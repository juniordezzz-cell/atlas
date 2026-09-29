const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('snapshots do servidor preservam horário real e métricas da observação', async () => {
  const window = {ATLAS_SUPABASE: {url: 'https://example.supabase.co', publishableKey: 'public'}};
  vm.runInNewContext(fs.readFileSync(__dirname + '/servidor.js', 'utf8'), {window});
  let called;
  const fetch = async (url) => {
    called = url;
    return {ok: true, json: async () => [{pool_id: 'pool-1', observado_em: '2026-09-29T12:37:00Z',
      tvl: 400000, vol_24h: 5000000, fee: 0.25, apr: null, vol_7d: null}]};
  };
  const result = await window.ScannerServidor.snapshots('pool-1', fetch);
  assert.match(called, /scanner_snapshots\?select=\*&pool_id=eq.pool-1&order=observado_em.asc/);
  assert.equal(result[0].ts, Date.parse('2026-09-29T12:37:00Z'));
  assert.equal(result[0].tvl, 400000);
  assert.equal(result[0].vol24h, 5000000);
});
