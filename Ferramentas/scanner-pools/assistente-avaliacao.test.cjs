// Avaliação reproduzível do motor de dados: não é um benchmark dos modelos gratuitos.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};for(const file of ['assistente-dados.js','assistente-conversa.js'])vm.runInNewContext(fs.readFileSync(__dirname+'/'+file,'utf8'),{window});
const pool=(id,extra={})=>({id,sid:'p:'+id,pool:'SOL/USDC',platform:'Orca',network:'Solana',tvl:100000,vol24h:1000000,fee:.3,nota:70,...extra});
const cases=[
  {name:'meta de taxas e limite inferior TVL',q:'Quais pools geram 2 a 3 dólares em um dia com 100 dólares?',pools:[pool(1),pool(2,{tvl:99999})],ids:[1],type:'meta',value:3},
  {name:'aprovação não ignora razão nem rejeição',q:'Liste pools',pools:[pool(1,{vol24h:50000}),pool(2,{rejected:true}),pool(3)],ids:[3],type:'lista'},
  {name:'preferência de rede confirmada',q:'Liste pools',prefs:{redes:['Base']},pools:[pool(1),pool(2,{network:'Base'})],ids:[2],type:'lista'},
  {name:'pedido explícito de outra rede é exceção temporária',q:'Liste pools na Solana',prefs:{redes:['Base']},pools:[pool(1),pool(2,{network:'Base'})],ids:[1],type:'lista'},
  {name:'conservadora continua sem meme mesmo numa exceção pessoal',q:'Liste pools conservadoras com meme',prefs:{evitarMemes:true},pools:[pool(1,{sinais:{memecoin:{detectada:true}}}),pool(2)],ids:[2],type:'lista'},
  {name:'sem capital pede esclarecimento',q:'Quais pools geram 3 dólares em um dia?',pools:[pool(1)],ids:[],type:'esclarecimento'},
  {name:'histórico ausente não vira crescimento',q:'Quais favoritas aumentaram o TVL em dois dias?',pools:[pool(1,{fav:true})],ids:[],type:'historico'},
];
for(const c of cases)test('avaliação: '+c.name,async()=>{
  const context={pools:c.pools,preferencias:c.prefs,trilho:p=>p.rejected?'oculta':'solida',historico:async()=>[]};
  const r=await window.ScannerConsultas.consultar(c.q,context);assert.equal(r.tipo,c.type);assert.deepEqual(Array.from(r.items,x=>x.id),c.ids);
  if(c.value)assert.equal(r.items[0].estimativa,c.value);
});
test('avaliação: continuidade não recupera favorita que saiu do universo atual',async()=>{
  const c=window.ScannerConversa.contextualizar('E dessas, qual escolheria?',{pools:[pool(2)],trilho:()=> 'solida'},['p:1']);
  const r=await window.ScannerConsultas.consultar('Liste essas pools',c);assert.equal(r.items.length,0);
});
test('oportunidades percorrem todas as elegíveis, aplicam JSON e preferem tokens escolhidos',async()=>{
  const ps=Array.from({length:40},(_,i)=>pool(i,{pool:'QNT/USDC',nota:75,tvl:250000,vol24h:500000}));
  ps.push(pool(99,{pool:'SOL/USDC',nota:74,tvl:300000,vol24h:600000}));
  ps.push(pool(100,{pool:'UNI/USDC',nota:99,tvl:120000,vol24h:240000}));
  const estrategia={tvlMinUsd:200000,volume24hMinUsd:400000,razao24hMin:0.5,tokensFavoritos:['SOL','UNI'],maxResultados:8};
  const r=await window.ScannerConsultas.consultar('Quais as melhores oportunidades de mercado?',{pools:ps,preferencias:{estrategia},trilho:()=> 'solida'});
  assert.equal(r.tipo,'oportunidades');assert.equal(r.totalElegiveis,41);assert.equal(r.items.length,8);
  assert.equal(r.items[0].id,99);assert.ok(!r.items.some(x=>x.id===100));
  assert.match(r.texto,/41 pool\(s\)/);assert.match(r.texto,/SOL\/USDC/);
});

test('método: pares preferidos entram antes da redução, sem ultrapassar cortes',async()=>{
  const ps=Array.from({length:12},(_,i)=>pool(i,{nota:90,pool:'QNT/USDC'}));
  ps.push(pool(99,{pool:'BTC/ETH',nota:20}),pool(100,{pool:'ETH/BTC',tvl:22,nota:100}));
  const r=await window.ScannerConsultas.consultar('Liste pools',{pools:ps,preferencias:{pares:['ETH/BTC']},trilho:()=> 'solida'});
  assert.equal(r.items[0].id,99);assert.ok(!r.items.some(x=>x.id===100));assert.match(r.texto,/interesse/i);
});

test('método: par explícito filtra os dois tokens em qualquer ordem',async()=>{
  const r=await window.ScannerConsultas.consultar('Quais pools de SOL/HYPE?',{pools:[pool(1),pool(2,{pool:'HYPE/SOL'}),pool(3,{pool:'SOL/HYPER'})],trilho:()=> 'solida'});
  assert.deepEqual(Array.from(r.items,x=>x.id),[2]);
});

test('método: negar um par não o transforma em pedido de inclusão',async()=>{
  const r=await window.ScannerConsultas.consultar('Liste pools sem ETH/BTC',{pools:[pool(1),pool(2,{pool:'BTC/ETH'})],trilho:()=> 'solida'});
  assert.deepEqual(Array.from(r.items,x=>x.id),[1]);
});

test('método: negação cobre lista de pares e termina com inclusão explícita',async()=>{
  const c={pools:[pool(1),pool(2,{pool:'BTC/ETH'}),pool(3,{pool:'QNT/USDC'})],trilho:()=> 'solida'};
  const r=await window.ScannerConsultas.consultar('Liste pools sem SOL/USDC e ETH/BTC',c);
  assert.deepEqual(Array.from(r.items,x=>x.id),[3]);
  const sim=await window.ScannerConsultas.consultar('Liste pools sem SOL/USDC e com ETH/BTC',c);
  assert.deepEqual(Array.from(sim.items,x=>x.id),[2]);
});

test('método: regra local inclui exceções e referências mesmo sem IA',async()=>{
  const r=await window.ScannerConsultas.consultar('Explique as regras',{pools:[],trilho:()=> 'solida'});
  for(const rx of [/30%.*60%/s,/9%.*27%/s,/3%.*9%/s,/BTC.*ETH/s,/27%.*30%/s,/−6%\/\+6%/])assert.match(r.texto,rx);
});

test('resumo carregado e fallback local usam a mesma versão das regras',()=>{
  const regras=JSON.parse(fs.readFileSync(__dirname+'/assistente-regras.json','utf8'));
  assert.equal(regras.resumo,window.ScannerConsultas.regrasBase);
  assert.equal(regras.versao,'2026-09-29');
});
