-- Scanner Pools: a coleta é disparada pelo próprio Supabase, de 4 em 4 horas.
--
-- O agendamento do GitHub Actions ("cron" no workflow) atrasa: pedindo a cada
-- 2 h, as coletas saíam de 4 a 7 h de distância (medido em out/2026). Um
-- disparo manual (workflow_dispatch) começa em segundos — então quem aperta o
-- botão é o pg_cron, às 00, 04, 08, 12, 16 e 20 h UTC (21, 01, 05, 09, 13 e
-- 17 h em Brasília).
--
-- O token do GitHub NÃO fica neste arquivo: ele mora no Vault do Supabase,
-- com o nome 'github_actions_scanner' (permissão só de Actions, só no repo
-- atlas). Sem ele, o disparo avisa e não faz nada.
--
-- Esta migração roda de novo a cada coleta (apply_migrations aplica todas):
-- tudo aqui é idempotente, e falha de extensão/agendamento vira aviso — não
-- pode derrubar a coleta que a está aplicando.

do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise warning 'Scanner Pools: não consegui ativar pg_cron/pg_net (%). Ative em Database → Extensions.', sqlerrm;
end $$;

create or replace function scanner.disparar_coleta() returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  tok text;
  pedido bigint;
begin
  select decrypted_secret into tok
    from vault.decrypted_secrets
   where name = 'github_actions_scanner'
   limit 1;
  if coalesce(tok, '') = '' then
    raise warning 'Scanner Pools: segredo github_actions_scanner ausente no Vault; coleta não disparada.';
    return null;
  end if;
  select net.http_post(
    url     := 'https://api.github.com/repos/juniordezzz-cell/atlas/actions/workflows/scanner-pools.yml/dispatches',
    body    := jsonb_build_object('ref', 'main'),
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || tok,
                 'Accept', 'application/vnd.github+json',
                 'X-GitHub-Api-Version', '2022-11-28',
                 'User-Agent', 'atlas-scanner-cron',
                 'Content-Type', 'application/json')
  ) into pedido;
  return pedido;
end $$;

-- ninguém de fora chama: só o agendamento (e você, pelo SQL Editor)
revoke all on function scanner.disparar_coleta() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'scanner-pools-coleta';
  perform cron.schedule('scanner-pools-coleta', '0 */4 * * *', 'select scanner.disparar_coleta()');
exception when others then
  raise warning 'Scanner Pools: agendamento não criado (%).', sqlerrm;
end $$;

-- Conferência: o que o disparo recebeu do GitHub (204 = aceito).
-- Leitura só para quem já lê o banco direto; não é exposta ao site.
do $$
begin
  execute $v$
    create or replace view scanner.disparos as
    select r.id, r.created, r.status_code, left(r.content::text, 300) as resposta
      from net._http_response r
     order by r.created desc
  $v$;
exception when others then
  raise warning 'Scanner Pools: view scanner.disparos não criada (%).', sqlerrm;
end $$;
