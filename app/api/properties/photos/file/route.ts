import {database} from "@/db/raw";
import {guard,propertyAllowed} from "@/lib/access-server";
import {bucket} from "@/lib/corporate-server";
import {PHOTO_WIDTHS,photoVariantKey} from "@/lib/property";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
/** Sem `w` devolve o original; com uma largura conhecida devolve a versão reduzida (ou o original, se ela não existir). */
export async function GET(request:Request){
 try{const params=new URL(request.url).searchParams,id=params.get("id"),width=Number(params.get("w"));
 /** Em paralelo: cada miniatura passa por aqui, e a resposta só sai depois de confirmado o acesso. */
 const [g,row]=await Promise.all([guard(request,"properties","view"),id?database().prepare("SELECT key,name,type,property_id FROM property_room_photos WHERE id=?").bind(id).first<{key:string,name:string,type:string,property_id:string}>():null]);
 if("response" in g)return g.response;
 if(!id)return reply({error:"Foto não indicada."},400);
 if(!row)return reply({error:"A foto não existe."},404);
 if(!propertyAllowed(g.access,row.property_id))return reply({error:"Não tens acesso a esta foto."},403);
 const wanted=PHOTO_WIDTHS.includes(width);
 const variant=wanted?await bucket().get(photoVariantKey(row.key,width)):null;
 const object=variant??await bucket().get(row.key);if(!object)return reply({error:"A foto está indisponível. Tenta novamente."},503);
 const ext=row.name.split(".").pop()?.replace(/[^a-z0-9]/gi,"")||"jpg";
 /** Se a versão reduzida ainda não existir, o original serve de recurso, sem ficar um ano em cache neste endereço. */
 return new Response(object.body,{headers:{"Content-Type":variant?"image/jpeg":row.type,"Content-Length":String(object.size),"Content-Disposition":`inline; filename="foto.${variant?"jpg":ext}"; filename*=UTF-8''${encodeURIComponent(row.name)}`,"Cache-Control":wanted&&!variant?"private, max-age=3600":"private, max-age=31536000, immutable","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'"}});
 }catch(e){console.error("Load room photo",e);return reply({error:"Não foi possível obter a foto."},503);}
}
