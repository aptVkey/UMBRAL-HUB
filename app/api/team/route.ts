import {database} from "@/db/raw";
import {memberSchema,normalizeMember,type SavedMember} from "@/lib/access";
import {getAccess,deny} from "@/lib/access-server";
import {createAuthUser,deleteAuthUser,findAuthUserId,updateAuthUser,passwordError,sendInviteEmail} from "@/lib/supabase-auth";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
type Row={id:string;payload:string;version:number;updated_at:string};
const NOT_ADMIN="Só os administradores podem gerir a equipa.";
export async function GET(request:Request){
 try{const a=await getAccess(request);if(!a.isAdmin)return deny(NOT_ADMIN);const db=database();
 const [m,l]=await db.batch([db.prepare("SELECT id,payload,version,updated_at FROM team_members ORDER BY lower(name)"),db.prepare("SELECT member_id,property_id FROM team_member_properties")]);
 const links=new Map<string,string[]>();for(const r of l.results as {member_id:string,property_id:string}[])links.set(r.member_id,[...(links.get(r.member_id)||[]),r.property_id]);
 return reply({members:(m.results as Row[]).map(r=>({toolCategories:[],...JSON.parse(r.payload),id:r.id,propertyIds:links.get(r.id)||[],version:r.version,updatedAt:r.updated_at}) as SavedMember),implicit:a.implicit,you:{email:a.email,name:a.name}});}
 catch(e){console.error("Load team",e);return reply({error:"Não foi possível carregar a equipa. Tenta novamente."},503);}
}
const otherAdmins=async(excludeId:string,excludeEmail:string)=>(await database().prepare("SELECT COUNT(*) AS n FROM team_members WHERE role='Administrador' AND status='Ativo' AND id<>? AND email<>?").bind(excludeId,excludeEmail).first<{n:number}>())?.n??0;
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 let createdEmail="";
 try{
 const a=await getAccess(request);if(!a.isAdmin)return deny(NOT_ADMIN);
 const raw=await request.text();if(raw.length>100000)return reply({error:"O pedido excede o tamanho permitido."},413);
 let input;try{input=JSON.parse(raw)}catch{return reply({error:"Dados inválidos."},400)}
 const password=typeof input?.password==="string"&&input.password?input.password:null;
 // Convite por email: a pessoa define a própria palavra-passe pelo link (só em contas novas sem palavra-passe).
 const invite=input?.invite===true&&!password;
 const parsed=memberSchema.safeParse(input);if(!parsed.success)return reply({error:"Revê os campos assinalados.",issues:parsed.error.issues},400);
 const m=normalizeMember(parsed.data),db=database(),now=new Date().toISOString(),version=m.version+1;
 const isNew=m.version===0;
 if((isNew&&!invite)||password){const bad=passwordError(password);if(bad)return reply({error:bad,issues:[{path:["password"],message:bad}]},400)}
 if(m.propertyIds.length&&(await db.prepare("SELECT COUNT(*) AS n FROM properties WHERE id IN (SELECT jsonb_array_elements_text(?::jsonb))").bind(JSON.stringify(m.propertyIds)).first<{n:number}>())?.n!==m.propertyIds.length)return reply({error:"A lista de alojamentos mudou. Atualiza a lista e revê a seleção."},409);
 const activeAdmin=m.role==="Administrador"&&m.status==="Ativo";
 if(!activeAdmin&&await otherAdmins(m.id,m.email)===0)return reply({error:"Tem de existir pelo menos um administrador ativo.",issues:[{path:["role"],message:"Este é o último administrador ativo."}]},409);
 const previous=isNew?null:await db.prepare("SELECT email FROM team_members WHERE id=?").bind(m.id).first<{email:string}>();
 if(!isNew&&!previous)return reply({error:"Esta conta já não existe. Recarrega a lista."},404);
 // Conta de acesso (Supabase Auth): criada com a palavra-passe inicial ou atualizada quando o admin define uma nova.
 if(isNew&&!invite){const u=await createAuthUser(m.email,password as string,m.name);if(u.created)createdEmail=m.email}
 else if(!isNew&&(password||previous!.email!==m.email)){
  const id=await findAuthUserId(previous!.email);
  if(id)await updateAuthUser(id,{...(password?{password}:{}),...(previous!.email!==m.email?{email:m.email}:{})});
  else{if(!password)return reply({error:"Esta conta ainda não tem palavra-passe. Define uma palavra-passe para guardar.",issues:[{path:["password"],message:"Define uma palavra-passe."}]},400);const u=await createAuthUser(m.email,password,m.name);if(u.created)createdEmail=m.email}
 }
 // Palavra-passe definida por um administrador: as sessões abertas dessa pessoa terminam.
 const {propertyIds,...core}=m,payload=JSON.stringify({...core,version});
 const first=isNew?db.prepare("INSERT INTO team_members (id,email,name,role,status,payload,version,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(m.id,m.email,m.name,m.role,m.status,payload,version,now):db.prepare("UPDATE team_members SET email=?,name=?,role=?,status=?,payload=?,version=?,updated_at=?,session_epoch=GREATEST(session_epoch,?) WHERE id=? AND version=?").bind(m.email,m.name,m.role,m.status,payload,version,now,password?Math.floor(Date.now()/1000):0,m.id,m.version);
 const guardSql="EXISTS (SELECT 1 FROM team_members WHERE id=? AND version=?)";
 let saved;try{saved=await db.batch([first,db.prepare(`DELETE FROM team_member_properties WHERE member_id=? AND ${guardSql}`).bind(m.id,m.id,version),...propertyIds.map(id=>db.prepare(`INSERT INTO team_member_properties (member_id,property_id) SELECT ?,? WHERE ${guardSql}`).bind(m.id,id,m.id,version))])}
 catch(e){if(createdEmail){try{await deleteAuthUser(createdEmail)}catch{}}if(String(e).includes("email"))return reply({error:"Já existe uma conta com este email.",issues:[{path:["email"],message:"Este email já está registado."}]},409);throw e}
 if(!saved[0].meta.changes){if(createdEmail){try{await deleteAuthUser(createdEmail)}catch{}}return reply({error:"Esta conta foi alterada noutra janela. Reabre-a antes de voltar a guardar."},409)}
 let inviteSent:boolean|undefined,inviteError:string|undefined;
 if(isNew&&invite){try{const r=await sendInviteEmail(m.email,m.name,`${new URL(request.url).origin}/redefinir`);inviteSent=r.ok;if(!r.ok){inviteError=r.message;console.error("Invite",r.status,r.message)}}catch(e){inviteSent=false;inviteError=e instanceof Error?e.message:String(e);console.error("Invite",e)}}
 return reply({member:{...m,version,updatedAt:now} as SavedMember,inviteSent,inviteError},isNew?201:200);
 }catch(e){if(createdEmail){try{await deleteAuthUser(createdEmail)}catch{}}if(/unique|duplicate key/i.test(String(e))&&String(e).includes("email"))return reply({error:"Já existe uma conta com este email."},409);console.error("Save member",e);return reply({error:e instanceof Error&&!(e instanceof TypeError)&&/palavra-passe|password|email/i.test(e.message)?e.message:"Não foi possível guardar. As tuas alterações foram mantidas. Tenta novamente."},503);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 try{const a=await getAccess(request);if(!a.isAdmin)return deny(NOT_ADMIN);
 const u=new URL(request.url),id=u.searchParams.get("id"),version=Number(u.searchParams.get("version"));if(!id||!Number.isInteger(version)||version<1)return reply({error:"Pedido inválido."},400);
 const row=await database().prepare("SELECT role,status,email FROM team_members WHERE id=?").bind(id).first<{role:string,status:string,email:string}>();
 if(row?.email===a.email)return reply({error:"Não podes remover a tua própria conta."},409);
 if(row?.role==="Administrador"&&row.status==="Ativo"&&await otherAdmins(id,row.email)===0)return reply({error:"Não podes remover o último administrador ativo."},409);
 const r=await database().prepare("DELETE FROM team_members WHERE id=? AND version=?").bind(id,version).run();if(!r.meta.changes)return reply({error:"A conta foi alterada. Reabre-a antes de eliminar."},409);
 if(row)try{await deleteAuthUser(row.email)}catch(e){console.error("Remove auth user",e)}
 return reply({ok:true});}
 catch(e){console.error("Delete member",e);return reply({error:"Não foi possível remover a conta."},503);}
}
