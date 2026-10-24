# Finanças objetiva — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lançar falando com o Oráculo e ver caixa, entradas, saídas e investido saírem sozinhos, sem erro de conta.

**Architecture:** Núcleo puro em ES modules (`js/core/dinheiro.js`, `livro.js`, `categorias.js`, `interpretador.js`, `conversa.js`), testado com `node --test`. Telas como módulos (`js/telas/*.js`) sobre o shell existente (`js/ui/shell.js`). Persistência local (`localStorage`, chave `finance-dashboard-state`, versão 2).

**Tech Stack:** HTML/CSS/JS puro, sem build; testes `node --test test/*.test.js` (Node 24).

**Spec:** `Ferramentas/entradas-saidas/docs/superpowers/specs/2026-10-23-financas-objetiva-design.md`

## Global Constraints

- Todo valor guardado e somado como inteiro em centavos; só a tela divide por 100.
- Datas `AAAA-MM-DD`; data no futuro é recusada.
- Tipos: `entrada`, `saida`, `investimento`, `resgate`, `saldo`.
- Mercadinho, venda, padaria e bar = uma categoria ("Mercadinho, bar e padaria"); Mercado separado.
- Texto do usuário nunca vai para `innerHTML` sem escape.
- Toda página leva `core/atlas-auth.js` + `core/atlas-secure.js` e o `core/ui/atlas-shell.js`.
- pt-BR em tudo.

## Review Focus

1. "uber 9,80" sem verbo → saída de 980 em Transporte (teste em Task 3).
2. "corrida no 99 11" → valor 1100, não 99 (Task 3).
3. "dia 30" em 23/10 → 2026-09-30, nunca futuro (Task 3).
4. Saldo com lançamento retroativo antes dele não muda o caixa final (Task 1).
5. Backup antigo importado passa pela migração, sem duplicar (Task 2).

---

### Task 1: Dinheiro e livro-caixa

**Files:** Create `js/core/dinheiro.js`, `js/core/livro.js`; Test `test/dinheiro.test.js`, `test/livro.test.js`

**Produces:**
- `paraCentavos(texto: string): number|null` — "9,80"→980, "9.80"→980, "1.500"→150000, "1.500,50"→150050, "R$ 500"→50000, "2 mil"→200000, "2,5 mil"→250000, "0"/lixo→null.
- `formatarCentavos(c: number, {sinal?:boolean}): string` — "R$ 1.284,40".
- `ordenar(lancs)`; `caixaAte(lancs, data?)`: number; `serieDiaria(lancs, mes)`: `[{dia, entrou, saiu, investiu, caixa}]`; `resumoMes(lancs, mes)`: `{entrou, saiu, investido, resgatado, porCategoria:{[cat]:c}}`; `investidoPorDestino(lancs)`: `{total, destinos:{[d]:c}}`; `mesesComDados(lancs)`.

- [ ] Testes: soma 0,1+0,2 em centavos = 30; saldo 50000 + saida 30000 + saida 30000 = −10000; saldo depois de lançamento anterior reinicia; retroativo antes do saldo não muda caixa final; investimento tira do caixa e não entra em `saiu`; resgate volta; mês exclui `saldo`.
- [ ] Implementar, rodar `node --test test/*.test.js` → PASS. Commit.

### Task 2: Store v2 e migração

**Files:** Modify `js/core/store.js`; Test `test/store.test.js` (reescrever)

**Produces:** `estadoVazio()`, `migrarEstado(raw, hoje)`, `lerEstado()`, `salvarEstado(s)`, `adicionar(s, lanc)`, `atualizar(s, id, campos)`, `remover(s, id)`, `novoId()`. Estado: `{versao:2, lancamentos:[], aprendizado:{}, metas:{mensal:null, categorias:{}}, profile, settings}`. Mantém `getState/saveState/updateState/resetState/migrateState/STORAGE_KEY` como apelidos para Configurações.

- [ ] Testes: estado antigo com entries/expenses vira lançamentos (só data ≤ hoje, valor 9.8→980); planner some; backup em `finance-dashboard-state.backup-v1`; v2 passa intacto; idempotente.
- [ ] Implementar, testes PASS. Commit.

### Task 3: Categorias e interpretador

**Files:** Create `js/core/categorias.js`, `js/core/interpretador.js`; Test `test/interpretador.test.js`

**Produces:** `CATEGORIAS_SAIDA`, `categoriaDe(desc, aprendizado): {categoria, certeza}`, `sugestoes(desc, lancs): string[]`; `interpretar(texto, {hoje, aprendizado}) → {itens:[{tipo, centavos, data, descricao, categoria|null, destino?}], perguntas, erro?}` e `interpretarData(texto, hoje)`.

- [ ] Testes: casos do Review Focus 1–3; "recebi 500"; "tenho 500 em caixa" → saldo; "mandei 100 pra binance" → investimento destino Binance; "tirei 200 da binance" → resgate; "gastei 9,80 no uber e 45 no mercadinho" → 2 itens; "50 de gasolina" → Transporte; "bar 30" → Mercadinho, bar e padaria; "mercado 210" → Mercado; "ontem" e "27/10"; aprendido "pastel" → categoria aprendida; "paguei 300" → categoria null (pergunta).
- [ ] Implementar, PASS. Commit.

### Task 4: Conversa (motor do Oráculo)

**Files:** Create `js/core/conversa.js`; Test `test/conversa.test.js`

**Produces:** `criarConversa({ler, salvar, hoje})` → `{responder(texto): {texto, sugestoes?:string[], lancados?:string[]}}`. Pergunta categoria pendente com sugestões + "Outros"; resposta grava `aprendizado`; "desfazer" remove o último lote; perguntas: caixa, gastei/entrou no mês, gastei com X, investido.

- [ ] Testes: lança e responde caixa; pendente → "Transporte" → lança e aprende; desfazer; caixa negativo avisa; pergunta "quanto tenho".
- [ ] Implementar, PASS. Commit.

### Task 5: Telas, fundo e Oráculo

**Files:** Rewrite `index.html`, `investimentos.html`, `planejar.html`; create `oraculo.html`, `lancamentos.html`, `css/painel.css`, `js/ui/fundo-fluxo.js`, `js/ui/comum.js`, `js/telas/{painel,oraculo,lancamentos,investimentos,planejar}.js`; modify `js/ui/shell.js` (seções), `configuracoes.html`/`js/pages/configuracoes.js` (import via migração), `sw.js` (rede primeiro, lista nova); `entradas.html`, `despesas.html`, `relatorios.html`, `analises.html` viram redirecionamento para `lancamentos.html`/`index.html`. Remove páginas antigas e `recurrence.js` não usados.

- [ ] Painel conforme spec; barra do Oráculo usa `criarConversa`; `AtlasOraculo.registerTool` em todas as telas.
- [ ] Conferir no navegador (`?atlas-dev=1`, localhost) desktop e 375 px; console sem erro. Commit.

### Task 6: Registro

- [ ] `docs/financas-2026-10-23.md`, linha de Finanças em `docs/oraculo-ferramentas.md`, link em `CLAUDE.md`. Commit e push.
