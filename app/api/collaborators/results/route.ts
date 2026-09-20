import {database} from "@/db/raw";
import {newId} from "@/lib/property";
import {resultSchema,MAX_RESULTS} from "@/lib/collab";
import {guard} from "@/lib/access-server";
import {reply,sameOrigin,resultsFor} from "@/lib/collab-server";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const g=await guard(request,"partnerships","view");if("response" in g)return g.response;
 const ownerId=new URL(request.url).searchParams.get("ownerId");if(!ownerId)return reply({error:"Pedido inválido."},400);
 try{return reply({results:await resultsFor(ownerId)});}catch(e){console.error("Load results",e);return reply({error:"Não foi possível carregar os resultados. Tenta novamente."},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"partnerships","edit");if("response" in g)return g.response;
 try{
 const raw=await request.text();if(raw.length>10000)return reply({error:"Pedido demasiado grande."},413);
 let input;try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
 const parsed=resultSchema.safeParse(input);if(!parsed.success)return reply({error:parsed.error.issues[0].message,issues:parsed.error.issues},400);
 const r=parsed.data,db=database();
 if(!await db.prepare("SELECT 1 FROM collaborators WHERE id=?").bind(r.ownerId).first())return reply({error:"O registo já não existe. Recarrega a área."},404);
 const count=await db.prepare("SELECT COUNT(*) AS n FROM collaborator_results WHERE owner_id=?").bind(r.ownerId).first<{n:number}>();if((count?.n??0)>=MAX_RESULTS)return reply({error:"Foi atingido o limite de registos de resultados."},409);
 const id=newId();await db.prepare("INSERT INTO collaborator_results (id,owner_id,date,bookings,nights,revenue_cents,note,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,r.ownerId,r.date,r.bookings,r.nights,r.revenueCents,r.note.trim(),new Date().toISOString()).run();
 return reply({result:{id,date:r.date,bookings:r.bookings,nights:r.nights,revenueCents:r.revenueCents,note:r.note.trim()}},201);
 }catch(e){console.error("Save result",e);return reply({error:"Não foi possível guardar o resultado. Tenta novamente."},503);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"partnerships","edit");if("response" in g)return g.response;
 try{const u=new URL(request.url),id=u.searchParams.get("id"),ownerId=u.searchParams.get("ownerId");if(!id||!ownerId)return reply({error:"Pedido inválido."},400);
 await database().prepare("DELETE FROM collaborator_results WHERE id=? AND owner_id=?").bind(id,ownerId).run();return reply({ok:true});}
 catch(e){console.error("Delete result",e);return reply({error:"Não foi possível eliminar o resultado."},503);}
}
