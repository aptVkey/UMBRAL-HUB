import {database} from "@/db/raw";
import {guard,scopeVisible,propertyAllowed} from "@/lib/access-server";
import {reply,bucket,linkedProperties} from "@/lib/operator-server";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const g=await guard(request,"operators","view");if("response" in g)return g.response;const access=g.access;
 try{const id=new URL(request.url).searchParams.get("id");if(!id)return reply({error:"Anexo não indicado."},400);
 const row=await database().prepare("SELECT a.key,a.name,a.type,m.operator_id,m.property_id FROM operator_attachments a JOIN operator_messages m ON m.id=a.message_id WHERE a.id=?").bind(id).first<{key:string,name:string,type:string,operator_id:string,property_id:string|null}>();
 if(!row)return reply({error:"O anexo não existe."},404);
 if(!scopeVisible(access,await linkedProperties(row.operator_id))||(row.property_id!==null&&!propertyAllowed(access,row.property_id)))return reply({error:"Não tens acesso a este anexo."},403);
 const object=await bucket().get(row.key);if(!object)return reply({error:"O anexo está indisponível. Tenta novamente."},503);
 const ext=row.name.split(".").pop()?.replace(/[^a-z0-9]/gi,"")||"bin";
 return new Response(object.body,{headers:{"Content-Type":row.type,"Content-Length":String(object.size),"Content-Disposition":`attachment; filename="anexo.${ext}"; filename*=UTF-8''${encodeURIComponent(row.name)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'"}});}
 catch(e){console.error("Load attachment",e);return reply({error:"Não foi possível obter o anexo."},503);}
}
