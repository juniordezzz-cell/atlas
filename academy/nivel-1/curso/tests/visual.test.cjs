// Piloto visual (21/10/2026): palco à direita, cena "cadeia", interativo "hash" e trilha.
// Sem WebGL nem GSAP no jsdom: confere o caminho sem 3D, que é o do plano B.
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=require('node:path').resolve(__dirname,'..');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const html=fs.readFileSync(root+'/index.html','utf8');
const dom=new JSDOM(html,{url:'https://atlas.test/index.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,d=w.document;w.TextEncoder=TextEncoder;Object.defineProperty(w,'crypto',{value:require('node:crypto').webcrypto});w.matchMedia=()=>({matches:false});w.scrollTo=()=>{};
w.Chart=class{constructor(c,o){this.data=o.data}update(){}resize(){}destroy(){}};
const ctx=dom.getInternalVMContext(),ev=code=>vm.runInContext(code,ctx);
const files=[...html.matchAll(/<script[^>]*\ssrc="(assets\/[^"]+)"/g)].map(x=>x[1]).filter(f=>f!=='assets/vendor/chart.umd.js');
for(const f of files)vm.runInContext(fs.readFileSync(root+'/'+f,'utf8'),ctx,{filename:f});
const tick=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let n=0;
 await tick(100);ev('academy.init()');
 // Visão geral: fileira de botões dos 10 módulos, sem 3D quando não há WebGL.
 ev("app.navigate('dashboard')");
 const bl=d.querySelectorAll('.trilha .trilha-bloco');assert.equal(bl.length,10);n++;
 assert.ok(!d.querySelector('.trilha').classList.contains('com-3d'));n++;
 bl[2].click();assert.equal(ev('app.currentView'),'m3');n++;
 // Módulo 1: toda aula com figura/cena/interativo ganha a coluna do palco.
 ev("app.navigate('m1')");
 const aulas=[...d.querySelectorAll('#tab-content .lesson')];
 for(const a of aulas){const v=a.querySelectorAll(':scope > .aula-visual');assert.equal(a.classList.contains('tem-visual'),v.length===1,a.id);assert.ok(v.length<=1,a.id);n++;}
 assert.ok(aulas.filter(a=>a.classList.contains('tem-visual')).length>=11);n++;
 // Bloco visual nunca fica fora do palco.
 assert.equal(d.querySelectorAll('#tab-content .lesson > figure').length,0);n++;
 // Interativo hash: SHA-256 de verdade e contagem do que mudou.
 const h=d.querySelector('.aula-interativo[data-interativo="hash"]');assert.ok(h);n++;
 await tick(250);
 assert.equal(h.querySelector('.hash-saida').textContent,'d8cb797dbff3cd588ba2e727b168af10465aad8114f8e512541b1af4f50e65cc');n++;
 const inp=h.querySelector('.hash-entrada');inp.value='Alice envia 2';inp.dispatchEvent(new w.Event('input'));await tick(250);
 assert.equal(h.querySelector('.hash-saida').textContent,'a4ffc6189c0c1f67b5ea6bcf3db0986dc5ec416e822ceb252b133a5f81c12909');n++;
 const marks=h.querySelectorAll('.hash-saida mark').length;assert.ok(marks>40);n++;
 assert.equal(h.querySelector('.hash-mudou').textContent,marks+' de 64 caracteres mudaram.');n++;
 // Texto digitado entra como texto, nunca como marcação.
 inp.value='<img src=x onerror=alert(1)>';inp.dispatchEvent(new w.Event('input'));await tick(250);
 assert.equal(h.querySelector('.hash-saida img'),null);assert.match(h.querySelector('.hash-saida').textContent,/^[0-9a-f]{64}$/);n++;
 // Cena cadeia sem WebGL: os dois SVGs se alternam e os botões trocam de estado.
 const c=d.querySelector('.aula-cena[data-cena="cadeia"]');assert.ok(c);n++;
 const alt=c.querySelector('[data-acao="alterar"]'),res=c.querySelector('[data-acao="restaurar"]');
 assert.ok(!c.querySelector('.plano-inteira').hidden&&c.querySelector('.plano-quebrada').hidden&&res.disabled);n++;
 alt.click();
 assert.ok(c.querySelector('.plano-inteira').hidden&&!c.querySelector('.plano-quebrada').hidden&&alt.disabled&&!res.disabled);n++;
 assert.match(c.querySelector('.cena-estado').textContent,/9b04.*c71e/);n++;
 res.click();assert.ok(!c.querySelector('.plano-inteira').hidden&&!alt.disabled);n++;
 // SVG da cadeia segue as regras das figuras (aparece duas vezes: sem id=).
 for(const q of [false,true]){const s=ev('AcademyRender.cadeiaSvg('+q+')');assert.ok(/^<svg/.test(s)&&!/\sid\s*=/.test(s)&&!/<script/i.test(s));n++;}
 assert.ok(ev('AcademyRender.cadeiaSvg(true)').includes('9b04')&&!ev('AcademyRender.cadeiaSvg(false)').includes('9b04'));n++;
 // Kind vem escapado no atributo.
 assert.ok(!ev(`AcademyRender.block({t:'scene',kind:'"><b>x',caption:'c',alt:'a'})`).includes('"><b>'));n++;
 // Índice ganhou a barra de progresso.
 assert.ok(d.querySelector('.lesson-toc .aula-progresso i'));n++;
 // ===== Módulo 2: toda aula principal tem visual, e cada interativo responde. =====
 ev("app.navigate('m2')");
 const principais=[...d.querySelectorAll('#tab-content > .lesson-layout > div > .lesson')];
 assert.equal(principais.length,12);n++;
 for(const a of principais){assert.ok(a.classList.contains('tem-visual'),a.id);n++;}
 const fig=k=>d.querySelector('.aula-interativo[data-interativo="'+k+'"]');
 const clica=(f,a)=>f.querySelector('[data-acao="'+a+'"]').click();
 const muda=(el,v)=>{el.value=String(v);el.dispatchEvent(new w.Event('input'));};
 // Papéis e transação: passo a passo.
 assert.match(fig('papeis').querySelector('.cena-estado').textContent,/^1 de 4/);clica(fig('papeis'),'proximo');
 assert.match(fig('papeis').querySelector('.cena-estado').textContent,/^2 de 4/);assert.ok(fig('papeis').querySelector('.p-no').classList.contains('aceso'));n+=2;
 clica(fig('transacao'),'proximo');clica(fig('transacao'),'proximo');
 assert.equal(fig('transacao').querySelector('.t-status-valor').textContent,'enviada');n++;
 assert.ok(fig('transacao').querySelector('[data-acao="anterior"]').disabled===false);n++;
 // Mineração: com 1 zero, acha rápido e o hash confere.
 const mi=fig('mineracao');mi.querySelector('.m-dif').value='1';mi.querySelector('.m-dif').dispatchEvent(new w.Event('change'));
 clica(mi,'minerar');for(let k=0;k<40&&!mi.classList.contains('m-ok');k++)await tick(50);
 assert.ok(mi.classList.contains('m-ok'));assert.match(mi.querySelector('.m-hash').textContent,/^0[0-9a-f]{63}$/);n+=2;
 const crypto=require('node:crypto');
 assert.equal(crypto.createHash('sha256').update(mi.querySelector('.m-dados').value+mi.querySelector('.m-nonce').textContent).digest('hex'),mi.querySelector('.m-hash').textContent);n++;
 // Validadores: 100 sorteios somam 100; trapaça expulsa Caio.
 const va=fig('validadores');clica(va,'sortear100');
 assert.equal([...va.querySelectorAll('.v-sorteios')].reduce((s,t)=>s+parseInt(t.textContent,10),0),100);n++;
 clica(va,'trapaca');assert.ok(va.querySelector('.v-2').classList.contains('punido'));assert.match(va.querySelector('.v-2 .v-valor').textContent,/expulso/);n+=2;
 // Reorganização: B passa A.
 const re=fig('reorg');assert.ok(!re.classList.contains('r-reorg'));clica(re,'b');clica(re,'b');
 assert.ok(re.classList.contains('r-reorg'));assert.match(re.querySelector('.cena-estado').textContent,/volta para a fila/);n+=2;
 clica(re,'recomecar');assert.ok(!re.classList.contains('r-reorg'));n++;
 // UTXO: pagar 0,6 gasta 0,5 + 0,3 e devolve 0,1999.
 const ut=fig('utxo');muda(ut.querySelector('.u-valor'),0.6);
 assert.equal(ut.querySelector('.u-troco').textContent,'troco: 0,1999');assert.equal(ut.querySelector('.u-conta').textContent,'saldo depois: 0,3999');n+=2;
 assert.deepEqual([...ut.querySelectorAll('.u-nota')].map(g=>g.classList.contains('gasta')),[true,true,false]);n++;
 // Taxas: 20 entra, 1 fica na fila; na hora de pico, 5 não basta.
 const tx=fig('taxas'),tr=tx.querySelector('.x-taxa');
 muda(tr,20);assert.ok(tx.querySelector('.x-vaga.minha'));n++;
 muda(tr,1);assert.equal(tx.querySelector('.x-vaga.minha'),null);assert.match(tx.querySelector('.x-fila').textContent,/você \(1\)/);n+=2;
 muda(tr,7);assert.ok(tx.querySelector('.x-vaga.minha'));clica(tx,'pico');assert.equal(tx.querySelector('.x-vaga.minha'),null);n+=2;
 // Oráculo: 0,5% não atualiza; 2% atualiza; 24 h atualiza.
 const or=fig('oraculo'),ofo=or.querySelector('.o-fora');
 muda(ofo,100.5);assert.equal(or.querySelector('.o-dentro').textContent,'100,00');n++;
 muda(ofo,102);assert.equal(or.querySelector('.o-dentro').textContent,'102,00');n++;
 muda(ofo,102.5);for(let k=0;k<24;k++)clica(or,'hora');assert.equal(or.querySelector('.o-dentro').textContent,'102,50');assert.match(or.querySelector('.cena-estado').textContent,/24 h/);n+=2;
 // Cena camadas sem WebGL: fica o SVG.
 const ca=d.querySelector('.aula-cena[data-cena="camadas"]');assert.ok(ca&&ca.querySelector('.cena-plano svg'));assert.ok(!ca.classList.contains('com-3d'));n+=2;
 // Laboratórios antigos do M2 continuam abrindo.
 ev("app.switchTab('labs')");assert.ok(d.querySelector('#tab-labs .legacy-labs'));n++;
 assert.deepEqual(errors,[]);n++;
 console.log('visual ok: '+n+' verificações');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
