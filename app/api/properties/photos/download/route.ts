import {zipSync} from "fflate";
import {database} from "@/db/raw";
import {guard,deny,propertyAllowed} from "@/lib/access-server";
import {bucket} from "@/lib/corporate-server";
import {inParallel} from "@/lib/parallel";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const MAX_PHOTOS=300,MAX_TOTAL_BYTES=300*1024*1024,TOO_BIG="TOO_BIG";
/** Nome seguro para pasta/ficheiro dentro do zip, em qualquer sistema operativo. */
function safeName(name:string,fallback:string){const cleaned=name.replace(/[\\/:*?"<>|\x00-\x1F]/g," ").replace(/\s+/g," ").trim();return cleaned||fallback}
type Row={id:string,room_id:string,key:string,name:string};
/** Descarrega todas as fotos de um alojamento num único .zip, organizado por tipologia. */
export async function GET(request:Request){
 const g=await guard(request,"properties","view");if("response" in g)return g.response;
 try{
 const propertyId=new URL(request.url).searchParams.get("propertyId");if(!propertyId)return reply({error:"Alojamento não indicado."},400);
 if(!propertyAllowed(g.access,propertyId))return deny("O teu acesso está limitado a alguns alojamentos.");
 const db=database();
 const propRow=await db.prepare("SELECT payload FROM properties WHERE id=?").bind(propertyId).first<{payload:string}>();
 if(!propRow)return reply({error:"O alojamento já não existe."},404);
 const property=JSON.parse(propRow.payload) as {name:string,rooms:{id:string,name:string}[]};
 const {results:photoRows}=await db.prepare("SELECT id,room_id,key,name FROM property_room_photos WHERE property_id=? ORDER BY room_id,position").bind(propertyId).all<Row>();
 if(!photoRows.length)return reply({error:"Ainda não há fotos para descarregar."},400);
 if(photoRows.length>MAX_PHOTOS)return reply({error:`Há demasiadas fotos para descarregar de uma vez (máximo ${MAX_PHOTOS}).`},400);
 const roomName=new Map(property.rooms.map(r=>[r.id,r.name]));
 const usedNames=new Map<string,Set<string>>(); // pasta -> nomes de ficheiro já usados nela
 const files:Record<string,Uint8Array>={};
 let total=0;
 const year=new Date().getFullYear();
 const zipName=safeName(`${property.name} Fotos ${year}`,`Fotos ${year}`);
 const buffers:(Uint8Array|undefined)[]=new Array(photoRows.length);
 try{await inParallel(photoRows,6,async(row,i)=>{
  const object=await bucket().get(row.key);
  if(!object)return; // ficheiro já não existe no Storage; ignora em vez de falhar o download todo
  const buf=new Uint8Array(await new Response(object.body).arrayBuffer());
  total+=buf.byteLength;
  if(total>MAX_TOTAL_BYTES)throw new Error(TOO_BIG);
  buffers[i]=buf;
 })}catch(e){if(e instanceof Error&&e.message===TOO_BIG)return reply({error:"O conjunto de fotos é demasiado grande para descarregar de uma vez."},400);throw e}
 for(const [i,row] of photoRows.entries()){
  const buf=buffers[i];if(!buf)continue;
  const folder=safeName(roomName.get(row.room_id)||"","Tipologia sem nome");
  const used=usedNames.get(folder)||new Set<string>();
  let filename=safeName(row.name,"foto.jpg");
  if(used.has(filename)){
   const i=filename.lastIndexOf("."),base=i>0?filename.slice(0,i):filename,ext=i>0?filename.slice(i):"";
   let n=2;while(used.has(`${base} (${n})${ext}`))n++;filename=`${base} (${n})${ext}`;
  }
  used.add(filename);usedNames.set(folder,used);
  files[`${zipName}/${folder}/${filename}`]=buf;
 }
 if(!Object.keys(files).length)return reply({error:"As fotos já não estão disponíveis. Tenta novamente."},404);
 const zipped=zipSync(files,{level:0}); // JPEG e PNG já vêm comprimidos: recomprimir só gastava tempo
 return new Response(zipped,{headers:{"Content-Type":"application/zip","Content-Disposition":`attachment; filename="${zipName}.zip"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch(e){console.error("Download room photos zip",e);return reply({error:"Não foi possível preparar o download. Tenta novamente."},503);}
}
