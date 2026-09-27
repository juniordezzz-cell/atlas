import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from './handler.mjs';

const ORIGIN='https://juniordezzz-cell.github.io';
const config={SCANNER_OPENROUTER_API_KEY:'or-test',SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-test'};
function setup(options={}){
  const calls=[];
  const fetcher=async (url,init)=>{
    calls.push({url:String(url),init});
    if(String(url).includes('accounts:lookup'))return Response.json({users:[{localId:'uid-1',email:'juniordezzz@gmail.com',emailVerified:true}]});
    if(String(url).includes('scanner_chat_reserve'))return Response.json(1);
    if(String(url).includes('openrouter.ai'))return Response.json({choices:[{message:{content:'Análise baseada nos dados enviados.'}}],model:'free-test',usage:{total_tokens:24}});
    throw Error('unexpected URL '+url);
  };
  const env={get:k=>options.env?.[k]??config[k]??null};
  return {handler:createHandler({env,fetcher:options.fetcher||fetcher}),calls};
}
function request(body={question:'Qual pool combina com meus critérios?',localAnswer:'Lista de pools',pools:[]},headers={}){
  return new Request('https://project.supabase.co/functions/v1/scanner-chat',{method:'POST',headers:{Origin:ORIGIN,Authorization:'Bearer firebase-token','Content-Type':'application/json',...headers},body:JSON.stringify(body)});
}
test('rejeita sem token antes de chamar Google ou OpenRouter',async()=>{
  const {handler,calls}=setup();const r=await handler(request(undefined,{Authorization:''}));assert.equal(r.status,401);assert.equal(calls.length,0);
});
test('rejeita origem não autorizada antes de chamar provedor',async()=>{
  const {handler,calls}=setup();const r=await handler(request(undefined,{Origin:'https://evil.example'}));assert.equal(r.status,403);assert.equal(calls.length,0);
});
test('token não verificado ou email não permitido bloqueia a chamada ao modelo',async()=>{
  const {handler,calls}=setup({fetcher:async (url,init)=>{calls.push({url:String(url),init});return Response.json({users:[{localId:'u',email:'other@example.com',emailVerified:true}]});}});
  const r=await handler(request());assert.equal(r.status,403);assert.equal(calls.length,1);
});
test('sem chave configurada responde indisponível sem reservar quota',async()=>{
  const {handler,calls}=setup({env:{SCANNER_OPENROUTER_API_KEY:''}});
  const r=await handler(request());assert.equal(r.status,503);assert.equal(calls.length,1);
});
test('valida tamanho e formato antes de usar token de modelo',async()=>{
  const {handler,calls}=setup();const r=await handler(request({question:'x'.repeat(1500),pools:[]}));assert.equal(r.status,400);assert.equal(calls.length,0);
});
test('quota esgotada bloqueia OpenRouter',async()=>{
  const calls=[];const {handler}=setup({fetcher:async (url,init)=>{calls.push(String(url));if(String(url).includes('accounts:lookup'))return Response.json({users:[{localId:'u',email:'juniordezzz@gmail.com',emailVerified:true}]});return Response.json(-1);}});
  const r=await handler(request());assert.equal(r.status,429);assert.equal(calls.length,2);
});
test('usa Authorization no RPC apenas para chave JWT legada',async()=>{
  const legacy=setup({env:{SUPABASE_SERVICE_ROLE_KEY:'eyJlegacy'}});
  assert.equal((await legacy.handler(request())).status,200);
  assert.equal(legacy.calls.find(x=>x.url.includes('scanner_chat_reserve')).init.headers.Authorization,'Bearer eyJlegacy');
  const modern=setup({env:{SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_test'})}});
  assert.equal((await modern.handler(request())).status,200);
  assert.equal(modern.calls.find(x=>x.url.includes('scanner_chat_reserve')).init.headers.Authorization,undefined);
});
test('chama somente openrouter/free com contexto limitado, uma vez, e não devolve a chave',async()=>{
  const {handler,calls}=setup();const pools=Array.from({length:50},(_,i)=>({id:'p'+i,par:'SOL/USDC',tvl:100000,vol24h:200000,fee:.3,nota:70}));
  const r=await handler(request({question:'Quais pools?',localAnswer:'50 pools',pools}));assert.equal(r.status,200);
  const out=await r.json();assert.match(out.answer,/Análise/);assert.ok(!JSON.stringify(out).includes('or-test'));
  const call=calls.find(x=>x.url.includes('openrouter.ai'));assert.ok(call);const payload=JSON.parse(call.init.body);
  assert.equal(payload.model,'openrouter/free');assert.ok(payload.max_tokens<=600);assert.ok(payload.messages[1].content.length<16000);assert.equal(calls.filter(x=>x.url.includes('openrouter.ai')).length,1);
});
test('erro de OpenRouter devolve falha clara sem vazar detalhes sensíveis',async()=>{
  const calls=[];const {handler}=setup({fetcher:async (url,init)=>{calls.push(String(url));if(String(url).includes('accounts:lookup'))return Response.json({users:[{localId:'u',email:'juniordezzz@gmail.com',emailVerified:true}]});if(String(url).includes('scanner_chat_reserve'))return Response.json(1);return new Response('provider secret diagnostic',{status:429});}});
  const r=await handler(request());assert.equal(r.status,429);assert.ok(!(await r.text()).includes('provider secret diagnostic'));
});
test('status indica se chave está configurada, sem devolver seu valor',async()=>{
  const {handler,calls}=setup();const r=await handler(new Request('https://project.supabase.co/functions/v1/scanner-chat',{headers:{Origin:ORIGIN}}));
  assert.equal(r.status,200);assert.deepEqual(await r.json(),{enabled:true,model:'openrouter/free'});assert.equal(calls.length,0);
});
