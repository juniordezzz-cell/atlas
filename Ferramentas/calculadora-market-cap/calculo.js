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
  /* Símbolo de cada projeto da régua: na fonte reserva (CoinPaprika) o
     Bitcoin é "btc-bitcoin", então o id da CoinGecko não basta. */
  var REGUA_SIMBOLOS = { bitcoin: "BTC", ethereum: "ETH", solana: "SOL", aave: "AAVE", uniswap: "UNI", hyperliquid: "HYPE" };

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
    var s = n.toLocaleString("pt-BR", { maximumSignificantDigits: 4 });
    /* centavos sempre com duas casas: "US$ 0,10", não "US$ 0,1" */
    if (!/,[0-9]{2}/.test(s)) s = s.indexOf(",") >= 0 ? s + "0" : s + ",00";
    return "US$ " + s;
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
    if (n >= 0.1) return br(n, 0, 2) + "×";
    /* Fração pequena com 2 algarismos significativos: "0,0016×", nunca
       "0×" — arredondar um tamanho real para zero seria mentir. */
    return n.toLocaleString("pt-BR", { maximumSignificantDigits: 2, maximumFractionDigits: 20 }) + "×";
  }

  function fmtPct(f) {
    if (!finito(f)) return "—";
    var p = f * 100;
    /* 99,6% não vira "100%" ao lado de "0,4% ainda vai entrar" */
    var umaCasa = Math.abs(p) < 10 || (p >= 99.5 && p < 100);
    return (umaCasa ? br(p, 0, 1) : br(p, 0, 0)) + "%";
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

  /* ---------- escolha da aba "Valer como" ----------
     Sem a régua (CoinGecko 429) ou sem o projeto escolhido nela, o
     select só mostraria "Outro valor…" enquanto o estado apontava para
     um projeto ausente — tela travada. Cai no primeiro da régua, ou em
     "outro" se a régua estiver vazia. */
  function opcaoValer(valer, ids) {
    ids = ids || [];
    if (valer === "outro") return "outro";
    if (ids.indexOf(valer) >= 0) return valer;
    return ids.length ? ids[0] : "outro";
  }

  /* ---------- o que fica guardado no navegador ----------
     O localStorage é dividido com as carteiras do ATLAS. A resposta crua
     da CoinGecko tem ~97 KB por token (tickers, descrição) e o top 250
     ~212 KB; a tela usa uma fração disso. */
  function enxugarFicha(c, fonte) {
    if (!c) return null;
    var l = c.links || {};
    /* A CoinPaprika não manda mais a circulação (só total e máximo).
       Ela sai de valor de mercado ÷ preço, a mesma conta ao contrário. */
    var sup = c.supply ? { circulating: c.supply.circulating, total: c.supply.total, max: c.supply.max } : null;
    if (sup && positivo(sup.circulating) == null) {
      var deduzida = precoNoMcap(c.marketCap, c.usd);
      if (deduzida != null) sup.circulating = deduzida;
    }
    return {
      fonte: fonte || "coingecko",
      id: c.id, symbol: c.symbol, name: c.name, image: c.image, usd: c.usd,
      marketCap: c.marketCap, fdv: c.fdv, rank: c.rank,
      ath: c.ath || null, athDate: c.athDate || null,
      supply: sup,
      links: { whitepaper: l.whitepaper || null, homepage: l.homepage || null }
    };
  }

  function enxugarMercado(lista) {
    return (lista || []).map(function (m) {
      return { id: m.id, name: m.name, symbol: m.symbol, marketCap: m.marketCap };
    });
  }

  /* ---------- várias fontes, ids diferentes ---------- */
  function simb(x) { return String(x || "").toUpperCase(); }

  /* Os projetos da régua, na ordem da régua: pelo id da CoinGecko ou,
     na fonte reserva, pelo símbolo (o de maior valor de mercado, para
     um token homônimo pequeno não tomar o lugar). */
  function acharNaRegua(mercado) {
    var l = mercado || [];
    return REGUA.map(function (id) {
      var porId = l.filter(function (m) { return m && m.id === id; })[0];
      if (porId) return porId;
      var s = REGUA_SIMBOLOS[id];
      return l.filter(function (m) { return m && simb(m.symbol) === s; })
        .sort(function (a, b) { return (b.marketCap || 0) - (a.marketCap || 0); })[0] || null;
    }).filter(Boolean);
  }

  /* O próprio token sai da lista do ranking, pelo id ou pelo símbolo
     (o token pode ter vindo de uma fonte e o ranking de outra). */
  function semOToken(lista, id, simbolo) {
    var s = simbolo ? simb(simbolo) : null;
    return (lista || []).filter(function (m) {
      return m && m.id !== id && !(s && simb(m.symbol) === s);
    });
  }

  /* Traduz para o id da fonte reserva usando a busca dela: símbolo
     exato, o de melhor ranking. */
  function idPeloSimbolo(resultados, simbolo) {
    var s = simb(simbolo);
    var achados = (resultados || []).filter(function (r) { return r && simb(r.symbol) === s; })
      .sort(function (a, b) { return (a.rank || 1e9) - (b.rank || 1e9); });
    return achados.length ? achados[0].id : null;
  }

  function podarFichas(fichas, max) {
    var ids = Object.keys(fichas || {}).sort(function (a, b) { return fichas[b].t - fichas[a].t; });
    var out = {};
    ids.slice(0, max).forEach(function (id) { out[id] = fichas[id]; });
    return out;
  }

  /* ============================================================
     TEXTOS PARA INICIANTE (13/10/2026)
     Quem chega pensando "a ENA está a 0,20, se chegar a 1 dólar eu faço
     5×" precisa ler a resposta em frases, com os números do token. Tudo
     aqui devolve texto puro; a tela escapa antes de pôr no HTML.
     ============================================================ */
  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  function mesAno(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return MESES[d.getUTCMonth()] + "/" + d.getUTCFullYear();
  }

  /* "4,8 vezes" a partir do mesmo arredondamento do fmtVezes */
  function vezesTexto(n) { return fmtVezes(n).replace("×", "") + " vezes"; }

  /* A régua em frase: "21% do tamanho", "5,4 vezes o tamanho". A barra
     vai de 0 a 1 (cheia quando o projeto simulado é maior). */
  function descreverRegua(v) {
    if (positivo(v) == null) return null;
    if (v >= 1) {
      return { texto: fmtVezes(v) === "1×" ? "do mesmo tamanho" : vezesTexto(v) + " o tamanho", barra: 1 };
    }
    return { texto: v < 0.01 ? "menos de 1% do tamanho" : fmtPct(v) + " do tamanho", barra: v };
  }

  /* Um preço-alvo de exemplo quando a pessoa ainda não digitou nada:
     o "1 dólar" clássico para quem custa centavos; o dobro para o resto. */
  function alvoExemplo(preco) {
    preco = positivo(preco);
    if (preco == null) return null;
    return preco < 1 ? 1 : preco * 2;
  }

  /* A resposta direta, em frases. d: { simbolo, precoAtual, precoAlvo,
     mcapHoje, mcapAlvo, mcapAlvoCheio, faltaEntrar, pctCirculando,
     acimaNoRanking, maiorQueTodos, ath, athDate } */
  function resumoSimples(d) {
    d = d || {};
    var s = d.simbolo, out = [];
    var razaoPreco = multiplicador(d.precoAlvo, d.precoAtual);
    if (razaoPreco == null || positivo(d.mcapAlvo) == null || positivo(d.mcapHoje) == null) return out;
    if (Math.abs(razaoPreco - 1) < 0.005) return ["Esse é praticamente o preço de hoje."];
    if (razaoPreco < 1) {
      return ["Para o preço de " + s + " cair para " + fmtUSD(d.precoAlvo) + ", o valor de mercado encolheria de " +
        fmtUSD(d.mcapHoje) + " para " + fmtUSD(d.mcapAlvo) + "."];
    }
    out.push("Para o preço de " + s + " chegar a " + fmtUSD(d.precoAlvo) + ", o projeto inteiro precisa ficar " +
      vezesTexto(multiplicador(d.mcapAlvo, d.mcapHoje)) + " maior: de " + fmtUSD(d.mcapHoje) + " para " + fmtUSD(d.mcapAlvo) + ".");
    if (d.maiorQueTodos) {
      out.push("Nenhuma criptomoeda vale isso hoje: seria a maior do mundo.");
    } else if (finito(d.acimaNoRanking) && d.acimaNoRanking > 0) {
      var n = d.acimaNoRanking, so = n <= 20 ? "só " : "";
      out.push("Hoje " + so + n + (n === 1 ? " criptomoeda vale" : " criptomoedas valem") + " isso ou mais.");
    }
    if (positivo(d.faltaEntrar) != null && finito(d.pctCirculando) && d.pctCirculando < 0.999 && positivo(d.mcapAlvoCheio) != null) {
      out.push("E ainda faltam entrar " + fmtQtd(d.faltaEntrar) + " de tokens. Com eles no mercado, o mesmo preço exige um projeto de " +
        fmtUSD(d.mcapAlvoCheio) + ".");
    }
    var quando = mesAno(d.athDate);
    if (positivo(d.ath) != null && quando) {
      out.push(d.precoAlvo > d.ath
        ? s + " nunca chegou a esse preço: o recorde foi " + fmtUSD(d.ath) + ", em " + quando + "."
        : s + " já passou desse preço: o recorde foi " + fmtUSD(d.ath) + ", em " + quando + ".");
    }
    return out;
  }

  /* A dúvida clássica do iniciante, respondida com os números da tela.
     Só faz sentido para alvo acima do preço de hoje. */
  function perguntaComum(d) {
    d = d || {};
    var m = multiplicador(d.precoAlvo, d.precoAtual);
    var mp = multiplicador(d.mcapAlvo, d.mcapHoje);
    if (m == null || m <= 1 || mp == null) return null;
    var s = d.simbolo;
    var resposta = "O seu dinheiro ficaria " + vezesTexto(m) + " maior (US$ 100 virariam " + fmtUSD(100 * m) + "). " +
      "Mas isso só acontece se o projeto inteiro ficar " + vezesTexto(mp) + " maior: de " + fmtUSD(d.mcapHoje) +
      " para " + fmtUSD(d.mcapAlvo) + ". ";
    if (d.precoAtual < 1 && positivo(d.circulante) != null) {
      resposta += "Preço baixo não é desconto: " + s + " custa menos de US$ 1 porque existem " + fmtQtd(d.circulante) + " de tokens. ";
    }
    resposta += "A pergunta certa é se alguém vai pagar " + fmtUSD(d.mcapAlvo) + " por esse projeto.";
    return {
      pergunta: s + " custa " + fmtUSD(d.precoAtual) + ". Se chegar a " + fmtUSD(d.precoAlvo) + ", eu ganho " + vezesTexto(m) + "?",
      resposta: resposta
    };
  }

  /* O dicionário do fim da página. ctx (opcional): { simbolo, preco,
     circulante, total, teto, mcap, fdv, rank, faltaEntrar } — vira o
     exemplo de cada termo quando o dado existe. */
  function glossario(ctx) {
    var c = ctx || {}, s = c.simbolo;
    function ex(cond, txt) { return ctx && s && cond ? s + ": " + txt : null; }
    return [
      { id: "valor-de-mercado", termo: "Valor de mercado (market cap)",
        texto: "Quanto o projeto inteiro vale hoje: o preço de um token vezes a quantidade de tokens em circulação. É o tamanho da pizza.",
        exemplo: ex(positivo(c.preco) && positivo(c.circulante),
          fmtUSD(c.preco) + " × " + fmtQtd(c.circulante) + " tokens = " + fmtUSD(mcapNoPreco(c.preco, c.circulante)) + ".") },
      { id: "circulacao", termo: "Tokens em circulação",
        texto: "Os tokens que já estão no mercado, nas mãos de quem pode comprar e vender. São as fatias que já foram servidas.",
        exemplo: ex(positivo(c.circulante), fmtQtd(c.circulante) + " tokens circulando.") },
      { id: "oferta-total", termo: "Oferta total",
        texto: "Todos os tokens que já existem, incluindo os que ainda estão travados com a equipe, investidores ou o tesouro do projeto.",
        exemplo: ex(positivo(c.total), fmtQtd(c.total) + " tokens existem hoje.") },
      { id: "teto", termo: "Teto (oferta máxima)",
        texto: "O limite de tokens que o contrato permite criar. Nem todo projeto tem teto; sem teto, sempre podem surgir tokens novos.",
        exemplo: ex(true, positivo(c.teto) ? "teto de " + fmtQtd(c.teto) + " tokens." : "sem teto informado.") },
      { id: "fdv", termo: "FDV (fully diluted valuation)",
        texto: "\"Valor totalmente diluído\": quanto o projeto valeria se todos os tokens já estivessem no mercado, pelo preço de hoje. Mostra o tamanho que o projeto vai precisar ter quando tudo for liberado.",
        exemplo: ex(positivo(c.preco) && positivo(c.total),
          fmtUSD(c.preco) + " × " + fmtQtd(c.total) + " tokens = " + fmtUSD(mcapNoPreco(c.preco, c.total)) + ".") },
      { id: "desbloqueio", termo: "Desbloqueio (unlock)",
        texto: "Quando tokens travados são liberados para a equipe, investidores ou comunidade. Quem recebe pode vender, e isso pressiona o preço para baixo.",
        exemplo: ex(positivo(c.faltaEntrar), fmtQtd(c.faltaEntrar) + " tokens ainda vão ser liberados.") },
      { id: "queima", termo: "Queima (burn)",
        texto: "Quando o projeto destrói tokens de propósito. Menos tokens existindo faz cada um representar uma fatia maior do projeto.",
        exemplo: null },
      { id: "emissao", termo: "Emissão",
        texto: "A criação de tokens novos ao longo do tempo, por exemplo como recompensa para quem participa da rede. Aumenta a quantidade de tokens.",
        exemplo: null },
      { id: "diluicao", termo: "Diluição",
        texto: "Quando entram tokens novos no mercado e cada token passa a representar uma fatia menor do projeto. Se o projeto não crescer junto, o preço cai.",
        exemplo: null },
      { id: "ranking", termo: "Ranking",
        texto: "A posição do projeto na lista de todas as criptomoedas, ordenada pelo valor de mercado. O 1º lugar é o maior.",
        exemplo: ex(positivo(c.rank), c.rank + "º lugar hoje.") },
      { id: "liquidez", termo: "Liquidez",
        texto: "Quanto dinheiro existe de verdade para comprar e vender o token. Com pouca liquidez, pouco dinheiro já mexe muito no preço, para cima e para baixo.",
        exemplo: null }
    ];
  }

  var api = {
    REGUA: REGUA,
    acharNaRegua: acharNaRegua, semOToken: semOToken, idPeloSimbolo: idPeloSimbolo,
    mesAno: mesAno, descreverRegua: descreverRegua, alvoExemplo: alvoExemplo,
    resumoSimples: resumoSimples, perguntaComum: perguntaComum, glossario: glossario,
    opcaoValer: opcaoValer, enxugarFicha: enxugarFicha, enxugarMercado: enxugarMercado,
    podarFichas: podarFichas,
    oferta: oferta, mcapNoPreco: mcapNoPreco, precoNoMcap: precoNoMcap,
    multiplicador: multiplicador, regua: regua, posicaoNoRanking: posicaoNoRanking,
    meuDinheiro: meuDinheiro, lerNumero: lerNumero,
    fmtUSD: fmtUSD, fmtQtd: fmtQtd, fmtVezes: fmtVezes, fmtPct: fmtPct,
    linkSeguro: linkSeguro, linksDoToken: linksDoToken
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AtlasMcapCalc = api;
})(typeof window !== "undefined" ? window : this);
