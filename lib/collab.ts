import {z} from "zod";
import {newId} from "./property";
const short=z.string().max(180,"Máximo de 180 caracteres.");
const long=z.string().max(5000,"Máximo de 5.000 caracteres.");
const email=short.refine(v=>!v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),"Introduz um email válido.");
const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const date=z.string().refine(v=>!v||validDate(v),"Data inválida.");
const percent=z.string().max(6).refine(v=>v===""||/^\d{1,3}(\.\d{1,2})?$/.test(v),"Introduz uma percentagem válida (até duas casas decimais).");
export const PARTNER_CATEGORIES=["Agência de viagens","Operador turístico","Empresa","Associação","Plataforma online","Outro"] as const;
export const STATUSES=["Rascunho","Ativo","Inativo"] as const;
export const PROMO_PATTERN=/^[A-Za-z0-9_-]{3,30}$/;
export const collaboratorSchema=z.object({
 id:z.string().uuid(),version:z.number().int().min(0),kind:z.enum(["partner","affiliate"]),
 name:short.trim().min(1,"Preenche o nome."),status:z.enum(STATUSES),
 contactName:short,contactEmail:email,contactPhone:short,website:z.string().max(500).refine(v=>!v||/^https?:\/\/[^\s]+$/.test(v),"Usa um endereço com https://."),
 category:z.enum(PARTNER_CATEGORIES),commission:percent,start:date,end:date,
 promoCode:z.string().trim().max(30),discount:percent,notes:long
}).superRefine((v,ctx)=>{
 const bad=(path:string,message:string)=>ctx.addIssue({code:"custom",path:[path],message});
 if(v.start&&v.end&&v.end<v.start)bad("end","A data final deve ser igual ou posterior à inicial.");
 if(Number(v.commission)>100)bad("commission","A comissão deve estar entre 0 e 100%.");
 if(Number(v.discount)>100)bad("discount","O desconto deve estar entre 0 e 100%.");
 if(v.kind==="affiliate"){
  if(v.promoCode&&!PROMO_PATTERN.test(v.promoCode))bad("promoCode","Usa 3 a 30 letras, números, hífen ou underscore, sem espaços.");
  if(v.status==="Ativo"&&!v.promoCode)bad("promoCode","Indica o código promocional para ativar o afiliado.");
  if(v.status==="Ativo"&&v.discount==="")bad("discount","Indica a percentagem de desconto para ativar o afiliado.");
  if(v.promoCode&&v.discount==="")bad("discount","Indica a percentagem de desconto associada ao código.");
 }
});
export type Collaborator=z.infer<typeof collaboratorSchema>;
export type Kind=Collaborator["kind"];
export type Totals={bookings:number;nights:number;revenueCents:number};
export type SavedCollaborator=Collaborator&{updatedAt:string;shareToken:string|null;totals:Totals};
export function newCollaborator(kind:Kind):Collaborator{return {id:newId(),version:0,kind,name:"",status:"Rascunho",contactName:"",contactEmail:"",contactPhone:"",website:"",category:"Agência de viagens",commission:"",start:"",end:"",promoCode:"",discount:"",notes:""};}
export const normalizePromo=(code:string)=>code.trim().toUpperCase();
export function percentLabel(v:string){return v===""?"Por definir":`${Number(v).toLocaleString("pt-PT",{maximumFractionDigits:2})}%`;}
export function agreementStatus(c:Collaborator,today=new Date().toISOString().slice(0,10)){if(c.status!=="Ativo")return c.status;if(c.end&&c.end<today)return "Expirado";if(c.start&&c.start>today)return "Agendado";return "Ativo";}

export const resultSchema=z.object({
 ownerId:z.string().uuid(),date:z.string().refine(validDate,"Data inválida."),
 bookings:z.number().int("Usa um número inteiro.").min(0).max(100000),nights:z.number().int("Usa um número inteiro.").min(0).max(1000000),
 revenueCents:z.number().int().min(0).max(100000000000),note:z.string().max(300,"Máximo de 300 caracteres.")
}).superRefine((v,ctx)=>{if(!v.bookings&&!v.nights&&!v.revenueCents)ctx.addIssue({code:"custom",path:["bookings"],message:"Regista pelo menos um valor de reservas, noites ou receita."});if(v.nights&&!v.bookings)ctx.addIssue({code:"custom",path:["bookings"],message:"Indica o número de reservas associado às noites."});});
export type ResultInput=z.infer<typeof resultSchema>;
export type ResultRow={id:string;date:string;bookings:number;nights:number;revenueCents:number;note:string};
export const MAX_RESULTS=5000;

export const euro=(cents:number,digits=0)=>(cents/100).toLocaleString("pt-PT",{style:"currency",currency:"EUR",minimumFractionDigits:digits,maximumFractionDigits:digits});
export const integer=(n:number)=>n.toLocaleString("pt-PT");
export function parseEuroToCents(v:string){const t=v.trim().replace(/\s/g,"").replace(",",".");if(t==="")return 0;if(!/^\d+(\.\d{1,2})?$/.test(t))return NaN;return Math.round(Number(t)*100);}
export function sum(rows:ResultRow[]):Totals{return rows.reduce((t,r)=>({bookings:t.bookings+r.bookings,nights:t.nights+r.nights,revenueCents:t.revenueCents+r.revenueCents}),{bookings:0,nights:0,revenueCents:0});}
const MONTHS=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
export type MonthPoint={month:string;label:string;bookings:number;nights:number;revenue:number};
/** Agrupa por mês e preenche os meses sem registos; `months` limita aos últimos N (0 = todos). */
export function monthly(rows:ResultRow[],months:number,today=new Date().toISOString().slice(0,10)):MonthPoint[]{
 if(!rows.length)return [];
 const map=new Map<string,MonthPoint>();
 for(const r of rows){const key=r.date.slice(0,7),p=map.get(key)||{month:key,label:"",bookings:0,nights:0,revenue:0};p.bookings+=r.bookings;p.nights+=r.nights;p.revenue+=r.revenueCents/100;map.set(key,p);}
 const keys=[...map.keys()].sort();let [y,m]=keys[0].split("-").map(Number);const last=keys[keys.length-1]>today.slice(0,7)?keys[keys.length-1]:today.slice(0,7);
 const out:MonthPoint[]=[];
 while(`${y}-${String(m).padStart(2,"0")}`<=last){const key=`${y}-${String(m).padStart(2,"0")}`;const p=map.get(key)||{month:key,label:"",bookings:0,nights:0,revenue:0};out.push({...p,label:`${MONTHS[m-1]} ${String(y).slice(2)}`});m++;if(m>12){m=1;y++;}}
 return months?out.slice(-months):out;
}
export function dateLabel(v:string){const [y,m,d]=v.split("-");return `${d}/${m}/${y}`;}
