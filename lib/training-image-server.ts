import {database} from "@/db/raw";
import {bucket,fileType} from "./corporate-server";
import {checkPhoto} from "./property";
import {trainingImageIds} from "./training";
export type TrainingImage={id:string,name:string,size:number,type:string};
/** Guarda uma imagem de formação no Storage e regista-a. */
export async function uploadTrainingImage(file:File,uploadedBy:string):Promise<{ok:true,image:TrainingImage}|{ok:false,status:number,error:string}>{
 const invalid=checkPhoto(file);if(invalid)return {ok:false,status:400,error:invalid.replace('Cada foto','Cada imagem')};
 const mime=await fileType(file);if(!mime||!mime.startsWith('image/'))return {ok:false,status:400,error:"O conteúdo do ficheiro não corresponde a uma imagem válida."};
 const id=crypto.randomUUID(),key=`training-images/${id}`,name=file.name.replace(/[\/\\\x00-\x1F\x7F]/g,'_').slice(0,200)||'imagem';
 try{
  await bucket().put(key,file.stream(),{httpMetadata:{contentType:mime}});
  await database().prepare("INSERT INTO training_images (id,key,name,size,type,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?)").bind(id,key,name,file.size,mime,uploadedBy,new Date().toISOString()).run();
  return {ok:true,image:{id,name,size:file.size,type:mime}};
 }catch(e){try{await bucket().delete(key)}catch{}console.error("Upload training image",e);return {ok:false,status:503,error:"Não foi possível guardar a imagem. Tenta novamente."};}
}
/** Apaga as imagens que já não são usadas em nenhum conteúdo (só as enviadas há mais de 24 h, para não apagar envios de um editor ainda aberto). Nunca falha. */
export async function pruneTrainingImages(training:{roles:{contents?:{imageId?:string|null}[]}[]}){
 try{
  const used=trainingImageIds(training),before=new Date(Date.now()-24*3600*1000).toISOString();
  const {results}=await database().prepare("SELECT id,key FROM training_images WHERE uploaded_at<?").bind(before).all<{id:string,key:string}>();
  for(const r of results.filter(r=>!used.has(r.id))){
   await database().prepare("DELETE FROM training_images WHERE id=?").bind(r.id).run();
   try{await bucket().delete(r.key)}catch(e){console.error("Remove training image object",e)}
  }
 }catch(e){console.error("Prune training images",e)}
}
