import {database} from "@/db/raw";
import {guard,deny,propertyAllowed} from "@/lib/access-server";
import {listPhotos} from "@/lib/property-photo-server";
import {propertySlug,type Property} from "@/lib/property";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Página de apresentação de um alojamento: só informação geral, comodidades selecionadas, regras e fotos.
 * Tarifas, operadores, keysafes e quartos nunca saem por aqui.
 */
export async function GET(request:Request){
 const g=await guard(request,"properties","view");if("response" in g)return g.response;
 try{
  // O endereço usa o nome do alojamento ("huma-by-umbral"); também aceita o id.
  const sp=new URL(request.url).searchParams,slug=(sp.get("slug")||"").toLowerCase().slice(0,200);let id=sp.get("id")||"";
  if(slug){const {results}=await database().prepare("SELECT id,name FROM properties ORDER BY lower(name),id").all<{id:string,name:string}>();id=results.find(r=>propertySlug(r.name)===slug)?.id||""}
  if(!UUID.test(id))return reply({error:"Alojamento não encontrado."},404);
  if(!propertyAllowed(g.access,id))return deny("O teu acesso está limitado a alguns alojamentos.");
  const row=await database().prepare("SELECT payload,updated_at FROM properties WHERE id=?").bind(id).first<{payload:string,updated_at:string}>();
  if(!row)return reply({error:"Alojamento não encontrado."},404);
  const p=JSON.parse(row.payload) as Property;
  const photos=(await listPhotos(id)).map(ph=>({id:ph.id,roomId:ph.roomId}));
  const rooms=(p.rooms||[]).map(r=>({id:r.id,name:r.name}));
  // Fotos pela ordem das tipologias na ficha (e, dentro de cada uma, pela ordem definida).
  const order=new Map(rooms.map((r,i)=>[r.id,i]));
  photos.sort((a,b)=>(order.get(a.roomId)??999)-(order.get(b.roomId)??999));
  return reply({property:{
   id,name:p.name,type:p.type,status:p.status,city:p.city,region:p.region,address:p.address,postal:p.postal,license:p.license,
   email:p.email,phone:p.phone,website:p.website,reviewLink:p.reviewLink,driveUrl:p.driveUrl,description:p.description,
   amenities:(p.amenities||[]).filter(a=>a.enabled).map(a=>({id:a.id,label:a.label,group:a.group,rules:a.rules})),
   policies:p.policies||{},hasDeposit:!!p.hasDeposit,depositNormal:p.depositNormal||{alta:"",baixa:""},depositGroup:p.depositGroup||{alta:"",baixa:""},updatedAt:row.updated_at,
  },rooms:rooms.filter(r=>photos.some(ph=>ph.roomId===r.id)),photos});
 }catch(e){console.error("Load property brochure",e);return reply({error:"Não foi possível carregar o alojamento. Tenta novamente."},503)}
}
