/* ============================================================
   Laboratório de Agentes · agentes/regras.mjs

   Os seis agentes e as regras de cada um (Fase 3, 13/11/2026): "procura
   pools com" e "descarta quando" do plano, traduzidos em números calculados
   com as velas de 1h. Os limites ficam todos aqui, num lugar só, para
   ajustar depois sem mexer no ciclo. A ficha de cada agente está em
   docs/laboratorio-agentes-fichas.md.
   ============================================================ */

/** Parâmetros da simulação de cada pool. Valores em dólar. */
export const CONFIG = {
  capitalUsd: 1000,    // capital simulado por pool
  dias: 30,            // horizonte da simulação
  nsim: 300,           // caminhos sorteados (os mesmos 300 do caça-estratégias)
  seed: 42,
  larguraSigmas: 1,    // faixa = preço × e^(±k·σ·√(dias/365))
  rebalancear: 0,      // como o caça-estratégias: sem rebalanceamento
};

/** Limites das regras (valores iniciais, ajustáveis). */
export const LIMITES = {
  giroMin: 1,              // volume 24h ÷ TVL
  giroEstavelMin: 0.5,     // dia mais fraco dos últimos 7 ≥ 50% da mediana
  lateralMin: 0.6,         // fração do tempo a ±10% da mediana em 30 dias
  voltaMediaMin: 5,        // κ (volta à média) por ano
  tendenciaForte: 1.5,     // movimento de 30 dias ≥ 1,5 oscilação normal (antes |μ| ≥ 0,4 ao ano: dava 90%)
  oscilacaoForte: 0.6,     // volatilidade de 30 dias ao ano
  precoParado: 0.2,        // volatilidade de 7 dias ao ano
  poolNovaDias: 30,        // menos que isso de velas = pool nova
  pertoDoSuporte: 0.1,     // até 10% acima da mínima de 30 dias
  semanaTipica: 7,         // Concentrador: o preço tem de caber na faixa do meio por tantos dias
};

/**
 * Lista de compra do Acumulador (dono, 13/11/2026), pelo símbolo do ativo.
 * Ações tokenizadas entram pelo padrão xStocks (AAPLx, CRCLx, TSLAx...) e
 * pelos nomes em LISTA_ACOES.
 */
export const LISTA_COMPRA = [
  "SYRUP", "AAVE", "ENA", "BTC", "BNB", "AERO", "UNI", "LDO", "SUI", "SOL", "ETH",
  "RENDER", "ONDO", "JTO", "MORPHO", "PENDLE", "RAY", "LINK", "SKY", "HYPE", "JUP", "PYTH",
];
export const LISTA_ACOES = ["SPACEX", "SPCX", "CRCL", "CRCLX"];
/** Versões embrulhadas que contam como o mesmo ativo. */
export const APELIDOS = {
  WETH: "ETH", WBTC: "BTC", CBBTC: "BTC", TBTC: "BTC", WSOL: "SOL", RNDR: "RENDER", WBNB: "BNB",
};

const XSTOCK = /^[A-Z]{1,5}x$/;

export function naListaDeCompra(simbolo) {
  if (!simbolo) return false;
  const s = String(simbolo).trim();
  if (XSTOCK.test(s)) return true;
  const u = s.toUpperCase();
  const base = APELIDOS[u] || u;
  return LISTA_COMPRA.includes(base) || LISTA_ACOES.includes(u);
}

/**
 * Os seis agentes. `faixas` = valores de N do simulador que o agente testa;
 * ele fica com o melhor pela média (o mesmo critério do caça-estratégias).
 */
export const AGENTES = [
  { id: "base", nome: "Base", modelo: "single", faixas: [1] },
  { id: "concentrador", nome: "Concentrador", modelo: "nested", faixas: [2, 3, 4, 5] },
  { id: "curva", nome: "Curva", modelo: "curve", faixas: [2, 3, 4, 5, 6] },
  { id: "pontas", nome: "Pontas", modelo: "bidask", faixas: [2, 3, 4, 5, 6] },
  { id: "grade", nome: "Grade", modelo: "spot", faixas: [2, 3, 4, 5, 6] },
  { id: "acumulador", nome: "Acumulador Dólar", modelo: "acc", faixas: [1, 2, 3, 4, 5, 6] },
  // Mesma regra e mesmo modelo, outro objetivo: terminar com mais unidades do token.
  { id: "acumulador_token", nome: "Acumulador Token", modelo: "acc", faixas: [1, 2, 3, 4, 5, 6], objetivo: "tokens" },
];

const sim = (v) => v === true;
const maiorQue = (v, x) => v != null && v >= x;
const menorQue = (v, x) => v != null && v < x;

/**
 * Regra de um agente sobre as métricas de uma pool (de metricasPool, em ciclo.mjs).
 * Devolve { procura, descarta, motivo }. O agente trabalha na pool quando
 * procura e não descarta. `descarta` pode ser null quando não dá para saber
 * (o Concentrador só sabe a largura da faixa do meio depois de simular).
 */
export function aplicarRegra(id, m, extra = {}) {
  const L = LIMITES;
  switch (id) {
    case "base": {
      const procura = maiorQue(m.giro, L.giroMin) && sim(m.giroEstavel);
      const descarta = sim(m.volumeCaindo3d);
      return { procura, descarta, motivo: descarta ? "volume caindo há 3 dias" : procura ? "giro alto e estável" : "giro baixo ou instável" };
    }
    case "concentrador": {
      const procura = maiorQue(m.lateral, L.lateralMin);
      let descarta = null;
      // O movimento de uma semana típica tem de caber na faixa do meio. (Até 13/11/2026
      // comparava com o de 30 dias, que por construção é a faixa toda: descartava quase tudo.)
      if (extra.meiaLarguraCentral != null && m.sigma7 != null) {
        descarta = m.sigma7 * Math.sqrt(L.semanaTipica / 365) > extra.meiaLarguraCentral;
      }
      return { procura, descarta, motivo: descarta ? "volatilidade passa da faixa do meio" : procura ? "preço lateral" : "preço pouco lateral" };
    }
    case "curva": {
      const procura = maiorQue(m.kappa, L.voltaMediaMin) && maiorQue(m.giro, L.giroMin);
      const descarta = m.tendencia != null && Math.abs(m.tendencia) >= L.tendenciaForte;
      return { procura, descarta, motivo: descarta ? "tendência forte" : procura ? "volta à média com giro alto" : "sem volta à média ou giro baixo" };
    }
    case "pontas": {
      const procura = maiorQue(m.sigma30, L.oscilacaoForte) && maiorQue(m.kappa, L.voltaMediaMin);
      const descarta = menorQue(m.sigma7, L.precoParado);
      return { procura, descarta, motivo: descarta ? "preço parado" : procura ? "oscila forte e volta" : "oscilação fraca ou sem volta" };
    }
    case "grade": {
      const procura = menorQue(m.diasHistorico, L.poolNovaDias);
      const descarta = menorQue(m.giro, L.giroMin);
      return { procura, descarta, motivo: descarta ? "giro baixo" : procura ? "pool nova" : "pool com histórico" };
    }
    case "acumulador":
    case "acumulador_token": {
      const descarta = !m.naLista;
      const procura = sim(m.naLista) && m.acimaDaMinima30 != null && m.acimaDaMinima30 <= L.pertoDoSuporte;
      return { procura, descarta, motivo: descarta ? "fora da lista de compra" : procura ? "perto da mínima de 30 dias" : "longe da mínima de 30 dias" };
    }
    default:
      throw new Error(`agente desconhecido: ${id}`);
  }
}
