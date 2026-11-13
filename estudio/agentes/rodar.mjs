#!/usr/bin/env node
/* ============================================================
   Estúdio de Agentes de Pools · agentes/rodar.mjs

   Ponto de entrada de uma rodada. O Python (python -m central_rwa agentes)
   lê o banco, manda as pools e as velas em JSON pela entrada padrão e grava
   o que voltar pela saída padrão. Este arquivo não fala com o banco.

   entrada: { rodada, pools: [...], achados_hoje: [...] }
   saída:   { rodada, achados, status, relatorio: { ranking, disputas, conflitos }, erros, duracao_s }
   ============================================================ */

import { rodarAgentes } from "./ciclo.mjs";
import { relatorioDoDia } from "./supervisor.mjs";

const pedacos = [];
for await (const p of process.stdin) pedacos.push(p);
const entrada = JSON.parse(Buffer.concat(pedacos).toString("utf8"));

const t0 = Date.now();
const r = rodarAgentes(entrada);
const achadosDoDia = [...(entrada.achados_hoje || []), ...r.achados.map((a) => ({ ...a, rodada: entrada.rodada }))];
const relatorio = relatorioDoDia(achadosDoDia, r.analises);

process.stdout.write(JSON.stringify({
  rodada: r.rodada,
  achados: r.achados,
  status: r.status,
  relatorio,
  erros: r.erros,
  pools: r.analises.length,
  duracao_s: (Date.now() - t0) / 1000,
}));
