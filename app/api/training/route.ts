import {database} from '@/db/raw';
import {trainingSchema} from '@/lib/training';
import {trainingSeed} from '@/lib/training-seed';
import {guard} from '@/lib/access-server';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){const g=await guard(request,"training","view");if("response" in g)return g.response;try{const row=await database().prepare('SELECT payload,version FROM training_workspace WHERE id=?').bind('umbral').first<{payload:string,version:number}>();return reply({training:row?{...JSON.parse(row.payload),version:row.version}:trainingSeed()});}catch(e){console.error('Training read',e);return reply({error:'Não foi possível carregar a formação. Tenta novamente.'},503)}}
export async function PUT(request:Request){const g=await guard(request,"training","edit");if("response" in g)return g.response;try{
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return reply({error:'Origem inválida.'},403);
 const limit=1500000;if(Number(request.headers.get('content-length'))>limit)return reply({error:'O conteúdo excede o limite de armazenamento desta área.'},413);
 if(!request.body)return reply({error:'Pedido vazio.'},400);const reader=request.body.getReader();let size=0;const chunks:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();return reply({error:'O conteúdo excede o limite de armazenamento desta área.'},413)}chunks.push(value)}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}let input;try{input=JSON.parse(new TextDecoder().decode(bytes))}catch{return reply({error:'Dados inválidos.'},400)}
 const checked=trainingSchema.safeParse(input);if(!checked.success)return reply({error:checked.error.issues[0].message},400);
 const data=checked.data,version=data.version+1,now=new Date().toISOString();const payload=JSON.stringify({...data,version});
 const result=data.version===0?await database().prepare('INSERT INTO training_workspace (id,payload,version,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING').bind('umbral',payload,version,now).run():await database().prepare('UPDATE training_workspace SET payload=?,version=?,updated_at=? WHERE id=? AND version=?').bind(payload,version,now,'umbral',data.version).run();
 if(!result.meta.changes)return reply({error:'A formação foi alterada noutra sessão. As tuas alterações continuam no formulário. Copia-as antes de sair e recarrega a área para consultar a versão mais recente.'},409);
 return reply({training:{...data,version}});
 }catch(e){console.error('Training write',e);return reply({error:'Não foi possível guardar. As alterações foram mantidas no formulário.'},503)}}
