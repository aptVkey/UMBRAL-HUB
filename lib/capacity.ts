import {ROOM_CATEGORIES,type SavedProperty} from "./property";

export const NO_CATEGORY="Sem categoria";
export const NO_VALUE={region:"Sem região",city:"Sem localidade",type:"Sem tipo",property:""} as const;
export type Dimension="region"|"city"|"type"|"property";
export const DIMENSIONS:{id:Dimension,label:string}[]=[{id:"region",label:"Região"},{id:"city",label:"Localidade"},{id:"type",label:"Tipo de alojamento"},{id:"property",label:"Alojamento"}];

export type CapacityRoom={id:string,name:string,category:string,units:number,perUnit:number,pax:number};
export type CapacityGroup={key:string,label:string,properties:number,units:number,pax:number,byCategory:Record<string,number>,rooms:CapacityRoom[],sub?:string};

const catOf=(c:string)=>c||NO_CATEGORY;
/** Pessoas que um alojamento recebe a 100% de ocupação: soma de unidades × máximo de pessoas por unidade de cada tipologia. */
export function propertyTotals(p:Pick<SavedProperty,"rooms">){let units=0,pax=0;for(const r of p.rooms){const u=Number(r.units)||0;units+=u;pax+=u*(Number(r.capacity)||0)}return {units,pax}}

export function groupCapacity(properties:SavedProperty[],by:Dimension):CapacityGroup[]{
 const groups=new Map<string,CapacityGroup>();
 for(const p of properties){
  const raw=by==="region"?p.region:by==="city"?p.city:by==="type"?p.type:p.name;
  const label=(raw||"").trim()||NO_VALUE[by]||p.name;
  const g=groups.get(label)||{key:label,label,properties:0,units:0,pax:0,byCategory:{},rooms:[],sub:by==="property"?[p.city,p.region].filter(Boolean).join(" · "):undefined};
  g.properties++;
  for(const r of p.rooms){const u=Number(r.units)||0,per=Number(r.capacity)||0,c=catOf(r.category);g.units+=u;g.pax+=u*per;g.byCategory[c]=(g.byCategory[c]||0)+u;g.rooms.push({id:r.id,name:r.name,category:c,units:u,perUnit:per,pax:u*per})}
  groups.set(label,g);
 }
 const noValue=new Set<string>(Object.values(NO_VALUE));
 return [...groups.values()].sort((a,b)=>Number(noValue.has(a.label))-Number(noValue.has(b.label))||b.pax-a.pax||a.label.localeCompare(b.label,"pt"));
}

/** Colunas de categoria presentes nos dados, pela ordem das categorias do sistema e com "Sem categoria" no fim. */
export function categoryColumns(groups:CapacityGroup[]){
 const present=new Set(groups.flatMap(g=>Object.keys(g.byCategory)));
 return [...ROOM_CATEGORIES.filter(c=>present.has(c)),...(present.has(NO_CATEGORY)?[NO_CATEGORY]:[])];
}
