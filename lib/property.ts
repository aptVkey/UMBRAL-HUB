import { z } from "zod";
const text = z.string().max(5000, "Máximo de 5.000 caracteres.");
const short = z.string().max(180);
const required = short.trim().min(1, "Preenche este campo.");
const id = z.string().uuid();
const amount = z.string().max(15).refine(v => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 1000000), "Introduz um valor válido, sem símbolos.");
const date = z.string().refine(v => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.");
/** Tipos de cama: `beds` é quantas camas o móvel conta (um beliche são duas) e `places` quantas pessoas dormem nele. Os ids são estáveis (servem os dashboards); os rótulos podem mudar. */
export const BED_TYPES=[
 {id:"double",label:"Cama de casal",beds:1,places:2},
 {id:"single",label:"Cama individual",beds:1,places:1},
 {id:"sofa_double",label:"Sofá-cama de casal",beds:1,places:2},
 {id:"sofa_single",label:"Sofá-cama individual",beds:1,places:1},
 {id:"bunk",label:"Beliche",beds:2,places:2},
 {id:"extra",label:"Cama extra",beds:1,places:1},
] as const;
export type BedType=typeof BED_TYPES[number]["id"];
export const bedType=(id:string)=>BED_TYPES.find(b=>b.id===id);
/** Categoria normalizada da tipologia, para agrupar (ex.: quantos quartos duplos no Algarve) independentemente do nome comercial. */
export const ROOM_CATEGORIES=["Single","Duplo","Twin","Triplo","Quádruplo","Familiar","Suite","Estúdio (T0)","Apartamento T1","Apartamento T2","Apartamento T3","Apartamento T4 ou superior","Outro"];
export const bedSchema=z.object({type:z.string().refine(v=>!!bedType(v),"Tipo de cama inválido."),count:z.number().int().min(1,"Indica pelo menos 1.").max(50)});
export const roomSchema = z.object({id,name:required,code:short,category:z.string().max(60).refine(v=>v===""||ROOM_CATEGORIES.includes(v),"Categoria inválida.").default(""),units:z.number().int().min(1).max(10000),capacity:z.number().int().min(1).max(100),bedding:z.array(bedSchema).max(10).default([]).refine(v=>new Set(v.map(b=>b.type)).size===v.length,"Cada tipo de cama só pode aparecer uma vez."),beds:short,area:amount,notes:text});
/** Camas e lugares de uma unidade da tipologia. */
export function roomBeds(r:{bedding?:{type:string,count:number}[]}){let beds=0,places=0;for(const b of r.bedding||[]){const t=bedType(b.type);if(!t)continue;const n=Number(b.count)||0;beds+=t.beds*n;places+=t.places*n;}return {beds,places};}
/** Fichas gravadas antes da categoria e das camas estruturadas não têm estes campos. */
/** Tarifas gravadas antes da separação interna/operadores são internas. */
export const REFUND_POLICIES=[{id:"refundable",label:"Reembolsável"},{id:"non_refundable",label:"Não reembolsável"},{id:"partial",label:"Parcialmente reembolsável"}] as const;
export type RefundPolicy=typeof REFUND_POLICIES[number]["id"];
/** Política de reembolso de uma tarifa; as tarifas antigas só tinham o campo reembolsável sim/não. */
export const refundPolicyOf=(r:{refundable:boolean,refundPolicy?:RefundPolicy}):RefundPolicy=>r.refundPolicy??(r.refundable?"refundable":"non_refundable");
export const refundLabel=(r:{refundable:boolean,refundPolicy?:RefundPolicy})=>REFUND_POLICIES.find(p=>p.id===refundPolicyOf(r))!.label;
export const normalizeRate=<T extends {refundable:boolean,refundPolicy?:RefundPolicy}>(r:T)=>({audience:"internal",...r,refundPolicy:refundPolicyOf(r)}) as T&{audience:RateAudience,refundPolicy:RefundPolicy};
export const normalizeRoom=<T extends object>(r:T)=>({category:"",bedding:[],...r}) as T&{category:string,bedding:{type:string,count:number}[]};
/** A quem se destina a tarifa: uso interno da equipa ou apenas para os operadores parceiros. */
export const RATE_AUDIENCES=[{id:"internal",label:"Tarifas internas"},{id:"operators",label:"Tarifas para operadores"}] as const;
export type RateAudience=typeof RATE_AUDIENCES[number]["id"];
export const rateSchema = z.object({id,audience:z.enum(["internal","operators"]).default("internal"),name:required,code:required,board:short,refundable:z.boolean(),refundPolicy:z.enum(["refundable","non_refundable","partial"]).optional(),price:amount,minNights:z.number().int().min(1).max(365),start:date,end:date,cancellation:text,payment:text,notes:text}).refine(v=>!v.start||!v.end||v.end>=v.start,{path:["end"],message:"A data final deve ser igual ou posterior à inicial."});
export const operatorSchema = z.object({id,name:required,kind:short,commission:amount,commissionType:z.enum(["percent","fixed"]),basis:text,payment:text,cancellation:text,rules:text,rateIds:z.array(id).max(100)}).refine(v=>v.commissionType!=="percent"||Number(v.commission)<=100,{path:["commission"],message:"A comissão deve estar entre 0 e 100%."});
export const unitSchema = z.object({id,number:short.trim().min(1,"Indica o número do quarto.").max(60),categoryCode:short,categoryName:short});
export const MAX_PHOTO_SIZE=10*1024*1024;
export const PHOTO_ACCEPT=".png,.jpg,.jpeg,.webp";
export function checkPhoto(file:{size:number;name:string}){if(file.size===0)return "O ficheiro está vazio.";if(file.size>MAX_PHOTO_SIZE)return "Cada foto pode ter no máximo 10 MB.";if(!/\.(png|jpe?g|webp)$/i.test(file.name))return "Utiliza imagens PNG, JPG ou WEBP.";return "";}
export type RoomPhoto={id:string;roomId:string;name:string;size:number;type:string;uploadedBy:string;uploadedAt:string;position:number};
/** A grelha e o ecrã inteiro nunca precisam do original: cada foto tem no Storage duas versões JPEG reduzidas, geradas no browser ao enviar. */
export const PHOTO_THUMB=480,PHOTO_VIEW=1600,PHOTO_WIDTHS=[PHOTO_THUMB,PHOTO_VIEW];
export const photoUrl=(id:string,width:number)=>`/api/properties/photos/file?id=${id}&w=${width}`;
export const photoVariantKey=(key:string,width:number)=>`${key}.w${width}.jpg`;
/** Move `ids` (pela ordem dada) para a tipologia `roomId`, antes da foto `beforeId` (ou no fim). Só renumera as tipologias afetadas. Usada no cliente (resultado imediato) e no servidor (gravação). */
export function relocatePhotos(photos:RoomPhoto[],ids:string[],roomId:string,beforeId:string|null):RoomPhoto[]{
 const moving=[...new Set(ids)].map(id=>photos.find(p=>p.id===id)).filter((p):p is RoomPhoto=>!!p);
 const movingIds=new Set(moving.map(p=>p.id)),affected=new Set([roomId,...moving.map(p=>p.roomId)]);
 const target=photos.filter(p=>p.roomId===roomId&&!movingIds.has(p.id));
 const at=beforeId?target.findIndex(p=>p.id===beforeId):-1,index=at<0?target.length:at;
 const placed=[...target.slice(0,index),...moving.map(p=>({...p,roomId})),...target.slice(index)];
 const renumber=(list:RoomPhoto[])=>list.map((p,i)=>({...p,position:i}));
 return [...new Set([...photos.map(p=>p.roomId),roomId])].flatMap(rid=>{
  if(rid===roomId)return renumber(placed);
  const rest=photos.filter(p=>p.roomId===rid&&!movingIds.has(p.id));
  return affected.has(rid)?renumber(rest):rest;
 });
}
export const amenitySchema = z.object({id:short,label:required,group:short,enabled:z.boolean(),rules:text,custom:z.boolean()});
export const propertySchema = z.object({
 id,version:z.number().int().min(0),name:required,code:short,type:short,status:z.enum(["Rascunho","Ativo","Inativo"]),city:short,region:short,address:text,postal:short,license:short,email:z.string().max(180).refine(v=>!v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),"Email inválido."),phone:short,website:z.string().max(500).refine(v=>!v||/^https?:\/\/[^\s]+$/.test(v),"Usa um endereço com https://."),driveUrl:z.string().max(500).refine(v=>!v||/^https?:\/\/[^\s]+$/.test(v),"Usa um endereço com https://."),reviewLink:z.string().max(500).refine(v=>!v||/^https?:\/\/[^\s]+$/.test(v),"Usa um endereço com https://."),description:text,
 rooms:z.array(roomSchema).max(100),rates:z.array(rateSchema).max(100),operators:z.array(operatorSchema).max(100),amenities:z.array(amenitySchema).max(200),policies:z.record(z.string().max(80),text),partnerOperatorIds:z.array(id).max(500).default([]),units:z.array(unitSchema).max(1000).default([]),keysafes:z.record(id,z.string().max(60,"Máximo de 60 caracteres.")).default({}),keysafeGeneral:z.string().max(60,"Máximo de 60 caracteres.").default(""),keysafeStaff:z.string().max(60,"Máximo de 60 caracteres.").default(""),keysafeInside:z.string().max(60,"Máximo de 60 caracteres.").default(""),
 hasDeposit:z.boolean().default(false),depositNormal:z.object({alta:amount,baixa:amount}).default({alta:"",baixa:""}),depositGroup:z.object({alta:amount,baixa:amount}).default({alta:"",baixa:""})
}).superRefine((v,ctx)=>{
 const ids=new Set(v.rates.map(r=>r.id));
 v.operators.forEach((o,i)=>{if(o.rateIds.some(x=>!ids.has(x)))ctx.addIssue({code:"custom",path:["operators",i,"rateIds"],message:"Existe uma tarifa associada que já não está disponível."})});
 for(const key of ["rooms","rates","operators","amenities","units"] as const){if(new Set(v[key].map(r=>r.id)).size!==v[key].length)ctx.addIssue({code:"custom",path:[key],message:"Existem registos duplicados."});}
 const unitIds=new Set(v.units.map(u=>u.id));if(Object.keys(v.keysafes).some(k=>!unitIds.has(k)))ctx.addIssue({code:"custom",path:["keysafes"],message:"Existe um código associado a um quarto que já não existe."});
 const numbers=v.units.map(u=>u.number.trim().toLowerCase());if(new Set(numbers).size!==numbers.length)ctx.addIssue({code:"custom",path:["units"],message:"Os números de quarto devem ser únicos."});
 const codes=v.rates.map(r=>r.code.trim().toLowerCase());if(new Set(codes).size!==codes.length)ctx.addIssue({code:"custom",path:["rates"],message:"Os códigos das tarifas devem ser únicos."});
});
export type Unit = z.infer<typeof unitSchema>;
export type Property = z.infer<typeof propertySchema>;
export type SavedProperty = Property & {updatedAt:string};
const CARD_KINDS=["OTA","Operador turístico","Agência de viagens","Canal direto","Outro"];
/** Tipo do cartão de condições comerciais a partir do tipo do operador (Wholesaler/Corporate → Outro). */
export const cardKind=(type?:string)=>type&&CARD_KINDS.includes(type)?type:"Outro";
export const emptyCard=(o:{id:string,name:string,type?:string}):Property["operators"][number]=>({id:o.id,name:o.name,kind:cardKind(o.type),commission:"",commissionType:"percent",basis:"",payment:"",cancellation:"",rules:"",rateIds:[]});
/**
 * Um cartão de condições comerciais por operador ligado, pela ordem das ligações. Ligações feitas
 * do lado do operador ganham um cartão vazio; cartões de operadores já desligados deixam de aparecer.
 */
export function alignCards(cards:Property["operators"],partnerIds:string[],operators:Map<string,{name:string,type?:string}>){
 return partnerIds.flatMap(id=>{const card=cards.find(c=>c.id===id);if(card)return [card];const o=operators.get(id);return o?[emptyCard({id,...o})]:[]});
}
export const amenityGroups: Record<string,string[]> = {
 "Conforto e equipamento":["Wi-Fi","Ar condicionado","Aquecimento","Televisão","Cofre","Minibar","Secretária","Varanda ou terraço","Roupeiro"],
 "Casa de banho e cozinha":["Casa de banho privativa","Secador de cabelo","Produtos de higiene","Toalhas","Kitchenette","Cozinha equipada","Frigorífico","Micro-ondas","Máquina de café"],
 "Serviços e áreas comuns":["Receção 24 horas","Check-in autónomo","Elevador","Depósito de bagagens","Pequeno-almoço","Restaurante","Bar","Lavandaria","Transfer"],
 "Lazer e exterior":["Piscina exterior","Piscina interior","Piscina infantil","Jardim","Ginásio","Spa","Parque infantil","Estacionamento privado","Estacionamento público"],
 "Acessibilidade e famílias":["Acesso sem degraus","Quartos adaptados","Casa de banho adaptada","Berço","Cama extra","Cadeira de bebé","Animais de estimação permitidos"]
};
export function newId(){if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,v=>v.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
export function newProperty():Property {return {id:newId(),version:0,name:"",code:"",type:"Hotel",status:"Rascunho",city:"",region:"",address:"",postal:"",license:"",email:"",phone:"",website:"",driveUrl:"",reviewLink:"",description:"",rooms:[],rates:[],operators:[],policies:{},partnerOperatorIds:[],units:[],keysafes:{},keysafeGeneral:"",keysafeStaff:"",keysafeInside:"",hasDeposit:false,depositNormal:{alta:"",baixa:""},depositGroup:{alta:"",baixa:""},amenities:Object.entries(amenityGroups).flatMap(([group,labels],g)=>labels.map((label,i)=>({id:`amenity-${g}-${i}`,label,group,enabled:false,rules:"",custom:false})))};}
export const SEASONS=[{id:"alta",label:"Época Alta"},{id:"baixa",label:"Época Baixa"}] as const;
export type Season=typeof SEASONS[number]["id"];
/** Chave da política tal como é guardada em `policies`: com sufixo de época nos grupos sazonais, plana nos restantes. */
export const policyKey=(fieldKey:string,seasonal:boolean,season:Season)=>seasonal?`${fieldKey}_${season}`:fieldKey;
export const policyGroups = [
 {title:"Chegada e saída",seasonal:true,fields:[{key:"checkin",label:"Check-in a partir de",type:"time"},{key:"checkinEnd",label:"Check-in até às",type:"time"},{key:"checkout",label:"Check-out até às",type:"time"},{key:"reception",label:"Horário da receção",placeholder:"Ex.: 08:00–22:00"},{key:"arrival",label:"Instruções de chegada e check-in autónomo",area:true},{key:"late",label:"Early check-in e late check-out",area:true}]},
 {title:"Taxas e Cauções",seasonal:true,fields:[{key:"tax",label:"Taxa turística — valor, idades e isenções",area:true,fullWidth:true}]},
 {title:"Durante a estadia",seasonal:false,fields:[{key:"cleaning",label:"Limpeza — frequência e exceções",area:true},{key:"towels",label:"Troca de toalhas e roupa de cama",area:true},{key:"breakfast",label:"Pequeno-almoço — horários, local e preço",area:true},{key:"children",label:"Crianças, berços e camas extra",area:true},{key:"pets",label:"Animais de estimação — regras e custos",area:true},{key:"smoking",label:"Fumadores, festas e horário de silêncio",area:true}]},
 {title:"Informação útil",seasonal:false,fields:[{key:"parking",label:"Estacionamento e acessos",area:true},{key:"accessibility",label:"Acessibilidade e limitações",area:true},{key:"emergency",label:"Contacto de emergência e assistência",area:true},{key:"directions",label:"Como chegar e pontos de referência",area:true},{key:"other",label:"Outras regras e informações",area:true,fullWidth:true}]}
] as const;
/** Usado para filtrar listas e seletores de alojamentos por nome, localidade ou região. */
export function propertyMatches(p:{name:string,city:string,region:string},query:string){
 const q=query.trim().toLowerCase();if(!q)return true;
 return p.name.toLowerCase().includes(q)||p.city.toLowerCase().includes(q)||p.region.toLowerCase().includes(q);
}

/** Parte do endereço da página de apresentação: nome em minúsculas, sem acentos, com hífens (ex.: "huma-by-umbral"). */
export const propertySlug=(name:string)=>name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," e ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
export const brochurePath=(name:string)=>`/alojamento/livro-de-informacoes/${propertySlug(name)}`;
