import {env} from "cloudflare:workers";
/**
 * Sessão da app: cookie httpOnly assinado com HMAC-SHA256 que só guarda o email e a validade.
 * A chave de assinatura deriva da chave secreta do Supabase, por isso não há mais segredos a configurar.
 * As permissões nunca vão no cookie: são lidas da base de dados a cada pedido.
 */
export const SESSION_COOKIE="umbral_session";
export const SESSION_DAYS=7;
const enc=new TextEncoder();
const b64=(b:ArrayBuffer|Uint8Array)=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const unb64=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
async function key(){
 const secret=env.SUPABASE_SECRET_KEY;if(!secret)throw new Error("SUPABASE_SECRET_KEY em falta.");
 const base=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const derived=await crypto.subtle.sign("HMAC",base,enc.encode("umbral-session-v1"));
 return crypto.subtle.importKey("raw",derived,{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
export async function createSession(email:string){
 const body=b64(enc.encode(JSON.stringify({e:email.trim().toLowerCase(),x:Math.floor(Date.now()/1000)+SESSION_DAYS*86400})));
 return `${body}.${b64(await crypto.subtle.sign("HMAC",await key(),enc.encode(body)))}`;
}
/** Devolve o email da sessão válida, ou "" se não existir, estiver adulterada ou tiver expirado. */
export async function sessionEmail(request:Request){
 try{const m=(request.headers.get("cookie")||"").match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));if(!m)return "";
 const [body,sig]=m[1].split(".");if(!body||!sig)return "";
 if(!await crypto.subtle.verify("HMAC",await key(),unb64(sig),enc.encode(body)))return "";
 const p=JSON.parse(new TextDecoder().decode(unb64(body))) as {e:string,x:number};
 return p.x>Math.floor(Date.now()/1000)&&typeof p.e==="string"?p.e:"";}catch{return "";}
}
const secure=(request:Request)=>new URL(request.url).protocol==="https:"||request.headers.get("x-forwarded-proto")==="https";
export const sessionCookie=(request:Request,token:string)=>`${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS*86400}${secure(request)?"; Secure":""}`;
export const clearCookie=(request:Request)=>`${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure(request)?"; Secure":""}`;
