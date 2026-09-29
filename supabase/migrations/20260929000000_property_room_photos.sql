-- Fotos por tipologia de alojamento (separador "Fotos"). room_id refere-se ao id de uma
-- tipologia dentro do JSON `rooms` do alojamento (as tipologias não têm tabela própria);
-- é validado à mão no servidor contra as tipologias atuais, não por FK.

create table public.property_room_photos (
  id text primary key,
  property_id text not null references public.properties(id) on delete cascade,
  room_id text not null,
  key text not null,
  name text not null,
  size integer not null,
  type text not null,
  uploaded_by text not null,
  uploaded_at text not null
);
create index idx_property_room_photos_property on public.property_room_photos(property_id, room_id);

alter table public.property_room_photos enable row level security;
revoke all on table public.property_room_photos from anon, authenticated;
