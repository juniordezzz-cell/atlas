-- Cota persistente por UID Firebase/dia UTC para o gateway do Scanner.
-- Só a função com papel de serviço pode reservar uma chamada. Sem políticas RLS.
create table if not exists scanner.chat_usage (
  uid text not null,
  dia date not null,
  usadas integer not null default 0 check (usadas >= 0),
  primary key (uid, dia)
);
alter table scanner.chat_usage enable row level security;
revoke all on scanner.chat_usage from public;

create or replace function public.scanner_chat_reserve(p_uid text, p_limit integer default 20)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, scanner
as $$
declare n integer;
begin
  if p_uid is null or length(p_uid) < 1 or length(p_uid) > 128 or p_limit is null or p_limit < 1 then
    return -1;
  end if;
  p_limit := least(p_limit, 20);
  insert into scanner.chat_usage (uid, dia, usadas)
  values (p_uid, (now() at time zone 'UTC')::date, 1)
  on conflict (uid, dia) do update
    set usadas = scanner.chat_usage.usadas + 1
    where scanner.chat_usage.usadas < p_limit
  returning usadas into n;
  return coalesce(n, -1);
end;
$$;

revoke all on function public.scanner_chat_reserve(text, integer) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.scanner_chat_reserve(text, integer) to service_role;
  end if;
end;
$$;
