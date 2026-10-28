import {database} from "@/db/raw";
import {guard,propertyAllowed} from "@/lib/access-server";
import {bucket} from "@/lib/corporate-server";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(request:Request){
 const g=await guard(request,"properties","view");if("response" in g)return g.response;
 try{const id=new URL(request.url).searchParams.get("id");if(!id)return reply({error:"Foto não indicada."},400);
 const row=await database().prepare("SELECT key,name,type,property_id FROM property_room_photos WHERE id=?").bind(id).first<{key:string,name:string,type:string,property_id:string}>();
 if(!row)return reply({error:"A foto não existe."},404);
 if(!propertyAllowed(g.access,row.property_id))return reply({error:"Não tens acesso a esta foto."},403);
 const object=await bucket().get(row.key);if(!object)return reply({error:"A foto está indisponível. Tenta novamente."},503);
 const ext=row.name.split(".").pop()?.replace(/[^a-z0-9]/gi,"")||"jpg";
 return new Response(object.body,{headers:{"Content-Type":row.type,"Content-Length":String(object.size),"Content-Disposition":`inline; filename="foto.${ext}"; filename*=UTF-8''${encodeURIComponent(row.name)}`,"Cache-Control":"private, max-age=31536000, immutable","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'"}});
 }catch(e){console.error("Load room photo",e);return reply({error:"Não foi possível obter a foto."},503);}
}
