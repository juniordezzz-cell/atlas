/* ============================================================
   ATLAS · core/settings.js
   ------------------------------------------------------------
   Store ÚNICO de preferências globais do sistema (item 9).

   Nenhum módulo deve guardar tema, idioma ou moeda por conta
   própria. Tudo passa por aqui, tudo persiste em localStorage
   e tudo emite evento — quem quiser reagir, escuta.

   Chaves oficiais
   ---------------
     theme        "dark" | "light"
     lang         "pt-BR" | "en"
     currency     "BRL" | "USD" | "EUR"
     dateFormat   "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd"
     numberFormat "pt-BR" | "en-US"
     animations   true | false

   API
   ---
     AtlasSettings.get(key)          -> valor
     AtlasSettings.set(key, value)   -> aplica + persiste + notifica
     AtlasSettings.patch({...})      -> várias de uma vez
     AtlasSettings.all()             -> cópia do objeto
     AtlasSettings.reset()           -> volta ao padrão
     AtlasSettings.on(fn)            -> fn(changedKeys, settings)
     AtlasSettings.off(fn)
     AtlasSettings.apply()           -> reaplica no <html>

   Efeito colateral no <html>
   --------------------------
     data-theme="dark|light"   → aciona o tema em atlas-theme.css
     data-anim="on|off"        → aciona o kill switch de animações
     lang="pt-BR|en"           → acessibilidade + i18n
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasSettings) return; // idempotente

  var LS_KEY = "atlas.settings.v1";

  var DEFAULTS = {
    theme: "dark",          // o ATLAS nasce escuro
    lang: "pt-BR",
    currency: "USD",        // regra do sistema: cripto em USD
    dateFormat: "dd/MM/yyyy",
    numberFormat: "pt-BR",
    animations: true
  };

  var ALLOWED = {
    theme: ["dark", "light"],
    lang: ["pt-BR", "en"],
    currency: ["BRL", "USD", "EUR"],
    dateFormat: ["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"],
    numberFormat: ["pt-BR", "en-US"]
  };

  var state = null;
  var listeners = [];

  /* ---------- persistência ---------- */

  function read() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return {};
      var obj = JSON.parse(raw);
      return (obj && typeof obj === "object") ? obj : {};
    } catch (e) { return {}; }
  }

  function write() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
    catch (e) { /* modo privado / storage cheio: segue só em memória */ }
  }

  function validate(key, value) {
    if (key === "animations") return !!value;
    var list = ALLOWED[key];
    if (!list) return value;
    return list.indexOf(value) !== -1 ? value : DEFAULTS[key];
  }

  function load() {
    var saved = read();
    state = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      state[k] = (k in saved) ? validate(k, saved[k]) : DEFAULTS[k];
    });
  }

  /* ---------- aplicação no documento ---------- */

  function apply() {
    var html = document.documentElement;
    if (!html) return;
    html.setAttribute("data-theme", state.theme);
    html.setAttribute("data-anim", state.animations ? "on" : "off");
    html.setAttribute("lang", state.lang);
    // cor da barra do navegador acompanha o tema
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      if (document.head) document.head.appendChild(meta);
    }
    meta.setAttribute("content", state.theme === "light" ? "#F6F8FC" : "#05080F");
  }

  /* ---------- notificação ---------- */

  function emit(changed) {
    if (!changed.length) return;
    listeners.slice().forEach(function (fn) {
      try { fn(changed, AtlasSettings.all()); }
      catch (e) { if (window.console) console.error("[AtlasSettings] listener:", e); }
    });
    try {
      document.dispatchEvent(new CustomEvent("atlas:settings", {
        detail: { changed: changed, settings: AtlasSettings.all() }
      }));
    } catch (e) { /* engines antigas */ }
  }

  /* ---------- API pública ---------- */

  var AtlasSettings = {
    keys: Object.keys(DEFAULTS),
    defaults: function () { return JSON.parse(JSON.stringify(DEFAULTS)); },
    options: function (key) { return (ALLOWED[key] || []).slice(); },

    get: function (key) { return state[key]; },

    all: function () { return JSON.parse(JSON.stringify(state)); },

    set: function (key, value) {
      return AtlasSettings.patch({ __k: key, __v: value, __single: true });
    },

    patch: function (obj) {
      var changed = [];
      if (obj && obj.__single) {
        var k = obj.__k, v = validate(obj.__k, obj.__v);
        if (!(k in DEFAULTS)) return [];
        if (state[k] !== v) { state[k] = v; changed.push(k); }
      } else {
        Object.keys(obj || {}).forEach(function (k) {
          if (!(k in DEFAULTS)) return;
          var v = validate(k, obj[k]);
          if (state[k] !== v) { state[k] = v; changed.push(k); }
        });
      }
      if (changed.length) { write(); apply(); emit(changed); }
      return changed;
    },

    reset: function () {
      var before = JSON.stringify(state);
      state = AtlasSettings.defaults();
      write(); apply();
      if (before !== JSON.stringify(state)) emit(Object.keys(DEFAULTS));
    },

    toggleTheme: function () {
      AtlasSettings.set("theme", state.theme === "dark" ? "light" : "dark");
      return state.theme;
    },

    on: function (fn) { if (typeof fn === "function") listeners.push(fn); return fn; },
    off: function (fn) {
      var i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    },

    apply: apply,

    /* Formatação de data respeitando a preferência */
    formatDate: function (value) {
      var d = (value instanceof Date) ? value : new Date(value);
      if (isNaN(d.getTime())) return "—";
      var dd = String(d.getDate()).padStart(2, "0");
      var mm = String(d.getMonth() + 1).padStart(2, "0");
      var yy = d.getFullYear();
      switch (state.dateFormat) {
        case "MM/dd/yyyy": return mm + "/" + dd + "/" + yy;
        case "yyyy-MM-dd": return yy + "-" + mm + "-" + dd;
        default:           return dd + "/" + mm + "/" + yy;
      }
    },

    /* Formatação numérica respeitando a preferência */
    formatNumber: function (n, opts) {
      var num = Number(n);
      if (!isFinite(num)) return "—";
      try { return num.toLocaleString(state.numberFormat, opts || {}); }
      catch (e) { return String(num); }
    },

    locale: function () { return state.numberFormat; }
  };

  load();
  apply();

  // Sincroniza entre abas/janelas abertas do ATLAS
  window.addEventListener("storage", function (e) {
    if (e.key !== LS_KEY) return;
    var before = AtlasSettings.all();
    load(); apply();
    var changed = Object.keys(DEFAULTS).filter(function (k) { return before[k] !== state[k]; });
    emit(changed);
  });

  window.AtlasSettings = AtlasSettings;
})();
