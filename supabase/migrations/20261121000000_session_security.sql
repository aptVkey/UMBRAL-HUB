-- Sessões: cada conta tem uma "época". Um cookie emitido antes dela deixa de ser válido
-- (ex.: depois de mudar a palavra-passe, as sessões noutros dispositivos terminam).
alter table public.team_members add column if not exists session_epoch bigint not null default 0;

-- Tentativas de login falhadas, para limitar ataques de adivinhação por conta e por IP.
-- Só guarda as últimas 24 h (a app apaga as antigas).
create table if not exists public.login_attempts (
  id bigserial primary key,
  email text not null,
  ip text not null default '',
  at timestamptz not null default now()
);
create index if not exists idx_login_attempts_email_at on public.login_attempts (email, at);
create index if not exists idx_login_attempts_ip_at on public.login_attempts (ip, at);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;
revoke all on sequence public.login_attempts_id_seq from anon, authenticated;
