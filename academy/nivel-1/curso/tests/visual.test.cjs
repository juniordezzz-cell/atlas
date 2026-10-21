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
 assert.deepEqual(errors,[]);n++;
 console.log('visual ok: '+n+' verificações');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
