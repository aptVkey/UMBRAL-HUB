-- Notificações por email (Resend): cada envio fica registado, com o estado e o erro, se existir.
-- Os emails que falham são tentados de novo (até 3 vezes) pelo pedido periódico /api/notifications/retry.
create table if not exists public.notifications (
  id text primary key,
  event text not null,
  recipient_email text not null,
  subject text not null,
  html text not null,
  text_body text not null,
  dedupe_key text,
  status text not null default 'pending',
  attempts integer not null default 0,
  error text,
  provider_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists idx_notifications_status on public.notifications (status, created_at);
create index if not exists idx_notifications_dedupe on public.notifications (recipient_email, dedupe_key, created_at);
alter table public.notifications enable row level security;
revoke all on table public.notifications from anon, authenticated;

-- Preferências de cada membro (JSON com os tipos de aviso ligados/desligados).
create table if not exists public.notification_prefs (
  email text primary key,
  prefs text not null,
  updated_at text not null
);
alter table public.notification_prefs enable row level security;
revoke all on table public.notification_prefs from anon, authenticated;
