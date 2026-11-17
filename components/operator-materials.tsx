"use client";
import {useEffect,useRef,useState} from 'react';
import {FolderOpen,FileText,Download,Trash2,LoaderCircle} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Skeleton} from '@/components/ui/skeleton';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {Heading} from '@/components/hub-fields';
import {toast} from 'sonner';
import {checkContract,CONTRACT_ACCEPT,type Material} from '@/lib/corporate-material';
import {fileSize} from '@/lib/operator';

const when=(v:string)=>{const [y,m,d]=v.split('-');return `${d}/${m}/${y}`};
export default function OperatorMaterials(){
 const [materials,setMaterials]=useState<Material[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[toDelete,setToDelete]=useState<Material|null>(null);
 const input=useRef<HTMLInputElement>(null);
 async function load(){setLoading(true);setError('');try{const r=await fetch('/api/operators/materials',{cache:'no-store'});const data:{materials?:Material[],error?:string}=await r.json();if(!r.ok||!data.materials)throw Error(data.error);setMaterials(data.materials)}catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar os materiais.')}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 async function upload(file?:File){if(!file)return;const invalid=checkContract(file);if(invalid){toast.error(invalid);return}setBusy(true);try{const body=new FormData();body.append('file',file);const r=await fetch('/api/operators/materials',{method:'POST',body});const data:{material?:Material,error?:string}=await r.json();if(!r.ok||!data.material)throw Error(data.error);setMaterials(m=>[data.material!,...m]);toast.success('Documento adicionado.')}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível guardar o ficheiro.')}finally{setBusy(false)}}
 async function remove(){if(!toDelete)return;const t=toDelete;setToDelete(null);setBusy(true);try{const r=await fetch(`/api/operators/materials?id=${encodeURIComponent(t.id)}`,{method:'DELETE'});const data:{error?:string}=await r.json();if(!r.ok)throw Error(data.error);setMaterials(m=>m.filter(x=>x.id!==t.id));toast.success('Documento removido.')}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível remover o ficheiro.')}finally{setBusy(false)}}
 return <section className="panel"><div className="panel-block"><Heading title="Materiais / Documentos" desc="Templates e documentos de apoio aos operadores, não associados a um operador específico."><Button variant="outline" disabled={busy} onClick={()=>input.current?.click()}>{busy?<LoaderCircle className="spin"/>:<FolderOpen/>} Adicionar material</Button></Heading>
  <input id="operator-material" className="sr-only" ref={input} type="file" accept={CONTRACT_ACCEPT} disabled={busy} onChange={e=>{upload(e.target.files?.[0]);e.target.value=''}}/>
  <p className="field-help">PDF, Word (DOC ou DOCX) ou imagem (JPG ou PNG) · até 10 MB.</p></div>
  {loading?<div className="loading-list" aria-label="A carregar materiais"><Skeleton className="h-16"/></div>:error?<div className="error-banner" role="alert">{error}<Button variant="outline" onClick={load}>Tentar novamente</Button></div>:materials.length?<div className="corporate-rows">{materials.map(m=><div className="corporate-row" key={m.id}><span className="property-avatar"><FileText size={20}/></span><span className="corporate-row-identity"><strong>{m.name}</strong><span>{fileSize(m.size)}</span><small>Adicionado em {when(m.uploadedAt.slice(0,10))}</small></span><div className="material-actions"><Button variant="outline" size="icon" aria-label={`Descarregar ${m.name}`} asChild><a href={`/api/operators/materials/file?id=${encodeURIComponent(m.id)}`} download={m.name}><Download/></a></Button><Button variant="ghost" size="icon" aria-label={`Remover ${m.name}`} disabled={busy} onClick={()=>setToDelete(m)}><Trash2 size={16}/></Button></div></div>)}</div>:<p className="contract-none">Ainda não existem materiais adicionados.</p>}
  <AlertDialog open={!!toDelete} onOpenChange={v=>{if(!v)setToDelete(null)}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remover este ficheiro?</AlertDialogTitle><AlertDialogDescription>{toDelete?.name} será removido de Materiais / Documentos. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="confirm-action" onClick={remove}>Remover</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </section>;
}
