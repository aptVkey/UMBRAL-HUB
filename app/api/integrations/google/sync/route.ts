import {getAccess} from "@/lib/access-server";
import {syncGoogle,GoogleError} from "@/lib/google-server";
export const dynamic="force-dynamic";
export const maxDuration=300;
/** Sincroniza as reviews do Google. Administradores e quem tem Edição nas Reviews. */
export async function POST(request:Request){
 if(request.headers.get("origin")&&request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Pedido não autorizado."},{status:403});
 const a=await getAccess(request);
 if(!a.isAdmin&&a.areas.reviews!=="edit")return Response.json({error:"Não tens permissão para sincronizar reviews."},{status:403});
 try{return Response.json(await syncGoogle(),{headers:{"Cache-Control":"no-store"}})}
 catch(e){console.error("Google sync",e);return Response.json({error:e instanceof GoogleError?e.message:"Não foi possível sincronizar."},{status:e instanceof GoogleError?e.status:503})}
}
