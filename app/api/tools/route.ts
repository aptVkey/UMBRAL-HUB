import {database} from "@/db/raw";
import {toolSchema} from "@/lib/tool";
import {guard,guardEditable} from "@/lib/access-server";
import {createChangeRequest} from "@/lib/change-request-server";
import {applyToolSave,applyToolDelete} from "@/lib/tool-server";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
export async function GET(request:Request){
 const g=await guard(request,"tools","view");if("response" in g)return g.response;
 try{const {results}=await database().prepare("SELECT id,payload,version,updated_at FROM tools ORDER BY lower(name)").all<{id:string,payload:string,version:number,updated_at:string}>();return reply({tools:results.map(r=>({...JSON.parse(r.payload),id:r.id,version:r.version,updatedAt:r.updated_at}))});}
 catch(e){console.error("Load tools",e);return reply({error:"Não foi possível carregar as ferramentas. Tenta novamente."},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"tools");if("response" in g)return g.response;
 try{
 const raw=await request.text();if(raw.length>10000)return reply({error:"O pedido excede o tamanho permitido."},413);
 let input;try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
 const parsed=toolSchema.safeParse(input);if(!parsed.success)return reply({error:parsed.error.issues[0].message,issues:parsed.error.issues},400);
 const t=parsed.data;
 if(g.mode==="propose"){
  const requestId=await createChangeRequest({area:"tools",entityType:"tool",entityId:t.id,entityName:t.name,action:"save",payload:t,baseVersion:t.version,access:g.access});
  return reply({proposal:true,requestId,message:"As alterações foram enviadas para aprovação. Um editor ou administrador tem de as aceitar antes de ficarem visíveis."},202);
 }
 const r=await applyToolSave(t);
 if(!r.ok)return reply({error:r.error},r.status);
 return reply({tool:r.tool},t.version===0?201:200);
 }catch(e){console.error("Save tool",e);return reply({error:"Não foi possível guardar. As tuas alterações foram mantidas. Tenta novamente."},503);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"tools");if("response" in g)return g.response;
 try{const u=new URL(request.url),id=u.searchParams.get("id"),version=Number(u.searchParams.get("version"));if(!id||!Number.isInteger(version)||version<1)return reply({error:"Pedido inválido."},400);
 if(g.mode==="propose"){
  const row=await database().prepare("SELECT name FROM tools WHERE id=?").bind(id).first<{name:string}>();
  if(!row)return reply({error:"A ferramenta já não existe."},404);
  const requestId=await createChangeRequest({area:"tools",entityType:"tool",entityId:id,entityName:row.name,action:"delete",payload:null,baseVersion:version,access:g.access});
  return reply({proposal:true,requestId,message:"O pedido de eliminação foi enviado para aprovação."},202);
 }
 const r=await applyToolDelete(id,version);
 if(!r.ok)return reply({error:r.error},r.status);
 return reply({ok:true});}
 catch(e){console.error("Delete tool",e);return reply({error:"Não foi possível eliminar a ferramenta."},503);}
}
