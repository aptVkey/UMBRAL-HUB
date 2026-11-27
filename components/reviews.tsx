"use client";
import {useEffect,useRef,useState} from 'react';
import {RefreshCw,Star,Sparkles,Save,Check,Copy,LoaderCircle,Plus,Trash2,RotateCcw,Send,Search,MessageSquareQuote,TriangleAlert,ShieldCheck,ChevronLeft,ChevronRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {Empty,EmptyHeader,EmptyTitle,EmptyDescription,EmptyMedia} from '@/components/ui/empty';
import {Skeleton} from '@/components/ui/skeleton';
import {Field} from '@/components/hub-fields';
import {toast} from 'sonner';
import {REVIEW_PLATFORMS,REVIEW_PERIODS,REVIEW_STATUSES,ratingFilters,STATUS_LABEL,manualReviewSchema,ratingScale,isNegative,type Review,type ReviewStatus,type ManualReview} from '@/lib/review';
type Can={draft:boolean,approve:boolean,sync?:boolean};
type Prop={id:string,name:string};
const PAGE_SIZE=20;
/** Números de página a mostrar: primeira, última e as vizinhas da atual, com reticências pelo meio. */
const pageList=(current:number,pages:number)=>{const set=new Set([1,pages,current-1,current,current+1].filter(p=>p>=1&&p<=pages));const out:(number|'…')[]=[];let last=0;for(const p of [...set].sort((a,b)=>a-b)){if(p-last>1)out.push('…');out.push(p);last=p}return out};
const fmtDate=(d:string)=>{const t=Date.parse(d);return isNaN(t)?d:new Date(t).toLocaleDateString('pt-PT',{day:'numeric',month:'short',year:'numeric'})};
const emptyManual=():ManualReview=>({propertyId:'',platform:'Booking.com',author:'',rating:null,body:'',reviewDate:new Date().toISOString().slice(0,10)});
async function call(url:string,init:RequestInit):Promise<any>{const r=await fetch(url,{...init,headers:{'Content-Type':'application/json'}});const data:any=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Não foi possível concluir o pedido.');return data}

export default function Reviews(){
 const [reviews,setReviews]=useState<Review[]>([]),[total,setTotal]=useState(0),[counts,setCounts]=useState<Record<ReviewStatus,number>>({new:0,draft:0,approved:0,published:0}),[properties,setProperties]=useState<Prop[]>([]),[can,setCan]=useState<Can>({draft:false,approve:false}),[ai,setAi]=useState({ready:false,label:""});
 const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
 const [status,setStatus]=useState<ReviewStatus|'open'|''>('open'),[property,setProperty]=useState(''),[platform,setPlatform]=useState(''),[period,setPeriod]=useState(''),[rating,setRating]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(1);
 const panelRef=useRef<HTMLElement>(null);
 const [texts,setTexts]=useState<Record<string,string>>({}),[busy,setBusy]=useState<Record<string,string>>({});
 const [manual,setManual]=useState<ManualReview|null>(null),[manualError,setManualError]=useState(''),[saving,setSaving]=useState(false),[removing,setRemoving]=useState<Review|null>(null);
 /** Só a página pedida vem do servidor, já filtrada e ordenada. As respostas antigas (filtros entretanto mudados) são ignoradas. */
 const seq=useRef(0),[debouncedQuery,setDebouncedQuery]=useState('');
 useEffect(()=>{const t=setTimeout(()=>setDebouncedQuery(query),300);return()=>clearTimeout(t)},[query]);
 async function load(quiet=false){const n=++seq.current;if(!quiet)setLoading(l=>l&&!reviews.length);setLoadError('');
  try{const sp=new URLSearchParams({status,property,platform,period,rating,q:debouncedQuery.trim(),page:String(page)});const d=await call('/api/reviews?'+sp,{method:'GET'});if(n!==seq.current)return;
   setReviews(d.reviews);setTotal(d.total);setCounts({new:0,draft:0,approved:0,published:0,...d.counts});setProperties(d.properties);setCan(d.can);setAi(d.ai)}
  catch(e){if(n===seq.current)setLoadError(e instanceof Error?e.message:'Não foi possível carregar as reviews.')}finally{if(n===seq.current)setLoading(false)}}
 useEffect(()=>{load()},[status,property,platform,period,rating,debouncedQuery,page]);
 const put=(r:Review)=>{setReviews(l=>l.some(x=>x.id===r.id)?l.map(x=>x.id===r.id?r:x):[r,...l]);setTexts(t=>{const {[r.id]:_,...rest}=t;return rest});load(true)};
 const textOf=(r:Review)=>texts[r.id]??(r.status==='published'?r.reply:r.draft);
 const allCount=REVIEW_STATUSES.reduce((n,s)=>n+(counts[s]||0),0),shown=reviews,pages=Math.max(1,Math.ceil(total/PAGE_SIZE)),current=Math.min(page,pages),pageItems=reviews;
 useEffect(()=>{setPage(1)},[status,property,platform,period,rating,debouncedQuery]);
 /** As notas dependem da escala da plataforma: ao mudar de plataforma, um filtro que já não exista volta a "Todas as notas". */
 const ratingOptions=ratingFilters(platform);
 const changePlatform=(v:string)=>{setPlatform(v);if(rating&&!ratingFilters(v).some(o=>o.value===rating))setRating('')};
 const goTo=(p:number)=>{setPage(Math.min(Math.max(1,p),pages));panelRef.current?.scrollIntoView({block:'start',behavior:'smooth'})};
 async function run(r:Review,kind:string,fn:()=>Promise<{review:Review}>,ok?:string){setBusy(b=>({...b,[r.id]:kind}));try{const d=await fn();put(d.review);if(ok)toast.success(ok)}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível concluir.')}finally{setBusy(b=>{const {[r.id]:_,...rest}=b;return rest})}}
 const draftAi=(r:Review)=>run(r,'ai',()=>call('/api/reviews/draft',{method:'POST',body:JSON.stringify({id:r.id,version:r.version})}),'Rascunho gerado. Revê antes de aprovar.');
 const act=(r:Review,action:string,ok:string,extra:object={})=>run(r,action,()=>call('/api/reviews',{method:'PATCH',body:JSON.stringify({action,id:r.id,version:r.version,...extra})}),ok);
 async function copy(text:string){try{await navigator.clipboard.writeText(text);toast.success('Resposta copiada. Cola-a na plataforma.')}catch{toast.error('Não foi possível copiar.')}}
 async function saveManual(){if(!manual||saving)return;setManualError('');const p=manualReviewSchema.safeParse(manual);if(!p.success){setManualError(p.error.issues[0].message);return}
  setSaving(true);try{const d=await call('/api/reviews',{method:'POST',body:JSON.stringify(p.data)});put(d.review);setManual(null);toast.success('Review adicionada.')}catch(e){setManualError(e instanceof Error?e.message:'Não foi possível guardar.')}finally{setSaving(false)}}
 async function remove(){const r=removing;if(!r)return;try{await call(`/api/reviews?id=${r.id}&version=${r.version}`,{method:'DELETE'});setReviews(l=>l.filter(x=>x.id!==r.id));load(true);toast.success('Review apagada.')}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível apagar.')}finally{setRemoving(null)}}
 const [syncing,setSyncing]=useState(false);
 async function sync(){if(syncing)return;setSyncing(true);try{const d=await call('/api/integrations/google/sync',{method:'POST'});await load();if(d.errors?.length)toast.error(`Sincronizado com erros em ${d.errors.length} alojamento(s): ${d.errors[0].property}: ${d.errors[0].error}`);else toast.success(`Google sincronizado: ${d.added} nova(s), ${d.updated} atualizada(s).`)}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível sincronizar.')}finally{setSyncing(false)}}
 const scale=manual?ratingScale(manual.platform):5;

 return <div className="reviews-area">
 <div className="page-heading"><div><div className="eyebrow">REPUTAÇÃO ONLINE</div><h1>Reviews <span className="heading-counter">{allCount}</span></h1><p>Reviews dos hóspedes e respostas preparadas com IA, sempre aprovadas por uma pessoa.</p></div><div className="heading-actions">{can.sync&&<Button variant="outline" disabled={syncing} onClick={sync}>{syncing?<LoaderCircle className="spin"/>:<RefreshCw/>} Sincronizar Google</Button>}{can.draft&&<Button className="primary-btn" onClick={()=>{setManual(emptyManual());setManualError('')}}><Plus/> Adicionar review</Button>}</div></div>
 {!loading&&!loadError&&<div className="stats review-stats">{(['new','draft','approved','published'] as ReviewStatus[]).map(s=><button key={s} className={'stat review-stat '+(status===s?'on':'')} onClick={()=>setStatus(status===s?'open':s)}><div><span>{STATUS_LABEL[s]}</span><strong>{counts[s]}</strong></div></button>)}</div>}
 {!ai.ready&&!loading&&!loadError&&can.draft&&<div className="cap-note" role="status"><TriangleAlert size={16}/><span>A geração de respostas com IA ainda não está ativa: um administrador tem de registar a chave do <strong>{ai.label||'fornecedor de IA'}</strong> em Integrações. Podes adicionar reviews e escrever respostas à mão.</span></div>}
 {loading?<div className="loading-list"><Skeleton className="h-40"/><Skeleton className="h-40"/></div>
 :loadError?<div className="error-banner" role="alert">{loadError}<Button variant="outline" onClick={()=>load()}>Tentar novamente</Button></div>
 :<section className="panel review-panel" ref={panelRef}>
  <div className="review-filters"><div className="bar-search"><Search size={14}/><Input aria-label="Pesquisar reviews" value={query} placeholder="Pesquisar" onChange={e=>setQuery(e.target.value)}/></div>
   <select aria-label="Estado" value={status} onChange={e=>setStatus(e.target.value as ReviewStatus|'open'|'')}><option value="open">Por tratar</option><option value="">Todos os estados</option>{REVIEW_STATUSES.map(s=><option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
   <select aria-label="Alojamento" value={property} onChange={e=>setProperty(e.target.value)}><option value="">Todos os alojamentos</option>{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
   <select aria-label="Plataforma" value={platform} onChange={e=>changePlatform(e.target.value)}><option value="">Todas as plataformas</option>{REVIEW_PLATFORMS.map(p=><option key={p}>{p}</option>)}</select>
   <select aria-label="Data" value={period} onChange={e=>setPeriod(e.target.value)}><option value="">Qualquer data</option>{REVIEW_PERIODS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
   <select aria-label="Nota" value={rating} onChange={e=>setRating(e.target.value)}><option value="">Todas as notas</option>{ratingOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
  {!shown.length?<Empty className="main-empty"><EmptyHeader><EmptyMedia className="empty-hotel"><MessageSquareQuote size={34}/></EmptyMedia><EmptyTitle>{allCount?'Nada para mostrar com estes filtros':'Ainda não há reviews'}</EmptyTitle><EmptyDescription>{allCount?'Muda os filtros para veres outras reviews.':'Quando a conta Google estiver ligada, as reviews aparecem aqui automaticamente. Até lá, podes adicionar reviews à mão.'}</EmptyDescription></EmptyHeader></Empty>
  :<><div className="review-list">{pageItems.map(r=>{const b=busy[r.id],text=textOf(r),neg=isNegative(r),published=r.status==='published',locked=published||!can.draft;
   return <article key={r.id} className={'review-card '+(neg?'negative':'')}>
    <header className="review-head"><div><strong>{r.propertyName}</strong><span>{r.platform} · {r.author||'Hóspede'} · {fmtDate(r.reviewDate)}</span></div><div className="review-meta">{r.rating!==null&&<span className={'review-rating '+(neg?'bad':'')}><Star size={13}/> {r.rating}/{ratingScale(r.platform)}</span>}<span className={'review-status s-'+r.status}>{STATUS_LABEL[r.status]}</span>{can.approve&&r.source==='manual'&&<Button variant="ghost" size="icon" aria-label="Apagar review" onClick={()=>setRemoving(r)}><Trash2/></Button>}</div></header>
    <p className="review-body">{r.body}</p>
    <div className="review-reply"><label htmlFor={'reply-'+r.id}>{published?'Resposta publicada':'Resposta'}{r.draftedBy.startsWith('IA')&&!published&&<em> · gerada com {r.draftedBy.replace(/^IA ?·? ?/,'')||'IA'}, revê antes de aprovar</em>}</label>
     <Textarea id={'reply-'+r.id} value={text} readOnly={locked||r.status==='approved'} placeholder={can.draft?'Escreve a resposta ou gera um rascunho com IA.':'Ainda sem resposta.'} onChange={e=>setTexts(t=>({...t,[r.id]:e.target.value}))} rows={5}/>
     {r.status==='approved'&&<p className="review-note"><ShieldCheck size={14}/> Aprovada por {r.approvedBy}{r.approvedAt?` em ${fmtDate(r.approvedAt)}`:''}. {r.source==='google'?'Pronta a publicar no Google.':'Copia e publica na plataforma.'}</p>}
     <div className="review-actions">
      {!published&&r.status!=='approved'&&can.draft&&<><Button variant="outline" disabled={!!b||!ai.ready} title={ai.ready?`Rascunho gerado com ${ai.label}`:undefined} onClick={()=>draftAi(r)}>{b==='ai'?<LoaderCircle className="spin"/>:<Sparkles/>} {r.draft?'Gerar de novo':'Gerar resposta com IA'}</Button>
       <Button variant="outline" disabled={!!b||text===r.draft} onClick={()=>act(r,'save','Rascunho guardado.',{draft:text})}>{b==='save'?<LoaderCircle className="spin"/>:<Save/>} Guardar rascunho</Button>
       {can.approve&&<Button className="primary-btn" disabled={!!b||!text.trim()} onClick={()=>act(r,'approve','Resposta aprovada.',{draft:text})}>{b==='approve'?<LoaderCircle className="spin"/>:<Check/>} Aprovar</Button>}</>}
      {r.status==='approved'&&<>{r.source!=='google'&&<Button variant="outline" onClick={()=>copy(r.draft)}><Copy/> Copiar resposta</Button>}{can.approve&&<><Button variant="outline" disabled={!!b} onClick={()=>act(r,'reopen','Resposta reaberta para edição.')}><RotateCcw/> Editar</Button><Button className="primary-btn" disabled={!!b} onClick={()=>act(r,'published',r.source==='google'?'Resposta publicada no Google.':'Marcada como respondida.')}>{b==='published'?<LoaderCircle className="spin"/>:<Send/>} {r.source==='google'?'Publicar no Google':'Marcar como publicada'}</Button></>}</>}
      {published&&can.approve&&<Button variant="outline" disabled={!!b} onClick={()=>act(r,'reopen','Review reaberta.')}><RotateCcw/> Reabrir</Button>}
     </div></div>
   </article>})}</div>
  {total>PAGE_SIZE&&<nav className="review-pager" aria-label="Paginação das reviews"><span className="review-pager-info">A mostrar {(current-1)*PAGE_SIZE+1}–{Math.min(current*PAGE_SIZE,total)} de {total}</span><div className="review-pager-pages"><Button variant="outline" size="sm" disabled={current===1} onClick={()=>goTo(current-1)}><ChevronLeft/> Anterior</Button>{pageList(current,pages).map((p,i)=>p==='…'?<span key={'gap'+i} className="review-pager-gap">…</span>:<Button key={p} size="sm" variant={p===current?'default':'outline'} className={p===current?'primary-btn':''} aria-current={p===current?'page':undefined} aria-label={'Página '+p} onClick={()=>goTo(p)}>{p}</Button>)}<Button variant="outline" size="sm" disabled={current===pages} onClick={()=>goTo(current+1)}>Seguinte <ChevronRight/></Button></div></nav>}</>}
 </section>}
 <Dialog open={!!manual} onOpenChange={v=>{if(!v&&!saving)setManual(null)}}><DialogContent className="tool-dialog" aria-describedby="review-add-desc"><DialogHeader><DialogTitle>Adicionar review</DialogTitle><DialogDescription id="review-add-desc">Para plataformas sem integração. Copia a review da extranet e cola-a aqui.</DialogDescription></DialogHeader>
  {manual&&<><fieldset disabled={saving} className="tool-form"><div className="form-grid">
   <div className="field wide"><label htmlFor="rv-prop">Alojamento <span className="required">*</span></label><select id="rv-prop" className="native-select" value={manual.propertyId} onChange={e=>setManual({...manual,propertyId:e.target.value})}><option value="">Selecionar</option>{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
   <Field label="Plataforma" value={manual.platform} options={[...REVIEW_PLATFORMS]} onChange={v=>setManual({...manual,platform:v,rating:manual.rating!==null&&manual.rating>ratingScale(v)?null:manual.rating})}/>
   <Field label={`Pontuação (1 a ${scale})`} value={manual.rating===null?'Sem pontuação':String(manual.rating)} options={['Sem pontuação',...Array.from({length:scale},(_,i)=>String(i+1))]} onChange={v=>setManual({...manual,rating:v==='Sem pontuação'?null:Number(v)})}/>
   <Field label="Nome do hóspede" value={manual.author} onChange={v=>setManual({...manual,author:v})} placeholder="Ex.: Maria S."/>
   <Field label="Data da review" type="date" value={manual.reviewDate} onChange={v=>setManual({...manual,reviewDate:v})}/>
   <Field label="Texto da review" required area value={manual.body} onChange={v=>setManual({...manual,body:v})} placeholder="Cola aqui o texto completo, incluindo pontos positivos e negativos."/></div></fieldset>
  {manualError&&<div className="error-banner" role="alert">{manualError}</div>}
  <div className="settings-actions"><span/><div><Button variant="outline" disabled={saving} onClick={()=>setManual(null)}>Cancelar</Button><Button className="primary-btn" disabled={saving} onClick={saveManual}>{saving?<LoaderCircle className="spin"/>:<Save/>} Adicionar</Button></div></div></>}</DialogContent></Dialog>
 <AlertDialog open={!!removing} onOpenChange={v=>{if(!v)setRemoving(null)}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Apagar review?</AlertDialogTitle><AlertDialogDescription>A review de {removing?.author||'hóspede'} e a resposta associada são apagadas do hub. Não afeta a plataforma.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="confirm-action" onClick={e=>{e.preventDefault();remove()}}>Apagar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>
}
