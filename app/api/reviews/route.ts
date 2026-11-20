import {database} from "@/db/raw";
import {guard} from "@/lib/access-server";
import {newId} from "@/lib/property";
import {manualReviewSchema,reviewActionSchema} from "@/lib/review";
import {listReviews,getReview,canSeeProperty} from "@/lib/review-server";
import {aiReady,aiLabel} from "@/lib/ai";
import {publishGoogleReply,GoogleError,connection,googleConfigured} from "@/lib/google-server";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
const CONFLICT="Esta review foi alterada noutra janela. Recarrega a lista.";
async function readJson(request:Request){const raw=await request.text();if(raw.length>30000)return {error:reply({error:"O pedido excede o tamanho permitido."},413)};try{return {data:JSON.parse(raw)}}catch{return {error:reply({error:"Dados inválidos."},400)}}}

export async function GET(request:Request){
 const g=await guard(request,"reviews","view");if("response" in g)return g.response;
 try{
  const a=g.access,level=a.areas.reviews;
  const {results}=await database().prepare("SELECT id,name FROM properties ORDER BY lower(name)").all<{id:string,name:string}>();
  const conn=googleConfigured()?await connection():null;
  return reply({reviews:await listReviews(a),properties:results.filter(p=>canSeeProperty(a,p.id)),can:{draft:level==="propose"||level==="edit",approve:level==="edit",sync:!!conn&&(a.isAdmin||level==="edit")},ai:{ready:await aiReady("reviews"),label:aiLabel("reviews")}});
 }catch(e){console.error("Load reviews",e);return reply({error:"Não foi possível carregar as reviews. Tenta novamente."},503)}
}

/** Nova review introduzida à mão. */
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"reviews","view");if("response" in g)return g.response;
 const level=g.access.areas.reviews;if(level!=="propose"&&level!=="edit")return reply({error:"Não tens permissão para adicionar reviews."},403);
 const body=await readJson(request);if(body.error)return body.error;
 const parsed=manualReviewSchema.safeParse(body.data);if(!parsed.success)return reply({error:parsed.error.issues[0].message,issues:parsed.error.issues},400);
 const r=parsed.data;if(!canSeeProperty(g.access,r.propertyId))return reply({error:"Não tens acesso a este alojamento."},403);
 try{
  const exists=await database().prepare("SELECT id FROM properties WHERE id=?").bind(r.propertyId).first();if(!exists)return reply({error:"O alojamento já não existe."},404);
  const id=newId(),now=new Date().toISOString();
  await database().prepare("INSERT INTO reviews (id,property_id,platform,author,rating,body,review_date,status,source,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'new','manual',1,?,?)").bind(id,r.propertyId,r.platform,r.author,r.rating,r.body,r.reviewDate||now.slice(0,10),now,now).run();
  return reply({review:await getReview(id)},201);
 }catch(e){console.error("Create review",e);return reply({error:"Não foi possível guardar a review."},503)}
}

/** Guardar rascunho, aprovar, marcar como publicada ou reabrir. */
export async function PATCH(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"reviews","view");if("response" in g)return g.response;
 const level=g.access.areas.reviews;
 const body=await readJson(request);if(body.error)return body.error;
 const parsed=reviewActionSchema.safeParse(body.data);if(!parsed.success)return reply({error:parsed.error.issues[0].message,issues:parsed.error.issues},400);
 const act=parsed.data;
 if(act.action==="save"?level!=="propose"&&level!=="edit":level!=="edit")return reply({error:act.action==="save"?"Não tens permissão para responder a reviews.":"Só quem tem permissão de edição pode aprovar respostas."},403);
 try{
  const cur=await getReview(act.id);if(!cur||!canSeeProperty(g.access,cur.propertyId))return reply({error:"A review já não existe."},404);
  if(cur.version!==act.version)return reply({error:CONFLICT},409);
  if(cur.status==="published"&&act.action!=="reopen")return reply({error:"Esta review já foi respondida. Reabre-a para alterar a resposta."},409);
  const now=new Date().toISOString(),who=g.access.name||g.access.email,db=database();
  const q=act.action==="save"?db.prepare("UPDATE reviews SET draft=?,status=CASE WHEN ?='' THEN 'new' ELSE 'draft' END,approved_by='',approved_at=NULL,version=version+1,updated_at=? WHERE id=? AND version=?").bind(act.draft,act.draft.trim(),now,act.id,act.version)
   :act.action==="approve"?db.prepare("UPDATE reviews SET draft=?,status='approved',approved_by=?,approved_at=?,version=version+1,updated_at=? WHERE id=? AND version=?").bind(act.draft.trim(),who,now,now,act.id,act.version)
   :act.action==="published"?(cur.status!=="approved"?null:db.prepare("UPDATE reviews SET reply=draft,status='published',published_at=?,version=version+1,updated_at=? WHERE id=? AND version=?").bind(now,now,act.id,act.version))
   :db.prepare("UPDATE reviews SET status=CASE WHEN draft='' THEN 'new' ELSE 'draft' END,approved_by='',approved_at=NULL,published_at=NULL,version=version+1,updated_at=? WHERE id=? AND version=?").bind(now,act.id,act.version);
  if(!q)return reply({error:"Aprova a resposta antes de a marcar como publicada."},409);
  // Reviews do Google: a resposta é publicada diretamente no perfil antes de ficar como "Respondida".
  if(act.action==="published"&&cur.source==="google"){
   if(!cur.externalId)return reply({error:"Esta review não tem identificador do Google."},409);
   try{await publishGoogleReply(cur.propertyId,cur.externalId,cur.draft)}
   catch(e){if(e instanceof GoogleError)return reply({error:`Não foi publicada no Google: ${e.message}`},e.status);throw e}
  }
  const r=await q.run();if(!r.meta.changes)return reply({error:CONFLICT},409);
  return reply({review:await getReview(act.id)});
 }catch(e){console.error("Update review",e);return reply({error:"Não foi possível guardar. A tua resposta foi mantida. Tenta novamente."},503)}
}

/** Só reviews introduzidas à mão podem ser apagadas (as sincronizadas voltariam na sincronização seguinte). */
export async function DELETE(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"reviews","edit");if("response" in g)return g.response;
 try{
  const u=new URL(request.url),id=u.searchParams.get("id")||"",version=Number(u.searchParams.get("version"));
  const cur=await getReview(id);if(!cur||!canSeeProperty(g.access,cur.propertyId))return reply({error:"A review já não existe."},404);
  if(cur.source!=="manual")return reply({error:"Só podes apagar reviews introduzidas à mão."},409);
  const r=await database().prepare("DELETE FROM reviews WHERE id=? AND version=?").bind(id,version).run();
  if(!r.meta.changes)return reply({error:CONFLICT},409);
  return reply({ok:true});
 }catch(e){console.error("Delete review",e);return reply({error:"Não foi possível apagar a review."},503)}
}
