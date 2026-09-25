-- Pedidos de alteração: propostas de contribuidores que aguardam aprovação de um editor/administrador.
create table public.change_requests (
  id text primary key,
  area text not null,
  entity_type text not null,
  entity_id text not null,
  entity_name text not null,
  action text not null, -- 'save' | 'delete'
  payload text, -- JSON da ficha validada (null para eliminações)
  base_version integer not null,
  status text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  requested_by_email text not null,
  requested_by_name text not null,
  requested_at text not null,
  reviewed_by_email text,
  reviewed_by_name text,
  reviewed_at text,
  review_note text
);
create index idx_change_requests_status on public.change_requests(status, area);
create index idx_change_requests_entity on public.change_requests(entity_type, entity_id);

alter table public.change_requests enable row level security;
revoke all on table public.change_requests from anon, authenticated;
