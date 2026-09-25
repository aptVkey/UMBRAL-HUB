import {database} from "@/db/raw";
import {unlinkConflict,conflictMessage} from "./operator-server";
import {publishNewCustomAmenities} from "./amenity-catalog";
import type {Property} from "./property";
export type ApplyResult={ok:true,property:Property&{updatedAt:string}}|{ok:false,status:number,error:string};
/**
 * Grava um alojamento (criação ou atualização), com toda a sincronização relacional
 * (tarifas, keysafes, operadores parceiros) e os bloqueios de utilização por campanhas.
 * Partilhado pela rota direta (nível "edit") e pela aprovação de pedidos de alteração.
 */
export async function applyPropertySave(p:Property):Promise<ApplyResult>{
 const now=new Date().toISOString(),version=p.version+1,{partnerOperatorIds,keysafes,...core}=p,payload=JSON.stringify({...core,version});
 const db=database();
 const query=p.version===0?db.prepare("INSERT INTO properties (id,name,payload,version,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(p.id,p.name,payload,version,now):db.prepare("UPDATE properties SET name=?,payload=?,version=?,updated_at=? WHERE id=? AND version=?").bind(p.name,payload,version,now,p.id,p.version);
 if(p.version>0){ // tarifas e operadores usados em campanhas não podem desaparecer
  const inUse=async(table:string,link:string,col:string,keep:string[],what:string)=>{const row=await db.prepare(`SELECT x.name AS item,c.name AS campaign FROM ${link} l JOIN ${table} x ON x.id=l.${col} JOIN campaigns c ON c.id=l.campaign_id WHERE x.property_id=? AND x.id NOT IN (SELECT jsonb_array_elements_text(?::jsonb)) LIMIT 1`).bind(p.id,JSON.stringify(keep)).first<{item:string,campaign:string}>();return row?`${what} “${row.item||'sem nome'}” está a ser usad${what==='A tarifa'?'a':'o'} na campanha “${row.campaign}”. Remove-${what==='A tarifa'?'a':'o'} primeiro da campanha.`:''};
  const blocked=await inUse("property_rates","campaign_rates","rate_id",p.rates.map(r=>r.id),"A tarifa");
  if(blocked)return {ok:false,status:409,error:blocked};
  const {results:current}=await db.prepare("SELECT operator_id FROM operator_properties WHERE property_id=?").bind(p.id).all<{operator_id:string}>();
  for(const c of current.filter(c=>!partnerOperatorIds.includes(c.operator_id))){const conflict=await unlinkConflict(c.operator_id,p.id);if(conflict)return {ok:false,status:409,error:conflictMessage(conflict)};}
 }
 if(partnerOperatorIds.length&&(await db.prepare("SELECT COUNT(*) AS n FROM operators WHERE id IN (SELECT jsonb_array_elements_text(?::jsonb))").bind(JSON.stringify(partnerOperatorIds)).first<{n:number}>())?.n!==partnerOperatorIds.length)return {ok:false,status:409,error:"A lista de operadores mudou. Atualiza a ficha e revê a seleção de operadores parceiros."};
 const guard="EXISTS (SELECT 1 FROM properties WHERE id=? AND version=?)";
 const sync=[
  db.prepare(`DELETE FROM property_rates WHERE property_id=? AND id NOT IN (SELECT jsonb_array_elements_text(?::jsonb)) AND ${guard}`).bind(p.id,JSON.stringify(p.rates.map(r=>r.id)),p.id,version),
  db.prepare(`DELETE FROM operator_properties WHERE property_id=? AND ${guard}`).bind(p.id,p.id,version),
  db.prepare(`DELETE FROM unit_keysafes WHERE property_id=? AND ${guard}`).bind(p.id,p.id,version),
  ...Object.entries(keysafes).filter(([,c])=>c.trim()).map(([uid,c])=>db.prepare(`INSERT INTO unit_keysafes (unit_id,property_id,code,updated_at) SELECT ?,?,?,? WHERE ${guard}`).bind(uid,p.id,c.trim(),now,p.id,version)),
  ...partnerOperatorIds.map(oid=>db.prepare(`INSERT INTO operator_properties (operator_id,property_id) SELECT ?,? WHERE ${guard}`).bind(oid,p.id,p.id,version)),
  ...p.rates.map(r=>db.prepare(`INSERT INTO property_rates (id,property_id,name,code) SELECT ?,?,?,? WHERE ${guard} ON CONFLICT(id) DO UPDATE SET name=excluded.name,code=excluded.code WHERE property_rates.property_id=excluded.property_id`).bind(r.id,p.id,r.name,r.code,p.id,version)),
 ];
 const [update]=await db.batch([query,...sync]);if(!update.meta.changes)return {ok:false,status:409,error:"Esta ficha foi alterada noutra janela. As tuas alterações continuam aqui; copia-as antes de reabrir a ficha atualizada."};
 try{await publishNewCustomAmenities(p.amenities)}catch(e){console.error("Publish custom amenities",e)} // best-effort: a falha aqui não deve impedir a gravação do alojamento
 return {ok:true,property:{...p,version,updatedAt:now}};
}
export async function applyPropertyDelete(id:string,version:number):Promise<{ok:true}|{ok:false,status:number,error:string}>{
 const db=database();
 const linked=await db.prepare("SELECT corporate_id FROM corporate_properties WHERE property_id=? LIMIT 1").bind(id).first();
 if(linked)return {ok:false,status:409,error:"Este alojamento está associado a um acordo corporate. Remove primeiro a associação na ficha da empresa."};
 const inCampaign=await db.prepare("SELECT campaign_id FROM campaign_properties WHERE property_id=? LIMIT 1").bind(id).first();
 if(inCampaign)return {ok:false,status:409,error:"Este alojamento está associado a uma campanha. Remove primeiro a associação na ficha da campanha."};
 const r=await db.prepare("DELETE FROM properties WHERE id=? AND version=?").bind(id,version).run();
 if(!r.meta.changes)return {ok:false,status:409,error:"A ficha foi alterada. Reabre-a antes de eliminar."};
 return {ok:true};
}
