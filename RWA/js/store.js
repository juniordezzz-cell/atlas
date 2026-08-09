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
    trans:   { id: "trans",   label: "Transition Phase", tag: "Uncertain",     cls: "regime-trans" }
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
      meta: { updatedAt: new Date().toISOString(), regime: "riskon" },
      equityCurves: {
        rwa:   series(90, 0, 0, 0, 21),
        hold:  series(90, 0, 0, 0, 33),
        total: series(90, 0, 0, 0, 44)
      },
      macro: {
        rates:     { k: "Juros (Fed Funds)", v: 4.50, unit: "%", delta: -0.25, series: vals(60, 5.3, -0.1, 0.3, 12), good: "down" },
        inflation: { k: "Inflação (CPI)",    v: 2.9,  unit: "%", delta: -0.10, series: vals(60, 3.4, -0.15, 0.4, 14), good: "down" },
        dxy:       { k: "DXY (Dólar)",       v: 103.4, unit: "", delta: 0.60, series: vals(60, 101.5, 0.03, 0.5, 16), good: "flat" },
        liquidity: { k: "Índice de Liquidez", v: 62, unit: "/100", delta: 3, series: vals(60, 54, 0.2, 1.2, 18), good: "up" },
        riskOnOff: 38, /* -100..100 */
        regime: "riskon"
      },
      narrative: {
        current: "AI Expansion Cycle", confidence: 82, impact: "Risk-On / Tech Leadership",
        liquidityCycle:      { v: "Expansion", dir: "up" },
        hedgeCycle:          { v: "Baixo", dir: "down" },
        cryptoRotation:      { v: "Rotação p/ Majors", dir: "up" },
        institutionalInflows:{ v: "+US$ 1,8B / sem", dir: "up" }
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
    return [{ id: "principal", name: "Principal", type: "global", module: null, color: "#4F8CFF" }];
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
      meta: s.meta || { updatedAt: new Date().toISOString(), regime: "trans" },
      macro: s.macro || {},
      narrative: s.narrative || {},
      assets: Array.isArray(wd.assets) ? wd.assets : [],
      equityCurves: wd.equityCurves || { rwa: [], hold: [], total: [] },
      journal: Array.isArray(wd.journal) ? wd.journal : []
    };
  }

  function scoreColor(s) { return s >= 85 ? "#22C55E" : s >= 70 ? "#4F8CFF" : s >= 50 ? "#F59E0B" : "#EF4444"; }

  var Store = {
    REGIMES: REGIMES,
    regimeMeta: function (id) { return REGIMES[id] || REGIMES.trans; },
    scoreColor: scoreColor,

    all: function () { return _read(); },
    meta: function () { return _read().meta; },
    reset: function () { _mem = _bootstrap(); _persist(); return _read(); },

    /* ---- Carteiras (mesma lógica do Trade) ---- */
    wallets: function () { return moduleWallets(); },
    currentWallet: function () {
      var id = _currentId();
      return (W && W.get && W.get(id)) || { id: id, name: "Principal", type: "global", color: "#4F8CFF" };
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

    assets: function () {
      var s = _read(), total = s.assets.reduce(function (a, x) { return a + x.current; }, 0) || 1;
      return s.assets.map(function (a) {
        var pnl = a.current - a.entry;
        return Object.assign({}, a, {
          pnlAbs: pnl, pnlPct: a.entry ? (pnl / a.entry) * 100 : 0,
          weight: (a.current / total) * 100
        });
      });
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
      a.entry = +a.entry || 0; a.current = +a.current || 0; a.score = Math.max(0, Math.min(100, +a.score || 0));
      a.date = a.date || new Date().toISOString().slice(0, 10);
      s.assets.push(a); _persist();
      if (window.AtlasMovements && a.entry) {
        var wid = s.currentWalletId || "principal";
        window.AtlasMovements.record({
          date: a.date, tipo: "entrada", valorUSD: a.entry, module: "rwa",
          walletId: wid, origem: "compra", ref: "rwa:" + a.id + ":" + wid,
          label: "Ativo " + (a.ticker || a.name || "RWA")
        });
      }
      return a;
    },
    updateAsset: function (id, patch) {
      var s = _read();
      for (var i = 0; i < s.assets.length; i++) {
        if (s.assets[i].id === id) {
          Object.keys(patch).forEach(function (k) { s.assets[i][k] = patch[k]; });
          s.assets[i].entry = +s.assets[i].entry || 0; s.assets[i].current = +s.assets[i].current || 0;
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
          if (window.AtlasMovements && sold.current) {
            var wid = s.currentWalletId || "principal";
            window.AtlasMovements.record({
              date: new Date().toISOString().slice(0, 10), tipo: "saida",
              valorUSD: sold.current, module: "rwa", walletId: wid, origem: "venda",
              ref: "rwa:" + id + ":" + wid,
              label: "Venda " + (sold.ticker || sold.name || "RWA")
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

  var PALETTE = ["#4F8CFF", "#22C55E", "#8B5CF6", "#F59E0B", "#22D3EE", "#EF4444", "#F472B6", "#A3E635", "#38BDF8", "#FB923C"];

  var GROUP_COLORS = {
    // setores
    "Government": "#4F8CFF", "Broad Equity": "#22C55E", "Technology": "#8B5CF6",
    "Commodities": "#F59E0B", "Private Credit": "#22D3EE", "Real Estate": "#EF4444",
    // classes
    "Treasury": "#4F8CFF", "Bond": "#3B82F6", "Equity": "#22C55E",
    "Commodity": "#F59E0B", "Credit": "#22D3EE"
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
