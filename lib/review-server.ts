import {database} from "@/db/raw";
import type {Access} from "./access-server";
import {periodRange,ratingFilters,type Review} from "./review";

type Row={id:string,property_id:string,property_name:string,platform:string,external_id:string|null,author:string,rating:number|null,body:string,review_date:string,status:Review["status"],draft:string,reply:string,drafted_by:string,approved_by:string,approved_at:string|null,published_at:string|null,source:string,version:number,created_at:string,updated_at:string};
const SELECT=`SELECT r.*,p.name AS property_name FROM reviews r JOIN properties p ON p.id=r.property_id`;
export const toReview=(r:Row):Review=>({id:r.id,propertyId:r.property_id,propertyName:r.property_name,platform:r.platform,externalId:r.external_id,author:r.author,rating:r.rating,body:r.body,reviewDate:r.review_date,status:r.status,draft:r.draft,reply:r.reply,draftedBy:r.drafted_by,approvedBy:r.approved_by,approvedAt:r.approved_at,publishedAt:r.published_at,source:r.source,version:r.version,createdAt:r.created_at,updatedAt:r.updated_at});
/** Quem tem acesso limitado a alguns alojamentos só vê as reviews desses. */
export const canSeeProperty=(a:Access,propertyId:string)=>a.propertyIds===null||a.propertyIds.includes(propertyId);
export const REVIEW_PAGE_SIZE=20;
export type ReviewQuery={status:string,property:string,platform:string,q:string,page:number,period:string,rating:string};
const TEN=`r.platform IN ('Booking.com','Expedia')`;
/** Negativa: até 6/10 no Booking/Expedia, até 2/5 nas restantes (igual a isNegative em lib/review). */
const NEGATIVE=`(r.rating IS NOT NULL AND ((${TEN} AND r.rating<=6) OR (NOT ${TEN} AND r.rating<=2)))`;
const SENTIMENT:Record<string,string>={
 pos:`(r.rating IS NOT NULL AND ((${TEN} AND r.rating>=8) OR (NOT ${TEN} AND r.rating>=4)))`,
 neu:`(r.rating IS NOT NULL AND ((${TEN} AND r.rating=7) OR (NOT ${TEN} AND r.rating=3)))`,
 neg:NEGATIVE,
 none:"r.rating IS NULL",
};
/** Valida os filtros de data e nota (a nota depende da plataforma escolhida). Devolve a mensagem de erro, se houver. */
export function invalidFilter(f:Pick<ReviewQuery,"period"|"rating"|"platform">){
 if(f.period&&!periodRange(f.period))return "Período inválido.";
 if(f.rating&&!ratingFilters(f.platform).some(o=>o.value===f.rating))return "Filtro de nota inválido para esta plataforma.";
 return null;
}
/**
 * Uma página de reviews já filtrada e ordenada na base de dados (por tratar primeiro, negativas primeiro, mais recentes primeiro),
 * com o total filtrado e as contagens por estado. Tudo numa só ida à base de dados.
 */
export async function listReviewPage(a:Access,f:ReviewQuery){
 const db=database(),where:string[]=[],params:unknown[]=[];
 if(a.propertyIds!==null){where.push("r.property_id IN (SELECT jsonb_array_elements_text(?::jsonb))");params.push(JSON.stringify(a.propertyIds))}
 const scope=[...where],scopeParams=[...params];
 if(f.status==="open")where.push("r.status<>'published'");else if(f.status){where.push("r.status=?");params.push(f.status)}
 if(f.property){where.push("r.property_id=?");params.push(f.property)}
 if(f.platform){where.push("r.platform=?");params.push(f.platform)}
 const range=f.period?periodRange(f.period):null;
 if(range){where.push("r.review_date>=?");params.push(range.from);if(range.to){where.push("r.review_date<=?");params.push(range.to)}}
 const band=f.rating?ratingFilters(f.platform).find(o=>o.value===f.rating):undefined;
 if(band){if(band.min!==undefined){where.push("r.rating BETWEEN ? AND ?");params.push(band.min,band.max)}else if(SENTIMENT[band.value])where.push(SENTIMENT[band.value])}
 const q=f.q.trim().slice(0,200);if(q){const like="%"+q.replace(/[\\%_]/g,m=>"\\"+m)+"%";where.push("(r.author ILIKE ? OR r.body ILIKE ? OR p.name ILIKE ?)");params.push(like,like,like)}
 const w=where.length?" WHERE "+where.join(" AND "):"",sw=scope.length?" WHERE "+scope.join(" AND "):"";
 const page=Math.max(1,Math.floor(f.page)||1);
 const [items,total,counts]=await db.batch([
  db.prepare(`${SELECT}${w} ORDER BY (r.status='published') ASC, ${NEGATIVE} DESC, r.review_date DESC, r.created_at DESC, r.id LIMIT ${REVIEW_PAGE_SIZE} OFFSET ${(page-1)*REVIEW_PAGE_SIZE}`).bind(...params),
  db.prepare(`SELECT COUNT(*) AS n FROM reviews r JOIN properties p ON p.id=r.property_id${w}`).bind(...params),
  db.prepare(`SELECT r.status,COUNT(*) AS n FROM reviews r${sw} GROUP BY r.status`).bind(...scopeParams),
 ]);
 return {reviews:(items.results as Row[]).map(toReview),total:Number((total.results[0] as {n:number}|undefined)?.n||0),
  counts:Object.fromEntries((counts.results as {status:string,n:number}[]).map(c=>[c.status,Number(c.n)])) as Record<string,number>,page,pageSize:REVIEW_PAGE_SIZE};
}
export async function getReview(id:string):Promise<Review|null>{
 const r=await database().prepare(`${SELECT} WHERE r.id=?`).bind(id).first<Row>();return r?toReview(r):null;
}
