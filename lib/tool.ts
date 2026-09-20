import {z} from "zod";
import {newId} from "./property";
export const toolSchema=z.object({
 id:z.string().uuid(),version:z.number().int().min(0),
 name:z.string().trim().min(1,"Preenche o nome da ferramenta.").max(120,"Máximo de 120 caracteres."),
 description:z.string().trim().max(500,"Máximo de 500 caracteres."),
 url:z.string().trim().min(1,"Preenche o link de acesso.").max(500,"Máximo de 500 caracteres.").refine(v=>/^https?:\/\/[^\s/$.?#][^\s]*$/i.test(v),"Usa um endereço completo, a começar por https://.")
});
export type Tool=z.infer<typeof toolSchema>;
export type SavedTool=Tool&{updatedAt:string};
export const newTool=():Tool=>({id:newId(),version:0,name:"",description:"",url:""});
export function hostOf(url:string){try{return new URL(url).hostname.replace(/^www\./,"")}catch{return url}}
