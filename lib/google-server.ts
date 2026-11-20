/**
 * Integração com o Google Business Profile: login OAuth, renovação do token, perfis (localizações),
 * leitura de reviews e publicação de respostas. O refresh token fica cifrado na tabela `integrations`.
 */
import {database} from "@/db/raw";
import {seal,open} from "./secret-box";
import {newId} from "./property";

export const GOOGLE_ID="google";
export const GOOGLE_SCOPES="openid email https://www.googleapis.com/auth/business.manage";
const TOKEN_URL="https://oauth2.googleapis.com/token";
export const callbackUrl=(request:Request)=>`${new URL(request.url).origin}/api/integrations/google/callback`;
export const googleConfigured=()=>!!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.INTEGRATIONS_KEY);
export class GoogleError extends Error{constructor(message:string,readonly status=502){super(message)}}

export function authUrl(request:Request,state:string){
 const q=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID!,redirect_uri:callbackUrl(request),response_type:"code",scope:GOOGLE_SCOPES,access_type:"offline",prompt:"consent",include_granted_scopes:"true",state});
 return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}
async function tokenRequest(body:Record<string,string>){
 const r=await fetch(TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID!,client_secret:process.env.GOOGLE_CLIENT_SECRET!,...body})});
 const data=await r.json().catch(()=>({})) as {access_token?:string,refresh_token?:string,expires_in?:number,error?:string,error_description?:string};
 if(!r.ok||!data.access_token){
  if(data.error==="invalid_grant")throw new GoogleError("A ligação à conta Google expirou ou foi revogada. Liga a conta de novo em Definições → Integrações.",401);
  throw new GoogleError(`A Google recusou o pedido de acesso (${data.error||r.status}).`);
 }
 return data as {access_token:string,refresh_token?:string,expires_in:number};
}

/** Troca o código do login pelo token e guarda o refresh token cifrado. */
export async function completeConnect(request:Request,code:string,who:string){
 const t=await tokenRequest({code,grant_type:"authorization_code",redirect_uri:callbackUrl(request)});
 if(!t.refresh_token)throw new GoogleError("A Google não devolveu um token de longa duração. Remove o acesso da app em myaccount.google.com/permissions e liga de novo.");
 const info=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:`Bearer ${t.access_token}`}}).then(r=>r.ok?r.json():{}).catch(()=>({})) as {email?:string};
 const now=new Date().toISOString();
 await database().prepare("INSERT INTO integrations (id,secret_enc,account_label,connected_by,connected_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT (id) DO UPDATE SET secret_enc=EXCLUDED.secret_enc,account_label=EXCLUDED.account_label,connected_by=EXCLUDED.connected_by,connected_at=EXCLUDED.connected_at,updated_at=EXCLUDED.updated_at")
  .bind(GOOGLE_ID,await seal(JSON.stringify({refresh_token:t.refresh_token})),info.email||"",who,now,now).run();
 cached=null;
 return info.email||"";
}
export async function connection(){
 return database().prepare("SELECT account_label,connected_by,connected_at FROM integrations WHERE id=?").bind(GOOGLE_ID).first<{account_label:string,connected_by:string,connected_at:string}>();
}
/** Desliga: revoga o token na Google (melhor esforço) e apaga-o. As correspondências e as reviews mantêm-se. */
export async function disconnect(){
 const row=await database().prepare("SELECT secret_enc FROM integrations WHERE id=?").bind(GOOGLE_ID).first<{secret_enc:string}>();
 if(row?.secret_enc){try{const {refresh_token}=JSON.parse(await open(row.secret_enc));await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh_token)}`,{method:"POST"})}catch{}}
 await database().prepare("DELETE FROM integrations WHERE id=?").bind(GOOGLE_ID).run();cached=null;
}

let cached:{token:string,until:number}|null=null;
async function accessToken(){
 if(cached&&cached.until>Date.now()+60_000)return cached.token;
 const row=await database().prepare("SELECT secret_enc FROM integrations WHERE id=?").bind(GOOGLE_ID).first<{secret_enc:string}>();
 if(!row?.secret_enc)throw new GoogleError("A conta Google não está ligada. Liga-a em Definições → Integrações.",409);
 const {refresh_token}=JSON.parse(await open(row.secret_enc)) as {refresh_token:string};
 const t=await tokenRequest({refresh_token,grant_type:"refresh_token"});
 cached={token:t.access_token,until:Date.now()+t.expires_in*1000};return t.access_token;
}
/** O hub só lê perfis/reviews e responde a reviews. Nunca edita nem apaga conteúdo do perfil (nem apaga respostas). */
function onlyReadOrReply(url:string,init:RequestInit){
 const m=(init.method||"GET").toUpperCase();
 if(m==="GET")return;
 if(m==="PUT"&&/^https:\/\/mybusiness\.googleapis\.com\/v4\/accounts\/[^/]+\/locations\/[^/]+\/reviews\/[^/]+\/reply$/.test(url))return;
 throw new GoogleError("Operação não permitida: o hub só lê e responde a reviews.",405);
}
async function api<T>(url:string,init:RequestInit={}):Promise<T>{
 onlyReadOrReply(url,init);
 const r=await fetch(url,{...init,headers:{...init.headers,Authorization:`Bearer ${await accessToken()}`,"Content-Type":"application/json"}});
 const data=await r.json().catch(()=>({})) as any;
 if(!r.ok){
  const msg=data?.error?.message||"";
  if(r.status===429)throw new GoogleError("A Google limitou os pedidos. Tenta daqui a alguns minutos.",429);
  if(r.status===403)throw new GoogleError(`A Google recusou o acesso${msg?`: ${msg}`:""}. Confirma que a API foi aprovada para o projeto.`,403);
  throw new GoogleError(`Erro da Google (${r.status})${msg?`: ${msg}`:""}.`);
 }
 return data as T;
}

export type GoogleLocation={ref:string,title:string,address:string};
/** Todos os perfis acessíveis pela conta ligada. ref = "accounts/X/locations/Y" (o formato que a API de reviews usa). */
export async function listLocations():Promise<GoogleLocation[]>{
 const out:GoogleLocation[]=[];
 const {accounts=[]}=await api<{accounts?:{name:string}[]}>("https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20");
 for(const a of accounts){
  let pageToken="";
  do{
   const q=new URLSearchParams({readMask:"name,title,storefrontAddress",pageSize:"100",...(pageToken?{pageToken}:{})});
   const d=await api<{locations?:{name:string,title?:string,storefrontAddress?:{addressLines?:string[],locality?:string}}[],nextPageToken?:string}>(`https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?${q}`);
   for(const l of d.locations||[])out.push({ref:`${a.name}/${l.name}`,title:l.title||l.name,address:[...(l.storefrontAddress?.addressLines||[]),l.storefrontAddress?.locality].filter(Boolean).join(", ")});
   pageToken=d.nextPageToken||"";
  }while(pageToken&&out.length<1000);
 }
 return out.sort((x,y)=>x.title.localeCompare(y.title,"pt"));
}

const STARS:Record<string,number>={ONE:1,TWO:2,THREE:3,FOUR:4,FIVE:5};
type GReview={reviewId:string,name:string,reviewer?:{displayName?:string,isAnonymous?:boolean},starRating?:string,comment?:string,createTime?:string,reviewReply?:{comment?:string,updateTime?:string}};
/** As reviews do Google trazem a tradução automática junto do original; fica só o original. */
export function cleanComment(c=""){const m=c.match(/\(Original\)\n([\s\S]*)$/);if(m)return m[1].trim();return c.replace(/\n*\(Translated by Google\)[\s\S]*$/,"").trim();}

export type SyncResult={properties:number,added:number,updated:number,errors:{property:string,error:string}[]};
/** Lê as reviews mais recentes de cada perfil ligado e grava-as. Respostas já publicadas no Google ficam como "Respondida". */
export async function syncGoogle(maxPerLocation=200):Promise<SyncResult>{
 const db=database();
 const {results:links}=await db.prepare("SELECT pi.property_id,pi.external_ref,p.name FROM property_integrations pi JOIN properties p ON p.id=pi.property_id WHERE pi.provider=?").bind(GOOGLE_ID).all<{property_id:string,external_ref:string,name:string}>();
 const res:SyncResult={properties:links.length,added:0,updated:0,errors:[]};
 for(const link of links){
  const now=new Date().toISOString();
  try{
   const reviews:GReview[]=[];let pageToken="";
   do{
    const d=await api<{reviews?:GReview[],nextPageToken?:string}>(`https://mybusiness.googleapis.com/v4/${link.external_ref}/reviews?pageSize=50&orderBy=updateTime%20desc${pageToken?`&pageToken=${encodeURIComponent(pageToken)}`:""}`);
    reviews.push(...(d.reviews||[]));pageToken=d.nextPageToken||"";
   }while(pageToken&&reviews.length<maxPerLocation);
   if(reviews.length){
    const ids=reviews.map(r=>r.reviewId);
    const {results:known}=await db.prepare("SELECT external_id FROM reviews WHERE platform='Google' AND external_id IN (SELECT jsonb_array_elements_text(?::jsonb))").bind(JSON.stringify(ids)).all<{external_id:string}>();
    const seen=new Set(known.map(k=>k.external_id));
    const stmts=reviews.map(r=>{
     const reply=r.reviewReply?.comment?.trim()||"",author=r.reviewer?.isAnonymous?"":(r.reviewer?.displayName||"");
     // Nova: entra como "Respondida" se já tiver resposta no Google, senão "Por responder".
     // Existente: atualiza texto e nota; se a resposta foi publicada fora do hub, passa a "Respondida".
     return db.prepare(`INSERT INTO reviews (id,property_id,platform,external_id,author,rating,body,review_date,status,reply,published_at,source,version,created_at,updated_at)
      VALUES (?,?,'Google',?,?,?,?,?,?,?,?,'google',1,?,?)
      ON CONFLICT (platform,external_id) WHERE external_id IS NOT NULL DO UPDATE SET author=EXCLUDED.author,rating=EXCLUDED.rating,body=EXCLUDED.body,
       reply=CASE WHEN EXCLUDED.reply<>'' THEN EXCLUDED.reply ELSE reviews.reply END,
       status=CASE WHEN EXCLUDED.reply<>'' THEN 'published' ELSE reviews.status END,
       published_at=CASE WHEN EXCLUDED.reply<>'' AND reviews.published_at IS NULL THEN EXCLUDED.published_at ELSE reviews.published_at END,
       version=CASE WHEN reviews.body<>EXCLUDED.body OR reviews.rating IS DISTINCT FROM EXCLUDED.rating OR (EXCLUDED.reply<>'' AND reviews.reply<>EXCLUDED.reply) THEN reviews.version+1 ELSE reviews.version END,
       updated_at=EXCLUDED.updated_at`)
      .bind(newId(),link.property_id,r.reviewId,author,STARS[r.starRating||""]??null,cleanComment(r.comment),(r.createTime||now).slice(0,10),reply?"published":"new",reply,reply?(r.reviewReply?.updateTime||now):null,now,now);
    });
    for(let i=0;i<stmts.length;i+=50)await db.batch(stmts.slice(i,i+50));
    for(const id of ids)seen.has(id)?res.updated++:res.added++;
   }
   await db.prepare("UPDATE property_integrations SET last_sync_at=?,last_error='' WHERE property_id=? AND provider=?").bind(now,link.property_id,GOOGLE_ID).run();
  }catch(e){
   const msg=e instanceof Error?e.message:"Erro desconhecido.";res.errors.push({property:link.name,error:msg});
   await db.prepare("UPDATE property_integrations SET last_error=? WHERE property_id=? AND provider=?").bind(msg.slice(0,500),link.property_id,GOOGLE_ID).run();
   if(e instanceof GoogleError&&(e.status===401||e.status===409||e.status===429))break;
  }
 }
 return res;
}

/** Publica (ou substitui) a resposta a uma review no Google. */
export async function publishGoogleReply(propertyId:string,reviewId:string,comment:string){
 const link=await database().prepare("SELECT external_ref FROM property_integrations WHERE property_id=? AND provider=?").bind(propertyId,GOOGLE_ID).first<{external_ref:string}>();
 if(!link)throw new GoogleError("Este alojamento já não está ligado a um perfil Google.",409);
 await api(`https://mybusiness.googleapis.com/v4/${link.external_ref}/reviews/${encodeURIComponent(reviewId)}/reply`,{method:"PUT",body:JSON.stringify({comment})});
}
