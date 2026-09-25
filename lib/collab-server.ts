import {database} from "@/db/raw";
import {normalizePromo} from "./collab";
import type {Collaborator,ResultRow,SavedCollaborator} from "./collab";
export const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
export const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
export type Row={id:string;payload:string;version:number;updated_at:string;share_token:string|null;bookings:number;nights:number;revenue_cents:number};
export const SELECT_WITH_TOTALS=`SELECT c.id,c.payload,c.version,c.updated_at,c.share_token,COALESCE(SUM(r.bookings),0) AS bookings,COALESCE(SUM(r.nights),0) AS nights,COALESCE(SUM(r.revenue_cents),0) AS revenue_cents FROM collaborators c LEFT JOIN collaborator_results r ON r.owner_id=c.id`;
export function present(r:Row):SavedCollaborator{return {...JSON.parse(r.payload) as Collaborator,id:r.id,version:r.version,updatedAt:r.updated_at,shareToken:r.share_token,totals:{bookings:r.bookings,nights:r.nights,revenueCents:r.revenue_cents}};}
/** Token de 192 bits; é a única credencial do link público do afiliado. */
export function newToken(){const b=crypto.getRandomValues(new Uint8Array(24));return btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
export async function findOne(id:string){const r=await database().prepare(`${SELECT_WITH_TOTALS} WHERE c.id=? GROUP BY c.id`).bind(id).first<Row>();return r?present(r):null;}
export type DbResult={id:string;date:string;bookings:number;nights:number;revenue_cents:number;note:string};
export const toResult=(r:DbResult):ResultRow=>({id:r.id,date:r.date,bookings:r.bookings,nights:r.nights,revenueCents:r.revenue_cents,note:r.note});
export async function resultsFor(ownerId:string){const {results}=await database().prepare("SELECT id,date,bookings,nights,revenue_cents,note FROM collaborator_results WHERE owner_id=? ORDER BY date DESC,created_at DESC").bind(ownerId).all<DbResult>();return results.map(toResult);}
export type ApplyCollabResult={ok:true,collaborator:SavedCollaborator}|{ok:false,status:number,error:string,issues?:{path:(string|number)[],message:string}[]};
/**
 * Grava um parceiro ou afiliado (criação ou atualização), com a verificação de código
 * promocional único. Partilhado pela rota direta (nível "edit") e pela aprovação de pedidos.
 */
export async function applyCollaboratorSave(c:Collaborator):Promise<ApplyCollabResult>{
 const db=database(),now=new Date().toISOString(),version=c.version+1;
 const promo=c.kind==="affiliate"&&c.promoCode?normalizePromo(c.promoCode):null;
 if(promo){
  const clash=await db.prepare("SELECT 1 FROM collaborators WHERE promo_code=? AND id<>? LIMIT 1").bind(promo,c.id).first()||await db.prepare("SELECT 1 FROM corporates WHERE upper(trim(payload::jsonb->>'promoCode'))=? LIMIT 1").bind(promo).first();
  if(clash)return {ok:false,status:409,error:"Este código promocional já está em uso.",issues:[{path:["promoCode"],message:"Escolhe um código que ainda não exista em afiliados ou acordos corporate."}]};
 }
 const payload=JSON.stringify({...c,promoCode:promo??"",version});
 const query=c.version===0
  ?db.prepare("INSERT INTO collaborators (id,kind,name,payload,version,updated_at,promo_code,share_token) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(c.id,c.kind,c.name,payload,version,now,promo,c.kind==="affiliate"?newToken():null)
  :db.prepare("UPDATE collaborators SET name=?,payload=?,version=?,updated_at=?,promo_code=? WHERE id=? AND version=? AND kind=?").bind(c.name,payload,version,now,promo,c.id,c.version,c.kind);
 let update;try{update=await query.run()}catch(e){if(String(e).includes("promo_code"))return {ok:false,status:409,error:"Este código promocional já está em uso."};throw e}
 if(!update.meta.changes)return {ok:false,status:409,error:"Este registo foi alterado noutra janela. As tuas alterações continuam aqui; copia-as antes de reabrir o registo atualizado."};
 const saved=await findOne(c.id);if(!saved)return {ok:false,status:503,error:"Não foi possível confirmar o registo guardado. Recarrega a lista."};
 return {ok:true,collaborator:saved};
}
export async function applyCollaboratorDelete(id:string,version:number):Promise<{ok:true}|{ok:false,status:number,error:string}>{
 const r=await database().prepare("DELETE FROM collaborators WHERE id=? AND version=?").bind(id,version).run();
 if(!r.meta.changes)return {ok:false,status:409,error:"O registo foi alterado. Reabre-o antes de eliminar."};
 return {ok:true};
}
