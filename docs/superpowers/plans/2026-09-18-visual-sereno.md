# Visual Sereno Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o visual "quadrado / cara de IA" do ATLAS por um visual sereno de empresa séria: fundo liso, seções abertas em vez de cartões, números grandes em destaque, sem efeitos de luz.

**Architecture:** Uma camada CSS nova (`themes/atlas-sereno.css`) carregada por último em cada página do escopo faz ~80% da mudança por cima dos estilos existentes; o spotlight/feixe é desligado na origem (`core/ui/atlas-magic.*`); depois, passes curtos no CSS de cada módulo cobrem o que a camada central não alcança.

**Tech Stack:** HTML/CSS/JS puro, sem build. Servidor local `py -3 -m http.server 8777` (já configurado em `.claude/launch.json`, nome `atlas`). Verificação no navegador com `?atlas-dev=1` (dispensa login só em localhost).

**Spec:** `docs/superpowers/specs/2026-09-18-visual-sereno-design.md`

## Global Constraints

- Escopo: Dashboard, Hold, Trade, DeFi (todas as páginas menos `testes.html`), RWA, Academy, Carteiras, Relatórios, Configurações, Ferramentas (hub), Scanner Pools, Login, Landing, Boas-vindas, shell comum, tema claro.
- Fora: `index.html` (Boot), `Ferramentas/entradas-saidas/financas/**`, `defi/testes.html`, `pages/offline.html`.
- Só CSS + o `<link>` novo + remoção do spotlight/feixe em `atlas-magic.*`. Nenhuma mudança em HTML estrutural nem em JS de dados.
- Não zerar `--atlas-border` global. Campos, tabelas, menus, modais continuam com contorno legível.
- Nada com informação recebe `display:none`. Sobretítulo só some quando o título vizinho já diz o mesmo.
- Fundo: sem grade, sem estrelas, sem textura; azul-noite liso com degradê vertical quase imperceptível.
- Acento do módulo só em: item ativo do menu, botão primário, variação +/−, foco de campo. Sem glow em nada.
- Números: Inter com `font-variant-numeric: tabular-nums` (JetBrains Mono sai dos valores).
- Contêiner necessário (modal, menu, popover, drawer, onboarding): preenchido, sem contorno, raio ~20px.
- Mantidos: contagem dos totais (`[data-atlas-count]`), entrada suave das telas, fita de cotações do Academy.
- Um commit por task. Mensagens em português, terminando com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Como verificar (vale para toda task — o "teste" deste projeto)

Não há suíte automatizada de CSS. O ciclo de cada task é **antes → mudança → depois** no navegador:

1. `preview_start {name:"atlas"}` (ou, se a porta 8777 já estiver servida por outra sessão, `navigate` direto para `http://localhost:8777/...`).
2. Abrir a página com `?atlas-dev=1`, `resize_window` 1440×900, screenshot "antes".
3. Aplicar a mudança; recarregar com cache ignorado: `javascript_tool` → `location.reload()` (se o CSS não pegar, é o service worker: em DevTools não temos acesso, então rodar `javascript_tool` → `navigator.serviceWorker.getRegistrations().then(r=>Promise.all(r.map(x=>x.unregister()))).then(()=>caches.keys()).then(k=>Promise.all(k.map(c=>caches.delete(c))))` e recarregar).
4. Screenshot "depois" em 1440×900 e em `preset:"mobile"`; alternar tema claro (`javascript_tool` → `document.documentElement.setAttribute('data-theme','light')`) e ver de novo.
5. `read_console_messages {onlyErrors:true}` — nenhum erro novo.
6. Interação mínima: abrir o seletor de carteira da topbar, abrir um modal do módulo (botão primário da tela), fechar.
7. Checagem de rolagem horizontal no mobile: `javascript_tool` → `document.documentElement.scrollWidth <= innerWidth` deve dar `true`.
8. `preset:"desktop"` ao terminar.

Ferramenta de inventário de caixas (usada nos passes por módulo) — salve em scratchpad como `boxes.py`:

```python
import re,sys
SKIP=re.compile(r'btn|button|input|select|kbd|chip|tag|badge|pill|toggle|switch|track|dot|scroll|toast|tip|modal|menu|pop|cmdk|search|field|campo|tab\b|seg|x\b|close|send|ico|emoji|avatar|thumb|swatch|legend|bar\b|fill',re.I)
for f in sys.argv[1:]:
    s=re.sub(r'/\*.*?\*/','',open(f,encoding='utf-8').read(),flags=re.S)
    print('=== '+f)
    for m in re.finditer(r'([^{}@]+)\{([^{}]*)\}',s):
        sel=' '.join(m.group(1).split()); b=m.group(2)
        if ':hover' in sel or ':focus' in sel: continue
        if re.search(r'(?<![-\w])border(-top|-bottom|-left|-right)?\s*:\s*(1px|2px|var)',b) \
           and re.search(r'background(-color)?\s*:\s*(?!transparent|none)',b) \
           and 'border-radius' in b and not SKIP.search(sel):
            print('  '+sel)
```

Rodar: `py -3 <scratchpad>/boxes.py <arquivos.css>`.

---

### Task 1: Camada central `atlas-sereno.css` + ligação nas páginas + service worker

**Files:**
- Create: `themes/atlas-sereno.css`
- Modify (inserir `<link>` imediatamente antes de `</head>`): `pages/dashboard.html`, `pages/carteiras.html`, `pages/configuracoes.html`, `pages/ferramentas.html`, `pages/relatorios.html`, `pages/login.html`, `pages/landing.html`, `pages/boas-vindas.html`, `hold/index.html`, `trade/index.html`, `RWA/index.html`, `academy/index.html`, `defi/index.html`, `defi/pools.html`, `defi/pool.html`, `defi/staking.html`, `defi/lending.html`, `defi/analytics.html`, `defi/historico.html`
- Modify: `sw.js` (lista `CASCA` e `VERSAO`)

**Interfaces:**
- Produces: tokens `--sereno-bg-top`, `--sereno-bg-bottom`, `--sereno-rule`, `--sereno-fill`, `--sereno-fill-hi`, `--sereno-r`, `--sereno-gap` em `:root`/tema claro; classes-alvo existentes estilizadas (`.card`, `.panel`, `.kpi`, `.set-card`, `.wcard`, `.est__card`, `.fin-card`, `.pos-card`, `.hpanel`, `.chart-card`, `.rep-card`, `.tool-card`, `.lp-card`, `.onboard`). Tasks 3–11 só acrescentam regras no CSS do próprio módulo ou num bloco com o nome do módulo **no fim** deste arquivo.

- [ ] **Step 1: Screenshot "antes"** de `pages/dashboard.html` e `hold/index.html` (1440×900). Guardar mentalmente para o checkpoint da Task 2.

- [ ] **Step 2: Criar `themes/atlas-sereno.css`**

```css
/* ===================================================================
   ATLAS — VISUAL SERENO
   -------------------------------------------------------------------
   Camada final do visual. Carregada POR ÚLTIMO em cada página, ela
   troca a linguagem "painel de terminal" (caixa dentro de caixa,
   malha no fundo, fio de luz, cantoneiras de HUD) por uma linguagem
   de relatório de portfólio: fundo liso, seções abertas separadas por
   espaço e linha fina, números grandes como protagonistas.

   Remover o <link> deste arquivo devolve o visual anterior inteiro.
   Spec: docs/superpowers/specs/2026-09-18-visual-sereno-design.md
   =================================================================== */

/* ---------- 0. Tokens ---------- */
:root,
html[data-theme="dark"] {
  --sereno-bg-top:    #0B1120;
  --sereno-bg-bottom: #070B15;
  --sereno-rule:      rgba(160, 185, 230, 0.08);   /* linha entre seções */
  --sereno-fill:      rgba(148, 170, 215, 0.045);  /* contêiner necessário */
  --sereno-fill-hi:   rgba(148, 170, 215, 0.075);  /* hover de clicável */
  --sereno-r:         20px;
  --sereno-gap:       40px;                        /* respiro entre seções */
}
html[data-theme="light"] {
  --sereno-bg-top:    #F6F8FC;
  --sereno-bg-bottom: #EEF2F8;
  --sereno-rule:      rgba(15, 30, 60, 0.09);
  --sereno-fill:      rgba(15, 30, 60, 0.035);
  --sereno-fill-hi:   rgba(15, 30, 60, 0.06);
}

/* ---------- 1. Fundo liso ---------- */
html {
  background: linear-gradient(180deg, var(--sereno-bg-top) 0%, var(--sereno-bg-bottom) 100%) fixed;
  background-color: var(--sereno-bg-bottom);
}
/* a malha de engenharia e os brilhos de canto (atlas-effects §9) */
body::before { content: none !important; }

/* ---------- 2. Seções abertas: o cartão de conteúdo perde a caixa ---------- */
html .card,
html .panel,
html .set-card,
html .wcard,
html .est__card,
html .fin-card,
html .pos-card,
html .hpanel,
html .chart-card,
html .rep-card {
  background: transparent;
  background-image: none;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  -webkit-backdrop-filter: none;
          backdrop-filter: none;
  padding-left: 0;
  padding-right: 0;
}
/* sem pulinho, sem sombra, sem borda acesa no hover */
html .card:hover, html .panel:hover, html .set-card:hover, html .wcard:hover,
html .est__card:hover, html .fin-card:hover, html .pos-card:hover,
html .kpi:hover, html .hpanel:hover, html .chart-card:hover, html .rep-card:hover {
  transform: none;
  box-shadow: none;
  border-color: transparent;
}
/* fio de luz (§10) e cantoneiras de HUD (§11) */
html .card::before, html .panel::before, html .set-card::before, html .kpi::before,
html .kpi::after {
  content: none;
}

/* linha fina entre seções irmãs empilhadas */
html :is(.card, .panel, .set-card, .hpanel, .chart-card, .rep-card)
  + :is(.card, .panel, .set-card, .hpanel, .chart-card, .rep-card) {
  border-top: 1px solid var(--sereno-rule);
  padding-top: var(--atlas-sp-7);
}

/* cartões clicáveis: só clareiam o fundo */
html :is(a.card, .card--link, .card[role="button"], .card.is-clickable, .tool-card, .lp-card, .wcard[role="button"]) {
  background: var(--sereno-fill);
  border: 0;
  border-radius: var(--sereno-r);
  box-shadow: none;
  padding-left: var(--atlas-sp-5);
  padding-right: var(--atlas-sp-5);
}
html :is(a.card, .card--link, .card[role="button"], .card.is-clickable, .tool-card, .lp-card, .wcard[role="button"]):hover {
  background: var(--sereno-fill-hi);
  transform: none;
  box-shadow: none;
}

/* ---------- 3. Faixa de números ---------- */
/* a linha que contém KPIs vira uma faixa: sem caixas, traço fino entre eles */
html :has(> .kpi + .kpi) {
  gap: 0;
}
html .kpi {
  background: transparent;
  background-image: none;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  padding: var(--atlas-sp-2) var(--atlas-sp-6);
}
html .kpi + .kpi { border-left: 1px solid var(--sereno-rule); }
html .kpi:first-child { padding-left: 0; }
/* ícone decorativo no canto do KPI */
html .kpi :is(.kpi-ic, .kpi__ic, .kpi-icon, .kpi__icon) { display: none; }

html :is(.kpi-val, .kpi-v, .kpi__value, .kpi .valor, .stat-value, .metric-value) {
  font-family: var(--atlas-font-ui);
  font-size: clamp(1.5rem, 1.1rem + 0.9vw, 2rem);
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
/* o primeiro KPI é o número principal da tela */
html .kpi:first-child :is(.kpi-val, .kpi-v, .kpi__value, .valor) {
  font-size: clamp(1.8rem, 1.2rem + 1.4vw, 2.5rem);
}
/* rótulo do KPI: discreto, caixa normal */
html :is(.kpi-label, .kpi__label, .kpi .rotulo) {
  text-transform: none;
  letter-spacing: 0;
  font-size: var(--atlas-fs-sm);
  font-weight: 500;
  color: var(--atlas-text-mut, var(--atlas-text));
}

/* números fora do KPI também saem da monoespaçada */
html :is(.money, .num, [data-num], td.num, .est__ticker) {
  font-family: var(--atlas-font-ui);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

/* no celular a faixa quebra em duas colunas; o traço vira espaço */
@media (max-width: 640px) {
  html :has(> .kpi + .kpi) { row-gap: var(--atlas-sp-5); }
  html .kpi, html .kpi:first-child { padding-left: 0; padding-right: var(--atlas-sp-4); }
  html .kpi + .kpi { border-left: 0; }
}

/* ---------- 4. Tipografia de seção ---------- */
html :is(.eyebrow, .card-eyebrow, .panel-eyebrow, .sec-eyebrow) {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
  font-size: var(--atlas-fs-sm);
  color: var(--atlas-text-mut, var(--atlas-text));
}
html :is(.card, .panel, .hpanel, .chart-card) :is(h2, h3, .card-title, .panel-title) {
  font-size: var(--atlas-fs-h2);
  letter-spacing: var(--atlas-track-display);
}

/* ---------- 5. Contêineres necessários: preenchidos, sem contorno ---------- */
html :is(.onboard, .modal, .rmodal, .atlas-applauncher__panel, .atlas-bell__pop, .atlas-oraculo__panel, .atlas-cal) {
  border-color: transparent;
  border-radius: var(--sereno-r);
}
html .onboard {
  background: var(--sereno-fill);
  box-shadow: none;
}
html :is(.onboard-card, .quick-item, .mini-stat, .scenario, .cap-calc, .obj-item, .fee-item, .cmp) {
  background: var(--sereno-fill);
  border-color: transparent;
  border-radius: 14px;
  box-shadow: none;
}

/* ---------- 6. Sem glow em lugar nenhum ---------- */
html {
  --atlas-glow: none;
  --atlas-glow-strong: none;
}
html :is(.btn, .btn-primary, .btn--primary, button):hover {
  box-shadow: none;
}

/* ---------- 7. Respiro entre blocos ---------- */
html :is(.grid, .row) + :is(.grid, .row) { margin-top: var(--atlas-sp-7); }
```

- [ ] **Step 3: Inserir o `<link>` em cada HTML listado.** Rode (Bash, na raiz do repo):

```bash
for f in pages/dashboard.html pages/carteiras.html pages/configuracoes.html pages/ferramentas.html pages/relatorios.html pages/login.html pages/landing.html pages/boas-vindas.html; do
  grep -q atlas-sereno.css "$f" || sed -i 's#</head>#  <link rel="stylesheet" href="../themes/atlas-sereno.css">\n</head>#' "$f"
done
for f in hold/index.html trade/index.html RWA/index.html academy/index.html defi/index.html defi/pools.html defi/pool.html defi/staking.html defi/lending.html defi/analytics.html defi/historico.html; do
  grep -q atlas-sereno.css "$f" || sed -i 's#</head>#  <link rel="stylesheet" href="../themes/atlas-sereno.css">\n</head>#' "$f"
done
grep -c "atlas-sereno.css" pages/*.html hold/index.html trade/index.html RWA/index.html academy/index.html defi/*.html
```

Expected: `1` para cada arquivo do escopo; `0` para `defi/testes.html` e `pages/offline.html`. Conferir `index.html` (Boot) sem o link: `grep -c atlas-sereno index.html` → `0`.

- [ ] **Step 4: Service worker.** Em `sw.js`, logo após `"themes/atlas-effects.css",` na lista `CASCA`, acrescentar `"themes/atlas-sereno.css",`. Trocar `var VERSAO = "atlas-v59";` por `var VERSAO = "atlas-v60";` e acrescentar acima dela, junto das notas de versão:

```js
/* v60 = visual sereno (themes/atlas-sereno.css): fundo liso, seções
   abertas, faixa de números; sai spotlight/feixe do Magic UI. */
```

- [ ] **Step 5: Verificar** (ciclo "Como verificar") em `pages/dashboard.html` e `hold/index.html`: grade sumiu, KPIs viraram faixa, painéis sem caixa, modal "Nova tese" do Hold abre com fundo preenchido e campos com contorno, seletor de carteira abre, console limpo, sem rolagem horizontal no mobile, tema claro legível.

- [ ] **Step 6: Commit**

```bash
git add themes/atlas-sereno.css sw.js pages/*.html hold/index.html trade/index.html RWA/index.html academy/index.html defi/*.html
git commit -m "Visual sereno: camada central com fundo liso, secoes abertas e faixa de numeros

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Desligar spotlight e feixe + checkpoint com o usuário

**Files:**
- Modify: `core/ui/atlas-magic.js` (remover spotlight/feixe; manter contagem)
- Modify: `core/ui/atlas-magic.css` (remover seções 1 e 2 e as regras `.atlas-beam` dos interruptores; manter 4 e o resto)
- Modify: `core/ui/atlas-shell.js:72-83` (atualizar o comentário: agora só contagem e fita)

**Interfaces:**
- Consumes: nada.
- Produces: `atlas-magic.js` continua expondo a contagem para `[data-atlas-flash], [data-atlas-count]` (sem mudança de API).

- [ ] **Step 1: Ler `core/ui/atlas-magic.js` inteiro** e localizar: `SPOT_SEL`, `BEAM_SEL`, `camada`, `prepararHost`, `iniciarSpot` (inclui o listener `pointermove`) e a chamada de `iniciarSpot()` no fim do arquivo.

- [ ] **Step 2: Remover esses cinco itens e a chamada.** Se `camada`/`prepararHost` forem usados por algo além do spotlight/feixe, manter o que for usado. Atualizar o cabeçalho do arquivo para listar só "CONTAGEM (number-ticker)".

- [ ] **Step 3: Em `atlas-magic.css`**, apagar do comentário de cabeçalho as linhas 1 e 2, apagar os blocos `/* ---------- 1. SPOTLIGHT` e `/* ---------- 2. FEIXE NA BORDA` inteiros, e nos interruptores apagar `html[data-anim="off"] .atlas-beam { display: none; }` e `.atlas-beam { display: none; }` do `@media (prefers-reduced-motion)`.

- [ ] **Step 4: Verificar** com `javascript_tool` no Dashboard após recarregar: `document.querySelectorAll('.atlas-spot, .atlas-beam').length` → `0`. Passar o mouse sobre um KPI e sobre um card de `pages/ferramentas.html`: nenhuma luz. Números do Dashboard ainda contam ao carregar (se houver valor > 0; com carteira vazia, conferir só ausência de erro no console). Fita do Academy ainda anda.

- [ ] **Step 5: Commit**

```bash
git add core/ui/atlas-magic.js core/ui/atlas-magic.css core/ui/atlas-shell.js
git commit -m "Magic UI: sai o spotlight do mouse e o feixe na borda; contagem e fita ficam

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: CHECKPOINT.** Enviar ao usuário screenshots antes/depois do Dashboard e do Hold (1440×900) e **esperar aprovação do visual** antes da Task 3. Ajustes pedidos entram em `atlas-sereno.css` e são commitados antes de seguir.

---

### Task 3: Shell comum (sidebar, topbar, seletor de carteira, Oráculo, notificações)

**Files:**
- Modify: `themes/atlas-sereno.css` (bloco novo no fim: `/* ---------- Shell ---------- */`)
- Read-only para descobrir seletores: `core/ui/atlas-shell.css`, `wallets/walletSelector.css`, `themes/atlas-effects.css` §4

**Interfaces:**
- Consumes: tokens `--sereno-*` da Task 1.

- [ ] **Step 1: Inventário.** `py -3 <scratchpad>/boxes.py core/ui/atlas-shell.css wallets/walletSelector.css core/ui/atlas-calendar.css core/ui/atlas-onboarding.css` e `grep -n "glow\|box-shadow: 0 0" core/ui/atlas-shell.css wallets/walletSelector.css themes/atlas-effects.css`. Conhecidos: `.atlas-backfoot`, `.atlas-oraculo__panel`, `.atlas-oraculo__pin`, `.atlas-applauncher__panel`, `.atlas-appcard`, `.atlas-bell__pop`, `.atlas-cal`, `.aonb__opcao`.

- [ ] **Step 2: Acrescentar ao fim de `atlas-sereno.css`:**

```css
/* ---------- Shell ---------- */
/* sidebar e topbar: sem moldura; só uma linha fina separa do conteúdo */
html :is(.sidebar, .atlas-sidebar, .side, .rail) {
  background: transparent;
  box-shadow: none;
  border-right: 1px solid var(--sereno-rule);
}
html :is(.topbar, .atlas-topbar, .topnav, .header) {
  background: color-mix(in srgb, var(--sereno-bg-top) 82%, transparent);
  box-shadow: none;
  border-bottom: 1px solid var(--sereno-rule);
}
/* item ativo do menu: fundo suave + acento no texto, sem trilho luminoso */
html :is(.nav-item, .atlas-nav a, .sidebar a, .topnav a).active,
html :is(.nav-item, .atlas-nav a, .sidebar a, .topnav a)[aria-current="page"] {
  background: var(--sereno-fill-hi);
  box-shadow: none;
  border-color: transparent;
}
html :is(.nav-item, .atlas-nav a, .sidebar a, .topnav a).active::before,
html :is(.nav-item, .atlas-nav a, .sidebar a, .topnav a)[aria-current="page"]::before {
  box-shadow: none;
}
html :is(.atlas-appcard, .atlas-backfoot, .aonb__opcao) {
  border-color: transparent;
  background: var(--sereno-fill);
  box-shadow: none;
}
```

- [ ] **Step 3: Ajustar os seletores reais.** Com `read_page` no Dashboard, no Hold e no DeFi, anotar as classes efetivas da sidebar, topbar e item ativo; trocar os seletores genéricos acima pelos reais (remover os que não existem). O item ativo deve continuar visivelmente destacado.

- [ ] **Step 4: Verificar** (ciclo completo) em Dashboard, Hold, DeFi, Trade: abrir seletor de carteira, sino de notificações, app launcher, Ctrl+K, Oráculo. Tudo legível, sem glow, sem moldura dupla.

- [ ] **Step 5: Commit** — `git add themes/atlas-sereno.css && git commit -m "Visual sereno: shell comum sem molduras nem brilho" ` (+ linha Co-Authored-By).

---

### Tasks 4–10: Passes por módulo

Cada uma segue **exatamente** este roteiro, com os arquivos e seletores da própria task:

1. Screenshot "antes" das páginas listadas (1440×900).
2. Inventário: `py -3 <scratchpad>/boxes.py <CSS do módulo>` + `grep -n "eyebrow\|uppercase\|glow\|border: 1px dashed" <CSS do módulo>`.
3. Para cada seletor do inventário, classificar: **(a) seção de conteúdo** → acrescentar à lista de "seções abertas" (bloco do módulo no fim de `atlas-sereno.css`, mesmas declarações do §2 da Task 1); **(b) contêiner necessário** (formulário/modal/menu/destaque explicativo) → `background: var(--sereno-fill); border-color: transparent; border-radius: var(--sereno-r); box-shadow: none;`; **(c) elemento interno** que só existe para emoldurar (estado vazio com borda tracejada, "empty-art", glyph de fundo) → `background: none; border: 0;`.
4. Sobretítulos em caixa alta do módulo: aplicar o mesmo tratamento do §4 da Task 1; esconder só se repetirem o título ao lado.
5. Verificação completa (ciclo "Como verificar") nas páginas listadas, incluindo abrir o modal principal e um filtro/aba.
6. Commit: `Visual sereno: <módulo>` (+ Co-Authored-By).

### Task 4: Dashboard
- Páginas: `pages/dashboard.html`
- CSS: `css/dashboard.css`
- Conhecidos: `.premium` (b), `.card` (a — já coberto), `.kpi` (já coberto), `.onboard` (b — já coberto), `.onboard-card` (b — já coberto), `.alert-empty` (c), `.tb-menu__empty` (c).

### Task 5: Hold
- Páginas: `hold/index.html` (rotas Painel, Ativos, Métricas, Histórico, Relatórios pela sidebar)
- CSS: `hold/css/components.css`, `hold/css/global.css`
- Conhecidos: `.card` (a), `.confirm-list .ci` (b), `.scenario` (b), `.quick-item` (b — ações rápidas do topo do Painel), `.funil .fn-linha.destaque` (b), estado vazio renderizado por `U.empty` em `hold/js/components.js` (c — procurar a classe lá).

### Task 6: Trade
- Páginas: `trade/index.html` (todas as abas)
- CSS: `trade/assets/css/components.css`, `trade/assets/css/dashboard.css`, `trade/assets/css/oraculo.css`
- Conhecidos: `.card` (a), `.est__card` (a), `.empty__glyph` (c), `.nsum__orb` (conferir: se for decorativo com glow, tirar o glow; manter a forma), `.oraculo__panel` (b).

### Task 7: DeFi
- Páginas: `defi/index.html`, `pools.html`, `pool.html`, `staking.html`, `lending.html`, `analytics.html`, `historico.html`
- CSS: `defi/css/cards.css`, `defi/css/global.css`, `defi/css/forms.css`, `defi/css/tables.css`
- Conhecidos: `.panel`, `.fin-card`, `.pos-card` (a); `.mini-stat`, `.cap-calc`, `.obj-item`, `.fee-item`, `.cmp`, `.opt` (b); `.empty-art` (c); `.hist-row` (manter como linha de tabela: `background: transparent; border: 0; border-bottom: 1px solid var(--sereno-rule); border-radius: 0;`). O ícone no canto dos KPIs do DeFi (`.fin-card` com ícone quadrado): localizar a classe e escondê-lo como no §3.

### Task 8: RWA
- Páginas: `RWA/index.html`
- CSS: `RWA/css/components.css`, `RWA/css/layout.css`
- Conhecidos: `.panel` (a), `.narrative-hero` (b), `.empty-art` (c), `.rmodal` (b — já coberto), `.rinput` (manter contorno).

### Task 9: Academy
- Páginas: `academy/index.html` (Command Center e página de ativo)
- CSS: `academy/css/academy.css`
- Conhecidos: `.hpanel`, `.chart-card` (a — já cobertos); `.kpi-strip`, `.cc-metrics`, `.metric-grid` (faixas de número desenhadas com `gap:1px` sobre fundo de linha — converter em faixa: `background: transparent; border: 0; border-radius: 0; gap: 0;` e filhos com `border-left: 1px solid var(--sereno-rule)` a partir do segundo); `.cc-tape` (b, mantém a fita); `.tabs`, `.athatl-box`, `.asset-head` (a); `.hud-bar` (conferir: se for moldura decorativa, (c)).

### Task 10: Carteiras, Relatórios, Configurações, Ferramentas
- Páginas: `pages/carteiras.html`, `pages/relatorios.html`, `pages/configuracoes.html`, `pages/ferramentas.html`
- CSS: `css/carteiras.css`, `css/relatorios.css`, `css/configuracoes.css`, `css/ferramentas.css`
- Conhecidos: `.cx-hero-card`, `.cx-wallet-card` (b — carteira é objeto clicável, fica preenchida); `.rep-kpi` (tratar como `.kpi`: acrescentar `.rep-kpi` aos seletores do §3 de `atlas-sereno.css`); `.rep-card`, `.rep-proj` (a); `.set-card` (a — já coberto); `.locked`, `.sup-relatorio` (b); `.tool-card` (clicável — já coberto).

---

### Task 11: Login, Landing, Boas-vindas

**Files:**
- Modify: `themes/atlas-sereno.css` (bloco `/* ---------- Entrada ---------- */`)
- Read-only: `css/landing.css`, `css/atlas-celestial.css`, `pages/login.html`, `pages/boas-vindas.html`

- [ ] **Step 1:** Screenshot "antes" das três páginas. Atenção: `css/atlas-celestial.css` é a identidade cósmica herdada do Boot. **Nestas três páginas de entrada o cosmos é mantido** (é a porta de entrada, como o Boot); só saem a grade (já coberta pela Task 1) e molduras/brilhos.
- [ ] **Step 2:** Inventário com `boxes.py css/landing.css css/atlas-celestial.css`. Conhecidos: `.lp-card` (clicável — já coberto), `.lp-passo__n` (número do passo: manter forma, tirar borda luminosa se houver).
- [ ] **Step 3:** Se `html::before`/`body::before` for usado pelo fundo celeste destas páginas e a Task 1 o tiver apagado, restaurar só nelas com um seletor de página (ex.: `html:has(body.lp) body::before { content: ""; }` usando a classe real do `<body>`) — conferir no screenshot se o céu sumiu.
- [ ] **Step 4:** Verificação completa; no Login, o botão de entrar com Google continua visível e clicável (não clicar para autenticar).
- [ ] **Step 5:** Commit `Visual sereno: login, landing e boas-vindas`.

---

### Task 12: Scanner Pools (CSS próprio)

**Files:**
- Modify: `Ferramentas/scanner-pools/index.html` (só o bloco `<style>` inline)

- [ ] **Step 1:** Ler o `<style>` inteiro e o screenshot "antes" (`http://localhost:8777/Ferramentas/scanner-pools/index.html?atlas-dev=1`).
- [ ] **Step 2:** Aplicar os mesmos princípios diretamente no `<style>`, sem importar `atlas-sereno.css` (a página não carrega o tema do ATLAS e não deve passar a carregar): fundo liso (remover grade/pontos de fundo se houver), cartões de pool viram linhas/seções com `border-bottom: 1px solid rgba(160,185,230,0.08)`, contêineres necessários preenchidos sem contorno com raio 20px, números em Inter/`tabular-nums` se a fonte estiver disponível (senão fonte do sistema), sem glow.
- [ ] **Step 3:** Verificação completa (a página exige login: usar `?atlas-dev=1`). A busca/listagem de pools continua funcionando (console sem erro, lista renderiza).
- [ ] **Step 4:** Commit `Visual sereno: Scanner Pools`.

---

### Task 13: Revisão final

- [ ] **Step 1:** Varredura visual em todas as páginas do escopo, 1440×900 e mobile, escuro e claro; anotar qualquer caixa remanescente com borda, brilho ou grade e corrigir no bloco do módulo.
- [ ] **Step 2:** Conferir que Boot (`index.html`) e Finanças (`Ferramentas/entradas-saidas/financas/index.html`) estão **idênticos** ao início (`git diff 87725a1 -- index.html Ferramentas/entradas-saidas/financas` vazio).
- [ ] **Step 3:** `git diff 87725a1 --stat` e conferir que só CSS, os `<link>`, `sw.js` e `atlas-magic.*`/comentário do shell mudaram (nenhum JS de dados).
- [ ] **Step 4:** Atualizar a memória do projeto com o princípio do visual sereno (arquivo novo em `memory/`, ponteiro no `MEMORY.md`), incluindo "o spotlight/feixe foram removidos a pedido — não reintroduzir".
- [ ] **Step 5:** Commit final se houver ajustes; relatório ao usuário com screenshots de antes/depois de 3–4 telas.
