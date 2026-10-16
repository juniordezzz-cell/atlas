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
