import {database} from "@/db/raw";
import {normalizeGuestbook} from "@/lib/guestbook";
import {findPropertyBySlug,staffPreview,loadRecs} from "@/lib/guestbook-server";
import {listPhotos} from "@/lib/property-photo-server";
import type {Property} from "@/lib/property";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex"}});
const NOT_FOUND="Este livro de informações não está disponível.";
/**
 * Livro de informações público (QR Code no alojamento). Só sai o que é para hóspedes: textos do livro,
 * horários de entrada/saída, comodidades, fotos, contactos e recomendações da localidade.
 * Antes de publicado, só a equipa com acesso ao alojamento o vê (pré-visualização).
 */
export async function GET(request:Request){
 try{
  const slug=(new URL(request.url).searchParams.get("slug")||"").slice(0,200);
  const id=slug?await findPropertyBySlug(slug):null;if(!id)return reply({error:NOT_FOUND},404);
  const row=await database().prepare("SELECT payload,updated_at FROM properties WHERE id=?").bind(id).first<{payload:string,updated_at:string}>();
  if(!row)return reply({error:NOT_FOUND},404);
  const p=JSON.parse(row.payload) as Property,g=normalizeGuestbook(p.guestbook);
  const preview=!g.published;
  if(preview&&!await staffPreview(request,id))return reply({error:NOT_FOUND},404);
  const pol=(k:string)=>(p.policies?.[`${k}_alta`]||p.policies?.[`${k}_baixa`]||"").trim();
  const order=new Map((p.rooms||[]).map((r,i)=>[r.id,i]));
  const [photos,recs]=await Promise.all([listPhotos(id),loadRecs(p.city||"")]);
  photos.sort((a,b)=>(order.get(a.roomId)??999)-(order.get(b.roomId)??999));
  return reply({preview,property:{
   name:p.name,type:p.type,city:p.city,region:p.region,address:p.address,postal:p.postal,license:p.license,email:p.email,
   phone:g.contactPhone||p.phone,whatsapp:g.whatsapp,checkin:pol("checkin"),checkinEnd:pol("checkinEnd"),checkout:pol("checkout"),
   quietFrom:g.quietFrom,quietTo:g.quietTo,wifiNetwork:g.wifiNetwork,wifiPassword:g.wifiPassword,damageUrl:g.damageUrl,texts:g.texts,
   amenities:(p.amenities||[]).filter(a=>a.enabled).map(a=>({label:a.label,group:a.group})),updatedAt:row.updated_at,
  },photos:photos.map(ph=>ph.id),recommendations:recs.items});
 }catch(e){console.error("Load guestbook",e);return reply({error:"Não foi possível carregar. Tenta novamente."},503)}
}
