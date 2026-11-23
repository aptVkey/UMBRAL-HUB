import {database} from "@/db/raw";
/** Contas e palavras-passe vivem no Supabase Auth; a app nunca guarda palavras-passe. */
export const MIN_PASSWORD=8;
export const passwordError=(p:unknown)=>typeof p!=="string"||p.length<MIN_PASSWORD?`A palavra-passe deve ter pelo menos ${MIN_PASSWORD} caracteres.`:p.length>128?"A palavra-passe é demasiado longa.":"";
const admin=()=>{const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;if(!url||!key)throw new Error("Supabase não configurado.");return {url,headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"}}};
/** Verifica email + palavra-passe. Nunca revela se foi o email ou a palavra-passe que falhou. */
export async function passwordLogin(email:string,password:string){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;if(!url||!key)throw new Error("Supabase não configurado.");
 const r=await fetch(`${url}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({email,password})});
 return {ok:r.ok,status:r.status};
}
export async function findAuthUserId(email:string){
 const row=await database().prepare("SELECT id FROM auth.users WHERE lower(email)=?").bind(email.trim().toLowerCase()).first<{id:string}>();return row?.id??null;
}
export async function createAuthUser(email:string,password:string,name:string){
 const {url,headers}=admin();
 const r=await fetch(`${url}/auth/v1/admin/users`,{method:"POST",headers,body:JSON.stringify({email,password,email_confirm:true,user_metadata:{name}})});
 if(r.ok)return {id:(await r.json() as {id:string}).id,created:true};
 const existing=await findAuthUserId(email);
 if(existing){await updateAuthUser(existing,{password});return {id:existing,created:false}}
 const e=await r.json().catch(()=>null) as {msg?:string,message?:string}|null;throw new Error(e?.msg||e?.message||`Não foi possível criar a conta (${r.status}).`);
}
export async function updateAuthUser(id:string,patch:{password?:string,email?:string}){
 const {url,headers}=admin();const r=await fetch(`${url}/auth/v1/admin/users/${id}`,{method:"PUT",headers,body:JSON.stringify(patch.email?{...patch,email_confirm:true}:patch)});
 if(!r.ok){const e=await r.json().catch(()=>null) as {msg?:string,message?:string}|null;throw new Error(e?.msg||e?.message||`Não foi possível atualizar a conta (${r.status}).`)}
}
const publicKey=()=>{const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;if(!url||!key)throw new Error("Supabase não configurado.");return {url,headers:{apikey:key,"Content-Type":"application/json"}}};
const authError=async(r:Response)=>{const e=await r.json().catch(()=>null) as {msg?:string,message?:string,error_code?:string,code?:string}|null;return {status:r.status,code:e?.error_code||e?.code||"",message:e?.msg||e?.message||`Supabase respondeu ${r.status}`}};
/**
 * Emails de conta: são enviados pelo próprio Supabase Auth (com o SMTP configurado no painel do Supabase).
 * O link leva a /redefinir, onde a pessoa escolhe a palavra-passe.
 */
export async function sendRecoveryEmail(email:string,redirectTo:string){
 const {url,headers}=publicKey();
 const r=await fetch(`${url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,{method:"POST",headers,body:JSON.stringify({email})});
 return r.ok?{ok:true as const}:{ok:false as const,...await authError(r)};
}
/** Convite para uma conta nova. Se a conta de acesso já existir, envia antes o email de definir palavra-passe. */
export async function sendInviteEmail(email:string,name:string,redirectTo:string){
 const {url,headers}=admin();
 const r=await fetch(`${url}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`,{method:"POST",headers,body:JSON.stringify({email,data:{name}})});
 if(r.ok)return {ok:true as const,kind:"invite" as const};
 const e=await authError(r);
 if(e.status===422||e.code==="email_exists"||/already|registered|exists/i.test(e.message)){const rec=await sendRecoveryEmail(email,redirectTo);return rec.ok?{ok:true as const,kind:"recovery" as const}:rec}
 return {ok:false as const,...e};
}
/** Valida o link do email (token_hash do modelo personalizado, ou access_token do modelo por defeito). Devolve o utilizador do Supabase. */
export async function userFromEmailLink(link:{tokenHash?:string,type?:string,accessToken?:string}){
 const {url,headers}=publicKey();
 if(link.tokenHash){
  const type=link.type==="invite"?"invite":link.type==="signup"?"signup":"recovery";
  const r=await fetch(`${url}/auth/v1/verify`,{method:"POST",headers,body:JSON.stringify({type,token_hash:link.tokenHash})});
  if(!r.ok)return null;const d=await r.json().catch(()=>null) as {user?:{id:string,email:string}}|null;return d?.user?.id?d.user:null;
 }
 if(link.accessToken){
  const r=await fetch(`${url}/auth/v1/user`,{headers:{...headers,Authorization:`Bearer ${link.accessToken}`}});
  if(!r.ok)return null;const d=await r.json().catch(()=>null) as {id?:string,email?:string}|null;return d?.id&&d.email?{id:d.id,email:d.email}:null;
 }
 return null;
}
export async function deleteAuthUser(email:string){
 const id=await findAuthUserId(email);if(!id)return;const {url,headers}=admin();await fetch(`${url}/auth/v1/admin/users/${id}`,{method:"DELETE",headers});
}
