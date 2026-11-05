import { database } from "@/db/raw";
import { propertySchema, alignCards, normalizeRoom } from "@/lib/property";
import {guard,guardEditable,deny,propertyAllowed} from "@/lib/access-server";
import {createChangeRequest} from "@/lib/change-request-server";
import {applyPropertySave,applyPropertyDelete} from "@/lib/property-server";
import {listCatalog,mergeCatalog} from "@/lib/amenity-catalog";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
function sameOrigin(r:Request){const origin=r.headers.get("origin");return !origin||origin===new URL(r.url).origin;}
export async function GET(request:Request){const g=await guard(request,["properties","corporates","campaigns"],"view");if("response" in g)return g.response;const access=g.access;try{const db=database();const [rows,links,safes,ops]=await db.batch([db.prepare("SELECT id, payload, version, updated_at FROM properties ORDER BY lower(name)"),db.prepare("SELECT operator_id,property_id FROM operator_properties"),db.prepare("SELECT unit_id,property_id,code FROM unit_keysafes"),db.prepare("SELECT id,name,payload FROM operators")]);const operatorInfo=new Map((ops.results as {id:string,name:string,payload:string}[]).map(o=>[o.id,{name:o.name,type:(JSON.parse(o.payload).type as string|undefined)}]));const codes=new Map<string,Record<string,string>>();if(access.areas.properties!=="none")for(const k of safes.results as {unit_id:string,property_id:string,code:string}[])codes.set(k.property_id,{...(codes.get(k.property_id)||{}),[k.unit_id]:k.code});const partners=new Map<string,string[]>();for(const l of links.results as {operator_id:string,property_id:string}[])partners.set(l.property_id,[...(partners.get(l.property_id)||[]),l.operator_id]);const catalog=access.areas.properties!=="none"?await listCatalog():[];return reply({properties:(rows.results as {id:string,payload:string,version:number,updated_at:string}[]).map(r=>{const p=JSON.parse(r.payload),partnerOperatorIds=partners.get(r.id)||[];return {...p,id:r.id,rooms:(p.rooms||[]).map(normalizeRoom),partnerOperatorIds,operators:alignCards(p.operators||[],partnerOperatorIds,operatorInfo),keysafes:codes.get(r.id)||{},amenities:mergeCatalog(p.amenities||[],catalog),version:r.version,updatedAt:r.updated_at}}).filter(p=>propertyAllowed(access,p.id))});}catch(e){console.error("Load properties",e);return reply({error:"Não foi possível carregar os alojamentos. Tenta novamente."},503);}}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"properties");if("response" in g)return g.response;
 try{
 const raw=await request.text();if(raw.length>250000)return reply({error:"A ficha excede o tamanho permitido."},413);
 let input;try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
 const result=propertySchema.safeParse(input);if(!result.success)return reply({error:"Revê os campos assinalados.",issues:result.error.issues},400);
 const p=result.data;if(g.access.propertyIds!==null&&(p.version===0||!propertyAllowed(g.access,p.id)))return deny("O teu acesso está limitado a alguns alojamentos.");
 if(g.mode==="propose"){
  const requestId=await createChangeRequest({area:"properties",entityType:"property",entityId:p.id,entityName:p.name,action:"save",payload:p,baseVersion:p.version,access:g.access});
  return reply({proposal:true,requestId,message:"As alterações foram enviadas para aprovação. Um editor ou administrador tem de as aceitar antes de ficarem visíveis."},202);
 }
 const r=await applyPropertySave(p);
 if(!r.ok)return reply({error:r.error},r.status);
 return reply({property:r.property},p.version===0?201:200);
 }catch(e){console.error("Save property",e);return reply({error:"Não foi possível guardar. As tuas alterações foram mantidas. Tenta novamente."},503);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"properties");if("response" in g)return g.response;
 try{
 const u=new URL(request.url),id=u.searchParams.get("id"),version=Number(u.searchParams.get("version"));if(!id||!Number.isInteger(version)||version<1)return reply({error:"Pedido inválido."},400);
 if(!propertyAllowed(g.access,id))return deny("O teu acesso está limitado a alguns alojamentos.");
 if(g.mode==="propose"){
  const row=await database().prepare("SELECT name FROM properties WHERE id=?").bind(id).first<{name:string}>();
  if(!row)return reply({error:"O alojamento já não existe."},404);
  const requestId=await createChangeRequest({area:"properties",entityType:"property",entityId:id,entityName:row.name,action:"delete",payload:null,baseVersion:version,access:g.access});
  return reply({proposal:true,requestId,message:"O pedido de eliminação foi enviado para aprovação."},202);
 }
 const r=await applyPropertyDelete(id,version);
 if(!r.ok)return reply({error:r.error},r.status);
 return reply({ok:true});
 }catch(e){console.error("Delete property",e);return reply({error:"Não foi possível eliminar o alojamento."},503);}
}
