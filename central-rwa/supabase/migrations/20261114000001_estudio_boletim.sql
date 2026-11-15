-- Laboratório de Agentes · boletim (14/11/2026).
--
-- Depois de 7 e de 30 dias, cada achado (o primeiro de cada agente, pool e
-- dia) é refeito com os preços e o volume que aconteceram de verdade, com as
-- mesmas faixas e o mesmo motor. A linha guarda o previsto para o mesmo prazo
-- (refeito com o mercado gravado no achado, só com o que se sabia na hora), o
-- real, a Faixa única real e as notas. Valores em dólar.
--
-- metodo: 'antigo' para achados de antes de 13/11/2026 20:00 UTC (simulação
-- com tendência e regra antiga da Curva), 'atual' depois. As notas dos agentes
-- usam só 'atual'.
--
-- Só acrescenta. Mesmas regras de acesso do estúdio. Idempotente.

create table if not exists estudio.boletim (
  id                 bigserial primary key,
  achado_id          bigint not null,
  rodada             timestamptz not null,
  agente             text not null,
  pool_id            text not null,
  par                text,
  horizonte_dias     integer not null check (horizonte_dias in (7, 30)),
  metodo             text not null check (metodo in ('antigo', 'atual')),
  horas              integer not null,          -- velas reais usadas
  preco_inicio       double precision not null,
  preco_fim          double precision not null,
  previsto_media_usd double precision not null,
  previsto_p10_usd   double precision not null,
  previsto_p90_usd   double precision not null,
  real_usd           double precision not null,
  base_real_usd      double precision not null, -- Faixa única, mesma faixa, mesmo período real
  erro_usd           double precision not null, -- real − previsto (média)
  dentro_faixa       boolean not null,          -- p10 ≤ real ≤ p90
  ganhou_base        boolean not null,
  lucro              boolean not null,
  tokens             jsonb,                     -- Acumulador Token: real × comprar agora × esperar
  acertou            boolean not null,          -- a nota do achado (ver docs/laboratorio-agentes-fichas.md)
  avaliado_em        timestamptz not null default now(),
  unique (achado_id, horizonte_dias)
);
create index if not exists estudio_boletim_agente_idx on estudio.boletim (agente, avaliado_em);

-- Resumo do boletim de cada agente (últimos 30 dias de avaliações, método atual).
alter table estudio.agentes_status add column if not exists boletim jsonb;

create or replace function estudio.manutencao_agentes() returns void
language sql
as $$
  delete from estudio.achados where rodada < now() - interval '90 days';
  delete from estudio.relatorios_diarios where data < (now() - interval '90 days')::date;
  delete from estudio.boletim where avaliado_em < now() - interval '365 days';
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on estudio.boletim from anon, authenticated';
  end if;
end $$;
grant select, insert, update, delete on estudio.boletim to estudio_agente;
grant usage on sequence estudio.boletim_id_seq to estudio_agente;
alter table estudio.boletim enable row level security;
drop policy if exists agente on estudio.boletim;
create policy agente on estudio.boletim for all to estudio_agente using (true) with check (true);
