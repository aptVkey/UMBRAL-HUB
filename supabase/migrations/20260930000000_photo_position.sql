-- Ordem das fotos dentro de cada tipologia (arrastar para reorganizar).
alter table public.property_room_photos add column position integer not null default 0;

-- Preenche a posição das fotos já existentes pela ordem atual (data de envio),
-- para não alterar a ordem que a equipa já via.
with ordered as (
  select id, row_number() over (partition by room_id order by uploaded_at) - 1 as rn
  from public.property_room_photos
)
update public.property_room_photos p
set position = ordered.rn
from ordered
where ordered.id = p.id;

create index idx_property_room_photos_order on public.property_room_photos(property_id, room_id, position);
