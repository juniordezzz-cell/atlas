/* ===================================================================
   ATLAS — Camada de consolidação (Bloco 3)
   -------------------------------------------------------------------
   Lê os TOTAIS REAIS de cada módulo (Trade, Hold, DeFi, RWA) direto das
   suas camadas de dados, soma tudo em US$ e devolve um snapshot para o
   dashboard principal.

   Regra de carteiras (via AtlasWallets):
     • carteiras GLOBAIS  → somam no patrimônio principal
     • carteiras ISOLADAS → ficam só no módulo (excluídas daqui)

   Tudo é defensivo: se um módulo não carregar, ele contribui 0 e o
   restante do dashboard continua funcionando.
   =================================================================== */
(function (global) {
  "use strict";

  function n(v) { return (typeof v === "number" && isFinite(v)) ? v : 0; }
  function safe(fn, fb) {
    try { var r = fn(); return (r === null || r === undefined) ? fb : r; }
    catch (e) { if (global.console) global.console.warn("[AtlasConsolidation]", e && e.message); return fb; }
  }

  var COLORS = { trade: "#4F8CFF", hold: "#22C55E", defi: "#8B5CF6", rwa: "#22D3EE" };

  /* ---- inicialização preguiçosa dos stores que precisam de init() ---- */
  function trade() {
    var A = global.ATLAS;
    if (A && A.app && A.app.init && !A.__consInit) { A.app.init(); A.__consInit = true; }
    return A;
  }
  function hold() {
    var S = global.Store; /* Hold expõe window.Store */
    if (S && S.init && !S.__consInit) { S.init(); S.__consInit = true; }
    return S;
  }

  function globalIds() {
    var W = global.AtlasWallets;
    return W && W.globals ? W.globals().map(function (w) { return w.id; }) : ["principal"];
  }

  /* ---------- TOTAIS (US$) — null = módulo ausente ---------- */
  function tradeTotal() {
    return safe(function () {
      var A = trade(); if (!A || !A.app || !A.app.getState) return null;
      var st = A.app.getState(), sum = 0;
      globalIds().forEach(function (id) {
        var d = st.data && st.data[id];
        var eq = d && d.equity && d.equity.length ? d.equity[d.equity.length - 1] : 0;
        sum += n(eq);
      });
      return sum;
    }, null);
  }
  function holdTotal() {
    return safe(function () {
      var S = hold(); if (!S || !S.get) return null;
      // soma só as carteiras globais (não a carteira ativa do módulo)
      if (S.get.globalTotal) return n(S.get.globalTotal());
      return S.get.portfolioValue ? n(S.get.portfolioValue()) : null;
    }, null);
  }
  function defiTotal() {
    return safe(function () {
      if (!global.DeFiStore) return null;
      if (global.DeFiStore.globalTotal) return n(global.DeFiStore.globalTotal());
      return n(global.DeFiStore.kpis().total);
    }, null);
  }
  function rwaTotal() {
    return safe(function () { return global.RWAStore ? n(global.RWAStore.globalTotal()) : null; }, null);
  }

  /* ---------- P&L por módulo (best-effort) ---------- */
  function tradePnl() {
    return safe(function () {
      var A = trade(); if (!A || !A.app || !A.app.getState) return 0;
      var st = A.app.getState(), p = 0;
      globalIds().forEach(function (id) {
        var d = st.data && st.data[id];
        if (d && d.equity && d.equity.length > 1) p += d.equity[d.equity.length - 1] - d.equity[0];
      });
      return p;
    }, 0);
  }
  function holdPnl() { return safe(function () { var S = hold(); return (S && S.get && S.get.portfolioPnL) ? n(S.get.portfolioPnL()) : 0; }, 0); }
  function defiPnl() { return safe(function () { return global.DeFiStore ? n(global.DeFiStore.kpis().profit) : 0; }, 0); }
  function rwaPnl()  { return safe(function () { return global.RWAStore ? n(global.RWAStore.kpis().pnlAbs) : 0; }, 0); }

  function moduleList() {
    return [
      { key: "trade", name: "Trade", total: tradeTotal(), color: COLORS.trade },
      { key: "hold",  name: "Hold",  total: holdTotal(),  color: COLORS.hold },
      { key: "defi",  name: "DeFi",  total: defiTotal(),  color: COLORS.defi },
      { key: "rwa",   name: "RWA",   total: rwaTotal(),   color: COLORS.rwa }
    ];
  }

  /* ---------- Histórico p/ evolução ----------
     Normaliza cada série do módulo para terminar no total ATUAL daquele
     módulo (reconcilia o endpoint com o KPI). Módulos sem série viram
     linha plana no total atual. Soma tudo elemento a elemento. */
  function vals(arr) { return (arr || []).map(function (p) { return typeof p === "number" ? p : n(p.value); }); }
  function moduleHistory(key, currentTotal, days) {
    var series = null;
    if (key === "rwa")  series = safe(function () { return global.RWAStore ? vals(global.RWAStore.equityCurves().total) : null; }, null);
    if (key === "defi") series = safe(function () { return global.DeFiStore ? vals(global.DeFiStore.portfolioHistory()) : null; }, null);
    var out = [];
    if (!series || !series.length) { for (var j = 0; j < days; j++) out.push(currentTotal); return out; }
    var tail = series.slice(-days);
    var last = tail[tail.length - 1] || 1;
    var k = currentTotal / last;
    out = tail.map(function (v) { return v * k; });
    while (out.length < days) out.unshift(out[0]);
    return out.slice(-days);
  }

  /* ---------- Exposição por blockchain (best-effort) ---------- */
  function blockchain() {
    var map = {};
    function add(k, v) { if (!k) return; map[k] = (map[k] || 0) + n(v); }
    safe(function () {
      if (!global.RWAStore) return null;
      global.RWAStore.assets().forEach(function (a) {
        var chain = null;
        (a.token || []).forEach(function (t) { if (t && /blockchain/i.test(t.k || "")) chain = t.v; });
        add((chain || "Outros").split("/")[0].trim(), a.current);
      });
      return true;
    }, null);
    safe(function () {
      if (!global.DeFiStore || !global.DeFiStore.distribution) return null;
      (global.DeFiStore.distribution("chain") || []).forEach(function (d) { add(String(d.label).split("/")[0].trim(), d.value); });
      return true;
    }, null);
    return Object.keys(map).map(function (k) { return { label: k, value: Math.round(map[k]) }; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  /* ---------- Renda passiva estimada (APR/APY do DeFi) ---------- */
  function passiveIncome() {
    return safe(function () {
      if (!global.DeFiStore) return 0;
      var y = 0;
      (global.DeFiStore.staking() || []).forEach(function (s) { y += n(s.value) * n(s.apr) / 100; });
      (global.DeFiStore.lending() || []).forEach(function (l) { y += n(l.value) * n(l.apy) / 100; });
      return y / 12; /* mensal */
    }, 0);
  }

  function protocolsCount() {
    return safe(function () {
      if (!global.DeFiStore) return 0;
      var set = {};
      (global.DeFiStore.staking() || []).concat(global.DeFiStore.lending() || []).forEach(function (x) { if (x.protocol) set[x.protocol] = 1; });
      return Object.keys(set).length;
    }, 0);
  }

  /* ---------- SNAPSHOT ---------- */
  function snapshot(days) {
    days = days || 30;
    var mods = moduleList();
    var present = mods.filter(function (m) { return m.total !== null; });
    var total = present.reduce(function (a, m) { return a + n(m.total); }, 0);
    var pnl = tradePnl() + holdPnl() + defiPnl() + rwaPnl();

    var evo = []; for (var i = 0; i < days; i++) evo.push(0);
    present.forEach(function (m) {
      var h = moduleHistory(m.key, n(m.total), days);
      for (var j = 0; j < days; j++) evo[j] += n(h[j]);
    });

    var byModule = present
      .map(function (m) { return { label: m.name, value: Math.round(n(m.total)), color: m.color }; })
      .filter(function (x) { return x.value > 0; });

    var W = global.AtlasWallets;
    var wallets = W ? { total: safe(function () { return W.all().length; }, 0), globals: globalIds().length } : { total: 0, globals: 0 };

    var cost = total - pnl;
    return {
      total: Math.round(total),
      pnl: Math.round(pnl),
      pnlPct: cost > 0 ? (pnl / cost) * 100 : 0,
      passiveIncome: Math.round(passiveIncome()),
      protocols: protocolsCount(),
      byModule: byModule,
      evolution: evo.map(function (v) { return Math.round(v); }),
      wallets: wallets,
      modules: mods
    };
  }

  /* ============================================================
     ALERTAS CONSOLIDADOS
     ------------------------------------------------------------
     O card "Alertas Inteligentes" do Dashboard lia SÓ o motor de
     risco do RWA. O nome prometia o sistema inteiro e entregava um
     módulo de quatro — e o Hold já calculava alertas próprios
     (Store.get.alerts) que nunca chegavam à tela principal.

     Aqui cada módulo contribui com o que ELE sabe. Nada é inventado:
     toda regra abaixo ou já existia no módulo, ou lê um estado que o
     próprio módulo define como problema.

     Formato de saída: { level, module, texto, quando }
       level: "crit" | "warn" | "info"  (ordena a lista)
     ============================================================ */

  var PESO = { crit: 0, warn: 1, info: 2 };

  function alerts() {
    var out = [];

    function add(level, module, texto, quando) {
      if (!texto) return;
      out.push({
        level: PESO[level] != null ? level : "info",
        module: module,
        texto: String(texto),
        quando: quando || "agora"
      });
    }

    /* ---- Hold: regras que o módulo já calculava e ninguém via ---- */
    safe(function () {
      var S = hold();
      if (!S || !S.get || !S.get.alerts) return null;
      S.get.alerts().forEach(function (a) {
        add(a.level, "hold", a.title + " — " + a.sub);
      });
      return true;
    }, null);

    /* ---- RWA: motor de risco (a única fonte que já aparecia) ----
       O riskEngine emite um item com level "ok" quando NÃO há nada
       errado ("Nenhuma sobre-exposição relevante"). Dentro da tela do
       RWA isso é um selo de tudo certo; num card chamado "Alertas
       Inteligentes" vira uma tranquilização com cara de aviso. Fica
       de fora — a ausência de alerta já é a mensagem. */
    var NIVEL_RWA = { neg: "crit", warn: "warn", info: "info" };
    safe(function () {
      if (!global.RWAStore || !global.RWAStore.riskEngine) return null;
      (global.RWAStore.riskEngine().alerts || []).forEach(function (a) {
        var nivel = (a && a.level) || "warn";
        if (nivel === "ok") return;
        add(NIVEL_RWA[nivel] || "warn", "rwa",
            typeof a === "string" ? a : (a.text || a.msg || ""),
            (a && a.when) || "agora");
      });
      return true;
    }, null);

    /* ---- DeFi: posição fora da faixa de preço ----
       Pool fora do range para de render taxa e começa a acumular
       perda impermanente. O módulo já marca esse estado; faltava
       alguém avisar fora da tela do DeFi. */
    safe(function () {
      if (!global.DeFiStore || !global.DeFiStore.activePools) return null;
      global.DeFiStore.activePools().forEach(function (p) {
        if (p.status === "range") {
          add("crit", "defi", "Pool " + p.base + "/" + p.quote + " (" + p.protocol +
                              ") está fora da faixa de preço.");
        }
      });
      return true;
    }, null);

    /* ---- Todos os módulos: tese aberta há mais de 72h ----
       Mesma régua que o Oráculo já usa (core/ui/atlas-shell.js). Uma
       tese parada é decisão adiada, que é o problema que o ATLAS
       existe para combater. */
    safe(function () {
      var T = global.AtlasTheses;
      if (!T || !T.open) return null;
      var LIM = 72 * 3600 * 1000;
      var paradas = T.open().filter(function (t) {
        return t.createdAt && (Date.now() - new Date(t.createdAt).getTime()) > LIM;
      });
      /* uma linha por módulo, não uma por tese: dez teses paradas no
         Trade viravam dez alertas iguais e enterravam o resto */
      var porModulo = {};
      paradas.forEach(function (t) {
        var m = t.module || "atlas";
        porModulo[m] = (porModulo[m] || 0) + 1;
      });
      Object.keys(porModulo).forEach(function (m) {
        var n = porModulo[m];
        add("warn", m, n + (n === 1 ? " tese aberta" : " teses abertas") +
                       " há mais de 72h — vale concluir ou arquivar.");
      });
      return true;
    }, null);

    /* crítico primeiro; dentro do mesmo nível, preserva a ordem de
       chegada (que é a ordem dos módulos acima) */
    return out.sort(function (a, b) { return PESO[a.level] - PESO[b.level]; });
  }

  global.AtlasConsolidation = {
    snapshot: snapshot,
    moduleList: moduleList,
    blockchain: blockchain,
    alerts: alerts
  };
})(window);
