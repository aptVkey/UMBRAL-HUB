import {z} from "zod";
import {newId} from "./property";
const short=z.string().max(180,"Máximo de 180 caracteres.");
const long=z.string().max(5000,"Máximo de 5.000 caracteres.");
const date=z.string().refine(v=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v),"Data inválida.");
export const campaignSchema=z.object({
 id:z.string().uuid(),version:z.number().int().min(0),name:short.trim().min(1,"Preenche o nome da campanha."),status:z.enum(["Rascunho","Ativo","Inativo"]),
 start:date,end:date,discountType:z.enum(["percent","fixed"]),discount:z.string().max(15).refine(v=>v===""||/^\d+(\.\d{1,2})?$/.test(v),"Introduz um valor válido (até duas casas decimais)."),
 description:long,propertyIds:z.array(z.string().uuid()).max(500),operatorIds:z.array(z.string().uuid()).max(2000),rateIds:z.array(z.string().uuid()).max(2000)
}).superRefine((v,ctx)=>{
 const bad=(path:string,message:string)=>ctx.addIssue({code:"custom",path:[path],message});
 if(v.start&&v.end&&v.end<v.start)bad("end","A data final deve ser igual ou posterior à inicial.");
 if(Number(v.discount)>(v.discountType==="percent"?100:1000000))bad("discount",v.discountType==="percent"?"O desconto deve estar entre 0 e 100%.":"O valor excede o limite permitido.");
 if(new Set(v.propertyIds).size!==v.propertyIds.length)bad("propertyIds","Existem alojamentos duplicados.");
 if(new Set(v.operatorIds).size!==v.operatorIds.length)bad("operatorIds","Existem operadores duplicados.");
 if(new Set(v.rateIds).size!==v.rateIds.length)bad("rateIds","Existem tarifas duplicadas.");
 if(v.status==="Ativo"){
  if(!v.start)bad("start","Indica a data de início para ativar a campanha.");
  if(!v.end)bad("end","Indica a data de fim para ativar a campanha.");
  if(v.discount===""||Number(v.discount)<=0)bad("discount","Indica o desconto para ativar a campanha.");
  if(!v.propertyIds.length)bad("propertyIds","Seleciona pelo menos um alojamento para ativar a campanha.");
 }
});
export type Campaign=z.infer<typeof campaignSchema>;
export type SavedCampaign=Campaign&{updatedAt:string};
export function newCampaign():Campaign{return {id:newId(),version:0,name:"",status:"Rascunho",start:"",end:"",discountType:"percent",discount:"",description:"",propertyIds:[],operatorIds:[],rateIds:[]};}
export function discountLabel(c:Pick<Campaign,"discount"|"discountType">){return c.discount===""?"Por definir":`${Number(c.discount).toLocaleString("pt-PT",{maximumFractionDigits:2})}${c.discountType==="percent"?"%":" €"}`;}
export function campaignStatus(c:Pick<Campaign,"status"|"start"|"end">,today=new Date().toISOString().slice(0,10)){if(c.status!=="Ativo")return c.status;if(c.end&&c.end<today)return "Expirado";if(c.start&&c.start>today)return "Agendado";return "Ativo";}
