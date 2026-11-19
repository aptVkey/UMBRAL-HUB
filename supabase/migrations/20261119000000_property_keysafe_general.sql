-- Código geral de cada alojamento (ex.: o código de clientes do keysafe de entrada).
-- Fica numa tabela própria, como os códigos de keysafe dos quartos, para só ser
-- devolvido a quem tem acesso à área de Alojamentos.

create table public.property_keysafe_general (
  property_id text primary key references public.properties(id) on delete cascade,
  code text not null,
  updated_at text not null
);

alter table public.property_keysafe_general enable row level security;
revoke all on table public.property_keysafe_general from anon, authenticated;