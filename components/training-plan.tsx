"use client";
import {useRef,useState} from 'react';
import {ArrowDown,ArrowUp,Copy,ExternalLink,ImagePlus,LoaderCircle,PlayCircle,Plus,Target,Trash2,Type} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {toast} from 'sonner';
import {preparePhoto} from '@/lib/image-optimize';
import {PHOTO_ACCEPT,checkPhoto} from '@/lib/property';
import {GOAL_PERIODS,WEEKDAYS,DAY_START,DAY_END,videoEmbed,trainingImageUrl,uid,type GoalKey,type ScheduleItem,type ContentBlock,type TrainingRole} from '@/lib/training';

/** Texto simples com parágrafos; linhas começadas por "-" ou "•" passam a lista. */
export function RichText({text,empty}:{text:string,empty?:string}){
 const blocks=text.trim().split(/\n\s*\n/).filter(Boolean);
 if(!blocks.length)return empty?<p className="training-muted">{empty}</p>:null;
 return <div className="rich-text">{blocks.map((b,i)=>{const lines=b.split('\n').map(l=>l.trim()).filter(Boolean);return lines.every(l=>/^[-•]\s*/.test(l))?<ul key={i}>{lines.map((l,j)=><li key={j}>{l.replace(/^[-•]\s*/,'')}</li>)}</ul>:<p key={i}>{b.trim()}</p>})}</div>;
}
const goalLines=(t:string)=>t.split('\n').map(l=>l.trim().replace(/^[-•]\s*/,'')).filter(Boolean);
const sortByTime=(a:ScheduleItem,b:ScheduleItem)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end);
const toMin=(t:string)=>{const [h,m]=t.split(':').map(Number);return h*60+m};
const toTime=(m:number)=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

/* ---------- Consulta ---------- */
export function PlanView({role}:{role:TrainingRole}){
 const filled=GOAL_PERIODS.filter(g=>goalLines(role.goals[g.key]).length).length;
 return <>
  <section className="panel training-plan-intro"><h3>Introdução</h3><RichText text={role.intro} empty="Ainda sem texto introdutório. Edita o plano para apresentar a função a quem chega."/></section>
  <section className="panel training-goals-panel"><div className="training-goals-head"><h3>Objetivos da formação</h3><span>{filled} de {GOAL_PERIODS.length} períodos definidos</span></div>
   <div className="training-goals">{GOAL_PERIODS.map((g,i)=>{const lines=goalLines(role.goals[g.key]);return <article key={g.key} className={'training-goal'+(lines.length?'':' empty')}>
    <header><span className="training-goal-step">{String(i+1).padStart(2,'0')}</span><div><strong>{g.label}</strong><small>{g.horizon}</small></div><Target size={17}/></header>
    {lines.length?<ul>{lines.map((l,j)=><li key={j}>{l}</li>)}</ul>:<p>Objetivos por definir.</p>}
   </article>})}</div>
  </section>
 </>;
}
export function ScheduleView({role}:{role:TrainingRole}){
 if(!role.schedule.length)return <p className="training-muted training-schedule-empty">Ainda sem horário. Edita o horário para planear a semana de segunda a sexta, das 9:00 às 18:00.</p>;
 return <div className="training-week">{WEEKDAYS.map((d,day)=>{const items=role.schedule.filter(s=>s.day===day).sort(sortByTime);return <div className="training-day" key={d}>
  <h4>{d}</h4>
  {items.length?items.map(s=><div className="training-slot" key={s.id} title={s.details||undefined}><span className="training-slot-time">{s.start}–{s.end}</span><strong>{s.title}</strong>{s.details&&<small>{s.details}</small>}</div>):<p className="training-muted">Sem blocos.</p>}
 </div>})}</div>;
}
export function ContentsView({role}:{role:TrainingRole}){
 if(!role.contents.length)return <p className="training-muted">Ainda sem conteúdos. Adiciona textos, imagens e vídeos para acompanhar a integração de quem chega.</p>;
 return <div className="training-contents">{role.contents.map((c,i)=><article className={'training-content-block '+c.type} key={c.id}>
  <span className="training-content-index">{String(i+1).padStart(2,'0')}</span>
  <div className="training-content-body">
   {c.title&&<h3>{c.title}</h3>}
   {c.type==='text'&&<RichText text={c.body}/>}
   {c.type==='image'&&c.imageId&&<figure><a href={trainingImageUrl(c.imageId)} target="_blank" rel="noopener noreferrer" aria-label="Abrir imagem noutro separador"><img src={trainingImageUrl(c.imageId)} alt={c.caption||c.title||'Imagem de formação'} loading="lazy"/></a>{c.caption&&<figcaption>{c.caption}</figcaption>}</figure>}
   {c.type==='video'&&<VideoFrame url={c.url} title={c.title||'Vídeo de formação'} caption={c.caption}/>}
  </div>
 </article>)}</div>;
}
function VideoFrame({url,title,caption}:{url:string,title:string,caption?:string}){
 const src=videoEmbed(url);if(!src)return null;
 return <figure><div className="training-video"><iframe src={src} title={title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></div>{caption&&<figcaption>{caption}</figcaption>}<a className="training-video-link" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/> Abrir no site original</a></figure>;
}

/* ---------- Edição ---------- */
export function PlanEditor({intro,goals,onChange}:{intro:string,goals:Record<GoalKey,string>,onChange:(p:{intro?:string,goals?:Record<GoalKey,string>})=>void}){
 return <>
  <section className="panel form-panel"><div className="section-heading"><div><h2>Introdução</h2><p>Apresenta a função a quem chega: o contexto, a equipa e o que se espera nos primeiros meses.</p></div></div>
   <div className="field"><Textarea aria-label="Texto introdutório" value={intro} maxLength={5000} onChange={e=>onChange({intro:e.target.value})} placeholder="Bem-vindo à equipa de…"/></div></section>
  <section className="panel form-panel"><div className="section-heading"><div><h2>Objetivos da formação</h2><p>Um objetivo por linha. Aparecem como lista em cada período.</p></div></div>
   <div className="training-goals-editor">{GOAL_PERIODS.map(g=><div className="field" key={g.key}><label htmlFor={'goal-'+g.key}>{g.label} <span className="training-muted-inline">· {g.horizon.toLowerCase()}</span></label><Textarea id={'goal-'+g.key} value={goals[g.key]} maxLength={5000} onChange={e=>onChange({goals:{...goals,[g.key]:e.target.value}})} placeholder={'Ex.: Conhecer os sistemas de reservas\nAcompanhar 5 check-ins'}/></div>)}</div></section>
 </>;
}
export function ScheduleEditor({items,onChange}:{items:ScheduleItem[],onChange:(items:ScheduleItem[])=>void}){
 const patch=(id:string,p:Partial<ScheduleItem>)=>onChange(items.map(x=>x.id===id?{...x,...p}:x));
 function add(day:number){const last=items.filter(x=>x.day===day).sort(sortByTime).at(-1);const start=Math.min(toMin(last?.end||DAY_START),toMin(DAY_END)-30),end=Math.min(start+60,toMin(DAY_END));onChange([...items,{id:uid(),day,start:toTime(start),end:toTime(end),title:'',details:''}])}
 function copy(from:number,to:string){const targets=to==='all'?WEEKDAYS.map((_,i)=>i).filter(i=>i!==from):[Number(to)];const source=items.filter(x=>x.day===from);onChange([...items.filter(x=>!targets.includes(x.day)),...targets.flatMap(day=>source.map(s=>({...s,id:uid(),day})))]);toast.success(`Horário de ${WEEKDAYS[from].toLowerCase()} copiado. Substituiu o que ${to==='all'?'os outros dias tinham':WEEKDAYS[Number(to)].toLowerCase()+' tinha'}.`)}
 return <div className="schedule-editor">{WEEKDAYS.map((d,day)=>{const list=items.filter(x=>x.day===day);return <section className="panel form-panel schedule-editor-day" key={d}>
  <div className="section-heading"><div><h2>{d}</h2><p>{list.length?`${list.length} ${list.length===1?'bloco':'blocos'}`:'Sem blocos'} · entre as 9:00 e as 18:00</p></div>
   {list.length>0&&<Select value="" onValueChange={v=>copy(day,v)}><SelectTrigger className="schedule-copy" aria-label={`Copiar o horário de ${d} para outro dia`}><Copy size={14}/><SelectValue placeholder="Copiar para…"/></SelectTrigger><SelectContent><SelectItem value="all">Todos os outros dias</SelectItem>{WEEKDAYS.map((w,i)=>i!==day&&<SelectItem key={w} value={String(i)}>{w}</SelectItem>)}</SelectContent></Select>}
  </div>
  {list.map(s=>{const bad=s.start<DAY_START||s.end>DAY_END||s.end<=s.start;return <div className={'schedule-row'+(bad?' invalid':'')} key={s.id}>
   <Input type="time" min={DAY_START} max={DAY_END} step={300} aria-label="Início" value={s.start} onChange={e=>patch(s.id,{start:e.target.value})}/>
   <span className="schedule-dash">–</span>
   <Input type="time" min={DAY_START} max={DAY_END} step={300} aria-label="Fim" value={s.end} onChange={e=>patch(s.id,{end:e.target.value})}/>
   <Input className="schedule-title" aria-label="Atividade" placeholder="Atividade (ex.: Reunião de equipa)" maxLength={180} value={s.title} onChange={e=>patch(s.id,{title:e.target.value})}/>
   <Input className="schedule-details" aria-label="Notas" placeholder="Notas (opcional)" maxLength={500} value={s.details} onChange={e=>patch(s.id,{details:e.target.value})}/>
   <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${s.title||'bloco'}`} onClick={()=>onChange(items.filter(x=>x.id!==s.id))}><Trash2 size={16}/></Button>
   {bad&&<small className="schedule-error">Escolhe um horário entre as 9:00 e as 18:00, com fim depois do início.</small>}
  </div>})}
  <Button type="button" variant="outline" className="schedule-add" disabled={items.length>=200} onClick={()=>add(day)}><Plus/> Adicionar bloco</Button>
 </section>})}</div>;
}
const CONTENT_LABEL={text:'Texto',image:'Imagem',video:'Vídeo'} as const;
const CONTENT_ICON={text:Type,image:ImagePlus,video:PlayCircle} as const;
export function ContentsEditor({items,onChange}:{items:ContentBlock[],onChange:(items:ContentBlock[])=>void}){
 const [uploading,setUploading]=useState<string|null>(null);
 const latest=useRef(items);latest.current=items;
 const patch=(id:string,p:Partial<ContentBlock>)=>onChange(latest.current.map(x=>x.id===id?{...x,...p}:x));
 const move=(i:number,d:number)=>{const n=[...items];[n[i],n[i+d]]=[n[i+d],n[i]];onChange(n)};
 const add=(type:ContentBlock['type'])=>onChange([...items,{id:uid(),type,title:'',body:'',imageId:null,url:'',caption:''}]);
 async function upload(id:string,file:File){
  const invalid=checkPhoto(file);if(invalid){toast.error(invalid.replace('Cada foto','Cada imagem'));return}
  setUploading(id);try{const {file:prepared}=await preparePhoto(file);const form=new FormData();form.append('file',prepared);const r=await fetch('/api/training/images',{method:'POST',body:form});const body=await r.json().catch(()=>({})) as {image?:{id:string},error?:string};if(!r.ok||!body.image)throw Error(body.error||'Não foi possível enviar a imagem.');patch(id,{imageId:body.image.id})}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível enviar a imagem.')}finally{setUploading(null)}
 }
 return <div className="contents-editor">
  {items.map((c,i)=>{const Icon=CONTENT_ICON[c.type],embed=c.type==='video'?videoEmbed(c.url):null;return <section className="panel form-panel content-edit" key={c.id}>
   <div className="training-step-toolbar"><span className="content-edit-kind"><Icon size={14}/> {CONTENT_LABEL[c.type].toUpperCase()} {String(i+1).padStart(2,'0')}</span><div>
    <Button type="button" size="icon" variant="ghost" disabled={i===0} aria-label={`Subir bloco ${i+1}`} onClick={()=>move(i,-1)}><ArrowUp size={16}/></Button>
    <Button type="button" size="icon" variant="ghost" disabled={i===items.length-1} aria-label={`Descer bloco ${i+1}`} onClick={()=>move(i,1)}><ArrowDown size={16}/></Button>
    <Button type="button" size="icon" variant="ghost" aria-label={`Remover bloco ${i+1}`} onClick={()=>onChange(items.filter(x=>x.id!==c.id))}><Trash2 size={16}/></Button>
   </div></div>
   <div className="form-grid">
    <div className="field wide"><label htmlFor={'ct-'+c.id}>Título {c.type!=='text'&&<span className="training-muted-inline">(opcional)</span>}</label><Input id={'ct-'+c.id} value={c.title} maxLength={180} onChange={e=>patch(c.id,{title:e.target.value})} placeholder={c.type==='text'?'Ex.: Como funciona a receção':c.type==='image'?'Ex.: Mapa do hotel':'Ex.: Visita guiada ao PMS'}/></div>
    {c.type==='text'&&<div className="field wide"><label htmlFor={'cb-'+c.id}>Texto</label><Textarea id={'cb-'+c.id} className="content-text" value={c.body} maxLength={5000} onChange={e=>patch(c.id,{body:e.target.value})} placeholder={'Escreve o conteúdo. Separa parágrafos com uma linha em branco.\n- Linhas começadas por "-" aparecem como lista'}/></div>}
    {c.type==='image'&&<div className="field wide"><span className="field-label">Imagem</span><div className="content-image">
     {c.imageId?<img src={trainingImageUrl(c.imageId)} alt=""/>:<div className="content-image-empty"><ImagePlus size={22}/><span>PNG, JPG ou WEBP até 10 MB</span></div>}
     <label className={'content-image-button'+(uploading===c.id?' busy':'')}>{uploading===c.id?<LoaderCircle className="spin" size={15}/>:<ImagePlus size={15}/>} {uploading===c.id?'A enviar…':c.imageId?'Substituir imagem':'Escolher imagem'}<input type="file" accept={PHOTO_ACCEPT} disabled={uploading===c.id} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)upload(c.id,f)}}/></label>
    </div></div>}
    {c.type==='video'&&<div className="field wide"><label htmlFor={'cu-'+c.id}>Link do vídeo</label><Input id={'cu-'+c.id} type="url" value={c.url} maxLength={500} onChange={e=>patch(c.id,{url:e.target.value})} placeholder="https://www.youtube.com/watch?v=…"/><small>{c.url&&!embed?<span className="schedule-error">Link não reconhecido. Usa um vídeo do YouTube, Vimeo, Loom ou Google Drive.</span>:'YouTube, Vimeo, Loom ou Google Drive (partilhado com quem vai ver).'}</small>{embed&&<div className="training-video content-video-preview"><iframe src={embed} title="Pré-visualização do vídeo" loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></div>}</div>}
    {c.type!=='text'&&<div className="field wide"><label htmlFor={'cc-'+c.id}>Legenda <span className="training-muted-inline">(opcional)</span></label><Input id={'cc-'+c.id} value={c.caption} maxLength={180} onChange={e=>patch(c.id,{caption:e.target.value})}/></div>}
   </div>
  </section>})}
  {!items.length&&<p className="training-muted">Ainda sem conteúdos. Escolhe o tipo de bloco a adicionar.</p>}
  <div className="content-add"><span>Adicionar bloco</span>{(['text','image','video'] as const).map(t=>{const Icon=CONTENT_ICON[t];return <Button key={t} type="button" variant="outline" disabled={items.length>=80} onClick={()=>add(t)}><Icon/> {CONTENT_LABEL[t]}</Button>})}</div>
 </div>;
}
