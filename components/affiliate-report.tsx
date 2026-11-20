"use client";
import {useCallback,useEffect,useState} from 'react';
import {LoaderCircle,Percent,Tag,LinkIcon} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Skeleton} from '@/components/ui/skeleton';
import ResultsDashboard from '@/components/results-dashboard';
import {percentLabel,type ResultRow} from '@/lib/collab';
type Report={affiliate:{name:string,promoCode:string,discount:string,status:string},results:ResultRow[]};
export default function AffiliateReport({token}:{token:string}){
 const [report,setReport]=useState<Report|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{setLoading(true);setError('');try{const r=await fetch(`/api/afiliado?token=${encodeURIComponent(token)}`,{cache:'no-store'});const data:any=await r.json();if(!r.ok)throw Error(data.error);setReport(data)}catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar os resultados.')}finally{setLoading(false)}},[token]);
 useEffect(()=>{load()},[load]);
 return <div className="public-report">
  <header className="public-masthead"><img className="brand-logo" src="/umbral-logo-white.png" alt="Umbral" width="640" height="125"/></header>
  <main className="public-page">
   {loading?<div className="loading-list" aria-label="A carregar resultados"><Skeleton className="h-24"/><Skeleton className="h-64"/></div>
   :error||!report?<div className="panel public-error"><LinkIcon size={26}/><h1>Link indisponível</h1><p>{error}</p><Button variant="outline" onClick={load}>{loading?<LoaderCircle className="spin"/>:null} Tentar novamente</Button></div>
   :<>
    <div className="page-heading"><div><div className="eyebrow">PROGRAMA DE AFILIADOS UMBRAL</div><h1>{report.affiliate.name}</h1><p>Acompanha os resultados obtidos com o teu código promocional.</p></div></div>
    <div className="affiliate-code-strip"><div><span><Tag size={14}/> Código promocional</span><strong>{report.affiliate.promoCode||'Por definir'}</strong></div><div><span><Percent size={14}/> Desconto para o cliente</span><strong>{percentLabel(report.affiliate.discount)}</strong></div></div>
    <section className="panel form-panel"><div className="section-heading"><div><h2>Os teus resultados</h2><p>Dados atualizados pela equipa Umbral.</p></div></div>
     <ResultsDashboard rows={report.results} emptyText="Assim que existirem reservas com o teu código, os resultados aparecem aqui."/></section>
    <p className="form-footnote">Este link é pessoal e mostra apenas os resultados do teu código. Não o partilhes com terceiros.</p>
   </>}
  </main></div>
}
