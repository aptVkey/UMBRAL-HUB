import {database} from "@/db/raw";
import {allAreas,atLeast,type AreaKey,type AreaMap,type Member,type Role} from "./access";
import {sessionEmail} from "./session";
export type Access={email:string;name:string;role:Role|null;isAdmin:boolean;implicit:boolean;noAccess:boolean;hasIdentity:boolean;authenticated:boolean;setupRequired:boolean;areas:AreaMap;propertyIds:string[]|null};
const json=(body:unknown,status:number)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export const deny=(message="Não tens permissão para esta ação.")=>json({error:message},403);
const none=allAreas("none");
/** A identidade vem da sessão da app (login); as permissões vêm sempre da base de dados. */
export async function getAccess(request:Request):Promise<Access>{
 const email=await sessionEmail(request),db=database();
 /** Uma só ida à base de dados (transação) em vez de três em série: este passo corre em todos os pedidos à API. */
 const [totalRes,memberRes,scopeRes]=await db.batch([
  db.prepare("SELECT COUNT(*) AS n FROM team_members"),
  db.prepare("SELECT id,role,status,payload FROM team_members WHERE email=?").bind(email),
  db.prepare("SELECT property_id FROM team_member_properties WHERE member_id=(SELECT id FROM team_members WHERE email=?)").bind(email)]);
 const total=(totalRes.results[0] as {n:number}|undefined)?.n??0;
 const base={email,name:email,hasIdentity:!!email,authenticated:!!email,setupRequired:total===0};
 const blocked:Access={...base,role:null,isAdmin:false,implicit:false,noAccess:true,areas:none,propertyIds:[]};
 if(!email)return blocked;
 const row=memberRes.results[0] as {id:string,role:Role,status:string,payload:string}|undefined;
 if(!row||row.status!=="Ativo")return blocked;
 const m=JSON.parse(row.payload) as Member;
 if(row.role==="Administrador")return {...base,name:m.name||email,role:row.role,isAdmin:true,implicit:false,noAccess:false,areas:allAreas("edit"),propertyIds:null};
 let propertyIds:string[]|null=null;
 if(m.propertyScope==="selected")propertyIds=(scopeRes.results as {property_id:string}[]).map(r=>r.property_id);
 return {...base,name:m.name||email,role:row.role,isAdmin:false,implicit:false,noAccess:false,areas:row.role==="Editor"?allAreas("edit"):row.role==="Leitor"?allAreas("view"):{...none,...m.areas},propertyIds};
}
/** Devolve o acesso ou a resposta 403. Com várias áreas, basta uma cumprir o nível pedido. */
export async function guard(request:Request,area:AreaKey|AreaKey[],level:"view"|"edit"):Promise<{access:Access}|{response:Response}>{
 const access=await getAccess(request),list=Array.isArray(area)?area:[area];
 if(!access.authenticated)return {response:json({error:"Inicia sessão para continuar."},401)};
 if(access.noAccess)return {response:deny("Não tens acesso a esta aplicação. Pede a um administrador que te adicione em Definições.")};
 if(!list.some(a=>atLeast(access.areas[a],level)))return {response:deny(level==="edit"?"Só tens acesso de consulta a esta área.":"Não tens acesso a esta área.")};
 return {access};
}
export type EditGate={mode:"edit"|"propose",access:Access}|{response:Response};
/**
 * Como guard(), mas para escrever num registo: "edit" aplica já a alteração, "propose" fica
 * a aguardar aprovação de um editor ou administrador. Cada rota decide o que fazer em cada modo.
 */
export async function guardEditable(request:Request,area:AreaKey|AreaKey[]):Promise<EditGate>{
 const access=await getAccess(request),list=Array.isArray(area)?area:[area];
 if(!access.authenticated)return {response:json({error:"Inicia sessão para continuar."},401)};
 if(access.noAccess)return {response:deny("Não tens acesso a esta aplicação. Pede a um administrador que te adicione em Definições.")};
 if(list.some(a=>access.areas[a]==="edit"))return {mode:"edit",access};
 if(list.some(a=>access.areas[a]==="propose"))return {mode:"propose",access};
 return {response:deny("Não tens permissão para editar esta área.")};
}
/** Pode aprovar ou rejeitar pedidos de alteração desta área. */
export const canApprove=(a:Access,area:AreaKey)=>a.isAdmin||a.areas[area]==="edit";
export const propertyAllowed=(a:Access,id:string)=>a.propertyIds===null||a.propertyIds.includes(id);
/** Todos os alojamentos indicados têm de estar dentro do âmbito do utilizador. */
export const scopeOk=(a:Access,ids:string[])=>a.propertyIds===null||ids.every(id=>a.propertyIds!.includes(id));
/** Um registo é visível se não tiver alojamentos ou se tocar em pelo menos um alojamento permitido. */
export const scopeVisible=(a:Access,ids:string[])=>a.propertyIds===null||!ids.length||ids.some(id=>a.propertyIds!.includes(id));
export async function linkedProperties(table:"corporate_properties"|"campaign_properties",owner:"corporate_id"|"campaign_id",id:string){const {results}=await database().prepare(`SELECT property_id FROM ${table} WHERE ${owner}=?`).bind(id).all<{property_id:string}>();return results.map(r=>r.property_id);}
