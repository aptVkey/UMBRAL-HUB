import {getAccess} from "@/lib/access-server";
import {listChangeRequests} from "@/lib/change-request-server";
import type {ChangeStatus} from "@/lib/change-request";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const STATUSES=["pending","approved","rejected"];
export async function GET(request:Request){
 try{
 const access=await getAccess(request);if(!access.authenticated)return reply({error:"Inicia sessão para continuar."},401);if(access.noAccess)return reply({error:"Não tens acesso a esta aplicação."},403);
 const status=new URL(request.url).searchParams.get("status");
 if(status&&!STATUSES.includes(status))return reply({error:"Pedido inválido."},400);
 const requests=await listChangeRequests(access,status as ChangeStatus|undefined);
 const reviewCount=requests.filter(r=>r.status==="pending"&&(access.isAdmin||access.areas[r.area]==="edit")).length;
 return reply({requests,reviewCount});
 }catch(e){console.error("Load change requests",e);return reply({error:"Não foi possível carregar os pedidos. Tenta novamente."},503);}
}
