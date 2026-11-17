"use client";
import {useEffect,useMemo,useState,Fragment} from 'react';
import {Users,Hotel,BedDouble,Layers,ChevronRight,ChevronDown,RefreshCw,Search,TriangleAlert} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Skeleton} from '@/components/ui/skeleton';
import {Empty,EmptyHeader,EmptyTitle,EmptyDescription,EmptyMedia} from '@/components/ui/empty';
import {groupCapacity,categoryColumns,DIMENSIONS,NO_CATEGORY,NO_VALUE,type Dimension} from '@/lib/capacity';
import {propertyMatches,type SavedProperty} from '@/lib/property';

const nf=(n:number)=>n.toLocaleString('pt-PT');
const pct=(n:number,t:number)=>t?`${Math.round(n/t*100)}%`:'0%';
export default function Capacity(){
 const [properties,setProperties]=useState<SavedProperty[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [by,setBy]=useState<Dimension>('region'),[status,setStatus]=useState('Ativo'),[region,setRegion]=useState(''),[city,setCity]=useState(''),[type,setType]=useState(''),[query,setQuery]=useState('');
 const [open,setOpen]=useState<Set<string>>(new Set());
 async function load(){setLoading(true);setError('');try{const r=await fetch('/api/properties',{cache:'no-store'});const data:{properties?:SavedProperty[],error?:string}=await r.json();if(!r.ok||!data.properties)throw Error(data.error);setProperties(data.properties)}catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar os alojamentos.')}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 const options=useMemo(()=>{const uniq=(f:(p:SavedProperty)=>string,empty:string)=>[...new Set(properties.map(p=>f(p).trim()||empty))].sort((a,b)=>a.localeCompare(b,'pt'));return {regions:uniq(p=>p.region,NO_VALUE.region),cities:uniq(p=>p.city,NO_VALUE.city),types:uniq(p=>p.type,NO_VALUE.type),statuses:[...new Set(properties.map(p=>p.status))]}},[properties]);
 const filtered=useMemo(()=>properties.filter(p=>(!status||p.status===status)&&(!region||(p.region.trim()||NO_VALUE.region)===region)&&(!city||(p.city.trim()||NO_VALUE.city)===city)&&(!type||(p.type.trim()||NO_VALUE.type)===type)&&(!query||propertyMatches(p,query))),[properties,status,region,city,type,query]);
 const groups=useMemo(()=>groupCapacity(filtered,by),[filtered,by]);
 const columns=useMemo(()=>categoryColumns(groups),[groups]);
 const totals=useMemo(()=>{const t={properties:filtered.length,rooms:0,units:0,pax:0,uncategorised:0,byCategory:{} as Record<string,number>};for(const g of groups){t.units+=g.units;t.pax+=g.pax;t.rooms+=g.rooms.length;for(const [c,n] of Object.entries(g.byCategory))t.byCategory[c]=(t.byCategory[c]||0)+n;t.uncategorised+=g.rooms.filter(r=>r.category===NO_CATEGORY).length}return t},[groups,filtered]);
 const max=Math.max(1,...groups.map(g=>g.pax)),filtersOn=!!(region||city||type||query||status!=='Ativo');
 const toggle=(k:string)=>setOpen(s=>{const n=new Set(s);n.has(k)?n.delete(k):n.add(k);return n});
 return <div className="capacity-area">
  <div className="page-heading"><div><div className="eyebrow">VISÃO DO PORTFOLIO</div><h1>Capacidades Máximas</h1><p>Quartos por tipologia e pessoas que o portfolio consegue receber com 100% de ocupação.</p></div><Button variant="outline" disabled={loading} onClick={load}><RefreshCw className={loading?'spin':''}/> Atualizar</Button></div>
  {loading&&!properties.length?<div className="loading-list" aria-label="A carregar capacidades"><Skeleton className="h-24"/><Skeleton className="h-64"/></div>:error?<div className="error-banner" role="alert">{error}<Button variant="outline" onClick={load}>Tentar novamente</Button></div>:!properties.length?<Empty className="main-empty"><EmptyHeader><EmptyMedia className="empty-hotel"><Hotel size={34}/></EmptyMedia><EmptyTitle>Ainda não há alojamentos</EmptyTitle><EmptyDescription>Regista os alojamentos e as respetivas tipologias para veres aqui a capacidade do portfolio.</EmptyDescription></EmptyHeader></Empty>:<>
  <div className="cap-kpis"><div className="cap-kpi main"><span className="stat-icon"><Users/></span><div><span>Capacidade máxima</span><strong>{nf(totals.pax)}</strong><small>pessoas com 100% de ocupação</small></div></div>
   <div className="cap-kpi"><span className="stat-icon"><Hotel/></span><div><span>Alojamentos</span><strong>{nf(totals.properties)}</strong></div></div>
   <div className="cap-kpi"><span className="stat-icon"><Layers/></span><div><span>Tipologias</span><strong>{nf(totals.rooms)}</strong></div></div>
   <div className="cap-kpi"><span className="stat-icon"><BedDouble/></span><div><span>Quartos / unidades</span><strong>{nf(totals.units)}</strong><small>{totals.units?`${(totals.pax/totals.units).toLocaleString('pt-PT',{maximumFractionDigits:1})} pessoas por unidade`:''}</small></div></div></div>
  {totals.uncategorised>0&&<div className="cap-note" role="status"><TriangleAlert size={16}/><span><strong>{totals.uncategorised} de {totals.rooms} tipologias sem categoria</strong> ({nf(totals.byCategory[NO_CATEGORY]||0)} de {nf(totals.units)} unidades). Para ver quantos duplos, twins, familiares ou T1 existem, preenche a <em>Categoria</em> em Alojamentos → Tipologias. A capacidade em pessoas já está completa.</span></div>}
  <section className="panel cap-panel"><div className="cap-toolbar"><div className="cap-seg" role="group" aria-label="Agrupar por">{DIMENSIONS.map(d=><button key={d.id} type="button" className={by===d.id?'on':''} aria-pressed={by===d.id} onClick={()=>setBy(d.id)}>{d.label}</button>)}</div>
   <div className="cap-filters"><div className="bar-search"><Search size={14}/><Input aria-label="Pesquisar alojamentos" value={query} placeholder="Pesquisar" onChange={e=>setQuery(e.target.value)}/></div>
    <select aria-label="Estado" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos os estados</option>{options.statuses.map(s=><option key={s}>{s}</option>)}</select>
    <select aria-label="Região" value={region} onChange={e=>setRegion(e.target.value)}><option value="">Todas as regiões</option>{options.regions.map(s=><option key={s}>{s}</option>)}</select>
    <select aria-label="Localidade" value={city} onChange={e=>setCity(e.target.value)}><option value="">Todas as localidades</option>{options.cities.map(s=><option key={s}>{s}</option>)}</select>
    <select aria-label="Tipo de alojamento" value={type} onChange={e=>setType(e.target.value)}><option value="">Todos os tipos</option>{options.types.map(s=><option key={s}>{s}</option>)}</select>
    {filtersOn&&<Button variant="ghost" onClick={()=>{setStatus('Ativo');setRegion('');setCity('');setType('');setQuery('')}}>Limpar</Button>}</div></div>
   {groups.length?<div className="cap-table-wrap"><table className="cap-table"><thead><tr><th>{DIMENSIONS.find(d=>d.id===by)!.label}</th>{by!=='property'&&<th className="num">Alojam.</th>}{columns.map(c=><th className="num" key={c}>{c}</th>)}<th className="num">Unidades</th><th className="num">Capacidade</th><th className="cap-share-h">% do total</th></tr></thead>
   <tbody>{groups.map(g=>{const expandable=by==='property',isOpen=open.has(g.key);return <Fragment key={g.key}><tr className={expandable?'expandable':''} onClick={expandable?()=>toggle(g.key):undefined}><td><span className="cap-name">{expandable&&(isOpen?<ChevronDown size={15}/>:<ChevronRight size={15}/>)}<span><strong>{g.label}</strong>{g.sub&&<small>{g.sub}</small>}</span></span></td>{by!=='property'&&<td className="num">{g.properties}</td>}{columns.map(c=><td className="num" key={c}>{g.byCategory[c]?nf(g.byCategory[c]):<span className="dim">–</span>}</td>)}<td className="num">{nf(g.units)}</td><td className="num strong">{nf(g.pax)}</td><td className="cap-share"><span className="cap-bar"><i style={{width:`${g.pax/max*100}%`}}/></span><small>{pct(g.pax,totals.pax)}</small></td></tr>
    {expandable&&isOpen&&g.rooms.map(r=><tr className="cap-sub" key={r.id}><td><span className="cap-name sub">{r.name}</span></td>{columns.map(c=><td className="num" key={c}>{r.category===c?nf(r.units):''}</td>)}<td className="num">{nf(r.units)}</td><td className="num">{nf(r.pax)} <small>({r.perUnit}/un.)</small></td><td/></tr>)}</Fragment>})}</tbody>
   <tfoot><tr><td>Total</td>{by!=='property'&&<td className="num">{totals.properties}</td>}{columns.map(c=><td className="num" key={c}>{nf(totals.byCategory[c]||0)}</td>)}<td className="num">{nf(totals.units)}</td><td className="num strong">{nf(totals.pax)}</td><td/></tr></tfoot></table></div>
   :<p className="form-footnote cap-empty">Nenhum alojamento corresponde aos filtros.</p>}
   <p className="form-footnote">Capacidade = unidades × máximo de pessoas de cada tipologia, somado por alojamento. {by==='property'&&'Clica num alojamento para veres as tipologias.'}</p></section></>}
 </div>;
}
