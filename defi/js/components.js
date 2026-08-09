/* ============================================================
   ATLAS · DeFi — components.js
   Componentes reutilizáveis: navegação superior, card financeiro,
   card de pool/posição, estado vazio, tag.
   ============================================================ */
(function () {
  "use strict";
  var U = window.U;

  var NAV = [
    { id: "dashboard", label: "Dashboard", href: "index.html" },
    { id: "pools", label: "Pools", href: "pools.html" },
    { id: "staking", label: "Staking", href: "staking.html" },
    { id: "lending", label: "Lending", href: "lending.html" },
    { id: "analytics", label: "Analytics", href: "analytics.html" },
    { id: "historico", label: "Histórico", href: "historico.html" },
    { id: "teses", label: "Teses", href: "teses.html" }
  ];

  var C = {
    /* ---------- Navegação superior ---------- */
    nav: function (active) {
      var links = NAV.map(function (n) {
        return '<a class="nav-link' + (n.id === active ? " active" : "") + '" href="' + n.href + '">' + n.label + '</a>';
      }).join("");

      return '' +
        '<header class="topnav">' +
          '<div class="topnav-inner">' +
            '<a class="brand" href="index.html">' +
              '<span class="brand-mark">' + U.icon("layers") + '</span>' +
              '<span class="brand-name">ATLAS<b> DeFi</b></span>' +
            '</a>' +
            '<nav class="nav-links">' + links + '</nav>' +
            '<div class="nav-spacer"></div>' +
            '<div id="wsel"></div>' +
            '<a class="nav-back" href="../dashboard.html" title="Voltar ao Atlas">' +
              U.icon("back") + '<span>Voltar ao Atlas</span>' +
            '</a>' +
          '</div>' +
        '</header>';
    },

    mountNav: function (active) {
      var host = U.qs("#nav");
      if (host) host.innerHTML = C.nav(active);
      C.mountWalletSelector();
    },

    /* ---------- Seletor de carteira (Global/Local) ---------- */
    mountWalletSelector: function () {
      /* Delegado 100% ao componente compartilhado (/wallets). O host é
         uma div sem classe: markup, medidas e cores são todos de
         wallets/walletSelector.css, iguais aos dos outros módulos.

         ------------------------------------------------------------
         reload: MANTIDO AQUI DE PROPÓSITO — e o Dashboard não usa mais.

         A diferença entre os dois casos importa:

           Dashboard  a consolidação soma TODAS as carteiras globais,
                      não a ativa. Trocar de carteira não mudava número
                      nenhum lá, então o reload era desperdício puro e
                      foi removido (ver js/dashboard.js).
           DeFi       os dados são PARTICIONADOS por carteira
                      (DeFiStore.byWallet[id]). Trocar de carteira muda
                      pools, staking, lending, KPIs e gráficos — tudo.

         E o DeFi é multipágina: sete telas, cada uma montando o próprio
         conteúdo no load, cada uma com seu script de entrada
         (dashboard.js, pools.js, staking.js, lending.js, analytics.js,
         history.js, teses.js). Tornar isso reativo é extrair a
         renderização de SETE arquivos para funções re-executáveis —
         refatoração de módulo, não ajuste de seletor.

         Enquanto for MPA, recarregar é o mecanismo honesto: é como uma
         aplicação multipágina troca de contexto. O custo é o flash; o
         que não se pode perder é o número certo. */
      var host = U.qs("#wsel");
      if (!host || !window.WalletSelector || !window.AtlasWallets || !window.DeFiStore) return;
      var S = window.DeFiStore;

      /* ---------------------------------------------------------------
         Totais do DeFi numa carteira qualquer.

         O DeFi NUNCA reportava ao ledger central. Resultado medido: com
         uma pool de US$ 12.500 registrada, o seletor mostrava "US$ 0" —
         na própria tela do DeFi. E no Dashboard a carteira aparecia sem
         a fatia de DeFi nenhuma.

         Esta função é a ÚNICA regra de cálculo do módulo: alimenta o
         cache (feed) e responde a leitura ao vivo (registerLive). Sendo
         uma só, as duas não têm como divergir. */
      function totaisDe(walletId) {
        var wd = null;
        try { wd = (S.all().byWallet || {})[walletId]; } catch (e) { return null; }
        if (!wd) return { id: walletId, module: "defi", capital: 0, saldo: 0, valorAtual: 0, assets: [] };

        function soma(lista, campo) {
          return (lista || []).reduce(function (a, x) { return a + (Number(x[campo]) || 0); }, 0);
        }
        var valor = soma(wd.pools, "currentValue") + soma(wd.staking, "value") + soma(wd.lending, "value");
        var capital = soma(wd.pools, "capital") + soma(wd.staking, "value") + soma(wd.lending, "value");

        return { id: walletId, module: "defi",
                 capital: capital, saldo: valor, valorAtual: valor, assets: [] };
      }

      if (window.AtlasWallets.registerLive) {
        window.AtlasWallets.registerLive("defi", totaisDe);
      }

      window.WalletSelector.render(host, {
        module: "defi", scope: "module", reload: true,
        balanceModule: "defi",
        getActive: S.activeWallet,
        /* reporta TODAS as carteiras do módulo, não só a ativa: é o que
           mantém o cache útil quando o usuário estiver noutra tela */
        feed: function () {
          return window.AtlasWallets.forModule("defi").map(function (w) { return totaisDe(w.id); })
                 .filter(Boolean);
        },
        onSelect: function (id) { S.setWallet(id); },
        afterChange: function (w, acao) { if (acao === "create") S.setWallet(w.id); }
      });
    },

    /* ---------- Card financeiro (KPI) ---------- */
    finCard: function (o) {
      // o: { label, value, icon, accent, delta (num|null), sub }
      var accent = o.accent ? " accent-" + o.accent : "";
      var foot = "";
      if (o.delta != null) foot += U.delta(o.delta);
      if (o.sub) foot += '<span class="sub">' + o.sub + '</span>';
      return '' +
        '<div class="fin-card' + accent + '">' +
          '<div class="fin-top">' +
            '<span class="fin-label">' + o.label + '</span>' +
            '<span class="fin-ic">' + U.icon(o.icon) + '</span>' +
          '</div>' +
          '<div class="fin-value">' + o.value + '</div>' +
          (foot ? '<div class="fin-foot">' + foot + '</div>' : '') +
        '</div>';
    },

    /* ---------- Card de pool / posição ---------- */
    poolCard: function (p) {
      var st = U.status(p.status);
      var rangeOut = p.status === "range";
      var rangeHtml = "";
      if ((p.status === "ativa" || p.status === "range") && p.rangeHigh > 0) {
        var pos = Math.max(4, Math.min(96, (p.rangePos || 0.5) * 100));
        rangeHtml = '<div class="range-bar' + (rangeOut ? " out" : "") + '"><i style="left:0;width:' + pos + '%"></i></div>';
      }
      var profitCls = p.profit > 0 ? "up" : (p.profit < 0 ? "down" : "flat");

      return '' +
        '<a class="pos-card" href="pool.html?id=' + p.id + '">' +
          '<div class="pos-head">' +
            '<div class="pos-pair">' +
              '<div class="pair-icons">' + U.coin(p.base) + U.coin(p.quote) + '</div>' +
              '<div>' +
                '<div class="pair-name">' + p.base + ' / ' + p.quote + '</div>' +
                '<div class="pair-proto">' + p.protocol + '</div>' +
              '</div>' +
            '</div>' +
            U.statusDot(p.status) +
          '</div>' +
          '<div class="pos-tags">' +
            '<span class="tag tag-chain"><span class="dot" style="background:' + DeFiStore.colorOf("chain", p.chain) + '"></span>' + p.chain + '</span>' +
            '<span class="tag tag-proto">' + p.protocol + '</span>' +
            '<span class="tag tag-cat">' + p.category + '</span>' +
          '</div>' +
          '<div class="pos-metrics">' +
            '<div class="pos-metric"><div class="k">Capital</div><div class="v">' + U.money(p.capital) + '</div></div>' +
            '<div class="pos-metric"><div class="k">Lucro</div><div class="v delta ' + profitCls + '">' + U.pct(p.profitPct, true) + '</div></div>' +
            '<div class="pos-metric"><div class="k">Valor atual</div><div class="v">' + U.money(p.currentValue) + '</div></div>' +
            '<div class="pos-metric"><div class="k">APR</div><div class="v">' + (p.apr ? U.pct(p.apr) : "—") + '</div></div>' +
          '</div>' +
          rangeHtml +
        '</a>';
    },

    /* ---------- Estado vazio ---------- */
    empty: function (o) {
      // o: { icon, title, text, actionLabel, actionHref }
      var btn = o.actionLabel ? '<a class="btn btn-primary" href="' + (o.actionHref || "#") + '">' + U.icon("plus") + o.actionLabel + '</a>' : "";
      return '' +
        '<div class="empty">' +
          '<div class="empty-art">' + U.icon(o.icon || "inbox") + '</div>' +
          '<h2>' + o.title + '</h2>' +
          '<p>' + o.text + '</p>' +
          btn +
        '</div>';
    }
  };

  window.C = C;
})();
