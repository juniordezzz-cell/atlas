# Conector MCP do Atlas — Fase 1 (conectar e consultar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O dono adiciona o Atlas como conector personalizado no Claude (celular ou web), faz login com o Google do Atlas e consulta carteiras, posições do Hold, caixa e histórico, com as respostas batendo com o site.

**Architecture:** Uma Supabase Edge Function `atlas-mcp` (Deno) atende quatro grupos de rota: metadados OAuth, OAuth (registro, autorização, token), e o endpoint MCP (`POST /mcp`, JSON-RPC sem streaming). A identidade vem do login Google do próprio Atlas numa página do site (`pages/conectar-claude.html`), que devolve o ID token Firebase à função. A leitura dos dados usa uma conta de serviço do Firebase contra a API REST do Firestore, só em `atlas_users/{uid}/store/{chave}`. Códigos e tokens OAuth ficam com hash em tabelas do Supabase, acessadas por RPC com a chave de serviço.

**Tech Stack:** JavaScript ES modules (`.mjs`), Web APIs (fetch, `crypto.subtle`, URL), Deno no Supabase, Node 22 + `node:test` nos testes, PostgreSQL (migração Supabase), HTML/JS clássico do site com Firebase compat 10.14.1 já vendorizado.

**Spec:** [docs/superpowers/specs/2026-10-15-conector-mcp-design.md](../specs/2026-10-15-conector-mcp-design.md). Esta fase cobre a linha "Fase 1" da tabela de entrega: OAuth + `listar_carteiras`, `ver_posicoes`, `ver_caixa`, `historico`.

## Global Constraints

- Sem dependências npm. Só Web APIs no código da função; `node:test`, `node:assert/strict`, `node:fs`, `node:crypto` apenas nos testes e no `build.mjs`.
- Fase 1 **só lê**. Nenhuma escrita no Firestore.
- O `uid` vem só do token de acesso. Nenhuma ferramenta aceita `uid`. Caminho do Firestore: `atlas_users/{uid}/store/{chave com "." trocado por "__"}`.
- E-mails permitidos: env `ATLAS_MCP_ALLOWED_EMAILS` (separados por vírgula), padrão `juniordezzz@gmail.com`. Exige `emailVerified` verdadeiro.
- Origem do site: `https://juniordezzz-cell.github.io`. Página de autorização: `https://juniordezzz-cell.github.io/atlas/pages/conectar-claude.html` (env `ATLAS_MCP_PAGINA` sobrescreve).
- Redirects aceitos no registro: `https://claude.ai/api/mcp/auth_callback` e `https://claude.com/api/mcp/auth_callback`. Nenhum outro.
- Validade: pedido de autorização 10 min; código 5 min, uso único; token de acesso 1 h; token de renovação 30 dias, com rotação e detecção de reuso. Limite: 60 chamadas por minuto por token de acesso.
- PKCE obrigatório, só `S256`.
- Chaves: `ATLAS_MCP_SECRET` (≥ 32 caracteres), `ATLAS_FIREBASE_SERVICE_ACCOUNT` (JSON) e a chave de serviço do Supabase ficam só como secrets no Supabase. Nada disso entra no repositório ou no navegador. A única chave no código é a chave web pública do Firebase, que já está no repositório.
- Mensagens para o usuário em português do Brasil.
- Implantação: um único `index.ts` gerado por `build.mjs`, colado no editor do Supabase; `verify_jwt = false`. GitHub Pages não publica a função.
- O bundle concatena os módulos: **nomes de nível superior não podem se repetir entre arquivos** do `atlas-mcp`.

## Review Focus

1. Carteira citada com outra grafia ("binance", " JRB1 ", "Binânce") deve achar a carteira; nome inexistente deve responder com a lista de carteiras, sem erro interno. → teste em Task 6.
2. Chave ausente no Firestore (usuário sem Hold, sem caixa) ou JSON corrompido deve responder "nada registrado" ou um aviso, nunca falha interna. → testes em Task 5 e Task 7.
3. Posição antiga sem `walletId` pertence à carteira `principal`, como no site. → teste em Task 6.
4. Token de acesso expirado ou revogado deve responder 401 com `WWW-Authenticate` apontando os metadados, para o Claude renovar; reuso de token de renovação revoga a família inteira. → testes em Task 4 e Task 8.
5. Ativo sem preço salvo (`preco_atual` 0 ou ausente) não pode entrar como $ 0 no total; aparece como "sem preço" e fora do total. → teste em Task 6.

---

## File Structure

Função (todos novos, em `central-rwa/supabase/functions/atlas-mcp/`):

| Arquivo | Responsabilidade |
|---|---|
| `crypto.mjs` | base64url, aleatório, SHA-256, PKCE, assinatura HMAC de blobs (client_id e pedido de autorização) |
| `mcp.mjs` | JSON-RPC do MCP: initialize, ping, tools/list, tools/call; `ErroUsuario` |
| `store.mjs` | Adaptador das RPCs do Supabase para códigos e tokens |
| `fakes.mjs` | Store em memória para testes (fora do bundle) |
| `oauth.mjs` | Metadados, registro, autorização, conclusão com Firebase, troca de token, autenticação |
| `firestore.mjs` | Token Google por conta de serviço e leitura de uma chave do Firestore |
| `leitura.mjs` | Contas de leitura sobre carteiras, Hold e caixa, com texto em pt-BR |
| `ferramentas.mjs` | Definição das 4 ferramentas MCP e carga do estado |
| `handler.mjs` | Roteamento HTTP, CORS da página, configuração por env |
| `index.ts` | Entrada para deploy por CLI (3 linhas) |
| `montar.mjs` / `build.mjs` | Gera `dist/index.ts` consolidado para colar no editor |
| `*.test.mjs` | Testes de cada módulo |

Outros:

| Arquivo | Ação |
|---|---|
| `central-rwa/supabase/migrations/20261015000001_atlas_mcp_oauth.sql` | Criar: schema `atlas_mcp`, tabelas e RPCs |
| `central-rwa/supabase/config.toml` | Modificar: `[functions.atlas-mcp] verify_jwt = false` |
| `pages/conectar-claude.html`, `js/conectar-claude.js`, `js/conectar-claude.test.cjs` | Criar: página de autorização |
| `docs/atlas-mcp.md` | Criar: contrato e implantação |
| `AGENTS.md` | Modificar: apontar para o contrato |
| `.github/workflows/atlas-mcp.yml` | Criar: testes no CI |
| `.gitignore` | Modificar: ignorar `central-rwa/supabase/functions/atlas-mcp/dist/` |

Comando de teste da função (bash, raiz do repositório):

```bash
node --test central-rwa/supabase/functions/atlas-mcp/*.test.mjs
```

---

### Task 1: Utilitários de criptografia

**Files:**
- Create: `central-rwa/supabase/functions/atlas-mcp/crypto.mjs`
- Test: `central-rwa/supabase/functions/atlas-mcp/crypto.test.mjs`

**Interfaces:**
- Produces:
  - `b64url(bytes: Uint8Array): string`
  - `b64urlDecode(texto: string): Uint8Array`
  - `aleatorio(n = 32): string` (base64url de `n` bytes aleatórios)
  - `sha256b64url(texto: string): Promise<string>`
  - `pkceConfere(verifier: string, challenge: string): Promise<boolean>`
  - `assinar(obj: object, segredo: string): Promise<string>` → `"<corpo>.<assinatura>"`
  - `verificar(token: string, segredo: string, agora = Date.now()): Promise<object|null>` (null se adulterado, malformado ou `exp` vencido)

- [ ] **Step 1: Write the failing test**

```js
// central-rwa/supabase/functions/atlas-mcp/crypto.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { b64url, b64urlDecode, aleatorio, sha256b64url, pkceConfere, assinar, verificar } from './crypto.mjs';

test('base64url ida e volta, sem padding', () => {
  for (const n of [0, 1, 2, 3, 31, 32, 33]) {
    const bytes = crypto.getRandomValues(new Uint8Array(n));
    const s = b64url(bytes);
    assert.doesNotMatch(s, /[+/=]/);
    assert.deepEqual([...b64urlDecode(s)], [...bytes]);
  }
});

test('aleatorio gera textos distintos do tamanho esperado', () => {
  const a = aleatorio(), b = aleatorio();
  assert.notEqual(a, b);
  assert.equal(a.length, 43);
  assert.equal(aleatorio(16).length, 22);
});

test('sha256 confere com node:crypto e PKCE S256', async () => {
  const v = aleatorio(48);
  const esperado = createHash('sha256').update(v).digest('base64url');
  assert.equal(await sha256b64url(v), esperado);
  assert.equal(await pkceConfere(v, esperado), true);
  assert.equal(await pkceConfere(v + 'x', esperado), false);
  assert.equal(await pkceConfere('curto', await sha256b64url('curto')), false);
  assert.equal(await pkceConfere(undefined, esperado), false);
});

test('assinar e verificar: válido, adulterado, vencido e malformado', async () => {
  const seg = 's'.repeat(40);
  const t = await assinar({ a: 1, exp: Date.now() + 1000 }, seg);
  assert.equal((await verificar(t, seg)).a, 1);
  assert.equal(await verificar(t, 'outro-segredo-com-mais-de-trinta-e-dois'), null);
  const [corpo, sig] = t.split('.');
  assert.equal(await verificar(corpo + 'A.' + sig, seg), null);
  assert.equal(await verificar(t, seg, Date.now() + 5000), null);
  assert.equal(await verificar('sem-ponto', seg), null);
  assert.equal(await verificar('a.b.c', seg), null);
  assert.equal(await verificar(null, seg), null);
  const semExp = await assinar({ r: ['x'] }, seg);
  assert.deepEqual(await verificar(semExp, seg), { r: ['x'] });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/crypto.test.mjs`
Expected: FAIL com `Cannot find module` para `./crypto.mjs`.

- [ ] **Step 3: Write minimal implementation**

```js
// central-rwa/supabase/functions/atlas-mcp/crypto.mjs
const enc = new TextEncoder();

export function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(texto) {
  const s = String(texto).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function aleatorio(n = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(n)));
}

export async function sha256b64url(texto) {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(texto))));
}

export async function pkceConfere(verifier, challenge) {
  if (typeof verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  return (await sha256b64url(verifier)) === challenge;
}

async function chaveHmac(segredo) {
  return crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function assinar(obj, segredo) {
  const corpo = b64url(enc.encode(JSON.stringify(obj)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await chaveHmac(segredo), enc.encode(corpo)));
  return corpo + '.' + b64url(sig);
}

export async function verificar(token, segredo, agora = Date.now()) {
  if (typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null;
  let valido = false;
  try {
    valido = await crypto.subtle.verify('HMAC', await chaveHmac(segredo), b64urlDecode(partes[1]), enc.encode(partes[0]));
  } catch { return null; }
  if (!valido) return null;
  let obj;
  try { obj = JSON.parse(new TextDecoder().decode(b64urlDecode(partes[0]))); } catch { return null; }
  if (typeof obj?.exp === 'number' && obj.exp < agora) return null;
  return obj;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/crypto.test.mjs`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add central-rwa/supabase/functions/atlas-mcp/crypto.mjs central-rwa/supabase/functions/atlas-mcp/crypto.test.mjs
git commit -m "atlas-mcp: utilitários de criptografia (PKCE, HMAC, base64url)"
```

---

### Task 2: Protocolo MCP (JSON-RPC)

**Files:**
- Create: `central-rwa/supabase/functions/atlas-mcp/mcp.mjs`
- Test: `central-rwa/supabase/functions/atlas-mcp/mcp.test.mjs`

**Interfaces:**
- Produces:
  - `class ErroUsuario extends Error` — erro com mensagem para mostrar ao dono.
  - `VERSOES: string[]` = `['2025-11-25', '2025-06-18', '2025-03-26']`
  - `atenderMcp(msg, { ferramentas, contexto }): Promise<{ status: number, corpo: object|null }>`
  - Formato de ferramenta consumido: `{ nome, titulo, descricao, schema, executar(args, contexto): Promise<{ texto: string, dados: object }> }`

- [ ] **Step 1: Write the failing test**

```js
// central-rwa/supabase/functions/atlas-mcp/mcp.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { atenderMcp, ErroUsuario, VERSOES } from './mcp.mjs';

const ferramentas = [
  { nome: 'eco', titulo: 'Eco', descricao: 'Repete', schema: { type: 'object', properties: {}, additionalProperties: false },
    executar: async (a, ctx) => ({ texto: 'oi ' + ctx.uid, dados: { a } }) },
  { nome: 'falha_usuario', titulo: 'F', descricao: 'F', schema: { type: 'object' }, executar: async () => { throw new ErroUsuario('Carteira não existe.'); } },
  { nome: 'falha_interna', titulo: 'F', descricao: 'F', schema: { type: 'object' }, executar: async () => { throw new Error('segredo vazou?'); } },
];
const ctx = { ferramentas, contexto: { uid: 'u1' } };
const rpc = (method, params, id = 1) => atenderMcp({ jsonrpc: '2.0', id, method, params }, ctx);

test('initialize negocia versão e se apresenta', async () => {
  const a = await rpc('initialize', { protocolVersion: '2025-06-18' });
  assert.equal(a.corpo.result.protocolVersion, '2025-06-18');
  assert.equal(a.corpo.result.serverInfo.name, 'atlas');
  assert.deepEqual(a.corpo.result.capabilities, { tools: { listChanged: false } });
  const b = await rpc('initialize', { protocolVersion: '1999-01-01' });
  assert.equal(b.corpo.result.protocolVersion, VERSOES[0]);
});

test('notificação devolve 202 sem corpo; ping devolve vazio', async () => {
  assert.deepEqual(await atenderMcp({ jsonrpc: '2.0', method: 'notifications/initialized' }, ctx), { status: 202, corpo: null });
  assert.deepEqual((await rpc('ping')).corpo.result, {});
});

test('tools/list expõe nome, schema e readOnlyHint', async () => {
  const { corpo } = await rpc('tools/list');
  const eco = corpo.result.tools.find((t) => t.name === 'eco');
  assert.equal(eco.title, 'Eco');
  assert.deepEqual(eco.inputSchema, ferramentas[0].schema);
  assert.equal(eco.annotations.readOnlyHint, true);
});

test('tools/call executa com contexto e devolve texto e dados', async () => {
  const { corpo } = await rpc('tools/call', { name: 'eco', arguments: { x: 1 } });
  assert.deepEqual(corpo.result.content, [{ type: 'text', text: 'oi u1' }]);
  assert.deepEqual(corpo.result.structuredContent, { a: { x: 1 } });
  assert.equal(corpo.result.isError, false);
});

test('erros: usuário mostra mensagem; interno esconde detalhe; desconhecidos', async () => {
  const u = (await rpc('tools/call', { name: 'falha_usuario', arguments: {} })).corpo.result;
  assert.equal(u.isError, true);
  assert.equal(u.content[0].text, 'Carteira não existe.');
  const i = (await rpc('tools/call', { name: 'falha_interna', arguments: {} })).corpo.result;
  assert.equal(i.isError, true);
  assert.doesNotMatch(i.content[0].text, /segredo/);
  assert.equal((await rpc('tools/call', { name: 'nao_existe' })).corpo.error.code, -32602);
  assert.equal((await rpc('tools/call', { name: 'eco', arguments: [1] })).corpo.error.code, -32602);
  assert.equal((await rpc('resources/list')).corpo.error.code, -32601);
});

test('lote e mensagem malformada são recusados', async () => {
  assert.equal((await atenderMcp([{ jsonrpc: '2.0', id: 1, method: 'ping' }], ctx)).status, 400);
  assert.equal((await atenderMcp({ id: 1, method: 'ping' }, ctx)).corpo.error.code, -32600);
  assert.equal((await atenderMcp(null, ctx)).status, 400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/mcp.test.mjs`
Expected: FAIL com `Cannot find module` para `./mcp.mjs`.

- [ ] **Step 3: Write minimal implementation**

```js
// central-rwa/supabase/functions/atlas-mcp/mcp.mjs
export class ErroUsuario extends Error {}

export const VERSOES = ['2025-11-25', '2025-06-18', '2025-03-26'];

const INSTRUCOES = 'Atlas é o painel de portfólio cripto do dono. Nesta versão o conector só lê: carteiras, posições do Hold, caixa e histórico. Valores em dólar usam o último preço salvo pelo site. Não invente números que as ferramentas não devolveram.';

const rpcErro = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const rpcOk = (id, result) => ({ jsonrpc: '2.0', id, result });

export async function atenderMcp(msg, { ferramentas, contexto }) {
  if (Array.isArray(msg)) return { status: 400, corpo: rpcErro(null, -32600, 'Lotes não são aceitos.') };
  if (!msg || typeof msg !== 'object') return { status: 400, corpo: rpcErro(null, -32600, 'Requisição JSON-RPC inválida.') };
  if (msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return { status: 400, corpo: rpcErro(msg.id ?? null, -32600, 'Requisição JSON-RPC inválida.') };
  if (!Object.hasOwn(msg, 'id') || msg.id === null) return { status: 202, corpo: null };
  const { id, method, params } = msg;

  if (method === 'initialize') {
    const pedida = params?.protocolVersion;
    return { status: 200, corpo: rpcOk(id, {
      protocolVersion: VERSOES.includes(pedida) ? pedida : VERSOES[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'atlas', title: 'Atlas', version: '0.1.0' },
      instructions: INSTRUCOES,
    }) };
  }
  if (method === 'ping') return { status: 200, corpo: rpcOk(id, {}) };
  if (method === 'tools/list') {
    return { status: 200, corpo: rpcOk(id, { tools: ferramentas.map((f) => ({
      name: f.nome, title: f.titulo, description: f.descricao, inputSchema: f.schema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    })) }) };
  }
  if (method === 'tools/call') {
    const f = ferramentas.find((x) => x.nome === params?.name);
    if (!f) return { status: 200, corpo: rpcErro(id, -32602, `Ferramenta desconhecida: ${params?.name}`) };
    const args = params?.arguments ?? {};
    if (typeof args !== 'object' || Array.isArray(args)) return { status: 200, corpo: rpcErro(id, -32602, 'arguments precisa ser um objeto.') };
    try {
      const r = await f.executar(args, contexto);
      return { status: 200, corpo: rpcOk(id, { content: [{ type: 'text', text: r.texto }], structuredContent: r.dados, isError: false }) };
    } catch (e) {
      const texto = e instanceof ErroUsuario ? e.message : 'Falha interna ao ler o Atlas. Nada foi alterado.';
      if (!(e instanceof ErroUsuario)) console.error('atlas-mcp ferramenta', f.nome, String(e?.message || e).slice(0, 120));
      return { status: 200, corpo: rpcOk(id, { content: [{ type: 'text', text: texto }], isError: true }) };
    }
  }
  return { status: 200, corpo: rpcErro(id, -32601, `Método não suportado: ${method}`) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/mcp.test.mjs`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add central-rwa/supabase/functions/atlas-mcp/mcp.mjs central-rwa/supabase/functions/atlas-mcp/mcp.test.mjs
git commit -m "atlas-mcp: protocolo MCP (initialize, tools/list, tools/call)"
```

---

### Task 3: Armazenamento de códigos e tokens (migração + adaptador + memória)

**Files:**
- Create: `central-rwa/supabase/migrations/20261015000001_atlas_mcp_oauth.sql`
- Create: `central-rwa/supabase/functions/atlas-mcp/store.mjs`
- Create: `central-rwa/supabase/functions/atlas-mcp/fakes.mjs`
- Test: `central-rwa/supabase/functions/atlas-mcp/store.test.mjs`

**Interfaces:**
- Produces (mesma interface em `criarStore` e `storeMemoria`):
  - `salvarCodigo({ hash, uid, clientId, redirectUri, challenge, segundos }): Promise<any>`
  - `consumirCodigo(hash): Promise<{ uid, clientId, redirectUri, challenge } | null>` (uso único, respeita validade)
  - `salvarToken({ hash, tipo: 'acesso'|'renovacao', uid, clientId, familia, segundos }): Promise<any>`
  - `buscarToken(hash, limite): Promise<{ status: 'ok'|'limite'|'invalido', uid?, clientId?, familia? }>` (só tipo acesso; conta chamadas por minuto)
  - `usarRenovacao(hash): Promise<{ status: 'ok'|'reuso'|'invalido', uid?, clientId?, familia? }>` (rotação; reuso revoga a família)
- `criarStore({ url, chave, fetcher })` em `store.mjs`; `storeMemoria(agora = () => Date.now())` em `fakes.mjs` (só testes, fora do bundle).

- [ ] **Step 1: Write the failing test**

```js
// central-rwa/supabase/functions/atlas-mcp/store.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarStore } from './store.mjs';
import { storeMemoria } from './fakes.mjs';

test('criarStore chama a RPC certa com a chave de serviço e mapeia as linhas', async () => {
  const chamadas = [];
  const fetcher = async (url, init) => {
    chamadas.push({ url, init });
    if (url.endsWith('atlas_mcp_buscar_token')) return Response.json([{ uid: 'u1', client_id: 'c', familia: 'f', status: 'ok' }]);
    if (url.endsWith('atlas_mcp_consumir_codigo')) return Response.json([]);
    if (url.endsWith('atlas_mcp_usar_renovacao')) return Response.json([{ uid: null, client_id: null, familia: null, status: 'reuso' }]);
    return Response.json(true);
  };
  const s = criarStore({ url: 'https://db/', chave: 'sb_secret_x', fetcher });
  assert.deepEqual(await s.buscarToken('h', 60), { uid: 'u1', clientId: 'c', familia: 'f', status: 'ok' });
  assert.equal(await s.consumirCodigo('h'), null);
  assert.equal((await s.usarRenovacao('h')).status, 'reuso');
  await s.salvarCodigo({ hash: 'h', uid: 'u', clientId: 'c', redirectUri: 'r', challenge: 'ch', segundos: 300 });
  assert.equal(chamadas[0].url, 'https://db/rest/v1/rpc/atlas_mcp_buscar_token');
  assert.deepEqual(JSON.parse(chamadas[0].init.body), { p_hash: 'h', p_limite: 60 });
  assert.equal(chamadas[0].init.headers.apikey, 'sb_secret_x');
  assert.equal(chamadas[0].init.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(chamadas[3].init.body), { p_hash: 'h', p_uid: 'u', p_client: 'c', p_redirect: 'r', p_challenge: 'ch', p_segundos: 300 });
});

test('chave JWT legada também vai no Authorization; erro HTTP vira exceção', async () => {
  let headers;
  const s = criarStore({ url: 'https://db', chave: 'eyJabc', fetcher: async (_u, init) => { headers = init.headers; return new Response('x', { status: 500 }); } });
  await assert.rejects(() => s.buscarToken('h', 60), /atlas_mcp_buscar_token 500/);
  assert.equal(headers.Authorization, 'Bearer eyJabc');
});

test('memória: código de uso único e com validade', async () => {
  let t = 1_000_000;
  const s = storeMemoria(() => t);
  await s.salvarCodigo({ hash: 'c1', uid: 'u', clientId: 'cl', redirectUri: 'r', challenge: 'ch', segundos: 300 });
  assert.equal((await s.consumirCodigo('c1')).uid, 'u');
  assert.equal(await s.consumirCodigo('c1'), null);
  await s.salvarCodigo({ hash: 'c2', uid: 'u', clientId: 'cl', redirectUri: 'r', challenge: 'ch', segundos: 300 });
  t += 301_000;
  assert.equal(await s.consumirCodigo('c2'), null);
});

test('memória: limite por minuto e rotação com detecção de reuso', async () => {
  let t = 0;
  const s = storeMemoria(() => t);
  await s.salvarToken({ hash: 'a', tipo: 'acesso', uid: 'u', clientId: 'c', familia: 'f', segundos: 3600 });
  await s.salvarToken({ hash: 'r', tipo: 'renovacao', uid: 'u', clientId: 'c', familia: 'f', segundos: 2592000 });
  for (let i = 0; i < 3; i++) assert.equal((await s.buscarToken('a', 3)).status, 'ok');
  assert.equal((await s.buscarToken('a', 3)).status, 'limite');
  t += 60_000;
  assert.equal((await s.buscarToken('a', 3)).status, 'ok');
  assert.equal((await s.buscarToken('r', 3)).status, 'invalido');
  assert.equal((await s.usarRenovacao('r')).status, 'ok');
  assert.equal((await s.usarRenovacao('r')).status, 'reuso');
  assert.equal((await s.buscarToken('a', 99)).status, 'invalido');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/store.test.mjs`
Expected: FAIL com `Cannot find module` para `./store.mjs`.

- [ ] **Step 3: Write the migration**

```sql
-- central-rwa/supabase/migrations/20261015000001_atlas_mcp_oauth.sql
-- Conector MCP do Atlas: códigos de autorização e tokens OAuth, guardados só com hash.
-- Só a Edge Function atlas-mcp (papel de serviço) usa as RPCs abaixo. Sem políticas RLS.
create schema if not exists atlas_mcp;
revoke all on schema atlas_mcp from public;

create table if not exists atlas_mcp.codigos (
  hash text primary key,
  uid text not null,
  client_id text not null,
  redirect_uri text not null,
  challenge text not null,
  expira timestamptz not null,
  usado boolean not null default false
);

create table if not exists atlas_mcp.tokens (
  hash text primary key,
  tipo text not null check (tipo in ('acesso', 'renovacao')),
  uid text not null,
  client_id text not null,
  familia text not null,
  expira timestamptz not null,
  revogado boolean not null default false,
  criado timestamptz not null default now(),
  minuto timestamptz,
  chamadas integer not null default 0
);
create index if not exists tokens_familia on atlas_mcp.tokens (familia);

alter table atlas_mcp.codigos enable row level security;
alter table atlas_mcp.tokens enable row level security;
revoke all on all tables in schema atlas_mcp from public;

create or replace function public.atlas_mcp_salvar_codigo(p_hash text, p_uid text, p_client text, p_redirect text, p_challenge text, p_segundos integer)
returns boolean language sql security definer set search_path = pg_catalog, atlas_mcp as $$
  insert into atlas_mcp.codigos (hash, uid, client_id, redirect_uri, challenge, expira)
  values (p_hash, p_uid, p_client, p_redirect, p_challenge, now() + make_interval(secs => least(p_segundos, 600)))
  returning true;
$$;

create or replace function public.atlas_mcp_consumir_codigo(p_hash text)
returns table (uid text, client_id text, redirect_uri text, challenge text)
language plpgsql security definer set search_path = pg_catalog, atlas_mcp as $$
#variable_conflict use_column
begin
  return query
    update atlas_mcp.codigos c set usado = true
    where c.hash = p_hash and not c.usado and c.expira > now()
    returning c.uid, c.client_id, c.redirect_uri, c.challenge;
end;
$$;

create or replace function public.atlas_mcp_salvar_token(p_hash text, p_tipo text, p_uid text, p_client text, p_familia text, p_segundos integer)
returns boolean language sql security definer set search_path = pg_catalog, atlas_mcp as $$
  insert into atlas_mcp.tokens (hash, tipo, uid, client_id, familia, expira)
  values (p_hash, p_tipo, p_uid, p_client, p_familia, now() + make_interval(secs => least(p_segundos, 2592000)))
  returning true;
$$;

create or replace function public.atlas_mcp_buscar_token(p_hash text, p_limite integer default 60)
returns table (uid text, client_id text, familia text, status text)
language plpgsql security definer set search_path = pg_catalog, atlas_mcp as $$
#variable_conflict use_column
declare
  t atlas_mcp.tokens%rowtype;
  agora_min timestamptz := date_trunc('minute', now());
begin
  select * into t from atlas_mcp.tokens where hash = p_hash and tipo = 'acesso' for update;
  if not found or t.revogado or t.expira <= now() then
    return query select null::text, null::text, null::text, 'invalido'::text; return;
  end if;
  if t.minuto is null or t.minuto < agora_min then
    update atlas_mcp.tokens set minuto = agora_min, chamadas = 1 where hash = p_hash;
  elsif t.chamadas >= p_limite then
    return query select t.uid, t.client_id, t.familia, 'limite'::text; return;
  else
    update atlas_mcp.tokens set chamadas = t.chamadas + 1 where hash = p_hash;
  end if;
  return query select t.uid, t.client_id, t.familia, 'ok'::text;
end;
$$;

create or replace function public.atlas_mcp_usar_renovacao(p_hash text)
returns table (uid text, client_id text, familia text, status text)
language plpgsql security definer set search_path = pg_catalog, atlas_mcp as $$
#variable_conflict use_column
declare t atlas_mcp.tokens%rowtype;
begin
  select * into t from atlas_mcp.tokens where hash = p_hash and tipo = 'renovacao' for update;
  if not found or t.expira <= now() then
    return query select null::text, null::text, null::text, 'invalido'::text; return;
  end if;
  if t.revogado then
    update atlas_mcp.tokens set revogado = true where familia = t.familia;
    return query select null::text, null::text, null::text, 'reuso'::text; return;
  end if;
  update atlas_mcp.tokens set revogado = true where hash = p_hash;
  return query select t.uid, t.client_id, t.familia, 'ok'::text;
end;
$$;

-- Revogação manual (sem tela até a fase 5): select public.atlas_mcp_revogar_uid('<uid>');
create or replace function public.atlas_mcp_revogar_uid(p_uid text)
returns integer language sql security definer set search_path = pg_catalog, atlas_mcp as $$
  with x as (update atlas_mcp.tokens set revogado = true where uid = p_uid and not revogado returning 1)
  select count(*)::integer from x;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'atlas_mcp_salvar_codigo(text, text, text, text, text, integer)',
    'atlas_mcp_consumir_codigo(text)',
    'atlas_mcp_salvar_token(text, text, text, text, text, integer)',
    'atlas_mcp_buscar_token(text, integer)',
    'atlas_mcp_usar_renovacao(text)',
    'atlas_mcp_revogar_uid(text)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function public.%s to service_role', f);
    end if;
  end loop;
end;
$$;
```

- [ ] **Step 4: Write the adapter and the in-memory fake**

```js
// central-rwa/supabase/functions/atlas-mcp/store.mjs
export function criarStore({ url, chave, fetcher }) {
  const raiz = String(url).replace(/\/$/, '');
  async function rpc(nome, args) {
    const headers = { apikey: chave, 'Content-Type': 'application/json' };
    if (String(chave).startsWith('eyJ')) headers.Authorization = 'Bearer ' + chave;
    const r = await fetcher(`${raiz}/rest/v1/rpc/${nome}`, { method: 'POST', headers, body: JSON.stringify(args), signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`rpc ${nome} ${r.status}`);
    return r.json();
  }
  const linha = (x) => (Array.isArray(x) ? x[0] : x) || null;
  const comoToken = (l) => (l ? { uid: l.uid, clientId: l.client_id, familia: l.familia, status: l.status } : { status: 'invalido' });
  return {
    salvarCodigo: (c) => rpc('atlas_mcp_salvar_codigo', { p_hash: c.hash, p_uid: c.uid, p_client: c.clientId, p_redirect: c.redirectUri, p_challenge: c.challenge, p_segundos: c.segundos }),
    async consumirCodigo(hash) {
      const l = linha(await rpc('atlas_mcp_consumir_codigo', { p_hash: hash }));
      return l && l.uid ? { uid: l.uid, clientId: l.client_id, redirectUri: l.redirect_uri, challenge: l.challenge } : null;
    },
    salvarToken: (t) => rpc('atlas_mcp_salvar_token', { p_hash: t.hash, p_tipo: t.tipo, p_uid: t.uid, p_client: t.clientId, p_familia: t.familia, p_segundos: t.segundos }),
    buscarToken: async (hash, limite) => comoToken(linha(await rpc('atlas_mcp_buscar_token', { p_hash: hash, p_limite: limite }))),
    usarRenovacao: async (hash) => comoToken(linha(await rpc('atlas_mcp_usar_renovacao', { p_hash: hash }))),
  };
}
```

```js
// central-rwa/supabase/functions/atlas-mcp/fakes.mjs
// Só para testes. Mesmo comportamento das RPCs da migração 20261015000001.
export function storeMemoria(agora = () => Date.now()) {
  const codigos = new Map(), tokens = new Map();
  return {
    codigos, tokens,
    async salvarCodigo(c) { codigos.set(c.hash, { ...c, expira: agora() + c.segundos * 1000, usado: false }); return true; },
    async consumirCodigo(hash) {
      const c = codigos.get(hash);
      if (!c || c.usado || c.expira <= agora()) return null;
      c.usado = true;
      return { uid: c.uid, clientId: c.clientId, redirectUri: c.redirectUri, challenge: c.challenge };
    },
    async salvarToken(t) { tokens.set(t.hash, { ...t, expira: agora() + t.segundos * 1000, revogado: false, minuto: null, chamadas: 0 }); return true; },
    async buscarToken(hash, limite) {
      const t = tokens.get(hash);
      if (!t || t.tipo !== 'acesso' || t.revogado || t.expira <= agora()) return { status: 'invalido' };
      const m = Math.floor(agora() / 60000);
      if (t.minuto !== m) { t.minuto = m; t.chamadas = 1; }
      else if (t.chamadas >= limite) return { uid: t.uid, clientId: t.clientId, familia: t.familia, status: 'limite' };
      else t.chamadas++;
      return { uid: t.uid, clientId: t.clientId, familia: t.familia, status: 'ok' };
    },
    async usarRenovacao(hash) {
      const t = tokens.get(hash);
      if (!t || t.tipo !== 'renovacao' || t.expira <= agora()) return { status: 'invalido' };
      if (t.revogado) { for (const x of tokens.values()) if (x.familia === t.familia) x.revogado = true; return { status: 'reuso' }; }
      t.revogado = true;
      return { uid: t.uid, clientId: t.clientId, familia: t.familia, status: 'ok' };
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/store.test.mjs`
Expected: PASS (4 testes). A migração é aplicada e conferida no SQL Editor na Task 11.

- [ ] **Step 6: Commit**

```bash
git add central-rwa/supabase/migrations/20261015000001_atlas_mcp_oauth.sql central-rwa/supabase/functions/atlas-mcp/store.mjs central-rwa/supabase/functions/atlas-mcp/fakes.mjs central-rwa/supabase/functions/atlas-mcp/store.test.mjs
git commit -m "atlas-mcp: tabelas e RPCs de códigos e tokens OAuth, com adaptador"
```

---

### Task 4: OAuth (metadados, registro, autorização, token, autenticação)

**Files:**
- Create: `central-rwa/supabase/functions/atlas-mcp/oauth.mjs`
- Test: `central-rwa/supabase/functions/atlas-mcp/oauth.test.mjs`

**Interfaces:**
- Consumes: `aleatorio`, `sha256b64url`, `pkceConfere`, `assinar`, `verificar` (Task 1); store da Task 3.
- Produces:
  - `REDIRECTS: string[]`
  - `metadadosRecurso(base): object` e `metadadosServidor(base): object`
  - `registrar(corpo, { segredo }): Promise<{ status, corpo }>`
  - `autorizar(params: URLSearchParams, { segredo, pagina, agora }): Promise<{ status: 302, local } | { status: 400, texto }>`
  - `concluir(corpo, { segredo, store, fetcher, chaveWeb, permitidos }): Promise<{ status, corpo }>` → sucesso `{ redirect }`
  - `trocarToken(form: URLSearchParams, { store }): Promise<{ status, corpo }>`
  - `autenticar(cabecalho: string|null, { store, limite = 60 }): Promise<{ status: 200, uid } | { status: 401|429 }>`

- [ ] **Step 1: Write the failing test**

```js
// central-rwa/supabase/functions/atlas-mcp/oauth.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { REDIRECTS, metadadosRecurso, metadadosServidor, registrar, autorizar, concluir, trocarToken, autenticar } from './oauth.mjs';
import { storeMemoria } from './fakes.mjs';
import { aleatorio } from './crypto.mjs';

const SEG = 'k'.repeat(40);
const BASE = 'https://ref.supabase.co/functions/v1/atlas-mcp';
const PAGINA = 'https://juniordezzz-cell.github.io/atlas/pages/conectar-claude.html';
const CB = REDIRECTS[0];
const firebase = (usuario) => async (url) => {
  assert.match(String(url), /accounts:lookup\?key=chave-web$/);
  return Response.json({ users: usuario ? [usuario] : [] });
};
const DONO = { localId: 'uidDono', email: 'juniordezzz@gmail.com', emailVerified: true };

async function fluxoAteCodigo({ store, usuario = DONO, agora = () => Date.now() } = {}) {
  const reg = await registrar({ redirect_uris: [CB], client_name: 'Claude' }, { segredo: SEG });
  const verifier = aleatorio(48);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const q = new URLSearchParams({ response_type: 'code', client_id: reg.corpo.client_id, redirect_uri: CB, code_challenge: challenge, code_challenge_method: 'S256', state: 'st1' });
  const a = await autorizar(q, { segredo: SEG, pagina: PAGINA, agora });
  const req = new URL(a.local).searchParams.get('req');
  const c = await concluir({ req, idToken: 'tok.fire-base_1' }, { segredo: SEG, store, fetcher: firebase(usuario), chaveWeb: 'chave-web', permitidos: ['juniordezzz@gmail.com'] });
  return { reg, verifier, a, c };
}
const form = (o) => new URLSearchParams(o);

test('metadados apontam para a própria função', () => {
  assert.deepEqual(metadadosRecurso(BASE).authorization_servers, [BASE]);
  assert.equal(metadadosRecurso(BASE).resource, BASE + '/mcp');
  const s = metadadosServidor(BASE);
  assert.equal(s.issuer, BASE);
  assert.equal(s.token_endpoint, BASE + '/token');
  assert.deepEqual(s.code_challenge_methods_supported, ['S256']);
});

test('registro aceita só os callbacks do Claude', async () => {
  assert.equal((await registrar({ redirect_uris: ['https://evil.example/cb'] }, { segredo: SEG })).status, 400);
  assert.equal((await registrar({}, { segredo: SEG })).status, 400);
  assert.equal((await registrar(undefined, { segredo: SEG })).status, 400);
  const ok = await registrar({ redirect_uris: REDIRECTS }, { segredo: SEG });
  assert.equal(ok.status, 201);
  assert.equal(ok.corpo.token_endpoint_auth_method, 'none');
});

test('autorizar recusa cliente adulterado, redirect diferente e falta de PKCE', async () => {
  const reg = await registrar({ redirect_uris: [CB] }, { segredo: SEG });
  const base = { response_type: 'code', client_id: reg.corpo.client_id, redirect_uri: CB, code_challenge: 'a'.repeat(43), code_challenge_method: 'S256' };
  const dep = { segredo: SEG, pagina: PAGINA, agora: () => Date.now() };
  assert.equal((await autorizar(new URLSearchParams({ ...base, client_id: reg.corpo.client_id + 'x' }), dep)).status, 400);
  assert.equal((await autorizar(new URLSearchParams({ ...base, redirect_uri: REDIRECTS[1] }), dep)).status, 400);
  assert.equal((await autorizar(new URLSearchParams({ ...base, code_challenge_method: 'plain' }), dep)).status, 400);
  const ok = await autorizar(new URLSearchParams(base), dep);
  assert.equal(ok.status, 302);
  assert.ok(ok.local.startsWith(PAGINA + '?req='));
});

test('concluir: pedido vencido, e-mail fora da lista e e-mail não verificado', async () => {
  const store = storeMemoria();
  const velho = await fluxoAteCodigo({ store, agora: () => Date.now() - 11 * 60000 });
  assert.equal(velho.c.status, 400);
  assert.equal((await fluxoAteCodigo({ store, usuario: { ...DONO, email: 'outro@gmail.com' } })).c.status, 403);
  assert.equal((await fluxoAteCodigo({ store, usuario: { ...DONO, emailVerified: false } })).c.status, 403);
  assert.equal((await fluxoAteCodigo({ store, usuario: null })).c.status, 401);
  assert.equal(store.codigos.size, 0);
});

test('fluxo completo: código vira tokens; código não reaproveita; PKCE errado falha', async () => {
  const store = storeMemoria();
  const { reg, verifier, c } = await fluxoAteCodigo({ store });
  assert.equal(c.status, 200);
  const destino = new URL(c.corpo.redirect);
  assert.equal(destino.origin + destino.pathname, CB);
  assert.equal(destino.searchParams.get('state'), 'st1');
  const code = destino.searchParams.get('code');
  const pedido = { grant_type: 'authorization_code', code, client_id: reg.corpo.client_id, redirect_uri: CB };
  const ruim = await trocarToken(form({ ...pedido, code_verifier: aleatorio(48) }), { store });
  assert.equal(ruim.corpo.error, 'invalid_grant');
  const outro = await fluxoAteCodigo({ store });
  const code2 = new URL(outro.c.corpo.redirect).searchParams.get('code');
  const t = await trocarToken(form({ ...pedido, code: code2, client_id: outro.reg.corpo.client_id, code_verifier: outro.verifier }), { store });
  assert.equal(t.status, 200);
  assert.equal(t.corpo.token_type, 'Bearer');
  assert.equal(t.corpo.expires_in, 3600);
  const de_novo = await trocarToken(form({ ...pedido, code: code2, client_id: outro.reg.corpo.client_id, code_verifier: outro.verifier }), { store });
  assert.equal(de_novo.status, 400);
  assert.deepEqual(await autenticar('Bearer ' + t.corpo.access_token, { store }), { status: 200, uid: 'uidDono' });
});

test('renovação gira o token e reuso derruba a família inteira', async () => {
  const store = storeMemoria();
  const { reg, verifier, c } = await fluxoAteCodigo({ store });
  const code = new URL(c.corpo.redirect).searchParams.get('code');
  const t1 = (await trocarToken(form({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: reg.corpo.client_id, redirect_uri: CB }), { store })).corpo;
  const r = form({ grant_type: 'refresh_token', refresh_token: t1.refresh_token, client_id: reg.corpo.client_id });
  const t2 = await trocarToken(r, { store });
  assert.equal(t2.status, 200);
  assert.notEqual(t2.corpo.access_token, t1.access_token);
  assert.equal((await trocarToken(r, { store })).status, 400);
  assert.equal((await autenticar('Bearer ' + t2.corpo.access_token, { store })).status, 401);
  assert.equal((await trocarToken(form({ grant_type: 'password' }), { store })).corpo.error, 'unsupported_grant_type');
});

test('autenticar: sem cabeçalho, token desconhecido e limite por minuto', async () => {
  const store = storeMemoria();
  assert.equal((await autenticar(null, { store })).status, 401);
  assert.equal((await autenticar('Bearer ' + aleatorio(), { store })).status, 401);
  await store.salvarToken({ hash: createHash('sha256').update('t'.repeat(43)).digest('base64url'), tipo: 'acesso', uid: 'u', clientId: 'c', familia: 'f', segundos: 3600 });
  assert.equal((await autenticar('Bearer ' + 't'.repeat(43), { store, limite: 1 })).status, 200);
  assert.equal((await autenticar('Bearer ' + 't'.repeat(43), { store, limite: 1 })).status, 429);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/oauth.test.mjs`
Expected: FAIL com `Cannot find module` para `./oauth.mjs`.

- [ ] **Step 3: Write minimal implementation**

```js
// central-rwa/supabase/functions/atlas-mcp/oauth.mjs
import { aleatorio, sha256b64url, pkceConfere, assinar, verificar } from './crypto.mjs';

export const REDIRECTS = ['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback'];
const FIREBASE_LOOKUP = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=';
const PEDIDO_MS = 10 * 60000;

export function metadadosRecurso(base) {
  return { resource: base + '/mcp', authorization_servers: [base], bearer_methods_supported: ['header'], resource_name: 'Atlas' };
}

export function metadadosServidor(base) {
  return {
    issuer: base,
    authorization_endpoint: base + '/authorize',
    token_endpoint: base + '/token',
    registration_endpoint: base + '/register',
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  };
}

export async function registrar(corpo, { segredo }) {
  const uris = corpo?.redirect_uris;
  if (!Array.isArray(uris) || !uris.length || uris.length > 4 || !uris.every((u) => REDIRECTS.includes(u))) {
    return { status: 400, corpo: { error: 'invalid_redirect_uri', error_description: 'Só o Claude pode se registrar neste conector.' } };
  }
  const nome = String(corpo.client_name || 'Claude').slice(0, 80);
  const client_id = await assinar({ r: uris, n: nome }, segredo);
  return { status: 201, corpo: { client_id, client_name: nome, redirect_uris: uris, grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' } };
}

export async function autorizar(params, { segredo, pagina, agora }) {
  const clientId = params.get('client_id');
  const cliente = await verificar(clientId, segredo);
  const redirect = params.get('redirect_uri');
  if (!cliente || !Array.isArray(cliente.r) || !cliente.r.includes(redirect)) {
    return { status: 400, texto: 'Cliente ou endereço de retorno inválido. Remova e adicione o conector de novo no Claude.' };
  }
  const challenge = params.get('code_challenge') || '';
  if (params.get('response_type') !== 'code' || params.get('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
    return { status: 400, texto: 'Pedido de autorização incompleto: PKCE S256 é obrigatório.' };
  }
  const req = await assinar({ c: clientId, r: redirect, ch: challenge, s: params.get('state') || '', exp: agora() + PEDIDO_MS }, segredo);
  return { status: 302, local: pagina + '?req=' + encodeURIComponent(req) };
}

export async function concluir(corpo, { segredo, store, fetcher, chaveWeb, permitidos }) {
  const pedido = await verificar(corpo?.req, segredo);
  if (!pedido || !pedido.c || !pedido.r || !pedido.ch) return { status: 400, corpo: { error: 'O pedido expirou. Volte ao Claude e conecte de novo.' } };
  if (typeof corpo.idToken !== 'string' || !/^[A-Za-z0-9._-]+$/.test(corpo.idToken)) return { status: 401, corpo: { error: 'Entre no Atlas para autorizar.' } };
  let user;
  try {
    const r = await fetcher(FIREBASE_LOOKUP + chaveWeb, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: corpo.idToken }), signal: AbortSignal.timeout(10000) });
    if (!r.ok) return { status: 401, corpo: { error: 'Sessão expirada. Entre de novo.' } };
    user = (await r.json()).users?.[0];
  } catch { return { status: 503, corpo: { error: 'Não consegui validar a sessão. Tente de novo.' } }; }
  if (!user?.localId) return { status: 401, corpo: { error: 'Sessão inválida. Entre de novo.' } };
  if (!permitidos.includes(String(user.email || '').toLowerCase()) || ![true, 'true'].includes(user.emailVerified)) {
    return { status: 403, corpo: { error: 'Esta conta não tem permissão para conectar o Claude ao Atlas.' } };
  }
  const code = aleatorio();
  await store.salvarCodigo({ hash: await sha256b64url(code), uid: String(user.localId), clientId: pedido.c, redirectUri: pedido.r, challenge: pedido.ch, segundos: 300 });
  const q = new URLSearchParams({ code });
  if (pedido.s) q.set('state', pedido.s);
  return { status: 200, corpo: { redirect: pedido.r + '?' + q } };
}

async function emitirTokens(store, uid, clientId, familia) {
  const acesso = aleatorio(), renovacao = aleatorio();
  await store.salvarToken({ hash: await sha256b64url(acesso), tipo: 'acesso', uid, clientId, familia, segundos: 3600 });
  await store.salvarToken({ hash: await sha256b64url(renovacao), tipo: 'renovacao', uid, clientId, familia, segundos: 2592000 });
  return { access_token: acesso, token_type: 'Bearer', expires_in: 3600, refresh_token: renovacao };
}

const concessaoNegada = (descricao) => ({ status: 400, corpo: { error: 'invalid_grant', error_description: descricao } });

export async function trocarToken(form, { store }) {
  const tipo = form.get('grant_type'), clientId = form.get('client_id') || '';
  if (tipo === 'authorization_code') {
    const code = form.get('code');
    if (!code) return concessaoNegada('Código ausente.');
    const c = await store.consumirCodigo(await sha256b64url(code));
    if (!c || c.clientId !== clientId || c.redirectUri !== form.get('redirect_uri')) return concessaoNegada('Código inválido, já usado ou vencido.');
    if (!(await pkceConfere(form.get('code_verifier'), c.challenge))) return concessaoNegada('PKCE não confere.');
    return { status: 200, corpo: await emitirTokens(store, c.uid, c.clientId, aleatorio(16)) };
  }
  if (tipo === 'refresh_token') {
    const rt = form.get('refresh_token');
    if (!rt) return concessaoNegada('Token de renovação ausente.');
    const r = await store.usarRenovacao(await sha256b64url(rt));
    if (r.status !== 'ok' || r.clientId !== clientId) return concessaoNegada('Token de renovação inválido.');
    return { status: 200, corpo: await emitirTokens(store, r.uid, r.clientId, r.familia) };
  }
  return { status: 400, corpo: { error: 'unsupported_grant_type' } };
}

export async function autenticar(cabecalho, { store, limite = 60 }) {
  const t = String(cabecalho || '').match(/^Bearer ([A-Za-z0-9_-]{20,})$/)?.[1];
  if (!t) return { status: 401 };
  const r = await store.buscarToken(await sha256b64url(t), limite);
  if (r.status === 'ok') return { status: 200, uid: r.uid };
  return { status: r.status === 'limite' ? 429 : 401 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/oauth.test.mjs`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add central-rwa/supabase/functions/atlas-mcp/oauth.mjs central-rwa/supabase/functions/atlas-mcp/oauth.test.mjs
git commit -m "atlas-mcp: OAuth com PKCE, login Firebase do Atlas e rotação de tokens"
```

---

### Task 5: Leitura do Firestore por conta de serviço

**Files:**
- Create: `central-rwa/supabase/functions/atlas-mcp/firestore.mjs`
- Test: `central-rwa/supabase/functions/atlas-mcp/firestore.test.mjs`

**Interfaces:**
- Consumes: `b64url` (Task 1).
- Produces:
  - `docIdFirestore(chave: string): string` (`"atlas.hold.state.v2"` → `"atlas__hold__state__v2"`)
  - `criarFirestore({ contaServico: string|object, fetcher, agora = () => Date.now() })` → `{ lerChave(uid, chave): Promise<{ valor: any|null, atualizado: string|null, corrompido?: true }> }`
  - Lança `Error` se a conta de serviço estiver incompleta, se `uid` não for alfanumérico (1–128) ou se a chave não começar com `atlas.`.

- [ ] **Step 1: Write the failing test**

```js
// central-rwa/supabase/functions/atlas-mcp/firestore.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { criarFirestore, docIdFirestore } from './firestore.mjs';

const par = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', par.privateKey));
const pem = '-----BEGIN PRIVATE KEY-----\n' + Buffer.from(der).toString('base64').match(/.{1,64}/g).join('\n') + '\n-----END PRIVATE KEY-----\n';
const CONTA = { project_id: 'cryptotrack-br', client_email: 'atlas-mcp@cryptotrack-br.iam.gserviceaccount.com', private_key: pem };
const b64 = (s) => Buffer.from(s, 'base64url');

function servidorFalso() {
  const log = { tokens: 0, docs: [] };
  const docs = {
    atlas__hold__state__v2: { fields: { value: { stringValue: JSON.stringify({ carteira: [1] }) }, updatedAt: { timestampValue: '2026-10-15T12:00:00Z' } } },
    atlas__wallets__v2: { fields: { value: { stringValue: '{quebrado' } } },
  };
  const fetcher = async (url, init) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      log.tokens++;
      const jwt = new URLSearchParams(String(init.body)).get('assertion');
      const [cab, corpo, sig] = jwt.split('.');
      const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', par.publicKey, b64(sig), new TextEncoder().encode(cab + '.' + corpo));
      assert.equal(ok, true);
      const claims = JSON.parse(b64(corpo).toString());
      assert.equal(claims.iss, CONTA.client_email);
      assert.equal(claims.scope, 'https://www.googleapis.com/auth/datastore');
      return Response.json({ access_token: 'ya29.teste', expires_in: 3600 });
    }
    log.docs.push(url);
    assert.equal(init.headers.Authorization, 'Bearer ya29.teste');
    const id = url.split('/').pop();
    return docs[id] ? Response.json(docs[id]) : new Response('{}', { status: 404 });
  };
  return { log, fetcher };
}

test('docId troca pontos por dois sublinhados', () => {
  assert.equal(docIdFirestore('atlas.hold.state.v2'), 'atlas__hold__state__v2');
});

test('lê, interpreta o valor e reaproveita o token Google', async () => {
  const { log, fetcher } = servidorFalso();
  const fs = criarFirestore({ contaServico: JSON.stringify(CONTA), fetcher });
  const r = await fs.lerChave('uidDono123', 'atlas.hold.state.v2');
  assert.deepEqual(r, { valor: { carteira: [1] }, atualizado: '2026-10-15T12:00:00Z' });
  assert.equal(log.docs[0], 'https://firestore.googleapis.com/v1/projects/cryptotrack-br/databases/(default)/documents/atlas_users/uidDono123/store/atlas__hold__state__v2');
  await fs.lerChave('uidDono123', 'atlas.caixa.v1');
  assert.equal(log.tokens, 1);
});

test('chave ausente devolve null; JSON quebrado avisa sem lançar', async () => {
  const { fetcher } = servidorFalso();
  const fs = criarFirestore({ contaServico: CONTA, fetcher });
  assert.deepEqual(await fs.lerChave('uidDono123', 'atlas.caixa.v1'), { valor: null, atualizado: null });
  const q = await fs.lerChave('uidDono123', 'atlas.wallets.v2');
  assert.equal(q.valor, null);
  assert.equal(q.corrompido, true);
});

test('recusa uid ou chave fora do padrão e conta incompleta', async () => {
  const { fetcher } = servidorFalso();
  const fs = criarFirestore({ contaServico: CONTA, fetcher });
  await assert.rejects(() => fs.lerChave('../outro', 'atlas.hold.state.v2'), /uid inválido/);
  await assert.rejects(() => fs.lerChave('uidDono123', 'mundodefi.coisa'), /chave inválida/);
  assert.throws(() => criarFirestore({ contaServico: { project_id: 'x' }, fetcher }), /Conta de serviço incompleta/);
  assert.throws(() => criarFirestore({ contaServico: undefined, fetcher }), /Conta de serviço incompleta/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/firestore.test.mjs`
Expected: FAIL com `Cannot find module` para `./firestore.mjs`.

- [ ] **Step 3: Write minimal implementation**

```js
// central-rwa/supabase/functions/atlas-mcp/firestore.mjs
import { b64url } from './crypto.mjs';

const codificador = new TextEncoder();

function pemParaDer(pem) {
  const corpo = String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(corpo), (c) => c.charCodeAt(0));
}

export function docIdFirestore(chave) {
  return String(chave).replace(/\./g, '__');
}

export function criarFirestore({ contaServico, fetcher, agora = () => Date.now() }) {
  let conta = null;
  try { conta = typeof contaServico === 'string' ? JSON.parse(contaServico) : contaServico; } catch { conta = null; }
  if (!conta?.client_email || !conta?.private_key || !conta?.project_id) throw new Error('Conta de serviço incompleta.');
  let cache = null;

  async function tokenGoogle() {
    if (cache && cache.exp - 60000 > agora()) return cache.token;
    const iat = Math.floor(agora() / 1000);
    const cab = b64url(codificador.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
    const corpo = b64url(codificador.encode(JSON.stringify({ iss: conta.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 })));
    const chave = await crypto.subtle.importKey('pkcs8', pemParaDer(conta.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, codificador.encode(cab + '.' + corpo)));
    const r = await fetcher('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${cab}.${corpo}.${b64url(sig)}` }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error('token google ' + r.status);
    const j = await r.json();
    cache = { token: j.access_token, exp: agora() + (Number(j.expires_in) || 3600) * 1000 };
    return cache.token;
  }

  async function lerChave(uid, chave) {
    if (!/^[A-Za-z0-9]{1,128}$/.test(String(uid))) throw new Error('uid inválido');
    if (!/^atlas\.[a-z0-9.]+$/.test(String(chave))) throw new Error('chave inválida');
    const url = `https://firestore.googleapis.com/v1/projects/${conta.project_id}/databases/(default)/documents/atlas_users/${uid}/store/${docIdFirestore(chave)}`;
    const r = await fetcher(url, { headers: { Authorization: 'Bearer ' + (await tokenGoogle()) }, signal: AbortSignal.timeout(8000) });
    if (r.status === 404) return { valor: null, atualizado: null };
    if (!r.ok) throw new Error('firestore ' + r.status);
    const d = await r.json();
    const bruto = d.fields?.value?.stringValue;
    const atualizado = d.fields?.updatedAt?.timestampValue || d.updateTime || null;
    if (typeof bruto !== 'string') return { valor: null, atualizado };
    try { return { valor: JSON.parse(bruto), atualizado }; } catch { return { valor: null, atualizado, corrompido: true }; }
  }

  return { lerChave };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/firestore.test.mjs`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add central-rwa/supabase/functions/atlas-mcp/firestore.mjs central-rwa/supabase/functions/atlas-mcp/firestore.test.mjs
git commit -m "atlas-mcp: leitura do Firestore por conta de serviço, restrita a atlas_users/{uid}"
```

---

### Task 6: Contas de leitura (carteiras, Hold, caixa, histórico)

**Files:**
- Create: `central-rwa/supabase/functions/atlas-mcp/leitura.mjs`
- Test: `central-rwa/supabase/functions/atlas-mcp/leitura.test.mjs`

Formatos lidos (iguais aos do site):
- `atlas.wallets.v2`: `{ wallets: [{ id, name, type, module }] }` — sem nada, existe só `principal`.
- `atlas.hold.state.v2`: `{ ativos: [{ id, ticker, nome, preco_atual }], carteira: [{ ativo_id, walletId?, quantidade, preco_medio }], vendas: [{ ativo_id, walletId?, resultado }], operacoes: [{ id, tipo: 'buy'|'sell', ativo_id, walletId, quantidade, preco, valorCaixa, data, eventos: [idCaixa] }] }`. Posição sem `walletId` é da `principal` (`hold/js/state.js:81`).
- `atlas.caixa.v1`: array de eventos `{ id, data, tipo, valorUSD, ativo, ativoDestino?, walletId, contraWalletId?, qtd? }` com efeito por tipo de `wallets/walletCaixa.js:55-62`: deposito +1, saque −1, transferencia −1 na origem e +1 no destino, swap 0, aporte −1, retorno +1.

**Interfaces:**
- Consumes: `ErroUsuario` (Task 2).
- Produces (todas puras; cada uma devolve `{ texto: string, dados: object }`, exceto as auxiliares):
  - `normalizarTexto(s): string`
  - `resolverCarteira(estadoCarteiras, nome?): { id, name, ... } | null` (null quando `nome` vazio; `ErroUsuario` se não achar ou se for ambíguo)
  - `posicoes(hold): Array<{ walletId, ativoId, ticker, nome, quantidade, precoMedio, custo, preco: number|null, valor: number|null, resultado: number|null }>`
  - `saldosCaixa(eventos): Record<walletId, number>`
  - `listarCarteiras({ carteiras, hold, caixa })`
  - `verPosicoes({ carteiras, hold }, { carteira?, token? })`
  - `verCaixa({ carteiras, caixa }, { carteira? })`
  - `historico({ carteiras, hold, caixa }, { carteira?, token?, desde?, limite? })`

- [ ] **Step 1: Write the failing test**

```js
// central-rwa/supabase/functions/atlas-mcp/leitura.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarTexto, resolverCarteira, posicoes, saldosCaixa, listarCarteiras, verPosicoes, verCaixa, historico } from './leitura.mjs';
import { ErroUsuario } from './mcp.mjs';

const carteiras = { wallets: [
  { id: 'principal', name: 'Principal', type: 'global' },
  { id: 'w_bin', name: 'Binance', type: 'isolada', module: 'hold' },
  { id: 'w_jrb', name: 'JRB1', type: 'isolada', module: 'hold' },
] };
const hold = {
  ativos: [
    { id: 'a_pyth', ticker: 'PYTH', nome: 'Pyth Network', preco_atual: 0.1 },
    { id: 'a_jup', ticker: 'JUP', nome: 'Jupiter', preco_atual: 0.3 },
    { id: 'a_met', ticker: 'MET', nome: 'Meteora', preco_atual: 0 },
  ],
  carteira: [
    { ativo_id: 'a_pyth', walletId: 'w_bin', quantidade: 100, preco_medio: 0.05 },
    { ativo_id: 'a_pyth', walletId: 'w_jrb', quantidade: 20, preco_medio: 0.08 },
    { ativo_id: 'a_jup', quantidade: 10, preco_medio: 0.4 },
    { ativo_id: 'a_met', walletId: 'w_jrb', quantidade: 21, preco_medio: 0.2 },
    { ativo_id: 'a_jup', walletId: 'w_bin', quantidade: 0, preco_medio: 0.4 },
  ],
  vendas: [{ ativo_id: 'a_pyth', walletId: 'w_bin', resultado: 2.5 }],
  operacoes: [
    { id: 'op1', tipo: 'buy', ativo_id: 'a_pyth', walletId: 'w_bin', quantidade: 100, preco: 0.05, valorCaixa: 5, data: '2026-10-01', eventos: ['cx2'] },
    { id: 'op2', tipo: 'sell', ativo_id: 'a_pyth', walletId: 'w_bin', quantidade: 50, preco: 0.1, valorCaixa: 5, data: '2026-10-10', eventos: [] },
  ],
};
const caixa = [
  { id: 'cx1', data: '2026-09-30', tipo: 'deposito', valorUSD: 100, ativo: 'USDT', walletId: 'w_bin' },
  { id: 'cx2', data: '2026-10-01', tipo: 'aporte', valorUSD: 5, ativo: 'USDT', walletId: 'w_bin' },
  { id: 'cx3', data: '2026-10-05', tipo: 'transferencia', valorUSD: 20, ativo: 'USDT', walletId: 'w_bin', contraWalletId: 'w_jrb' },
  { id: 'cx4', data: '2026-10-06', tipo: 'saque', valorUSD: -3, ativo: 'USDT', walletId: 'w_bin' },
  { id: 'cx5', data: '2026-10-07', tipo: 'inventado', valorUSD: 9, walletId: 'w_bin' },
];

test('normaliza acentos, espaços e caixa', () => {
  assert.equal(normalizarTexto('  Binânce '), 'binance');
});

test('resolve carteira por nome ou id com qualquer grafia', () => {
  assert.equal(resolverCarteira(carteiras, 'binance').id, 'w_bin');
  assert.equal(resolverCarteira(carteiras, ' JRB1 ').id, 'w_jrb');
  assert.equal(resolverCarteira(carteiras, 'Binânce').id, 'w_bin');
  assert.equal(resolverCarteira(carteiras, 'w_jrb').id, 'w_jrb');
  assert.equal(resolverCarteira(carteiras, undefined), null);
  assert.equal(resolverCarteira(carteiras, '  '), null);
  assert.throws(() => resolverCarteira(carteiras, 'OKX'), (e) => e instanceof ErroUsuario && /Principal, Binance, JRB1/.test(e.message));
  const duplicada = { wallets: [{ id: 'a', name: 'X' }, { id: 'b', name: 'x' }] };
  assert.throws(() => resolverCarteira(duplicada, 'x'), /Use o id: a, b/);
  assert.equal(resolverCarteira(null, 'principal').id, 'principal');
});

test('posições: sem walletId é principal; quantidade zero some; sem preço não vira zero', () => {
  const p = posicoes(hold);
  assert.equal(p.length, 4);
  assert.equal(p.find((x) => x.ticker === 'JUP').walletId, 'principal');
  const met = p.find((x) => x.ticker === 'MET');
  assert.equal(met.preco, null);
  assert.equal(met.valor, null);
  assert.equal(met.resultado, null);
  assert.deepEqual(posicoes(undefined), []);
});

test('caixa soma eventos válidos com o efeito de cada tipo', () => {
  assert.deepEqual(saldosCaixa(caixa), { w_bin: 75, w_jrb: 20 });
  assert.deepEqual(saldosCaixa(null), {});
});

test('ver_posicoes por carteira e consolidado, com sem-preço fora do total', () => {
  const bin = verPosicoes({ carteiras, hold }, { carteira: 'binance' });
  assert.equal(bin.dados.total, 10);
  assert.equal(bin.dados.realizado, 2.5);
  assert.match(bin.texto, /PYTH: 100 · preço médio \$ 0,05 · valor \$ 10,00 · resultado \+\$ 5,00/);
  const tudo = verPosicoes({ carteiras, hold }, {});
  const pyth = tudo.dados.posicoes.find((x) => x.ticker === 'PYTH');
  assert.equal(pyth.quantidade, 120);
  assert.equal(Math.round(pyth.precoMedio * 10000) / 10000, 0.055);
  assert.deepEqual(pyth.carteiras, ['w_bin', 'w_jrb']);
  assert.deepEqual(tudo.dados.semPreco, ['MET']);
  assert.equal(tudo.dados.total, 15);
  assert.match(tudo.texto, /Fora do total por falta de preço: MET/);
  const pythSo = verPosicoes({ carteiras, hold }, { token: 'pyth' });
  assert.deepEqual(pythSo.dados.posicoes.map((x) => x.ticker), ['PYTH']);
  assert.match(verPosicoes({ carteiras, hold: null }, { carteira: 'JRB1' }).texto, /Nenhuma posição no Hold na JRB1/);
});

test('ver_caixa mostra saldo em dólar e últimos movimentos da carteira', () => {
  const r = verCaixa({ carteiras, caixa }, { carteira: 'JRB1' });
  assert.equal(r.dados.total, 20);
  assert.match(r.texto, /JRB1: \$ 20,00/);
  assert.match(r.texto, /2026-10-05 · Transferência · USDT · \$ 20,00 \(Binance → JRB1\)/);
  const todas = verCaixa({ carteiras, caixa }, {});
  assert.deepEqual(todas.dados.saldos, { principal: 0, w_bin: 75, w_jrb: 20 });
});

test('historico junta Hold e caixa, sem repetir o aporte de uma compra', () => {
  const r = historico({ carteiras, hold, caixa }, { carteira: 'Binance' });
  assert.deepEqual(r.dados.itens.map((i) => i.data + ' ' + i.rotulo), [
    '2026-10-10 Venda', '2026-10-05 Transferência', '2026-10-01 Compra', '2026-09-30 Depósito',
  ]);
  assert.equal(historico({ carteiras, hold, caixa }, { token: 'PYTH', desde: '2026-10-05' }).dados.itens.length, 1);
  assert.equal(historico({ carteiras, hold, caixa }, { limite: 2 }).dados.itens.length, 2);
  assert.throws(() => historico({ carteiras, hold, caixa }, { desde: '05/10/2026' }), ErroUsuario);
  assert.throws(() => historico({ carteiras, hold, caixa }, { limite: 0 }), ErroUsuario);
  assert.equal(historico({ carteiras, hold: null, caixa: null }, {}).texto, 'Nenhuma operação encontrada com esses filtros.');
});

test('listar_carteiras resume caixa e Hold por carteira', () => {
  const r = listarCarteiras({ carteiras, hold, caixa });
  const jrb = r.dados.carteiras.find((w) => w.id === 'w_jrb');
  assert.deepEqual({ caixa: jrb.caixa, hold: jrb.hold, posicoes: jrb.posicoes }, { caixa: 20, hold: 2, posicoes: 2 });
  assert.match(r.texto, /Binance \(id w_bin\): caixa \$ 75,00 · Hold \$ 10,00 em 1 posição\(ões\)/);
  assert.equal(listarCarteiras({ carteiras: null, hold: null, caixa: null }).dados.carteiras[0].id, 'principal');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/leitura.test.mjs`
Expected: FAIL com `Cannot find module` para `./leitura.mjs`.

- [ ] **Step 3: Write minimal implementation**

```js
// central-rwa/supabase/functions/atlas-mcp/leitura.mjs
import { ErroUsuario } from './mcp.mjs';

// Mesmo efeito por tipo de wallets/walletCaixa.js (TIPOS).
const EFEITO_CAIXA = { deposito: 1, saque: -1, transferencia: -1, swap: 0, aporte: -1, retorno: 1 };
const ROTULOS = { deposito: 'Depósito', saque: 'Saque', transferencia: 'Transferência', swap: 'Swap', aporte: 'Aporte em posição', retorno: 'Retorno de posição', buy: 'Compra', sell: 'Venda' };

export function normalizarTexto(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function usd(v) {
  const s = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? '-$ ' : '$ ') + s;
}

function qtd(v) {
  return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 8 });
}

function listaCarteiras(estado) {
  const ws = Array.isArray(estado?.wallets) ? estado.wallets.filter((w) => w && w.id) : [];
  return ws.length ? ws : [{ id: 'principal', name: 'Principal', type: 'global', module: null }];
}

function nomeCarteira(estado, id) {
  return listaCarteiras(estado).find((w) => w.id === id)?.name || id;
}

export function resolverCarteira(estado, nome) {
  if (nome == null || String(nome).trim() === '') return null;
  const alvo = normalizarTexto(nome);
  const ws = listaCarteiras(estado);
  const achou = ws.filter((w) => normalizarTexto(w.id) === alvo || normalizarTexto(w.name) === alvo);
  if (achou.length === 1) return achou[0];
  if (!achou.length) throw new ErroUsuario(`Não encontrei a carteira "${String(nome).trim()}". Carteiras: ${ws.map((w) => w.name).join(', ')}.`);
  throw new ErroUsuario(`Mais de uma carteira se chama "${String(nome).trim()}". Use o id: ${achou.map((w) => w.id).join(', ')}.`);
}

export function posicoes(hold) {
  const ativos = new Map((Array.isArray(hold?.ativos) ? hold.ativos : []).map((a) => [a.id, a]));
  return (Array.isArray(hold?.carteira) ? hold.carteira : [])
    .filter((p) => p && Number(p.quantidade) > 0)
    .map((p) => {
      const a = ativos.get(p.ativo_id) || {};
      const preco = Number(a.preco_atual);
      const temPreco = Number.isFinite(preco) && preco > 0;
      const q = Number(p.quantidade), pm = Number(p.preco_medio) || 0;
      return {
        walletId: p.walletId || 'principal', ativoId: p.ativo_id,
        ticker: String(a.ticker || '?').toUpperCase(), nome: a.nome || '',
        quantidade: q, precoMedio: pm, custo: q * pm,
        preco: temPreco ? preco : null, valor: temPreco ? q * preco : null, resultado: temPreco ? q * preco - q * pm : null,
      };
    });
}

function agruparPorTicker(lista) {
  const grupos = new Map();
  for (const p of lista) {
    const g = grupos.get(p.ticker) || { ativoId: p.ativoId, ticker: p.ticker, nome: p.nome, carteiras: [], quantidade: 0, custo: 0, valor: 0, semPreco: false };
    g.quantidade += p.quantidade; g.custo += p.custo; g.carteiras.push(p.walletId);
    if (p.valor === null) g.semPreco = true; else g.valor += p.valor;
    grupos.set(p.ticker, g);
  }
  return [...grupos.values()].map((g) => ({
    walletId: null, carteiras: g.carteiras, ativoId: g.ativoId, ticker: g.ticker, nome: g.nome,
    quantidade: g.quantidade, precoMedio: g.quantidade ? g.custo / g.quantidade : 0, custo: g.custo,
    preco: g.semPreco ? null : g.valor / g.quantidade, valor: g.semPreco ? null : g.valor, resultado: g.semPreco ? null : g.valor - g.custo,
  }));
}

const porValorDesc = (a, b) => (b.valor ?? -1) - (a.valor ?? -1);

export function verPosicoes({ carteiras, hold }, { carteira, token } = {}) {
  const w = resolverCarteira(carteiras, carteira);
  const alvo = token ? normalizarTexto(token) : null;
  let lista = posicoes(hold).filter((p) => (!w || p.walletId === w.id) && (!alvo || normalizarTexto(p.ticker) === alvo));
  if (!w) lista = agruparPorTicker(lista);
  lista.sort(porValorDesc);
  const ativos = new Map((Array.isArray(hold?.ativos) ? hold.ativos : []).map((a) => [a.id, a]));
  const realizado = (Array.isArray(hold?.vendas) ? hold.vendas : [])
    .filter((v) => v && (!w || (v.walletId || 'principal') === w.id) && (!alvo || normalizarTexto(ativos.get(v.ativo_id)?.ticker) === alvo))
    .reduce((s, v) => s + (Number(v.resultado) || 0), 0);
  const total = lista.filter((p) => p.valor !== null).reduce((s, p) => s + p.valor, 0);
  const custo = lista.reduce((s, p) => s + p.custo, 0);
  const semPreco = lista.filter((p) => p.valor === null).map((p) => p.ticker);
  const onde = w ? `na ${w.name}` : 'em todas as carteiras';
  const dados = { carteira: w?.id ?? null, posicoes: lista, total, custo, realizado, semPreco };
  if (!lista.length) return { texto: `Nenhuma posição no Hold ${onde}${token ? ` para ${String(token).trim().toUpperCase()}` : ''}.`, dados };
  const linhas = lista.map((p) => `${p.ticker}: ${qtd(p.quantidade)} · preço médio ${usd(p.precoMedio)} · `
    + (p.valor === null ? 'sem preço salvo' : `valor ${usd(p.valor)} · resultado ${p.resultado >= 0 ? '+' : ''}${usd(p.resultado)}`));
  linhas.push(`Total ${onde}: ${usd(total)} (custo ${usd(custo)}). Realizado: ${usd(realizado)}.`);
  if (semPreco.length) linhas.push(`Fora do total por falta de preço: ${semPreco.join(', ')}.`);
  linhas.push('Valores com o último preço salvo pelo site.');
  return { texto: linhas.join('\n'), dados };
}

function eventosCaixa(caixa) {
  return (Array.isArray(caixa) ? caixa : []).filter((e) => e && EFEITO_CAIXA[e.tipo] !== undefined && Number(e.valorUSD) > 0 && e.walletId);
}

const porDataDesc = (a, b) => String(b.data ?? '').slice(0, 10).localeCompare(String(a.data ?? '').slice(0, 10));

export function saldosCaixa(caixa) {
  const s = {};
  for (const e of eventosCaixa(caixa)) {
    const v = Number(e.valorUSD);
    s[e.walletId] = (s[e.walletId] || 0) + EFEITO_CAIXA[e.tipo] * v;
    if (e.tipo === 'transferencia' && e.contraWalletId) s[e.contraWalletId] = (s[e.contraWalletId] || 0) + v;
  }
  return s;
}

export function verCaixa({ carteiras, caixa }, { carteira } = {}) {
  const w = resolverCarteira(carteiras, carteira);
  const saldos = saldosCaixa(caixa);
  const ws = w ? [w] : listaCarteiras(carteiras);
  const linhas = ws.map((x) => `${x.name}: ${usd(saldos[x.id] || 0)}`);
  const ultimos = eventosCaixa(caixa).filter((e) => !w || e.walletId === w.id || e.contraWalletId === w.id).sort(porDataDesc).slice(0, 5);
  if (ultimos.length) {
    linhas.push('Últimos movimentos:');
    for (const e of ultimos) {
      linhas.push(`${String(e.data).slice(0, 10)} · ${ROTULOS[e.tipo]} · ${String(e.ativo || 'USDT').toUpperCase()} · ${usd(Number(e.valorUSD))}`
        + (e.tipo === 'transferencia' ? ` (${nomeCarteira(carteiras, e.walletId)} → ${nomeCarteira(carteiras, e.contraWalletId)})` : ''));
    }
  }
  linhas.push('Saldo do caixa em dólar, somando os eventos. O saldo por token vem numa próxima fase.');
  const porCarteira = Object.fromEntries(ws.map((x) => [x.id, saldos[x.id] || 0]));
  return { texto: linhas.join('\n'), dados: { saldos: porCarteira, total: Object.values(porCarteira).reduce((s, v) => s + v, 0), ultimos } };
}

export function listarCarteiras({ carteiras, hold, caixa }) {
  const saldos = saldosCaixa(caixa), pos = posicoes(hold);
  const lista = listaCarteiras(carteiras).map((w) => {
    const ps = pos.filter((p) => p.walletId === w.id);
    return { id: w.id, nome: w.name, tipo: w.type || null, modulo: w.module || null, caixa: saldos[w.id] || 0, hold: ps.reduce((s, p) => s + (p.valor ?? 0), 0), posicoes: ps.length };
  });
  return { texto: lista.map((w) => `${w.nome} (id ${w.id}): caixa ${usd(w.caixa)} · Hold ${usd(w.hold)} em ${w.posicoes} posição(ões)`).join('\n'), dados: { carteiras: lista } };
}

export function historico({ carteiras, hold, caixa }, { carteira, token, desde, limite } = {}) {
  const w = resolverCarteira(carteiras, carteira);
  if (desde != null && desde !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(String(desde))) throw new ErroUsuario('Use a data no formato AAAA-MM-DD, por exemplo 2026-10-01.');
  const n = limite == null ? 20 : Number(limite);
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new ErroUsuario('O limite precisa ser um número inteiro de 1 a 100.');
  const alvo = token ? normalizarTexto(token) : null;
  const ativos = new Map((Array.isArray(hold?.ativos) ? hold.ativos : []).map((a) => [a.id, a]));
  const ops = (Array.isArray(hold?.operacoes) ? hold.operacoes : []).filter((o) => o && (o.tipo === 'buy' || o.tipo === 'sell'));
  const ligados = new Set(ops.flatMap((o) => (Array.isArray(o.eventos) ? o.eventos : [])));
  const itens = [
    ...ops.map((o) => ({
      origem: 'hold', data: String(o.data ?? '').slice(0, 10), tipo: o.tipo, rotulo: ROTULOS[o.tipo],
      walletId: o.walletId || 'principal', contraWalletId: null,
      tokens: [String(ativos.get(o.ativo_id)?.ticker || '?').toUpperCase()],
      quantidade: Number(o.quantidade) || 0, preco: Number(o.preco) || 0, valorUSD: Number(o.valorCaixa) || 0,
    })),
    ...eventosCaixa(caixa).filter((e) => !ligados.has(e.id)).map((e) => ({
      origem: 'caixa', data: String(e.data ?? '').slice(0, 10), tipo: e.tipo, rotulo: ROTULOS[e.tipo],
      walletId: e.walletId, contraWalletId: e.contraWalletId || null,
      tokens: [e.ativo, e.ativoDestino].filter(Boolean).map((x) => String(x).toUpperCase()),
      quantidade: Number(e.qtd) || null, preco: null, valorUSD: Number(e.valorUSD),
    })),
  ]
    .filter((i) => (!w || i.walletId === w.id || i.contraWalletId === w.id)
      && (!alvo || i.tokens.some((t) => normalizarTexto(t) === alvo))
      && (!desde || i.data >= desde))
    .sort(porDataDesc)
    .slice(0, n);
  if (!itens.length) return { texto: 'Nenhuma operação encontrada com esses filtros.', dados: { itens: [] } };
  const texto = itens.map((i) => `${i.data} · ${i.rotulo} · ${i.tokens.join(' → ')} · `
    + (i.origem === 'hold' ? `${qtd(i.quantidade)} a ${usd(i.preco)} = ${usd(i.valorUSD)}` : usd(i.valorUSD))
    + ` · ${nomeCarteira(carteiras, i.walletId)}` + (i.contraWalletId ? ` → ${nomeCarteira(carteiras, i.contraWalletId)}` : '')).join('\n');
  return { texto, dados: { itens } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/leitura.test.mjs`
Expected: PASS (8 testes). Se algum texto falhar só por separador numérico, confira que o Node tem ICU completo (`node -p "(1234.5).toLocaleString('pt-BR')"` deve imprimir `1.234,5`).

- [ ] **Step 5: Commit**

```bash
git add central-rwa/supabase/functions/atlas-mcp/leitura.mjs central-rwa/supabase/functions/atlas-mcp/leitura.test.mjs
git commit -m "atlas-mcp: leitura de carteiras, posições do Hold, caixa e histórico"
```

---

### Task 7: Ferramentas MCP

**Files:**
- Create: `central-rwa/supabase/functions/atlas-mcp/ferramentas.mjs`
- Test: `central-rwa/supabase/functions/atlas-mcp/ferramentas.test.mjs`

**Interfaces:**
- Consumes: `listarCarteiras`, `verPosicoes`, `verCaixa`, `historico` (Task 6); contexto `{ uid, firestore: { lerChave } }` (Task 5).
- Produces:
  - `CHAVES = { carteiras: 'atlas.wallets.v2', hold: 'atlas.hold.state.v2', caixa: 'atlas.caixa.v1' }`
  - `carregarEstado(ctx): Promise<{ carteiras, hold, caixa, aviso: string|null }>`
  - `FERRAMENTAS`: array no formato da Task 2, nomes `listar_carteiras`, `ver_posicoes`, `ver_caixa`, `historico`.

- [ ] **Step 1: Write the failing test**

```js
// central-rwa/supabase/functions/atlas-mcp/ferramentas.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { FERRAMENTAS, CHAVES, carregarEstado } from './ferramentas.mjs';

const ferramenta = (nome) => FERRAMENTAS.find((f) => f.nome === nome);
function ctxCom(respostas) {
  const lidas = [];
  return { lidas, uid: 'uidDono', firestore: { lerChave: async (uid, chave) => { lidas.push([uid, chave]); return respostas[chave] ?? { valor: null, atualizado: null }; } } };
}

test('as quatro ferramentas existem com schema fechado', () => {
  assert.deepEqual(FERRAMENTAS.map((f) => f.nome), ['listar_carteiras', 'ver_posicoes', 'ver_caixa', 'historico']);
  for (const f of FERRAMENTAS) {
    assert.equal(f.schema.type, 'object');
    assert.equal(f.schema.additionalProperties, false);
    assert.ok(f.descricao.length > 20);
  }
  assert.deepEqual(Object.keys(ferramenta('historico').schema.properties), ['carteira', 'token', 'desde', 'limite']);
});

test('carrega as três chaves só do uid do contexto', async () => {
  const ctx = ctxCom({});
  await carregarEstado(ctx);
  assert.deepEqual(ctx.lidas.map(([u]) => u), ['uidDono', 'uidDono', 'uidDono']);
  assert.deepEqual(ctx.lidas.map(([, c]) => c).sort(), Object.values(CHAVES).sort());
});

test('usuário sem nada salvo recebe respostas vazias, não erro', async () => {
  const ctx = ctxCom({});
  assert.match((await ferramenta('listar_carteiras').executar({}, ctx)).texto, /Principal \(id principal\): caixa \$ 0,00/);
  assert.match((await ferramenta('ver_posicoes').executar({}, ctx)).texto, /Nenhuma posição no Hold/);
  assert.match((await ferramenta('historico').executar({}, ctx)).texto, /Nenhuma operação/);
});

test('dado corrompido vira aviso no texto e nos dados', async () => {
  const ctx = ctxCom({ [CHAVES.hold]: { valor: null, atualizado: null, corrompido: true } });
  const r = await ferramenta('ver_posicoes').executar({}, ctx);
  assert.match(r.texto, /Não consegui ler: Hold\. Abra o Atlas no navegador/);
  assert.match(r.dados.aviso, /Hold/);
});

test('ver_posicoes repassa carteira e token', async () => {
  const ctx = ctxCom({
    [CHAVES.carteiras]: { valor: { wallets: [{ id: 'w_bin', name: 'Binance' }] } },
    [CHAVES.hold]: { valor: { ativos: [{ id: 'a', ticker: 'PYTH', preco_atual: 0.1 }], carteira: [{ ativo_id: 'a', walletId: 'w_bin', quantidade: 10, preco_medio: 0.05 }] } },
  });
  const r = await ferramenta('ver_posicoes').executar({ carteira: 'binance', token: 'pyth' }, ctx);
  assert.equal(r.dados.total, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/ferramentas.test.mjs`
Expected: FAIL com `Cannot find module` para `./ferramentas.mjs`.

- [ ] **Step 3: Write minimal implementation**

```js
// central-rwa/supabase/functions/atlas-mcp/ferramentas.mjs
import { listarCarteiras, verPosicoes, verCaixa, historico } from './leitura.mjs';

export const CHAVES = { carteiras: 'atlas.wallets.v2', hold: 'atlas.hold.state.v2', caixa: 'atlas.caixa.v1' };

export async function carregarEstado(ctx) {
  const [w, h, c] = await Promise.all([CHAVES.carteiras, CHAVES.hold, CHAVES.caixa].map((k) => ctx.firestore.lerChave(ctx.uid, k)));
  const ilegiveis = [[w, 'carteiras'], [h, 'Hold'], [c, 'caixa']].filter(([x]) => x?.corrompido).map(([, nome]) => nome);
  return {
    carteiras: w?.valor ?? null, hold: h?.valor ?? null, caixa: c?.valor ?? null,
    aviso: ilegiveis.length ? `Não consegui ler: ${ilegiveis.join(', ')}. Abra o Atlas no navegador para reenviar esses dados.` : null,
  };
}

function comAviso(r, estado) {
  return estado.aviso ? { texto: r.texto + '\n' + estado.aviso, dados: { ...r.dados, aviso: estado.aviso } } : r;
}

const esquema = (propriedades) => ({ type: 'object', properties: propriedades, additionalProperties: false });
const P_CARTEIRA = { type: 'string', description: 'Nome ou id da carteira, por exemplo Binance ou JRB1. Sem isso, considera todas.' };
const P_TOKEN = { type: 'string', description: 'Ticker do token, por exemplo PYTH.' };
const usando = (fn) => async (args, ctx) => { const estado = await carregarEstado(ctx); return comAviso(fn(estado, args), estado); };

export const FERRAMENTAS = [
  {
    nome: 'listar_carteiras', titulo: 'Listar carteiras',
    descricao: 'Lista as carteiras do Atlas com o caixa em dólar e o valor no Hold de cada uma. Use para descobrir os nomes das carteiras.',
    schema: esquema({}), executar: usando((e) => listarCarteiras(e)),
  },
  {
    nome: 'ver_posicoes', titulo: 'Ver posições do Hold',
    descricao: 'Mostra quantidade, preço médio, valor atual e resultado das posições do Hold, por carteira ou somando todas, com filtro opcional por token.',
    schema: esquema({ carteira: P_CARTEIRA, token: P_TOKEN }), executar: usando((e, a) => verPosicoes(e, a)),
  },
  {
    nome: 'ver_caixa', titulo: 'Ver caixa',
    descricao: 'Mostra o saldo de caixa em dólar de cada carteira (ou de uma) e os últimos movimentos de depósito, saque e transferência.',
    schema: esquema({ carteira: P_CARTEIRA }), executar: usando((e, a) => verCaixa(e, a)),
  },
  {
    nome: 'historico', titulo: 'Histórico de operações',
    descricao: 'Lista compras, vendas e movimentos de caixa em ordem do mais recente, com filtros por carteira, token e data inicial.',
    schema: esquema({
      carteira: P_CARTEIRA, token: P_TOKEN,
      desde: { type: 'string', description: 'Data inicial no formato AAAA-MM-DD.' },
      limite: { type: 'integer', minimum: 1, maximum: 100, description: 'Máximo de itens. Padrão 20.' },
    }),
    executar: usando((e, a) => historico(e, a)),
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/ferramentas.test.mjs`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add central-rwa/supabase/functions/atlas-mcp/ferramentas.mjs central-rwa/supabase/functions/atlas-mcp/ferramentas.test.mjs
git commit -m "atlas-mcp: ferramentas listar_carteiras, ver_posicoes, ver_caixa e historico"
```

---

### Task 8: Handler HTTP, entrada e bundle de implantação

**Files:**
- Create: `central-rwa/supabase/functions/atlas-mcp/handler.mjs`
- Create: `central-rwa/supabase/functions/atlas-mcp/index.ts`
- Create: `central-rwa/supabase/functions/atlas-mcp/montar.mjs`
- Create: `central-rwa/supabase/functions/atlas-mcp/build.mjs`
- Modify: `central-rwa/supabase/config.toml` (acrescentar no fim)
- Modify: `.gitignore` (acrescentar no fim)
- Test: `central-rwa/supabase/functions/atlas-mcp/handler.test.mjs`
- Test: `central-rwa/supabase/functions/atlas-mcp/montar.test.mjs`

**Interfaces:**
- Consumes: tudo das Tasks 1–7.
- Produces:
  - `rotaDe(pathname): string` — tira tudo até `/atlas-mcp` (funciona no Supabase e em domínio próprio).
  - `createHandler({ env: { get(k) }, fetcher, store?, firestore?, agora? }): (req: Request) => Promise<Response>`
  - Rotas: `GET /.well-known/oauth-protected-resource[/mcp]`, `GET /.well-known/oauth-authorization-server`, `GET /.well-known/openid-configuration`, `POST /register`, `GET /authorize`, `OPTIONS|POST /authorize/concluir`, `POST /token`, `POST /mcp` (outros métodos 405).
  - Envs lidas: `ATLAS_MCP_BASE_URL`, `ATLAS_MCP_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEYS`/`SUPABASE_SERVICE_ROLE_KEY`, `ATLAS_FIREBASE_SERVICE_ACCOUNT`, `ATLAS_MCP_ALLOWED_EMAILS`, `ATLAS_MCP_PAGINA`, `ATLAS_FIREBASE_WEB_KEY`.
  - `montar(): string` — conteúdo do `dist/index.ts`.

- [ ] **Step 1: Write the failing tests**

```js
// central-rwa/supabase/functions/atlas-mcp/handler.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, rotaDe } from './handler.mjs';
import { storeMemoria } from './fakes.mjs';
import { aleatorio, sha256b64url } from './crypto.mjs';

const BASE = 'https://ref.supabase.co/functions/v1/atlas-mcp';
const ORIGEM = 'https://juniordezzz-cell.github.io';
const CB = 'https://claude.ai/api/mcp/auth_callback';
const ENV = { ATLAS_MCP_BASE_URL: BASE, ATLAS_MCP_SECRET: 'x'.repeat(40), SUPABASE_URL: 'https://db', SUPABASE_SERVICE_ROLE_KEY: 'svc' };
const DADOS = {
  'atlas.wallets.v2': { wallets: [{ id: 'principal', name: 'Principal' }, { id: 'w_bin', name: 'Binance' }] },
  'atlas.hold.state.v2': { ativos: [{ id: 'a1', ticker: 'PYTH', preco_atual: 0.08674 }], carteira: [{ ativo_id: 'a1', walletId: 'w_bin', quantidade: 152.6472, preco_medio: 0.06620104 }] },
};

function montar({ email = 'juniordezzz@gmail.com', env = ENV } = {}) {
  const store = storeMemoria();
  const lidas = [];
  const firestore = { lerChave: async (uid, chave) => { lidas.push(uid); return { valor: uid === 'uidDono' ? (DADOS[chave] ?? null) : null, atualizado: null }; } };
  const fetcher = async (url) => {
    if (String(url).includes('accounts:lookup')) return Response.json({ users: [{ localId: 'uidDono', email, emailVerified: true }] });
    throw new Error('fetch inesperado ' + url);
  };
  return { store, lidas, h: createHandler({ env: { get: (k) => env[k] }, fetcher, store, firestore }) };
}
const u = (p) => BASE + p;

async function conectar(h) {
  const reg = await (await h(new Request(u('/register'), { method: 'POST', body: JSON.stringify({ redirect_uris: [CB], client_name: 'Claude' }) }))).json();
  const verifier = aleatorio(48);
  const q = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: CB, code_challenge: await sha256b64url(verifier), code_challenge_method: 'S256', state: 'xyz' });
  const auth = await h(new Request(u('/authorize?' + q)));
  assert.equal(auth.status, 302);
  const req = new URL(auth.headers.get('Location')).searchParams.get('req');
  const fim = await h(new Request(u('/authorize/concluir'), { method: 'POST', headers: { Origin: ORIGEM, 'Content-Type': 'application/json' }, body: JSON.stringify({ req, idToken: 'firebase-token' }) }));
  assert.equal(fim.status, 200);
  assert.equal(fim.headers.get('Access-Control-Allow-Origin'), ORIGEM);
  const destino = new URL((await fim.json()).redirect);
  assert.equal(destino.searchParams.get('state'), 'xyz');
  const tok = await h(new Request(u('/token'), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: destino.searchParams.get('code'), code_verifier: verifier, client_id: reg.client_id, redirect_uri: CB }) }));
  assert.equal(tok.status, 200);
  return { ...(await tok.json()), client_id: reg.client_id };
}
const rpc = (h, token, corpo) => h(new Request(u('/mcp'), { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }));

test('rotaDe funciona com e sem prefixo do Supabase', () => {
  assert.equal(rotaDe('/functions/v1/atlas-mcp/mcp'), '/mcp');
  assert.equal(rotaDe('/atlas-mcp/.well-known/oauth-authorization-server'), '/.well-known/oauth-authorization-server');
  assert.equal(rotaDe('/atlas-mcp'), '/');
  assert.equal(rotaDe('/token/'), '/token');
});

test('sem configuração responde 503 explicando', async () => {
  const { h } = montar({ env: {} });
  const r = await h(new Request(u('/mcp'), { method: 'POST' }));
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /não configurado/);
});

test('metadados públicos', async () => {
  const { h } = montar();
  assert.equal((await (await h(new Request(u('/.well-known/oauth-protected-resource')))).json()).resource, BASE + '/mcp');
  assert.equal((await (await h(new Request(u('/.well-known/oauth-protected-resource/mcp')))).json()).resource, BASE + '/mcp');
  assert.equal((await (await h(new Request(u('/.well-known/oauth-authorization-server')))).json()).issuer, BASE);
  assert.equal((await (await h(new Request(u('/.well-known/openid-configuration')))).json()).issuer, BASE);
  assert.equal((await h(new Request(u('/nada')))).status, 404);
});

test('MCP sem token pede autorização com WWW-Authenticate', async () => {
  const { h } = montar();
  const r = await rpc(h, 'token-inventado-com-mais-de-vinte', { jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal(r.status, 401);
  assert.equal(r.headers.get('WWW-Authenticate'), `Bearer resource_metadata="${BASE}/.well-known/oauth-protected-resource"`);
  assert.equal((await h(new Request(u('/mcp')))).status, 405);
});

test('concluir só aceita a origem do site e e-mail permitido', async () => {
  const outro = montar({ email: 'intruso@gmail.com' });
  const pre = await outro.h(new Request(u('/authorize/concluir'), { method: 'OPTIONS', headers: { Origin: ORIGEM } }));
  assert.equal(pre.status, 204);
  assert.equal((await outro.h(new Request(u('/authorize/concluir'), { method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{}' }))).status, 403);
  await assert.rejects(() => conectar(outro.h));
});

test('fluxo completo: conecta e consulta PYTH só com o uid do token', async () => {
  const { h, lidas } = montar();
  const t = await conectar(h);
  const init = await (await rpc(h, t.access_token, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } })).json();
  assert.equal(init.result.serverInfo.name, 'atlas');
  assert.equal((await rpc(h, t.access_token, { jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202);
  const lista = await (await rpc(h, t.access_token, { jsonrpc: '2.0', id: 2, method: 'tools/list' })).json();
  assert.equal(lista.result.tools.length, 4);
  const r = await (await rpc(h, t.access_token, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ver_posicoes', arguments: { token: 'pyth' } } })).json();
  assert.equal(r.result.isError, false);
  assert.match(r.result.content[0].text, /PYTH: 152,6472/);
  assert.match(r.result.content[0].text, /valor \$ 13,24/);
  assert.ok(lidas.length > 0 && lidas.every((x) => x === 'uidDono'));
  const ruim = await rpc(h, t.access_token, 'não é json');
  assert.equal(ruim.status, 400);
});

test('renovação funciona e reuso derruba o acesso', async () => {
  const { h } = montar();
  const t = await conectar(h);
  const form = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: t.client_id });
  const novo = await h(new Request(u('/token'), { method: 'POST', body: form }));
  assert.equal(novo.status, 200);
  const t2 = await novo.json();
  assert.equal((await rpc(h, t2.access_token, { jsonrpc: '2.0', id: 1, method: 'ping' })).status, 200);
  assert.equal((await h(new Request(u('/token'), { method: 'POST', body: form }))).status, 400);
  assert.equal((await rpc(h, t2.access_token, { jsonrpc: '2.0', id: 1, method: 'ping' })).status, 401);
});
```

```js
// central-rwa/supabase/functions/atlas-mcp/montar.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { montar } from './montar.mjs';

test('bundle único, sem import/export, termina em Deno.serve', () => {
  const b = montar();
  assert.doesNotMatch(b, /^\s*import\s/m);
  assert.doesNotMatch(b, /^export\s/m);
  assert.doesNotMatch(b, /storeMemoria/);
  assert.match(b, /Deno\.serve\(createHandler\(\{ env: Deno\.env, fetcher: fetch \}\)\);\s*$/);
});

test('bundle carrega (sem nomes repetidos) e responde metadados', async () => {
  const codigo = montar().replace(/Deno\.serve\([\s\S]*$/, 'export { createHandler };\n');
  const arquivo = join(mkdtempSync(join(tmpdir(), 'atlas-mcp-')), 'bundle.mjs');
  writeFileSync(arquivo, codigo);
  const { createHandler } = await import(pathToFileURL(arquivo).href);
  const env = { get: (k) => ({ ATLAS_MCP_BASE_URL: 'https://x/functions/v1/atlas-mcp', ATLAS_MCP_SECRET: 's'.repeat(40), SUPABASE_URL: 'https://db', SUPABASE_SERVICE_ROLE_KEY: 'k' })[k] };
  const r = await createHandler({ env, fetcher: fetch })(new Request('https://x/functions/v1/atlas-mcp/.well-known/oauth-authorization-server'));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).issuer, 'https://x/functions/v1/atlas-mcp');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/handler.test.mjs central-rwa/supabase/functions/atlas-mcp/montar.test.mjs`
Expected: FAIL com `Cannot find module` para `./handler.mjs` e `./montar.mjs`.

- [ ] **Step 3: Write the handler and the entry point**

```js
// central-rwa/supabase/functions/atlas-mcp/handler.mjs
import { atenderMcp } from './mcp.mjs';
import { criarStore } from './store.mjs';
import { criarFirestore } from './firestore.mjs';
import { FERRAMENTAS } from './ferramentas.mjs';
import { metadadosRecurso, metadadosServidor, registrar, autorizar, concluir, trocarToken, autenticar } from './oauth.mjs';

const ORIGEM_SITE = 'https://juniordezzz-cell.github.io';
const PAGINA_PADRAO = ORIGEM_SITE + '/atlas/pages/conectar-claude.html';
const CHAVE_WEB_FIREBASE = 'AIzaSyCvHDXyRfaozjHKL0S9zvs9C00NS6Bd8cs';

function respostaJson(corpo, status = 200, extra = {}) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });
}

function chaveServicoSupabase(env) {
  try { const m = JSON.parse(env.get('SUPABASE_SECRET_KEYS') || '{}'); if (m.default) return m.default; } catch { /* formato antigo */ }
  return env.get('SUPABASE_SERVICE_ROLE_KEY');
}

async function lerJson(req) {
  const t = await req.text();
  if (t.length > 200000) return undefined;
  try { return JSON.parse(t); } catch { return undefined; }
}

async function lerForm(req) {
  return new URLSearchParams((await req.text()).slice(0, 20000));
}

export function rotaDe(pathname) {
  const i = pathname.indexOf('/atlas-mcp');
  const resto = i >= 0 ? pathname.slice(i + '/atlas-mcp'.length) : pathname;
  return resto.replace(/\/+$/, '') || '/';
}

export function createHandler({ env, fetcher, store: storeInjetado = null, firestore: firestoreInjetado = null, agora = () => Date.now() }) {
  let store = storeInjetado, firestore = firestoreInjetado;

  function config() {
    const base = (env.get('ATLAS_MCP_BASE_URL') || '').replace(/\/$/, '');
    const segredo = env.get('ATLAS_MCP_SECRET') || '';
    if (!base || segredo.length < 32) return null;
    if (!store) {
      const url = env.get('SUPABASE_URL'), chave = chaveServicoSupabase(env);
      if (!url || !chave) return null;
      store = criarStore({ url, chave, fetcher });
    }
    return {
      base, segredo,
      pagina: env.get('ATLAS_MCP_PAGINA') || PAGINA_PADRAO,
      permitidos: (env.get('ATLAS_MCP_ALLOWED_EMAILS') || 'juniordezzz@gmail.com').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
    };
  }

  function obterFirestore() {
    if (!firestore) firestore = criarFirestore({ contaServico: env.get('ATLAS_FIREBASE_SERVICE_ACCOUNT'), fetcher });
    return firestore;
  }

  return async (req) => {
    const c = config();
    if (!c) return respostaJson({ error: 'Conector do Atlas ainda não configurado no Supabase.' }, 503);
    const url = new URL(req.url), rota = rotaDe(url.pathname), metodo = req.method;
    try {
      if (metodo === 'GET' && (rota === '/.well-known/oauth-protected-resource' || rota === '/.well-known/oauth-protected-resource/mcp')) return respostaJson(metadadosRecurso(c.base));
      if (metodo === 'GET' && (rota === '/.well-known/oauth-authorization-server' || rota === '/.well-known/openid-configuration')) return respostaJson(metadadosServidor(c.base));
      if (metodo === 'POST' && rota === '/register') { const r = await registrar(await lerJson(req), { segredo: c.segredo }); return respostaJson(r.corpo, r.status); }
      if (metodo === 'GET' && rota === '/authorize') {
        const r = await autorizar(url.searchParams, { segredo: c.segredo, pagina: c.pagina, agora });
        if (r.status === 302) return new Response(null, { status: 302, headers: { Location: r.local, 'Cache-Control': 'no-store' } });
        return new Response(r.texto, { status: r.status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      if (rota === '/authorize/concluir') {
        const cors = { 'Access-Control-Allow-Origin': ORIGEM_SITE, Vary: 'Origin' };
        if (metodo === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' } });
        if (metodo !== 'POST' || req.headers.get('Origin') !== ORIGEM_SITE) return respostaJson({ error: 'Origem não autorizada.' }, 403, cors);
        const r = await concluir(await lerJson(req), { segredo: c.segredo, store, fetcher, chaveWeb: env.get('ATLAS_FIREBASE_WEB_KEY') || CHAVE_WEB_FIREBASE, permitidos: c.permitidos });
        return respostaJson(r.corpo, r.status, cors);
      }
      if (metodo === 'POST' && rota === '/token') { const r = await trocarToken(await lerForm(req), { store }); return respostaJson(r.corpo, r.status); }
      if (rota === '/mcp') {
        if (metodo !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
        const a = await autenticar(req.headers.get('Authorization'), { store });
        if (a.status === 429) return respostaJson({ error: 'Muitas chamadas; espere um minuto.' }, 429);
        if (a.status !== 200) return respostaJson({ error: 'invalid_token' }, 401, { 'WWW-Authenticate': `Bearer resource_metadata="${c.base}/.well-known/oauth-protected-resource"` });
        const msg = await lerJson(req);
        if (msg === undefined) return respostaJson({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido.' } }, 400);
        const contexto = { uid: a.uid, get firestore() { return obterFirestore(); } };
        const r = await atenderMcp(msg, { ferramentas: FERRAMENTAS, contexto });
        return r.corpo === null ? new Response(null, { status: 202 }) : respostaJson(r.corpo, r.status);
      }
      return respostaJson({ error: 'Rota não encontrada.' }, 404);
    } catch (e) {
      console.error('atlas-mcp', rota, String(e?.message || e).slice(0, 120));
      return respostaJson({ error: 'Falha interna. Nada foi alterado.' }, 500);
    }
  };
}
```

```ts
// central-rwa/supabase/functions/atlas-mcp/index.ts
import { createHandler } from './handler.mjs';
Deno.serve(createHandler({ env: Deno.env, fetcher: fetch }));
```

- [ ] **Step 4: Write the bundler**

```js
// central-rwa/supabase/functions/atlas-mcp/montar.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
// Ordem de dependência. fakes.mjs e *.test.mjs ficam de fora de propósito.
const ORDEM = ['crypto.mjs', 'mcp.mjs', 'store.mjs', 'firestore.mjs', 'leitura.mjs', 'ferramentas.mjs', 'oauth.mjs', 'handler.mjs'];

export function montar() {
  const partes = ORDEM.map((nome) => {
    const fonte = readFileSync(join(AQUI, nome), 'utf8');
    if (/^\s*import\s[^;]*?from\s+['"](?!\.\/)/m.test(fonte)) throw new Error(`${nome}: import externo não é suportado no bundle`);
    const limpo = fonte
      .replace(/^\s*import\s[\s\S]*?from\s+['"]\.\/[^'"]+['"];?[ \t]*$/gm, '')
      .replace(/^export\s+(?=(async\s+)?function|const|class|let)/gm, '');
    return `// ---- ${nome} ----\n${limpo.trim()}\n`;
  });
  return '// GERADO por build.mjs a partir dos módulos de atlas-mcp. Não edite à mão.\n'
    + partes.join('\n')
    + '\nDeno.serve(createHandler({ env: Deno.env, fetcher: fetch }));\n';
}
```

```js
// central-rwa/supabase/functions/atlas-mcp/build.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { montar } from './montar.mjs';

const destino = join(dirname(fileURLToPath(import.meta.url)), 'dist', 'index.ts');
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, montar());
console.log('Bundle gerado em', destino);
```

- [ ] **Step 5: Register the function config and ignore the build output**

Acrescentar ao fim de `central-rwa/supabase/config.toml`:

```toml

[functions.atlas-mcp]
verify_jwt = false
```

Acrescentar ao fim de `.gitignore`:

```
# Bundle gerado do conector MCP (colar no editor do Supabase)
central-rwa/supabase/functions/atlas-mcp/dist/
```

- [ ] **Step 6: Run all function tests**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/*.test.mjs`
Expected: PASS em todos os arquivos (crypto, mcp, store, oauth, firestore, leitura, ferramentas, handler, montar).

Run: `node central-rwa/supabase/functions/atlas-mcp/build.mjs`
Expected: `Bundle gerado em .../atlas-mcp/dist/index.ts`, e `git status` não lista `dist/`.

- [ ] **Step 7: Commit**

```bash
git add central-rwa/supabase/functions/atlas-mcp/handler.mjs central-rwa/supabase/functions/atlas-mcp/index.ts central-rwa/supabase/functions/atlas-mcp/montar.mjs central-rwa/supabase/functions/atlas-mcp/build.mjs central-rwa/supabase/functions/atlas-mcp/handler.test.mjs central-rwa/supabase/functions/atlas-mcp/montar.test.mjs central-rwa/supabase/config.toml .gitignore
git commit -m "atlas-mcp: handler HTTP, rotas OAuth/MCP e bundle para o editor do Supabase"
```

---

### Task 9: Página de autorização no site

**Files:**
- Create: `js/conectar-claude.js`
- Create: `pages/conectar-claude.html`
- Test: `js/conectar-claude.test.cjs`

**Interfaces:**
- Consumes: rota `POST {ATLAS_SUPABASE.url}/functions/v1/atlas-mcp/authorize/concluir` com `{ req, idToken }` → `{ redirect }` ou `{ error }` (Task 8).
- Produces: `concluirAutorizacao({ req, user, fetcher, baseFuncao }): Promise<string>` (URL de retorno do Claude), exportada por `module.exports` quando carregada no Node.

- [ ] **Step 1: Write the failing test**

```js
// js/conectar-claude.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { concluirAutorizacao } = require('./conectar-claude.js');

const user = { getIdToken: async () => 'id-token-firebase' };

test('envia req e idToken para a função e devolve o retorno do Claude', async () => {
  let chamada;
  const fetcher = async (url, init) => { chamada = { url, init }; return Response.json({ redirect: 'https://claude.ai/api/mcp/auth_callback?code=abc&state=s' }); };
  const destino = await concluirAutorizacao({ req: 'pedido.assinado', user, fetcher, baseFuncao: 'https://opaimjoimbndwuwkxuva.supabase.co/' });
  assert.equal(destino, 'https://claude.ai/api/mcp/auth_callback?code=abc&state=s');
  assert.equal(chamada.url, 'https://opaimjoimbndwuwkxuva.supabase.co/functions/v1/atlas-mcp/authorize/concluir');
  assert.deepEqual(JSON.parse(chamada.init.body), { req: 'pedido.assinado', idToken: 'id-token-firebase' });
});

test('mostra a mensagem de erro da função', async () => {
  const fetcher = async () => Response.json({ error: 'Esta conta não tem permissão para conectar o Claude ao Atlas.' }, { status: 403 });
  await assert.rejects(() => concluirAutorizacao({ req: 'r', user, fetcher, baseFuncao: 'https://x' }), /não tem permissão/);
});

test('recusa link sem pedido e retorno fora do Claude', async () => {
  await assert.rejects(() => concluirAutorizacao({ req: '', user, fetcher: async () => { throw new Error('não deveria chamar'); }, baseFuncao: 'https://x' }), /Link incompleto/);
  const fetcher = async () => Response.json({ redirect: 'https://evil.example/cb?code=abc' });
  await assert.rejects(() => concluirAutorizacao({ req: 'r', user, fetcher, baseFuncao: 'https://x' }), /retorno inesperado/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/conectar-claude.test.cjs`
Expected: FAIL com `Cannot find module './conectar-claude.js'`.

- [ ] **Step 3: Write the page script**

```js
// js/conectar-claude.js
/* ATLAS · Conectar o Claude ao Atlas (OAuth do conector MCP).
   O Claude abre a função atlas-mcp, que manda para cá com ?req=<pedido assinado>.
   Aqui o dono entra com o Google do Atlas e autoriza; a função devolve o
   endereço de retorno do Claude com o código. Ver docs/atlas-mcp.md. */
(function (raiz) {
  'use strict';

  async function concluirAutorizacao({ req, user, fetcher, baseFuncao }) {
    if (!req) throw new Error('Link incompleto. Volte ao Claude e conecte de novo.');
    const idToken = await user.getIdToken();
    const r = await fetcher(String(baseFuncao).replace(/\/$/, '') + '/functions/v1/atlas-mcp/authorize/concluir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ req, idToken }),
    });
    let j = {};
    try { j = await r.json(); } catch (_) { j = {}; }
    if (!r.ok || !j.redirect) throw new Error(j.error || 'Não foi possível autorizar. Tente de novo.');
    if (!/^https:\/\/claude\.(ai|com)\/api\/mcp\/auth_callback\?/.test(j.redirect)) throw new Error('Endereço de retorno inesperado. Nada foi autorizado.');
    return j.redirect;
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { concluirAutorizacao }; return; }

  const $ = (id) => document.getElementById(id);
  const ESTADOS = ['entrar', 'permitir', 'feito', 'erro'];
  function mostrar(estado, texto) {
    ESTADOS.forEach((n) => { $('estado-' + n).hidden = n !== estado; });
    if (texto) $('msg-' + estado).textContent = texto;
  }

  const req = new URLSearchParams(raiz.location.search).get('req');
  if (!req) { mostrar('erro', 'Link incompleto. Volte ao Claude e conecte de novo.'); return; }
  if (!raiz.firebase.apps.length) raiz.firebase.initializeApp(raiz.ATLAS_FIREBASE.config);
  const auth = raiz.firebase.auth();

  auth.onAuthStateChanged((user) => {
    if (!user) { mostrar('entrar'); return; }
    $('email').textContent = user.email || '';
    mostrar('permitir');
  });

  $('btn-entrar').addEventListener('click', () => {
    const provedor = new raiz.firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provedor).catch((e) => {
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) return auth.signInWithRedirect(provedor);
      mostrar('erro', 'Não deu para entrar: ' + ((e && e.message) || e));
    });
  });

  $('btn-permitir').addEventListener('click', async () => {
    $('btn-permitir').disabled = true;
    try {
      const destino = await concluirAutorizacao({ req, user: auth.currentUser, fetcher: raiz.fetch.bind(raiz), baseFuncao: raiz.ATLAS_SUPABASE.url });
      mostrar('feito');
      raiz.location.replace(destino);
    } catch (e) {
      $('btn-permitir').disabled = false;
      mostrar('erro', e.message);
    }
  });

  $('btn-cancelar').addEventListener('click', () => mostrar('erro', 'Conexão cancelada. Pode fechar esta aba.'));
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Write the page**

```html
<!-- pages/conectar-claude.html -->
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Conectar o Claude · Atlas</title>
  <link rel="icon" type="image/png" href="../assets/iconeatlas.png">
  <link rel="stylesheet" href="../themes/atlas-fonts.css">
  <link rel="stylesheet" href="../css/variables.css">
  <link rel="stylesheet" href="../css/global.css">
  <style>
    .conectar { max-width: 28rem; margin: 12vh auto 0; padding: 0 16px; display: grid; gap: 16px; }
    .conectar h1 { font-size: 1.5rem; margin: 0; }
    .conectar p { margin: 0; line-height: 1.5; }
    .conectar .acoes { display: flex; gap: 8px; flex-wrap: wrap; }
    .conectar button { font: inherit; padding: 10px 16px; border-radius: 8px; cursor: pointer; }
    .conectar ul { margin: 0; padding-left: 1.2rem; line-height: 1.6; }
  </style>
</head>
<body>
  <main class="conectar">
    <h1>Conectar o Claude ao Atlas</h1>

    <section id="estado-entrar" hidden>
      <p>Entre com a conta Google do Atlas para continuar.</p>
      <div class="acoes"><button id="btn-entrar" type="button">Entrar com Google</button></div>
      <p id="msg-entrar"></p>
    </section>

    <section id="estado-permitir" hidden>
      <p>Conta: <strong id="email"></strong></p>
      <p>O Claude vai poder <strong>ler</strong>:</p>
      <ul>
        <li>suas carteiras e o caixa de cada uma;</li>
        <li>as posições do Hold, com preço médio e resultado;</li>
        <li>o histórico de operações.</li>
      </ul>
      <p>Nesta versão ele não registra nem altera nada.</p>
      <div class="acoes">
        <button id="btn-permitir" type="button">Permitir</button>
        <button id="btn-cancelar" type="button">Cancelar</button>
      </div>
      <p id="msg-permitir"></p>
    </section>

    <section id="estado-feito" hidden>
      <p id="msg-feito">Pronto. Voltando para o Claude…</p>
    </section>

    <section id="estado-erro" hidden>
      <p id="msg-erro"></p>
    </section>
  </main>

  <script src="../core/atlas-firebase-config.js"></script>
  <script src="../core/atlas-supabase-config.js"></script>
  <script src="../assets/vendor/firebase-app-compat-10.14.1.js"></script>
  <script src="../assets/vendor/firebase-auth-compat-10.14.1.js"></script>
  <script src="../js/conectar-claude.js"></script>
</body>
</html>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test js/conectar-claude.test.cjs`
Expected: PASS (3 testes).

- [ ] **Step 6: Check the page renders locally**

Run (bash, raiz): `python -m http.server 8765`, abrir `http://localhost:8765/pages/conectar-claude.html` (sem `?req`).
Expected: aparece só "Link incompleto. Volte ao Claude e conecte de novo.", sem erro no console. Abrir `http://localhost:8765/pages/conectar-claude.html?req=x`: aparece "Entrar com Google" (ou "Conta: …" se já houver sessão Firebase nesse navegador). Não clicar em Permitir aqui.

- [ ] **Step 7: Commit**

```bash
git add js/conectar-claude.js js/conectar-claude.test.cjs pages/conectar-claude.html
git commit -m "Atlas: página para autorizar o conector do Claude com o login Google"
```

---

### Task 10: Contrato, guia de implantação e CI

**Files:**
- Create: `docs/atlas-mcp.md`
- Modify: `AGENTS.md` (acrescentar parágrafo no fim)
- Create: `.github/workflows/atlas-mcp.yml`

**Interfaces:**
- Consumes: nomes de rotas, envs e RPCs das Tasks 3, 8 e 9.

- [ ] **Step 1: Write the contract and deploy guide**

````markdown
<!-- docs/atlas-mcp.md -->
# Conector MCP do Atlas

Projeto: [spec de 15/10/2026](superpowers/specs/2026-10-15-conector-mcp-design.md). Plano da fase 1: [plano](superpowers/plans/2026-10-15-conector-mcp-fase1.md).

## Contrato vigente (fase 1)

- Só leitura. Ferramentas: `listar_carteiras`, `ver_posicoes`, `ver_caixa`, `historico`.
- Login: OAuth com PKCE S256. A identidade vem do login Google do Atlas em `pages/conectar-claude.html`. Só e-mails de `ATLAS_MCP_ALLOWED_EMAILS` (padrão `juniordezzz@gmail.com`) com e-mail verificado.
- O `uid` vem do token. Leitura só em `atlas_users/{uid}/store/{atlas.wallets.v2|atlas.hold.state.v2|atlas.caixa.v1}`.
- Tokens: acesso 1 h, renovação 30 dias com rotação; reuso de renovação revoga a família. 60 chamadas por minuto.
- Valores do Hold usam o último `preco_atual` salvo pelo site. Ativo sem preço fica fora do total. Caixa é a soma dos eventos em dólar; saldo por token fica para a fase 2.
- Revogar tudo (até existir a tela da fase 5): no SQL Editor, `select public.atlas_mcp_revogar_uid('<uid>');`.

Código: `central-rwa/supabase/functions/atlas-mcp/`. Testes: `node --test central-rwa/supabase/functions/atlas-mcp/*.test.mjs` e `node --test js/conectar-claude.test.cjs`.

## Implantação manual (feita pelo dono)

GitHub Pages publica a página `conectar-claude.html`, mas não publica a função.

1. **Conta de serviço do Firebase.** Console do Firebase → projeto `cryptotrack-br` → Configurações do projeto → Contas de serviço → Gerar nova chave privada. Guarde o JSON; ele não entra no repositório.
2. **Banco.** Supabase (mesmo projeto do Scanner) → SQL Editor → colar e rodar `central-rwa/supabase/migrations/20261015000001_atlas_mcp_oauth.sql`. Conferir: `select count(*) from atlas_mcp.tokens;` devolve 0.
3. **Secrets.** Supabase → Edge Functions → Secrets:
   - `ATLAS_MCP_SECRET`: gerar com `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
   - `ATLAS_FIREBASE_SERVICE_ACCOUNT`: colar o JSON inteiro do passo 1.
   - `ATLAS_MCP_BASE_URL`: `https://opaimjoimbndwuwkxuva.supabase.co/functions/v1/atlas-mcp`.
   - `ATLAS_MCP_ALLOWED_EMAILS`: `juniordezzz@gmail.com`.
4. **Função.** Rodar `node central-rwa/supabase/functions/atlas-mcp/build.mjs`. Supabase → Edge Functions → criar `atlas-mcp` pelo editor → colar o conteúdo inteiro de `dist/index.ts` → Deploy. Em Settings da função, desligar **Verify JWT with legacy secret**.
5. **Site.** Publicar a branch no GitHub Pages para `pages/conectar-claude.html` existir.
6. **Conferir.** `curl -s https://opaimjoimbndwuwkxuva.supabase.co/functions/v1/atlas-mcp/.well-known/oauth-authorization-server` devolve JSON com `issuer`.
7. **Claude.** claude.ai → Configurações → Conectores → Adicionar conector personalizado → URL `https://opaimjoimbndwuwkxuva.supabase.co/functions/v1/atlas-mcp/mcp` → Conectar → entrar com Google → Permitir.
8. **Teste.** No celular: "quais são minhas carteiras no Atlas?" e "quanto eu tenho de PYTH somando tudo?". Os números precisam bater com o site.

Para atualizar: repetir o passo 4 com o bundle novo e clicar em Deploy updates.

## Se o Claude não achar o servidor de autorização

A função vive num subcaminho (`/functions/v1/atlas-mcp`). Clientes que só procuram `/.well-known/oauth-authorization-server` na raiz do domínio não chegam nela. Se a conexão falhar antes de abrir a página de login:

1. Conferir o passo 6.
2. Publicar o mesmo `dist/index.ts` no Deno Deploy (o handler não depende do Supabase para rotear: `rotaDe` aceita caminho na raiz), com os mesmos secrets e `ATLAS_MCP_BASE_URL` igual à URL do Deno Deploy. `SUPABASE_URL` e a chave de serviço continuam apontando para o Supabase, onde ficam as tabelas.
3. Trocar a URL do conector no Claude para `<url do Deno Deploy>/mcp`.
````

- [ ] **Step 2: Point agents to the contract**

Acrescentar ao fim de `AGENTS.md`:

```markdown

Conector MCP do Atlas (Claude lendo e, em fases seguintes, registrando operações): consultar [o contrato e a implantação](docs/atlas-mcp.md) antes de alterar `central-rwa/supabase/functions/atlas-mcp/`, `pages/conectar-claude.html` ou `js/conectar-claude.js`. O conector só acessa `atlas_users/{uid do token}`; nunca aceitar `uid` como parâmetro. Validar com `node --test central-rwa/supabase/functions/atlas-mcp/*.test.mjs js/conectar-claude.test.cjs`.
```

- [ ] **Step 3: Add the CI workflow**

```yaml
# .github/workflows/atlas-mcp.yml
name: Atlas MCP
on:
  push:
    paths: ['central-rwa/supabase/functions/atlas-mcp/**', 'js/conectar-claude*', 'pages/conectar-claude.html', '.github/workflows/atlas-mcp.yml']
  pull_request:
    paths: ['central-rwa/supabase/functions/atlas-mcp/**', 'js/conectar-claude*', 'pages/conectar-claude.html', '.github/workflows/atlas-mcp.yml']
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: node --test central-rwa/supabase/functions/atlas-mcp/*.test.mjs js/conectar-claude.test.cjs
      - run: node central-rwa/supabase/functions/atlas-mcp/build.mjs
```

- [ ] **Step 4: Run the whole suite once more**

Run: `node --test central-rwa/supabase/functions/atlas-mcp/*.test.mjs js/conectar-claude.test.cjs`
Expected: PASS em todos.

Run: `node --test core/atlas-oraculo-operacoes.test.cjs`
Expected: PASS (nada do Oráculo mudou; confirma que o repositório segue verde).

- [ ] **Step 5: Commit**

```bash
git add docs/atlas-mcp.md AGENTS.md .github/workflows/atlas-mcp.yml
git commit -m "Docs e CI do conector MCP do Atlas (fase 1)"
```

---

### Task 11: Implantação real e teste no celular (com o dono)

Esta task não tem código novo. Ela é o portão da fase 1: só termina quando o Claude do celular responde com os números do site.

**Files:**
- Modify (só se o portão falhar): `docs/atlas-mcp.md`, seção "Se o Claude não achar o servidor de autorização", com o que foi observado.

- [ ] **Step 1: Dono executa os passos 1 a 6 de `docs/atlas-mcp.md`.** O agente não gera nem cola chaves; só confere o resultado do passo 6 pelo `curl`.

- [ ] **Step 2: Conferir as RPCs no SQL Editor**

```sql
select public.atlas_mcp_salvar_token('teste-hash', 'acesso', 'uid-teste', 'c', 'f', 60);
select * from public.atlas_mcp_buscar_token('teste-hash', 60);
select public.atlas_mcp_revogar_uid('uid-teste');
select * from public.atlas_mcp_buscar_token('teste-hash', 60);
delete from atlas_mcp.tokens where uid = 'uid-teste';
```

Expected: primeira busca com `status = ok`; depois da revogação, `status = invalido`.

- [ ] **Step 3: Dono adiciona o conector no Claude (passo 7) e autoriza.**
Expected: abre `conectar-claude.html`, mostra o e-mail do dono, "Permitir" volta para o Claude e o conector aparece como conectado.
Se falhar antes de abrir a página: seguir "Se o Claude não achar o servidor de autorização" e registrar no doc o que apareceu.

- [ ] **Step 4: Dono testa pelo celular (passo 8) com o PC desligado.**
Expected: `listar_carteiras` mostra as carteiras do site; "quanto tenho de PYTH somando tudo?" mostra a mesma quantidade do Hold no site.

- [ ] **Step 5: Commit (só se o doc mudou)**

```bash
git add docs/atlas-mcp.md
git commit -m "Docs do conector MCP: registro da implantação real"
```
