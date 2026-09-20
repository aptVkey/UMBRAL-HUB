import {z} from 'zod';
const id=z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const short=z.string().trim().max(180), long=z.string().max(5000);
export const phases=['Início do turno','Durante o turno','Fecho do turno'] as const;
export const departmentSchema=z.object({id,name:short.min(1,'Indica o nome do departamento.'),description:long});
export const routineSchema=z.object({id,phase:z.enum(phases),title:short.min(1,'Dá um título à tarefa.'),details:long});
export const roleSchema=z.object({id,departmentId:id,parentId:id.nullable(),name:short.min(1,'Indica o nome do cargo.'),mission:long,responsibilities:long,routine:z.array(routineSchema).max(80)});
export const sopSchema=z.object({id,roleId:id,title:short.min(1,'Indica o título do procedimento.'),code:short,status:z.enum(['Rascunho','Validado','Arquivado']),purpose:long,frequency:short,scope:long,resources:long,steps:z.array(z.object({id,title:short.min(1,'Dá um título a cada passo.'),details:long})).max(80),result:long,exceptions:long,owner:short,reviewDate:z.string().refine(v=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v),'Data inválida.'),revision:z.number().int().min(1),updatedAt:z.string()}).superRefine((s,c)=>{if(s.status==='Validado'&&(!s.purpose.trim()||!s.steps.length||!s.owner.trim()||!s.result.trim()||s.steps.some(x=>!x.details.trim())))c.addIssue({code:'custom',path:['status'],message:'Para validar, preenche objetivo, responsável, resultado esperado e pelo menos um passo com instruções.'});});
export const trainingSchema=z.object({version:z.number().int().nonnegative(),departments:z.array(departmentSchema).max(60),roles:z.array(roleSchema).max(300),sops:z.array(sopSchema).max(1000)}).superRefine((t,c)=>{
 const issue=(message:string)=>c.addIssue({code:'custom',message});
 for(const list of [t.departments,t.roles,t.sops])if(new Set(list.map(x=>x.id)).size!==list.length)issue('Existem identificadores repetidos.');
 const departments=new Set(t.departments.map(d=>d.id)),roles=new Map(t.roles.map(r=>[r.id,r]));
 for(const r of t.roles){if(!departments.has(r.departmentId))issue('Departamento inexistente.');if(r.parentId&&roles.get(r.parentId)?.departmentId!==r.departmentId)issue('O superior deve pertencer ao mesmo departamento.');let parent=r.parentId;const seen=new Set([r.id]);while(parent){if(seen.has(parent)){issue('A hierarquia de cargos não pode formar um ciclo.');break}seen.add(parent);parent=roles.get(parent)?.parentId||null;}if(new Set(r.routine.map(x=>x.id)).size!==r.routine.length)issue('Tarefas repetidas.');}
 for(const s of t.sops){if(!roles.has(s.roleId))issue('Cargo inexistente.');if(new Set(s.steps.map(x=>x.id)).size!==s.steps.length)issue('Passos repetidos.');}
});
export type Department=z.infer<typeof departmentSchema>;
export type TrainingRole=z.infer<typeof roleSchema>;
export type SOP=z.infer<typeof sopSchema>;
export type Training=z.infer<typeof trainingSchema>;
export function uid(){return typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():`id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`}
export function blankSOP(roleId:string):SOP{return {id:uid(),roleId,title:'',code:'',status:'Rascunho',purpose:'',frequency:'Diária',scope:'',resources:'',steps:[],result:'',exceptions:'',owner:'',reviewDate:'',revision:1,updatedAt:''}}
export function descendants(roles:TrainingRole[],roleId:string):Set<string>{const result=new Set([roleId]);let changed=true;while(changed){changed=false;for(const r of roles)if(r.parentId&&result.has(r.parentId)&&!result.has(r.id)){result.add(r.id);changed=true}}return result}
export function roleTree(roles:TrainingRole[],departmentId:string){const list=roles.filter(r=>r.departmentId===departmentId),out:{role:TrainingRole,depth:number}[]=[];function walk(parent:string|null,depth:number){for(const role of list.filter(r=>r.parentId===parent)){out.push({role,depth});walk(role.id,depth+1)}}walk(null,0);return out}
