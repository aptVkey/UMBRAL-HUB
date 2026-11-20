"use client";
import {useEffect,useMemo,useState} from 'react';
import {MapPin,Plug,LoaderCircle,RefreshCw,Save,Unplug,TriangleAlert,CheckCircle2,Sparkles} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {Skeleton} from '@/components/ui/skeleton';
import {toast} from 'sonner';
type Status={google:{configured:boolean,connected:boolean,account:string,connectedBy:string,connectedAt:string|null},links:{propertyId:string,externalRef:string,label:string,lastSyncAt:string|null,lastError:string}[],properties:{id:string,name:string}[]};
type Loc={ref:string,title:string,address:string};
const norm=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\bby (umbral|portugalferias)\b/g,'').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>1&&!['de','da','do','das','dos','e','hotel','residencial','apartamentos','apartamento','alojamento','local','guesthouse','guest','house'].includes(w));
/** Semelhança entre nomes (palavras em comum), para sugerir a correspondência. */
function score(a:string,b:string){const x=new Set(norm(a)),y=new Set(norm(b));if(!x.size||!y.size)return 0;let n=0;x.forEach(w=>{if(y.has(w))n++});return n/Math.max(x.size,y.size)}
const fmt=(d:string|null)=>d?new Date(d).toLocaleString('pt-PT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
async function call(url:string,init?:RequestInit):Promise<any>{const r=await fetch(url,{...init,headers:{'Content-Type':'application/json'}});const d:any=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Não foi possível concluir o pedido.');return d}

export default function IntegrationsPanel(){
 const [st,setSt]=useState<Status|null>(null),[error,setError]=useState(''),[locs,setLocs]=useState<Loc[]|null>(null),[locError,setLocError]=useState(''),[map,setMap]=useState<Record<string,string>>({}),[busy,setBusy]=useState(''),[confirmOff,setConfirmOff]=useState(false);
 async function load(){setError('');try{const d:Status=await call('/api/integrations');setSt(d);setMap(Object.fromEntries(d.links.map(l=>[l.externalRef,l.propertyId])))}catch(e){setError(e instanceof Error?e.message:'Erro.')}}
 useEffect(()=>{load()},[]);
 async function loadLocations(){setBusy('locs');setLocError('');try{const d=await call('/api/integrations/google/locations');setLocs(d.locations)}catch(e){setLocError(e instanceof Error?e.message:'Erro.')}finally{setBusy('')}}
 function suggest(){if(!locs||!st)return;const used=new Set(Object.values(map).filter(Boolean)),next={...map};let n=0;
  for(const l of locs){if(next[l.ref])continue;let best='',bs=0;for(const p of st.properties){if(used.has(p.id))continue;const s=score(l.title,p.name);if(s>bs){bs=s;best=p.id}}if(best&&bs>=0.5){next[l.ref]=best;used.add(best);n++}}
  setMap(next);toast.success(n?`${n} correspondência(s) sugerida(s). Confirma antes de guardar.`:'Não encontrei mais correspondências pelo nome.')}
 async function save(){if(!locs)return;setBusy('save');try{const links=Object.entries(map).filter(([,p])=>p).map(([ref,propertyId])=>({propertyId,externalRef:ref,label:locs.find(l=>l.ref===ref)?.title||ref}));await call('/api/integrations',{method:'PUT',body:JSON.stringify({links})});toast.success('Correspondências guardadas.');load()}catch(e){toast.error(e instanceof Error?e.message:'Erro.')}finally{setBusy('')}}
 async function off(){setBusy('off');try{await call('/api/integrations/google',{method:'DELETE'});toast.success('Conta Google desligada.');setLocs(null);load()}catch(e){toast.error(e instanceof Error?e.message:'Erro.')}finally{setBusy('');setConfirmOff(false)}}
 const taken=useMemo(()=>{const c:Record<string,number>={};Object.values(map).forEach(p=>{if(p)c[p]=(c[p]||0)+1});return c},[map]);
 const dup=Object.values(taken).some(n=>n>1);
 const linkOf=(propertyId:string)=>st?.links.find(l=>l.propertyId===propertyId);

 return <div className="settings-block integrations-block"><h4><MapPin size={16}/> Google Business Profile</h4><p>Liga a conta Google que gere os perfis dos alojamentos para importar reviews e publicar respostas aprovadas. O hub só lê perfis e reviews e escreve respostas: nunca edita nem apaga conteúdo do perfil.</p>
  {error?<div className="error-banner" role="alert">{error}<Button variant="outline" onClick={load}>Tentar novamente</Button></div>
  :!st?<Skeleton className="h-16"/>
  :!st.google.configured?<p className="settings-note"><TriangleAlert size={15}/>A integração Google ainda não está configurada no servidor: faltam GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e INTEGRATIONS_KEY.</p>
  :!st.google.connected?<Button className="primary-btn" onClick={()=>{window.location.href='/api/integrations/google/connect'}}><Plug/> Ligar conta Google</Button>
  :<>
   <div className="integration-status"><CheckCircle2 size={18}/><div><strong>Google ligado{st.google.account?` como ${st.google.account}`:''}</strong><span>{st.google.connectedBy&&`Por ${st.google.connectedBy}`}{st.google.connectedAt&&` · ${fmt(st.google.connectedAt)}`} · {st.links.length} {st.links.length===1?'alojamento ligado':'alojamentos ligados'}</span></div><Button variant="ghost" className="danger-link" disabled={!!busy} onClick={()=>setConfirmOff(true)}><Unplug/> Desligar</Button></div>
   {!locs?<Button variant="outline" disabled={busy==='locs'} onClick={loadLocations}>{busy==='locs'?<LoaderCircle className="spin"/>:<RefreshCw/>} Carregar perfis Google</Button>
   :<><div className="integration-tools"><span>{locs.length} perfis na conta Google. Escolhe o alojamento de cada um.</span><div><Button variant="outline" size="sm" onClick={suggest}><Sparkles/> Sugerir pelo nome</Button><Button variant="outline" size="sm" disabled={busy==='locs'} onClick={loadLocations}><RefreshCw/> Atualizar</Button></div></div>
    <div className="integration-rows">{locs.map(l=>{const pid=map[l.ref]||'',link=pid?linkOf(pid):undefined,isDup=pid&&taken[pid]>1;return <div className="integration-row" key={l.ref}><div><strong>{l.title}</strong><span>{l.address}</span>{link?.externalRef===l.ref&&(link.lastError?<em className="bad">{link.lastError}</em>:link.lastSyncAt?<em>Sincronizado {fmt(link.lastSyncAt)}</em>:null)}</div>
     <select aria-label={`Alojamento para ${l.title}`} className={'native-select'+(isDup?' invalid':'')} value={pid} onChange={e=>setMap(m=>({...m,[l.ref]:e.target.value}))}><option value="">Não ligar</option>{st.properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>})}</div>
    {dup&&<p className="field-error">Há alojamentos escolhidos para mais do que um perfil.</p>}
    <div className="settings-actions"><span/><div><Button className="primary-btn" disabled={busy==='save'||dup} onClick={save}>{busy==='save'?<LoaderCircle className="spin"/>:<Save/>} Guardar correspondências</Button></div></div></>}
   {locError&&<div className="error-banner" role="alert">{locError}</div>}
  </>}
  <AlertDialog open={confirmOff} onOpenChange={setConfirmOff}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Desligar a conta Google?</AlertDialogTitle><AlertDialogDescription>O hub deixa de importar reviews e de publicar respostas no Google. As reviews já importadas e as correspondências mantêm-se. Podes voltar a ligar a conta quando quiseres.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="confirm-action" onClick={e=>{e.preventDefault();off()}}>Desligar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>
}
