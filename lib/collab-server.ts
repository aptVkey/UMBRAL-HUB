import {database} from "@/db/raw";
import type {Collaborator,ResultRow,SavedCollaborator} from "./collab";
export const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
export const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
export type Row={id:string;payload:string;version:number;updated_at:string;share_token:string|null;bookings:number;nights:number;revenue_cents:number};
export const SELECT_WITH_TOTALS=`SELECT c.id,c.payload,c.version,c.updated_at,c.share_token,COALESCE(SUM(r.bookings),0) AS bookings,COALESCE(SUM(r.nights),0) AS nights,COALESCE(SUM(r.revenue_cents),0) AS revenue_cents FROM collaborators c LEFT JOIN collaborator_results r ON r.owner_id=c.id`;
export function present(r:Row):SavedCollaborator{return {...JSON.parse(r.payload) as Collaborator,id:r.id,version:r.version,updatedAt:r.updated_at,shareToken:r.share_token,totals:{bookings:r.bookings,nights:r.nights,revenueCents:r.revenue_cents}};}
/** Token de 192 bits; é a única credencial do link público do afiliado. */
export function newToken(){const b=crypto.getRandomValues(new Uint8Array(24));return btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
export async function findOne(id:string){const r=await database().prepare(`${SELECT_WITH_TOTALS} WHERE c.id=? GROUP BY c.id`).bind(id).first<Row>();return r?present(r):null;}
export type DbResult={id:string;date:string;bookings:number;nights:number;revenue_cents:number;note:string};
export const toResult=(r:DbResult):ResultRow=>({id:r.id,date:r.date,bookings:r.bookings,nights:r.nights,revenueCents:r.revenue_cents,note:r.note});
export async function resultsFor(ownerId:string){const {results}=await database().prepare("SELECT id,date,bookings,nights,revenue_cents,note FROM collaborator_results WHERE owner_id=? ORDER BY date DESC,created_at DESC").bind(ownerId).all<DbResult>();return results.map(toResult);}
