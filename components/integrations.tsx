"use client";
import {useEffect,useState} from 'react';
import {Sparkles,CheckCircle2,CircleDashed,ShieldCheck,KeyRound,LoaderCircle,Save,Trash2,Eye,EyeOff,TriangleAlert} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Skeleton} from '@/components/ui/skeleton';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {toast} from 'sonner';
import IntegrationsPanel from '@/components/integrations-panel';

type Provider={id:string,label:string,env:string,configured:boolean,source:'hub'|'env'|null,hint:string,savedBy:string,savedAt:string|null,model:string};
type Ai={providers:Provider[],canStore:boolean,uses:{feature:string,provider:string,env:string}[]};
const WHERE:Record<string,string>={gemini:'aistudio.google.com → Get API key',claude:'console.anthropic.com → API Keys'};
const fmt=(d:string|null)=>d?new Date(d).toLocaleString('pt-PT',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
async function call(url:string,init?:RequestInit):Promise<any>{const r=await fetch(url,{...init,headers:{'Content-Type':'application/json'}});const d:any=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Não foi possível concluir o pedido.');return d}

/** Linha de um fornecedor: estado + campo para registar a chave (cifrada no servidor, nunca devolvida). */
function ProviderRow({p,canStore,onChange}:{p:Provider,canStore:boolean,onChange:(ai:Ai)=>void}){
 const [editing,setEditing]=useState(false),[key,setKey]=useState(''),[show,setShow]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[confirm,setConfirm]=useState(false);
 const open=editing||!p.configured;
 async function save(){if(!key.trim()){setError('Cola a chave.');return}setBusy('save');setError('');try{const d=await call('/api/integrations/ai',{method:'PUT',body:JSON.stringify({provider:p.id,key:key.trim()})});setKey('');setShow(false);setEditing(false);onChange(d.ai);toast.success(`Chave do ${p.label} validada e guardada cifrada.`)}catch(e){setError(e instanceof Error?e.message:'Erro.')}finally{setBusy('')}}
 async function remove(){setBusy('del');try{const d=await call(`/api/integrations/ai?provider=${p.id}`,{method:'DELETE'});onChange(d.ai);toast.success(`Chave do ${p.label} removida.`)}catch(e){toast.error(e instanceof Error?e.message:'Erro.')}finally{setBusy('');setConfirm(false)}}
 return <div className="ai-provider">
  <div className="ai-provider-head">
   {p.configured?<CheckCircle2 size={18} className="ok"/>:<CircleDashed size={18} className="off"/>}
   <div><strong>{p.label}</strong><span>{p.source==='hub'?<>Chave guardada no hub (cifrada) · termina em <code>{p.hint}</code>{p.savedBy&&` · por ${p.savedBy}`}{p.savedAt&&` · ${fmt(p.savedAt)}`}</>:p.source==='env'?<>Chave definida no servidor (<code>{p.env}</code>)</>:'Sem chave registada'}{p.configured&&<> · modelo {p.model}</>}</span></div>
   <span className={'status '+(p.configured?'ativo':'inativo')}>{p.configured?'Ativo':'Por configurar'}</span>
  </div>
  {canStore&&(open?<div className="ai-key-form">
   <label htmlFor={'key-'+p.id}>{p.configured?'Nova chave':'Chave de API'} <span>· obtém em {WHERE[p.id]}</span></label>
   <div className="ai-key-input">
    <div className="ai-key-field"><Input id={'key-'+p.id} type={show?'text':'password'} value={key} autoComplete="off" spellCheck={false} maxLength={400} placeholder="Cola aqui a chave" disabled={!!busy} aria-invalid={!!error} onChange={e=>{setKey(e.target.value);setError('')}} onKeyDown={e=>{if(e.key==='Enter')save()}}/>
     <Button type="button" variant="ghost" size="icon" aria-label={show?'Esconder chave':'Mostrar chave'} onClick={()=>setShow(s=>!s)}>{show?<EyeOff/>:<Eye/>}</Button></div>
    <Button className="primary-btn" disabled={!!busy||!key.trim()} onClick={save}>{busy==='save'?<LoaderCircle className="spin"/>:<Save/>} {busy==='save'?'A validar…':'Validar e guardar'}</Button>
    {p.configured&&<Button variant="outline" disabled={!!busy} onClick={()=>{setEditing(false);setKey('');setError('')}}>Cancelar</Button>}
   </div>
   {error&&<p className="field-error" role="alert">{error}</p>}
  </div>
  :<div className="ai-key-actions"><Button variant="outline" size="sm" onClick={()=>setEditing(true)}><KeyRound/> {p.source==='hub'?'Substituir chave':'Registar chave no hub'}</Button>{p.source==='hub'&&<Button variant="ghost" size="sm" className="danger-link" disabled={!!busy} onClick={()=>setConfirm(true)}><Trash2/> Remover</Button>}</div>)}
  <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remover a chave do {p.label}?</AlertDialogTitle><AlertDialogDescription>A chave é apagada do hub. As funcionalidades que usam o {p.label} deixam de gerar rascunhos até registares outra chave.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="confirm-action" onClick={e=>{e.preventDefault();remove()}}>Remover</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>
}

/** Separador só para administradores: contas externas (Google) e fornecedores de IA. Nunca mostra chaves. */
export default function Integrations(){
 const [ai,setAi]=useState<Ai|null>(null),[error,setError]=useState('');
 async function load(){setError('');try{const d=await call('/api/integrations');setAi(d.ai)}catch(e){setError(e instanceof Error?e.message:'Erro.')}}
 useEffect(()=>{load()},[]);
 const label=(id:string)=>ai?.providers.find(p=>p.id===id)?.label||id;

 return <div className="integrations-area">
  <div className="page-heading"><div><div className="eyebrow">ADMINISTRAÇÃO</div><h1>Integrações</h1><p>Contas externas e serviços de IA ligados ao hub. Só os administradores veem este separador.</p></div></div>
  <section className="panel form-panel integrations-panel"><IntegrationsPanel/></section>
  <section className="panel form-panel integrations-panel"><div className="settings-block"><h4><Sparkles size={16}/> Inteligência artificial</h4><p>Fornecedores usados para preparar rascunhos. Nenhuma resposta é publicada sem aprovação humana.</p>
   {error?<div className="error-banner" role="alert">{error}<Button variant="outline" onClick={load}>Tentar novamente</Button></div>
   :!ai?<Skeleton className="h-24"/>
   :<>
    {!ai.canStore&&<p className="settings-note warn"><TriangleAlert size={15}/>Falta a INTEGRATIONS_KEY no servidor: sem ela o hub não consegue cifrar chaves.</p>}
    <div className="ai-providers">{ai.providers.map(p=><ProviderRow key={p.id} p={p} canStore={ai.canStore} onChange={setAi}/>)}</div>
    <div className="ai-uses"><h5>Quem usa o quê</h5>{ai.uses.map(u=><div key={u.feature}><span>{u.feature}</span><strong>{label(u.provider)}</strong><code>{u.env}</code></div>)}</div>
    <p className="settings-note"><ShieldCheck size={15}/>Antes de guardar, o hub testa a chave junto do fornecedor. Fica cifrada (AES-256) na base de dados, só é usada no servidor e nunca volta a ser mostrada: aparecem apenas os últimos 4 caracteres.</p>
   </>}
  </div></section>
 </div>
}
