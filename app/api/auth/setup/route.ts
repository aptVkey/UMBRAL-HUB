import {database} from "@/db/raw";
import {allAreas,normalizeMember} from "@/lib/access";
import {createSession,sessionCookie} from "@/lib/session";
import {createAuthUser,deleteAuthUser,passwordError} from "@/lib/supabase-auth";
import {reply,sameOrigin,readJson,EMAIL} from "@/lib/auth-server";
import {newId} from "@/lib/property";
export const dynamic="force-dynamic";
/** Primeiro acesso: só funciona enquanto não existir nenhuma conta; cria o primeiro administrador. */
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 let createdEmail="";
 try{
 const db=database();
 if(((await db.prepare("SELECT COUNT(*) AS n FROM team_members").first<{n:number}>())?.n??0)>0)return reply({error:"O primeiro acesso já foi configurado. Inicia sessão."},409);
 const b=await readJson(request);const name=String(b?.name||"").trim().slice(0,180),email=String(b?.email||"").trim().toLowerCase(),password=b?.password;
 if(!name)return reply({error:"Preenche o nome."},400);if(!EMAIL.test(email))return reply({error:"Introduz um email válido."},400);
 const bad=passwordError(password);if(bad)return reply({error:bad},400);
 const user=await createAuthUser(email,password as string,name);if(user.created)createdEmail=email;
 const m=normalizeMember({id:newId(),version:1,name,email,role:"Administrador",status:"Ativo",areas:allAreas("edit"),toolCategories:[],propertyScope:"all",propertyIds:[]});
 const {propertyIds,...core}=m;const now=new Date().toISOString();
 const r=await db.prepare("INSERT INTO team_members (id,email,name,role,status,payload,version,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM team_members)").bind(m.id,email,name,m.role,m.status,JSON.stringify(core),1,now).run();
 if(!r.meta.changes){if(createdEmail)await deleteAuthUser(createdEmail);return reply({error:"O primeiro acesso já foi configurado. Inicia sessão."},409)}
 return reply({ok:true},201,{"Set-Cookie":sessionCookie(request,await createSession(email))});
 }catch(e){if(createdEmail){try{await deleteAuthUser(createdEmail)}catch{}}console.error("Setup",e);return reply({error:"Não foi possível criar a conta. Tenta novamente."},503);}
}
