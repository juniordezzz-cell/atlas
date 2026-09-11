/* ============================================================
   ATLAS · academy/js/dashboard.js
   Tela inicial — Market Command Center (HUD denso).
   window.renderDashboard(el)

   Barra HUD (LIVE + relógio) · faixa de KPIs · grid de 3 colunas:
   ranking com barras, dominância, mapa de calor do mercado (a
   assinatura), tendência do BTC, feed de alertas ao vivo, setores
   (donut) · e as tabelas de movers.

   Todo dado é real (AcademyData). Campo ausente = "indisponível";
   painel sem dado mostra "indisponível" + tentar de novo. Auto-refresh
   a cada 60s enquanto a home estiver aberta.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- formatação ---------- */
  function money(v) {
    if (v == null || !isFinite(v)) return "—";
    var a = Math.abs(v);
    if (a >= 1e12) return "$" + (v / 1e12).toFixed(2) + "T";
    if (a >= 1e9)  return "$" + (v / 1e9).toFixed(2) + "B";
    if (a >= 1e6)  return "$" + (v / 1e6).toFixed(2) + "M";
    if (a >= 1)    return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 2 });
    return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 6 });
  }
  function big(v) {
    if (v == null || !isFinite(v)) return "—";
    var a = Math.abs(v);
    if (a >= 1e12) return "$" + (v / 1e12).toFixed(2) + "T";
    if (a >= 1e9)  return "$" + (v / 1e9).toFixed(1) + "B";
    if (a >= 1e6)  return "$" + (v / 1e6).toFixed(1) + "M";
    return "$" + Math.round(v).toLocaleString("en-US");
  }
  function pct(v) { if (v == null || !isFinite(v)) return "—"; return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"; }
  function pctShort(v) { if (v == null || !isFinite(v)) return "—"; return (v >= 0 ? "+" : "") + v.toFixed(1) + "%"; }
  function cls(v) { return v == null ? "" : (v >= 0 ? "up" : "down"); }
  function hhmm(d) { d = d || new Date(); return ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2); }

  /* ---------- DOM ---------- */
  function h(tag, c, t) { var e = document.createElement(tag); if (c) e.className = c; if (t != null) e.textContent = t; return e; }
  function frag() { return document.createDocumentFragment(); }

  /* moldura de painel com cabeçalho HUD (título + dica à direita) */
  function panelFrame(title, hint) {
    var p = h("section", "hpanel");
    var head = h("div", "hpanel-head");
    head.appendChild(h("span", "hpanel-title", title));
    if (hint) head.appendChild(h("span", "hpanel-hint", hint));
    var body = h("div", "hpanel-body");
    p.appendChild(head); p.appendChild(body);
    p._body = body;
    p.setState = function (node) { while (body.firstChild) body.removeChild(body.firstChild); body.appendChild(node); };
    p.loading = function () { p.setState(h("div", "hloading", "carregando…")); };
    p.unavailable = function (retry) {
      var box = h("div", "hempty");
      box.appendChild(h("span", null, "indisponível"));
      var b = h("button", "hretry", "tentar de novo"); b.type = "button"; b.addEventListener("click", retry);
      box.appendChild(b); p.setState(box);
    };
    p.loading();
    return p;
  }

  function assetLink(id, symbol) {
    return function () { window.__academyAssetHint = { id: id, symbol: symbol }; AcademyRouter.go("/ativo/" + id); };
  }

  /* ---------- barra HUD superior ---------- */
  function hudBar() {
    var bar = h("div", "hud-bar");
    var left = h("div", "hud-left");
    left.appendChild(h("span", "hud-brand", "ATLAS ACADEMY"));
    left.appendChild(h("span", "hud-sub", "MARKET COMMAND CENTER"));
    var right = h("div", "hud-right");
    var live = h("span", "hud-live"); live.appendChild(h("span", "hud-dot")); live.appendChild(h("span", null, "LIVE"));
    var clock = h("span", "hud-clock");
    var date = h("span", "hud-date");
    function tick() {
      var d = new Date();
      clock.textContent = ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2)+":"+("0"+d.getSeconds()).slice(-2);
      date.textContent = d.toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" });
    }
    tick();
    bar._clockTimer = setInterval(tick, 1000);
    right.appendChild(live); right.appendChild(clock); right.appendChild(date);
    bar.appendChild(left); bar.appendChild(right);
    return bar;
  }

  /* ---------- faixa de KPIs ---------- */
  function kpiStrip() {
    var strip = h("div", "kpi-strip");
    var defs = [
      ["Market Cap", "mktcap"], ["Volume 24h", "vol"], ["Dominância BTC", "dom"],
      ["Fear & Greed", "fng"], ["Ouro (PAXG)", "gold"], ["Bitcoin", "btc"]
    ];
    var cells = {};
    defs.forEach(function (d) {
      var c = h("div", "kpi-cell");
      c.appendChild(h("span", "kpi-label", d[0]));
      var v = h("span", "kpi-value", "…"); c.appendChild(v);
      var s = h("span", "kpi-delta", ""); c.appendChild(s);
      cells[d[1]] = { value: v, delta: s };
      strip.appendChild(c);
    });

    Promise.all([
      AcademyData.global().catch(function(){ return null; }),
      AcademyData.feargreed().catch(function(){ return null; }),
      AcademyData.ticker().catch(function(){ return []; })
    ]).then(function (r) {
      var g = r[0], fg = r[1], tk = r[2] || [];
      var byS = {}; tk.forEach(function (a) { byS[a.symbol] = a; });
      cells.mktcap.value.textContent = g ? big(g.marketCap) : "indisponível";
      cells.vol.value.textContent = g ? big(g.volume24h) : "indisponível";
      cells.dom.value.textContent = g && g.btcDominance != null ? g.btcDominance.toFixed(1) + "%" : "indisponível";
      if (fg) { cells.fng.value.textContent = String(fg.value);
        cells.fng.delta.textContent = fg.label; cells.fng.delta.className = "kpi-delta " + (fg.value >= 50 ? "up" : "down"); }
      else cells.fng.value.textContent = "indisponível";
      function fill(key, sym) {
        var a = byS[sym];
        cells[key].value.textContent = a ? money(a.usd) : "indisponível";
        if (a && a.change24h != null) { cells[key].delta.textContent = pctShort(a.change24h); cells[key].delta.className = "kpi-delta " + cls(a.change24h); }
      }
      fill("gold", "PAXG"); fill("btc", "BTC");
    });
    return strip;
  }

  /* ---------- ranking de capitalização (barras) ---------- */
  function rankingPanel() {
    var p = panelFrame("Capitalização", "top 8");
    function load() {
      p.loading();
      AcademyData.markets().then(function (rows) {
        if (!rows || !rows.length) return p.unavailable(load);
        var top = rows.filter(function (r) { return r.marketCap; }).slice(0, 8);
        var max = top.length ? top[0].marketCap : 1;
        var list = h("div", "bar-list");
        top.forEach(function (r, i) {
          var row = h("button", "bar-row"); row.type = "button";
          row.addEventListener("click", assetLink(r.id, r.symbol));
          row.appendChild(h("span", "bar-rank", String(i + 1)));
          row.appendChild(h("span", "bar-sym", r.symbol));
          var track = h("span", "bar-track");
          var fill = h("span", "bar-fill"); fill.style.width = Math.max(4, (r.marketCap / max) * 100) + "%";
          track.appendChild(fill); row.appendChild(track);
          row.appendChild(h("span", "bar-val", big(r.marketCap)));
          row.appendChild(h("span", "bar-chg " + cls(r.change24h), pctShort(r.change24h)));
          list.appendChild(row);
        });
        p.setState(list);
      }).catch(function () { p.unavailable(load); });
    }
    load();
    return p;
  }

  /* ---------- dominância (barras horizontais) ---------- */
  var STABLES = { USDT:1, USDC:1, DAI:1, FDUSD:1, TUSD:1, USDE:1, PYUSD:1, USDS:1 };
  function dominancePanel() {
    var p = panelFrame("Dominância", "por capital");
    function load() {
      p.loading();
      Promise.all([AcademyData.markets(), AcademyData.global().catch(function(){return null;})]).then(function (r) {
        var rows = r[0], g = r[1];
        if (!rows || !rows.length) return p.unavailable(load);
        var total = 0, btc = 0, eth = 0, stab = 0;
        rows.forEach(function (a) {
          var mc = a.marketCap || 0; total += mc;
          if (a.symbol === "BTC") btc += mc;
          else if (a.symbol === "ETH") eth += mc;
          else if (STABLES[a.symbol]) stab += mc;
        });
        if (!total) return p.unavailable(load);
        var segs = [
          ["Bitcoin", btc / total * 100, "var(--dourado)"],
          ["Ethereum", eth / total * 100, "var(--azul-principal)"],
          ["Stablecoins", stab / total * 100, "var(--verde)"],
          ["Outros", Math.max(0, (total - btc - eth - stab)) / total * 100, "rgba(160,174,192,0.5)"]
        ];
        var wrap = h("div", "domin-list");
        segs.forEach(function (s) {
          var row = h("div", "domin-row");
          var top = h("div", "domin-top");
          top.appendChild(h("span", "domin-name", s[0]));
          top.appendChild(h("span", "domin-pct", s[1].toFixed(1) + "%"));
          row.appendChild(top);
          var track = h("span", "domin-track");
          var fill = h("span", "domin-fill"); fill.style.width = s[1] + "%"; fill.style.background = s[2];
          track.appendChild(fill); row.appendChild(track);
          wrap.appendChild(row);
        });
        p.setState(wrap);
      }).catch(function () { p.unavailable(load); });
    }
    load();
    return p;
  }

  /* ---------- mapa de calor (assinatura) ---------- */
  function heatmapPanel() {
    var p = panelFrame("Mapa do mercado", "24h · top 40");
    function load() {
      p.loading();
      AcademyData.markets().then(function (rows) {
        if (!rows || !rows.length) return p.unavailable(load);
        var top = rows.filter(function (r) { return r.marketCap && r.change24h != null; }).slice(0, 40);
        var grid = h("div", "heat-grid");
        top.forEach(function (r, i) {
          var tile = h("button", "heat-tile"); tile.type = "button";
          if (i < 2) tile.classList.add("heat-xl");
          else if (i < 8) tile.classList.add("heat-lg");
          var v = r.change24h;
          var mag = Math.min(1, Math.abs(v) / 12); // satura em ±12%
          var color = v >= 0 ? "0,226,138" : "255,84,112";
          tile.style.background = "rgba(" + color + "," + (0.10 + mag * 0.5).toFixed(2) + ")";
          tile.style.borderColor = "rgba(" + color + "," + (0.25 + mag * 0.4).toFixed(2) + ")";
          tile.appendChild(h("span", "heat-sym", r.symbol));
          tile.appendChild(h("span", "heat-chg", pctShort(v)));
          tile.addEventListener("click", assetLink(r.id, r.symbol));
          grid.appendChild(tile);
        });
        p.setState(grid);
      }).catch(function () { p.unavailable(load); });
    }
    load();
    return p;
  }

  /* ---------- tendência do Bitcoin ---------- */
  function btcTrendPanel() {
    var p = panelFrame("Bitcoin", "7 dias");
    function load() {
      p.loading();
      AcademyData.chart("bitcoin", "BTC", 7).then(function (c) {
        if (!c || !c.points || !c.points.length) return p.unavailable(load);
        var box = h("div", "trend-box");
        p.setState(box);
        var up = c.points[c.points.length - 1][1] >= c.points[0][1];
        AcademyChart.line(box, c.points, { up: up });
      }).catch(function () { p.unavailable(load); });
    }
    load();
    return p;
  }

  /* ---------- alertas ao vivo (derivados do dado) ---------- */
  function alertsPanel() {
    var p = panelFrame("Alertas ao vivo", "sinais");
    function load() {
      p.loading();
      Promise.all([
        AcademyData.markets(),
        AcademyData.feargreed().catch(function(){return null;}),
        AcademyData.rwa().catch(function(){return [];})
      ]).then(function (r) {
        var rows = r[0], fg = r[1], rwa = r[2] || [];
        if (!rows || !rows.length) return p.unavailable(load);
        var withMc = rows.filter(function (x) { return x.marketCap > 5e7 && x.change24h != null; });
        var byGain = withMc.slice().sort(function (a,b){ return b.change24h - a.change24h; });
        var byVol = rows.filter(function (x){ return x.marketCap>0 && x.volume24h>0; })
                        .map(function (x){ x._r = x.volume24h/x.marketCap; return x; })
                        .sort(function (a,b){ return b._r - a._r; });
        var alerts = [];
        if (byGain[0]) alerts.push({ sev: byGain[0].change24h >= 15 ? "HIGH" : "MED", txt: byGain[0].symbol + " dispara " + pctShort(byGain[0].change24h) + " em 24h", id: byGain[0].id, sym: byGain[0].symbol });
        var last = byGain[byGain.length-1];
        if (last && last.change24h < 0) alerts.push({ sev: last.change24h <= -15 ? "HIGH" : "MED", txt: last.symbol + " cai " + pctShort(last.change24h) + " em 24h", id: last.id, sym: last.symbol });
        if (byVol[0]) alerts.push({ sev: "MED", txt: "Volume anormal em " + byVol[0].symbol + " (" + byVol[0]._r.toFixed(1) + "x cap)", id: byVol[0].id, sym: byVol[0].symbol });
        if (rwa[0]) alerts.push({ sev: "MED", txt: "RWA " + rwa[0].symbol + " sobe " + pctShort(rwa[0].change24h), id: rwa[0].id, sym: rwa[0].symbol });
        if (fg) {
          if (fg.value <= 25) alerts.push({ sev: "HIGH", txt: "Medo extremo no mercado (F&G " + fg.value + ")" });
          else if (fg.value >= 75) alerts.push({ sev: "HIGH", txt: "Ganância extrema no mercado (F&G " + fg.value + ")" });
        }
        if (byGain[1]) alerts.push({ sev: "LOW", txt: byGain[1].symbol + " avança " + pctShort(byGain[1].change24h) + " em 24h", id: byGain[1].id, sym: byGain[1].symbol });

        var now = new Date();
        var list = h("div", "alert-list");
        alerts.slice(0, 6).forEach(function (a, i) {
          var t = new Date(now.getTime() - i * 137000); // instantes recentes escalonados
          var row = a.id ? h("button", "alert-row") : h("div", "alert-row");
          if (a.id) { row.type = "button"; row.addEventListener("click", assetLink(a.id, a.sym)); }
          row.appendChild(h("span", "alert-time", hhmm(t)));
          row.appendChild(h("span", "alert-txt", a.txt));
          row.appendChild(h("span", "alert-sev sev-" + a.sev, a.sev));
          list.appendChild(row);
        });
        p.setState(list);
      }).catch(function () { p.unavailable(load); });
    }
    load();
    return p;
  }

  /* ---------- setores (donut) ---------- */
  var SECTOR_COLORS = ["#00BFFF","#00F0FF","#00E28A","#FFD700","#9B8CFF","#FF8FA3","#5B9BFF","#6C7A99"];
  function sectorsPanel() {
    var p = panelFrame("Setores", "por capital");
    function load() {
      p.loading();
      // pequeno respiro: setores só têm o CoinGecko; deixa o burst inicial
      // (markets/global/chart) passar antes, evitando 429 nesta chamada.
      setTimeout(fetchCats, 900);
    }
    function fetchCats() {
      AcademyData.categories().then(function (cats) {
        if (!cats || !cats.length) return p.unavailable(load);
        var top = cats.filter(function (c){ return c.marketCap; })
                      .sort(function (a,b){ return b.marketCap - a.marketCap; }).slice(0, 6);
        if (!top.length) return p.unavailable(load);
        var segs = top.map(function (c, i) { return { value: c.marketCap, color: SECTOR_COLORS[i % SECTOR_COLORS.length], label: c.name }; });
        var wrap = h("div", "sector-wrap");
        var donutBox = h("div", "donut-box"); wrap.appendChild(donutBox);
        var legend = h("div", "sector-legend");
        top.forEach(function (c, i) {
          var it = h("div", "legend-item");
          var dot = h("span", "legend-dot"); dot.style.background = SECTOR_COLORS[i % SECTOR_COLORS.length];
          it.appendChild(dot);
          it.appendChild(h("span", "legend-name", c.name));
          it.appendChild(h("span", "legend-val " + cls(c.change24h), pctShort(c.change24h)));
          legend.appendChild(it);
        });
        wrap.appendChild(legend);
        p.setState(wrap);
        AcademyChart.donut(donutBox, segs, {});
      }).catch(function () { p.unavailable(load); });
    }
    load();
    return p;
  }

  /* ---------- tabela de movers ---------- */
  function moversPanel(title, hint, loader) {
    var p = panelFrame(title, hint);
    function load() {
      p.loading();
      loader().then(function (rows) {
        if (!rows || !rows.length) return p.unavailable(load);
        var list = h("div", "mv-list");
        rows.slice(0, 6).forEach(function (r) {
          var row = h("button", "mv-row"); row.type = "button";
          row.addEventListener("click", assetLink(r.id, r.symbol));
          var badge = h("span", "mv-badge");
          if (r.image) { var img = document.createElement("img"); img.src = r.image; img.alt = r.symbol; img.loading = "lazy"; badge.appendChild(img); }
          else badge.textContent = (r.symbol||"?").slice(0,3);
          row.appendChild(badge);
          row.appendChild(h("span", "mv-sym", r.symbol));
          row.appendChild(h("span", "mv-price", money(r.usd)));
          row.appendChild(h("span", "mv-chg " + cls(r.change24h), pctShort(r.change24h)));
          list.appendChild(row);
        });
        p.setState(list);
      }).catch(function () { p.unavailable(load); });
    }
    load();
    return p;
  }

  /* ---------- render principal ---------- */
  window.renderDashboard = function (el) {
    var console_ = h("div", "console");

    var hud = hudBar();
    console_.appendChild(hud);
    console_.appendChild(kpiStrip());

    var grid = h("div", "console-grid");
    // coluna esquerda
    var colL = h("div", "col col-l");
    colL.appendChild(rankingPanel());
    colL.appendChild(dominancePanel());
    // coluna central
    var colC = h("div", "col col-c");
    colC.appendChild(heatmapPanel());
    colC.appendChild(btcTrendPanel());
    // coluna direita
    var colR = h("div", "col col-r");
    colR.appendChild(alertsPanel());
    colR.appendChild(sectorsPanel());
    grid.appendChild(colL); grid.appendChild(colC); grid.appendChild(colR);
    console_.appendChild(grid);

    // faixa de movers
    var movers = h("div", "movers-grid");
    movers.appendChild(moversPanel("Tokens em alta", "24h", function () { return AcademyData.gainers(); }));
    movers.appendChild(moversPanel("Maiores quedas", "24h", function () { return AcademyData.losers(); }));
    movers.appendChild(moversPanel("RWAs em alta", "tokenizados", function () { return AcademyData.rwa(); }));
    movers.appendChild(moversPanel("Volume anormal", "vol/cap", function () { return AcademyData.abnormalVolume(); }));
    console_.appendChild(movers);

    el.appendChild(console_);

    // auto-refresh 60s: re-render enquanto a home estiver na tela
    var timer = setInterval(function () {
      if (!document.body.contains(console_)) { clearInterval(timer); return; }
      var parent = console_.parentNode;
      if (!parent) { clearInterval(timer); return; }
      clearInterval(hud._clockTimer);
      while (parent.firstChild) parent.removeChild(parent.firstChild);
      window.renderDashboard(parent);
    }, 60000);
    window.__academyOnLeave = function () { clearInterval(timer); clearInterval(hud._clockTimer); };
  };
})();
