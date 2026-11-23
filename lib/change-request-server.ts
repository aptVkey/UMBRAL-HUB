import {database} from "@/db/raw";
import {newId} from "./property";
import type {Access} from "./access-server";
import type {AreaKey} from "./access";
import {notifyApprovalRequested} from "./notify-server";
import type {ChangeRequest,ChangeAction,ChangeStatus,EntityType} from "./change-request";
export const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
type Row={id:string,area:string,entity_type:string,entity_id:string,entity_name:string,action:string,payload:string|null,base_version:number,status:string,requested_by_email:string,requested_by_name:string,requested_at:string,reviewed_by_email:string|null,reviewed_by_name:string|null,reviewed_at:string|null,review_note:string|null};
const present=(r:Row):ChangeRequest=>({id:r.id,area:r.area as AreaKey,entityType:r.entity_type as EntityType,entityId:r.entity_id,entityName:r.entity_name,action:r.action as ChangeAction,payload:r.payload?JSON.parse(r.payload):null,baseVersion:r.base_version,status:r.status as ChangeStatus,requestedByEmail:r.requested_by_email,requestedByName:r.requested_by_name,requestedAt:r.requested_at,reviewedByEmail:r.reviewed_by_email,reviewedByName:r.reviewed_by_name,reviewedAt:r.reviewed_at,reviewNote:r.review_note});
/** Regista um pedido de alteração. Chamado pelas rotas de escrita quando o autor só tem nível "propose". */
export async function createChangeRequest(opts:{area:AreaKey,entityType:EntityType,entityId:string,entityName:string,action:ChangeAction,payload:unknown,baseVersion:number,access:Access}){
 const id=newId(),now=new Date().toISOString();
 await database().prepare("INSERT INTO change_requests (id,area,entity_type,entity_id,entity_name,action,payload,base_version,status,requested_by_email,requested_by_name,requested_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
  .bind(id,opts.area,opts.entityType,opts.entityId,opts.entityName.slice(0,180),opts.action,opts.payload?JSON.stringify(opts.payload):null,opts.baseVersion,"pending",opts.access.email,opts.access.name,now).run();
 await notifyApprovalRequested({area:opts.area,entityType:opts.entityType,entityId:opts.entityId,entityName:opts.entityName.slice(0,180),action:opts.action,access:opts.access});
 return id;
}
/** Pedidos visíveis para este utilizador: os que pode rever (área em "edit", ou administrador) e os seus próprios. */
export async function listChangeRequests(access:Access,status?:ChangeStatus){
 const {results}=await database().prepare(status?"SELECT * FROM change_requests WHERE status=? ORDER BY requested_at DESC LIMIT 300":"SELECT * FROM change_requests ORDER BY requested_at DESC LIMIT 300").bind(...(status?[status]:[])).all<Row>();
 return results.map(present).filter(r=>access.isAdmin||access.areas[r.area]==="edit"||r.requestedByEmail===access.email);
}
/** Conta os pedidos pendentes que este utilizador pode rever (para o sino de notificações). */
export async function countReviewable(access:Access){
 if(!access.isAdmin&&!Object.values(access.areas).some(l=>l==="edit"))return 0;
 const {results}=await database().prepare("SELECT area FROM change_requests WHERE status='pending'").all<{area:string}>();
 return results.filter(r=>access.isAdmin||access.areas[r.area as AreaKey]==="edit").length;
}
export async function getChangeRequest(id:string){const r=await database().prepare("SELECT * FROM change_requests WHERE id=?").bind(id).first<Row>();return r?present(r):null;}
export async function markDecided(id:string,status:"approved"|"rejected",access:Access,note?:string){
 const now=new Date().toISOString();
 const r=await database().prepare("UPDATE change_requests SET status=?,reviewed_by_email=?,reviewed_by_name=?,reviewed_at=?,review_note=? WHERE id=? AND status='pending'")
  .bind(status,access.email,access.name,now,note?.trim()||null,id).run();
 return r.meta.changes>0;
}
