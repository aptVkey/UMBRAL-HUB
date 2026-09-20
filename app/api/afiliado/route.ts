import {database} from "@/db/raw";
import {reply,resultsFor} from "@/lib/collab-server";
export const dynamic="force-dynamic";
/** Rota pública: o token identifica um único afiliado e só devolve os dados do seu gráfico. */
export async function GET(request:Request){
 const token=new URL(request.url).searchParams.get("token")||"";
 if(!/^[A-Za-z0-9_-]{20,64}$/.test(token))return reply({error:"Link inválido."},404);
 try{const row=await database().prepare("SELECT id,payload FROM collaborators WHERE share_token=? AND kind='affiliate'").bind(token).first<{id:string,payload:string}>();
 if(!row)return reply({error:"Este link não existe ou foi substituído. Pede um novo link à Umbral."},404);
 const p=JSON.parse(row.payload) as {name:string,promoCode:string,discount:string,status:string};
 return reply({affiliate:{name:p.name,promoCode:p.promoCode,discount:p.discount,status:p.status},results:await resultsFor(row.id)});}
 catch(e){console.error("Affiliate report",e);return reply({error:"Não foi possível carregar os resultados. Tenta novamente."},503);}
}
