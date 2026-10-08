const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function load(){
  const dados=new Map();
  const window={localStorage:{getItem:k=>dados.has(k)?dados.get(k):null,setItem:(k,v)=>dados.set(k,v)}};
  vm.runInNewContext(fs.readFileSync(__dirname+'/assistente-conversas.js','utf8'),{window,Date,Math,JSON});
  return window.ScannerConversas;
}
const H=3600000, T0=Date.UTC(2026,9,8,12);
test('conversa salva com título da primeira pergunta e volta ao recarregar',()=>{
  const C=load(); let lista=C.carregar(T0);
  const c=C.nova({},T0); c.mensagens.push({role:'user',text:'pools de SOL'},{role:'assistant',text:'ok',items:[{pool:{pool:'SOL/USDC',platform:'Orca',network:'Solana',history:[1,2,3],tvl:1}}]});
  lista=C.salvar(lista,c,T0);
  const de_novo=C.carregar(T0+H);
  assert.equal(de_novo.length,1);assert.equal(de_novo[0].titulo,'pools de SOL');
  assert.equal(de_novo[0].mensagens[1].items[0].pool.pool,'SOL/USDC');
  assert.equal(de_novo[0].mensagens[1].items[0].pool.history,undefined);   // guardada enxuta
});
test('temporária some 24 h depois de criada; a normal fica',()=>{
  const C=load(); let lista=[];
  const t=C.nova({temporaria:true},T0); t.mensagens.push({role:'user',text:'teste'});
  const n=C.nova({},T0); n.mensagens.push({role:'user',text:'fica'});
  lista=C.salvar(lista,t,T0); lista=C.salvar(lista,n,T0);
  assert.equal(C.carregar(T0+23*H).length,2);
  assert.equal(C.restante(t,T0+23*H),'expira em 1 h');
  assert.equal(C.restante(t,T0+23.5*H),'expira em 30 min');
  const depois=C.carregar(T0+24*H);
  assert.deepEqual(depois.map(c=>c.titulo),['fica']);
});
test('conversa vazia não é salva e apagar remove',()=>{
  const C=load(); let lista=C.salvar([],C.nova({},T0),T0);
  assert.equal(lista.length,0);
  const c=C.nova({},T0); c.mensagens.push({role:'user',text:'a'}); lista=C.salvar(lista,c,T0);
  lista=C.apagar(lista,c.id); assert.equal(C.carregar(T0).length,0);
});
