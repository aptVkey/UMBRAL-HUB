import {getAccess} from "@/lib/access-server";
import type {Me} from "@/lib/access";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 try{const a=await getAccess(request);
 if(!a.authenticated)return Response.json({me:null,authenticated:false,setupRequired:a.setupRequired},{headers:{"Cache-Control":"no-store"}});
 const me:Me={email:a.email,name:a.name,role:a.role,isAdmin:a.isAdmin,implicit:false,noAccess:a.noAccess,areas:a.areas,propertyIds:a.propertyIds,toolCategories:a.toolCategories};
 return Response.json({me,authenticated:true,setupRequired:false},{headers:{"Cache-Control":"no-store"}});}
 catch(e){console.error("Load me",e);return Response.json({error:"Não foi possível verificar o teu acesso. Tenta novamente."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
