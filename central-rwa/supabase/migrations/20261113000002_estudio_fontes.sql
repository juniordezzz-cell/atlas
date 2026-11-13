-- Estúdio de Agentes de Pools · fontes do histórico (13/11/2026).
--
-- O preço por hora passa a vir da DeFiLlama (GeckoTerminal fica de reserva).
-- Só acrescenta colunas: de onde vieram as velas de cada pool, o endereço do
-- token da cotação (para pedir o preço dele) e quantas chamadas cada
-- varredura fez à DeFiLlama. Idempotente.

alter table estudio.candles_estado add column if not exists cotacao_end text;
alter table estudio.candles_estado add column if not exists fonte text;
alter table estudio.varredura_status add column if not exists chamadas_llama integer not null default 0;
alter table estudio.varredura_status add column if not exists velas_adiadas boolean not null default false;
