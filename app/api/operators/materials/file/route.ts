import {database} from "@/db/raw";
import {guard} from "@/lib/access-server";
import {reply,bucket} from "@/lib/corporate-server";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const g=await guard(request,"operators","view");if("response" in g)return g.response;
 try{const id=new URL(request.url).searchParams.get('id');if(!id)return reply({error:"Ficheiro não indicado."},400);
 const row=await database().prepare("SELECT key,name,type FROM operator_materials WHERE id=?").bind(id).first<{key:string,name:string,type:string}>();
 if(!row)return reply({error:"O ficheiro não existe."},404);
 const object=await bucket().get(row.key);if(!object)return reply({error:"O ficheiro está indisponível. Tenta novamente."},503);
 const ext=row.name.split('.').pop()?.replace(/[^a-z0-9]/gi,'')||'bin';
 return new Response(object.body,{headers:{'Content-Type':row.type,'Content-Length':String(object.size),'Content-Disposition':`attachment; filename="documento.${ext}"; filename*=UTF-8''${encodeURIComponent(row.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
 }catch(e){console.error('Download operator material',e);return reply({error:"Não foi possível descarregar o ficheiro."},503);}
}
