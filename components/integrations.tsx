"use client";
import {useEffect,useState} from 'react';
import {Sparkles,CheckCircle2,CircleDashed,ShieldCheck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Skeleton} from '@/components/ui/skeleton';
import IntegrationsPanel from '@/components/integrations-panel';

type Ai={providers:{id:string,label:string,key:string,configured:boolean,model:string}[],uses:{feature:string,provider:string,env:string}[]};

/** Separador só para administradores: contas externas (Google) e fornecedores de IA. Nunca mostra chaves. */
export default function Integrations(){
 const [ai,setAi]=useState<Ai|null>(null),[error,setError]=useState('');
 async function load(){setError('');try{const r=await fetch('/api/integrations');const d:any=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Não foi possível carregar as integrações.');setAi(d.ai)}catch(e){setError(e instanceof Error?e.message:'Erro.')}}
 useEffect(()=>{load()},[]);
 const label=(id:string)=>ai?.providers.find(p=>p.id===id)?.label||id;

 return <div className="integrations-area">
  <div className="page-heading"><div><div className="eyebrow">ADMINISTRAÇÃO</div><h1>Integrações</h1><p>Contas externas e serviços de IA ligados ao hub. Só os administradores veem este separador.</p></div></div>
  <section className="panel form-panel integrations-panel"><IntegrationsPanel/></section>
  <section className="panel form-panel integrations-panel"><div className="settings-block"><h4><Sparkles size={16}/> Inteligência artificial</h4><p>Fornecedores usados para preparar rascunhos. Nenhuma resposta é publicada sem aprovação humana.</p>
   {error?<div className="error-banner" role="alert">{error}<Button variant="outline" onClick={load}>Tentar novamente</Button></div>
   :!ai?<Skeleton className="h-24"/>
   :<>
    <div className="ai-providers">{ai.providers.map(p=><div className="ai-provider" key={p.id}>
     {p.configured?<CheckCircle2 size={18} className="ok"/>:<CircleDashed size={18} className="off"/>}
     <div><strong>{p.label}</strong><span>{p.configured?`Chave configurada · modelo ${p.model}`:<>Falta a <code>{p.key}</code> no servidor</>}</span></div>
     <span className={'status '+(p.configured?'ativo':'inativo')}>{p.configured?'Ativo':'Por configurar'}</span>
    </div>)}</div>
    <div className="ai-uses"><h5>Quem usa o quê</h5>{ai.uses.map(u=><div key={u.feature}><span>{u.feature}</span><strong>{label(u.provider)}</strong><code>{u.env}</code></div>)}</div>
    <p className="settings-note"><ShieldCheck size={15}/>As chaves ficam só no servidor (variáveis de ambiente no Vercel) e nunca são mostradas no hub. Para trocar o fornecedor de uma funcionalidade, altera a variável indicada e faz Redeploy.</p>
   </>}
  </div></section>
 </div>
}
