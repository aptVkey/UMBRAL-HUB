import {database} from "@/db/raw";
export type CatalogAmenity = {id:string,label:string,group:string};
type Row = {id:string,label:string,group_name:string};
type PropertyRow = {id:string,payload:string,version:number};
type Amenity = {id:string,label:string,group:string,enabled:boolean,rules:string,custom:boolean};

export async function listCatalog():Promise<CatalogAmenity[]> {
 const {results} = await database().prepare("SELECT id,label,group_name FROM custom_amenities ORDER BY lower(label)").all<Row>();
 return results.map(r=>({id:r.id,label:r.label,group:r.group_name}));
}

/** Junta ao array de comodidades de um alojamento as do catálogo que ainda não tem, por selecionar. Só usado para apresentação (GET); nada é escrito. */
export function mergeCatalog(amenities:Amenity[],catalog:CatalogAmenity[]):Amenity[] {
 const have = new Set(amenities.map(a=>a.id));
 const missing = catalog.filter(c=>!have.has(c.id));
 if(!missing.length)return amenities;
 return [...amenities,...missing.map(c=>({id:c.id,label:c.label,group:c.group,enabled:false,rules:"",custom:true}))];
}

/** Publica no catálogo partilhado as comodidades personalizadas novas de um alojamento acabado de guardar. */
export async function publishNewCustomAmenities(amenities:Amenity[]):Promise<void> {
 const custom = amenities.filter(a=>a.custom);
 if(!custom.length)return;
 const db=database();
 const {results:existing} = await db.prepare("SELECT id FROM custom_amenities WHERE id IN (SELECT jsonb_array_elements_text(?::jsonb))").bind(JSON.stringify(custom.map(a=>a.id))).all<{id:string}>();
 const have = new Set(existing.map(r=>r.id));
 const toInsert = custom.filter(a=>!have.has(a.id));
 if(!toInsert.length)return;
 const now = new Date().toISOString();
 await db.batch(toInsert.map(a=>db.prepare("INSERT INTO custom_amenities (id,label,group_name,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT (id) DO NOTHING").bind(a.id,a.label,a.group,now,now)));
}

async function propagate(id:string,transform:(a:Amenity)=>Amenity|null):Promise<void> {
 const db=database();
 const {results:props} = await db.prepare("SELECT id,payload,version FROM properties").all<PropertyRow>();
 const stmts=[];
 for(const p of props){
  const parsed = JSON.parse(p.payload);
  const list:Amenity[] = parsed.amenities||[];
  if(!list.some(a=>a.id===id))continue;
  let changed=false;
  const next:Amenity[]=[];
  for(const a of list){
   if(a.id!==id){next.push(a);continue}
   const out = transform(a);
   if(out===null){changed=true;continue}
   if(out.label!==a.label||out.group!==a.group)changed=true;
   next.push(out);
  }
  if(!changed)continue;
  const version=p.version+1;
  stmts.push(db.prepare("UPDATE properties SET payload=?,version=?,updated_at=? WHERE id=? AND version=?").bind(JSON.stringify({...parsed,amenities:next,version}),version,new Date().toISOString(),p.id,p.version));
 }
 if(stmts.length)await db.batch(stmts);
}

/** Renomeia/muda a categoria de uma comodidade personalizada no catálogo e em todos os alojamentos que a têm. */
export async function renameCatalogAmenity(id:string,label:string,group:string):Promise<{ok:true}|{ok:false,status:number,error:string}> {
 const db=database();
 const row=await db.prepare("SELECT id FROM custom_amenities WHERE id=?").bind(id).first();
 if(!row)return {ok:false,status:404,error:"Esta comodidade personalizada já não existe."};
 await db.prepare("UPDATE custom_amenities SET label=?,group_name=?,updated_at=? WHERE id=?").bind(label,group,new Date().toISOString(),id).run();
 await propagate(id,a=>({...a,label,group}));
 return {ok:true};
}

/** Elimina uma comodidade personalizada do catálogo e de todos os alojamentos, mesmo onde estava selecionada. */
export async function deleteCatalogAmenity(id:string):Promise<{ok:true}|{ok:false,status:number,error:string}> {
 const db=database();
 const row=await db.prepare("SELECT id FROM custom_amenities WHERE id=?").bind(id).first();
 if(!row)return {ok:false,status:404,error:"Esta comodidade personalizada já não existe."};
 await db.prepare("DELETE FROM custom_amenities WHERE id=?").bind(id).run();
 await propagate(id,()=>null);
 return {ok:true};
}
