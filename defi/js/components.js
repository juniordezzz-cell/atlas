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

        /* A soma tinha uma cópia própria da regra e esquecia a TAXA
           PENDENTE — dinheiro do usuário parado dentro da pool. Agora
           delega a DeFiStore.walletValue/walletCapital, que é a mesma
           função usada pelos KPIs, pelo globalTotal e pela consolidação
           da raiz. Uma regra, quatro leitores. */
        return { id: walletId, module: "defi",
                 capital: S.walletCapital(wd),
                 saldo: S.walletValue(wd),
                 valorAtual: S.walletValue(wd),
                 assets: [] };
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

    /* ---------- Card de pool / posição ----------
       Os números vêm de DeFiStore.poolSummary, não dos campos gravados
       na pool. O card mostrava "Capital" (p.capital) e "Valor atual"
       (p.currentValue) lidos direto do objeto: com aporte e
       reinvestimento no meio, os dois passaram a ter significado
       diferente do que o rótulo prometia, e a taxa pendente ficava
       fora do valor. Ler pelo resumo é a mesma conta da página da
       posição — os dois não têm como divergir. */
    poolCard: function (p) {
      var r = (window.DeFiStore && DeFiStore.poolSummary) ? DeFiStore.poolSummary(p) : null;
      /* "Capital" no card = o que saiu do BOLSO (aportado), o mesmo
         número que a página da posição chama de "Capital colocado". A
         base investida inclui reinvestimento, e mostrar uma no card e
         outra na página fazia o mesmo rótulo valer duas coisas — e o
         percentual ao lado, medido sobre o aportado, não fechava com o
         capital exibido. */
      var capital = r ? r.aportado : (Number(p.capital) || 0);
      /* "Valor atual" era r.valorTotal — mercado MAIS taxa pendente.
         Numa pool de 50 que valorizou para 52 e gerou 3 de taxa, o
         card dizia 55, como se a posição tivesse valorizado 10%. Aqui
         é o valor da POSIÇÃO; a taxa tem linha própria na página. */
      var valor   = r ? r.valorPosicao  : (Number(p.currentValue) || 0);
      var lucro   = r ? r.resultado     : (Number(p.profit) || 0);
      var lucroPct = r ? r.resultadoPct : (Number(p.profitPct) || 0);
      var taxas   = r ? r.taxasGeradas  : 0;

      /* ------------------------------------------------------------
         O SELO VEM DO CÁLCULO, NÃO DO CAMPO GRAVADO

         Este bloco lia p.status e p.rangePos — dois campos escritos à
         mão no wizard ("Dentro do range" / "Fora do range", com
         rangePos: 1 fixo) e reescritos só pela tela do Dashboard,
         quando houvesse preço dos dois lados. Na tela de Pools, que
         nunca cotava nada, o card mostrava a escolha de meses atrás
         com aparência de leitura de agora.

         Agora vem de DeFiStore.statusDe(), a mesma função que a
         página da posição, o KPI e o alerta do Dashboard usam. Sem
         preço não existe barra nem selo de faixa: existe "Faixa não
         avaliada", que é o que de fato se sabe. */
      var st = (window.DeFiStore && DeFiStore.statusDe) ? DeFiStore.statusDe(p) : null;
      var status = st ? st.status : "naoavaliada";
      var rangeHtml = "";
      if (st && st.dentro !== null && p.rangeHigh > 0) {
        var pos = Math.max(4, Math.min(96, (st.posFaixa != null ? st.posFaixa : 0.5) * 100));
        rangeHtml = '<div class="range-bar' + (st.dentro ? "" : " out") +
                    '"><i style="left:0;width:' + pos + '%"></i></div>';
      }
      var profitCls = lucro > 0 ? "up" : (lucro < 0 ? "down" : "flat");

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
            U.statusDot(status, "pool") +
          '</div>' +
          '<div class="pos-tags">' +
            '<span class="tag tag-chain"><span class="dot" style="background:' + DeFiStore.colorOf("chain", p.chain) + '"></span>' + p.chain + '</span>' +
            '<span class="tag tag-proto">' + p.protocol + '</span>' +
            '<span class="tag tag-cat">' + p.category + '</span>' +
          '</div>' +
          '<div class="pos-metrics">' +
            '<div class="pos-metric"><div class="k">Capital</div><div class="v">' + U.money(capital) + '</div></div>' +
            '<div class="pos-metric"><div class="k">Posição</div><div class="v">' + U.money(valor) + '</div></div>' +
            '<div class="pos-metric"><div class="k">Taxas</div><div class="v delta up">' + U.money(taxas) + '</div></div>' +
            '<div class="pos-metric"><div class="k">Resultado</div><div class="v delta ' + profitCls + '">' + U.pct(lucroPct, true) + '</div></div>' +
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
