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

Os modelos usam a mesma moldura das notificações: cabeçalho coral com o logótipo Umbral, a faixa navy "HUB | Centro de informação", Montserrat/Inter e o botão navy. Estão prontos a colar em:

| Modelo no Supabase | Assunto | Ficheiro (copiar todo o conteúdo para "Message body") |
|---|---|---|
| **Invite user** | `Foste convidado para o Umbral Hub` | [docs/email-templates/convite.html](email-templates/convite.html) |
| **Reset password** | `Definir nova palavra-passe · Umbral Hub` | [docs/email-templates/redefinir-palavra-passe.html](email-templates/redefinir-palavra-passe.html) |

O logótipo é carregado de `https://umbral-hub.vercel.app/umbral-logo-white.png`. Se o endereço da app mudar, ou se quiseres alterar os textos, edita `scripts/email-templates.ts` e corre `node --experimental-strip-types scripts/email-templates.ts` para gerar os ficheiros de novo.
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
