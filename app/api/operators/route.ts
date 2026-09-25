import {database} from "@/db/raw";
import {operatorSchema,withDefaults,type SavedOperator,type SlimOperator} from "@/lib/operator";
import {atLeast} from "@/lib/access";
import {guard,guardEditable,deny,scopeVisible,scopeOk,propertyAllowed} from "@/lib/access-server";
import {createChangeRequest} from "@/lib/change-request-server";
import {reply,sameOrigin,linkedProperties,scopedOperatorProperties,applyOperatorSave,applyOperatorDelete} from "@/lib/operator-server";
export const dynamic="force-dynamic";
type Row={id:string,payload:string,version:number,updated_at:string};
export async function GET(request:Request){
 const g=await guard(request,["operators","properties","campaigns"],"view");if("response" in g)return g.response;const access=g.access;
 try{const db=database();const [o,l]=await db.batch([db.prepare("SELECT id,payload,version,updated_at FROM operators ORDER BY lower(name)"),db.prepare("SELECT operator_id,property_id FROM operator_properties")]);
 const links=new Map<string,string[]>();for(const r of l.results as {operator_id:string,property_id:string}[])links.set(r.operator_id,[...(links.get(r.operator_id)||[]),r.property_id]);
 const full=atLeast(access.areas.operators,"view");
 const visible=(o.results as Row[]).filter(r=>scopeVisible(access,links.get(r.id)||[]));
 const own=(id:string)=>(links.get(id)||[]).filter(p=>propertyAllowed(access,p));
 if(!full)return reply({slim:true,operators:visible.map(r=>{const p=withDefaults({...JSON.parse(r.payload),id:r.id});return {id:r.id,name:p.name,type:p.type,status:p.status,propertyIds:own(r.id)} as SlimOperator})});
 return reply({slim:false,operators:visible.map(r=>({...withDefaults({...JSON.parse(r.payload),id:r.id}),propertyIds:own(r.id),version:r.version,updatedAt:r.updated_at}) as SavedOperator)});}
 catch(e){console.error("Load operators",e);return reply({error:"Não foi possível carregar os operadores. Tenta novamente."},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"operators");if("response" in g)return g.response;
 try{
 const raw=await request.text();if(raw.length>200000)return reply({error:"O operador excede o tamanho permitido."},413);
 let input;try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
 const parsed=operatorSchema.safeParse(input);if(!parsed.success)return reply({error:"Revê os campos assinalados.",issues:parsed.error.issues},400);
 const o=parsed.data,db=database();
 const old=await db.prepare("SELECT version FROM operators WHERE id=?").bind(o.id).first<{version:number}>();
 if((o.version===0&&old)||(o.version>0&&(!old||old.version!==o.version)))return reply({error:"Este operador foi alterado noutra janela. As tuas alterações continuam aqui; copia-as antes de reabrir a ficha atualizada."},409);
 const existing=old?await linkedProperties(o.id):[];
 if(old&&!scopeVisible(g.access,existing))return deny("O teu acesso está limitado a alguns alojamentos.");
 // Quem tem acesso limitado só altera as ligações dos seus alojamentos; as restantes mantêm-se.
 const propertyIds=scopedOperatorProperties(g.access,o.propertyIds,existing);
 if(g.mode==="propose"){
  const requestId=await createChangeRequest({area:"operators",entityType:"operator",entityId:o.id,entityName:o.name,action:"save",payload:{...o,propertyIds},baseVersion:o.version,access:g.access});
  return reply({proposal:true,requestId,message:"As alterações foram enviadas para aprovação. Um editor ou administrador tem de as aceitar antes de ficarem visíveis."},202);
 }
 const r=await applyOperatorSave(o,propertyIds);
 if(!r.ok)return reply({error:r.error},r.status);
 return reply({operator:r.operator},o.version===0?201:200);
 }catch(e){console.error("Save operator",e);return reply({error:"Não foi possível guardar. As tuas alterações foram mantidas. Confirma os alojamentos selecionados e tenta novamente."},503);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"operators");if("response" in g)return g.response;
 try{const u=new URL(request.url),id=u.searchParams.get("id"),version=Number(u.searchParams.get("version"));if(!id||!Number.isInteger(version)||version<1)return reply({error:"Pedido inválido."},400);
 if(!scopeOk(g.access,await linkedProperties(id)))return deny("O teu acesso está limitado a alguns alojamentos.");
 if(g.mode==="propose"){
  const row=await database().prepare("SELECT name FROM operators WHERE id=?").bind(id).first<{name:string}>();
  if(!row)return reply({error:"O operador já não existe."},404);
  const requestId=await createChangeRequest({area:"operators",entityType:"operator",entityId:id,entityName:row.name,action:"delete",payload:null,baseVersion:version,access:g.access});
  return reply({proposal:true,requestId,message:"O pedido de eliminação foi enviado para aprovação."},202);
 }
 const r=await applyOperatorDelete(id,version);
 if(!r.ok)return reply({error:r.error},r.status);
 return reply({ok:true});}
 catch(e){console.error("Delete operator",e);return reply({error:"Não foi possível eliminar o operador."},503);}
}
