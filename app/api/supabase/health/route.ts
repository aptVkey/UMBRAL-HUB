import {getAccess,deny} from "@/lib/access-server";
import {database} from "@/db/raw";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
/** Verifica a ligação ao Supabase. Só administradores; nunca devolve valores das chaves. */
export async function GET(request:Request){
 const a=await getAccess(request);if(!a.isAdmin)return deny("Só os administradores podem verificar a ligação ao Supabase.");
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 const configured={url:!!url,publishableKey:!!key,secretKey:!!process.env.SUPABASE_SECRET_KEY,jwksUrl:!!process.env.SUPABASE_JWKS_URL};
 if(!url||!key)return reply({ok:false,configured,error:"Faltam SUPABASE_URL ou SUPABASE_PUBLISHABLE_KEY no ambiente."},503);
 const check=async(path:string,headers:Record<string,string>={})=>{try{const r=await fetch(url+path,{headers:{apikey:key,...headers},signal:AbortSignal.timeout(8000)});return {status:r.status,ok:r.ok}}catch(e){return {status:0,ok:false,error:e instanceof Error?e.message:"erro de rede"}}};
 const jwksUrl=process.env.SUPABASE_JWKS_URL;
 const [auth,jwks]=await Promise.all([check("/auth/v1/health"),jwksUrl?fetch(jwksUrl,{signal:AbortSignal.timeout(8000)}).then(r=>({status:r.status,ok:r.ok})).catch(()=>({status:0,ok:false})):Promise.resolve(null)]);
 const db=await database().prepare("SELECT count(*) AS tabelas FROM pg_tables WHERE schemaname=?").bind("public").first<{tabelas:number}>().then(r=>({ok:true,tabelas:r?.tabelas??0}),e=>({ok:false,error:e instanceof Error?e.message:"erro"}));
 return reply({ok:auth.ok&&db.ok&&(jwks?jwks.ok:true),configured,auth,jwks,database:db});
}
