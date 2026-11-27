-- Organograma: um único registo JSON (caixas, pessoas, contactos e ligações) com controlo de versão.
create table if not exists public.org_chart (
  id text primary key,
  payload text not null,
  version integer not null,
  updated_at text not null,
  updated_by text not null default ''
);
alter table public.org_chart enable row level security;
revoke all on table public.org_chart from anon, authenticated;
