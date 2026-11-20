import {database} from "@/db/raw";
import type {Access} from "./access-server";
import type {Review} from "./review";

type Row={id:string,property_id:string,property_name:string,platform:string,external_id:string|null,author:string,rating:number|null,body:string,review_date:string,status:Review["status"],draft:string,reply:string,drafted_by:string,approved_by:string,approved_at:string|null,published_at:string|null,source:string,version:number,created_at:string,updated_at:string};
const SELECT=`SELECT r.*,p.name AS property_name FROM reviews r JOIN properties p ON p.id=r.property_id`;
export const toReview=(r:Row):Review=>({id:r.id,propertyId:r.property_id,propertyName:r.property_name,platform:r.platform,externalId:r.external_id,author:r.author,rating:r.rating,body:r.body,reviewDate:r.review_date,status:r.status,draft:r.draft,reply:r.reply,draftedBy:r.drafted_by,approvedBy:r.approved_by,approvedAt:r.approved_at,publishedAt:r.published_at,source:r.source,version:r.version,createdAt:r.created_at,updatedAt:r.updated_at});
/** Quem tem acesso limitado a alguns alojamentos só vê as reviews desses. */
export const canSeeProperty=(a:Access,propertyId:string)=>a.propertyIds===null||a.propertyIds.includes(propertyId);
export async function listReviews(a:Access):Promise<Review[]>{
 const db=database();
 const q=a.propertyIds===null?db.prepare(`${SELECT} ORDER BY r.review_date DESC,r.created_at DESC LIMIT 2000`):db.prepare(`${SELECT} WHERE r.property_id IN (SELECT jsonb_array_elements_text(?::jsonb)) ORDER BY r.review_date DESC,r.created_at DESC LIMIT 2000`).bind(JSON.stringify(a.propertyIds));
 const {results}=await q.all<Row>();return results.map(toReview);
}
export async function getReview(id:string):Promise<Review|null>{
 const r=await database().prepare(`${SELECT} WHERE r.id=?`).bind(id).first<Row>();return r?toReview(r):null;
}
