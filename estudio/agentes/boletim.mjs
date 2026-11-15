#!/usr/bin/env node
/* ============================================================
   Laboratório de Agentes · agentes/boletim.mjs

   O boletim (14/11/2026): depois de 7 e de 30 dias, refaz um achado com o
   que aconteceu de verdade e compara com o que o agente previu.

   - Real: as mesmas posições (faixas e capital do achado) passam pelo
     mesmo motor (evalStrat do simulador) num único caminho, o dos preços
     reais de 1h. Volume = média real do período; TVL = média real dos
     snapshots (ou a do achado, se faltar).
   - Previsto para o mesmo prazo: refeito com o mercado gravado no achado
     (só o que se sabia na hora), mesmos 300 sorteios. Assim o boletim de
     7 dias compara 7 com 7, e não com a previsão de 30.
   - Faixa única real: a régua, no mesmo período real.
   - Acertou: o que o achado afirmava aconteceu. Base: fechou no lucro.
     Demais: fechou no lucro e ganhou da faixa única. Acumulador Token:
     terminou com mais token que comprar tudo no início e que esperar com
     o dinheiro parado e comprar no fim.

   Uso pelo Python: entrada { itens: [...] } pela entrada padrão, saída
   { resultados, pulados } pela saída padrão.
   ============================================================ */

import { evalStrat, statsOf, caminhos } from "../motor/simulador.mjs";
import { normalizarCandles } from "../motor/metricas.mjs";
import { pathToFileURL } from "node:url";

const HORA = 3600;
export const COBERTURA_MIN = 0.9;          // fração mínima das horas do prazo com vela real
export const MUDANCA_DE_METODO = Date.parse("2026-11-13T20:00:00Z");   // tendência zero e Curva nova

/**
 * item: { achado_id, rodada, agente, pool_id, par, horizonte_dias, preco,
 *         posicoes:[{cap,a,b}] (cap em dólar), faixa_min, faixa_max, capital_usd,
 *         mercado (M + cotacao_usd), candles:[[t,o,h,l,c,v]], tvl_usd|null }
 * Devolve { resultado } ou { pulado: motivo }.
 */
export function avaliarAchado(item) {
  const H = item.horizonte_dias;
  const M0 = item.mercado || {};
  const cot = Number(M0.cotacao_usd) || 1;
  const t0 = Math.floor(Date.parse(item.rodada) / 1000 / HORA) * HORA;
  const velas = normalizarCandles(item.candles).filter((c) => c[0] >= t0 && c[0] < t0 + H * 86400);
  if (velas.length < COBERTURA_MIN * H * 24) return { pulado: `faltam velas (${velas.length} de ${H * 24})` };

  const data = Float32Array.from([item.preco, ...velas.map((c) => c[4])]);
  const steps = data.length - 1;
  const px = { n: 1, steps, data, dtDays: H / steps };
  const volDia = velas.reduce((s, c) => s + (c[5] || 0), 0) / velas.length * 24;
  const M = {
    ...M0, days: H, nsim: 1,
    vday: volDia > 0 ? volDia / cot : M0.vday,
    tvl: item.tvl_usd > 0 ? item.tvl_usd / cot : M0.tvl,
  };
  const defs = item.posicoes.map((q) => ({ cap: q.cap / cot, a: q.a, b: q.b }));
  const Rr = evalStrat(defs, 0, px, M);
  const real = Rr.pnl[0] * cot;
  const unica = [{ cap: item.capital_usd / cot, a: item.faixa_min, b: item.faixa_max }];
  const baseReal = evalStrat(unica, 0, px, M).pnl[0] * cot;

  const Mp = { ...M0, days: H };
  const st = statsOf(evalStrat(defs, 0, caminhos(Mp), Mp), H);
  const prev = { media: st.mean * cot, p10: st.p10 * cot, p90: st.p90 * cot };

  const pe = data[steps];
  let tokens = null;
  if (item.agente === "acumulador_token") {
    const fim = (Rr.pnl[0] + Rr.cap) / pe, agora = Rr.cap / item.preco, esperar = Rr.cap / pe;
    tokens = { real: fim, comprar_agora: agora, esperar_com_dolar: esperar, ganho_pct: (fim / Math.max(agora, esperar) - 1) * 100 };
  }
  const lucro = real > 0, ganhouBase = real > baseReal;
  const acertou = tokens ? tokens.ganho_pct > 0 : item.agente === "base" ? lucro : lucro && ganhouBase;
  return {
    resultado: {
      achado_id: item.achado_id, rodada: item.rodada, agente: item.agente, pool_id: item.pool_id, par: item.par ?? null,
      horizonte_dias: H, metodo: Date.parse(item.rodada) < MUDANCA_DE_METODO ? "antigo" : "atual",
      horas: velas.length, preco_inicio: item.preco, preco_fim: pe,
      previsto_media_usd: prev.media, previsto_p10_usd: prev.p10, previsto_p90_usd: prev.p90,
      real_usd: real, base_real_usd: baseReal, erro_usd: real - prev.media,
      dentro_faixa: real >= prev.p10 && real <= prev.p90, ganhou_base: ganhouBase, lucro, tokens, acertou,
    },
  };
}

export function avaliarTodos(itens) {
  const resultados = [], pulados = [];
  for (const it of itens || []) {
    try {
      const r = avaliarAchado(it);
      if (r.resultado) resultados.push(r.resultado);
      else pulados.push({ achado_id: it.achado_id, horizonte_dias: it.horizonte_dias, motivo: r.pulado });
    } catch (e) {
      pulados.push({ achado_id: it.achado_id, horizonte_dias: it.horizonte_dias, motivo: `erro: ${e.message}` });
    }
  }
  return { resultados, pulados };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pedacos = [];
  for await (const p of process.stdin) pedacos.push(p);
  const entrada = JSON.parse(Buffer.concat(pedacos).toString("utf8"));
  process.stdout.write(JSON.stringify(avaliarTodos(entrada.itens)));
}
