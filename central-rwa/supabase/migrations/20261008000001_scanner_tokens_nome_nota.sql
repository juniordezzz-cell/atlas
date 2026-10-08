-- Scanner Pools: nome e nota de confiança (gt_score) de cada token, vindos da
-- GeckoTerminal. Servem para reconhecer versões embrulhadas legítimas
-- ("Wrapped NEAR…") que a CoinGecko não cadastra (08/10/2026).
-- Idempotente: roda de novo a cada coleta.
alter table scanner.tokens add column if not exists nome text;
alter table scanner.tokens add column if not exists gt_score double precision;
