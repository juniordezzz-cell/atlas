/* ============================================================
   ATLAS — Entidade compartilhada: TESES (fonte única da verdade)
   ------------------------------------------------------------
   Uma tese representa um processo de pesquisa, análise e
   tomada de decisão. Nasce dentro de um módulo (hold, trade,
   defi, rwa...), evolui, é concluída (→ vai pro Academy),
   pode ser reaberta (→ volta pro módulo, nova versão) e nunca
   perde histórico.

   Os módulos NÃO implementam teses — apenas consomem esta
   entidade. Trocar o backend (Firebase, API) = reescrever só
   este arquivo mantendo a mesma interface.

   Status oficiais:
     planejada | andamento | concluida | arquivada

   Regras centrais:
     - concluida  → sai da lista do módulo e aparece no Academy
     - reabrir    → volta ao módulo de origem, status andamento,
                    versão + 1 (a versão concluída vira snapshot)
     - histórico  → history[] (evolução da visão) + versions[]
                    (fotos de cada conclusão) + log[] (auditoria)
   ============================================================ */
(function (global) {
  "use strict";

  var KEY  = "atlas.theses.v1";
  var FKEY = "atlas.future_studies.v1";

  var STATUSES = ["planejada", "andamento", "concluida", "arquivada"];
  var STATUS_LABEL = {
    planejada: "Planejada",
    andamento: "Em andamento",
    concluida: "Concluída",
    arquivada: "Arquivada"
  };
  var MODULE_LABEL = { hold: "Hold", trade: "Trade", defi: "DeFi", rwa: "RWA" };

  /* ---------- persistência resiliente (file:// e http) ---------- */
  var memT = null, memF = null;
  function canLS() {
    try {
      var k = "__atlas_theses_probe__";
      global.localStorage.setItem(k, "1");
      global.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  }
  var HAS_LS = canLS();

  function rawGet(key, mem) {
    if (!HAS_LS) return mem;
    try { return global.localStorage.getItem(key); } catch (e) { return mem; }
  }
  function rawSet(key, str, isFuture) {
    if (isFuture) memF = str; else memT = str;
    if (!HAS_LS) return;
    try { global.localStorage.setItem(key, str); } catch (e) { /* memória */ }
  }

  function now() { return Date.now(); }
  function uid(p) { return (p || "th") + "_" + now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  /* ---------- estado ---------- */
  function emptyState() { return { meta: { migrated: {} }, items: [] }; }

  var state = null;
  function load() {
    if (state) return state;
    var raw = rawGet(KEY, memT);
    if (raw) {
      try {
        state = JSON.parse(raw);
        if (!state || !Array.isArray(state.items)) state = emptyState();
        if (!state.meta) state.meta = { migrated: {} };
        if (!state.meta.migrated) state.meta.migrated = {};
      } catch (e) { state = emptyState(); }
    } else {
      state = emptyState();
    }
    migrateLegacy();      // uma vez por fonte, não destrutivo
    return state;
  }

  function persist() { rawSet(KEY, JSON.stringify(state)); notify(); }

  /* ---------- eventos (mesma página + entre páginas) ---------- */
  var listeners = [];
  function notify() {
    listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  }
  if (global.addEventListener) {
    global.addEventListener("storage", function (ev) {
      if (ev && (ev.key === KEY || ev.key === FKEY)) {
        state = null; load(); notify();
      }
    });
  }

  /* ---------- helpers de domínio ---------- */
  function log(t, action, detail) {
    t.log.push({ ts: now(), action: action, detail: detail || "" });
  }

  function normalize(t) {
    if (!t.history) t.history = [];
    if (!t.versions) t.versions = [];
    if (!t.log) t.log = [];
    if (!t.data) t.data = {};
    if (!t.version) t.version = 1;
    if (STATUSES.indexOf(t.status) === -1) t.status = "planejada";
    return t;
  }

  function get(id) {
    load();
    for (var i = 0; i < state.items.length; i++) if (state.items[i].id === id) return state.items[i];
    return null;
  }

  /* ============================================================
     MIGRAÇÃO (Hold: estudos + teses · Trade: studies por carteira)
     Não destrutiva: apenas lê as chaves antigas. Ids preservados
     para não quebrar vínculos (ativo.tese_id no Hold, rd.studyId
     no Trade).
     ============================================================ */
  function migrateLegacy() {
    try { migrateHold(); } catch (e) { console.warn("Migração Hold falhou:", e); }
    try { migrateTrade(); } catch (e) { console.warn("Migração Trade falhou:", e); }
  }

  function readJSON(key) {
    var raw = rawGet(key, null);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function has(id) { return !!get(id); }

  function migrateHold() {
    if (state.meta.migrated.hold_v2) return;
    var hold = readJSON("atlas.hold.state.v2");
    if (!hold) { state.meta.migrated.hold_v2 = true; rawSet(KEY, JSON.stringify(state)); return; }

    var tick = {};
    (hold.ativos || []).forEach(function (a) { tick[a.id] = a.ticker || a.nome || "—"; });

    var mapStatus = { active: "andamento", review: "andamento", invalid: "arquivada" };
    var changed = false;

    (hold.teses || []).forEach(function (old) {
      if (has(old.id)) return;
      var t = normalize({
        id: old.id, module: "hold",
        asset: tick[old.ativo_id] || "—",
        title: "Tese " + (tick[old.ativo_id] || ""),
        content: old.narrativa || "",
        status: mapStatus[old.status] || "andamento",
        data: {
          ativo_id: old.ativo_id || null,
          cenarios: old.cenarios || { bull: "", base: "", bear: "" },
          riscos: old.riscos || [],
          catalisadores: old.catalisadores || [],
          criterios_invalidacao: old.criterios_invalidacao || "",
          conviccao: old.conviccao != null ? old.conviccao : 5
        },
        history: old.narrativa ? [{ ts: now(), text: old.narrativa }] : [],
        version: 1, versions: [], log: [],
        createdAt: now(), updatedAt: now(), concludedAt: null
      });
      log(t, "migrada", "Migrada do sistema antigo de teses do Hold (status original: " + old.status + ").");
      if (old.status === "review") log(t, "nota", "Estava marcada como 'em revisão' no sistema antigo.");
      state.items.push(t);
      changed = true;
    });

    (hold.estudos || []).forEach(function (old) {
      if (has(old.id)) return;
      var body = [old.conteudo, old.insights ? "Insights: " + old.insights : ""].filter(Boolean).join("\n\n");
      var t = normalize({
        id: old.id, module: "hold",
        asset: tick[old.ativo_id] || (old.ativo_id ? "—" : "Tema geral"),
        title: old.titulo || "Estudo sem título",
        content: body,
        status: "planejada",
        data: { ativo_id: old.ativo_id || null, tipo_estudo: old.tipo || null, origem: "estudo" },
        history: body ? [{ ts: now(), text: body }] : [],
        version: 1, versions: [], log: [],
        createdAt: now(), updatedAt: now(), concludedAt: null
      });
      log(t, "migrada", "Convertida a partir de um Estudo do Hold (tipo: " + (old.tipo || "—") + ").");
      state.items.push(t);
      changed = true;
    });

    state.meta.migrated.hold_v2 = true;
    rawSet(KEY, JSON.stringify(state));
    if (changed) notify();
  }

  function migrateTrade() {
    if (state.meta.migrated.trade_v1) return;
    var trade = readJSON("atlas.trade.state.v1");
    if (!trade || !trade.data) { state.meta.migrated.trade_v1 = true; rawSet(KEY, JSON.stringify(state)); return; }

    var mapStatus = { futuro: "planejada", andamento: "andamento", concluido: "concluida" };
    var changed = false;

    function importStudy(s, wid, archived) {
      if (!s || has(s.id)) return;
      var status = mapStatus[s.state] || "planejada";
      var t = normalize({
        id: s.id, module: "trade",
        asset: s.asset || "—",
        title: s.title || "Sem título",
        content: s.thesis || "",
        status: status,
        data: { walletId: wid || null, arquivo_trade: !!archived },
        history: clone(s.history || []),
        version: 1, versions: [],
        log: [],
        createdAt: s.createdAt || now(),
        updatedAt: s.updatedAt || s.createdAt || now(),
        concludedAt: null
      });
      log(t, "migrada", "Migrada do módulo Estudos do Trade" + (archived ? " (arquivo)" : "") + ".");
      if (status === "concluida") {
        t.concludedAt = s.closedAt || s.updatedAt || now();
        t.versions.push({
          version: 1, openedAt: t.createdAt, concludedAt: t.concludedAt,
          snapshot: { title: t.title, asset: t.asset, content: t.content, data: clone(t.data), history: clone(t.history) }
        });
        log(t, "concluida", "Concluída ainda no sistema antigo.");
      }
      state.items.push(t);
      changed = true;
    }

    Object.keys(trade.data).forEach(function (wid) {
      var wd = trade.data[wid] || {};
      (wd.studies || []).forEach(function (s) { importStudy(s, wid, false); });
      if (wd.archive && wd.archive.studies) {
        wd.archive.studies.forEach(function (s) { importStudy(s, wid, true); });
      }
    });

    state.meta.migrated.trade_v1 = true;
    rawSet(KEY, JSON.stringify(state));
    if (changed) notify();
  }

  /* ============================================================
     ESTUDOS FUTUROS (ativos ainda sem tese — vivem no Academy)
     ============================================================ */
  var SEED_FUTURES = ["Hyperliquid", "Ethena", "Morpho", "EigenLayer", "Pendle", "Drift"];

  var fstate = null;
  function fload() {
    if (fstate) return fstate;
    var raw = rawGet(FKEY, memF);
    if (raw) {
      try { fstate = JSON.parse(raw); } catch (e) { fstate = null; }
    }
    if (!fstate || !Array.isArray(fstate.items)) {
      fstate = {
        items: SEED_FUTURES.map(function (n) {
          return { id: uid("fu"), asset: n, note: "", createdAt: now() };
        })
      };
      rawSet(FKEY, JSON.stringify(fstate), true);
    }
    return fstate;
  }
  function fpersist() { rawSet(FKEY, JSON.stringify(fstate), true); notify(); }

  /* ============================================================
     API PÚBLICA
     ============================================================ */
  var api = {

    STATUSES: STATUSES,
    statusLabel: function (s) { return STATUS_LABEL[s] || s; },
    moduleLabel: function (m) { return MODULE_LABEL[m] || m; },

    /* ---- leitura ---- */
    all: function () { return load().items.slice(); },

    get: function (id) { return get(id); },

    /** Teses de um módulo. Por padrão exclui concluídas (foram pro Academy). */
    byModule: function (module, opts) {
      opts = opts || {};
      return load().items.filter(function (t) {
        if (t.module !== module) return false;
        if (t.status === "concluida" && !opts.includeConcluded) return false;
        if (t.status === "arquivada" && opts.excludeArchived) return false;
        return true;
      });
    },

    byStatus: function (status) {
      return load().items.filter(function (t) { return t.status === status; });
    },

    open: function () {
      return load().items.filter(function (t) { return t.status === "planejada" || t.status === "andamento"; });
    },

    concluded: function () { return api.byStatus("concluida"); },

    search: function (q) {
      q = (q || "").toLowerCase().trim();
      if (!q) return [];
      return load().items.filter(function (t) {
        return (t.title || "").toLowerCase().indexOf(q) > -1 ||
               (t.asset || "").toLowerCase().indexOf(q) > -1 ||
               (t.content || "").toLowerCase().indexOf(q) > -1;
      });
    },

    /* ---- escrita ---- */
    create: function (d) {
      load();
      var t = normalize({
        id: d.id || uid("th"),
        module: d.module,
        asset: (d.asset || "—"),
        title: d.title || "Sem título",
        content: d.content || "",
        status: d.status || "planejada",
        data: d.data || {},
        history: d.content ? [{ ts: now(), text: d.content }] : [],
        version: 1, versions: [], log: [],
        createdAt: now(), updatedAt: now(), concludedAt: null
      });
      log(t, "criada", "Tese criada no módulo " + api.moduleLabel(t.module) + " (status " + api.statusLabel(t.status) + ").");
      state.items.unshift(t);
      persist();
      return t;
    },

    /** Patch de metadados/dados. `note` opcional entra no log. */
    update: function (id, patch, note) {
      var t = get(id); if (!t) return null;
      if (patch.asset != null) t.asset = patch.asset;
      if (patch.title != null) t.title = patch.title;
      if (patch.content != null) t.content = patch.content;
      if (patch.data != null) t.data = Object.assign({}, t.data, patch.data);
      t.updatedAt = now();
      log(t, "revisada", note || "Tese atualizada.");
      persist();
      return t;
    },

    /** Nova visão: vira o conteúdo atual e entra no histórico. */
    addUpdate: function (id, text) {
      var t = get(id); if (!t || !text) return null;
      t.history.push({ ts: now(), text: text });
      t.content = text;
      t.updatedAt = now();
      persist();
      return t;
    },

    setStatus: function (id, status) {
      if (STATUSES.indexOf(status) === -1) return null;
      if (status === "concluida") return api.conclude(id);
      var t = get(id); if (!t) return null;
      var old = t.status;
      t.status = status;
      t.updatedAt = now();
      log(t, "status", api.statusLabel(old) + " → " + api.statusLabel(status));
      persist();
      return t;
    },

    /** Conclui: snapshot da versão + status concluida → aparece no Academy. */
    conclude: function (id) {
      var t = get(id); if (!t) return null;
      if (t.status === "concluida") return t;
      t.status = "concluida";
      t.concludedAt = now();
      t.updatedAt = now();
      t.versions.push({
        version: t.version,
        openedAt: t.versions.length ? t.versions[t.versions.length - 1].concludedAt : t.createdAt,
        concludedAt: t.concludedAt,
        snapshot: { title: t.title, asset: t.asset, content: t.content, data: clone(t.data), history: clone(t.history) }
      });
      log(t, "concluida", "Versão " + t.version + " concluída. Enviada automaticamente ao Academy.");
      persist();
      return t;
    },

    /** Reabre: volta ao módulo de origem, status andamento, versão +1. */
    reopen: function (id) {
      var t = get(id); if (!t) return null;
      if (t.status !== "concluida" && t.status !== "arquivada") return t;
      var was = t.status;
      t.status = "andamento";
      t.version += 1;
      t.updatedAt = now();
      log(t, "reaberta", (was === "concluida" ? "Reaberta a partir do Academy" : "Desarquivada") +
        " → versão " + t.version + " em andamento no módulo " + api.moduleLabel(t.module) + ".");
      persist();
      return t;
    },

    archive: function (id, motivo) {
      var t = get(id); if (!t) return null;
      t.status = "arquivada";
      t.updatedAt = now();
      log(t, "arquivada", motivo || "Tese arquivada.");
      persist();
      return t;
    },

    remove: function (id) {
      load();
      var before = state.items.length;
      state.items = state.items.filter(function (t) { return t.id !== id; });
      if (state.items.length !== before) persist();
    },

    /* ---- indicadores (Academy / relatórios) ---- */
    stats: function () {
      var items = load().items;
      var s = {
        total: items.length,
        planejadas: 0, andamento: 0, concluidas: 0, arquivadas: 0,
        revisoes: 0,
        futuros: api.futures().length,
        ultimaAtualizacao: null,
        tempoMedioConclusaoMs: null,
        porModulo: {}
      };
      var durTotal = 0, durN = 0;
      items.forEach(function (t) {
        if (t.status === "planejada") s.planejadas++;
        if (t.status === "andamento") s.andamento++;
        if (t.status === "concluida") s.concluidas++;
        if (t.status === "arquivada") s.arquivadas++;
        s.revisoes += Math.max(0, (t.log || []).filter(function (l) { return l.action === "revisada"; }).length) +
                      Math.max(0, t.version - 1);
        if (!s.ultimaAtualizacao || t.updatedAt > s.ultimaAtualizacao) s.ultimaAtualizacao = t.updatedAt;
        var m = t.module || "outro";
        if (!s.porModulo[m]) s.porModulo[m] = { total: 0, planejadas: 0, andamento: 0, concluidas: 0, arquivadas: 0, revisoes: 0, ultimaRevisao: null };
        var pm = s.porModulo[m];
        pm.total++;
        pm[t.status === "planejada" ? "planejadas" : t.status === "andamento" ? "andamento" : t.status === "concluida" ? "concluidas" : "arquivadas"]++;
        pm.revisoes += Math.max(0, t.version - 1);
        if (!pm.ultimaRevisao || t.updatedAt > pm.ultimaRevisao) pm.ultimaRevisao = t.updatedAt;
        (t.versions || []).forEach(function (v) {
          if (v.openedAt && v.concludedAt && v.concludedAt > v.openedAt) {
            durTotal += (v.concludedAt - v.openedAt); durN++;
          }
        });
      });
      if (durN) s.tempoMedioConclusaoMs = durTotal / durN;
      return s;
    },

    /* ---- estudos futuros ---- */
    futures: function () { return fload().items.slice(); },

    addFuture: function (asset, note) {
      fload();
      var f = { id: uid("fu"), asset: asset, note: note || "", createdAt: now() };
      fstate.items.unshift(f);
      fpersist();
      return f;
    },

    removeFuture: function (id) {
      fload();
      fstate.items = fstate.items.filter(function (f) { return f.id !== id; });
      fpersist();
    },

    /** Promove um estudo futuro a Tese (status planejada) no módulo escolhido. */
    promoteFuture: function (id, module) {
      fload();
      var f = null;
      fstate.items.forEach(function (x) { if (x.id === id) f = x; });
      if (!f) return null;
      var t = api.create({
        module: module, asset: f.asset, title: "Tese " + f.asset,
        content: f.note || "", status: "planejada",
        data: { origem: "estudo_futuro" }
      });
      log(t, "nota", "Originada da lista de Estudos Futuros do Academy.");
      api.removeFuture(id);
      persist();
      return t;
    },

    /* ---- eventos ---- */
    onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); }
  };

  global.AtlasTheses = api;
  load();
})(typeof window !== "undefined" ? window : this);
