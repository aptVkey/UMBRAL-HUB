import {userFromEmailLink,passwordError,updateAuthUser} from "@/lib/supabase-auth";
import {reply,sameOrigin,readJson,memberByEmail,slow,clientIp,tooManyAttempts,recordFailure,clearFailures,endSessions,TOO_MANY} from "@/lib/auth-server";
import {createSession,sessionCookie,nowSec} from "@/lib/session";
export const dynamic="force-dynamic";
const EXPIRED="Este link já foi usado ou expirou. Pede um novo email em \"Esqueci-me da palavra-passe\".";
/** Define a palavra-passe a partir do link do email (convite ou reposição) e abre a sessão. */
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 try{
 const b=await readJson(request);
 const password=b?.password,tokenHash=String(b?.tokenHash||"").slice(0,512),type=String(b?.type||""),accessToken=String(b?.accessToken||"").slice(0,4096);
 // A palavra-passe é validada antes de usar o link, para que um erro de escrita não gaste o link.
 const bad=passwordError(password);if(bad)return reply({error:bad},400);
 if(!tokenHash&&!accessToken)return reply({error:EXPIRED},400);
 const ip=clientIp(request);
 if(await tooManyAttempts("link:"+ip,ip)){await slow();return reply({error:TOO_MANY},429)}
 const user=await userFromEmailLink({tokenHash:tokenHash||undefined,type,accessToken:tokenHash?undefined:accessToken});
 if(!user){await recordFailure("link:"+ip,ip);await slow();return reply({error:EXPIRED},400)}
 const email=user.email.trim().toLowerCase();
 const member=await memberByEmail(email);
 if(!member||member.status!=="Ativo")return reply({error:"Esta conta não tem acesso ao hub. Contacta um administrador."},403);
 await updateAuthUser(user.id,{password:password as string});
 await clearFailures(email);
 // Sessões antigas terminam; esta começa já com a nova palavra-passe.
 await endSessions(email,nowSec());
 return reply({ok:true,name:member.name},200,{"Set-Cookie":sessionCookie(request,await createSession(email))});
 }catch(e){console.error("Reset password",e);return reply({error:"Não foi possível definir a palavra-passe. Tenta novamente."},503);}
}
