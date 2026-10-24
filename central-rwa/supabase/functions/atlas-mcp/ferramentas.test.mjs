import test from 'node:test';
import assert from 'node:assert/strict';
import { FERRAMENTAS, CHAVES, carregarEstado } from './ferramentas.mjs';

const ferramenta = (nome) => FERRAMENTAS.find((f) => f.nome === nome);
function ctxCom(respostas) {
  const lidas = [];
  return { lidas, uid: 'uidDono', firestore: { lerChave: async (uid, chave) => { lidas.push([uid, chave]); return respostas[chave] ?? { valor: null, atualizado: null }; } } };
}

test('ferramentas de leitura e escrita existem com schema fechado', () => {
  assert.deepEqual(FERRAMENTAS.map((f) => f.nome), [
    'listar_carteiras', 'ver_posicoes', 'ver_caixa', 'historico',
    'preparar_carteira', 'preparar_deposito', 'preparar_saque', 'preparar_compra', 'preparar_venda', 'preparar_desfazer',
    'confirmar', 'cancelar',
  ]);
  for (const f of FERRAMENTAS) {
    assert.equal(f.schema.type, 'object');
    assert.equal(f.schema.additionalProperties, false);
    assert.ok(f.descricao.length > 20);
  }
  assert.deepEqual(Object.keys(ferramenta('historico').schema.properties), ['carteira', 'token', 'desde', 'limite']);
  assert.deepEqual(ferramenta('preparar_compra').schema.required, ['carteira', 'token', 'quantidade', 'preco']);
  assert.equal(ferramenta('confirmar').destrutiva, true);
  assert.equal(ferramenta('preparar_compra').escrita, true);
  assert.equal(ferramenta('ver_posicoes').escrita, undefined);
});

test('preparar_* usa o fluxo de prévia e cancelar não grava', async () => {
  const lidas = [];
  const ctx = { uid: 'uidDono', segredo: 's'.repeat(40), agora: () => Date.parse('2026-10-16T02:00:00Z'),
    firestore: { lerDocs: async (u, ks) => { lidas.push(u); return Object.fromEntries(ks.map((k) => [k, { bruto: null, updateTime: null, mcpOp: null }])); }, gravar: async () => { throw new Error('não deveria gravar'); } } };
  const r = await ferramenta('preparar_carteira').executar({ nome: 'Binance' }, ctx);
  assert.match(r.texto, /PRÉVIA/);
  assert.ok(lidas.every((u) => u === 'uidDono'));
  const c = await ferramenta('cancelar').executar({ id_previa: r.dados.id_previa }, ctx);
  assert.match(c.texto, /Cancelado/);
});

test('carrega as três chaves só do uid do contexto', async () => {
  const ctx = ctxCom({});
  await carregarEstado(ctx);
  assert.deepEqual(ctx.lidas.map(([u]) => u), ['uidDono', 'uidDono', 'uidDono']);
  assert.deepEqual(ctx.lidas.map(([, c]) => c).sort(), Object.values(CHAVES).sort());
});

test('usuário sem nada salvo recebe respostas vazias, não erro', async () => {
  const ctx = ctxCom({});
  assert.match((await ferramenta('listar_carteiras').executar({}, ctx)).texto, /Principal \(id principal\): caixa \$ 0,00/);
  assert.match((await ferramenta('ver_posicoes').executar({}, ctx)).texto, /Nenhuma posição no Hold/);
  assert.match((await ferramenta('historico').executar({}, ctx)).texto, /Nenhuma operação/);
});

test('dado corrompido vira aviso no texto e nos dados', async () => {
  const ctx = ctxCom({ [CHAVES.hold]: { valor: null, atualizado: null, corrompido: true } });
  const r = await ferramenta('ver_posicoes').executar({}, ctx);
  assert.match(r.texto, /Não consegui ler: Hold\. Abra o Atlas no navegador/);
  assert.match(r.dados.aviso, /Hold/);
});

test('ver_posicoes repassa carteira e token', async () => {
  const ctx = ctxCom({
    [CHAVES.carteiras]: { valor: { wallets: [{ id: 'w_bin', name: 'Binance' }] } },
    [CHAVES.hold]: { valor: { ativos: [{ id: 'a', ticker: 'PYTH', preco_atual: 0.1 }], carteira: [{ ativo_id: 'a', walletId: 'w_bin', quantidade: 10, preco_medio: 0.05 }] } },
  });
  const r = await ferramenta('ver_posicoes').executar({ carteira: 'binance', token: 'pyth' }, ctx);
  assert.equal(r.dados.total, 1);
});
