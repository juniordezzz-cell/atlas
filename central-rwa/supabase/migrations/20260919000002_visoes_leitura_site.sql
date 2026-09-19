-- ATLAS · Central RWA — visões de LEITURA para o site (primeira tela)
--
-- O site lê o Supabase pela API REST (PostgREST), que só enxerga o schema
-- "public". Em vez de abrir as tabelas de central_rwa, expomos visões
-- enxutas, só com dado de mercado já tratado. As tabelas continuam fechadas
-- (RLS sem política); as visões rodam com os direitos do dono (postgres) e
-- apenas SELECT nelas é liberado.
--
-- Leitura liberada para "anon" (a chave publicável que vai no site): o
-- conteúdo é dado público de mercado (preço de NVDA, de NVDAx...). A página
-- em si continua atrás do login do ATLAS. Quando houver dado pessoal
-- (Fase 4: placar/posições), a leitura passa a exigir o login do Firebase
-- no Supabase (role "authenticated").
--
-- Idempotente: pode rodar de novo (drop + create).

drop view if exists public.crwa_ativos;
drop view if exists public.crwa_tokens;
drop view if exists public.crwa_historico;
drop view if exists public.crwa_tbills;
drop view if exists public.crwa_execucoes;

-- Um ativo por linha: camada, cotação mais recente, fechamentos, tamanho do histórico.
create view public.crwa_ativos as
select
  w.ticker,
  w.tier                             as camada,
  w.reason                           as motivo,
  ra.name                            as nome,
  ra.asset_class                     as classe,
  q.price                            as ref_preco,
  q.previous_close                   as ref_fechamento_anterior,
  q.ts                               as ref_em,
  q.source                           as ref_fonte,
  d1.close                           as ult_fechamento,
  d1.day                             as ult_dia,
  d2.close                           as fechamento_anterior,
  h.pregoes                          as pregoes,
  h.desde                            as historico_desde,
  (select count(*) from central_rwa.tokens t where t.reference_ticker = w.ticker and t.active) as tokens
from central_rwa.watch_tiers w
join central_rwa.reference_assets ra on ra.ticker = w.ticker
left join lateral (
  select price, previous_close, ts, source from central_rwa.reference_quotes rq
  where rq.ticker = w.ticker order by ts desc limit 1
) q on true
left join lateral (
  select day, close from central_rwa.reference_prices_daily p
  where p.ticker = w.ticker order by day desc limit 1
) d1 on true
left join lateral (
  select close from central_rwa.reference_prices_daily p
  where p.ticker = w.ticker order by day desc offset 1 limit 1
) d2 on true
left join lateral (
  select count(*) as pregoes, min(day) as desde from central_rwa.reference_prices_daily p where p.ticker = w.ticker
) h on true;

-- Último snapshot de cada token dos ativos monitorados (camadas A e B).
create view public.crwa_tokens as
select
  t.reference_ticker                 as ticker,
  t.network                          as rede,
  t.symbol                           as simbolo,
  t.issuer                           as emissor,
  t.address                          as endereco,
  t.mapping_confidence               as confianca,
  s.price_usd                        as preco,
  s.volume_24h_usd                   as volume_24h,
  s.liquidity_usd                    as liquidez,
  s.sources_confirmed                as fontes_confirmadas,
  s.divergence_pct                   as divergencia_pct,
  s.source                           as fonte,
  s.ts                               as em,
  s.tier                             as camada_coleta
from central_rwa.tokens t
join lateral (
  select * from central_rwa.token_snapshots s
  where s.token_id = t.id order by ts desc limit 1
) s on true
where t.active and t.reference_ticker in (select ticker from central_rwa.watch_tiers);

-- Fechamentos diários dos últimos ~13 meses dos ativos monitorados (gráfico).
create view public.crwa_historico as
select p.ticker, p.day as dia, p.close as fechamento
from central_rwa.reference_prices_daily p
where p.day >= current_date - 400
  and p.ticker in (select ticker from central_rwa.watch_tiers);

-- Taxa mais recente de cada prazo de T-bill.
create view public.crwa_tbills as
select distinct on (tenor) tenor as prazo, day as dia, rate as taxa, source as fonte
from central_rwa.tbill_yields_daily
order by tenor, day desc;

-- Últimas execuções dos jobs (saúde do sistema), sem o resumo completo.
create view public.crwa_execucoes as
select id, job, status, started_at as inicio, finished_at as fim,
       (summary->>'duracao_s')::numeric as duracao_s
from central_rwa.job_runs
order by id desc
limit 30;

grant select on public.crwa_ativos, public.crwa_tokens, public.crwa_historico,
                public.crwa_tbills, public.crwa_execucoes to anon, authenticated;

-- Avisa a API REST para enxergar as visões novas sem reiniciar.
notify pgrst, 'reload schema';
