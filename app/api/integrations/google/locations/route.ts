import {getAccess} from "@/lib/access-server";
import {listLocations,GoogleError} from "@/lib/google-server";
export const dynamic="force-dynamic";
export const maxDuration=60;
/** Perfis Google acessíveis pela conta ligada (só administradores). */
export async function GET(request:Request){
 const a=await getAccess(request);if(!a.isAdmin)return Response.json({error:"Só os administradores podem gerir integrações."},{status:403});
 try{return Response.json({locations:await listLocations()},{headers:{"Cache-Control":"no-store"}})}
 catch(e){console.error("Google locations",e);return Response.json({error:e instanceof GoogleError?e.message:"Não foi possível obter os perfis Google."},{status:e instanceof GoogleError?e.status:503})}
}
