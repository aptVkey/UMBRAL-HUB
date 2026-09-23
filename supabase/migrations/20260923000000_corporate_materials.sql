-- Materiais / Documentos do separador Corporates: modelos e ficheiros partilhados,
-- não associados a uma empresa específica (ex.: minutas de acordo).

create table public.corporate_materials (
  id text primary key,
  key text not null,
  name text not null,
  size integer not null,
  type text not null,
  uploaded_by text not null,
  uploaded_at text not null
);
create index idx_corporate_materials_uploaded_at on public.corporate_materials(uploaded_at);

alter table public.corporate_materials enable row level security;
revoke all on table public.corporate_materials from anon, authenticated;
