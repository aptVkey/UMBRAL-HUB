import {database} from "@/db/raw";
import {campaignSchema} from "@/lib/campaign";
import {guard,guardEditable,deny,scopeOk,scopeVisible,linkedProperties} from "@/lib/access-server";
import {createChangeRequest} from "@/lib/change-request-server";
import {reply,sameOrigin,present,group,applyCampaignSave,applyCampaignDelete,type Row} from "@/lib/campaign-server";
export const dynamic="force-dynamic";
export async function GET(request:Request){const g=await guard(request,"campaigns","view");if("response" in g)return g.response;const access=g.access;try{const db=database();
 const [c,p,o,r]=await db.batch([db.prepare("SELECT id,payload,version,updated_at FROM campaigns ORDER BY lower(name)"),db.prepare("SELECT campaign_id,property_id AS ref FROM campaign_properties"),db.prepare("SELECT campaign_id,operator_id AS ref FROM campaign_operators"),db.prepare("SELECT campaign_id,rate_id AS ref FROM campaign_rates")]);
 const [P,O,R]=[p,o,r].map(x=>group(x.results as {campaign_id:string,ref:string}[]));
 return reply({campaigns:(c.results as Row[]).map(x=>present(x,{propertyIds:P.get(x.id)||[],operatorIds:O.get(x.id)||[],rateIds:R.get(x.id)||[]})).filter(x=>scopeVisible(access,x.propertyIds))});}
 catch(e){console.error("Load campaigns",e);return reply({error:"Não foi possível carregar as campanhas. Tenta novamente."},503);}}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"campaigns");if("response" in g)return g.response;
 try{
 const raw=await request.text();if(raw.length>250000)return reply({error:"A campanha excede o tamanho permitido."},413);
 let input;try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
 const parsed=campaignSchema.safeParse(input);if(!parsed.success)return reply({error:"Revê os campos assinalados.",issues:parsed.error.issues},400);
 const c=parsed.data;
 if(!scopeOk(g.access,c.propertyIds)||(c.version>0&&!scopeOk(g.access,await linkedProperties("campaign_properties","campaign_id",c.id))))return deny("O teu acesso está limitado a alguns alojamentos.");
 if(g.mode==="propose"){
  const requestId=await createChangeRequest({area:"campaigns",entityType:"campaign",entityId:c.id,entityName:c.name,action:"save",payload:c,baseVersion:c.version,access:g.access});
  return reply({proposal:true,requestId,message:"As alterações foram enviadas para aprovação. Um editor ou administrador tem de as aceitar antes de ficarem visíveis."},202);
 }
 const r=await applyCampaignSave(c);
 if(!r.ok)return reply({error:r.error,issues:r.issues},r.status);
 return reply({campaign:r.campaign},c.version===0?201:200);
 }catch(e){console.error("Save campaign",e);return reply({error:"Não foi possível guardar. As tuas alterações foram mantidas. Confirma os alojamentos, operadores e tarifas selecionados e tenta novamente."},503);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"campaigns");if("response" in g)return g.response;
 try{const u=new URL(request.url),id=u.searchParams.get("id"),version=Number(u.searchParams.get("version"));if(!id||!Number.isInteger(version)||version<1)return reply({error:"Pedido inválido."},400);
 if(!scopeOk(g.access,await linkedProperties("campaign_properties","campaign_id",id)))return deny("O teu acesso está limitado a alguns alojamentos.");
 if(g.mode==="propose"){
  const row=await database().prepare("SELECT name FROM campaigns WHERE id=?").bind(id).first<{name:string}>();
  if(!row)return reply({error:"A campanha já não existe."},404);
  const requestId=await createChangeRequest({area:"campaigns",entityType:"campaign",entityId:id,entityName:row.name,action:"delete",payload:null,baseVersion:version,access:g.access});
  return reply({proposal:true,requestId,message:"O pedido de eliminação foi enviado para aprovação."},202);
 }
 const r=await applyCampaignDelete(id,version);
 if(!r.ok)return reply({error:r.error},r.status);
 return reply({ok:true});}
 catch(e){console.error("Delete campaign",e);return reply({error:"Não foi possível eliminar a campanha."},503);}
}
