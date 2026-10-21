"use client";
import {useEffect,useMemo,useState} from 'react';
import {Bell,ArrowLeft,Check,X,LoaderCircle,ShieldAlert,Clock,User,Hotel,Building2,Megaphone,Network,Handshake,Wrench} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Empty,EmptyHeader,EmptyTitle,EmptyDescription,EmptyMedia} from '@/components/ui/empty';
import {Skeleton} from '@/components/ui/skeleton';
import {toast} from 'sonner';
import {ENTITY_LABEL,diffFields,type ChangeRequest,type EntityType,type FieldDiff} from '@/lib/change-request';
import type {Me} from '@/lib/access';

const ICON:Record<EntityType,any>={property:Hotel,corporate:Building2,campaign:Megaphone,operator:Network,collaborator:Handshake,tool:Wrench};
const LIST_ENDPOINT:Record<EntityType,(payload:Record<string,unknown>|null)=>string>={
 property:()=>'/api/properties',corporate:()=>'/api/corporates',campaign:()=>'/api/campaigns',operator:()=>'/api/operators',
 collaborator:p=>`/api/collaborators?kind=${(p?.kind as string)||'partner'}`,tool:()=>'/api/tools',
};
const LIST_KEY:Record<EntityType,string>={property:'properties',corporate:'corporates',campaign:'campaigns',operator:'operators',collaborator:'collaborators',tool:'tools'};
const FIELD_LABEL:Record<string,string>={name:'Nome',code:'Código',license:'Registo / licença',status:'Estado',email:'Email',phone:'Telefone',website:'Website',commission:'Comissão',commissionType:'Modelo de comissão',discount:'Desconto',discountType:'Tipo de desconto',promoCode:'Código promocional',start:'Início',end:'Fim',contractStart:'Início do contrato',contractEnd:'Fim do contrato',notes:'Notas',description:'Descrição',city:'Localidade',region:'Região',address:'Morada',postal:'Código postal',type:'Tipo',category:'Categoria',kind:'Tipo',contactName:'Contacto',contactRole:'Cargo do contacto',contactEmail:'Email de contacto',contactPhone:'Telefone de contacto',billingEmail:'Email de faturação',billingDetails:'Dados de faturação',legalName:'Denominação social',taxId:'NIF / VAT',sector:'Setor',agreementName:'Designação do acordo',propertyIds:'Alojamentos',rateIds:'Tarifas',operatorIds:'Operadores',partnerOperatorIds:'Operadores parceiros',rooms:'Tipologias',rates:'Tarifas',units:'Quartos',amenities:'Comodidades',policies:'Regras',url:'Link',driveUrl:'Fotos',reviewLink:'Reviews',extranetUrl:'Link da extranet',reservationsEmail:'Email de reservas',financeEmail:'Email financeiro',country:'País',propertyScope:'Âmbito de alojamentos',propertyCodes:'IDs no operador'};
const fieldLabel=(k:string)=>FIELD_LABEL[k]||k;
const fmt=(v:unknown)=>v===undefined?'—':v===''?'(vazio)':v===null?'(vazio)':typeof v==='boolean'?(v?'Sim':'Não'):String(v);
const stamp=(iso:string)=>{const d=new Date(iso);return `${d.toLocaleDateString('pt-PT',{day:'2-digit',month:'2-digit',year:'numeric'})} · ${d.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'})}`};

export default function ChangeRequestsPanel({open,onOpenChange,me,onDecided}:{open:boolean,onOpenChange:(v:boolean)=>void,me:Me,onDecided?:()=>void}){
 const canReview=me.isAdmin||Object.values(me.areas).some(l=>l==='edit');
 const [tab,setTab]=useState<'review'|'mine'>(canReview?'review':'mine');
 const [items,setItems]=useState<ChangeRequest[]>([]),[loading,setLoading]=useState(false),[loadError,setLoadError]=useState('');
 const [selected,setSelected]=useState<ChangeRequest|null>(null),[current,setCurrent]=useState<Record<string,unknown>|null|undefined>(undefined);
 const [note,setNote]=useState(''),[busy,setBusy]=useState(false);
 async function load(){setLoading(true);setLoadError('');try{const r=await fetch('/api/change-requests',{cache:'no-store'});const data:{requests?:ChangeRequest[],error?:string}=await r.json();if(!r.ok||!data.requests)throw Error(data.error);setItems(data.requests)}catch(e){setLoadError(e instanceof Error?e.message:'Não foi possível carregar os pedidos.')}finally{setLoading(false)}}
 useEffect(()=>{if(open){load();setSelected(null);setNote('')}},[open]);
 async function openDetail(cr:ChangeRequest){setSelected(cr);setNote('');setCurrent(undefined);
  if(cr.action==='delete'){setCurrent(null);return}
  try{const r=await fetch(LIST_ENDPOINT[cr.entityType](cr.payload),{cache:'no-store'});const data:any=await r.json();const list=data[LIST_KEY[cr.entityType]]||[];setCurrent(list.find((x:any)=>x.id===cr.entityId)||null)}catch{setCurrent(null)}}
 async function decide(decision:'approve'|'reject'){if(!selected||busy)return;setBusy(true);try{const r=await fetch(`/api/change-requests/${selected.id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,note:note.trim()||undefined})});const data:{error?:string}=await r.json();if(!r.ok)throw Error(data.error);toast.success(decision==='approve'?'Alteração aprovada.':'Pedido rejeitado.');setSelected(null);await load();onDecided?.()}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível concluir a decisão.')}finally{setBusy(false)}}
 const reviewable=useMemo(()=>items.filter(r=>r.status==='pending'&&(me.isAdmin||me.areas[r.area]==='edit')),[items,me]);
 const mine=useMemo(()=>items.filter(r=>r.requestedByEmail===me.email),[items,me]);
 const shown=tab==='review'?reviewable:mine;
 const diffs:FieldDiff[]=selected&&selected.action==='save'&&current!==undefined&&selected.payload?diffFields(current,selected.payload):[];
 const canDecide=selected&&selected.status==='pending'&&(me.isAdmin||me.areas[selected.area]==='edit');
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="settings-dialog" aria-describedby="cr-desc">
  <DialogHeader><DialogTitle>Pedidos de alteração</DialogTitle><DialogDescription id="cr-desc">Propostas de contribuidores que aguardam, ou já tiveram, uma decisão.</DialogDescription></DialogHeader>
  {!selected?<div className="settings-body">
   <Tabs value={tab} onValueChange={v=>setTab(v as 'review'|'mine')}><TabsList className="editor-tabs cr-tabs">{canReview&&<TabsTrigger value="review">A rever<span>{reviewable.length}</span></TabsTrigger>}<TabsTrigger value="mine">As minhas propostas<span>{mine.filter(m=>m.status==='pending').length}</span></TabsTrigger></TabsList></Tabs>
   {loading?<div className="loading-list"><Skeleton className="h-16"/><Skeleton className="h-16"/></div>:loadError?<div className="error-banner" role="alert">{loadError}<Button variant="outline" onClick={load}>Tentar novamente</Button></div>
   :shown.length?<div className="member-rows cr-rows">{shown.map(cr=>{const Icon=ICON[cr.entityType],label=cr.action==='delete'?'Eliminação':cr.baseVersion===0?'Novo registo':'Alteração';return <button key={cr.id} className="member-row" onClick={()=>openDetail(cr)}><span className="member-avatar"><Icon size={17}/></span><span className="member-id"><strong>{cr.entityName}</strong><span>{ENTITY_LABEL[cr.entityType]} · {label}{tab==='review'&&` · ${cr.requestedByName}`}</span><small>{stamp(cr.requestedAt)}</small></span><span className={'status '+(cr.status==='pending'?'rascunho':cr.status==='approved'?'ativo':'inativo')}>{cr.status==='pending'?'Pendente':cr.status==='approved'?'Aprovado':'Rejeitado'}</span></button>})}</div>
   :<div className="settings-empty"><Bell size={26}/><strong>{tab==='review'?'Sem pedidos para rever':'Ainda não propuseste alterações'}</strong><span>{tab==='review'?'Quando um contribuidor propuser uma alteração numa área que edites, aparece aqui.':'As propostas que fizeres ficam aqui, com o respetivo estado.'}</span></div>}
  </div>
  :<div className="settings-body">
   <button className="back-link" onClick={()=>setSelected(null)}><ArrowLeft size={16}/> Todos os pedidos</button>
   <div className="cr-detail-head"><h3>{selected.entityName}</h3><span className={'status '+(selected.status==='pending'?'rascunho':selected.status==='approved'?'ativo':'inativo')}>{selected.status==='pending'?'Pendente':selected.status==='approved'?'Aprovado':'Rejeitado'}</span></div>
   <p className="settings-note"><User size={15}/>{ENTITY_LABEL[selected.entityType]} · {selected.action==='delete'?'Eliminação':selected.baseVersion===0?'Novo registo':'Alteração'} · proposto por {selected.requestedByName} em {stamp(selected.requestedAt)}</p>
   {selected.reviewedAt&&<p className="settings-note"><ShieldAlert size={15}/>{selected.status==='approved'?'Aprovado':'Rejeitado'} por {selected.reviewedByName} em {stamp(selected.reviewedAt)}{selected.reviewNote&&`: “${selected.reviewNote}”`}</p>}
   {selected.action==='delete'?<div className="error-banner" role="alert">Este pedido elimina definitivamente o registo, incluindo tudo o que está ligado a ele.</div>
   :current===undefined?<div className="loading-list"><Skeleton className="h-24"/></div>
   :!diffs.length?<p className="form-footnote">Sem alterações de campos para mostrar.</p>
   :<div className="cr-diff"><table className="results-table"><thead><tr><th>Campo</th><th>Atual</th><th>Proposto</th></tr></thead><tbody>{diffs.map(d=><tr key={d.key}><td>{fieldLabel(d.key)}</td><td className="cr-before">{fmt(d.before)}</td><td className="cr-after">{fmt(d.after)}</td></tr>)}</tbody></table></div>}
   {canDecide&&<div className="cr-decide"><label htmlFor="cr-note" className="field-label">Nota (opcional)</label><Textarea id="cr-note" value={note} maxLength={500} placeholder="Visível para quem propôs a alteração." onChange={e=>setNote(e.target.value)}/>
    <div className="cr-decide-actions"><Button variant="outline" disabled={busy} onClick={()=>decide('reject')}>{busy?<LoaderCircle className="spin"/>:<X/>} Rejeitar</Button><Button className="primary-btn" disabled={busy} onClick={()=>decide('approve')}>{busy?<LoaderCircle className="spin"/>:<Check/>} Aprovar</Button></div></div>}
  </div>}
 </DialogContent></Dialog>
}
