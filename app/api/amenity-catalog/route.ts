import {guard} from "@/lib/access-server";
import {listCatalog} from "@/lib/amenity-catalog";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
/** Lista o catálogo partilhado de comodidades personalizadas, usada para pré-preencher um alojamento novo ainda não guardado. */
export async function GET(request:Request){
 const g=await guard(request,"properties","view");if("response" in g)return g.response;
 try{return reply({amenities:await listCatalog()})}
 catch(e){console.error("Load amenity catalog",e);return reply({error:"Não foi possível carregar as comodidades."},503)}
}
