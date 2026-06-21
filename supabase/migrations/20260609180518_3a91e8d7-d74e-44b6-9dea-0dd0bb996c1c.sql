
create or replace function public.security_scan_query(_sql text)
returns setof jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare r record;
begin
  for r in execute 'select to_jsonb(t) as j from (' || _sql || ') t' loop
    return next r.j;
  end loop;
  return;
end;
$$;

create or replace function public.security_scan_exec(_sql text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  execute _sql;
end;
$$;

revoke execute on function public.security_scan_query(text) from public;
revoke execute on function public.security_scan_exec(text)  from public;
grant  execute on function public.security_scan_query(text) to service_role;
grant  execute on function public.security_scan_exec(text)  to service_role;
