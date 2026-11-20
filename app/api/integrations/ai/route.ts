import {z} from "zod";
import {getAccess} from "@/lib/access-server";
import {AI_PROVIDERS,AiError,saveAiKey,removeAiKey,aiStatus} from "@/lib/ai";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
const NOT_ADMIN="Só os administradores podem gerir integrações.";
const input=z.object({provider:z.enum(AI_PROVIDERS),key:z.string().min(1,"Cola a chave.").max(400,"A chave é demasiado longa.")});

/** Regista (ou substitui) a chave de um fornecedor de IA. A chave é validada, cifrada e nunca devolvida. */
export async function PUT(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const a=await getAccess(request);if(!a.isAdmin)return reply({error:NOT_ADMIN},403);
 const raw=await request.text();if(raw.length>2000)return reply({error:"O pedido excede o tamanho permitido."},413);
 let parsed;try{parsed=input.safeParse(JSON.parse(raw))}catch{return reply({error:"Dados inválidos."},400)}
 if(!parsed.success)return reply({error:parsed.error.issues[0].message},400);
 try{await saveAiKey(parsed.data.provider,parsed.data.key,a.name||a.email);return reply({ai:await aiStatus()})}
 catch(e){if(e instanceof AiError)return reply({error:e.message},e.status);console.error("Save AI key",e instanceof Error?e.message:e);return reply({error:"Não foi possível guardar a chave."},503)}
}

/** Remove a chave guardada no hub (se existir variável de ambiente, essa passa a ser usada). */
export async function DELETE(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const a=await getAccess(request);if(!a.isAdmin)return reply({error:NOT_ADMIN},403);
 const p=new URL(request.url).searchParams.get("provider");
 if(!(AI_PROVIDERS as readonly string[]).includes(p||""))return reply({error:"Fornecedor inválido."},400);
 try{await removeAiKey(p as typeof AI_PROVIDERS[number]);return reply({ai:await aiStatus()})}
 catch(e){console.error("Remove AI key",e);return reply({error:"Não foi possível remover a chave."},503)}
}
