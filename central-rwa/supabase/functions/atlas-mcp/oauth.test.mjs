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
  const { reg, c } = await fluxoAteCodigo({ store });
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
  const deNovo = await trocarToken(form({ ...pedido, code: code2, client_id: outro.reg.corpo.client_id, code_verifier: outro.verifier }), { store });
  assert.equal(deNovo.status, 400);
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
