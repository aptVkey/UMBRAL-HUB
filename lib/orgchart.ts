import {z} from "zod";

/**
 * Organograma: caixas com uma ou mais pessoas (com contactos) e uma lista opcional (alojamentos ou responsabilidades).
 * Cada caixa liga-se de uma de três formas:
 *  - below:   abaixo da caixa "parentId" (hierarquia normal);
 *  - side:    ao lado da linha que desce da caixa "parentId" (assessoria, ex.: assistente);
 *  - support: apoio transversal, numa linha própria por baixo, ligado a várias caixas ("supports").
 * As posições não são guardadas: são calculadas por layoutOrgChart, para o desenho ficar sempre arrumado.
 */
export const ORG_TONES=["navy","soft","coral"] as const;
export type OrgTone=typeof ORG_TONES[number];
export const TONE_LABEL:Record<OrgTone,string>={navy:"Azul Umbral",soft:"Azul suave",coral:"Coral"};
export const ORG_PLACEMENTS=["below","side","support"] as const;
export type OrgPlacement=typeof ORG_PLACEMENTS[number];
export const PLACEMENT_LABEL:Record<OrgPlacement,string>={below:"Abaixo de outra caixa (hierarquia)",side:"Ao lado de outra caixa (assessoria)",support:"Apoio transversal (ligado a várias caixas)"};

const id=z.string().min(1).max(64);
const text=(max:number)=>z.string().trim().max(max,`Máximo de ${max} caracteres.`);
export const personSchema=z.object({
 id,
 name:text(120).min(1,"Preenche o nome de cada pessoa."),
 role:text(120).default(""),
 email:z.string().trim().toLowerCase().max(180).refine(v=>!v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),"Introduz um email válido.").default(""),
 phone:text(40).refine(v=>!v||/^\+?[\d\s().-]{6,}$/.test(v),"Introduz um telefone válido.").default(""),
 notes:text(500).default("")
});
export const boxSchema=z.object({
 id,
 people:z.array(personSchema).min(1,"Cada caixa tem de ter pelo menos uma pessoa.").max(12,"Máximo de 12 pessoas por caixa."),
 items:z.array(text(120)).max(40,"Máximo de 40 linhas por caixa.").default([]),
 parentId:id.nullable().default(null),
 placement:z.enum(ORG_PLACEMENTS).default("below"),
 supports:z.array(id).max(60).default([]),
 tone:z.enum(ORG_TONES).default("navy")
});
export type OrgPerson=z.infer<typeof personSchema>;
export type OrgBox=z.infer<typeof boxSchema>;

/** Caixas que podem ter outras por baixo ou ao lado: só as da hierarquia ("below"). */
const canParent=(b:OrgBox|undefined)=>!!b&&b.placement==="below";
export const orgChartSchema=z.object({version:z.number().int().min(0),boxes:z.array(boxSchema).max(200,"Máximo de 200 caixas.")}).superRefine((v,ctx)=>{
 const bad=(message:string)=>ctx.addIssue({code:"custom",path:["boxes"],message});
 const byId=new Map(v.boxes.map(b=>[b.id,b]));
 if(byId.size!==v.boxes.length)return bad("Existem caixas repetidas.");
 for(const b of v.boxes){
  const label=b.people[0]?.name||"Uma caixa";
  if(b.placement==="support"){
   if(!b.supports.length)return bad(`${label}: escolhe pelo menos uma caixa a apoiar.`);
   if(b.supports.some(s=>s===b.id||!byId.has(s)||byId.get(s)!.placement==="support"))return bad(`${label}: as ligações de apoio têm de ser a caixas da hierarquia.`);
  }else{
   if(b.placement==="side"&&!b.parentId)return bad(`${label}: escolhe a caixa ao lado da qual fica.`);
   if(b.parentId&&(b.parentId===b.id||!canParent(byId.get(b.parentId))))return bad(`${label}: a caixa de cima tem de pertencer à hierarquia.`);
  }
 }
 // Sem ciclos: subindo pelos "parentId" nunca se volta à mesma caixa.
 for(const b of v.boxes){const seen=new Set<string>();let cur:OrgBox|undefined=b;while(cur?.parentId&&cur.placement!=="support"){if(seen.has(cur.id))return bad("Há caixas que dependem umas das outras em círculo.");seen.add(cur.id);cur=byId.get(cur.parentId)}}
});
export type OrgChart=z.infer<typeof orgChartSchema>;

export const newOrgId=()=>typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36);
export const newPerson=():OrgPerson=>({id:newOrgId(),name:"",role:"",email:"",phone:"",notes:""});

/** Ids desta caixa e de todas as que estão por baixo dela (para não a ligar a um descendente). */
export function descendants(boxes:OrgBox[],rootId:string){const out=new Set([rootId]);let grew=true;while(grew){grew=false;for(const b of boxes)if(b.placement!=="support"&&b.parentId&&out.has(b.parentId)&&!out.has(b.id)){out.add(b.id);grew=true}}return out}

/** Remove uma caixa: as que estavam por baixo sobem para a caixa de cima; os apoios deixam de apontar para ela. */
export function removeBox(boxes:OrgBox[],boxId:string):OrgBox[]{
 const gone=boxes.find(b=>b.id===boxId);if(!gone)return boxes;
 const up=gone.placement==="support"?null:gone.parentId;
 return boxes.filter(b=>b.id!==boxId).map(b=>{
  let n=b;
  if(n.placement!=="support"&&n.parentId===boxId)n={...n,parentId:up,placement:up?n.placement:"below"};
  if(n.supports.includes(boxId)){const supports=n.supports.filter(s=>s!==boxId);n=n.placement==="support"&&!supports.length?{...n,supports,placement:"below",parentId:null}:{...n,supports}}
  return n;
 });
}
/** Troca a ordem de uma caixa com a vizinha do mesmo grupo (mesma caixa de cima e mesmo tipo de ligação). */
export function moveBox(boxes:OrgBox[],boxId:string,dir:-1|1):OrgBox[]{
 const b=boxes.find(x=>x.id===boxId);if(!b)return boxes;
 const same=(x:OrgBox)=>x.placement===b.placement&&(b.placement==="support"||x.parentId===b.parentId);
 const idx=boxes.map((x,i)=>same(x)?i:-1).filter(i=>i>=0),at=idx.indexOf(boxes.indexOf(b)),to=idx[at+dir];
 if(to===undefined)return boxes;
 const out=[...boxes];[out[boxes.indexOf(b)],out[to]]=[out[to],out[boxes.indexOf(b)]];return out;
}

const seedBox=(key:string,people:[string,string?][],o:Partial<OrgBox>={}):OrgBox=>({id:"seed-"+key,people:people.map(([name,role],i)=>({id:`seed-${key}-${i}`,name,role:role||"",email:"",phone:"",notes:""})),items:[],parentId:null,placement:"below",supports:[],tone:"navy",...o});
const MANAGERS=["alex","andreia","sandrine","pedro-lopes","fatima","claudia"].map(k=>"seed-"+k);
/** Organograma inicial (desenho original). Só é gravado quando alguém o edita pela primeira vez. */
export const orgChartSeed=():OrgChart=>({version:0,boxes:[
 seedBox("rui",[["Rui Sacramento"]]),
 seedBox("soraia",[["Soraia"]],{parentId:"seed-rui",placement:"side",tone:"soft"}),
 seedBox("goncalo",[["Gonçalo Teixeira"]],{parentId:"seed-rui"}),
 seedBox("alex",[["Alex"]],{parentId:"seed-goncalo",items:["Campo Mar","PHC","Recanto"]}),
 seedBox("andreia",[["Andreia"]],{parentId:"seed-goncalo",items:["Eira","Torre","Bem Vindo","VC","RSA","Água Viva","Casa das Pedras"]}),
 seedBox("sandrine",[["Sandrine"]],{parentId:"seed-goncalo",items:["Capri","Sequeira","Cerro"]}),
 seedBox("pedro-lopes",[["Pedro Lopes"]],{parentId:"seed-goncalo",items:["Fátima"]}),
 seedBox("fatima",[["Fátima Esteves"]],{parentId:"seed-goncalo",items:["VNMF"]}),
 seedBox("claudia",[["Cláudia"]],{parentId:"seed-goncalo",items:["Évora"]}),
 seedBox("governantas",[["Telma","Governanta Geral"],["Liliana","Subgovernanta Geral"]],{placement:"support",supports:MANAGERS.slice(0,3),tone:"soft"}),
 seedBox("manutencao",[["Pedro Sacramento","Diretor Manutenção"]],{placement:"support",supports:MANAGERS,tone:"coral"}),
]});

/* ---------------------------------------------------------------- Desenho */

export const ORG_BOX_W=230;
const GAP_X=26,LEVEL_GAP=64,SIDE_OFFSET=36,SIDE_GAP=12,SUPPORT_LANE=14,PAD=24;
/** Caixa com lista: cabeçalho escuro + lista. Sem lista: caixa compacta. As alturas seguem o CSS (.org-box). */
export const hasList=(b:OrgBox)=>b.items.length>0;
const singleRole=(b:OrgBox)=>b.people.length===1&&!!b.people[0].role;
export function boxHeight(b:OrgBox){
 if(hasList(b))return 22+20*b.people.length+(singleRole(b)?17:0)+24+22*b.items.length;
 return 24+(b.people.length===1?20+(singleRole(b)?18:0):22*b.people.length);
}
export type PlacedBox={box:OrgBox,x:number,y:number,w:number,h:number};
export type OrgLine={d:string,tone:"main"|"soft"|"coral"};
export function layoutOrgChart(boxes:OrgBox[]):{placed:PlacedBox[],lines:OrgLine[],width:number,height:number}{
 const byId=new Map(boxes.map(b=>[b.id,b]));
 const tree=boxes.filter(b=>b.placement==="below"),sides=boxes.filter(b=>b.placement==="side"&&canParent(byId.get(b.parentId||""))),supportBoxes=boxes.filter(b=>b.placement==="support");
 const kids=(p:string|null)=>tree.filter(b=>(b.parentId&&byId.has(b.parentId)?b.parentId:null)===p);
 const sideOf=(p:string)=>sides.filter(b=>b.parentId===p);
 // Profundidade de cada caixa e larguras das sub-árvores.
 const depth=new Map<string,number>(),width=new Map<string,number>();
 const walk=(b:OrgBox,d:number):number=>{depth.set(b.id,d);const ch=kids(b.id);const cw=ch.reduce((s,c)=>s+walk(c,d+1),0)+GAP_X*Math.max(0,ch.length-1);const w=Math.max(ORG_BOX_W,cw,sideOf(b.id).length?2*(SIDE_OFFSET+ORG_BOX_W):0);width.set(b.id,w);return w};
 const roots=kids(null);roots.forEach(r=>walk(r,0));
 const levels=Math.max(0,...[...depth.values()].map(d=>d+1));
 // Altura de cada nível: caixas com lista do mesmo nível ficam todas com a mesma altura.
 const rowList=Array.from({length:levels},()=>0),rowAny=Array.from({length:levels},()=>0),sideStack=Array.from({length:levels},()=>0);
 for(const b of tree){const d=depth.get(b.id);if(d===undefined)continue;const h=boxHeight(b);rowAny[d]=Math.max(rowAny[d],h);if(hasList(b))rowList[d]=Math.max(rowList[d],h)}
 for(const b of tree){const d=depth.get(b.id);if(d===undefined)continue;const s=sideOf(b.id);if(s.length)sideStack[d]=Math.max(sideStack[d],s.reduce((n,x)=>n+boxHeight(x),0)+SIDE_GAP*(s.length-1)+20)}
 const rowTop:number[]=[];let y=PAD;for(let d=0;d<levels;d++){rowTop[d]=y;y+=rowAny[d]+LEVEL_GAP+sideStack[d]}
 const placed:PlacedBox[]=[],pos=new Map<string,PlacedBox>(),lines:OrgLine[]=[];
 const place=(b:OrgBox,left:number)=>{
  const d=depth.get(b.id)!,w=width.get(b.id)!,cx=left+w/2,h=hasList(b)?rowList[d]:boxHeight(b);
  const p={box:b,x:cx-ORG_BOX_W/2,y:rowTop[d],w:ORG_BOX_W,h};placed.push(p);pos.set(b.id,p);
  const ch=kids(b.id),cw=ch.reduce((s,c)=>s+width.get(c.id)!,0)+GAP_X*Math.max(0,ch.length-1);
  let l=left+(w-cw)/2;for(const c of ch){place(c,l);l+=width.get(c.id)!+GAP_X}
  // Caixas ao lado: à direita da linha que desce, entre esta caixa e as de baixo.
  let sy=rowTop[d]+rowAny[d]+20,lastMid=0;
  for(const s of sideOf(b.id)){const sh=boxHeight(s),sp={box:s,x:cx+SIDE_OFFSET,y:sy,w:ORG_BOX_W,h:sh};placed.push(sp);pos.set(s.id,sp);lastMid=sy+sh/2;lines.push({d:`M${cx} ${lastMid}H${sp.x}`,tone:"main"});sy+=sh+SIDE_GAP}
  const bottom=p.y+p.h;
  if(ch.length){const bus=rowTop[d+1]-LEVEL_GAP/2,cs=ch.map(c=>pos.get(c.id)!.x+ORG_BOX_W/2);
   lines.push({d:`M${cx} ${bottom}V${bus}`,tone:"main"});
   if(cs.length>1||cs[0]!==cx)lines.push({d:`M${Math.min(cx,...cs)} ${bus}H${Math.max(cx,...cs)}`,tone:"main"});
   for(const c of ch){const cp=pos.get(c.id)!;lines.push({d:`M${cp.x+ORG_BOX_W/2} ${bus}V${cp.y}`,tone:"main"})}}
  else if(lastMid)lines.push({d:`M${cx} ${bottom}V${lastMid}`,tone:"main"});
 };
 let left=PAD;for(const r of roots){place(r,left);left+=width.get(r.id)!+GAP_X*2}
 let right=Math.max(left-GAP_X*2,PAD),bottom=Math.max(PAD,...placed.map(p=>p.y+p.h));
 // Apoios transversais: uma faixa de linhas por caixa e as caixas numa linha própria por baixo.
 const sup=supportBoxes.map(b=>({b,targets:b.supports.map(s=>pos.get(s)).filter((p):p is PlacedBox=>!!p)}));
 if(sup.length){
  const laneTop=bottom+28,boxTop=laneTop+SUPPORT_LANE*sup.length+30;
  const want=sup.map(s=>s.targets.length?s.targets.reduce((n,t)=>n+t.x+ORG_BOX_W/2,0)/s.targets.length:PAD+ORG_BOX_W/2);
  const order=sup.map((_,i)=>i).sort((a,b)=>want[a]-want[b]);let prev=PAD-GAP_X;const lefts:number[]=[];
  for(const i of order){lefts[i]=Math.max(want[i]-ORG_BOX_W/2,prev+GAP_X,PAD);prev=lefts[i]+ORG_BOX_W}
  sup.forEach((s,i)=>{
   const h=boxHeight(s.b),p={box:s.b,x:lefts[i],y:boxTop,w:ORG_BOX_W,h};placed.push(p);
   const tone=s.b.tone==="coral"?"coral":"soft",lane=laneTop+SUPPORT_LANE*i,dx=(i-(sup.length-1)/2)*12,bx=p.x+ORG_BOX_W/2;
   const xs=s.targets.map(t=>t.x+ORG_BOX_W/2+dx);
   for(const [k,t] of s.targets.entries())lines.push({d:`M${xs[k]} ${t.y+t.h}V${lane}`,tone});
   if(xs.length)lines.push({d:`M${Math.min(bx,...xs)} ${lane}H${Math.max(bx,...xs)}`,tone});
   lines.push({d:`M${bx} ${lane}V${p.y}`,tone});
  });
  right=Math.max(right,...placed.map(p=>p.x+p.w));bottom=Math.max(...placed.map(p=>p.y+p.h));
 }
 right=Math.max(right,...placed.map(p=>p.x+p.w));
 return {placed,lines,width:right+PAD,height:bottom+PAD};
}
