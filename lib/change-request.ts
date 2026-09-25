import {z} from "zod";
import type {AreaKey} from "./access";
/** As áreas onde um Contribuidor pode propor alterações, e o que cada uma edita. */
export const ENTITY_LABEL={property:"Alojamento",corporate:"Empresa",campaign:"Campanha",operator:"Operador",collaborator:"Parceiro / Afiliado",tool:"Ferramenta"} as const;
export type EntityType=keyof typeof ENTITY_LABEL;
export const ENTITY_AREA:Record<EntityType,AreaKey>={property:"properties",corporate:"corporates",campaign:"campaigns",operator:"operators",collaborator:"partnerships",tool:"tools"};
export type ChangeAction="save"|"delete";
export type ChangeStatus="pending"|"approved"|"rejected";
export type ChangeRequest={
 id:string;area:AreaKey;entityType:EntityType;entityId:string;entityName:string;action:ChangeAction;
 payload:Record<string,unknown>|null;baseVersion:number;status:ChangeStatus;
 requestedByEmail:string;requestedByName:string;requestedAt:string;
 reviewedByEmail:string|null;reviewedByName:string|null;reviewedAt:string|null;reviewNote:string|null;
};
export const decisionSchema=z.object({decision:z.enum(["approve","reject"]),note:z.string().max(500).optional()});
export const actionLabel=(a:ChangeAction)=>a==="delete"?"Eliminação":"Alteração";
/** Campos a ignorar na comparação (id/version não são "alterações" a mostrar). */
const SKIP_KEYS=new Set(["id","version"]);
export type FieldDiff={key:string,before:unknown,after:unknown};
/** Diferenças de topo entre o registo atual e a proposta, para o painel de aprovação. Arrays mostram só a contagem. */
export function diffFields(current:Record<string,unknown>|null,proposed:Record<string,unknown>):FieldDiff[]{
 const keys=new Set([...(current?Object.keys(current):[]),...Object.keys(proposed)]);
 const summarize=(v:unknown)=>Array.isArray(v)?`${v.length} registo(s)`:v&&typeof v==="object"?JSON.stringify(v):v;
 const out:FieldDiff[]=[];
 for(const key of keys){if(SKIP_KEYS.has(key))continue;
  const before=current?current[key]:undefined,after=proposed[key];
  if(JSON.stringify(before)===JSON.stringify(after))continue;
  out.push({key,before:summarize(before),after:summarize(after)});
 }
 return out;
}
