import {database} from "@/db/raw";
export const reply=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{"Cache-Control":"no-store",...headers}});
export const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
export const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export async function readJson(request:Request){try{const t=await request.text();return t.length>10000?null:JSON.parse(t) as Record<string,unknown>}catch{return null}}
export const memberByEmail=(email:string)=>database().prepare("SELECT id,name,role,status FROM team_members WHERE email=?").bind(email).first<{id:string,name:string,role:string,status:string}>();
/** Pequeno atraso para dificultar tentativas em série de adivinhar palavras-passe. */
export const slow=()=>new Promise(r=>setTimeout(r,400));

/**
 * Limite de tentativas falhadas (login e confirmação da palavra-passe atual):
 * 8 por conta ou 30 por IP em 15 minutos. O Supabase só vê o IP do servidor, por isso o limite é feito aqui.
 */
const WINDOW="15 minutes",MAX_PER_EMAIL=8,MAX_PER_IP=30;
export const clientIp=(r:Request)=>(r.headers.get("x-real-ip")||r.headers.get("x-forwarded-for")?.split(",")[0]||"").trim().slice(0,64);
export async function tooManyAttempts(email:string,ip:string){
 const db=database();
 const [byEmail,byIp]=await db.batch([
  db.prepare(`SELECT COUNT(*) AS n FROM login_attempts WHERE email=? AND at>now()-interval '${WINDOW}'`).bind(email),
  db.prepare(`SELECT COUNT(*) AS n FROM login_attempts WHERE ip=? AND ip<>'' AND at>now()-interval '${WINDOW}'`).bind(ip)]);
 const n=(r:{results:unknown[]})=>Number((r.results[0] as {n:number|string}|undefined)?.n||0);
 return n(byEmail)>=MAX_PER_EMAIL||n(byIp)>=MAX_PER_IP;
}
export async function recordFailure(email:string,ip:string){
 const db=database();
 await db.batch([db.prepare("INSERT INTO login_attempts (email,ip) VALUES (?,?)").bind(email,ip),db.prepare("DELETE FROM login_attempts WHERE at<now()-interval '1 day'")]);
}
export const clearFailures=(email:string)=>database().prepare("DELETE FROM login_attempts WHERE email=?").bind(email).run();
export const TOO_MANY="Demasiadas tentativas falhadas. Aguarda 15 minutos e tenta novamente.";
/** Termina todas as sessões emitidas até agora para esta conta. */
export const endSessions=(email:string,at:number)=>database().prepare("UPDATE team_members SET session_epoch=? WHERE email=?").bind(at,email).run();
