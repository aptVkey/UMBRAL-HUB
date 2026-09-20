import {database} from "@/db/raw";
import {guard} from "@/lib/access-server";
import {reply,sameOrigin,newToken} from "@/lib/collab-server";
export const dynamic="force-dynamic";
/** Gera um novo link para o afiliado; o anterior deixa de funcionar de imediato. */
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"partnerships","edit");if("response" in g)return g.response;
 try{const {id}=await request.json().catch(()=>({})) as {id?:string};if(!id)return reply({error:"Pedido inválido."},400);
 const token=newToken(),r=await database().prepare("UPDATE collaborators SET share_token=? WHERE id=? AND kind='affiliate'").bind(token,id).run();
 if(!r.meta.changes)return reply({error:"Guarda o afiliado antes de gerar o link."},404);return reply({shareToken:token});}
 catch(e){console.error("Rotate link",e);return reply({error:"Não foi possível gerar o novo link."},503);}
}
