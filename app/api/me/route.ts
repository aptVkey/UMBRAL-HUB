import {getAccess} from "@/lib/access-server";
import type {Me} from "@/lib/access";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 try{const a=await getAccess(request);const me:Me={email:a.email,name:a.name,role:a.role,isAdmin:a.isAdmin,implicit:a.implicit,noAccess:a.noAccess,areas:a.areas,propertyIds:a.propertyIds};
 return Response.json({me},{headers:{"Cache-Control":"no-store"}});}
 catch(e){console.error("Load me",e);return Response.json({error:"Não foi possível verificar o teu acesso. Tenta novamente."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
