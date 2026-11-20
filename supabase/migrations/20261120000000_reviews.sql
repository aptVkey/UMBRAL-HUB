-- Reviews dos hóspedes (Google, Booking, Tripadvisor…) e respostas com aprovação humana.
create table public.reviews (
  id text primary key,
  property_id text not null references public.properties(id) on delete cascade,
  platform text not null,
  external_id text,
  author text not null default '',
  rating integer,
  body text not null default '',
  review_date text not null default '',
  status text not null default 'new',
  draft text not null default '',
  reply text not null default '',
  drafted_by text not null default '',
  approved_by text not null default '',
  approved_at text,
  published_at text,
  source text not null default 'manual',
  version integer not null default 1,
  created_at text not null,
  updated_at text not null
);
create unique index idx_reviews_external on public.reviews(platform, external_id) where external_id is not null;
create index idx_reviews_property on public.reviews(property_id);
create index idx_reviews_status on public.reviews(status);
alter table public.reviews enable row level security;
revoke all on table public.reviews from anon, authenticated;

-- Ligações a plataformas externas (ex.: conta Google). Os tokens ficam cifrados (AES-256-GCM)
-- com uma chave que só existe no servidor; nunca são devolvidos ao browser.
create table public.integrations (
  id text primary key,
  secret_enc text not null default '',
  account_label text not null default '',
  connected_by text not null default '',
  connected_at text,
  updated_at text not null
);
alter table public.integrations enable row level security;
revoke all on table public.integrations from anon, authenticated;

-- Correspondência entre cada alojamento e o seu perfil em cada plataforma (sem segredos).
create table public.property_integrations (
  property_id text not null references public.properties(id) on delete cascade,
  provider text not null,
  external_ref text not null,
  label text not null default '',
  last_sync_at text,
  last_error text not null default '',
  primary key (property_id, provider)
);
alter table public.property_integrations enable row level security;
revoke all on table public.property_integrations from anon, authenticated;
