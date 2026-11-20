/**
 * Cifra de segredos de integrações (tokens OAuth) com AES-256-GCM.
 * A chave vem de INTEGRATIONS_KEY (32 bytes em base64), definida só no servidor (Vercel).
 * Formato guardado: "v1.<iv base64>.<dados cifrados base64>".
 */
const b64=(u:Uint8Array)=>Buffer.from(u).toString("base64");
const unb64=(s:string)=>new Uint8Array(Buffer.from(s,"base64"));
async function key(){
 const raw=process.env.INTEGRATIONS_KEY;
 if(!raw)throw new Error("INTEGRATIONS_KEY não está definida no servidor.");
 const bytes=unb64(raw);if(bytes.length!==32)throw new Error("INTEGRATIONS_KEY tem de ter 32 bytes em base64.");
 return crypto.subtle.importKey("raw",bytes,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}
export async function seal(plain:string):Promise<string>{
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},await key(),new TextEncoder().encode(plain)));
 return `v1.${b64(iv)}.${b64(data)}`;
}
export async function open(sealed:string):Promise<string>{
 const [v,iv,data]=sealed.split(".");if(v!=="v1"||!iv||!data)throw new Error("Segredo em formato desconhecido.");
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(iv)},await key(),unb64(data)));
}
