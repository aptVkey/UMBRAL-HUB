import {guardEditable,deny,propertyAllowed} from "@/lib/access-server";
import {deletePhotos,movePhotos,MAX_BULK_PHOTOS} from "@/lib/property-photo-server";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
/** Ações em massa sobre fotos: eliminar várias ou movê-las (para outra tipologia ou para outra posição). */
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"properties");if("response" in g)return g.response;
 if(g.mode==="propose")return reply({error:"Não podes propor alterações às fotos. Pede a um editor ou administrador."},400);
 try{
 const raw=await request.text();let input:unknown;try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
 const {propertyId,action,ids,roomId,beforeId}=(input||{}) as {propertyId?:string,action?:string,ids?:unknown,roomId?:string,beforeId?:string|null};
 if(!propertyId||!Array.isArray(ids)||!ids.length||ids.length>MAX_BULK_PHOTOS||ids.some(id=>typeof id!=='string'))return reply({error:"Pedido inválido."},400);
 if(!propertyAllowed(g.access,propertyId))return deny("O teu acesso está limitado a alguns alojamentos.");
 if(action==="delete"){
  const r=await deletePhotos(propertyId,ids as string[]);
  return r.ok?reply({photos:r.photos}):reply({error:r.error},r.status);
 }
 if(action==="move"){
  if(!roomId||(beforeId!=null&&typeof beforeId!=='string'))return reply({error:"Pedido inválido."},400);
  const r=await movePhotos(propertyId,ids as string[],roomId,beforeId||null);
  return r.ok?reply({photos:r.photos}):reply({error:r.error},r.status);
 }
 return reply({error:"Ação inválida."},400);
 }catch(e){console.error("Bulk room photos",e);return reply({error:"Não foi possível concluir a ação. Tenta novamente."},503);}
}
