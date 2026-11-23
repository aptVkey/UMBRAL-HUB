import {database} from "@/db/raw";
import {getAccess,deny} from "@/lib/access-server";
import {sendInviteEmail} from "@/lib/supabase-auth";
import {reply,sameOrigin,readJson} from "@/lib/auth-server";
export const dynamic="force-dynamic";
/** O administrador (re)envia o email para a pessoa definir a palavra-passe: convite se a conta ainda não existe, senão reposição. */
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 try{const a=await getAccess(request);if(!a.isAdmin)return deny("Só os administradores podem gerir a equipa.");
 const b=await readJson(request);const id=String(b?.id||"");if(!id)return reply({error:"Pedido inválido."},400);
 const m=await database().prepare("SELECT email,name,status FROM team_members WHERE id=?").bind(id).first<{email:string,name:string,status:string}>();
 if(!m)return reply({error:"Esta conta já não existe. Recarrega a lista."},404);
 if(m.status!=="Ativo")return reply({error:"A conta está suspensa. Ativa-a antes de enviar o email."},409);
 const r=await sendInviteEmail(m.email,m.name,`${new URL(request.url).origin}/redefinir`);
 if(!r.ok){console.error("Resend invite",r.status,r.message);return reply({error:r.status===429?"Já foi enviado um email há pouco. Aguarda um minuto e tenta novamente.":`Não foi possível enviar o email: ${r.message}`},r.status===429?429:502)}
 return reply({ok:true,kind:r.kind});}
 catch(e){console.error("Resend invite",e);return reply({error:"Não foi possível enviar o email."},503);}
}
