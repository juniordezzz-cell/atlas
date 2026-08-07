/* ============================================================
   ATLAS · core/currency.js
   ------------------------------------------------------------
   Moeda de exibição e conversão automática (item 9).

   Princípio inegociável do ATLAS
   ------------------------------
   Todo dado é ARMAZENADO em USD. Sempre. Cripto se mede em dólar
   e misturar bases de moeda no banco local é como um sistema
   financeiro se corrompe em silêncio.

   A moeda escolhida pelo usuário (BRL/USD/EUR) é uma CAMADA DE
   APRESENTAÇÃO: converte na hora de exibir, nunca ao gravar.

   Fontes de câmbio (em cascata)
   -----------------------------
     1. open.er-api.com   — grátis, sem chave, CORS liberado
     2. CoinGecko         — /exchange_rates, já usado pelo ATLAS
     3. Fallback embutido — mantém o sistema utilizável offline,
                            marcado como "stale" para não enganar

   Cache de 6h em localStorage (funciona em file://).

   API
   ---
     AtlasCurrency.code()                -> "USD" | "BRL" | "EUR"
     AtlasCurrency.symbol()              -> "$" | "R$" | "€"
     AtlasCurrency.rate(code)            -> taxa a partir de USD
     AtlasCurrency.convert(v, from, to)  -> número convertido
     AtlasCurrency.fromUSD(v)            -> valor na moeda ativa
     AtlasCurrency.toUSD(v)              -> valor de volta para USD
     AtlasCurrency.format(vUSD, opts)    -> "R$ 1.234,56"
     AtlasCurrency.compact(vUSD)         -> "R$ 1,2 mi"
     AtlasCurrency.ready()               -> Promise
     AtlasCurrency.refresh(force)        -> Promise
     AtlasCurrency.isStale()             -> boolean
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasCurrency) return;

  var LS_KEY = "atlas.fx.v1";
  var TTL = 6 * 60 * 60 * 1000; // 6 horas

  var META = {
    USD: { symbol: "$",   name: "Dólar americano", nameEn: "US Dollar",  locale: "en-US" },
    BRL: { symbol: "R$",  name: "Real brasileiro", nameEn: "Brazilian Real", locale: "pt-BR" },
    EUR: { symbol: "€",   name: "Euro",            nameEn: "Euro",       locale: "de-DE" }
  };

  // Rede de segurança: nunca deixar a interface quebrar por falta de câmbio.
  var FALLBACK = { USD: 1, BRL: 5.40, EUR: 0.92 };

  var rates = null;     // { USD:1, BRL:x, EUR:y }
  var fetchedAt = 0;
  var stale = true;
  var inflight = null;
  var listeners = [];

  /* ---------- cache ---------- */

  function loadCache() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      var o = JSON.parse(raw);
      if (!o || !o.rates || !o.t) return false;
      rates = o.rates;
      fetchedAt = o.t;
      stale = (Date.now() - o.t) > TTL;
      return !stale;
    } catch (e) { return false; }
  }

  function saveCache() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ rates: rates, t: fetchedAt })); }
    catch (e) { /* segue em memória */ }
  }

  /* ---------- rede ---------- */

  function getJSON(url, timeout) {
    if (window.AtlasHttp && window.AtlasHttp.getJSON) {
      return window.AtlasHttp.getJSON(url, { ttl: TTL, timeout: timeout || 8000, retries: 1 });
    }
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function fromErApi() {
    return getJSON("https://open.er-api.com/v6/latest/USD").then(function (d) {
      if (!d || !d.rates || !d.rates.BRL) throw new Error("resposta sem taxas");
      return {
        USD: 1,
        BRL: Number(d.rates.BRL),
        EUR: Number(d.rates.EUR)
      };
    });
  }

  function fromCoinGecko() {
    return getJSON("https://api.coingecko.com/api/v3/exchange_rates").then(function (d) {
      var r = d && d.rates;
      if (!r || !r.usd || !r.brl) throw new Error("resposta sem taxas");
      // As taxas do CoinGecko são relativas ao BTC → normaliza pelo USD.
      var usd = Number(r.usd.value);
      return {
        USD: 1,
        BRL: Number(r.brl.value) / usd,
        EUR: Number(r.eur.value) / usd
      };
    });
  }

  function sane(r) {
    return r && isFinite(r.BRL) && r.BRL > 0.5 && r.BRL < 100 &&
           isFinite(r.EUR) && r.EUR > 0.1 && r.EUR < 10;
  }

  function refresh(force) {
    if (!force && rates && !stale) return Promise.resolve(rates);
    if (inflight) return inflight;

    // Promise.resolve().then(...) garante que um erro SÍNCRONO dentro de
    // fromErApi (ex.: fetch inexistente) vire rejeição e caia no fallback,
    // em vez de escapar da cadeia e derrubar o boot.
    inflight = Promise.resolve()
      .then(fromErApi)
      .catch(function () { return fromCoinGecko(); })
      .then(function (r) {
        if (!sane(r)) throw new Error("taxas fora do intervalo plausível");
        rates = r;
        fetchedAt = Date.now();
        stale = false;
        saveCache();
        emit();
        return rates;
      })
      .catch(function (err) {
        if (!rates) { rates = FALLBACK; fetchedAt = 0; }
        stale = true;
        if (window.console) console.warn("[AtlasCurrency] câmbio indisponível, usando cache/fallback:", err && err.message);
        emit();
        return rates;
      })
      .then(function (r) { inflight = null; return r; });

    return inflight;
  }

  /* ---------- símbolo curto, igual ao que o Intl imprime ----------
     format() usa Intl, que em pt-BR escreve "US$ 1.234" para dólar e
     em en-US escreve "$1,234". compact() montava o texto na mão com
     META.symbol ("$"), então o MESMO valor aparecia como "US$ 60.000"
     num card e "$ 60 mil" no card ao lado.

     Aqui o prefixo é lido do próprio Intl, para os dois caminhos nunca
     divergirem: formata 0, tira dígitos, separadores e espaços. */
  function prefixo(code) {
    var locale = (window.AtlasSettings && window.AtlasSettings.locale()) || "pt-BR";
    try {
      return (0).toLocaleString(locale, {
        style: "currency", currency: code,
        minimumFractionDigits: 0, maximumFractionDigits: 0
      }).replace(/[\d\s .,]/g, "");
    } catch (e) {
      return AtlasCurrency.symbol(code);
    }
  }

  function emit() {
    listeners.slice().forEach(function (fn) {
      try { fn(AtlasCurrency.code(), rates, stale); } catch (e) {}
    });
    try {
      document.dispatchEvent(new CustomEvent("atlas:currency", {
        detail: { code: AtlasCurrency.code(), rates: rates, stale: stale }
      }));
    } catch (e) {}
  }

  /* ---------- API ---------- */

  var AtlasCurrency = {
    codes: Object.keys(META),
    meta: function (c) { return META[c || AtlasCurrency.code()]; },

    code: function () {
      return (window.AtlasSettings && window.AtlasSettings.get("currency")) || "USD";
    },

    symbol: function (c) {
      var m = META[c || AtlasCurrency.code()];
      return m ? m.symbol : "$";
    },

    label: function (c) {
      var code = c || AtlasCurrency.code();
      var m = META[code];
      if (!m) return code;
      var en = window.AtlasI18n && window.AtlasI18n.lang() === "en";
      return code + " — " + (en ? m.nameEn : m.name);
    },

    rate: function (c) {
      var code = c || AtlasCurrency.code();
      if (!rates) loadCache();
      if (!rates) rates = FALLBACK;
      var r = rates[code];
      return isFinite(r) && r > 0 ? r : (FALLBACK[code] || 1);
    },

    convert: function (value, from, to) {
      var v = Number(value);
      if (!isFinite(v)) return 0;
      var f = AtlasCurrency.rate(from || "USD");
      var t = AtlasCurrency.rate(to || AtlasCurrency.code());
      return v / f * t;
    },

    fromUSD: function (vUSD) { return AtlasCurrency.convert(vUSD, "USD", AtlasCurrency.code()); },
    toUSD:   function (v)    { return AtlasCurrency.convert(v, AtlasCurrency.code(), "USD"); },

    /* Formata um valor guardado em USD na moeda de exibição. */
    format: function (valueUSD, opts) {
      opts = opts || {};
      if (valueUSD == null || !isFinite(Number(valueUSD))) return "—";
      var code = opts.currency || AtlasCurrency.code();
      var v = (opts.raw === true) ? Number(valueUSD)
                                  : AtlasCurrency.convert(valueUSD, "USD", code);
      if (!isFinite(v)) return "—";

      var decimals = (opts.decimals != null) ? opts.decimals
                   : (Math.abs(v) >= 1000 ? 0 : 2);
      var locale = (window.AtlasSettings && window.AtlasSettings.locale()) || "pt-BR";

      try {
        return v.toLocaleString(locale, {
          style: "currency",
          currency: code,
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });
      } catch (e) {
        return AtlasCurrency.symbol(code) + " " + v.toFixed(decimals);
      }
    },

    /* Versão curta para KPIs: R$ 1,2 mi */
    compact: function (valueUSD, opts) {
      opts = opts || {};
      if (valueUSD == null || !isFinite(Number(valueUSD))) return "—";
      var code = opts.currency || AtlasCurrency.code();
      var v = AtlasCurrency.convert(valueUSD, "USD", code);
      if (!isFinite(v)) return "—";

      var en = (window.AtlasSettings && window.AtlasSettings.get("lang") === "en");
      var abs = Math.abs(v), sign = v < 0 ? "-" : "";
      var units = en
        ? [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]]
        : [[1e12, " tri"], [1e9, " bi"], [1e6, " mi"], [1e3, " mil"]];

      for (var i = 0; i < units.length; i++) {
        if (abs >= units[i][0]) {
          var n = abs / units[i][0];
          return sign + prefixo(code) + " " +
                 n.toFixed(n < 10 ? 1 : 0).replace(".", en ? "." : ",") + units[i][1];
        }
      }
      return AtlasCurrency.format(valueUSD, { currency: code });
    },

    isStale: function () { return stale; },
    updatedAt: function () { return fetchedAt ? new Date(fetchedAt) : null; },
    ready: function () { return refresh(false); },
    refresh: refresh,

    on: function (fn) { if (typeof fn === "function") listeners.push(fn); return fn; },
    off: function (fn) { var i = listeners.indexOf(fn); if (i !== -1) listeners.splice(i, 1); }
  };

  loadCache();
  if (!rates) rates = FALLBACK;

  // Busca o câmbio sem travar o carregamento da interface.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { refresh(false); });
  } else {
    setTimeout(function () { refresh(false); }, 0);
  }

  // Trocar de moeda repinta a interface (os módulos reagem ao evento).
  if (window.AtlasSettings) {
    window.AtlasSettings.on(function (changed) {
      if (changed.indexOf("currency") !== -1) { refresh(false); emit(); }
    });
  }

  window.AtlasCurrency = AtlasCurrency;
})();
