/* ============================================================
   ATLAS · core/providers/hyperliquid.js   (26/11/2026)
   API pública da Hyperliquid, sem chave e com CORS aberto.

     POST https://api.hyperliquid.xyz/info  {"type":"metaAndAssetCtxs"}
       -> [meta, contextos]; cada contexto traz dayNtlVlm (volume em
          dólar das últimas 24 h daquele mercado de perpétuos).

   Existe porque o volume de perpétuos da DefiLlama passou a ser pago
   (HTTP 402) e a Hyperliquid é a maior corretora DeFi em volume.
   O AtlasHttp só faz GET, então este provedor usa fetch direto, com
   tempo-limite e cache em memória de 5 minutos.
   ============================================================ */
(function () {
  "use strict";
  if (!window.AtlasProviders) return;
  if (window.AtlasProviders.get("hyperliquid")) return;

  var URL = "https://api.hyperliquid.xyz/info";
  var memo = null;

  function postar(corpo, timeout) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, timeout || 10000) : null;
    return fetch(URL, { method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(corpo), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (t) clearTimeout(t); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); },
            function (e) { if (t) clearTimeout(t); throw e; });
  }

  var Hyperliquid = {
    capabilities: ["volumePerps"],

    /* { total24h, mercados } — soma do volume de todos os perpétuos. */
    volumePerps: function () {
      if (memo && Date.now() - memo.t < 300000) return memo.p;
      var p = postar({ type: "metaAndAssetCtxs" }).then(function (d) {
        var ctx = Array.isArray(d) && Array.isArray(d[1]) ? d[1] : [];
        var total = ctx.reduce(function (s, c) { var v = Number(c && c.dayNtlVlm); return s + (isFinite(v) ? v : 0); }, 0);
        return total > 0 ? { total24h: total, mercados: ctx.length } : null;
      });
      memo = { t: Date.now(), p: p };
      p.catch(function () { if (memo && memo.p === p) memo = null; });
      return p;
    }
  };

  window.AtlasProviders.register("hyperliquid", Hyperliquid);
})();
