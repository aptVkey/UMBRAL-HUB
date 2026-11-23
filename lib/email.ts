/**
 * Envio de emails de notificação pelo Resend (API HTTP, sem SDK).
 * Configuração (Vercel → Environment Variables):
 *  RESEND_API_KEY  chave da API do Resend
 *  EMAIL_FROM      remetente verificado, ex.: "Umbral Hub <notificacoes@umbral.pt>"
 *  APP_URL         endereço público da app, ex.: https://hub.umbral.pt (opcional; a Vercel indica um por defeito)
 */
export const emailConfigured=()=>!!process.env.RESEND_API_KEY&&!!process.env.EMAIL_FROM;
export function appUrl(){
 const explicit=process.env.APP_URL?.trim().replace(/\/+$/,"");if(explicit)return explicit;
 const vercel=process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL;return vercel?`https://${vercel}`:"";
}
export type SendResult={ok:true,id:string}|{ok:false,error:string,retry:boolean};
export async function sendEmail(msg:{to:string,subject:string,html:string,text:string}):Promise<SendResult>{
 const key=process.env.RESEND_API_KEY,from=process.env.EMAIL_FROM;
 if(!key||!from)return {ok:false,error:"Resend não configurado (RESEND_API_KEY / EMAIL_FROM).",retry:false};
 try{
  const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},
   body:JSON.stringify({from,to:[msg.to],subject:msg.subject,html:msg.html,text:msg.text}),signal:AbortSignal.timeout(8000)});
  const data=await r.json().catch(()=>null) as {id?:string,message?:string}|null;
  if(r.ok&&data?.id)return {ok:true,id:data.id};
  return {ok:false,error:(data?.message||`Resend respondeu ${r.status}`).slice(0,500),retry:r.status===429||r.status>=500};
 }catch(e){return {ok:false,error:(e instanceof Error?e.message:String(e)).slice(0,500),retry:true}}
}

const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
/** Identidade Umbral (as mesmas cores e tipos de letra do Hub). */
export const BRAND={coral:"#ea525c",navy:"#2a3175",turquoise:"#00adb6",turquoiseSoft:"#edfafa",navySoft:"#eff0f8",paper:"#f9f9f9",ink:"#303030",gray:"#505050",line:"#dbdbdb"};
const HEAD="'Montserrat',Arial,Helvetica,sans-serif",BODY="'Inter',Arial,Helvetica,sans-serif";
/** O logótipo branco do Hub, servido pela própria app (endereço público, sem login). */
export const logoUrl=(base=appUrl())=>`${base||"https://umbral-hub.vercel.app"}/umbral-logo-white.png`;
const FOOTER="Recebeste este email porque fazes parte da equipa Umbral. Podes escolher que avisos recebes em Definições → A minha conta → Notificações por email.";
/**
 * Moldura comum a todos os emails Umbral: cabeçalho coral com o logótipo, faixa navy "HUB | Centro de informação",
 * conteúdo e rodapé. `content` e `footerHtml` são HTML já seguro (escapado por quem chama).
 * Também é usada para gerar os modelos do Supabase (docs/email-templates).
 */
export function emailShell(o:{title:string,preheader:string,content:string,footerHtml:string,logo?:string}){
 const B=BRAND;
 return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${o.title}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Montserrat:wght@600;700&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${B.paper};font-family:${BODY};color:${B.ink};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${o.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${B.paper}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${B.line};border-radius:14px;overflow:hidden">
<tr><td style="background:${B.coral};padding:26px 32px"><img src="${o.logo||logoUrl()}" width="168" height="33" alt="UMBRAL" style="display:block;width:168px;height:33px;border:0;outline:none;color:#ffffff;font-family:${HEAD};font-size:22px;font-weight:700;letter-spacing:4px"></td></tr>
<tr><td style="background:${B.navy};padding:11px 32px;font-family:${HEAD};font-size:11px;letter-spacing:1.5px;color:#ffffff"><strong style="font-weight:700">HUB</strong>&nbsp;&nbsp;<span style="color:#8f95c4">|</span>&nbsp;&nbsp;<span style="color:#d6d9ee">Centro de informação</span></td></tr>
<tr><td style="padding:34px 32px 30px">${o.content}</td></tr>
<tr><td style="padding:20px 32px 24px;background:${B.paper};border-top:1px solid ${B.line}">
<div style="font-family:${HEAD};font-size:12px;font-weight:700;color:${B.navy};margin-bottom:4px">Grupo Umbral <span style="font-weight:600;color:${B.gray}">· Base de conhecimento</span></div>
<div style="font-size:12px;line-height:1.55;color:#808080">${o.footerHtml}</div></td></tr>
</table></td></tr></table></body></html>`;
}
const eyebrow=(t:string)=>`<div style="font-family:${HEAD};font-size:11px;font-weight:700;letter-spacing:1.5px;color:${BRAND.turquoise};text-transform:uppercase;margin:0 0 10px">${t}</div>`;
const heading=(t:string)=>`<h1 style="margin:0 0 14px;font-family:${HEAD};font-size:23px;line-height:1.3;font-weight:700;letter-spacing:-.3px;color:${BRAND.navy}">${t}</h1>`;
const para=(t:string)=>`<p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:${BRAND.ink}">${t}</p>`;
const button=(label:string,href:string)=>`<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:${BRAND.navy}"><a href="${href}" style="display:inline-block;padding:13px 26px;font-family:${HEAD};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${label}&nbsp;&nbsp;→</a></td></tr></table>`;
export const emailParts={eyebrow,heading,para,button,HEAD,BODY};

/** Email de notificação. Todo o texto é escapado; `rows` aparecem como tabela de detalhes. */
export function renderEmail(o:{title:string,intro:string,rows?:[string,string][],note?:string,cta?:{label:string,url:string},footer?:string,eyebrow?:string}){
 const B=BRAND,rows=(o.rows||[]).filter(([,v])=>v);
 const table=rows.length?`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${B.line};border-radius:10px;border-collapse:separate;margin:0 0 22px">${rows.map(([k,v],i)=>`<tr><td style="padding:11px 16px;font-size:13px;color:${B.gray};width:36%;vertical-align:top;${i?`border-top:1px solid #ececec;`:""}">${esc(k)}</td><td style="padding:11px 16px;font-family:${HEAD};font-size:14px;font-weight:600;color:${B.navy};${i?`border-top:1px solid #ececec;`:""}">${esc(v)}</td></tr>`).join("")}</table>`:"";
 const note=o.note?`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr><td style="background:${B.turquoiseSoft};border-left:3px solid ${B.turquoise};border-radius:6px;padding:13px 16px;font-size:14px;line-height:1.55;color:${B.ink}">${esc(o.note)}</td></tr></table>`:"";
 const content=eyebrow(esc(o.eyebrow||"Notificação"))+heading(esc(o.title))+para(esc(o.intro))+table+note+(o.cta?button(esc(o.cta.label),esc(o.cta.url)):"");
 const html=emailShell({title:esc(o.title),preheader:esc(o.intro),content,footerHtml:esc(o.footer||FOOTER)});
 const text=[o.title,"",o.intro,"",...rows.map(([k,v])=>`${k}: ${v}`),...(o.note?["",o.note]:[]),...(o.cta?["",`${o.cta.label}: ${o.cta.url}`]:[]),"","—","Grupo Umbral · Umbral Hub",o.footer||FOOTER].join("\n");
 return {html,text};
}
