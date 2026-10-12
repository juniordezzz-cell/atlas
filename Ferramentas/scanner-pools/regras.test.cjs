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
  pool:'UNI/WETH', tvl:100000, vol24h:100000*r, trilho:'caca', sinais:{memecoin:{detectada:meme}, classe_par:'cauda'}});
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
test('✕ bloqueia pelo contrato e pelo ID CoinGecko, não pelo nome', () => {
  const S=load();
  const mk=(rede,end,cg,sid)=>({...p(3,false,sid), network:rede, pool:'ELIZAOS/USDC',
    tokens:[{simbolo:'ELIZAOS',endereco:end,cg},{simbolo:'USDC',endereco:'0xusdc',cg:'usd-coin'}]});
  const oficialBsc=mk('BNB Chain','0xABC','elizaos','gecko:bsc:0x1');
  const lista={bloqueados:[],bloqueadosEnd:S.bloqueiosDaPool(oficialBsc)};
  assert.equal(lista.bloqueadosEnd[0].endereco,'0xABC');assert.equal(lista.bloqueadosEnd[0].cg,'elizaos');
  assert.equal(S.trilhoEfetivo(oficialBsc,lista),'oculta');                                   // o próprio contrato
  assert.equal(S.trilhoEfetivo(mk('BNB Chain','0xabc',null,'gecko:bsc:0x2'),lista),'oculta');  // mesmo contrato, outra pool
  assert.equal(S.trilhoEfetivo(mk('Solana','Eliza111',"elizaos",'gecko:sol:0x3'),lista),'oculta'); // oficial em outra rede
  assert.equal(S.trilhoEfetivo(mk('Base','0xcopia',null,'gecko:base:0x4'),lista),'solida');    // cópia com o mesmo nome
  // o USDC do par nunca entra no bloqueio
  assert.ok(!lista.bloqueadosEnd.some(b=>b.simbolo==='USDC'));
});
test('pool classificada antes das regras de 07/10 (sem classe_par) não fica nas Sólidas', () => {
  const S=load(), x=p(); delete x.sinais.classe_par; x.trilho='solida';
  assert.equal(S.trilhoEfetivo(x,{}), 'caca');
});
test('categoria da pool: blue chip só BTC/ETH/SOL; BNB e cia são altcoin; ações e ouro são RWA', () => {
  const S=load(), r=(pool,extra={})=>S.rotuloCategoria({pool, network:'Solana', sinais:{}, ...extra});
  assert.equal(r('SPCXx/USDC'),'RWA / Stable');
  assert.equal(r('USDC/NVDAx'),'RWA / Stable');            // stable vai para o fim
  assert.equal(r('WBTC/WETH'),'Blue chip / Blue chip');
  assert.equal(r('NEAR/WBNB'),'Altcoin / Altcoin');
  assert.equal(r('SOL/USDC'),'Blue chip / Stable');
  assert.equal(r('USDC/USDT'),'Stable / Stable');
  assert.equal(r('GMX/WETH'),'Altcoin / Blue chip');
  assert.equal(r('wXIAOx/USDT'),'Altcoin / Stable');
  assert.equal(r('META/USDC'),'Altcoin / Stable');
  assert.equal(r('META/USDC',{network:'Robinhood'}),'RWA / Stable');
  assert.equal(r('FOO/SOL',{sinais:{memecoin:{detectada:true}}}),'Meme / Blue chip');
  assert.equal(r('FOO/SOL',{sinais:{categoria:['meme','bluechip']}}),'Meme / Blue chip');   // a do coletor vale primeiro
});
test('mesma pool da DefiLlama e da GeckoTerminal aparece uma vez só', () => {
  const S=load();
  const lla={sid:'llama:3beb',network:'Solana',pool:'SOL/SPCXX',sinais:{conferencia:{endereco:'CN32jwm'}}};
  const gk={sid:'gecko:solana:CN32jwm',network:'Solana',pool:'SOL/SPCXx',sinais:{}};
  const outra={sid:'gecko:solana:OUTRA',network:'Solana',pool:'SOL/USDC',sinais:{}};
  assert.deepEqual(S.semDuplicatas([lla,gk,outra]).map(p=>p.sid),['llama:3beb','gecko:solana:OUTRA']);
});
test('emissor do RWA pelo ID CoinGecko e, sem ele, pelo sufixo', () => {
  const S=load();
  const mk=(pool,rede,cg)=>({pool, network:rede, sinais:{}, tokens:[{simbolo:pool.split('/')[0].toUpperCase(),cg},{simbolo:'USDC',cg:null}]});
  assert.equal(S.rotuloEmissor(mk('SPCX/USDC','Solana','spacex-backpack-securities')),'Backpack');
  assert.equal(S.rotuloEmissor(mk('SPCXx/USDC','Solana','spacex-xstocks')),'xStocks');
  assert.equal(S.rotuloEmissor(mk('SPCXB/USDC','BNB Chain','spacex-bstocks-tokenized-stock')),'Binance bStocks');
  assert.equal(S.rotuloEmissor(mk('SPCXON/USDC','Ethereum',null)),'Ondo (provável)');
  assert.equal(S.rotuloEmissor(mk('SPCX/USDG','Robinhood',null)),'Robinhood (provável)');
  assert.equal(S.rotuloEmissor(mk('SOL/USDC','Solana',null)),'');
  assert.equal(S.rotuloCategoria(mk('SPCXON/USDC','Ethereum',null)),'RWA / Stable');
});
test('categoria antiga "altcoin" de um RWA pela regra nova vira RWA', () => {
  const S=load();
  assert.equal(S.rotuloCategoria({pool:'USDT/SPCXB',network:'BNB Chain',sinais:{categoria:['stable','altcoin']}}),'RWA / Stable');
  assert.equal(S.rotuloCategoria({pool:'FOO/SOL',network:'Solana',sinais:{categoria:['meme','bluechip']}}),'Meme / Blue chip');
});
test('link direto da pool na corretora (formatos conferidos em 08/10)', () => {
  const S=load(), L=(o)=>S.linkPool({servidor:true, sinais:{}, ...o});
  assert.equal(L({sid:'gecko:bsc:0x47bc',platform:'PancakeSwap',network:'BNB Chain'}).url,'https://pancakeswap.finance/liquidity/pool/bsc/0x47bc');
  assert.equal(L({sid:'gecko:arbitrum:0x7f',platform:'PancakeSwap',network:'Arbitrum'}).url,'https://pancakeswap.finance/liquidity/pool/arb/0x7f');
  assert.equal(L({sid:'llama:x',platform:'Uniswap',network:'Ethereum',sinais:{conferencia:{endereco:'0x8366'}}}).url,'https://app.uniswap.org/explore/pools/ethereum/0x8366');
  assert.equal(L({sid:'llama:y',platform:'Orca',network:'Solana',sinais:{endereco_pool:'Ckp1'}}).url,'https://www.orca.so/pools/Ckp1');
  assert.equal(L({sid:'gecko:solana:9n3d',platform:'Raydium',network:'Solana'}).url,'https://raydium.io/liquidity-pools/?token=9n3d');
  assert.equal(L({sid:'gecko:optimism:0x47',platform:'Velodrome',network:'Optimism'}).url,'https://www.geckoterminal.com/optimism/pools/0x47');
  assert.equal(L({sid:'llama:abc-123',platform:'Aerodrome',network:'Base'}).url,'https://defillama.com/yields/pool/abc-123');
});
test('trava de domínio: só sites oficiais e só https', () => {
  const S=load(), ok=u=>!!S.linkSeguro({url:u,onde:'x'});
  assert.equal(ok('https://raydium.io/liquidity-pools/?token=9n3d'),true);
  assert.equal(S.linkSeguro({url:'https://www.orca.so/pools/Ck',onde:'Orca'}).dominio,'www.orca.so');
  assert.equal(ok('http://raydium.io/x'),false);                    // sem https
  assert.equal(ok('https://raydium.io.evil.com/x'),false);          // domínio parecido
  assert.equal(ok('https://raydium.io@evil.com/x'),false);          // truque do @
  assert.equal(ok('https://raydlum.io/x'),false);                   // letra trocada
  assert.equal(ok('https://evil.com/?r=https://raydium.io/'),false);
  // endereço malicioso vindo dos dados não muda o domínio
  const L=S.linkPool({servidor:true,sid:'gecko:solana:x',platform:'Raydium',network:'Solana',sinais:{endereco_pool:'@evil.com/'}});
  assert.equal(L.dominio,'raydium.io'); assert.ok(L.url.startsWith('https://raydium.io/'));
});

test('par de majors com liquidez sai de Pendentes mesmo rendendo pouco (12/10/2026)', () => {
  const S=load();
  const q=(pool, tvl, vol, motivos, fee=0.0073) => ({sid:'gecko:base:'+pool, servidor:true, network:'Base', pool, tvl, vol24h:vol, fee,
    trilho:'caca', motivos, sinais:{memecoin:{detectada:false}, classe_par:'grande_stable'}});
  const rend=['rende 0.043%/dia, abaixo do mínimo de 0.05%/dia para blue chip ou RWA com stable'];
  assert.equal(S.trilhoEfetivo(q('WETH/USDC', 359400, 310900, rend),{}), 'solida');
  assert.equal(S.trilhoEfetivo(q('EURC/USDC', 1610000, 3720000, ['rende 0.063%/dia, abaixo do mínimo de 0.3%/dia para par com altcoin ou meme']),{}), 'solida');
  assert.equal(S.trilhoEfetivo(q('BNB/USDT', 1260000, 713300, rend),{}), 'solida');
  assert.equal(S.trilhoEfetivo(q('WETH/USDC', 200000, 150000, rend),{}), 'caca');        // liquidez rasa
  assert.equal(S.trilhoEfetivo(q('CAKE/WBNB', 5e6, 5e6, rend),{}), 'caca');             // altcoin: régua vale
  assert.equal(S.trilhoEfetivo(q('USDC/USDT', 5e6, 6e6, rend, 0.005),{}), 'caca');      // stable/stable: piso vale
  assert.equal(S.trilhoEfetivo(q('WETH/USDC', 5e6, 5e6, ['token fraco: WETH usa o símbolo de um token grande']),{}), 'caca');
});

test('altcoin preferida com major sai de Pendentes por rendimento (12/10/2026)', () => {
  const S=load();
  const q=(pool, motivos) => ({sid:'gecko:eth:'+pool, servidor:true, network:'Ethereum', pool, tvl:500000, vol24h:300000, fee:0.3,
    trilho:'caca', motivos, sinais:{memecoin:{detectada:false}, classe_par:'cauda'}});
  const rend=['rende 0.194%/dia, abaixo do mínimo de 0.3%/dia para par com altcoin ou meme'];
  for (const par of ['ENA/WETH','ZRO/WETH','SKY/USDC','AERO/CBBTC','USDC/UNI','WETH/ETHFI','WETH/ARB','LDO/WETH'])
    assert.equal(S.trilhoEfetivo(q(par, rend),{}), 'solida', par);
  assert.equal(S.trilhoEfetivo(q('FOO/WETH', rend),{}), 'caca');                       // fora da lista
  assert.equal(S.trilhoEfetivo(q('ENA/FOO', rend),{}), 'caca');                        // com altcoin fora da lista
  assert.equal(S.trilhoEfetivo(q('ENA/WETH', ['token fraco: ENA sem dados de segurança']),{}), 'caca');
});

test('pool ve(3,3) que paga em AERO perde nota; sem emissão não muda (12/10/2026)', () => {
  const S=load();
  const row=(dex, apr, reward, comp) => ({id:'llama:'+dex+reward, par:'WETH/CBBTC', dex, rede:'Base', fee:0.0085, tvl:2e6, vol_24h:4e7,
    apr, apr_reward:reward, nota:89.3, componentes:comp||{taxa:1}, trilho:'solida', motivos:[], sinais:{}});
  const a=S.paraPool(row('Aerodrome', 67, 3376));
  assert.ok(a.nota < 46 && a.nota > 44, String(a.nota));
  assert.equal(S.paraPool(row('Aerodrome', 67, null)).nota, 89.3);                 // paga no par
  assert.equal(S.paraPool(row('PancakeSwap', 67, 3376)).nota, 89.3);               // reward é extra
  assert.equal(S.paraPool(row('Aerodrome', 67, 3376, {taxa:1, emissao:0.98})).nota, 89.3);   // coletor já aplicou
});

test('ve(3,3) sem dado de emissão (THENA) presume 60%: nota × 0,7 (12/10/2026)', () => {
  const S=load();
  const row={id:'gecko:bsc:0xth', par:'ETH/USDT', dex:'THENA', rede:'BNB Chain', fee:0.05, tvl:1e6, vol_24h:2e6,
    apr:null, apr_reward:null, nota:62.4, componentes:{taxa:1}, trilho:'solida', motivos:[], sinais:{}};
  const p=S.paraPool(row);
  assert.equal(p.nota, 43.7); assert.equal(p.componentes.emissao_presumida, true);
  assert.equal(S.paraPool(Object.assign({}, row, {dex:'PancakeSwap'})).nota, 62.4);
});

test('mesma pool da DefiLlama (taxa 0) e da Orca vira uma; taxas diferentes ficam (12/10/2026)', () => {
  const S=load();
  const p=(sid, fee, tvl, a='pltrx') => ({sid, pool:'X/USDC', network:'Solana', platform:'Orca', fee, tvl,
    tokens:[{simbolo:'X', endereco:a}, {simbolo:'USDC', endereco:'usdc'}]});
  let r=S.semDuplicatas([p('llama:1', 0, 124000), p('gecko:solana:1', 0.65, 126000)]);
  assert.deepEqual(r.map(x=>x.sid), ['llama:1']); assert.equal(r[0].fee, 0.65);
  assert.equal(S.semDuplicatas([p('llama:2', 0.08, 500000), p('gecko:solana:2', 0.25, 510000)]).length, 2);
  assert.equal(S.semDuplicatas([p('llama:3', 0, 200000), p('gecko:solana:3', 0.05, 200000), p('gecko:solana:4', 0.3, 205000)]).length, 3);
  assert.equal(S.semDuplicatas([p('llama:5', 0.2, 224000), p('gecko:solana:5', 0.2, 161000)]).length, 2);
});
