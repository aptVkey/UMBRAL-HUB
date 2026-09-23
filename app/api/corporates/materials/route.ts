import {database} from "@/db/raw";
import {guard} from "@/lib/access-server";
import {checkContract} from "@/lib/corporate-material";
import {reply,sameOrigin,bucket,boundedForm,fileType} from "@/lib/corporate-server";
export const dynamic="force-dynamic";
type Row={id:string,name:string,size:number,type:string,uploaded_by:string,uploaded_at:string};
const present=(r:Row)=>({id:r.id,name:r.name,size:r.size,type:r.type,uploadedBy:r.uploaded_by,uploadedAt:r.uploaded_at});
export async function GET(request:Request){
 const g=await guard(request,"corporates","view");if("response" in g)return g.response;
 try{const {results}=await database().prepare("SELECT id,name,size,type,uploaded_by,uploaded_at FROM corporate_materials ORDER BY uploaded_at DESC").all<Row>();return reply({materials:results.map(present)});}
 catch(e){console.error("Load corporate materials",e);return reply({error:"Não foi possível carregar os materiais. Tenta novamente."},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"corporates","edit");if("response" in g)return g.response;const access=g.access;
 let uploadedKey:string|null=null;
 try{
 let form:FormData;try{form=await boundedForm(request)}catch(e){return reply({error:e instanceof Error&&e.message==='BODY_TOO_LARGE'?"O ficheiro pode ter no máximo 10 MB.":"Não foi possível ler os dados enviados."},400);}
 const upload=form.get('file');if(!(upload instanceof File))return reply({error:"Seleciona um ficheiro."},400);
 const invalid=checkContract(upload);if(invalid)return reply({error:invalid},400);
 const mime=await fileType(upload);if(!mime)return reply({error:"O conteúdo do ficheiro não corresponde ao formato indicado. Seleciona um ficheiro válido."},400);
 const id=crypto.randomUUID();uploadedKey=`corporate-materials/${id}`;
 const name=upload.name.replace(/[\/\\\x00-\x1F\x7F]/g,'_').slice(0,200)||'documento';
 await bucket().put(uploadedKey,upload.stream(),{httpMetadata:{contentType:mime}});
 const now=new Date().toISOString();
 await database().prepare("INSERT INTO corporate_materials (id,key,name,size,type,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?)").bind(id,uploadedKey,name,upload.size,mime,access.email,now).run();
 return reply({material:{id,name,size:upload.size,type:mime,uploadedBy:access.email,uploadedAt:now}},201);
 }catch(e){if(uploadedKey){try{await bucket().delete(uploadedKey)}catch{}}console.error("Save corporate material",e);return reply({error:"Não foi possível guardar o ficheiro. Tenta novamente."},503);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"corporates","edit");if("response" in g)return g.response;
 try{const id=new URL(request.url).searchParams.get('id');if(!id)return reply({error:"Ficheiro não indicado."},400);
 const row=await database().prepare("SELECT key FROM corporate_materials WHERE id=?").bind(id).first<{key:string}>();if(!row)return reply({error:"O ficheiro já não existe."},404);
 await database().prepare("DELETE FROM corporate_materials WHERE id=?").bind(id).run();
 try{await bucket().delete(row.key)}catch(e){console.error("Remove material object",e)}
 return reply({ok:true});
 }catch(e){console.error("Delete corporate material",e);return reply({error:"Não foi possível remover o ficheiro."},503);}
}
