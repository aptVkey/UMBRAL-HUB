import {database} from "@/db/raw";
import {notifyRecordChanged,entityName} from "@/lib/notify-server";
import {collaboratorSchema} from "@/lib/collab";
import {guard,guardEditable} from "@/lib/access-server";
import {createChangeRequest} from "@/lib/change-request-server";
import {reply,sameOrigin,present,SELECT_WITH_TOTALS,applyCollaboratorSave,applyCollaboratorDelete,type Row} from "@/lib/collab-server";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const g=await guard(request,"partnerships","view");if("response" in g)return g.response;
 const kind=new URL(request.url).searchParams.get("kind");if(kind!=="partner"&&kind!=="affiliate")return reply({error:"Pedido inválido."},400);
 try{const {results}=await database().prepare(`${SELECT_WITH_TOTALS} WHERE c.kind=? GROUP BY c.id ORDER BY lower(c.name)`).bind(kind).all<Row>();return reply({collaborators:results.map(present)});}
 catch(e){console.error("Load collaborators",e);return reply({error:"Não foi possível carregar os registos. Tenta novamente."},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"partnerships");if("response" in g)return g.response;
 try{
 const raw=await request.text();if(raw.length>100000)return reply({error:"O registo excede o tamanho permitido."},413);
 let input;try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
 const result=collaboratorSchema.safeParse(input);if(!result.success)return reply({error:"Revê os campos assinalados.",issues:result.error.issues},400);
 const c=result.data;
 if(g.mode==="propose"){
  const requestId=await createChangeRequest({area:"partnerships",entityType:"collaborator",entityId:c.id,entityName:c.name,action:"save",payload:c,baseVersion:c.version,access:g.access});
  return reply({proposal:true,requestId,message:"As alterações foram enviadas para aprovação. Um editor ou administrador tem de as aceitar antes de ficarem visíveis."},202);
 }
 const r=await applyCollaboratorSave(c);
 if(!r.ok)return reply({error:r.error,issues:r.issues},r.status);
 await notifyRecordChanged({area:"partnerships",entityType:"collaborator",entityId:c.id,entityName:c.name,kind:c.version===0?"create":"update",access:g.access});
 return reply({collaborator:r.collaborator},c.version===0?201:200);
 }catch(e){console.error("Save collaborator",e);return reply({error:"Não foi possível guardar. As tuas alterações foram mantidas. Tenta novamente."},503);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"partnerships");if("response" in g)return g.response;
 try{const u=new URL(request.url),id=u.searchParams.get("id"),version=Number(u.searchParams.get("version"));if(!id||!Number.isInteger(version)||version<1)return reply({error:"Pedido inválido."},400);
 if(g.mode==="propose"){
  const row=await database().prepare("SELECT name FROM collaborators WHERE id=?").bind(id).first<{name:string}>();
  if(!row)return reply({error:"O registo já não existe."},404);
  const requestId=await createChangeRequest({area:"partnerships",entityType:"collaborator",entityId:id,entityName:row.name,action:"delete",payload:null,baseVersion:version,access:g.access});
  return reply({proposal:true,requestId,message:"O pedido de eliminação foi enviado para aprovação."},202);
 }
 const deletedName=await entityName("collaborator",id);
 const r=await applyCollaboratorDelete(id,version);
 if(!r.ok)return reply({error:r.error},r.status);
 await notifyRecordChanged({area:"partnerships",entityType:"collaborator",entityId:id,entityName:deletedName||"(sem nome)",kind:"delete",access:g.access});
 return reply({ok:true});}
 catch(e){console.error("Delete collaborator",e);return reply({error:"Não foi possível eliminar o registo."},503);}
}
