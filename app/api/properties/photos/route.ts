import {database} from "@/db/raw";
import {guard,guardEditable,deny,propertyAllowed} from "@/lib/access-server";
import {listPhotos,uploadPhoto,boundedForm} from "@/lib/property-photo-server";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
export async function GET(request:Request){
 const g=await guard(request,"properties","view");if("response" in g)return g.response;
 try{
 const propertyId=new URL(request.url).searchParams.get("propertyId");if(!propertyId)return reply({error:"Alojamento não indicado."},400);
 if(!propertyAllowed(g.access,propertyId))return deny("O teu acesso está limitado a alguns alojamentos.");
 return reply({photos:await listPhotos(propertyId)});
 }catch(e){console.error("Load room photos",e);return reply({error:"Não foi possível carregar as fotos. Tenta novamente."},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guardEditable(request,"properties");if("response" in g)return g.response;
 if(g.mode==="propose")return reply({error:"Não podes propor fotos. Pede a um editor ou administrador que as adicione."},400);
 try{
 let form:FormData;try{form=await boundedForm(request)}catch(e){return reply({error:e instanceof Error&&e.message==='BODY_TOO_LARGE'?"Cada foto pode ter no máximo 10 MB.":"Não foi possível ler os dados enviados."},400);}
 const propertyId=String(form.get('propertyId')||''),roomId=String(form.get('roomId')||'');
 const upload=form.get('file');
 if(!propertyId||!roomId)return reply({error:"Pedido inválido."},400);
 if(!(upload instanceof File))return reply({error:"Seleciona uma foto."},400);
 if(!propertyAllowed(g.access,propertyId))return deny("O teu acesso está limitado a alguns alojamentos.");
 const row=await database().prepare("SELECT payload FROM properties WHERE id=?").bind(propertyId).first<{payload:string}>();
 if(!row)return reply({error:"O alojamento já não existe. Guarda a ficha antes de adicionar fotos."},404);
 const rooms=(JSON.parse(row.payload).rooms||[]) as {id:string}[];
 if(!rooms.some(r=>r.id===roomId))return reply({error:"Esta tipologia já não existe nesta ficha. Guarda a ficha e tenta novamente."},409);
 const r=await uploadPhoto(propertyId,roomId,upload,g.access.email);
 if(!r.ok)return reply({error:r.error},r.status);
 return reply({photo:r.photo},201);
 }catch(e){console.error("Upload room photo",e);return reply({error:"Não foi possível guardar a foto. Tenta novamente."},503);}
}
