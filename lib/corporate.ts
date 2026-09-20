import {z} from "zod";
import {newId} from "./property";
const short=z.string().max(180,"Máximo de 180 caracteres.");
const long=z.string().max(5000,"Máximo de 5.000 caracteres.");
const email=short.refine(v=>!v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),"Introduz um email válido.");
const date=z.string().refine(v=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v),"Data inválida.");
export const corporateSchema=z.object({
 id:z.string().uuid(),version:z.number().int().min(0),name:short.trim().min(1,"Preenche o nome da empresa."),legalName:short,taxId:short,code:short,sector:short,
 address:short,postal:short,city:short,country:short,email,phone:short,website:z.string().max(500).refine(v=>!v||/^https?:\/\/[^\s]+$/.test(v),"Usa um endereço com https://."),
 contactName:short,contactRole:short,contactEmail:email,contactPhone:short,billingEmail:email,billingDetails:long,notes:long,
 status:z.enum(["Rascunho","Ativo","Inativo"]),agreementName:short,start:date,end:date,discountType:z.enum(["percent","fixed"]),discount:z.string().max(15).refine(v=>v===""||/^\d+(\.\d{1,2})?$/.test(v),"Introduz um valor válido (até duas casas decimais)."),promoCode:z.string().max(80),discountBasis:long,
 bookingRules:long,paymentRules:long,cancellationRules:long,exclusions:long,agreedRules:long,
 propertyIds:z.array(z.string().uuid()).max(500)
}).superRefine((v,ctx)=>{
 if(v.start&&v.end&&v.end<v.start)ctx.addIssue({code:"custom",path:["end"],message:"A data final deve ser igual ou posterior à inicial."});
 if(Number(v.discount)>(v.discountType==="percent"?100:1000000))ctx.addIssue({code:"custom",path:["discount"],message:v.discountType==="percent"?"O desconto deve estar entre 0 e 100%.":"O valor excede o limite permitido."});
 if(new Set(v.propertyIds).size!==v.propertyIds.length)ctx.addIssue({code:"custom",path:["propertyIds"],message:"Existem alojamentos duplicados."});
 if(v.status==="Ativo"&&!v.propertyIds.length)ctx.addIssue({code:"custom",path:["propertyIds"],message:"Seleciona pelo menos um alojamento para ativar o acordo."});
});
export type Corporate=z.infer<typeof corporateSchema>;
export type ContractInfo={name:string;size:number;type:string;uploadedAt:string};
export type SavedCorporate=Corporate&{updatedAt:string;contract:ContractInfo|null};
export function newCorporate():Corporate{return {id:newId(),version:0,name:"",legalName:"",taxId:"",code:"",sector:"",address:"",postal:"",city:"",country:"Portugal",email:"",phone:"",website:"",contactName:"",contactRole:"",contactEmail:"",contactPhone:"",billingEmail:"",billingDetails:"",notes:"",status:"Rascunho",agreementName:"",start:"",end:"",discountType:"percent",discount:"",promoCode:"",discountBasis:"",bookingRules:"",paymentRules:"",cancellationRules:"",exclusions:"",agreedRules:"",propertyIds:[]};}
export function discountLabel(c:Corporate){return c.discount===""?"Por definir":`${Number(c.discount).toLocaleString("pt-PT",{maximumFractionDigits:2})}${c.discountType==="percent"?"%":" €"}`;}
export function agreementStatus(c:Corporate,today=new Date().toISOString().slice(0,10)){if(c.status!=="Ativo")return c.status;if(c.end&&c.end<today)return "Expirado";if(c.start&&c.start>today)return "Agendado";return "Ativo";}
export const MAX_CONTRACT_SIZE=10*1024*1024;
export const CONTRACT_ACCEPT=".pdf,.doc,.docx,.png,.jpg,.jpeg";
export function checkContract(file:{size:number;name:string}){if(file.size===0)return "O ficheiro está vazio.";if(file.size>MAX_CONTRACT_SIZE)return "O contrato pode ter no máximo 10 MB.";if(!/\.(pdf|doc|docx|png|jpe?g)$/i.test(file.name))return "Utiliza PDF, DOC, DOCX, PNG ou JPG.";return "";}
