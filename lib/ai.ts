import Anthropic from "@anthropic-ai/sdk";

/**
 * Camada comum de IA do hub. Cada funcionalidade escolhe o fornecedor:
 * - Reviews: REVIEWS_AI_PROVIDER (por omissão "gemini")
 * - Restantes: AI_PROVIDER (por omissão "claude")
 * Chaves: GEMINI_API_KEY e ANTHROPIC_API_KEY (só no servidor).
 */
export const AI_PROVIDERS=["gemini","claude"] as const;
export type AiProvider=typeof AI_PROVIDERS[number];
export type AiFeature="reviews"|"default";

const DEFAULTS:Record<AiFeature,AiProvider>={reviews:"gemini",default:"claude"};
const ENV_KEY:Record<AiProvider,string>={gemini:"GEMINI_API_KEY",claude:"ANTHROPIC_API_KEY"};
const LABEL:Record<AiProvider,string>={gemini:"Gemini",claude:"Claude"};
const CLAUDE_MODEL="claude-opus-5-5";
/** Alias da Google que aponta sempre para o Gemini Flash mais recente. Pode ser trocado com GEMINI_MODEL. */
const GEMINI_MODEL=()=>process.env.GEMINI_MODEL?.trim()||"gemini-flash-latest";

/** Erros com mensagem pronta a mostrar ao utilizador e o código HTTP a devolver. */
export class AiError extends Error{constructor(message:string,readonly status:number){super(message)}}

export function aiProvider(feature:AiFeature="default"):AiProvider{
 const v=(feature==="reviews"?process.env.REVIEWS_AI_PROVIDER:process.env.AI_PROVIDER)?.trim().toLowerCase();
 return (AI_PROVIDERS as readonly string[]).includes(v||"")?v as AiProvider:DEFAULTS[feature];
}
/** A chave existe e não é o texto de exemplo. */
const hasKey=(p:AiProvider)=>{const v=process.env[ENV_KEY[p]]?.trim()||"";return v.length>=20&&!v.startsWith("<")};
export const aiReady=(feature:AiFeature="default")=>hasKey(aiProvider(feature));
export const aiLabel=(feature:AiFeature="default")=>LABEL[aiProvider(feature)];
export const aiKeyName=(feature:AiFeature="default")=>ENV_KEY[aiProvider(feature)];

/** Estado dos fornecedores para o separador Integrações (sem chaves). */
export function aiStatus(){
 return {
  providers:AI_PROVIDERS.map(p=>({id:p,label:LABEL[p],key:ENV_KEY[p],configured:hasKey(p),model:p==="gemini"?GEMINI_MODEL():CLAUDE_MODEL})),
  uses:[{feature:"Reviews",provider:aiProvider("reviews"),env:"REVIEWS_AI_PROVIDER"},{feature:"Outras funcionalidades",provider:aiProvider("default"),env:"AI_PROVIDER"}]
 };
}

export type AiRequest={system:string;user:string;maxTokens?:number};

/** Gera texto com o fornecedor configurado para a funcionalidade. */
export async function generateText(feature:AiFeature,req:AiRequest):Promise<string>{
 const p=aiProvider(feature);
 if(!hasKey(p))throw new AiError(`A IA ainda não está configurada no servidor (falta a ${ENV_KEY[p]}).`,503);
 const text=p==="gemini"?await gemini(req):await claude(req);
 if(!text.trim())throw new AiError("A IA devolveu uma resposta vazia. Tenta novamente.",502);
 return text.trim();
}

async function claude(req:AiRequest):Promise<string>{
 const client=new Anthropic();
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
  if(e instanceof Anthropic.AuthenticationError)throw new AiError("A chave da IA (ANTHROPIC_API_KEY) não é válida.",503);
  if(e instanceof Anthropic.APIError){console.error("Claude",e.status,e.message);throw new AiError("A IA não respondeu. Tenta novamente.",502)}
  throw e;
 }
}

type GeminiResponse={candidates?:{content?:{parts?:{text?:string,thought?:boolean}[]},finishReason?:string}[];promptFeedback?:{blockReason?:string};error?:{code?:number,message?:string,status?:string}};

async function gemini(req:AiRequest):Promise<string>{
 const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL())}:generateContent`;
 let r:Response;
 try{
  r=await fetch(url,{method:"POST",signal:AbortSignal.timeout(50000),headers:{"Content-Type":"application/json","x-goog-api-key":process.env.GEMINI_API_KEY!.trim()},body:JSON.stringify({
   systemInstruction:{parts:[{text:req.system}]},
   contents:[{role:"user",parts:[{text:req.user}]}],
   generationConfig:{maxOutputTokens:req.maxTokens??8192,temperature:0.7}
  })});
 }catch(e){console.error("Gemini fetch",e);throw new AiError("A IA não respondeu. Tenta novamente.",502)}
 const d=await r.json().catch(()=>({})) as GeminiResponse;
 if(!r.ok){
  const msg=d.error?.message||"",status=d.error?.status||"";
  console.error("Gemini",r.status,status,msg);
  if(r.status===429)throw new AiError("A IA atingiu o limite de pedidos do plano. Tenta daqui a um minuto.",429);
  if(/API_KEY_INVALID|API key not valid/i.test(msg)||r.status===401||r.status===403)throw new AiError("A chave da IA (GEMINI_API_KEY) não é válida ou não tem acesso.",503);
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
