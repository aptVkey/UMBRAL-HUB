import {getAccess} from "@/lib/access-server";
import {disconnect} from "@/lib/google-server";
export const dynamic="force-dynamic";
/** Desliga a conta Google (revoga e apaga o token). As correspondências e as reviews já importadas mantêm-se. */
export async function DELETE(request:Request){
 if(request.headers.get("origin")&&request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Pedido não autorizado."},{status:403});
 const a=await getAccess(request);if(!a.isAdmin)return Response.json({error:"Só os administradores podem gerir integrações."},{status:403});
 try{await disconnect();return Response.json({ok:true})}catch(e){console.error("Disconnect google",e);return Response.json({error:"Não foi possível desligar a conta."},{status:503})}
}
