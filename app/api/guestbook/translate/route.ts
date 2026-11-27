import {guardEditable} from "@/lib/access-server";
import {aiReady,generateText,AiError} from "@/lib/ai";
import {LANGS,isLang,type Lang} from "@/lib/guestbook";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
const NAMES:Record<Lang,string>={pt:"Portuguese (Portugal)",en:"English",fr:"French",es:"Spanish",de:"German"};
const SYSTEM=`You translate guest information for holiday accommodation in Portugal (hotels, guesthouses, apartments) from European Portuguese.
Rules:
- Translate faithfully, in a warm and clear tone suitable for hotel guests. Do not add, remove or invent information.
- Keep line breaks, lists, numbers, times, prices, phone numbers, e-mail addresses, URLs and Wi-Fi names exactly as they are.
- Do not translate proper names of places, streets, restaurants or businesses.
- Reply with JSON only, no comments and no code fences, with exactly the ids you receive.`;
/** Traduz textos do livro de PT para as línguas pedidas, com o fornecedor de IA configurado. */
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"properties");if("response" in g)return g.response;
 try{
  const raw=await request.text();if(raw.length>60000)return reply({error:"Há demasiado texto para traduzir de uma vez."},413);
  let input:{items?:unknown,langs?:unknown};try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
  const items=Array.isArray(input.items)?input.items.filter((i):i is {id:string,text:string}=>!!i&&typeof i.id==="string"&&typeof i.text==="string"&&!!i.text.trim()).slice(0,80):[];
  const langs=(Array.isArray(input.langs)?input.langs.filter(isLang):LANGS.slice(1)).filter(l=>l!=="pt");
  if(!items.length||!langs.length)return reply({translations:{}});
  if(items.reduce((n,i)=>n+i.text.length,0)>40000)return reply({error:"Há demasiado texto para traduzir de uma vez."},413);
  const feature=await aiReady("default")?"default":"reviews";
  const source=JSON.stringify(Object.fromEntries(items.map(i=>[i.id,i.text])));
  const ask=(lang:Lang)=>generateText(feature,{system:SYSTEM,user:`Target language: ${lang} (${NAMES[lang]}). Reply with {"<id>":"<translation>"} for every id.\n\n${source}`,maxTokens:12000});
  /** Um pedido por língua, em paralelo (mais rápido e, se uma falhar, as outras aproveitam-se). Uma segunda tentativa só se a primeira falhar depressa (fornecedor sobrecarregado), para não deixar o editor minutos à espera. */
  const one=async(lang:Lang)=>{let out:string;const t0=Date.now();try{out=await ask(lang)}catch(e){if(!(e instanceof AiError)||(e.status!==502&&e.status!==429)||Date.now()-t0>15000)throw e;await new Promise(r=>setTimeout(r,1500));out=await ask(lang)}
   const data=JSON.parse(out.slice(out.indexOf("{"),out.lastIndexOf("}")+1)) as Record<string,unknown>;return [lang,data] as const};
  const results=await Promise.allSettled(langs.map(one));
  const ok=results.flatMap(r=>r.status==="fulfilled"?[r.value]:[]);
  if(!ok.length){const e=results.find(r=>r.status==="rejected") as PromiseRejectedResult|undefined;if(e?.reason instanceof AiError)return reply({error:e.reason.message},e.reason.status);return reply({error:"A tradução falhou. Tenta novamente."},502)}
  const translations:Record<string,Partial<Record<Lang,string>>>={};
  for(const i of items){translations[i.id]={};for(const [lang,data] of ok){const v=data[i.id];if(typeof v==="string"&&v.trim())translations[i.id][lang]=v.slice(0,6000)}}
  const failed=langs.filter(l=>!ok.some(([x])=>x===l));
  return reply({translations,failed});
 }catch(e){
  if(e instanceof AiError)return reply({error:e.message},e.status);
  console.error("Translate guestbook",e);return reply({error:"Não foi possível traduzir. Tenta novamente."},503);
 }
}
