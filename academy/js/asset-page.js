/* ============================================================
   ATLAS · academy/js/asset-page.js
   Página dedicada do ativo — window.renderAsset(el, id)

   Topo (logo, nome, símbolo, selo, preço, %24h) + gráfico com
   seletor de período + variações por janela + ATH/ATL, e abas:
   Mercado · Dados · On-chain · Fundamentos · Sobre.

   Regra: campo nulo vira "indisponível". Nunca inventa dado.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- formatação ---------- */
  function money(v) {
    if (v == null || !isFinite(v)) return "indisponível";
    var abs = Math.abs(v);
    if (abs >= 1e12) return "$" + (v / 1e12).toFixed(2) + "T";
    if (abs >= 1e9)  return "$" + (v / 1e9).toFixed(2) + "B";
    if (abs >= 1e6)  return "$" + (v / 1e6).toFixed(2) + "M";
    if (abs >= 1)    return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 2 });
    return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 6 });
  }
  function big(v) {
    if (v == null || !isFinite(v)) return "indisponível";
    var abs = Math.abs(v);
    if (abs >= 1e12) return "$" + (v / 1e12).toFixed(2) + "T";
    if (abs >= 1e9)  return "$" + (v / 1e9).toFixed(1) + "B";
    if (abs >= 1e6)  return "$" + (v / 1e6).toFixed(1) + "M";
    return "$" + Math.round(v).toLocaleString("en-US");
  }
  function num(v) {
    if (v == null || !isFinite(v)) return "indisponível";
    return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  function pct(v) {
    if (v == null || !isFinite(v)) return "—";
    return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
  }
  function pctClass(v) { return v == null ? "" : (v >= 0 ? "up" : "down"); }
  function dateBR(iso) {
    if (!iso) return null;
    var d = new Date(iso); if (isNaN(d)) return null;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  }

  /* ---------- DOM helpers ---------- */
  function h(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function val(x, fmt) {
    // exibe "indisponível" quando o dado não existe — nunca inventa
    if (x == null) return "indisponível";
    return fmt ? fmt(x) : String(x);
  }

  /* mapa chain -> explorador (link do contrato). Chains conhecidas; as
     demais mostram o endereço sem link. */
  var EXPLORER = {
    ethereum: "https://etherscan.io/token/",
    "binance-smart-chain": "https://bscscan.com/token/",
    "polygon-pos": "https://polygonscan.com/token/",
    "arbitrum-one": "https://arbiscan.io/token/",
    optimism: "https://optimistic.etherscan.io/token/",
    avalanche: "https://snowtrace.io/token/",
    base: "https://basescan.org/token/",
    solana: "https://solscan.io/token/",
    tron: "https://tronscan.org/#/token20/"
  };
  var CHAIN_LABEL = {
    ethereum: "Ethereum", "binance-smart-chain": "BNB Chain", "polygon-pos": "Polygon",
    "arbitrum-one": "Arbitrum", optimism: "Optimism", avalanche: "Avalanche",
    base: "Base", solana: "Solana", tron: "Tron"
  };

  /* ---------- blocos reutilizáveis ---------- */
  function metric(label, value, cls) {
    var m = h("div", "metric");
    m.appendChild(h("span", "metric-label", label));
    m.appendChild(h("span", "metric-value " + (cls || ""), value));
    return m;
  }

  function grid(items) {
    var g = h("div", "metric-grid");
    items.forEach(function (it) { g.appendChild(metric(it[0], it[1], it[2])); });
    return g;
  }

  /* ---------- abas ---------- */
  function buildTabs(a) {
    var PERIODS = [[1, "24h"], [7, "7d"], [30, "30d"], [90, "3m"], [180, "6m"], [365, "1a"]];

    var wrap = h("div", "tabs");
    var nav = h("div", "tab-nav");
    var body = h("div", "tab-body");
    wrap.appendChild(nav);
    wrap.appendChild(body);

    var TABS = [
      ["Mercado", function () { return tabMercado(a); }],
      ["Dados", function () { return tabDados(a); }],
      ["On-chain", function () { return tabOnchain(a); }],
      ["Fundamentos", function () { return tabFundamentos(a); }],
      ["Sobre", function () { return tabSobre(a); }]
    ];

    var btns = [];
    TABS.forEach(function (t, i) {
      var b = h("button", "tab-btn" + (i === 0 ? " active" : ""), t[0]);
      b.type = "button";
      b.addEventListener("click", function () {
        btns.forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        while (body.firstChild) body.removeChild(body.firstChild);
        body.appendChild(t[1]());
      });
      btns.push(b);
      nav.appendChild(b);
    });
    body.appendChild(TABS[0][1]());
    return wrap;
  }

  function tabMercado(a) {
    var box = h("div");
    box.appendChild(grid([
      ["Market cap", val(a.marketCap, big)],
      ["Ranking", a.rank ? "#" + a.rank : "indisponível"],
      ["Volume 24h", val(a.volume24h, big)],
      ["FDV", val(a.fdv, big)]
    ]));
    var exWrap = h("div", "sub-block");
    exWrap.appendChild(h("h3", "sub-title", "Onde é negociado"));
    if (a.exchanges && a.exchanges.length) {
      var list = h("div", "ex-list");
      a.exchanges.slice(0, 12).forEach(function (e) {
        var row = e.url ? h("a", "ex-row") : h("div", "ex-row");
        if (e.url) { row.href = e.url; row.target = "_blank"; row.rel = "noopener"; }
        row.appendChild(h("span", "ex-name", e.name || "—"));
        row.appendChild(h("span", "ex-pair", e.pair || ""));
        list.appendChild(row);
      });
      exWrap.appendChild(list);
    } else {
      exWrap.appendChild(h("p", "muted", "indisponível"));
    }
    box.appendChild(exWrap);
    return box;
  }

  function tabDados(a) {
    var s = a.supply || {};
    return grid([
      ["Supply circulante", val(s.circulating, num)],
      ["Supply total", val(s.total, num)],
      ["Supply máximo", val(s.max, num)],
      ["Market cap", val(a.marketCap, big)],
      ["FDV", val(a.fdv, big)],
      ["Preço", val(a.usd, money)]
    ]);
  }

  function tabOnchain(a) {
    var box = h("div");
    if (a.platforms && a.platforms.length) {
      a.platforms.forEach(function (p) {
        var row = h("div", "chain-row");
        row.appendChild(h("span", "chain-name", CHAIN_LABEL[p.chain] || p.chain || "—"));
        var base = EXPLORER[p.chain];
        if (base && p.contract) {
          var link = h("a", "chain-addr", p.contract);
          link.href = base + p.contract; link.target = "_blank"; link.rel = "noopener";
          row.appendChild(link);
        } else {
          row.appendChild(h("span", "chain-addr", p.contract || "—"));
        }
        box.appendChild(row);
      });
    } else {
      box.appendChild(h("p", "muted", a.classification === "crypto"
        ? "Ativo nativo da própria rede — sem contrato de token." : "indisponível"));
    }
    var note = h("p", "muted small", "Holders e distribuição on-chain: indisponível nas fontes gratuitas.");
    box.appendChild(note);
    return box;
  }

  function tabFundamentos(a) {
    var box = h("div");
    box.appendChild(grid([
      ["Classificação", a.classification === "rwa" ? "RWA (tokenizado)" : "Cripto"],
      ["Ranking de mercado", a.rank ? "#" + a.rank : "indisponível"]
    ]));
    var catWrap = h("div", "sub-block");
    catWrap.appendChild(h("h3", "sub-title", "Categorias / setores"));
    if (a.categories && a.categories.length) {
      var chips = h("div", "chips");
      a.categories.slice(0, 16).forEach(function (c) { chips.appendChild(h("span", "chip", c)); });
      catWrap.appendChild(chips);
    } else {
      catWrap.appendChild(h("p", "muted", "indisponível"));
    }
    box.appendChild(catWrap);
    return box;
  }

  function tabSobre(a) {
    var box = h("div");
    var desc = h("div", "sub-block");
    desc.appendChild(h("h3", "sub-title", "Sobre o ativo"));
    if (a.description) {
      // description pode conter HTML da fonte — inserimos como TEXTO puro
      // (segurança: nunca innerHTML de conteúdo de API). Tags viram texto.
      var clean = String(a.description).replace(/<[^>]*>/g, "");
      desc.appendChild(h("p", "about-text", clean));
    } else {
      desc.appendChild(h("p", "muted", "indisponível"));
    }
    box.appendChild(desc);

    var links = a.links || {};
    var linkDefs = [
      ["Site oficial", links.homepage], ["Whitepaper", links.whitepaper],
      ["Twitter/X", links.twitter], ["Telegram", links.telegram],
      ["GitHub", links.github], ["Reddit", links.reddit]
    ].filter(function (l) { return l[1]; });
    var linkWrap = h("div", "sub-block");
    linkWrap.appendChild(h("h3", "sub-title", "Links oficiais"));
    if (linkDefs.length) {
      var list = h("div", "link-list");
      linkDefs.forEach(function (l) {
        var link = h("a", "link-pill", l[0]);
        link.href = l[1]; link.target = "_blank"; link.rel = "noopener";
        list.appendChild(link);
      });
      linkWrap.appendChild(list);
    } else {
      linkWrap.appendChild(h("p", "muted", "indisponível"));
    }
    box.appendChild(linkWrap);

    var risk = h("div", "sub-block");
    risk.appendChild(h("h3", "sub-title", "Risco e natureza"));
    risk.appendChild(h("p", "about-text", a.classification === "rwa"
      ? "Ativo do mundo real tokenizado — carrega risco do emissor/custódia além do risco de mercado e de contrato inteligente."
      : "Criptoativo — sujeito a alta volatilidade, risco de mercado, de liquidez e de contrato inteligente."));
    box.appendChild(risk);
    return box;
  }

  /* ---------- render principal ---------- */
  window.renderAsset = function (el, id) {
    // guarda o símbolo, se veio de um clique anterior (para fallback)
    var hintSym = window.__academyAssetHint && window.__academyAssetHint.id === id
      ? window.__academyAssetHint.symbol : null;

    var loading = h("div", "asset-loading", "Carregando ativo…");
    el.appendChild(loading);

    AcademyData.asset(id, hintSym).then(function (a) {
      while (el.firstChild) el.removeChild(el.firstChild);
      if (!a) {
        var err = h("div", "asset-error");
        err.appendChild(h("p", null, "Ativo indisponível."));
        var back = h("button", "panel-retry", "voltar ao mercado");
        back.type = "button";
        back.addEventListener("click", function () { AcademyRouter.go("/"); });
        err.appendChild(back);
        el.appendChild(err);
        return;
      }
      renderLoaded(el, a);
    }).catch(function () {
      while (el.firstChild) el.removeChild(el.firstChild);
      el.appendChild(h("div", "asset-error", "Ativo indisponível."));
    });
  };

  function renderLoaded(el, a) {
    var page = h("div", "asset-page");

    /* ----- topo ----- */
    var back = h("button", "asset-back", "‹ Mercado");
    back.type = "button";
    back.addEventListener("click", function () { AcademyRouter.go("/"); });
    page.appendChild(back);

    var head = h("div", "asset-head");
    var badge = h("div", "asset-logo");
    if (a.image) { var img = document.createElement("img"); img.src = a.image; img.alt = a.symbol; badge.appendChild(img); }
    else badge.textContent = (a.symbol || "?").slice(0, 3);
    head.appendChild(badge);

    var idcol = h("div", "asset-headinfo");
    var titleRow = h("div", "asset-titlerow");
    titleRow.appendChild(h("h1", "asset-h1", a.name || a.symbol || "—"));
    titleRow.appendChild(h("span", "asset-ticker", a.symbol || ""));
    var tag = h("span", "asset-tag " + (a.classification === "rwa" ? "rwa" : "crypto"),
                a.classification === "rwa" ? "RWA" : "Cripto");
    titleRow.appendChild(tag);
    idcol.appendChild(titleRow);

    var priceRow = h("div", "asset-pricerow");
    priceRow.appendChild(h("span", "asset-price-big", money(a.usd)));
    priceRow.appendChild(h("span", "asset-price-chg " + pctClass(a.change && a.change.h24), pct(a.change && a.change.h24)));
    idcol.appendChild(priceRow);
    head.appendChild(idcol);
    page.appendChild(head);

    /* ----- gráfico + seletor de período ----- */
    var chartCard = h("div", "chart-card");
    var chartTools = h("div", "chart-tools");
    var PERIODS = [[1, "24h"], [7, "7d"], [30, "30d"], [90, "3m"], [180, "6m"], [365, "1a"]];
    var chartBox = h("div", "chart-box");

    var periodBtns = [];
    function loadChart(days) {
      chartBox.textContent = "";
      var spin = h("div", "chart-empty", "carregando…");
      chartBox.appendChild(spin);
      AcademyData.chart(a.id, a.symbol, days).then(function (c) {
        chartBox.textContent = "";
        if (!c || !c.points || !c.points.length) { chartBox.appendChild(h("div", "chart-empty", "indisponível")); return; }
        var up = c.points[c.points.length - 1][1] >= c.points[0][1];
        AcademyChart.line(chartBox, c.points, { up: up });
      }).catch(function () { chartBox.textContent = ""; chartBox.appendChild(h("div", "chart-empty", "indisponível")); });
    }
    PERIODS.forEach(function (p, i) {
      var b = h("button", "period-btn" + (p[0] === 7 ? " active" : ""), p[1]);
      b.type = "button";
      b.addEventListener("click", function () {
        periodBtns.forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        loadChart(p[0]);
      });
      periodBtns.push(b);
      chartTools.appendChild(b);
    });
    chartCard.appendChild(chartTools);
    chartCard.appendChild(chartBox);
    page.appendChild(chartCard);
    loadChart(7);

    /* ----- variações por janela + ATH/ATL ----- */
    var ch = a.change || {};
    page.appendChild(grid([
      ["24h", pct(ch.h24), pctClass(ch.h24)],
      ["7 dias", pct(ch.d7), pctClass(ch.d7)],
      ["30 dias", pct(ch.d30), pctClass(ch.d30)],
      ["3 meses", pct(ch.m3), pctClass(ch.m3)],
      ["6 meses", pct(ch.m6), pctClass(ch.m6)],
      ["1 ano", pct(ch.y1), pctClass(ch.y1)]
    ]));

    var athatl = h("div", "athatl");
    var athBox = h("div", "athatl-box");
    athBox.appendChild(h("span", "athatl-label", "ATH (máxima histórica)"));
    athBox.appendChild(h("span", "athatl-val", money(a.ath)));
    var athSub = a.athDate ? ("em " + (dateBR(a.athDate) || "")) : "";
    if (a.ath && a.usd) { var d = ((a.usd - a.ath) / a.ath) * 100; athSub += "  ·  " + pct(d) + " desde então"; }
    athBox.appendChild(h("span", "athatl-sub " + (a.ath && a.usd && a.usd < a.ath ? "down" : "up"), athSub || "—"));
    athatl.appendChild(athBox);

    var atlBox = h("div", "athatl-box");
    atlBox.appendChild(h("span", "athatl-label", "ATL (mínima histórica)"));
    atlBox.appendChild(h("span", "athatl-val", money(a.atl)));
    var atlSub = a.atlDate ? ("em " + (dateBR(a.atlDate) || "")) : "";
    if (a.atl && a.usd) { var d2 = ((a.usd - a.atl) / a.atl) * 100; atlSub += "  ·  " + pct(d2) + " desde então"; }
    atlBox.appendChild(h("span", "athatl-sub up", atlSub || "—"));
    athatl.appendChild(atlBox);
    page.appendChild(athatl);

    /* ----- abas ----- */
    page.appendChild(buildTabs(a));

    el.appendChild(page);
  }
})();
