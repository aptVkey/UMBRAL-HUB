"use client";
import {useEffect,useState} from 'react';
import {Wrench,Plus,ExternalLink,PencilLine,Trash2,LoaderCircle,Save} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {Empty,EmptyHeader,EmptyTitle,EmptyDescription,EmptyMedia} from '@/components/ui/empty';
import {Skeleton} from '@/components/ui/skeleton';
import {Field} from '@/components/hub-fields';
import {toast} from 'sonner';
import {toolSchema,newTool,hostOf,TOOL_CATEGORIES,type Tool,type SavedTool} from '@/lib/tool';
type Issue={path:(string|number)[],message:string};
const toDraft=(t:SavedTool):Tool=>{const {updatedAt,...d}=t;return {...d,categories:d.categories||[]}};
export default function Tools({canEdit}:{canEdit:boolean}){
 const [tools,setTools]=useState<SavedTool[]>([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
 const [draft,setDraft]=useState<Tool|null>(null),[baseline,setBaseline]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[issues,setIssues]=useState<Issue[]>([]);
 const [cat,setCat]=useState('');
 const [removing,setRemoving]=useState<SavedTool|null>(null),[confirmLeave,setConfirmLeave]=useState(false);
 const dirty=!!draft&&JSON.stringify(draft)!==baseline;
 async function load(){setLoading(true);setLoadError('');try{const r=await fetch('/api/tools',{cache:'no-store'});const data:{tools?:SavedTool[],error?:string}=await r.json();if(!r.ok||!data.tools)throw Error(data.error);setTools(data.tools)}catch(e){setLoadError(e instanceof Error?e.message:'Não foi possível carregar as ferramentas.')}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 function open(t?:SavedTool){const d=t?toDraft(t):newTool();setDraft(d);setBaseline(JSON.stringify(d));setError('');setIssues([])}
 function patch(p:Partial<Tool>){setDraft(d=>d?{...d,...p}:d);if(issues.length){setIssues([]);setError('')}}
 function closeForm(){if(busy)return;if(dirty)setConfirmLeave(true);else setDraft(null)}
 const present=TOOL_CATEGORIES.filter(c=>tools.some(t=>t.categories?.includes(c))),shown=cat?tools.filter(t=>t.categories?.includes(cat as typeof TOOL_CATEGORIES[number])):tools;
 const fieldError=(k:string)=>issues.find(i=>i.path[0]===k)?.message;
 async function save(){if(!draft||busy)return;setError('');setIssues([]);const parsed=toolSchema.safeParse(draft);if(!parsed.success){setIssues(parsed.error.issues);setError(parsed.error.issues[0].message);return}
  setBusy(true);try{const r=await fetch('/api/tools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsed.data)});const data:{tool?:SavedTool,error?:string,issues?:Issue[],message?:string}=await r.json();if(!r.ok){if(data.issues)setIssues(data.issues);throw Error(data.error)}
   if(r.status===202){toast.success(data.message||'Enviado para aprovação.');setDraft(null);return}
   if(!data.tool)throw Error(data.error);
   const t=data.tool;setTools(l=>[...l.filter(x=>x.id!==t.id),t].sort((a,b)=>a.name.localeCompare(b.name,'pt')));setDraft(null);toast.success(parsed.data.version?'Ferramenta atualizada.':'Ferramenta adicionada.')}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível guardar. As tuas alterações foram mantidas.')}finally{setBusy(false)}}
 async function remove(){const t=removing;if(!t||busy)return;setBusy(true);try{const r=await fetch(`/api/tools?id=${t.id}&version=${t.version}`,{method:'DELETE'});const data:{error?:string,message?:string}=await r.json();if(!r.ok)throw Error(data.error);if(r.status===202){toast.success(data.message||'Pedido de eliminação enviado para aprovação.');setRemoving(null);return}setTools(l=>l.filter(x=>x.id!==t.id));setRemoving(null);toast.success('Ferramenta eliminada.')}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível eliminar.');setRemoving(null);load()}finally{setBusy(false)}}
 return <div className="tools-area">
 <div className="page-heading"><div><div className="eyebrow">FERRAMENTAS DA EQUIPA</div><h1>Ferramentas <span className="heading-counter">{tools.length}</span></h1><p>Acesso rápido às ferramentas usadas pela equipa.</p></div>{canEdit&&<Button className="primary-btn" onClick={()=>open()}><Plus/> Nova ferramenta</Button>}</div>
 {!loading&&!loadError&&present.length>0&&<div className="tool-filters" role="group" aria-label="Filtrar por categoria"><button className={'tool-chip '+(!cat?'on':'')} aria-pressed={!cat} onClick={()=>setCat('')}>Todas <span>{tools.length}</span></button>{present.map(c=><button key={c} className={'tool-chip '+(cat===c?'on':'')} aria-pressed={cat===c} onClick={()=>setCat(cat===c?'':c)}>{c} <span>{tools.filter(t=>t.categories?.includes(c)).length}</span></button>)}</div>}
 {loading?<div className="tool-grid" aria-label="A carregar ferramentas"><Skeleton className="h-44"/><Skeleton className="h-44"/><Skeleton className="h-44"/></div>
 :loadError?<div className="error-banner" role="alert">{loadError}<Button variant="outline" onClick={load}>Tentar novamente</Button></div>
 :tools.length?<div className="tool-grid">{shown.map(t=><article className="tool-card" key={t.id}><div className="tool-card-top"><span className="tool-icon"><Wrench size={20}/></span>{canEdit&&<div className="tool-actions"><Button variant="ghost" size="icon" aria-label={`Editar ${t.name}`} onClick={()=>open(t)}><PencilLine/></Button><Button variant="ghost" size="icon" aria-label={`Eliminar ${t.name}`} onClick={()=>setRemoving(t)}><Trash2/></Button></div>}</div>
  <h2>{t.name}</h2>{!!t.categories?.length&&<div className="tool-cats">{t.categories.map(c=><span key={c}>{c}</span>)}</div>}<p className="tool-desc">{t.description||'Sem descrição.'}</p><span className="tool-host">{hostOf(t.url)}</span>
  <Button className="tool-open" asChild><a href={t.url} target="_blank" rel="noopener noreferrer">Aceder <ExternalLink/></a></Button></article>)}</div>
 :<section className="panel"><Empty className="main-empty"><EmptyHeader><EmptyMedia className="empty-hotel"><Wrench size={34}/></EmptyMedia><EmptyTitle>Ainda não há ferramentas</EmptyTitle><EmptyDescription>{canEdit?'Adiciona as ferramentas que a equipa usa no dia a dia, com uma descrição e o link de acesso.':'Ainda ninguém adicionou ferramentas. Pede a um membro com permissão de edição que as registe.'}</EmptyDescription></EmptyHeader>{canEdit&&<Button onClick={()=>open()}><Plus/> Adicionar ferramenta</Button>}</Empty></section>}
 <Dialog open={!!draft} onOpenChange={v=>{if(!v)closeForm()}}><DialogContent className="tool-dialog" aria-describedby="tool-desc-text"><DialogHeader><DialogTitle>{draft?.version?'Editar ferramenta':'Nova ferramenta'}</DialogTitle><DialogDescription id="tool-desc-text">O card mostra o nome, a descrição e um botão de acesso ao link.</DialogDescription></DialogHeader>
  {draft&&<><fieldset disabled={busy} className="tool-form"><div className="form-grid single"><Field label="Nome da ferramenta" required value={draft.name} onChange={v=>patch({name:v})} placeholder="Ex.: Channel manager"/>{fieldError('name')&&<p className="field-error">{fieldError('name')}</p>}
   <Field label="Descrição" area value={draft.description} onChange={v=>patch({description:v})} placeholder="Para que serve e quando deve ser usada."/>
   <div className="field"><label>Categorias</label><div className="tool-cat-pick">{TOOL_CATEGORIES.map(c=>{const on=draft.categories.includes(c);return <button type="button" key={c} className={'tool-chip '+(on?'on':'')} aria-pressed={on} onClick={()=>patch({categories:on?draft.categories.filter(x=>x!==c):[...draft.categories,c]})}>{c}</button>})}</div><small>Só as pessoas com acesso a estas categorias veem a ferramenta. Sem categorias, todos a veem.</small></div>
   <Field label="Link de acesso" required type="url" value={draft.url} onChange={v=>patch({url:v})} placeholder="https://" hint="Endereço completo, a começar por https://."/>{fieldError('url')&&<p className="field-error">{fieldError('url')}</p>}</div></fieldset>
  {error&&!issues.length&&<div className="error-banner" role="alert">{error}</div>}
  <div className="settings-actions"><span/><div><Button variant="outline" disabled={busy} onClick={closeForm}>Cancelar</Button><Button className="primary-btn" disabled={busy} onClick={save}>{busy?<LoaderCircle className="spin"/>:<Save/>} Guardar</Button></div></div></>}</DialogContent></Dialog>
 <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Sair sem guardar?</AlertDialogTitle><AlertDialogDescription>As alterações a esta ferramenta ainda não foram guardadas.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Continuar a editar</AlertDialogCancel><AlertDialogAction className="confirm-action" onClick={()=>{setConfirmLeave(false);setDraft(null)}}>Sair sem guardar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 <AlertDialog open={!!removing} onOpenChange={v=>{if(!v&&!busy)setRemoving(null)}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminar ferramenta?</AlertDialogTitle><AlertDialogDescription>O card “{removing?.name}” é eliminado de forma permanente. A ferramenta em si não é afetada.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction className="confirm-action" disabled={busy} onClick={e=>{e.preventDefault();remove()}}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>
}
