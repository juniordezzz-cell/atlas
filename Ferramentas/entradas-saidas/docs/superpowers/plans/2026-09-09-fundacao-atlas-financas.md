# Fundação — Módulo "Finanças" do ATLAS — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a ferramenta de finanças pessoais num módulo nativo do ATLAS — visual profissional mobile-first, PWA instalável, dados local-first — reorganizando o código sem perder nenhuma funcionalidade existente.

**Architecture:** App estático vanilla multipágina, igual ao ATLAS. A lógica pura (persistência, recorrência, resumos, formatação) é extraída para ES modules em `financas/js/core/` (unit-testáveis com `node:test`); cada página tem um controller de DOM em `financas/js/pages/`; o shell (sidebar/topbar/navegação/tema do ATLAS) fica em `financas/js/ui/shell.js`. Os tokens de tema do ATLAS (as 117 CSS custom properties, cores, fontes, espaçamento, temas claro/escuro) são **recriados** num arquivo próprio `financas/css/atlas-tokens.css` a partir dos valores já extraídos do site do ATLAS — **sem download de arquivos**. Fontes Inter e JetBrains Mono via Google Fonts, com fallback de sistema robusto. Quando o módulo for colado dentro do repositório do ATLAS (numa conversa futura), troca-se `atlas-tokens.css` pelos `<link>` reais do tema do ATLAS (`../../css/variables.css`, etc.).

**Tech Stack:** HTML/CSS/JS vanilla (ES modules), sem build step. Testes com Node.js `node:test` + `node:assert` (`node --test`). PWA via Web App Manifest + Service Worker. Gráficos com o engine próprio `FinanceCharts` (Canvas).

**Spec:** `docs/superpowers/specs/2026-09-09-fundacao-atlas-financas-design.md`

## Global Constraints

- **Local-first:** persistência só em `localStorage` (chave `finance-dashboard-state`). Nenhuma dependência de Firebase, rede ou conta. Todo acesso a `localStorage` protegido por try/catch, com fallback para estado vazio.
- **Zero MundoDeFi:** nenhuma referência remanescente a `mundodefi`, `firebase`, `NexusAuth`, `pro-gate`, `nexus`, "modo demonstração/PRO", "Voltar ao MundoDeFi" no build final do módulo.
- **Tokens ATLAS:** todo CSS de finanças usa as CSS custom properties do ATLAS (`--fundo`, `--card`, `--atlas-accent`, `--verde`, `--vermelho`, `--texto`, `--raio`, `--atlas-sp-*`, etc.). Proibido hardcode de cor que possa descolar do tema. Fontes: Inter (UI) e JetBrains Mono (números).
- **Tema:** claro e escuro via `data-theme` no `<html>` (ambos já existem no tema do ATLAS). Toda tela deve ficar legível nos dois.
- **Sem novas features de produto:** esta fase é fundação/reskin/PWA/reorg. Funcionalidades novas (contas, metas, busca, etc.) são de fases futuras e não entram aqui.
- **Preservar comportamento:** cálculos, motor de recorrência do planner, migração de dados e fluxo de cada página continuam funcionando igual — só mudam apresentação, organização e camada de persistência.
- **Idioma:** UI e textos em pt-BR.
- **Nome de exibição:** "Finanças".
- **Seções do módulo (sub-navegação, nesta ordem):** Visão geral · Planejar (Entradas × Saídas) · Entradas · Despesas · Investimentos · Relatórios · Análises. (+ Configurações no menu.)

---

## Estrutura de arquivos (mapa)

```
financas/
  index.html            Visão geral (data-page="dashboard")
  planejar.html         Planner / Entradas × Saídas (data-page="comparativo")
  entradas.html         (data-page="entradas")
  despesas.html         (data-page="despesas")
  investimentos.html    (data-page="investimentos") — reformulado p/ "aporte do mês"
  relatorios.html       (data-page="relatorios")
  analises.html         (data-page="analises")
  configuracoes.html    (data-page="configuracoes")
  manifest.webmanifest
  sw.js
  offline.html
  css/
    atlas-tokens.css    tokens do ATLAS recriados (cores/temas/fontes/espaçamento) — swap por links do ATLAS depois
    financas.css        componentes específicos de finanças, sobre tokens ATLAS
  js/
    core/               LÓGICA PURA (testável, sem DOM)
      format.js         formatCurrency, formatPercent, formatDate, parseMoney, month helpers
      store.js          localStorage: getState/saveState/updateState/migrate/freshState/defaultState
      finance.js        summarize*, refreshSummary, deriveCashFlow, deriveNetWorth
      recurrence.js     payDates, incomeEntries, incomeInMonth, generateMovimentos, defaultPlanner
    ui/
      shell.js          injeta sidebar/topbar ATLAS + subnav (pílulas) + bottom bar + FAB + tema
      charts.js         engine de gráficos com paleta ATLAS
    pages/
      visao-geral.js  planejar.js  entradas.js  despesas.js
      investimentos.js  relatorios.js  analises.js  configuracoes.js
    pwa.js              registro do service worker
    app-bridge.js       expõe os core modules como window.FinanceUtils/FinanceCharts p/ os controllers
  assets/icons/         ícones PWA (192, 512, maskable) no estilo ATLAS
  test/
    format.test.js  store.test.js  finance.test.js  recurrence.test.js
```

**Nota de portabilidade p/ dentro do ATLAS:** o `<link>` para `css/atlas-tokens.css` (e o bloco de Google Fonts) é a única coisa a trocar pelos `<link>` reais do tema do ATLAS quando o módulo entrar no repo. Manter esse bloco de `<link>` idêntico em todas as páginas para facilitar o find-replace.

**Estratégia de módulos/testes:** `js/core/*.js` são ES modules com `export`. Para o browser (scripts clássicos dos controllers), `app-bridge.js` importa os core e publica `window.FinanceUtils`/`window.FinanceCharts`, preservando a API que os controllers já usam. Isso permite portar os controllers com mudança mínima e, ao mesmo tempo, testar o core no Node.

---

## Task 1: Scaffold do módulo + tokens ATLAS recriados + shell básico

**Files:**
- Create: `financas/css/atlas-tokens.css` (tokens ATLAS recriados — NÃO baixar do site)
- Create: `financas/index.html`
- Create: `financas/js/ui/shell.js`
- Create: `financas/css/financas.css`

**Interfaces:**
- Produces: `Shell.mount({ page, title, subtitle })` — função global (via `window.Shell`) que injeta sidebar+topbar do ATLAS, marca a seção ativa e aplica o tema salvo. `page` = slug (`dashboard|comparativo|entradas|despesas|investimentos|relatorios|analises|configuracoes`).

- [ ] **Step 1: Criar `financas/css/atlas-tokens.css` recriando os tokens do ATLAS**

Sem download. Escrever `:root` (tema escuro, padrão) com os valores extraídos do ATLAS e um bloco de tema claro sob `:root[data-theme="light"]`. Valores verbatim a usar:

```css
:root, :root[data-theme="dark"] {
  --fundo:#05080F; --card:#0D1422; --azul-escuro:#0A1A2F; --azul-profundo:#07121F;
  --texto:#E6F1FF; --texto-suave:rgba(230,241,255,.62); --texto-fraco:rgba(230,241,255,.38);
  --atlas-accent:#00BFFF; --atlas-accent-2:#00F0FF; --ciano:#00F0FF; --azul-principal:#00BFFF;
  --atlas-grad:linear-gradient(135deg,#00BFFF 0%,#00F0FF 100%); --atlas-on-accent:#04121e;
  --verde:#00E28A; --vermelho:#FF5470; --dourado:#FFD700; --cinza:#A0AEC0;
  --card-borda:rgba(0,191,255,.10); --card-borda-forte:rgba(0,191,255,.22); --linha:rgba(160,174,192,.10);
  --glow-azul:0 0 40px rgba(0,191,255,.45); --glow-ciano:0 0 60px rgba(0,240,255,.35);
  --raio:14px; --raio-sm:10px; --gap:20px; --sidebar-w:240px; --topbar-h:64px; --content-max:1400px;
  --atlas-sp-1:4px; --atlas-sp-2:8px; --atlas-sp-3:12px; --atlas-sp-4:16px; --atlas-sp-5:20px;
  --atlas-sp-6:24px; --atlas-sp-7:32px; --atlas-sp-8:40px;
  --atlas-r-sm:10px; --atlas-r-md:14px; --atlas-r-lg:20px; --atlas-r-pill:999px;
  --atlas-ease:cubic-bezier(.22,1,.36,1); --atlas-dur:260ms;
  --font-ui:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
  --font-mono:"JetBrains Mono","SF Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
}
:root[data-theme="light"] {
  --fundo:#F6F8FC; --card:#FFFFFF; --texto:#0B1220; --texto-suave:#4A5568; --texto-fraco:#646E7D;
  --card-borda:rgba(15,30,60,.12); --card-borda-forte:rgba(15,30,60,.26); --linha:rgba(15,30,60,.08);
  --verde:#0A6B61; --vermelho:#B91C1C; --atlas-on-accent:#04121e;
}
```
Incluir Inter + JetBrains Mono via Google Fonts no `<head>` das páginas (permitido; com fallback de sistema nos tokens acima para funcionar offline). `body { background:var(--fundo); color:var(--texto); font-family:var(--font-ui); }`.

Verificação: abrir `index.html` (Step 3) e confirmar no console que `getComputedStyle(document.documentElement).getPropertyValue('--atlas-accent').trim()` é `#00BFFF`, e que trocar `data-theme` para `light` muda o fundo.

- [ ] **Step 2: Escrever `financas/js/ui/shell.js`**

Injeta o shell do ATLAS e expõe `window.Shell.mount`. Conteúdo mínimo:

```js
(function () {
  const NAV = [
    { slug: "dashboard",     label: "Dashboard",   href: "index.html" }, // item ATLAS "Ferramentas" fica ativo p/ todas as seções deste módulo
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
    const mais = `<button class="fx-tab" type="button" data-fx-more><span class="fx-tab-ic" aria-hidden="true"></span><span>Mais</span></button>`;
    return `<nav class="fx-bottombar" aria-label="Navegação">${items[0]}${items[1]}${fab}${items[2]}${mais}</nav>`;
  }

  function mount(opts) {
    const active = opts.page;
    document.documentElement.setAttribute("data-module", "atlas");
    applyTheme();
    const app = document.querySelector("[data-fx-app]") || document.body;
    const main = document.querySelector("[data-fx-main]");
    // topbar
    const topbar = `<header class="fx-topbar">
        <button class="fx-menu" type="button" data-fx-menu aria-label="Abrir menu ATLAS">☰</button>
        <div class="fx-title"><h1>${opts.title || "Finanças"}</h1><p>${opts.subtitle || ""}</p></div>
        <button class="fx-theme" type="button" data-fx-theme aria-label="Alternar tema">◐</button>
      </header>`;
    if (main) { main.insertAdjacentHTML("afterbegin", topbar + pills(active)); }
    app.insertAdjacentHTML("beforeend", bottomBar(active));

    document.querySelector("[data-fx-theme]")?.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", cur);
      try { localStorage.setItem("atlas-financas-theme", cur); } catch (e) {}
    });
  }

  window.Shell = { mount, SECTIONS };
})();
```

(A sidebar global do ATLAS será colada do shell real do ATLAS quando o módulo entrar no repo; nesta fase standalone, `shell.js` desenha uma sidebar equivalente com os itens do ATLAS e "Ferramentas" ativo. Adicionar essa sidebar no mesmo `mount`, antes do `main`.)

- [ ] **Step 3: Escrever `financas/index.html` mínimo usando o shell**

```html
<!DOCTYPE html>
<html lang="pt-BR" data-module="atlas" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Finanças — ATLAS</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap">
  <link rel="stylesheet" href="css/atlas-tokens.css">
  <link rel="stylesheet" href="css/financas.css">
</head>
<body>
  <div class="fx-app" data-fx-app>
    <main class="fx-main" data-fx-main>
      <section class="fx-content"><p class="fx-empty">Visão geral (em construção)</p></section>
    </main>
  </div>
  <script src="js/ui/shell.js"></script>
  <script>window.Shell.mount({ page: "dashboard", title: "Finanças", subtitle: "Fluxo de caixa pessoal" });</script>
</body>
</html>
```

- [ ] **Step 4: Escrever `financas/css/financas.css` (base do layout do shell)**

Layout `.fx-app` (grid sidebar+main), `.fx-topbar`, `.fx-title`, `.fx-subnav`/`.fx-pill` (pílula ativa com `background: var(--atlas-grad); color: var(--atlas-on-accent)`), `.fx-bottombar`/`.fx-tab`/`.fx-fab` (escondidos no desktop via media query, visíveis ≤768px; `.fx-subnav` visível no desktop, escondido no mobile). Usar tokens ATLAS. Sem hardcode de cor.

- [ ] **Step 5: Verificar no navegador (desktop e mobile)**

Abrir `financas/index.html`. Confirmar: fundo `#05080F`, sidebar estilo ATLAS com "Ferramentas" ativo, topbar com título "Finanças", pílulas de seção com "Visão geral" ativa (gradiente ciano). Alternar tema claro/escuro pelo botão ◐ e confirmar que ambos ficam legíveis. Reduzir a largura ≤768px: pílulas somem, barra inferior aparece com Início/Planejar/＋/Despesas/Mais.

- [ ] **Step 6: Commit**

```bash
git add financas/css/atlas-tokens.css financas/index.html financas/js/ui/shell.js financas/css/financas.css
git commit -m "feat(financas): scaffold do módulo com shell e tokens ATLAS recriados"
```

---

## Task 2: Core `format.js` (helpers puros de formatação) + testes

**Files:**
- Create: `financas/js/core/format.js`
- Test: `financas/test/format.test.js`

**Interfaces:**
- Produces (exports): `formatCurrency(v)`, `formatPercent(v)`, `formatDate("YYYY-MM-DD")`, `parseMoney(str|num)`, `getMonthKey(date)`, `monthLabel(key)`, `yearMonthKeys(year)`, `MONTH_NAMES`. Fonte: portar de `js/utils.js` (linhas 230–303, 464–468) sem alterar comportamento.

- [ ] **Step 1: Escrever o teste que falha**

```js
// financas/test/format.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { formatCurrency, parseMoney, formatDate, getMonthKey, monthLabel, yearMonthKeys } from "../js/core/format.js";

test("formatCurrency formata em BRL", () => {
  assert.equal(formatCurrency(1550).replace(/ /g, " "), "R$ 1.550,00");
  assert.equal(formatCurrency(0).replace(/ /g, " "), "R$ 0,00");
});
test("parseMoney entende pt-BR", () => {
  assert.equal(parseMoney("R$ 1.550,50"), 1550.5);
  assert.equal(parseMoney(1200), 1200);
  assert.equal(parseMoney("abc"), 0);
});
test("formatDate inverte ISO", () => {
  assert.equal(formatDate("2026-03-05"), "05/03/2026");
});
test("getMonthKey e monthLabel", () => {
  assert.equal(getMonthKey("2026-03-05"), "2026-03");
  assert.equal(monthLabel("2026-03"), "Março / 2026");
});
test("yearMonthKeys gera 12 chaves", () => {
  const ks = yearMonthKeys(2026);
  assert.equal(ks.length, 12);
  assert.equal(ks[0], "2026-01");
  assert.equal(ks[11], "2026-12");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test financas/test/format.test.js`
Expected: FAIL (`Cannot find module ../js/core/format.js`).

- [ ] **Step 3: Implementar `financas/js/core/format.js`**

Portar as funções de `js/utils.js` como ES exports. `formatCurrency`/`formatPercent` via `Intl.NumberFormat("pt-BR", …)`; `parseMoney` com o mesmo regex de normalização; `formatDate` split ISO; `getMonthKey`/`monthLabel`/`yearMonthKeys`/`MONTH_NAMES` idênticos. Exportar cada um com `export function …`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test financas/test/format.test.js`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add financas/js/core/format.js financas/test/format.test.js
git commit -m "feat(financas): core de formatação (pt-BR) com testes"
```

---

## Task 3: Core `store.js` local-first + testes

**Files:**
- Create: `financas/js/core/store.js`
- Test: `financas/test/store.test.js`

**Interfaces:**
- Consumes: nada.
- Produces (exports): `defaultState`, `freshState()`, `migrateState(state)`, `getState()`, `saveState(next)`, `updateState(fn)`, `resetState()`, `STORAGE_KEY`. Persistência: `localStorage[STORAGE_KEY]` (JSON). Fonte: `defaultState`/`freshState`/`migrateState` de `js/utils.js` (linhas 15–141); `get/save/update` reescritos para localStorage (substituem a camada de nuvem das linhas 143–228).

- [ ] **Step 1: Escrever o teste que falha**

```js
// financas/test/store.test.js
import test from "node:test";
import assert from "node:assert/strict";

// shim de localStorage p/ Node
class LS { constructor(){this.m=new Map();} getItem(k){return this.m.has(k)?this.m.get(k):null;} setItem(k,v){this.m.set(k,String(v));} removeItem(k){this.m.delete(k);} }
globalThis.localStorage = new LS();

const { getState, saveState, updateState, freshState, migrateState, resetState, STORAGE_KEY } = await import("../js/core/store.js");

test("estado inicial é vazio (freshState) quando não há nada salvo", () => {
  const s = getState();
  assert.deepEqual(s.entries, []);
  assert.deepEqual(s.expenses, []);
  assert.equal(s.summary.saldo, 0);
});
test("saveState persiste no localStorage e getState relê", () => {
  saveState({ ...freshState(), entries: [{ id: "e1", date: "2026-03-01", source: "Salário", description: "x", value: 100 }] });
  const s = getState();
  assert.equal(s.entries.length, 1);
  assert.equal(s.entries[0].value, 100);
  assert.ok(localStorage.getItem(STORAGE_KEY));
});
test("updateState aplica o updater e salva", () => {
  updateState((cur) => { cur.profile.name = "Ana"; return cur; });
  assert.equal(getState().profile.name, "Ana");
});
test("migrateState renomeia tipos legados", () => {
  const s = migrateState({ expenses: [{ type: "Essenciais" }], categories: [{ type: "Não essenciais" }] });
  assert.equal(s.expenses[0].type, "Gastos fixos");
  assert.equal(s.categories[0].type, "Gastos não fixos");
});
test("resetState limpa para o estado vazio", () => {
  resetState();
  assert.deepEqual(getState().entries, []);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test financas/test/store.test.js`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `financas/js/core/store.js`**

- Portar `defaultState`, `clone`, `freshState`, `migrateState` de `js/utils.js` (idênticos).
- `getState()`: ler `localStorage[STORAGE_KEY]`; se existir, `migrateState(JSON.parse(...))`; senão `freshState()`. Envolver leitura/parse em try/catch → `freshState()` em erro.
- `saveState(next)`: `localStorage.setItem(STORAGE_KEY, JSON.stringify(next))` em try/catch; retornar `next`.
- `updateState(fn)`: `const cur = getState(); const next = fn(cur) || cur; saveState(next); return next;`
- `resetState()`: `saveState(freshState())`.
- `STORAGE_KEY = "finance-dashboard-state"`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test financas/test/store.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add financas/js/core/store.js financas/test/store.test.js
git commit -m "feat(financas): store local-first (localStorage) com migração e testes"
```

---

## Task 4: Core `finance.js` (resumos e séries) + testes

**Files:**
- Create: `financas/js/core/finance.js`
- Test: `financas/test/finance.test.js`

**Interfaces:**
- Consumes: `getMonthKey`, `monthLabel` de `format.js`; `EXPENSE_TYPES`.
- Produces (exports): `EXPENSE_TYPES`, `summarizeEntries(entries)`, `summarizeExpenses(expenses)`, `refreshSummary(state)`, `deriveCashFlow(state)`, `deriveNetWorth(state)`, `monthOptions(state)`. Fonte: `js/utils.js` linhas 305–383, 281–286.

- [ ] **Step 1: Escrever o teste que falha**

```js
// financas/test/finance.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { summarizeEntries, summarizeExpenses, refreshSummary, monthOptions } from "../js/core/finance.js";

const state = () => ({
  entries: [ {id:"e1",date:"2026-03-05",source:"Salário",description:"",value:1000},
             {id:"e2",date:"2026-03-20",source:"Freela",description:"",value:500} ],
  expenses: [ {id:"d1",date:"2026-03-02",category:"Casa",type:"Gastos fixos",description:"",value:400},
              {id:"d2",date:"2026-03-11",category:"Mercado",type:"Gastos não fixos",description:"",value:300} ],
  summary:{}, investments:{ invested: 0 }, categories: []
});

test("summarizeEntries soma e agrupa por origem", () => {
  const r = summarizeEntries(state().entries);
  assert.equal(r.total, 1500);
  assert.equal(r.bySource["Salário"], 1000);
});
test("summarizeExpenses soma total, por tipo e por categoria", () => {
  const r = summarizeExpenses(state().expenses);
  assert.equal(r.total, 700);
  assert.equal(r.byType["Gastos fixos"], 400);
  assert.equal(r.byCategory["Mercado"], 300);
});
test("refreshSummary calcula receitas/despesas/saldo", () => {
  const s = refreshSummary(state());
  assert.equal(s.summary.receitas, 1500);
  assert.equal(s.summary.despesas, 700);
  assert.equal(s.summary.saldo, 800);
});
test("monthOptions lista meses com dados, mais recente primeiro", () => {
  const s = state(); s.entries.push({id:"e3",date:"2026-02-10",source:"x",description:"",value:10});
  assert.deepEqual(monthOptions(s), ["2026-03","2026-02"]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test financas/test/finance.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `financas/js/core/finance.js`**

Portar `summarizeEntries`, `summarizeExpenses`, `refreshSummary`, `deriveCashFlow`, `deriveNetWorth`, `monthOptions` de `js/utils.js` como ES exports. `EXPENSE_TYPES = { fixed:"Gastos fixos", variable:"Gastos não fixos" }`. `refreshSummary` chama `deriveCashFlow` e `deriveNetWorth` (importar `getMonthKey`/`monthLabel` de `./format.js`).

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test financas/test/finance.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add financas/js/core/finance.js financas/test/finance.test.js
git commit -m "feat(financas): core de resumos e séries com testes"
```

---

## Task 5: Core `recurrence.js` (motor de recorrência do planner) + testes

**Files:**
- Create: `financas/js/core/recurrence.js`
- Test: `financas/test/recurrence.test.js`

**Interfaces:**
- Consumes: `EXPENSE_TYPES` de `finance.js`; `yearMonthKeys` de `format.js`; `refreshSummary`.
- Produces (exports): `defaultPlanner(year)`, `payDates(income, startISO, endISO)`, `incomeEntries(income, startISO, endISO)`, `incomeInMonth(planner, mk)`, `installmentsTotal(income)`, `generateMovimentos(state, planner, year)`. Fonte: `js/entradas-saidas.js` linhas 26–147, 337–397 (mesma lógica, sem DOM).

- [ ] **Step 1: Escrever o teste que falha**

```js
// financas/test/recurrence.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { payDates, incomeEntries, incomeInMonth, installmentsTotal } from "../js/core/recurrence.js";

test("payDates mensal cai no dia escolhido em cada mês do range", () => {
  const d = payDates({ frequency:"monthly", monthday:5 }, "2026-01-01", "2026-03-31");
  assert.deepEqual(d, ["2026-01-05","2026-02-05","2026-03-05"]);
});
test("payDates mensal ajusta dia 31 ao último dia do mês", () => {
  const d = payDates({ frequency:"monthly", monthday:31 }, "2026-02-01", "2026-02-28");
  assert.deepEqual(d, ["2026-02-28"]);
});
test("payDates semanal repete no weekday", () => {
  const d = payDates({ frequency:"weekly", weekday:1 }, "2026-01-01", "2026-01-31"); // segundas
  assert.ok(d.length >= 4);
  d.forEach(iso => { const [y,m,day]=iso.split("-").map(Number); assert.equal(new Date(y,m-1,day).getDay(), 1); });
});
test("incomeEntries custom soma parcelas no range", () => {
  const inc = { frequency:"custom", installments:[ {id:"p1",date:"2026-03-05",value:500}, {id:"p2",date:"2026-03-20",value:400}, {id:"p3",date:"2025-12-01",value:999} ] };
  const e = incomeEntries(inc, "2026-01-01", "2026-12-31");
  assert.equal(e.length, 2);
  assert.equal(installmentsTotal(inc), 1899);
});
test("incomeInMonth soma recebimentos regulares do mês", () => {
  const planner = { incomes:[ { id:"i1", frequency:"monthly", monthday:5, value:1000 } ] };
  assert.equal(incomeInMonth(planner, "2026-03"), 1000);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test financas/test/recurrence.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `financas/js/core/recurrence.js`**

Portar de `js/entradas-saidas.js` sem DOM: helpers `pad/iso/parse/sum`, `payDates` (weekly/biweekly/firstBusinessDay/monthly), `incomeEntries`, `installmentsTotal`, `incomeInMonth`, `defaultPlanner(year)`, e `generateMovimentos(state, planner, year)` (usa `yearMonthKeys` de `./format.js`, `EXPENSE_TYPES` de `./finance.js`, `refreshSummary` de `./finance.js`; mantém a constante `DEMO_IDS` e o filtro `manter`). `RANGE_START/END` derivados de `year` (parâmetro, default `new Date().getFullYear()`).

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test financas/test/recurrence.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add financas/js/core/recurrence.js financas/test/recurrence.test.js
git commit -m "feat(financas): motor de recorrência do planner com testes"
```

---

## Task 6: Ponte `app-bridge.js` (core → window.FinanceUtils/FinanceCharts)

**Files:**
- Create: `financas/js/app-bridge.js`
- Create: `financas/js/ui/charts.js` (engine com cores ATLAS)

**Interfaces:**
- Consumes: todos os `js/core/*.js`.
- Produces: `window.FinanceUtils` (mesma superfície de API que os controllers já usam: `getState, saveState, updateState, refreshSummary, formatCurrency, formatPercent, formatDate, parseMoney, uid, getMonthKey, monthLabel, monthOptions, MONTH_NAMES, yearMonthKeys, fillMonthSelect, summarizeEntries, summarizeExpenses, renderRows, setText, countUpCurrency, downloadText, toCsv, toast, EXPENSE_TYPES, applyTheme, migrateState, resetState`) e `window.FinanceCharts` (`lineChart, barChart, doughnutChart, areaChart, horizontalBars, colors`).

- [ ] **Step 1: Escrever `financas/js/ui/charts.js`**

Portar `js/charts.js`, trocando o objeto `colors` para a paleta ATLAS lida dos tokens (fallback fixo):
```js
const css = getComputedStyle(document.documentElement);
const pick = (name, fb) => (css.getPropertyValue(name).trim() || fb);
const colors = {
  green: pick("--verde", "#00E28A"),
  red:   pick("--vermelho", "#FF5470"),
  blue:  pick("--atlas-accent", "#00BFFF"),
  cyan:  pick("--atlas-accent-2", "#00F0FF"),
  gold:  pick("--dourado", "#FFD700"),
  grid:  "rgba(160,174,192,0.12)",
  text:  pick("--texto-suave", "rgba(230,241,255,.62)")
};
```
Ajustar eixos/grades/labels dos gráficos para usar `colors.grid`/`colors.text` (em vez de brancos hardcoded), para ficarem bons nos dois temas.

- [ ] **Step 2: Escrever `financas/js/app-bridge.js`**

Importar os core modules e publicar `window.FinanceUtils` mapeando cada função. Incluir os helpers de DOM que os controllers usam e que não são "puros" (`renderRows`, `setText`, `countUpCurrency`, `toast`, `downloadText`, `toCsv`, `fillMonthSelect`, `applyTheme`, `uid`) — portados de `js/utils.js` (linhas 262–264, 288–303, 385–462). Publicar `window.FinanceCharts` a partir de `ui/charts.js`. Carregar via `<script type="module" src="js/app-bridge.js">` antes dos controllers.

- [ ] **Step 3: Verificação (browser, smoke test)**

Criar `financas/_smoke.html` temporário que carrega `app-bridge.js` e um `<canvas id="c">`, chama `FinanceCharts.lineChart("#c", {labels:["a","b"],datasets:[{label:"x",values:[1,2],color:FinanceCharts.colors.cyan}]})` e `console.log(FinanceUtils.formatCurrency(1550))`. Abrir no navegador: confirmar o gráfico em ciano ATLAS e `R$ 1.550,00` no console. Apagar `_smoke.html` depois.

- [ ] **Step 4: Commit**

```bash
git add financas/js/app-bridge.js financas/js/ui/charts.js
git commit -m "feat(financas): ponte core→window e engine de gráficos em cores ATLAS"
```

---

## Task 7: Visão geral (dashboard) — layout "foco no essencial"

**Files:**
- Modify: `financas/index.html` (conteúdo da Visão geral)
- Create: `financas/js/pages/visao-geral.js`

**Interfaces:**
- Consumes: `window.FinanceUtils`, `window.FinanceCharts`, `window.Shell`.
- Produces: página `data-page="dashboard"` renderizada.

- [ ] **Step 1: Montar o HTML do conteúdo (layout "foco")**

Dentro de `[data-fx-main] .fx-content`: (1) card herói **Saldo do mês** (`[data-saldo-mes]`, número grande, classe de acento) com micro-nota (`[data-note-saldo]`) e `<canvas id="cashFlowHero">`; (2) três mini-cards Entradas (`[data-total-entradas]`, verde), Saídas (`[data-total-despesas]`, vermelho), Investido (`[data-total-investimentos]`); (3) card grande "Fluxo financeiro do mês" com `<canvas id="cashFlowChart">`; (4) seções que revelam ao rolar: "Distribuição das despesas" (`[data-expense-detail]`), "Últimas movimentações" (`[data-last-transactions]`), "Desempenho mês a mês" (`[data-monthly-performance]`). Reusar os mesmos `data-*` que o controller de dashboard já conhece.

- [ ] **Step 2: Escrever `financas/js/pages/visao-geral.js`**

Portar as funções de render de `js/dashboard.js` (`renderSummary`, `renderMonthNotes`, `renderExpenseDetails`, `renderTransactions`, `renderMonthlyPerformance`, `renderCharts` — adaptando os `<canvas>` presentes) e o `boot()`. Trocar `finance-cloud-ready` por execução direta no `DOMContentLoaded` (não há mais nuvem). Ajustar cores dos charts para `FinanceCharts.colors` (verde/vermelho/ciano ATLAS).

- [ ] **Step 3: Wire dos scripts na página**

`index.html` carrega, no fim do body: `shell.js`, `app-bridge.js` (module), `ui/charts.js` (se não embutido na ponte), `pages/visao-geral.js`, e o `Shell.mount({page:"dashboard", ...})`.

- [ ] **Step 4: Verificação (browser)**

Com `localStorage` vazio: a Visão geral mostra zeros e estados vazios amigáveis, sem erro no console. Depois de carregar dados de exemplo (Task 12) ou injetar um state de teste: herói mostra Saldo do mês, mini-cards corretos, gráfico de fluxo em ciano/vermelho, distribuição e movimentações preenchidas. Testar tema claro e escuro. Mobile ≤768px: herói e cards empilham, barra inferior presente, sem scroll horizontal.

- [ ] **Step 5: Commit**

```bash
git add financas/index.html financas/js/pages/visao-geral.js
git commit -m "feat(financas): Visão geral com layout foco no essencial (ATLAS)"
```

---

## Task 8: Planejar (Entradas × Saídas) — porta do planner

**Files:**
- Create: `financas/planejar.html`
- Create: `financas/js/pages/planejar.js`

**Interfaces:**
- Consumes: `window.FinanceUtils`, `recurrence.js` (via bridge: expor `generateMovimentos`, `defaultPlanner`, `incomeInMonth`, `installmentsTotal` em `window.FinancePlanner`), `window.Shell`.
- Produces: página `data-page="comparativo"` funcional (edição do planejamento persistida no localStorage).

- [ ] **Step 1: Expor o core de recorrência na ponte**

Em `app-bridge.js`, adicionar `window.FinancePlanner = { defaultPlanner, payDates, incomeEntries, incomeInMonth, installmentsTotal, generateMovimentos }` a partir de `core/recurrence.js`.

- [ ] **Step 2: Montar `financas/planejar.html`**

Portar a marcação de `pages/entradas-saidas.html` (listas `[data-planner-list="incomes|essentials|nonEssentials"]`, seletor `#plannerMonth`, campos de totais `[data-planner-*]`, `#plannerOwner`, `#plannerReset`, botões `[data-planner-add]`) para dentro do shell ATLAS (`.fx-main`/`.fx-content`), reestilizada com tokens ATLAS (a `planner.css` atual será adaptada para `financas.css`).

- [ ] **Step 3: Escrever `financas/js/pages/planejar.js`**

Portar toda a lógica de DOM de `js/entradas-saidas.js` (renderLists, renderTotals, bindEvents, savePlanner→usa `FinancePlanner.generateMovimentos`, boot), trocando as chamadas puras (`payDates`, `incomeEntries`, `incomeInMonth`, `installmentsTotal`, `generateMovimentos`, `defaultPlanner`) por `window.FinancePlanner.*`. Remover a dependência de `finance-cloud-ready` (rodar direto).

- [ ] **Step 4: Verificação (browser)**

Abrir `planejar.html`. Adicionar uma renda mensal (valor + dia), um gasto fixo e um gasto não fixo; confirmar que os totais (entradas/saídas/sobra/reserva/comprometimento) atualizam. Recarregar a página: os valores persistem (localStorage). Abrir `index.html`: a Visão geral reflete os lançamentos gerados. Testar frequência "Personalizada" (parcelas) e o botão "reiniciar orçamento".

- [ ] **Step 5: Commit**

```bash
git add financas/planejar.html financas/js/pages/planejar.js
git commit -m "feat(financas): página Planejar (motor de recorrência) no shell ATLAS"
```

---

## Task 9: Páginas de visualização — Entradas e Despesas

**Files:**
- Create: `financas/entradas.html`, `financas/js/pages/entradas.js`
- Create: `financas/despesas.html`, `financas/js/pages/despesas.js`

**Interfaces:**
- Consumes: `window.FinanceUtils`, `window.FinanceCharts`, `window.Shell`.
- Produces: páginas `data-page="entradas"` e `data-page="despesas"`.

- [ ] **Step 1: Portar `entradas.html` + `entradas.js`**

Marcação de `pages/entradas.html` (cards `[data-entradas-*]`, filtros `#entradaSearch`/`#entradaMonth`, `#entradasTableBody`, `<canvas id="entradasFonteChart">`) para o shell ATLAS; controller portado de `js/entradas.js` (sem `finance-cloud-ready`). Ajustar cores do bar chart para `FinanceCharts.colors.green`.

- [ ] **Step 2: Portar `despesas.html` + `despesas.js`**

Marcação de `pages/despesas.html` (cards `[data-despesas-*]`, filtros, `#despesasTableBody`, canvases `#essenciaisChart`/`#naoEssenciaisChart`/`#topCategoriasChart`, e o bloco "Lista de compras do mês": `#shoppingForm`, `[data-shopping-list]`, `#shoppingLaunch`, totais `[data-shopping-*]`) para o shell; controller portado de `js/despesas.js` (incluindo `renderShopping`/`bindShopping`, que persistem em `state.shopping`). Cores em tons de vermelho ATLAS.

- [ ] **Step 3: Verificação (browser)**

Com dados de exemplo: `entradas.html` mostra totais, tabela e gráfico por origem; filtro por mês/busca funciona. `despesas.html` mostra totais por tipo, tabelas, gráficos e a lista de compras (adicionar item, marcar pago, "lançar como despesa" cria linha em Despesas e persiste). Tema claro/escuro OK. Mobile: tabelas com scroll horizontal contido (`overflow-x:auto`), sem estourar a página.

- [ ] **Step 4: Commit**

```bash
git add financas/entradas.html financas/js/pages/entradas.js financas/despesas.html financas/js/pages/despesas.js
git commit -m "feat(financas): páginas Entradas e Despesas no shell ATLAS"
```

---

## Task 10: Investimentos reformulado — "aporte do mês"

**Files:**
- Create: `financas/investimentos.html`
- Create: `financas/js/pages/investimentos.js`

**Interfaces:**
- Consumes: `window.FinanceUtils`, `window.FinanceCharts`, `window.Shell`.
- Produces: página `data-page="investimentos"` simplificada; grava em `state.investments` mantendo compatibilidade com o que a Visão geral lê (`invested`).

- [ ] **Step 1: Definir o modelo simplificado**

`state.investments` passa a focar em **aportes mensais**: `{ monthly: [ { id, month: "YYYY-MM", value } ], invested }`, onde `invested` = soma dos aportes do ano corrente (ou acumulado — manter simples: soma de todos os `monthly`). Sem `assets`/`allocation`/`profitability`/`emergencyReserve`/`availableCash`. Migração leve: se existir formato antigo (`assets`), somar seus valores num único aporte do mês atual e descartar o resto (registrar em `migrateState` do store, ou numa função `migrateInvestments(inv)` chamada no boot).

- [ ] **Step 2: Montar `investimentos.html`**

Card de topo "Investido no total" + "Aporte deste mês"; uma lista simples de aportes por mês (mês + valor, adicionar/remover); um mini-gráfico de barras "aporte por mês" (`<canvas id="aporteMesChart">`). Copy deixa claro que é acompanhamento pessoal de quanto se guarda por mês — **sem preços de ativos, sem carteira**.

- [ ] **Step 3: Escrever `financas/js/pages/investimentos.js`**

Controller enxuto: renderiza total e lista de aportes; adicionar aporte (mês atual por padrão) / editar valor / remover; recomputa `invested`; persiste via `FinanceUtils.updateState`; desenha o bar chart por mês com `FinanceCharts.colors.green`.

- [ ] **Step 4: Verificação (browser)**

Adicionar aportes em 2–3 meses; confirmar total e gráfico por mês; recarregar e ver persistência; abrir a Visão geral e confirmar que "Investido" reflete o total. Nenhuma menção a ativos/rentabilidade/carteira. Tema claro/escuro OK.

- [ ] **Step 5: Commit**

```bash
git add financas/investimentos.html financas/js/pages/investimentos.js
git commit -m "feat(financas): Investimentos reformulado como aporte mensal (sem carteira)"
```

---

## Task 11: Relatórios e Análises — porta das páginas

**Files:**
- Create: `financas/relatorios.html`, `financas/js/pages/relatorios.js`
- Create: `financas/analises.html`, `financas/js/pages/analises.js`

**Interfaces:**
- Consumes: `window.FinanceUtils`, `window.FinanceCharts`, `window.Shell`.
- Produces: páginas `data-page="relatorios"` e `data-page="analises"`.

- [ ] **Step 1: Ler as fontes e portar**

Ler `js/relatorios.js`, `pages/relatorios.html`, `js/analises.js`, `pages/analises.html`. Portar marcação para o shell ATLAS e controllers para `pages/*.js`, trocando qualquer referência de `FinanceUtils` (já compatível via ponte), removendo `finance-cloud-ready`, e ajustando cores de gráfico para a paleta ATLAS. Preservar o CSV export de relatórios (usa `FinanceUtils.downloadText`/`toCsv`).

- [ ] **Step 2: Verificação (browser)**

Com dados de exemplo: relatórios geram tabelas/CSV corretamente (exportar e conferir o arquivo); análises renderizam seus gráficos/insights. Tema claro/escuro e mobile OK.

- [ ] **Step 3: Commit**

```bash
git add financas/relatorios.html financas/js/pages/relatorios.js financas/analises.html financas/js/pages/analises.js
git commit -m "feat(financas): páginas Relatórios e Análises no shell ATLAS"
```

---

## Task 12: Configurações + boas-vindas + carregar dados de exemplo + reset

**Files:**
- Create: `financas/configuracoes.html`, `financas/js/pages/configuracoes.js`
- Modify: `financas/js/pages/visao-geral.js` (empty state / welcome)

**Interfaces:**
- Consumes: `window.FinanceUtils` (`getState/saveState/updateState/resetState/downloadText/applyTheme`), `defaultState` (via bridge, p/ dados de exemplo).
- Produces: `data-page="configuracoes"`; welcome + "carregar dados de exemplo" na Visão geral.

- [ ] **Step 1: Configurações**

Portar `js/config.js`: tema (claro/escuro via `data-theme`+localStorage — reusar o toggle do shell), switches (animações, tabelas compactas), perfil (nome/e-mail/moeda), backup **exportar/importar JSON** (sobre localStorage), e **"restaurar dados"** → `FinanceUtils.resetState()`. Marcação portada de `pages/configuracoes.html`.

- [ ] **Step 2: Boas-vindas / carregar exemplo**

Na Visão geral, quando `getState()` estiver vazio (sem entries/expenses/planner), exibir um bloco de boas-vindas estilo ATLAS ("Seu Finanças está pronto — e vazio") com dois botões: **"Começar a planejar"** (→ `planejar.html`) e **"Carregar dados de exemplo"** (grava `defaultState` de demonstração via `saveState(refreshSummary(clone(defaultState)))` e recarrega).

- [ ] **Step 3: Verificação (browser)**

Estado vazio mostra boas-vindas; "carregar dados de exemplo" popula tudo e some com o welcome; exportar backup baixa JSON; importar restaura; "restaurar dados" limpa e volta ao vazio; trocar tema persiste após reload. Sem erros no console.

- [ ] **Step 4: Commit**

```bash
git add financas/configuracoes.html financas/js/pages/configuracoes.js financas/js/pages/visao-geral.js
git commit -m "feat(financas): Configurações, boas-vindas e dados de exemplo (local-first)"
```

---

## Task 13: PWA — manifest, service worker, ícones, offline

**Files:**
- Create: `financas/manifest.webmanifest`, `financas/sw.js`, `financas/offline.html`, `financas/js/pwa.js`
- Create: `financas/assets/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`
- Modify: todas as páginas `financas/*.html` (link do manifest + registro do SW + meta theme-color)

**Interfaces:**
- Produces: app instalável e offline. `pwa.js` registra `sw.js` com `scope` do módulo.

- [ ] **Step 1: `manifest.webmanifest`**

```json
{
  "name": "Finanças — ATLAS",
  "short_name": "Finanças",
  "description": "Fluxo de caixa pessoal do ATLAS",
  "start_url": "index.html",
  "scope": "./",
  "display": "standalone",
  "background_color": "#05080F",
  "theme_color": "#05080F",
  "lang": "pt-BR",
  "icons": [
    { "src": "assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "assets/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2: Ícones**

Gerar 3 PNGs com o emblema/gradiente ATLAS (fundo `#05080F`, marca ciano) nos tamanhos 192/512 e um maskable 512 com safe-area. Colocar em `assets/icons/`.

- [ ] **Step 3: `sw.js` (app-shell cache)**

Precache do shell e assets do módulo (todas as `*.html`, `css/atlas-tokens.css`, `css/financas.css`, `js/**`, ícones, `offline.html`). `install` → `caches.open(CACHE).addAll(ASSETS)`; `activate` → limpar caches antigos; `fetch` → cache-first para GET same-origin, com fallback para `offline.html` em navegação sem cache. Versionar `const CACHE = "financas-v1"`. As Google Fonts são cross-origin — não precachear; o fallback de sistema nos tokens garante boa aparência offline.

- [ ] **Step 4: `pwa.js` + wire nas páginas**

```js
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {}));
}
```
Em todas as `*.html`: adicionar `<link rel="manifest" href="manifest.webmanifest">`, `<meta name="theme-color" content="#05080F">`, `<link rel="apple-touch-icon" href="assets/icons/icon-192.png">` e `<script src="js/pwa.js" defer></script>`.

- [ ] **Step 5: Verificação (browser)**

Servir a pasta por HTTP (`npx http-server financas` ou `python -m http.server` dentro de `financas/`) — SW exige http(s). No DevTools → Application: manifest válido (sem erros), SW `activated`, ícones reconhecidos, prompt de instalação disponível (ou "Add to Home screen"). Ativar offline e recarregar: o app abre do cache; uma rota sem cache cai em `offline.html`.

- [ ] **Step 6: Commit**

```bash
git add financas/manifest.webmanifest financas/sw.js financas/offline.html financas/js/pwa.js financas/assets/icons
git commit -m "feat(financas): PWA instalável e offline (manifest + service worker)"
```

---

## Task 14: Limpeza do MundoDeFi + verificação final

**Files:**
- Delete (raiz antiga do MundoDeFi, agora substituída pelo módulo): `index.html` (raiz), `pages/`, `js/nexus*.js`, `js/pro-gate.js`, `css/nexus.css`, e demais arquivos raiz acoplados ao MundoDeFi que não foram reaproveitados.
- Verify: todo o módulo `financas/`.

**Interfaces:**
- Produces: build do módulo sem nenhum resíduo MundoDeFi/Firebase/Nexus.

- [ ] **Step 1: Confirmar paridade antes de apagar**

Checar que cada página do módulo `financas/` cobre a funcionalidade da página raiz correspondente (Visão geral↔dashboard, Planejar↔entradas-saidas, Entradas, Despesas, Investimentos↔aporte, Relatórios, Análises, Configurações). Só então remover os arquivos antigos da raiz.

- [ ] **Step 2: Remover arquivos antigos**

Apagar os arquivos raiz listados acima. Manter `docs/` e `.superpowers/`.

- [ ] **Step 3: Grep de resíduo (deve vir vazio)**

Run:
```bash
grep -rniE "mundodefi|firebase|nexus|pro-gate|Voltar ao MundoDeFi|Assine PRO|19,90" financas/ ; echo "exit: $?"
```
Expected: nenhum resultado (grep exit 1). Se aparecer algo, remover.

- [ ] **Step 4: Rodar toda a suíte de testes do core**

Run: `node --test "financas/test/*.test.js"` (a forma glob; a forma diretório `node --test financas/test/` falha no Node 24/Windows — alternativa equivalente: `cd financas && node --test`).
Expected: PASS em format/store/finance/recurrence (~19/19).

- [ ] **Step 5: Verificação visual final (browser, HTTP)**

Percorrer as 8 páginas nos temas claro e escuro, desktop e mobile (≤768px): shell ATLAS consistente, pílulas no desktop, barra inferior + ＋ no mobile, nenhum erro no console, nenhuma referência textual ao MundoDeFi, dados persistindo entre reloads.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(financas): remove resíduos MundoDeFi/Firebase/Nexus e valida a fundação"
```

---

## Self-Review (feito na escrita)

- **Cobertura do spec:** identidade/arquitetura (T1), navegação pílulas+bottom bar+FAB (T1/T7…), Visão geral "foco" (T7), Planejar preservado (T8) — corrigida a omissão do planner no mock, Entradas/Despesas (T9), Investimentos reformulado "aporte do mês" (T10), Relatórios/Análises (T11), local-first + welcome + exemplo + backup + reset (T3/T12), PWA (T13), rebrand/limpeza + verificação (T14). Core testável cobre store/migração/resumos/recorrência (T2–T5).
- **Placeholders:** tarefas de lógica têm código de teste real; tarefas visuais têm verificação de browser concreta (o "teste" de um front estático). Portes referenciam funções/arquivos-fonte exatos a relocar — não são placeholders.
- **Consistência de tipos:** `EXPENSE_TYPES` centralizado em `finance.js`; `generateMovimentos(state, planner, year)`, `payDates(income,start,end)`, `getState/saveState/updateState` com assinaturas idênticas entre tasks e ponte; `window.FinanceUtils`/`FinanceCharts`/`FinancePlanner` estáveis.
- **Ponto aberto conhecido (herdado do spec):** os tokens do ATLAS são recriados em `css/atlas-tokens.css` (sem download); ao colar o módulo no repo do ATLAS (conversa futura), trocar o `<link>` de `atlas-tokens.css` pelos `<link>` reais do tema do ATLAS e ajustar o `scope`/`start_url` do PWA ao caminho final. A ferramenta é entregue standalone e pronta.
```
