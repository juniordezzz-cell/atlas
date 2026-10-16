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
