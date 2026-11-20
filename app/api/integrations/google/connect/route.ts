import {getAccess} from "@/lib/access-server";
import {authUrl,googleConfigured} from "@/lib/google-server";
export const dynamic="force-dynamic";
const STATE_COOKIE="umbral_google_state";
/** Início do login Google (só administradores). O state aleatório fica num cookie e é confirmado no regresso. */
export async function GET(request:Request){
 const a=await getAccess(request);
 if(!a.isAdmin)return Response.redirect(new URL("/?integracao=google-sem-permissao",request.url),302);
 if(!googleConfigured())return Response.redirect(new URL("/?integracao=google-por-configurar",request.url),302);
 const state=Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url");
 const secure=new URL(request.url).protocol==="https:"?"; Secure":"";
 return new Response(null,{status:302,headers:{Location:authUrl(request,state),"Set-Cookie":`${STATE_COOKIE}=${state}; Path=/api/integrations/google; HttpOnly; SameSite=Lax; Max-Age=600${secure}`,"Cache-Control":"no-store"}});
}
