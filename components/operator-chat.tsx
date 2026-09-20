"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {Send,Paperclip,X,FileText,Download,Reply,Trash2,LoaderCircle,MessageSquare,Hotel,RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Skeleton} from '@/components/ui/skeleton';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {toast} from 'sonner';
import {checkAttachment,fileSize,ATTACH_ACCEPT,MAX_FILES,MAX_TOTAL_BYTES,type ChatMessage} from '@/lib/operator';

const ALL='all';
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()).join('')||'?';
const stamp=(iso:string)=>{const d=new Date(iso);return `${d.toLocaleDateString('pt-PT',{day:'2-digit',month:'2-digit',year:'numeric'})} · ${d.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'})}`};
export default function OperatorChat({operatorId,properties}:{operatorId:string,properties:{id:string,name:string}[]}){
 const [messages,setMessages]=useState<ChatMessage[]>([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
 const [text,setText]=useState(''),[files,setFiles]=useState<File[]>([]),[scope,setScope]=useState(ALL),[replyTo,setReplyTo]=useState<ChatMessage|null>(null);
 const [sending,setSending]=useState(false),[error,setError]=useState(''),[removing,setRemoving]=useState<ChatMessage|null>(null);
 const listRef=useRef<HTMLDivElement>(null),inputRef=useRef<HTMLInputElement>(null),stick=useRef(true);
 const load=useCallback(async(silent=false)=>{if(!silent){setLoading(true);setLoadError('')}try{const r=await fetch(`/api/operators/messages?operatorId=${operatorId}`,{cache:'no-store'});const data:{messages?:ChatMessage[],error?:string}=await r.json();if(!r.ok||!data.messages)throw Error(data.error);setMessages(data.messages)}catch(e){if(!silent)setLoadError(e instanceof Error?e.message:'Não foi possível carregar a conversa.')}finally{if(!silent)setLoading(false)}},[operatorId]);
 useEffect(()=>{load()},[load]);
 // Atualização periódica enquanto a conversa está aberta e o separador visível.
 useEffect(()=>{const t=setInterval(()=>{if(document.visibilityState==='visible'&&!sending)load(true)},20000);return()=>clearInterval(t)},[load,sending]);
 useEffect(()=>{const el=listRef.current;if(el&&stick.current)el.scrollTop=el.scrollHeight},[messages]);
 const byId=new Map(messages.map(m=>[m.id,m])),propName=(id:string|null)=>id?properties.find(p=>p.id===id)?.name||'Alojamento':'';
 function addFiles(list:FileList|null){if(!list)return;const next=[...files];let problem='';for(const f of Array.from(list)){const bad=checkAttachment(f);if(bad){problem=bad;continue}next.push(f)}
  if(next.length>MAX_FILES){problem=`Podes anexar no máximo ${MAX_FILES} ficheiros por mensagem.`;next.length=MAX_FILES}
  if(next.reduce((n,f)=>n+f.size,0)>MAX_TOTAL_BYTES){problem='Os anexos podem ter no máximo 10 MB no total.';setError(problem);return}
  setFiles(next);setError(problem)}
 async function send(){if(sending)return;if(!text.trim()&&!files.length){setError('Escreve uma mensagem ou anexa um ficheiro.');return}setError('');setSending(true);
  try{const body=new FormData();body.append('payload',JSON.stringify({operatorId,body:text,propertyId:scope===ALL?null:scope,replyToId:replyTo?.id||null}));for(const f of files)body.append('files',f);
   const r=await fetch('/api/operators/messages',{method:'POST',body});const data:{message?:ChatMessage,error?:string}=await r.json();if(!r.ok||!data.message)throw Error(data.error);
   stick.current=true;setMessages(m=>[...m,data.message!]);setText('');setFiles([]);setReplyTo(null);if(inputRef.current)inputRef.current.value=''}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível enviar. O texto foi mantido.')}finally{setSending(false)}}
 async function remove(){const m=removing;if(!m)return;setRemoving(null);try{const r=await fetch(`/api/operators/messages?id=${m.id}`,{method:'DELETE'});const data:{error?:string}=await r.json();if(!r.ok)throw Error(data.error);setMessages(l=>l.filter(x=>x.id!==m.id));if(replyTo?.id===m.id)setReplyTo(null);toast.success('Mensagem eliminada.')}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível eliminar a mensagem.')}}
 return <div className="chat">
  <div className="chat-head"><div><h3><MessageSquare size={17}/> Notas e conversa</h3><p>Partilha notas e ficheiros sobre este operador. Todos os utilizadores com acesso ao operador (e ao alojamento indicado) veem e podem responder.</p></div><Button variant="outline" size="sm" onClick={()=>load()} disabled={loading}><RefreshCw className={loading?'spin':''}/> Atualizar</Button></div>
  <div className="chat-list" ref={listRef} onScroll={e=>{const el=e.currentTarget;stick.current=el.scrollHeight-el.scrollTop-el.clientHeight<80}} aria-live="polite">
   {loading?<div className="loading-list"><Skeleton className="h-16"/><Skeleton className="h-16"/></div>:loadError?<div className="error-banner" role="alert">{loadError}<Button variant="outline" onClick={()=>load()}>Tentar novamente</Button></div>:!messages.length?<div className="chat-empty"><MessageSquare size={26}/><strong>Ainda não há notas</strong><span>Escreve a primeira nota ou anexa um documento importante sobre este operador.</span></div>
   :messages.map(m=>{const parent=m.replyToId?byId.get(m.replyToId):null;return <article className={'chat-msg '+(m.mine?'mine':'')} key={m.id}>
    <span className="member-avatar">{initials(m.authorName)}</span>
    <div className="chat-bubble"><header><strong>{m.authorName}</strong><time dateTime={m.createdAt}>{stamp(m.createdAt)}</time>{m.propertyId&&<span className="chat-tag"><Hotel size={11}/>{propName(m.propertyId)}</span>}</header>
     {m.replyToId&&<blockquote className="chat-quote">{parent?<><strong>{parent.authorName}</strong><span>{parent.body||'Anexo'}</span></>:<span>Mensagem eliminada ou indisponível.</span>}</blockquote>}
     {m.body&&<p>{m.body}</p>}
     {m.attachments.length>0&&<div className="chat-files">{m.attachments.map(f=><a className="chat-file" key={f.id} href={`/api/operators/attachment?id=${f.id}`} download={f.name}><FileText size={16}/><span><strong>{f.name}</strong><small>{fileSize(f.size)}</small></span><Download size={15}/></a>)}</div>}
     <footer><button type="button" onClick={()=>{setReplyTo(m);document.getElementById('chat-text')?.focus()}}><Reply size={13}/> Responder</button>{m.canDelete&&<button type="button" className="danger" onClick={()=>setRemoving(m)}><Trash2 size={13}/> Eliminar</button>}</footer></div></article>})}
  </div>
  <div className="chat-composer">
   {replyTo&&<div className="chat-replying"><Reply size={14}/><span>A responder a <strong>{replyTo.authorName}</strong>: {replyTo.body||'Anexo'}</span><button type="button" aria-label="Cancelar resposta" onClick={()=>setReplyTo(null)}><X size={14}/></button></div>}
   <label className="sr-only" htmlFor="chat-text">Mensagem</label>
   <Textarea id="chat-text" value={text} maxLength={5000} placeholder="Escreve uma nota ou responde à conversa…" disabled={sending} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();send()}}}/>
   {files.length>0&&<div className="chat-pending">{files.map((f,i)=><span className="chat-chip" key={i}><FileText size={13}/>{f.name} <small>{fileSize(f.size)}</small><button type="button" aria-label={`Remover ${f.name}`} onClick={()=>setFiles(files.filter((_,j)=>j!==i))}><X size={12}/></button></span>)}</div>}
   {error&&<div className="error-banner" role="alert">{error}</div>}
   <div className="chat-bar"><div className="chat-tools"><label className="chat-attach" htmlFor="chat-files"><Paperclip size={15}/> Anexar</label><input id="chat-files" className="sr-only" ref={inputRef} type="file" multiple accept={ATTACH_ACCEPT} disabled={sending} onChange={e=>{addFiles(e.target.files);e.target.value=''}}/>
    <div className="chat-scope"><label htmlFor="chat-scope" className="sr-only">Visibilidade</label><Select value={scope} onValueChange={setScope}><SelectTrigger id="chat-scope"><SelectValue/></SelectTrigger><SelectContent><SelectItem value={ALL}>Todos com acesso ao operador</SelectItem>{properties.map(p=><SelectItem key={p.id} value={p.id}>Só quem tem acesso a {p.name}</SelectItem>)}</SelectContent></Select></div></div>
   <Button className="chat-send" onClick={send} disabled={sending}>{sending?<LoaderCircle className="spin"/>:<Send/>} Enviar</Button></div>
   <p className="chat-hint">PDF, Word, Excel, PNG ou JPG · até {MAX_FILES} ficheiros e 10 MB por mensagem · Ctrl/⌘ + Enter para enviar.</p>
  </div>
  <AlertDialog open={!!removing} onOpenChange={v=>{if(!v)setRemoving(null)}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminar mensagem?</AlertDialogTitle><AlertDialogDescription>A mensagem e os seus anexos são eliminados para todos os utilizadores.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="confirm-action" onClick={remove}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>
}
