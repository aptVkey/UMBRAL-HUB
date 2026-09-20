import {database} from "@/db/raw";
import {collaboratorSchema,normalizePromo} from "@/lib/collab";
import {guard} from "@/lib/access-server";
import {reply,sameOrigin,newToken,findOne,present,SELECT_WITH_TOTALS,type Row} from "@/lib/collab-server";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const g=await guard(request,"partnerships","view");if("response" in g)return g.response;
 const kind=new URL(request.url).searchParams.get("kind");if(kind!=="partner"&&kind!=="affiliate")return reply({error:"Pedido inválido."},400);
 try{const {results}=await database().prepare(`${SELECT_WITH_TOTALS} WHERE c.kind=? GROUP BY c.id ORDER BY c.name COLLATE NOCASE`).bind(kind).all<Row>();return reply({collaborators:results.map(present)});}
 catch(e){console.error("Load collaborators",e);return reply({error:"Não foi possível carregar os registos. Tenta novamente."},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"partnerships","edit");if("response" in g)return g.response;
 try{
 const raw=await request.text();if(raw.length>100000)return reply({error:"O registo excede o tamanho permitido."},413);
 let input;try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
 const result=collaboratorSchema.safeParse(input);if(!result.success)return reply({error:"Revê os campos assinalados.",issues:result.error.issues},400);
 const c=result.data,now=new Date().toISOString(),version=c.version+1,db=database();
 const promo=c.kind==="affiliate"&&c.promoCode?normalizePromo(c.promoCode):null;
 if(promo){
  const clash=await db.prepare("SELECT 1 FROM collaborators WHERE promo_code=? AND id<>? LIMIT 1").bind(promo,c.id).first()||await db.prepare("SELECT 1 FROM corporates WHERE upper(trim(json_extract(payload,'$.promoCode')))=? LIMIT 1").bind(promo).first();
  if(clash)return reply({error:"Este código promocional já está em uso.",issues:[{path:["promoCode"],message:"Escolhe um código que ainda não exista em afiliados ou acordos corporate."}]},409);
 }
 const payload=JSON.stringify({...c,promoCode:promo??"",version});
 const query=c.version===0
  ?db.prepare("INSERT INTO collaborators (id,kind,name,payload,version,updated_at,promo_code,share_token) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(c.id,c.kind,c.name,payload,version,now,promo,c.kind==="affiliate"?newToken():null)
  :db.prepare("UPDATE collaborators SET name=?,payload=?,version=?,updated_at=?,promo_code=? WHERE id=? AND version=? AND kind=?").bind(c.name,payload,version,now,promo,c.id,c.version,c.kind);
 let update;try{update=await query.run()}catch(e){if(String(e).includes("promo_code"))return reply({error:"Este código promocional já está em uso."},409);throw e}
 if(!update.meta.changes)return reply({error:"Este registo foi alterado noutra janela. As tuas alterações continuam aqui; copia-as antes de reabrir o registo atualizado."},409);
 return reply({collaborator:await findOne(c.id)},c.version===0?201:200);
 }catch(e){console.error("Save collaborator",e);return reply({error:"Não foi possível guardar. As tuas alterações foram mantidas. Tenta novamente."},503);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"partnerships","edit");if("response" in g)return g.response;
 try{const u=new URL(request.url),id=u.searchParams.get("id"),version=Number(u.searchParams.get("version"));if(!id||!Number.isInteger(version)||version<1)return reply({error:"Pedido inválido."},400);
 const r=await database().prepare("DELETE FROM collaborators WHERE id=? AND version=?").bind(id,version).run();
 if(!r.meta.changes)return reply({error:"O registo foi alterado. Reabre-o antes de eliminar."},409);return reply({ok:true});}
 catch(e){console.error("Delete collaborator",e);return reply({error:"Não foi possível eliminar o registo."},503);}
}
