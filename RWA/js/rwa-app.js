/* ============================================================
   ATLAS · RWA — rwa-app.js  (reconstruído)
   Shell + Router + Views + Formulários em UM arquivo, blindado:
   - Qualquer erro aparece NA TELA (nunca mais tela branca muda)
   - Chart.js é opcional (CDN); sem ele a página renderiza igual
   - AtlasWallets e AtlasAssets são opcionais (fallbacks internos)
   Depende de: store.js (RWAStore), utils.js (U), ui.js (UI),
   charts.js (Charts). Substitui shell/router/app/view-*.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Captura global de erros → visível na tela ---------- */
  function panic(msg) {
    try {
      var el = document.getElementById("rwaErrors");
      if (!el) {
        el = document.createElement("div");
        el.id = "rwaErrors";
        el.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;background:rgba(127,29,29,.96);color:#FECACA;border:1px solid #EF4444;border-radius:10px;padding:12px 16px;font:12.5px/1.5 Inter,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.5)";
        document.body.appendChild(el);
      }
      el.innerHTML = "<b>Erro no módulo RWA:</b> " + String(msg) +
        /* A chave TEM de acompanhar o rename do 3.6: este é o caminho de
           recuperação de quem já está com a tela quebrada. Apagar o nome
           antigo não faria nada e o usuário ficaria preso no erro. */
        ' &nbsp;·&nbsp; <a href="#" style="color:#FCA5A5" onclick="try{localStorage.removeItem(\'atlas.rwa.state.v3\')}catch(e){};location.reload();return false;">Resetar dados e recarregar</a>';
    } catch (e) {}
  }
  window.addEventListener("error", function (e) { panic(e.message || "erro desconhecido"); });

  var U = window.U, S = window.RWAStore, UI = window.UI;
  var C = function () { return window.Charts || null; };

  /* ============================================================
     SHELL — sidebar + topbar
     ============================================================ */
  var NAV = [
    { id: "dashboard", label: "Dashboard",   icon: "grid",      route: "#/dashboard" },
    { id: "portfolio", label: "Portfolio",   icon: "portfolio", route: "#/portfolio" },
    { id: "macro",     label: "Macro",       icon: "macro",     route: "#/macro" },
    { id: "risk",      label: "Risk Engine", icon: "risk",      route: "#/risk" },
    { id: "narrative", label: "Narrative",   icon: "narrative", route: "#/narrative" },
    /* Teses vem ANTES do Journal de propósito: tese é o fundamento da
       decisão, o Journal é o registro dela. A ordem do menu conta a
       ordem do processo. */
    { id: "teses",     label: "Teses",       icon: "doc",       route: "#/teses" },
    { id: "journal",   label: "Journal",     icon: "journal",   route: "#/journal" }
  ];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* Confirmação de ação destrutiva pelo kit compartilhado
     (core/ui/atlas-ui.js), com window.confirm como rede de segurança —
     o RWA carrega tudo como opcional de propósito. O callback só roda
     no "sim", mesma semântica do `if (confirm(...)) { ... }` anterior. */
  function perguntar(opts, aoConfirmar) {
    if (window.AtlasUI) {
      AtlasUI.confirm(opts).then(function (ok) { if (ok) aoConfirmar(); });
      return;
    }
    if (window.confirm(opts.title + "\n\n" + (opts.message || ""))) aoConfirmar();
  }

  var Shell = {
    mount: function (rootSel) {
      var root = U.qs(rootSel);
      root.innerHTML =
        '<aside class="sidebar" id="sidebar">' +
          '<div class="side-brand">' +
            '<span class="mark">' + U.icon("layers") + '</span>' +
            '<span class="txt"><span class="n">ATLAS<b> RWA</b></span><span class="s">Macro Intelligence</span></span>' +
          '</div>' +
          '<div class="side-label">Terminal</div>' +
          '<nav class="nav" id="nav">' +
            NAV.map(function (n) { return '<a class="nav-item" href="' + n.route + '" data-id="' + n.id + '">' + U.icon(n.icon) + '<span>' + n.label + '</span></a>'; }).join("") +
          '</nav>' +
          '<div class="side-foot">' +
            '<a class="side-back" href="../dashboard.html">' + U.icon("back") + '<span>Voltar ao Atlas</span></a>' +
          '</div>' +
        '</aside>' +
        '<div class="scrim" id="scrim"></div>' +
        '<div class="main">' +
          '<header class="topbar">' +
            '<button class="nav-toggle" id="navToggle">' + U.icon("menu") + '</button>' +
            '<div class="search">' + U.icon("search") + '<input id="globalSearch" type="text" placeholder="Buscar ativo, setor, classe…" autocomplete="off" /></div>' +
            '<div class="tb-spacer"></div>' +
            '<div class="tb-wallet" id="tbWallet"></div>' +
            '<div class="tb-sep hide-sm"></div>' +
            '<div class="tb-metric hide-sm"><span class="k">Regime</span><span id="tbRegime"></span></div>' +
            '<div class="tb-sep hide-sm"></div>' +
            '<div class="tb-metric"><span class="k">Patrimônio</span><span class="v" id="tbTotal">—</span></div>' +
          '</header>' +
          '<main id="app" class="view"></main>' +
        '</div>';

      var sb = U.qs("#sidebar"), scrim = U.qs("#scrim");
      U.qs("#navToggle").addEventListener("click", function () { sb.classList.toggle("open"); scrim.classList.toggle("show"); });
      scrim.addEventListener("click", function () { sb.classList.remove("open"); scrim.classList.remove("show"); });
      U.qsa("#nav .nav-item").forEach(function (a) { a.addEventListener("click", function () { sb.classList.remove("open"); scrim.classList.remove("show"); }); });

      var si = U.qs("#globalSearch");
      si.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && si.value.trim()) location.hash = "#/portfolio?q=" + encodeURIComponent(si.value.trim());
      });

      try { if (S.onWalletChange) S.onWalletChange(function () { Shell.renderWallet(); Shell.refreshTopbar(); Router.resolve(); }); } catch (e) {}
      this.renderWallet();
      this.refreshTopbar();
    },

    setActive: function (id) {
      U.qsa("#nav .nav-item").forEach(function (a) { a.classList.toggle("active", a.dataset.id === id); });
    },

    /* ---- Seletor de carteiras: 100% delegado à central (/wallets) ----
       Este bloco já foi uma cópia inteira do seletor: montava o markup
       .w-*, ligava o clique de cada item e registrava listener a cada
       render. Além de duplicar a lógica, era a única pele SEM "Nova
       carteira" — no RWA não dava para criar carteira nenhuma.
       Agora ele só declara "sou o RWA, pele .w-*, troco assim"; listar,
       trocar, criar, fechar e repintar vivem em WalletSelector. */
    renderWallet: function () {
      var el = U.qs("#tbWallet"); if (!el) return;
      if (!window.WalletSelector || !window.AtlasWallets) return;

      /* Totais do RWA numa carteira qualquer.
         O RWA, como o DeFi, nunca reportava ao ledger central: a fatia
         dele simplesmente não existia no saldo mostrado pelo seletor,
         nem aqui nem no Dashboard.
         Esta é a ÚNICA regra de cálculo do módulo — alimenta o cache
         (feed) e responde a leitura ao vivo (registerLive), então as
         duas não têm como divergir. */
      function totaisDe(walletId) {
        var wd = null;
        try { wd = (S.all().byWallet || {})[walletId]; } catch (e) { return null; }
        var ativos = (wd && wd.assets) || [];
        var valor = ativos.reduce(function (a, x) { return a + (Number(x.current) || 0); }, 0);
        var custo = ativos.reduce(function (a, x) { return a + (Number(x.entry) || 0); }, 0);
        return { id: walletId, module: "rwa",
                 capital: custo, saldo: valor, valorAtual: valor, assets: [] };
      }

      if (window.AtlasWallets.registerLive) {
        window.AtlasWallets.registerLive("rwa", totaisDe);
      }

      try {
        window.WalletSelector.render(el, {
          module: "rwa", scope: "module",
          balanceModule: "rwa",
          getActive: S.currentWallet,
          feed: function () {
            return window.AtlasWallets.forModule("rwa").map(function (w) { return totaisDe(w.id); })
                   .filter(Boolean);
          },
          /* Só o que é DO RWA: gravar a carteira em uso e redesenhar a
             view e a topbar. Redesenhar o seletor é com o componente. */
          onSelect: function (id) {
            S.setWallet(id);
            Shell.refreshTopbar();
            Router.resolve();
          },
          afterChange: function (w, acao) {
            if (acao === "create") S.setWallet(w.id);
            Shell.refreshTopbar();
            Router.resolve();
            U.toast(acao === "create" ? "Carteira criada: " + w.name
                  : acao === "rename" ? "Carteira renomeada: " + w.name
                  : "Carteira excluída: " + w.name);
          }
        });
      } catch (e) { el.innerHTML = ""; }
    },

    refreshTopbar: function () {
      try {
        var k = S.kpis();
        var reg = U.qs("#tbRegime"); if (reg) reg.innerHTML = U.regime(k.regime, true);
        var tot = U.qs("#tbTotal"); if (tot) tot.textContent = U.money0(k.total);
      } catch (e) {}
    }
  };
  window.Shell = Shell;

  /* ============================================================
     ROUTER — SPA por hash
     ============================================================ */
  var routes = [];
  function parseHash(hash) {
    hash = (hash || "").replace(/^#\/?/, "");
    var qi = hash.indexOf("?"), query = {};
    if (qi !== -1) {
      hash.slice(qi + 1).split("&").forEach(function (kv) {
        var p = kv.split("="); if (p[0]) query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
      });
      hash = hash.slice(0, qi);
    }
    return { path: hash || "dashboard", query: query };
  }
  function matchRoute(path) {
    var segs = path.split("/");
    for (var i = 0; i < routes.length; i++) {
      var r = routes[i], ps = r.pattern.split("/");
      if (ps.length !== segs.length) continue;
      var params = {}, ok = true;
      for (var j = 0; j < ps.length; j++) {
        if (ps[j][0] === ":") params[ps[j].slice(1)] = decodeURIComponent(segs[j]);
        else if (ps[j] !== segs[j]) { ok = false; break; }
      }
      if (ok) return { route: r, params: params };
    }
    return null;
  }
  var Router = {
    register: function (pattern, handler, navId) { routes.push({ pattern: pattern, handler: handler, navId: navId }); return this; },
    resolve: function () {
      var p = parseHash(location.hash);
      var m = matchRoute(p.path) || matchRoute("dashboard");
      try { window.scrollTo(0, 0); } catch (e) {}
      Shell.setActive(m.route.navId || m.route.pattern.split("/")[0]);
      var app = document.getElementById("app");
      try { m.route.handler({ params: m.params, query: p.query }); }
      catch (e) {
        if (app) app.innerHTML = '<div class="empty"><div class="empty-art">' + U.icon("alert") + '</div><h3>Erro ao carregar a view</h3><p>' + esc(e.message || e) + '</p></div>';
        panic((e && e.message) || e);
      }
      Shell.refreshTopbar();
    },
    start: function () {
      window.addEventListener("hashchange", this.resolve.bind(this));
      if (!location.hash) { try { history.replaceState(null, "", "#/dashboard"); } catch (e) {} }
      this.resolve();
    },
    go: function (h) { location.hash = h; }
  };
  window.Router = Router;

  /* ============================================================
     MODAL genérico + formulário de ativo
     ============================================================ */
  var soltarFocoModal = null;         // devolvida por AtlasUI.trapFocus

  function closeModal() {
    if (soltarFocoModal) { soltarFocoModal(); soltarFocoModal = null; }
    var m = U.qs("#rwaModal"); if (m) m.remove();
  }
  function openModal(title, bodyHtml, footHtml) {
    closeModal();
    var wrap = document.createElement("div");
    wrap.id = "rwaModal";
    wrap.className = "rmodal-backdrop";
    wrap.innerHTML =
      '<div class="rmodal">' +
        '<div class="rmodal-head"><h3>' + title + '</h3><button class="rmodal-x" data-close>' + U.icon("alert").replace("alert", "") + '✕</button></div>' +
        '<div class="rmodal-body">' + bodyHtml + '</div>' +
        (footHtml ? '<div class="rmodal-foot">' + footHtml + '</div>' : '') +
      '</div>';
    document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) { if (e.target === wrap || e.target.hasAttribute("data-close")) closeModal(); });

    /* Armadilha de foco do kit compartilhado. Este modal não prendia o
       foco, não fechava no Escape e não declarava role/aria-modal —
       trapFocus resolve os três de uma vez e devolve o foco a quem
       abriu. A caixa interna é o alvo: o backdrop é só o fundo. */
    var caixa = wrap.querySelector(".rmodal") || wrap;
    if (window.AtlasUI && AtlasUI.trapFocus) {
      soltarFocoModal = AtlasUI.trapFocus(caixa, closeModal);
    }
    /* primeiro campo em foco, como no diálogo de carteira */
    setTimeout(function () {
      var f = caixa.querySelector("input,select,textarea,button:not([data-close])");
      if (f) { try { f.focus(); } catch (e) {} }
    }, 50);

    return wrap;
  }

  var CLASSES = ["Treasury", "Bond", "Equity", "Commodity", "Credit", "Real Estate", "Crypto"];
  var SECTORS = ["Government", "Broad Equity", "Technology", "Commodities", "Private Credit", "Real Estate", "Energy", "Financials", "Infra"];
  var SENS = ["Risk-On", "Risk-Off", "Liquidity", "Neutral"];

  function assetForm(a) {
    a = a || {};
    function opt(list, cur) { return list.map(function (x) { return '<option value="' + x + '"' + (x === cur ? " selected" : "") + '>' + x + '</option>'; }).join(""); }
    return '' +
      '<div class="rform">' +
        '<div class="rrow">' +
          '<label class="rfield"><span>Nome do ativo</span><input class="rinput" data-rf="name" value="' + esc(a.name || "") + '" placeholder="Ex.: US Treasury 10Y / Bitcoin" /></label>' +
          '<label class="rfield rfield-sm"><span>Ticker</span><input class="rinput" data-rf="ticker" value="' + esc(a.ticker || "") + '" placeholder="Ex.: UST10 / BTC" /></label>' +
        '</div>' +
        '<div class="rrow">' +
          '<label class="rfield"><span>Classe</span><select class="rinput" data-rf="type">' + opt(CLASSES, a.type || "Treasury") + '</select></label>' +
          '<label class="rfield"><span>Setor</span><input class="rinput" data-rf="sector" list="rwaSectors" value="' + esc(a.sector || "") + '" placeholder="Ex.: Government" />' +
            '<datalist id="rwaSectors">' + SECTORS.map(function (s) { return '<option value="' + s + '">'; }).join("") + '</datalist></label>' +
        '</div>' +
        '<div class="rrow">' +
          '<label class="rfield"><span>Valor investido (US$)</span><input class="rinput" data-rf="entry" type="number" step="any" min="0" value="' + (a.entry != null ? a.entry : "") + '" placeholder="0" /></label>' +
          '<label class="rfield"><span>Valor atual (US$)</span><input class="rinput" data-rf="current" type="number" step="any" min="0" value="' + (a.current != null ? a.current : "") + '" placeholder="0" /></label>' +
        '</div>' +
        '<div class="rrow">' +
          '<label class="rfield"><span>Score (0–100)</span><input class="rinput" data-rf="score" type="number" min="0" max="100" value="' + (a.score != null ? a.score : 70) + '" /></label>' +
          '<label class="rfield"><span>Sensibilidade a regime</span><select class="rinput" data-rf="regimeSens">' + opt(SENS, a.regimeSens || "Neutral") + '</select></label>' +
          '<label class="rfield"><span>Status</span><select class="rinput" data-rf="status">' +
            '<option value="core"' + (a.status === "core" || !a.status ? " selected" : "") + '>Core</option>' +
            '<option value="watch"' + (a.status === "watch" ? " selected" : "") + '>Watch</option>' +
            '<option value="reduce"' + (a.status === "reduce" ? " selected" : "") + '>Reduce</option>' +
          '</select></label>' +
        '</div>' +
      '</div>';
  }

  function openAssetModal(existing) {
    var isEdit = !!existing;
    var m = openModal(isEdit ? "Editar ativo" : "Adicionar ativo", assetForm(existing),
      (isEdit ? '<button class="rbtn rbtn-danger" data-del>Excluir</button>' : '') +
      '<span class="grow"></span>' +
      '<button class="rbtn rbtn-ghost" data-close>Cancelar</button>' +
      '<button class="rbtn rbtn-primary" data-save>' + (isEdit ? "Salvar" : "Adicionar") + '</button>');

    function fv(f) { var el = m.querySelector('[data-rf="' + f + '"]'); return el ? el.value.trim() : ""; }

    // Autocomplete CoinGecko (opcional) — Nome + Ticker com preenchimento cruzado
    if (window.AtlasAssets) {
      var nameEl = m.querySelector('[data-rf="name"]'), tkEl = m.querySelector('[data-rf="ticker"]');
      var fillBoth = function (coin) {
        nameEl.value = coin.name; tkEl.value = coin.symbol;
        var typeEl = m.querySelector('[data-rf="type"]'); if (typeEl && !isEdit) typeEl.value = "Crypto";
        var secEl = m.querySelector('[data-rf="sector"]'); if (secEl && !isEdit && !secEl.value) secEl.value = "Technology";
        // preço atual em tempo real via provedor (CoinGecko)
        var curEl = m.querySelector('[data-rf="current"]');
        if (coin.id && curEl && !curEl.value && AtlasAssets.priceFull) {
          AtlasAssets.priceFull(coin.id).then(function (info) {
            if (info && info.usd != null && !curEl.value) curEl.value = info.usd;
          }).catch(function (err) {
            U.toast((err && err.message) || "Preço indisponível agora — preencha manualmente.", "warn");
          });
        }
      };
      AtlasAssets.attach(nameEl, { value: "name", onSelect: fillBoth });
      AtlasAssets.attach(tkEl, { value: "symbol", onSelect: fillBoth });
    }

    m.querySelector("[data-save]").addEventListener("click", function () {
      var name = fv("name"), ticker = fv("ticker").toUpperCase();
      if (!name || !ticker) { U.toast("Preencha nome e ticker.", "warn"); return; }
      var data = {
        name: name, ticker: ticker, type: fv("type") || "Treasury", sector: fv("sector") || "Outros",
        entry: parseFloat(fv("entry")) || 0, current: parseFloat(fv("current")) || 0,
        score: parseInt(fv("score"), 10) || 0, regimeSens: fv("regimeSens") || "Neutral", status: fv("status") || "core"
      };
      if (isEdit) { S.updateAsset(existing.id, data); U.toast("Ativo atualizado."); }
      else { S.addAsset(data); U.toast("Ativo adicionado."); }
      closeModal(); Router.resolve();
    });
    var del = m.querySelector("[data-del]");
    if (del) del.addEventListener("click", function () {
      perguntar({
        title: "Excluir " + existing.ticker + " do portfólio?",
        message: "A posição e o histórico de análise deste ativo saem do RWA. Não há como desfazer.",
        confirmLabel: "Excluir",
        danger: true
      }, function () {
        S.removeAsset(existing.id); U.toast("Ativo removido.");
        closeModal(); location.hash = "#/portfolio";
      });
    });
  }

  /* ============================================================
     VIEWS
     ============================================================ */
  var V = {};

  /* ---------------- Dashboard ---------------- */
  V.dashboard = function () {
    var app = U.qs("#app");
    var k = S.kpis(), reg = S.regimeMeta(k.regime);
    var byClass = S.allocationByClass(), bySector = S.allocationBySector();
    var risk = S.riskEngine(), macro = S.macro(), curves = S.equityCurves();
    var hasAssets = S.assets().length > 0;

    var riskColor = risk.totalRisk >= 66 ? "var(--neg)" : risk.totalRisk >= 40 ? "var(--warn)" : "var(--pos)";
    var riskWord = risk.totalRisk >= 66 ? "Elevado" : risk.totalRisk >= 40 ? "Moderado" : "Controlado";

    function macroCell(id, mm) {
      mm = mm || { k: "—", v: 0, unit: "", delta: 0, series: [] };
      var goodColor = (mm.good === "up" && mm.delta > 0) || (mm.good === "down" && mm.delta < 0) ? "var(--pos)" : (mm.good === "flat" ? "var(--text-2)" : "var(--neg)");
      return '<div class="panel panel-pad" style="padding:14px 16px">' +
        '<div class="spread"><span style="font-size:12px;color:var(--text-2)">' + mm.k + '</span>' +
        '<span style="color:' + goodColor + ';font-size:12px;font-weight:600">' + (mm.delta > 0 ? "+" : "") + U.num(mm.delta, 2) + (mm.unit === "%" ? "pp" : "") + '</span></div>' +
        '<div class="mono" style="font-size:21px;font-weight:600;margin:6px 0 8px">' + U.num(mm.v, mm.unit === "/100" ? 0 : 2) + '<span style="font-size:12px;color:var(--text-3)"> ' + (mm.unit || "") + '</span></div>' +
        '<div class="chart-box h-xs"><canvas id="spark_' + id + '"></canvas></div></div>';
    }

    app.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Terminal</div><h1 class="view-title">Dashboard</h1>' +
        '<div class="view-sub">Leitura macro + fluxo global do seu patrimônio RWA.</div></div>' +
        '<div class="vh-right">' + U.regime(k.regime) + ' <button class="rbtn rbtn-primary" id="btnAdd">+ Adicionar ativo</button></div>' +
      '</div>' +

      '<div class="grid g-4">' +
        UI.kpi({ k: "Total Portfolio Value", v: U.money0(k.total), icon: "wallet", foot: U.delta(k.pnlPct) + '<span class="sub"> retorno total</span>' }) +
        UI.kpi({ k: "PnL", v: U.signed(k.pnlAbs), icon: "trend", accent: k.pnlAbs >= 0 ? "apos" : "", foot: '<span class="sub">custo vs. atual</span>' }) +
        UI.kpi({ k: "Risk Score", v: k.riskScore + '<span style="font-size:14px;color:var(--text-3)"> /100</span>', icon: "shield", accent: "awarn", foot: '<span style="color:' + riskColor + '">' + riskWord + '</span>' }) +
        UI.kpi({ k: "Macro Regime", v: '<span style="font-size:17px">' + reg.label + '</span>', icon: "pulse", accent: "a2", foot: '<span class="sub">' + reg.tag + '</span>' }) +
      '</div>' +

      (hasAssets
        ? '<div class="grid g-2 section">' +
            UI.panel("Alocação por classe", '<div class="donut-flex"><div class="chart-box donut-hold" style="height:160px"><canvas id="chartClass"></canvas><div class="donut-center"><div class="dc-v">' + byClass.length + '</div><div class="dc-k">classes</div></div></div>' + UI.legend(byClass) + '</div>', '', "Asset Class") +
            UI.panel("Alocação por setor", '<div class="donut-flex"><div class="chart-box donut-hold" style="height:160px"><canvas id="chartSector"></canvas><div class="donut-center"><div class="dc-v">' + bySector.length + '</div><div class="dc-k">setores</div></div></div>' + UI.legend(bySector) + '</div>', '', "Sector") +
          '</div>'
        : '<div class="section">' + UI.panel("Portfólio", UI.empty({ icon: "portfolio", title: "Nenhum ativo ainda", text: 'Clique em "+ Adicionar ativo" para registrar sua primeira posição RWA.' }), '', "Começar") + '</div>') +

      '<div class="section">' +
        UI.panel("Equity Curve", '<div class="chart-box h-lg"><canvas id="chartEquity"></canvas></div>', '<div class="t3" style="font-size:11.5px">RWA · 90d</div>', "Performance") +
      '</div>' +

      '<div class="section"><div class="grid g-4">' +
        macroCell("rates", macro.rates) + macroCell("inflation", macro.inflation) +
        macroCell("dxy", macro.dxy) + macroCell("liquidity", macro.liquidity) +
      '</div></div>' +

      '<div class="section">' +
        UI.panel("Alertas do Risk Engine",
          '<div class="alerts">' + risk.alerts.map(function (al) {
            var c = al.level === "neg" ? "var(--neg)" : al.level === "warn" ? "var(--warn)" : "var(--pos)";
            return '<div class="alert-row" style="border-left:3px solid ' + c + '">' + al.text + '</div>';
          }).join("") + '</div>', '', "Monitoramento") +
      '</div>';

    U.qs("#btnAdd").addEventListener("click", function () { openAssetModal(); });

    var ch = C();
    if (ch) {
      if (hasAssets) {
        ch.donut(U.qs("#chartClass"), byClass);
        ch.donut(U.qs("#chartSector"), bySector);
      }
      ch.line(U.qs("#chartEquity"), curves.rwa || []);
      ["rates", "inflation", "dxy", "liquidity"].forEach(function (id) {
        var mm = macro[id]; if (mm && mm.series) ch.spark(U.qs("#spark_" + id), mm.series);
      });
    }
  };

  /* ---------------- Portfolio ---------------- */
  V.portfolio = function (ctx) {
    var app = U.qs("#app");
    var state = { q: (ctx.query && ctx.query.q) || "", cls: "", score: "", sort: "weight", dir: "desc" };
    var classes = uniq(S.assets().map(function (a) { return a.type; }));

    app.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Carteira</div><h1 class="view-title">Portfolio</h1>' +
        '<div class="view-sub">Ativos do mundo real — clique numa linha para abrir a análise.</div></div>' +
        '<div class="vh-right"><button class="rbtn rbtn-primary" id="btnAdd">+ Adicionar ativo</button></div></div>' +
      '<div class="filters">' +
        '<select class="select" id="fClass"><option value="">Todas as classes</option>' + classes.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join("") + '</select>' +
        '<select class="select" id="fScore"><option value="">Qualquer score</option><option value="85">Score ≥ 85</option><option value="70">Score ≥ 70</option><option value="50">Score ≥ 50</option></select>' +
        '<select class="select" id="fSort"><option value="weight">Ordenar: Peso</option><option value="pnlPct">Ordenar: PnL %</option><option value="score">Ordenar: Score</option><option value="current">Ordenar: Valor</option></select>' +
        '<div class="grow"></div>' +
        (state.q ? '<span class="tag tag-accent">busca: "' + esc(state.q) + '" <button class="btn-ghost btn-sm" id="clearQ" style="padding:0 4px">✕</button></span>' : '') +
      '</div>' +
      '<div class="panel"><div class="table-wrap"><table class="dtable"><thead><tr>' +
        '<th>Asset</th><th>Type</th><th class="num">Entry</th><th class="num">Current</th>' +
        '<th class="num sortable" data-s="pnlPct">PnL <span class="arr" id="arrPnl"></span></th>' +
        '<th class="num sortable" data-s="weight">Weight <span class="arr" id="arrW"></span></th>' +
        '<th class="num">Score</th><th>Regime Sens.</th>' +
      '</tr></thead><tbody id="tbody"></tbody></table></div></div>';

    function draw() {
      var items = S.assets();
      if (state.q) { var q = state.q.toLowerCase(); items = items.filter(function (a) { return (a.name + " " + a.ticker + " " + a.type + " " + a.sector).toLowerCase().indexOf(q) !== -1; }); }
      if (state.cls) items = items.filter(function (a) { return a.type === state.cls; });
      if (state.score) items = items.filter(function (a) { return a.score >= +state.score; });
      items.sort(function (a, b) { var d = b[state.sort] - a[state.sort]; return state.dir === "asc" ? -d : d; });

      var tb = U.qs("#tbody");
      if (!items.length) {
        tb.innerHTML = '<tr><td colspan="8">' + UI.empty({ icon: "search", title: "Nenhum ativo", text: S.assets().length ? "Ajuste os filtros ou a busca." : 'Use "+ Adicionar ativo" para registrar a primeira posição.' }) + '</td></tr>';
        return;
      }
      tb.innerHTML = items.map(function (a) {
        var pcls = a.pnlPct > 0 ? "val-pos" : a.pnlPct < 0 ? "val-neg" : "val-flat";
        return '<tr data-id="' + a.id + '">' +
          '<td><div class="asset-cell">' + U.tkn(a) + '<div><div class="asset-name">' + esc(a.name) + '</div><div class="asset-tick">' + esc(a.ticker) + '</div></div></div></td>' +
          '<td><span class="tag">' + esc(a.type) + '</span></td>' +
          '<td class="num t2">' + U.money0(a.entry) + '</td>' +
          '<td class="num">' + U.money0(a.current) + '</td>' +
          '<td class="num ' + pcls + '">' + U.pct(a.pnlPct, true) + '<div style="font-size:10.5px;font-weight:400" class="t3">' + U.signed(a.pnlAbs) + '</div></td>' +
          '<td class="num">' + U.pct(a.weight) + '</td>' +
          '<td class="num">' + U.score(a.score) + '</td>' +
          '<td>' + U.sens(a.regimeSens) + '</td>' +
        '</tr>';
      }).join("");
      U.qsa("#tbody tr[data-id]").forEach(function (tr) { tr.addEventListener("click", function () { location.hash = "#/asset/" + tr.dataset.id; }); });
      updateArrows();
    }
    function updateArrows() {
      var a = state.dir === "desc" ? "▼" : "▲";
      U.qs("#arrPnl").textContent = state.sort === "pnlPct" ? a : "";
      U.qs("#arrW").textContent = state.sort === "weight" ? a : "";
    }

    U.qs("#btnAdd").addEventListener("click", function () { openAssetModal(); });
    U.qs("#fClass").addEventListener("change", function (e) { state.cls = e.target.value; draw(); });
    U.qs("#fScore").addEventListener("change", function (e) { state.score = e.target.value; draw(); });
    U.qs("#fSort").addEventListener("change", function (e) { state.sort = e.target.value; state.dir = "desc"; draw(); });
    U.qsa(".dtable th.sortable").forEach(function (th) {
      th.addEventListener("click", function () {
        var s2 = th.dataset.s;
        if (state.sort === s2) state.dir = state.dir === "desc" ? "asc" : "desc"; else { state.sort = s2; state.dir = "desc"; }
        draw();
      });
    });
    var cq = U.qs("#clearQ"); if (cq) cq.addEventListener("click", function () { location.hash = "#/portfolio"; });
    draw();
  };

  /* ---------------- Asset detail ---------------- */
  V.asset = function (ctx) {
    var app = U.qs("#app");
    var a = S.asset(ctx.params.id);
    if (!a) { app.innerHTML = UI.empty({ icon: "search", title: "Ativo não encontrado", text: "Ele pode ter sido removido." }); return; }
    var pcls = a.pnlPct > 0 ? "val-pos" : a.pnlPct < 0 ? "val-neg" : "val-flat";

    app.innerHTML =
      '<div class="view-head"><div>' +
        '<a class="bck" href="#/portfolio">' + U.icon("back") + ' Portfolio</a>' +
        '<h1 class="view-title" style="display:flex;align-items:center;gap:10px">' + U.tkn(a) + esc(a.name) + '</h1>' +
        '<div class="view-sub">' + esc(a.ticker) + ' · ' + esc(a.type) + ' · ' + esc(a.sector) + '</div></div>' +
        '<div class="vh-right">' + U.status(a.status) + ' <button class="rbtn rbtn-ghost" id="btnEdit">Editar</button></div>' +
      '</div>' +
      '<div class="grid g-4">' +
        UI.kpi({ k: "Valor atual", v: U.money0(a.current), icon: "wallet" }) +
        UI.kpi({ k: "Investido", v: U.money0(a.entry), icon: "coins" }) +
        UI.kpi({ k: "PnL", v: '<span class="' + pcls + '">' + U.pct(a.pnlPct, true) + '</span>', icon: "trend", foot: '<span class="sub">' + U.signed(a.pnlAbs) + '</span>' }) +
        UI.kpi({ k: "Peso na carteira", v: U.pct(a.weight), icon: "gauge" }) +
      '</div>' +
      '<div class="grid g-2 section">' +
        UI.panel("Qualidade", '<div style="padding:6px 0">' + U.score(a.score) + '</div><p class="t2" style="font-size:12.5px;margin-top:8px">Score interno de qualidade/convicção (0–100).</p>', '', "Score") +
        UI.panel("Sensibilidade a regime", '<div style="padding:6px 0">' + U.sens(a.regimeSens) + '</div><p class="t2" style="font-size:12.5px;margin-top:8px">Como o ativo tende a reagir ao regime macro vigente.</p>', '', "Macro") +
      '</div>';

    U.qs("#btnEdit").addEventListener("click", function () { openAssetModal(a); });
  };

  /* ---------------- Macro ---------------- */
  V.macro = function () {
    var app = U.qs("#app");
    var m = S.macro(), k = S.kpis();
    function block(id, mm) {
      mm = mm || { k: "—", v: 0, unit: "", delta: 0, series: [] };
      return UI.panel(mm.k,
        '<div class="mono" style="font-size:26px;font-weight:600;margin:2px 0 10px">' + U.num(mm.v, 2) + '<span style="font-size:13px;color:var(--text-3)"> ' + (mm.unit || "") + '</span></div>' +
        '<div class="chart-box" style="height:120px"><canvas id="mc_' + id + '"></canvas></div>',
        '<span style="font-size:12px;color:var(--text-2)">' + (mm.delta > 0 ? "+" : "") + U.num(mm.delta, 2) + (mm.unit === "%" ? "pp" : "") + ' no período</span>', "Indicador");
    }
    var roo = (m.riskOnOff != null ? m.riskOnOff : 0); // -100..100
    var rooPct = (roo + 100) / 2;

    app.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Macro</div><h1 class="view-title">Leitura Macro</h1>' +
        '<div class="view-sub">Indicadores de referência do regime vigente. <span class="tag">valores de referência — API real em breve</span></div></div>' +
        '<div>' + U.regime(k.regime) + '</div></div>' +
      '<div class="section">' + UI.panel("Risk-On ↔ Risk-Off",
        '<div class="roo-track"><i style="left:' + rooPct + '%"></i></div>' +
        '<div class="spread" style="margin-top:8px"><span class="t3" style="font-size:11px">RISK-OFF</span><span class="t3" style="font-size:11px">RISK-ON</span></div>',
        '<span class="mono" style="font-weight:600;color:' + (roo >= 0 ? "var(--pos)" : "var(--neg)") + '">' + (roo > 0 ? "+" : "") + roo + '</span>', "Barômetro") + '</div>' +
      '<div class="grid g-2 section">' + block("rates", m.rates) + block("inflation", m.inflation) + '</div>' +
      '<div class="grid g-2 section">' + block("dxy", m.dxy) + block("liquidity", m.liquidity) + '</div>';

    var ch = C();
    if (ch) ["rates", "inflation", "dxy", "liquidity"].forEach(function (id) {
      var mm = m[id]; if (mm && mm.series) ch.spark(U.qs("#mc_" + id), mm.series, "var(--info)");
    });
  };

  /* ---------------- Risk Engine ---------------- */
  V.risk = function () {
    var app = U.qs("#app");
    var r = S.riskEngine();
    var color = r.totalRisk >= 66 ? "var(--neg)" : r.totalRisk >= 40 ? "var(--warn)" : "var(--pos)";
    var word = r.totalRisk >= 66 ? "Elevado" : r.totalRisk >= 40 ? "Moderado" : "Controlado";

    app.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Risco</div><h1 class="view-title">Risk Engine</h1>' +
        '<div class="view-sub">Concentração, qualidade e alertas do portfólio.</div></div></div>' +
      '<div class="grid g-3">' +
        UI.kpi({ k: "Risco total", v: '<span style="color:' + color + '">' + r.totalRisk + '</span><span style="font-size:14px;color:var(--text-3)"> /100</span>', icon: "shield", foot: '<span style="color:' + color + '">' + word + '</span>' }) +
        UI.kpi({ k: "Maior setor", v: '<span style="font-size:17px">' + esc(r.topSector.label) + '</span>', icon: "building", foot: '<span class="sub">' + U.pct(r.topSector.pct || 0) + ' do portfólio</span>' }) +
        UI.kpi({ k: "Posições", v: String(r.byAsset.length), icon: "portfolio", foot: '<span class="sub">ativos na carteira</span>' }) +
      '</div>' +
      '<div class="grid g-2 section">' +
        UI.panel("Concentração por setor",
          r.bySector.length ? r.bySector.map(function (s2) { return UI.meter({ k: s2.label, v: U.pct(s2.pct), pct: s2.pct, color: s2.color }); }).join("") : UI.empty({ icon: "info", title: "Sem dados", text: "Adicione ativos para ver a concentração." }), '', "Setores") +
        UI.panel("Concentração por ativo",
          r.byAsset.length ? r.byAsset.map(function (s2) { return UI.meter({ k: s2.label, v: U.pct(s2.pct), pct: s2.pct, color: s2.color }); }).join("") : UI.empty({ icon: "info", title: "Sem dados", text: "Adicione ativos para ver a concentração." }), '', "Ativos") +
      '</div>' +
      '<div class="section">' + UI.panel("Alertas",
        '<div class="alerts">' + r.alerts.map(function (al) {
          var c = al.level === "neg" ? "var(--neg)" : al.level === "warn" ? "var(--warn)" : "var(--pos)";
          return '<div class="alert-row" style="border-left:3px solid ' + c + '">' + al.text + '</div>';
        }).join("") + '</div>', '', "Monitoramento") + '</div>';
  };

  /* ---------------- Narrative ---------------- */
  V.narrative = function () {
    var app = U.qs("#app");
    var n = S.narrative();
    function cyc(label, o) {
      o = o || { v: "—", dir: "flat" };
      var ic = o.dir === "up" ? U.icon("up") : o.dir === "down" ? U.icon("down") : U.icon("info");
      var c = o.dir === "up" ? "var(--pos)" : o.dir === "down" ? "var(--neg)" : "var(--text-2)";
      return '<div class="panel panel-pad" style="display:flex;align-items:center;gap:12px">' +
        '<span style="color:' + c + ';display:inline-flex;width:18px">' + ic + '</span>' +
        '<div><div style="font-size:12px;color:var(--text-2)">' + label + '</div><div style="font-weight:600;margin-top:2px">' + esc(o.v) + '</div></div></div>';
    }
    app.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Narrativa</div><h1 class="view-title">Narrative Engine</h1>' +
        '<div class="view-sub">Qual história o mercado está contando agora. <span class="tag">valores de referência — API real em breve</span></div></div></div>' +
      '<div class="section">' + UI.panel("Narrativa dominante",
        '<div style="font-size:24px;font-weight:700;margin:2px 0 6px">' + esc(n.current || "—") + '</div>' +
        '<div class="t2" style="font-size:13px">' + esc(n.impact || "") + '</div>' +
        '<div style="margin-top:14px">' + UI.meter({ k: "Confiança", v: (n.confidence || 0) + "%", pct: n.confidence || 0, color: "#8B5CF6" }) + '</div>', '', "Atual") + '</div>' +
      '<div class="grid g-2 section">' +
        cyc("Ciclo de liquidez", n.liquidityCycle) + cyc("Demanda por hedge", n.hedgeCycle) +
        cyc("Rotação cripto", n.cryptoRotation) + cyc("Fluxo institucional", n.institutionalInflows) +
      '</div>';
  };

  /* ============================================================
     TESES — a entidade compartilhada, enfim também aqui
     ------------------------------------------------------------
     O RWA era o ÚNICO módulo fora de AtlasTheses. Hold, Trade e DeFi
     já registravam teses lá, e o Academy se apresenta como "central de
     conhecimento — todas as teses do ATLAS" enquanto,
     estruturalmente, não podia incluir o RWA: o link do Academy para
     este módulo apontava para a home, porque rota de teses não existia.

     Por que NÃO reaproveitei Narrative/Journal
     ------------------------------------------
     São coisas diferentes, e fundi-las corromperia o significado das
     duas. Narrative é leitura de mercado (o que o cenário está
     dizendo). Journal é diário de decisões — um LOG, append-only.
     Tese é um processo com estado, versão e conclusão: nasce
     planejada, evolui, conclui, vai para o Academy e pode reabrir.
     Cada uma continua fazendo o que fazia.

     A view segue as convenções visuais do RWA (painéis, rform, rbtn) e
     o mesmo conjunto de ações do DeFi, porque é a mesma entidade: o
     usuário não deveria reaprender a tela ao trocar de módulo.
     ============================================================ */

  var STATUS_TESE = {
    planejada: { label: "Planejada",    cor: "var(--text-2)" },
    andamento: { label: "Em andamento", cor: "var(--accent)" },
    concluida: { label: "Concluída",    cor: "var(--pos)" },
    arquivada: { label: "Arquivada",    cor: "var(--warn)" }
  };

  var teseAberta = null;

  function T() { return window.AtlasTheses || null; }

  function tesesDoModulo(incluirConcluidas) {
    var api = T();
    if (!api) return [];
    try { return api.byModule("rwa", { includeConcluded: !!incluirConcluidas }) || []; }
    catch (e) { return []; }
  }

  function quandoFoi(ts) {
    if (!ts) return "—";
    var d = Math.round((Date.now() - ts) / 86400000);
    if (d <= 0) return "hoje";
    if (d === 1) return "ontem";
    return "há " + d + " dias";
  }

  function formTese(t) {
    t = t || {};
    return '<div class="rform">' +
      '<div class="rrow">' +
        '<label class="rfield rfield-sm"><span>Ativo</span>' +
          '<input class="rinput" data-rf="asset" value="' + esc(t.asset || "") + '" placeholder="Ex.: OUSG" /></label>' +
        '<label class="rfield"><span>Título</span>' +
          '<input class="rinput" data-rf="title" value="' + esc(t.title || "") + '" placeholder="Ex.: Treasuries tokenizados como piso de carteira" /></label>' +
      '</div>' +
      '<label class="rfield"><span>Tese</span>' +
        '<textarea class="rinput" data-rf="content" rows="6" placeholder="Por que esta posição existe, o que a valida e o que a invalida…">' +
        esc(t.content || "") + '</textarea></label>' +
    '</div>';
  }

  function abrirFormTese(id) {
    var api = T(); if (!api) return;
    var t = id ? api.get(id) : null;
    var m = openModal(t ? "Editar tese" : "Nova tese", formTese(t),
      '<span class="grow"></span><button class="rbtn rbtn-ghost" data-close>Cancelar</button>' +
      '<button class="rbtn rbtn-primary" data-save>Salvar</button>');

    m.querySelector("[data-save]").addEventListener("click", function () {
      var campo = function (k) { return m.querySelector('[data-rf="' + k + '"]'); };
      var asset = campo("asset").value.trim();
      var title = campo("title").value.trim();
      /* marca o campo em falta em vez de um aviso solto — mesmo padrão
         que o kit usa nos outros módulos */
      if (!asset) { if (window.AtlasUI) AtlasUI.invalid(campo("asset"), "Informe o ativo."); return; }
      if (!title) { if (window.AtlasUI) AtlasUI.invalid(campo("title"), "Informe o título."); return; }

      var content = campo("content").value.trim();
      if (t) api.update(t.id, { asset: asset, title: title, content: content }, "Editada no módulo RWA.");
      else api.create({ module: "rwa", asset: asset, title: title, content: content, status: "planejada" });

      U.toast(t ? "Tese atualizada." : "Tese criada.");
      closeModal();
      Router.resolve();
    });
  }

  V.teses = function () {
    var app = U.qs("#app");
    var api = T();

    if (!api) {
      app.innerHTML =
        '<div class="view-head"><div><div class="eyebrow">Fundamento</div>' +
        '<h1 class="view-title">Teses</h1></div></div>' +
        UI.empty({ icon: "alert", title: "Entidade de Teses indisponível",
                   text: "core/entities/theses.js não foi carregado nesta página." });
      return;
    }

    var todas = tesesDoModulo(true);
    var n = { planejada: 0, andamento: 0, concluida: 0, arquivada: 0 };
    todas.forEach(function (t) { if (n[t.status] != null) n[t.status]++; });

    var visiveis = todas.filter(function (t) { return t.status !== "concluida"; });

    app.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Fundamento</div>' +
        '<h1 class="view-title">Teses</h1>' +
        '<div class="view-sub">Toda posição de RWA deveria nascer de uma tese. ' +
        'Ao concluir, ela vai para o Academy e pode ser reaberta de lá.</div></div>' +
        '<button class="rbtn rbtn-primary" id="btnNovaTese">' + U.icon("plus") + ' Nova tese</button>' +
      '</div>' +

      '<div class="grid g-4 section">' +
        UI.kpi({ k: "Planejadas",  v: String(n.planejada), icon: "journal" }) +
        UI.kpi({ k: "Em andamento", v: String(n.andamento), icon: "pulse", accent: "a2" }) +
        UI.kpi({ k: "Concluídas",  v: String(n.concluida), icon: "check", accent: "apos",
                 foot: '<span class="sub">no Academy</span>' }) +
        UI.kpi({ k: "Arquivadas",  v: String(n.arquivada), icon: "layers", accent: "awarn" }) +
      '</div>' +

      '<div class="section" id="listaTeses">' +
        (visiveis.length ? visiveis.map(cartaoTese).join("") :
          UI.empty({ icon: "journal", title: "Nenhuma tese ainda",
                     text: "Registre a primeira tese do RWA. As concluídas ficam na biblioteca do Academy." })) +
      '</div>';

    U.qs("#btnNovaTese").addEventListener("click", function () { abrirFormTese(null); });
    ligarEventosTeses();
  };

  function cartaoTese(t) {
    var s = STATUS_TESE[t.status] || STATUS_TESE.planejada;
    var aberta = teseAberta === t.id;
    var corpo = "";

    if (aberta) {
      var hist = (t.history || []).slice().sort(function (a, b) { return a.ts - b.ts; });
      corpo =
        '<div style="border-top:1px solid var(--border);margin-top:14px;padding-top:14px">' +
          '<div class="eyebrow" style="margin-bottom:10px">Evolução da tese · versão ' + t.version + '</div>' +
          (hist.length ? hist.map(function (h) {
            return '<p style="margin:0 0 12px;font-size:13px">' +
              '<span class="t2" style="display:block;font-size:11.5px">' +
              new Date(h.ts).toLocaleString("pt-BR") + '</span>' + esc(h.text) + '</p>';
          }).join("") : '<p class="t2" style="font-size:13px">Sem registros ainda.</p>') +
          '<textarea class="rinput" data-nota="' + t.id + '" rows="3" ' +
            'placeholder="Registrar nova visão…" style="margin-top:10px"></textarea>' +
          '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
            '<button class="rbtn rbtn-primary" data-addnota="' + t.id + '">Registrar visão</button>' +
            '<button class="rbtn rbtn-ghost" data-edit="' + t.id + '">Editar</button>' +
            (t.status === "planejada" ? '<button class="rbtn rbtn-ghost" data-start="' + t.id + '">Iniciar</button>' : "") +
            (t.status === "andamento" ? '<button class="rbtn rbtn-ghost" data-done="' + t.id + '">Concluir → Academy</button>' : "") +
            (t.status !== "arquivada"
              ? '<button class="rbtn rbtn-ghost" data-arch="' + t.id + '">Arquivar</button>'
              : '<button class="rbtn rbtn-ghost" data-start="' + t.id + '">Reativar</button>') +
            '<span class="grow"></span>' +
            '<button class="rbtn rbtn-ghost" data-del="' + t.id + '" style="color:var(--neg)">Excluir</button>' +
          '</div>' +
        '</div>';
    }

    return '<div class="panel panel-pad" style="margin-bottom:12px;cursor:pointer" data-abrir="' + t.id + '">' +
        '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
          '<div style="flex:1;min-width:180px">' +
            '<b style="font-size:14px">' + esc(t.title) + '</b>' +
            '<div class="t2" style="font-size:12px;margin-top:2px">' + esc(t.asset) +
              ' · atualizada ' + quandoFoi(t.updatedAt) + (t.version > 1 ? ' · v' + t.version : "") + '</div>' +
          '</div>' +
          '<span class="tag" style="color:' + s.cor + '">' + s.label + '</span>' +
        '</div>' +
        (aberta ? "" : '<p class="t2" style="margin:10px 0 0;font-size:13px">' +
          esc(t.content || "Sem tese registrada.") + '</p>') +
        corpo +
      '</div>';
  }

  function ligarEventosTeses() {
    var api = T(); if (!api) return;
    var host = U.qs("#listaTeses"); if (!host) return;

    U.qsa("[data-abrir]", host).forEach(function (el) {
      el.addEventListener("click", function (ev) {
        if (ev.target.closest("button") || ev.target.closest("textarea")) return;
        teseAberta = (teseAberta === el.dataset.abrir) ? null : el.dataset.abrir;
        Router.resolve();
      });
    });

    U.qsa("[data-addnota]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        var ta = U.qs('[data-nota="' + b.dataset.addnota + '"]', host);
        var v = ta && ta.value.trim();
        if (!v) { if (ta) ta.focus(); return; }
        api.addUpdate(b.dataset.addnota, v);
        U.toast("Visão registrada.");
        Router.resolve();
      });
    });

    U.qsa("[data-edit]", host).forEach(function (b) {
      b.addEventListener("click", function () { abrirFormTese(b.dataset.edit); });
    });

    U.qsa("[data-start]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        var t = api.get(b.dataset.start);
        if (t && t.status === "arquivada") api.reopen(t.id);
        else api.setStatus(b.dataset.start, "andamento");
        U.toast("Tese em andamento.");
        Router.resolve();
      });
    });

    U.qsa("[data-done]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        var t = api.get(b.dataset.done);
        perguntar({
          title: "Concluir esta tese?",
          message: "Fecha a versão " + (t ? t.version : "") + " e envia a tese automaticamente " +
                   "para o Academy. De lá ela pode ser reaberta, criando uma nova versão.",
          confirmLabel: "Concluir"
        }, function () {
          api.conclude(b.dataset.done);
          U.toast("Tese concluída — disponível no Academy.");
          teseAberta = null;
          Router.resolve();
        });
      });
    });

    U.qsa("[data-arch]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        api.archive(b.dataset.arch);
        U.toast("Tese arquivada.");
        Router.resolve();
      });
    });

    U.qsa("[data-del]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        perguntar({
          title: "Excluir esta tese?",
          message: "O histórico e todas as versões vão junto. Não há como desfazer.",
          confirmLabel: "Excluir",
          danger: true
        }, function () {
          api.remove(b.dataset.del);
          teseAberta = null;
          Router.resolve();
        });
      });
    });
  }

  /* ---------------- Journal ---------------- */
  V.journal = function () {
    var app = U.qs("#app");
    var list = S.journal();

    app.innerHTML =
      '<div class="view-head"><div><div class="eyebrow">Processo</div><h1 class="view-title">Journal</h1>' +
        '<div class="view-sub">Registro de decisões e leituras — a memória do seu processo.</div></div>' +
        '<div class="vh-right"><button class="rbtn rbtn-primary" id="btnNew">+ Nova entrada</button></div></div>' +
      '<div id="jList">' +
      (list.length
        ? list.map(function (e, i) {
            return '<div class="panel panel-pad jentry">' +
              '<div class="spread"><div><span class="tag tag-accent">' + esc(e.tag || "Nota") + '</span> <b style="margin-left:6px">' + esc(e.title || "") + '</b></div>' +
              '<span class="t3" style="font-size:11.5px">' + U.date(e.date) + ' <button class="btn-ghost btn-sm jdel" data-i="' + i + '" title="Excluir">✕</button></span></div>' +
              '<p class="t2" style="font-size:13px;margin-top:8px;white-space:pre-wrap">' + esc(e.text || "") + '</p></div>';
          }).join("")
        : UI.empty({ icon: "journal", title: "Journal vazio", text: "Registre a primeira decisão ou leitura de mercado." })) +
      '</div>';

    U.qs("#btnNew").addEventListener("click", function () {
      var m = openModal("Nova entrada no Journal",
        '<div class="rform">' +
          '<div class="rrow">' +
            '<label class="rfield rfield-sm"><span>Tag</span><select class="rinput" data-rf="tag"><option>Decisão</option><option>Leitura</option><option>Alerta</option><option>Nota</option></select></label>' +
            '<label class="rfield"><span>Título</span><input class="rinput" data-rf="title" placeholder="Ex.: Aumentei exposição a Treasuries" /></label>' +
          '</div>' +
          '<label class="rfield"><span>Descrição</span><textarea class="rinput" data-rf="text" rows="5" placeholder="Contexto, racional e próximos passos…"></textarea></label>' +
        '</div>',
        '<span class="grow"></span><button class="rbtn rbtn-ghost" data-close>Cancelar</button><button class="rbtn rbtn-primary" data-save>Salvar</button>');
      m.querySelector("[data-save]").addEventListener("click", function () {
        var title = m.querySelector('[data-rf="title"]').value.trim();
        if (!title) { U.toast("Dê um título à entrada.", "warn"); return; }
        S.addJournal({ tag: m.querySelector('[data-rf="tag"]').value, title: title, text: m.querySelector('[data-rf="text"]').value.trim() });
        U.toast("Entrada registrada."); closeModal(); Router.resolve();
      });
    });
    U.qsa(".jdel").forEach(function (b) {
      b.addEventListener("click", function () {
        perguntar({
          title: "Excluir esta entrada do diário?",
          message: "O registro da decisão é apagado permanentemente.",
          confirmLabel: "Excluir",
          danger: true
        }, function () { S.removeJournal(+b.dataset.i); Router.resolve(); });
      });
    });
  };

  function uniq(arr) { var s2 = {}, o = []; arr.forEach(function (x) { if (!s2[x]) { s2[x] = 1; o.push(x); } }); return o.sort(); }

  /* ============================================================
     BOOT
     ============================================================ */
  function boot() {
    Shell.mount("#shell");
    Router
      .register("dashboard", V.dashboard, "dashboard")
      .register("portfolio", V.portfolio, "portfolio")
      .register("asset/:id", V.asset, "portfolio")
      .register("macro", V.macro, "macro")
      .register("risk", V.risk, "risk")
      .register("narrative", V.narrative, "narrative")
      .register("teses", V.teses, "teses")
      .register("journal", V.journal, "journal")
      .start();

    /* Trocar a moeda (ou o formato de data/número) exige repintar os
       valores. AtlasBoot já coordena isso e ninguém nunca se registrou —
       a camada existia sem um só assinante. */
    if (window.AtlasBoot && window.AtlasBoot.onRepaint) {
      window.AtlasBoot.onRepaint(function () {
        try { Shell.refreshTopbar(); Router.resolve(); }
        catch (e) { if (window.console) console.error(e); }
      });
    }
  }
  try { boot(); }
  catch (e) {
    panic((e && e.message) || e);
    var root = document.getElementById("shell");
    if (root && !root.innerHTML) root.innerHTML = '<div style="padding:40px;color:#E5E7EB;font-family:Inter,sans-serif">Erro ao iniciar o RWA: ' + esc(e.message || e) + '</div>';
  }
})();
