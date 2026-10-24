const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const HOLD = 'atlas.hold.state.v2';
const MODS = 'atlas.cloud.localmods.v1';
const espera = () => new Promise((r) => setImmediate(r));

// Roda o atlas-cloud.js de verdade com Firebase e localStorage falsos.
function montar({ local = {}, mods = {}, nuvem = {} } = {}) {
  class Storage {
    constructor() { this.m = new Map(); }
    getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
    setItem(k, v) { this.m.set(k, String(v)); }
    removeItem(k) { this.m.delete(k); }
  }
  const LS = new Storage();
  for (const [k, v] of Object.entries(local)) LS.m.set(k, v);
  LS.m.set(MODS, JSON.stringify(mods));
  const enviados = [];
  let liberar;
  const leitura = new Promise((res, rej) => { liberar = { res, rej }; });
  const docs = Object.entries(nuvem).map(([k, { value, at }]) => ({ id: k.replace(/\./g, '__'), data: () => ({ value, updatedAt: { toMillis: () => at }, device: 'claude-mcp' }) }));
  const colecao = {
    get: () => leitura,
    doc: (id) => ({ set: (d) => { enviados.push({ id, value: d.value }); return Promise.resolve(); }, delete: () => Promise.resolve() }),
    onSnapshot: () => () => {},
  };
  const db = { enablePersistence() {}, collection: () => ({ doc: () => ({ collection: () => colecao }) }) };
  const recargas = [];
  const janela = {
    localStorage: LS, sessionStorage: new Storage(), Storage, console, setTimeout, clearTimeout,
    ATLAS_FIREBASE: {},
    firebase: { firestore: Object.assign(() => db, { FieldValue: { serverTimestamp: () => 'TS' } }), auth: () => ({ currentUser: { uid: 'u1' } }) },
    AtlasStorage: { KEYS: [HOLD, 'atlas.caixa.v1', 'atlas.wallets.v2'], isDiscardable: () => false },
    AtlasAuth: { current: () => ({ email: 'dono@x' }), onChange() {} },
    location: { reload: () => recargas.push(1) },
    document: { createElement: () => ({ style: {}, appendChild() {}, addEventListener() {} }), head: { appendChild() {} }, body: { appendChild() {} }, documentElement: { appendChild() {} } },
  };
  janela.window = janela;
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'atlas-cloud.js'), 'utf8'), vm.createContext(janela));
  return {
    LS, enviados, recargas,
    abrirNuvem: async () => { liberar.res({ forEach: (fn) => docs.forEach(fn) }); await espera(); },
    falharNuvem: async () => { liberar.rej(new Error('offline')); await espera(); },
    modsSalvos: () => JSON.parse(LS.getItem(MODS) || '{}'),
  };
}

test('escrita automática durante a abertura não passa por cima de gravação mais nova na nuvem', async () => {
  const agora = Date.now();
  const s = montar({ local: { [HOLD]: 'hold-antigo' }, mods: { [HOLD]: agora - 60000 }, nuvem: { [HOLD]: { value: 'hold-do-claude', at: agora - 1000 } } });
  s.LS.setItem(HOLD, 'hold-antigo-com-precos'); // ex.: refreshIfStale terminando antes da sincronização
  await s.abrirNuvem();
  assert.equal(s.LS.getItem(HOLD), 'hold-do-claude');
  assert.equal(s.enviados.some((e) => e.id === 'atlas__hold__state__v2'), false);
  assert.equal(s.recargas.length, 1);
});

test('edição local antiga e já marcada continua vencendo a nuvem mais velha', async () => {
  const agora = Date.now();
  const s = montar({ local: { [HOLD]: 'editado-offline' }, mods: { [HOLD]: agora - 1000 }, nuvem: { [HOLD]: { value: 'velho', at: agora - 60000 } } });
  await s.abrirNuvem();
  assert.equal(s.LS.getItem(HOLD), 'editado-offline');
  assert.ok(s.enviados.some((e) => e.id === 'atlas__hold__state__v2' && e.value === 'editado-offline'));
});

test('se a nuvem falhar na abertura, as escritas do início viram edição local', async () => {
  const s = montar({ local: {}, mods: {} });
  s.LS.setItem(HOLD, 'feito-offline');
  await s.falharNuvem();
  assert.ok(s.modsSalvos()[HOLD] > 0);
});

test('escrita do início numa chave que a nuvem não tem é enviada e marcada', async () => {
  const s = montar({ local: {}, mods: {}, nuvem: { 'atlas.caixa.v1': { value: '[]', at: Date.now() - 5000 } } });
  s.LS.setItem(HOLD, 'novo-local');
  await s.abrirNuvem();
  assert.ok(s.enviados.some((e) => e.id === 'atlas__hold__state__v2' && e.value === 'novo-local'));
  assert.ok(s.modsSalvos()[HOLD] > 0);
});
