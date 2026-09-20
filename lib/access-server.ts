import {database} from "@/db/raw";
import {allAreas,atLeast,type AreaKey,type AreaMap,type Member,type Role} from "./access";
export type Access={email:string;name:string;role:Role|null;isAdmin:boolean;implicit:boolean;noAccess:boolean;hasIdentity:boolean;areas:AreaMap;propertyIds:string[]|null};
const json=(body:unknown,status:number)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export const deny=(message="Não tens permissão para esta ação.")=>json({error:message},403);
function identity(r:Request){
 const email=(r.headers.get("oai-authenticated-user-email")||"").trim().toLowerCase();
 const raw=r.headers.get("oai-authenticated-user-full-name");let name="";
 if(raw&&r.headers.get("oai-authenticated-user-full-name-encoding")==="percent-encoded-utf-8"){try{name=decodeURIComponent(raw)}catch{}}
 return {email,name:name||email};
}
const none=allAreas("none");
/** A identidade vem da plataforma; as permissões vêm sempre da base de dados. Sem equipa registada, o proprietário mantém acesso total. */
export async function getAccess(request:Request):Promise<Access>{
 const {email,name}=identity(request),db=database();
 const total=(await db.prepare("SELECT COUNT(*) AS n FROM team_members").first<{n:number}>())?.n??0;
 const base={email,name,hasIdentity:!!email};
 if(total===0)return {...base,role:null,isAdmin:true,implicit:true,noAccess:false,areas:allAreas("edit"),propertyIds:null};
 const blocked:Access={...base,role:null,isAdmin:false,implicit:false,noAccess:true,areas:none,propertyIds:[]};
 if(!email)return blocked;
 const row=await db.prepare("SELECT id,role,status,payload FROM team_members WHERE email=?").bind(email).first<{id:string,role:Role,status:string,payload:string}>();
 if(!row||row.status!=="Ativo")return blocked;
 const m=JSON.parse(row.payload) as Member;
 if(row.role==="Administrador")return {...base,name:m.name||name,role:row.role,isAdmin:true,implicit:false,noAccess:false,areas:allAreas("edit"),propertyIds:null};
 let propertyIds:string[]|null=null;
 if(m.propertyScope==="selected"){const {results}=await db.prepare("SELECT property_id FROM team_member_properties WHERE member_id=?").bind(row.id).all<{property_id:string}>();propertyIds=results.map(r=>r.property_id);}
 return {...base,name:m.name||name,role:row.role,isAdmin:false,implicit:false,noAccess:false,areas:row.role==="Editor"?allAreas("edit"):row.role==="Leitor"?allAreas("view"):{...none,...m.areas},propertyIds};
}
/** Devolve o acesso ou a resposta 403. Com várias áreas, basta uma cumprir o nível pedido. */
export async function guard(request:Request,area:AreaKey|AreaKey[],level:"view"|"edit"):Promise<{access:Access}|{response:Response}>{
 const access=await getAccess(request),list=Array.isArray(area)?area:[area];
 if(access.noAccess)return {response:deny("Não tens acesso a esta aplicação. Pede a um administrador que te adicione em Definições.")};
 if(!list.some(a=>atLeast(access.areas[a],level)))return {response:deny(level==="edit"?"Só tens acesso de consulta a esta área.":"Não tens acesso a esta área.")};
 return {access};
}
export const propertyAllowed=(a:Access,id:string)=>a.propertyIds===null||a.propertyIds.includes(id);
/** Todos os alojamentos indicados têm de estar dentro do âmbito do utilizador. */
export const scopeOk=(a:Access,ids:string[])=>a.propertyIds===null||ids.every(id=>a.propertyIds!.includes(id));
/** Um registo é visível se não tiver alojamentos ou se tocar em pelo menos um alojamento permitido. */
export const scopeVisible=(a:Access,ids:string[])=>a.propertyIds===null||!ids.length||ids.some(id=>a.propertyIds!.includes(id));
export async function linkedProperties(table:"corporate_properties"|"campaign_properties",owner:"corporate_id"|"campaign_id",id:string){const {results}=await database().prepare(`SELECT property_id FROM ${table} WHERE ${owner}=?`).bind(id).all<{property_id:string}>();return results.map(r=>r.property_id);}
