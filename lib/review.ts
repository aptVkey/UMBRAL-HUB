import {z} from "zod";
export const REVIEW_PLATFORMS=["Google","Booking.com","Expedia","Tripadvisor","Outra"] as const;
export type ReviewPlatform=typeof REVIEW_PLATFORMS[number];
/** new: por responder · draft: rascunho guardado · approved: aprovada, à espera de publicação · published: respondida na plataforma. */
export const REVIEW_STATUSES=["new","draft","approved","published"] as const;
export type ReviewStatus=typeof REVIEW_STATUSES[number];
export const STATUS_LABEL:Record<ReviewStatus,string>={new:"Por responder",draft:"Rascunho",approved:"Aprovada",published:"Respondida"};
/** Escala da plataforma: Google e Tripadvisor 1–5, Booking e Expedia 1–10. */
export const ratingScale=(platform:string)=>platform==="Booking.com"||platform==="Expedia"?10:5;
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
