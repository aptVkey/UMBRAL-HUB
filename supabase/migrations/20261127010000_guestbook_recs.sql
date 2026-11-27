-- Livro de informações: recomendações partilhadas por localidade (restaurantes, supermercados, cultura…).
create table if not exists public.guestbook_recs (
  city_key text primary key,
  city text not null,
  payload text not null,
  version integer not null,
  updated_at text not null,
  updated_by text not null default ''
);
alter table public.guestbook_recs enable row level security;
revoke all on table public.guestbook_recs from anon, authenticated;
