import {database} from "@/db/raw";
import {guard,guardEditable,deny} from "@/lib/access-server";
import {cityKey,cityRecsSchema} from "@/lib/guestbook";
import {loadRecs} from "@/lib/guestbook-server";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
/** Recomendações de uma localidade (partilhadas por todos os alojamentos dessa localidade). */
export async function GET(request:Request){
 const g=await guard(request,"properties","view");if("response" in g)return g.response;
 try{const city=(new URL(request.url).searchParams.get("city")||"").trim().slice(0,120);if(!cityKey(city))return reply({error:"Indica a localidade do alojamento."},400);return reply({city,recs:await loadRecs(city)})}
 catch(e){console.error("Load recs",e);return reply({error:"Não foi possível carregar as recomendações."},503)}
}
export async function PUT(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"properties");if("response" in g)return g.response;
 if(g.mode==="propose")return reply({error:"Só editores ou administradores podem alterar as recomendações."},403);
 try{
  const raw=await request.text();if(raw.length>400000)return reply({error:"As recomendações excedem o tamanho permitido."},413);
  let input:{city?:unknown}&Record<string,unknown>;try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
  const city=typeof input.city==="string"?input.city.trim().slice(0,120):"",key=cityKey(city);if(!key)return reply({error:"Indica a localidade do alojamento."},400);
  const parsed=cityRecsSchema.safeParse(input);if(!parsed.success)return reply({error:parsed.error.issues[0].message},400);
  const db=database();
  // Quem só tem acesso a alguns alojamentos só altera as recomendações das localidades desses alojamentos.
  if(g.access.propertyIds!==null){const {results}=await db.prepare("SELECT payload::jsonb->>'city' AS city FROM properties WHERE id IN (SELECT jsonb_array_elements_text(?::jsonb))").bind(JSON.stringify(g.access.propertyIds)).all<{city:string|null}>();if(!results.some(r=>cityKey(r.city||"")===key))return deny("Não tens acesso a alojamentos desta localidade.")}
  const {version,items}=parsed.data,next=version+1,now=new Date().toISOString(),by=g.access.name||g.access.email,payload=JSON.stringify({items});
  const r=version===0
   ?await db.prepare("INSERT INTO guestbook_recs (city_key,city,payload,version,updated_at,updated_by) VALUES (?,?,?,?,?,?) ON CONFLICT(city_key) DO NOTHING").bind(key,city,payload,next,now,by).run()
   :await db.prepare("UPDATE guestbook_recs SET city=?,payload=?,version=?,updated_at=?,updated_by=? WHERE city_key=? AND version=?").bind(city,payload,next,now,by,key,version).run();
  if(!r.meta.changes)return reply({error:"As recomendações desta localidade foram alteradas noutra janela. Recarrega para veres a versão mais recente."},409);
  return reply({city,recs:{version:next,items}});
 }catch(e){console.error("Save recs",e);return reply({error:"Não foi possível guardar as recomendações."},503)}
}
