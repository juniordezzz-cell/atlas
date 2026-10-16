# Conector MCP do Atlas — Fases 2 e 3 (gravação) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O dono pede pelo Claude ("cria a carteira Binance", "comprei 4 MORPHO a 2,683 em 27/09", "adiciona 43,98 USDT no caixa da Binance") e o conector grava no Atlas, sempre com prévia e confirmação, com as mesmas regras do site.

**Architecture:** Fase 2 — em vez de reescrever as contas no servidor, o conector executa **o próprio código do site** (`wallets/walletStore.js`, `walletTypes.js`, `walletLedger.js`, `walletManager.js`, `walletCaixa.js`, `hold/js/state.js`) dentro de uma função, com um `localStorage` em memória semeado com o que está no Firestore. Um script gera `site-gerado.mjs` a partir desses arquivos e um teste falha se ele ficar desatualizado. Fase 3 — ferramentas `preparar_*` simulam a operação nesse motor e devolvem uma prévia assinada; `confirmar` relê, confere que nada mudou e grava as chaves alteradas num único `commit` do Firestore com pré-condição de `updateTime`, junto com um backup que permite `desfazer`.

**Tech Stack:** Os mesmos da fase 1 (ES modules, Web APIs, Node 22 `node:test`, Supabase Edge Function Deno), mais a API REST `documents:commit` e `runQuery` do Firestore.

**Spec:** [docs/superpowers/specs/2026-10-15-conector-mcp-design.md](../specs/2026-10-15-conector-mcp-design.md). Este plano cobre as fases 2 e 3 da tabela de entrega. Fase 1: [plano](2026-10-15-conector-mcp-fase1.md), contrato em [docs/atlas-mcp.md](../../atlas-mcp.md).

## Decisões deste plano (divergem do texto da spec; registrar na spec na Task 8)

- **Fase 2 sem refatorar o site.** A spec previa extrair funções puras para `core/dominio/` e fazer o site usá-las. O experimento de 16/10 mostrou que os seis arquivos do site rodam sem alteração fora do navegador, inclusive em modo estrito. Executar o código do site é a forma mais forte de "uma regra, uma versão" e não mexe no site.
- **Compra sem caixa:** `preparar_compra` aceita `cobrir_falta: true`, que lança o depósito automático na data da compra — exatamente o que o formulário de compra do site faz (`hold/js/forms.js:576`). Sem esse campo, a compra é recusada com a falta explicada. O depósito aparece na prévia; não é implícito.
- **Alocação para o Hold** ("transfere 30 USDT da Binance para o Hold") é uma `preparar_compra` do token no Hold usando o caixa. Alocação para DeFi fica com pools, na fase 4.
- **Carteira nova** nesta fase só do tipo **global** (pedido do dono). Isolada fica para depois.
- **Depósito de token não estável** exige `valor_usd`. Busca automática de preço fica para depois.

## Global Constraints

- Tudo da fase 1 continua valendo (uid só do token, caminhos `atlas_users/{uid}/...`, nada de chave no repositório, mensagens em pt-BR, bundle único sem imports externos e sem nomes de nível superior repetidos).
- Chaves que o conector pode gravar: **somente** `atlas.wallets.v2`, `atlas.hold.state.v2`, `atlas.caixa.v1`.
- Nada é gravado sem `confirmar` de uma prévia válida, do mesmo uid, com menos de 10 minutos, e com os três documentos no mesmo `updateTime` da prévia.
- Gravação: um único `documents:commit` com pré-condição por documento (`updateTime` lido, ou `exists: false`), campos `value` (string), `device: "claude-mcp"`, `mcpOp` (id da operação) e `updatedAt` = `REQUEST_TIME`. O backup vai no mesmo commit em `atlas_users/{uid}/mcp_backup/{idOperacao}`; manter os 50 mais recentes.
- Datas: `AAAA-MM-DD`, padrão "hoje" no fuso `America/Sao_Paulo`, nunca no futuro.
- `site-gerado.mjs` é gerado; nunca editar à mão. Mudou um dos seis arquivos do site → rodar `node central-rwa/supabase/functions/atlas-mcp/gerar-site.mjs` e reimplantar a função.

## Review Focus

1. Prévia confirmada depois que o site gravou por cima → recusa, nada gravado. → teste na Task 5.
2. O mesmo `id_previa` confirmado duas vezes → a segunda é recusada. → teste na Task 5.
3. Compra sem caixa e sem `cobrir_falta` → erro com o valor que falta, nada gravado. → teste na Task 4.
4. Data no futuro ou em outro formato (`27/09/2026`) → erro claro. → teste na Task 4.
5. `desfazer` depois que o site já gravou por cima da operação → recusa. → teste na Task 5.

---

## File Structure

Em `central-rwa/supabase/functions/atlas-mcp/`:

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `gerar-site.mjs` | Criar | Lê os seis arquivos do site e gera `site-gerado.mjs` |
| `site-gerado.mjs` | Criar (gerado) | `codigoSite(window, localStorage)` com o código do site |
| `motor.mjs` | Criar | `criarMotor(brutos)`: instância isolada do site sobre um `localStorage` em memória |
| `operacoes.mjs` | Criar | Carteira, depósito, saque, compra e venda sobre o motor, com validação e resumo |
| `previa.mjs` | Criar | `preparar`, `confirmar`, `prepararDesfazer` (prévia assinada, pré-condições, backup) |
| `firestore.mjs` | Modificar | `lerDocs`, `gravar` (commit), `ultimoBackup`, `lerBackup`, `ConflitoGravacao` |
| `leitura.mjs` | Modificar | Exportar `usd` e `qtd` |
| `mcp.mjs` | Modificar | Anotações por ferramenta (`escrita`, `destrutiva`) e instruções novas |
| `ferramentas.mjs` | Modificar | 8 ferramentas novas |
| `handler.mjs` | Modificar | Contexto com `segredo` e `agora` |
| `montar.mjs`, `build.mjs` | Modificar | Incluir os módulos novos; `build` regenera o `site-gerado.mjs` |

Outros: `pages/conectar-claude.html` (texto do consentimento), `docs/atlas-mcp.md`, a spec, `.github/workflows/atlas-mcp.yml` (gatilho nos arquivos do site).

Teste de toda a função (bash, raiz do repositório):

```bash
node --test central-rwa/supabase/functions/atlas-mcp/*.test.mjs js/conectar-claude.test.cjs
```

---

### Task 1: Código do site gerado para o servidor

**Files:**
- Create: `central-rwa/supabase/functions/atlas-mcp/gerar-site.mjs`
- Create (gerado): `central-rwa/supabase/functions/atlas-mcp/site-gerado.mjs`
- Test: `central-rwa/supabase/functions/atlas-mcp/site.test.mjs`

**Interfaces:**
- Produces: `ARQUIVOS_SITE: string[]`, `gerarCodigoSite(): string` (em `gerar-site.mjs`); `codigoSite(window, localStorage): window` (em `site-gerado.mjs`), que devolve o `window` com `AtlasWallets`, `AtlasCaixa` e `Store`.

- [ ] **Step 1: Write the failing test**

```js
// central-rwa/supabase/functions/atlas-mcp/site.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gerarCodigoSite, ARQUIVOS_SITE } from './gerar-site.mjs';
import { codigoSite } from './site-gerado.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));

test('site-gerado.mjs está em dia com os arquivos do site', () => {
  const salvo = readFileSync(join(AQUI, 'site-gerado.mjs'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(salvo, gerarCodigoSite(), 'Rode: node central-rwa/supabase/functions/atlas-mcp/gerar-site.mjs');
  assert.deepEqual(ARQUIVOS_SITE.slice(-2), ['wallets/walletCaixa.js', 'hold/js/state.js']);
});

test('o código do site roda em modo estrito fora do navegador', () => {
  const mem = new Map();
  const ls = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; } };
  const w = codigoSite({ localStorage: ls, addEventListener() {}, removeEventListener() {} }, ls);
  assert.equal(typeof w.AtlasWallets.create, 'function');
  assert.equal(typeof w.AtlasCaixa.registrar, 'function');
  assert.equal(typeof w.Store.actions.executeBuy, 'function');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/site.test.mjs`
Expected: FAIL com `Cannot find module` para `./gerar-site.mjs`.

- [ ] **Step 3: Write the generator and generate**

```js
// central-rwa/supabase/functions/atlas-mcp/gerar-site.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..', '..', '..');

// Ordem de carga igual à das páginas do site.
export const ARQUIVOS_SITE = [
  'wallets/walletStore.js', 'wallets/walletTypes.js', 'wallets/walletLedger.js',
  'wallets/walletManager.js', 'wallets/walletCaixa.js', 'hold/js/state.js',
];

export function gerarCodigoSite() {
  const partes = ARQUIVOS_SITE.map((f) => `// ---- ${f} ----\n${readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n')}\n;`);
  return '// GERADO por gerar-site.mjs a partir dos arquivos do site. Não edite à mão.\n'
    + '// Mudou algum desses arquivos? Rode: node central-rwa/supabase/functions/atlas-mcp/gerar-site.mjs\n'
    + 'export function codigoSite(window, localStorage) {\n"use strict";\n'
    + partes.join('\n')
    + '\nreturn window;\n}\n';
}

export function escreverCodigoSite() {
  writeFileSync(join(AQUI, 'site-gerado.mjs'), gerarCodigoSite());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  escreverCodigoSite();
  console.log('site-gerado.mjs atualizado');
}
```

Run: `node central-rwa/supabase/functions/atlas-mcp/gerar-site.mjs`
Expected: `site-gerado.mjs atualizado`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/site.test.mjs`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add central-rwa/supabase/functions/atlas-mcp/gerar-site.mjs central-rwa/supabase/functions/atlas-mcp/site-gerado.mjs central-rwa/supabase/functions/atlas-mcp/site.test.mjs
git commit -m "atlas-mcp: gera o código do site (carteiras, caixa, Hold) para rodar no servidor"
```

---

### Task 2: Motor — o site sobre um localStorage em memória

**Files:**
- Create: `central-rwa/supabase/functions/atlas-mcp/motor.mjs`
- Test: `central-rwa/supabase/functions/atlas-mcp/motor.test.mjs`

**Interfaces:**
- Consumes: `codigoSite` (Task 1).
- Produces:
  - `CHAVES_GRAVAVEIS = ['atlas.wallets.v2', 'atlas.hold.state.v2', 'atlas.caixa.v1']`
  - `criarMotor(brutos: Record<chave, string|null>)` → `{ carteiras: AtlasWallets, caixa: AtlasCaixa, hold: Store, alteracoes(): Record<chave, string|null> }` — `alteracoes` devolve só as chaves gravadas cujo texto mudou.

- [ ] **Step 1: Write the failing test**

```js
// central-rwa/supabase/functions/atlas-mcp/motor.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarMotor, CHAVES_GRAVAVEIS } from './motor.mjs';

function binance(m) {
  const w = m.carteiras.create({ name: 'Binance', type: 'global' });
  m.hold.actions.createAsset({ nome: 'Pyth Network', ticker: 'PYTH', preco_atual: 0.0867 });
  const id = m.hold.state.ativos.find((a) => a.ticker === 'PYTH').id;
  const r = m.hold.actions.executeBuy({ ativo_id: id, quantidade: 92.7072, preco: 0.0549, taxa: 0.005095, data: '2026-09-12', walletId: w.id, cobrirFalta: true });
  return { w, id, r };
}

test('motor vazio cria carteira e compra como o site, e só as três chaves mudam', () => {
  const m = criarMotor({});
  const { w, id, r } = binance(m);
  assert.equal(r.error, undefined);
  const pos = m.hold.get.positionOf(id, w.id);
  assert.equal(pos.quantidade, 92.7072);
  assert.equal(Math.round(pos.preco_medio * 1e6) / 1e6, 0.054955);
  assert.equal(m.caixa.saldo(w.id), 0);
  assert.deepEqual(Object.keys(m.alteracoes()).sort(), [...CHAVES_GRAVAVEIS].sort());
});

test('motor semeado lê o estado anterior e só reporta o que mudou', () => {
  const m1 = criarMotor({});
  binance(m1);
  const brutos = m1.alteracoes();
  const m2 = criarMotor(brutos);
  assert.equal(m2.carteiras.all().find((w) => w.name === 'Binance').type, 'global');
  assert.deepEqual(m2.alteracoes(), {});
  const w = m2.carteiras.all().find((x) => x.name === 'Binance');
  m2.caixa.registrar({ tipo: 'deposito', valorUSD: 43.98, ativo: 'USDT', walletId: w.id, data: '2026-10-15' });
  assert.deepEqual(Object.keys(m2.alteracoes()), ['atlas.caixa.v1']);
  assert.equal(m2.caixa.saldo(w.id), 43.98);
});

test('instâncias não vazam estado entre si', () => {
  const a = criarMotor({});
  a.carteiras.create({ name: 'Só na A', type: 'global' });
  const b = criarMotor({});
  assert.equal(b.carteiras.all().some((w) => w.name === 'Só na A'), false);
});

test('chave fora da lista é ignorada na entrada', () => {
  const m = criarMotor({ 'atlas.outra.v1': '{"x":1}' });
  assert.deepEqual(m.alteracoes(), {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/motor.test.mjs`
Expected: FAIL com `Cannot find module` para `./motor.mjs`.

- [ ] **Step 3: Write minimal implementation**

```js
// central-rwa/supabase/functions/atlas-mcp/motor.mjs
import { codigoSite } from './site-gerado.mjs';

export const CHAVES_GRAVAVEIS = ['atlas.wallets.v2', 'atlas.hold.state.v2', 'atlas.caixa.v1'];

export function criarMotor(brutos = {}) {
  const mem = new Map();
  for (const k of CHAVES_GRAVAVEIS) if (typeof brutos[k] === 'string') mem.set(k, brutos[k]);
  const original = new Map(mem);
  const armazenamento = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: (k) => { mem.delete(k); },
    key: (i) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  };
  const janela = codigoSite({ localStorage: armazenamento, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } }, armazenamento);
  janela.Store.init();
  const antes = new Map(CHAVES_GRAVAVEIS.map((k) => [k, original.has(k) ? original.get(k) : null]));
  return {
    carteiras: janela.AtlasWallets,
    caixa: janela.AtlasCaixa,
    hold: janela.Store,
    alteracoes() {
      const out = {};
      for (const k of CHAVES_GRAVAVEIS) {
        const agora = mem.has(k) ? mem.get(k) : null;
        if (agora !== antes.get(k)) out[k] = agora;
      }
      return out;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/motor.test.mjs`
Expected: PASS (4 testes). Se o teste 2 falhar porque `Store.init()` regrava o Hold mesmo sem mudança, a regra do motor muda para comparar o JSON normalizado (`JSON.stringify(JSON.parse(x))`) e o caso vira um `Ruling` no ledger.

- [ ] **Step 5: Commit**

```bash
git add central-rwa/supabase/functions/atlas-mcp/motor.mjs central-rwa/supabase/functions/atlas-mcp/motor.test.mjs
git commit -m "atlas-mcp: motor que executa as regras do site sobre o estado do Firestore"
```

---

### Task 3: Gravação no Firestore (commit com pré-condição e backup)

**Files:**
- Modify: `central-rwa/supabase/functions/atlas-mcp/firestore.mjs`
- Test: `central-rwa/supabase/functions/atlas-mcp/firestore-gravacao.test.mjs`

**Interfaces:**
- Produces (no objeto devolvido por `criarFirestore`, além de `lerChave`):
  - `lerDocs(uid, chaves): Promise<Record<chave, { bruto: string|null, updateTime: string|null, mcpOp: string|null }>>`
  - `gravar(uid, { opId, mudancas: Record<chave, string|null>, bases: Record<chave, string|null>, backup: { ferramenta, resumo, antes: Record<chave, string|null> }, marcarDesfeito?: string }): Promise<void>` — lança `ConflitoGravacao` se a pré-condição falhar.
  - `ultimoBackup(uid): Promise<backup|null>` e `lerBackup(uid, id): Promise<backup|null>`, com `backup = { id, ferramenta, resumo, antes, desfeito }`.
- Produces (export do módulo): `class ConflitoGravacao extends Error`.

- [ ] **Step 1: Write the failing test**

```js
// central-rwa/supabase/functions/atlas-mcp/firestore-gravacao.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarFirestore, ConflitoGravacao } from './firestore.mjs';

const par = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', par.privateKey));
const CONTA = { project_id: 'p1', client_email: 'x@p1.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\n' + Buffer.from(der).toString('base64') + '\n-----END PRIVATE KEY-----\n' };
const DOCS = 'projects/p1/databases/(default)/documents/atlas_users/uid1';

function servidor({ commitStatus = 200, erro = null } = {}) {
  const log = { commits: [], queries: [] };
  const fetcher = async (url, init = {}) => {
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 't', expires_in: 3600 });
    if (url.endsWith(':commit')) { log.commits.push(JSON.parse(init.body)); return erro ? Response.json({ error: erro }, { status: commitStatus }) : Response.json({ writeResults: [], commitTime: 'x' }); }
    if (url.endsWith(':runQuery')) {
      const q = JSON.parse(init.body); log.queries.push(q);
      if (q.structuredQuery.offset) return Response.json([{ readTime: 'x' }]);
      return Response.json([{ document: { name: `${DOCS}/mcp_backup/000000000000001-abc`, fields: { ferramenta: { stringValue: 'compra' }, resumo: { stringValue: 'Compra de PYTH' }, antes: { mapValue: { fields: { 'atlas.caixa.v1': { stringValue: '[]' }, 'atlas.wallets.v2': { nullValue: null } } } } } } }]);
    }
    if (url.includes('/store/atlas__caixa__v1')) return Response.json({ name: 'n', updateTime: '2026-10-16T01:00:00Z', fields: { value: { stringValue: '[]' }, mcpOp: { stringValue: 'op9' } } });
    if (url.includes('/store/')) return new Response('{}', { status: 404 });
    throw new Error('url inesperada ' + url);
  };
  return { log, fs: criarFirestore({ contaServico: CONTA, fetcher }) };
}

test('lerDocs devolve texto, updateTime e mcpOp; ausente vira null', async () => {
  const { fs } = servidor();
  const d = await fs.lerDocs('uid1', ['atlas.caixa.v1', 'atlas.hold.state.v2']);
  assert.deepEqual(d['atlas.caixa.v1'], { bruto: '[]', updateTime: '2026-10-16T01:00:00Z', mcpOp: 'op9' });
  assert.deepEqual(d['atlas.hold.state.v2'], { bruto: null, updateTime: null, mcpOp: null });
});

test('gravar manda um commit com pré-condições, campos do site e backup', async () => {
  const { fs, log } = servidor();
  await fs.gravar('uid1', {
    opId: '000000000000002-xyz',
    mudancas: { 'atlas.caixa.v1': '[1]', 'atlas.hold.state.v2': '{"a":1}' },
    bases: { 'atlas.caixa.v1': '2026-10-16T01:00:00Z', 'atlas.hold.state.v2': null },
    backup: { ferramenta: 'deposito', resumo: 'Depósito', antes: { 'atlas.caixa.v1': '[]', 'atlas.hold.state.v2': null } },
  });
  const w = log.commits[0].writes;
  assert.equal(w.length, 3);
  assert.equal(w[0].update.name, `${DOCS}/store/atlas__caixa__v1`);
  assert.deepEqual(w[0].currentDocument, { updateTime: '2026-10-16T01:00:00Z' });
  assert.deepEqual(w[0].update.fields, { value: { stringValue: '[1]' }, device: { stringValue: 'claude-mcp' }, mcpOp: { stringValue: '000000000000002-xyz' } });
  assert.deepEqual(w[0].updateTransforms, [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }]);
  assert.deepEqual(w[1].currentDocument, { exists: false });
  assert.equal(w[2].update.name, `${DOCS}/mcp_backup/000000000000002-xyz`);
  assert.deepEqual(w[2].currentDocument, { exists: false });
  assert.deepEqual(w[2].update.fields.antes.mapValue.fields['atlas.hold.state.v2'], { nullValue: null });
  assert.equal(log.queries[0].structuredQuery.offset, 50);
});

test('mudança para null apaga o documento; marcarDesfeito atualiza o backup antigo', async () => {
  const { fs, log } = servidor();
  await fs.gravar('uid1', { opId: '3-a', mudancas: { 'atlas.wallets.v2': null }, bases: { 'atlas.wallets.v2': 'T1' }, backup: { ferramenta: 'desfazer', resumo: 'r', antes: { 'atlas.wallets.v2': '{}' } }, marcarDesfeito: '1-b' });
  const w = log.commits[0].writes;
  assert.deepEqual(w[0], { delete: `${DOCS}/store/atlas__wallets__v2`, currentDocument: { updateTime: 'T1' } });
  assert.deepEqual(w[2], { update: { name: `${DOCS}/mcp_backup/1-b`, fields: { desfeito: { booleanValue: true } } }, updateMask: { fieldPaths: ['desfeito'] }, currentDocument: { exists: true } });
});

test('pré-condição falhando vira ConflitoGravacao; outro erro vira Error comum', async () => {
  const arg = { opId: '4-a', mudancas: { 'atlas.caixa.v1': '[]' }, bases: { 'atlas.caixa.v1': 'T' }, backup: { ferramenta: 'x', resumo: 'r', antes: {} } };
  await assert.rejects(() => servidor({ commitStatus: 400, erro: { status: 'FAILED_PRECONDITION' } }).fs.gravar('uid1', arg), ConflitoGravacao);
  await assert.rejects(() => servidor({ commitStatus: 409, erro: { status: 'ABORTED' } }).fs.gravar('uid1', arg), ConflitoGravacao);
  await assert.rejects(() => servidor({ commitStatus: 500, erro: { status: 'INTERNAL' } }).fs.gravar('uid1', arg), (e) => !(e instanceof ConflitoGravacao));
  await assert.rejects(() => servidor().fs.gravar('uid1', { ...arg, mudancas: { 'mundodefi.x': '1' } }), /chave inválida/);
});

test('ultimoBackup decodifica o mais recente', async () => {
  const { fs, log } = servidor();
  const b = await fs.ultimoBackup('uid1');
  assert.deepEqual(b, { id: '000000000000001-abc', ferramenta: 'compra', resumo: 'Compra de PYTH', antes: { 'atlas.caixa.v1': '[]', 'atlas.wallets.v2': null }, desfeito: false });
  assert.deepEqual(log.queries[0].structuredQuery.orderBy, [{ field: { fieldPath: '__name__' }, direction: 'DESCENDING' }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/firestore-gravacao.test.mjs`
Expected: FAIL com `does not provide an export named 'ConflitoGravacao'`.

- [ ] **Step 3: Implement in `firestore.mjs`**

Acrescentar, no topo do módulo (depois de `docIdFirestore`):

```js
export class ConflitoGravacao extends Error {}

const LIMITE_BACKUPS = 50;

function valorFirestore(v) {
  return v === null || v === undefined ? { nullValue: null } : { stringValue: String(v) };
}
```

Dentro de `criarFirestore`, depois de `lerChave`, acrescentar e devolver junto:

```js
  const raiz = () => `projects/${conta.project_id}/databases/(default)/documents`;
  const nomeUsuario = (uid) => {
    if (!/^[A-Za-z0-9]{1,128}$/.test(String(uid))) throw new Error('uid inválido');
    return `${raiz()}/atlas_users/${uid}`;
  };
  const nomeChave = (uid, chave) => {
    if (!/^atlas\.[a-z0-9.]+$/.test(String(chave))) throw new Error('chave inválida');
    return `${nomeUsuario(uid)}/store/${docIdFirestore(chave)}`;
  };
  const api = (caminho) => `https://firestore.googleapis.com/v1/${caminho}`;

  async function chamar(url, corpo) {
    const r = await fetcher(url, { method: 'POST', headers: { Authorization: 'Bearer ' + (await tokenGoogle()), 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(10000) });
    return r;
  }

  async function lerDocs(uid, chaves) {
    const pares = await Promise.all(chaves.map(async (chave) => {
      const r = await fetcher(api(nomeChave(uid, chave)), { headers: { Authorization: 'Bearer ' + (await tokenGoogle()) }, signal: AbortSignal.timeout(8000) });
      if (r.status === 404) return [chave, { bruto: null, updateTime: null, mcpOp: null }];
      if (!r.ok) throw new Error('firestore ' + r.status);
      const d = await r.json();
      const bruto = d.fields?.value?.stringValue;
      return [chave, { bruto: typeof bruto === 'string' ? bruto : null, updateTime: d.updateTime || null, mcpOp: d.fields?.mcpOp?.stringValue || null }];
    }));
    return Object.fromEntries(pares);
  }

  async function podarBackups(uid) {
    const r = await chamar(api(`${nomeUsuario(uid)}:runQuery`), { structuredQuery: { from: [{ collectionId: 'mcp_backup' }], select: { fields: [{ fieldPath: '__name__' }] }, orderBy: [{ field: { fieldPath: '__name__' }, direction: 'DESCENDING' }], offset: LIMITE_BACKUPS, limit: 20 } });
    if (!r.ok) return;
    const velhos = (await r.json()).map((x) => x.document?.name).filter(Boolean);
    if (velhos.length) await chamar(api(`${raiz()}:commit`), { writes: velhos.map((name) => ({ delete: name })) });
  }

  async function gravar(uid, { opId, mudancas, bases, backup, marcarDesfeito }) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(opId))) throw new Error('opId inválido');
    const writes = Object.entries(mudancas).map(([chave, valor]) => {
      const name = nomeChave(uid, chave);
      const currentDocument = bases[chave] ? { updateTime: bases[chave] } : { exists: false };
      if (valor === null) return { delete: name, currentDocument };
      return {
        update: { name, fields: { value: { stringValue: valor }, device: { stringValue: 'claude-mcp' }, mcpOp: { stringValue: opId } } },
        currentDocument,
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
      };
    });
    writes.push({
      update: {
        name: `${nomeUsuario(uid)}/mcp_backup/${opId}`,
        fields: {
          ferramenta: { stringValue: String(backup.ferramenta) },
          resumo: { stringValue: String(backup.resumo).slice(0, 2000) },
          antes: { mapValue: { fields: Object.fromEntries(Object.entries(backup.antes).map(([k, v]) => [k, valorFirestore(v)])) } },
        },
      },
      currentDocument: { exists: false },
      updateTransforms: [{ fieldPath: 'criado', setToServerValue: 'REQUEST_TIME' }],
    });
    if (marcarDesfeito) {
      writes.push({ update: { name: `${nomeUsuario(uid)}/mcp_backup/${marcarDesfeito}`, fields: { desfeito: { booleanValue: true } } }, updateMask: { fieldPaths: ['desfeito'] }, currentDocument: { exists: true } });
    }
    const r = await chamar(api(`${raiz()}:commit`), { writes });
    if (!r.ok) {
      let status = '';
      try { status = (await r.json()).error?.status || ''; } catch { status = ''; }
      if (r.status === 409 || ['FAILED_PRECONDITION', 'ABORTED', 'ALREADY_EXISTS', 'NOT_FOUND'].includes(status)) throw new ConflitoGravacao(status || String(r.status));
      throw new Error('commit ' + r.status + ' ' + status);
    }
    try { await podarBackups(uid); } catch { /* poda é opcional */ }
  }

  function decodificarBackup(doc) {
    if (!doc?.name) return null;
    const f = doc.fields || {};
    const antes = Object.fromEntries(Object.entries(f.antes?.mapValue?.fields || {}).map(([k, v]) => [k, typeof v.stringValue === 'string' ? v.stringValue : null]));
    return { id: doc.name.split('/').pop(), ferramenta: f.ferramenta?.stringValue || '', resumo: f.resumo?.stringValue || '', antes, desfeito: f.desfeito?.booleanValue === true };
  }

  async function ultimoBackup(uid) {
    const r = await chamar(api(`${nomeUsuario(uid)}:runQuery`), { structuredQuery: { from: [{ collectionId: 'mcp_backup' }], orderBy: [{ field: { fieldPath: '__name__' }, direction: 'DESCENDING' }], limit: 1 } });
    if (!r.ok) throw new Error('firestore ' + r.status);
    return decodificarBackup((await r.json())[0]?.document);
  }

  async function lerBackup(uid, id) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(id))) return null;
    const r = await fetcher(api(`${nomeUsuario(uid)}/mcp_backup/${id}`), { headers: { Authorization: 'Bearer ' + (await tokenGoogle()) }, signal: AbortSignal.timeout(8000) });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('firestore ' + r.status);
    return decodificarBackup(await r.json());
  }
```

E trocar o `return { lerChave };` final por:

```js
  return { lerChave, lerDocs, gravar, ultimoBackup, lerBackup };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/firestore-gravacao.test.mjs central-rwa/supabase/functions/atlas-mcp/firestore.test.mjs`
Expected: PASS (5 + 4 testes).

- [ ] **Step 5: Commit**

```bash
git add central-rwa/supabase/functions/atlas-mcp/firestore.mjs central-rwa/supabase/functions/atlas-mcp/firestore-gravacao.test.mjs
git commit -m "atlas-mcp: gravação no Firestore com pré-condição, backup e poda"
```

---

### Task 4: Operações de escrita sobre o motor

**Files:**
- Create: `central-rwa/supabase/functions/atlas-mcp/operacoes.mjs`
- Modify: `central-rwa/supabase/functions/atlas-mcp/leitura.mjs` (exportar `usd` e `qtd`)
- Test: `central-rwa/supabase/functions/atlas-mcp/operacoes.test.mjs`

**Interfaces:**
- Consumes: `criarMotor` (Task 2), `resolverCarteira`, `usd`, `qtd` (leitura), `ErroUsuario`.
- Produces (cada uma `(motor, args, agora = Date.now()) => { resumo: string, dados: object }`, lança `ErroUsuario`):
  - `criarCarteira(motor, { nome })`
  - `deposito(motor, { carteira, token, quantidade, valor_usd?, data? })`
  - `saque(motor, { carteira, token, quantidade, valor_usd?, data? })`
  - `compra(motor, { carteira, token, quantidade, preco, taxa_usd?, data?, cobrir_falta?, nome?, coingecko_id? })`
  - `venda(motor, { carteira, token, quantidade?, fracao?, preco, taxa_usd?, data? })`
  - `hojeBrasil(agora?): string`

- [ ] **Step 1: Export helpers from `leitura.mjs`**

Trocar `function usd(v) {` por `export function usd(v) {` e `function qtd(v) {` por `export function qtd(v) {`.

- [ ] **Step 2: Write the failing test**

```js
// central-rwa/supabase/functions/atlas-mcp/operacoes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarMotor } from './motor.mjs';
import { criarCarteira, deposito, saque, compra, venda, hojeBrasil } from './operacoes.mjs';
import { ErroUsuario } from './mcp.mjs';

const AGORA = Date.parse('2026-10-16T02:00:00Z'); // 23:00 de 15/10 em São Paulo
const novo = () => { const m = criarMotor({}); criarCarteira(m, { nome: 'Binance' }, AGORA); return m; };

test('hoje é calculado no fuso de São Paulo', () => {
  assert.equal(hojeBrasil(AGORA), '2026-10-15');
});

test('cria carteira global e recusa nome repetido ou vazio', () => {
  const m = criarMotor({});
  const r = criarCarteira(m, { nome: 'Binance' }, AGORA);
  assert.equal(r.dados.carteira.tipo, 'global');
  assert.match(r.resumo, /Criar a carteira Binance \(global\)/);
  assert.throws(() => criarCarteira(m, { nome: ' binance ' }, AGORA), /Já existe uma carteira chamada/);
  assert.throws(() => criarCarteira(m, { nome: '' }, AGORA), ErroUsuario);
});

test('depósito de stablecoin usa a quantidade como valor; outro token exige valor_usd', () => {
  const m = novo();
  const r = deposito(m, { carteira: 'binance', token: 'usdt', quantidade: 43.98, data: '2026-10-15' }, AGORA);
  assert.match(r.resumo, /Depósito de 43,98 USDT \(\$ 43,98\) no caixa da Binance, em 2026-10-15/);
  const w = m.carteiras.all().find((x) => x.name === 'Binance');
  assert.equal(m.caixa.saldo(w.id), 43.98);
  assert.throws(() => deposito(m, { carteira: 'Binance', token: 'SOL', quantidade: 1 }, AGORA), /valor_usd/);
  assert.throws(() => deposito(m, { carteira: 'OKX', token: 'USDT', quantidade: 1 }, AGORA), /Não encontrei a carteira "OKX"/);
});

test('saque recusa caixa insuficiente', () => {
  const m = novo();
  deposito(m, { carteira: 'Binance', token: 'USDT', quantidade: 10 }, AGORA);
  assert.throws(() => saque(m, { carteira: 'Binance', token: 'USDT', quantidade: 11 }, AGORA), /Caixa insuficiente na Binance: há \$ 10,00/);
  assert.match(saque(m, { carteira: 'Binance', token: 'USDT', quantidade: 4 }, AGORA).resumo, /Saque de 4 USDT/);
});

test('compra sem caixa e sem cobrir_falta é recusada com o valor que falta', () => {
  const m = novo();
  assert.throws(() => compra(m, { carteira: 'Binance', token: 'JUP', quantidade: 13.986, preco: 0.365, taxa_usd: 0.00511, data: '2026-09-27' }, AGORA), /Falta \$ 5,11 no caixa da Binance/);
});

test('compra com cobrir_falta cadastra o ativo, deposita na data e acerta o preço médio', () => {
  const m = novo();
  const r = compra(m, { carteira: 'Binance', token: 'morpho', nome: 'Morpho', quantidade: 3.996, preco: 2.683, taxa_usd: 0.010732, data: '2026-09-27', cobrir_falta: true }, AGORA);
  assert.match(r.resumo, /MORPHO é novo no Hold e será cadastrado/);
  assert.match(r.resumo, /Depósito automático de \$ 10,73/);
  compra(m, { carteira: 'Binance', token: 'MORPHO', quantidade: 6.54345, preco: 2.682, taxa_usd: 0.0175671, data: '2026-09-27', cobrir_falta: true }, AGORA);
  const a = m.hold.state.ativos.find((x) => x.ticker === 'MORPHO');
  const w = m.carteiras.all().find((x) => x.name === 'Binance');
  const pos = m.hold.get.positionOf(a.id, w.id);
  assert.equal(pos.quantidade, 10.53945);
  assert.equal(Math.round(pos.preco_medio * 1000) / 1000, 2.685);
  assert.equal(m.caixa.saldo(w.id), 0);
});

test('compra usa o caixa existente antes de depositar', () => {
  const m = novo();
  deposito(m, { carteira: 'Binance', token: 'USDT', quantidade: 3 }, AGORA);
  const r = compra(m, { carteira: 'Binance', token: 'PYTH', quantidade: 60, preco: 0.08368, data: '2026-09-27', cobrir_falta: true }, AGORA);
  assert.equal(Math.round(r.dados.deposito_automatico * 100) / 100, 2.02);
});

test('datas inválidas ou no futuro são recusadas', () => {
  const m = novo();
  const base = { carteira: 'Binance', token: 'USDT', quantidade: 1 };
  assert.throws(() => deposito(m, { ...base, data: '27/09/2026' }, AGORA), /AAAA-MM-DD/);
  assert.throws(() => deposito(m, { ...base, data: '2026-10-16' }, AGORA), /está no futuro/);
  assert.throws(() => deposito(m, { ...base, data: '2026-02-30' }, AGORA), /AAAA-MM-DD/);
  assert.match(deposito(m, base, AGORA).resumo, /em 2026-10-15/);
});

test('venda por fração devolve ao caixa e informa o resultado', () => {
  const m = novo();
  compra(m, { carteira: 'Binance', token: 'PYTH', quantidade: 100, preco: 0.05, data: '2026-09-12', cobrir_falta: true }, AGORA);
  const r = venda(m, { carteira: 'Binance', token: 'pyth', fracao: 0.5, preco: 0.1, data: '2026-10-15' }, AGORA);
  assert.match(r.resumo, /Venda de 50 PYTH a \$ 0,1 na Binance/);
  assert.match(r.resumo, /Resultado \+\$ 2,50/);
  assert.match(r.resumo, /Fica 50 PYTH/);
  assert.throws(() => venda(m, { carteira: 'Binance', token: 'PYTH', quantidade: 999, preco: 0.1 }, AGORA), /não dá para vender/);
  assert.throws(() => venda(m, { carteira: 'Binance', token: 'JUP', quantidade: 1, preco: 0.3 }, AGORA), /Não há JUP no Hold/);
  assert.throws(() => venda(m, { carteira: 'Binance', token: 'PYTH', fracao: 2, preco: 0.1 }, AGORA), /fração/);
});

test('números inválidos viram ErroUsuario', () => {
  const m = novo();
  assert.throws(() => compra(m, { carteira: 'Binance', token: 'PYTH', quantidade: -1, preco: 1 }, AGORA), /quantidade precisa ser um número maior que zero/);
  assert.throws(() => compra(m, { carteira: 'Binance', token: 'PYTH', quantidade: 1, preco: 1, taxa_usd: -1 }, AGORA), /taxa não pode ser negativa/);
  assert.throws(() => compra(m, { carteira: 'Binance', token: '', quantidade: 1, preco: 1 }, AGORA), /ticker/);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/operacoes.test.mjs`
Expected: FAIL com `Cannot find module` para `./operacoes.mjs`.

- [ ] **Step 4: Write minimal implementation**

```js
// central-rwa/supabase/functions/atlas-mcp/operacoes.mjs
import { ErroUsuario } from './mcp.mjs';
import { resolverCarteira, usd, qtd } from './leitura.mjs';

const ESTAVEIS = new Set(['USDT', 'USDC', 'DAI', 'USD1', 'FDUSD', 'PYUSD', 'USDE', 'TUSD']);

export function hojeBrasil(agora = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(agora));
}

function dataOperacao(data, agora) {
  const hoje = hojeBrasil(agora);
  if (data == null || data === '') return hoje;
  const s = String(data).trim();
  const d = new Date(s + 'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    throw new ErroUsuario('Use a data no formato AAAA-MM-DD, por exemplo 2026-09-27.');
  }
  if (s > hoje) throw new ErroUsuario(`A data ${s} está no futuro.`);
  return s;
}

function positivo(v, nome) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new ErroUsuario(`${nome} precisa ser um número maior que zero.`);
  return n;
}

function naoNegativo(v, nome) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new ErroUsuario(`${nome} não pode ser negativa.`);
  return n;
}

function tickerDe(t) {
  const s = String(t ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9.$_-]{1,15}$/.test(s)) throw new ErroUsuario('Informe o ticker do token, por exemplo PYTH.');
  return s;
}

function precoTxt(v) {
  return '$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: v < 1 ? 8 : 4 });
}

function carteiraDe(motor, nome) {
  if (nome == null || String(nome).trim() === '') throw new ErroUsuario('Diga em qual carteira, por exemplo Binance.');
  return resolverCarteira({ wallets: motor.carteiras.all() }, nome);
}

function doSite(r) {
  if (r && r.error) throw new ErroUsuario(r.error);
  return r;
}

function valorEmDolar(tk, q, valor_usd) {
  if (valor_usd != null && valor_usd !== '') return positivo(valor_usd, 'O valor em dólar');
  if (ESTAVEIS.has(tk)) return q;
  throw new ErroUsuario(`Informe quanto valiam os ${qtd(q)} ${tk} em dólar (valor_usd). Para stablecoins o valor é a própria quantidade.`);
}

export function criarCarteira(motor, { nome } = {}) {
  const n = String(nome ?? '').trim();
  if (!n || n.length > 40) throw new ErroUsuario('Dê um nome de até 40 caracteres para a carteira.');
  if (motor.carteiras.nameTaken(n)) throw new ErroUsuario(`Já existe uma carteira chamada "${n}".`);
  const w = motor.carteiras.create({ name: n, type: 'global' });
  return { resumo: `Criar a carteira ${w.name} (global).`, dados: { carteira: { id: w.id, nome: w.name, tipo: w.type } } };
}

function movimentoCaixa(tipo, motor, { carteira, token, quantidade, valor_usd, data } = {}, agora = Date.now()) {
  const w = carteiraDe(motor, carteira);
  const tk = tickerDe(token);
  const q = positivo(quantidade, 'A quantidade');
  const valor = valorEmDolar(tk, q, valor_usd);
  const dia = dataOperacao(data, agora);
  if (tipo === 'saque') {
    const c = motor.caixa.podeGastar(w.id, valor);
    if (!c.ok) throw new ErroUsuario(`Caixa insuficiente na ${w.name}: há ${usd(c.saldo)} e o saque é de ${usd(valor)}.`);
  }
  const ev = motor.caixa.registrar({ tipo, valorUSD: valor, ativo: tk, qtd: q, walletId: w.id, data: dia, obs: 'Registrado pelo Claude' });
  if (!ev) throw new ErroUsuario('O caixa recusou o lançamento. Confira os valores.');
  const rotulo = tipo === 'deposito' ? 'Depósito' : 'Saque';
  const preposicao = tipo === 'deposito' ? 'no' : 'do';
  return { resumo: `${rotulo} de ${qtd(q)} ${tk} (${usd(valor)}) ${preposicao} caixa da ${w.name}, em ${dia}.`, dados: { carteira: w.name, token: tk, quantidade: q, valor_usd: valor, data: dia } };
}

export const deposito = (motor, args, agora) => movimentoCaixa('deposito', motor, args, agora);
export const saque = (motor, args, agora) => movimentoCaixa('saque', motor, args, agora);

export function compra(motor, { carteira, token, quantidade, preco, taxa_usd, data, cobrir_falta = false, nome, coingecko_id } = {}, agora = Date.now()) {
  const w = carteiraDe(motor, carteira);
  const tk = tickerDe(token);
  const q = positivo(quantidade, 'A quantidade');
  const p = positivo(preco, 'O preço');
  const taxa = naoNegativo(taxa_usd, 'A taxa');
  const dia = dataOperacao(data, agora);
  const S = motor.hold;
  const acharAtivo = () => S.state.ativos.find((a) => String(a.ticker || '').toUpperCase() === tk);
  const novoAtivo = !acharAtivo();
  if (novoAtivo) {
    doSite(S.actions.createAsset({ nome: String(nome || tk).slice(0, 60), ticker: tk, preco_atual: p, cg_id: coingecko_id ? String(coingecko_id) : undefined }));
  }
  const ativo = acharAtivo();
  const custo = q * p + taxa;
  const falta = motor.caixa.faltaPara(w.id, custo);
  if (falta > 0 && !cobrir_falta) {
    throw new ErroUsuario(`Falta ${usd(falta)} no caixa da ${w.name} para essa compra de ${usd(custo)}. Registre antes um depósito, ou repita com cobrir_falta: true para lançar um depósito automático desse valor na data da compra, como faz o formulário do site.`);
  }
  const saldoAntes = motor.caixa.saldo(w.id);
  doSite(S.actions.executeBuy({ ativo_id: ativo.id, quantidade: q, preco: p, taxa, data: dia, walletId: w.id, cobrirFalta: !!cobrir_falta }));
  const depositado = Math.max(0, custo - saldoAntes);
  const pos = S.get.positionOf(ativo.id, w.id);
  const linhas = [`Compra de ${qtd(q)} ${tk} a ${precoTxt(p)} na ${w.name}, em ${dia}${taxa ? `, taxa ${usd(taxa)}` : ''}: custo ${usd(custo)}.`];
  if (novoAtivo) linhas.push(`${tk} é novo no Hold e será cadastrado${coingecko_id ? ` (CoinGecko: ${coingecko_id})` : ''}.`);
  if (depositado > 0.000001) linhas.push(`Depósito automático de ${usd(depositado)} no caixa da ${w.name}, em ${dia}, para cobrir a compra.`);
  linhas.push(`Posição depois: ${qtd(pos.quantidade)} ${tk}, preço médio ${precoTxt(pos.preco_medio)}.`);
  return { resumo: linhas.join('\n'), dados: { carteira: w.name, token: tk, quantidade: q, preco: p, taxa_usd: taxa, custo, deposito_automatico: depositado, data: dia, posicao: { quantidade: pos.quantidade, preco_medio: pos.preco_medio } } };
}

export function venda(motor, { carteira, token, quantidade, fracao, preco, taxa_usd, data } = {}, agora = Date.now()) {
  const w = carteiraDe(motor, carteira);
  const tk = tickerDe(token);
  const p = positivo(preco, 'O preço');
  const taxa = naoNegativo(taxa_usd, 'A taxa');
  const dia = dataOperacao(data, agora);
  const S = motor.hold;
  const ativo = S.state.ativos.find((a) => String(a.ticker || '').toUpperCase() === tk);
  if (!ativo) throw new ErroUsuario(`Não há ${tk} no Hold.`);
  const pos = S.get.positionOf(ativo.id, w.id);
  if (!pos) throw new ErroUsuario(`Não há posição de ${tk} na ${w.name}.`);
  let q;
  if (fracao != null && fracao !== '') {
    const f = Number(fracao);
    if (!(f > 0 && f <= 1)) throw new ErroUsuario('A fração vai de 0 a 1, por exemplo 0.5 para metade.');
    q = pos.quantidade * f;
  } else {
    q = positivo(quantidade, 'A quantidade');
  }
  const pm = pos.preco_medio;
  doSite(S.actions.executeSell({ ativo_id: ativo.id, quantidade: q, preco: p, taxa, data: dia, walletId: w.id }));
  const apurado = q * p - taxa;
  const resultado = apurado - q * pm;
  const depois = S.get.positionOf(ativo.id, w.id);
  const resumo = `Venda de ${qtd(q)} ${tk} a ${precoTxt(p)} na ${w.name}, em ${dia}${taxa ? `, taxa ${usd(taxa)}` : ''}: volta ${usd(apurado)} ao caixa.\n`
    + `Resultado ${resultado >= 0 ? '+' : ''}${usd(resultado)} sobre o preço médio de ${precoTxt(pm)}. Fica ${qtd(depois ? depois.quantidade : 0)} ${tk}.`;
  return { resumo, dados: { carteira: w.name, token: tk, quantidade: q, preco: p, taxa_usd: taxa, apurado, resultado, data: dia } };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/operacoes.test.mjs central-rwa/supabase/functions/atlas-mcp/leitura.test.mjs`
Expected: PASS (10 + 9 testes).

- [ ] **Step 6: Commit**

```bash
git add central-rwa/supabase/functions/atlas-mcp/operacoes.mjs central-rwa/supabase/functions/atlas-mcp/operacoes.test.mjs central-rwa/supabase/functions/atlas-mcp/leitura.mjs
git commit -m "atlas-mcp: carteira, depósito, saque, compra e venda com as regras do site"
```

---

### Task 5: Prévia, confirmação e desfazer

**Files:**
- Create: `central-rwa/supabase/functions/atlas-mcp/previa.mjs`
- Test: `central-rwa/supabase/functions/atlas-mcp/previa.test.mjs`

**Interfaces:**
- Consumes: `assinar`, `verificar`, `aleatorio` (Task 1 da fase 1); `criarMotor`, `CHAVES_GRAVAVEIS`; operações da Task 4; `ConflitoGravacao` e `firestore.{lerDocs, gravar, ultimoBackup, lerBackup}` (Task 3).
- Contexto consumido: `ctx = { uid, segredo, agora: () => number, firestore }`.
- Produces:
  - `OPERACOES_ESCRITA = ['carteira', 'deposito', 'saque', 'compra', 'venda']`
  - `preparar(ctx, op, args): Promise<{ texto, dados: { id_previa, operacao, ... } }>`
  - `prepararDesfazer(ctx): Promise<{ texto, dados: { id_previa } }>`
  - `confirmar(ctx, idPrevia): Promise<{ texto, dados }>`

- [ ] **Step 1: Write the failing test**

```js
// central-rwa/supabase/functions/atlas-mcp/previa.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { preparar, confirmar, prepararDesfazer } from './previa.mjs';
import { ConflitoGravacao } from './firestore.mjs';
import { ErroUsuario } from './mcp.mjs';

// Firestore falso com as mesmas regras de pré-condição do real.
function firestoreFalso() {
  const docs = new Map(); // chave -> { bruto, updateTime, mcpOp }
  const backups = new Map();
  let relogio = 0;
  const fs = {
    docs, backups,
    async lerDocs(_uid, chaves) { return Object.fromEntries(chaves.map((k) => [k, docs.get(k) ? { ...docs.get(k) } : { bruto: null, updateTime: null, mcpOp: null }])); },
    async gravar(_uid, { opId, mudancas, bases, backup, marcarDesfeito }) {
      for (const k of Object.keys(mudancas)) if ((docs.get(k)?.updateTime ?? null) !== (bases[k] ?? null)) throw new ConflitoGravacao('FAILED_PRECONDITION');
      for (const [k, v] of Object.entries(mudancas)) { if (v === null) docs.delete(k); else docs.set(k, { bruto: v, updateTime: 'T' + (++relogio), mcpOp: opId }); }
      backups.set(opId, { id: opId, ...backup, desfeito: false });
      if (marcarDesfeito) backups.get(marcarDesfeito).desfeito = true;
    },
    async ultimoBackup() { const ids = [...backups.keys()].sort(); return ids.length ? { ...backups.get(ids.at(-1)) } : null; },
    async lerBackup(_uid, id) { return backups.has(id) ? { ...backups.get(id) } : null; },
    siteGrava(k, bruto) { docs.set(k, { bruto, updateTime: 'S' + (++relogio), mcpOp: null }); },
  };
  return fs;
}
const ctxCom = (fs, uid = 'uid1') => ({ uid, segredo: 's'.repeat(40), agora: () => Date.parse('2026-10-16T02:00:00Z'), firestore: fs });

test('preparar não grava nada e devolve id_previa', async () => {
  const fs = firestoreFalso();
  const r = await preparar(ctxCom(fs), 'carteira', { nome: 'Binance' });
  assert.match(r.texto, /^PRÉVIA — nada foi gravado ainda\./);
  assert.match(r.texto, /Criar a carteira Binance \(global\)/);
  assert.ok(r.dados.id_previa.length > 20);
  assert.equal(fs.docs.size, 0);
});

test('confirmar grava as chaves alteradas com backup; o mesmo id não grava duas vezes', async () => {
  const fs = firestoreFalso();
  const ctx = ctxCom(fs);
  const p = await preparar(ctx, 'carteira', { nome: 'Binance' });
  const c = await confirmar(ctx, p.dados.id_previa);
  assert.match(c.texto, /^Gravado no Atlas\./);
  assert.ok(JSON.parse(fs.docs.get('atlas.wallets.v2').bruto).wallets.some((w) => w.name === 'Binance'));
  assert.equal(fs.backups.size, 1);
  await assert.rejects(() => confirmar(ctx, p.dados.id_previa), /mudaram desde a prévia/);
});

test('confirmar recusa se o site gravou depois da prévia', async () => {
  const fs = firestoreFalso();
  const ctx = ctxCom(fs);
  await confirmar(ctx, (await preparar(ctx, 'carteira', { nome: 'Binance' })).dados.id_previa);
  const p = await preparar(ctx, 'deposito', { carteira: 'Binance', token: 'USDT', quantidade: 43.98, data: '2026-10-15' });
  fs.siteGrava('atlas.caixa.v1', '[]');
  await assert.rejects(() => confirmar(ctx, p.dados.id_previa), (e) => e instanceof ErroUsuario && /mudaram desde a prévia/.test(e.message));
});

test('prévia de outro usuário, adulterada ou vencida é recusada', async () => {
  const fs = firestoreFalso();
  const p = await preparar(ctxCom(fs), 'carteira', { nome: 'Binance' });
  await assert.rejects(() => confirmar(ctxCom(fs, 'outro'), p.dados.id_previa), /Prévia inválida ou vencida/);
  await assert.rejects(() => confirmar(ctxCom(fs), p.dados.id_previa + 'x'), /Prévia inválida ou vencida/);
  const tarde = { ...ctxCom(fs), agora: () => Date.parse('2026-10-16T02:11:00Z') };
  await assert.rejects(() => confirmar(tarde, p.dados.id_previa), /Prévia inválida ou vencida/);
});

test('erro de regra aparece já na prévia e operação desconhecida é recusada', async () => {
  const fs = firestoreFalso();
  await assert.rejects(() => preparar(ctxCom(fs), 'deposito', { carteira: 'Binance', token: 'USDT', quantidade: 1 }), /Não encontrei a carteira/);
  await assert.rejects(() => preparar(ctxCom(fs), 'apagar_tudo', {}), /Operação desconhecida/);
});

test('fluxo da Binance: carteira, compra com cobrir_falta e depósito', async () => {
  const fs = firestoreFalso();
  const ctx = ctxCom(fs);
  const passo = async (op, args) => confirmar(ctx, (await preparar(ctx, op, args)).dados.id_previa);
  await passo('carteira', { nome: 'Binance' });
  await passo('compra', { carteira: 'Binance', token: 'JUP', nome: 'Jupiter', quantidade: 13.986, preco: 0.365, taxa_usd: 0.00511, data: '2026-09-27', cobrir_falta: true });
  await passo('deposito', { carteira: 'Binance', token: 'USDT', quantidade: 43.98, data: '2026-10-15' });
  const hold = JSON.parse(fs.docs.get('atlas.hold.state.v2').bruto);
  assert.equal(hold.carteira[0].quantidade, 13.986);
  assert.equal(JSON.parse(fs.docs.get('atlas.caixa.v1').bruto).length, 3);
});

test('desfazer restaura o estado anterior e recusa se o site gravou por cima', async () => {
  const fs = firestoreFalso();
  const ctx = ctxCom(fs);
  await confirmar(ctx, (await preparar(ctx, 'carteira', { nome: 'Binance' })).dados.id_previa);
  const antes = fs.docs.get('atlas.caixa.v1')?.bruto ?? null;
  await confirmar(ctx, (await preparar(ctx, 'deposito', { carteira: 'Binance', token: 'USDT', quantidade: 5 })).dados.id_previa);
  const d = await prepararDesfazer(ctx);
  assert.match(d.texto, /PRÉVIA — desfazer/);
  assert.match(d.texto, /Depósito de 5 USDT/);
  await confirmar(ctx, d.dados.id_previa);
  assert.equal(fs.docs.get('atlas.caixa.v1')?.bruto ?? null, antes);
  await assert.rejects(() => prepararDesfazer(ctx), /já foi um desfazer/);

  await confirmar(ctx, (await preparar(ctx, 'deposito', { carteira: 'Binance', token: 'USDT', quantidade: 7 })).dados.id_previa);
  fs.siteGrava('atlas.caixa.v1', '[]');
  await assert.rejects(() => prepararDesfazer(ctx), /mudaram depois dessa operação/);
});

test('sem operações do Claude não há o que desfazer', async () => {
  await assert.rejects(() => prepararDesfazer(ctxCom(firestoreFalso())), /Não há operação feita pelo Claude/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/previa.test.mjs`
Expected: FAIL com `Cannot find module` para `./previa.mjs`.

- [ ] **Step 3: Write minimal implementation**

```js
// central-rwa/supabase/functions/atlas-mcp/previa.mjs
import { assinar, verificar, aleatorio } from './crypto.mjs';
import { ErroUsuario } from './mcp.mjs';
import { criarMotor, CHAVES_GRAVAVEIS } from './motor.mjs';
import { ConflitoGravacao } from './firestore.mjs';
import { criarCarteira, deposito, saque, compra, venda } from './operacoes.mjs';

const EXECUTORES = { carteira: criarCarteira, deposito, saque, compra, venda };
export const OPERACOES_ESCRITA = Object.keys(EXECUTORES);
const VALIDADE_PREVIA_MS = 10 * 60000;
const MUDOU = 'Os dados do Atlas mudaram desde a prévia (talvez pelo site). Prepare a operação de novo para ver a prévia atualizada.';

async function simular(ctx, op, args) {
  const docs = await ctx.firestore.lerDocs(ctx.uid, CHAVES_GRAVAVEIS);
  const motor = criarMotor(Object.fromEntries(CHAVES_GRAVAVEIS.map((k) => [k, docs[k].bruto])));
  const r = EXECUTORES[op](motor, args, ctx.agora());
  return { docs, r, mudancas: motor.alteracoes() };
}

const basesDe = (docs, chaves) => Object.fromEntries(chaves.map((k) => [k, docs[k].updateTime]));
const brutosDe = (docs, chaves) => Object.fromEntries(chaves.map((k) => [k, docs[k].bruto]));
// Ordem lexicográfica = ordem de gravação: carimbo, depois sequência (dois pedidos no mesmo ms).
let sequenciaOp = 0;
const novoOpId = (ctx) => String(ctx.agora()).padStart(15, '0') + '-' + String(++sequenciaOp % 10000).padStart(4, '0') + aleatorio(4);

async function gravarComTratamento(ctx, args) {
  try { await ctx.firestore.gravar(ctx.uid, args); } catch (e) {
    if (e instanceof ConflitoGravacao) throw new ErroUsuario(MUDOU);
    throw e;
  }
}

export async function preparar(ctx, op, args = {}) {
  if (!EXECUTORES[op]) throw new ErroUsuario(`Operação desconhecida: ${op}.`);
  const { docs, r, mudancas } = await simular(ctx, op, args);
  if (!Object.keys(mudancas).length) throw new ErroUsuario('Essa operação não mudaria nada no Atlas.');
  const id = await assinar({ t: 'previa', u: ctx.uid, op, a: args, b: basesDe(docs, CHAVES_GRAVAVEIS), exp: ctx.agora() + VALIDADE_PREVIA_MS }, ctx.segredo);
  return {
    texto: `PRÉVIA — nada foi gravado ainda.\n${r.resumo}\n\nMostre esta prévia ao dono. Só chame confirmar com o id_previa depois de um "sim" explícito. Vale 10 minutos.`,
    dados: { id_previa: id, operacao: op, ...r.dados },
  };
}

export async function prepararDesfazer(ctx) {
  const b = await ctx.firestore.ultimoBackup(ctx.uid);
  if (!b) throw new ErroUsuario('Não há operação feita pelo Claude para desfazer.');
  if (b.ferramenta === 'desfazer' || b.desfeito) throw new ErroUsuario('A última operação do Claude já foi um desfazer. Corrija pelo site se precisar voltar mais.');
  const chaves = Object.keys(b.antes).filter((k) => CHAVES_GRAVAVEIS.includes(k));
  const docs = await ctx.firestore.lerDocs(ctx.uid, chaves);
  if (chaves.some((k) => docs[k].mcpOp !== b.id)) throw new ErroUsuario('Os dados mudaram depois dessa operação (pelo site ou por outra operação). Desfaça pelo site.');
  const id = await assinar({ t: 'previa', u: ctx.uid, op: 'desfazer', a: { backup: b.id }, b: basesDe(docs, chaves), exp: ctx.agora() + VALIDADE_PREVIA_MS }, ctx.segredo);
  return { texto: `PRÉVIA — desfazer a última operação do Claude:\n${b.resumo}\n\nMostre ao dono e só confirme depois de um "sim".`, dados: { id_previa: id, operacao: 'desfazer' } };
}

export async function confirmar(ctx, idPrevia) {
  const p = await verificar(idPrevia, ctx.segredo, ctx.agora());
  if (!p || p.t !== 'previa' || p.u !== ctx.uid) throw new ErroUsuario('Prévia inválida ou vencida. Prepare a operação de novo.');
  const opId = novoOpId(ctx);

  if (p.op === 'desfazer') {
    const b = await ctx.firestore.lerBackup(ctx.uid, p.a?.backup);
    if (!b || b.desfeito) throw new ErroUsuario('Essa operação já foi desfeita ou não existe mais.');
    const chaves = Object.keys(p.b);
    const docs = await ctx.firestore.lerDocs(ctx.uid, chaves);
    if (chaves.some((k) => docs[k].updateTime !== p.b[k])) throw new ErroUsuario(MUDOU);
    const mudancas = Object.fromEntries(chaves.map((k) => [k, b.antes[k] ?? null]));
    await gravarComTratamento(ctx, { opId, mudancas, bases: p.b, backup: { ferramenta: 'desfazer', resumo: 'Desfeito: ' + b.resumo, antes: brutosDe(docs, chaves) }, marcarDesfeito: b.id });
    return { texto: `Desfeito no Atlas.\n${b.resumo}\nRecarregue o Atlas para ver.`, dados: { gravado: true, operacao: 'desfazer' } };
  }

  if (!EXECUTORES[p.op]) throw new ErroUsuario('Prévia inválida ou vencida. Prepare a operação de novo.');
  const { docs, r, mudancas } = await simular(ctx, p.op, p.a);
  if (CHAVES_GRAVAVEIS.some((k) => docs[k].updateTime !== p.b[k])) throw new ErroUsuario(MUDOU);
  const chaves = Object.keys(mudancas);
  await gravarComTratamento(ctx, { opId, mudancas, bases: basesDe(docs, chaves), backup: { ferramenta: p.op, resumo: r.resumo, antes: brutosDe(docs, chaves) } });
  return { texto: `Gravado no Atlas.\n${r.resumo}\nAbra ou recarregue o Atlas para ver.`, dados: { gravado: true, operacao: p.op, ...r.dados } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/previa.test.mjs`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
git add central-rwa/supabase/functions/atlas-mcp/previa.mjs central-rwa/supabase/functions/atlas-mcp/previa.test.mjs
git commit -m "atlas-mcp: prévia assinada, confirmação com pré-condição e desfazer"
```

---

### Task 6: Ferramentas de escrita no MCP

**Files:**
- Modify: `central-rwa/supabase/functions/atlas-mcp/mcp.mjs`
- Modify: `central-rwa/supabase/functions/atlas-mcp/ferramentas.mjs`
- Modify: `central-rwa/supabase/functions/atlas-mcp/mcp.test.mjs`
- Modify: `central-rwa/supabase/functions/atlas-mcp/ferramentas.test.mjs`

**Interfaces:**
- Consumes: `preparar`, `prepararDesfazer`, `confirmar` (Task 5).
- Produces: ferramenta com campos opcionais `escrita: boolean` e `destrutiva: boolean`; `tools/list` devolve `annotations: { readOnlyHint: !escrita, destructiveHint: !!destrutiva, openWorldHint: false }`. Nomes novos: `preparar_carteira`, `preparar_deposito`, `preparar_saque`, `preparar_compra`, `preparar_venda`, `preparar_desfazer`, `confirmar`, `cancelar`.

- [ ] **Step 1: Write the failing tests**

Em `mcp.test.mjs`, acrescentar à lista `ferramentas` (antes do `];`):

```js
  { nome: 'grava', titulo: 'G', descricao: 'G', schema: { type: 'object' }, escrita: true, destrutiva: true, executar: async () => ({ texto: 'ok', dados: {} }) },
```

e acrescentar o teste:

```js
test('ferramenta de escrita é anunciada como escrita', async () => {
  const { corpo } = await rpc('tools/list');
  const g = corpo.result.tools.find((t) => t.name === 'grava');
  assert.deepEqual(g.annotations, { readOnlyHint: false, destructiveHint: true, openWorldHint: false });
  assert.equal(corpo.result.tools.find((t) => t.name === 'eco').annotations.destructiveHint, false);
});
```

Em `ferramentas.test.mjs`, trocar o primeiro teste por:

```js
test('ferramentas de leitura e escrita existem com schema fechado', () => {
  assert.deepEqual(FERRAMENTAS.map((f) => f.nome), [
    'listar_carteiras', 'ver_posicoes', 'ver_caixa', 'historico',
    'preparar_carteira', 'preparar_deposito', 'preparar_saque', 'preparar_compra', 'preparar_venda', 'preparar_desfazer',
    'confirmar', 'cancelar',
  ]);
  for (const f of FERRAMENTAS) {
    assert.equal(f.schema.type, 'object');
    assert.equal(f.schema.additionalProperties, false);
    assert.ok(f.descricao.length > 20);
  }
  assert.deepEqual(Object.keys(ferramenta('historico').schema.properties), ['carteira', 'token', 'desde', 'limite']);
  assert.deepEqual(ferramenta('preparar_compra').schema.required, ['carteira', 'token', 'quantidade', 'preco']);
  assert.equal(ferramenta('confirmar').destrutiva, true);
  assert.equal(ferramenta('preparar_compra').escrita, true);
  assert.equal(ferramenta('ver_posicoes').escrita, undefined);
});

test('preparar_* usa o fluxo de prévia e cancelar não grava', async () => {
  const lidas = [];
  const ctx = { uid: 'uidDono', segredo: 's'.repeat(40), agora: () => Date.parse('2026-10-16T02:00:00Z'),
    firestore: { lerDocs: async (u, ks) => { lidas.push(u); return Object.fromEntries(ks.map((k) => [k, { bruto: null, updateTime: null, mcpOp: null }])); }, gravar: async () => { throw new Error('não deveria gravar'); } } };
  const r = await ferramenta('preparar_carteira').executar({ nome: 'Binance' }, ctx);
  assert.match(r.texto, /PRÉVIA/);
  assert.ok(lidas.every((u) => u === 'uidDono'));
  const c = await ferramenta('cancelar').executar({ id_previa: r.dados.id_previa }, ctx);
  assert.match(c.texto, /Cancelado/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/mcp.test.mjs central-rwa/supabase/functions/atlas-mcp/ferramentas.test.mjs`
Expected: FAIL (anotação `readOnlyHint` ainda fixa em `true`; lista de ferramentas com 4 nomes).

- [ ] **Step 3: Update `mcp.mjs`**

Trocar a constante `INSTRUCOES` por:

```js
const INSTRUCOES = 'Atlas é o painel de portfólio cripto do dono. Leitura: listar_carteiras, ver_posicoes, ver_caixa, historico. Escrita: sempre em dois passos — chame preparar_* (carteira, deposito, saque, compra, venda, desfazer), mostre a prévia ao dono e só chame confirmar com o id_previa depois de um "sim" explícito dele. Nunca confirme por conta própria. Datas no formato AAAA-MM-DD; "semana passada" vira uma data exata que você mostra na prévia. Em prints de corretora com taxa cobrada no token, lance a quantidade líquida e a taxa convertida em dólar (taxa em tokens × preço). Valores em dólar usam o último preço salvo pelo site. Não invente números que o dono ou as ferramentas não deram.';
```

E, em `tools/list`, trocar `annotations: { readOnlyHint: true, openWorldHint: false },` por:

```js
      annotations: { readOnlyHint: !f.escrita, destructiveHint: !!f.destrutiva, openWorldHint: false },
```

Também trocar a mensagem do erro interno para servir a leitura e escrita: `'Falha interna no conector do Atlas. Nada foi alterado.'` (o teste existente só confere que não vaza o detalhe).

- [ ] **Step 4: Update `ferramentas.mjs`**

Acrescentar o import no topo:

```js
import { preparar, prepararDesfazer, confirmar } from './previa.mjs';
```

Acrescentar, depois de `const usando = ...`:

```js
const P_DATA = { type: 'string', description: 'Data da operação, AAAA-MM-DD. Sem isso, hoje (horário de Brasília).' };
const P_QTD = { type: 'number', exclusiveMinimum: 0, description: 'Quantidade de tokens (líquida, depois de taxa cobrada no token).' };
const P_VALOR = { type: 'number', exclusiveMinimum: 0, description: 'Valor total em dólar. Obrigatório para tokens que não são stablecoin.' };
const P_TAXA = { type: 'number', minimum: 0, description: 'Taxa em dólar. Se a corretora cobrou no token, use taxa em tokens × preço.' };
const P_ID = { type: 'string', description: 'O id_previa devolvido pela ferramenta preparar_*.' };
const esquemaCom = (propriedades, required) => ({ ...esquema(propriedades), required });
const prepararOp = (op) => (args, ctx) => preparar(ctx, op, args);
```

E acrescentar ao fim do array `FERRAMENTAS` (antes do `];`):

```js
  {
    nome: 'preparar_carteira', titulo: 'Preparar carteira nova', escrita: true,
    descricao: 'Prévia da criação de uma carteira global no Atlas (por exemplo Binance). Não grava; devolve id_previa para confirmar.',
    schema: esquemaCom({ nome: { type: 'string', description: 'Nome da carteira, até 40 caracteres.' } }, ['nome']),
    executar: prepararOp('carteira'),
  },
  {
    nome: 'preparar_deposito', titulo: 'Preparar depósito no caixa', escrita: true,
    descricao: 'Prévia de um depósito no caixa de uma carteira (dinheiro que entrou de fora, como um Pix convertido em USDT). Não grava.',
    schema: esquemaCom({ carteira: P_CARTEIRA, token: P_TOKEN, quantidade: P_QTD, valor_usd: P_VALOR, data: P_DATA }, ['carteira', 'token', 'quantidade']),
    executar: prepararOp('deposito'),
  },
  {
    nome: 'preparar_saque', titulo: 'Preparar saque do caixa', escrita: true,
    descricao: 'Prévia de um saque do caixa de uma carteira (dinheiro que saiu do Atlas). Recusa se faltar caixa. Não grava.',
    schema: esquemaCom({ carteira: P_CARTEIRA, token: P_TOKEN, quantidade: P_QTD, valor_usd: P_VALOR, data: P_DATA }, ['carteira', 'token', 'quantidade']),
    executar: prepararOp('saque'),
  },
  {
    nome: 'preparar_compra', titulo: 'Preparar compra no Hold', escrita: true,
    descricao: 'Prévia de uma compra no Hold, com data, preço e taxa. O custo sai do caixa da carteira; com cobrir_falta: true o que faltar entra como depósito automático na data da compra, como no formulário do site. Também serve para mover caixa para o Hold. Não grava.',
    schema: esquemaCom({
      carteira: P_CARTEIRA, token: P_TOKEN, quantidade: P_QTD,
      preco: { type: 'number', exclusiveMinimum: 0, description: 'Preço por token em dólar.' },
      taxa_usd: P_TAXA, data: P_DATA,
      cobrir_falta: { type: 'boolean', description: 'Lançar depósito automático do que faltar no caixa, na data da compra.' },
      nome: { type: 'string', description: 'Nome do token, usado só se ele ainda não existir no Hold.' },
      coingecko_id: { type: 'string', description: 'Id do token na CoinGecko, para o site atualizar o preço sozinho.' },
    }, ['carteira', 'token', 'quantidade', 'preco']),
    executar: prepararOp('compra'),
  },
  {
    nome: 'preparar_venda', titulo: 'Preparar venda no Hold', escrita: true,
    descricao: 'Prévia de uma venda no Hold, por quantidade ou fração (0.5 = metade). O apurado volta ao caixa da carteira e o resultado é calculado sobre o preço médio. Não grava.',
    schema: esquemaCom({
      carteira: P_CARTEIRA, token: P_TOKEN, quantidade: P_QTD,
      fracao: { type: 'number', exclusiveMinimum: 0, maximum: 1, description: 'Fração da posição, por exemplo 0.5 para metade.' },
      preco: { type: 'number', exclusiveMinimum: 0, description: 'Preço de venda por token em dólar.' },
      taxa_usd: P_TAXA, data: P_DATA,
    }, ['carteira', 'token', 'preco']),
    executar: prepararOp('venda'),
  },
  {
    nome: 'preparar_desfazer', titulo: 'Preparar desfazer', escrita: true,
    descricao: 'Prévia para desfazer a última operação gravada pelo Claude, se ninguém mexeu nesses dados depois. Não grava.',
    schema: esquema({}), executar: (args, ctx) => prepararDesfazer(ctx),
  },
  {
    nome: 'confirmar', titulo: 'Confirmar e gravar', escrita: true, destrutiva: true,
    descricao: 'Grava no Atlas a operação de uma prévia. Use somente depois que o dono disser sim à prévia mostrada.',
    schema: esquemaCom({ id_previa: P_ID }, ['id_previa']),
    executar: (args, ctx) => confirmar(ctx, args.id_previa),
  },
  {
    nome: 'cancelar', titulo: 'Cancelar prévia', escrita: true,
    descricao: 'Descarta uma prévia. Nada é gravado; a prévia também expira sozinha em 10 minutos.',
    schema: esquemaCom({ id_previa: P_ID }, ['id_previa']),
    executar: async () => ({ texto: 'Cancelado. Nada foi gravado no Atlas.', dados: { cancelado: true } }),
  },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/mcp.test.mjs central-rwa/supabase/functions/atlas-mcp/ferramentas.test.mjs`
Expected: PASS (7 + 6 testes).

- [ ] **Step 6: Commit**

```bash
git add central-rwa/supabase/functions/atlas-mcp/mcp.mjs central-rwa/supabase/functions/atlas-mcp/ferramentas.mjs central-rwa/supabase/functions/atlas-mcp/mcp.test.mjs central-rwa/supabase/functions/atlas-mcp/ferramentas.test.mjs
git commit -m "atlas-mcp: ferramentas de escrita com prévia e confirmação"
```

---

### Task 7: Handler, bundle e página de consentimento

**Files:**
- Modify: `central-rwa/supabase/functions/atlas-mcp/handler.mjs`
- Modify: `central-rwa/supabase/functions/atlas-mcp/montar.mjs`
- Modify: `central-rwa/supabase/functions/atlas-mcp/build.mjs`
- Modify: `central-rwa/supabase/functions/atlas-mcp/handler.test.mjs`
- Modify: `pages/conectar-claude.html`

**Interfaces:**
- Consumes: tudo das Tasks 1–6.
- Produces: contexto MCP `{ uid, segredo, agora, firestore }`; bundle com `site-gerado.mjs`, `motor.mjs`, `operacoes.mjs`, `previa.mjs`.

- [ ] **Step 1: Write the failing test**

Em `handler.test.mjs`, no `montar()`, trocar o `firestore` falso por um que também implementa `lerDocs` e `gravar` em memória:

```js
  const gravados = new Map();
  const firestore = {
    lerChave: async (uid, chave) => { lidas.push(uid); return { valor: uid === 'uidDono' ? (DADOS[chave] ?? null) : null, atualizado: null }; },
    lerDocs: async (uid, chaves) => { lidas.push(uid); return Object.fromEntries(chaves.map((k) => [k, gravados.has(k) ? gravados.get(k) : { bruto: DADOS[k] ? JSON.stringify(DADOS[k]) : null, updateTime: DADOS[k] ? 'T0' : null, mcpOp: null }])); },
    gravar: async (uid, { opId, mudancas }) => { for (const [k, v] of Object.entries(mudancas)) gravados.set(k, { bruto: v, updateTime: 'T' + opId, mcpOp: opId }); },
  };
```

e devolver `gravados` junto (`return { store, lidas, gravados, h: ... }`). Acrescentar o teste:

```js
test('fluxo de escrita pelo MCP: prévia não grava, confirmar grava com o uid do token', async () => {
  const { h, gravados, lidas } = montar();
  const t = await conectar(h);
  const p = await (await rpc(h, t.access_token, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'preparar_carteira', arguments: { nome: 'OKX' } } })).json();
  assert.match(p.result.content[0].text, /PRÉVIA/);
  assert.equal(gravados.size, 0);
  const c = await (await rpc(h, t.access_token, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'confirmar', arguments: { id_previa: p.result.structuredContent.id_previa } } })).json();
  assert.equal(c.result.isError, false);
  assert.ok(JSON.parse(gravados.get('atlas.wallets.v2').bruto).wallets.some((w) => w.name === 'OKX'));
  assert.ok(lidas.every((x) => x === 'uidDono'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/handler.test.mjs`
Expected: FAIL no teste novo (o contexto não tem `segredo`/`agora`: `confirmar` recusa a prévia ou `preparar` quebra).

- [ ] **Step 3: Update the handler context**

Em `handler.mjs`, trocar:

```js
        const contexto = { uid: a.uid, get firestore() { return obterFirestore(); } };
```

por:

```js
        const contexto = { uid: a.uid, segredo: c.segredo, agora, get firestore() { return obterFirestore(); } };
```

- [ ] **Step 4: Update the bundle**

Em `montar.mjs`, trocar a constante `ORDEM` por:

```js
const ORDEM = ['crypto.mjs', 'mcp.mjs', 'store.mjs', 'firestore.mjs', 'leitura.mjs', 'site-gerado.mjs', 'motor.mjs', 'operacoes.mjs', 'previa.mjs', 'ferramentas.mjs', 'oauth.mjs', 'handler.mjs'];
```

Em `build.mjs`, regenerar o código do site antes de montar: acrescentar `import { escreverCodigoSite } from './gerar-site.mjs';` e chamar `escreverCodigoSite();` antes de `writeFileSync(destino, montar());`.

- [ ] **Step 5: Update the consent page text**

Em `pages/conectar-claude.html`, trocar o bloco entre `<p>O Claude vai poder <strong>ler</strong>:</p>` e `<p>Nesta versão ele não registra nem altera nada.</p>` (inclusive) por:

```html
      <p>O Claude vai poder:</p>
      <ul>
        <li><strong>ler</strong> suas carteiras, o caixa, as posições do Hold e o histórico;</li>
        <li><strong>registrar</strong> carteiras, depósitos, saques, compras e vendas, sempre mostrando uma prévia e gravando só depois do seu "sim".</li>
      </ul>
```

- [ ] **Step 6: Run the whole suite and build**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/*.test.mjs js/conectar-claude.test.cjs`
Expected: PASS em todos (o `montar.test.mjs` carrega o bundle novo e confirma que não há nomes repetidos).

Run: `node central-rwa/supabase/functions/atlas-mcp/build.mjs`
Expected: `Bundle gerado em ...dist/index.ts` e `git status` sem mudança em `site-gerado.mjs`.

- [ ] **Step 7: Commit**

```bash
git add central-rwa/supabase/functions/atlas-mcp/handler.mjs central-rwa/supabase/functions/atlas-mcp/montar.mjs central-rwa/supabase/functions/atlas-mcp/build.mjs central-rwa/supabase/functions/atlas-mcp/handler.test.mjs pages/conectar-claude.html
git commit -m "atlas-mcp: handler e bundle com a gravação; consentimento menciona registro"
```

---

### Task 8: Documentação e CI

**Files:**
- Modify: `docs/atlas-mcp.md`
- Modify: `docs/superpowers/specs/2026-10-15-conector-mcp-design.md`
- Modify: `.github/workflows/atlas-mcp.yml`

- [ ] **Step 1: Update `docs/atlas-mcp.md`**

Trocar o título da seção `## Contrato vigente (fase 1)` por `## Contrato vigente (fases 1 a 3)` e substituir a primeira linha da lista (`- Só leitura. Ferramentas: ...`) por:

```markdown
- Leitura: `listar_carteiras`, `ver_posicoes`, `ver_caixa`, `historico`.
- Escrita (fases 2 e 3): `preparar_carteira`, `preparar_deposito`, `preparar_saque`, `preparar_compra`, `preparar_venda`, `preparar_desfazer`, `confirmar`, `cancelar`. Nada grava sem `confirmar` de uma prévia assinada, do mesmo uid, com menos de 10 minutos e com os documentos no mesmo `updateTime` da prévia.
- As regras são as do próprio site: o conector executa `wallets/*.js` e `hold/js/state.js` (via `site-gerado.mjs`) sobre o estado lido do Firestore. Mudou um desses arquivos? Rode `node central-rwa/supabase/functions/atlas-mcp/gerar-site.mjs`, confira os testes e reimplante a função.
- Gravação: um `documents:commit` com pré-condição por documento; campos `value`, `device: "claude-mcp"`, `mcpOp` e `updatedAt`. Backup no mesmo commit em `atlas_users/{uid}/mcp_backup/{op}` (50 mais recentes). `desfazer` só restaura se os documentos ainda tiverem o `mcpOp` da operação.
- Compra sem caixa: recusada, a não ser com `cobrir_falta: true`, que lança o depósito automático na data da compra (mesmo comportamento do formulário do site). Carteira nova: só global nesta fase. Depósito de token não estável exige `valor_usd`.
- Se o site estiver aberto em outro aparelho com edição local ainda não enviada, a regra do site continua sendo "a edição mais recente vence". Recarregue o Atlas depois de gravar pelo Claude.
```

Acrescentar ao fim da seção "Implantação manual", antes de "Para atualizar":

```markdown
9. **Atualização para as fases 2 e 3.** Rodar `node central-rwa/supabase/functions/atlas-mcp/build.mjs`, colar o `dist/index.ts` novo na função `atlas-mcp` e clicar em Deploy updates. Não precisa de secret nem migração novos. O conector já autorizado continua valendo; as ferramentas novas aparecem sozinhas no Claude.
```

- [ ] **Step 2: Record the plan decisions in the spec**

Em `docs/superpowers/specs/2026-10-15-conector-mcp-design.md`, no fim da seção `## Regras de domínio compartilhadas`, acrescentar:

```markdown
**Atualização de 16/10/2026 (fases 2 e 3).** Em vez de extrair funções para `core/dominio/`, o conector executa o próprio código do site (`wallets/walletStore.js`, `walletTypes.js`, `walletLedger.js`, `walletManager.js`, `walletCaixa.js`, `hold/js/state.js`), gerado em `site-gerado.mjs`, sobre um `localStorage` em memória. O site não muda, e não existe segunda versão das regras. Também ficou decidido: compra sem caixa aceita `cobrir_falta` (igual ao formulário do site); alocação para o Hold é uma compra no Hold; alocação para DeFi fica com pools na fase 4; carteira nova só global nesta fase. Plano: [fases 2 e 3](../plans/2026-10-16-conector-mcp-fases-2-3.md).
```

- [ ] **Step 3: Trigger CI on site rule files**

Em `.github/workflows/atlas-mcp.yml`, acrescentar `'wallets/**'` e `'hold/js/state.js'` às duas listas `paths`.

- [ ] **Step 4: Run all tests once more**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/*.test.mjs js/conectar-claude.test.cjs`
Expected: PASS em todos.

Run: `node --test core/atlas-oraculo-operacoes.test.cjs Ferramentas/scanner-pools/regras.test.cjs defi/js/pool-history.test.cjs`
Expected: PASS (nada do site mudou).

- [ ] **Step 5: Commit**

```bash
git add docs/atlas-mcp.md docs/superpowers/specs/2026-10-15-conector-mcp-design.md .github/workflows/atlas-mcp.yml
git commit -m "Docs e CI do conector MCP: fases 2 e 3"
```

---

### Task 9: Implantação e primeiro uso real (com o dono)

Sem código novo.

- [ ] **Step 1:** PR aberto, revisado e com merge (o dono decide o merge).
- [ ] **Step 2:** `node central-rwa/supabase/functions/atlas-mcp/build.mjs`, colar o `dist/index.ts` na função `atlas-mcp` e Deploy updates (o dono cola; o agente copia o bundle para a área de transferência).
- [ ] **Step 3:** O agente confere por `curl` que `/.well-known/oauth-authorization-server` responde 200 e que `POST /mcp` sem token responde 401.
- [ ] **Step 4:** Numa conversa do Claude com o conector Atlas, o dono pede a carteira Binance e os lançamentos da Binance (6 compras com `cobrir_falta`, sobra de 0,00405 LINK como compra no mesmo preço, 43,98 USDT de depósito). Cada prévia é conferida e confirmada.
- [ ] **Step 5:** O dono abre o Atlas logado e confere carteira, posições, preço médio e caixa.
