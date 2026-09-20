import {database} from "@/db/raw";
import {newId} from "@/lib/property";
import {messageSchema,checkAttachment,MAX_FILES,MAX_TOTAL_BYTES,type ChatMessage} from "@/lib/operator";
import {guard,scopeVisible,propertyAllowed,type Access} from "@/lib/access-server";
import {reply,sameOrigin,bucket,boundedForm,attachmentType,linkedProperties} from "@/lib/operator-server";
export const dynamic="force-dynamic";
type Msg={id:string,operator_id:string,property_id:string|null,reply_to_id:string|null,author_email:string,author_name:string,body:string,created_at:string};
const isAuthor=(a:Access,email:string)=>a.isAdmin||(!!a.email&&a.email===email);
/** Uma mensagem associada a um alojamento só é visível a quem tem acesso a esse alojamento. */
const visible=(a:Access,m:{property_id:string|null})=>m.property_id===null||propertyAllowed(a,m.property_id);
async function operatorAccess(access:Access,operatorId:string){const db=database();if(!await db.prepare("SELECT 1 FROM operators WHERE id=?").bind(operatorId).first())return {error:"O operador já não existe. Recarrega a lista.",status:404};const linked=await linkedProperties(operatorId);if(!scopeVisible(access,linked))return {error:"Não tens acesso a este operador.",status:403};return {linked};}
export async function GET(request:Request){
 const g=await guard(request,"operators","view");if("response" in g)return g.response;const access=g.access;
 const operatorId=new URL(request.url).searchParams.get("operatorId");if(!operatorId)return reply({error:"Pedido inválido."},400);
 try{const ok=await operatorAccess(access,operatorId);if("error" in ok)return reply({error:ok.error},ok.status);
 const db=database();const [m,a]=await db.batch([db.prepare("SELECT * FROM (SELECT * FROM operator_messages WHERE operator_id=? ORDER BY created_at DESC LIMIT 500) ORDER BY created_at ASC").bind(operatorId),db.prepare("SELECT id,message_id,name,size,type FROM operator_attachments WHERE message_id IN (SELECT id FROM operator_messages WHERE operator_id=?)").bind(operatorId)]);
 const files=new Map<string,{id:string,name:string,size:number,type:string}[]>();for(const f of a.results as {id:string,message_id:string,name:string,size:number,type:string}[])files.set(f.message_id,[...(files.get(f.message_id)||[]),{id:f.id,name:f.name,size:f.size,type:f.type}]);
 const messages:ChatMessage[]=(m.results as Msg[]).filter(x=>visible(access,x)).map(x=>({id:x.id,operatorId:x.operator_id,propertyId:x.property_id,replyToId:x.reply_to_id,authorEmail:x.author_email,authorName:x.author_name,body:x.body,createdAt:x.created_at,attachments:files.get(x.id)||[],mine:!!access.email&&access.email===x.author_email,canDelete:isAuthor(access,x.author_email)}));
 return reply({messages});}
 catch(e){console.error("Load messages",e);return reply({error:"Não foi possível carregar a conversa. Tenta novamente."},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"operators","view");if("response" in g)return g.response;const access=g.access;
 const uploaded:string[]=[];let committed=false;
 try{
 let form:FormData;try{form=await boundedForm(request)}catch(e){return reply({error:e instanceof Error&&e.message==="BODY_TOO_LARGE"?"Os anexos podem ter no máximo 10 MB no total.":"Não foi possível ler a mensagem."},400)}
 const raw=form.get("payload");if(typeof raw!=="string"||raw.length>20000)return reply({error:"Mensagem inválida."},400);
 let input;try{input=JSON.parse(raw)}catch{return reply({error:"Mensagem inválida."},400)}
 const parsed=messageSchema.safeParse(input);if(!parsed.success)return reply({error:parsed.error.issues[0].message},400);
 const m=parsed.data,body=m.body.trim(),files=form.getAll("files").filter((f):f is File=>f instanceof File);
 if(!body&&!files.length)return reply({error:"Escreve uma mensagem ou anexa um ficheiro."},400);
 if(files.length>MAX_FILES)return reply({error:`Podes anexar no máximo ${MAX_FILES} ficheiros por mensagem.`},400);
 if(files.reduce((n,f)=>n+f.size,0)>MAX_TOTAL_BYTES)return reply({error:"Os anexos podem ter no máximo 10 MB no total."},400);
 const db=database(),ok=await operatorAccess(access,m.operatorId);if("error" in ok)return reply({error:ok.error},ok.status);
 if(m.propertyId&&(!ok.linked.includes(m.propertyId)||!propertyAllowed(access,m.propertyId)))return reply({error:"Escolhe um alojamento ligado a este operador."},400);
 if(m.replyToId){const parent=await db.prepare("SELECT property_id FROM operator_messages WHERE id=? AND operator_id=?").bind(m.replyToId,m.operatorId).first<{property_id:string|null}>();if(!parent||!visible(access,parent))return reply({error:"A mensagem a que estás a responder já não existe."},404);}
 const stored:{id:string,key:string,name:string,size:number,type:string}[]=[];
 for(const f of files){const bad=checkAttachment(f);if(bad)return reply({error:bad},400);const type=await attachmentType(f);if(!type)return reply({error:`“${f.name}”: o conteúdo não corresponde ao formato indicado.`},400);
  const key=`operator-files/${m.operatorId}/${crypto.randomUUID()}`;await bucket().put(key,f.stream(),{httpMetadata:{contentType:type}});uploaded.push(key);
  stored.push({id:newId(),key,name:f.name.replace(/[\/\\\x00-\x1F\x7F]/g,"_").slice(0,200)||"anexo",size:f.size,type});}
 const id=newId(),now=new Date().toISOString(),name=access.name||"Utilizador";
 await db.batch([db.prepare("INSERT INTO operator_messages (id,operator_id,property_id,reply_to_id,author_email,author_name,body,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,m.operatorId,m.propertyId,m.replyToId,access.email,name,body,now),...stored.map(s=>db.prepare("INSERT INTO operator_attachments (id,message_id,key,name,size,type) VALUES (?,?,?,?,?,?)").bind(s.id,id,s.key,s.name,s.size,s.type))]);
 committed=true;
 const message:ChatMessage={id,operatorId:m.operatorId,propertyId:m.propertyId,replyToId:m.replyToId,authorEmail:access.email,authorName:name,body,createdAt:now,attachments:stored.map(({id,name,size,type})=>({id,name,size,type})),mine:true,canDelete:true};
 return reply({message},201);
 }catch(e){if(!committed)for(const k of uploaded){try{await bucket().delete(k)}catch{}}console.error("Save message",e);return reply({error:"Não foi possível enviar a mensagem. O texto foi mantido; tenta novamente."},503);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"operators","view");if("response" in g)return g.response;const access=g.access;
 try{const id=new URL(request.url).searchParams.get("id");if(!id)return reply({error:"Pedido inválido."},400);const db=database();
 const msg=await db.prepare("SELECT * FROM operator_messages WHERE id=?").bind(id).first<Msg>();if(!msg)return reply({ok:true});
 if(!visible(access,msg)||!isAuthor(access,msg.author_email))return reply({error:"Só o autor da mensagem ou um administrador a pode eliminar."},403);
 const {results:files}=await db.prepare("SELECT key FROM operator_attachments WHERE message_id=?").bind(id).all<{key:string}>();
 await db.prepare("DELETE FROM operator_messages WHERE id=?").bind(id).run();
 for(const f of files){try{await bucket().delete(f.key)}catch(e){console.error("Remove attachment",e)}}
 return reply({ok:true});}
 catch(e){console.error("Delete message",e);return reply({error:"Não foi possível eliminar a mensagem."},503);}
}
