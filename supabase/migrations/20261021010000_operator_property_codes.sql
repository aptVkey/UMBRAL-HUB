-- O ID do alojamento no operador passa a ser independente da ligação: fica guardado mesmo
-- que o alojamento seja desmarcado do operador (e reaparece se voltar a ser marcado).
create table public.operator_property_codes (
  operator_id text not null references public.operators(id) on delete cascade,
  property_id text not null references public.properties(id) on delete cascade,
  external_id text not null,
  primary key (operator_id, property_id)
);
create index idx_operator_property_codes_property on public.operator_property_codes(property_id);
alter table public.operator_property_codes enable row level security;
revoke all on table public.operator_property_codes from anon, authenticated;

insert into public.operator_property_codes (operator_id, property_id, external_id)
select operator_id, property_id, external_id from public.operator_properties where external_id <> '';
alter table public.operator_properties drop column external_id;
