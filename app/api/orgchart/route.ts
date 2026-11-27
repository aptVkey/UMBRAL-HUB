import {database} from "@/db/raw";
import {guard} from "@/lib/access-server";
import {orgChartSchema,orgChartSeed} from "@/lib/orgchart";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
const ID="umbral",LIMIT=300000;

export async function GET(request:Request){
 const g=await guard(request,"orgchart","view");if("response" in g)return g.response;
 try{
  const row=await database().prepare("SELECT payload,version,updated_at,updated_by FROM org_chart WHERE id=?").bind(ID).first<{payload:string,version:number,updated_at:string,updated_by:string}>();
  // Enquanto ninguém editar, mostra o organograma inicial (versão 0).
  if(!row)return reply({chart:orgChartSeed(),updatedAt:null,updatedBy:""});
  const parsed=orgChartSchema.safeParse({...JSON.parse(row.payload),version:row.version});
  return reply({chart:parsed.success?parsed.data:{...JSON.parse(row.payload),version:row.version},updatedAt:row.updated_at,updatedBy:row.updated_by});
 }catch(e){console.error("Load org chart",e);return reply({error:"Não foi possível carregar o organograma. Tenta novamente."},503)}
}

/** Grava o organograma inteiro. Só quem tem edição; a versão evita apagar alterações feitas noutra janela. */
export async function PUT(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"orgchart","edit");if("response" in g)return g.response;
 try{
  const raw=await request.text();if(raw.length>LIMIT)return reply({error:"O organograma excede o tamanho permitido."},413);
  let input;try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
  const parsed=orgChartSchema.safeParse(input);if(!parsed.success)return reply({error:parsed.error.issues[0].message},400);
  const data=parsed.data,version=data.version+1,now=new Date().toISOString(),by=g.access.name||g.access.email;
  const payload=JSON.stringify({boxes:data.boxes});
  const db=database();
  const result=data.version===0
   ?await db.prepare("INSERT INTO org_chart (id,payload,version,updated_at,updated_by) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(ID,payload,version,now,by).run()
   :await db.prepare("UPDATE org_chart SET payload=?,version=?,updated_at=?,updated_by=? WHERE id=? AND version=?").bind(payload,version,now,by,ID,data.version).run();
  if(!result.meta.changes)return reply({error:"O organograma foi alterado noutra janela. Recarrega para veres a versão mais recente."},409);
  return reply({chart:{...data,version},updatedAt:now,updatedBy:by});
 }catch(e){console.error("Save org chart",e);return reply({error:"Não foi possível guardar o organograma. Tenta novamente."},503)}
}
