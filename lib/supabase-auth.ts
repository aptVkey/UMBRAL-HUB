import {env} from "cloudflare:workers";
import {database} from "@/db/raw";
/** Contas e palavras-passe vivem no Supabase Auth; a app nunca guarda palavras-passe. */
export const MIN_PASSWORD=8;
export const passwordError=(p:unknown)=>typeof p!=="string"||p.length<MIN_PASSWORD?`A palavra-passe deve ter pelo menos ${MIN_PASSWORD} caracteres.`:p.length>128?"A palavra-passe é demasiado longa.":"";
const admin=()=>{const url=env.SUPABASE_URL,key=env.SUPABASE_SECRET_KEY;if(!url||!key)throw new Error("Supabase não configurado.");return {url,headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"}}};
/** Verifica email + palavra-passe. Nunca revela se foi o email ou a palavra-passe que falhou. */
export async function passwordLogin(email:string,password:string){
 const url=env.SUPABASE_URL,key=env.SUPABASE_PUBLISHABLE_KEY;if(!url||!key)throw new Error("Supabase não configurado.");
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
export async function deleteAuthUser(email:string){
 const id=await findAuthUserId(email);if(!id)return;const {url,headers}=admin();await fetch(`${url}/auth/v1/admin/users/${id}`,{method:"DELETE",headers});
}
