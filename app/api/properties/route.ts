import { database } from "@/db/raw";
import { propertySchema } from "@/lib/property";
import {guard,deny,propertyAllowed} from "@/lib/access-server";
import {unlinkConflict,conflictMessage} from "@/lib/operator-server";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
function sameOrigin(r:Request){const origin=r.headers.get("origin");return !origin||origin===new URL(r.url).origin;}
export async function GET(request:Request){const g=await guard(request,["properties","corporates","campaigns"],"view");if("response" in g)return g.response;const access=g.access;try{const db=database();const [rows,links,safes]=await db.batch([db.prepare("SELECT payload, version, updated_at FROM properties ORDER BY name COLLATE NOCASE"),db.prepare("SELECT operator_id,property_id FROM operator_properties"),db.prepare("SELECT unit_id,property_id,code FROM unit_keysafes")]);const codes=new Map<string,Record<string,string>>();if(access.areas.properties!=="none")for(const k of safes.results as {unit_id:string,property_id:string,code:string}[])codes.set(k.property_id,{...(codes.get(k.property_id)||{}),[k.unit_id]:k.code});const partners=new Map<string,string[]>();for(const l of links.results as {operator_id:string,property_id:string}[])partners.set(l.property_id,[...(partners.get(l.property_id)||[]),l.operator_id]);return reply({properties:(rows.results as {payload:string,version:number,updated_at:string}[]).map(r=>{const p=JSON.parse(r.payload);return {...p,partnerOperatorIds:partners.get(p.id)||[],keysafes:codes.get(p.id)||{},version:r.version,updatedAt:r.updated_at}}).filter(p=>propertyAllowed(access,p.id))});}catch(e){console.error("Load properties",e);return reply({error:"Não foi possível carregar os alojamentos. Tenta novamente."},503);}}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"properties","edit");if("response" in g)return g.response;const access=g.access;
 try{
 const raw=await request.text();if(raw.length>250000)return reply({error:"A ficha excede o tamanho permitido."},413);
 let input;try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
 const result=propertySchema.safeParse(input);if(!result.success)return reply({error:"Revê os campos assinalados.",issues:result.error.issues},400);
 const p=result.data;if(access.propertyIds!==null&&(p.version===0||!propertyAllowed(access,p.id)))return deny("O teu acesso está limitado a alguns alojamentos.");const now=new Date().toISOString(),version=p.version+1,{partnerOperatorIds,keysafes,...core}=p,payload=JSON.stringify({...core,version});
 const query=p.version===0?database().prepare("INSERT INTO properties (id,name,payload,version,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(p.id,p.name,payload,version,now):database().prepare("UPDATE properties SET name=?,payload=?,version=?,updated_at=? WHERE id=? AND version=?").bind(p.name,payload,version,now,p.id,p.version);
 const db=database();
 if(p.version>0){ // tarifas e operadores usados em campanhas não podem desaparecer
  const inUse=async(table:string,link:string,col:string,keep:string[],what:string)=>{const row=await db.prepare(`SELECT x.name AS item,c.name AS campaign FROM ${link} l JOIN ${table} x ON x.id=l.${col} JOIN campaigns c ON c.id=l.campaign_id WHERE x.property_id=? AND x.id NOT IN (SELECT value FROM json_each(?)) LIMIT 1`).bind(p.id,JSON.stringify(keep)).first<{item:string,campaign:string}>();return row?`${what} “${row.item||'sem nome'}” está a ser usad${what==='A tarifa'?'a':'o'} na campanha “${row.campaign}”. Remove-${what==='A tarifa'?'a':'o'} primeiro da campanha.`:''};
  const blocked=await inUse("property_rates","campaign_rates","rate_id",p.rates.map(r=>r.id),"A tarifa");
  if(blocked)return reply({error:blocked},409);
  const {results:current}=await db.prepare("SELECT operator_id FROM operator_properties WHERE property_id=?").bind(p.id).all<{operator_id:string}>();
  for(const c of current.filter(c=>!partnerOperatorIds.includes(c.operator_id))){const conflict=await unlinkConflict(c.operator_id,p.id);if(conflict)return reply({error:conflictMessage(conflict)},409);}
 }
 if(partnerOperatorIds.length&&(await db.prepare("SELECT COUNT(*) AS n FROM operators WHERE id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(partnerOperatorIds)).first<{n:number}>())?.n!==partnerOperatorIds.length)return reply({error:"A lista de operadores mudou. Atualiza a ficha e revê a seleção de operadores parceiros."},409);
 const guard="EXISTS (SELECT 1 FROM properties WHERE id=? AND version=?)";
 const sync=[
  db.prepare(`DELETE FROM property_rates WHERE property_id=? AND id NOT IN (SELECT value FROM json_each(?)) AND ${guard}`).bind(p.id,JSON.stringify(p.rates.map(r=>r.id)),p.id,version),
  db.prepare(`DELETE FROM operator_properties WHERE property_id=? AND ${guard}`).bind(p.id,p.id,version),
  db.prepare(`DELETE FROM unit_keysafes WHERE property_id=? AND ${guard}`).bind(p.id,p.id,version),
  ...Object.entries(keysafes).filter(([,c])=>c.trim()).map(([uid,c])=>db.prepare(`INSERT INTO unit_keysafes (unit_id,property_id,code,updated_at) SELECT ?,?,?,? WHERE ${guard}`).bind(uid,p.id,c.trim(),now,p.id,version)),
  ...partnerOperatorIds.map(oid=>db.prepare(`INSERT INTO operator_properties (operator_id,property_id) SELECT ?,? WHERE ${guard}`).bind(oid,p.id,p.id,version)),
  ...p.rates.map(r=>db.prepare(`INSERT INTO property_rates (id,property_id,name,code) SELECT ?,?,?,? WHERE ${guard} ON CONFLICT(id) DO UPDATE SET name=excluded.name,code=excluded.code WHERE property_id=excluded.property_id`).bind(r.id,p.id,r.name,r.code,p.id,version)),
 ];
 const [update]=await db.batch([query,...sync]);if(!update.meta.changes)return reply({error:"Esta ficha foi alterada noutra janela. As tuas alterações continuam aqui; copia-as antes de reabrir a ficha atualizada."},409);
 return reply({property:{...p,version,updatedAt:now}},p.version===0?201:200);
 }catch(e){console.error("Save property",e);return reply({error:"Não foi possível guardar. As tuas alterações foram mantidas. Tenta novamente."},503);}
}
export async function DELETE(request:Request){if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);const g=await guard(request,"properties","edit");if("response" in g)return g.response;const access=g.access;try{const u=new URL(request.url),id=u.searchParams.get("id"),version=Number(u.searchParams.get("version"));if(!id||!Number.isInteger(version)||version<1)return reply({error:"Pedido inválido."},400);if(!propertyAllowed(access,id))return deny("O teu acesso está limitado a alguns alojamentos.");const linked=await database().prepare("SELECT corporate_id FROM corporate_properties WHERE property_id=? LIMIT 1").bind(id).first();if(linked)return reply({error:"Este alojamento está associado a um acordo corporate. Remove primeiro a associação na ficha da empresa."},409);const inCampaign=await database().prepare("SELECT campaign_id FROM campaign_properties WHERE property_id=? LIMIT 1").bind(id).first();if(inCampaign)return reply({error:"Este alojamento está associado a uma campanha. Remove primeiro a associação na ficha da campanha."},409);const r=await database().prepare("DELETE FROM properties WHERE id=? AND version=?").bind(id,version).run();if(!r.meta.changes)return reply({error:"A ficha foi alterada. Reabre-a antes de eliminar."},409);return reply({ok:true});}catch(e){console.error("Delete property",e);return reply({error:"Não foi possível eliminar o alojamento."},503);}}
