-- Retirada da Central RWA do Supabase (pedido do dono, 11/11/2026).
--
-- O banco fica só com o Scanner Pools (schema scanner), o conector MCP
-- (schema atlas_mcp) e, depois, o Estúdio de Agentes de Pools. Os dados da
-- Central RWA foram salvos antes pelo workflow "Central RWA · backup antes da
-- retirada" (artefato central-rwa-backup-20261111, 90 dias).
--
-- As migrações 20260919000001 a 04, que criavam o schema central_rwa e as
-- visões public.crwa_*, saíram da pasta no mesmo commit; sem isso,
-- apply_migrations recriaria tudo vazio na coleta seguinte.
--
-- Idempotente: roda de novo em toda coleta sem efeito.

drop view if exists public.crwa_placar_periodo;
drop view if exists public.crwa_agentes;
drop view if exists public.crwa_placar_setup;
drop view if exists public.crwa_placar;
drop view if exists public.crwa_posicoes;
drop view if exists public.crwa_eventos;
drop view if exists public.crwa_execucoes;
drop view if exists public.crwa_tbills;
drop view if exists public.crwa_historico;
drop view if exists public.crwa_tokens;
drop view if exists public.crwa_ativos;

drop schema if exists central_rwa cascade;
