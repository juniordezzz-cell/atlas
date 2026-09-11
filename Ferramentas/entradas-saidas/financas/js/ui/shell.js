/* ==========================================================================
   Finanças (ATLAS) — shell.js
   Injeta sidebar global ATLAS (stand-in visual) + topbar + sub-nav (pílulas)
   + barra inferior mobile. Expõe window.Shell.mount({ page, title, subtitle }).
   Sem dependências externas, sem rede, sem conta.
   ========================================================================== */
(function () {
  // Este app roda INDEPENDENTE do ATLAS por enquanto — a ligação vem
  // depois, via Firebase. Por isso ele NÃO injeta mais a sidebar nem o
  // botão de menu do ATLAS (eram só um stand-in visual, e no celular a
  // sidebar abria por cima do próprio botão ☰ e não fechava mais).
  // A navegação agora é 100% própria: pílulas no desktop, barra inferior
  // + "Mais" no celular.

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

    // topbar — sem o botão de menu do ATLAS: o app é autônomo e o título
    // faz o papel de marca ("Finanças").
    const topbar = `<header class="fx-topbar">
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
