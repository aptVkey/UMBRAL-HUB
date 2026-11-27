import {database} from "@/db/raw";
import {bucket} from "@/lib/corporate-server";
import {PHOTO_WIDTHS,photoVariantKey} from "@/lib/property";
import {staffPreview} from "@/lib/guestbook-server";
export const dynamic="force-dynamic";
const fail=(error:string,status:number)=>Response.json({error},{status,headers:{"Cache-Control":"no-store"}});
/** Fotos do livro público: só de alojamentos com o livro publicado (ou para a equipa, em pré-visualização). */
export async function GET(request:Request){
 try{
  const params=new URL(request.url).searchParams,id=params.get("id")||"",width=Number(params.get("w"));
  if(!PHOTO_WIDTHS.includes(width))return fail("Tamanho inválido.",400);
  const row=id?await database().prepare("SELECT f.key,f.type,f.property_id,(p.payload::jsonb->'guestbook'->>'published') AS published FROM property_room_photos f JOIN properties p ON p.id=f.property_id WHERE f.id=?").bind(id).first<{key:string,type:string,property_id:string,published:string|null}>():null;
  if(!row)return fail("A foto não existe.",404);
  const published=row.published==="true";
  if(!published&&!await staffPreview(request,row.property_id))return fail("A foto não existe.",404);
  const variant=await bucket().get(photoVariantKey(row.key,width)),object=variant??await bucket().get(row.key);
  if(!object)return fail("A foto está indisponível.",503);
  return new Response(object.body,{headers:{"Content-Type":variant?"image/jpeg":row.type,"Content-Length":String(object.size),"Cache-Control":published?"public, max-age=86400":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'","X-Robots-Tag":"noindex"}});
 }catch(e){console.error("Guestbook photo",e);return fail("Não foi possível obter a foto.",503)}
}
