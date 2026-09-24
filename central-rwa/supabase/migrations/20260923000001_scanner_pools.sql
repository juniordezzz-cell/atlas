-- ATLAS · Scanner Pools — pools de liquidez coletadas pelo servidor
-- (central-rwa/backend/central_rwa/pools, job "python -m central_rwa pools").
--
-- Tabelas fechadas (RLS sem política); o site lê só pelas visões scanner_*,
-- no mesmo padrão das crwa_*: dado público de mercado, leitura liberada para
-- a chave publicável. Pool barrada pela camada de segurança é guardada (para
-- a contagem e o histórico), mas nunca aparece nas visões.
--
-- Idempotente: pode rodar de novo.

create schema if not exists scanner;

create table if not exists scanner.pools (
  id              text primary key,
  fonte           text not null,
  rede            text not null,
  dex             text not null,
  par             text not null,
  token_a         text,
  simbolo_a       text,
  token_b         text,
  simbolo_b       text,
  fee             double precision not null default 0,
  tvl             double precision not null default 0,
  vol_24h         double precision not null default 0,
  vol_7d          double precision,
  apr             double precision,
  apr_reward      double precision,
  criada_em       timestamptz,
  sinais          jsonb not null default '{}'::jsonb,
  trilho          text not null check (trilho in ('solida','caca','barrada')),
  motivos         text[] not null default '{}',
  nota            double precision not null default 0,
  componentes     jsonb not null default '{}'::jsonb,
  ativa           boolean not null default true,
  visto_em        timestamptz not null,
  falhas_seguidas integer not null default 0
);

create table if not exists scanner.leituras (
  pool_id  text not null references scanner.pools(id) on delete cascade,
  dia      date not null,
  tvl      double precision not null,
  vol_24h  double precision not null,
  vol_7d   double precision,
  apr      double precision,
  fee      double precision not null,
  primary key (pool_id, dia)
);

create table if not exists scanner.tokens (
  rede              text not null,
  endereco          text not null,
  simbolo           text,
  honeypot          boolean,
  mint_ativo        boolean not null default false,
  freeze_ativo      boolean not null default false,
  dev_pct           double precision,
  holders           integer,
  coingecko_id      text,
  mcap              double precision,
  primeira_pool_em  timestamptz,
  consultado_em     timestamptz not null,
  primary key (rede, endereco)
);

create table if not exists scanner.status_coleta (
  fonte     text not null,
  rede      text,
  dex       text,
  estado    text not null,
  contagem  integer not null default 0,
  em        timestamptz not null
);

alter table scanner.pools enable row level security;
alter table scanner.leituras enable row level security;
alter table scanner.tokens enable row level security;
alter table scanner.status_coleta enable row level security;

drop view if exists public.scanner_pools;
drop view if exists public.scanner_leituras;
drop view if exists public.scanner_status;

-- var_tvl_7d: TVL da última leitura contra a leitura mais antiga dos 7 dias
-- anteriores a ela (null com uma leitura só). Vem pronta para o site não
-- precisar baixar 30 dias de leituras de milhares de pools ao abrir.
create view public.scanner_pools as
select p.id, p.rede, p.dex, p.par, p.simbolo_a, p.simbolo_b, p.fee, p.tvl, p.vol_24h, p.vol_7d, p.apr, p.apr_reward,
       p.criada_em, p.sinais, p.trilho, p.motivos, p.nota, p.componentes, p.visto_em,
       h.leituras,
       case when h.base_dia < h.ult_dia and h.base_tvl > 0 then h.ult_tvl / h.base_tvl - 1 end as var_tvl_7d
from scanner.pools p
left join lateral (
  select count(*) as leituras,
         max(l.dia) as ult_dia,
         (select l2.tvl from scanner.leituras l2 where l2.pool_id = p.id order by l2.dia desc limit 1) as ult_tvl,
         (select l3.dia from scanner.leituras l3 where l3.pool_id = p.id
            and l3.dia >= (select max(dia) from scanner.leituras where pool_id = p.id) - 7
          order by l3.dia asc limit 1) as base_dia,
         (select l4.tvl from scanner.leituras l4 where l4.pool_id = p.id
            and l4.dia >= (select max(dia) from scanner.leituras where pool_id = p.id) - 7
          order by l4.dia asc limit 1) as base_tvl
  from scanner.leituras l where l.pool_id = p.id
) h on true
where p.ativa and p.trilho <> 'barrada';

create view public.scanner_leituras as
select l.pool_id, l.dia, l.tvl, l.vol_24h, l.vol_7d, l.apr, l.fee
from scanner.leituras l
join scanner.pools p on p.id = l.pool_id
where p.ativa and p.trilho <> 'barrada';

create view public.scanner_status as
select fonte, rede, dex, estado, contagem, em from scanner.status_coleta;

grant select on public.scanner_pools, public.scanner_leituras, public.scanner_status to anon, authenticated;
