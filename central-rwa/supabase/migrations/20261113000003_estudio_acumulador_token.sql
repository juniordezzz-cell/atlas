-- Laboratório de Agentes · Acumulador em duas versões (13/11/2026).
--
-- O Acumulador ('acumulador') passa a ser o Acumulador Dólar e nasce o
-- Acumulador Token ('acumulador_token'): mesma regra, objetivo de terminar
-- com mais unidades do token. Só amplia a lista de agentes aceitos em
-- estudio.achados. Idempotente.

alter table estudio.achados drop constraint if exists achados_agente_check;
alter table estudio.achados add constraint achados_agente_check
  check (agente in ('base', 'concentrador', 'curva', 'pontas', 'grade', 'acumulador', 'acumulador_token'));
