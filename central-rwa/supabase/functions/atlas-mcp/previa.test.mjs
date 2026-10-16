import test from 'node:test';
import assert from 'node:assert/strict';
import { preparar, confirmar, prepararDesfazer } from './previa.mjs';
import { ConflitoGravacao } from './firestore.mjs';
import { ErroUsuario } from './mcp.mjs';

// Firestore falso com as mesmas regras de pré-condição do real.
function firestoreFalso() {
  const docs = new Map(); // chave -> { bruto, updateTime, mcpOp }
  const backups = new Map();
  let relogio = 0;
  const fs = {
    docs, backups,
    async lerDocs(_uid, chaves) { return Object.fromEntries(chaves.map((k) => [k, docs.get(k) ? { ...docs.get(k) } : { bruto: null, updateTime: null, mcpOp: null }])); },
    async gravar(_uid, { opId, mudancas, bases, backup, marcarDesfeito }) {
      for (const k of Object.keys(mudancas)) if ((docs.get(k)?.updateTime ?? null) !== (bases[k] ?? null)) throw new ConflitoGravacao('FAILED_PRECONDITION');
      for (const [k, v] of Object.entries(mudancas)) { if (v === null) docs.delete(k); else docs.set(k, { bruto: v, updateTime: 'T' + (++relogio), mcpOp: opId }); }
      backups.set(opId, { id: opId, ...backup, desfeito: false });
      if (marcarDesfeito) backups.get(marcarDesfeito).desfeito = true;
    },
    async ultimoBackup() { const ids = [...backups.keys()].sort(); return ids.length ? { ...backups.get(ids.at(-1)) } : null; },
    async lerBackup(_uid, id) { return backups.has(id) ? { ...backups.get(id) } : null; },
    siteGrava(k, bruto) { docs.set(k, { bruto, updateTime: 'S' + (++relogio), mcpOp: null }); },
  };
  return fs;
}
const ctxCom = (fs, uid = 'uid1') => ({ uid, segredo: 's'.repeat(40), agora: () => Date.parse('2026-10-16T02:00:00Z'), firestore: fs });

test('preparar não grava nada e devolve id_previa', async () => {
  const fs = firestoreFalso();
  const r = await preparar(ctxCom(fs), 'carteira', { nome: 'Binance' });
  assert.match(r.texto, /^PRÉVIA — nada foi gravado ainda\./);
  assert.match(r.texto, /Criar a carteira Binance \(global\)/);
  assert.ok(r.dados.id_previa.length > 20);
  assert.equal(fs.docs.size, 0);
});

test('confirmar grava as chaves alteradas com backup; o mesmo id não grava duas vezes', async () => {
  const fs = firestoreFalso();
  const ctx = ctxCom(fs);
  const p = await preparar(ctx, 'carteira', { nome: 'Binance' });
  const c = await confirmar(ctx, p.dados.id_previa);
  assert.match(c.texto, /^Gravado no Atlas\./);
  assert.ok(JSON.parse(fs.docs.get('atlas.wallets.v2').bruto).wallets.some((w) => w.name === 'Binance'));
  assert.equal(fs.backups.size, 1);
  await assert.rejects(() => confirmar(ctx, p.dados.id_previa), /mudaram desde a prévia/);
});

test('confirmar recusa se o site gravou depois da prévia', async () => {
  const fs = firestoreFalso();
  const ctx = ctxCom(fs);
  await confirmar(ctx, (await preparar(ctx, 'carteira', { nome: 'Binance' })).dados.id_previa);
  const p = await preparar(ctx, 'deposito', { carteira: 'Binance', token: 'USDT', quantidade: 43.98, data: '2026-10-15' });
  fs.siteGrava('atlas.caixa.v1', '[]');
  await assert.rejects(() => confirmar(ctx, p.dados.id_previa), (e) => e instanceof ErroUsuario && /mudaram desde a prévia/.test(e.message));
});

test('prévia de outro usuário, adulterada ou vencida é recusada', async () => {
  const fs = firestoreFalso();
  const p = await preparar(ctxCom(fs), 'carteira', { nome: 'Binance' });
  await assert.rejects(() => confirmar(ctxCom(fs, 'outro'), p.dados.id_previa), /Prévia inválida ou vencida/);
  await assert.rejects(() => confirmar(ctxCom(fs), p.dados.id_previa + 'x'), /Prévia inválida ou vencida/);
  const tarde = { ...ctxCom(fs), agora: () => Date.parse('2026-10-16T02:11:00Z') };
  await assert.rejects(() => confirmar(tarde, p.dados.id_previa), /Prévia inválida ou vencida/);
});

test('erro de regra aparece já na prévia e operação desconhecida é recusada', async () => {
  const fs = firestoreFalso();
  await assert.rejects(() => preparar(ctxCom(fs), 'deposito', { carteira: 'Binance', token: 'USDT', quantidade: 1 }), /Não encontrei a carteira/);
  await assert.rejects(() => preparar(ctxCom(fs), 'apagar_tudo', {}), /Operação desconhecida/);
});

test('fluxo da Binance: carteira, compra com cobrir_falta e depósito', async () => {
  const fs = firestoreFalso();
  const ctx = ctxCom(fs);
  const passo = async (op, args) => confirmar(ctx, (await preparar(ctx, op, args)).dados.id_previa);
  await passo('carteira', { nome: 'Binance' });
  await passo('compra', { carteira: 'Binance', token: 'JUP', nome: 'Jupiter', quantidade: 13.986, preco: 0.365, taxa_usd: 0.00511, data: '2026-09-27', cobrir_falta: true });
  await passo('deposito', { carteira: 'Binance', token: 'USDT', quantidade: 43.98, data: '2026-10-15' });
  const hold = JSON.parse(fs.docs.get('atlas.hold.state.v2').bruto);
  assert.equal(hold.carteira[0].quantidade, 13.986);
  assert.equal(JSON.parse(fs.docs.get('atlas.caixa.v1').bruto).length, 3);
});

test('desfazer restaura o estado anterior e recusa se o site gravou por cima', async () => {
  const fs = firestoreFalso();
  const ctx = ctxCom(fs);
  await confirmar(ctx, (await preparar(ctx, 'carteira', { nome: 'Binance' })).dados.id_previa);
  const antes = fs.docs.get('atlas.caixa.v1')?.bruto ?? null;
  await confirmar(ctx, (await preparar(ctx, 'deposito', { carteira: 'Binance', token: 'USDT', quantidade: 5 })).dados.id_previa);
  const d = await prepararDesfazer(ctx);
  assert.match(d.texto, /PRÉVIA — desfazer/);
  assert.match(d.texto, /Depósito de 5 USDT/);
  await confirmar(ctx, d.dados.id_previa);
  assert.equal(fs.docs.get('atlas.caixa.v1')?.bruto ?? null, antes);
  await assert.rejects(() => prepararDesfazer(ctx), /já foi um desfazer/);

  await confirmar(ctx, (await preparar(ctx, 'deposito', { carteira: 'Binance', token: 'USDT', quantidade: 7 })).dados.id_previa);
  fs.siteGrava('atlas.caixa.v1', '[]');
  await assert.rejects(() => prepararDesfazer(ctx), /mudaram depois dessa operação/);
});

test('sem operações do Claude não há o que desfazer', async () => {
  await assert.rejects(() => prepararDesfazer(ctxCom(firestoreFalso())), /Não há operação feita pelo Claude/);
});

test('se a gravação cair depois de aplicada, confirmar confere o backup e responde gravado', async () => {
  const fs = firestoreFalso();
  const ctx = ctxCom(fs);
  const p = await preparar(ctx, 'carteira', { nome: 'Binance' });
  const gravarReal = fs.gravar;
  fs.gravar = async (...a) => { await gravarReal(...a); throw new Error('timeout'); };
  const c = await confirmar(ctx, p.dados.id_previa);
  assert.match(c.texto, /^Gravado no Atlas\./);
});

test('se a gravação falhar sem aplicar, confirmar não diz que nada mudou e pede conferência', async () => {
  const fs = firestoreFalso();
  const ctx = ctxCom(fs);
  const p = await preparar(ctx, 'carteira', { nome: 'Binance' });
  fs.gravar = async () => { throw new Error('rede caiu'); };
  await assert.rejects(() => confirmar(ctx, p.dados.id_previa), (e) => e instanceof ErroUsuario && /Não consegui confirmar se a gravação aconteceu/.test(e.message));
});

test('a data mostrada na prévia é a gravada, mesmo confirmando depois da meia-noite', async () => {
  const fs = firestoreFalso();
  const antes = { ...ctxCom(fs), agora: () => Date.parse('2026-10-16T02:58:00Z') }; // 23:58 de 15/10 em SP
  await confirmar(antes, (await preparar(antes, 'carteira', { nome: 'Binance' })).dados.id_previa);
  const p = await preparar(antes, 'deposito', { carteira: 'Binance', token: 'USDT', quantidade: 5 });
  assert.equal(p.dados.data, '2026-10-15');
  const depois = { ...antes, agora: () => Date.parse('2026-10-16T03:02:00Z') }; // 00:02 de 16/10 em SP
  const c = await confirmar(depois, p.dados.id_previa);
  assert.equal(c.dados.data, '2026-10-15');
});
