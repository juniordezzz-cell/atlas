-- Memória pessoal e avaliações independentes do Oráculo, acessíveis só por RPC de serviço.
create table if not exists scanner.chat_memory (
  uid text primary key check (length(uid) between 1 and 128),
  preferences jsonb not null check (jsonb_typeof(preferences) = 'object' and octet_length(preferences::text) <= 18000),
  updated_at timestamptz not null default now()
);
create table if not exists scanner.chat_feedback (
  id bigint generated always as identity primary key,
  uid text not null check (length(uid) between 1 and 128),
  feedback jsonb not null check (jsonb_typeof(feedback) = 'object' and octet_length(feedback::text) <= 14000),
  created_at timestamptz not null default now()
);
alter table scanner.chat_memory enable row level security;
alter table scanner.chat_feedback enable row level security;
revoke all on scanner.chat_memory, scanner.chat_feedback from public, anon, authenticated;

create or replace function public.scanner_chat_memory_get(p_uid text)
returns jsonb language sql security definer set search_path = pg_catalog, scanner as $$
  select coalesce((select preferences from scanner.chat_memory where uid = p_uid),
    '{"evitarMemes":true,"redes":[],"pares":[],"notas":""}'::jsonb);
$$;
create or replace function public.scanner_chat_memory_set(p_uid text, p_preferences jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, scanner as $$
begin
  insert into scanner.chat_memory(uid, preferences) values(p_uid, p_preferences)
  on conflict(uid) do update set preferences = excluded.preferences, updated_at = now();
  return p_preferences;
end;
$$;
create or replace function public.scanner_chat_feedback(p_uid text, p_feedback jsonb)
returns boolean language plpgsql security definer set search_path = pg_catalog, scanner as $$
begin
  insert into scanner.chat_feedback(uid, feedback) values(p_uid, p_feedback);
  delete from scanner.chat_feedback where uid = p_uid and id not in
    (select id from scanner.chat_feedback where uid = p_uid order by id desc limit 50);
  return true;
end;
$$;
revoke all on function public.scanner_chat_memory_get(text), public.scanner_chat_memory_set(text,jsonb), public.scanner_chat_feedback(text,jsonb) from public, anon, authenticated;
create or replace function public.scanner_chat_feedback_get(p_uid text)
returns jsonb language sql security definer set search_path = pg_catalog, scanner as $$
  select coalesce(jsonb_agg(feedback order by id desc), '[]'::jsonb) from
    (select id, feedback from scanner.chat_feedback where uid = p_uid order by id desc limit 3) recent;
$$;
create or replace function public.scanner_chat_feedback_clear(p_uid text)
returns boolean language plpgsql security definer set search_path = pg_catalog, scanner as $$
begin
  delete from scanner.chat_feedback where uid = p_uid;
  return true;
end;
$$;
revoke all on function public.scanner_chat_feedback_get(text), public.scanner_chat_feedback_clear(text) from public, anon, authenticated;
do $$ begin
  if exists(select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.scanner_chat_memory_get(text), public.scanner_chat_memory_set(text,jsonb), public.scanner_chat_feedback(text,jsonb) to service_role;
    grant execute on function public.scanner_chat_feedback_get(text), public.scanner_chat_feedback_clear(text) to service_role;
  end if;
end $$;
notify pgrst, 'reload schema';
