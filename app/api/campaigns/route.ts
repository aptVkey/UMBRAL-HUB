import {database} from "@/db/raw";
import {campaignSchema,type SavedCampaign} from "@/lib/campaign";
import {guard,deny,scopeOk,scopeVisible,linkedProperties} from "@/lib/access-server";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
type Row={id:string,payload:string,version:number,updated_at:string};
type Links={propertyIds:string[],operatorIds:string[],rateIds:string[]};
/** As relações (alojamentos, operadores, tarifas) vêm sempre das tabelas de ligação, não do JSON. */
const present=(r:Row,l:Links):SavedCampaign=>({...JSON.parse(r.payload),...l,version:r.version,updatedAt:r.updated_at});
const group=(rows:{campaign_id:string,ref:string}[])=>{const m=new Map<string,string[]>();for(const r of rows)m.set(r.campaign_id,[...(m.get(r.campaign_id)||[]),r.ref]);return m};
export async function GET(request:Request){const g=await guard(request,"campaigns","view");if("response" in g)return g.response;const access=g.access;try{const db=database();
 const [c,p,o,r]=await db.batch([db.prepare("SELECT id,payload,version,updated_at FROM campaigns ORDER BY lower(name)"),db.prepare("SELECT campaign_id,property_id AS ref FROM campaign_properties"),db.prepare("SELECT campaign_id,operator_id AS ref FROM campaign_operators"),db.prepare("SELECT campaign_id,rate_id AS ref FROM campaign_rates")]);
 const [P,O,R]=[p,o,r].map(x=>group(x.results as {campaign_id:string,ref:string}[]));
 return reply({campaigns:(c.results as Row[]).map(x=>present(x,{propertyIds:P.get(x.id)||[],operatorIds:O.get(x.id)||[],rateIds:R.get(x.id)||[]})).filter(x=>scopeVisible(access,x.propertyIds))});}
 catch(e){console.error("Load campaigns",e);return reply({error:"Não foi possível carregar as campanhas. Tenta novamente."},503);}}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"campaigns","edit");if("response" in g)return g.response;const access=g.access;
 try{
 const raw=await request.text();if(raw.length>250000)return reply({error:"A campanha excede o tamanho permitido."},413);
 let input;try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
 const parsed=campaignSchema.safeParse(input);if(!parsed.success)return reply({error:"Revê os campos assinalados.",issues:parsed.error.issues},400);
 const c=parsed.data,db=database();
 if(!scopeOk(access,c.propertyIds)||(c.version>0&&!scopeOk(access,await linkedProperties("campaign_properties","campaign_id",c.id))))return deny("O teu acesso está limitado a alguns alojamentos.");
 // Cada relação tem de existir nas tabelas e pertencer a um alojamento selecionado na campanha.
 const count=async(sql:string,ids:string[])=>ids.length?(await db.prepare(sql).bind(JSON.stringify(ids),JSON.stringify(c.propertyIds)).first<{n:number}>())?.n??0:0;
 if(c.propertyIds.length&&(await db.prepare("SELECT COUNT(*) AS n FROM properties WHERE id IN (SELECT jsonb_array_elements_text(?::jsonb))").bind(JSON.stringify(c.propertyIds)).first<{n:number}>())?.n!==c.propertyIds.length)return reply({error:"A lista de alojamentos mudou. Atualiza a lista no separador Alojamentos e revê a seleção."},409);
 if(await count("SELECT COUNT(*) AS n FROM property_rates WHERE id IN (SELECT jsonb_array_elements_text(?::jsonb)) AND property_id IN (SELECT jsonb_array_elements_text(?::jsonb))",c.rateIds)!==c.rateIds.length)return reply({error:"Uma tarifa selecionada já não existe ou não pertence aos alojamentos da campanha. Revê o separador Tarifas.",issues:[{path:["rateIds"],message:"Existem tarifas indisponíveis."}]},409);
 if(await count("SELECT COUNT(DISTINCT operator_id) AS n FROM operator_properties WHERE operator_id IN (SELECT jsonb_array_elements_text(?::jsonb)) AND property_id IN (SELECT jsonb_array_elements_text(?::jsonb))",c.operatorIds)!==c.operatorIds.length)return reply({error:"Um operador selecionado já não existe ou não trabalha com os alojamentos da campanha. Revê o separador Operadores.",issues:[{path:["operatorIds"],message:"Existem operadores indisponíveis."}]},409);
 const now=new Date().toISOString(),version=c.version+1,token=crypto.randomUUID();
 const {propertyIds,operatorIds,rateIds,...core}=c,payload=JSON.stringify({...core,version});
 const first=c.version===0?db.prepare("INSERT INTO campaigns (id,name,payload,version,updated_at,last_write_id) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(c.id,c.name,payload,version,now,token):db.prepare("UPDATE campaigns SET name=?,payload=?,version=?,updated_at=?,last_write_id=? WHERE id=? AND version=?").bind(c.name,payload,version,now,token,c.id,c.version);
 const guard="EXISTS (SELECT 1 FROM campaigns WHERE id=? AND last_write_id=?)";
 const link=(table:string,col:string,ids:string[])=>[db.prepare(`DELETE FROM ${table} WHERE campaign_id=? AND ${guard}`).bind(c.id,c.id,token),...ids.map(id=>db.prepare(`INSERT INTO ${table} (campaign_id,${col}) SELECT ?,? WHERE ${guard}`).bind(c.id,id,c.id,token))];
 const saved=await db.batch([first,...link("campaign_properties","property_id",propertyIds),...link("campaign_operators","operator_id",operatorIds),...link("campaign_rates","rate_id",rateIds)]);
 if(!saved[0].meta.changes)return reply({error:"Esta campanha foi alterada noutra janela. As tuas alterações continuam aqui; copia-as antes de reabrir a campanha atualizada."},409);
 return reply({campaign:present({id:c.id,payload,version,updated_at:now},{propertyIds,operatorIds,rateIds})},c.version===0?201:200);
 }catch(e){console.error("Save campaign",e);return reply({error:"Não foi possível guardar. As tuas alterações foram mantidas. Confirma os alojamentos, operadores e tarifas selecionados e tenta novamente."},503);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"campaigns","edit");if("response" in g)return g.response;const access=g.access;
 try{const u=new URL(request.url),id=u.searchParams.get("id"),version=Number(u.searchParams.get("version"));if(!id||!Number.isInteger(version)||version<1)return reply({error:"Pedido inválido."},400);
 if(!scopeOk(access,await linkedProperties("campaign_properties","campaign_id",id)))return deny("O teu acesso está limitado a alguns alojamentos.");const r=await database().prepare("DELETE FROM campaigns WHERE id=? AND version=?").bind(id,version).run();if(!r.meta.changes)return reply({error:"A campanha foi alterada. Reabre-a antes de eliminar."},409);return reply({ok:true});}
 catch(e){console.error("Delete campaign",e);return reply({error:"Não foi possível eliminar a campanha."},503);}
}
