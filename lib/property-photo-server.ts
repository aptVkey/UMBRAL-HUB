import {database} from "@/db/raw";
import {bucket,boundedForm,fileType} from "./corporate-server";
import {checkPhoto} from "./property";
import type {RoomPhoto} from "./property";
export {boundedForm};
type Row={id:string,room_id:string,key:string,name:string,size:number,type:string,uploaded_by:string,uploaded_at:string,position:number};
const present=(r:Row):RoomPhoto=>({id:r.id,roomId:r.room_id,name:r.name,size:r.size,type:r.type,uploadedBy:r.uploaded_by,uploadedAt:r.uploaded_at,position:r.position});
export async function listPhotos(propertyId:string):Promise<RoomPhoto[]>{
 const {results}=await database().prepare("SELECT id,room_id,key,name,size,type,uploaded_by,uploaded_at,position FROM property_room_photos WHERE property_id=? ORDER BY room_id,position").bind(propertyId).all<Row>();
 return results.map(present);
}
export type UploadResult={ok:true,photo:RoomPhoto}|{ok:false,status:number,error:string};
/** Envia uma foto para uma tipologia. roomId tem de pertencer à ficha atual do alojamento (validado pelo chamador). */
export async function uploadPhoto(propertyId:string,roomId:string,file:File,uploadedBy:string):Promise<UploadResult>{
 const invalid=checkPhoto(file);if(invalid)return {ok:false,status:400,error:invalid};
 const mime=await fileType(file);if(!mime||!mime.startsWith('image/'))return {ok:false,status:400,error:"O conteúdo do ficheiro não corresponde a uma imagem válida."};
 const id=crypto.randomUUID(),key=`property-photos/${propertyId}/${roomId}/${id}`;
 const name=file.name.replace(/[\/\\\x00-\x1F\x7F]/g,'_').slice(0,200)||'foto';
 try{
  const db=database();
  const next=await db.prepare("SELECT COALESCE(MAX(position),-1)+1 AS n FROM property_room_photos WHERE property_id=? AND room_id=?").bind(propertyId,roomId).first<{n:number}>();
  const position=next?.n??0;
  await bucket().put(key,file.stream(),{httpMetadata:{contentType:mime}});
  const now=new Date().toISOString();
  await db.prepare("INSERT INTO property_room_photos (id,property_id,room_id,key,name,size,type,uploaded_by,uploaded_at,position) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id,propertyId,roomId,key,name,file.size,mime,uploadedBy,now,position).run();
  return {ok:true,photo:{id,roomId,name,size:file.size,type:mime,uploadedBy,uploadedAt:now,position}};
 }catch(e){try{await bucket().delete(key)}catch{}console.error("Upload room photo",e);return {ok:false,status:503,error:"Não foi possível guardar a foto. Tenta novamente."};}
}
/** Grava a nova ordem das fotos de uma tipologia (arrastar para reorganizar). */
export async function reorderPhotos(propertyId:string,roomId:string,orderedIds:string[]):Promise<{ok:true}|{ok:false,status:number,error:string}>{
 const db=database();
 const {results}=await db.prepare("SELECT id FROM property_room_photos WHERE property_id=? AND room_id=?").bind(propertyId,roomId).all<{id:string}>();
 const current=new Set(results.map(r=>r.id));
 if(orderedIds.length!==current.size||orderedIds.some(id=>!current.has(id)))return {ok:false,status:409,error:"A lista de fotos mudou. Recarrega a ficha e tenta novamente."};
 await db.batch(orderedIds.map((id,i)=>db.prepare("UPDATE property_room_photos SET position=? WHERE id=?").bind(i,id)));
 return {ok:true};
}
export async function deletePhoto(id:string,propertyId:string):Promise<{ok:true}|{ok:false,status:number,error:string}>{
 const row=await database().prepare("SELECT key FROM property_room_photos WHERE id=? AND property_id=?").bind(id,propertyId).first<{key:string}>();
 if(!row)return {ok:false,status:404,error:"A foto já não existe."};
 await database().prepare("DELETE FROM property_room_photos WHERE id=?").bind(id).run();
 try{await bucket().delete(row.key)}catch(e){console.error("Remove room photo object",e)}
 return {ok:true};
}
/** Remove as fotos de tipologias que já não existem na ficha (chamado ao guardar o alojamento). */
export async function pruneOrphanPhotos(propertyId:string,keepRoomIds:string[]):Promise<void>{
 const db=database();
 const {results}=await db.prepare("SELECT id,key,room_id FROM property_room_photos WHERE property_id=?").bind(propertyId).all<{id:string,key:string,room_id:string}>();
 const orphans=results.filter(r=>!keepRoomIds.includes(r.room_id));
 if(!orphans.length)return;
 await db.batch(orphans.map(o=>db.prepare("DELETE FROM property_room_photos WHERE id=?").bind(o.id)));
 for(const o of orphans){try{await bucket().delete(o.key)}catch(e){console.error("Remove orphan room photo",e)}}
}
