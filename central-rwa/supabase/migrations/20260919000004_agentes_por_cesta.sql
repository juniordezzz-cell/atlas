-- ATLAS · Central RWA — agentes por cesta (config/agents.yaml)
-- Idempotente.

set search_path = central_rwa, public;

create table if not exists agents (
  id text primary key,
  nome text not null,
  descricao text not null default '',
  cesta jsonb not null default '[]'::jsonb,
  regras jsonb not null default '{}'::jsonb,
  corte_validacao date not null,
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table agents enable row level security;

drop view if exists public.crwa_agentes;
drop view if exists public.crwa_placar_periodo;

create view public.crwa_agentes as
select id, nome, descricao, cesta, regras, corte_validacao, updated_at as atualizado_em
from central_rwa.agents
where ativo;

-- Placar separado por período: treino (antes do corte), validação (depois do
-- corte, que a escolha das regras nunca viu) e ao vivo.
create view public.crwa_placar_periodo as
select p.agent as agente,
       case when p.mode = 'live' then 'ao_vivo'
            when p.entry_day < a.corte_validacao then 'treino'
            else 'validacao' end as periodo,
       count(*) filter (where p.status = 'fechada')                                      as fechadas,
       count(*) filter (where p.status = 'aberta')                                       as abertas,
       round(100.0 * avg((p.ret_net_pct > 0)::int) filter (where p.status = 'fechada'), 1) as taxa_acerto_pct,
       round(avg(p.ret_net_pct) filter (where p.status = 'fechada')::numeric, 2)          as retorno_medio_pct,
       round((percentile_cont(0.5) within group (order by p.ret_net_pct) filter (where p.status = 'fechada'))::numeric, 2) as retorno_mediano_pct,
       round(min(p.ret_net_pct) filter (where p.status = 'fechada')::numeric, 2)          as pior_pct,
       round(max(p.ret_net_pct) filter (where p.status = 'fechada')::numeric, 2)          as melhor_pct,
       round(avg(p.baseline_pct) filter (where p.status = 'fechada')::numeric, 2)         as base_media_pct,
       round(sum(p.ret_net_pct) filter (where p.status = 'fechada')::numeric, 1)          as soma_pct,
       min(p.entry_day) as desde, max(coalesce(p.exit_day, p.entry_day)) as ate
from central_rwa.paper_positions p
join central_rwa.agents a on a.id = p.agent and a.ativo
group by 1, 2;

grant select on public.crwa_agentes, public.crwa_placar_periodo to anon, authenticated;

notify pgrst, 'reload schema';
