import {database} from "@/db/raw";
import type {Access} from "./access-server";
import {propertyAllowed} from "./access-server";
import type {Operator,SavedOperator} from "./operator";
import {bucket} from "./corporate-server";
export {reply,sameOrigin,bucket,boundedForm} from "./corporate-server";
/** Um operador não pode perder um alojamento que uma campanha ainda usa com esse operador. */
export async function unlinkConflict(operatorId:string,propertyId:string){
 return database().prepare(`SELECT c.name AS campaign,o.name AS operator FROM campaign_operators co JOIN campaigns c ON c.id=co.campaign_id JOIN operators o ON o.id=co.operator_id JOIN campaign_properties cp ON cp.campaign_id=co.campaign_id AND cp.property_id=?2 WHERE co.operator_id=?1 AND NOT EXISTS (SELECT 1 FROM campaign_properties cp2 JOIN operator_properties op ON op.property_id=cp2.property_id AND op.operator_id=co.operator_id WHERE cp2.campaign_id=co.campaign_id AND cp2.property_id<>?2) LIMIT 1`).bind(operatorId,propertyId).first<{campaign:string,operator:string}>();
}
export const conflictMessage=(c:{campaign:string,operator:string})=>`O operador “${c.operator}” está a ser usado na campanha “${c.campaign}” neste alojamento. Remove-o primeiro da campanha.`;
export async function linkedProperties(operatorId:string){const {results}=await database().prepare("SELECT property_id FROM operator_properties WHERE operator_id=?").bind(operatorId).all<{property_id:string}>();return results.map(r=>r.property_id);}
/** Só aceita tipos permitidos cujo conteúdo corresponde à extensão. */
export async function attachmentType(file:File){
 const b=new Uint8Array(await file.slice(0,16).arrayBuffer()),ext=file.name.split(".").pop()?.toLowerCase();const is=(a:number[])=>a.every((x,i)=>b[i]===x);
 const OLE=[208,207,17,224,161,177,26,225],ZIP=[80,75,3,4];
 if(ext==="pdf"&&is([37,80,68,70,45]))return "application/pdf";
 if(ext==="doc"&&is(OLE))return "application/msword";
 if(ext==="xls"&&is(OLE))return "application/vnd.ms-excel";
 if(ext==="docx"&&is(ZIP))return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
 if(ext==="xlsx"&&is(ZIP))return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
 if(ext==="png"&&is([137,80,78,71,13,10,26,10]))return "image/png";
 if((ext==="jpg"||ext==="jpeg")&&is([255,216,255]))return "image/jpeg";
 return null;
}
/** Alojamentos fora do âmbito de quem propõe mantêm-se ligados; só o que está ao seu alcance muda. */
export function scopedOperatorProperties(access:Access,submitted:string[],existing:string[]){
 return access.propertyIds===null?submitted:[...submitted.filter(id=>propertyAllowed(access,id)),...existing.filter(id=>!propertyAllowed(access,id))];
}
export type ApplyOperatorResult={ok:true,operator:SavedOperator}|{ok:false,status:number,error:string};
/**
 * Grava um operador (criação ou atualização) com a ligação aos alojamentos escolhidos.
 * Partilhado pela rota direta (nível "edit") e pela aprovação de pedidos de alteração.
 * `propertyIds` já deve vir ajustado ao âmbito de quem gravou (scopedOperatorProperties).
 */
export async function applyOperatorSave(o:Operator,propertyIds:string[]):Promise<ApplyOperatorResult>{
 const db=database();
 if(propertyIds.length&&(await db.prepare("SELECT COUNT(*) AS n FROM properties WHERE id IN (SELECT jsonb_array_elements_text(?::jsonb))").bind(JSON.stringify(propertyIds)).first<{n:number}>())?.n!==propertyIds.length)return {ok:false,status:409,error:"A lista de alojamentos mudou. Atualiza a lista no separador Alojamentos e revê a seleção."};
 const existing=await linkedProperties(o.id);
 for(const removed of existing.filter(id=>!propertyIds.includes(id))){const c=await unlinkConflict(o.id,removed);if(c)return {ok:false,status:409,error:conflictMessage(c)};}
 const now=new Date().toISOString(),version=o.version+1,token=crypto.randomUUID();
 const {propertyIds:_ignored,...core}=o,payload=JSON.stringify({...core,version});
 const first=o.version===0?db.prepare("INSERT INTO operators (id,name,payload,version,updated_at,last_write_id) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(o.id,o.name,payload,version,now,token):db.prepare("UPDATE operators SET name=?,payload=?,version=?,updated_at=?,last_write_id=? WHERE id=? AND version=?").bind(o.name,payload,version,now,token,o.id,o.version);
 const guardSql="EXISTS (SELECT 1 FROM operators WHERE id=? AND last_write_id=?)";
 const saved=await db.batch([first,db.prepare(`DELETE FROM operator_properties WHERE operator_id=? AND ${guardSql}`).bind(o.id,o.id,token),...propertyIds.map(id=>db.prepare(`INSERT INTO operator_properties (operator_id,property_id) SELECT ?,? WHERE ${guardSql}`).bind(o.id,id,o.id,token))]);
 if(!saved[0].meta.changes)return {ok:false,status:409,error:"Este operador foi alterado noutra janela. Reabre a ficha atualizada antes de voltar a guardar."};
 return {ok:true,operator:{...core,propertyIds,version,updatedAt:now} as SavedOperator};
}
export async function applyOperatorDelete(id:string,version:number):Promise<{ok:true}|{ok:false,status:number,error:string}>{
 const db=database();
 const used=await db.prepare("SELECT c.name FROM campaign_operators co JOIN campaigns c ON c.id=co.campaign_id WHERE co.operator_id=? LIMIT 1").bind(id).first<{name:string}>();
 if(used)return {ok:false,status:409,error:`Este operador está a ser usado na campanha “${used.name}”. Remove-o primeiro da campanha.`};
 const {results:files}=await db.prepare("SELECT a.key FROM operator_attachments a JOIN operator_messages m ON m.id=a.message_id WHERE m.operator_id=?").bind(id).all<{key:string}>();
 const r=await db.prepare("DELETE FROM operators WHERE id=? AND version=?").bind(id,version).run();
 if(!r.meta.changes)return {ok:false,status:409,error:"O operador foi alterado. Reabre-o antes de eliminar."};
 for(const f of files){try{await bucket().delete(f.key)}catch(e){console.error("Remove attachment",e)}}
 return {ok:true};
}
