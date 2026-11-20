import {getAccess} from "@/lib/access-server";
import {completeConnect} from "@/lib/google-server";
export const dynamic="force-dynamic";
const STATE_COOKIE="umbral_google_state";
/** Regresso do login Google: confirma o administrador e o state, troca o código pelo token e volta à app. */
export async function GET(request:Request){
 const u=new URL(request.url),back=(result:string)=>new Response(null,{status:302,headers:{Location:`/?integracao=${result}`,"Set-Cookie":`${STATE_COOKIE}=; Path=/api/integrations/google; HttpOnly; SameSite=Lax; Max-Age=0`,"Cache-Control":"no-store"}});
 const a=await getAccess(request);if(!a.isAdmin)return back("google-sem-permissao");
 const cookie=(request.headers.get("cookie")||"").split(/;\s*/).find(c=>c.startsWith(STATE_COOKIE+"="))?.slice(STATE_COOKIE.length+1);
 const state=u.searchParams.get("state"),code=u.searchParams.get("code");
 if(u.searchParams.get("error"))return back("google-cancelado");
 if(!cookie||!state||cookie!==state||!code)return back("google-erro");
 try{await completeConnect(request,code,a.name||a.email);return back("google-ligado")}
 catch(e){console.error("Google callback",e);return back("google-erro")}
}
