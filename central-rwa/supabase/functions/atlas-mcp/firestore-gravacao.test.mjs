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

test('mudança para null grava valor vazio (o site remove a chave) em vez de apagar; marcarDesfeito atualiza o backup antigo', async () => {
  const { fs, log } = servidor();
  await fs.gravar('uid1', { opId: '3-a', mudancas: { 'atlas.wallets.v2': null }, bases: { 'atlas.wallets.v2': 'T1' }, backup: { ferramenta: 'desfazer', resumo: 'r', antes: { 'atlas.wallets.v2': '{}' } }, marcarDesfeito: '1-b' });
  const w = log.commits[0].writes;
  // Apagar o documento faria o site, na abertura, reenviar a cópia local ('só local tem → sobe').
  assert.deepEqual(w[0], { update: { name: `${DOCS}/store/atlas__wallets__v2`, fields: { value: { nullValue: null }, device: { stringValue: 'claude-mcp' }, mcpOp: { stringValue: '3-a' } } }, currentDocument: { updateTime: 'T1' }, updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }] });
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
