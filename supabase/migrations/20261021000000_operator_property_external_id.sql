-- ID do alojamento no sistema do operador (ex.: o código com que a EC Travel identifica
-- o Água-Viva). É um atributo da ligação operador↔alojamento, por isso vive na tabela de ligação.
alter table public.operator_properties add column external_id text not null default '';
