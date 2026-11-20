import {z} from "zod";
import {newId} from "./property";
const short=z.string().max(180,"Máximo de 180 caracteres.");
const long=z.string().max(5000,"Máximo de 5.000 caracteres.");
const email=short.refine(v=>!v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),"Introduz um email válido.");
const url=z.string().max(500).refine(v=>!v||/^https?:\/\/[^\s]+$/.test(v),"Usa um endereço com https://.");
const date=z.string().refine(v=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v),"Data inválida.");
export const contactPersonSchema=z.object({name:short,role:short,email,phone:short});
export type ContactPerson=z.infer<typeof contactPersonSchema>;
export const OPERATOR_TYPES=["OTA","Operador turístico","Agência de viagens","Wholesaler","Canal direto","Corporate","Outro"] as const;
export const operatorSchema=z.object({
 id:z.string().uuid(),version:z.number().int().min(0),name:short.trim().min(1,"Preenche o nome do operador."),legalName:short,taxId:short,
 type:z.enum(OPERATOR_TYPES),status:z.enum(["Rascunho","Ativo","Inativo"]),website:url,country:short,city:short,
 contactName:short,contactRole:short,contactEmail:email,contactPhone:short,reservationsEmail:email,financeEmail:email,extranetUrl:url,
 address:z.string().max(300,"Máximo de 300 caracteres.").default(""),offersEmail:email.default(""),stopSalesEmail:email.default(""),contacts:z.array(contactPersonSchema).max(30,"Máximo de 30 contactos.").default([]),
 commissionType:z.enum(["percent","fixed"]),commission:z.string().max(15).refine(v=>v===""||/^\d+(\.\d{1,2})?$/.test(v),"Introduz um valor válido (até duas casas decimais)."),
 contractStart:date,contractEnd:date,paymentTerms:long,cancellationRules:long,bookingRules:long,notes:long,
 propertyIds:z.array(z.string().uuid()).max(500),
 /** ID de cada alojamento no sistema do operador (por id de alojamento). Ausente = não mexer nos IDs já guardados. */
 propertyCodes:z.record(z.string().uuid(),z.string().trim().max(120,"O ID pode ter no máximo 120 caracteres.")).optional()
}).superRefine((v,ctx)=>{
 if(v.contractStart&&v.contractEnd&&v.contractEnd<v.contractStart)ctx.addIssue({code:"custom",path:["contractEnd"],message:"A data final deve ser igual ou posterior à inicial."});
 if(v.commissionType==="percent"&&Number(v.commission)>100)ctx.addIssue({code:"custom",path:["commission"],message:"A comissão deve estar entre 0 e 100%."});
 if(new Set(v.propertyIds).size!==v.propertyIds.length)ctx.addIssue({code:"custom",path:["propertyIds"],message:"Existem alojamentos duplicados."});
});
export type Operator=z.infer<typeof operatorSchema>;
export type SavedOperator=Operator&{updatedAt:string};
export type SlimOperator={id:string;name:string;type:string;status:string;propertyIds:string[]};
export function newOperator():Operator{return {id:newId(),version:0,name:"",legalName:"",taxId:"",type:"OTA",status:"Rascunho",website:"",country:"",city:"",contactName:"",contactRole:"",contactEmail:"",contactPhone:"",reservationsEmail:"",financeEmail:"",extranetUrl:"",address:"",offersEmail:"",stopSalesEmail:"",contacts:[],commissionType:"percent",commission:"",contractStart:"",contractEnd:"",paymentTerms:"",cancellationRules:"",bookingRules:"",notes:"",propertyIds:[],propertyCodes:{}};}
/** Registos migrados ou antigos podem não ter todos os campos. */
export const withDefaults=(o:Partial<Operator>&{id:string}):Operator=>({...newOperator(),...o});
export const commissionLabel=(o:Pick<Operator,"commission"|"commissionType">)=>o.commission===""?"Por definir":`${Number(o.commission).toLocaleString("pt-PT",{maximumFractionDigits:2})}${o.commissionType==="percent"?"%":" €"}`;

export type MessageAttachment={id:string;name:string;size:number;type:string};
export type ChatMessage={id:string;operatorId:string;propertyId:string|null;replyToId:string|null;authorEmail:string;authorName:string;body:string;createdAt:string;attachments:MessageAttachment[];mine:boolean;canDelete:boolean};
export const messageSchema=z.object({operatorId:z.string().uuid(),body:z.string().max(5000,"A mensagem pode ter no máximo 5.000 caracteres."),propertyId:z.string().uuid().nullable(),replyToId:z.string().uuid().nullable()});
export const MAX_FILES=5,MAX_TOTAL_BYTES=10*1024*1024;
export const ATTACH_ACCEPT=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg";
export function checkAttachment(file:{size:number;name:string}){if(file.size===0)return `“${file.name}” está vazio.`;if(file.size>MAX_TOTAL_BYTES)return `“${file.name}” excede 10 MB.`;if(!/\.(pdf|docx?|xlsx?|png|jpe?g)$/i.test(file.name))return `“${file.name}”: utiliza PDF, Word, Excel, PNG ou JPG.`;return "";}
export function fileSize(size:number){return size<1024*1024?`${Math.max(1,Math.ceil(size/1024))} KB`:`${(size/(1024*1024)).toLocaleString("pt-PT",{maximumFractionDigits:1})} MB`;}
