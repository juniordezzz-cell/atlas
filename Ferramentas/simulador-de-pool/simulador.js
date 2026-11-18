/* ============================================================
   Simulador de Pools de Liquidez — ferramenta própria (17/11/2026)
   ------------------------------------------------------------
   Nasceu como aba do Scanner. A pedido do dono, virou ferramenta
   separada e maior. Pega uma pool REAL (rede, plataforma, taxa) que
   passou nas regras do Scanner e responde:
     · quanto ela teria rendido com esta faixa e este dinheiro?
     · como outras larguras de faixa teriam ido no mesmo período?
     · em qual plataforma do mesmo par teria rendido mais?
     · se o preço terminar em X, quanto a posição vale contra segurar?

   Dados:
     · pools, TVL, taxa, volume e regras: as mesmas do Scanner, lidas pelo
       ../scanner-pools/servidor.js (Supabase + trilhoEfetivo). As regras
       vigentes (spec de 26/09) não mudam: pool `oculta` não aparece.
     · velas da própria pool na GeckoTerminal: diárias (180) ou horárias
       (168), em dólar (preço do token base e volume) e no token de
       cotação (preço do base no token de cotação).

   LIMITE (escrito também na tela): a fatia da posição nas taxas é
   estimada pelo TVL total da pool (o de hoje) ajustado pela concentração
   da faixa. As fontes públicas não dão a liquidez preço a preço (ticks):
   em pools onde todo mundo concentra no mesmo preço, a taxa estimada
   pode ficar acima da real.

   Registro: docs/simulador-de-pool-2026-11-17.md
   ============================================================ */
(function () {
  "use strict";

  /* rótulo da rede no Scanner → slug da GeckoTerminal (mesmo mapa do coletor, config.py) */
  var REDE = { "Solana": "solana", "Base": "base", "Arbitrum": "arbitrum", "BNB Chain": "bsc", "Ethereum": "eth",
    "Optimism": "optimism", "Polygon": "polygon_pos", "Avalanche": "avax", "Sui": "sui-network",
    "HyperEVM": "hyperevm", "Robinhood": "robinhood", "Robinhood Chain": "robinhood" };
  var EMBRULHADO = { WETH: "ETH", WSOL: "SOL", WBTC: "BTC", CBBTC: "BTC", WBNB: "BNB", WAVAX: "AVAX", WPOL: "POL", WMATIC: "POL", WHYPE: "HYPE",
    /* versões em ponte da mesma moeda: mesmo mercado para quem monta a pool */
    "USDC.E": "USDC", USDBC: "USDC", "USDT.E": "USDT", USDT0: "USDT", "WETH.E": "ETH" };
  /* tempo gráfico: velas por dia e períodos do teste (em dias) */
  var TEMPO = {
    day: { rot: "Diário", porDia: 1, limite: 180, periodos: [7, 30, 90, 180], padrao: 30 },
    hour: { rot: "Por hora", porDia: 24, limite: 168, periodos: [1, 3, 7], padrao: 7 }
  };

  var SIM = { id: null, busca: "", a: 0, b: 0, dep: 1000, tempo: "day", dias: 30, dados: null, carregando: false, erro: "",
    rank: null, rankCarregando: false, pedido: 0 };
  var BASE = { pools: [], carregado: false, erro: "", doCache: false, em: 0 };
  var cache = {};

  /* ---------- utilidades ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function dec(p) { var a = Math.abs(p); if (!a) return 2; return a >= 10 ? 2 : a >= 1 ? 3 : a >= 0.01 ? 4 : Math.min(10, Math.ceil(-Math.log10(a)) + 3); }
  function fp(p) { return isFinite(p) ? p.toLocaleString("pt-BR", { minimumFractionDigits: dec(p), maximumFractionDigits: dec(p) }) : "—"; }
  function fu(v) { return isFinite(v) ? (v < -0.005 ? "−" : "") + "US$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"; }
  function fuc(v) { return isFinite(v) ? "US$ " + (Math.abs(v) >= 1e6 ? (v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi" : Math.round(v).toLocaleString("pt-BR")) : "—"; }
  function fpct(v) { return isFinite(v) ? (v > 0.05 ? "+" : v < -0.05 ? "−" : "") + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%" : "—"; }
  function num(s) { var t = String(s == null ? "" : s).trim().replace(/\s/g, ""); if (/,/.test(t)) t = t.replace(/\./g, "").replace(",", "."); var v = parseFloat(t); return isFinite(v) ? v : NaN; }
  function campo(v) { return isFinite(v) ? String(+v.toPrecision(6)).replace(".", ",") : ""; }
  function cls(v) { return v >= 0 ? "sim-pos" : "sim-neg"; }
  function normSym(t) { t = String(t || "").toUpperCase(); return EMBRULHADO[t] || t; }

  /* ---------- pools do Scanner ---------- */
  function todas() { return BASE.pools; }
  function elegivel(p) { return !!p && p._trilho !== "oculta" && Number(p.tvl) >= 100000; }
  function pendente(p) { return p._trilho === "caca"; }
  function endereco(p) { return window.ScannerServidor && ScannerServidor.enderecoPool ? ScannerServidor.enderecoPool(p) : null; }
  function simulavel(p) { return !!(REDE[p.network] && endereco(p)); }
  function tokens(p) {
    return String(p.pool || "").replace(/\s+\d[\d.,]*\s*%.*$/, "").split(/[\/\-]/)
      .map(function (t) { return t.trim().split(/\s+/)[0].toUpperCase(); }).filter(Boolean).map(normSym);
  }
  function chavePar(p) { return tokens(p).slice().sort().join("/"); }
  function feeDe(p) { return Number(p.fee) > 0 ? Number(p.fee) : 0; }
  function volDe(p) { var v = Number(p.vol24h); if (v > 0) return v; var s = Number(p.vol7d); return s > 0 ? s / 7 : 0; }
  function poolPorId(id) { return todas().find(function (p) { return p.id === id; }) || null; }

  function carregarPools() {
    var S = window.ScannerServidor;
    if (!S) { BASE.erro = "A leitura das pools do Scanner não carregou."; return Promise.resolve(); }
    var lista = S.lerTokens(), decisoes = S.lerDecisoes(), marcas = S.lerMarcas();
    return S.carregar().then(function (d) {
      var ps = S.semDuplicatas((d.pools || []).map(function (r) { return S.paraPool(r, marcas[r.id]); }));
      ps.forEach(function (p) { p._trilho = S.trilhoEfetivo(p, lista, decisoes); });
      BASE.pools = ps; BASE.carregado = true; BASE.doCache = !!d.doCache; BASE.em = d.em || Date.now(); BASE.erro = "";
    }).catch(function () { BASE.carregado = true; BASE.erro = "Não foi possível ler as pools do Scanner agora. Tente de novo em instantes."; });
  }
  /* ★ Radar: a mesma marca que o Scanner lê (marcas por sid) */
  function alternarRadar(p) {
    var S = window.ScannerServidor; if (!S || !p.sid) return;
    var m = S.lerMarcas(), k = m[p.sid] || { fav: false, level: null, notes: "" };
    k.fav = !k.fav; p.fav = k.fav;
    if (k.fav || k.level || (k.notes && k.notes.trim())) m[p.sid] = k; else delete m[p.sid];
    S.gravarMarcas(m);
  }

  /* ---------- matemática da pool concentrada (a mesma das Estratégias) ---------- */
  function clAmt(L, a, b, p) { var sa = Math.sqrt(a), sb = Math.sqrt(b), sp = Math.sqrt(Math.min(Math.max(p, a), b)); return { x: L * (1 / sp - 1 / sb), y: L * (sp - sa) }; }
  /* quanto a faixa concentra o capital em relação à faixa infinita */
  function concentracao(a, b) { return 1 / (1 - Math.pow(a / b, 1 / 4)); }
  /* fração da vela que o preço passou dentro da faixa (aproximação pela máxima e mínima) */
  function cobertura(c, a, b) {
    if (!(c.h > c.l)) return c.c >= a && c.c <= b ? 1 : 0;
    var lo = Math.max(c.l, a), hi = Math.min(c.h, b);
    return hi > lo ? (hi - lo) / (c.h - c.l) : 0;
  }

  /* ---------- dados: velas da pool na GeckoTerminal ---------- */
  function ohlcv(p, tempo) {
    var rede = REDE[p.network], end = endereco(p), T = TEMPO[tempo];
    if (!rede || !end) return Promise.reject(new Error("sem-endereco"));
    var k = rede + ":" + end + ":" + tempo;
    if (cache[k] && Date.now() - cache[k].t < 10 * 60e3) return Promise.resolve(cache[k].d);
    var url = "https://api.geckoterminal.com/api/v2/networks/" + rede + "/pools/" + encodeURIComponent(end) + "/ohlcv/" + tempo + "?aggregate=1&limit=" + T.limite;
    var op = { ttl: 0, timeout: 15000, retries: 1 };
    return Promise.all([AtlasHttp.getJSON(url + "&currency=usd", op), AtlasHttp.getJSON(url + "&currency=token", op)]).then(function (r) {
      var u = (((r[0] || {}).data || {}).attributes || {}).ohlcv_list || [];
      var t = (((r[1] || {}).data || {}).attributes || {}).ohlcv_list || [];
      var meta = (r[1] || {}).meta || (r[0] || {}).meta || {};
      var porTs = {}; u.forEach(function (x) { porTs[x[0]] = x; });
      var linhas = [];
      t.forEach(function (x) {
        var y = porTs[x[0]]; if (!y) return;
        var o = +x[1], h = +x[2], l = +x[3], c = +x[4], bu = +y[4], vol = +y[5];
        if (!(o > 0 && h > 0 && l > 0 && c > 0 && bu > 0)) return;
        linhas.push({ t: x[0] * 1000, o: o, h: h, l: l, c: c, bu: bu, qu: bu / c, vol: vol > 0 ? vol : 0 });
      });
      linhas.sort(function (a, b) { return a.t - b.t; });
      var base = String(((meta.base || {}).symbol) || ""), quote = String(((meta.quote || {}).symbol) || "");
      var d = { linhas: linhas, tempo: tempo, base: normSym(base) || tokens(p)[0] || "A", quote: normSym(quote) || tokens(p)[1] || "B" };
      if (linhas.length < 8) throw new Error("poucos-dados");
      cache[k] = { t: Date.now(), d: d };
      return d;
    });
  }
  /* mesma pool com os tokens na ordem trocada (USDC/SOL em vez de SOL/USDC) */
  function inverter(d) {
    return { base: d.quote, quote: d.base, tempo: d.tempo, linhas: d.linhas.map(function (x) {
      return { t: x.t, o: 1 / x.o, h: 1 / x.l, l: 1 / x.h, c: 1 / x.c, bu: x.qu, qu: x.bu, vol: x.vol }; }) };
  }

  /* ---------- teste no histórico: n = número de velas ---------- */
  function testar(p, d, a, b, dep, n) {
    var ls = d.linhas.slice(-(n + 1));
    if (ls.length < 3 || !(a > 0 && b > a && dep > 0)) return null;
    var c0 = ls[0], p0 = c0.c, depQ = dep / c0.qu;
    var u = clAmt(1, a, b, p0), L = depQ / (u.x * p0 + u.y), e = clAmt(L, a, b, p0);
    var ef = concentracao(a, b), tvl = Number(p.tvl) || 0, fee = feeDe(p) / 100;
    var taxas = 0, dentro = 0, serie = [{ t: c0.t, pool: dep, semTaxa: dep, segurar: dep }];
    for (var i = 1; i < ls.length; i++) {
      var k = ls[i], v = clAmt(L, a, b, k.c), val = v.x * k.bu + v.y * k.qu;
      var f = cobertura(k, a, b); dentro += f;
      var fatia = tvl > 0 ? Math.min(1, val * ef / tvl) : 0;
      taxas += fee * k.vol * fatia * f;
      serie.push({ t: k.t, pool: val + taxas, semTaxa: val, segurar: e.x * k.bu + e.y * k.qu });
    }
    var fim = serie[serie.length - 1], ult = ls[ls.length - 1];
    return { taxas: taxas, semTaxa: fim.semTaxa, segurar: fim.segurar, total: fim.pool, dep: dep, dentro: dentro / (ls.length - 1),
      velas: ls.length - 1, serie: serie, p0: p0, pFim: ult.c, inicio: c0.t,
      saida: ult.c < a ? "abaixo" : ult.c > b ? "acima" : "dentro" };
  }
  function estimativaHoje(p, d, a, b, dep) {
    var pAgora = d.linhas[d.linhas.length - 1].c, fee = feeDe(p) / 100, tvl = Number(p.tvl) || 0;
    var dentro = pAgora >= a && pAgora <= b, fatia = tvl > 0 ? Math.min(1, dep * concentracao(a, b) / tvl) : 0;
    var dia = dentro ? fee * volDe(p) * fatia : 0;
    return { dia: dia, apr: dep > 0 ? dia * 365 / dep * 100 : 0, dentro: dentro, fatia: fatia, pAgora: pAgora };
  }
  /* oscilação típica por DIA (log), qualquer que seja o tempo gráfico */
  function volatilidadeDia(d) {
    var porDia = TEMPO[d.tempo] ? TEMPO[d.tempo].porDia : 1;
    var ls = d.linhas.slice(-Math.min(d.linhas.length, 60 * porDia)), r = [];
    for (var i = 1; i < ls.length; i++) r.push(Math.log(ls[i].c / ls[i - 1].c));
    if (r.length < 5) return 0.05;
    var m = r.reduce(function (s, v) { return s + v; }, 0) / r.length;
    return Math.sqrt(r.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0) / (r.length - 1)) * Math.sqrt(porDia);
  }
  function nVelas() { return SIM.dias * TEMPO[SIM.tempo].porDia; }

  /* ---------- montagem da página ---------- */
  function montar() {
    $("simDias").addEventListener("click", function (ev) { var b = ev.target.closest("button[data-d]"); if (!b) return; SIM.dias = +b.dataset.d; SIM.rank = null; desenharTudo(); });
    $("simTempo").addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-t]"); if (!b || b.dataset.t === SIM.tempo) return;
      SIM.tempo = b.dataset.t; SIM.dias = TEMPO[SIM.tempo].padrao; SIM.rank = null; recarregar();
    });
    $("simBusca").addEventListener("input", function () { SIM.busca = this.value; renderLista(); });
    $("simLista").addEventListener("click", function (ev) { var b = ev.target.closest("button[data-id]"); if (b) escolher(+b.dataset.id); });
    ligarArraste();
    new ResizeObserver(function () { desenharGrafico(); desenharMini(); }).observe($("simChart"));
  }

  function lista() {
    var q = SIM.busca.trim().toUpperCase().replace(/\s+/g, "");
    var ps = todas().filter(function (p) { return elegivel(p) && simulavel(p); });
    if (q) {
      var partes = q.split(/[\/\-]/).filter(Boolean).map(normSym);
      ps = ps.filter(function (p) { var t = tokens(p); return partes.every(function (x) { return t.indexOf(x) !== -1; }); });
    }
    return ps.sort(function (a, b) { return (Number(b.tvl) || 0) - (Number(a.tvl) || 0); }).slice(0, 120);
  }
  function renderLista() {
    var ps = lista(), el = $("simLista"); if (!el) return;
    $("simContagem").textContent = BASE.carregado ? ps.length + (ps.length === 1 ? " pool" : " pools") : "";
    if (!BASE.carregado) { el.innerHTML = '<div class="sim-vazio">Lendo as pools do Scanner…</div>'; return; }
    if (BASE.erro && !todas().length) { el.innerHTML = '<div class="sim-vazio">' + esc(BASE.erro) + "</div>"; return; }
    if (!ps.length) { el.innerHTML = '<div class="sim-vazio">Nenhuma pool com esse token entre as que passaram nas regras do Scanner. Tente outro token, ou o par sem o W (ETH em vez de WETH).</div>'; return; }
    el.innerHTML = ps.map(function (p) {
      return '<button type="button" class="sim-pool' + (p.id === SIM.id ? " on" : "") + '" data-id="' + p.id + '">' +
        "<b>" + esc(p.pool) + "</b><em>" + fuc(p.tvl) + "</em>" +
        "<span>" + esc(p.platform) + " · " + esc(p.network) + (feeDe(p) ? " · " + feeDe(p).toLocaleString("pt-BR", { maximumFractionDigits: 4 }) + "%" : "") + "</span>" +
        (pendente(p) ? '<em class="pend">pendente</em>' : "<em></em>") + "</button>";
    }).join("");
  }
  function renderStatus() {
    var el = $("simFonte"); if (!el) return;
    if (!BASE.carregado) { el.textContent = "Lendo as pools do Scanner…"; return; }
    var min = Math.max(1, Math.round((Date.now() - BASE.em) / 60000));
    el.textContent = BASE.erro && !todas().length ? BASE.erro
      : "Pools do Scanner " + (BASE.doCache ? "(cópia guardada) " : "") + "· atualizado há " + (min < 60 ? min + " min" : Math.round(min / 60) + " h") + " · histórico da GeckoTerminal";
  }

  function escolher(id) {
    var p = poolPorId(id); if (!p) return;
    /* a mesma pool de novo: mantém a faixa que a pessoa montou */
    if (id === SIM.id && SIM.dados && !SIM.erro) { renderLista(); desenharTudo(); return; }
    SIM.id = id; SIM.dados = null; SIM.a = 0; SIM.b = 0;
    try { history.replaceState(null, "", "?pool=" + encodeURIComponent(p.sid || "")); } catch (e) { /* sem history: segue */ }
    renderLista(); recarregar();
  }
  function recarregar() {
    var p = poolPorId(SIM.id); if (!p) { desenharTudo(); return; }
    SIM.erro = ""; SIM.rank = null; SIM.carregando = true;
    var meu = ++SIM.pedido; desenharTudo();
    ohlcv(p, SIM.tempo).then(function (d) {
      if (meu !== SIM.pedido) return;
      SIM.dados = d; SIM.carregando = false;
      var agora = d.linhas[d.linhas.length - 1].c;
      /* faixa nova só quando não há uma faixa válida perto do preço */
      if (!(SIM.a > 0 && SIM.b > SIM.a && SIM.b > agora / 3 && SIM.a < agora * 3)) { SIM.a = +(agora / 1.1).toPrecision(6); SIM.b = +(agora * 1.1).toPrecision(6); }
      desenharTudo();
    }).catch(function (e) {
      if (meu !== SIM.pedido) return;
      SIM.carregando = false; SIM.dados = null;
      SIM.erro = e && e.message === "poucos-dados" ? "A GeckoTerminal tem pouco histórico desta pool neste tempo gráfico. Tente o diário ou outra pool do mesmo par."
        : e && e.message === "sem-endereco" ? "Esta pool não tem endereço conhecido, então não dá para buscar o histórico."
        : "Não foi possível buscar o histórico desta pool agora. Tente de novo em instantes.";
      desenharTudo();
    });
  }

  function presets() {
    var d = SIM.dados; if (!d) return [];
    var p = d.linhas[d.linhas.length - 1].c, s = volatilidadeDia(d), w7 = Math.max(0.01, s * Math.sqrt(7)), w30 = Math.max(0.02, s * Math.sqrt(30));
    return [["±5%", p / 1.05, p * 1.05], ["±10%", p / 1.1, p * 1.1], ["±20%", p / 1.2, p * 1.2], ["±50%", p / 1.5, p * 1.5],
      ["1 semana", p * Math.exp(-w7), p * Math.exp(w7)], ["1 mês", p * Math.exp(-w30), p * Math.exp(w30)], ["Cheia", p / 1e6, p * 1e6]];
  }

  function desenharTudo() {
    var p = poolPorId(SIM.id), T = TEMPO[SIM.tempo];
    $("simTempo").innerHTML = Object.keys(TEMPO).map(function (k) { return '<button type="button" data-t="' + k + '" class="' + (k === SIM.tempo ? "on" : "") + '">' + TEMPO[k].rot + "</button>"; }).join("");
    $("simDias").innerHTML = T.periodos.map(function (d) { return '<button type="button" data-d="' + d + '" class="' + (d === SIM.dias ? "on" : "") + '">' + d + (d === 1 ? " dia" : " dias") + "</button>"; }).join("");
    var cab = $("simCab"), dir = $("simDir");
    renderStatus();
    if (!p) {
      cab.innerHTML = "<b>Escolha uma pool à esquerda</b><span>O gráfico da pool e o teste no histórico aparecem aqui.</span>";
      dir.innerHTML = '<h3>Como funciona</h3><ol class="sim-passos"><li>Escolha uma pool real: rede, plataforma e taxa.</li><li>Arraste a faixa no gráfico ou use um atalho.</li><li>Veja quanto teria rendido no período, como outras faixas teriam ido e em qual plataforma do mesmo par renderia mais.</li></ol>' +
        '<p class="sim-nota">Quer entender o conceito antes? Abra as <a href="../estrategia-de-pool/index.html">Estratégias de Pools de Liquidez</a>.</p>';
      $("simRank").innerHTML = ""; $("simFaixas").innerHTML = ""; $("simCen").innerHTML = ""; desenharGrafico(); return;
    }
    var L = window.ScannerServidor && p.servidor ? ScannerServidor.linkPool(p) : null;
    cab.innerHTML = "<b>" + esc(p.pool) + "</b><span>" + esc(p.platform) + " · " + esc(p.network) + (feeDe(p) ? " · taxa " + feeDe(p).toLocaleString("pt-BR", { maximumFractionDigits: 4 }) + "%" : " · taxa não informada") +
      " · TVL " + fuc(p.tvl) + " · volume/dia " + fuc(volDe(p)) + "</span>" +
      (L ? '<a href="' + esc(L.url) + '" target="_blank" rel="noopener noreferrer">Abrir na ' + esc(L.onde) + " ↗</a>" : "");
    if (SIM.carregando || SIM.erro || !SIM.dados) {
      dir.innerHTML = "<h3>Simulação</h3>" + (SIM.carregando ? '<p class="sim-nota">Buscando o histórico da pool na GeckoTerminal…</p>' : '<p class="sim-aviso">' + esc(SIM.erro || "Sem dados.") + "</p>");
      $("simRank").innerHTML = ""; $("simFaixas").innerHTML = ""; $("simCen").innerHTML = ""; desenharGrafico(); return;
    }
    renderDireita(p); renderFaixas(p); renderCenarios(p); renderRank(p); desenharGrafico();
  }

  function renderDireita(p) {
    var d = SIM.dados, dir = $("simDir"), a = SIM.a, b = SIM.b;
    var hoje = estimativaHoje(p, d, a, b, SIM.dep), t = testar(p, d, a, b, SIM.dep, nVelas());
    var html = "<h3>Simulação</h3>" +
      (pendente(p) ? '<p class="sim-aviso">Esta pool está em <b>Pendentes de análise</b> no Scanner. Confira o token antes de colocar dinheiro.</p>' : "") +
      (!feeDe(p) ? '<p class="sim-aviso">A fonte não informou a taxa desta pool. Sem taxa, a simulação mostra só a troca de tokens.</p>' : "") +
      '<div class="sim-campos">' +
        '<label>Depósito (US$)<input id="simDep" inputmode="decimal" value="' + campo(SIM.dep) + '"></label>' +
        '<label>Preço hoje<input value="' + esc(fp(hoje.pAgora)) + '" disabled></label>' +
        '<label>Mín da faixa<input id="simA" inputmode="decimal" value="' + campo(a) + '"></label>' +
        '<label>Máx da faixa<input id="simB" inputmode="decimal" value="' + campo(b) + '"></label>' +
      "</div>" +
      '<p class="sim-nota">Preço = ' + esc(d.base) + " em " + esc(d.quote) + ". Faixa de " + fpct((a / hoje.pAgora - 1) * 100) + " a " + fpct((b / hoje.pAgora - 1) * 100) + " do preço de hoje.</p>" +
      '<div class="sim-seg" id="simPre">' + presets().map(function (x, i) { return '<button type="button" data-i="' + i + '">' + x[0] + "</button>"; }).join("") + "</div>" +
      '<p class="sim-nota">"1 semana" e "1 mês": faixa do tamanho da oscilação real da pool nesse prazo.</p>' +
      "<h3>Hoje</h3><div class=\"sim-kpis\">" +
        '<div class="sim-kpi destaque"><span>Taxa estimada</span><b>' + fu(hoje.dia) + '/dia</b><em>' + (hoje.dentro ? "com o preço dentro da faixa" : "preço fora da faixa: não rende") + "</em></div>" +
        '<div class="sim-kpi"><span>APR estimado</span><b>' + hoje.apr.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%</b><em>concentração " + concentracao(a, b).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "×</em></div>" +
      "</div>";
    if (t) {
      var res = (t.total / t.dep - 1) * 100, vsH = t.total - t.segurar;
      html += "<h3>Teste: últimos " + SIM.dias + (SIM.dias === 1 ? " dia" : " dias") + "</h3><div class=\"sim-kpis\">" +
        '<div class="sim-kpi"><span>Taxas</span><b class="sim-pos">' + fu(t.taxas) + "</b></div>" +
        '<div class="sim-kpi"><span>Dentro da faixa</span><b>' + Math.round(t.dentro * 100) + "%</b><em>do tempo</em></div>" +
        '<div class="sim-kpi"><span>Posição sem taxa</span><b>' + fu(t.semTaxa) + "</b></div>" +
        '<div class="sim-kpi"><span>Só segurar</span><b>' + fu(t.segurar) + "</b></div>" +
        '<div class="sim-kpi destaque" style="grid-column:1/-1"><span>Resultado com taxas</span><b>' + fu(t.total) + ' <span class="' + cls(res) + '">' + fpct(res) + "</span></b><em>" +
          (vsH >= 0 ? '<span class="sim-pos">' + fu(vsH) + "</span> à frente de só segurar" : '<span class="sim-neg">' + fu(-vsH) + "</span> atrás de só segurar") + "</em></div>" +
      "</div>" +
      '<canvas class="sim-mini" id="simMini" aria-label="Valor da posição ao longo do teste"></canvas>' +
      '<div class="sim-legenda"><span><i style="background:#b197fc"></i>pool com taxas</span><span><i style="background:#8a94a8"></i>só segurar</span><span><i style="background:#2ec785"></i>depósito</span></div>' +
      '<p class="sim-nota">Entrada a ' + fp(t.p0) + " em " + new Date(t.inicio).toLocaleDateString("pt-BR") + ", agora a " + fp(t.pFim) + ". " +
        (t.saida === "dentro" ? "O preço está dentro da faixa." : t.saida === "abaixo" ? "O preço saiu por baixo: a posição virou toda " + esc(d.base) + " e parou de render." : "O preço saiu por cima: a posição virou toda " + esc(d.quote) + " e parou de render.") + "</p>";
    }
    html += '<p class="sim-limite">Estimativa. A fatia nas taxas sai do TVL total da pool (' + fuc(p.tvl) + ", o de hoje) ajustado pela concentração da faixa. As fontes públicas não mostram a liquidez preço a preço: em pools onde todo mundo concentra no mesmo preço, a taxa real pode ser menor.</p>" +
      '<div class="sim-linha"><button type="button" class="sim-btn" id="simFav">' + (p.fav ? "★ No Radar do Scanner" : "☆ Acompanhar no Radar") + '</button><a class="sim-btn" href="../estrategia-de-pool/index.html">Entender esta faixa ↗</a></div>';
    dir.innerHTML = html;
    $("simDep").addEventListener("change", function () { var v = num(this.value); if (v > 0) { SIM.dep = v; SIM.rank = null; desenharTudo(); } });
    $("simA").addEventListener("change", function () { var v = num(this.value); if (v > 0 && v < SIM.b) { SIM.a = v; SIM.rank = null; desenharTudo(); } });
    $("simB").addEventListener("change", function () { var v = num(this.value); if (v > SIM.a) { SIM.b = v; SIM.rank = null; desenharTudo(); } });
    $("simPre").addEventListener("click", function (ev) { var bt = ev.target.closest("button[data-i]"); if (!bt) return; var x = presets()[+bt.dataset.i]; SIM.a = +x[1].toPrecision(6); SIM.b = +x[2].toPrecision(6); SIM.rank = null; desenharTudo(); });
    $("simFav").addEventListener("click", function () { alternarRadar(p); renderDireita(p); });
    desenharMini();
  }

  /* ---------- outras faixas no mesmo período (ensina o efeito da largura) ---------- */
  function renderFaixas(p) {
    var d = SIM.dados, el = $("simFaixas"), n = nVelas();
    var linhas = [["Sua faixa", SIM.a, SIM.b, true]].concat(presets().map(function (x) { return [x[0], x[1], x[2], false]; }))
      .map(function (x) { return { nome: x[0], a: x[1], b: x[2], sua: x[3], t: testar(p, d, x[1], x[2], SIM.dep, n) }; }).filter(function (x) { return x.t; });
    if (!linhas.length) { el.innerHTML = ""; return; }
    var melhor = linhas.reduce(function (m, x) { return x.t.total > m.t.total ? x : m; }, linhas[0]);
    el.innerHTML = "<h3>Outras larguras de faixa · mesmo período, mesmo dinheiro</h3><div class=\"sim-rank-wrap\"><table class=\"sim-rank\"><thead><tr><th>Faixa</th><th>Mín – máx</th><th>Na faixa</th><th>Taxas</th><th>Resultado</th><th>vs segurar</th></tr></thead><tbody>" +
      linhas.map(function (x) {
        var t = x.t, vs = t.total - t.segurar, cheia = x.nome === "Cheia";
        return '<tr class="' + (x.sua ? "on" : "") + '"><td>' + esc(x.nome) + (x === melhor ? ' <span class="sim-tag">melhor</span>' : "") + "</td><td>" + (cheia ? "todos os preços" : fp(x.a) + " – " + fp(x.b)) + "</td><td>" + Math.round(t.dentro * 100) + "%</td><td>" + fu(t.taxas) +
          '</td><td class="' + cls(t.total - t.dep) + '">' + fpct((t.total / t.dep - 1) * 100) + '</td><td class="' + cls(vs) + '">' + (vs >= 0 ? "+" : "−") + fu(Math.abs(vs)).replace("US$ ", "US$ ") + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<p class="sim-nota">Faixa estreita rende mais taxa por dólar enquanto o preço está dentro, mas sai da faixa com mais facilidade e troca mais tokens. Todas as faixas da tabela usam preços fixos (os atalhos são calculados em volta do preço de <b>hoje</b>) e entram no início do período, como a sua.</p>';
  }

  /* ---------- se o preço terminar em X (a partir de hoje, sem taxas) ---------- */
  function renderCenarios(p) {
    var d = SIM.dados, el = $("simCen"), a = SIM.a, b = SIM.b, ult = d.linhas[d.linhas.length - 1], p0 = ult.c, qu = ult.qu;
    if (!(a > 0 && b > a)) { el.innerHTML = ""; return; }
    var depQ = SIM.dep / qu, u = clAmt(1, a, b, p0), L = depQ / (u.x * p0 + u.y), e = clAmt(L, a, b, p0);
    var ms = [-0.5, -0.3, -0.1, 0, 0.1, 0.3, 0.5];
    el.innerHTML = "<h3>Se montar hoje e o preço terminar em…</h3><div class=\"sim-rank-wrap\"><table class=\"sim-rank\"><thead><tr><th>Preço final</th><th>Composição</th><th>Pool (sem taxa)</th><th>Só segurar</th><th>Diferença</th></tr></thead><tbody>" +
      ms.map(function (m) {
        var pf = p0 * (1 + m), v = clAmt(L, a, b, pf), val = (v.x * pf + v.y) * qu, hold = (e.x * pf + e.y) * qu, df = val - hold;
        var tok = v.x * pf / (v.x * pf + v.y || 1);
        return "<tr" + (m === 0 ? ' class="on"' : "") + "><td>" + (m ? fpct(m * 100) : "hoje") + " · " + fp(pf) + "</td><td>" + Math.round(tok * 100) + "% " + esc(d.base) + "</td><td>" + fu(val) + "</td><td>" + fu(hold) + '</td><td class="' + cls(df) + '">' + (df >= 0 ? "+" : "−") + fu(Math.abs(df)) + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<p class="sim-nota">Valores em dólar, sem taxas, com ' + esc(d.quote) + " no preço de hoje. A diferença para só segurar é a perda que as taxas precisam cobrir.</p>";
  }

  /* ---------- em qual plataforma montar (mesma faixa nas outras pools do par) ---------- */
  function outrasDoPar(p) {
    var k = chavePar(p);
    return todas().filter(function (q) { return q.id !== p.id && elegivel(q) && simulavel(q) && chavePar(q) === k; })
      .sort(function (a, b) { return (Number(b.tvl) || 0) - (Number(a.tvl) || 0); }).slice(0, 6);
  }
  function renderRank(p) {
    var el = $("simRank"), outras = outrasDoPar(p);
    if (!outras.length) { el.innerHTML = "<h3>Em qual plataforma montar?</h3><p class=\"sim-nota\">Nenhuma outra pool de " + esc(chavePar(p)) + " passou nas regras do Scanner para comparar plataformas.</p>"; return; }
    if (!SIM.rank) {
      el.innerHTML = '<h3>Em qual plataforma montar?</h3><div class="sim-linha"><button type="button" class="sim-btn prim" id="simRankGo"' + (SIM.rankCarregando ? " disabled" : "") + ">" +
        (SIM.rankCarregando ? "Comparando…" : "Comparar com " + outras.length + (outras.length > 1 ? " outras pools de " : " outra pool de ") + esc(chavePar(p))) + "</button>" +
        '<span class="sim-nota">Mesma faixa, mesmo dinheiro, mesmo período.</span></div>';
      var go = $("simRankGo"); if (go) go.addEventListener("click", function () { comparar(p, outras); });
      return;
    }
    var linhas = SIM.rank.slice().sort(function (x, y) { return (y.t ? y.t.total : -Infinity) - (x.t ? x.t.total : -Infinity); });
    el.innerHTML = "<h3>Em qual plataforma montar? · " + SIM.dias + (SIM.dias === 1 ? " dia" : " dias") + "</h3><div class=\"sim-rank-wrap\"><table class=\"sim-rank\"><thead><tr><th>Pool</th><th>Taxa</th><th>TVL</th><th>Taxas</th><th>Na faixa</th><th>Resultado</th></tr></thead><tbody>" +
      linhas.map(function (r, i) {
        var q = r.p, t = r.t;
        return '<tr class="' + (q.id === p.id ? "on" : "") + '"><td>' + (i + 1) + ". " + esc(q.platform) + " · " + esc(q.network) + (pendente(q) ? ' <span class="pend">pendente</span>' : "") + (q.id === p.id ? " (esta)" : "") + "</td>" +
          "<td>" + (feeDe(q) ? feeDe(q).toLocaleString("pt-BR", { maximumFractionDigits: 4 }) + "%" : "?") + "</td><td>" + fuc(q.tvl) + "</td>" +
          (t ? "<td>" + fu(t.taxas) + "</td><td>" + Math.round(t.dentro * 100) + '%</td><td class="' + cls(t.total - t.dep) + '">' + fpct((t.total / t.dep - 1) * 100) + "</td>"
             : '<td colspan="3" class="sim-nota">' + esc(r.erro || "sem histórico") + "</td>") + "</tr>";
      }).join("") + "</tbody></table></div>" +
      '<p class="sim-nota">Ordem pelo resultado com taxas no histórico, não pelo APR anunciado. Pools com a ordem dos tokens trocada (USDC/SOL) foram convertidas para a mesma faixa.</p>';
  }
  function comparar(p, outras) {
    var d0 = SIM.dados, meu = SIM.pedido, n = nVelas(), chave = [SIM.a, SIM.b, SIM.dep, SIM.dias, SIM.tempo].join("|");
    SIM.rankCarregando = true; renderRank(p);
    var res = [{ p: p, t: testar(p, d0, SIM.a, SIM.b, SIM.dep, n) }];
    /* uma pool por vez: a GeckoTerminal limita as chamadas por minuto */
    outras.reduce(function (cadeia, q) {
      return cadeia.then(function () {
        return ohlcv(q, SIM.tempo).then(function (d) {
          if (d.base !== d0.base && d.base === d0.quote) d = inverter(d);
          res.push(d.base === d0.base ? { p: q, t: testar(q, d, SIM.a, SIM.b, SIM.dep, n) } : { p: q, t: null, erro: "tokens diferentes" });
        }).catch(function () { res.push({ p: q, t: null, erro: "histórico indisponível" }); });
      });
    }, Promise.resolve()).then(function () {
      SIM.rankCarregando = false;
      if (meu !== SIM.pedido) return;
      /* faixa, depósito ou período mudaram durante a comparação: não mostra o ranking velho */
      if (chave !== [SIM.a, SIM.b, SIM.dep, SIM.dias, SIM.tempo].join("|")) { renderRank(p); return; }
      SIM.rank = res; renderRank(p);
    });
  }

  /* ---------- gráfico principal: velas + faixa arrastável ---------- */
  var G = { y: null };
  function desenharGrafico() {
    var cv = $("simCv"); if (!cv) return;
    var r = cv.getBoundingClientRect(); if (!r.width) return;
    var dpr = window.devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr;
    var g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
    var d = SIM.dados; G.y = null;
    g.fillStyle = "#7d8aa0"; g.font = "13px Inter, system-ui, sans-serif"; g.textBaseline = "middle";
    if (!d) { g.fillText(SIM.carregando ? "Carregando o histórico…" : "Escolha uma pool para ver o gráfico.", 16, 28); return; }
    var ls = d.linhas, W = r.width, H = r.height, L = 8, R = W - 76, T = 16, B = H - 24;
    var mn = Infinity, mx = -Infinity; ls.forEach(function (c) { mn = Math.min(mn, c.l); mx = Math.max(mx, c.h); });
    var span = mx - mn; [SIM.a, SIM.b].forEach(function (v) { if (v > mn - span && v < mx + span) { mn = Math.min(mn, v); mx = Math.max(mx, v); } });
    var pad = (mx - mn) * 0.06 || mx * 0.05; mn -= pad; mx += pad;
    var Y = function (v) { return T + (mx - v) / (mx - mn) * (B - T); };
    G.y = Y; G.iv = function (y) { return mx - (y - T) / (B - T) * (mx - mn); };
    g.font = "10.5px JetBrains Mono, monospace";
    for (var k = 0; k <= 5; k++) { var v = mn + (mx - mn) * k / 5; g.strokeStyle = "rgba(148,170,215,.08)"; g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(R, Y(v)); g.stroke(); g.fillStyle = "#7d8aa0"; g.fillText(fp(v), R + 6, Y(v)); }
    var ya = Y(SIM.a), yb = Y(SIM.b);
    g.fillStyle = "rgba(177,151,252,.12)"; g.fillRect(L, Math.max(T, yb), R - L, Math.max(0, Math.min(B, ya) - Math.max(T, yb)));
    var n = ls.length, w = (R - L) / n, X = function (i) { return L + w * (i + 0.5); };
    var ini = ls.length - (nVelas() + 1);
    if (ini > 0) { g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(L, T, X(ini) - w / 2 - L, B - T); }
    ls.forEach(function (c, i) {
      var up = c.c >= c.o; g.strokeStyle = g.fillStyle = up ? "#2ec785" : "#f0556a";
      g.beginPath(); g.moveTo(X(i), Y(c.h)); g.lineTo(X(i), Y(c.l)); g.stroke();
      var y1 = Y(Math.max(c.o, c.c)), y2 = Y(Math.min(c.o, c.c)); g.fillRect(X(i) - Math.max(1, w * 0.32), y1, Math.max(2, w * 0.64), Math.max(1, y2 - y1));
    });
    if (ini > 0) { g.strokeStyle = "#5b8cff"; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(X(ini), T); g.lineTo(X(ini), B); g.stroke(); g.setLineDash([]); g.fillStyle = "#7ea6ff"; g.font = "600 11px Inter, sans-serif"; g.fillText("início do teste", X(ini) + 5, T + 6); }
    /* preço de agora */
    var pA = ls[n - 1].c; g.strokeStyle = "rgba(126,166,255,.6)"; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(L, Y(pA)); g.lineTo(R, Y(pA)); g.stroke(); g.setLineDash([]);
    [[SIM.a, "mín"], [SIM.b, "máx"]].forEach(function (x) {
      var y = Y(x[0]); if (y < T - 2 || y > B + 2) return;
      g.strokeStyle = "#b197fc"; g.lineWidth = 2; g.setLineDash([7, 4]); g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke(); g.setLineDash([]); g.lineWidth = 1;
      g.fillStyle = "#b197fc"; g.fillRect(R, y - 9, 76, 18); g.fillStyle = "#0a0e17"; g.font = "600 10.5px JetBrains Mono, monospace"; g.fillText(fp(x[0]), R + 4, y);
      g.fillStyle = "#b197fc"; g.font = "600 11px Inter, sans-serif"; g.fillText(x[1] + " (arraste)", L + 4, y - 10);
    });
    g.fillStyle = "#7d8aa0"; g.font = "10.5px Inter, sans-serif"; g.textAlign = "center";
    var fmt = SIM.tempo === "hour" ? { day: "2-digit", month: "2-digit", hour: "2-digit" } : { day: "2-digit", month: "2-digit" };
    [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n - 1].forEach(function (i) { g.fillText(new Date(ls[i].t).toLocaleString("pt-BR", fmt), X(i), H - 10); });
    g.textAlign = "left";
  }
  function ligarArraste() {
    var cv = $("simCv"), alvo = null, t = null;
    function y(ev) { var r = cv.getBoundingClientRect(); return ev.clientY - r.top; }
    function atualizar() { var p = poolPorId(SIM.id); if (p && SIM.dados) { renderDireita(p); renderFaixas(p); renderCenarios(p); renderRank(p); } }
    cv.addEventListener("pointerdown", function (ev) {
      if (!G.y || !SIM.dados) return;
      var yy = y(ev), da = Math.abs(G.y(SIM.a) - yy), db = Math.abs(G.y(SIM.b) - yy);
      if (Math.min(da, db) > 14) return;
      alvo = da <= db ? "a" : "b"; cv.setPointerCapture(ev.pointerId); ev.preventDefault();
    });
    cv.addEventListener("pointermove", function (ev) {
      if (!G.y) return;
      var yy = y(ev);
      if (!alvo) { var perto = SIM.dados && Math.min(Math.abs(G.y(SIM.a) - yy), Math.abs(G.y(SIM.b) - yy)) <= 14; cv.style.cursor = perto ? "ns-resize" : "default"; return; }
      var v = G.iv(yy); if (!(v > 0)) return;
      if (alvo === "a") SIM.a = +Math.min(v, SIM.b * 0.999).toPrecision(6); else SIM.b = +Math.max(v, SIM.a * 1.001).toPrecision(6);
      SIM.rank = null; desenharGrafico();
      clearTimeout(t); t = setTimeout(atualizar, 90);
    });
    function solta() { if (alvo) { alvo = null; clearTimeout(t); atualizar(); } }
    cv.addEventListener("pointerup", solta); cv.addEventListener("pointercancel", solta);
  }

  /* ---------- mini gráfico do teste ---------- */
  function desenharMini() {
    var cv = $("simMini"), p = poolPorId(SIM.id); if (!cv || !p || !SIM.dados) return;
    var t = testar(p, SIM.dados, SIM.a, SIM.b, SIM.dep, nVelas()); if (!t) return;
    var r = cv.getBoundingClientRect(); if (!r.width) return;
    var dpr = window.devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr;
    var g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var s = t.serie, W = r.width, H = r.height, L = 8, R = W - 8, T = 10, B = H - 10;
    var vs = []; s.forEach(function (x) { vs.push(x.pool, x.segurar); }); vs.push(t.dep);
    var mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs), pd = (mx - mn) * 0.1 || 1; mn -= pd; mx += pd;
    var X = function (i) { return L + (R - L) * i / Math.max(1, s.length - 1); }, Y = function (v) { return T + (mx - v) / (mx - mn) * (B - T); };
    g.strokeStyle = "#2ec785"; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(L, Y(t.dep)); g.lineTo(R, Y(t.dep)); g.stroke(); g.setLineDash([]);
    [["segurar", "#8a94a8"], ["pool", "#b197fc"]].forEach(function (k) {
      g.strokeStyle = k[1]; g.lineWidth = 2; g.beginPath(); s.forEach(function (x, i) { if (i) g.lineTo(X(i), Y(x[k[0]])); else g.moveTo(X(i), Y(x[k[0]])); }); g.stroke(); g.lineWidth = 1;
    });
  }

  /* ---------- início ---------- */
  function iniciar() {
    if (!$("simLista")) return;
    montar(); renderLista(); desenharTudo();
    var q = new URLSearchParams(location.search);
    var sid = q.get("pool"), tok = String(q.get("simular") || "").toUpperCase().replace(/[^A-Z0-9.\/\-]/g, "").slice(0, 24);
    if (tok) { SIM.busca = tok; $("simBusca").value = tok; }
    carregarPools().then(function () {
      renderLista(); renderStatus();
      var alvo = sid ? todas().find(function (p) { return p.sid === sid; }) : null;
      if (alvo && elegivel(alvo) && simulavel(alvo)) { SIM.busca = chavePar(alvo); $("simBusca").value = SIM.busca; renderLista(); escolher(alvo.id); }
      else if (tok) { var ps = lista(); if (ps.length) escolher(ps[0].id); }
    });
  }

  window.SimuladorPool = { _testar: testar, _clAmt: clAmt, _tokens: tokens, _inverter: inverter, _volatilidadeDia: volatilidadeDia };
  if (typeof document !== "undefined" && document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
