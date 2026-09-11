/* ============================================================
   ATLAS · academy/js/dashboard.js
   Tela inicial — command center de mercado.
   window.renderDashboard(el)

   Faixa de mercado (BTC/ETH/SOL/PAXG + market cap, dominância,
   volume, Fear & Greed) e 5 painéis: tokens em alta, RWAs em alta,
   maiores quedas, volume anormal, categorias.

   Cada painel tem 3 estados: carregando / dado / indisponível. Campo
   sem dado nunca é inventado. Auto-refresh a cada 60s enquanto a home
   estiver aberta (limpo ao sair pela rota).
   ============================================================ */
(function () {
  "use strict";

  /* ---------- formatação ---------- */
  function fmtMoney(v) {
    if (v == null || !isFinite(v)) return "indisponível";
    var abs = Math.abs(v);
    if (abs >= 1e12) return "$" + (v / 1e12).toFixed(2) + "T";
    if (abs >= 1e9)  return "$" + (v / 1e9).toFixed(2) + "B";
    if (abs >= 1e6)  return "$" + (v / 1e6).toFixed(2) + "M";
    if (abs >= 1)    return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 2 });
    return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 6 });
  }
  function fmtBig(v) {
    if (v == null || !isFinite(v)) return "indisponível";
    var abs = Math.abs(v);
    if (abs >= 1e12) return "$" + (v / 1e12).toFixed(2) + "T";
    if (abs >= 1e9)  return "$" + (v / 1e9).toFixed(1) + "B";
    if (abs >= 1e6)  return "$" + (v / 1e6).toFixed(1) + "M";
    return "$" + Math.round(v).toLocaleString("en-US");
  }
  function fmtPct(v) {
    if (v == null || !isFinite(v)) return "—";
    return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
  }
  function pctClass(v) { return v == null ? "" : (v >= 0 ? "up" : "down"); }

  /* ---------- DOM helpers ---------- */
  function h(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  /* ---------- faixa de mercado ---------- */
  function tile(label, valueNode, sub, subClass) {
    var t = h("div", "mkt-tile");
    t.appendChild(h("span", "mkt-label", label));
    var v = h("div", "mkt-value");
    v.appendChild(valueNode);
    t.appendChild(v);
    if (sub != null) {
      var s = h("span", "mkt-sub " + (subClass || ""), sub);
      t.appendChild(s);
    }
    return t;
  }

  function renderStrip(strip) {
    while (strip.firstChild) strip.removeChild(strip.firstChild);
    var live = h("div", "mkt-tile mkt-live");
    var dot = h("span", "live-dot");
    live.appendChild(dot);
    live.appendChild(h("span", "mkt-live-txt", "MERCADO AO VIVO"));
    strip.appendChild(live);

    // placeholders enquanto carrega
    ["BTC", "ETH", "SOL", "PAXG"].forEach(function (s) {
      strip.appendChild(tile(s, h("span", null, "…"), "", ""));
    });
    strip.appendChild(tile("Market Cap", h("span", null, "…")));
    strip.appendChild(tile("Domin. BTC", h("span", null, "…")));
    strip.appendChild(tile("Volume 24h", h("span", null, "…")));
    strip.appendChild(tile("Fear & Greed", h("span", null, "…")));

    Promise.all([
      AcademyData.ticker().catch(function () { return []; }),
      AcademyData.global().catch(function () { return null; }),
      AcademyData.feargreed().catch(function () { return null; })
    ]).then(function (r) {
      var tk = r[0] || [], g = r[1], fg = r[2];
      while (strip.firstChild) strip.removeChild(strip.firstChild);
      strip.appendChild(live);
      tk.forEach(function (a) {
        var val = h("span", null, fmtMoney(a.usd));
        strip.appendChild(tile(a.symbol, val, fmtPct(a.change24h), pctClass(a.change24h)));
      });
      strip.appendChild(tile("Market Cap", h("span", null, g ? fmtBig(g.marketCap) : "indisponível")));
      strip.appendChild(tile("Domin. BTC", h("span", null, g && g.btcDominance != null ? g.btcDominance.toFixed(1) + "%" : "indisponível")));
      strip.appendChild(tile("Volume 24h", h("span", null, g ? fmtBig(g.volume24h) : "indisponível")));
      if (fg) {
        var fgVal = h("span", null, String(fg.value));
        strip.appendChild(tile("Fear & Greed", fgVal, fg.label, fg.value >= 50 ? "up" : "down"));
      } else {
        strip.appendChild(tile("Fear & Greed", h("span", null, "indisponível")));
      }
    });
  }

  /* ---------- painel genérico ---------- */
  // cols: ex. [{key:'usd',fmt:fmtMoney,cls:''}, ...]
  function assetRow(row) {
    var r = h("button", "asset-row");
    r.type = "button";
    var badge = h("span", "asset-badge");
    if (row.image) {
      var img = document.createElement("img");
      img.src = row.image; img.alt = row.symbol; img.loading = "lazy";
      badge.appendChild(img);
    } else {
      badge.textContent = (row.symbol || "?").slice(0, 3);
    }
    var idb = h("span", "asset-id");
    idb.appendChild(h("span", "asset-sym", row.symbol || "?"));
    idb.appendChild(h("span", "asset-name", row.name || ""));
    r.appendChild(badge);
    r.appendChild(idb);
    r.appendChild(h("span", "asset-price", fmtMoney(row.usd)));
    r.appendChild(h("span", "asset-chg " + pctClass(row.change24h), fmtPct(row.change24h)));
    r.appendChild(h("span", "asset-vol", fmtBig(row.volume24h)));
    r.addEventListener("click", function () {
      window.__academyAssetHint = { id: row.id, symbol: row.symbol };
      AcademyRouter.go("/ativo/" + row.id);
    });
    return r;
  }

  function categoryRow(cat) {
    var r = h("div", "cat-row");
    r.appendChild(h("span", "cat-name", cat.name || "—"));
    r.appendChild(h("span", "cat-chg " + pctClass(cat.change24h), fmtPct(cat.change24h)));
    return r;
  }

  function panel(title, hint, loader, rowFn) {
    var p = h("section", "panel");
    var head = h("div", "panel-head");
    head.appendChild(h("h2", "panel-title", title));
    if (hint) head.appendChild(h("span", "panel-hint", hint));
    p.appendChild(head);
    var body = h("div", "panel-body");
    p.appendChild(body);

    function load() {
      while (body.firstChild) body.removeChild(body.firstChild);
      body.appendChild(h("div", "panel-loading", "Carregando…"));
      loader().then(function (rows) {
        while (body.firstChild) body.removeChild(body.firstChild);
        if (!rows || !rows.length) {
          body.appendChild(unavailable(load));
          return;
        }
        rows.forEach(function (row) { body.appendChild(rowFn(row)); });
      }).catch(function () {
        while (body.firstChild) body.removeChild(body.firstChild);
        body.appendChild(unavailable(load));
      });
    }
    load();
    return p;
  }

  function unavailable(retry) {
    var box = h("div", "panel-empty");
    box.appendChild(h("span", "panel-empty-txt", "indisponível"));
    var btn = h("button", "panel-retry", "tentar de novo");
    btn.type = "button";
    btn.addEventListener("click", retry);
    box.appendChild(btn);
    return box;
  }

  /* ---------- render principal ---------- */
  window.renderDashboard = function (el) {
    var wrap = h("div", "dash");

    var strip = h("div", "mkt-strip");
    wrap.appendChild(strip);
    renderStrip(strip);

    var grid = h("div", "panel-grid");
    grid.appendChild(panel("Tokens em alta", "24h", function () { return AcademyData.gainers(); }, assetRow));
    grid.appendChild(panel("RWAs em alta", "tokenizados", function () { return AcademyData.rwa(); }, assetRow));
    grid.appendChild(panel("Maiores quedas", "24h", function () { return AcademyData.losers(); }, assetRow));
    grid.appendChild(panel("Volume anormal", "vol/mcap", function () { return AcademyData.abnormalVolume(); }, assetRow));
    grid.appendChild(panel("Categorias", "setores 24h", function () { return AcademyData.categories(); }, categoryRow));
    wrap.appendChild(grid);

    el.appendChild(wrap);

    // auto-refresh a cada 60s enquanto a home estiver na tela
    var timer = setInterval(function () {
      if (!document.body.contains(strip)) { clearInterval(timer); return; }
      renderStrip(strip);
    }, 60000);
    window.__academyOnLeave = function () { clearInterval(timer); };
  };
})();
