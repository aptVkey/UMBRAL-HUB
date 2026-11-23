"use client";
import {useEffect,useState} from 'react';
import {LoaderCircle,LogIn,ShieldCheck,Eye,EyeOff,Mail,ArrowLeft,MailCheck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
export default function Login({setupRequired}:{setupRequired:boolean}){
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [forgot,setForgot]=useState(false),[sent,setSent]=useState('');
 // Links de convite/reposição que o Supabase reencaminha para a raiz do site (#access_token=…&type=recovery): seguem para /redefinir.
 useEffect(()=>{if(new URLSearchParams(window.location.search).has('token_hash')){window.location.replace('/redefinir'+window.location.search);return}const h=window.location.hash;if(/[#&](access_token|error_description)=/.test(h)&&/type=(recovery|invite|signup)|error_description=/.test(h))window.location.replace('/redefinir'+h)},[]);
 async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setError('');
  if(forgot){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){setError('Introduz um email válido.');return}
   setBusy(true);try{const r=await fetch('/api/auth/forgot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const data=await r.json().catch(()=>({})) as {error?:string,message?:string};if(!r.ok)throw Error(data.error||'Não foi possível enviar o email.');setSent(data.message||'Verifica o teu email.')}
   catch(err){setError(err instanceof Error?err.message:'Não foi possível enviar o email.')}finally{setBusy(false)}return}
  if(setupRequired){if(!name.trim()){setError('Preenche o nome.');return}if(password.length<8){setError('A palavra-passe deve ter pelo menos 8 caracteres.');return}if(password!==confirm){setError('As palavras-passe não coincidem.');return}}
  setBusy(true);try{const r=await fetch(setupRequired?'/api/auth/setup':'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(setupRequired?{name,email,password}:{email,password})});const data=await r.json().catch(()=>({})) as {error?:string};if(!r.ok)throw Error(data.error||'Não foi possível iniciar sessão.');window.location.reload()}
  catch(err){setError(err instanceof Error?err.message:'Não foi possível iniciar sessão.');setBusy(false)}}
 function toggleForgot(v:boolean){setForgot(v);setSent('');setError('');setPassword('')}
 const icon=setupRequired?<ShieldCheck size={26}/>:forgot?<Mail size={26}/>:<LogIn size={26}/>;
 return <div className="login-page">
  <header className="public-masthead"><img className="brand-logo" src="/umbral-logo-white.png" alt="Umbral" width="640" height="125"/></header>
  <main className="login-main"><form className="panel login-card" onSubmit={submit} noValidate>
   <span className="login-icon">{icon}</span>
   <div className="eyebrow">{setupRequired?'PRIMEIRO ACESSO':forgot?'REPOR ACESSO':'CENTRO DE INFORMAÇÃO'}</div>
   <h1>{setupRequired?'Criar o primeiro administrador':forgot?'Esqueci-me da palavra-passe':'Entrar no Hub'}</h1>
   <p>{setupRequired?'Ainda não existem contas. Cria a conta de administrador com que vais gerir a equipa e as permissões.':forgot?'Indica o email da tua conta. Vais receber um link para definir uma nova palavra-passe.':'Inicia sessão com a conta que a tua equipa criou para ti.'}</p>
   {error&&<div className="error-banner" role="alert">{error}</div>}
   {forgot&&sent?<><div className="login-sent" role="status"><MailCheck size={18}/><span>{sent} O link é válido durante 1 hora. Se não o encontrares, verifica a pasta de spam.</span></div>
     <Button className="primary-btn login-submit" type="button" onClick={()=>toggleForgot(false)}><ArrowLeft/> Voltar ao login</Button></>
   :<><div className="login-fields">
    {setupRequired&&<div className="field"><label htmlFor="login-name">Nome</label><Input id="login-name" autoComplete="name" value={name} maxLength={180} onChange={e=>setName(e.target.value)} autoFocus/></div>}
    <div className="field"><label htmlFor="login-email">Email</label><Input id="login-email" type="email" autoComplete="username" inputMode="email" value={email} maxLength={180} onChange={e=>setEmail(e.target.value)} autoFocus={!setupRequired}/></div>
    {!forgot&&<div className="field"><div className="login-label-row"><label htmlFor="login-password">Palavra-passe</label>{!setupRequired&&<button type="button" className="login-link" onClick={()=>toggleForgot(true)}>Esqueci-me da palavra-passe</button>}</div><div className="password-row"><Input id="login-password" type={show?'text':'password'} autoComplete={setupRequired?'new-password':'current-password'} value={password} maxLength={128} onChange={e=>setPassword(e.target.value)}/><Button type="button" variant="outline" size="icon" aria-label={show?'Ocultar palavra-passe':'Mostrar palavra-passe'} onClick={()=>setShow(v=>!v)}>{show?<EyeOff/>:<Eye/>}</Button></div>{setupRequired&&<small>Mínimo de 8 caracteres.</small>}</div>}
    {setupRequired&&<div className="field"><label htmlFor="login-confirm">Confirmar palavra-passe</label><Input id="login-confirm" type={show?'text':'password'} autoComplete="new-password" value={confirm} maxLength={128} onChange={e=>setConfirm(e.target.value)}/></div>}
   </div>
   <Button className="primary-btn login-submit" type="submit" disabled={busy}>{busy?<LoaderCircle className="spin"/>:forgot?<Mail/>:<LogIn/>} {setupRequired?'Criar conta e entrar':forgot?'Enviar link':'Entrar'}</Button>
   {forgot&&<button type="button" className="login-link login-back" onClick={()=>toggleForgot(false)}><ArrowLeft size={14}/> Voltar ao login</button>}</>}
   <p className="login-note"><ShieldCheck size={14}/> Espaço privado do grupo Umbral. Se não tens conta, pede a um administrador.</p>
  </form></main></div>
}
