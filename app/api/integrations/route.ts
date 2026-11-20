import {z} from "zod";
import {database} from "@/db/raw";
import {getAccess} from "@/lib/access-server";
import {GOOGLE_ID,googleConfigured,connection} from "@/lib/google-server";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const NOT_ADMIN="Só os administradores podem gerir integrações.";

/** Estado das integrações e correspondências alojamento ↔ perfil Google (só administradores; sem segredos). */
export async function GET(request:Request){
 const a=await getAccess(request);if(!a.isAdmin)return reply({error:NOT_ADMIN},403);
 try{
  const db=database();
  const [conn,{results:links},{results:properties}]=await Promise.all([connection(),
   db.prepare("SELECT property_id,external_ref,label,last_sync_at,last_error FROM property_integrations WHERE provider=?").bind(GOOGLE_ID).all<{property_id:string,external_ref:string,label:string,last_sync_at:string|null,last_error:string}>(),
   db.prepare("SELECT id,name FROM properties ORDER BY lower(name)").all<{id:string,name:string}>()]);
  return reply({google:{configured:googleConfigured(),connected:!!conn,account:conn?.account_label||"",connectedBy:conn?.connected_by||"",connectedAt:conn?.connected_at||null},
   links:links.map(l=>({propertyId:l.property_id,externalRef:l.external_ref,label:l.label,lastSyncAt:l.last_sync_at,lastError:l.last_error})),properties});
 }catch(e){console.error("Load integrations",e);return reply({error:"Não foi possível carregar as integrações."},503)}
}

const linksSchema=z.object({links:z.array(z.object({propertyId:z.string().uuid(),externalRef:z.string().regex(/^accounts\/[\w-]+\/locations\/[\w-]+$/,"Perfil Google inválido."),label:z.string().max(300)})).max(500)})
 .refine(v=>new Set(v.links.map(l=>l.propertyId)).size===v.links.length,"Cada alojamento só pode ter um perfil Google.")
 .refine(v=>new Set(v.links.map(l=>l.externalRef)).size===v.links.length,"Cada perfil Google só pode estar ligado a um alojamento.");
/** Substitui as correspondências do Google pelas enviadas. */
export async function PUT(request:Request){
 if(request.headers.get("origin")&&request.headers.get("origin")!==new URL(request.url).origin)return reply({error:"Pedido não autorizado."},403);
 const a=await getAccess(request);if(!a.isAdmin)return reply({error:NOT_ADMIN},403);
 let parsed;try{parsed=linksSchema.safeParse(JSON.parse(await request.text()))}catch{return reply({error:"Dados inválidos."},400)}
 if(!parsed.success)return reply({error:parsed.error.issues[0].message},400);
 try{
  const db=database(),links=parsed.data.links;
  if(links.length){const n=await db.prepare("SELECT COUNT(*) AS n FROM properties WHERE id IN (SELECT jsonb_array_elements_text(?::jsonb))").bind(JSON.stringify(links.map(l=>l.propertyId))).first<{n:number}>();if(Number(n?.n)!==links.length)return reply({error:"A lista de alojamentos mudou. Recarrega e tenta de novo."},409)}
  await db.batch([db.prepare("DELETE FROM property_integrations WHERE provider=? AND property_id NOT IN (SELECT jsonb_array_elements_text(?::jsonb))").bind(GOOGLE_ID,JSON.stringify(links.map(l=>l.propertyId))),
   ...links.map(l=>db.prepare("INSERT INTO property_integrations (property_id,provider,external_ref,label) VALUES (?,?,?,?) ON CONFLICT (property_id,provider) DO UPDATE SET external_ref=EXCLUDED.external_ref,label=EXCLUDED.label,last_error=CASE WHEN property_integrations.external_ref=EXCLUDED.external_ref THEN property_integrations.last_error ELSE '' END,last_sync_at=CASE WHEN property_integrations.external_ref=EXCLUDED.external_ref THEN property_integrations.last_sync_at ELSE NULL END").bind(l.propertyId,GOOGLE_ID,l.externalRef,l.label))]);
  return reply({ok:true});
 }catch(e){console.error("Save integrations",e);return reply({error:"Não foi possível guardar as correspondências."},503)}
}
