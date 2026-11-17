import {MAX_CONTRACT_SIZE,CONTRACT_ACCEPT,checkContract} from "./corporate";
export {MAX_CONTRACT_SIZE,CONTRACT_ACCEPT,checkContract};
export type Material={id:string;name:string;size:number;type:string;uploadedBy:string;uploadedAt:string};
/** Materiais aceitam também folhas de cálculo (Excel); os contratos continuam só PDF, Word e imagem. */
export const MATERIAL_ACCEPT=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg";
export function checkMaterial(file:{size:number;name:string}){if(file.size===0)return "O ficheiro está vazio.";if(file.size>MAX_CONTRACT_SIZE)return "O ficheiro pode ter no máximo 10 MB.";if(!/\.(pdf|docx?|xlsx?|png|jpe?g)$/i.test(file.name))return "Utiliza PDF, Word, Excel, PNG ou JPG.";return "";}
