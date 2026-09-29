const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('aprovações enviadas antes da resposta visual não são enfileiradas para um estado futuro',async()=>{
 const source=fs.readFileSync('core/ui/atlas-shell.js','utf8'),a=source.indexOf('    function ask(q, arquivo) {'),b=source.indexOf('    /* ------------------------------------------------',a);assert.ok(a>0&&b>a);
 let release;const gateway=new Promise(resolve=>release=resolve),messages=[],used=[],send={},review={};
 const context=vm.createContext({window:{AtlasOraculoImagem:{pendente:()=>false,ler:async()=>gateway,responder:async q=>{used.push(q);return 'resposta';}}},wrap:{querySelector:()=>send},botaoRevisar:review,setOpen(){},push:(r,who)=>messages.push({r,who}),normalizar:String,perguntadas:{},filaOperacoes:Promise.resolve(),carregarImagem:async()=>{},carregarOperacoes:async()=>{},RAIZ:'',renderChips(){},responder:()=>'',Promise});context.AtlasOraculoImagem=context.window.AtlasOraculoImagem;
 vm.runInContext(source.slice(a,b),context);context.ask('Leia este print',{type:'image/png'});await new Promise(r=>setImmediate(r));assert.equal(send.disabled,true);
 context.ask('sim');context.ask('M2R');context.ask('sim');assert.equal(messages.filter(x=>String(x.r).includes('não foi usada como aprovação')).length,3);
 release('Entendi uma pool. Confirma a leitura?');await context.filaOperacoes;assert.deepEqual(used,[]);assert.equal(context.window.AtlasOraculoImagemEmProcessamento,false);assert.equal(send.disabled,false);
});
