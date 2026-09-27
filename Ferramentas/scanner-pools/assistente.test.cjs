const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{}};
if(fs.existsSync(__dirname+'/assistente-dados.js')) vm.runInNewContext(fs.readFileSync(__dirname+'/assistente-dados.js','utf8'),context);
const C=context.window.ScannerConsultas;
const pool=(id,extra={})=>({id,sid:'pool:'+id,pool:'SOL/USDC',network:'Solana',platform:'Orca',tvl:100000,vol24h:1000000,fee:.3,updatedAt:Date.UTC(2026,8,27),...extra});
const ctx=(pools,extra={})=>({pools,trilho:p=>p.rejected?'oculta':p.pending?'caca':'solida',agora:Date.UTC(2026,8,27),...extra});
test('consulta além da página e não sugere rejeitadas, pendentes ou liquidez insuficiente',async()=>{
  assert.ok(C,'motor de consultas ainda não implementado');
  const r=await C.consultar('Quais pools para fazer 2 a 3 dólares em um dia com 100 dólares?',ctx([pool(1,{rejected:true}),pool(2,{tvl:99999}),pool(3,{pending:true}),pool(4),pool(5,{migrada:'pool:4'}),pool(6,{arquivada:true})]));
  assert.equal(r.tipo,'meta'); assert.equal(r.items.length,1); assert.equal(r.items[0].id,4); assert.equal(r.items[0].estimativa,3);
});
test('valor de fee percentual e prazo produzem referência agregada sem inventar faixa',async()=>{
  assert.ok(C);const r=await C.consultar('2 a 3 dólares em dois dias com 100 dólares',ctx([pool(1,{vol24h:500000})]));
  assert.equal(r.items[0].estimativa,3); assert.match(r.texto,/agregada/i);assert.match(r.texto,/faixa/i);
});
test('pergunta sem capital não presume dinheiro do usuário',async()=>{
  assert.ok(C);const r=await C.consultar('Quais pools para ganhar 3 dólares em um dia?',ctx([pool(1)]));
  assert.equal(r.tipo,'esclarecimento');assert.match(r.texto,/capital/i);
});
test('histórico de favoritas é buscado mesmo sem gráfico aberto e preserva datas diárias',async()=>{
  assert.ok(C);const calls=[];
  const r=await C.consultar('Quais favoritas aumentaram o TVL nos últimos dois dias?',ctx([pool(1,{fav:true}),pool(2)],{historico:async p=>{calls.push(p.id);return [{dia:'2026-09-25',tvl:100000},{dia:'2026-09-27',tvl:120000}];}}));
  assert.deepEqual(calls,[1]);assert.equal(r.items[0].delta,20000);assert.equal(r.items[0].pct,20);assert.match(r.texto,/2026-09-25/);
});
test('sem base no período não fabrica evolução; falha parcial não oculta resultado válido',async()=>{
  assert.ok(C);const r=await C.consultar('TVL das favoritas nos últimos 2 dias',ctx([pool(1,{fav:true}),pool(2,{fav:true}),pool(3,{fav:true})],{historico:async p=>{
    if(p.id===1)throw Error('rede');if(p.id===2)return [{dia:'2026-09-27',tvl:120000}];
    return [{dia:'2026-09-25',tvl:100000},{dia:'2026-09-27',tvl:110000}];
  }}));assert.equal(r.items.length,1);assert.equal(r.indisponiveis,2);assert.match(r.texto,/insuficiente|indisponível/i);
});
test('cenário conservador exclui meme sem transformar SOL em meme e não certifica sem dados',async()=>{
  assert.ok(C);const r=await C.consultar('Quais pools conservadoras?',ctx([pool(1,{sinais:{memecoin:{detectada:true}}}),pool(2)]));
  assert.equal(r.items.length,1);assert.equal(r.items[0].id,2);assert.match(r.texto,/faixa|montagem/i);
});
test('protocolo de emissões não usa fee bruto como taxa recebida pelo LP',async()=>{
  assert.ok(C);const r=await C.consultar('2 a 3 dólares em um dia com 100 dólares',ctx([pool(1,{platform:'Aerodrome'})]));assert.equal(r.items.length,0);
});
test('pergunta não suportada não inventa resposta e cache é sinalizado',async()=>{
  assert.ok(C);const r=await C.consultar('Qual será o preço de SOL amanhã?',ctx([pool(1)],{status:{doCache:true}}));
  assert.equal(r.tipo,'ajuda');assert.match(r.texto,/cache/i);
});
test('histórico antigo não responde últimos dois dias como dado atual',async()=>{
  const r=await C.consultar('Qual a diferença do TVL das minhas favoritas nos últimos 2 dias?',ctx([pool(1,{fav:true})],{historico:async()=>[{dia:'2026-08-25',tvl:100000},{dia:'2026-08-27',tvl:120000}]}));
  assert.equal(r.tipo,'historico');assert.equal(r.items.length,0);assert.match(r.texto,/desatualizad|insuficiente/i);
});
test('filtro de rede Sui não mistura pools de outras redes',async()=>{
  const r=await C.consultar('Liste pools na Sui',ctx([pool(1),pool(2,{network:'Sui'})]));
  assert.equal(r.items.length,1);assert.equal(r.items[0].id,2);
});
test('memória confirmada exclui meme e redes fora da preferência, exceção explícita não altera memória',async()=>{
  const prefs={evitarMemes:true,redes:['Base']};
  const c=ctx([pool(1,{network:'Base'}),pool(2,{network:'Base',sinais:{memecoin:{detectada:true}}}),pool(3)],{preferencias:prefs});
  const r=await C.consultar('Liste pools',c);assert.deepEqual(Array.from(r.items,x=>x.id),[1]);
  const except=await C.consultar('Liste pools com meme como exceção nesta análise',c);assert.deepEqual(Array.from(except.items,x=>x.id),[1,2]);assert.equal(prefs.evitarMemes,true);
});
test('pedidos negativos de meme nunca são interpretados como exceção afirmativa',async()=>{
  for(const pref of [null,{evitarMemes:true},{evitarMemes:false}])for(const q of ['Liste pools sem memecoins','Não quero memes nas pools','Liste pools, exclua os memes']){
    const r=await C.consultar(q,ctx([pool(1),pool(2,{sinais:{memecoin:{detectada:true}}})],{preferencias:pref}));
    assert.deepEqual(Array.from(r.items,x=>x.id),[1],q);
  }
});
