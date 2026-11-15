import {database} from "@/db/raw";
import {guard} from "@/lib/access-server";
import {bucket,boundedForm} from "@/lib/corporate-server";
import {uploadTrainingImage} from "@/lib/training-image-server";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
/** Mostra uma imagem de formação (quem consulta a Formação pode vê-la). */
export async function GET(request:Request){
 try{
  const id=new URL(request.url).searchParams.get("id");
  const [g,row]=await Promise.all([guard(request,"training","view"),id&&/^[0-9a-f-]{36}$/i.test(id)?database().prepare("SELECT key,name,type FROM training_images WHERE id=?").bind(id).first<{key:string,name:string,type:string}>():null]);
  if("response" in g)return g.response;
  if(!row)return reply({error:"A imagem não existe."},404);
  const object=await bucket().get(row.key);if(!object)return reply({error:"A imagem está indisponível. Tenta novamente."},503);
  return new Response(object.body,{headers:{"Content-Type":row.type,"Content-Length":String(object.size),"Content-Disposition":`inline; filename*=UTF-8''${encodeURIComponent(row.name)}`,"Cache-Control":"private, max-age=31536000, immutable","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'"}});
 }catch(e){console.error("Load training image",e);return reply({error:"Não foi possível obter a imagem."},503);}
}
/** Envia uma imagem para um bloco de conteúdo (quem edita a Formação). */
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"training","edit");if("response" in g)return g.response;
 try{
  let form:FormData;try{form=await boundedForm(request)}catch(e){return reply({error:e instanceof Error&&e.message==="BODY_TOO_LARGE"?"Cada imagem pode ter no máximo 10 MB.":"Não foi possível ler os dados enviados."},400);}
  const file=form.get("file");if(!(file instanceof File))return reply({error:"Seleciona uma imagem."},400);
  const r=await uploadTrainingImage(file,g.access.email);
  return r.ok?reply({image:r.image},201):reply({error:r.error},r.status);
 }catch(e){console.error("Upload training image",e);return reply({error:"Não foi possível guardar a imagem. Tenta novamente."},503);}
}
