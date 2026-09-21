import {database} from "@/db/raw";
import {operatorSchema,withDefaults,type SavedOperator,type SlimOperator} from "@/lib/operator";
import {atLeast} from "@/lib/access";
import {guard,deny,scopeVisible,scopeOk,propertyAllowed} from "@/lib/access-server";
import {reply,sameOrigin,bucket,unlinkConflict,conflictMessage,linkedProperties} from "@/lib/operator-server";
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
 const g=await guard(request,"operators","edit");if("response" in g)return g.response;const access=g.access;
 try{
 const raw=await request.text();if(raw.length>200000)return reply({error:"O operador excede o tamanho permitido."},413);
 let input;try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
 const parsed=operatorSchema.safeParse(input);if(!parsed.success)return reply({error:"Revê os campos assinalados.",issues:parsed.error.issues},400);
 const o=parsed.data,db=database();
 const old=await db.prepare("SELECT version FROM operators WHERE id=?").bind(o.id).first<{version:number}>();
 if((o.version===0&&old)||(o.version>0&&(!old||old.version!==o.version)))return reply({error:"Este operador foi alterado noutra janela. As tuas alterações continuam aqui; copia-as antes de reabrir a ficha atualizada."},409);
 const existing=old?await linkedProperties(o.id):[];
 if(old&&!scopeVisible(access,existing))return deny("O teu acesso está limitado a alguns alojamentos.");
 // Quem tem acesso limitado só altera as ligações dos seus alojamentos; as restantes mantêm-se.
 const propertyIds=access.propertyIds===null?o.propertyIds:[...o.propertyIds.filter(id=>propertyAllowed(access,id)),...existing.filter(id=>!propertyAllowed(access,id))];
 if(propertyIds.length&&(await db.prepare("SELECT COUNT(*) AS n FROM properties WHERE id IN (SELECT jsonb_array_elements_text(?::jsonb))").bind(JSON.stringify(propertyIds)).first<{n:number}>())?.n!==propertyIds.length)return reply({error:"A lista de alojamentos mudou. Atualiza a lista no separador Alojamentos e revê a seleção."},409);
 for(const removed of existing.filter(id=>!propertyIds.includes(id))){const c=await unlinkConflict(o.id,removed);if(c)return reply({error:conflictMessage(c)},409);}
 const now=new Date().toISOString(),version=o.version+1,token=crypto.randomUUID();
 const {propertyIds:_ignored,...core}=o,payload=JSON.stringify({...core,version});
 const first=o.version===0?db.prepare("INSERT INTO operators (id,name,payload,version,updated_at,last_write_id) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(o.id,o.name,payload,version,now,token):db.prepare("UPDATE operators SET name=?,payload=?,version=?,updated_at=?,last_write_id=? WHERE id=? AND version=?").bind(o.name,payload,version,now,token,o.id,o.version);
 const guardSql="EXISTS (SELECT 1 FROM operators WHERE id=? AND last_write_id=?)";
 const saved=await db.batch([first,db.prepare(`DELETE FROM operator_properties WHERE operator_id=? AND ${guardSql}`).bind(o.id,o.id,token),...propertyIds.map(id=>db.prepare(`INSERT INTO operator_properties (operator_id,property_id) SELECT ?,? WHERE ${guardSql}`).bind(o.id,id,o.id,token))]);
 if(!saved[0].meta.changes)return reply({error:"Este operador foi alterado noutra janela. Reabre a ficha atualizada antes de voltar a guardar."},409);
 return reply({operator:{...core,propertyIds:propertyIds.filter(id=>propertyAllowed(access,id)),version,updatedAt:now} as SavedOperator},o.version===0?201:200);
 }catch(e){console.error("Save operator",e);return reply({error:"Não foi possível guardar. As tuas alterações foram mantidas. Confirma os alojamentos selecionados e tenta novamente."},503);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"operators","edit");if("response" in g)return g.response;const access=g.access;
 try{const u=new URL(request.url),id=u.searchParams.get("id"),version=Number(u.searchParams.get("version"));if(!id||!Number.isInteger(version)||version<1)return reply({error:"Pedido inválido."},400);
 const db=database();
 if(!scopeOk(access,await linkedProperties(id)))return deny("O teu acesso está limitado a alguns alojamentos.");
 const used=await db.prepare("SELECT c.name FROM campaign_operators co JOIN campaigns c ON c.id=co.campaign_id WHERE co.operator_id=? LIMIT 1").bind(id).first<{name:string}>();
 if(used)return reply({error:`Este operador está a ser usado na campanha “${used.name}”. Remove-o primeiro da campanha.`},409);
 const {results:files}=await db.prepare("SELECT a.key FROM operator_attachments a JOIN operator_messages m ON m.id=a.message_id WHERE m.operator_id=?").bind(id).all<{key:string}>();
 const r=await db.prepare("DELETE FROM operators WHERE id=? AND version=?").bind(id,version).run();if(!r.meta.changes)return reply({error:"O operador foi alterado. Reabre-o antes de eliminar."},409);
 for(const f of files){try{await bucket().delete(f.key)}catch(e){console.error("Remove attachment",e)}}
 return reply({ok:true});}
 catch(e){console.error("Delete operator",e);return reply({error:"Não foi possível eliminar o operador."},503);}
}
