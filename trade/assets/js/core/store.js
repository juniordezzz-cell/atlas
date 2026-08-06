/* ============================================================
   ATLAS — DataStore (camada de persistência)
   ------------------------------------------------------------
   Este é o ÚNICO arquivo que sabe COMO os dados são guardados.
   Todo o resto do ATLAS fala com esta interface, nunca com o
   localStorage direto. Para migrar para nuvem (Supabase, API
   própria, etc.) basta reescrever este arquivo mantendo os
   mesmos métodos: get / set / remove / keys.
   ============================================================ */
(function (ATLAS) {
  "use strict";

  var PREFIX = "atlas.";
  var memory = {};              // fallback quando localStorage não existe
  var usingMemory = false;

  // Detecta se o localStorage está disponível e utilizável
  function probe() {
    try {
      var k = "__atlas_probe__";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  var hasLS = probe();

  var store = {
    /** true quando rodando sem persistência real (ex.: preview em sandbox) */
    get ephemeral() { return usingMemory || !hasLS; },

    get: function (key) {
      var raw;
      try {
        raw = hasLS ? window.localStorage.getItem(PREFIX + key) : memory[key];
      } catch (e) {
        usingMemory = true;
        raw = memory[key];
      }
      if (raw == null) return null;
      try { return JSON.parse(raw); } catch (e) { return raw; }
    },

    set: function (key, value) {
      var raw = JSON.stringify(value);
      try {
        if (hasLS) window.localStorage.setItem(PREFIX + key, raw);
        else memory[key] = raw;
      } catch (e) {
        // cota estourada ou sandbox sem acesso — cai para memória
        usingMemory = true;
        memory[key] = raw;
      }
      return value;
    },

    remove: function (key) {
      try {
        if (hasLS) window.localStorage.removeItem(PREFIX + key);
        else delete memory[key];
      } catch (e) { delete memory[key]; }
    },

    keys: function () {
      var out = [];
      try {
        if (hasLS) {
          for (var i = 0; i < window.localStorage.length; i++) {
            var k = window.localStorage.key(i);
            if (k && k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length));
          }
        } else {
          out = Object.keys(memory);
        }
      } catch (e) { out = Object.keys(memory); }
      return out;
    }
  };

  ATLAS.store = store;
})(window.ATLAS = window.ATLAS || {});
