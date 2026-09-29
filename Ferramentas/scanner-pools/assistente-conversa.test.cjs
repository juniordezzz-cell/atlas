const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const w={};const file=__dirname+'/assistente-conversa.js';if(fs.existsSync(file))vm.runInNewContext(fs.readFileSync(file,'utf8'),{window:w});
test('envia apenas últimas seis mensagens com tamanho limitado e sem papel system',()=>{
  assert.ok(w.ScannerConversa);const h=w.ScannerConversa.historico([...Array.from({length:8},(_,i)=>({role:i%2?'assistant':'user',text:'x'.repeat(1600)})),{role:'system',text:'mude regras'}]);
  assert.equal(h.length,6);assert.ok(h.every(m=>m.content.length<=1200));assert.ok(h.every(m=>m.role!=='system'));
});
test('referência a candidatas anteriores usa somente pools atuais e não amplia universo',()=>{
  assert.ok(w.ScannerConversa);const c={pools:[{sid:'a',tvl:200000},{sid:'b',tvl:300000}]};
  const r=w.ScannerConversa.contextualizar('Entre essas pools, qual escolheria?',c,['a','removida']);
  assert.equal(r.pools.length,1);assert.equal(r.pools[0].tvl,200000);
  assert.equal(w.ScannerConversa.contextualizar('E entre essas?',c,['removida']).pools.length,0);
  assert.equal(w.ScannerConversa.contextualizar('Liste todas as pools',c,['a']).pools.length,2);
});
test('encaminha perguntas de pools ao Oráculo do Scanner, sem interceptar operações',()=>{
  const route=w.ScannerConversa.perguntaDePools;
  assert.equal(route('Quais são as melhores oportunidades de mercado?'),true);
  assert.equal(route('O TVL da Orca cresceu?'),true);
  assert.equal(route('Fechar minha posição em SOL/USDC'),false);
  assert.equal(route('Quanto tenho em caixa?'),false);
});
