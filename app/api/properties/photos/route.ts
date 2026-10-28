import {guard,guardEditable,deny,propertyAllowed} from "@/lib/access-server";
import {listPhotos,uploadPhoto,reorderPhotos,boundedForm,checkRoom} from "@/lib/property-photo-server";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
export async function GET(request:Request){
 const g=await guard(request,"properties","view");if("response" in g)return g.response;
 try{
 const propertyId=new URL(request.url).searchParams.get("propertyId");if(!propertyId)return reply({error:"Alojamento não indicado."},400);
 if(!propertyAllowed(g.access,propertyId))return deny("O teu acesso está limitado a alguns alojamentos.");
 return reply({photos:await listPhotos(propertyId)});
 }catch(e){console.error("Load room photos",e);return reply({error:"Não foi possível carregar as fotos. Tenta novamente."},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"properties");if("response" in g)return g.response;
 if(g.mode==="propose")return reply({error:"Não podes propor fotos. Pede a um editor ou administrador que as adicione."},400);
 try{
 let form:FormData;try{form=await boundedForm(request)}catch(e){return reply({error:e instanceof Error&&e.message==='BODY_TOO_LARGE'?"Cada foto pode ter no máximo 10 MB.":"Não foi possível ler os dados enviados."},400);}
 const propertyId=String(form.get('propertyId')||''),roomId=String(form.get('roomId')||'');
 const upload=form.get('file');
 if(!propertyId||!roomId)return reply({error:"Pedido inválido."},400);
 if(!(upload instanceof File))return reply({error:"Seleciona uma foto."},400);
 if(!propertyAllowed(g.access,propertyId))return deny("O teu acesso está limitado a alguns alojamentos.");
 const room=await checkRoom(propertyId,roomId);if(!room.ok)return reply({error:room.error},room.status);
 const r=await uploadPhoto(propertyId,roomId,upload,g.access.email);
 if(!r.ok)return reply({error:r.error},r.status);
 return reply({photo:r.photo},201);
 }catch(e){console.error("Upload room photo",e);return reply({error:"Não foi possível guardar a foto. Tenta novamente."},503);}
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"properties");if("response" in g)return g.response;
 if(g.mode==="propose")return reply({error:"Não podes propor a ordem das fotos. Pede a um editor ou administrador."},400);
 try{
 const raw=await request.text();let input:unknown;try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
 const {propertyId,roomId,order}=(input||{}) as {propertyId?:string,roomId?:string,order?:string[]};
 if(!propertyId||!roomId||!Array.isArray(order)||!order.length||order.some(id=>typeof id!=='string'))return reply({error:"Pedido inválido."},400);
 if(!propertyAllowed(g.access,propertyId))return deny("O teu acesso está limitado a alguns alojamentos.");
 const r=await reorderPhotos(propertyId,roomId,order);
 if(!r.ok)return reply({error:r.error},r.status);
 return reply({ok:true});
 }catch(e){console.error("Reorder room photos",e);return reply({error:"Não foi possível guardar a nova ordem. Tenta novamente."},503);}
}
