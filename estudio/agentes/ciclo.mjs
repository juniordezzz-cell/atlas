/* ============================================================
   Estúdio de Agentes de Pools · agentes/ciclo.mjs

   O ciclo dos agentes (Fase 3, sem IA), uma vez por hora:
     1. recebe as pools prontas (filtro da varredura + 7 dias de velas);
     2. cada agente aplica a sua regra (regras.mjs);
     3. simula a sua estratégia com o motor da Fase 1 (mesmo build, evalStrat
        e statsOf do caça-estratégias, mesma faixa e mesmos sorteios);
     4. compara com a Faixa única na mesma pool: só é achado se ganhar dela
        na média (e a média for positiva);
     5. devolve achados e status para o Python gravar.
   O passo do parecer (IA) entra na Fase 5.

   Unidades: o simulador conta tudo na moeda da cotação. Em par com stable
   isso já é dólar. Em par como JUP/SOL, a simulação roda em SOL (capital,
   TVL, volume e gás convertidos pelo preço do SOL em dólar no snapshot) e o
   resultado volta para dólar pelo mesmo preço. A variação do próprio SOL
   contra o dólar fica de fora, como no simulador.
   ============================================================ */

import { build, evalStrat, statsOf, caminhos } from "../motor/simulador.mjs";
import { calibrar } from "../motor/calibracao.mjs";
import { normalizarCandles, janela, volRealizada, lateralidade } from "../motor/metricas.mjs";
import { AGENTES, CONFIG, aplicarRegra, naListaDeCompra } from "./regras.mjs";

const DIA = 86400;
const EM_DOLAR = ["mean", "med", "p10", "p90", "fees", "il", "cost"];
const ESTAVEIS = ["USDC", "USDT", "USDS", "DAI", "USDE", "PYUSD", "USDBC", "EURC", "USD1", "FDUSD", "USDG", "AUSD", "SUSDS"];

/** Volume em dólar por dia completo (UTC), do mais antigo ao mais novo. */
export function volumesDiarios(candles) {
  if (!candles.length) return [];
  const ultimoDia = Math.floor(candles[candles.length - 1][0] / DIA);
  const porDia = new Map();
  for (const c of candles) {
    const d = Math.floor(c[0] / DIA);
    if (d >= ultimoDia) continue; // o dia de hoje ainda não fechou
    porDia.set(d, (porDia.get(d) || 0) + (c[5] || 0));
  }
  return [...porDia.entries()].sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}

const mediana = (xs) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Preço da moeda da cotação em dólar (1 para stables). */
export function cotacaoEmDolar(pool) {
  if (pool.preco > 0 && pool.preco_usd > 0) return pool.preco_usd / pool.preco;
  if (ESTAVEIS.includes(String(pool.cotacao || "").toUpperCase())) return 1;
  return null;
}

/**
 * Mercado M e faixa de uma pool, na moeda da cotação.
 * Devolve null (com motivo) quando faltam dados para simular.
 */
export function prepararPool(pool, candlesBrutos, cfg = CONFIG) {
  const c = normalizarCandles(candlesBrutos);
  if (c.length < 24 * 7 * 0.8) return { erro: "menos de 7 dias de velas" };
  const cot = cotacaoEmDolar(pool);
  if (!(cot > 0)) return { erro: "sem preço da cotação em dólar" };
  if (pool.taxa_pct == null) return { erro: "sem taxa" };
  const p0 = c[c.length - 1][4];
  const tvl = pool.tvl_snap ?? pool.tvl, vol = pool.vol_24h_snap ?? pool.vol_24h;
  const cal = calibrar({ rede: pool.rede, preco: p0, tvl, vol24h: vol, taxaPct: pool.taxa_pct }, c,
    { days: cfg.dias, nsim: cfg.nsim, seed: cfg.seed });
  if (!cal) return { erro: "calibração sem dados" };
  // Tudo na moeda da cotação: TVL, volume e gás vêm em dólar.
  const M = { ...cal.M, tvl: cal.M.tvl / cot, vday: cal.M.vday / cot, gas: cal.M.gas / cot };
  const w = cfg.larguraSigmas * M.vol * Math.sqrt(cfg.dias / 365);
  const lo = p0 * Math.exp(-w), hi = p0 * Math.exp(w);
  return { c, M, origem: cal.origem, cot, p0, lo, hi, cap: cfg.capitalUsd / cot, tvl, vol };
}

/** O que as regras olham, calculado das velas e do snapshot. */
export function metricasPool(pool, prep, cfg = CONFIG) {
  const { c, M, p0, tvl, vol } = prep;
  const vd = volumesDiarios(c);
  const ult7 = vd.slice(-7);
  const ult4 = vd.slice(-4);
  const j30 = janela(c, 30);
  const min30 = Math.min(...j30.map((x) => x[4]));
  return {
    dias: cfg.dias,
    giro: tvl > 0 ? vol / tvl : null,
    giroEstavel: ult7.length >= 3 ? Math.min(...ult7) >= 0.5 * mediana(ult7) : null,
    volumeCaindo3d: ult4.length === 4 ? ult4[1] < ult4[0] && ult4[2] < ult4[1] && ult4[3] < ult4[2] : false,
    lateral: lateralidade(c, 30, 0.1),
    sigma30: volRealizada(c, 30),
    sigma7: volRealizada(c, 7),
    kappa: M.kappa,
    mu: M.mu,
    diasHistorico: (c[c.length - 1][0] - c[0][0]) / DIA,
    naLista: naListaDeCompra(pool.ativo_simbolo),
    acimaDaMinima30: min30 > 0 ? p0 / min30 - 1 : null,
  };
}

/** Simula uma estratégia (modelo × N) na pool: números idênticos ao caça-estratégias. */
export function simular(prep, px, modelo, n, cfg = CONFIG) {
  const d = build(modelo, n, prep.cap, prep.lo, prep.hi, prep.M.p0);
  const st = statsOf(evalStrat(d, cfg.rebalancear, px, prep.M), prep.M.days);
  return { modelo, n, posicoes: d, st };
}

/** Estatísticas na moeda da cotação → dólar. */
export function emDolar(st, cot) {
  const o = { ...st };
  for (const k of EM_DOLAR) o[k] = st[k] * cot;
  return o;
}

/** Meia-largura relativa da faixa do meio das Aninhadas (para a regra do Concentrador). */
function meiaLarguraCentral(posicoes, p0) {
  const ultima = posicoes[posicoes.length - 1];
  return (ultima.b - ultima.a) / 2 / p0;
}

/**
 * Uma pool, todos os agentes. Devolve as análises (regra e resultado de cada
 * agente) e os achados.
 */
export function analisarPool(pool, candles, cfg = CONFIG) {
  const prep = prepararPool(pool, candles, cfg);
  if (prep.erro) return { pool_id: pool.pool_id, erro: prep.erro, analises: [], achados: [] };
  const m = metricasPool(pool, prep, cfg);
  const regras = Object.fromEntries(AGENTES.map((a) => [a.id, aplicarRegra(a.id, m)]));
  const trabalham = AGENTES.filter((a) => regras[a.id].procura && regras[a.id].descarta !== true);
  const analises = AGENTES.map((a) => ({ agente: a.id, ...regras[a.id], trabalha: false }));
  if (!trabalham.length) return { pool_id: pool.pool_id, metricas: m, analises, achados: [] };

  const px = caminhos(prep.M);
  const ref = simular(prep, px, "single", 1, cfg);
  const achados = [];
  for (const a of trabalham) {
    let melhor = null;
    for (const n of a.faixas) {
      const r = a.modelo === "single" ? ref : simular(prep, px, a.modelo, n, cfg);
      if (!melhor || r.st.mean > melhor.st.mean) melhor = r;
    }
    const an = analises.find((x) => x.agente === a.id);
    if (a.id === "concentrador") {
      const meia = meiaLarguraCentral(melhor.posicoes, prep.p0);
      const r2 = aplicarRegra(a.id, m, { meiaLarguraCentral: meia });
      Object.assign(an, r2);
      if (r2.descarta) continue;
    }
    an.trabalha = true;
    an.media_usd = melhor.st.mean * prep.cot;
    an.faixas = melhor.n;
    const ganho = melhor.st.mean - ref.st.mean;
    const venceu = a.modelo === "single" ? melhor.st.mean > 0 : ganho > 0 && melhor.st.mean > 0;
    an.achado = venceu;
    if (!venceu) continue;
    const st = emDolar(melhor.st, prep.cot);
    achados.push({
      agente: a.id,
      pool_id: pool.pool_id,
      rede: pool.rede,
      dex: pool.dex,
      par: pool.par,
      ativo_simbolo: pool.ativo_simbolo,
      cotacao: pool.cotacao,
      modelo: melhor.modelo,
      faixas: melhor.n,
      preco: prep.p0,
      faixa_min: prep.lo,
      faixa_max: prep.hi,
      posicoes: melhor.posicoes.map((q) => ({ cap: q.cap * prep.cot, a: q.a, b: q.b })),
      capital_usd: cfg.capitalUsd,
      dias: cfg.dias,
      media_usd: st.mean,
      p10_usd: st.p10,
      p90_usd: st.p90,
      taxas_usd: st.fees,
      il_usd: st.il,
      custo_usd: st.cost,
      em_faixa_pct: st.tir,
      ret_risco: st.rr,
      prob_perda_pct: st.loss,
      apr_taxas_pct: st.apr,
      ref_media_usd: ref.st.mean * prep.cot,
      ganho_vs_ref_usd: ganho * prep.cot,
      mercado: { ...prep.M, cotacao_usd: prep.cot },
      metricas: { ...m, regra: an.motivo },
      conc_estimada: prep.origem.concEstimada,
    });
  }
  return { pool_id: pool.pool_id, metricas: m, analises, achados };
}

/**
 * Rodada completa: todas as pools, todos os agentes.
 *   entrada: { rodada, pools: [{ pool_id, rede, dex, par, taxa_pct, tvl, vol_24h,
 *              tvl_snap, vol_24h_snap, preco, preco_usd, ativo_simbolo, cotacao, candles }] }
 */
export function rodarAgentes(entrada, cfg = CONFIG) {
  const pools = entrada.pools || [];
  const resultados = pools.map((p) => analisarPool(p, p.candles, cfg));
  const achados = resultados.flatMap((r) => r.achados);
  const porPool = Object.fromEntries(pools.map((p) => [p.pool_id, p]));
  const status = AGENTES.map((a) => {
    const meus = achados.filter((x) => x.agente === a.id).sort((x, y) => y.media_usd - x.media_usd);
    const trabalhadas = resultados.filter((r) => r.analises.some((x) => x.agente === a.id && x.trabalha)).length;
    const top = meus[0];
    return {
      agente: a.id,
      estado: !pools.length || !trabalhadas ? "sem_pools" : "ok",
      pool_em_analise: top?.pool_id ?? null,
      par_em_analise: top ? porPool[top.pool_id]?.par ?? null : null,
      pools_vistas: pools.length,
      pools_trabalhadas: trabalhadas,
      achados: meus.length,
      melhor_media_usd: top?.media_usd ?? null,
      mensagem: top ? `melhor: ${top.par} (${top.modelo} × ${top.faixas})` : trabalhadas ? "nenhuma estratégia ganhou da Faixa única" : "nenhuma pool passou na regra",
    };
  });
  const erros = resultados.filter((r) => r.erro).map((r) => ({ pool_id: r.pool_id, erro: r.erro }));
  return { rodada: entrada.rodada, achados, status, analises: resultados, erros };
}
