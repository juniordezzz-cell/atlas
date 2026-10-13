/* ============================================================
   ATLAS · Ferramentas/calculadora-market-cap/calculo.js

   As contas da Calculadora de Market Cap, sem tela e sem rede.
   Spec: docs/superpowers/specs/2026-10-13-calculadora-market-cap-design.md

   A ideia que tudo aqui serve: o preço da unidade não diz se um
   token é barato. Valor de mercado = preço × quantidade de tokens.
   "Hoje" usa os tokens em circulação; "quando tudo desbloquear" usa
   a oferta total (ou a máxima, se não houver total), o mesmo
   critério do FDV da CoinGecko.

   Regra da casa: faltou dado, devolve null. Nunca NaN nem Infinity —
   número inventado numa ferramenta que ensina a desconfiar de número
   seria a pior ironia possível.

   Exposto em: window.AtlasMcapCalc (navegador) e module.exports (Node).
   ============================================================ */
(function (root) {
  "use strict";

  var REGUA = ["bitcoin", "ethereum", "solana", "aave", "uniswap", "hyperliquid"];

  function finito(x) { return typeof x === "number" && isFinite(x); }
  function positivo(x) { return finito(x) && x > 0 ? x : null; }

  /* ---------- oferta ---------- */
  function oferta(s) {
    s = s || {};
    var circ = positivo(s.circulating);
    var total = positivo(s.total);
    var max = positivo(s.max);
    /* Mesmo critério do FDV da CoinGecko (conferido no JUP em 13/10/2026):
       a oferta TOTAL primeiro. A máxima fica desatualizada quando o
       projeto queima tokens (JUP: máx. 10 bi, total 6,86 bi), então só
       entra quando a fonte não informa o total. */
    var cheia = total != null ? total : max;
    var base = total != null ? "total" : (max != null ? "max" : null);
    var inconsistente = false;
    /* Fonte às vezes informa mais tokens circulando do que o total.
       Tratamos como 100% circulando e a tela avisa. */
    if (circ != null && cheia != null && circ > cheia) {
      inconsistente = true;
      cheia = circ;
    }
    var temAmbos = circ != null && cheia != null;
    return {
      circulante: circ,
      cheia: cheia,
      base: base,
      faltaEntrar: temAmbos ? cheia - circ : null,
      pctCirculando: temAmbos ? circ / cheia : null,
      semTeto: max == null,
      teto: max,
      inconsistente: inconsistente
    };
  }

  /* ---------- contas ---------- */
  function mcapNoPreco(preco, qtd) {
    preco = positivo(preco); qtd = positivo(qtd);
    if (preco == null || qtd == null) return null;
    var r = preco * qtd;
    return finito(r) ? r : null;
  }

  function precoNoMcap(mcap, qtd) {
    mcap = positivo(mcap); qtd = positivo(qtd);
    if (mcap == null || qtd == null) return null;
    var r = mcap / qtd;
    return finito(r) ? r : null;
  }

  function multiplicador(alvo, atual) {
    alvo = positivo(alvo); atual = positivo(atual);
    if (alvo == null || atual == null) return null;
    var r = alvo / atual;
    return finito(r) ? r : null;
  }

  function regua(mcap, projetos) {
    if (positivo(mcap) == null) return [];
    return (projetos || []).filter(function (p) {
      return p && positivo(p.marketCap) != null;
    }).map(function (p) {
      return { id: p.id, name: p.name, symbol: p.symbol, vezes: mcap / p.marketCap };
    });
  }

  /* Onde um valor de mercado cairia no ranking. lista: os maiores do
     mercado (qualquer ordem); excluirId tira o próprio token, senão
     ele competiria consigo mesmo. */
  function posicaoNoRanking(mcap, lista, excluirId) {
    if (positivo(mcap) == null) return null;
    var l = (lista || []).filter(function (c) {
      return c && c.id !== excluirId && positivo(c.marketCap) != null;
    }).sort(function (a, b) { return b.marketCap - a.marketCap; });
    if (!l.length) return null;
    for (var i = 0; i < l.length; i++) {
      if (mcap > l[i].marketCap) {
        return {
          posicao: i + 1, acima: i > 0 ? l[i - 1] : null, abaixo: l[i],
          maiorQueTodos: i === 0, foraDaLista: false, tamanhoLista: l.length
        };
      }
    }
    return {
      posicao: null, acima: l[l.length - 1], abaixo: null,
      maiorQueTodos: false, foraDaLista: true, tamanhoLista: l.length
    };
  }

  function meuDinheiro(valor, precoAtual, precoAlvo) {
    valor = positivo(valor); precoAtual = positivo(precoAtual); precoAlvo = positivo(precoAlvo);
    if (valor == null || precoAtual == null || precoAlvo == null) return null;
    var tokens = valor / precoAtual;
    var valorFinal = tokens * precoAlvo;
    var lucro = valorFinal - valor;
    return { tokens: tokens, valorFinal: valorFinal, lucro: lucro, lucroPct: lucro / valor * 100 };
  }

  /* ---------- leitura do que a pessoa digita ----------
     Jeito brasileiro primeiro: "1.000" é mil, "0,5" é meio.
     "0.077" é decimal (parte inteira zero não tem milhar).
     Aceita sufixos: k/mil, mi, bi, tri. */
  var SUFIXOS = { k: 1e3, mil: 1e3, mi: 1e6, bi: 1e9, tri: 1e12 };

  function lerNumero(texto) {
    if (texto == null) return null;
    var t = String(texto).toLowerCase().replace(/us\$|\$/g, "").replace(/\s+/g, "");
    if (!t) return null;
    var mult = 1;
    var m = t.match(/^(.*?)(tri|bi|mi|mil|k)$/);
    if (m) { t = m[1]; mult = SUFIXOS[m[2]]; }
    if (!/^[0-9.,]+$/.test(t)) return null;
    var pontos = (t.match(/\./g) || []).length;
    var virgulas = (t.match(/,/g) || []).length;
    if (pontos && virgulas) {
      /* o separador que aparece por último é o decimal */
      if (t.lastIndexOf(",") > t.lastIndexOf(".")) {
        if (virgulas > 1) return null;
        t = t.replace(/\./g, "").replace(",", ".");
      } else {
        if (pontos > 1) return null;
        t = t.replace(/,/g, "");
      }
    } else if (virgulas) {
      if (virgulas > 1) return null;
      t = t.replace(",", ".");
    } else if (pontos > 1) {
      t = t.replace(/\./g, "");
    } else if (pontos === 1 && /^[1-9][0-9]{0,2}\.[0-9]{3}$/.test(t)) {
      t = t.replace(".", ""); /* "1.000" = mil */
    }
    var n = parseFloat(t);
    if (!finito(n)) return null;
    n = n * mult;
    return n > 0 && finito(n) ? n : null;
  }

  /* ---------- formatos ---------- */
  function br(n, minFrac, maxFrac) {
    return n.toLocaleString("pt-BR", { minimumFractionDigits: minFrac, maximumFractionDigits: maxFrac });
  }

  function escala(n) {
    var a = Math.abs(n);
    if (a >= 1e12) return { v: n / 1e12, s: " tri" };
    if (a >= 1e9) return { v: n / 1e9, s: " bi" };
    if (a >= 1e6) return { v: n / 1e6, s: " mi" };
    return null;
  }

  function fmtUSD(n) {
    if (!finito(n)) return "—";
    var e = escala(n);
    if (e) return "US$ " + br(e.v, 2, 2) + e.s;
    var a = Math.abs(n);
    if (a >= 1) return "US$ " + br(n, 2, 2);
    if (a === 0) return "US$ 0,00";
    return "US$ " + n.toLocaleString("pt-BR", { maximumSignificantDigits: 4 });
  }

  function fmtQtd(n) {
    if (!finito(n)) return "—";
    var e = escala(n);
    if (e) return br(e.v, 0, 2) + e.s;
    var a = Math.abs(n);
    if (a >= 1000) return br(n, 0, 0);
    if (a >= 1) return br(n, 0, 2);
    return n.toLocaleString("pt-BR", { maximumSignificantDigits: 3 });
  }

  function fmtVezes(n) {
    if (!finito(n)) return "—";
    if (n >= 10) return br(n, 0, 0) + "×";
    if (n >= 1) return br(n, 0, 1) + "×";
    return br(n, 0, 2) + "×";
  }

  function fmtPct(f) {
    if (!finito(f)) return "—";
    var p = f * 100;
    return (Math.abs(p) >= 10 ? br(p, 0, 0) : br(p, 0, 1)) + "%";
  }

  /* ---------- links ---------- */
  function linkSeguro(url) {
    if (typeof url !== "string") return null;
    var u = url.trim();
    return /^https?:\/\/[^\s]+$/i.test(u) ? u : null;
  }

  function linksDoToken(coin) {
    coin = coin || {};
    var l = coin.links || {};
    var out = [];
    var oficial = linkSeguro(l.whitepaper) || linkSeguro(l.homepage);
    if (oficial) out.push({ rotulo: "Documentação oficial do projeto", url: oficial, tipo: "oficial" });
    if (coin.id) {
      out.push({
        rotulo: "Cronograma em gráfico (Tokenomist)",
        url: "https://tokenomist.ai/" + encodeURIComponent(coin.id),
        tipo: "tokenomist"
      });
    }
    return out;
  }

  var api = {
    REGUA: REGUA,
    oferta: oferta, mcapNoPreco: mcapNoPreco, precoNoMcap: precoNoMcap,
    multiplicador: multiplicador, regua: regua, posicaoNoRanking: posicaoNoRanking,
    meuDinheiro: meuDinheiro, lerNumero: lerNumero,
    fmtUSD: fmtUSD, fmtQtd: fmtQtd, fmtVezes: fmtVezes, fmtPct: fmtPct,
    linkSeguro: linkSeguro, linksDoToken: linksDoToken
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AtlasMcapCalc = api;
})(typeof window !== "undefined" ? window : this);
