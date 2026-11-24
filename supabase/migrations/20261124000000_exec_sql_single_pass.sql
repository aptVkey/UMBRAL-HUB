-- exec_sql substituía os $N um a um (do maior para o menor). Um valor que contivesse "$1"
-- (ex.: o texto de uma review) era alterado pela substituição seguinte: a consulta partia
-- ("syntax error at or near ...") e um texto preparado conseguia executar SQL. Agora a
-- substituição é feita numa só passagem e um valor já inserido nunca volta a ser lido.
create or replace function public.exec_sql(stmts jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare item jsonb; q text; prm jsonb; n bigint; res jsonb := '[]'::jsonb; rws jsonb;
  parts text[]; tok record; idx int; out text; cnt int;
begin
  for item in select value from jsonb_array_elements(stmts) loop
    q := item->>'sql'; prm := coalesce(item->'params','[]'::jsonb); cnt := jsonb_array_length(prm);
    -- Substitui todos os $N numa só passagem: um valor já inserido nunca volta a ser lido,
    -- por isso um texto com "$4" (ex.: uma review) não pode partir nem alterar a consulta.
    if cnt > 0 then
      parts := regexp_split_to_array(q, '\$\d+');
      out := parts[1];
      for tok in select m[1] as d, o from regexp_matches(q, '\$(\d+)', 'g') with ordinality as t(m, o) loop
        idx := tok.d::int;
        if idx between 1 and cnt then
          out := out || case jsonb_typeof(prm->(idx-1))
            when 'null' then 'NULL' when 'number' then prm->>(idx-1) when 'boolean' then prm->>(idx-1)
            else quote_literal(prm->>(idx-1)) end;
        else
          out := out || '$' || tok.d;
        end if;
        out := out || parts[tok.o + 1];
      end loop;
      q := out;
    end if;
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
