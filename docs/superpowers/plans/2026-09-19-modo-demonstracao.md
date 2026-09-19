# Modo demonstração Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard abre com dados de exemplo num ATLAS vazio, com faixa "Modo demonstração" e botão de limpar; formulários de criar dados pedem para limpar antes.

**Architecture:** `core/atlas-demo.js` guarda o estado (`atlas.demo.v1`: ausente | "ativo" | "limpo"), gera o conjunto fictício no formato de `buildAtlasData()` e oferece `bloquear(continuar)` para as funções que abrem formulários de criação. Nada fictício é gravado nos stores.

**Tech Stack:** HTML/CSS/JS puro, sem build. Verificação no navegador em origem de teste `http://127.0.0.1:8777/...?atlas-dev=1` (localStorage separado do usuário).

**Spec:** `docs/superpowers/specs/2026-09-19-modo-demonstracao-design.md`

## Global Constraints

- Demonstração só no Dashboard; só com todos os módulos sem dado real e estado ≠ "limpo".
- Nenhuma chave de dado de módulo/caixa/snapshot é escrita pela demonstração; a única chave nova é `atlas.demo.v1`.
- Estados: ausente = não decidido (não bloqueia); "ativo" = Dashboard exibiu (bloqueia criação); "limpo" = nunca mais.
- Dashboard com dado real grava "limpo" (usuário antigo nunca é bloqueado).
- "Apagar todos os dados" (Configurações) regrava "limpo" depois de apagar.
- Textos: faixa "Modo demonstração — estes números são ilustrativos. Para usar o ATLAS com os seus dados, limpe a demonstração." · botão "Limpar demonstração" · aviso "Primeiro limpe os dados de demonstração para cadastrar os seus." · botões "Limpar e continuar" / "Cancelar".
- Depois de limpar: Dashboard zerado, sem o cartão "Primeiros passos".
- Visual sereno (themes/atlas-sereno.css): faixa preenchida, sem borda, sem glow.

---

### Task 1: `core/atlas-demo.js` — estado, dados e bloqueio

**Files:** Create `core/atlas-demo.js`; Modify `core/atlas-storage.js` (CANONICAS + "atlas.demo.v1"), `core/atlas-backup.js` (rótulo "Demonstração").

**Produces:** `window.AtlasDemo = { estado(), exibindo(), ativar(), encerrar(), limpar(), dados(perfil), snapshot(dias), bloquear(continuar) }`
- `estado()` → `null | "ativo" | "limpo"`.
- `exibindo()` → `estado() === "ativo"` (usado pelo Dashboard depois de decidir).
- `ativar()` grava "ativo" se estado for null. `encerrar()` grava "limpo" sem evento. `limpar()` grava "limpo" e dispara `document` event `atlas:demo` `{detail:{estado:"limpo"}}`.
- `bloquear(continuar)` → se `estado()==="ativo"`: abre `AtlasUI.confirm` (fallback `window.confirm`) com os textos; se confirmar → `limpar()` e `continuar()`; retorna `true`. Senão retorna `false`.
- `dados(perfil)` → objeto no formato de `buildAtlasData()` (usuario, kpis[6], evolucao{total,variacao,labels(30),valores(30),labelsCheios,medidos:30,dias:30}, categoria{labels,valores,cores}, blockchain, movimentacoes[4], pools[4], alertas[3], oraculo).
- `snapshot(dias)` → `{ total, pnl, pnlPct, evolution:[dias números], evolutionMedidos: dias, evolutionDias: dias }`.
- Série determinística: random walk com semente fixa, 90 pontos, último = total (48.320), primeiro ≈ 41.900. Datas das movimentações relativas a hoje.

- [ ] Step 1: escrever teste Node `scratchpad/demo.test.js` que carrega o arquivo num `vm` com `window`/`localStorage`/`document` falsos e verifica: estado inicial null; `ativar()` → "ativo"; `bloquear(fn)` com estado ativo retorna true; `limpar()` → "limpo"; `bloquear` retorna false; `dados()` tem 6 kpis, 30 valores de evolução, último valor 48320; `snapshot(90).evolution.length===90` e termina em 48320; `snapshot(7)` é o fim da série de 90.
- [ ] Step 2: rodar, ver falhar (arquivo não existe).
- [ ] Step 3: implementar `core/atlas-demo.js`.
- [ ] Step 4: rodar, ver passar.
- [ ] Step 5: registrar a chave em atlas-storage/backup; commit.

### Task 2: Dashboard — dados de exemplo, faixa e limpar

**Files:** Modify `pages/dashboard.html` (script `../core/atlas-demo.js` antes de `../js/atlas-consolidation.js`), `js/data.js`, `js/dashboard.js`, `themes/atlas-sereno.css` (faixa).

- `js/data.js`: renomear o corpo atual para `buildAtlasDataReal()`; `buildAtlasData()` = se `AtlasDemo` presente: calcula o real; se real tem dado → `AtlasDemo.encerrar()` e devolve real; se real vazio e estado ≠ "limpo" → `AtlasDemo.ativar()` e devolve `AtlasDemo.dados(real.usuario)`; senão devolve real. "Real vazio" = `!categoria.labels.length && !movimentacoes.length && !pools.length` (mesmo critério de `calcularSemDados`).
- `js/dashboard.js`: `pintarRoteiro()` não mostra o roteiro se `AtlasDemo.estado()==="limpo"`; faixa `.demo-faixa` no topo do `main` quando `AtlasDemo.exibindo()`; botão chama `AtlasDemo.limpar()`; ouvir `atlas:demo` → `repintar()` + remover faixa; `aplicar(dias)` usa `AtlasDemo.snapshot(dias)` quando exibindo.
- [ ] Verificar em origem limpa: exemplos + faixa; seletor 7/30/90 muda a curva; "Limpar demonstração" → zerado, sem roteiro, sem faixa; recarregar mantém zerado; `localStorage` só ganhou `atlas.demo.v1` além do que já existia.
- [ ] Verificar origem com dado real: sem faixa, estado vira "limpo".
- [ ] Commit.

### Task 3: Bloqueio nas funções de criar

**Files/entradas (cada uma recebe no início `if (window.AtlasDemo && AtlasDemo.bloquear(function () { <mesma chamada> })) return;`):**
- `hold/js/forms.js`: `newAsset()`, `newThesis(presetAssetId)`, `trade(assetId, side)` (só quando `side !== "sell"`).
- `trade/modules/rd/rd.js`: handler `[data-new]`; `trade/modules/trades/trades.js`: handler `[data-new]`.
- `defi/js/pools.js`: `openWizard()`; `defi/js/rendimentos.js`: `abrirNovo()`.
- `RWA/js/rwa-app.js`: `openAssetModal(existing)` (só sem `existing`), `abrirFormTese(id)` (só sem `id`).
- `js/carteiras.js`: `abrir(acao)`.
- `wallets/walletDialog.js`: `open(opts)` quando `opts.mode !== "rename"`.
- Script `core/atlas-demo.js` logo após `core/settings.js` em: hold/index.html, trade/index.html, defi/{index,pools,pool,staking,lending,analytics,historico}.html, RWA/index.html, pages/carteiras.html.
- [ ] Verificar (estado "ativo"): cada entrada abre o aviso; "Limpar e continuar" abre o formulário real; "Cancelar" não abre nada; com estado "limpo" ou ausente nada é bloqueado. Editar/renomear nunca bloqueia.
- [ ] Commit.

### Task 4: Configurações e fechamento

**Files:** `js/configuracoes.js` (após apagar tudo: `localStorage.setItem("atlas.demo.v1","limpo")`), `sw.js` (VERSAO +1).
- [ ] Verificar "Apagar todos os dados" → Dashboard zerado sem demonstração.
- [ ] Celular 375px sem rolagem lateral no Dashboard com a faixa; console sem erro; tema claro legível.
- [ ] Commit; memória do projeto ("modo demonstração" e a regra de estados).
