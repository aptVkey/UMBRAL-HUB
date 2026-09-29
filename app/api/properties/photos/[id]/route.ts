import {guardEditable,deny,propertyAllowed} from "@/lib/access-server";
import {deletePhoto} from "@/lib/property-photo-server";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"properties");if("response" in g)return g.response;
 if(g.mode==="propose")return reply({error:"Não podes propor a eliminação de fotos. Pede a um editor ou administrador."},400);
 try{
 const propertyId=new URL(request.url).searchParams.get("propertyId");if(!propertyId)return reply({error:"Alojamento não indicado."},400);
 if(!propertyAllowed(g.access,propertyId))return deny("O teu acesso está limitado a alguns alojamentos.");
 const {id}=await params;
 const r=await deletePhoto(id,propertyId);
 if(!r.ok)return reply({error:r.error},r.status);
 return reply({ok:true});
 }catch(e){console.error("Delete room photo",e);return reply({error:"Não foi possível eliminar a foto."},503);}
}
