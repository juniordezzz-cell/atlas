/* ==========================================================================
   Finanças (ATLAS) — shell.js
   Injeta sidebar global ATLAS (stand-in visual) + topbar + sub-nav (pílulas)
   + barra inferior mobile. Expõe window.Shell.mount({ page, title, subtitle }).
   Sem dependências externas, sem rede, sem conta.
   ========================================================================== */
(function () {
  // Itens globais da sidebar ATLAS (produto real). Aqui são apenas um
  // stand-in visual — os links não navegam (href="#") exceto onde indicado.
  // "Ferramentas" é o item que leva a este módulo, por isso fica ativo.
  const ATLAS_NAV = [
    { label: "Dashboard" },
    { label: "Hold" },
    { label: "Trade" },
    { label: "DeFi" },
    { label: "RWA" },
    { label: "Carteiras" },
    { label: "Academy" },
    { label: "Ferramentas", active: true },
    { label: "Relatórios" },
    { label: "Configurações" },
  ];

  const SECTIONS = [
    { slug: "dashboard",     label: "Visão geral",      href: "index.html" },
    { slug: "comparativo",   label: "Planejar",         href: "planejar.html" },
    { slug: "entradas",      label: "Entradas",         href: "entradas.html" },
    { slug: "despesas",      label: "Despesas",         href: "despesas.html" },
    { slug: "investimentos", label: "Investimentos",    href: "investimentos.html" },
    { slug: "relatorios",    label: "Relatórios",       href: "relatorios.html" },
    { slug: "analises",      label: "Análises",         href: "analises.html" },
  ];
  const MOBILE_PRIMARY = ["dashboard", "comparativo", "despesas"]; // + FAB + "Mais"

  function applyTheme() {
    let t = "dark";
    try { t = localStorage.getItem("atlas-financas-theme") || "dark"; } catch (e) {}
    document.documentElement.setAttribute("data-theme", t);
  }

  function sidebar() {
    const items = ATLAS_NAV.map(item =>
      `<a class="fx-side-item${item.active ? " is-active" : ""}" href="#"><span class="fx-side-ic" aria-hidden="true"></span><span>${item.label}</span></a>`
    ).join("");
    return `<aside class="fx-sidebar" data-fx-sidebar>
        <div class="fx-side-brand"><span class="fx-side-logo" aria-hidden="true"></span><span>ATLAS</span></div>
        <nav class="fx-side-nav" aria-label="Navegação ATLAS">${items}</nav>
      </aside>`;
  }

  function pills(active) {
    return `<nav class="fx-subnav" aria-label="Seções do Finanças">` +
      SECTIONS.map(s => `<a class="fx-pill${s.slug === active ? " is-active" : ""}" href="${s.href}">${s.label}</a>`).join("") +
      `</nav>`;
  }

  function bottomBar(active) {
    const items = MOBILE_PRIMARY.map(slug => {
      const s = SECTIONS.find(x => x.slug === slug);
      return `<a class="fx-tab${s.slug === active ? " is-active" : ""}" href="${s.href}"><span class="fx-tab-ic" aria-hidden="true"></span><span>${s.label === "Visão geral" ? "Início" : s.label}</span></a>`;
    });
    const fab = `<a class="fx-fab" href="planejar.html" aria-label="Lançar / planejar">＋</a>`;
    const mais = `<button class="fx-tab" type="button" data-fx-more aria-haspopup="true" aria-expanded="false"><span class="fx-tab-ic" aria-hidden="true"></span><span>Mais</span></button>`;
    return `<nav class="fx-bottombar" aria-label="Navegação">${items[0]}${items[1]}${fab}${items[2]}${mais}</nav>`;
  }

  // Seções que não têm aba própria na barra inferior mobile (nem são o
  // alvo do FAB central) + Configurações (fora de SECTIONS de propósito,
  // pois não é uma "seção" do módulo, e sim o acesso a preferências).
  function overflowSections() {
    return SECTIONS.filter(s => !MOBILE_PRIMARY.includes(s.slug) && s.slug !== "comparativo");
  }

  function moreMenu(active) {
    const list = overflowSections().concat([
      { slug: "configuracoes", label: "Configurações", href: "configuracoes.html" },
    ]);
    const links = list
      .map(s => `<a class="fx-more-item${s.slug === active ? " is-active" : ""}" href="${s.href}">${s.label}</a>`)
      .join("");
    return `<div class="fx-more-scrim" data-fx-more-scrim hidden></div>
      <nav class="fx-more-menu" data-fx-more-menu aria-label="Mais seções" hidden>${links}</nav>`;
  }

  function mount(opts) {
    opts = opts || {};
    const active = opts.page;
    document.documentElement.setAttribute("data-module", "atlas");
    applyTheme();
    const app = document.querySelector("[data-fx-app]") || document.body;
    const main = document.querySelector("[data-fx-main]");

    // sidebar global ATLAS (stand-in visual), inserida antes do main
    if (main) {
      main.insertAdjacentHTML("beforebegin", sidebar());
    } else {
      app.insertAdjacentHTML("afterbegin", sidebar());
    }

    // topbar
    const topbar = `<header class="fx-topbar">
        <button class="fx-menu" type="button" data-fx-menu aria-label="Abrir menu ATLAS">☰</button>
        <div class="fx-title"><h1>${opts.title || "Finanças"}</h1><p>${opts.subtitle || ""}</p></div>
        <div class="fx-topbar-actions">
          <a class="fx-settings${active === "configuracoes" ? " is-active" : ""}" href="configuracoes.html" aria-label="Configurações">⚙</a>
          <button class="fx-theme" type="button" data-fx-theme aria-label="Alternar tema">◐</button>
        </div>
      </header>`;
    if (main) { main.insertAdjacentHTML("afterbegin", topbar + pills(active)); }
    app.insertAdjacentHTML("beforeend", bottomBar(active) + moreMenu(active));

    document.querySelector("[data-fx-theme]")?.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", cur);
      try { localStorage.setItem("atlas-financas-theme", cur); } catch (e) {}
    });

    document.querySelector("[data-fx-menu]")?.addEventListener("click", () => {
      document.querySelector("[data-fx-sidebar]")?.classList.toggle("is-open");
    });

    // menu "Mais" (mobile): abre um sheet com as seções fora da barra
    // inferior + Configurações. Fecha ao clicar fora ou pressionar Esc.
    const moreBtn = document.querySelector("[data-fx-more]");
    const moreMenuEl = document.querySelector("[data-fx-more-menu]");
    const moreScrim = document.querySelector("[data-fx-more-scrim]");

    function closeMore() {
      moreMenuEl?.setAttribute("hidden", "");
      moreScrim?.setAttribute("hidden", "");
      moreBtn?.setAttribute("aria-expanded", "false");
    }
    function openMore() {
      moreMenuEl?.removeAttribute("hidden");
      moreScrim?.removeAttribute("hidden");
      moreBtn?.setAttribute("aria-expanded", "true");
    }

    moreBtn?.addEventListener("click", () => {
      const isOpen = moreBtn.getAttribute("aria-expanded") === "true";
      if (isOpen) { closeMore(); } else { openMore(); }
    });
    moreScrim?.addEventListener("click", closeMore);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closeMore(); }
    });
  }

  window.Shell = { mount, SECTIONS };
})();
