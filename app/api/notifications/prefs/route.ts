import {database} from "@/db/raw";
import {getAccess} from "@/lib/access-server";
import {reply,sameOrigin,readJson} from "@/lib/auth-server";
import {prefsSchema,withDefaults} from "@/lib/notification";
import {emailConfigured} from "@/lib/email";
export const dynamic="force-dynamic";
/** Preferências de notificação por email do próprio utilizador. */
export async function GET(request:Request){
 try{const a=await getAccess(request);if(!a.authenticated||a.noAccess)return reply({error:"Inicia sessão para continuar."},401);
 const row=await database().prepare("SELECT prefs FROM notification_prefs WHERE email=?").bind(a.email).first<{prefs:string}>();
 let saved={};try{saved=row?JSON.parse(row.prefs):{}}catch{}
 return reply({prefs:withDefaults(saved),configured:emailConfigured()});}
 catch(e){console.error("Load notification prefs",e);return reply({error:"Não foi possível carregar as preferências."},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 try{const a=await getAccess(request);if(!a.authenticated||a.noAccess)return reply({error:"Inicia sessão para continuar."},401);
 const parsed=prefsSchema.safeParse(await readJson(request));if(!parsed.success)return reply({error:"Dados inválidos."},400);
 await database().prepare("INSERT INTO notification_prefs (email,prefs,updated_at) VALUES (?,?,?) ON CONFLICT (email) DO UPDATE SET prefs=EXCLUDED.prefs,updated_at=EXCLUDED.updated_at").bind(a.email,JSON.stringify(parsed.data),new Date().toISOString()).run();
 return reply({prefs:parsed.data});}
 catch(e){console.error("Save notification prefs",e);return reply({error:"Não foi possível guardar as preferências."},503);}
}
