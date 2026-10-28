import {guardEditable,deny,propertyAllowed} from "@/lib/access-server";
import {copyPhoto} from "@/lib/property-photo-server";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
/** Copia uma foto para uma tipologia (a mesma, para duplicar, ou outra). O cliente chama uma vez por foto, para cada pedido ser curto. */
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"properties");if("response" in g)return g.response;
 if(g.mode==="propose")return reply({error:"Não podes propor cópias de fotos. Pede a um editor ou administrador."},400);
 try{
 const raw=await request.text();let input:unknown;try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
 const {propertyId,id,roomId}=(input||{}) as {propertyId?:string,id?:string,roomId?:string};
 if(!propertyId||!id||!roomId||typeof id!=='string'||typeof roomId!=='string')return reply({error:"Pedido inválido."},400);
 if(!propertyAllowed(g.access,propertyId))return deny("O teu acesso está limitado a alguns alojamentos.");
 const r=await copyPhoto(propertyId,id,roomId,g.access.email);
 if(!r.ok)return reply({error:r.error},r.status);
 return reply({photo:r.photo},201);
 }catch(e){console.error("Copy room photo",e);return reply({error:"Não foi possível copiar a foto. Tenta novamente."},503);}
}
