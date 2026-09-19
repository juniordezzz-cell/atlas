-- ATLAS · Central RWA — Fase 1 (roteador + data engine)
-- Esquema em "central_rwa" para não misturar com nada do projeto Supabase.
-- RLS ligado em tudo e SEM políticas públicas: só o backend (conexão direta
-- ao Postgres) lê e grava. O front entra na Fase 5, com políticas próprias.

create schema if not exists central_rwa;
set search_path = central_rwa, public;

-- ---------- dimensões ----------

create table if not exists asset_classes (
  id text primary key,
  name text not null
);
insert into asset_classes (id, name) values
  ('stock', 'Ação'), ('etf', 'ETF'), ('commodity', 'Commodity'),
  ('tbill', 'Título do Tesouro (T-bill)'), ('br_stock', 'Ação brasileira')
on conflict (id) do nothing;

create table if not exists networks (
  id text primary key,
  name text not null,
  chain_id integer,
  active boolean not null default true
);
insert into networks (id, name, chain_id, active) values
  ('solana', 'Solana', null, true),
  ('ethereum', 'Ethereum', 1, true),
  ('bnb_chain', 'BNB Chain', 56, true),
  ('robinhood_chain', 'Robinhood Chain', 4663, true)
on conflict (id) do nothing;

create table if not exists issuers (
  id text primary key,
  name text not null,
  notes text
);
insert into issuers (id, name) values
  ('xstocks', 'xStocks (Backed)'), ('ondo', 'Ondo Global Markets'), ('robinhood', 'Robinhood Stock Tokens'),
  ('dinari', 'Dinari'), ('bstocks', 'bStocks'), ('colb', 'Colb Finance'), ('paimon', 'Paimon Finance'),
  ('tether', 'Tether (XAUT)'), ('paxos', 'Paxos (PAXG)'), ('blackrock', 'BlackRock'),
  ('franklin', 'Franklin Templeton'), ('superstate', 'Superstate'), ('varios', 'Vários / não identificado')
on conflict (id) do nothing;

create table if not exists reference_assets (
  ticker text primary key,
  name text,
  asset_class text not null references asset_classes(id),
  market text,
  symbols jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists tokens (
  id bigserial primary key,
  network text not null references networks(id),
  address text not null,
  symbol text not null,
  name text,
  issuer text references issuers(id),
  reference_ticker text references reference_assets(ticker),
  mapping_confidence real not null default 0,
  mapping_origin text not null default '',
  source text not null,
  active boolean not null default true,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (network, address)
);
create index if not exists tokens_reference_idx on tokens(reference_ticker);

-- Camadas de atualização (seção 5.3). A promoção automática B → A por evento
-- chega na Fase 3; aqui fica só a estrutura.
create table if not exists watch_tiers (
  ticker text primary key references reference_assets(ticker),
  tier text not null check (tier in ('A', 'B')),
  reason text not null check (reason in ('manual', 'evento', 'padrao')),
  since timestamptz not null default now(),
  until timestamptz
);

-- ---------- fatos ----------

create table if not exists reference_prices_daily (
  ticker text not null references reference_assets(ticker),
  day date not null,
  open double precision,
  high double precision,
  low double precision,
  close double precision not null,
  adj_close double precision,
  volume double precision,
  source text not null,
  primary key (ticker, day)
);

create table if not exists token_snapshots (
  token_id bigint not null references tokens(id) on delete cascade,
  ts timestamptz not null,
  price_usd double precision not null,
  volume_24h_usd double precision,
  liquidity_usd double precision,
  source text not null,
  sources_confirmed smallint not null default 1,
  divergence_pct real,
  tier text,
  primary key (token_id, ts)
);
create index if not exists token_snapshots_ts_idx on token_snapshots(ts desc);

-- Cotação do ativo de referência a cada execução da camada A (base para a
-- diferença token × ativo da seção 7.2).
create table if not exists reference_quotes (
  ticker text not null references reference_assets(ticker),
  ts timestamptz not null,
  price double precision not null,
  previous_close double precision,
  source text not null,
  primary key (ticker, ts)
);

create table if not exists tbill_yields_daily (
  tenor text not null,
  day date not null,
  rate double precision not null,
  source text not null,
  primary key (tenor, day)
);

-- ---------- roteador ----------

create table if not exists provider_usage (
  provider text not null,
  window_name text not null check (window_name in ('second', 'minute', 'day', 'month')),
  window_start timestamptz not null,
  calls integer not null default 0,
  primary key (provider, window_name)
);

create table if not exists provider_health (
  provider text primary key,
  consecutive_failures integer not null default 0,
  cooldown_until timestamptz,
  circuit_open_until timestamptz,
  last_error text,
  last_success timestamptz,
  latency_ms_avg real,
  calls bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists job_runs (
  id bigserial primary key,
  job text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null check (status in ('ok', 'parcial', 'erro')),
  summary jsonb not null default '{}'::jsonb
);
create index if not exists job_runs_job_idx on job_runs(job, started_at desc);

-- ---------- tamanho do banco ----------

create or replace view db_size as
select c.relname as tabela,
       pg_size_pretty(pg_total_relation_size(c.oid)) as tamanho,
       pg_total_relation_size(c.oid) as bytes
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'central_rwa' and c.relkind = 'r'
order by bytes desc;

-- ---------- RLS ----------

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'central_rwa' loop
    execute format('alter table central_rwa.%I enable row level security', t);
  end loop;
end $$;
