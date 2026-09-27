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
  vm.runInNewContext(code,{window:win,fetch:(...args)=>win.fetch(...args)});
  return {api:win.ScannerIA,calls,win};
}
const pool=(id,pool='SOL/USDC',more={})=>({id,sid:'pool:'+id,pool,network:'Solana',platform:'Orca',tvl:100000,vol24h:200000,fee:.3,nota:70,updatedAt:Date.UTC(2026,8,27),...more});
const context=pools=>({pools,trilho:p=>p.oculta?'oculta':'solida',status:{doCache:false}});
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
