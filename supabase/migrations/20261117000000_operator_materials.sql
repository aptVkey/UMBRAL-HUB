-- Materiais / Documentos do separador Operadores: modelos e ficheiros partilhados,
-- nÃ£o associados a uma empresa especÃ­fica (ex.: templates e minutas).

create table public.operator_materials (
  id text primary key,
  key text not null,
  name text not null,
  size integer not null,
  type text not null,
  uploaded_by text not null,
  uploaded_at text not null
);
create index idx_operator_materials_uploaded_at on public.operator_materials(uploaded_at);

alter table public.operator_materials enable row level security;
revoke all on table public.operator_materials from anon, authenticated;
