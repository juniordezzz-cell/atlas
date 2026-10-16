# Painel do Hold: pizzas 3D (opção A) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** trocar a pizza SVG "infantil" do Painel do Hold por uma pizza sólida 3D realista, com nome e % dentro das fatias, por token e por setor.

**Architecture:** a lógica de dados (agrupar, "Outros", sem preço, decidir rótulo) vira funções puras em `hold/js/charts.js`, testadas com Node. O desenho (`Charts.pie3d`) é SVG puro, reescrito para luz/sombra. `AtlasSetores.cor()` dá cor fixa a cada setor. O Painel só monta os dados e a legenda.

**Tech Stack:** HTML/CSS/JS puro, sem build; SVG; testes com `node` (v24) sem dependências.

**Spec:** `docs/superpowers/specs/2026-10-16-painel-pizzas-3d-design.md`

## Global Constraints

- Sem biblioteca nova, sem WebGL, sem glow, sem contorno externo.
- Paleta: `#4C7BD9 #2FA58F #D4A23A #8A6AD1 #C2566F #3E9BC0`, "Outros" `#66707F`; tema claro passa por `AtlasChartTheme.serie()`.
- No máximo 7 fatias; "Outros" único, cinza, sempre por último, dentro do limite.
- Base do %: soma das fatias (valor > 0). Rótulo e legenda mostram o mesmo número.
- Rótulo: ≥ 9 % nome + "34,4%"; 4,5–9 % só "%" inteiro; < 4,5 % nada.
- Textos em pt-BR; vírgula decimal.
- Subir `?v=hold-89` → `hold-90` em `hold/index.html` (cache do Pages).

## Review Focus

- Carteira com posições todas sem preço → disco cinza "sem preço", não "sem posições" (teste na Task 1).
- Setor "Outros" real + resto agrupado → uma fatia só (teste na Task 1).
- Uma posição só → disco inteiro, rótulo no centro (teste na Task 1 + conferência na Task 4).
- Nome longo ("Reserva de valor") numa fatia estreita → só o % (teste na Task 1).
- 12 posições → 6 + "Outros", cores sem repetir (teste na Task 1).

---

### Task 1: Funções puras de layout

**Files:**
- Modify: `hold/js/charts.js` (antes de `window.Charts = …`)
- Create: `hold/testes/pizza.test.js`

**Interfaces:**
- Produces:
  - `Charts.fatias(itens, opts) -> { fatias, semPreco, total }` — `itens: [{label, value, sub?, id?}]`; `opts.max` (padrão 7). `fatias: [{label, value, frac, sub, ids, id}]` em ordem de valor, "Outros" (agrupado + o que já vier com label "Outros") por último, `sub` do "Outros" = labels de dentro unidos por ", ". `semPreco: [label]` dos itens com value ≤ 0.
  - `Charts.rotulo(frac, label) -> { modo: "nome"|"pct"|"nenhum", fonte, texto }` — `texto` é "34,4%" no modo nome e "7%" no modo pct; `fonte` 12, ou 10,5 se label > 9 caracteres; se label > 9 caracteres e `frac < 0.16`, modo "pct".

- [ ] **Step 1: Teste que falha** — `hold/testes/pizza.test.js` carrega `charts.js` com `global.window = {}` e `assert`:
  - 12 itens de 10..120 → 7 fatias, a última "Outros" com value = soma dos 6 menores; soma dos `frac` = 1 (±1e-9).
  - itens `[{A,50},{Outros,10},{B,40},{C,0}]` → fatias A, B, Outros(10); `semPreco` = ["C"].
  - todos com value 0 → `fatias` vazio, `total` 0, `semPreco` com todos.
  - 1 item → 1 fatia, frac 1.
  - `rotulo(0.344,"ETH")` → `{modo:"nome", texto:"34,4%", fonte:12}`; `rotulo(0.07,"SOL")` → `{modo:"pct", texto:"7%"}`; `rotulo(0.03,"SUI").modo` = "nenhum"; `rotulo(0.12,"Reserva de valor").modo` = "pct"; `rotulo(0.2,"Reserva de valor")` → modo "nome", fonte 10.5.
- [ ] **Step 2:** `node hold/testes/pizza.test.js` → falha (`Charts.fatias is not a function`).
- [ ] **Step 3:** implementar `fatias` e `rotulo`; exportar em `window.Charts`.
- [ ] **Step 4:** `node hold/testes/pizza.test.js` → imprime "ok".

### Task 2: Cor fixa por setor

**Files:**
- Modify: `core/atlas-setores.js`
- Modify: `hold/testes/pizza.test.js` (casos novos)

**Interfaces:**
- Produces: `AtlasSetores.cor(setor) -> string hex`. Mapa fixo para os 16 de `lista`, "Outros" = `#66707F`, desconhecido = `#66707F`. DeFi `#4C7BD9`, Layer 1 `#2FA58F`, Oráculos `#D4A23A`, RWA `#8A6AD1`, IA `#C2566F`, DePIN `#3E9BC0`; os demais escolhidos pelo implementador, distintos desses seis.

- [ ] **Step 1: Teste** — carregar `atlas-setores.js` com `global.window = global; global.localStorage` falso; `assert.equal(cor("RWA"), "#8A6AD1")`, `cor("Outros") === "#66707F"`, `cor("xyz") === "#66707F"`, os 15 setores fora "Outros" com cores todas diferentes.
- [ ] **Step 2:** rodar → falha. **Step 3:** implementar. **Step 4:** rodar → "ok".

### Task 3: `pie3d` com luz e rótulos internos

**Files:**
- Modify: `hold/js/charts.js` (substitui o `pie3d` atual)

**Interfaces:**
- Consumes: `Charts.rotulo` (Task 1).
- Produces: `Charts.pie3d(fatias, opts) -> SVGElement` com `.destacar(i)`; `fatias: [{label, value, frac, color, onClick?}]`; `opts.vazio` (texto do disco cinza), `opts.ariaLabel`.

Geometria e luz exatamente como na spec (elipse ry = rx/2, espessura ≈ 0,19·rx, viewBox 300×215, sombra radial no chão, degradê horizontal na parede, véu vertical no topo, separação 1,2 px na cor `--surface`, ids de degradê únicos por gráfico). Rótulo a 60 % do raio no ângulo médio; 1 fatia → rótulo no centro. Texto branco com `paint-order: stroke` e contorno `rgba(0,0,0,.35)` 2,5 px. Fatia deslocada ~8 px no hover/`destacar`; sem transição se `prefers-reduced-motion`. `<title>` por fatia: "ETH · US$ 700 · 34,4%" (valor via `window.UI.money` se existir).

- [ ] **Step 1:** implementar.
- [ ] **Step 2:** `node hold/testes/pizza.test.js` continua "ok" (nada quebrou no carregamento).

### Task 4: Painel usa o novo componente

**Files:**
- Modify: `hold/js/pages/dashboard.js` (bloco "DUAS PIZZAS")
- Modify: `hold/css/components.css` (bloco das pizzas)
- Modify: `hold/index.html` (`hold-89` → `hold-90`)

**Interfaces:**
- Consumes: `Charts.fatias`, `Charts.pie3d`, `Charts.pieColor` (cores de token por ranking, cinza no "Outros"), `AtlasSetores.cor`.

- [ ] **Step 1:** montar `itens` de token (`label` ticker, `sub` nome, `id`) e de setor (`sub` tickers), passar por `Charts.fatias`, colorir (token: `pieColor(i)`, setor: `AtlasSetores.cor`), legenda com % = `frac` (não mais `/ val`), linha "sem preço: …" quando `semPreco` não for vazio, disco "sem preço" quando todas estiverem sem preço, `aria-label` "ETH 34 %, AAVE 23 %…".
- [ ] **Step 2: Conferir no navegador do Claude** (`/hold/index.html?atlas-dev=1`, dados de teste só nele): vazio, 1, 4, 8 e 12 posições; uma posição com preço 0; escuro e claro; 1600 px e 375 px. Esperado: rótulos dentro e legíveis, nenhum rótulo em fatia < 4,5 %, % da fatia = % da legenda, sem rolagem lateral, console sem erros.
- [ ] **Step 3:** mostrar captura ao dono; só depois commitar (`hold/`, `core/atlas-setores.js`, spec e plano).
