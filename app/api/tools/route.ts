import {database} from "@/db/raw";
import {toolSchema} from "@/lib/tool";
import {guard} from "@/lib/access-server";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
export async function GET(request:Request){
 const g=await guard(request,"tools","view");if("response" in g)return g.response;
 try{const {results}=await database().prepare("SELECT payload,version,updated_at FROM tools ORDER BY name COLLATE NOCASE").all<{payload:string,version:number,updated_at:string}>();return reply({tools:results.map(r=>({...JSON.parse(r.payload),version:r.version,updatedAt:r.updated_at}))});}
 catch(e){console.error("Load tools",e);return reply({error:"Não foi possível carregar as ferramentas. Tenta novamente."},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"tools","edit");if("response" in g)return g.response;
 try{
 const raw=await request.text();if(raw.length>10000)return reply({error:"O pedido excede o tamanho permitido."},413);
 let input;try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
 const parsed=toolSchema.safeParse(input);if(!parsed.success)return reply({error:parsed.error.issues[0].message,issues:parsed.error.issues},400);
 const t=parsed.data,db=database(),now=new Date().toISOString(),version=t.version+1,payload=JSON.stringify({...t,version});
 const q=t.version===0?db.prepare("INSERT INTO tools (id,name,payload,version,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(t.id,t.name,payload,version,now):db.prepare("UPDATE tools SET name=?,payload=?,version=?,updated_at=? WHERE id=? AND version=?").bind(t.name,payload,version,now,t.id,t.version);
 const r=await q.run();if(!r.meta.changes)return reply({error:"Esta ferramenta foi alterada noutra janela. Fecha e volta a abrir o card para veres a versão atual."},409);
 return reply({tool:{...t,version,updatedAt:now}},t.version===0?201:200);
 }catch(e){console.error("Save tool",e);return reply({error:"Não foi possível guardar. As tuas alterações foram mantidas. Tenta novamente."},503);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"tools","edit");if("response" in g)return g.response;
 try{const u=new URL(request.url),id=u.searchParams.get("id"),version=Number(u.searchParams.get("version"));if(!id||!Number.isInteger(version)||version<1)return reply({error:"Pedido inválido."},400);
 const r=await database().prepare("DELETE FROM tools WHERE id=? AND version=?").bind(id,version).run();if(!r.meta.changes)return reply({error:"O card foi alterado ou já não existe. Recarrega a lista."},409);return reply({ok:true});}
 catch(e){console.error("Delete tool",e);return reply({error:"Não foi possível eliminar a ferramenta."},503);}
}
