-- ATLAS · Central RWA — Fases 3 e 4: eventos e agentes (paper trading)
-- Idempotente.

set search_path = central_rwa, public;

-- Eventos detectados (seção 12). Um por ativo/tipo/pregão.
create table if not exists events (
  id bigserial primary key,
  ticker text not null references reference_assets(ticker),
  kind text not null,                 -- queda_brusca | alta_brusca | intradiario | ...
  day date not null,                  -- pregão do evento
  detected_at timestamptz not null default now(),
  magnitude_pct double precision not null,
  volume_ratio double precision,
  level text not null check (level in ('INFO', 'ATENCAO', 'EXTREMO')),
  stats jsonb not null default '{}'::jsonb,   -- eventos semelhantes (seção 13)
  source text not null default 'daily',
  unique (ticker, kind, day)
);
create index if not exists events_day_idx on events(day desc);

-- Posições simuladas (seção 14.3). mode: 'backtest' (treino histórico) ou 'live'.
create table if not exists paper_positions (
  id bigserial primary key,
  agent text not null,
  mode text not null check (mode in ('backtest', 'live')),
  ticker text not null references reference_assets(ticker),
  token_id bigint references tokens(id) on delete set null,
  setup text not null,                -- queda_brusca | alta_brusca
  event_day date not null,
  event_id bigint references events(id) on delete set null,
  direction text not null default 'long',
  entry_day date not null,
  entry_price double precision not null,
  target_pct double precision not null,
  stop_pct double precision not null,
  horizon_days integer not null,
  status text not null check (status in ('aberta', 'fechada')),
  exit_day date,
  exit_price double precision,
  exit_reason text,                   -- alvo | stop | prazo
  ret_pct double precision,
  ret_net_pct double precision,
  baseline_pct double precision,      -- retorno médio de 7 pregões num dia qualquer (o "não fazer nada")
  rationale text,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (agent, mode, ticker, event_day)
);
create index if not exists paper_positions_agent_idx on paper_positions(agent, mode, status);

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'central_rwa' loop
    execute format('alter table central_rwa.%I enable row level security', t);
  end loop;
end $$;

-- ---------- visões do site (dado de mercado + simulação; nada pessoal) ----------

drop view if exists public.crwa_eventos;
drop view if exists public.crwa_posicoes;
drop view if exists public.crwa_placar;
drop view if exists public.crwa_placar_setup;

create view public.crwa_eventos as
select e.id, e.ticker, ra.asset_class as classe, e.kind as tipo, e.day as dia, e.detected_at as detectado_em,
       e.magnitude_pct as variacao_pct, e.volume_ratio as volume_x_media, e.level as nivel, e.stats as estatistica, e.source as origem
from central_rwa.events e
join central_rwa.reference_assets ra on ra.ticker = e.ticker
where e.day >= current_date - 180;

create view public.crwa_posicoes as
select p.id, p.agent as agente, p.mode as modo, p.ticker, p.setup, p.event_day as dia_evento,
       p.entry_day as entrada_dia, p.entry_price as entrada_preco, p.target_pct as alvo_pct, p.stop_pct,
       p.horizon_days as prazo, p.status, p.exit_day as saida_dia, p.exit_price as saida_preco,
       p.exit_reason as motivo_saida, p.ret_pct as retorno_pct, p.ret_net_pct as retorno_liquido_pct,
       p.baseline_pct as base_pct, p.rationale as racional, t.symbol as token, t.network as rede
from central_rwa.paper_positions p
left join central_rwa.tokens t on t.id = p.token_id;

create view public.crwa_placar as
select agent as agente, mode as modo,
       count(*) filter (where status = 'fechada')                                   as fechadas,
       count(*) filter (where status = 'aberta')                                    as abertas,
       round(100.0 * avg((ret_net_pct > 0)::int) filter (where status = 'fechada'), 1) as taxa_acerto_pct,
       round(avg(ret_net_pct) filter (where status = 'fechada')::numeric, 2)         as retorno_medio_pct,
       round((percentile_cont(0.5) within group (order by ret_net_pct) filter (where status = 'fechada'))::numeric, 2) as retorno_mediano_pct,
       round(min(ret_net_pct) filter (where status = 'fechada')::numeric, 2)         as pior_pct,
       round(max(ret_net_pct) filter (where status = 'fechada')::numeric, 2)         as melhor_pct,
       round(avg(baseline_pct) filter (where status = 'fechada')::numeric, 2)        as base_media_pct,
       round(sum(ret_net_pct) filter (where status = 'fechada')::numeric, 1)         as soma_pct,
       min(entry_day) as desde, max(coalesce(exit_day, entry_day)) as ate
from central_rwa.paper_positions
group by agent, mode;

create view public.crwa_placar_setup as
select agent as agente, mode as modo, ticker, setup,
       count(*) filter (where status = 'fechada') as fechadas,
       round(100.0 * avg((ret_net_pct > 0)::int) filter (where status = 'fechada'), 1) as taxa_acerto_pct,
       round(avg(ret_net_pct) filter (where status = 'fechada')::numeric, 2) as retorno_medio_pct,
       round(sum(ret_net_pct) filter (where status = 'fechada')::numeric, 1) as soma_pct
from central_rwa.paper_positions
group by agent, mode, ticker, setup;

grant select on public.crwa_eventos, public.crwa_posicoes, public.crwa_placar, public.crwa_placar_setup to anon, authenticated;

notify pgrst, 'reload schema';
