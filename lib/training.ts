import {z} from 'zod';
const id=z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const short=z.string().trim().max(180), long=z.string().max(5000);
export const phases=['Início do turno','Durante o turno','Fecho do turno'] as const;
export const departmentSchema=z.object({id,name:short.min(1,'Indica o nome da área de atuação.'),description:long});
/** Objetivos de formação por período desde a entrada na função. */
export const GOAL_PERIODS=[{key:'week1',label:'Semana 1',horizon:'Até ao dia 7'},{key:'week2',label:'Semana 2',horizon:'Até ao dia 14'},{key:'week3',label:'Semana 3',horizon:'Até ao dia 21'},{key:'week4',label:'Semana 4',horizon:'Até ao dia 28'},{key:'day60',label:'60 dias',horizon:'Até ao dia 60'},{key:'day90',label:'90 dias',horizon:'Até ao dia 90'}] as const;
export type GoalKey=typeof GOAL_PERIODS[number]['key'];
export const emptyGoals=()=>Object.fromEntries(GOAL_PERIODS.map(g=>[g.key,'']))as Record<GoalKey,string>;
const goalsSchema=z.object(Object.fromEntries(GOAL_PERIODS.map(g=>[g.key,long.default('')])) as Record<GoalKey,z.ZodDefault<z.ZodString>>).default(emptyGoals());
/** Horário semanal de referência: segunda (0) a sexta (4), entre as 9:00 e as 18:00. */
export const WEEKDAYS=['Segunda','Terça','Quarta','Quinta','Sexta'] as const;
export const DAY_START='09:00',DAY_END='18:00';
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/,'Indica a hora no formato 00:00.');
export const scheduleItemSchema=z.object({id,day:z.number().int().min(0).max(4),start:time,end:time,title:short.min(1,'Dá um título a cada bloco do horário.'),details:long.default('')}).refine(v=>v.start>=DAY_START&&v.end<=DAY_END&&v.end>v.start,{message:'Cada bloco do horário deve ficar entre as 9:00 e as 18:00 e terminar depois de começar.'});
/** Endereço de incorporação para vídeos do YouTube, Vimeo, Loom ou Google Drive (só estes são aceites). */
export function videoEmbed(raw:string):string|null{
 let u:URL;try{u=new URL(raw.trim())}catch{return null}
 if(u.protocol!=='https:')return null;
 const host=u.hostname.replace(/^www\.|^m\./,''),path=u.pathname.split('/').filter(Boolean),ok=(v?:string|null)=>v&&/^[\w-]{6,80}$/.test(v)?v:null;
 if(host==='youtu.be'){const v=ok(path[0]);return v?`https://www.youtube-nocookie.com/embed/${v}`:null}
 if(host==='youtube.com'||host==='youtube-nocookie.com'){const v=ok(path[0]==='watch'?u.searchParams.get('v'):['embed','shorts','live'].includes(path[0])?path[1]:null);return v?`https://www.youtube-nocookie.com/embed/${v}`:null}
 if(host==='vimeo.com'||host==='player.vimeo.com'){const v=path.find(x=>/^\d{5,12}$/.test(x));return v?`https://player.vimeo.com/video/${v}`:null}
 if(host==='loom.com'&&['share','embed'].includes(path[0])){const v=ok(path[1]);return v?`https://www.loom.com/embed/${v}`:null}
 if(host==='drive.google.com'&&path[0]==='file'&&path[1]==='d'){const v=ok(path[2]);return v?`https://drive.google.com/file/d/${v}/preview`:null}
 return null;
}
export const CONTENT_TYPES=['text','image','video'] as const;
export const contentSchema=z.object({id,type:z.enum(CONTENT_TYPES),title:short.default(''),body:long.default(''),imageId:z.string().uuid().nullable().default(null),url:z.string().max(500).default(''),caption:short.default('')}).superRefine((c,ctx)=>{
 if(c.type==='text'&&!c.title.trim()&&!c.body.trim())ctx.addIssue({code:'custom',message:'Escreve o texto de cada bloco de texto (ou remove-o).'});
 if(c.type==='image'&&!c.imageId)ctx.addIssue({code:'custom',message:'Envia a imagem de cada bloco de imagem (ou remove-o).'});
 if(c.type==='video'&&!videoEmbed(c.url))ctx.addIssue({code:'custom',message:'Indica um link de vídeo válido do YouTube, Vimeo, Loom ou Google Drive.'});
});
export const routineSchema=z.object({id,phase:z.enum(phases),title:short.min(1,'Dá um título à tarefa.'),details:long});
export const roleSchema=z.object({id,departmentId:id,parentId:id.nullable(),name:short.min(1,'Indica o nome do cargo.'),mission:long,responsibilities:long,routine:z.array(routineSchema).max(80),intro:long.default(''),goals:goalsSchema,schedule:z.array(scheduleItemSchema).max(200).default([]),contents:z.array(contentSchema).max(80).default([])});
export const sopSchema=z.object({id,roleId:id,title:short.min(1,'Indica o título do procedimento.'),code:short,status:z.enum(['Rascunho','Validado','Arquivado']),purpose:long,frequency:short,scope:long,resources:long,steps:z.array(z.object({id,title:short.min(1,'Dá um título a cada passo.'),details:long})).max(80),result:long,exceptions:long,owner:short,reviewDate:z.string().refine(v=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v),'Data inválida.'),revision:z.number().int().min(1),updatedAt:z.string()}).superRefine((s,c)=>{if(s.status==='Validado'&&(!s.purpose.trim()||!s.steps.length||!s.owner.trim()||!s.result.trim()||s.steps.some(x=>!x.details.trim())))c.addIssue({code:'custom',path:['status'],message:'Para validar, preenche objetivo, responsável, resultado esperado e pelo menos um passo com instruções.'});});
export const trainingSchema=z.object({version:z.number().int().nonnegative(),departments:z.array(departmentSchema).max(60),roles:z.array(roleSchema).max(300),sops:z.array(sopSchema).max(1000)}).superRefine((t,c)=>{
 const issue=(message:string)=>c.addIssue({code:'custom',message});
 for(const list of [t.departments,t.roles,t.sops])if(new Set(list.map(x=>x.id)).size!==list.length)issue('Existem identificadores repetidos.');
 const departments=new Set(t.departments.map(d=>d.id)),roles=new Map(t.roles.map(r=>[r.id,r]));
 for(const r of t.roles){if(!departments.has(r.departmentId))issue('Área de atuação inexistente.');if(r.parentId&&roles.get(r.parentId)?.departmentId!==r.departmentId)issue('O superior deve pertencer à mesma área de atuação.');let parent=r.parentId;const seen=new Set([r.id]);while(parent){if(seen.has(parent)){issue('A hierarquia de cargos não pode formar um ciclo.');break}seen.add(parent);parent=roles.get(parent)?.parentId||null;}if(new Set(r.routine.map(x=>x.id)).size!==r.routine.length)issue('Tarefas repetidas.');if(new Set(r.schedule.map(x=>x.id)).size!==r.schedule.length||new Set(r.contents.map(x=>x.id)).size!==r.contents.length)issue('Existem blocos repetidos.');}
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
export type ScheduleItem=z.infer<typeof scheduleItemSchema>;
export type ContentBlock=z.infer<typeof contentSchema>;
export function blankRole(departmentId:string):TrainingRole{return {id:uid(),departmentId,parentId:null,name:'',mission:'',responsibilities:'',routine:[],intro:'',goals:emptyGoals(),schedule:[],contents:[]}}
/** Ids das imagens usadas nos conteúdos de formação (as restantes podem ser apagadas do Storage). */
export const trainingImageIds=(t:{roles:{contents?:{imageId?:string|null}[]}[]})=>new Set(t.roles.flatMap(r=>(r.contents||[]).flatMap(c=>c.imageId?[c.imageId]:[])));
export const trainingImageUrl=(id:string)=>`/api/training/images?id=${id}`;
