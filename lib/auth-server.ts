import {database} from "@/db/raw";
export const reply=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{"Cache-Control":"no-store",...headers}});
export const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
export const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export async function readJson(request:Request){try{const t=await request.text();return t.length>10000?null:JSON.parse(t) as Record<string,unknown>}catch{return null}}
export const memberByEmail=(email:string)=>database().prepare("SELECT id,name,role,status FROM team_members WHERE email=?").bind(email).first<{id:string,name:string,role:string,status:string}>();
/** Pequeno atraso para dificultar tentativas em série de adivinhar palavras-passe. */
export const slow=()=>new Promise(r=>setTimeout(r,400));
