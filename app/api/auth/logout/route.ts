import {clearCookie} from "@/lib/session";
import {reply,sameOrigin} from "@/lib/auth-server";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 return reply({ok:true},200,{"Set-Cookie":clearCookie(request)});
}
