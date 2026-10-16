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
