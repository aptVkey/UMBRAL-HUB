import {database} from "@/db/raw";
import {corporateSchema,checkContract} from "@/lib/corporate";
import {guard,deny,scopeOk,scopeVisible,linkedProperties} from "@/lib/access-server";
import {reply,sameOrigin,bucket,present,findCorporate,boundedForm,fileType,type CorporateRow,type StoredContract} from "@/lib/corporate-server";
export const dynamic="force-dynamic";
export async function GET(request:Request){const g=await guard(request,"corporates","view");if("response" in g)return g.response;const access=g.access;try{const db=database();const [records,links]=await db.batch([db.prepare("SELECT * FROM corporates ORDER BY name COLLATE NOCASE"),db.prepare("SELECT corporate_id,property_id FROM corporate_properties")]);const grouped=new Map<string,string[]>();for(const link of links.results as {corporate_id:string,property_id:string}[]){grouped.set(link.corporate_id,[...(grouped.get(link.corporate_id)||[]),link.property_id]);}return reply({corporates:(records.results as CorporateRow[]).map(r=>present(r,grouped.get(r.id)||[])).filter(c=>scopeVisible(access,c.propertyIds))});}catch(e){console.error("Load corporates",e);return reply({error:"Não foi possível carregar as empresas. Tenta novamente."},503);}}
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:"Pedido não autorizado."},403);
 const g=await guard(request,"corporates","edit");if("response" in g)return g.response;const access=g.access;
 let uploadedKey:string|null=null;let committed=false;
 try{
 let form:FormData;try{form=await boundedForm(request)}catch(e){return reply({error:e instanceof Error&&e.message==='BODY_TOO_LARGE'?"O contrato pode ter no máximo 10 MB.":"Não foi possível ler os dados enviados."},400);}
 const raw=form.get('payload');if(typeof raw!=='string'||raw.length>200000)return reply({error:"Ficha inválida ou demasiado extensa."},400);
 let input:unknown;try{input=JSON.parse(raw)}catch{return reply({error:"Ficha inválida."},400)}
 const result=corporateSchema.safeParse(input);if(!result.success)return reply({error:"Revê os campos assinalados.",issues:result.error.issues},400);
 const p=result.data,db=database();const old=await findCorporate(p.id);
 if(!scopeOk(access,p.propertyIds)||(old&&!scopeOk(access,await linkedProperties("corporate_properties","corporate_id",p.id))))return deny("O teu acesso está limitado a alguns alojamentos.");
 if((p.version===0&&old)||(p.version>0&&(!old||old.version!==p.version)))return reply({error:"Esta empresa foi alterada noutra janela. As tuas alterações continuam aqui; copia-as antes de reabrir a ficha atualizada."},409);
 if(p.propertyIds.length){const {results}=await db.prepare('SELECT id FROM properties').all<{id:string}>();const available=new Set(results.map(r=>r.id));if(p.propertyIds.some(id=>!available.has(id)))return reply({error:"A lista de alojamentos mudou. Atualiza a lista no separador Alojamentos e revê a seleção."},409);}
 const upload=form.get('contract');let contract:StoredContract|null=old?.contract?JSON.parse(old.contract):null;const oldContract=contract;
 if(form.get('removeContract')==='true')contract=null;
 if(upload instanceof File){const error=checkContract(upload);if(error)return reply({error},400);const mime=await fileType(upload);if(!mime)return reply({error:"O conteúdo do ficheiro não corresponde ao formato indicado. Seleciona um contrato válido."},400);
 uploadedKey=`corporate-contracts/${p.id}/${crypto.randomUUID()}`;const name=upload.name.replace(/[\/\\\x00-\x1F\x7F]/g,'_').slice(0,200)||'contrato';
 await bucket().put(uploadedKey,upload.stream(),{httpMetadata:{contentType:mime}});
 contract={key:uploadedKey,name,size:upload.size,type:mime,uploadedAt:new Date().toISOString()};
 }
 const now=new Date().toISOString(),version=p.version+1,token=crypto.randomUUID(),payload=JSON.stringify({...p,version}),serialized=contract?JSON.stringify(contract):null;
 const first=p.version===0?db.prepare("INSERT INTO corporates (id,name,payload,version,updated_at,last_write_id,contract) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(p.id,p.name,payload,version,now,token,serialized):db.prepare("UPDATE corporates SET name=?,payload=?,version=?,updated_at=?,last_write_id=?,contract=? WHERE id=? AND version=?").bind(p.name,payload,version,now,token,serialized,p.id,p.version);
 const statements=[first,db.prepare("DELETE FROM corporate_properties WHERE corporate_id=? AND EXISTS (SELECT 1 FROM corporates WHERE id=? AND last_write_id=?)").bind(p.id,p.id,token),...p.propertyIds.map(id=>db.prepare("INSERT INTO corporate_properties (corporate_id,property_id) SELECT ?,? WHERE EXISTS (SELECT 1 FROM corporates WHERE id=? AND last_write_id=?)").bind(p.id,id,p.id,token))];
 const saved=await db.batch(statements);if(!saved[0].meta.changes){if(uploadedKey)await bucket().delete(uploadedKey);return reply({error:"Esta empresa foi alterada noutra janela. Reabre a ficha atualizada antes de voltar a guardar."},409);}
 committed=true;
 if(oldContract&&oldContract.key!==contract?.key){try{await bucket().delete(oldContract.key)}catch(e){console.error("Remove superseded contract",e)}}
 return reply({corporate:present({id:p.id,payload,version,updated_at:now,contract:serialized,last_write_id:token},p.propertyIds)},p.version===0?201:200);
 }catch(e){if(uploadedKey&&!committed){try{await bucket().delete(uploadedKey)}catch{}}console.error("Save corporate",e);return reply({error:"Não foi possível guardar a empresa e o contrato. Mantivemos as tuas alterações; confirma os alojamentos selecionados e tenta novamente."},503);}
}
