"use client";
import {useEffect,useMemo,useState} from 'react';
import {Star,Sparkles,Save,Check,Copy,LoaderCircle,Plus,Trash2,RotateCcw,Send,Search,MessageSquareQuote,TriangleAlert,ShieldCheck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {Empty,EmptyHeader,EmptyTitle,EmptyDescription,EmptyMedia} from '@/components/ui/empty';
import {Skeleton} from '@/components/ui/skeleton';
import {Field} from '@/components/hub-fields';
import {toast} from 'sonner';
import {REVIEW_PLATFORMS,REVIEW_STATUSES,STATUS_LABEL,manualReviewSchema,ratingScale,isNegative,type Review,type ReviewStatus,type ManualReview} from '@/lib/review';
type Can={draft:boolean,approve:boolean};
type Prop={id:string,name:string};
const fmtDate=(d:string)=>{const t=Date.parse(d);return isNaN(t)?d:new Date(t).toLocaleDateString('pt-PT',{day:'numeric',month:'short',year:'numeric'})};
const emptyManual=():ManualReview=>({propertyId:'',platform:'Booking.com',author:'',rating:null,body:'',reviewDate:new Date().toISOString().slice(0,10)});
async function call(url:string,init:RequestInit):Promise<any>{const r=await fetch(url,{...init,headers:{'Content-Type':'application/json'}});const data:any=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Não foi possível concluir o pedido.');return data}

export default function Reviews(){
 const [reviews,setReviews]=useState<Review[]>([]),[properties,setProperties]=useState<Prop[]>([]),[can,setCan]=useState<Can>({draft:false,approve:false}),[aiReady,setAiReady]=useState(false);
 const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
 const [status,setStatus]=useState<ReviewStatus|'open'|''>('open'),[property,setProperty]=useState(''),[platform,setPlatform]=useState(''),[query,setQuery]=useState('');
 const [texts,setTexts]=useState<Record<string,string>>({}),[busy,setBusy]=useState<Record<string,string>>({});
 const [manual,setManual]=useState<ManualReview|null>(null),[manualError,setManualError]=useState(''),[saving,setSaving]=useState(false),[removing,setRemoving]=useState<Review|null>(null);
 async function load(){setLoading(true);setLoadError('');try{const d=await call('/api/reviews',{method:'GET'});setReviews(d.reviews);setProperties(d.properties);setCan(d.can);setAiReady(d.aiReady)}catch(e){setLoadError(e instanceof Error?e.message:'Não foi possível carregar as reviews.')}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 const put=(r:Review)=>{setReviews(l=>l.some(x=>x.id===r.id)?l.map(x=>x.id===r.id?r:x):[r,...l]);setTexts(t=>{const {[r.id]:_,...rest}=t;return rest})};
 const textOf=(r:Review)=>texts[r.id]??(r.status==='published'?r.reply:r.draft);
 const counts=useMemo(()=>Object.fromEntries(REVIEW_STATUSES.map(s=>[s,reviews.filter(r=>r.status===s).length])) as Record<ReviewStatus,number>,[reviews]);
 const shown=useMemo(()=>{const q=query.trim().toLowerCase();return reviews.filter(r=>(!status||(status==='open'?r.status!=='published':r.status===status))&&(!property||r.propertyId===property)&&(!platform||r.platform===platform)&&(!q||`${r.author} ${r.body} ${r.propertyName}`.toLowerCase().includes(q)))
  .sort((a,b)=>(a.status==='published'?1:0)-(b.status==='published'?1:0)||(isNegative(b)?1:0)-(isNegative(a)?1:0)||b.reviewDate.localeCompare(a.reviewDate))},[reviews,status,property,platform,query]);
 async function run(r:Review,kind:string,fn:()=>Promise<{review:Review}>,ok?:string){setBusy(b=>({...b,[r.id]:kind}));try{const d=await fn();put(d.review);if(ok)toast.success(ok)}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível concluir.')}finally{setBusy(b=>{const {[r.id]:_,...rest}=b;return rest})}}
 const draftAi=(r:Review)=>run(r,'ai',()=>call('/api/reviews/draft',{method:'POST',body:JSON.stringify({id:r.id,version:r.version})}),'Rascunho gerado. Revê antes de aprovar.');
 const act=(r:Review,action:string,ok:string,extra:object={})=>run(r,action,()=>call('/api/reviews',{method:'PATCH',body:JSON.stringify({action,id:r.id,version:r.version,...extra})}),ok);
 async function copy(text:string){try{await navigator.clipboard.writeText(text);toast.success('Resposta copiada. Cola-a na plataforma.')}catch{toast.error('Não foi possível copiar.')}}
 async function saveManual(){if(!manual||saving)return;setManualError('');const p=manualReviewSchema.safeParse(manual);if(!p.success){setManualError(p.error.issues[0].message);return}
  setSaving(true);try{const d=await call('/api/reviews',{method:'POST',body:JSON.stringify(p.data)});put(d.review);setManual(null);toast.success('Review adicionada.')}catch(e){setManualError(e instanceof Error?e.message:'Não foi possível guardar.')}finally{setSaving(false)}}
 async function remove(){const r=removing;if(!r)return;try{await call(`/api/reviews?id=${r.id}&version=${r.version}`,{method:'DELETE'});setReviews(l=>l.filter(x=>x.id!==r.id));toast.success('Review apagada.')}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível apagar.')}finally{setRemoving(null)}}
 const scale=manual?ratingScale(manual.platform):5;

 return <div className="reviews-area">
 <div className="page-heading"><div><div className="eyebrow">REPUTAÇÃO ONLINE</div><h1>Reviews <span className="heading-counter">{reviews.length}</span></h1><p>Reviews dos hóspedes e respostas preparadas com IA, sempre aprovadas por uma pessoa.</p></div>{can.draft&&<Button className="primary-btn" onClick={()=>{setManual(emptyManual());setManualError('')}}><Plus/> Adicionar review</Button>}</div>
 {!loading&&!loadError&&<div className="stats review-stats">{(['new','draft','approved','published'] as ReviewStatus[]).map(s=><button key={s} className={'stat review-stat '+(status===s?'on':'')} onClick={()=>setStatus(status===s?'open':s)}><div><span>{STATUS_LABEL[s]}</span><strong>{counts[s]}</strong></div></button>)}</div>}
 {!aiReady&&!loading&&!loadError&&can.draft&&<div className="cap-note" role="status"><TriangleAlert size={16}/><span>A geração de respostas com IA ainda não está ativa: falta configurar a <strong>ANTHROPIC_API_KEY</strong> no servidor. Podes adicionar reviews e escrever respostas à mão.</span></div>}
 {loading?<div className="loading-list"><Skeleton className="h-40"/><Skeleton className="h-40"/></div>
 :loadError?<div className="error-banner" role="alert">{loadError}<Button variant="outline" onClick={load}>Tentar novamente</Button></div>
 :<section className="panel review-panel">
  <div className="review-filters"><div className="bar-search"><Search size={14}/><Input aria-label="Pesquisar reviews" value={query} placeholder="Pesquisar" onChange={e=>setQuery(e.target.value)}/></div>
   <select aria-label="Estado" value={status} onChange={e=>setStatus(e.target.value as ReviewStatus|'open'|'')}><option value="open">Por tratar</option><option value="">Todos os estados</option>{REVIEW_STATUSES.map(s=><option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
   <select aria-label="Alojamento" value={property} onChange={e=>setProperty(e.target.value)}><option value="">Todos os alojamentos</option>{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
   <select aria-label="Plataforma" value={platform} onChange={e=>setPlatform(e.target.value)}><option value="">Todas as plataformas</option>{REVIEW_PLATFORMS.map(p=><option key={p}>{p}</option>)}</select></div>
  {!shown.length?<Empty className="main-empty"><EmptyHeader><EmptyMedia className="empty-hotel"><MessageSquareQuote size={34}/></EmptyMedia><EmptyTitle>{reviews.length?'Nada para mostrar com estes filtros':'Ainda não há reviews'}</EmptyTitle><EmptyDescription>{reviews.length?'Muda os filtros para veres outras reviews.':'Quando a conta Google estiver ligada, as reviews aparecem aqui automaticamente. Até lá, podes adicionar reviews à mão.'}</EmptyDescription></EmptyHeader></Empty>
  :<div className="review-list">{shown.map(r=>{const b=busy[r.id],text=textOf(r),neg=isNegative(r),published=r.status==='published',locked=published||!can.draft;
   return <article key={r.id} className={'review-card '+(neg?'negative':'')}>
    <header className="review-head"><div><strong>{r.propertyName}</strong><span>{r.platform} · {r.author||'Hóspede'} · {fmtDate(r.reviewDate)}</span></div><div className="review-meta">{r.rating!==null&&<span className={'review-rating '+(neg?'bad':'')}><Star size={13}/> {r.rating}/{ratingScale(r.platform)}</span>}<span className={'review-status s-'+r.status}>{STATUS_LABEL[r.status]}</span>{can.approve&&r.source==='manual'&&<Button variant="ghost" size="icon" aria-label="Apagar review" onClick={()=>setRemoving(r)}><Trash2/></Button>}</div></header>
    <p className="review-body">{r.body}</p>
    <div className="review-reply"><label htmlFor={'reply-'+r.id}>{published?'Resposta publicada':'Resposta'}{r.draftedBy==='IA'&&!published&&<em> · gerada com IA, revê antes de aprovar</em>}</label>
     <Textarea id={'reply-'+r.id} value={text} readOnly={locked||r.status==='approved'} placeholder={can.draft?'Escreve a resposta ou gera um rascunho com IA.':'Ainda sem resposta.'} onChange={e=>setTexts(t=>({...t,[r.id]:e.target.value}))} rows={5}/>
     {r.status==='approved'&&<p className="review-note"><ShieldCheck size={14}/> Aprovada por {r.approvedBy}{r.approvedAt?` em ${fmtDate(r.approvedAt)}`:''}. Copia e publica na plataforma.</p>}
     <div className="review-actions">
      {!published&&r.status!=='approved'&&can.draft&&<><Button variant="outline" disabled={!!b||!aiReady} onClick={()=>draftAi(r)}>{b==='ai'?<LoaderCircle className="spin"/>:<Sparkles/>} {r.draft?'Gerar de novo':'Gerar resposta com IA'}</Button>
       <Button variant="outline" disabled={!!b||text===r.draft} onClick={()=>act(r,'save','Rascunho guardado.',{draft:text})}>{b==='save'?<LoaderCircle className="spin"/>:<Save/>} Guardar rascunho</Button>
       {can.approve&&<Button className="primary-btn" disabled={!!b||!text.trim()} onClick={()=>act(r,'approve','Resposta aprovada.',{draft:text})}>{b==='approve'?<LoaderCircle className="spin"/>:<Check/>} Aprovar</Button>}</>}
      {r.status==='approved'&&<><Button variant="outline" onClick={()=>copy(r.draft)}><Copy/> Copiar resposta</Button>{can.approve&&<><Button variant="outline" disabled={!!b} onClick={()=>act(r,'reopen','Resposta reaberta para edição.')}><RotateCcw/> Editar</Button><Button className="primary-btn" disabled={!!b} onClick={()=>act(r,'published','Marcada como respondida.')}>{b==='published'?<LoaderCircle className="spin"/>:<Send/>} Marcar como publicada</Button></>}</>}
      {published&&can.approve&&<Button variant="outline" disabled={!!b} onClick={()=>act(r,'reopen','Review reaberta.')}><RotateCcw/> Reabrir</Button>}
     </div></div>
   </article>})}</div>}
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
