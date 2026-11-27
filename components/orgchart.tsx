"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {Workflow,Plus,PencilLine,Trash2,LoaderCircle,Save,ChevronLeft,ChevronRight,ZoomIn,ZoomOut,Maximize2,Mail,Phone,Copy,X,Check,UserPlus} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Checkbox} from '@/components/ui/checkbox';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {Skeleton} from '@/components/ui/skeleton';
import {toast} from 'sonner';
import {ORG_PLACEMENTS,ORG_TONES,PLACEMENT_LABEL,TONE_LABEL,descendants,hasList,layoutOrgChart,moveBox,newOrgId,newPerson,orgChartSchema,removeBox,type OrgBox,type OrgChart as Chart,type OrgPerson,type OrgPlacement,type PlacedBox} from '@/lib/orgchart';

const boxName=(b:OrgBox)=>b.people.map(p=>p.name||'Sem nome').join(' / ');
const initials=(n:string)=>n.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?';
const fmtWhen=(iso:string)=>new Date(iso).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
type Editing={box:OrgBox,items:string,isNew:boolean};
type Loaded={chart?:Chart,updatedAt:string|null,updatedBy:string,error?:string};

export default function OrgChart({canEdit}:{canEdit:boolean}){
 const [chart,setChart]=useState<Chart|null>(null),[meta,setMeta]=useState<{updatedAt:string|null,updatedBy:string}>({updatedAt:null,updatedBy:''});
 const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[busy,setBusy]=useState(false);
 const [edit,setEdit]=useState(false),[editing,setEditing]=useState<Editing|null>(null),[formError,setFormError]=useState(''),[removing,setRemoving]=useState<OrgBox|null>(null);
 const [contact,setContact]=useState<{person:OrgPerson,box:OrgBox}|null>(null);
 const [zoom,setZoom]=useState<number|null>(null),[fit,setFit]=useState(1);
 const wrapRef=useRef<HTMLDivElement>(null);

 async function load(){setLoading(true);setLoadError('');try{const r=await fetch('/api/orgchart',{cache:'no-store'});const d:Loaded=await r.json();if(!r.ok||!d.chart)throw Error(d.error);setChart(d.chart);setMeta({updatedAt:d.updatedAt,updatedBy:d.updatedBy})}catch(e){setLoadError(e instanceof Error&&e.message?e.message:'Não foi possível carregar o organograma.')}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 const layout=useMemo(()=>chart?layoutOrgChart(chart.boxes):null,[chart]);
 // Por omissão o desenho encolhe para caber na largura disponível (sem passar de 100%).
 useEffect(()=>{const el=wrapRef.current;if(!el||!layout)return;const ro=new ResizeObserver(()=>setFit(Math.min(1,Math.max(0.4,(el.clientWidth-2)/layout.width))));ro.observe(el);return()=>ro.disconnect()},[layout]);
 const scale=zoom??fit;

 /** Grava o organograma inteiro com a versão atual; em caso de conflito pede para recarregar. */
 async function save(boxes:OrgBox[],ok:string){
  if(!chart)return false;const next={version:chart.version,boxes};
  const check=orgChartSchema.safeParse(next);if(!check.success){const m=check.error.issues[0].message;setFormError(m);toast.error(m);return false}
  setBusy(true);
  try{const r=await fetch('/api/orgchart',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(check.data)});const d:Loaded=await r.json();if(!r.ok||!d.chart)throw Error(d.error||'Não foi possível guardar.');setChart(d.chart);setMeta({updatedAt:d.updatedAt,updatedBy:d.updatedBy});toast.success(ok);return true}
  catch(e){const m=e instanceof Error?e.message:'Não foi possível guardar.';setFormError(m);toast.error(m);return false}
  finally{setBusy(false)}
 }
 function openEditor(box?:OrgBox,parentId?:string|null){
  if(!chart)return;setFormError('');
  if(box){setEditing({box:structuredClone(box),items:box.items.join('\n'),isNew:false});return}
  const root=chart.boxes.find(b=>b.placement==='below'&&!b.parentId);
  setEditing({box:{id:newOrgId(),people:[newPerson()],items:[],parentId:parentId===undefined?root?.id??null:parentId,placement:'below',supports:[],tone:'navy'},items:'',isNew:true});
 }
 async function saveEditor(){
  if(!chart||!editing)return;
  const items=editing.items.split('\n').map(s=>s.trim()).filter(Boolean);
  const b:OrgBox={...editing.box,items,people:editing.box.people.map(p=>({...p,name:p.name.trim()})),
   parentId:editing.box.placement==='support'?null:editing.box.parentId,supports:editing.box.placement==='support'?editing.box.supports:[]};
  const boxes=editing.isNew?[...chart.boxes,b]:chart.boxes.map(x=>x.id===b.id?b:x);
  if(await save(boxes,editing.isNew?'Caixa adicionada.':'Caixa atualizada.'))setEditing(null);
 }
 async function remove(){if(!chart||!removing)return;if(await save(removeBox(chart.boxes,removing.id),'Caixa eliminada.'))setRemoving(null)}
 const move=(b:OrgBox,dir:-1|1)=>{if(chart&&!busy)save(moveBox(chart.boxes,b.id,dir),'Ordem atualizada.')};
 const clickPerson=(person:OrgPerson,box:OrgBox)=>{if(edit)openEditor(box);else setContact({person,box})};

 const parentOf=(b:OrgBox)=>b.parentId?chart?.boxes.find(x=>x.id===b.parentId):undefined;
 return <div className="orgchart-area">
  <div className="page-heading"><div><div className="eyebrow">EQUIPA</div><h1>Organograma</h1><p>Estrutura da equipa e responsáveis por cada alojamento. Clica num nome para ver os contactos.</p></div>
   {canEdit&&chart&&<div className="heading-actions">{edit&&<Button variant="outline" disabled={busy} onClick={()=>openEditor()}><Plus/> Adicionar caixa</Button>}<Button className={edit?'primary-btn':''} variant={edit?'default':'outline'} onClick={()=>setEdit(e=>!e)}>{edit?<><Check/> Concluir edição</>:<><PencilLine/> Editar organograma</>}</Button></div>}</div>
  {loading?<section className="panel"><Skeleton className="h-[420px] w-full"/></section>
  :loadError?<section className="panel"><p className="field-error">{loadError}</p><Button variant="outline" onClick={load}>Tentar novamente</Button></section>
  :chart&&layout&&<section className="panel org-panel">
   <div className="org-toolbar">
    <span className="org-hint">{edit?'Modo de edição: clica numa caixa para a editar, ou usa os botões por cima de cada caixa.':meta.updatedAt?`Atualizado por ${meta.updatedBy||'—'} em ${fmtWhen(meta.updatedAt)}`:'Organograma inicial.'}</span>
    <div className="org-zoom"><Button variant="ghost" size="icon" aria-label="Diminuir" onClick={()=>setZoom(Math.max(0.4,+(scale-0.1).toFixed(2)))}><ZoomOut/></Button><span>{Math.round(scale*100)}%</span><Button variant="ghost" size="icon" aria-label="Aumentar" onClick={()=>setZoom(Math.min(1.6,+(scale+0.1).toFixed(2)))}><ZoomIn/></Button><Button variant="ghost" size="icon" aria-label="Ajustar ao ecrã" title="Ajustar ao ecrã" onClick={()=>setZoom(null)}><Maximize2/></Button></div>
   </div>
   <div className="org-scroll" ref={wrapRef}>
    {!chart.boxes.length?<div className="org-empty"><Workflow/><p>O organograma está vazio.</p>{canEdit&&<Button variant="outline" onClick={()=>{setEdit(true);openEditor(undefined,null)}}><Plus/> Adicionar a primeira caixa</Button>}</div>
    :<div className="org-stage" style={{width:layout.width*scale,height:layout.height*scale}}>
     <div className="org-canvas" style={{width:layout.width,height:layout.height,transform:`scale(${scale})`}}>
      <svg className="org-lines" width={layout.width} height={layout.height} aria-hidden="true">{layout.lines.map((l,i)=><path key={i} d={l.d} className={'org-line '+l.tone}/>)}</svg>
      {layout.placed.map(p=><BoxView key={p.box.id} p={p} edit={edit} busy={busy} onPerson={clickPerson} onEdit={()=>openEditor(p.box)} onAdd={()=>openEditor(undefined,p.box.id)} onRemove={()=>setRemoving(p.box)} onMove={d=>move(p.box,d)}/>)}
     </div>
    </div>}
   </div>
  </section>}

  <Dialog open={!!contact} onOpenChange={v=>{if(!v)setContact(null)}}><DialogContent className="org-contact" aria-describedby="org-contact-desc">{contact&&(()=>{const {person,box}=contact,parent=parentOf(box),supported=box.supports.map(s=>chart?.boxes.find(x=>x.id===s)).filter((x):x is OrgBox=>!!x);return <>
   <DialogHeader><div className="org-contact-head"><span className={'org-avatar tone-'+box.tone}>{initials(person.name)}</span><div><DialogTitle>{person.name}</DialogTitle><DialogDescription id="org-contact-desc">{person.role||'Sem função indicada'}</DialogDescription></div></div></DialogHeader>
   <div className="org-contact-rows">
    <ContactRow icon={<Mail/>} label="Email" value={person.email} href={person.email?`mailto:${person.email}`:''}/>
    <ContactRow icon={<Phone/>} label="Telefone" value={person.phone} href={person.phone?`tel:${person.phone.replace(/[^\d+]/g,'')}`:''}/>
    {person.notes&&<div className="org-contact-notes">{person.notes}</div>}
   </div>
   {(parent||supported.length>0||box.items.length>0||box.people.length>1)&&<dl className="org-contact-meta">
    {parent&&<><dt>{box.placement==='side'?'Assessoria de':'Reporta a'}</dt><dd>{boxName(parent)}</dd></>}
    {supported.length>0&&<><dt>Apoia</dt><dd>{supported.map(boxName).join(', ')}</dd></>}
    {box.people.length>1&&<><dt>Na mesma caixa</dt><dd>{box.people.filter(p=>p.id!==person.id).map(p=>p.name+(p.role?` (${p.role})`:'')).join(', ')}</dd></>}
    {box.items.length>0&&<><dt>Responsável por</dt><dd><ul>{box.items.map((it,i)=><li key={i}>{it}</li>)}</ul></dd></>}
   </dl>}
   {canEdit&&<div className="settings-actions"><span/><div><Button variant="outline" onClick={()=>{setContact(null);openEditor(box)}}><PencilLine/> Editar contactos</Button></div></div>}
  </>})()}</DialogContent></Dialog>

  <Dialog open={!!editing} onOpenChange={v=>{if(!v&&!busy)setEditing(null)}}><DialogContent className="org-editor" aria-describedby="org-editor-desc">{editing&&chart&&<BoxEditor editing={editing} setEditing={setEditing} boxes={chart.boxes} busy={busy} error={formError} onCancel={()=>setEditing(null)} onSave={saveEditor} onRemove={editing.isNew?undefined:()=>{setRemoving(editing.box);setEditing(null)}}/>}</DialogContent></Dialog>

  <AlertDialog open={!!removing} onOpenChange={v=>{if(!v&&!busy)setRemoving(null)}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminar caixa?</AlertDialogTitle><AlertDialogDescription>A caixa “{removing?boxName(removing):''}” e os contactos que tem são eliminados. As caixas que estavam por baixo passam para a caixa de cima.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction className="confirm-action" disabled={busy} onClick={e=>{e.preventDefault();remove()}}>{busy?<LoaderCircle className="spin"/>:null} Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>;
}

function ContactRow({icon,label,value,href}:{icon:React.ReactNode,label:string,value:string,href:string}){
 async function copy(){try{await navigator.clipboard.writeText(value);toast.success(`${label} copiado.`)}catch{toast.error('Não foi possível copiar.')}}
 return <div className="org-contact-row">{icon}<div><span>{label}</span>{value?<a href={href}>{value}</a>:<em>Sem {label.toLowerCase()} registado</em>}</div>{value&&<Button variant="ghost" size="icon" aria-label={`Copiar ${label.toLowerCase()}`} onClick={copy}><Copy/></Button>}</div>;
}

function BoxView({p,edit,busy,onPerson,onEdit,onAdd,onRemove,onMove}:{p:PlacedBox,edit:boolean,busy:boolean,onPerson:(person:OrgPerson,box:OrgBox)=>void,onEdit:()=>void,onAdd:()=>void,onRemove:()=>void,onMove:(d:-1|1)=>void}){
 const b=p.box,list=hasList(b),single=b.people.length===1;
 const person=(x:OrgPerson,children:React.ReactNode)=><button type="button" key={x.id} className="org-person" onClick={e=>{e.stopPropagation();onPerson(x,b)}} title={edit?'Editar caixa':'Ver contactos'}>{children}</button>;
 return <div className={`org-box tone-${b.tone} ${list?'with-list':'compact'} ${edit?'editing':''}`} style={{left:p.x,top:p.y,width:p.w,height:p.h}} onClick={edit?onEdit:undefined}>
  {edit&&<div className="org-box-tools" onClick={e=>e.stopPropagation()}>
   <button type="button" aria-label="Mover para a esquerda" disabled={busy} onClick={()=>onMove(-1)}><ChevronLeft/></button>
   <button type="button" aria-label="Mover para a direita" disabled={busy} onClick={()=>onMove(1)}><ChevronRight/></button>
   {b.placement==='below'&&<button type="button" aria-label="Adicionar caixa por baixo" title="Adicionar caixa por baixo" disabled={busy} onClick={onAdd}><Plus/></button>}
   <button type="button" aria-label="Editar caixa" disabled={busy} onClick={onEdit}><PencilLine/></button>
   <button type="button" aria-label="Eliminar caixa" className="danger" disabled={busy} onClick={onRemove}><Trash2/></button>
  </div>}
  {list?<>
   <div className="org-box-head">{b.people.map(x=>person(x,<strong>{x.name}</strong>))}{single&&b.people[0].role&&<span className="org-role">{b.people[0].role}</span>}</div>
   <ul className="org-items">{b.items.map((it,i)=><li key={i}>{it}</li>)}</ul>
  </>:single?<div className="org-compact">{person(b.people[0],<strong>{b.people[0].name}</strong>)}{b.people[0].role&&<span className="org-role">{b.people[0].role}</span>}</div>
  :<div className="org-compact multi">{b.people.map(x=>person(x,<><strong>{x.name}</strong>{x.role&&<span> — {x.role}</span>}</>))}</div>}
 </div>;
}

function BoxEditor({editing,setEditing,boxes,busy,error,onCancel,onSave,onRemove}:{editing:Editing,setEditing:(e:Editing)=>void,boxes:OrgBox[],busy:boolean,error:string,onCancel:()=>void,onSave:()=>void,onRemove?:()=>void}){
 const b=editing.box,patch=(p:Partial<OrgBox>)=>setEditing({...editing,box:{...b,...p}});
 const setPerson=(i:number,p:Partial<OrgPerson>)=>patch({people:b.people.map((x,j)=>j===i?{...x,...p}:x)});
 const blocked=descendants(boxes,b.id);
 const parents=boxes.filter(x=>x.placement==='below'&&!blocked.has(x.id)),targets=boxes.filter(x=>x.placement!=='support'&&x.id!==b.id);
 function setPlacement(v:OrgPlacement){
  if(v==='support')patch({placement:v,supports:b.supports.length?b.supports:b.parentId?[b.parentId]:[]});
  else patch({placement:v,parentId:b.parentId&&parents.some(x=>x.id===b.parentId)?b.parentId:(v==='side'?parents[0]?.id??null:b.parentId)});
 }
 return <>
  <DialogHeader><DialogTitle>{editing.isNew?'Nova caixa':'Editar caixa'}</DialogTitle><DialogDescription id="org-editor-desc">Pessoas, contactos, lista de alojamentos ou responsabilidades e a ligação no organograma.</DialogDescription></DialogHeader>
  <fieldset disabled={busy} className="org-form">
   <div className="org-form-block"><h4>Pessoas</h4>
    {b.people.map((p,i)=><div className="org-person-row" key={p.id}>
     <div className="org-person-fields">
      <label><span>Nome <span className="required">*</span></span><Input value={p.name} maxLength={120} placeholder="Ex.: Ana Silva" onChange={e=>setPerson(i,{name:e.target.value})}/></label>
      <label>Função<Input value={p.role} maxLength={120} placeholder="Ex.: Governanta Geral" onChange={e=>setPerson(i,{role:e.target.value})}/></label>
      <label>Email<Input type="email" value={p.email} maxLength={180} placeholder="nome@byumbral.com" onChange={e=>setPerson(i,{email:e.target.value})}/></label>
      <label>Telefone<Input type="tel" value={p.phone} maxLength={40} placeholder="+351 912 345 678" onChange={e=>setPerson(i,{phone:e.target.value})}/></label>
      <label className="wide">Notas<Input value={p.notes} maxLength={500} placeholder="Ex.: Horário, extensão, disponibilidade" onChange={e=>setPerson(i,{notes:e.target.value})}/></label>
     </div>
     {b.people.length>1&&<Button variant="ghost" size="icon" aria-label={`Remover ${p.name||'pessoa'}`} onClick={()=>patch({people:b.people.filter((_,j)=>j!==i)})}><X/></Button>}
    </div>)}
    {b.people.length<12&&<Button variant="outline" size="sm" onClick={()=>patch({people:[...b.people,newPerson()]})}><UserPlus/> Adicionar pessoa</Button>}
   </div>
   <div className="org-form-block"><h4>Lista</h4><p>Alojamentos ou responsabilidades, um por linha. Com lista, a caixa aparece com cabeçalho e marcadores.</p>
    <Textarea value={editing.items} rows={4} placeholder={'Ex.:\nCampo Mar\nPHC'} onChange={e=>setEditing({...editing,items:e.target.value})}/></div>
   <div className="org-form-block"><h4>Ligação</h4>
    <div className="org-form-grid">
     <label>Tipo<select className="native-select" value={b.placement} onChange={e=>setPlacement(e.target.value as OrgPlacement)}>{ORG_PLACEMENTS.map(p=><option key={p} value={p} disabled={p==='side'&&!parents.length}>{PLACEMENT_LABEL[p]}</option>)}</select></label>
     {b.placement!=='support'&&<label>{b.placement==='side'?'Ao lado de':'Por baixo de'}<select className="native-select" value={b.parentId??''} onChange={e=>patch({parentId:e.target.value||null})}>{b.placement==='below'&&<option value="">Nenhuma (topo do organograma)</option>}{parents.map(x=><option key={x.id} value={x.id}>{boxName(x)}</option>)}</select></label>}
     <label>Cor<select className="native-select" value={b.tone} onChange={e=>patch({tone:e.target.value as OrgBox['tone']})}>{ORG_TONES.map(t=><option key={t} value={t}>{TONE_LABEL[t]}</option>)}</select></label>
    </div>
    {b.placement==='support'&&<div className="org-support-list"><span>Liga a</span>{targets.map(x=><label key={x.id} className="check-line"><Checkbox checked={b.supports.includes(x.id)} onCheckedChange={v=>patch({supports:v===true?[...b.supports,x.id]:b.supports.filter(s=>s!==x.id)})}/><span>{boxName(x)}</span></label>)}</div>}
   </div>
  </fieldset>
  {error&&<p className="field-error" role="alert">{error}</p>}
  <div className="settings-actions">{onRemove?<Button variant="ghost" className="org-remove" disabled={busy} onClick={onRemove}><Trash2/> Eliminar caixa</Button>:<span/>}<div><Button variant="outline" disabled={busy} onClick={onCancel}>Cancelar</Button><Button className="primary-btn" disabled={busy} onClick={onSave}>{busy?<LoaderCircle className="spin"/>:<Save/>} Guardar</Button></div></div>
 </>;
}
