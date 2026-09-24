import { z } from "zod";
const text = z.string().max(5000, "Máximo de 5.000 caracteres.");
const short = z.string().max(180);
const required = short.trim().min(1, "Preenche este campo.");
const id = z.string().uuid();
const amount = z.string().max(15).refine(v => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 1000000), "Introduz um valor válido, sem símbolos.");
const date = z.string().refine(v => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.");
export const roomSchema = z.object({id,name:required,code:short,units:z.number().int().min(1).max(10000),capacity:z.number().int().min(1).max(100),beds:short,area:amount,notes:text});
export const rateSchema = z.object({id,name:required,code:required,board:short,refundable:z.boolean(),price:amount,minNights:z.number().int().min(1).max(365),start:date,end:date,cancellation:text,payment:text,notes:text}).refine(v=>!v.start||!v.end||v.end>=v.start,{path:["end"],message:"A data final deve ser igual ou posterior à inicial."});
export const operatorSchema = z.object({id,name:required,kind:short,commission:amount,commissionType:z.enum(["percent","fixed"]),basis:text,payment:text,cancellation:text,rules:text,rateIds:z.array(id).max(100)}).refine(v=>v.commissionType!=="percent"||Number(v.commission)<=100,{path:["commission"],message:"A comissão deve estar entre 0 e 100%."});
export const unitSchema = z.object({id,number:short.trim().min(1,"Indica o número do quarto.").max(60),categoryCode:short,categoryName:short});
export const amenitySchema = z.object({id:short,label:required,group:short,enabled:z.boolean(),rules:text,custom:z.boolean()});
export const propertySchema = z.object({
 id,version:z.number().int().min(0),name:required,code:short,type:short,status:z.enum(["Rascunho","Ativo","Inativo"]),city:short,region:short,address:text,postal:short,license:short,email:z.string().max(180).refine(v=>!v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),"Email inválido."),phone:short,website:z.string().max(500).refine(v=>!v||/^https?:\/\/[^\s]+$/.test(v),"Usa um endereço com https://."),driveUrl:z.string().max(500).refine(v=>!v||/^https?:\/\/[^\s]+$/.test(v),"Usa um endereço com https://."),reviewLink:z.string().max(500).refine(v=>!v||/^https?:\/\/[^\s]+$/.test(v),"Usa um endereço com https://."),description:text,
 rooms:z.array(roomSchema).max(100),rates:z.array(rateSchema).max(100),operators:z.array(operatorSchema).max(100),amenities:z.array(amenitySchema).max(200),policies:z.record(z.string().max(80),text),partnerOperatorIds:z.array(id).max(500).default([]),units:z.array(unitSchema).max(1000).default([]),keysafes:z.record(id,z.string().max(60,"Máximo de 60 caracteres.")).default({})
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
export const amenityGroups: Record<string,string[]> = {
 "Conforto e equipamento":["Wi-Fi","Ar condicionado","Aquecimento","Televisão","Cofre","Minibar","Secretária","Varanda ou terraço","Roupeiro"],
 "Casa de banho e cozinha":["Casa de banho privativa","Secador de cabelo","Produtos de higiene","Toalhas","Kitchenette","Cozinha equipada","Frigorífico","Micro-ondas","Máquina de café"],
 "Serviços e áreas comuns":["Receção 24 horas","Check-in autónomo","Elevador","Depósito de bagagens","Pequeno-almoço","Restaurante","Bar","Lavandaria","Transfer"],
 "Lazer e exterior":["Piscina exterior","Piscina interior","Piscina infantil","Jardim","Ginásio","Spa","Parque infantil","Estacionamento privado","Estacionamento público"],
 "Acessibilidade e famílias":["Acesso sem degraus","Quartos adaptados","Casa de banho adaptada","Berço","Cama extra","Cadeira de bebé","Animais de estimação permitidos"]
};
export function newId(){if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,v=>v.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
export function newProperty():Property {return {id:newId(),version:0,name:"",code:"",type:"Hotel",status:"Rascunho",city:"",region:"",address:"",postal:"",license:"",email:"",phone:"",website:"",driveUrl:"",reviewLink:"",description:"",rooms:[],rates:[],operators:[],policies:{},partnerOperatorIds:[],units:[],keysafes:{},amenities:Object.entries(amenityGroups).flatMap(([group,labels],g)=>labels.map((label,i)=>({id:`amenity-${g}-${i}`,label,group,enabled:false,rules:"",custom:false})))};}
export const policyGroups = [
 {title:"Chegada e saída",fields:[{key:"checkin",label:"Check-in a partir de",type:"time"},{key:"checkinEnd",label:"Check-in até às",type:"time"},{key:"checkout",label:"Check-out até às",type:"time"},{key:"reception",label:"Horário da receção",placeholder:"Ex.: 08:00–22:00"},{key:"arrival",label:"Instruções de chegada e check-in autónomo",area:true},{key:"late",label:"Early check-in e late check-out",area:true}]},
 {title:"Pagamentos e condições",fields:[{key:"deposit",label:"Caução — valor, cobrança e devolução",area:true},{key:"tax",label:"Taxa turística — valor, idades e isenções",area:true},{key:"payments",label:"Métodos de pagamento e faturação",area:true},{key:"cancellation",label:"Cancelamento e não comparência",area:true}]},
 {title:"Durante a estadia",fields:[{key:"cleaning",label:"Limpeza — frequência e exceções",area:true},{key:"towels",label:"Troca de toalhas e roupa de cama",area:true},{key:"breakfast",label:"Pequeno-almoço — horários, local e preço",area:true},{key:"children",label:"Crianças, berços e camas extra",area:true},{key:"pets",label:"Animais de estimação — regras e custos",area:true},{key:"smoking",label:"Fumadores, festas e horário de silêncio",area:true}]},
 {title:"Informação útil",fields:[{key:"parking",label:"Estacionamento e acessos",area:true},{key:"accessibility",label:"Acessibilidade e limitações",area:true},{key:"emergency",label:"Contacto de emergência e assistência",area:true},{key:"directions",label:"Como chegar e pontos de referência",area:true},{key:"other",label:"Outras regras e informações",area:true}]}
] as const;
/** Usado para filtrar listas e seletores de alojamentos por nome, localidade ou região. */
export function propertyMatches(p:{name:string,city:string,region:string},query:string){
 const q=query.trim().toLowerCase();if(!q)return true;
 return p.name.toLowerCase().includes(q)||p.city.toLowerCase().includes(q)||p.region.toLowerCase().includes(q);
}
