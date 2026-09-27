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
