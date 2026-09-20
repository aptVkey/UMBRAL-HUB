import {database} from "@/db/raw";
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
