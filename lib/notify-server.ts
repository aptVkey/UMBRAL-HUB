import {database} from "@/db/raw";
import {AREAS,type AreaKey,type AreaMap,type Member,type Role} from "./access";
import {areasFor,linkedProperties,type Access} from "./access-server";
import {ENTITY_LABEL,actionLabel,type ChangeAction,type EntityType} from "./change-request";
import {withDefaults,type NotifyEvent,type NotifyPrefs} from "./notification";
import {appUrl,emailConfigured,renderEmail,sendEmail} from "./email";
import {newId} from "./property";

/**
 * Notificações da equipa por email (Resend). Nunca falham o pedido que as origina:
 * qualquer erro fica registado em `notifications` e no log. Os emails nunca incluem
 * dados sensíveis (códigos de keysafe, tarifas, contratos): só o quê, quem e um link para a app.
 */
type Recipient={email:string,name:string,isAdmin:boolean,areas:AreaMap,propertyIds:string[]|null,prefs:NotifyPrefs};
type Outgoing={event:NotifyEvent,to:string,subject:string,html:string,text:string,dedupeKey?:string};
const DEDUPE_MINUTES=30,MAX_ATTEMPTS=3;
const areaName=(a:AreaKey)=>AREAS.find(x=>x.key===a)?.name||a;
const fmtDate=(d=new Date())=>d.toLocaleString("pt-PT",{timeZone:"Europe/Lisbon",dateStyle:"short",timeStyle:"short"});

async function recipients():Promise<Recipient[]>{
 const db=database();
 const [m,l,p]=await db.batch([
  db.prepare("SELECT id,email,name,role,payload FROM team_members WHERE status='Ativo'"),
  db.prepare("SELECT member_id,property_id FROM team_member_properties"),
  db.prepare("SELECT email,prefs FROM notification_prefs")]);
 const scope=new Map<string,string[]>();for(const r of l.results as {member_id:string,property_id:string}[])scope.set(r.member_id,[...(scope.get(r.member_id)||[]),r.property_id]);
 const prefs=new Map((p.results as {email:string,prefs:string}[]).map(r=>{try{return [r.email,JSON.parse(r.prefs)]}catch{return [r.email,{}]}}));
 return (m.results as {id:string,email:string,name:string,role:Role,payload:string}[]).map(r=>{
  const member=JSON.parse(r.payload) as Member,isAdmin=r.role==="Administrador";
  return {email:r.email,name:r.name,isAdmin,areas:areasFor(r.role,member),propertyIds:isAdmin||member.propertyScope!=="selected"?null:scope.get(r.id)||[],prefs:withDefaults(prefs.get(r.email))};
 });
}
/** O destinatário consegue ver este registo? (mesmas regras de âmbito por alojamento da app) */
async function visibility(entityType:EntityType,entityId:string){
 if(entityType==="property")return (r:Recipient)=>r.propertyIds===null||r.propertyIds.includes(entityId);
 if(entityType==="corporate"||entityType==="campaign"){
  const ids=await linkedProperties(entityType==="corporate"?"corporate_properties":"campaign_properties",entityType==="corporate"?"corporate_id":"campaign_id",entityId).catch(()=>[] as string[]);
  return (r:Recipient)=>r.propertyIds===null||!ids.length||ids.some(id=>r.propertyIds!.includes(id));
 }
 return ()=>true;
}
async function deliver(list:Outgoing[]){
 if(!list.length)return;
 const db=database();
 // Anti-spam: o mesmo aviso (dedupeKey) não se repete para a mesma pessoa durante 30 minutos.
 const keyed=list.filter(o=>o.dedupeKey);
 let recent=new Set<string>();
 if(keyed.length){
  const {results}=await db.prepare(`SELECT recipient_email,dedupe_key FROM notifications WHERE dedupe_key IN (SELECT jsonb_array_elements_text(?::jsonb)) AND status<>'failed' AND created_at>now()-interval '${DEDUPE_MINUTES} minutes'`).bind(JSON.stringify([...new Set(keyed.map(o=>o.dedupeKey))])).all<{recipient_email:string,dedupe_key:string}>();
  recent=new Set(results.map(r=>r.recipient_email+"|"+r.dedupe_key));
 }
 const todo=list.filter(o=>!o.dedupeKey||!recent.has(o.to+"|"+o.dedupeKey)).map(o=>({...o,id:newId()}));
 if(!todo.length)return;
 const configured=emailConfigured();
 await db.batch(todo.map(o=>db.prepare("INSERT INTO notifications (id,event,recipient_email,subject,html,text_body,dedupe_key,status) VALUES (?,?,?,?,?,?,?,?)").bind(o.id,o.event,o.to,o.subject,o.html,o.text,o.dedupeKey||null,configured?"pending":"skipped")));
 if(!configured){console.warn("Notificações: Resend não configurado; emails registados como 'skipped'.");return}
 const results=await Promise.all(todo.map(o=>sendEmail(o)));
 await db.batch(todo.map((o,i)=>{const r=results[i];return r.ok
  ?db.prepare("UPDATE notifications SET status='sent',attempts=attempts+1,provider_id=?,sent_at=now(),error=NULL WHERE id=?").bind(r.id,o.id)
  :db.prepare("UPDATE notifications SET status=?,attempts=attempts+1,error=? WHERE id=?").bind(r.retry?"failed":"error",r.error,o.id)}));
}
/** Corre a notificação sem nunca deixar um erro chegar ao pedido original. */
async function safely(label:string,fn:()=>Promise<void>){try{await fn()}catch(e){console.error("Notificação",label,e)}}
const cta=()=>{const url=appUrl();return url?{label:"Abrir o Umbral Hub",url}:undefined};

/** Um contribuidor propôs uma alteração: avisa quem a pode aprovar (exceto o próprio). */
export const notifyApprovalRequested=(o:{area:AreaKey,entityType:EntityType,entityId:string,entityName:string,action:ChangeAction,access:Access})=>safely("approvalRequested",async()=>{
 const [all,visible]=await Promise.all([recipients(),visibility(o.entityType,o.entityId)]);
 const what=`${ENTITY_LABEL[o.entityType]} · ${o.entityName}`;
 const list=all.filter(r=>r.email!==o.access.email&&(r.isAdmin||r.areas[o.area]==="edit")&&r.prefs.approvalRequested&&visible(r)).map(r=>{
  const {html,text}=renderEmail({eyebrow:"Aprovação pendente",title:"Nova proposta para aprovar",intro:`${o.access.name||o.access.email} propôs uma ${o.action==="delete"?"eliminação":"alteração"} que aguarda a tua aprovação.`,
   rows:[["Área",areaName(o.area)],["Registo",what],["Tipo",actionLabel(o.action)],["Pedido por",o.access.name||o.access.email],["Data",fmtDate()]],
   note:"Revê a proposta no sino de notificações do Hub para a aprovar ou rejeitar.",cta:cta()});
  return {event:"approvalRequested" as const,to:r.email,subject:`Aprovação pendente: ${what}`,html,text};
 });
 await deliver(list);
});
/** Uma proposta foi aprovada ou rejeitada: avisa quem a pediu. */
export const notifyApprovalDecided=(o:{area:AreaKey,entityType:EntityType,entityName:string,action:ChangeAction,requestedByEmail:string,decision:"approved"|"rejected",note?:string|null,access:Access})=>safely("approvalDecided",async()=>{
 if(o.requestedByEmail===o.access.email)return;
 const r=(await recipients()).find(x=>x.email===o.requestedByEmail);if(!r||!r.prefs.approvalDecided)return;
 const ok=o.decision==="approved",what=`${ENTITY_LABEL[o.entityType]} · ${o.entityName}`;
 const {html,text}=renderEmail({eyebrow:"Decisão sobre o teu pedido",title:ok?"A tua proposta foi aprovada":"A tua proposta foi rejeitada",
  intro:ok?`${o.access.name||o.access.email} aprovou a tua proposta. A alteração já está visível no Hub.`:`${o.access.name||o.access.email} rejeitou a tua proposta. Nada foi alterado.`,
  rows:[["Área",areaName(o.area)],["Registo",what],["Tipo",actionLabel(o.action)],["Decisão",ok?"Aprovada":"Rejeitada"],["Revisto por",o.access.name||o.access.email],["Data",fmtDate()]],
  note:o.note?.trim()?`Nota: ${o.note.trim()}`:undefined,cta:cta()});
 await deliver([{event:"approvalDecided",to:r.email,subject:`${ok?"Aprovada":"Rejeitada"}: ${what}`,html,text}]);
});
/** Alteração aplicada (direta ou por aprovação): avisa quem tem acesso à área, exceto o autor. */
export const notifyRecordChanged=(o:{area:AreaKey,entityType:EntityType,entityId:string,entityName:string,kind:"create"|"update"|"delete",access:Access,exclude?:string[]})=>safely("recordChanged",async()=>{
 const [all,visible]=await Promise.all([recipients(),visibility(o.entityType,o.entityId)]);
 const skip=new Set([o.access.email,...(o.exclude||[])]);
 const verb=o.kind==="create"?"criou":o.kind==="delete"?"eliminou":"alterou",what=`${ENTITY_LABEL[o.entityType]} · ${o.entityName}`;
 const label=o.kind==="create"?"Novo registo":o.kind==="delete"?"Registo eliminado":"Registo alterado";
 const list=all.filter(r=>!skip.has(r.email)&&r.areas[o.area]!=="none"&&r.prefs.recordChanged&&visible(r)).map(r=>{
  const {html,text}=renderEmail({eyebrow:`Alteração · ${areaName(o.area)}`,title:`${label}: ${o.entityName}`,intro:`${o.access.name||o.access.email} ${verb} um registo em ${areaName(o.area)}.`,
   rows:[["Área",areaName(o.area)],["Registo",what],["Alterado por",o.access.name||o.access.email],["Data",fmtDate()]],
   note:o.kind==="delete"?undefined:"Abre o registo no Hub para ver os detalhes.",cta:cta()});
  return {event:"recordChanged" as const,to:r.email,subject:`${label}: ${what}`,html,text,dedupeKey:`${o.entityType}:${o.entityId}:${o.kind==="delete"?"delete":"change"}`};
 });
 await deliver(list);
});
/** Nome atual de um registo (para avisos de eliminação, antes de o apagar). */
const TABLE:Record<EntityType,string>={property:"properties",corporate:"corporates",campaign:"campaigns",operator:"operators",collaborator:"collaborators",tool:"tools"};
export async function entityName(type:EntityType,id:string){try{return (await database().prepare(`SELECT name FROM ${TABLE[type]} WHERE id=?`).bind(id).first<{name:string}>())?.name||""}catch{return ""}}

/** Volta a tentar os envios que falharam por erro temporário (até 3 tentativas, últimas 24 h). */
export async function retryFailed(){
 if(!emailConfigured())return {retried:0,sent:0};
 const db=database();
 const {results}=await db.prepare(`SELECT id,recipient_email,subject,html,text_body FROM notifications WHERE status='failed' AND attempts<${MAX_ATTEMPTS} AND created_at>now()-interval '1 day' ORDER BY created_at LIMIT 50`).all<{id:string,recipient_email:string,subject:string,html:string,text_body:string}>();
 let sent=0;
 for(const n of results){
  const r=await sendEmail({to:n.recipient_email,subject:n.subject,html:n.html,text:n.text_body});
  if(r.ok){sent++;await db.prepare("UPDATE notifications SET status='sent',attempts=attempts+1,provider_id=?,sent_at=now(),error=NULL WHERE id=?").bind(r.id,n.id).run()}
  else await db.prepare("UPDATE notifications SET status=?,attempts=attempts+1,error=? WHERE id=?").bind(r.retry?"failed":"error",r.error,n.id).run();
 }
 await db.prepare("DELETE FROM notifications WHERE created_at<now()-interval '90 days'").run();
 return {retried:results.length,sent};
}
