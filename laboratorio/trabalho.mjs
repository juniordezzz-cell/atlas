#!/usr/bin/env node
/* ============================================================
   Laboratório de Agentes (no PC) · trabalho.mjs

   A rodada dos agentes num processo separado, para a tela não travar
   enquanto o motor simula (1 a 2 minutos). Usa os mesmos agentes e o mesmo
   supervisor de estudio/agentes, sem mudança nenhuma.

   entrada (stdin):  { rodada, pools: [...com candles], achados_hoje: [...] }
   saída (stdout):   { rodada, achados, status, relatorio, erros, pools, duracao_s,
                       analises: [{ pool_id, erro?, analises: [o que cada agente achou da pool] }] }
   ============================================================ */

import { rodarAgentes } from "../estudio/agentes/ciclo.mjs";
import { relatorioDoDia } from "../estudio/agentes/supervisor.mjs";

const pedacos = [];
for await (const p of process.stdin) pedacos.push(p);
const entrada = JSON.parse(Buffer.concat(pedacos).toString("utf8"));

const t0 = Date.now();
const r = rodarAgentes(entrada);
const doDia = [...(entrada.achados_hoje || []), ...r.achados.map((a) => ({ ...a, rodada: entrada.rodada }))];
const relatorio = relatorioDoDia(doDia, r.analises);

process.stdout.write(JSON.stringify({
  rodada: r.rodada,
  achados: r.achados,
  status: r.status,
  relatorio,
  erros: r.erros,
  pools: r.analises.length,
  duracao_s: (Date.now() - t0) / 1000,
  analises: r.analises.map((p) => ({
    pool_id: p.pool_id,
    erro: p.erro ?? null,
    analises: (p.analises || []).map(({ tokens, ...x }) => x),
  })),
}));
