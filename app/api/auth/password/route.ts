import {getAccess} from "@/lib/access-server";
import {findAuthUserId,passwordLogin,passwordError,updateAuthUser} from "@/lib/supabase-auth";
import {reply,sameOrigin,readJson,slow} from "@/lib/auth-server";
export const dynamic="force-dynamic";
/** Cada utilizador altera a sua própria palavra-passe, confirmando a atual. */
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 try{
 const a=await getAccess(request);if(!a.authenticated)return reply({error:"Inicia sessão para continuar."},401);
 const b=await readJson(request);const current=String(b?.current||""),next=b?.next;
 const bad=passwordError(next);if(bad)return reply({error:bad},400);
 if(next===current)return reply({error:"A nova palavra-passe deve ser diferente da atual."},400);
 if(!(await passwordLogin(a.email,current)).ok){await slow();return reply({error:"A palavra-passe atual está incorreta."},400)}
 const id=await findAuthUserId(a.email);if(!id)return reply({error:"Conta não encontrada."},404);
 await updateAuthUser(id,{password:next as string});return reply({ok:true});
 }catch(e){console.error("Password",e);return reply({error:"Não foi possível alterar a palavra-passe."},503);}
}
