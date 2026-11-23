import {getAccess,canApprove} from "@/lib/access-server";
import {getChangeRequest,markDecided} from "@/lib/change-request-server";
import {decisionSchema} from "@/lib/change-request";
import {notifyApprovalDecided,notifyRecordChanged} from "@/lib/notify-server";
import {propertySchema} from "@/lib/property";
import {corporateSchema} from "@/lib/corporate";
import {campaignSchema} from "@/lib/campaign";
import {operatorSchema} from "@/lib/operator";
import {collaboratorSchema} from "@/lib/collab";
import {toolSchema} from "@/lib/tool";
import {applyPropertySave,applyPropertyDelete} from "@/lib/property-server";
import {applyCorporateSave,applyCorporateDelete} from "@/lib/corporate-server";
import {applyCampaignSave,applyCampaignDelete} from "@/lib/campaign-server";
import {applyOperatorSave,applyOperatorDelete} from "@/lib/operator-server";
import {applyCollaboratorSave,applyCollaboratorDelete} from "@/lib/collab-server";
import {applyToolSave,applyToolDelete} from "@/lib/tool-server";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
/** Aplica a alteração aprovada. Devolve o erro tal e qual se a ficha tiver mudado entretanto, sem marcar o pedido como decidido. */
async function apply(req:{entityType:string,action:string,payload:Record<string,unknown>|null,entityId:string,baseVersion:number}):Promise<{ok:true}|{ok:false,status:number,error:string}>{
 const del=req.action==="delete";
 switch(req.entityType){
  case "property":{if(del)return applyPropertyDelete(req.entityId,req.baseVersion);const p=propertySchema.safeParse(req.payload);if(!p.success)return {ok:false,status:400,error:"A proposta ficou inválida. Pede ao autor para a refazer."};const r=await applyPropertySave(p.data);return r.ok?{ok:true}:r;}
  case "corporate":{if(del)return applyCorporateDelete(req.entityId,req.baseVersion);const p=corporateSchema.safeParse(req.payload);if(!p.success)return {ok:false,status:400,error:"A proposta ficou inválida. Pede ao autor para a refazer."};const r=await applyCorporateSave(p.data,null,false);return r.ok?{ok:true}:r;}
  case "campaign":{if(del)return applyCampaignDelete(req.entityId,req.baseVersion);const p=campaignSchema.safeParse(req.payload);if(!p.success)return {ok:false,status:400,error:"A proposta ficou inválida. Pede ao autor para a refazer."};const r=await applyCampaignSave(p.data);return r.ok?{ok:true}:r;}
  case "operator":{if(del)return applyOperatorDelete(req.entityId,req.baseVersion);const p=operatorSchema.safeParse(req.payload);if(!p.success)return {ok:false,status:400,error:"A proposta ficou inválida. Pede ao autor para a refazer."};const r=await applyOperatorSave(p.data,p.data.propertyIds,p.data.propertyCodes);return r.ok?{ok:true}:r;}
  case "collaborator":{if(del)return applyCollaboratorDelete(req.entityId,req.baseVersion);const p=collaboratorSchema.safeParse(req.payload);if(!p.success)return {ok:false,status:400,error:"A proposta ficou inválida. Pede ao autor para a refazer."};const r=await applyCollaboratorSave(p.data);return r.ok?{ok:true}:r;}
  case "tool":{if(del)return applyToolDelete(req.entityId,req.baseVersion);const p=toolSchema.safeParse(req.payload);if(!p.success)return {ok:false,status:400,error:"A proposta ficou inválida. Pede ao autor para a refazer."};const r=await applyToolSave(p.data);return r.ok?{ok:true}:r;}
  default:return {ok:false,status:400,error:"Tipo de pedido desconhecido."};
 }
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 try{
 const access=await getAccess(request);if(!access.authenticated)return reply({error:"Inicia sessão para continuar."},401);
 const {id}=await params;
 const cr=await getChangeRequest(id);if(!cr)return reply({error:"O pedido já não existe."},404);
 if(!canApprove(access,cr.area))return reply({error:"Não tens permissão para rever pedidos desta área."},403);
 if(cr.status!=="pending")return reply({error:"Este pedido já foi decidido."},409);
 const raw=await request.text();let input:unknown={};if(raw){try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}}
 const parsed=decisionSchema.safeParse(input);if(!parsed.success)return reply({error:"Escolhe aprovar ou rejeitar."},400);
 if(parsed.data.decision==="reject"){
  const ok=await markDecided(id,"rejected",access,parsed.data.note);
  if(!ok)return reply({error:"Este pedido já foi decidido."},409);
  await notifyApprovalDecided({...cr,decision:"rejected",note:parsed.data.note,access});
  return reply({ok:true,status:"rejected"});
 }
 const applied=await apply(cr);
 if(!applied.ok)return reply({error:applied.error},applied.status);
 const ok=await markDecided(id,"approved",access,parsed.data.note);
 if(!ok)return reply({error:"Este pedido já foi decidido."},409);
 await Promise.all([
  notifyApprovalDecided({...cr,decision:"approved",note:parsed.data.note,access}),
  notifyRecordChanged({area:cr.area,entityType:cr.entityType,entityId:cr.entityId,entityName:cr.entityName,kind:cr.action==="delete"?"delete":cr.baseVersion===0?"create":"update",
   access:{...access,name:`${cr.requestedByName||cr.requestedByEmail} (aprovado por ${access.name||access.email})`},exclude:[cr.requestedByEmail]})]);
 return reply({ok:true,status:"approved"});
 }catch(e){console.error("Decide change request",e);return reply({error:"Não foi possível concluir a decisão. Tenta novamente."},503);}
}
