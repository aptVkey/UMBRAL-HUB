import {database} from "@/db/raw";
import {corporateSchema} from "@/lib/corporate";
import {guard,guardEditable,deny,scopeOk,scopeVisible,linkedProperties} from "@/lib/access-server";
import {createChangeRequest} from "@/lib/change-request-server";
import {reply,sameOrigin,present,boundedForm,applyCorporateSave,applyCorporateDelete,findCorporate,type CorporateRow} from "@/lib/corporate-server";
export const dynamic="force-dynamic";
export async function GET(request:Request){const g=await guard(request,"corporates","view");if("response" in g)return g.response;const access=g.access;try{const db=database();const [records,links]=await db.batch([db.prepare("SELECT * FROM corporates ORDER BY lower(name)"),db.prepare("SELECT corporate_id,property_id FROM corporate_properties")]);const grouped=new Map<string,string[]>();for(const link of links.results as {corporate_id:string,property_id:string}[]){grouped.set(link.corporate_id,[...(grouped.get(link.corporate_id)||[]),link.property_id]);}return reply({corporates:(records.results as CorporateRow[]).map(r=>present(r,grouped.get(r.id)||[])).filter(c=>scopeVisible(access,c.propertyIds))});}catch(e){console.error("Load corporates",e);return reply({error:"Não foi possível carregar as empresas. Tenta novamente."},503);}}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"corporates");if("response" in g)return g.response;
 try{
 let form:FormData;try{form=await boundedForm(request)}catch(e){return reply({error:e instanceof Error&&e.message==='BODY_TOO_LARGE'?"O contrato pode ter no máximo 10 MB.":"Não foi possível ler os dados enviados."},400);}
 const raw=form.get('payload');if(typeof raw!=='string'||raw.length>200000)return reply({error:"Ficha inválida ou demasiado extensa."},400);
 let input:unknown;try{input=JSON.parse(raw)}catch{return reply({error:"Ficha inválida."},400)}
 const result=corporateSchema.safeParse(input);if(!result.success)return reply({error:"Revê os campos assinalados.",issues:result.error.issues},400);
 const p=result.data;
 if(!scopeOk(g.access,p.propertyIds)||(p.version>0&&!scopeOk(g.access,await linkedProperties("corporate_properties","corporate_id",p.id))))return deny("O teu acesso está limitado a alguns alojamentos.");
 const upload=form.get('contract'),removeContract=form.get('removeContract')==='true';
 if(g.mode==="propose"){
  if(upload instanceof File||removeContract)return reply({error:"Não podes propor alterações ao contrato. Pede a um editor ou administrador que o anexe ou remova depois de aprovar a tua proposta."},400);
  const requestId=await createChangeRequest({area:"corporates",entityType:"corporate",entityId:p.id,entityName:p.name,action:"save",payload:p,baseVersion:p.version,access:g.access});
  return reply({proposal:true,requestId,message:"As alterações foram enviadas para aprovação. Um editor ou administrador tem de as aceitar antes de ficarem visíveis."},202);
 }
 const r=await applyCorporateSave(p,upload instanceof File?upload:null,removeContract);
 if(!r.ok)return reply({error:r.error},r.status);
 return reply({corporate:r.corporate},p.version===0?201:200);
 }catch(e){console.error("Save corporate",e);return reply({error:"Não foi possível guardar. As tuas alterações foram mantidas. Tenta novamente."},503);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"corporates");if("response" in g)return g.response;
 try{
 const u=new URL(request.url),id=u.searchParams.get("id"),version=Number(u.searchParams.get("version"));if(!id||!Number.isInteger(version)||version<1)return reply({error:"Pedido inválido."},400);
 const row=await findCorporate(id);if(!row)return reply({error:"A empresa já não existe."},404);
 if(!scopeOk(g.access,await linkedProperties("corporate_properties","corporate_id",id)))return deny("O teu acesso está limitado a alguns alojamentos.");
 if(g.mode==="propose"){
  const requestId=await createChangeRequest({area:"corporates",entityType:"corporate",entityId:id,entityName:present(row,[]).name,action:"delete",payload:null,baseVersion:version,access:g.access});
  return reply({proposal:true,requestId,message:"O pedido de eliminação foi enviado para aprovação."},202);
 }
 const r=await applyCorporateDelete(id,version);
 if(!r.ok)return reply({error:r.error},r.status);
 return reply({ok:true});
 }catch(e){console.error("Delete corporate",e);return reply({error:"Não foi possível eliminar a empresa."},503);}
}
