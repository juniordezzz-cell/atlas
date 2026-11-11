-- Estúdio de Agentes de Pools · Fase 2 (varredura), 12/11/2026.
--
-- Schema estudio: pools-alvo (visão sobre scanner.pools), snapshots de 15 min,
-- resumo horário, candles de 1h e o registro de cada varredura. Nada aqui é
-- público: RLS ligada, nenhuma visão em public, nenhum grant para anon ou
-- authenticated. Quem lê e grava é o papel estudio_agente (credencial de
-- serviço do workflow estudio-varredura.yml) e o dono do banco.
--
-- O papel nasce SEM senha (o repositório é público). O dono liga uma vez, no
-- SQL Editor:  alter role estudio_agente with login password '<senha>';
-- e cadastra ESTUDIO_DB_URL nos segredos do GitHub. Esta migração nunca
-- mexe na senha nem no LOGIN depois disso.
--
-- Idempotente: roda de novo antes de cada coleta do Scanner.

create schema if not exists estudio;

-- ---------- pools-alvo ----------
-- Filtro do estúdio sobre o Scanner: Solana e Base, ativa, não barrada,
-- TVL >= US$ 250 mil, giro (volume 24h / TVL) > 0,5 e endereço conhecido.
-- Roda com os privilégios do dono da visão: o agente não lê scanner.pools.
create or replace view estudio.pools_alvo as
select p.id as pool_id, p.rede, p.dex, p.par,
       p.token_a, p.simbolo_a, p.token_b, p.simbolo_b,
       p.fee as taxa_pct, p.tvl, p.vol_24h, p.vol_24h / p.tvl as giro, p.criada_em, p.trilho,
       coalesce(case when p.id like 'gecko:%' then split_part(p.id, ':', 3) end,
                nullif(p.sinais->>'endereco_pool', ''),
                nullif(p.sinais->'conferencia'->>'endereco', '')) as endereco
from scanner.pools p
where p.ativa and p.trilho <> 'barrada'
  and p.rede in ('Solana', 'Base')
  and p.tvl >= 250000 and p.vol_24h / nullif(p.tvl, 0) > 0.5
  and coalesce(case when p.id like 'gecko:%' then split_part(p.id, ':', 3) end,
               nullif(p.sinais->>'endereco_pool', ''),
               nullif(p.sinais->'conferencia'->>'endereco', '')) is not null;

-- ---------- dados ----------
-- preco = preço do token volátil ("ativo") em unidades do outro token do par;
-- em par com stable, é o preço em dólar. preco_usd = o mesmo ativo em dólar.
create table if not exists estudio.snapshots (
  pool_id      text not null,
  observado_em timestamptz not null,
  preco        double precision,
  preco_usd    double precision,
  tvl          double precision not null,
  vol_24h      double precision not null,
  giro         double precision,
  taxa_pct     double precision,
  fonte        text not null default 'dexscreener',
  primary key (pool_id, observado_em)
);
create index if not exists estudio_snapshots_em_idx on estudio.snapshots (observado_em);

create table if not exists estudio.snapshots_hora (
  pool_id  text not null,
  hora     timestamptz not null,
  preco    double precision,
  tvl      double precision,
  vol_24h  double precision,
  giro     double precision,
  amostras integer not null,
  primary key (pool_id, hora)
);

-- Velas de 1h da GeckoTerminal, preço do ativo em unidades do outro token.
create table if not exists estudio.candles (
  pool_id    text not null,
  hora       timestamptz not null,
  abertura   double precision not null,
  maxima     double precision not null,
  minima     double precision not null,
  fechamento double precision not null,
  volume_usd double precision not null default 0,
  primary key (pool_id, hora)
);

-- Quando as velas de cada pool foram buscadas e de qual token.
create table if not exists estudio.candles_estado (
  pool_id       text primary key,
  ativo         text,
  ativo_simbolo text,
  cotacao       text,
  buscado_em    timestamptz,
  ultima_vela   timestamptz,
  primeira_vela timestamptz,
  falhas        integer not null default 0
);

create table if not exists estudio.varredura_status (
  id            bigserial primary key,
  inicio        timestamptz not null,
  fim           timestamptz,
  pools_alvo    integer not null default 0,
  snapshots     integer not null default 0,
  candles_pools integer not null default 0,
  candles_novas integer not null default 0,
  chamadas_gt   integer not null default 0,
  limites_429   integer not null default 0,
  falhas        text[] not null default '{}',
  estado        text not null default 'rodando' check (estado in ('rodando', 'ok', 'parcial', 'erro'))
);
create index if not exists estudio_varredura_inicio_idx on estudio.varredura_status (inicio);

-- Pools prontas para os agentes: alvo + pelo menos 7 dias de velas
-- (substitui a data de criação, que falta em parte das pools).
create or replace view estudio.pools_prontas as
select a.*, e.ativo, e.ativo_simbolo, e.cotacao, e.primeira_vela, e.ultima_vela
from estudio.pools_alvo a
join estudio.candles_estado e on e.pool_id = a.pool_id
where e.primeira_vela <= now() - interval '7 days';

-- ---------- manutenção ----------
-- Resume as últimas horas em snapshots_hora e apaga o que passou do prazo:
-- snapshots 7 dias, resumo horário 30 dias, velas 45 dias, registro 30 dias.
create or replace function estudio.manutencao() returns void
language sql
as $$
  insert into estudio.snapshots_hora (pool_id, hora, preco, tvl, vol_24h, giro, amostras)
  select pool_id, date_trunc('hour', observado_em), avg(preco), avg(tvl), avg(vol_24h), avg(giro), count(*)
  from estudio.snapshots
  where observado_em >= date_trunc('hour', now()) - interval '3 hours'
  group by 1, 2
  on conflict (pool_id, hora) do update
    set preco = excluded.preco, tvl = excluded.tvl, vol_24h = excluded.vol_24h,
        giro = excluded.giro, amostras = excluded.amostras;
  delete from estudio.snapshots where observado_em < now() - interval '7 days';
  delete from estudio.snapshots_hora where hora < now() - interval '30 days';
  delete from estudio.candles where hora < now() - interval '45 days';
  delete from estudio.varredura_status where inicio < now() - interval '30 days';
$$;

-- ---------- acesso ----------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'estudio_agente') then
    create role estudio_agente nologin;
  end if;
end $$;

revoke all on schema estudio from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema estudio from anon, authenticated';
    execute 'revoke all on schema estudio from anon, authenticated';
  end if;
end $$;

grant usage on schema estudio to estudio_agente;
grant select on estudio.pools_alvo, estudio.pools_prontas to estudio_agente;
grant select, insert, update, delete on estudio.snapshots, estudio.snapshots_hora, estudio.candles,
  estudio.candles_estado, estudio.varredura_status to estudio_agente;
grant usage on sequence estudio.varredura_status_id_seq to estudio_agente;
revoke all on function estudio.manutencao() from public;
grant execute on function estudio.manutencao() to estudio_agente;

-- RLS: fechado para todos; o agente tem política própria nas tabelas.
do $$
declare t text;
begin
  foreach t in array array['snapshots', 'snapshots_hora', 'candles', 'candles_estado', 'varredura_status'] loop
    execute format('alter table estudio.%I enable row level security', t);
    execute format('drop policy if exists agente on estudio.%I', t);
    execute format('create policy agente on estudio.%I for all to estudio_agente using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- agendamento: a cada 15 min, pelo pg_cron ----------
-- Mesmo padrão do Scanner (20261004000001): o pg_cron dispara o workflow por
-- workflow_dispatch, porque o cron do GitHub atrasa horas. Usa o token
-- 'github_actions_scanner' do Vault (permissão só de Actions, só no repo).
create or replace function estudio.disparar_varredura() returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  tok text;
  pedido bigint;
begin
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'github_actions_scanner' limit 1;
  if coalesce(tok, '') = '' then
    raise warning 'Estúdio: segredo github_actions_scanner ausente no Vault; varredura não disparada.';
    return null;
  end if;
  select net.http_post(
    url     := 'https://api.github.com/repos/juniordezzz-cell/atlas/actions/workflows/estudio-varredura.yml/dispatches',
    body    := jsonb_build_object('ref', 'main'),
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || tok,
                 'Accept', 'application/vnd.github+json',
                 'X-GitHub-Api-Version', '2022-11-28',
                 'User-Agent', 'atlas-estudio-cron',
                 'Content-Type', 'application/json')
  ) into pedido;
  return pedido;
end $$;
revoke all on function estudio.disparar_varredura() from public;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'estudio-varredura';
  perform cron.schedule('estudio-varredura', '*/15 * * * *', 'select estudio.disparar_varredura()');
exception when others then
  raise warning 'Estúdio: agendamento não criado (%).', sqlerrm;
end $$;
