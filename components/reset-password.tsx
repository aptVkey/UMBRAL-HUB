"use client";
import {useEffect,useState} from 'react';
import {LoaderCircle,KeyRound,ShieldCheck,Eye,EyeOff,ArrowLeft} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
type Link={tokenHash?:string,accessToken?:string,type:string,error?:string};
/** Lê o link do email: ?token_hash=…&type=… (modelo personalizado) ou #access_token=…&type=… (modelo por defeito do Supabase). */
function readLink():Link{
 const q=new URLSearchParams(window.location.search),h=new URLSearchParams(window.location.hash.replace(/^#/,''));
 const error=h.get('error_description')||q.get('error_description')||'';
 return {tokenHash:q.get('token_hash')||undefined,accessToken:h.get('access_token')||undefined,type:q.get('type')||h.get('type')||'recovery',error:error?error.replace(/\+/g,' '):undefined};
}
let cached:Link|null=null;
export default function ResetPassword(){
 const [link,setLink]=useState<Link|null>(null),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const l=cached||(cached=readLink());setLink(l);
  // Tira o token da barra de endereço (não fica no histórico nem em capturas de ecrã).
  window.history.replaceState(null,'',window.location.pathname)},[]);
 const invite=link?.type==='invite'||link?.type==='signup';
 const usable=!!link&&!link.error&&!!(link.tokenHash||link.accessToken);
 async function submit(e:React.FormEvent){e.preventDefault();if(busy||!link)return;setError('');
  if(password.length<8){setError('A palavra-passe deve ter pelo menos 8 caracteres.');return}
  if(password!==confirm){setError('As palavras-passe não coincidem.');return}
  setBusy(true);try{const r=await fetch('/api/auth/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,tokenHash:link.tokenHash,type:link.type,accessToken:link.accessToken})});
   const data=await r.json().catch(()=>({})) as {error?:string};if(!r.ok)throw Error(data.error||'Não foi possível definir a palavra-passe.');window.location.replace('/')}
  catch(err){setError(err instanceof Error?err.message:'Não foi possível definir a palavra-passe.');setBusy(false)}}
 return <div className="login-page">
  <header className="public-masthead"><img className="brand-logo" src="/umbral-logo-white.png" alt="Umbral" width="640" height="125"/></header>
  <main className="login-main"><form className="panel login-card" onSubmit={submit} noValidate>
   <span className="login-icon">{invite?<ShieldCheck size={26}/>:<KeyRound size={26}/>}</span>
   <div className="eyebrow">{invite?'BEM-VINDO AO HUB':'REPOR ACESSO'}</div>
   <h1>{invite?'Cria a tua palavra-passe':'Definir nova palavra-passe'}</h1>
   {!link?<p><LoaderCircle className="spin" size={16}/> A validar o link…</p>
   :!usable?<><div className="error-banner" role="alert">{link.error?'Este link já foi usado ou expirou.':'Link inválido.'} Pede um novo email na página de login, em "Esqueci-me da palavra-passe", ou pede a um administrador que te reenvie o convite.</div>
     <Button className="primary-btn login-submit" type="button" onClick={()=>window.location.replace('/')}><ArrowLeft/> Ir para o login</Button></>
   :<><p>{invite?'Escolhe a palavra-passe com que vais entrar no Umbral Hub.':'Escolhe uma nova palavra-passe para a tua conta. As sessões abertas noutros dispositivos vão terminar.'}</p>
    {error&&<div className="error-banner" role="alert">{error}</div>}
    <div className="login-fields">
     <div className="field"><label htmlFor="reset-password">Nova palavra-passe</label><div className="password-row"><Input id="reset-password" type={show?'text':'password'} autoComplete="new-password" value={password} maxLength={128} onChange={e=>setPassword(e.target.value)} autoFocus/><Button type="button" variant="outline" size="icon" aria-label={show?'Ocultar palavra-passe':'Mostrar palavra-passe'} onClick={()=>setShow(v=>!v)}>{show?<EyeOff/>:<Eye/>}</Button></div><small>Mínimo de 8 caracteres.</small></div>
     <div className="field"><label htmlFor="reset-confirm">Confirmar palavra-passe</label><Input id="reset-confirm" type={show?'text':'password'} autoComplete="new-password" value={confirm} maxLength={128} onChange={e=>setConfirm(e.target.value)}/></div>
    </div>
    <Button className="primary-btn login-submit" type="submit" disabled={busy}>{busy?<LoaderCircle className="spin"/>:<KeyRound/>} {invite?'Criar palavra-passe e entrar':'Guardar e entrar'}</Button></>}
   <p className="login-note"><ShieldCheck size={14}/> Espaço privado do grupo Umbral.</p>
  </form></main></div>
}
