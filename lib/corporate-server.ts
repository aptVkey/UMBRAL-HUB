import {database,storage} from "@/db/raw";
import {checkContract} from "./corporate";
import type {Corporate,ContractInfo,SavedCorporate} from "./corporate";
export type StoredContract=ContractInfo&{key:string};
export type CorporateRow={id:string,payload:string,version:number,updated_at:string,contract:string|null,last_write_id:string};
export const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export const sameOrigin=(r:Request)=>!r.headers.get("origin")||r.headers.get("origin")===new URL(r.url).origin;
export function bucket(){return storage();}
export function present(row:CorporateRow,propertyIds:string[]):SavedCorporate{const c=row.contract?JSON.parse(row.contract) as StoredContract:null;return {...JSON.parse(row.payload) as Corporate,id:row.id,version:row.version,updatedAt:row.updated_at,propertyIds,contract:c?{name:c.name,size:c.size,type:c.type,uploadedAt:c.uploadedAt}:null};}
export async function findCorporate(id:string){return database().prepare("SELECT * FROM corporates WHERE id=?").bind(id).first<CorporateRow>();}
export async function boundedForm(request:Request){const limit=11*1024*1024;if(Number(request.headers.get("content-length"))>limit)throw new Error("BODY_TOO_LARGE");if(!request.body)throw new Error("INVALID_FORM");const reader=request.body.getReader();const chunks:Uint8Array[]=[];let length=0;while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw new Error("BODY_TOO_LARGE");}chunks.push(value);}const buffer=new Uint8Array(length);let offset=0;for(const c of chunks){buffer.set(c,offset);offset+=c.length;}return new Response(buffer,{headers:{"Content-Type":request.headers.get("content-type")||""}}).formData();}
export async function fileType(file:File){const b=new Uint8Array(await file.slice(0,16).arrayBuffer()),ext=file.name.split('.').pop()?.toLowerCase();const matches=(a:number[])=>a.every((x,i)=>b[i]===x);
 if(ext==='pdf'&&matches([37,80,68,70,45]))return 'application/pdf';
 if(ext==='doc'&&matches([208,207,17,224,161,177,26,225]))return 'application/msword';
 if(ext==='docx'&&matches([80,75,3,4]))return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
 if(ext==='png'&&matches([137,80,78,71,13,10,26,10]))return 'image/png';
 if((ext==='jpg'||ext==='jpeg')&&matches([255,216,255]))return 'image/jpeg';
 return null;
}
export type ApplyCorporateResult={ok:true,corporate:SavedCorporate}|{ok:false,status:number,error:string};
/**
 * Grava uma empresa (criação ou atualização), com o contrato opcional. Partilhado pela rota
 * direta (nível "edit") e pela aprovação de pedidos de alteração (aí sem ficheiro: mantém o
 * contrato atual, porque um contribuidor não pode propor anexos).
 */
export async function applyCorporateSave(p:Corporate,upload:File|null,removeContract:boolean):Promise<ApplyCorporateResult>{
 let uploadedKey:string|null=null,committed=false;
 try{
 const db=database(),old=await findCorporate(p.id);
 if((p.version===0&&old)||(p.version>0&&(!old||old.version!==p.version)))return {ok:false,status:409,error:"Esta empresa foi alterada noutra janela. As tuas alterações continuam aqui; copia-as antes de reabrir a ficha atualizada."};
 if(p.propertyIds.length){const {results}=await db.prepare('SELECT id FROM properties').all<{id:string}>();const available=new Set(results.map(r=>r.id));if(p.propertyIds.some(id=>!available.has(id)))return {ok:false,status:409,error:"A lista de alojamentos mudou. Atualiza a lista no separador Alojamentos e revê a seleção."};}
 let contract:StoredContract|null=old?.contract?JSON.parse(old.contract):null;const oldContract=contract;
 if(removeContract)contract=null;
 if(upload){const error=checkContract(upload);if(error)return {ok:false,status:400,error};const mime=await fileType(upload);if(!mime)return {ok:false,status:400,error:"O conteúdo do ficheiro não corresponde ao formato indicado. Seleciona um contrato válido."};
  uploadedKey=`corporate-contracts/${p.id}/${crypto.randomUUID()}`;const name=upload.name.replace(/[\/\\\x00-\x1F\x7F]/g,'_').slice(0,200)||'contrato';
  await bucket().put(uploadedKey,upload.stream(),{httpMetadata:{contentType:mime}});
  contract={key:uploadedKey,name,size:upload.size,type:mime,uploadedAt:new Date().toISOString()};
 }
 const now=new Date().toISOString(),version=p.version+1,token=crypto.randomUUID(),payload=JSON.stringify({...p,version}),serialized=contract?JSON.stringify(contract):null;
 const first=p.version===0?db.prepare("INSERT INTO corporates (id,name,payload,version,updated_at,last_write_id,contract) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(p.id,p.name,payload,version,now,token,serialized):db.prepare("UPDATE corporates SET name=?,payload=?,version=?,updated_at=?,last_write_id=?,contract=? WHERE id=? AND version=?").bind(p.name,payload,version,now,token,serialized,p.id,p.version);
 const statements=[first,db.prepare("DELETE FROM corporate_properties WHERE corporate_id=? AND EXISTS (SELECT 1 FROM corporates WHERE id=? AND last_write_id=?)").bind(p.id,p.id,token),...p.propertyIds.map(id=>db.prepare("INSERT INTO corporate_properties (corporate_id,property_id) SELECT ?,? WHERE EXISTS (SELECT 1 FROM corporates WHERE id=? AND last_write_id=?)").bind(p.id,id,p.id,token))];
 const saved=await db.batch(statements);if(!saved[0].meta.changes){if(uploadedKey)await bucket().delete(uploadedKey);return {ok:false,status:409,error:"Esta empresa foi alterada noutra janela. Reabre a ficha atualizada antes de voltar a guardar."};}
 committed=true;
 if(oldContract&&oldContract.key!==contract?.key){try{await bucket().delete(oldContract.key)}catch(e){console.error("Remove superseded contract",e)}}
 return {ok:true,corporate:present({id:p.id,payload,version,updated_at:now,contract:serialized,last_write_id:token},p.propertyIds)};
 }catch(e){if(uploadedKey&&!committed){try{await bucket().delete(uploadedKey)}catch{}}console.error("Save corporate",e);return {ok:false,status:503,error:"Não foi possível guardar a empresa e o contrato. Mantivemos as tuas alterações; confirma os alojamentos selecionados e tenta novamente."};}
}
/**
 * Elimina uma empresa: liga-se aos alojamentos e ao contrato guardado no Storage, ambos
 * removidos com o registo. Partilhado pela rota direta e pela aprovação de um pedido de eliminação.
 */
export async function applyCorporateDelete(id:string,version:number):Promise<{ok:true}|{ok:false,status:number,error:string}>{
 const db=database(),old=await findCorporate(id);
 if(!old)return {ok:false,status:404,error:"A empresa já não existe."};
 if(old.version!==version)return {ok:false,status:409,error:"A ficha foi alterada. Reabre-a antes de eliminar."};
 const contract:StoredContract|null=old.contract?JSON.parse(old.contract):null;
 const [del]=await db.batch([db.prepare("DELETE FROM corporates WHERE id=? AND version=?").bind(id,version),db.prepare("DELETE FROM corporate_properties WHERE corporate_id=?").bind(id)]);
 if(!del.meta.changes)return {ok:false,status:409,error:"A ficha foi alterada. Reabre-a antes de eliminar."};
 if(contract){try{await bucket().delete(contract.key)}catch(e){console.error("Remove contract on corporate delete",e)}}
 return {ok:true};
}
