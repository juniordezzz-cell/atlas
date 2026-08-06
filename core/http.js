/* ============================================================
   ATLAS · core/http.js
   Serviço ÚNICO de rede. Nenhum módulo deve chamar fetch()
   diretamente — sempre AtlasHttp.getJSON().

   Recursos:
   - timeout (padrão 8s) via AbortController
   - retry com backoff (padrão 2 tentativas extras)
   - cache TTL: memória + localStorage (sobrevive a reload)
   - erro normalizado e amigável (nunca derruba o app)

   API:
     AtlasHttp.getJSON(url, opts) -> Promise<data>
       opts: { ttl, timeout, retries, headers, cacheKey }
     AtlasHttp.clearCache()
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasHttp) return; // idempotente

  var LS_KEY = "atlas.http.cache.v1";
  var MAX_LS_ENTRIES = 120; // não deixar o localStorage inchar

  var mem = {}; // cache em memória { key: { t, ttl, data } }

  function lsRead() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function lsWrite(obj) {
    try {
      var keys = Object.keys(obj);
      if (keys.length > MAX_LS_ENTRIES) {
        // remove os mais antigos
        keys.sort(function (a, b) { return obj[a].t - obj[b].t; })
            .slice(0, keys.length - MAX_LS_ENTRIES)
            .forEach(function (k) { delete obj[k]; });
      }
      localStorage.setItem(LS_KEY, JSON.stringify(obj));
    } catch (e) { /* storage cheio ou indisponível → só memória */ }
  }

  function cacheGet(key) {
    var hit = mem[key];
    if (hit && (Date.now() - hit.t) < hit.ttl) return hit.data;
    var ls = lsRead()[key];
    if (ls && (Date.now() - ls.t) < ls.ttl) {
      mem[key] = ls; // promove pra memória
      return ls.data;
    }
    return undefined;
  }
  function cacheSet(key, data, ttl) {
    var entry = { t: Date.now(), ttl: ttl, data: data };
    mem[key] = entry;
    var all = lsRead(); all[key] = entry; lsWrite(all);
  }

  function fetchWithTimeout(url, headers, timeout) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeout) : null;
    return fetch(url, { headers: headers || {}, signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        if (timer) clearTimeout(timer);
        if (!r.ok) {
          var e = new Error("HTTP " + r.status);
          e.status = r.status;
          throw e;
        }
        return r.json();
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        throw err;
      });
  }

  function getJSON(url, opts) {
    opts = opts || {};
    var ttl     = opts.ttl != null ? opts.ttl : 60000; // 60s padrão
    var timeout = opts.timeout || 8000;
    var retries = opts.retries != null ? opts.retries : 2;
    var key     = opts.cacheKey || url;

    if (ttl > 0) {
      var cached = cacheGet(key);
      if (cached !== undefined) return Promise.resolve(cached);
    }

    function attempt(n) {
      return fetchWithTimeout(url, opts.headers, timeout).catch(function (err) {
        // 4xx (exceto 429) não adianta repetir; rede/5xx/429 sim
        var retryable = !err.status || err.status >= 500 || err.status === 429;
        if (n < retries && retryable) {
          var wait = 500 * Math.pow(2, n); // 500ms, 1s, 2s…
          return new Promise(function (res) { setTimeout(res, wait); })
            .then(function () { return attempt(n + 1); });
        }
        throw err;
      });
    }

    return attempt(0).then(function (data) {
      if (ttl > 0) cacheSet(key, data, ttl);
      return data;
    }).catch(function (err) {
      // erro normalizado e amigável — quem chama decide como exibir
      var friendly = new Error(
        err.name === "AbortError" ? "Tempo de resposta esgotado."
        : err.status === 429      ? "Limite de requisições atingido. Tente em instantes."
        : err.status              ? "Serviço indisponível (" + err.status + ")."
        : "Sem conexão com o serviço de dados."
      );
      friendly.cause = err;
      friendly.status = err.status || 0;
      throw friendly;
    });
  }

  window.AtlasHttp = {
    getJSON: getJSON,
    clearCache: function () { mem = {}; try { localStorage.removeItem(LS_KEY); } catch (e) {} }
  };
})();
