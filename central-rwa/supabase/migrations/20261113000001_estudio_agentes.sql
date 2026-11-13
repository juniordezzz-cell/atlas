-- Estúdio de Agentes de Pools · Fase 3 (agentes sem IA), 13/11/2026.
--
-- Achados dos seis agentes, o status de cada um e o relatório diário do
-- supervisor. Só acrescenta: não muda nenhuma tabela da Fase 2. Mesmas
-- regras de acesso: RLS ligada, nada em public, nada para anon ou
-- authenticated; quem grava é o papel estudio_agente.
--
-- Valores em dólar. Idempotente: roda de novo antes de cada coleta do Scanner.

-- ---------- achados ----------
-- Uma linha por agente, pool e rodada (de hora em hora) em que a estratégia
-- do agente ganhou da Faixa única na mesma pool. 90 dias.
create table if not exists estudio.achados (
  id             bigserial primary key,
  rodada         timestamptz not null,
  agente         text not null check (agente in ('base', 'concentrador', 'curva', 'pontas', 'grade', 'acumulador')),
  pool_id        text not null,
  rede           text not null,
  dex            text,
  par            text,
  ativo_simbolo  text,
  cotacao        text,
  modelo         text not null,          -- single, nested, curve, bidask, spot, acc (nomes do simulador)
  faixas         integer not null,       -- N do simulador
  preco          double precision not null,   -- preço do ativo na cotação, na hora da simulação
  faixa_min      double precision not null,
  faixa_max      double precision not null,
  posicoes       jsonb not null,         -- [{cap, a, b}] em dólar e na unidade de preço da pool
  capital_usd    double precision not null,
  dias           integer not null,
  media_usd      double precision not null,
  p10_usd        double precision not null,
  p90_usd        double precision,
  taxas_usd      double precision not null,
  il_usd         double precision not null,
  custo_usd      double precision,
  em_faixa_pct   double precision not null,
  ret_risco      double precision,
  prob_perda_pct double precision,
  apr_taxas_pct  double precision,
  ref_media_usd  double precision not null,   -- Faixa única na mesma pool, mesma faixa, mesmos sorteios
  ganho_vs_ref_usd double precision not null,
  mercado        jsonb not null,         -- M do simulador (volatilidade, tendência, volta à média, ...)
  metricas       jsonb not null,         -- o que a regra do agente olhou
  conc_estimada  boolean not null default true,
  unique (rodada, agente, pool_id)
);
create index if not exists estudio_achados_rodada_idx on estudio.achados (rodada);
create index if not exists estudio_achados_pool_idx on estudio.achados (pool_id, rodada);

-- ---------- status ----------
-- Uma linha por agente (seis) e uma do supervisor: o que fez na última rodada.
create table if not exists estudio.agentes_status (
  agente          text primary key,
  estado          text not null check (estado in ('ocioso', 'cacando', 'ok', 'sem_pools', 'erro')),
  pool_em_analise text,
  par_em_analise  text,
  pools_vistas    integer not null default 0,
  pools_trabalhadas integer not null default 0,
  achados         integer not null default 0,
  melhor_media_usd double precision,
  mensagem        text,
  rodada          timestamptz,
  atualizado_em   timestamptz not null default now()
);

-- ---------- relatório diário do supervisor ----------
-- Uma linha por dia (UTC), refeita a cada rodada: ranking dos achados do dia,
-- disputas (dois agentes com achado na mesma pool) e conflitos (achado de um
-- agente numa pool que a regra de outro descarta). O texto da IA é da Fase 5.
create table if not exists estudio.relatorios_diarios (
  data          date primary key,
  ranking       jsonb not null default '[]',
  disputas      jsonb not null default '[]',
  conflitos     jsonb not null default '[]',
  rodadas       integer not null default 0,
  texto         text,
  atualizado_em timestamptz not null default now()
);

-- ---------- manutenção ----------
create or replace function estudio.manutencao_agentes() returns void
language sql
as $$
  delete from estudio.achados where rodada < now() - interval '90 days';
  delete from estudio.relatorios_diarios where data < (now() - interval '90 days')::date;
$$;

-- ---------- acesso ----------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on estudio.achados, estudio.agentes_status, estudio.relatorios_diarios from anon, authenticated';
  end if;
end $$;

grant select, insert, update, delete on estudio.achados, estudio.agentes_status, estudio.relatorios_diarios to estudio_agente;
grant usage on sequence estudio.achados_id_seq to estudio_agente;
revoke all on function estudio.manutencao_agentes() from public;
grant execute on function estudio.manutencao_agentes() to estudio_agente;

do $$
declare t text;
begin
  foreach t in array array['achados', 'agentes_status', 'relatorios_diarios'] loop
    execute format('alter table estudio.%I enable row level security', t);
    execute format('drop policy if exists agente on estudio.%I', t);
    execute format('create policy agente on estudio.%I for all to estudio_agente using (true) with check (true)', t);
  end loop;
end $$;
