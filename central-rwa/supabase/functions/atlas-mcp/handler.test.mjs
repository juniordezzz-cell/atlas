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
