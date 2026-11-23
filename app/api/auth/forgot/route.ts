import {sendRecoveryEmail} from "@/lib/supabase-auth";
import {reply,sameOrigin,readJson,memberByEmail,slow,EMAIL,clientIp,tooManyAttempts,recordFailure,TOO_MANY} from "@/lib/auth-server";
export const dynamic="force-dynamic";
const DONE="Se o email pertencer a uma conta ativa, vais receber em breve um link para definir uma nova palavra-passe.";
/** "Esqueci-me da palavra-passe": a resposta é sempre a mesma, para não revelar que contas existem. */
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 try{
 const b=await readJson(request);const email=String(b?.email||"").trim().toLowerCase();
 if(!EMAIL.test(email))return reply({error:"Introduz um email válido."},400);
 const ip=clientIp(request),key="reset:"+email;
 if(await tooManyAttempts(key,ip)){await slow();return reply({error:TOO_MANY},429)}
 await recordFailure(key,ip);
 const member=await memberByEmail(email);
 if(member?.status==="Ativo"){
  const r=await sendRecoveryEmail(email,`${new URL(request.url).origin}/redefinir`);
  if(!r.ok&&r.status!==429)console.error("Forgot password",r.status,r.message);
 }else await slow();
 return reply({ok:true,message:DONE});
 }catch(e){console.error("Forgot password",e);return reply({error:"Não foi possível enviar o email. Tenta novamente."},503);}
}
