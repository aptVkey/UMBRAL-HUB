/**
 * Gera os modelos de email do Supabase (convite e reposição de palavra-passe) com a mesma
 * moldura Umbral das notificações. Correr: node --experimental-strip-types scripts/email-templates.ts [pasta-de-pré-visualização]
 * Depois colar o conteúdo de docs/email-templates/*.html em Supabase → Authentication → Emails → Templates.
 */
import {writeFileSync,mkdirSync} from "node:fs";
import {emailShell,emailParts as P,renderEmail,logoUrl} from "../lib/email.ts";
const SITE="https://umbral-hub.vercel.app",logo=logoUrl(SITE);
const note=(t:string)=>`<p style="margin:22px 0 0;font-size:12px;line-height:1.55;color:#808080">${t}</p>`;
const templates={
 "convite.html":emailShell({logo,title:"Bem-vindo ao Umbral Hub",preheader:"Foi criada uma conta para ti no Umbral Hub. Escolhe a tua palavra-passe.",
  content:P.eyebrow("Bem-vindo ao Hub")+P.heading("Foste convidado para o Umbral Hub")+P.para("Foi criada uma conta para ti no Umbral Hub, o centro de informação do grupo Umbral. Carrega no botão para escolheres a tua palavra-passe e entrares.")
   +P.button("Criar a minha palavra-passe","{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite")+note("O link é válido durante 24 horas. Se não estavas à espera deste email, podes ignorá-lo."),
  footerHtml:"Este email foi enviado para {{ .Email }} porque um administrador te adicionou à equipa Umbral."}),
 "redefinir-palavra-passe.html":emailShell({logo,title:"Definir nova palavra-passe",preheader:"Recebemos um pedido para definir uma nova palavra-passe para a tua conta.",
  content:P.eyebrow("Repor acesso")+P.heading("Definir nova palavra-passe")+P.para("Recebemos um pedido para definir uma nova palavra-passe para a tua conta do Umbral Hub. Carrega no botão para escolheres a nova palavra-passe.")
   +P.button("Definir nova palavra-passe","{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery")+note("O link é válido durante 1 hora. Se não foste tu a pedir, ignora este email: a tua palavra-passe não muda."),
  footerHtml:"Este email foi enviado para {{ .Email }}, conta do Umbral Hub."}),
};
mkdirSync("docs/email-templates",{recursive:true});
for(const [f,html] of Object.entries(templates))writeFileSync(`docs/email-templates/${f}`,html);
const preview=process.argv[2];
if(preview){
 mkdirSync(preview,{recursive:true});
 const n=renderEmail({eyebrow:"Aprovação pendente",title:"Nova proposta para aprovar",intro:"Ana Silva propôs uma alteração que aguarda a tua aprovação.",
  rows:[["Área","Alojamentos"],["Registo","Alojamento · Água-Viva by Umbral"],["Tipo","Alteração"],["Pedido por","Ana Silva"],["Data","23/11/2026, 16:10"]],
  note:"Revê a proposta no sino de notificações do Hub para a aprovar ou rejeitar.",cta:{label:"Abrir o Umbral Hub",url:SITE}});
 writeFileSync(`${preview}/notificacao.html`,n.html.replace(logoUrl(""),logo));
 for(const [f,html] of Object.entries(templates))writeFileSync(`${preview}/${f}`,html.replaceAll("{{ .RedirectTo }}",SITE+"/redefinir").replaceAll("{{ .TokenHash }}","exemplo").replaceAll("{{ .Email }}","nome@byumbral.com"));
}
console.log("Modelos gerados em docs/email-templates");
