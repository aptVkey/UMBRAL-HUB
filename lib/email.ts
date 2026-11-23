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
/** Email simples com as cores Umbral. Todo o texto é escapado; `rows` aparecem como tabela de detalhes. */
export function renderEmail(o:{title:string,intro:string,rows?:[string,string][],note?:string,cta?:{label:string,url:string},footer?:string}){
 const rows=(o.rows||[]).filter(([,v])=>v);
 const html=`<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f9;font-family:Arial,Helvetica,sans-serif;color:#303030">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e3e5ef">
<tr><td style="background:#ea525c;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:4px">UMBRAL</td></tr>
<tr><td style="padding:28px">
<div style="font-size:11px;letter-spacing:2px;color:#00adb6;font-weight:bold;text-transform:uppercase;margin-bottom:8px">Umbral Hub · Notificação</div>
<h1 style="margin:0 0 12px;font-size:20px;color:#2a3175">${esc(o.title)}</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.5">${esc(o.intro)}</p>
${rows.length?`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e5ef;border-radius:8px;margin-bottom:18px">${rows.map(([k,v],i)=>`<tr><td style="padding:10px 14px;font-size:13px;color:#505050;width:38%;${i?"border-top:1px solid #eef0f5;":""}">${esc(k)}</td><td style="padding:10px 14px;font-size:14px;color:#2a3175;font-weight:bold;${i?"border-top:1px solid #eef0f5;":""}">${esc(v)}</td></tr>`).join("")}</table>`:""}
${o.note?`<div style="background:#eff0f8;border-radius:8px;padding:12px 14px;font-size:14px;line-height:1.5;margin-bottom:18px">${esc(o.note)}</div>`:""}
${o.cta?`<a href="${esc(o.cta.url)}" style="display:inline-block;background:#2a3175;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;font-size:14px">${esc(o.cta.label)}</a>`:""}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #eef0f5;font-size:12px;color:#808080;line-height:1.5">${esc(o.footer||"Recebeste este email porque fazes parte da equipa Umbral. Podes escolher que avisos recebes em Definições → A minha conta → Notificações por email.")}</td></tr>
</table></td></tr></table></body></html>`;
 const text=[o.title,"",o.intro,...rows.map(([k,v])=>`${k}: ${v}`),...(o.note?["",o.note]:[]),...(o.cta?["",`${o.cta.label}: ${o.cta.url}`]:[]),"","—",o.footer||"Umbral Hub"].join("\n");
 return {html,text};
}
