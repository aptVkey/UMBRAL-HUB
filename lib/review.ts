import {z} from "zod";
export const REVIEW_PLATFORMS=["Google","Booking.com","Expedia","Tripadvisor","Outra"] as const;
export type ReviewPlatform=typeof REVIEW_PLATFORMS[number];
/** new: por responder · draft: rascunho guardado · approved: aprovada, à espera de publicação · published: respondida na plataforma. */
export const REVIEW_STATUSES=["new","draft","approved","published"] as const;
export type ReviewStatus=typeof REVIEW_STATUSES[number];
export const STATUS_LABEL:Record<ReviewStatus,string>={new:"Por responder",draft:"Rascunho",approved:"Aprovada",published:"Respondida"};
/** Escala da plataforma: Google e Tripadvisor 1–5, Booking e Expedia 1–10. */
export const ratingScale=(platform:string)=>platform==="Booking.com"||platform==="Expedia"?10:5;

/** Filtro de data (sobre a data da review). */
export const REVIEW_PERIODS=[
 {value:"7d",label:"Últimos 7 dias"},{value:"30d",label:"Últimos 30 dias"},{value:"90d",label:"Últimos 3 meses"},
 {value:"12m",label:"Últimos 12 meses"},{value:"year",label:"Este ano"},{value:"lastyear",label:"Ano passado"}
] as const;
const iso=(d:Date)=>d.toISOString().slice(0,10);
/** Intervalo de datas (AAAA-MM-DD, inclusive) de um período; null se o valor não existir. */
export function periodRange(value:string,today=new Date()):{from:string,to:string|null}|null{
 const y=today.getUTCFullYear(),ago=(days:number)=>iso(new Date(today.getTime()-days*864e5));
 switch(value){
  case "7d":return {from:ago(6),to:null};
  case "30d":return {from:ago(29),to:null};
  case "90d":return {from:ago(89),to:null};
  case "12m":{const d=new Date(today);d.setUTCFullYear(y-1);return {from:iso(new Date(d.getTime()+864e5)),to:null}}
  case "year":return {from:`${y}-01-01`,to:null};
  case "lastyear":return {from:`${y-1}-01-01`,to:`${y-1}-12-31`};
  default:return null;
 }
}

/**
 * Filtro de nota conforme a plataforma: estrelas (1–5) no Google/Tripadvisor, intervalos (1–10) no Booking/Expedia
 * e, com todas as plataformas, positivas/neutras/negativas já ajustadas à escala de cada uma.
 */
export type RatingFilter={value:string,label:string,min?:number,max?:number};
export function ratingFilters(platform:string):RatingFilter[]{
 const none={value:"none",label:"Sem nota"};
 if(!platform)return [{value:"pos",label:"Positivas (4–5★ · 8–10)"},{value:"neu",label:"Neutras (3★ · 7)"},{value:"neg",label:"Negativas (1–2★ · 1–6)"},none];
 if(ratingScale(platform)===10)return [
  {value:"9-10",label:"9 a 10 · Excelente",min:9,max:10},{value:"7-8",label:"7 a 8 · Bom",min:7,max:8},
  {value:"5-6",label:"5 a 6 · Razoável",min:5,max:6},{value:"1-4",label:"1 a 4 · Mau",min:1,max:4},none];
 return [...[5,4,3,2,1].map(n=>({value:String(n),label:`${"★".repeat(n)} ${n} ${n===1?"estrela":"estrelas"}`,min:n,max:n})),none];
}
const date=z.string().refine(v=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))),"Data inválida.");
/** Review introduzida à mão (enquanto a plataforma não tiver integração). */
export const manualReviewSchema=z.object({
 propertyId:z.string().uuid("Escolhe o alojamento."),
 platform:z.enum(REVIEW_PLATFORMS),
 author:z.string().trim().max(120,"Máximo de 120 caracteres."),
 rating:z.number().int().min(1).max(10).nullable(),
 body:z.string().trim().min(1,"Cola o texto da review.").max(10000,"A review pode ter no máximo 10.000 caracteres."),
 reviewDate:date
}).superRefine((v,ctx)=>{if(v.rating!==null&&v.rating>ratingScale(v.platform))ctx.addIssue({code:"custom",path:["rating"],message:`No ${v.platform} a pontuação vai de 1 a ${ratingScale(v.platform)}.`})});
export type ManualReview=z.infer<typeof manualReviewSchema>;
export const reviewActionSchema=z.discriminatedUnion("action",[
 z.object({action:z.literal("save"),id:z.string().uuid(),version:z.number().int().min(1),draft:z.string().max(4000,"A resposta pode ter no máximo 4.000 caracteres.")}),
 z.object({action:z.literal("approve"),id:z.string().uuid(),version:z.number().int().min(1),draft:z.string().trim().min(1,"Escreve a resposta antes de aprovar.").max(4000,"A resposta pode ter no máximo 4.000 caracteres.")}),
 z.object({action:z.literal("published"),id:z.string().uuid(),version:z.number().int().min(1)}),
 z.object({action:z.literal("reopen"),id:z.string().uuid(),version:z.number().int().min(1)})
]);
export type ReviewAction=z.infer<typeof reviewActionSchema>;
export type Review={id:string;propertyId:string;propertyName:string;platform:string;externalId:string|null;author:string;rating:number|null;body:string;reviewDate:string;status:ReviewStatus;draft:string;reply:string;draftedBy:string;approvedBy:string;approvedAt:string|null;publishedAt:string|null;source:string;version:number;createdAt:string;updatedAt:string};
/** Negativa: até 2/5 ou até 6/10. */
export const isNegative=(r:Pick<Review,"rating"|"platform">)=>r.rating!==null&&r.rating/ratingScale(r.platform)<=(ratingScale(r.platform)===10?0.6:0.4);
