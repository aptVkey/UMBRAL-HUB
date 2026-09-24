import {database,storage} from "@/db/raw";
import type {Corporate,ContractInfo,SavedCorporate} from "./corporate";
export type StoredContract=ContractInfo&{key:string};
export type CorporateRow={id:string,payload:string,version:number,updated_at:string,contract:string|null,last_write_id:string};
export const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
export function bucket(){return storage();}
export function present(row:CorporateRow,propertyIds:string[]):SavedCorporate{const c=row.contract?JSON.parse(row.contract) as StoredContract:null;return {...JSON.parse(row.payload) as Corporate,id:row.id,version:row.version,updatedAt:row.updated_at,propertyIds,contract:c?{name:c.name,size:c.size,type:c.type,uploadedAt:c.uploadedAt}:null};}
export async function findCorporate(id:string){return database().prepare("SELECT * FROM corporates WHERE id=?").bind(id).first<CorporateRow>();}
export async function boundedForm(request:Request){const limit=11*1024*1024;if(Number(request.headers.get("content-length"))>limit)throw new Error("BODY_TOO_LARGE");if(!request.body)throw new Error("INVALID_FORM");const reader=request.body.getReader();const chunks:Uint8Array[]=[];let length=0;while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw new Error("BODY_TOO_LARGE");}chunks.push(value);}const buffer=new Uint8Array(length);let offset=0;for(const c of chunks){buffer.set(c,offset);offset+=c.length;}return new Response(buffer,{headers:{"Content-Type":request.headers.get("content-type")||""}}).formData();}
export async function fileType(file:File){const b=new Uint8Array(await file.slice(0,16).arrayBuffer()),ext=file.name.split('.').pop()?.toLowerCase();const matches=(a:number[])=>a.every((x,i)=>b[i]===x);
 if(ext==='pdf'&&matches([37,80,68,70,45]))return 'application/pdf';
 if(ext==='doc'&&matches([208,207,17,224,161,177,26,225]))return 'application/msword';
 if(ext==='docx'&&matches([80,75,3,4]))return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
 if(ext==='png'&&matches([137,80,78,71,13,10,26,10]))return 'image/png';
 if((ext==='jpg'||ext==='jpeg')&&matches([255,216,255]))return 'image/jpeg';
 return null;
}
