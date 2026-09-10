/* ============================================================
   ANÁLISES — central de gráficos do ano (VISUALIZAÇÃO)
   ------------------------------------------------------------
   • Renda mês a mês (Jan..Dez) + a média mensal recebida no ano.
   • Gasto por categoria: escolha no seletor (totais de fixos /
     não fixos, ou uma categoria) e veja o valor mês a mês + média.
   Lê state.entries / state.expenses, que já vêm datados do motor
   de recorrência da página Planejar.

   Portado de js/analises.js (v1), adaptado para:
   - Inicializar direto no DOMContentLoaded, sem o evento
     "finance-cloud-ready" (local-first, sem nuvem).
   - Tom do gráfico de "Não fixos"/busca lido do token --vermelho
     via color-mix() (deriveToneFromToken, mesma técnica de
     financas/js/pages/despesas.js), no lugar do hex fixo "#ff7279"
     da v1 — canvas 2D não resolve var()/color-mix(var()), por isso
     o tom é resolvido para #rrggbb em tempo de execução.

   Local-first: sem backend na nuvem, sem rede. pt-BR.

   Nota de segurança: as funções abaixo montam HTML (innerHTML) a
   partir de `state` (lido do localStorage pelo próprio app, via
   FinanceUtils.getState -- mesma origem, sem rede ou terceiros) e
   de textos fixos deste arquivo. Não há entrada de rede sendo
   injetada; mesmo padrão já usado em financas/js/app-bridge.js.
   ============================================================ */
(function () {
  const YEAR = new Date().getFullYear();

  /* Calculado sob demanda (não no topo do arquivo): este script é
     clássico e roda de forma síncrona assim que o parser o
     encontra, ANTES do app-bridge.js (type="module", carregado
     como deferred) publicar window.FinanceUtils. Ler
     FinanceUtils.MONTH_NAMES aqui dentro de uma função — chamada
     só a partir do DOMContentLoaded — evita o ReferenceError. */
  function monthAbbr() {
    return FinanceUtils.MONTH_NAMES.map((n) => n.slice(0, 3));
  }

  /* Deriva um tom de --vermelho (tema atual) sem hardcodar hex.
     Dois passos, porque o contexto 2D do canvas NÃO resolve
     var(--token) (fillStyle é um <color> "solto", fora da cascata
     CSS) mas ENTENDE color-mix() com cores literais:
       1) lê o valor computado de --vermelho no tema atual via
          getComputedStyle(documentElement) — já resolvido pelo
          navegador para o tema ativo (dark/light);
       2) pinta 1 pixel de canvas com color-mix(in srgb, <literal>
          70%, #000) e lê o pixel de volta em #rrggbb — formato que
          o motor de gráficos (financas/js/ui/charts.js) espera. */
  function deriveToneFromToken(tokenName, mixPercent, fallback) {
    try {
      const base = getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
      if (!base) {
        return fallback;
      }
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = `color-mix(in srgb, ${base} ${mixPercent}%, #000)`;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      const toHex = (n) => n.toString(16).padStart(2, "0");
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } catch (err) {
      return fallback;
    }
  }

  /* Soma por mês (12 posições, Jan..Dez) das linhas que passam no filtro */
  function byMonth(rows, filterFn) {
    const keys = FinanceUtils.yearMonthKeys(YEAR);
    return keys.map((mk) =>
      rows
        .filter((r) => String(r.date).slice(0, 7) === mk && (!filterFn || filterFn(r)))
        .reduce((acc, r) => acc + (Number(r.value) || 0), 0)
    );
  }

  /* Média mensal considerando só os meses que tiveram movimento */
  function mediaMensal(valores) {
    const comValor = valores.filter((v) => v > 0);
    if (!comValor.length) { return 0; }
    return comValor.reduce((a, b) => a + b, 0) / comValor.length;
  }

  function renderRenda(state) {
    const valores = byMonth(state.entries);
    FinanceUtils.setText("[data-renda-media]", FinanceUtils.formatCurrency(mediaMensal(valores)));
    FinanceCharts.barChart("#rendaAnualChart", {
      labels: monthAbbr(),
      datasets: [{ label: "Renda", color: FinanceCharts.colors.green, values: valores }]
    });
  }

  let tipoAtivo = "fixed"; // atalho selecionado quando a busca está vazia

  /* Sugestões (datalist) enquanto a pessoa digita. Constrói cada
     <option> via DOM (createElement/textContent), não por
     innerHTML: os termos vêm de state (100% local, mas ainda
     assim evitamos concatenar strings em innerHTML aqui). */
  function fillCategorias(state) {
    const datalist = document.querySelector("#analiseCats");
    if (!datalist) { return; }
    const termos = [...new Set(
      state.expenses.flatMap((e) => [e.category, e.description]).filter(Boolean)
    )].sort();
    datalist.replaceChildren(...termos.map((t) => {
      const option = document.createElement("option");
      option.value = t;
      return option;
    }));
  }

  function renderCategoria(state) {
    const TYPES = FinanceUtils.EXPENSE_TYPES;
    const busca = (document.querySelector("#analiseBusca")?.value || "").trim().toLowerCase();
    const redSoft = deriveToneFromToken("--vermelho", 70, FinanceCharts.colors.red);

    let filterFn;
    let cor = FinanceCharts.colors.red;

    if (busca) {
      /* Busca por texto: casa categoria OU descrição */
      filterFn = (r) => `${r.category || ""} ${r.description || ""}`.toLowerCase().includes(busca);
      cor = redSoft;
    } else if (tipoAtivo === "variable") {
      filterFn = (r) => r.type === TYPES.variable;
      cor = redSoft;
    } else {
      filterFn = (r) => r.type === TYPES.fixed;
    }

    const valores = byMonth(state.expenses, filterFn);
    FinanceUtils.setText("[data-cat-media]", FinanceUtils.formatCurrency(mediaMensal(valores)));
    FinanceCharts.barChart("#categoriaChart", {
      labels: monthAbbr(),
      datasets: [{ label: busca ? busca : (tipoAtivo === "variable" ? "Não fixos" : "Fixos"), color: cor, values: valores }]
    });
  }

  function boot() {
    const state = FinanceUtils.refreshSummary(FinanceUtils.getState());
    FinanceUtils.saveState(state);
    FinanceUtils.setText("[data-analise-ano]", String(YEAR));
    fillCategorias(state);
    renderRenda(state);
    renderCategoria(state);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.page !== "analises") { return; }
    boot();

    const busca = document.querySelector("#analiseBusca");
    if (busca) {
      busca.addEventListener("input", () => {
        /* Digitou algo: os atalhos de tipo ficam inativos */
        const temTexto = busca.value.trim().length > 0;
        document.querySelectorAll(".fx-chip").forEach((c) => c.classList.toggle("is-active", !temTexto && c.dataset.filtro === tipoAtivo));
        renderCategoria(FinanceUtils.getState());
      });
    }

    document.querySelectorAll(".fx-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        tipoAtivo = chip.dataset.filtro;
        if (busca) { busca.value = ""; }
        document.querySelectorAll(".fx-chip").forEach((c) => c.classList.toggle("is-active", c === chip));
        renderCategoria(FinanceUtils.getState());
      });
    });
  });
})();
