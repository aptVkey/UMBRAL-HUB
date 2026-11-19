"use client";
import {useMemo,useState} from 'react';
import {KeyRound,Eye,EyeOff,Copy,Search,ShieldAlert} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Empty,EmptyHeader,EmptyTitle,EmptyDescription,EmptyMedia} from '@/components/ui/empty';
import {toast} from 'sonner';
import type {Unit} from '@/lib/property';
type Group={key:string,name:string,code:string,units:Unit[]};
export default function KeysafesPanel({units,codes,general,onGeneralChange,onChange,onGoToUnits}:{units:Unit[],codes:Record<string,string>,general:string,onGeneralChange:(code:string)=>void,onChange:(codes:Record<string,string>)=>void,onGoToUnits:()=>void}){
 const GENERAL='__general';
 const [show,setShow]=useState(false),[filter,setFilter]=useState('');
 const groups=useMemo(()=>{const map=new Map<string,Group>();for(const u of units){const key=u.categoryCode+'|'+u.categoryName;const g=map.get(key)||{key,name:u.categoryName,code:u.categoryCode,units:[]};g.units.push(u);map.set(key,g)}return [...map.values()]},[units]);
 const q=filter.trim().toLowerCase();
 const shown=groups.map(g=>({...g,units:q?g.units.filter(u=>u.number.toLowerCase().includes(q)||g.name.toLowerCase().includes(q)||(codes[u.id]||'').toLowerCase().includes(q)):g.units})).filter(g=>g.units.length);
 const filled=units.filter(u=>(codes[u.id]||'').trim()).length;
 const set=(id:string,value:string)=>{const next={...codes};if(value)next[id]=value;else delete next[id];onChange(next)};
 async function copy(id:string){try{await navigator.clipboard.writeText(id===GENERAL?general:codes[id]||'');toast.success('Código copiado.')}catch{toast.error('Não foi possível copiar. Seleciona o código e copia-o manualmente.')}}
 if(!units.length)return <Empty className="small-empty"><EmptyHeader><EmptyMedia variant="icon"><KeyRound/></EmptyMedia><EmptyTitle>Ainda não há quartos</EmptyTitle><EmptyDescription>Os códigos de keysafe são registados por quarto. Adiciona primeiro os números de quarto.</EmptyDescription></EmptyHeader><Button variant="outline" onClick={onGoToUnits}>Ir para Quartos</Button></Empty>;
 return <div className="keysafe-panel">
  <div className="keysafe-toolbar"><div className="unit-search"><Search size={15}/><Input aria-label="Pesquisar quartos" value={filter} placeholder="Pesquisar por número ou categoria" onChange={e=>setFilter(e.target.value)}/></div><span className="muted">{filled} de {units.length} quartos com código</span><Button className="ks-tools" variant="outline" size="sm" aria-pressed={show} onClick={()=>setShow(v=>!v)}>{show?<EyeOff/>:<Eye/>} {show?'Ocultar códigos':'Mostrar códigos'}</Button></div>
  <section className="unit-group keysafe-general"><header><h3>Código geral</h3><span className="unit-count">{general.trim()?'Preenchido':'Por preencher'}</span></header><div className="keysafe-list"><div className="keysafe-row"><label htmlFor="ks-general">Geral</label><Input id="ks-general" className={show?'':'ks-hidden'} value={general} maxLength={60} autoComplete="off" spellCheck={false} placeholder="Código geral do alojamento" onChange={e=>onGeneralChange(e.target.value)}/><Button className="ks-copy" variant="ghost" size="icon" aria-label="Copiar código geral" disabled={!general.trim()} onClick={()=>copy(GENERAL)}><Copy/></Button></div></div></section>
  <p className="settings-note"><ShieldAlert size={15}/>Os códigos ficam ocultos por defeito e só são visíveis a quem tem acesso a este alojamento. Guarda a ficha para gravar as alterações.</p>
  {shown.length?shown.map(g=><section className="unit-group" key={g.key}><header><h3>{g.name||'Sem categoria'}</h3>{g.code&&<span className="unit-code">{g.code}</span>}<span className="unit-count">{g.units.filter(u=>(codes[u.id]||'').trim()).length}/{g.units.length}</span></header>
   <div className="keysafe-list">{g.units.map(u=><div className="keysafe-row" key={u.id}><label htmlFor={'ks-'+u.id}>{u.number}</label><Input id={'ks-'+u.id} className={show?'':'ks-hidden'} value={codes[u.id]||''} maxLength={60} autoComplete="off" spellCheck={false} placeholder="Código do keysafe" onChange={e=>set(u.id,e.target.value)}/><Button className="ks-copy" variant="ghost" size="icon" aria-label={`Copiar código do quarto ${u.number}`} disabled={!(codes[u.id]||'').trim()} onClick={()=>copy(u.id)}><Copy/></Button></div>)}</div></section>):<p className="form-footnote">Nenhum quarto corresponde à pesquisa.</p>}
 </div>
}
