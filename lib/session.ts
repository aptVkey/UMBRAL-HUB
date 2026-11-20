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
let cachedKey:Promise<CryptoKey>|null=null;
/** A chave derivada é calculada uma vez por instância (corre em todos os pedidos). */
function key(){
 if(!cachedKey)cachedKey=deriveKey().catch(e=>{cachedKey=null;throw e});
 return cachedKey;
}
async function deriveKey(){
 const secret=process.env.SUPABASE_SECRET_KEY;if(!secret)throw new Error("SUPABASE_SECRET_KEY em falta.");
 const base=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const derived=await crypto.subtle.sign("HMAC",base,enc.encode("umbral-session-v1"));
 return crypto.subtle.importKey("raw",derived,{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
export const nowSec=()=>Math.floor(Date.now()/1000);
/** "i" é o momento de emissão: permite invalidar sessões antigas (ver session_epoch). */
export async function createSession(email:string){
 const body=b64(enc.encode(JSON.stringify({e:email.trim().toLowerCase(),x:nowSec()+SESSION_DAYS*86400,i:nowSec()})));
 return `${body}.${b64(await crypto.subtle.sign("HMAC",await key(),enc.encode(body)))}`;
}
const COOKIE_RE=new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`);
/** Sessão válida (email e momento de emissão), ou null se não existir, estiver adulterada ou tiver expirado. */
export async function sessionInfo(request:Request):Promise<{email:string,issuedAt:number}|null>{
 try{const m=(request.headers.get("cookie")||"").match(COOKIE_RE);if(!m)return null;
 const [body,sig]=m[1].split(".");if(!body||!sig)return null;
 if(!await crypto.subtle.verify("HMAC",await key(),unb64(sig),enc.encode(body)))return null;
 const p=JSON.parse(new TextDecoder().decode(unb64(body))) as {e:string,x:number,i?:number};
 return p.x>nowSec()&&typeof p.e==="string"&&p.e?{email:p.e,issuedAt:typeof p.i==="number"?p.i:0}:null;}catch{return null;}
}
export const sessionEmail=async(request:Request)=>(await sessionInfo(request))?.email||"";
const secure=(request:Request)=>new URL(request.url).protocol==="https:"||request.headers.get("x-forwarded-proto")==="https";
export const sessionCookie=(request:Request,token:string)=>`${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS*86400}${secure(request)?"; Secure":""}`;
export const clearCookie=(request:Request)=>`${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure(request)?"; Secure":""}`;
