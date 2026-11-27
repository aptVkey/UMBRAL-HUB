"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {MapPin,Phone,Mail,Share2,Navigation,LogIn,LogOut,Moon,Check,X,ChevronLeft,ChevronRight,Images,FileBadge,LoaderCircle,Wifi,Copy,Languages,MessageCircle,Siren,HeartPulse,ShieldAlert,BookOpen,ExternalLink,Utensils,Coffee,ShoppingBasket,Landmark,Waves,Mountain,ShoppingBag,Bus,Cross,Sparkles,DoorOpen,DoorClosed,ScrollText,ConciergeBell,WashingMachine,Recycle,ParkingCircle,FireExtinguisher,Eye,Globe} from 'lucide-react';
import {Toaster} from '@/components/ui/sonner';
import {toast} from 'sonner';
import {LANGS,LANG_LABEL,UI,TEXT_TITLE,GUEST_TEXTS,REC_CATEGORIES,REC_LABEL,AMENITY_GROUP_LABEL,COMPLAINTS_URL,amenityLabel,pick,recMapUrl,isLang,type Lang,type GuestTextKey,type Translations,type Recommendation,type RecCategory} from '@/lib/guestbook';

type Book={name:string,type:string,city:string,region:string,address:string,postal:string,license:string,email:string,phone:string,whatsapp:boolean,checkin:string,checkinEnd:string,checkout:string,quietFrom:string,quietTo:string,wifiNetwork:string,wifiPassword:string,damageUrl:string,texts:Record<GuestTextKey,Translations>,amenities:{label:string,group:string}[],updatedAt:string};
type Data={preview:boolean,property:Book,photos:string[],recommendations:Recommendation[]};
const TEXT_ICON:Record<GuestTextKey,React.ComponentType>={welcome:Sparkles,arrival:DoorOpen,departure:DoorClosed,houseRules:ScrollText,services:ConciergeBell,appliances:WashingMachine,waste:Recycle,parking:ParkingCircle,safety:FireExtinguisher};
const REC_ICON:Record<RecCategory,React.ComponentType>={restaurants:Utensils,cafes:Coffee,groceries:ShoppingBasket,culture:Landmark,beaches:Waves,activities:Mountain,shopping:ShoppingBag,transport:Bus,health:Cross};
const photoSrc=(id:string,w:number)=>`/api/guestbook/photo?id=${encodeURIComponent(id)}&w=${w}`;
const telHref=(v:string)=>'tel:'+v.replace(/[^\d+]/g,'');
const waHref=(v:string)=>{let d=v.replace(/\D/g,'');if(d.length===9)d='351'+d;return `https://wa.me/${d}`};
const LOCALE:Record<Lang,string>={pt:'pt-PT',en:'en-GB',fr:'fr-FR',es:'es-ES',de:'de-DE'};
const LANG_KEY='umbral-guestbook-lang';

/** Língua: ?lang= no link, depois a última escolhida neste telemóvel, depois a do telemóvel; por omissão português. */
function initialLang():Lang{
 try{const q=new URLSearchParams(location.search).get('lang');if(isLang(q))return q}catch{}
 try{const s=localStorage.getItem(LANG_KEY);if(isLang(s))return s}catch{}
 for(const l of (typeof navigator!=='undefined'?navigator.languages||[navigator.language]:[])){const c=(l||'').slice(0,2).toLowerCase();if(isLang(c))return c}
 return 'pt';
}

export default function PropertyBrochure({slug}:{slug:string}){
 const [data,setData]=useState<Data|null>(null),[state,setState]=useState<'loading'|'error'|'ready'>('loading'),[lang,setLang]=useState<Lang>('pt');
 useEffect(()=>{setLang(initialLang())},[]);
 useEffect(()=>{document.documentElement.lang=lang},[lang]);
 useEffect(()=>{let live=true;(async()=>{
  try{const r=await fetch('/api/guestbook?slug='+encodeURIComponent(slug),{cache:'no-store'});const d=await r.json().catch(()=>({})) as Partial<Data>;if(!live)return;
   if(!r.ok||!d.property)throw Error();setData(d as Data);setState('ready');document.title=`${d.property.name} · Umbral`;
  }catch{if(live)setState('error')}
 })();return()=>{live=false}},[slug]);
 const t=UI[lang];
 if(state==='loading')return <div className="bro-status"><LoaderCircle className="spin"/><span>{t.loading}</span></div>;
 if(state==='error'||!data)return <div className="bro-status"><BookOpen/><h1>{t.notFound}</h1><img src="/umbral-icon.png" alt="Umbral" className="bro-status-logo"/></div>;
 const choose=(l:Lang)=>{setLang(l);try{localStorage.setItem(LANG_KEY,l)}catch{};try{const u=new URL(location.href);u.searchParams.set('lang',l);history.replaceState(null,'',u)}catch{}};
 return <><BookView data={data} lang={lang} onLang={choose}/><Toaster position="bottom-center"/></>;
}

function BookView({data,lang,onLang}:{data:Data,lang:Lang,onLang:(l:Lang)=>void}){
 const p=data.property,t=UI[lang];
 const [lightbox,setLightbox]=useState<number|null>(null),[showAll,setShowAll]=useState(false),[langOpen,setLangOpen]=useState(false);
 const cover=data.photos[0];
 const mapUrl=p.address||p.city?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name,p.address,p.postal,p.city].filter(Boolean).join(', '))}`:'';
 const texts=GUEST_TEXTS.map(g=>({key:g.key,body:pick(p.texts?.[g.key],lang)})).filter(x=>x.body);
 const welcome=texts.find(x=>x.key==='welcome');
 const facts=[p.checkin&&{icon:<LogIn/>,label:t.checkin,value:`${t.from} ${p.checkin}`,extra:p.checkinEnd?`${t.until} ${p.checkinEnd}`:''},p.checkout&&{icon:<LogOut/>,label:t.checkout,value:`${t.until} ${p.checkout}`,extra:''},p.quietFrom&&p.quietTo&&{icon:<Moon/>,label:t.quiet,value:`${p.quietFrom} – ${p.quietTo}`,extra:''}].filter(Boolean) as {icon:React.ReactNode,label:string,value:string,extra:string}[];
 const amenityGroups=useMemo(()=>{const order=Object.keys(AMENITY_GROUP_LABEL);const m=new Map<string,string[]>();for(const a of p.amenities){const g=a.group||'Personalizadas';if(!m.has(g))m.set(g,[]);m.get(g)!.push(amenityLabel(a.label,lang))}return [...m.entries()].sort((a,b)=>(order.indexOf(a[0])+1||99)-(order.indexOf(b[0])+1||99))},[p.amenities,lang]);
 const recGroups=REC_CATEGORIES.map(c=>({c,items:data.recommendations.filter(r=>r.category===c)})).filter(g=>g.items.length);
 const sections=[
  p.wifiNetwork&&{id:'wifi',label:t.wifi},
  ...texts.filter(x=>x.key!=='welcome').map(x=>({id:x.key,label:TEXT_TITLE[x.key][lang]})),
  p.amenities.length&&{id:'comodidades',label:t.amenities},
  data.photos.length&&{id:'fotos',label:t.photos},
  recGroups.length&&{id:'recomendacoes',label:t.recommendations},
  {id:'emergencias',label:t.emergency},
  {id:'contactos',label:t.contacts},
 ].filter(Boolean) as {id:string,label:string}[];
 const active=useActiveSection(sections.map(s=>s.id));
 const navRef=useRef<HTMLElement>(null);
 useEffect(()=>{const nav=navRef.current,el=nav?.querySelector<HTMLElement>('a.on');if(nav&&el)nav.scrollTo({left:el.offsetLeft-nav.clientWidth/2+el.clientWidth/2,behavior:'smooth'})},[active]);
 async function copy(v:string){try{await navigator.clipboard.writeText(v);toast.success(t.copied)}catch{}}
 async function share(){const url=location.href;try{if(navigator.share){await navigator.share({title:p.name,url});return}await navigator.clipboard.writeText(url);toast.success(t.linkCopied)}catch{}}
 const shown=showAll?data.photos:data.photos.slice(0,9);

 return <div className="bro">
  {data.preview&&<div className="bro-preview"><Eye/> {t.preview}</div>}
  <header className={'bro-hero'+(cover?' has-photo':'')} style={cover?{backgroundImage:`url(${photoSrc(cover,1600)})`}:undefined}>
   <div className="bro-hero-bar">
    <div className="bro-lang"><button type="button" className="bro-round bro-lang-btn" aria-label={t.language} aria-expanded={langOpen} onClick={()=>setLangOpen(o=>!o)}><Languages/><span>{lang.toUpperCase()}</span></button>
     {langOpen&&<div className="bro-lang-menu" role="menu">{LANGS.map(l=><button key={l} type="button" role="menuitemradio" aria-checked={l===lang} className={l===lang?'on':''} onClick={()=>{onLang(l);setLangOpen(false)}}><span>{l.toUpperCase()}</span>{LANG_LABEL[l]}{l===lang&&<Check/>}</button>)}</div>}</div>
    <img src="/umbral-logo-white.png" alt="Umbral" className="bro-logo"/>
    <button type="button" className="bro-round" aria-label={t.share} onClick={share}><Share2/></button>
   </div>
   <div className="bro-hero-text">
    <div className="bro-kicker">{t.guide}</div>
    <h1>{p.name}</h1>
    {(p.city||p.address)&&<p><MapPin/>{p.city||p.address}</p>}
   </div>
   {cover&&<button type="button" className="bro-hero-photos" onClick={()=>setLightbox(0)}><Images/> {data.photos.length} {t.photos.toLowerCase()}</button>}
  </header>

  <div className="bro-body">
   {(p.phone||mapUrl||p.email)&&<div className="bro-actions">
    {p.phone&&<a href={telHref(p.phone)}><Phone/><span>{t.call}</span></a>}
    {p.phone&&p.whatsapp&&<a href={waHref(p.phone)} target="_blank" rel="noopener noreferrer" className="wa"><MessageCircle/><span>{t.whatsapp}</span></a>}
    {mapUrl&&<a href={mapUrl} target="_blank" rel="noopener noreferrer"><Navigation/><span>{t.map}</span></a>}
    {p.email&&<a href={`mailto:${p.email}`}><Mail/><span>{t.email}</span></a>}
   </div>}

   {welcome&&<p className="bro-welcome">{welcome.body}</p>}

   {p.wifiNetwork&&<section id="wifi" className="bro-wifi" aria-label={t.wifi}>
    <div className="bro-wifi-icon"><Wifi/></div>
    <div className="bro-wifi-rows">
     <div><span>{t.network}</span><strong>{p.wifiNetwork}</strong><button type="button" aria-label={`${t.copy} ${t.network}`} onClick={()=>copy(p.wifiNetwork)}><Copy/></button></div>
     {p.wifiPassword&&<div><span>{t.password}</span><strong className="mono">{p.wifiPassword}</strong><button type="button" aria-label={`${t.copy} ${t.password}`} onClick={()=>copy(p.wifiPassword)}><Copy/></button></div>}
    </div>
   </section>}

   {facts.length>0&&<div className="bro-facts">{facts.map(f=><div key={f.label}>{f.icon}<span>{f.label}</span><strong className={f.value.length>13?'long':''}>{f.value}</strong>{f.extra&&<small>{f.extra}</small>}</div>)}</div>}

   {sections.length>1&&<nav className="bro-nav" aria-label={t.guide} ref={navRef}>{sections.map(s=><a key={s.id} href={'#'+s.id} className={active===s.id?'on':''}>{s.label}</a>)}</nav>}

   {texts.filter(x=>x.key!=='welcome').map(x=>{const Icon=TEXT_ICON[x.key];return <section id={x.key} key={x.key} className="bro-section"><h2>{TEXT_TITLE[x.key][lang]}</h2>
    <div className="bro-card bro-textcard"><Icon/><div className="bro-text">{x.body}</div></div>
    {x.key==='houseRules'&&(p.quietFrom&&p.quietTo||p.damageUrl)&&<div className="bro-chips">{p.quietFrom&&p.quietTo&&<span><Moon/> {t.quietRule}: {p.quietFrom} – {p.quietTo}</span>}{p.damageUrl&&<a href={p.damageUrl} target="_blank" rel="noopener noreferrer"><ExternalLink/> {t.damage}</a>}</div>}
   </section>})}

   {p.amenities.length>0&&<section id="comodidades" className="bro-section"><h2>{t.amenities}</h2>
    <div className="bro-amenities">{amenityGroups.map(([group,list])=><div key={group} className="bro-card"><h3>{AMENITY_GROUP_LABEL[group]?.[lang]||group}</h3><ul>{list.map(a=><li key={a}><Check/><div><span>{a}</span></div></li>)}</ul></div>)}</div>
   </section>}

   {data.photos.length>0&&<section id="fotos" className="bro-section"><h2>{t.photos} <span className="bro-count">{data.photos.length}</span></h2>
    <div className="bro-gallery">{shown.map((id,i)=><button type="button" key={id} className={i===0?'big':''} onClick={()=>setLightbox(i)} aria-label={`${t.photo} ${i+1}`}><img src={photoSrc(id,i===0?1600:480)} alt="" loading={i<3?'eager':'lazy'} decoding="async"/></button>)}</div>
    {data.photos.length>shown.length&&<button type="button" className="bro-btn outline" onClick={()=>setShowAll(true)}>{t.seeAll} ({data.photos.length})</button>}
   </section>}

   {recGroups.length>0&&<section id="recomendacoes" className="bro-section"><h2>{t.recommendations}</h2>
    <p className="bro-muted bro-intro">{t.recIntro} {p.city}.</p>
    {recGroups.map(({c,items})=>{const Icon=REC_ICON[c];return <div key={c} className="bro-rec-group"><h3><Icon/> {REC_LABEL[c][lang]}</h3>
     <div className="bro-recs">{items.map(r=>{const note=pick(r.note,lang);return <div key={r.id} className="bro-card bro-rec">
      <strong>{r.name}</strong>{note&&<p>{note}</p>}{r.address&&<small><MapPin/> {r.address}</small>}
      <div className="bro-rec-actions"><a href={recMapUrl(r,p.city)} target="_blank" rel="noopener noreferrer"><Navigation/> {t.openMap}</a>{r.phone&&<a href={telHref(r.phone)}><Phone/> {t.call}</a>}{r.website&&<a href={r.website} target="_blank" rel="noopener noreferrer"><Globe/> {t.website}</a>}</div>
     </div>})}</div></div>})}
   </section>}

   <section id="emergencias" className="bro-section"><h2>{t.emergency}</h2>
    <p className="bro-muted bro-intro">{t.emergencyIntro}</p>
    <div className="bro-emergency">
     <a href="tel:112" className="sos"><Siren/><div><strong>112</strong><span>{t.e112}</span></div></a>
     <a href="tel:808242424"><HeartPulse/><div><strong>808 24 24 24</strong><span>{t.sns}</span></div></a>
     {p.phone&&<a href={telHref(p.phone)}><Phone/><div><strong>{p.phone}</strong><span>{t.host}</span></div></a>}
    </div>
   </section>

   <section id="contactos" className="bro-section"><h2>{t.contacts}</h2>
    <div className="bro-card bro-contacts">
     {p.address&&<a href={mapUrl} target="_blank" rel="noopener noreferrer"><MapPin/><div><span>{t.address}</span><strong>{[p.address,[p.postal,p.city].filter(Boolean).join(' ')].filter(Boolean).join('\n')}</strong></div><ChevronRight className="bro-go"/></a>}
     {p.phone&&<a href={telHref(p.phone)}><Phone/><div><span>{t.host}</span><strong>{p.phone}</strong></div><ChevronRight className="bro-go"/></a>}
     {p.email&&<a href={`mailto:${p.email}`}><Mail/><div><span>{t.email}</span><strong>{p.email}</strong></div><ChevronRight className="bro-go"/></a>}
    </div>
    <div className="bro-legal"><h3><ShieldAlert/> {t.legal}</h3>
     {p.license&&<p><FileBadge/> {t.license}: {p.license}</p>}
     <p>{t.aima}</p>
     <a href={COMPLAINTS_URL} target="_blank" rel="noopener noreferrer"><BookOpen/> {t.complaints}</a>
    </div>
   </section>

   <footer className="bro-footer"><img src="/umbral-icon.png" alt=""/><div><strong>Umbral</strong><span>{t.updated} {new Date(p.updatedAt).toLocaleDateString(LOCALE[lang],{day:'numeric',month:'long',year:'numeric'})}</span></div></footer>
  </div>

  {lightbox!==null&&data.photos.length>0&&<Lightbox photos={data.photos} start={Math.min(lightbox,data.photos.length-1)} t={t} title={p.name} onClose={()=>setLightbox(null)}/>}
 </div>;
}

/** Galeria em ecrã inteiro: desliza com o dedo (scroll-snap), setas e teclado no computador. */
function Lightbox({photos,start,title,t,onClose}:{photos:string[],start:number,title:string,t:Record<string,string>,onClose:()=>void}){
 const ref=useRef<HTMLDivElement>(null),[index,setIndex]=useState(start);
 useEffect(()=>{const el=ref.current;if(el)el.scrollTo({left:start*el.clientWidth,behavior:'instant' as ScrollBehavior});document.body.style.overflow='hidden';return()=>{document.body.style.overflow=''}},[start]);
 const go=(i:number)=>{const el=ref.current;if(!el)return;const n=Math.max(0,Math.min(photos.length-1,i));el.scrollTo({left:n*el.clientWidth,behavior:'smooth'})};
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();if(e.key==='ArrowRight')go(index+1);if(e.key==='ArrowLeft')go(index-1)};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)});
 return <div className="bro-lightbox" role="dialog" aria-modal="true" aria-label={`${t.photos} — ${title}`}>
  <div className="bro-lightbox-bar"><span>{index+1} / {photos.length}</span><button type="button" className="bro-round" aria-label={t.close} onClick={onClose}><X/></button></div>
  <div className="bro-slides" ref={ref} onScroll={e=>{const el=e.currentTarget;setIndex(Math.round(el.scrollLeft/el.clientWidth))}}>
   {photos.map((id,i)=><div className="bro-slide" key={id}>{Math.abs(i-index)<=2&&<img src={photoSrc(id,1600)} alt={`${t.photo} ${i+1} ${t.of} ${photos.length}`}/>}</div>)}
  </div>
  {index>0&&<button type="button" className="bro-round bro-prev" aria-label={t.prev} onClick={()=>go(index-1)}><ChevronLeft/></button>}
  {index<photos.length-1&&<button type="button" className="bro-round bro-next" aria-label={t.next} onClick={()=>go(index+1)}><ChevronRight/></button>}
 </div>;
}

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
