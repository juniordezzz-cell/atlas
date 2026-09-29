const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
  const map=new Map(),w={console,localStorage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)},addEventListener(){},dispatchEvent(){}};
  w.window=w;const c=vm.createContext({...w,window:w,CustomEvent:function(){},setTimeout,clearTimeout});
  for(const f of ['wallets/walletStore.js','wallets/walletTypes.js','wallets/walletLedger.js','wallets/walletCaixa.js','wallets/walletManager.js','defi/js/data.js','core/atlas-oraculo-operacoes.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
  const a=w.AtlasWallets.all()[0];w.AtlasWallets.rename(a.id,'M2R');const b=w.AtlasWallets.create({name:'M2P',type:'global'});
  w.AtlasCaixa.registrar({tipo:'deposito',walletId:a.id,ativo:'SOL',qtd:10,valorUSD:1000,rede:'Solana'});
  return {w,a,b,chat:w.AtlasOraculoOperacoes.criar()};
}
test('swap exige revisão, troca quantidades e preserva custo do caixa',()=>{
  const {w,a,chat}=setup();assert.match(chat.responder('Fiz swap de 1 SOL por 5 HYPE na M2R na Jupiter'),/confirmar/i);
  assert.equal(w.AtlasCaixa.saldo(a.id),1000);assert.match(chat.responder('confirmar'),/registrado/i);
  const ativos=w.AtlasCaixa.caixaPorRede(a.id)[0].ativos;
  assert.equal(ativos.find(x=>x.ativo==='SOL').qtd,9);assert.equal(ativos.find(x=>x.ativo==='HYPE').qtd,5);
  assert.equal(w.AtlasCaixa.saldo(a.id),1000);assert.equal(chat.responder('confirmar'),null);
});
test('transferência preserva patrimônio entre duas carteiras',()=>{
  const {w,a,b,chat}=setup();assert.match(chat.responder('Transferi 2 SOL da M2R para M2P'),/confirmar/i);chat.responder('confirmar');
  assert.equal(w.AtlasCaixa.saldo(a.id),800);assert.equal(w.AtlasCaixa.saldo(b.id),200);
});
test('abrir e fechar preserva resultado, caixa e histórico separado',()=>{
  const {w,a,chat}=setup();assert.match(chat.responder('Abre pool SOL/HYPE na Orca na M2R, 1 SOL e 5 HYPE, preço SOL 100 e preço HYPE 20, faixa 2 a 8 HYPE por SOL'),/confirmar/i);chat.responder('confirmar');
  const p=w.DeFiStore.poolsDeTodasCarteiras()[0].pool;assert.equal(p.capital,200);assert.equal(w.AtlasCaixa.saldo(a.id),800);
  w.DeFiStore.updatePool(p.id,{currentValue:204,fees:[{status:'pendente',amount:2}]});
  assert.match(chat.responder('Fecha posição SOL/HYPE na M2R'),/206/);chat.responder('confirmar');
  assert.equal(w.AtlasCaixa.saldo(a.id),1006);assert.equal(w.DeFiStore.poolsDeTodasCarteiras().length,0);
});
test('negação e pergunta nunca preparam gravação',()=>{
  const {chat}=setup();assert.match(chat.responder('Não transfere 2 SOL da M2R para M2P'),/nenhum|não/i);
  assert.equal(chat.pendente(),false);assert.equal(chat.responder('confirmar'),null);
  assert.match(chat.responder('Como fechar posição SOL/HYPE na M2R?'),/comando direto/i);assert.equal(chat.pendente(),false);
});
test('correção de quantidade substitui os dois lados do swap',()=>{
  const {w,a,chat}=setup();chat.responder('Fiz swap de 1 SOL por 5 HYPE na M2R');
  assert.match(chat.responder('Na verdade 2 SOL por 8 HYPE'),/2 SOL.*8 HYPE/);chat.responder('confirmar');
  const as=w.AtlasCaixa.caixaPorRede(a.id)[0].ativos;assert.equal(as.find(x=>x.ativo==='SOL').qtd,8);assert.equal(as.find(x=>x.ativo==='HYPE').qtd,8);
});
test('origem de transferência é indicada por de/da, não ordem dos nomes',()=>{
  const {w,a,b,chat}=setup();assert.match(chat.responder('Transferi 2 SOL para M2P da M2R'),/de M2R para M2P/);chat.responder('confirmar');
  assert.equal(w.AtlasCaixa.saldo(a.id),800);assert.equal(w.AtlasCaixa.saldo(b.id),200);
});
test('fechamento fora da carteira selecionada usa posição exata e não duplica taxa coletada',()=>{
  const {w,b,chat}=setup();w.AtlasCaixa.registrar({tipo:'deposito',walletId:b.id,valorUSD:100,ativo:'USDT'});
  const p=w.DeFiStore.addPool({walletId:b.id,base:'SOL',quote:'HYPE',protocol:'Orca',chain:'Solana',capital:100,currentValue:104,status:'aberta',fees:[{amount:2,status:'coletada'},{amount:3,status:'pendente'}]});
  assert.match(chat.responder('Fecha posição SOL/HYPE na M2P'),/107/);assert.match(chat.responder('confirmar'),/registrado/i);
  assert.equal(w.DeFiStore.poolsDeTodasCarteiras().length,0);assert.equal(w.AtlasCaixa.saldo(b.id),107);
});
test('rating 6% calcula cada lado e novo ciclo não reabre o antigo',()=>{
  const {w,chat}=setup();const q='Abre pool SOL/HYPE na Orca na M2R, 1 SOL e 5 HYPE, preço SOL 100 e preço HYPE 20, rating 6%';
  assert.match(chat.responder(q),/4.7.*5.3/);chat.responder('confirmar');const p=w.DeFiStore.poolsDeTodasCarteiras()[0].pool;
  assert.ok(Math.abs(p.rangeLow-4.7)<1e-10);assert.ok(Math.abs(p.rangeHigh-5.3)<1e-10);assert.equal(p.rangeDenom,'quote_por_base');
  chat.responder('Fecha pool SOL/HYPE na M2R');chat.responder('confirmar');chat.responder(q);chat.responder('confirmar');
  assert.notEqual(w.DeFiStore.poolsDeTodasCarteiras()[0].pool.id,p.id);assert.equal(w.DeFiStore.closed().length,1);
});
test('saldo insuficiente, carteira ambígua e cancelamento não gravam',()=>{
  const {w,a,chat}=setup();assert.match(chat.responder('Fiz swap de 20 SOL por 1 HYPE na M2R'),/insuficiente/i);
  assert.match(chat.responder('cancelar'),/cancelad/i);
  assert.match(chat.responder('Fiz swap de 1 SOL por 5 HYPE'),/carteira/i);chat.responder('cancelar');
  assert.equal(w.AtlasCaixa.saldo(a.id),1000);
});
test('operações misturadas e correção incompleta não confirmam rascunho antigo',()=>{
 const {w,a,chat}=setup();chat.responder('Fiz swap de 1 SOL por 5 HYPE na M2R');
 assert.match(chat.responder('Na verdade 2 SOL'),/dois lados/);assert.equal(chat.responder('confirmar'),null);
 assert.match(chat.responder('Fecha pool SOL/HYPE na M2R e abre pool SOL/HYPE na Orca'),/uma operação/);
 assert.equal(chat.pendente(),false);assert.equal(w.AtlasCaixa.saldo(a.id),1000);
});
test('saldo alterado após prévia é revalidado antes de registrar',()=>{
 const {w,a,b,chat}=setup();chat.responder('Transferi 2 SOL da M2R para M2P');
 w.AtlasCaixa.registrar({tipo:'saque',walletId:a.id,ativo:'SOL',qtd:9,valorUSD:900,rede:'Solana'});
 assert.match(chat.responder('confirmar'),/insuficiente/);assert.equal(w.AtlasCaixa.saldo(b.id),0);
});
test('correção de transferência usa quantidade mais recente',()=>{
 const {w,a,b,chat}=setup();chat.responder('Transferi 1 SOL da M2R para M2P');
 assert.match(chat.responder('Na verdade 2 SOL'),/Transferir 2 SOL/);chat.responder('confirmar');
 assert.equal(w.AtlasCaixa.saldo(a.id),800);assert.equal(w.AtlasCaixa.saldo(b.id),200);
});
test('correção de protocolo fecha posição exata e resumo inclui identidade',()=>{
 const {w,chat}=setup();for(const protocol of ['Orca','Uniswap'])w.DeFiStore.addPool({walletId:w.AtlasWallets.all()[0].id,base:'SOL',quote:'HYPE',protocol,chain:'Solana',capital:100,currentValue:100,status:'aberta'});
 chat.responder('Fecha posição SOL/HYPE na Orca na M2R');assert.match(chat.responder('Na verdade na Uniswap'),/Uniswap.*ID/);chat.responder('confirmar');
 assert.equal(w.DeFiStore.poolsDeTodasCarteiras()[0].pool.protocol,'Orca');
});
