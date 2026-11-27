"use client";
import {useEffect,useMemo,useState} from 'react';
import QRCode from 'qrcode';
import {Copy,ExternalLink,Download,Languages,LoaderCircle,TriangleAlert,Plus,PencilLine,Trash2,Save,FileInput,QrCode,MapPin} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Switch} from '@/components/ui/switch';
import {Checkbox} from '@/components/ui/checkbox';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {toast} from 'sonner';
import {LANGS,LANG_LABEL,GUEST_TEXTS,REC_CATEGORIES,REC_LABEL,normalizeGuestbook,cityRecsSchema,type Lang,type Guestbook,type GuestTextKey,type Recommendation,type CityRecs,type Translations} from '@/lib/guestbook';
type Api={error?:string,translations?:Record<string,Partial<Translations>>,failed?:Lang[],recs?:CityRecs};
import {brochurePath,type Property} from '@/lib/property';

const OTHER:Lang[]=['en','fr','es','de'];
/** Pede traduções de PT para as línguas indicadas. Devolve {id:{en,fr,…}}. */
async function translate(items:{id:string,text:string}[],langs:Lang[]=OTHER){
 const r=await fetch('/api/guestbook/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,langs})});
 const d=await r.json().catch(()=>({})) as Api;if(!r.ok)throw Error(d.error||'Não foi possível traduzir.');
 if(d.failed?.length)toast.warning(`Não foi possível traduzir para: ${d.failed.map(l=>LANG_LABEL[l]).join(', ')}. Tenta de novo daqui a pouco.`);
 return (d.translations||{}) as Record<string,Partial<Translations>>;
}
/** Campos das Regras internas que podem ir para o livro (nunca as instruções de chegada: podem ter códigos). */
const IMPORT:{to:GuestTextKey,from:string[]}[]=[{to:'services',from:['breakfast','cleaning','towels']},{to:'houseRules',from:['smoking','pets','children']},{to:'parking',from:['parking','directions']},{to:'departure',from:['late_alta']}];

export default function GuestbookEditor({draft,patch,savedName,canEdit,cityCount}:{draft:Property,patch:(p:Partial<Property>)=>void,savedName:string,canEdit:boolean,cityCount:number}){
 const g=useMemo(()=>normalizeGuestbook(draft.guestbook),[draft.guestbook]);
 const set=(p:Partial<Guestbook>)=>patch({guestbook:{...g,...p}});
 const setText=(key:GuestTextKey,lang:Lang,value:string)=>set({texts:{...g.texts,[key]:{...g.texts[key],[lang]:value}}});
 const [lang,setLang]=useState<Lang>('pt'),[translating,setTranslating]=useState(false);
 const saved=draft.version>0,path=brochurePath(savedName||draft.name);
 const [origin,setOrigin]=useState('');useEffect(()=>setOrigin(location.origin),[]);
 const url=origin+path;
 const filled=(l:Lang)=>GUEST_TEXTS.filter(t=>g.texts[t.key][l].trim()).length,ptCount=filled('pt');
 const pol=(k:string)=>(draft.policies[`${k}_alta`]||draft.policies[`${k}_baixa`]||draft.policies[k]||'').trim();

 async function runTranslate(overwrite:boolean){
  const items=GUEST_TEXTS.filter(t=>g.texts[t.key].pt.trim()&&(overwrite||OTHER.some(l=>!g.texts[t.key][l].trim()))).map(t=>({id:t.key,text:g.texts[t.key].pt}));
  if(!items.length){toast.info(overwrite?'Escreve primeiro os textos em português.':'Já está tudo traduzido.');return}
  setTranslating(true);
  try{const out=await translate(items);let n=0;const texts={...g.texts};
   for(const [key,tr] of Object.entries(out)){const k=key as GuestTextKey;const cur={...texts[k]};for(const l of OTHER){if(tr[l]&&(overwrite||!cur[l].trim())){cur[l]=tr[l]!;n++}}texts[k]=cur}
   set({texts});toast.success(n?`${n} traduções preenchidas. Revê-as e guarda a ficha.`:'Nada para atualizar.')}
  catch(e){toast.error(e instanceof Error?e.message:'Não foi possível traduzir.')}finally{setTranslating(false)}
 }
 function importRules(){
  let n=0;const texts={...g.texts};
  for(const m of IMPORT){if(texts[m.to].pt.trim())continue;const v=m.from.map(k=>(draft.policies[k]||'').trim()).filter(Boolean).join('\n\n');if(v){texts[m.to]={...texts[m.to],pt:v};n++}}
  set({texts});toast[n?'success':'info'](n?`${n} textos preenchidos a partir das Regras. Revê-os antes de publicar.`:'Não há nada para importar: os textos já estão preenchidos ou as Regras estão vazias.');
 }

 return <section className="panel form-panel gb-editor">
  <div className="section-heading"><div><h2>Livro de informações</h2><p>Página pública para os hóspedes, aberta por QR Code no alojamento, em português, inglês, francês, espanhol e alemão.</p></div></div>
  <div className="gb-warning" role="note"><TriangleAlert/><span><strong>Este livro é público.</strong> Qualquer pessoa com o link pode lê-lo: não escrevas códigos de portas, cofres ou keysafes. A palavra-passe do Wi-Fi fica visível.</span></div>

  <div className="gb-publish">
   <label className="gb-switch"><Switch checked={g.published} onCheckedChange={v=>set({published:v===true})} disabled={!canEdit}/><div><strong>{g.published?'Publicado':'Não publicado'}</strong><span>{g.published?'Os hóspedes podem abrir o livro pelo link e pelo QR Code.':'Só a equipa vê o livro (pré-visualização).'} A alteração aplica-se ao guardar a ficha.</span></div></label>
   {saved?<div className="gb-link"><code>{url}</code><div><Button variant="outline" size="sm" onClick={async()=>{try{await navigator.clipboard.writeText(url);toast.success('Link copiado.')}catch{}}}><Copy/> Copiar</Button><Button variant="outline" size="sm" asChild><a href={path} target="_blank" rel="noopener"><ExternalLink/> Abrir</a></Button></div></div>:<p className="field-help">Guarda a ficha para criar o link e o QR Code.</p>}
   {saved&&origin&&<QrBlock url={url} name={savedName||draft.name}/>}
  </div>

  <div className="gb-block"><h3>Wi-Fi e contactos</h3>
   <div className="form-grid">
    <GField label="Rede Wi-Fi" value={g.wifiNetwork} onChange={v=>set({wifiNetwork:v})} placeholder="Ex.: Umbral_Guests"/>
    <GField label="Palavra-passe do Wi-Fi" value={g.wifiPassword} onChange={v=>set({wifiPassword:v})}/>
    <GField label="Telefone para hóspedes" value={g.contactPhone} onChange={v=>set({contactPhone:v})} placeholder={draft.phone?`Se vazio, usa ${draft.phone}`:'+351'} type="tel"/>
    <div className="field"><span className="field-label">WhatsApp</span><label className="check-line gb-check"><Checkbox checked={g.whatsapp} onCheckedChange={v=>set({whatsapp:v===true})}/>Mostrar botão de WhatsApp com este número</label></div>
    <GField label="Silêncio a partir das" value={g.quietFrom} onChange={v=>set({quietFrom:v})} type="time"/>
    <GField label="Silêncio até às" value={g.quietTo} onChange={v=>set({quietTo:v})} type="time"/>
    <GField label="Tabela de quebras e danos (link)" value={g.damageUrl} onChange={v=>set({damageUrl:v})} placeholder="https://" type="url"/>
   </div>
   <p className="field-help">Check-in e check-out vêm das Regras (época alta): {pol('checkin')?`check-in a partir das ${pol('checkin')}${pol('checkinEnd')?` até às ${pol('checkinEnd')}`:''}`:'check-in por preencher'} · {pol('checkout')?`check-out até às ${pol('checkout')}`:'check-out por preencher'}. Morada, email, registo, comodidades e fotos vêm das outras secções da ficha.</p>
  </div>

  <div className="gb-block">
   <div className="gb-block-head"><h3>Textos para os hóspedes</h3>
    <div className="gb-actions">
     <Button variant="outline" size="sm" disabled={!canEdit} onClick={importRules}><FileInput/> Importar das Regras</Button>
     <Button variant="outline" size="sm" disabled={!canEdit||translating||!ptCount} onClick={()=>runTranslate(false)}>{translating?<LoaderCircle className="spin"/>:<Languages/>} Traduzir o que falta</Button>
     <Button variant="ghost" size="sm" disabled={!canEdit||translating||!ptCount} onClick={()=>runTranslate(true)}>Traduzir tudo de novo</Button>
    </div></div>
   <p className="field-help">Escreve em português e traduz automaticamente para as outras línguas; depois revê as traduções. Se uma tradução faltar, o hóspede vê o texto em português.</p>
   <div className="gb-langs" role="tablist">{LANGS.map(l=><button key={l} type="button" role="tab" aria-selected={lang===l} className={lang===l?'on':''} onClick={()=>setLang(l)}><span>{l.toUpperCase()}</span>{LANG_LABEL[l]}<em className={filled(l)>=ptCount&&ptCount>0?'ok':''}>{filled(l)}/{l==='pt'?GUEST_TEXTS.length:ptCount}</em></button>)}</div>
   <div className="gb-texts">{GUEST_TEXTS.map(t=><div className="field wide" key={t.key}>
    <label htmlFor={`gb-${t.key}-${lang}`}>{t.label}{lang!=='pt'&&!g.texts[t.key][lang].trim()&&g.texts[t.key].pt.trim()&&<span className="gb-missing">por traduzir</span>}</label>
    <Textarea id={`gb-${t.key}-${lang}`} value={g.texts[t.key][lang]} maxLength={6000} rows={t.key==='welcome'?3:4} placeholder={lang==='pt'?t.hint:(g.texts[t.key].pt||t.hint)} onChange={e=>setText(t.key,lang,e.target.value)}/>
   </div>)}</div>
  </div>

  <RecsEditor city={draft.city} canEdit={canEdit} cityCount={cityCount}/>
 </section>;
}

function GField({label,value,onChange,placeholder='',type='text'}:{label:string,value:string,onChange:(v:string)=>void,placeholder?:string,type?:string}){
 const id='gbf-'+label.replace(/\W+/g,'-');
 return <div className="field"><label htmlFor={id}>{label}</label><Input id={id} type={type} value={value} placeholder={placeholder} maxLength={type==='url'?500:120} onChange={e=>onChange(e.target.value)}/></div>;
}

/** QR Code do link público, para imprimir e colocar no alojamento. */
function QrBlock({url,name}:{url:string,name:string}){
 const [png,setPng]=useState('');
 useEffect(()=>{let live=true;QRCode.toDataURL(url,{width:1024,margin:2,errorCorrectionLevel:'M',color:{dark:'#2a3175',light:'#ffffff'}}).then(d=>{if(live)setPng(d)}).catch(()=>setPng(''));return()=>{live=false}},[url]);
 const file=`qr-livro-${name.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`;
 async function svg(){const s=await QRCode.toString(url,{type:'svg',margin:2,errorCorrectionLevel:'M',color:{dark:'#2a3175',light:'#ffffff'}});const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([s],{type:'image/svg+xml'}));a.download=file+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
 return <div className="gb-qr">{png?<img src={png} alt={`QR Code de ${url}`}/>:<div className="gb-qr-empty"><QrCode/></div>}
  <div><strong>QR Code</strong><span>Para imprimir e colocar na parede. Abre o livro na língua do telemóvel do hóspede.</span>
   <div className="gb-actions"><Button variant="outline" size="sm" disabled={!png} asChild={!!png}>{png?<a href={png} download={file+'.png'}><Download/> PNG</a>:<span><Download/> PNG</span>}</Button><Button variant="outline" size="sm" onClick={svg}><Download/> SVG (impressão)</Button></div></div>
 </div>;
}

const blankRec=():Recommendation=>({id:crypto.randomUUID(),category:'restaurants',name:'',note:{pt:'',en:'',fr:'',es:'',de:''},address:'',mapsUrl:'',website:'',phone:''});
/** Recomendações da localidade: partilhadas por todos os alojamentos da mesma localidade; gravadas à parte da ficha. */
function RecsEditor({city,canEdit,cityCount}:{city:string,canEdit:boolean,cityCount:number}){
 const [recs,setRecs]=useState<CityRecs|null>(null),[base,setBase]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [editing,setEditing]=useState<{rec:Recommendation,isNew:boolean}|null>(null),[noteLang,setNoteLang]=useState<Lang>('pt'),[formError,setFormError]=useState('');
 const c=city.trim();
 async function load(){if(!c){setRecs(null);return}setError('');try{const r=await fetch('/api/guestbook/recs?city='+encodeURIComponent(c),{cache:'no-store'});const d:Api=await r.json();if(!r.ok||!d.recs)throw Error(d.error);setRecs(d.recs);setBase(JSON.stringify(d.recs.items))}catch(e){setError(e instanceof Error&&e.message?e.message:'Não foi possível carregar as recomendações.')}}
 useEffect(()=>{load()},[c]);// eslint-disable-line react-hooks/exhaustive-deps
 const dirty=!!recs&&JSON.stringify(recs.items)!==base;
 async function save(){if(!recs)return;const check=cityRecsSchema.safeParse(recs);if(!check.success){toast.error(check.error.issues[0].message);return}setBusy(true);
  try{const r=await fetch('/api/guestbook/recs',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({city:c,...check.data})});const d:Api=await r.json();if(!r.ok||!d.recs)throw Error(d.error);setRecs(d.recs);setBase(JSON.stringify(d.recs.items));toast.success(`Recomendações de ${c} guardadas.`)}
  catch(e){toast.error(e instanceof Error?e.message:'Não foi possível guardar.')}finally{setBusy(false)}}
 async function translateNote(){if(!editing?.rec.note.pt.trim())return;setBusy(true);try{const out=await translate([{id:'note',text:editing.rec.note.pt}]);const tr=out.note||{};setEditing(e=>e&&{...e,rec:{...e.rec,note:{...e.rec.note,...Object.fromEntries(OTHER.filter(l=>tr[l]).map(l=>[l,tr[l]]))}}});toast.success('Nota traduzida.')}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível traduzir.')}finally{setBusy(false)}}
 function apply(){if(!editing||!recs)return;if(!editing.rec.name.trim()){setFormError('Preenche o nome.');return}const rec={...editing.rec,name:editing.rec.name.trim()};setRecs({...recs,items:editing.isNew?[...recs.items,rec]:recs.items.map(r=>r.id===rec.id?rec:r)});setEditing(null)}
 const remove=(id:string)=>recs&&setRecs({...recs,items:recs.items.filter(r=>r.id!==id)});
 if(!c)return <div className="gb-block"><h3>Recomendações</h3><p className="field-help">Preenche a localidade do alojamento (separador Geral) para gerir as recomendações.</p></div>;
 return <div className="gb-block">
  <div className="gb-block-head"><h3>Recomendações de {c}</h3>
   {canEdit&&recs&&<div className="gb-actions"><Button variant="outline" size="sm" onClick={()=>{setNoteLang('pt');setFormError('');setEditing({rec:blankRec(),isNew:true})}}><Plus/> Adicionar</Button><Button className="primary-btn" size="sm" disabled={!dirty||busy} onClick={save}>{busy&&!editing?<LoaderCircle className="spin"/>:<Save/>} Guardar recomendações</Button></div>}</div>
  <p className="field-help">Partilhadas com {cityCount>1?`os ${cityCount} alojamentos`:'o alojamento'} de {c}. Gravam-se à parte, com o botão “Guardar recomendações”.</p>
  {error?<p className="field-error">{error}</p>:!recs?<p className="field-help"><LoaderCircle className="spin"/> A carregar…</p>
  :!recs.items.length?<div className="gb-empty"><MapPin/><span>Ainda não há recomendações para {c}.</span></div>
  :REC_CATEGORIES.filter(cat=>recs.items.some(r=>r.category===cat)).map(cat=><div key={cat} className="gb-rec-group"><h4>{REC_LABEL[cat].pt}</h4>
   {recs.items.filter(r=>r.category===cat).map(r=><div key={r.id} className="gb-rec"><div><strong>{r.name}</strong><span>{[r.note.pt,r.address].filter(Boolean).join(' · ')||'Sem nota'}</span><em>{OTHER.filter(l=>r.note[l].trim()).length===4||!r.note.pt.trim()?'':'Tradução em falta'}</em></div>
    {canEdit&&<div className="gb-rec-actions"><Button variant="ghost" size="icon" aria-label={`Editar ${r.name}`} onClick={()=>{setNoteLang('pt');setFormError('');setEditing({rec:structuredClone(r),isNew:false})}}><PencilLine/></Button><Button variant="ghost" size="icon" aria-label={`Remover ${r.name}`} onClick={()=>remove(r.id)}><Trash2/></Button></div>}
   </div>)}</div>)}
  {dirty&&<p className="gb-dirty">Há alterações por guardar nas recomendações.</p>}

  <Dialog open={!!editing} onOpenChange={v=>{if(!v&&!busy)setEditing(null)}}><DialogContent className="gb-rec-dialog" aria-describedby="gb-rec-desc">{editing&&<>
   <DialogHeader><DialogTitle>{editing.isNew?'Nova recomendação':'Editar recomendação'}</DialogTitle><DialogDescription id="gb-rec-desc">Aparece no livro de todos os alojamentos de {c}.</DialogDescription></DialogHeader>
   <div className="form-grid">
    <div className="field"><label htmlFor="gb-rec-cat">Categoria</label><select id="gb-rec-cat" className="native-select" value={editing.rec.category} onChange={e=>setEditing({...editing,rec:{...editing.rec,category:e.target.value as Recommendation['category']}})}>{REC_CATEGORIES.map(cat=><option key={cat} value={cat}>{REC_LABEL[cat].pt}</option>)}</select></div>
    <GField label="Nome *" value={editing.rec.name} onChange={v=>setEditing({...editing,rec:{...editing.rec,name:v}})} placeholder="Ex.: Restaurante O Pescador"/>
    <GField label="Morada" value={editing.rec.address} onChange={v=>setEditing({...editing,rec:{...editing.rec,address:v}})}/>
    <GField label="Telefone" type="tel" value={editing.rec.phone} onChange={v=>setEditing({...editing,rec:{...editing.rec,phone:v}})}/>
    <GField label="Link do Google Maps (opcional)" type="url" value={editing.rec.mapsUrl} onChange={v=>setEditing({...editing,rec:{...editing.rec,mapsUrl:v}})} placeholder="Se vazio, pesquisa pelo nome"/>
    <GField label="Website" type="url" value={editing.rec.website} onChange={v=>setEditing({...editing,rec:{...editing.rec,website:v}})} placeholder="https://"/>
   </div>
   <div className="gb-note"><div className="gb-block-head"><span className="field-label">Nota para o hóspede</span><Button variant="outline" size="sm" disabled={busy||!editing.rec.note.pt.trim()} onClick={translateNote}>{busy?<LoaderCircle className="spin"/>:<Languages/>} Traduzir</Button></div>
    <div className="gb-langs small">{LANGS.map(l=><button key={l} type="button" className={noteLang===l?'on':''} onClick={()=>setNoteLang(l)}><span>{l.toUpperCase()}</span>{editing.rec.note[l].trim()&&<em className="ok">✓</em>}</button>)}</div>
    <Textarea value={editing.rec.note[noteLang]} rows={3} maxLength={1000} placeholder={noteLang==='pt'?'Ex.: Peixe fresco grelhado, a 5 minutos a pé. Reservar ao fim de semana.':editing.rec.note.pt} onChange={e=>setEditing({...editing,rec:{...editing.rec,note:{...editing.rec.note,[noteLang]:e.target.value}}})}/>
   </div>
   {formError&&<p className="field-error">{formError}</p>}
   <div className="settings-actions"><span/><div><Button variant="outline" disabled={busy} onClick={()=>setEditing(null)}>Cancelar</Button><Button className="primary-btn" disabled={busy} onClick={apply}>Aplicar</Button></div></div>
  </>}</DialogContent></Dialog>
 </div>;
}
