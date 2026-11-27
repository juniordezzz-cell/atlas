/* ============================================================
   ATLAS · Ferramentas/scanner-pools/capital-dex.js   (28/11/2026)
   Bloco "Onde o capital rende mais" da aba Descobrir.

   Pergunta que responde: em qual DEX, e em qual rede, cada dólar parado
   numa pool trabalha mais? O TVL sozinho engana (o dono, 28/11: "a
   PancakeSwap tem 1,8 bi, então rende mais?"): quem fornece liquidez
   divide as taxas com todo o TVL, então o que importa é o giro.

     Razão 24h   = volume 24h ÷ TVL           (mesma régua do ranking)
     Taxas p/ LP = parte das taxas que vai para quem fornece liquidez
                   (DefiLlama "dailySupplySideRevenue"; o resto vai para o
                   protocolo ou para quem vota, como na Aero)
     Por US$ 1.000 = Taxas p/ LP ÷ TVL × 1.000, por dia; × 365 = ao ano

   Fontes (DefiLlama, grátis, sem chave), uma linha por DEX × rede:
     TVL     lite/protocols2  (chainTvls de cada versão; parentProtocols dá
                               o nome da DEX: Uniswap V3 + V4 = Uniswap)
     Volume  overview/dexs    (breakdown24h por rede)
     Taxas   overview/fees?dataType=dailySupplySideRevenue

   As três falam de rede com nomes diferentes ("BSC" no TVL, "bsc" no
   volume; "OP Mainnet" e "optimism"); chaveRede() junta. O Scanner chama
   a mesma rede de "BNB Chain": REDE_SCANNER faz a ponte para o clique,
   que filtra a tabela de pools pela DEX e pela rede da linha.

   Carrega só quando o bloco é aberto e guarda o resultado por 1 hora.
   ============================================================ */
(function (raiz) {
  "use strict";

  var TVL_MIN = 10e6;                 // abaixo disso a razão vira ruído
  var CACHE_KEY = "atlas.scanner.capitalDex.v1", CACHE_MS = 3600e3;
  var URLS = {
    lite: "https://api.llama.fi/lite/protocols2",
    dexs: "https://api.llama.fi/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true",
    lp: "https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailySupplySideRevenue"
  };
  // nome no TVL (chainTvls) → nome no volume/taxas (breakdown24h), quando a regra geral não basta
  var ESPECIAL = { "OP Mainnet": "optimism", "Hyperliquid L1": "hyperliquid", "Robinhood Chain": "robinhood",
    "ZKsync Era": "era", "Gnosis": "xdai", "Avalanche": "avax" };
  // nome da DefiLlama → nome que o Scanner usa
  var REDE_SCANNER = { "BSC": "BNB Chain", "OP Mainnet": "Optimism", "Hyperliquid L1": "HyperEVM", "Robinhood Chain": "Robinhood" };
  var DEX_SCANNER = { "Curve Finance": "Curve" };
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

  /* junta as três fontes: [{dex, rede, tvl, vol, lp|null, razao, apr|null, por1000|null}] */
  function agrega(lite, dexs, lp) {
    var nomePai = {};
    ((lite && lite.parentProtocols) || []).forEach(function (p) { nomePai[p.id] = p.name; });
    var vol = porRede(dexs), taxa = porRede(lp), linhas = {};
    ((lite && lite.protocols) || []).forEach(function (p) {
      if (p.category !== "Dexs" || !p.chainTvls) return;
      var id = String(p.defillamaId), v = vol[id]; if (!v) return;
      var dex = nomePai[p.parentProtocol] || p.name, t = taxa[id];
      for (var rede in p.chainTvls) {
        if (rede.indexOf("-") >= 0 || /^(staking|pool2|borrowed|vesting|treasury)$/i.test(rede)) continue;
        var tvl = p.chainTvls[rede] && p.chainTvls[rede].tvl; if (!(tvl > 0)) continue;
        var k = chaveRede(rede), chave = dex + "|" + rede;
        var l = linhas[chave] || (linhas[chave] = { dex: dex, rede: rede, tvl: 0, vol: 0, lp: null });
        l.tvl += tvl; l.vol += v[k] || 0;
        if (t) l.lp = (l.lp || 0) + (t[k] || 0);
      }
    });
    return Object.keys(linhas).map(function (k) { return linhas[k]; })
      .filter(function (l) { return l.tvl >= TVL_MIN && l.vol > 0; })
      .map(function (l) {
        l.razao = l.vol / l.tvl;
        l.por1000 = l.lp != null && l.lp > 0 ? l.lp / l.tvl * 1000 : null;
        l.apr = l.por1000 != null ? l.por1000 * 365 / 10 : null;      // % ao ano
        return l;
      })
      .sort(function (a, b) { return b.razao - a.razao; });
  }

  var api = { agrega: agrega, chaveRede: chaveRede, REDE_SCANNER: REDE_SCANNER, DEX_SCANNER: DEX_SCANNER, TVL_MIN: TVL_MIN };
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
    if (a >= 1e3) return "$" + f(v / 1e3, 0) + " mil";
    return "$" + f(v, 2);
  }
  function num(v, d) { return v == null || !isFinite(v) ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }); }

  function lerCache() {
    try { var c = JSON.parse(raiz.localStorage.getItem(CACHE_KEY) || "null"); if (c && Date.now() - c.t < CACHE_MS) return c; } catch (e) {}
    return null;
  }
  function gravaCache(linhas) { try { raiz.localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), linhas: linhas })); } catch (e) {} }

  function buscar() {
    var c = lerCache(); if (c) return Promise.resolve(c);
    var get = function (u) { return raiz.AtlasHttp ? raiz.AtlasHttp.getJSON(u) : fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
    return Promise.all([get(URLS.lite), get(URLS.dexs), get(URLS.lp).catch(function () { return null; })]).then(function (r) {
      var linhas = agrega(r[0], r[1], r[2]);
      gravaCache(linhas);
      return { t: Date.now(), linhas: linhas };
    });
  }

  function montar(caixa, opts) {
    opts = opts || {};
    var redeSel = "Todas", ordem = "razao", dados = null, carregou = false;
    var topo = el("div", "cx-topo");
    var selRede = el("select", "cx-rede"); selRede.setAttribute("aria-label", "Rede");
    selRede.addEventListener("change", function () { redeSel = selRede.value; desenha(); });
    var selOrdem = el("select", "cx-ordem"); selOrdem.setAttribute("aria-label", "Ordenar por");
    [["razao", "Ordenar pela razão 24h"], ["apr", "Ordenar pelo rendimento p/ LP"], ["tvl", "Ordenar pelo TVL"]].forEach(function (o) {
      var op = el("option", null, o[1]); op.value = o[0]; selOrdem.appendChild(op);
    });
    selOrdem.addEventListener("change", function () { ordem = selOrdem.value; desenha(); });
    var nota = el("span", "cx-nota");
    topo.appendChild(selRede); topo.appendChild(selOrdem); topo.appendChild(nota);
    var corpo = el("div", "cx-corpo", "Carregando dados da DefiLlama…");
    var rodape = el("p", "cx-rodape");
    rodape.textContent = "Razão 24h = volume ÷ TVL: quanto cada dólar da DEX girou no dia. Taxas p/ LP = a parte das taxas que fica com quem fornece liquidez " +
      "(na Aero ela vai para quem vota, por isso é baixa; o LP recebe AERO). Por US$ 1.000 é a média da DEX na rede: cada pool rende diferente, " +
      "veja a nota delas na tabela. DEX com TVL acima de US$ 10 mi. Fonte: DefiLlama.";
    caixa.appendChild(topo); caixa.appendChild(corpo); caixa.appendChild(rodape);

    function opcoesRede() {
      var conta = {};
      dados.linhas.forEach(function (l) { conta[l.rede] = (conta[l.rede] || 0) + l.tvl; });
      var redes = Object.keys(conta).sort(function (a, b) { return conta[b] - conta[a]; }).slice(0, 12);
      limpa(selRede);
      [["Todas", "Todas as redes"]].concat(redes.map(function (r) { return [r, REDE_EXIBE[r] || r]; })).forEach(function (o) {
        var op = el("option", null, o[1]); op.value = o[0]; if (o[0] === redeSel) op.selected = true; selRede.appendChild(op);
      });
    }

    function desenha() {
      var ls = dados.linhas.filter(function (l) { return redeSel === "Todas" || l.rede === redeSel; })
        .sort(function (a, b) { return (b[ordem] == null ? -1 : b[ordem]) - (a[ordem] == null ? -1 : a[ordem]); }).slice(0, 15);
      limpa(corpo);
      if (!ls.length) { corpo.appendChild(el("div", "cx-vazio", "Nenhuma DEX com TVL acima de US$ 10 mi nesta rede.")); return; }
      var tw = el("div", "cx-rolagem"), tb = el("table", "cx-tabela");
      var th = el("tr");
      [["DEX", ""], ["Rede", ""], ["TVL", "n"], ["Volume 24h", "n"], ["Razão 24h", "n"], ["Taxas p/ LP 24h", "n"], ["Por US$ 1.000", "n"]].forEach(function (c) {
        th.appendChild(el("th", c[1], c[0]));
      });
      var thead = el("thead"); thead.appendChild(th); tb.appendChild(thead);
      var tbody = el("tbody");
      ls.forEach(function (l) {
        var tr = el("tr");
        var dexS = DEX_SCANNER[l.dex] || l.dex, redeS = REDE_SCANNER[l.rede] || l.rede;
        var noScanner = opts.temPools ? opts.temPools(dexS, redeS) : 0;
        var dexTd = el("td", "cx-dex");
        dexTd.appendChild(el("b", null, l.dex));
        if (noScanner) dexTd.appendChild(el("small", null, noScanner + (noScanner === 1 ? " pool no Scanner" : " pools no Scanner")));
        tr.appendChild(dexTd);
        tr.appendChild(el("td", null, REDE_EXIBE[l.rede] || l.rede));
        tr.appendChild(el("td", "n", usd(l.tvl)));
        tr.appendChild(el("td", "n", usd(l.vol)));
        tr.appendChild(el("td", "n cx-razao " + (l.razao >= 1 ? "bom" : l.razao >= 0.3 ? "medio" : "fraco"), num(l.razao, 2) + "×"));
        tr.appendChild(el("td", "n", l.lp == null ? "—" : usd(l.lp)));
        var r = el("td", "n cx-rende");
        if (l.por1000 == null) { r.textContent = "—"; r.title = "A DefiLlama não informa a parte das taxas que vai para o LP nesta DEX."; }
        else { r.appendChild(el("b", null, usd(l.por1000) + "/dia")); r.appendChild(el("small", null, num(l.apr, 1) + "% ao ano")); }
        tr.appendChild(r);
        if (noScanner && opts.aoEscolher) {
          tr.className = "clicavel"; tr.tabIndex = 0;
          tr.title = "Mostrar na tabela abaixo as pools desta DEX nesta rede";
          var vai = function () { opts.aoEscolher(dexS, redeS); };
          tr.addEventListener("click", vai);
          tr.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); vai(); } });
        }
        tbody.appendChild(tr);
      });
      tb.appendChild(tbody); tw.appendChild(tb); corpo.appendChild(tw);
    }

    function carregar() {
      if (carregou) return; carregou = true;
      buscar().then(function (d) {
        dados = d; opcoesRede(); desenha();
        var min = Math.round((Date.now() - d.t) / 60000);
        nota.textContent = "15 primeiras · dados de " + (min < 1 ? "agora" : "há " + min + " min");
      }).catch(function () {
        carregou = false;
        limpa(corpo);
        var v = el("div", "cx-vazio", "A DefiLlama não respondeu agora. ");
        var b = el("button", "linkbtn", "Tentar de novo"); b.type = "button"; b.addEventListener("click", carregar);
        v.appendChild(b); corpo.appendChild(v);
      });
    }
    return { carregar: carregar };
  }

  raiz.ScannerCapital = { montar: montar, agrega: agrega };
})(typeof window !== "undefined" ? window : globalThis);
