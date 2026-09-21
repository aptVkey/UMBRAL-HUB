import {createSession,sessionCookie} from "@/lib/session";
import {passwordLogin} from "@/lib/supabase-auth";
import {reply,sameOrigin,readJson,memberByEmail,slow,EMAIL} from "@/lib/auth-server";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 try{
 const b=await readJson(request);const email=String(b?.email||"").trim().toLowerCase(),password=String(b?.password||"");
 if(!EMAIL.test(email)||!password)return reply({error:"Indica o email e a palavra-passe."},400);
 const login=await passwordLogin(email,password);
 if(!login.ok){await slow();return reply({error:login.status===429?"Demasiadas tentativas. Aguarda um momento e tenta novamente.":"Email ou palavra-passe incorretos."},login.status===429?429:401)}
 const member=await memberByEmail(email);
 if(!member||member.status!=="Ativo")return reply({error:"Esta conta não tem acesso ao hub. Contacta um administrador."},403);
 return reply({ok:true,name:member.name},200,{"Set-Cookie":sessionCookie(request,await createSession(email))});
 }catch(e){console.error("Login",e);return reply({error:"Não foi possível iniciar sessão. Tenta novamente."},503);}
}
