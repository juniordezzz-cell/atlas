/* ============================================================
   ATLAS · RWA — store.js
   Fonte única de verdade do módulo. JSON embutido (funciona em
   file://), persistência em localStorage com fallback em memória.
   É este contrato que o Oráculo consumirá no futuro.
   ============================================================ */
(function () {
  "use strict";
  var KEY = "atlas.rwa.state.v3";

  /* ---------- Regimes de mercado (core) ---------- */
  var REGIMES = {
    riskon:  { id: "riskon",  label: "Risk-On", tag: "Tech Expansion",        cls: "regime-riskon" },
    riskoff: { id: "riskoff", label: "Risk-Off", tag: "Hedge Mode",            cls: "regime-riskoff" },
    liqexp:  { id: "liqexp",  label: "Liquidity Expansion", tag: "Easing",     cls: "regime-liqexp" },
    liqcon:  { id: "liqcon",  label: "Liquidity Contraction", tag: "Tightening", cls: "regime-liqcon" },
    trans:   { id: "trans",   label: "Transition Phase", tag: "Uncertain",     cls: "regime-trans" },
    /* Sem provedor de macro, o ATLAS não tem como afirmar regime
       nenhum. "Risk-On · Tech Expansion" era o valor fixo que vinha na
       semente e aparecia como KPI no Dashboard, com selo verde — uma
       leitura de mercado que ninguém fez. */
    nenhum:  { id: "nenhum",  label: "Sem leitura",      tag: "sem fonte",    cls: "regime-trans" }
  };

  /* ---------- Gerador determinístico de séries ---------- */
  function series(days, start, drift, vol, seed) {
    var out = [], v = start, s = seed || 7, today = new Date();
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(today); d.setDate(today.getDate() - i);
      s = (s * 9301 + 49297) % 233280; var r = s / 233280;
      v = v * (1 + drift / 100 + (r - 0.5) * vol / 100);
      out.push({ date: d.toISOString().slice(0, 10), value: +v.toFixed(2) });
    }
    return out;
  }
  function vals(days, start, drift, vol, seed) { return series(days, start, drift, vol, seed).map(function (p) { return p.value; }); }

  function seed() {
    var assets = []; /* estado inicial LIMPO — sem dados de demonstração */

    return {
      /* regime: "nenhum" enquanto não houver provedor de macro. Era
         "riskon", fixo, e virava o KPI "Macro Regime · Risk-On" do
         Dashboard — leitura de mercado que ninguém fez. */
      meta: { updatedAt: new Date().toISOString(), regime: "nenhum" },
      equityCurves: {
        rwa:   series(90, 0, 0, 0, 21),
        hold:  series(90, 0, 0, 0, 33),
        total: series(90, 0, 0, 0, 44)
      },
      /* ============================================================
         MACRO E NARRATIVA — ESVAZIADOS NA TERCEIRA AUDITORIA
         ------------------------------------------------------------
         Aqui havia números inventados, fixos no código, exibidos na
         tela como leitura de mercado:

           Juros (Fed Funds)   4,50%   com seta de −0,25
           Inflação (CPI)      2,9%    com seta de −0,10
           DXY (Dólar)         103,4
           Índice de Liquidez  62/100
           "AI Expansion Cycle", confiança 82%
           "+US$ 1,8B / sem" de fluxo institucional

         Nenhum deles vinha de fonte nenhuma, e os gráficos de apoio
         eram séries de um gerador pseudoaleatório com semente fixa.
         Um painel de macro decorativo dentro de um sistema que decide
         alocação é pior que painel nenhum: ele convida a decidir com
         base num dado que não existe.

         A regra de ouro do ATLAS é explícita — zero dado fictício em
         fluxo real. Os campos ficam, com valor nulo, e a tela mostra
         que não há fonte conectada. Quando entrar um provedor de
         macro de verdade (capacidade "macro" no registry), ele
         preenche isto e a tela volta a desenhar sozinha.
         ============================================================ */
      macro: {
        rates:     { k: "Juros (Fed Funds)",  v: null, unit: "%",    delta: null, series: [], good: "down" },
        inflation: { k: "Inflação (CPI)",     v: null, unit: "%",    delta: null, series: [], good: "down" },
        dxy:       { k: "DXY (Dólar)",        v: null, unit: "",     delta: null, series: [], good: "flat" },
        liquidity: { k: "Índice de Liquidez", v: null, unit: "/100", delta: null, series: [], good: "up" },
        riskOnOff: null,
        regime: "nenhum"
      },
      narrative: {
        current: null, confidence: null, impact: null,
        liquidityCycle:      { v: null, dir: "flat" },
        hedgeCycle:          { v: null, dir: "flat" },
        cryptoRotation:      { v: null, dir: "flat" },
        institutionalInflows:{ v: null, dir: "flat" }
      },
      journal: [],
      assets: assets
    };
  }

  /* ---------- Carteiras (integração com a central AtlasWallets) ----------
     RWA passa a guardar UM portfólio por carteira, igual ao Trade.
     - carteira "principal" (global ativa) nasce com a carteira-semente
     - demais carteiras (globais ou isoladas) nascem vazias
     - só carteiras GLOBAIS somam no dashboard principal (globalTotal)
  */
  var W = (typeof window !== "undefined") ? window.AtlasWallets : null;
  function principalId() { return (W && W.activeGlobal) ? W.activeGlobal().id : "principal"; }
  function moduleWallets() {
    if (W && W.forModule) return W.forModule("rwa");
    return [{ id: "principal", name: "Principal", type: "global", module: null, color: "var(--info)" }];
  }
  function globalIds() {
    if (W && W.globals) return W.globals().map(function (w) { return w.id; });
    return ["principal"];
  }

  function emptyWallet() {
    return {
      assets: [],
      equityCurves: { rwa: series(90, 0, 0, 0, 21), hold: series(90, 0, 0, 0, 33), total: series(90, 0, 0, 0, 44) },
      journal: []
    };
  }
  function seededWallet(full) { return { assets: full.assets, equityCurves: full.equityCurves, journal: full.journal }; }

  /* ---------- Persistência (estado multi-carteira) ---------- */
  var _mem = null;
  function _bootstrap() {
    var full = seed(), pid = principalId(), byWallet = {};
    byWallet[pid] = seededWallet(full);
    return { meta: full.meta, macro: full.macro, narrative: full.narrative, currentWalletId: pid, byWallet: byWallet };
  }
  function _hasAssets(s) {
    var k = Object.keys(s.byWallet);
    for (var i = 0; i < k.length; i++) { if (s.byWallet[k[i]].assets && s.byWallet[k[i]].assets.length) return true; }
    return false;
  }
  function _load() {
    if (_mem) return _mem;
    try { var raw = localStorage.getItem(KEY); if (raw) { _mem = JSON.parse(raw); } } catch (e) {}
    if (!_mem || typeof _mem !== "object" || !_mem.byWallet || typeof _mem.byWallet !== "object" || !_mem.meta) {
      _mem = _bootstrap(); _persist();
    }

    /* ------------------------------------------------------------
       MACRO E NARRATIVA NÃO SÃO DADO DO USUÁRIO

       São leitura de MERCADO: ninguém as edita nesta tela, e elas não
       pertencem a carteira nenhuma. Estavam sendo persistidas junto
       com o portfólio, e por isso os valores inventados (Fed Funds
       4,50%, "AI Expansion Cycle") sobreviveriam à correção — ficariam
       gravados no localStorage de quem já abriu o RWA, e a tela
       continuaria mostrando o número fixo mesmo com o código limpo.

       Vêm sempre do código, nunca do disco. No dia em que um provedor
       de macro existir, é ele quem preenche — e continua não sendo
       coisa para guardar em estado de carteira.
       ------------------------------------------------------------ */
    var fresco = seed();
    _mem.macro = fresco.macro;
    _mem.narrative = fresco.narrative;
    /* O regime é conclusão da macro, e vive em meta por acidente
       histórico. Sem macro não há regime — e sem esta linha o
       "Risk-On" gravado continuaria sendo o KPI do Dashboard. */
    if (!_mem.meta) _mem.meta = fresco.meta;
    _mem.meta.regime = fresco.meta.regime;

    return _mem;
  }
  function _persist() { try { localStorage.setItem(KEY, JSON.stringify(_mem)); } catch (e) {} }

  function _ensureWallet(id) {
    var s = _load();
    var wd = s.byWallet[id];
    if (!wd || typeof wd !== "object" || !Array.isArray(wd.assets)) {
      s.byWallet[id] = (id === principalId() && !_hasAssets(s)) ? seededWallet(seed()) : emptyWallet();
      _persist();
    }
    return s.byWallet[id];
  }
  function _currentId() {
    var s = _load();
    var id = s.currentWalletId || principalId();
    var ids = moduleWallets().map(function (w) { return w.id; });
    if (ids.indexOf(id) === -1) { id = principalId(); s.currentWalletId = id; }
    return id;
  }

  /* view mesclada: dados de mercado (compartilhados) + portfólio da carteira atual.
     Os arrays retornados são as MESMAS referências guardadas, para addJournal/mutações persistirem. */
  function _read() {
    var s = _load();
    var wd = _ensureWallet(_currentId());
    return {
      meta: s.meta || { updatedAt: new Date().toISOString(), regime: "nenhum" },
      macro: s.macro || {},
      narrative: s.narrative || {},
      assets: Array.isArray(wd.assets) ? wd.assets : [],
      equityCurves: wd.equityCurves || { rwa: [], hold: [], total: [] },
      journal: Array.isArray(wd.journal) ? wd.journal : []
    };
  }

  function scoreColor(s) { return s >= 85 ? "var(--pos)" : s >= 70 ? "var(--info)" : s >= 50 ? "var(--warn)" : "var(--neg)"; }

  var Store = {
    REGIMES: REGIMES,
    regimeMeta: function (id) { return REGIMES[id] || REGIMES.nenhum; },
    scoreColor: scoreColor,

    /* Visão MESCLADA da carteira atual: dados de mercado + o portfólio
       dela. É o que as telas do RWA consomem. */
    all: function () { return _read(); },

    /* ------------------------------------------------------------
       O ESTADO CRU, POR CARTEIRA — e o bug que a ausência dele causava

       `all()` devolve a visão mesclada e NÃO tem `byWallet`. Mesmo
       assim, três leitores de fora do módulo faziam
       `RWAStore.all().byWallet[walletId]` — que é `undefined` sempre:

         js/atlas-consolidation.js   o RWA entrava com ZERO no
                                     patrimônio consolidado do
                                     Dashboard e no saldo do seletor
                                     de carteira, com o módulo cheio
         js/atlas-movements.js       nenhum movimento de RWA era
                                     derivado para os Relatórios

       Não quebrava nada visivelmente: `(undefined || {})[id]` é
       `undefined`, o código seguia com lista vazia e somava zero. O
       módulo inteiro sumia da consolidação em silêncio.
       ------------------------------------------------------------ */
    byWallet: function () { return _load().byWallet || {}; },
    meta: function () { return _read().meta; },
    reset: function () { _mem = _bootstrap(); _persist(); return _read(); },

    /* ---- Carteiras (mesma lógica do Trade) ---- */
    wallets: function () { return moduleWallets(); },
    currentWallet: function () {
      var id = _currentId();
      return (W && W.get && W.get(id)) || { id: id, name: "Principal", type: "global", color: "var(--info)" };
    },
    currentWalletId: function () { return _currentId(); },
    isIsolated: function () { var w = this.currentWallet(); return !!(w && w.type === "isolada"); },
    setWallet: function (id) {
      var s = _load();
      _ensureWallet(id);
      s.currentWalletId = id;
      if (W && W.get) { var w = W.get(id); if (w && w.type === "global" && W.setActiveGlobal) W.setActiveGlobal(id); }
      _persist();
      return true;
    },
    /* total só das carteiras GLOBAIS — é o valor que sobe pro dashboard do Atlas */
    globalTotal: function () {
      var s = _load(), sum = 0;
      globalIds().forEach(function (id) {
        var wd = s.byWallet[id] || (id === principalId() ? _ensureWallet(id) : null);
        if (wd && wd.assets) sum += wd.assets.reduce(function (a, x) { return a + x.current; }, 0);
      });
      return sum;
    },
    /* reage a trocas de carteira feitas em qualquer módulo/aba */
    onWalletChange: function (fn) { if (W && W.subscribe) W.subscribe(fn); },

    /* ============================================================
       QUANTIDADE × PREÇO — o erro de categoria que o RWA tinha
       ------------------------------------------------------------
       O ativo guardava só dois números: `entry` e `current`, ambos
       TOTAIS em dólar. O autopreenchimento do CoinGecko, porém,
       escrevia no campo "Valor atual (US$)" o PREÇO UNITÁRIO do
       token. Uma posição de US$ 5.000 em SKY virava US$ 153 de
       patrimônio — e o número seguia para o Dashboard, para a
       consolidação e para os relatórios sem nada acusando.

       Não era um bug de conta: era um campo significando duas coisas.
       Sem quantidade, "preço do ativo" não existia como conceito, e a
       regra do ATLAS ("quando a API não reconhece, o usuário informa o
       preço") não tinha onde ser aplicada.

       O modelo agora tem os três, e os totais são DERIVADOS:

         quantidade × precoMedio  = entry     (custo)
         quantidade × precoAtual  = current   (valor de mercado)

       MIGRAÇÃO SEM INVENTAR NADA
       Ativo cadastrado antes disto não tem quantidade, e o sistema não
       tem como adivinhá-la. Ele continua valendo pelos TOTAIS que a
       pessoa informou — `quantidade: null` é um estado legítimo, não um
       defeito — e a tela pede a quantidade para poder acompanhar o
       preço sozinha. Preencher um "1" no lugar da quantidade faria os
       totais baterem e todo o resto mentir.
       ============================================================ */
    normalizar: function (a) {
      if (!a) return a;
      var q = Number(a.quantidade);
      if (isFinite(q) && q > 0) {
        a.quantidade = q;
        var pm = Number(a.precoMedio), pa = Number(a.precoAtual);
        if (isFinite(pm) && pm >= 0) a.entry = q * pm;
        if (isFinite(pa) && pa >= 0) a.current = q * pa;
      } else {
        a.quantidade = null;
        /* sem quantidade, preço unitário não significa nada e some —
           deixá-lo gravado criaria um segundo número disputando com o
           total informado */
        a.precoMedio = null;
        a.precoAtual = null;
      }
      a.entry = Number(a.entry) || 0;
      a.current = Number(a.current) || 0;
      return a;
    },

    assets: function () {
      var s = _read(), total = s.assets.reduce(function (a, x) { return a + x.current; }, 0) || 1;
      return s.assets.map(function (a) {
        Store.normalizar(a);
        var pnl = a.current - a.entry;
        return Object.assign({}, a, {
          pnlAbs: pnl, pnlPct: a.entry ? (pnl / a.entry) * 100 : 0,
          weight: (a.current / total) * 100,
          /* a tela usa para pedir a quantidade e para saber se dá
             para atualizar o preço deste ativo automaticamente */
          acompanhaPreco: a.quantidade != null && a.quantidade > 0
        });
      });
    },

    /* ------------------------------------------------------------
       Atualiza o PREÇO UNITÁRIO de um ativo e deixa o total seguir.

       Só funciona para ativo com quantidade: sem ela não há como
       transformar preço em valor de posição, e escrever o preço no
       campo de total seria repetir exatamente o erro que este modelo
       veio corrigir.
       ------------------------------------------------------------ */
    setPrecoAtual: function (id, preco) {
      var s = _read();
      for (var i = 0; i < s.assets.length; i++) {
        if (s.assets[i].id !== id) continue;
        var a = s.assets[i];
        var p = Number(preco);
        if (!(a.quantidade > 0) || !isFinite(p) || p < 0) return null;
        a.precoAtual = p;
        a.precoEm = new Date().toISOString();
        Store.normalizar(a);
        _persist();
        return a;
      }
      return null;
    },
    asset: function (id) { return this.assets().filter(function (a) { return a.id === id; })[0] || null; },

    kpis: function () {
      var s = _read();
      var assets = s.assets || [];
      var total = assets.reduce(function (a, x) { return a + (x.current || 0); }, 0);
      var cost = assets.reduce(function (a, x) { return a + (x.entry || 0); }, 0);
      var pnl = total - cost;
      var conc = this.riskEngine().topSector.pct || 0;
      var avgScore = assets.length ? assets.reduce(function (a, x) { return a + (x.score || 0); }, 0) / assets.length : 0;
      var risk = assets.length ? Math.round(Math.max(1, Math.min(100, (100 - avgScore) * 0.6 + Math.max(0, conc - 35) * 1.1))) : 0;
      return { total: total || 0, pnlAbs: pnl || 0, pnlPct: cost ? (pnl / cost) * 100 : 0, riskScore: risk || 0, regime: (s.meta && s.meta.regime) || "trans" };
    },

    allocationByClass: function () { return group(this.assets(), "type"); },
    allocationBySector: function () { return group(this.assets(), "sector"); },

    equityCurves: function () { return _read().equityCurves; },
    macro: function () { return _read().macro; },
    narrative: function () { return _read().narrative; },
    journal: function () { return _read().journal.slice(); },
    addJournal: function (entry) {
      entry.date = entry.date || new Date().toISOString().slice(0, 10);
      _read().journal.unshift(entry); _persist(); return entry;
    },

    riskEngine: function () {
      var assets = this.assets();
      var bySector = group(assets, "sector");
      var byAsset = assets.map(function (a) { return { label: a.ticker, name: a.name, pct: a.weight, color: a.color }; })
        .sort(function (a, b) { return b.pct - a.pct; });
      var topSector = bySector[0] || { label: "—", pct: 0 };
      var alerts = [];
      bySector.forEach(function (s) { if (s.pct > 40) alerts.push({ level: "warn", text: "Concentração elevada em <b>" + s.label + "</b>: " + s.pct.toFixed(1) + "% do portfólio." }); });
      byAsset.forEach(function (a) { if (a.pct > 22) alerts.push({ level: "warn", text: "Posição <b>" + a.label + "</b> acima de 22% (" + a.pct.toFixed(1) + "%)." }); });
      assets.forEach(function (a) { if (a.status === "reduce") alerts.push({ level: "neg", text: "<b>" + a.ticker + "</b> marcado para redução — revisar exposição." }); });
      if (!alerts.length) alerts.push({ level: "ok", text: "Nenhuma sobre-exposição relevante. Portfólio dentro dos limites." });
      // risco total 0-100
      var concRisk = Math.max(0, topSector.pct - 30) * 1.4;
      var qualRisk = assets.length ? 100 - (assets.reduce(function (a, x) { return a + x.score; }, 0) / assets.length) : 0;
      var totalRisk = assets.length ? Math.round(Math.max(1, Math.min(100, concRisk * 0.5 + qualRisk * 0.7))) : 0;
      return { bySector: bySector, byAsset: byAsset, topSector: topSector, alerts: alerts, totalRisk: totalRisk };
    },

    search: function (q) {
      q = (q || "").trim().toLowerCase(); if (!q) return [];
      return this.assets().filter(function (a) {
        return (a.name + " " + a.ticker + " " + a.type + " " + a.sector).toLowerCase().indexOf(q) !== -1;
      });
    },

    /* ---- Mutações de ativos (CRUD do portfólio) ---- */
    addAsset: function (a) {
      var s = _read();
      a.id = a.id || (String(a.ticker || "ast").toLowerCase().replace(/[^a-z0-9]/g, "") + "_" + Date.now().toString(36));
      a.color = a.color || PALETTE[s.assets.length % PALETTE.length];
      a.score = Math.max(0, Math.min(100, +a.score || 0));
      a.date = a.date || new Date().toISOString().slice(0, 10);
      /* quantidade × preço manda; sem quantidade, valem os totais */
      Store.normalizar(a);
      s.assets.push(a); _persist();
      var widA = _currentId();
      if (window.AtlasMovements && a.entry) {
        window.AtlasMovements.record({
          date: a.date, tipo: "entrada", valorUSD: a.entry, module: "rwa",
          walletId: widA, origem: "compra", ref: "rwa:" + a.id + ":" + widA,
          label: "Ativo " + (a.ticker || a.name || "RWA")
        });
      }
      /* O custo sai do caixa da carteira: a posição não nasce do nada. */
      if (window.AtlasCaixa && a.entry > 0) {
        window.AtlasCaixa.registrar({
          tipo: "aporte", valorUSD: a.entry, walletId: widA,
          module: "rwa", refId: "rwa:" + a.id, data: a.date,
          obs: "Compra de " + (a.ticker || a.name || "RWA")
        });
      }
      return a;
    },
    updateAsset: function (id, patch) {
      var s = _read();
      for (var i = 0; i < s.assets.length; i++) {
        if (s.assets[i].id === id) {
          Object.keys(patch).forEach(function (k) { s.assets[i][k] = patch[k]; });
          Store.normalizar(s.assets[i]);
          _persist(); return s.assets[i];
        }
      }
      return null;
    },
    removeAsset: function (id) {
      var s = _read();
      for (var i = 0; i < s.assets.length; i++) {
        if (s.assets[i].id === id) {
          var sold = s.assets[i];
          var widR = _currentId();
          if (window.AtlasMovements && sold.current) {
            window.AtlasMovements.record({
              date: new Date().toISOString().slice(0, 10), tipo: "saida",
              valorUSD: sold.current, module: "rwa", walletId: widR, origem: "venda",
              ref: "rwa:" + id + ":" + widR,
              label: "Venda " + (sold.ticker || sold.name || "RWA")
            });
          }
          /* Vender devolve o valor ao CAIXA da carteira — não retira
             do ATLAS. Sair do sistema é um saque, que é outro evento. */
          if (window.AtlasCaixa && sold.current > 0) {
            window.AtlasCaixa.registrar({
              tipo: "retorno", valorUSD: sold.current, walletId: widR,
              module: "rwa", refId: "rwa:" + id,
              obs: "Venda de " + (sold.ticker || sold.name || "RWA")
            });
          }
          s.assets.splice(i, 1); _persist(); return true;
        }
      }
      return false;
    },
    removeJournal: function (idx) {
      var j = _read().journal;
      if (idx >= 0 && idx < j.length) { j.splice(idx, 1); _persist(); return true; }
      return false;
    }
  };

  var PALETTE = ["var(--info)", "var(--pos)", "#8B5CF6", "var(--warn)", "#22D3EE", "var(--neg)", "#F472B6", "#A3E635", "#38BDF8", "#FB923C"];

  var GROUP_COLORS = {
    // setores
    "Government": "var(--info)", "Broad Equity": "var(--pos)", "Technology": "#8B5CF6",
    "Commodities": "var(--warn)", "Private Credit": "#22D3EE", "Real Estate": "var(--neg)",
    // classes
    "Treasury": "var(--info)", "Bond": "#3B82F6", "Equity": "var(--pos)",
    "Commodity": "var(--warn)", "Credit": "#22D3EE"
  };

  function group(assets, field) {
    var map = {}, total = assets.reduce(function (a, x) { return a + x.current; }, 0) || 1;
    assets.forEach(function (a) {
      if (!map[a[field]]) map[a[field]] = { label: a[field], value: 0, color: GROUP_COLORS[a[field]] || a.color };
      map[a[field]].value += a.current;
    });
    return Object.keys(map).map(function (k) { var g = map[k]; g.pct = (g.value / total) * 100; return g; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  window.RWAStore = Store;
})();
