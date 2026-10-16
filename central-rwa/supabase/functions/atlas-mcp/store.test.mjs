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
