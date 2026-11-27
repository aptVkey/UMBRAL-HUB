"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import dynamic from 'next/dynamic';
import {ArrowLeft,MapPin,Phone,Mail,Globe,Share2,Navigation,LogIn,LogOut,Clock,Check,X,ChevronLeft,ChevronRight,Images,Star,FileBadge,FolderOpen,LoaderCircle,ShieldCheck} from 'lucide-react';
import {Toaster} from '@/components/ui/sonner';
import {toast} from 'sonner';
import {policyGroups,photoUrl,PHOTO_THUMB,PHOTO_VIEW,amenityGroups} from '@/lib/property';

const Login=dynamic(()=>import('@/components/login'));
type Amenity={id:string,label:string,group:string,rules:string};
type Brochure={id:string,name:string,type:string,status:string,city:string,region:string,address:string,postal:string,license:string,email:string,phone:string,website:string,reviewLink:string,driveUrl:string,description:string,amenities:Amenity[],policies:Record<string,string>,hasDeposit:boolean,depositNormal:{alta:string,baixa:string},depositGroup:{alta:string,baixa:string},updatedAt:string};
type Data={property:Brochure,rooms:{id:string,name:string}[],photos:{id:string,roomId:string}[]};
type Season='alta'|'baixa';
const SEASON_LABEL:Record<Season,string>={alta:'Época alta',baixa:'Época baixa'};
const fmtDate=(iso:string)=>new Date(iso).toLocaleDateString('pt-PT',{day:'2-digit',month:'long',year:'numeric'});
const telHref=(v:string)=>'tel:'+v.replace(/[^\d+]/g,'');
const euro=(v:string)=>v?`${v.replace('.',',')} €`:'';
const host=(url:string)=>{try{return new URL(url).host.replace(/^www\./,'')}catch{return url}};

export default function PropertyBrochure({id}:{id:string}){
 const [data,setData]=useState<Data|null>(null),[state,setState]=useState<'loading'|'login'|'error'|'ready'>('loading'),[error,setError]=useState('');
 useEffect(()=>{let live=true;(async()=>{
  try{const r=await fetch('/api/properties/brochure?id='+encodeURIComponent(id),{cache:'no-store'});const d=await r.json().catch(()=>({})) as Partial<Data>&{error?:string};if(!live)return;
   if(r.status===401){setState('login');return}
   if(!r.ok||!d.property)throw Error(d.error||'Não foi possível carregar o alojamento.');
   setData(d as Data);setState('ready');document.title=`${d.property.name} · Umbral`;
  }catch(e){if(live){setError(e instanceof Error?e.message:'Não foi possível carregar o alojamento.');setState('error')}}
 })();return()=>{live=false}},[id]);
 if(state==='login')return <Login setupRequired={false}/>;
 if(state==='loading')return <div className="bro-status"><LoaderCircle className="spin"/><span>A carregar o alojamento…</span></div>;
 if(state==='error'||!data)return <div className="bro-status"><ShieldCheck/><h1>Não foi possível abrir este alojamento</h1><p>{error}</p><a className="bro-btn" href="/">Voltar ao hub</a></div>;
 return <><BrochureView data={data}/><Toaster position="bottom-center"/></>;
}

function BrochureView({data}:{data:Data}){
 const p=data.property,pol=(k:string)=>(p.policies[k]||'').trim();
 const seasonal=(k:string)=>({alta:pol(k+'_alta'),baixa:pol(k+'_baixa')});
 const [lightbox,setLightbox]=useState<number|null>(null),[filter,setFilter]=useState(''),[showAll,setShowAll]=useState(false),[readMore,setReadMore]=useState(false);
 const photos=filter?data.photos.filter(ph=>ph.roomId===filter):data.photos;
 const cover=data.photos[0];
 const mapUrl=p.address||p.city?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name,p.address,p.postal,p.city].filter(Boolean).join(', '))}`:'';
 // Horários principais: época alta por omissão; a época baixa só aparece quando é diferente.
 const fact=(k:string)=>{const s=seasonal(k);return {main:s.alta||s.baixa,alt:s.alta&&s.baixa&&s.alta!==s.baixa?s.baixa:''}};
 const facts=[{icon:<LogIn/>,label:'Check-in',value:fact('checkin'),suffix:pol('checkinEnd_alta')?` – ${pol('checkinEnd_alta')}`:''},{icon:<LogOut/>,label:'Check-out',value:fact('checkout'),prefix:'Até '},{icon:<Clock/>,label:'Receção',value:fact('reception')}].filter(f=>f.value.main);
 const amenityByGroup=useMemo(()=>{const order=[...Object.keys(amenityGroups),'Personalizadas'];const groups=new Map<string,Amenity[]>();for(const a of p.amenities){const g=a.group||'Outras';if(!groups.has(g))groups.set(g,[]);groups.get(g)!.push(a)}return [...groups.entries()].sort((a,b)=>(order.indexOf(a[0])+1||99)-(order.indexOf(b[0])+1||99))},[p.amenities]);
 const ruleGroups=policyGroups.map(g=>{
  const deposit=g.title==='Taxas e Cauções'&&p.hasDeposit;
  const rows=(season:Season|null)=>{
   const list:{label:string,value:string}[]=g.fields.map(f=>({label:f.label as string,value:g.seasonal?pol(`${f.key}_${season}`):pol(f.key)})).filter(r=>r.value);
   if(deposit&&season){const n=euro(p.depositNormal[season]),gr=euro(p.depositGroup[season]),txt=pol(`deposit_${season}`);
    if(n||gr||txt)list.push({label:'Caução',value:[n&&`Reserva normal: ${n}`,gr&&`Reserva de grupo: ${gr}`,txt].filter(Boolean).join('\n')})}
   return list;
  };
  if(!g.seasonal)return {title:g.title,seasonal:false,alta:rows(null),baixa:[] as {label:string,value:string}[],differs:false};
  const alta=rows('alta'),baixa=rows('baixa');
  return {title:g.title,seasonal:true,alta,baixa,differs:JSON.stringify(alta)!==JSON.stringify(baixa)};
 }).filter(g=>g.alta.length||g.baixa.length);
 const contacts=[
  p.address&&{icon:<MapPin/>,label:'Morada',value:[p.address,[p.postal,p.city].filter(Boolean).join(' ')].filter(Boolean).join('\n'),href:mapUrl},
  p.phone&&{icon:<Phone/>,label:'Telefone',value:p.phone,href:telHref(p.phone)},
  p.email&&{icon:<Mail/>,label:'Email',value:p.email,href:`mailto:${p.email}`},
  p.website&&{icon:<Globe/>,label:'Website',value:host(p.website),href:p.website},
  p.reviewLink&&{icon:<Star/>,label:'Reviews',value:host(p.reviewLink),href:p.reviewLink},
  p.driveUrl&&{icon:<FolderOpen/>,label:'Todas as fotos',value:'Pasta partilhada',href:p.driveUrl},
  p.license&&{icon:<FileBadge/>,label:'Registo / licença',value:p.license},
 ].filter(Boolean) as {icon:React.ReactNode,label:string,value:string,href?:string}[];
 const sections=[p.description&&{id:'sobre',label:'Sobre'},data.photos.length&&{id:'fotos',label:'Fotos'},p.amenities.length&&{id:'comodidades',label:'Comodidades'},ruleGroups.length&&{id:'regras',label:'Regras'},contacts.length&&{id:'contactos',label:'Contactos'}].filter(Boolean) as {id:string,label:string}[];
 const active=useActiveSection(sections.map(s=>s.id));
 const navRef=useRef<HTMLElement>(null);
 // O separador ativo fica sempre visível na barra (que desliza na horizontal em ecrãs estreitos).
 useEffect(()=>{const nav=navRef.current,el=nav?.querySelector<HTMLElement>('a.on');if(nav&&el)nav.scrollTo({left:el.offsetLeft-nav.clientWidth/2+el.clientWidth/2,behavior:'smooth'})},[active]);
 async function share(){const url=window.location.href;try{if(navigator.share){await navigator.share({title:p.name,text:`${p.name} — ${[p.type,p.city].filter(Boolean).join(' · ')}`,url});return}await navigator.clipboard.writeText(url);toast.success('Link copiado.')}catch(e){if((e as Error)?.name!=='AbortError')toast.error('Não foi possível partilhar o link.')}}
 const long=p.description.length>520;
 const shown=showAll?photos:photos.slice(0,9);

 return <div className="bro">
  <header className={'bro-hero'+(cover?' has-photo':'')} style={cover?{backgroundImage:`url(${photoUrl(cover.id,PHOTO_VIEW)})`}:undefined}>
   <div className="bro-hero-bar"><a href="/" className="bro-round" aria-label="Voltar ao hub"><ArrowLeft/></a><img src="/umbral-logo-white.png" alt="Umbral" className="bro-logo"/><button type="button" className="bro-round" aria-label="Partilhar" onClick={share}><Share2/></button></div>
   <div className="bro-hero-text">
    <div className="bro-kicker">{[p.type,p.region].filter(Boolean).join(' · ')}</div>
    <h1>{p.name}</h1>
    {(p.city||p.address)&&<p><MapPin/>{p.city||p.address}</p>}
    {p.status!=='Ativo'&&<span className="bro-chip">{p.status}</span>}
   </div>
   {cover&&<button type="button" className="bro-hero-photos" onClick={()=>{setFilter('');setLightbox(0)}}><Images/> {data.photos.length} fotos</button>}
  </header>

  <div className="bro-body">
   {(p.phone||p.email||mapUrl||p.website)&&<div className="bro-actions">
    {p.phone&&<a href={telHref(p.phone)}><Phone/><span>Ligar</span></a>}
    {p.email&&<a href={`mailto:${p.email}`}><Mail/><span>Email</span></a>}
    {mapUrl&&<a href={mapUrl} target="_blank" rel="noopener noreferrer"><Navigation/><span>Mapa</span></a>}
    {p.website&&<a href={p.website} target="_blank" rel="noopener noreferrer"><Globe/><span>Website</span></a>}
   </div>}

   {facts.length>0&&<div className="bro-facts">{facts.map(f=><div key={f.label}>{f.icon}<span>{f.label}</span><strong className={(f.prefix||'').length+f.value.main.length+(f.suffix||'').length>13?'long':''}>{f.prefix||''}{f.value.main}{f.suffix||''}</strong>{f.value.alt&&<small>Época baixa: {f.value.alt}</small>}</div>)}</div>}

   {sections.length>1&&<nav className="bro-nav" aria-label="Secções" ref={navRef}>{sections.map(s=><a key={s.id} href={'#'+s.id} className={active===s.id?'on':''}>{s.label}</a>)}</nav>}

   {p.description&&<section id="sobre" className="bro-section"><h2>Sobre o alojamento</h2>
    <div className={'bro-text'+(long&&!readMore?' clamp':'')}>{p.description}</div>
    {long&&<button type="button" className="bro-link" onClick={()=>setReadMore(v=>!v)}>{readMore?'Mostrar menos':'Ler mais'}</button>}
   </section>}

   {data.photos.length>0&&<section id="fotos" className="bro-section"><h2>Fotos <span className="bro-count">{data.photos.length}</span></h2>
    {data.rooms.length>1&&<div className="bro-filters" role="tablist" aria-label="Filtrar fotos">{[{id:'',name:'Todas'},...data.rooms].map(r=><button key={r.id} type="button" role="tab" aria-selected={filter===r.id} className={filter===r.id?'on':''} onClick={()=>{setFilter(r.id);setShowAll(false)}}>{r.name||'Sem nome'}</button>)}</div>}
    <div className="bro-gallery">{shown.map((ph,i)=><button type="button" key={ph.id} className={i===0?'big':''} onClick={()=>setLightbox(i)} aria-label={`Abrir foto ${i+1}`}><img src={photoUrl(ph.id,i===0?PHOTO_VIEW:PHOTO_THUMB)} alt="" loading={i<3?'eager':'lazy'} decoding="async"/></button>)}</div>
    {photos.length>shown.length&&<button type="button" className="bro-btn outline" onClick={()=>setShowAll(true)}>Ver todas as fotos ({photos.length})</button>}
   </section>}

   {p.amenities.length>0&&<section id="comodidades" className="bro-section"><h2>Comodidades e serviços</h2>
    <div className="bro-amenities">{amenityByGroup.map(([group,list])=><div key={group} className="bro-card"><h3>{group}</h3><ul>{list.map(a=><li key={a.id}><Check/><div><span>{a.label}</span>{a.rules&&<small>{a.rules}</small>}</div></li>)}</ul></div>)}</div>
   </section>}

   {ruleGroups.length>0&&<section id="regras" className="bro-section"><h2>Regras e informações</h2>
    {ruleGroups.map(g=><RuleGroup key={g.title} group={g}/>)}
   </section>}

   {contacts.length>0&&<section id="contactos" className="bro-section"><h2>Contactos e localização</h2>
    <div className="bro-card bro-contacts">{contacts.map(c=>{const inner=<>{c.icon}<div><span>{c.label}</span><strong>{c.value}</strong></div>{c.href&&<ChevronRight className="bro-go"/>}</>;return c.href?<a key={c.label} href={c.href} target={c.href.startsWith('http')?'_blank':undefined} rel="noopener noreferrer">{inner}</a>:<div key={c.label} className="bro-contact-static">{inner}</div>})}</div>
   </section>}

   <footer className="bro-footer"><img src="/umbral-icon.png" alt=""/><div><strong>Grupo Umbral</strong><span>Informação interna{p.updatedAt?` · atualizada a ${fmtDate(p.updatedAt)}`:''}</span></div></footer>
  </div>

  {lightbox!==null&&photos.length>0&&<Lightbox photos={photos} start={Math.min(lightbox,photos.length-1)} title={p.name} onClose={()=>setLightbox(null)}/>}
 </div>;
}

function RuleGroup({group}:{group:{title:string,seasonal:boolean,alta:{label:string,value:string}[],baixa:{label:string,value:string}[],differs:boolean}}){
 const [season,setSeason]=useState<Season>(group.alta.length?'alta':'baixa');
 const rows=group.seasonal?(group.differs?group[season]:group.alta.length?group.alta:group.baixa):group.alta;
 return <div className="bro-card bro-rules">
  <div className="bro-rules-head"><h3>{group.title}</h3>{group.seasonal&&group.differs&&<div className="bro-seg" role="tablist">{(['alta','baixa'] as Season[]).map(s=><button key={s} type="button" role="tab" aria-selected={season===s} className={season===s?'on':''} onClick={()=>setSeason(s)}>{SEASON_LABEL[s]}</button>)}</div>}</div>
  {rows.length?<dl>{rows.map(r=><div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl>:<p className="bro-muted">Sem informação para a {SEASON_LABEL[season].toLowerCase()}.</p>}
 </div>;
}

/** Galeria em ecrã inteiro: desliza com o dedo (scroll-snap), setas e teclado no computador. */
function Lightbox({photos,start,title,onClose}:{photos:{id:string}[],start:number,title:string,onClose:()=>void}){
 const ref=useRef<HTMLDivElement>(null),[index,setIndex]=useState(start);
 useEffect(()=>{const el=ref.current;if(el)el.scrollTo({left:start*el.clientWidth,behavior:'instant' as ScrollBehavior});document.body.style.overflow='hidden';return()=>{document.body.style.overflow=''}},[start]);
 const go=(i:number)=>{const el=ref.current;if(!el)return;const n=Math.max(0,Math.min(photos.length-1,i));el.scrollTo({left:n*el.clientWidth,behavior:'smooth'})};
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();if(e.key==='ArrowRight')go(index+1);if(e.key==='ArrowLeft')go(index-1)};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)});
 return <div className="bro-lightbox" role="dialog" aria-modal="true" aria-label={`Fotos de ${title}`}>
  <div className="bro-lightbox-bar"><span>{index+1} / {photos.length}</span><button type="button" className="bro-round" aria-label="Fechar" onClick={onClose}><X/></button></div>
  <div className="bro-slides" ref={ref} onScroll={e=>{const el=e.currentTarget;setIndex(Math.round(el.scrollLeft/el.clientWidth))}}>
   {photos.map((ph,i)=><div className="bro-slide" key={ph.id}>{Math.abs(i-index)<=2&&<img src={photoUrl(ph.id,PHOTO_VIEW)} alt={`Foto ${i+1} de ${photos.length}`}/>}</div>)}
  </div>
  {index>0&&<button type="button" className="bro-round bro-prev" aria-label="Foto anterior" onClick={()=>go(index-1)}><ChevronLeft/></button>}
  {index<photos.length-1&&<button type="button" className="bro-round bro-next" aria-label="Foto seguinte" onClick={()=>go(index+1)}><ChevronRight/></button>}
 </div>;
}

/** Secção visível no ecrã, para destacar o separador correspondente na navegação fixa. */
function useActiveSection(ids:string[]){
 const [active,setActive]=useState(ids[0]||''),key=ids.join(',');
 useEffect(()=>{
  const els=ids.map(i=>document.getElementById(i)).filter((e):e is HTMLElement=>!!e);if(!els.length)return;
  const io=new IntersectionObserver(entries=>{const vis=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);if(vis[0])setActive(vis[0].target.id)},{rootMargin:'-120px 0px -55% 0px'});
  els.forEach(e=>io.observe(e));return()=>io.disconnect();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[key]);
 return active;
}
