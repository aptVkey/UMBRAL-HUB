-- Imagens dos conteúdos de formação (blocos de imagem do onboarding de cada cargo).
-- O ficheiro fica no Storage; o JSON da formação guarda apenas o id. As imagens que deixam
-- de ser usadas são apagadas ao guardar a formação (com uma margem de 24 h para envios
-- feitos num editor ainda por guardar).
create table public.training_images (
  id text primary key,
  key text not null,
  name text not null,
  size integer not null,
  type text not null,
  uploaded_by text not null,
  uploaded_at text not null
);
alter table public.training_images enable row level security;
revoke all on table public.training_images from anon, authenticated;
