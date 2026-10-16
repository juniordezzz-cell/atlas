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
