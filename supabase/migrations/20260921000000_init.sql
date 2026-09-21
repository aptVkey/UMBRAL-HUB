-- Umbral Hub · esquema inicial (equivalente ao D1/SQLite; datas guardadas como texto ISO).
-- O acesso é feito só pelo servidor da app, com a chave secreta. RLS ativo e sem políticas:
-- a chave pública (anon) e utilizadores autenticados não leem nem escrevem nestas tabelas.

create table public.properties (id text primary key, name text not null, payload text not null, version integer not null default 1, updated_at text not null);
create table public.property_rates (id text primary key, property_id text not null references public.properties(id) on delete cascade, name text not null, code text not null);
create index idx_property_rates_property_id on public.property_rates(property_id);
create table public.unit_keysafes (unit_id text primary key, property_id text not null references public.properties(id) on delete cascade, code text not null, updated_at text not null);
create index idx_unit_keysafes_property_id on public.unit_keysafes(property_id);

create table public.corporates (id text primary key, name text not null, payload text not null, version integer not null default 1, updated_at text not null, last_write_id text not null, contract text);
create table public.corporate_properties (corporate_id text not null references public.corporates(id) on delete cascade, property_id text not null references public.properties(id) on delete restrict, primary key (corporate_id, property_id));
create index idx_corporate_properties_property_id on public.corporate_properties(property_id);

create table public.training_workspace (id text primary key, payload text not null, version integer not null, updated_at text not null);
create table public.tools (id text primary key, name text not null, payload text not null, version integer not null default 1, updated_at text not null);

create table public.collaborators (id text primary key, kind text not null, name text not null, payload text not null, version integer not null default 1, updated_at text not null, promo_code text, share_token text);
create index idx_collaborators_kind on public.collaborators(kind);
create unique index uq_collaborators_promo_code on public.collaborators(promo_code);
create unique index uq_collaborators_share_token on public.collaborators(share_token);
create table public.collaborator_results (id text primary key, owner_id text not null references public.collaborators(id) on delete cascade, date text not null, bookings integer not null, nights integer not null, revenue_cents bigint not null, note text not null default '', created_at text not null);
create index idx_collaborator_results_owner on public.collaborator_results(owner_id, date);

create table public.operators (id text primary key, name text not null, payload text not null, version integer not null default 1, updated_at text not null, last_write_id text not null);
create table public.operator_properties (operator_id text not null references public.operators(id) on delete cascade, property_id text not null references public.properties(id) on delete cascade, primary key (operator_id, property_id));
create index idx_operator_properties_property_id on public.operator_properties(property_id);
create table public.operator_messages (id text primary key, operator_id text not null references public.operators(id) on delete cascade, property_id text references public.properties(id) on delete cascade, reply_to_id text, author_email text not null, author_name text not null, body text not null, created_at text not null);
create index idx_operator_messages_operator on public.operator_messages(operator_id, created_at);
create table public.operator_attachments (id text primary key, message_id text not null references public.operator_messages(id) on delete cascade, key text not null, name text not null, size integer not null, type text not null);
create index idx_operator_attachments_message on public.operator_attachments(message_id);

create table public.campaigns (id text primary key, name text not null, payload text not null, version integer not null default 1, updated_at text not null, last_write_id text not null);
create table public.campaign_properties (campaign_id text not null references public.campaigns(id) on delete cascade, property_id text not null references public.properties(id) on delete restrict, primary key (campaign_id, property_id));
create index idx_campaign_properties_property_id on public.campaign_properties(property_id);
create table public.campaign_rates (campaign_id text not null references public.campaigns(id) on delete cascade, rate_id text not null references public.property_rates(id) on delete restrict, primary key (campaign_id, rate_id));
create index idx_campaign_rates_rate_id on public.campaign_rates(rate_id);
create table public.campaign_operators (campaign_id text not null references public.campaigns(id) on delete cascade, operator_id text not null references public.operators(id) on delete restrict, primary key (campaign_id, operator_id));
create index idx_campaign_operators_operator_id on public.campaign_operators(operator_id);

create table public.team_members (id text primary key, email text not null, name text not null, role text not null, status text not null, payload text not null, version integer not null default 1, updated_at text not null);
create unique index uq_team_members_email on public.team_members(email);
create table public.team_member_properties (member_id text not null references public.team_members(id) on delete cascade, property_id text not null references public.properties(id) on delete cascade, primary key (member_id, property_id));
create index idx_team_member_properties_property_id on public.team_member_properties(property_id);

-- Segurança: nada é acessível pelas chaves públicas.
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('revoke all on table public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;

-- Executa uma lista de instruções parametrizadas numa única transação (equivalente a db.batch do D1).
-- Cada item: {"sql": "... $1 ... $2", "params": [...]}. Devolve [{rows, changes}] por instrução.
create or replace function public.exec_sql(stmts jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare item jsonb; q text; prm jsonb; i int; n bigint; res jsonb := '[]'::jsonb; rws jsonb; lit text;
begin
  for item in select value from jsonb_array_elements(stmts) loop
    q := item->>'sql'; prm := coalesce(item->'params','[]'::jsonb);
    for i in reverse jsonb_array_length(prm)..1 loop
      lit := case jsonb_typeof(prm->(i-1))
        when 'null' then 'NULL' when 'number' then prm->>(i-1) when 'boolean' then prm->>(i-1)
        else quote_literal(prm->>(i-1)) end;
      q := replace(q, '$'||i, lit);
    end loop;
    if q ~* '^\s*(select|with)\M' then
      execute 'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from (' || q || ') t' into rws;
      res := res || jsonb_build_array(jsonb_build_object('rows', rws, 'changes', 0));
    else
      execute q; get diagnostics n = row_count;
      res := res || jsonb_build_array(jsonb_build_object('rows', '[]'::jsonb, 'changes', n));
    end if;
  end loop;
  return res;
end $$;
revoke all on function public.exec_sql(jsonb) from public, anon, authenticated;
grant execute on function public.exec_sql(jsonb) to service_role;
