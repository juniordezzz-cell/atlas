/* ============================================================
   ATLAS · Ferramentas/scanner-pools/eficiencia.js   (28/11/2026)
   Aba "Eficiência" do Scanner Pools: eficiência de capital nas
   últimas 24 h = volume 24h ÷ TVL (a mesma Razão do ranking de pools).

   Pergunta que responde: em qual plataforma e em qual rede cada dólar
   parado gira mais? O TVL sozinho engana (o dono, 28/11: "a PancakeSwap
   tem 1,8 bi, então rende mais?"): quem fornece liquidez divide as taxas
   com todo o TVL, então o que importa é o giro.

   Duas listas curtas, 8 linhas cada: por plataforma (todas as redes
   somadas) e por rede (todas as DEX somadas). Só entra quem tem TVL de
   pelo menos US$ 50 mi: abaixo disso a razão vira ruído (com 10 mi o topo
   era Metric, BisonFi e Elysium, com pouco dinheiro e giro inflado).

   Fontes (DefiLlama, grátis, sem chave):
     TVL     lite/protocols2  (chainTvls de cada versão; parentProtocols dá
                               o nome da plataforma: Uniswap V3 + V4 = Uniswap)
     Volume  overview/dexs    (breakdown24h por rede)
   As duas falam de rede com nomes diferentes ("BSC" e "bsc", "OP Mainnet"
   e "optimism", "Avalanche" e "avax"); chaveRede() junta. O Scanner chama
   BSC de "BNB Chain": REDE_SCANNER faz a ponte para o clique, que leva ao
   Descobrir com a plataforma ou a rede já filtrada.

   Carrega só quando a aba é aberta e guarda o resultado por 1 hora.
   ============================================================ */
(function (raiz) {
  "use strict";

  var TVL_MIN = 50e6, LINHAS = 8;     // abaixo de 50 mi apareciam DEX pequenas com giro inflado
  var CACHE_KEY = "atlas.scanner.eficiencia.v3", CACHE_MS = 3600e3;
  var URLS = {
    lite: "https://api.llama.fi/lite/protocols2",
    dexs: "https://api.llama.fi/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true"
  };
  // nome no TVL (chainTvls) → nome no volume (breakdown24h), quando a regra geral não basta
  var ESPECIAL = { "OP Mainnet": "optimism", "Hyperliquid L1": "hyperliquid", "Robinhood Chain": "robinhood",
    "ZKsync Era": "era", "Gnosis": "xdai", "Avalanche": "avax" };
  // nome da DefiLlama → nome que o Scanner usa nos filtros
  var REDE_SCANNER = { "BSC": "BNB Chain", "OP Mainnet": "Optimism", "Hyperliquid L1": "HyperEVM", "Robinhood Chain": "Robinhood" };
  var DEX_SCANNER = { "Curve Finance": "Curve" };
  // fora a pedido do dono (28/11): THORChain é troca entre redes com pool pareada em RUNE,
  // não é o tipo de pool que o projeto estuda (e o Scanner não acompanha)
  var FORA = /thorchain/i;
  var REDE_EXIBE = { "BSC": "BNB Chain", "OP Mainnet": "Optimism", "Hyperliquid L1": "Hyperliquid", "Robinhood Chain": "Robinhood" };

  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
  function chaveRede(nomeTvl) { return norm(ESPECIAL[nomeTvl] || nomeTvl); }
  function somaVersoes(o) { var s = 0; for (var k in o) if (o[k] > 0) s += o[k]; return s; }

  /* breakdown24h {rede:{versão:valor}} → {chaveRede: total} por defillamaId */
  function porRede(overview) {
    var out = {};
    ((overview && overview.protocols) || []).forEach(function (p) {
      var b = p.breakdown24h; if (!b || p.defillamaId == null) return;
      var m = {}; for (var r in b) m[norm(r)] = (m[norm(r)] || 0) + somaVersoes(b[r]);
      out[String(p.defillamaId)] = m;
    });
    return out;
  }

  /* junta as fontes: uma linha por plataforma × rede [{dex, rede, tvl, vol}] */
  function agrega(lite, dexs) {
    var nomePai = {};
    ((lite && lite.parentProtocols) || []).forEach(function (p) { nomePai[p.id] = p.name; });
    var vol = porRede(dexs), linhas = {};
    ((lite && lite.protocols) || []).forEach(function (p) {
      if (p.category !== "Dexs" || !p.chainTvls || FORA.test(p.name) || FORA.test(nomePai[p.parentProtocol] || "")) return;
      var v = vol[String(p.defillamaId)]; if (!v) return;
      var dex = nomePai[p.parentProtocol] || p.name;
      for (var rede in p.chainTvls) {
        if (rede.indexOf("-") >= 0 || FORA.test(rede) || /^(staking|pool2|borrowed|vesting|treasury)$/i.test(rede)) continue;
        var tvl = p.chainTvls[rede] && p.chainTvls[rede].tvl; if (!(tvl > 0)) continue;
        var chave = dex + "|" + rede;
        var l = linhas[chave] || (linhas[chave] = { dex: dex, rede: rede, tvl: 0, vol: 0 });
        l.tvl += tvl; l.vol += v[chaveRede(rede)] || 0;
      }
    });
    return Object.keys(linhas).map(function (k) { return linhas[k]; });
  }

  /* soma por "dex" ou por "rede", corta TVL < 10 mi, ordena pela razão */
  function ranking(linhas, campo, n) {
    var g = {};
    linhas.forEach(function (l) {
      var x = g[l[campo]] || (g[l[campo]] = { nome: l[campo], tvl: 0, vol: 0 });
      x.tvl += l.tvl; x.vol += l.vol;
    });
    return Object.keys(g).map(function (k) { var x = g[k]; x.razao = x.tvl > 0 ? x.vol / x.tvl : 0; return x; })
      .filter(function (x) { return x.tvl >= TVL_MIN && x.vol > 0; })
      .sort(function (a, b) { return b.razao - a.razao; })
      .slice(0, n || LINHAS);
  }

  var api = { agrega: agrega, ranking: ranking, chaveRede: chaveRede, REDE_SCANNER: REDE_SCANNER, DEX_SCANNER: DEX_SCANNER, TVL_MIN: TVL_MIN };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  /* ---------------- tela ---------------- */
  var doc = raiz.document;
  function el(tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function limpa(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function usd(v) {
    if (v == null || !isFinite(v)) return "—";
    var a = Math.abs(v), f = function (n, d) { return n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }); };
    if (a >= 1e9) return "$" + f(v / 1e9, 2) + " bi";
    if (a >= 1e6) return "$" + f(v / 1e6, 1) + " mi";
    return "$" + f(v / 1e3, 0) + " mil";
  }
  function vezes(v) { return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "×"; }
  function tom(r) { return r >= 1 ? "bom" : r >= 0.3 ? "medio" : "fraco"; }

  function lerCache() {
    try { var c = JSON.parse(raiz.localStorage.getItem(CACHE_KEY) || "null"); if (c && Date.now() - c.t < CACHE_MS) return c; } catch (e) {}
    return null;
  }
  function buscar() {
    var c = lerCache(); if (c) return Promise.resolve(c);
    var get = function (u) { return raiz.AtlasHttp ? raiz.AtlasHttp.getJSON(u) : fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
    return Promise.all([get(URLS.lite), get(URLS.dexs)]).then(function (r) {
      var linhas = agrega(r[0], r[1]);
      var d = { t: Date.now(), plataformas: ranking(linhas, "dex"), redes: ranking(linhas, "rede") };
      try { raiz.localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch (e) {}
      return d;
    });
  }

  /* opts.temPlataforma(nomeScanner) / opts.temRede(nomeScanner) → nº de pools no Scanner
     opts.abrirPlataforma(nome) / opts.abrirRede(nome) → leva ao Descobrir filtrado */
  function montar(caixa, opts) {
    opts = opts || {};
    var carregou = false;
    var cab = el("header", "ef-cab");
    cab.appendChild(el("h2", "ef-titulo", "Eficiência de capital nas últimas 24 h"));
    cab.appendChild(el("p", "ef-sub", "Volume de 24 h ÷ TVL: quanto cada dólar parado girou no dia. Quanto maior, mais taxa cada dólar da pool tende a gerar."));
    var destaques = el("div", "ef-destaques");
    var grade = el("div", "ef-grade", "Carregando dados da DefiLlama…");
    var rodape = el("p", "ef-rodape", "Só entra quem tem TVL de pelo menos US$ 50 mi. É a média de cada plataforma ou rede: cada pool gira diferente, e a nota de cada uma está no Descobrir. Fonte: DefiLlama.");
    caixa.appendChild(cab); caixa.appendChild(destaques); caixa.appendChild(grade); caixa.appendChild(rodape);

    function destaque(rotulo, x, nomeExibe) {
      var d = el("div", "ef-destaque");
      d.appendChild(el("span", null, rotulo));
      d.appendChild(el("b", null, nomeExibe));
      d.appendChild(el("small", "ef-razao " + tom(x.razao), vezes(x.razao) + " o TVL em 24 h"));
      return d;
    }

    function lista(titulo, itens, exibe, paraScanner, conta, abrir) {
      var p = el("section", "ef-lista");
      p.appendChild(el("h3", null, titulo));
      var t = el("table", "ef-tabela"), hd = el("tr");
      [["", ""], ["TVL", "n"], ["Volume 24h", "n"], ["Razão", "n"]].forEach(function (c) { hd.appendChild(el("th", c[1], c[0])); });
      var th = el("thead"); th.appendChild(hd); t.appendChild(th);
      var tb = el("tbody");
      itens.forEach(function (x, i) {
        var tr = el("tr"), nomeS = paraScanner(x.nome), n = conta ? conta(nomeS) : 0;
        var td = el("td", "ef-nome");
        td.appendChild(el("i", null, String(i + 1)));
        td.appendChild(el("b", null, exibe(x.nome)));
        if (n) td.appendChild(el("small", null, n + (n === 1 ? " pool" : " pools")));
        tr.appendChild(td);
        tr.appendChild(el("td", "n", usd(x.tvl)));
        tr.appendChild(el("td", "n", usd(x.vol)));
        tr.appendChild(el("td", "n ef-razao " + tom(x.razao), vezes(x.razao)));
        if (n && abrir) {
          tr.className = "clicavel"; tr.tabIndex = 0; tr.title = "Ver as pools no Descobrir";
          var vai = function () { abrir(nomeS); };
          tr.addEventListener("click", vai);
          tr.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); vai(); } });
        }
        tb.appendChild(tr);
      });
      t.appendChild(tb); p.appendChild(t);
      return p;
    }

    var mesmo = function (x) { return x; };
    var exRede = function (r) { return REDE_EXIBE[r] || r; };
    function carregar() {
      if (carregou) return; carregou = true;
      buscar().then(function (d) {
        limpa(destaques); limpa(grade);
        if (d.plataformas[0]) destaques.appendChild(destaque("Plataforma que mais gira", d.plataformas[0], d.plataformas[0].nome));
        if (d.redes[0]) destaques.appendChild(destaque("Rede que mais gira", d.redes[0], exRede(d.redes[0].nome)));
        var min = Math.round((Date.now() - d.t) / 60000);
        destaques.appendChild(el("span", "ef-hora", "dados de " + (min < 1 ? "agora" : "há " + min + " min")));
        grade.appendChild(lista("Por plataforma", d.plataformas, mesmo, function (x) { return DEX_SCANNER[x] || x; }, opts.temPlataforma, opts.abrirPlataforma));
        grade.appendChild(lista("Por rede", d.redes, exRede, function (x) { return REDE_SCANNER[x] || x; }, opts.temRede, opts.abrirRede));
      }).catch(function () {
        carregou = false; limpa(grade);
        var v = el("div", "ef-vazio", "A DefiLlama não respondeu agora. ");
        var b = el("button", "linkbtn", "Tentar de novo"); b.type = "button"; b.addEventListener("click", carregar);
        v.appendChild(b); grade.appendChild(v);
      });
    }
    return { carregar: carregar };
  }

  raiz.ScannerEficiencia = { montar: montar, agrega: agrega, ranking: ranking };
})(typeof window !== "undefined" ? window : globalThis);
