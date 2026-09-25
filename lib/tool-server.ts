import {database} from "@/db/raw";
import type {Tool,SavedTool} from "./tool";
export type ApplyResult={ok:true,tool:SavedTool}|{ok:false,status:number,error:string};
export async function applyToolSave(t:Tool):Promise<ApplyResult>{
 const db=database(),now=new Date().toISOString(),version=t.version+1,payload=JSON.stringify({...t,version});
 const q=t.version===0?db.prepare("INSERT INTO tools (id,name,payload,version,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(t.id,t.name,payload,version,now):db.prepare("UPDATE tools SET name=?,payload=?,version=?,updated_at=? WHERE id=? AND version=?").bind(t.name,payload,version,now,t.id,t.version);
 const r=await q.run();if(!r.meta.changes)return {ok:false,status:409,error:"Esta ferramenta foi alterada noutra janela. Fecha e volta a abrir o card para veres a versão atual."};
 return {ok:true,tool:{...t,version,updatedAt:now}};
}
export async function applyToolDelete(id:string,version:number):Promise<{ok:true}|{ok:false,status:number,error:string}>{
 const r=await database().prepare("DELETE FROM tools WHERE id=? AND version=?").bind(id,version).run();
 if(!r.meta.changes)return {ok:false,status:409,error:"O card foi alterado ou já não existe. Recarrega a lista."};
 return {ok:true};
}
