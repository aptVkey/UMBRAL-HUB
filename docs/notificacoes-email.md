# Emails do Umbral Hub — configuração

Há dois tipos de email:

| Tipo | Quem envia | Exemplos |
|---|---|---|
| **Conta** | Supabase Auth (através do SMTP do Resend) | Convite para nova conta, "Esqueci-me da palavra-passe" |
| **Notificações da equipa** | A app, pela API do Resend | Proposta para aprovar, proposta aprovada/rejeitada, registo criado/alterado/eliminado |

Os emails **nunca** incluem códigos de keysafe, tarifas ou contratos: só o quê, quem, quando e um link para o Hub.

---

## 1. Resend

1. Criar conta em resend.com.
2. **Domains → Add domain** (ex.: `umbral.pt` ou um subdomínio como `mail.umbral.pt`).
3. Adicionar no DNS do domínio os registos que o Resend mostrar (SPF/MX e DKIM; DMARC recomendado). Esperar até o domínio ficar **Verified**.
4. **API Keys → Create API key** com permissão *Sending access*. Guardar a chave (só aparece uma vez).

## 2. Vercel → Settings → Environment Variables (Production)

| Variável | Valor |
|---|---|
| `RESEND_API_KEY` | a chave criada no passo 1.4 |
| `EMAIL_FROM` | `Umbral Hub <notificacoes@umbral.pt>` (o endereço tem de ser do domínio verificado) |
| `APP_URL` | o endereço público da app, ex.: `https://hub.umbral.pt` (usado no botão "Abrir o Umbral Hub") |
| `CRON_SECRET` | um texto aleatório longo (protege o reenvio diário de emails que falharam) |

Depois de gravar, fazer **Redeploy** para as variáveis ficarem ativas. Sem `RESEND_API_KEY`/`EMAIL_FROM` a app continua a funcionar: as notificações ficam registadas como `skipped` e não são enviadas.

## 3. Supabase → Authentication

### 3.1 SMTP (Authentication → Emails → SMTP Settings → Enable custom SMTP)

| Campo | Valor |
|---|---|
| Sender email | `notificacoes@umbral.pt` |
| Sender name | `Umbral Hub` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a chave da API do Resend |

Sem SMTP próprio, o Supabase só envia uns poucos emails por hora e apenas para membros da organização Supabase.

### 3.2 URLs (Authentication → URL Configuration)

- **Site URL**: o endereço público da app (ex.: `https://hub.umbral.pt`).
- **Redirect URLs**: adicionar `https://hub.umbral.pt/redefinir` (e o endereço `*.vercel.app/redefinir` se também usarem esse).

### 3.3 Modelos de email (Authentication → Emails → Templates)

Os links usam `token_hash`: o link só é "gasto" quando a pessoa grava a palavra-passe, e não quando um antivírus do email abre o link.

**Invite user** — Assunto: `Foste convidado para o Umbral Hub`

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#303030">
  <div style="background:#ea525c;color:#fff;padding:20px 28px;font-weight:bold;letter-spacing:4px;font-size:20px;border-radius:12px 12px 0 0">UMBRAL</div>
  <div style="border:1px solid #e3e5ef;border-top:0;padding:28px;border-radius:0 0 12px 12px">
    <h1 style="color:#2a3175;font-size:20px;margin:0 0 12px">Bem-vindo ao Umbral Hub</h1>
    <p style="font-size:15px;line-height:1.5">Foi criada uma conta para ti no Umbral Hub, o centro de informação do grupo Umbral. Carrega no botão para escolheres a tua palavra-passe.</p>
    <p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite" style="display:inline-block;background:#2a3175;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold">Criar a minha palavra-passe</a></p>
    <p style="font-size:12px;color:#808080">O link é válido durante 24 horas. Se não estavas à espera deste email, ignora-o.</p>
  </div>
</div>
```

**Reset password** — Assunto: `Definir nova palavra-passe · Umbral Hub`

```html
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#303030">
  <div style="background:#ea525c;color:#fff;padding:20px 28px;font-weight:bold;letter-spacing:4px;font-size:20px;border-radius:12px 12px 0 0">UMBRAL</div>
  <div style="border:1px solid #e3e5ef;border-top:0;padding:28px;border-radius:0 0 12px 12px">
    <h1 style="color:#2a3175;font-size:20px;margin:0 0 12px">Definir nova palavra-passe</h1>
    <p style="font-size:15px;line-height:1.5">Recebemos um pedido para definir uma nova palavra-passe para a tua conta do Umbral Hub.</p>
    <p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery" style="display:inline-block;background:#2a3175;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold">Definir nova palavra-passe</a></p>
    <p style="font-size:12px;color:#808080">O link é válido durante 1 hora. Se não foste tu a pedir, ignora este email: a tua palavra-passe não muda.</p>
  </div>
</div>
```

> A app também aceita os modelos por defeito do Supabase (link `{{ .ConfirmationURL }}`), por isso nada parte se os modelos ainda não tiverem sido trocados.

---

## Como funciona na app

- **Definições → Equipa → Adicionar membro**: com "Enviar convite por email" ligado (por defeito), a pessoa recebe o convite e escolhe a palavra-passe em `/redefinir`. Numa conta já criada, o botão **Enviar email de acesso** volta a enviar o link.
- **Login → Esqueci-me da palavra-passe**: envia o link de reposição. A resposta é sempre a mesma, exista ou não a conta, e há um limite de tentativas.
- **Definições → A minha conta → Notificações por email**: cada pessoa liga ou desliga:
  - *Pedidos para aprovar*: para quem tem nível "Edição" na área (ou é administrador);
  - *Decisões sobre os meus pedidos*: para o autor da proposta;
  - *Alterações nas minhas áreas*: para quem tem acesso à área e ao alojamento. Há no máximo um aviso por registo e por pessoa a cada 30 minutos.
- Quem faz a alteração nunca recebe o aviso da própria alteração.
- Cada envio fica na tabela `notifications` (`sent`, `failed`, `error`, `skipped`). Os `failed` são tentados de novo uma vez por dia (Cron da Vercel → `/api/notifications/retry`, até 3 tentativas). Os registos com mais de 90 dias são apagados.
