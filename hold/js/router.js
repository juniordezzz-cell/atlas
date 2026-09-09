/* ============================================================
   HOLD SYSTEM · js/router.js
   Inicializa o Store, monta o shell e roteia por hash.
   Reage a STATE_CHANGED re-renderizando a view atual.
   ============================================================ */
(function () {
  "use strict";
  var U = window.UI, S = window.Store;

  var NAV = [
    { section: "Operação" },
    { route: "dashboard",     label: "Painel",       icon: "dashboard" },
    { route: "ativos",        label: "Ativos",       icon: "layers", count: function (c) { return c.ativos; } },
    { section: "Análise" },
    { route: "metricas",      label: "Métricas",     icon: "chart" },
    { route: "historico",     label: "Histórico",    icon: "history", count: function (c) { return c.historico; } },
    { route: "relatorios",    label: "Relatórios",   icon: "report" }
  ];

  var current = { route: "dashboard", query: {} };
  var mounted = false;

  function parseHash() {
    var raw = (location.hash || "#/dashboard").replace(/^#\/?/, "");
    var parts = raw.split("?");
    var route = parts[0] || "dashboard";
    var query = {};
    if (parts[1]) parts[1].split("&").forEach(function (kv) {
      var p = kv.split("="); query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
    });
    if (!window.Pages[route]) route = "dashboard";
    return { route: route, query: query };
  }

  function buildShell() {
    var app = U.el("div", { class: "app", id: "app" });

    /* sidebar */
    var sidebar = U.el("aside", { class: "sidebar" });
    var brand = U.el("div", { class: "brand" });
    brand.appendChild(U.el("img", { class: "brand-mark", src: "../assets/iconeatlas.png", alt: "ATLAS" }));
    brand.appendChild(U.el("div", { class: "brand-text" }, [
      U.el("div", { class: "brand-name", text: "ATLAS HOLD" })
    ]));
    sidebar.appendChild(brand);

    /* voltar ao Atlas */
    var back = U.el("a", { class: "nav-back", href: "../pages/dashboard.html", title: "Voltar ao Atlas" });
    back.innerHTML = U.icon("chevron");
    back.appendChild(U.el("span", { class: "label", text: "Voltar ao Atlas" }));
    sidebar.appendChild(back);

    var nav = U.el("nav", { class: "nav", id: "nav" });
    sidebar.appendChild(nav);
    app.appendChild(sidebar);

    /* main */
    var main = U.el("main", { class: "main" });
    var topbar = U.el("header", { class: "topbar", id: "topbar" });
    main.appendChild(topbar);
    var viewHost = U.el("div", { class: "view", id: "app-view" });
    main.appendChild(viewHost);
    app.appendChild(main);

    // ANTES: document.body.innerHTML = "" — isso apagava também o botão do
    // Oráculo e a faixa do ATLAS, que o shell tinha acabado de montar. O
    // shell então os recriava, gerando um pisca-pisca e uma corrida de
    // remontagem a cada render. Agora só removemos o que é do Hold.
    Array.prototype.slice.call(document.body.childNodes).forEach(function (n) {
      if (n.nodeType === 1 && n.hasAttribute("data-atlas-ui")) return; // do shell: preserva
      document.body.removeChild(n);
    });
    document.body.appendChild(app);

    try { localStorage.removeItem("HOLD_SIDEBAR"); } catch (e) {}
    mounted = true;
  }

  function renderNav() {
    var nav = document.getElementById("nav");
    if (!nav) return;
    nav.innerHTML = "";
    var c = S.get.counts();
    NAV.forEach(function (item) {
      if (item.section) { nav.appendChild(U.el("div", { class: "nav-section", text: item.section })); return; }
      var a = U.el("a", { class: "nav-item" + (item.route === current.route ? " active" : ""), href: "#/" + item.route });
      a.innerHTML = U.icon(item.icon);
      a.appendChild(U.el("span", { class: "label", text: item.label }));
      if (item.count) {
        var n = item.count(c);
        if (n) a.appendChild(U.el("span", { class: "count", text: n }));
      }
      nav.appendChild(a);
    });
  }

  function renderTopbar(meta) {
    var tb = document.getElementById("topbar");
    if (!tb) return;
    tb.innerHTML = "";
    var crumb = U.el("div", { class: "crumb" });
    /* Era um <h1>, e a view abaixo tem outro com o mesmo texto: o
       leitor de tela anunciava o título duas vezes e a página ficava
       com dois "títulos do documento". A migalha é LOCALIZAÇÃO, não
       título — vira <p>, e o CSS continua valendo pela classe. */
    crumb.appendChild(U.el("p", { class: "crumb__atual", text: meta.title }));
    if (meta.crumb) {
      crumb.appendChild(U.el("span", { class: "sep", text: "/" }));
      crumb.appendChild(U.el("span", { class: "ctx", text: meta.crumb }));
    }
    tb.appendChild(crumb);

    var actions = U.el("div", { class: "topbar-actions" });

    /* ---- Seletor de carteira (Global/Local) ---- */
    actions.appendChild(buildWalletSelector());

    /* ------------------------------------------------------------
       A PASTILHA NÃO É UM SINAL DE MERCADO AO VIVO

       Ela se chamava "market-pill" e trazia um ponto verde com brilho
       — a convenção universal de "conectado, dados chegando agora".
       Não há conexão nenhuma: o número é o valor da carteira calculado
       com os preços gravados, que podem ser de semanas atrás. Um sinal
       de "ao vivo" ao lado de um preço velho é o tipo de mentira
       silenciosa que esta auditoria vem removendo.

       O ponto agora reflete a idade do preço mais VELHO da carteira, e
       a pastilha diz quando foi a última remarcação.
       ------------------------------------------------------------ */
    var idade = idadeDosPrecos();
    var pill = U.el("div", { class: "market-pill " + idade.nivel, title: idade.dica });
    pill.appendChild(U.el("span", { class: "dot" }));
    pill.appendChild(document.createTextNode("Carteira " + U.compact(S.get.portfolioValue())));
    pill.appendChild(U.el("span", { class: "mp-idade", text: idade.rotulo }));
    actions.appendChild(pill);
    tb.appendChild(actions);
  }

  /* Idade do preço mais velho ENTRE AS POSIÇÕES — não entre todos os
     ativos: um ativo de watchlist com preço velho não afeta nenhum
     número de dinheiro, e alarmar por ele treinaria a ignorar o aviso.
     Sem posição, não há o que envelhecer. */
  function idadeDosPrecos() {
    var pos = S.get.walletPositions();
    if (!pos.length) return { nivel: "neutro", rotulo: "", dica: "Sem posições nesta carteira." };

    var maisVelho = null, semData = 0;
    pos.forEach(function (p) {
      var a = S.get.asset(p.ativo_id);
      if (!a) return;
      if (!a.precoEm) { semData++; return; }
      var d = Math.floor((Date.now() - new Date(a.precoEm).getTime()) / 86400000);
      if (maisVelho == null || d > maisVelho) maisVelho = d;
    });

    if (semData) {
      return { nivel: "velho", rotulo: "· preço do cadastro",
               dica: semData + " posição(ões) ainda com o preço digitado no cadastro. " +
                     "Use \"Atualizar preços\" em Ativos." };
    }
    var r = maisVelho <= 0 ? "· hoje" : maisVelho === 1 ? "· ontem" : "· há " + maisVelho + "d";
    return {
      nivel: maisVelho <= 1 ? "fresco" : maisVelho <= 7 ? "morno" : "velho",
      rotulo: r,
      dica: "Remarcação mais antiga entre as posições: " +
            (maisVelho <= 0 ? "hoje" : maisVelho + " dia(s) atrás") + "."
    };
  }

  /* Totais do Hold numa carteira QUALQUER — não só a ativa.
     S.get.portfolioValue() só sabe da carteira em uso, então aqui a
     soma é feita direto sobre as posições daquela carteira, com os
     mesmos cálculos por posição que o módulo já usa. É a única regra
     de cálculo: alimenta o cache e responde à leitura ao vivo. */
  function totaisDe(walletId) {
    var pos = (S.state.carteira || []).filter(function (p) {
      return (p.walletId || "principal") === walletId;
    });
    var valor = pos.reduce(function (a, p) { return a + S.get.positionValue(p); }, 0);
    var custo = pos.reduce(function (a, p) { return a + S.get.positionCost(p); }, 0);
    return { id: walletId, module: "hold",
             capital: custo, saldo: valor, valorAtual: valor, assets: [] };
  }

  function buildWalletSelector() {
    /* Delegado 100% ao componente compartilhado (/wallets). O Hold não
       monta markup, não liga clique e não tem CSS de seletor: o host é
       uma div sem classe nenhuma, justamente para não existir nada
       daqui que possa sobrescrever a aparência do componente. */
    var wrap = U.el("div");
    if (!window.AtlasWallets || !window.WalletSelector) return wrap;
    if (window.AtlasWallets.registerLive) {
      window.AtlasWallets.registerLive("hold", totaisDe);
    }
    window.WalletSelector.render(wrap, {
      module: "hold", scope: "module",
      balanceModule: "hold",
      /* o Hold guarda a carteira em uso no estado dele, porque é por
         ela que a partição dos dados do módulo é feita */
      getActive: S.wallets.active,
      onSelect: function (id) { S.wallets.set(id); },   // Hold reage via emit()
      /* alimenta o ledger central. Antes reportava SÓ a carteira ativa,
         então as outras ficavam com o valor da última vez que foram
         abertas — ou com nada. Agora reporta todas as do módulo, com a
         mesma função que responde à leitura ao vivo (totaisDe). */
      feed: function () {
        return window.AtlasWallets.forModule("hold").map(function (w) { return totaisDe(w.id); });
      },
      afterChange: function (w, acao) {
        if (acao === "create") {
          S.wallets.set(w.id);
          U.toast("Carteira criada", w.name + " está ativa.", "success");
        } else if (acao === "rename") {
          U.toast("Carteira renomeada", w.name, "success");
        } else if (acao === "remove") {
          U.toast("Carteira excluída", w.name, "success");
        }
      }
    });
    return wrap;
  }

  /* escapeHtml() morava aqui e não era chamada por uma linha sequer.
     Função de escape sem uso é pior que ausente: quem lê o arquivo
     conclui que a saída HTML daqui é escapada, e ela é montada com
     textContent — que já escapa por natureza. */

  function render() {
    if (!mounted) buildShell();
    /* O menu suspenso vive em document.body com position:fixed, então
       ele NÃO é removido junto com a view. Sem esta linha, um menu
       aberto quando o estado muda (troca de carteira, outra aba
       gravando) sobrevivia ao render, flutuando sobre a tela nova e
       apontando para uma linha que não existe mais. */
    if (U.fecharMenu) U.fecharMenu();
    current = parseHash();
    var host = document.getElementById("app-view");
    var pageFn = window.Pages[current.route] || window.Pages.dashboard;
    var result = pageFn(current);
    host.innerHTML = "";
    host.appendChild(result.node);
    host.scrollTop = 0;
    renderNav();
    renderTopbar({ title: result.title, crumb: result.crumb });
    window.scrollTo(0, 0);
  }

  function rerender() { render(); }

  window.Router = { render: render, rerender: rerender, get current() { return current; } };

  function init() {
    S.init();
    // re-render em qualquer mudança de estado (mantém contadores/topbar em dia)
    /* Trocar/criar carteira precisa redesenhar a página inteira: a
       topbar (nome e saldo da carteira ativa) e a view (os números são
       por carteira). Este listener existia mas era um corpo vazio fora
       do caso "modal aberto" — o comentário prometia "full render" e
       não havia render nenhum. Resultado: criava a carteira no Hold e a
       tela continuava mostrando a anterior.

       Reage a wallet_change venha de onde vier: do próprio Hold, de
       outro módulo ou de outra aba (state.js assina AtlasWallets e
       reemite aqui). O setTimeout junta várias mudanças do mesmo tick
       em um render só e evita reentrância. (setTimeout e não rAF: rAF
       não roda com a aba em segundo plano, e a carteira pode mudar
       justamente enquanto o usuário está em outra aba.) */
    var renderPendente = false;
    S.on(S.EVENTS.STATE_CHANGED, function (p) {
      // com modal aberto, só cromo leve — um render derrubaria o modal
      if (document.querySelector(".modal-scrim")) { try { renderNav(); } catch (e) {} return; }
      if (!p || p.evt !== "wallet_change") return;
      if (renderPendente) return;
      renderPendente = true;
      setTimeout(function () {
        renderPendente = false;
        try { render(); } catch (e) { if (window.console) console.error(e); }
      }, 0);
    });
    /* Trocar a moeda (ou o formato de data/número) nas Configurações
       exige repintar os valores. AtlasBoot já coordena isso e ninguém
       nunca se registrou — a camada existia sem um só assinante. */
    if (window.AtlasBoot && AtlasBoot.onRepaint) {
      AtlasBoot.onRepaint(function () {
        try { render(); } catch (e) { if (window.console) console.error(e); }
      });
    }

    window.addEventListener("hashchange", render);
    if (!location.hash) location.hash = "#/dashboard";
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
