"use client";
import {useState} from 'react';
import {LoaderCircle,LogIn,ShieldCheck,Eye,EyeOff} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
export default function Login({setupRequired}:{setupRequired:boolean}){
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setError('');
  if(setupRequired){if(!name.trim()){setError('Preenche o nome.');return}if(password.length<8){setError('A palavra-passe deve ter pelo menos 8 caracteres.');return}if(password!==confirm){setError('As palavras-passe não coincidem.');return}}
  setBusy(true);try{const r=await fetch(setupRequired?'/api/auth/setup':'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(setupRequired?{name,email,password}:{email,password})});const data=await r.json().catch(()=>({})) as {error?:string};if(!r.ok)throw Error(data.error||'Não foi possível iniciar sessão.');window.location.reload()}
  catch(err){setError(err instanceof Error?err.message:'Não foi possível iniciar sessão.');setBusy(false)}}
 return <div className="login-page">
  <header className="public-masthead"><img className="brand-logo" src="/umbral-logo-white.png" alt="Umbral" width="2048" height="402"/></header>
  <main className="login-main"><form className="panel login-card" onSubmit={submit} noValidate>
   <span className="login-icon">{setupRequired?<ShieldCheck size={26}/>:<LogIn size={26}/>}</span>
   <div className="eyebrow">{setupRequired?'PRIMEIRO ACESSO':'CENTRO DE INFORMAÇÃO'}</div>
   <h1>{setupRequired?'Criar o primeiro administrador':'Entrar no Hub'}</h1>
   <p>{setupRequired?'Ainda não existem contas. Cria a conta de administrador com que vais gerir a equipa e as permissões.':'Inicia sessão com a conta que a tua equipa criou para ti.'}</p>
   {error&&<div className="error-banner" role="alert">{error}</div>}
   <div className="login-fields">
    {setupRequired&&<div className="field"><label htmlFor="login-name">Nome</label><Input id="login-name" autoComplete="name" value={name} maxLength={180} onChange={e=>setName(e.target.value)} autoFocus/></div>}
    <div className="field"><label htmlFor="login-email">Email</label><Input id="login-email" type="email" autoComplete="username" inputMode="email" value={email} maxLength={180} onChange={e=>setEmail(e.target.value)} autoFocus={!setupRequired}/></div>
    <div className="field"><label htmlFor="login-password">Palavra-passe</label><div className="password-row"><Input id="login-password" type={show?'text':'password'} autoComplete={setupRequired?'new-password':'current-password'} value={password} maxLength={128} onChange={e=>setPassword(e.target.value)}/><Button type="button" variant="outline" size="icon" aria-label={show?'Ocultar palavra-passe':'Mostrar palavra-passe'} onClick={()=>setShow(v=>!v)}>{show?<EyeOff/>:<Eye/>}</Button></div>{setupRequired&&<small>Mínimo de 8 caracteres.</small>}</div>
    {setupRequired&&<div className="field"><label htmlFor="login-confirm">Confirmar palavra-passe</label><Input id="login-confirm" type={show?'text':'password'} autoComplete="new-password" value={confirm} maxLength={128} onChange={e=>setConfirm(e.target.value)}/></div>}
   </div>
   <Button className="primary-btn login-submit" type="submit" disabled={busy}>{busy?<LoaderCircle className="spin"/>:<LogIn/>} {setupRequired?'Criar conta e entrar':'Entrar'}</Button>
   <p className="login-note"><ShieldCheck size={14}/> Espaço privado do grupo Umbral. Se não tens conta, pede a um administrador.</p>
  </form></main></div>
}
