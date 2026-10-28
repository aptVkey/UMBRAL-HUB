import {database} from "@/db/raw";
import {bucket,boundedForm,fileType} from "./corporate-server";
import {checkPhoto,relocatePhotos} from "./property";
import type {RoomPhoto} from "./property";
export {boundedForm};
type Row={id:string,room_id:string,key:string,name:string,size:number,type:string,uploaded_by:string,uploaded_at:string,position:number};
const present=(r:Row):RoomPhoto=>({id:r.id,roomId:r.room_id,name:r.name,size:r.size,type:r.type,uploadedBy:r.uploaded_by,uploadedAt:r.uploaded_at,position:r.position});
export async function listPhotos(propertyId:string):Promise<RoomPhoto[]>{
 const {results}=await database().prepare("SELECT id,room_id,key,name,size,type,uploaded_by,uploaded_at,position FROM property_room_photos WHERE property_id=? ORDER BY room_id,position,uploaded_at,id").bind(propertyId).all<Row>();
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
  await bucket().put(key,file.stream(),{httpMetadata:{contentType:mime}});
  const now=new Date().toISOString();
  const row=await insertPhoto({id,propertyId,roomId,key,name,size:file.size,type:mime,uploadedBy,uploadedAt:now});
  return {ok:true,photo:{id,roomId,name,size:file.size,type:mime,uploadedBy,uploadedAt:now,position:row.position}};
 }catch(e){try{await bucket().delete(key)}catch{}console.error("Upload room photo",e);return {ok:false,status:503,error:"Não foi possível guardar a foto. Tenta novamente."};}
}
/** Insere a foto no fim da tipologia. A posição é calculada na própria instrução, para que uploads em paralelo não usem todos a mesma. */
async function insertPhoto(p:{id:string,propertyId:string,roomId:string,key:string,name:string,size:number,type:string,uploadedBy:string,uploadedAt:string}):Promise<{position:number}>{
 const db=database();
 const [,read]=await db.batch([
  db.prepare("INSERT INTO property_room_photos (id,property_id,room_id,key,name,size,type,uploaded_by,uploaded_at,position) SELECT ?,?,?,?,?,?,?,?,?,COALESCE(MAX(position),-1)+1 FROM property_room_photos WHERE property_id=? AND room_id=?").bind(p.id,p.propertyId,p.roomId,p.key,p.name,p.size,p.type,p.uploadedBy,p.uploadedAt,p.propertyId,p.roomId),
  db.prepare("SELECT position FROM property_room_photos WHERE id=?").bind(p.id)]);
 return {position:Number((read.results[0] as {position:number}|undefined)?.position??0)};
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
export type PhotoResult<T>=({ok:true}&T)|{ok:false,status:number,error:string};
export const MAX_BULK_PHOTOS=300;
/** A tipologia de destino tem de existir na ficha atual do alojamento (as tipologias não têm tabela própria). */
export async function checkRoom(propertyId:string,roomId:string):Promise<{ok:true}|{ok:false,status:number,error:string}>{
 const row=await database().prepare("SELECT payload FROM properties WHERE id=?").bind(propertyId).first<{payload:string}>();
 if(!row)return {ok:false,status:404,error:"O alojamento já não existe. Guarda a ficha antes de mexer nas fotos."};
 const rooms=(JSON.parse(row.payload).rooms||[]) as {id:string}[];
 if(!rooms.some(r=>r.id===roomId))return {ok:false,status:409,error:"Esta tipologia já não existe nesta ficha. Guarda a ficha e tenta novamente."};
 return {ok:true};
}
/** Elimina várias fotos de uma vez (base de dados numa só instrução; ficheiros do Storage em lotes pequenos em paralelo). */
export async function deletePhotos(propertyId:string,ids:string[]):Promise<PhotoResult<{photos:RoomPhoto[]}>>{
 const db=database();
 const {results}=await db.prepare("SELECT id,key FROM property_room_photos WHERE property_id=? AND id IN (SELECT jsonb_array_elements_text(?::jsonb))").bind(propertyId,JSON.stringify(ids)).all<{id:string,key:string}>();
 if(!results.length)return {ok:false,status:404,error:"As fotos já não existem."};
 await db.prepare("DELETE FROM property_room_photos WHERE property_id=? AND id IN (SELECT jsonb_array_elements_text(?::jsonb))").bind(propertyId,JSON.stringify(results.map(r=>r.id))).run();
 for(let i=0;i<results.length;i+=10)await Promise.all(results.slice(i,i+10).map(async r=>{try{await bucket().delete(r.key)}catch(e){console.error("Remove room photo object",e)}}));
 return {ok:true,photos:await listPhotos(propertyId)};
}
/** Move fotos (também de várias tipologias) para a tipologia `roomId`, antes de `beforeId` ou no fim. O ficheiro no Storage não muda de sítio: a chave fica guardada na linha. */
export async function movePhotos(propertyId:string,ids:string[],roomId:string,beforeId:string|null):Promise<PhotoResult<{photos:RoomPhoto[]}>>{
 const room=await checkRoom(propertyId,roomId);if(!room.ok)return room;
 const current=await listPhotos(propertyId),known=new Set(current.map(p=>p.id));
 const moving=ids.filter(id=>known.has(id));
 if(!moving.length)return {ok:false,status:404,error:"As fotos já não existem."};
 if(beforeId&&(!known.has(beforeId)||moving.includes(beforeId)))return {ok:false,status:409,error:"A lista de fotos mudou. Recarrega a ficha e tenta novamente."};
 const next=relocatePhotos(current,moving,roomId,beforeId),old=new Map(current.map(p=>[p.id,p]));
 const changed=next.filter(p=>{const o=old.get(p.id);return !o||o.roomId!==p.roomId||o.position!==p.position});
 if(changed.length){const db=database();await db.batch(changed.map(p=>db.prepare("UPDATE property_room_photos SET room_id=?,position=? WHERE id=? AND property_id=?").bind(p.roomId,p.position,p.id,propertyId)));}
 return {ok:true,photos:next};
}
/** Copia uma foto para a tipologia `roomId` (no fim). Cria um novo ficheiro no Storage, para que eliminar uma das cópias não afete a outra. */
export async function copyPhoto(propertyId:string,id:string,roomId:string,uploadedBy:string):Promise<UploadResult>{
 const room=await checkRoom(propertyId,roomId);if(!room.ok)return room;
 const db=database();
 const src=await db.prepare("SELECT key,name,size,type FROM property_room_photos WHERE id=? AND property_id=?").bind(id,propertyId).first<{key:string,name:string,size:number,type:string}>();
 if(!src)return {ok:false,status:404,error:"A foto já não existe."};
 const object=await bucket().get(src.key);
 if(!object)return {ok:false,status:503,error:"A foto original está indisponível. Tenta novamente."};
 const newId=crypto.randomUUID(),key=`property-photos/${propertyId}/${roomId}/${newId}`;
 try{
  await bucket().put(key,object.body,{httpMetadata:{contentType:src.type}});
  const now=new Date().toISOString();
  const {position}=await insertPhoto({id:newId,propertyId,roomId,key,name:src.name,size:src.size,type:src.type,uploadedBy,uploadedAt:now});
  return {ok:true,photo:{id:newId,roomId,name:src.name,size:src.size,type:src.type,uploadedBy,uploadedAt:now,position}};
 }catch(e){try{await bucket().delete(key)}catch{}console.error("Copy room photo",e);return {ok:false,status:503,error:"Não foi possível copiar a foto. Tenta novamente."};}
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
