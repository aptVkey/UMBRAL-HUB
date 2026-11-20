import {z} from "zod";
import {newId} from "./property";
import {TOOL_CATEGORIES} from "./tool";
export const AREAS=[
 {key:"properties",name:"Alojamentos"},{key:"operators",name:"Operadores"},{key:"corporates",name:"Corporates"},{key:"partnerships",name:"Parcerias / Afiliados"},{key:"campaigns",name:"Campanhas Ativas"},{key:"training",name:"Formação"},{key:"tools",name:"Ferramentas"},{key:"reviews",name:"Reviews"}
] as const;
export type AreaKey=typeof AREAS[number]["key"];
export const LEVELS=["none","view","propose","edit"] as const;
export type Level=typeof LEVELS[number];
export const LEVEL_LABEL:Record<Level,string>={none:"Sem acesso",view:"Consulta",propose:"Propõe alterações",edit:"Edição"};
export const ROLES=["Administrador","Editor","Contribuidor","Leitor","Personalizado"] as const;
export type Role=typeof ROLES[number];
export type AreaMap=Record<AreaKey,Level>;
export const allAreas=(level:Level):AreaMap=>({properties:level,corporates:level,partnerships:level,campaigns:level,training:level,tools:level,operators:level,reviews:level});
export const ROLE_INFO:Record<Role,string>={Administrador:"Acesso total, incluindo definições e gestão da equipa.",Editor:"Consulta e edita todas as áreas, sem gerir a equipa.",Contribuidor:"Propõe alterações em todas as áreas. As alterações só ficam visíveis depois de um editor ou administrador as aprovar.",Leitor:"Consulta todas as áreas, sem poder alterar dados.",Personalizado:"Escolhes o nível de acesso de cada área."};
export function presetAreas(role:Role,current:AreaMap):AreaMap{return role==="Administrador"||role==="Editor"?allAreas("edit"):role==="Contribuidor"?allAreas("propose"):role==="Leitor"?allAreas("view"):current;}
const areaLevel=z.enum(LEVELS);
export const memberSchema=z.object({
 id:z.string().uuid(),version:z.number().int().min(0),
 name:z.string().trim().min(1,"Preenche o nome.").max(180),
 email:z.string().trim().toLowerCase().max(180).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/,"Introduz um email válido."),
 role:z.enum(ROLES),status:z.enum(["Ativo","Suspenso"]),
 areas:z.object({properties:areaLevel,corporates:areaLevel,partnerships:areaLevel,campaigns:areaLevel,training:areaLevel,tools:areaLevel.default("none"),operators:areaLevel.default("none"),reviews:areaLevel.default("none")}),
 toolCategories:z.array(z.enum(TOOL_CATEGORIES)).max(TOOL_CATEGORIES.length).default([]),
 propertyScope:z.enum(["all","selected"]),propertyIds:z.array(z.string().uuid()).max(500)
}).superRefine((v,ctx)=>{
 const bad=(path:string,message:string)=>ctx.addIssue({code:"custom",path:[path],message});
 if(new Set(v.propertyIds).size!==v.propertyIds.length)bad("propertyIds","Existem alojamentos duplicados.");
 if(v.role!=="Administrador"){
  if(v.status==="Ativo"&&!Object.values(v.areas).some(l=>l!=="none"))bad("areas","Dá acesso a pelo menos uma área ou suspende a conta.");
  if(v.propertyScope==="selected"&&!v.propertyIds.length)bad("propertyIds","Seleciona pelo menos um alojamento ou permite todos.");
 }
});
export type Member=z.infer<typeof memberSchema>;
export type SavedMember=Member&{updatedAt:string};
export type Me={email:string;name:string;role:Role|null;isAdmin:boolean;implicit:boolean;noAccess:boolean;areas:AreaMap;propertyIds:string[]|null;toolCategories:string[]};
export function newMember():Member{return {id:newId(),version:0,name:"",email:"",role:"Leitor",status:"Ativo",areas:allAreas("view"),toolCategories:[],propertyScope:"all",propertyIds:[]};}
/** Administradores têm sempre acesso total, independentemente do que estiver guardado. */
export function normalizeMember(m:Member):Member{return m.role==="Administrador"?{...m,areas:allAreas("edit"),toolCategories:[],propertyScope:"all",propertyIds:[]}:m.propertyScope==="all"?{...m,propertyIds:[]}:m;}
export const atLeast=(have:Level,need:"view"|"edit")=>need==="view"?have!=="none":have==="edit";
