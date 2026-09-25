-- Catálogo partilhado de comodidades personalizadas ("Outra comodidade ou serviço").
-- Uma comodidade personalizada criada num alojamento passa a ficar disponível (por selecionar)
-- em todos os outros; o nome/categoria fica em sync ao editar, e a eliminação remove-a de todos.
-- A associação a um alojamento em concreto (selecionada ou não, e as regras) continua a viver
-- só no JSON de cada alojamento — esta tabela guarda apenas a definição partilhada (nome/categoria).

create table public.custom_amenities (
  id text primary key,
  label text not null,
  group_name text not null,
  created_at text not null,
  updated_at text not null
);
create index idx_custom_amenities_label on public.custom_amenities(lower(label));

alter table public.custom_amenities enable row level security;
revoke all on table public.custom_amenities from anon, authenticated;
