const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync(__dirname + '/servidor.js', 'utf8');
const dados = new Map();
function load() {
  const window = {localStorage: {getItem: k => dados.get(k) || null, setItem: (k,v) => dados.set(k,v)}};
  vm.runInNewContext(code, {window});
  return window.ScannerServidor;
}
const p = (r=3, meme=false, sid='gecko:base:0x1') => ({sid, servidor:true, network:'Base',
  pool:'UNI/WETH', tvl:100000, vol24h:100000*r, trilho:'caca', sinais:{memecoin:{detectada:meme}}});
test('legado sem meme entra em Sólidas; cortes inclusivos', () => {
  const S=load();
  assert.equal(S.trilhoEfetivo(p(),{}), 'solida');
  assert.equal(S.trilhoEfetivo(p(.5),{}), 'oculta');
  assert.equal(S.trilhoEfetivo(p(2,true),{}), 'oculta');
  assert.equal(S.trilhoEfetivo(p(2.01,true),{}), 'caca');
});
test('lista de memecoins incompleta: token não conferido vai para Pendentes', () => {
  const S=load(), x=p(); x.sinais.memecoin.estado='nao_verificada';
  assert.equal(S.trilhoEfetivo(x,{}), 'caca');
  const d={}; d[S.chaveDecisao(x)]='aprovada';
  assert.equal(S.trilhoEfetivo(x,{},d), 'solida');   // aprovação por pool continua valendo
});
test('Pendentes com motivo do coletor (token fraco, rendimento, volume suspeito) não viram Sólidas', () => {
  const S=load(), x=p(); x.motivos=['token fraco: FOO sem cadastro na CoinGecko'];
  assert.equal(S.trilhoEfetivo(x,{}), 'caca');
  const d={}; d[S.chaveDecisao(x)]='aprovada';
  assert.equal(S.trilhoEfetivo(x,{},d), 'solida');
});
test('decisão por pool persiste em refresh e não afeta outra taxa/endereço', () => {
  let S=load(), a=p(3,true), b=p(3,true,'gecko:base:0x2');
  const d={}; d[S.chaveDecisao(a)]='aprovada';
  S.gravarDecisoes(d); S=load();
  assert.equal(S.trilhoEfetivo(a,{},S.lerDecisoes()),'solida');
  assert.equal(S.trilhoEfetivo(b,{},S.lerDecisoes()),'caca');
  d[S.chaveDecisao(a)]='rejeitada'; S.gravarDecisoes(d); S=load();
  assert.equal(S.trilhoEfetivo(a,{},S.lerDecisoes()),'oculta');
});
test('endereço comum mantém decisão entre DefiLlama e Gecko', () => {
  const S=load(), a=p(), b=p(3,false,'llama:uuid');
  b.sinais.endereco_pool='0x1';
  assert.equal(S.chaveDecisao(a),S.chaveDecisao(b));
});
test('aprovação não contorna segurança ou corte', () => {
  const S=load(), a=p(.5,true); const d={[S.chaveDecisao(a)]:'aprovada'};
  assert.equal(S.trilhoEfetivo(a,{},d),'oculta');
  a.vol24h=400000; a.trilho='barrada';
  assert.equal(S.trilhoEfetivo(a,{},d),'oculta');
});
test('aprovação antiga por símbolo não aprova meme nova', () => {
  const S=load();
  assert.equal(S.trilhoEfetivo(p(3,true),{aprovados:['UNI']}),'caca');
});
test('backup do Scanner exporta e restaura decisões por pool', () => {
  const html=fs.readFileSync(__dirname+'/index.html','utf8');
  const S=load(); S.gravarDecisoes({'Base:0xbackup':'rejeitada'});
  let payload, input;
  const ctx={window:{ScannerServidor:S},state:{pools:[]},tokensLista:{},decisoesPool:{},
    Blob:class{constructor(parts){payload=parts.join('')}},
    URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},
    document:{createElement:()=>({click:()=>{}})},
    setBackupCfg:()=>{},checkBackupReminder:()=>{},confirm:()=>true,
    localStorage:{removeItem:()=>{}},assignPoolIds:x=>x,normalizePool:x=>x,
    save:()=>{},carregarServidor:()=>{},alert:msg=>assert.fail(msg),
    FileReader:class{readAsText(){this.result=input;this.onload()}}};
  vm.createContext(ctx);
  vm.runInContext(html.slice(html.indexOf('function exportJSON(){'),html.indexOf('/* ---- lembrete de backup')),ctx);
  ctx.exportJSON();
  const backup=JSON.parse(payload);
  assert.equal(backup.decisoes['Base:0xbackup'],'rejeitada');
  S.gravarDecisoes({}); input=payload;
  vm.runInContext(html.slice(html.indexOf('function importJSON(ev){'),html.indexOf('function esc(s)')),ctx);
  ctx.importJSON({target:{files:[{}],value:'x'}});
  assert.equal(S.lerDecisoes()['Base:0xbackup'],'rejeitada');
});
test('backup central registra a chave de decisões', () => {
  const src=fs.readFileSync(__dirname+'/../../core/atlas-storage.js','utf8');
  const ctx={window:{}}; vm.runInNewContext(src,ctx);
  assert.ok(ctx.window.AtlasStorage.KEYS.includes(load().DECISOES_KEY));
});

test('TVL mínimo obrigatório em cache, manuais e aprovadas', () => {
  const S=load();
  for (const tvl of [0, .22, 1, 22, 41, 800, 1000, 99999.99]) {
    for (const servidor of [true,false]) {
      const a={...p(), tvl,vol24h:10_000_000,servidor};
      assert.equal(S.trilhoEfetivo(a,{}, {[S.chaveDecisao(a)]:'aprovada'}),'oculta');
    }
  }
  const a={...p(),tvl:100000,vol24h:100000};
  assert.equal(S.trilhoEfetivo(a,{}),'solida');
});
