import {z} from "zod";
import {getAccess} from "@/lib/access-server";
import {amenityGroups} from "@/lib/property";
import {renameCatalogAmenity,deleteCatalogAmenity} from "@/lib/amenity-catalog";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
const groups=[...Object.keys(amenityGroups),"Personalizadas"];
const renameSchema=z.object({label:z.string().trim().min(1,"Indica um nome para a comodidade.").max(180),group:z.string().refine(v=>groups.includes(v),"Categoria inválida.")});
/** Só administradores podem editar/eliminar uma comodidade personalizada — a alteração aplica-se a todos os alojamentos. */
async function requireAdmin(request:Request){
 if(!sameOrigin(request))return {response:reply({error:"Pedido não autorizado."},403)};
 const access=await getAccess(request);
 if(!access.authenticated)return {response:reply({error:"Inicia sessão para continuar."},401)};
 if(!access.isAdmin)return {response:reply({error:"Só administradores podem editar ou eliminar comodidades personalizadas."},403)};
 return {access};
}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 const g=await requireAdmin(request);if("response" in g)return g.response;
 try{
 const raw=await request.text();let input:unknown;try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
 const result=renameSchema.safeParse(input);if(!result.success)return reply({error:result.error.issues[0].message},400);
 const {id}=await params;
 const r=await renameCatalogAmenity(id,result.data.label,result.data.group);
 if(!r.ok)return reply({error:r.error},r.status);
 return reply({ok:true});
 }catch(e){console.error("Rename custom amenity",e);return reply({error:"Não foi possível guardar. Tenta novamente."},503);}
}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 const g=await requireAdmin(request);if("response" in g)return g.response;
 try{
 const {id}=await params;
 const r=await deleteCatalogAmenity(id);
 if(!r.ok)return reply({error:r.error},r.status);
 return reply({ok:true});
 }catch(e){console.error("Delete custom amenity",e);return reply({error:"Não foi possível eliminar. Tenta novamente."},503);}
}
