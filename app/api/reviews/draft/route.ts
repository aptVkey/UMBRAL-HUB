import {database} from "@/db/raw";
import {guard} from "@/lib/access-server";
import type {Property} from "@/lib/property";
import {ratingScale} from "@/lib/review";
import {getReview,canSeeProperty} from "@/lib/review-server";
import {draftReply} from "@/lib/review-ai";
import {AiError,aiLabel} from "@/lib/ai";
import {z} from "zod";
export const dynamic="force-dynamic";
export const maxDuration=60;
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const input=z.object({id:z.string().uuid(),version:z.number().int().min(1)});

/** Gera um rascunho de resposta com IA. Nunca publica: a resposta fica como rascunho para uma pessoa rever. */
export async function POST(request:Request){
 if(request.headers.get("origin")&&request.headers.get("origin")!==new URL(request.url).origin)return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"reviews","view");if("response" in g)return g.response;
 const level=g.access.areas.reviews;if(level!=="propose"&&level!=="edit")return reply({error:"Não tens permissão para responder a reviews."},403);
 let parsed;try{parsed=input.safeParse(JSON.parse(await request.text()))}catch{return reply({error:"Dados inválidos."},400)}
 if(!parsed.success)return reply({error:"Pedido inválido."},400);
 const cur=await getReview(parsed.data.id);if(!cur||!canSeeProperty(g.access,cur.propertyId))return reply({error:"A review já não existe."},404);
 if(cur.version!==parsed.data.version)return reply({error:"Esta review foi alterada noutra janela. Recarrega a lista."},409);
 if(cur.status==="published")return reply({error:"Esta review já foi respondida."},409);
 try{
  const row=await database().prepare("SELECT payload FROM properties WHERE id=?").bind(cur.propertyId).first<{payload:string}>();
  if(!row)return reply({error:"O alojamento já não existe."},404);
  const text=await draftReply({property:JSON.parse(row.payload) as Property,platform:cur.platform,author:cur.author,rating:cur.rating,scale:ratingScale(cur.platform),body:cur.body});
  const now=new Date().toISOString();
  const r=await database().prepare("UPDATE reviews SET draft=?,status='draft',drafted_by=?,approved_by='',approved_at=NULL,version=version+1,updated_at=? WHERE id=? AND version=?").bind(text,`IA · ${aiLabel("reviews")}`,now,cur.id,cur.version).run();
  if(!r.meta.changes)return reply({error:"Esta review foi alterada noutra janela. Recarrega a lista."},409);
  return reply({review:await getReview(cur.id)});
 }catch(e){
  if(e instanceof AiError)return reply({error:e.message},e.status);
  console.error("Review draft",e);return reply({error:e instanceof Error?e.message:"Não foi possível gerar a resposta."},500);
 }
}
