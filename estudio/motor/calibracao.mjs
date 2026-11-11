/* ============================================================
   Estúdio de Agentes de Pools · motor/calibracao.mjs

   Dados reais → "mercado" M no formato do simulador (o mesmo objeto que
   market() monta na aba Simulação), para os agentes simularem cada pool.

   Decisões da Fase 1 (11/11/2026):
   - Simulação calibrada: volatilidade, tendência e volta à média vêm dos
     candles de 1h; os caminhos continuam sorteados como no simulador.
     Replay do histórico fica para o backtest.
   - κ (volta à média) estimado por regressão AR(1) do log do preço,
     limitado a [0, 25] — 25 é o cenário "Lateral" do simulador.
   - μ (tendência) limitado a [−60%, +80%] ao ano, os cenários "baixa" e
     "alta" do simulador: 30 dias de histórico dão tendências absurdas.
   - conc (concentração dos outros LPs) fica em 8%, o padrão do simulador,
     até a liquidez por tick entrar; o achado deve marcar como estimado.
   ============================================================ */

import { normalizarCandles, janela, volRealizada, HORAS_ANO } from "./metricas.mjs";

/** Gás por transação em dólar e taxa de swap (fração), como NETS do simulador. */
export const REDES = {
  Solana: { gas: 0.003 },
  Base: { gas: 0.03 },
};
export const PADRAO = { days: 30, conc: 0.08, swap: 0.0015, nsim: 1000, seed: 42 };
export const LIMITES = { kappa: [0, 25], mu: [-0.6, 0.8] };

const limitar = (v, [a, b]) => Math.min(b, Math.max(a, v));

/**
 * Estima μ e κ do processo do simulador
 *   ln P ← ln P + (μ − σ²/2)dt + κ(ln P₀ − ln P)dt + σ√dt·Z
 * pela regressão Δx = a + b·x₋₁ nos logs dos fechamentos de 1h.
 * κ = −b/dt. μ sai da deriva média dos retornos: μ = média/dt + σ²/2.
 */
export function estimarProcesso(candles, dias, sigma) {
  const j = janela(candles, dias);
  if (j.length < 0.8 * dias * 24) return null;
  const x = j.map((c) => Math.log(c[4])), dt = 1 / HORAS_ANO;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  const n = x.length - 1;
  for (let i = 1; i < x.length; i++) {
    const a = x[i - 1], d = x[i] - x[i - 1];
    sx += a; sy += d; sxx += a * a; sxy += a * d;
  }
  const den = n * sxx - sx * sx;
  const b = den !== 0 ? (n * sxy - sx * sy) / den : 0;
  const kappaBruto = -b / dt;
  const muBruto = sy / n / dt + (sigma * sigma) / 2;
  return {
    kappa: limitar(Number.isFinite(kappaBruto) ? kappaBruto : 0, LIMITES.kappa),
    mu: limitar(Number.isFinite(muBruto) ? muBruto : 0, LIMITES.mu),
    kappaBruto,
    muBruto,
  };
}

/**
 * Monta o mercado M de uma pool real.
 *   pool: { rede, preco, tvl, vol24h, taxaPct }  (taxaPct como no Scanner: 0,3 = 0,3%)
 *   candles: OHLCV de 1h da GeckoTerminal (qualquer ordem)
 *   opcoes: sobrescreve days, conc, swap, nsim, seed, janelaDias (padrão 30)
 * Devolve { M, origem } ou null se faltarem dados; origem diz de onde veio cada número.
 */
export function calibrar(pool, candles, opcoes = {}) {
  const rede = REDES[pool?.rede];
  if (!rede || !(pool.preco > 0) || !(pool.tvl > 0) || !(pool.vol24h >= 0) || !(pool.taxaPct >= 0)) return null;
  const c = normalizarCandles(candles);
  const dias = opcoes.janelaDias || 30;
  let sigma = volRealizada(c, dias), janelaUsada = dias;
  if (sigma == null) { sigma = volRealizada(c, 7); janelaUsada = 7; }
  if (sigma == null || !(sigma > 0)) return null;
  const proc = estimarProcesso(c, janelaUsada, sigma);
  const cfg = { ...PADRAO, ...opcoes };
  const M = {
    p0: pool.preco,
    vol: sigma,
    mu: proc ? proc.mu : 0,
    kappa: proc ? proc.kappa : 0,
    days: Math.max(1, cfg.days),
    tvl: pool.tvl,
    vday: pool.vol24h,
    fee: pool.taxaPct / 100,
    conc: Math.min(0.95, Math.max(0.005, cfg.conc)),
    gas: rede.gas,
    swap: cfg.swap,
    nsim: Math.max(50, Math.min(3000, cfg.nsim | 0)),
    seed: cfg.seed | 0,
  };
  return {
    M,
    origem: {
      janelaDias: janelaUsada,
      velas: janela(c, janelaUsada).length,
      kappaBruto: proc?.kappaBruto ?? null,
      muBruto: proc?.muBruto ?? null,
      concEstimada: opcoes.conc == null,
    },
  };
}
