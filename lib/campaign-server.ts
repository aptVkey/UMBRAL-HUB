import {database} from "@/db/raw";
import type {Campaign,SavedCampaign} from "./campaign";
export const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
export type Row={id:string,payload:string,version:number,updated_at:string};
export type Links={propertyIds:string[],operatorIds:string[],rateIds:string[]};
/** As relações (alojamentos, operadores, tarifas) vêm sempre das tabelas de ligação, não do JSON. */
export const present=(r:Row,l:Links):SavedCampaign=>({...JSON.parse(r.payload),...l,version:r.version,updatedAt:r.updated_at});
export const group=(rows:{campaign_id:string,ref:string}[])=>{const m=new Map<string,string[]>();for(const r of rows)m.set(r.campaign_id,[...(m.get(r.campaign_id)||[]),r.ref]);return m};
export type ApplyResult={ok:true,campaign:SavedCampaign}|{ok:false,status:number,error:string,issues?:{path:(string|number)[],message:string}[]};
/**
 * Grava uma campanha (criação ou atualização), com a validação das relações (alojamentos,
 * operadores, tarifas). Partilhado pela rota direta (nível "edit") e pela aprovação de pedidos.
 */
export async function applyCampaignSave(c:Campaign):Promise<ApplyResult>{
 const db=database();
 const count=async(sql:string,ids:string[])=>ids.length?(await db.prepare(sql).bind(JSON.stringify(ids),JSON.stringify(c.propertyIds)).first<{n:number}>())?.n??0:0;
 if(c.propertyIds.length&&(await db.prepare("SELECT COUNT(*) AS n FROM properties WHERE id IN (SELECT jsonb_array_elements_text(?::jsonb))").bind(JSON.stringify(c.propertyIds)).first<{n:number}>())?.n!==c.propertyIds.length)return {ok:false,status:409,error:"A lista de alojamentos mudou. Atualiza a lista no separador Alojamentos e revê a seleção."};
 if(await count("SELECT COUNT(*) AS n FROM property_rates WHERE id IN (SELECT jsonb_array_elements_text(?::jsonb)) AND property_id IN (SELECT jsonb_array_elements_text(?::jsonb))",c.rateIds)!==c.rateIds.length)return {ok:false,status:409,error:"Uma tarifa selecionada já não existe ou não pertence aos alojamentos da campanha. Revê o separador Tarifas.",issues:[{path:["rateIds"],message:"Existem tarifas indisponíveis."}]};
 if(await count("SELECT COUNT(DISTINCT operator_id) AS n FROM operator_properties WHERE operator_id IN (SELECT jsonb_array_elements_text(?::jsonb)) AND property_id IN (SELECT jsonb_array_elements_text(?::jsonb))",c.operatorIds)!==c.operatorIds.length)return {ok:false,status:409,error:"Um operador selecionado já não existe ou não trabalha com os alojamentos da campanha. Revê o separador Operadores.",issues:[{path:["operatorIds"],message:"Existem operadores indisponíveis."}]};
 const now=new Date().toISOString(),version=c.version+1,token=crypto.randomUUID();
 const {propertyIds,operatorIds,rateIds,...core}=c,payload=JSON.stringify({...core,version});
 const first=c.version===0?db.prepare("INSERT INTO campaigns (id,name,payload,version,updated_at,last_write_id) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(c.id,c.name,payload,version,now,token):db.prepare("UPDATE campaigns SET name=?,payload=?,version=?,updated_at=?,last_write_id=? WHERE id=? AND version=?").bind(c.name,payload,version,now,token,c.id,c.version);
 const guard="EXISTS (SELECT 1 FROM campaigns WHERE id=? AND last_write_id=?)";
 const link=(table:string,col:string,ids:string[])=>[db.prepare(`DELETE FROM ${table} WHERE campaign_id=? AND ${guard}`).bind(c.id,c.id,token),...ids.map(id=>db.prepare(`INSERT INTO ${table} (campaign_id,${col}) SELECT ?,? WHERE ${guard}`).bind(c.id,id,c.id,token))];
 const saved=await db.batch([first,...link("campaign_properties","property_id",propertyIds),...link("campaign_operators","operator_id",operatorIds),...link("campaign_rates","rate_id",rateIds)]);
 if(!saved[0].meta.changes)return {ok:false,status:409,error:"Esta campanha foi alterada noutra janela. As tuas alterações continuam aqui; copia-as antes de reabrir a campanha atualizada."};
 return {ok:true,campaign:present({id:c.id,payload,version,updated_at:now},{propertyIds,operatorIds,rateIds})};
}
export async function applyCampaignDelete(id:string,version:number):Promise<{ok:true}|{ok:false,status:number,error:string}>{
 const r=await database().prepare("DELETE FROM campaigns WHERE id=? AND version=?").bind(id,version).run();
 if(!r.meta.changes)return {ok:false,status:409,error:"A campanha foi alterada. Reabre-a antes de eliminar."};
 return {ok:true};
}
