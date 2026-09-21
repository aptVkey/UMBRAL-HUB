"use client";
import {useMemo,useState} from 'react';
import {DoorOpen,Plus,X,Search} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Empty,EmptyHeader,EmptyTitle,EmptyDescription,EmptyMedia} from '@/components/ui/empty';
import {newId,type Unit} from '@/lib/property';
const NONE='Sem categoria';
type Group={key:string,code:string,name:string,units:Unit[]};
export default function PropertyUnits({units,onChange}:{units:Unit[],onChange:(units:Unit[])=>void}){
 const [filter,setFilter]=useState(''),[number,setNumber]=useState(''),[category,setCategory]=useState(''),[error,setError]=useState('');
 const groups=useMemo(()=>{const map=new Map<string,Group>();for(const u of units){const key=u.categoryCode+'|'+u.categoryName;const g=map.get(key)||{key,code:u.categoryCode,name:u.categoryName,units:[]};g.units.push(u);map.set(key,g)}return [...map.values()]},[units]);
 const q=filter.trim().toLowerCase();
 const shown=groups.map(g=>({...g,units:q?g.units.filter(u=>u.number.toLowerCase().includes(q)||g.name.toLowerCase().includes(q)||g.code.toLowerCase().includes(q)):g.units})).filter(g=>g.units.length);
 const categories=[...new Set(groups.map(g=>g.name).filter(Boolean))];
 function add(name=category,num=number){const n=num.trim();if(!n){setError('Indica o número do quarto.');return}
  if(units.some(u=>u.number.trim().toLowerCase()===n.toLowerCase())){setError(`Já existe o quarto ${n} neste alojamento.`);return}
  const cat=name.trim(),known=groups.find(g=>g.name.toLowerCase()===cat.toLowerCase());
  onChange([...units,{id:newId(),number:n,categoryCode:known?known.code:'',categoryName:known?known.name:cat}]);setNumber('');setError('')}
 const rename=(id:string,value:string)=>onChange(units.map(u=>u.id===id?{...u,number:value}:u));
 const remove=(id:string)=>onChange(units.filter(u=>u.id!==id));
 return <div className="units-panel">
  <div className="unit-add"><div className="field"><label htmlFor="unit-number">Número do quarto</label><Input id="unit-number" value={number} maxLength={60} placeholder="Ex.: 101" onChange={e=>{setNumber(e.target.value);setError('')}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add()}}}/></div>
   <div className="field"><label htmlFor="unit-category">Categoria (opcional)</label><Input id="unit-category" list="unit-categories" value={category} maxLength={180} placeholder="Ex.: Duplo Superior" onChange={e=>setCategory(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add()}}}/><datalist id="unit-categories">{categories.map(c=><option key={c} value={c}/>)}</datalist></div>
   <Button variant="outline" onClick={()=>add()}><Plus/> Adicionar quarto</Button></div>
  {error&&<div className="error-banner" role="alert">{error}</div>}
  {!units.length?<Empty className="small-empty"><EmptyHeader><EmptyMedia variant="icon"><DoorOpen/></EmptyMedia><EmptyTitle>Sem números de quarto</EmptyTitle><EmptyDescription>Regista o número de cada quarto ou apartamento e a categoria a que pertence.</EmptyDescription></EmptyHeader></Empty>:<>
  <div className="unit-toolbar"><div className="unit-search"><Search size={15}/><Input aria-label="Pesquisar quartos" value={filter} placeholder="Pesquisar por número ou categoria" onChange={e=>setFilter(e.target.value)}/></div><span className="muted">{units.length} {units.length===1?'quarto':'quartos'} · {groups.length} {groups.length===1?'categoria':'categorias'}</span></div>
  {shown.length?shown.map(g=><section className="unit-group" key={g.key}><header><h3>{g.name||NONE}</h3>{g.code&&<span className="unit-code">{g.code}</span>}<span className="unit-count">{g.units.length}</span></header>
   <div className="unit-grid">{g.units.map(u=><div className="unit-chip" key={u.id}><Input aria-label={`Número do quarto ${u.number}`} value={u.number} maxLength={60} onChange={e=>rename(u.id,e.target.value)}/><button type="button" aria-label={`Remover quarto ${u.number}`} onClick={()=>remove(u.id)}><X size={14}/></button></div>)}</div></section>):<p className="form-footnote">Nenhum quarto corresponde à pesquisa.</p>}
  <div className="total-line"><span>Quartos registados</span><strong>{units.length} números de quarto</strong></div></>}
 </div>
}
