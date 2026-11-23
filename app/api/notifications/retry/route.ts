import {retryFailed} from "@/lib/notify-server";
export const dynamic="force-dynamic";
/**
 * Reenvio dos emails que falharam (chamado pelo Cron da Vercel, ver vercel.json).
 * A Vercel envia "Authorization: Bearer <CRON_SECRET>" quando a variável CRON_SECRET está definida.
 */
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return Response.json({error:"Não autorizado."},{status:401});
 try{return Response.json(await retryFailed(),{headers:{"Cache-Control":"no-store"}})}
 catch(e){console.error("Retry notifications",e);return Response.json({error:"Falhou."},{status:503})}
}
