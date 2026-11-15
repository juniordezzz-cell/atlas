/* ============================================================
   Estúdio de Agentes de Pools · motor/metricas.mjs

   Métricas de pool calculadas com dados reais (Fase 1, 11/11/2026):
   APR de taxas, volatilidade realizada e sinal de lateralidade.

   Candle = [hora_unix_s, abertura, máxima, mínima, fechamento, volume_usd],
   o formato do OHLCV da GeckoTerminal. A GeckoTerminal manda do mais novo
   para o mais antigo; normalizarCandles põe em ordem e tira repetidos.
   ============================================================ */

export const HORAS_ANO = 24 * 365;

/** Candles válidos, em ordem crescente de hora, um por hora. */
export function normalizarCandles(lista) {
  const porHora = new Map();
  for (const c of lista || []) {
    if (!Array.isArray(c) || c.length < 5) continue;
    const t = Number(c[0]), f = Number(c[4]);
    if (!Number.isFinite(t) || !(f > 0)) continue;
    porHora.set(t, [t, Number(c[1]), Number(c[2]), Number(c[3]), f, Number(c[5]) || 0]);
  }
  return [...porHora.values()].sort((a, b) => a[0] - b[0]);
}

/** Últimos `dias` de candles de 1h (pela hora do mais recente). */
export function janela(candles, dias) {
  if (!candles.length) return [];
  const fim = candles[candles.length - 1][0], ini = fim - dias * 86400;
  return candles.filter((c) => c[0] > ini);
}

/**
 * APR de taxas (fração ao ano): 365 × taxa × volume 24h ÷ TVL.
 * taxaPct em % como no Scanner e no simulador (0,3 = 0,3%).
 */
export function aprTaxas(taxaPct, vol24h, tvl) {
  if (!(tvl > 0) || !(vol24h >= 0) || !(taxaPct >= 0)) return null;
  return (365 * (taxaPct / 100) * vol24h) / tvl;
}

/**
 * Volatilidade realizada anual (fração) dos últimos `dias`, pelos retornos
 * logarítmicos dos fechamentos de 1h: desvio-padrão × √(24 × 365).
 * Devolve null se a janela tiver menos de 80% das velas esperadas.
 */
export function volRealizada(candles, dias) {
  const j = janela(candles, dias);
  if (j.length < 0.8 * dias * 24) return null;
  const r = [];
  for (let i = 1; i < j.length; i++) r.push(Math.log(j[i][4] / j[i - 1][4]));
  if (r.length < 2) return null;
  const m = r.reduce((s, x) => s + x, 0) / r.length;
  const v = r.reduce((s, x) => s + (x - m) ** 2, 0) / (r.length - 1);
  return Math.sqrt(v * HORAS_ANO);
}

/**
 * Sinal de lateralidade (0 a 1): fração das velas de 1h dos últimos `dias`
 * que fecharam dentro de ±`faixa` da mediana dos fechamentos do período.
 * 1 = preço preso numa faixa; perto de 0 = tendência ou oscilação larga.
 */
export function lateralidade(candles, dias = 30, faixa = 0.1) {
  const j = janela(candles, dias);
  if (j.length < 0.8 * dias * 24) return null;
  const f = j.map((c) => c[4]).sort((a, b) => a - b);
  const meio = f.length >> 1;
  const med = f.length % 2 ? f[meio] : (f[meio - 1] + f[meio]) / 2;
  const dentro = f.filter((x) => Math.abs(x / med - 1) <= faixa).length;
  return dentro / f.length;
}
