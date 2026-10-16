-- Conector MCP do Atlas: códigos de autorização e tokens OAuth, guardados só com hash.
-- Só a Edge Function atlas-mcp (papel de serviço) usa as RPCs abaixo. Sem políticas RLS.
-- O Supabase concede EXECUTE a anon/authenticated por default privileges: revogar também deles
-- (mesmo cuidado de 20260927000002_scanner_chat_privileges.sql).
create schema if not exists atlas_mcp;
revoke all on schema atlas_mcp from public, anon, authenticated;

create table if not exists atlas_mcp.codigos (
  hash text primary key,
  uid text not null,
  client_id text not null,
  redirect_uri text not null,
  challenge text not null,
  expira timestamptz not null,
  usado boolean not null default false
);

create table if not exists atlas_mcp.tokens (
  hash text primary key,
  tipo text not null check (tipo in ('acesso', 'renovacao')),
  uid text not null,
  client_id text not null,
  familia text not null,
  expira timestamptz not null,
  revogado boolean not null default false,
  criado timestamptz not null default now(),
  minuto timestamptz,
  chamadas integer not null default 0
);
create index if not exists tokens_familia on atlas_mcp.tokens (familia);

alter table atlas_mcp.codigos enable row level security;
alter table atlas_mcp.tokens enable row level security;
revoke all on all tables in schema atlas_mcp from public, anon, authenticated;

create or replace function public.atlas_mcp_salvar_codigo(p_hash text, p_uid text, p_client text, p_redirect text, p_challenge text, p_segundos integer)
returns boolean language sql security definer set search_path = pg_catalog, atlas_mcp as $$
  insert into atlas_mcp.codigos (hash, uid, client_id, redirect_uri, challenge, expira)
  values (p_hash, p_uid, p_client, p_redirect, p_challenge, now() + make_interval(secs => least(p_segundos, 600)))
  returning true;
$$;

create or replace function public.atlas_mcp_consumir_codigo(p_hash text)
returns table (uid text, client_id text, redirect_uri text, challenge text)
language plpgsql security definer set search_path = pg_catalog, atlas_mcp as $$
#variable_conflict use_column
begin
  return query
    update atlas_mcp.codigos c set usado = true
    where c.hash = p_hash and not c.usado and c.expira > now()
    returning c.uid, c.client_id, c.redirect_uri, c.challenge;
end;
$$;

create or replace function public.atlas_mcp_salvar_token(p_hash text, p_tipo text, p_uid text, p_client text, p_familia text, p_segundos integer)
returns boolean language sql security definer set search_path = pg_catalog, atlas_mcp as $$
  insert into atlas_mcp.tokens (hash, tipo, uid, client_id, familia, expira)
  values (p_hash, p_tipo, p_uid, p_client, p_familia, now() + make_interval(secs => least(p_segundos, 2592000)))
  returning true;
$$;

create or replace function public.atlas_mcp_buscar_token(p_hash text, p_limite integer default 60)
returns table (uid text, client_id text, familia text, status text)
language plpgsql security definer set search_path = pg_catalog, atlas_mcp as $$
#variable_conflict use_column
declare
  t atlas_mcp.tokens%rowtype;
  agora_min timestamptz := date_trunc('minute', now());
begin
  select * into t from atlas_mcp.tokens where hash = p_hash and tipo = 'acesso' for update;
  if not found or t.revogado or t.expira <= now() then
    return query select null::text, null::text, null::text, 'invalido'::text; return;
  end if;
  if t.minuto is null or t.minuto < agora_min then
    update atlas_mcp.tokens set minuto = agora_min, chamadas = 1 where hash = p_hash;
  elsif t.chamadas >= p_limite then
    return query select t.uid, t.client_id, t.familia, 'limite'::text; return;
  else
    update atlas_mcp.tokens set chamadas = t.chamadas + 1 where hash = p_hash;
  end if;
  return query select t.uid, t.client_id, t.familia, 'ok'::text;
end;
$$;

create or replace function public.atlas_mcp_usar_renovacao(p_hash text)
returns table (uid text, client_id text, familia text, status text)
language plpgsql security definer set search_path = pg_catalog, atlas_mcp as $$
#variable_conflict use_column
declare t atlas_mcp.tokens%rowtype;
begin
  select * into t from atlas_mcp.tokens where hash = p_hash and tipo = 'renovacao' for update;
  if not found or t.expira <= now() then
    return query select null::text, null::text, null::text, 'invalido'::text; return;
  end if;
  if t.revogado then
    update atlas_mcp.tokens set revogado = true where familia = t.familia;
    return query select null::text, null::text, null::text, 'reuso'::text; return;
  end if;
  update atlas_mcp.tokens set revogado = true where hash = p_hash;
  return query select t.uid, t.client_id, t.familia, 'ok'::text;
end;
$$;

-- Revogação manual (sem tela até a fase 5): select public.atlas_mcp_revogar_uid('<uid>');
create or replace function public.atlas_mcp_revogar_uid(p_uid text)
returns integer language sql security definer set search_path = pg_catalog, atlas_mcp as $$
  with x as (update atlas_mcp.tokens set revogado = true where uid = p_uid and not revogado returning 1)
  select count(*)::integer from x;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'atlas_mcp_salvar_codigo(text, text, text, text, text, integer)',
    'atlas_mcp_consumir_codigo(text)',
    'atlas_mcp_salvar_token(text, text, text, text, text, integer)',
    'atlas_mcp_buscar_token(text, integer)',
    'atlas_mcp_usar_renovacao(text)',
    'atlas_mcp_revogar_uid(text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function public.%s to service_role', f);
    end if;
  end loop;
end;
$$;
