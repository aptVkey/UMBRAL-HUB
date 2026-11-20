import Anthropic from "@anthropic-ai/sdk";
import {database} from "@/db/raw";
import {seal,open} from "./secret-box";

/**
 * Camada comum de IA do hub. Cada funcionalidade escolhe o fornecedor:
 * - Reviews: REVIEWS_AI_PROVIDER (por omissão "gemini")
 * - Restantes: AI_PROVIDER (por omissão "claude")
 * Chaves: guardadas cifradas (AES-256-GCM, INTEGRATIONS_KEY) na tabela integrations pelo separador Integrações;
 * em alternativa, GEMINI_API_KEY / ANTHROPIC_API_KEY no servidor. A chave guardada no hub tem prioridade.
 */
export const AI_PROVIDERS=["gemini","claude"] as const;
export type AiProvider=typeof AI_PROVIDERS[number];
export type AiFeature="reviews"|"default";

const DEFAULTS:Record<AiFeature,AiProvider>={reviews:"gemini",default:"claude"};
const ENV_KEY:Record<AiProvider,string>={gemini:"GEMINI_API_KEY",claude:"ANTHROPIC_API_KEY"};
const LABEL:Record<AiProvider,string>={gemini:"Gemini",claude:"Claude"};
const ROW_ID=(p:AiProvider)=>`ai_${p}`;
const CLAUDE_MODEL="claude-opus-5-5";
/** Alias da Google que aponta sempre para o Gemini Flash mais recente. Pode ser trocado com GEMINI_MODEL. */
const GEMINI_MODEL=()=>process.env.GEMINI_MODEL?.trim()||"gemini-flash-latest";

/** Erros com mensagem pronta a mostrar ao utilizador e o código HTTP a devolver. */
export class AiError extends Error{constructor(message:string,readonly status:number){super(message)}}

export const isAiProvider=(v:unknown):v is AiProvider=>(AI_PROVIDERS as readonly unknown[]).includes(v);
export function aiProvider(feature:AiFeature="default"):AiProvider{
 const v=(feature==="reviews"?process.env.REVIEWS_AI_PROVIDER:process.env.AI_PROVIDER)?.trim().toLowerCase();
 return isAiProvider(v)?v:DEFAULTS[feature];
}
export const aiLabel=(feature:AiFeature="default")=>LABEL[aiProvider(feature)];

/** Chave válida no formato (não vazia nem o texto de exemplo). */
const plausible=(v:string|undefined)=>!!v&&v.trim().length>=20&&!v.trim().startsWith("<");
const envKey=(p:AiProvider)=>{const v=process.env[ENV_KEY[p]];return plausible(v)?v!.trim():""};

// Cache curta por instância para não decifrar em cada pedido.
const cache=new Map<AiProvider,{key:string,until:number}>();
type Row={secret_enc:string,account_label:string,connected_by:string,connected_at:string};
const loadRow=(p:AiProvider)=>database().prepare("SELECT secret_enc,account_label,connected_by,connected_at FROM integrations WHERE id=?").bind(ROW_ID(p)).first<Row>();

/** Chave em uso: a guardada no hub (decifrada) ou, na falta dela, a variável de ambiente. */
async function getKey(p:AiProvider):Promise<string>{
 const c=cache.get(p);if(c&&c.until>Date.now())return c.key;
 let key="";
 try{const row=await loadRow(p);if(row?.secret_enc)key=await open(row.secret_enc)}catch(e){console.error("AI key",p,e instanceof Error?e.message:e)}
 key=key||envKey(p);
 cache.set(p,{key,until:Date.now()+60_000});
 return key;
}
export const aiReady=async(feature:AiFeature="default")=>!!(await getKey(aiProvider(feature)));

/** Testa a chave com um pedido de leitura barato (lista de modelos). */
async function validateKey(p:AiProvider,key:string){
 try{
  if(p==="gemini"){
   const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",{headers:{"x-goog-api-key":key},signal:AbortSignal.timeout(15000)});
   if(r.ok)return;
   if(r.status===429)return; // chave válida, só limitada
   throw new AiError("A Google não aceitou esta chave do Gemini. Confirma que a copiaste inteira.",400);
  }
  await new Anthropic({apiKey:key}).models.list({limit:1});
 }catch(e){
  if(e instanceof AiError)throw e;
  if(e instanceof Anthropic.RateLimitError)return;
  if(e instanceof Anthropic.AuthenticationError||e instanceof Anthropic.PermissionDeniedError)throw new AiError("A Anthropic não aceitou esta chave. Confirma que a copiaste inteira.",400);
  console.error("Validate AI key",p,e instanceof Error?e.message:e);
  throw new AiError("Não foi possível validar a chave agora. Tenta novamente.",502);
 }
}

/** Guarda a chave cifrada, depois de a validar junto do fornecedor. */
export async function saveAiKey(p:AiProvider,key:string,who:string){
 if(!process.env.INTEGRATIONS_KEY)throw new AiError("Falta a INTEGRATIONS_KEY no servidor: sem ela não é possível cifrar a chave.",503);
 const k=key.trim();
 if(!plausible(k)||/\s/.test(k))throw new AiError("Esta chave não parece válida.",400);
 await validateKey(p,k);
 const now=new Date().toISOString(),hint=`…${k.slice(-4)}`;
 await database().prepare("INSERT INTO integrations (id,secret_enc,account_label,connected_by,connected_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT (id) DO UPDATE SET secret_enc=EXCLUDED.secret_enc,account_label=EXCLUDED.account_label,connected_by=EXCLUDED.connected_by,connected_at=EXCLUDED.connected_at,updated_at=EXCLUDED.updated_at")
  .bind(ROW_ID(p),await seal(k),hint,who,now,now).run();
 cache.delete(p);
}
export async function removeAiKey(p:AiProvider){
 await database().prepare("DELETE FROM integrations WHERE id=?").bind(ROW_ID(p)).run();
 cache.delete(p);
}

/** Estado dos fornecedores para o separador Integrações. Nunca devolve a chave (só os últimos 4 caracteres). */
export async function aiStatus(){
 const providers=await Promise.all(AI_PROVIDERS.map(async p=>{
  let row:Row|null=null;try{row=await loadRow(p)}catch{}
  const source=row?"hub":envKey(p)?"env":null;
  return {id:p,label:LABEL[p],env:ENV_KEY[p],configured:!!source,source,hint:row?.account_label||"",savedBy:row?.connected_by||"",savedAt:row?.connected_at||null,model:p==="gemini"?GEMINI_MODEL():CLAUDE_MODEL};
 }));
 return {
  providers,canStore:!!process.env.INTEGRATIONS_KEY,
  uses:[{feature:"Reviews",provider:aiProvider("reviews"),env:"REVIEWS_AI_PROVIDER"},{feature:"Outras funcionalidades",provider:aiProvider("default"),env:"AI_PROVIDER"}]
 };
}

export type AiRequest={system:string;user:string;maxTokens?:number};

/** Gera texto com o fornecedor configurado para a funcionalidade. */
export async function generateText(feature:AiFeature,req:AiRequest):Promise<string>{
 const p=aiProvider(feature),key=await getKey(p);
 if(!key)throw new AiError(`A IA ainda não está configurada: um administrador tem de registar a chave do ${LABEL[p]} em Integrações.`,503);
 const text=p==="gemini"?await gemini(req,key):await claude(req,key);
 if(!text.trim())throw new AiError("A IA devolveu uma resposta vazia. Tenta novamente.",502);
 return text.trim();
}

async function claude(req:AiRequest,apiKey:string):Promise<string>{
 const client=new Anthropic({apiKey});
 try{
  const response=await client.beta.messages.create({
   model:CLAUDE_MODEL,max_tokens:req.maxTokens??16000,
   betas:["server-side-fallback-2026-07-01"],fallbacks:"default",
   output_config:{effort:"medium"},
   system:[{type:"text",text:req.system,cache_control:{type:"ephemeral"}}],
   messages:[{role:"user",content:req.user}]
  });
  if(response.stop_reason==="refusal")throw new AiError("A IA não conseguiu gerar uma resposta. Escreve-a manualmente.",422);
  return response.content.flatMap(b=>b.type==="text"?[b.text]:[]).join("");
 }catch(e){
  if(e instanceof AiError)throw e;
  if(e instanceof Anthropic.RateLimitError)throw new AiError("A IA está com muitos pedidos. Tenta daqui a um minuto.",429);
  if(e instanceof Anthropic.AuthenticationError)throw new AiError("A chave do Claude deixou de ser válida. Regista uma nova em Integrações.",503);
  if(e instanceof Anthropic.APIError){console.error("Claude",e.status,e.message);throw new AiError("A IA não respondeu. Tenta novamente.",502)}
  throw e;
 }
}

type GeminiResponse={candidates?:{content?:{parts?:{text?:string,thought?:boolean}[]},finishReason?:string}[];promptFeedback?:{blockReason?:string};error?:{code?:number,message?:string,status?:string}};

async function gemini(req:AiRequest,apiKey:string):Promise<string>{
 const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL())}:generateContent`;
 let r:Response;
 try{
  r=await fetch(url,{method:"POST",signal:AbortSignal.timeout(50000),headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},body:JSON.stringify({
   systemInstruction:{parts:[{text:req.system}]},
   contents:[{role:"user",parts:[{text:req.user}]}],
   generationConfig:{maxOutputTokens:req.maxTokens??8192,temperature:0.7}
  })});
 }catch(e){console.error("Gemini fetch",e);throw new AiError("A IA não respondeu. Tenta novamente.",502)}
 const d=await r.json().catch(()=>({})) as GeminiResponse;
 if(!r.ok){
  const msg=d.error?.message||"",status=d.error?.status||"";
  console.error("Gemini",r.status,status,msg);
  if(r.status===402||/prepayment|credits are depleted|billing/i.test(msg))throw new AiError("O projeto Google desta chave do Gemini ficou sem saldo. Adiciona créditos em aistudio.google.com ou regista uma chave de um projeto sem faturação (plano gratuito).",402);
  if(r.status===429)throw new AiError("A IA atingiu o limite de pedidos do plano. Tenta daqui a um minuto.",429);
  if(/API_KEY_INVALID|API key not valid/i.test(msg)||r.status===401||r.status===403)throw new AiError("A chave do Gemini deixou de ser válida. Regista uma nova em Integrações.",503);
  if(r.status===404)throw new AiError(`O modelo Gemini "${GEMINI_MODEL()}" não existe. Ajusta a GEMINI_MODEL.`,503);
  throw new AiError("A IA não respondeu. Tenta novamente.",502);
 }
 if(d.promptFeedback?.blockReason)throw new AiError("A IA recusou responder a esta review. Escreve a resposta manualmente.",422);
 const c=d.candidates?.[0];
 if(c?.finishReason==="SAFETY"||c?.finishReason==="PROHIBITED_CONTENT")throw new AiError("A IA recusou responder a esta review. Escreve a resposta manualmente.",422);
 const text=(c?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||"").join("");
 if(c?.finishReason==="MAX_TOKENS"&&!text.trim())throw new AiError("A IA não terminou a resposta. Tenta novamente.",502);
 return text;
}
