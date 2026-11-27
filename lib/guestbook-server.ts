import {database} from "@/db/raw";
import {getAccess,propertyAllowed,type Access} from "./access-server";
import {propertySlug} from "./property";
import {cityKey,cityRecsSchema,type CityRecs} from "./guestbook";

/** Alojamento pelo endereço público ("huma-by-umbral"). */
export async function findPropertyBySlug(slug:string){
 const {results}=await database().prepare("SELECT id,name FROM properties ORDER BY lower(name),id").all<{id:string,name:string}>();
 return results.find(r=>propertySlug(r.name)===slug.toLowerCase())?.id||null;
}
/** Quem tem sessão e acesso ao alojamento vê o livro mesmo antes de publicado (pré-visualização). */
export async function staffPreview(request:Request,propertyId:string){
 const a:Access=await getAccess(request);
 return a.authenticated&&!a.noAccess&&a.areas.properties!=="none"&&propertyAllowed(a,propertyId);
}
export async function loadRecs(city:string):Promise<CityRecs>{
 const key=cityKey(city);if(!key)return {version:0,items:[]};
 const row=await database().prepare("SELECT payload,version FROM guestbook_recs WHERE city_key=?").bind(key).first<{payload:string,version:number}>();
 if(!row)return {version:0,items:[]};
 const parsed=cityRecsSchema.safeParse({...JSON.parse(row.payload),version:row.version});
 return parsed.success?parsed.data:{version:row.version,items:[]};
}
