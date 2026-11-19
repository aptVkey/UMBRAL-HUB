-- O código geral passa a ter três códigos: clientes (a coluna code), staff e keysafe inside.
alter table public.property_keysafe_general add column staff text not null default '';
alter table public.property_keysafe_general add column inside text not null default '';