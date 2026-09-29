const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const code=fs.readFileSync(__dirname+'/assistente-api.js','utf8');
function setup(overrides={}){
  const calls=[];const win={
    ATLAS_SUPABASE:{url:'https://project.supabase.co',publishableKey:'publishable'},
    firebase:{auth:()=>({currentUser:{getIdToken:async()=> 'firebase-token'}})},
    fetch:async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>({answer:'Texto da IA',model:'openrouter/free'})};},
    ...overrides
  };
  vm.runInNewContext(fs.readFileSync(__dirname+'/assistente-dados.js','utf8'),{window:win});
  vm.runInNewContext(code,{window:win,fetch:(...args)=>win.fetch(...args)});
  return {api:win.ScannerIA,calls,win};
}
const pool=(id,pool='SOL/USDC',more={})=>({id,sid:'pool:'+id,pool,network:'Solana',platform:'Orca',tvl:100000,vol24h:200000,fee:.3,nota:70,updatedAt:Date.UTC(2026,8,27),...more});
const context=pools=>({pools,trilho:p=>p.oculta?'oculta':'solida',status:{doCache:false}});
test('classificação de segurança vira falha para preservar fallback local mesmo com função antiga',async()=>{
  const {api}=setup({fetch:async()=>({ok:true,json:async()=>({answer:'User Safety: safe'})})});
  await assert.rejects(api.responder('Liste minhas favoritas',context([]),{tipo:'lista',texto:'Favorita SOL/USDC'}),/Resultado local preservado/);
});
test('sem sessão Firebase não chama gateway nem usa chave no browser',async()=>{
  const {api,calls}=setup({firebase:{auth:()=>({currentUser:null})}});
  const r=await api.responder('Qual pool?',context([pool(1)]),{tipo:'ajuda',texto:'local'});
  assert.equal(r.disponivel,false);assert.equal(calls.length,0);
});
test('chamada autenticada envia no máximo 30 candidatas, não só a página visual',async()=>{
  const {api,calls}=setup();const ps=Array.from({length:40},(_,i)=>pool(i));
  const r=await api.responder('Qual pool?',context(ps),{tipo:'ajuda',items:[],texto:'lista'});
  assert.equal(r.answer,'Texto da IA');assert.equal(calls.length,1);
  const body=JSON.parse(calls[0].init.body);assert.equal(body.pools.length,30);assert.equal(body.totalElegiveis,40);
  assert.equal(calls[0].init.headers.Authorization,'Bearer firebase-token');assert.ok(!JSON.stringify(body).includes('firebase-token'));
});
test('prioriza a pool citada na pergunta e preserva resultado determinístico',async()=>{
  const {api,calls}=setup();const ps=[...Array.from({length:35},(_,i)=>pool(i)),pool(99,'UNI/WETH')];
  await api.responder('E a UNI?',context(ps),{tipo:'meta',items:[{id:99,pool:ps.at(-1)}],texto:'Referência US$ 2,00'});
  const body=JSON.parse(calls[0].init.body);assert.equal(body.pools[0].id,'pool:99');assert.match(body.localAnswer,/US\$ 2,00/);
});
test('exclui inelegíveis e migradas antes de enviar contexto',async()=>{
  const {api,calls}=setup();const ps=[pool(1),pool(2,'SOL/USDC',{tvl:22}),pool(3,'SOL/USDC',{oculta:true}),pool(4,'SOL/USDC',{migrada:'pool:1'})];
  await api.responder('Liste pools',context(ps),{tipo:'ajuda',items:[],texto:'Lista'});
  assert.equal(JSON.parse(calls[0].init.body).pools.length,1);
});
test('consulta de meta envia somente candidatas aprovadas pelo cálculo local',async()=>{
  const {api,calls}=setup();const chosen=pool(1),emissions=pool(2,'SOL/USDC',{platform:'Aerodrome'});
  await api.responder('Quais pools geram 2 dólares?',context([chosen,emissions]),{tipo:'meta',items:[{id:1,pool:chosen,estimativa:2}],texto:'Só a pool 1 atende.'});
  const body=JSON.parse(calls[0].init.body);assert.deepEqual(body.pools.map(p=>p.id),['pool:1']);assert.equal(body.totalElegiveis,1);
});
test('sem configuração do Supabase devolve indisponível para fallback local',async()=>{
  const {api,calls}=setup({ATLAS_SUPABASE:null});const r=await api.responder('Olá',context([]),{tipo:'ajuda',texto:'local'});
  assert.equal(r.disponivel,false);assert.equal(calls.length,0);
});
test('salvar memória e feedback usam sessão, sem chave de modelo ou chamada de chat',async()=>{
  const {api,calls}=setup();assert.equal(typeof api.salvarMemoria,'function');
  await api.salvarMemoria({evitarMemes:true,redes:['Base'],pares:[],notas:'Prefiro crossover'});
  await api.avaliar({rating:'corrigir',question:'Qual pool?',answer:'A',comment:'A categoria é desconhecida'});
  assert.deepEqual(calls.map(x=>JSON.parse(x.init.body).operation),['memory.set','feedback']);
  assert.ok(calls.every(x=>x.init.headers.Authorization==='Bearer firebase-token'));
});

test('contexto de pergunta livre respeita par, rede e favoritas antes de enviar',async()=>{
  const {api}=setup();const c=context([pool(1,'HYPE/SOL',{fav:true}),pool(2,'SOL/USDC',{fav:true}),pool(3,'SOL/HYPE',{fav:false})]);
  const r=api.contexto('Compare minhas favoritas SOL/HYPE na Solana sem memes',c,{tipo:'ajuda',items:[]});
  assert.deepEqual(r.pools.map(p=>p.id),['pool:1']);
});

test('par de interesse chega ao modelo mesmo com mais de 30 candidatas por nota',()=>{
  const {api}=setup(),c=context([...Array.from({length:35},(_,i)=>pool(i,'QNT/USDC',{nota:90})),pool(99,'BTC/ETH',{nota:10})]);
  c.preferencias={pares:['ETH/BTC']};const r=api.contexto('O que combina com meus critérios?',c,{tipo:'ajuda',items:[]});
  assert.equal(r.pools[0].id,'pool:99');assert.equal(r.totalElegiveis,36);assert.equal(r.pools.length,30);
});
test('oportunidades informam o universo examinado e enviam somente a lista calculada',async()=>{
  const {api,win}=setup();const ps=Array.from({length:40},(_,i)=>pool(i,'QNT/USDC',{tvl:250000,vol24h:500000}));
  ps.push(pool(99,'SOL/USDC',{tvl:300000,vol24h:600000}));
  const c=context(ps);c.preferencias={estrategia:{versao:1,tvlMinUsd:200000,volume24hMinUsd:400000,razao24hMin:0.5,tokensFavoritos:['SOL'],maxResultados:8}};
  const r=await win.ScannerConsultas.consultar('Melhores oportunidades?',c);
  const enviado=api.contexto('Melhores oportunidades?',c,r);
  assert.equal(enviado.totalElegiveis,41);assert.equal(enviado.pools.length,8);assert.equal(enviado.pools[0].id,'pool:99');
});
