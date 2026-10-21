const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=require('node:path').resolve(__dirname,'..');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const html=fs.readFileSync(root+'/index.html','utf8');
const dom=new JSDOM(html,{url:'https://atlas.test/index.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,d=w.document;w.TextEncoder=TextEncoder;Object.defineProperty(w,'crypto',{value:require('node:crypto').webcrypto});w.matchMedia=()=>({matches:false});w.scrollTo=()=>{};
class TestChart{constructor(c,o){this.data=o.data}update(){}resize(){}destroy(){}}
w.Chart=TestChart;
const ctx=dom.getInternalVMContext(),ev=code=>vm.runInContext(code,ctx);
const files=[...html.matchAll(/<script[^>]*\ssrc="(assets\/[^"]+)"/g)].map(x=>x[1]).filter(f=>f!=='assets/vendor/chart.umd.js');
for(const f of files)vm.runInContext(fs.readFileSync(root+'/'+f,'utf8'),ctx,{filename:f});
let n=0;
const fixture={id:'m3',title:'Carteiras (fixture)',icon:'x',summary:'Resumo.',minutes:5,goals:['Meta um'],flow:['a','b','c'],
 history:{intro:'Introdução histórica.',timeline:[{when:'1976',title:'Chaves',text:'Texto um.'},{when:'2009',title:'Bitcoin',text:'Texto **dois**.'},{when:'2015',title:'Ethereum',text:'Texto três.'}]},
 lessons:[
  {id:'a',title:'Primeira aula',optional:false,sources:['m3.x'],blocks:[{t:'p',text:'Uma palavraunica aqui, com **negrito**.'},{t:'analogy',text:'Como um cofre.'},{t:'example',text:'1 + 1 = 2'},{t:'figure',svg:'<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',caption:'Legenda da figura',alt:'x'},{t:'data',text:'Havia 21 milhões.',source:'m3.x',date:'2026-10-20'},{t:'table',caption:'Tabela',headers:['A','B'],rows:[['1','2']]},{t:'summary',text:'Resumo da aula.'},{t:'terms',terms:['Colateral','Chave privada']}]},
  {id:'b',title:'Segunda aula',optional:false,sources:['m3.x'],blocks:[{t:'p',text:'Texto b.'}]},
  {id:'c',title:'Aula opcional',optional:true,sources:['m3.x'],blocks:[{t:'p',text:'Texto c.'}]}],
 quiz:[['Q?',['a','b'],0,'ok']],sources:{'m3.x':['Fonte X','https://example.org/x','desc']},glossary:[['TermoFixture','def']]};
ev(`AcademyContent.register(${JSON.stringify(fixture)})`);
// Fixture com marcação no texto: tudo deve aparecer como texto, nunca como HTML.
const X='<b>&';
const hostil={id:'m4',title:'Título '+X,icon:'x',summary:'Resumo '+X,minutes:5,goals:['Meta '+X],flow:['Passo '+X,'b','c'],
 history:{intro:'Intro.',timeline:[{when:'1',title:'t',text:'x'},{when:'2',title:'t',text:'x'},{when:'3',title:'t',text:'x'}]},
 lessons:[{id:'h',title:'Aula '+X+' hostilx',optional:false,sources:['m4.y'],blocks:[{t:'p',text:'Texto hostilx.'},{t:'summary',text:'Resumo.'},{t:'terms',terms:['Termo '+X]}]}],
 quiz:[['Pergunta '+X+'?',['Opção '+X,'Outra **forte**'],0,'Explicação '+X+' com **negrito**.']],
 sources:{'m4.y':['Fonte Y','https://example.org/y','desc']},glossary:[['Termo '+X,'Significado '+X+' com **ênfase**.']]};
ev(`AcademyContent.register(${JSON.stringify(hostil)})`);
// inline
assert.equal(ev("AcademyRender.inline('1 < 2 & **forte**')"),'1 &lt; 2 &amp; <strong>forte</strong>');n++;
ev("localStorage.setItem('atlas-academy-v1',JSON.stringify({version:1,completed:['m3'],studied:[],scores:{},notes:{},bookmarks:['m3-0','m3:a','m3:zzz','m5-0','m5-99','lixo'],last:'m1',level:2}))");
ev('academy.init()');
assert.deepEqual(Array.from(ev('academy.state.bookmarks')),['m3:a','m5-0']);n++;
assert.ok(ev("academy.state.completed.includes('m3')"));n++;
ev("app.navigate('m3')");
assert.ok(d.getElementById('lesson-m3-a'));n++;
assert.equal(d.querySelectorAll('.aula-historia .timeline li').length,3);n++;
{const li=d.querySelectorAll('.aula-historia .timeline li')[1],tit=li.querySelector('.timeline-titulo'),b=li.querySelector('p strong');
 assert.equal(tit&&tit.textContent,'Bitcoin');n++;
 assert.ok(b&&b!==tit&&b.textContent==='dois'&&!b.classList.contains('timeline-titulo'));n++;}
assert.match(d.querySelector('.module-header .reading-summary').textContent,/Cada dado real traz a fonte e a data/);n++;
assert.equal(d.querySelectorAll('.lesson').length,3);n++;
const heads=[...d.querySelectorAll('#tab-content h2')].map(h=>h.id||h.textContent);
const iAlem=[...d.querySelectorAll('#tab-content h2')].findIndex(h=>/Indo além/.test(h.textContent)),iC=[...d.querySelectorAll('#tab-content h2')].findIndex(h=>h.closest('#lesson-m3-c'));
assert.ok(iAlem>=0&&iC>iAlem);n++;
assert.ok(d.getElementById('lesson-m3-b').compareDocumentPosition(d.getElementById('lesson-m3-c'))&4);n++;
assert.equal(d.querySelectorAll('.level-select,.level-badge').length,0);n++;
assert.ok(!/Mostrando \d+ de/.test(d.getElementById('tab-content').textContent));n++;
assert.match(d.querySelector('.lesson-toc').textContent,/Como tudo começou/);n++;
assert.match(d.querySelector('.lesson-toc').textContent,/Indo além/);n++;
assert.match(d.getElementById('lesson-m3-a').textContent,/01\. Primeira aula/);n++;
assert.match(d.getElementById('lesson-m3-c').textContent,/03\. Aula opcional/);n++;
// blocos
assert.ok(d.querySelector('#lesson-m3-a .aula-analogia strong'));n++;
assert.ok(d.querySelector('#lesson-m3-a .example'));n++;
assert.ok(d.querySelector('#lesson-m3-a p .aula-dado, #lesson-m3-a p.aula-dado'));n++;
assert.match(d.querySelector('#lesson-m3-a .aula-dado').textContent,/consultado em 20\/10\/2026/);n++;
assert.ok(d.querySelector('#lesson-m3-a .table-scroll table.chart-table.comparison caption'));n++;
assert.ok(d.querySelector('#lesson-m3-a .aula-frase strong'));n++;
assert.equal(d.querySelectorAll('#lesson-m3-a .aula-termos button').length,2);n++;
assert.ok(d.querySelector('#lesson-m3-a figure.aula-figura svg[role=img][aria-label="x"]'));n++;
assert.equal(d.querySelectorAll('figure.aula-figura[role]').length,0);n++;
assert.ok(d.querySelector('#lesson-m3-a .source-inline a'));n++;
// favoritos
d.querySelector('#lesson-m3-b .lesson-foot button').click();
assert.ok(ev("academy.state.bookmarks.includes('m3:b')"));n++;
// infográficos
ev("app.switchTab('infographics')");
assert.equal(d.querySelector('#btn-infographics').textContent,'Infográficos');n++;
assert.ok(d.querySelector('#tab-infographics .aula-figura'));n++;
assert.match(d.querySelector('#tab-infographics').textContent,/Primeira aula/);n++;
{const h=d.querySelector('#tab-infographics h2');assert.equal(h&&h.textContent,'Figuras das aulas');n++;
 assert.ok(h.compareDocumentPosition(d.querySelector('#tab-infographics .aula-figura'))&4);n++;}
// termos
ev("academy.term('Colateral')");
assert.equal(ev('app.currentView'),'glossary');n++;
assert.ok(d.getElementById('termo-colateral'));n++;
// favoritos / jump
ev("app.navigate('saved')");
assert.match(d.getElementById('view-container').textContent,/Primeira aula/);n++;
ev("academy.jump('m3','c')");
assert.equal(ev('app.currentView'),'m3');n++;
// busca
ev("academy.query='palavraunica';app.navigate('search')");
assert.equal(d.querySelectorAll('.source-card').length,1);n++;
assert.match(d.querySelector('.source-card button').getAttribute('onclick'),/m3/);n++;
// dashboard sem nível
ev("app.navigate('dashboard')");
assert.equal(d.querySelectorAll('.level-select').length,0);n++;
assert.equal(typeof ev('academy.setLevel'),'undefined');n++;
assert.equal(errors.length,0,errors.join('\n'));n++;
console.log('render ok: '+n+' verificações');
// regressão: link "Indo além" do índice em módulo antigo
ev("app.navigate('m6');academy.jump('m6','alem')");
assert.equal(d.activeElement&&d.activeElement.id,'alem-m6');
console.log('jump alem ok');
// Campos de módulo novo com "<b>&" aparecem como texto (nenhum <b> criado).
let k=0;
const semB=(el,msg)=>{assert.ok(el,msg+': elemento ausente');assert.equal(el.querySelectorAll('b').length,0,msg+': virou HTML');k++;};
ev("app.navigate('m4')");
{const h=d.querySelector('.module-header');semB(h,'cabeçalho');
 assert.equal(h.querySelector('h1').textContent,'Título '+X);k++;
 assert.equal(h.querySelector('h1 + p').textContent,'Resumo '+X);k++;
 assert.equal(h.querySelector('.objective-list li').textContent,'Meta '+X);k++;}
assert.match(d.getElementById('course-current-label').textContent,/Título <b>&/);k++;
semB(d.getElementById('module-navigation'),'menu de módulos');
ev("app.switchTab('infographics')");
{const f=d.querySelector('#tab-infographics .flow-diagram');semB(f,'fluxo');assert.match(f.textContent,/Passo <b>&/);k++;}
ev("app.switchTab('assessment')");
{const q=d.querySelector('#academy-quiz');semB(q,'avaliação');
 assert.equal(q.querySelector('legend').textContent,'1. Pergunta '+X+'?');k++;
 assert.equal(q.querySelector('.quiz-answer span').textContent,'Opção '+X);k++;
 assert.equal(q.querySelectorAll('.quiz-answer span')[1].querySelector('strong').textContent,'forte');k++;
 d.querySelector('input[name="academy-q0"][value="1"]').checked=true;ev('academy.checkQuiz()');
 const fb=d.getElementById('feedback-0');semB(fb,'explicação');
 assert.ok(fb.textContent.includes('Opção '+X)&&fb.textContent.includes('Explicação '+X));k++;
 assert.ok(!fb.textContent.includes('**'));assert.equal(fb.querySelector('strong').textContent,'negrito');k++;}
ev("app.navigate('glossary')");
{const dl=d.querySelector('.glossary-list');semB(dl,'glossário');
 const dt=[...dl.querySelectorAll('dt')].find(x=>x.textContent==='Termo '+X);assert.ok(dt);k++;
 assert.match(dt.nextElementSibling.textContent,/Significado <b>& com ênfase/);k++;}
ev("app.navigate('dashboard')");semB(d.querySelector('.dashboard-grid'),'mapa de estudos');
assert.ok([...d.querySelectorAll('.module-card h3')].some(h=>h.textContent==='Título '+X));k++;
// Texto do painel: só os módulos reescritos começam pela história.
assert.ok(!/Cada módulo começa pela história/.test(d.getElementById('view-container').textContent));k++;
assert.match(d.getElementById('view-container').textContent,/já reescritos começam pela história/);k++;
ev("academy.query='hostilx';app.navigate('search')");
{const c=d.querySelector('.source-card');semB(c,'busca');assert.equal(c.querySelector('h2').textContent,'Aula '+X+' hostilx');k++;}
ev("academy.state.bookmarks.push('m4:h');app.navigate('saved')");
{semB(d.getElementById('view-container'),'favoritos');assert.ok([...d.querySelectorAll('#view-container .source-card h3')].some(h=>h.textContent==='Aula '+X+' hostilx'));k++;}
// Termo da aula: a definição abre no lugar, sem trocar de página nem rolar.
ev("app.navigate('m4')");
{const main=d.querySelector('main');let writes=0,scrolls=0;const real=Object.getOwnPropertyDescriptor(w.Element.prototype,'scrollTop');
 Object.defineProperty(main,'scrollTop',{configurable:true,get(){return 321},set(){writes++}});
 const oldScrollTo=w.scrollTo;w.scrollTo=()=>{scrolls++};const hash=w.location.hash;
 const btn=d.querySelector('#lesson-m4-h .aula-termos button');btn.click();
 assert.equal(ev('app.currentView'),'m4');k++;
 assert.equal(w.location.hash,hash);k++;
 assert.equal(writes,0,'scrollTop foi zerado');assert.equal(scrolls,0,'a janela rolou');assert.equal(main.scrollTop,321);k++;
 const box=d.querySelector('#lesson-m4-h .aula-termos').nextElementSibling;
 assert.ok(box&&box.classList.contains('aula-termo-def'),'caixa de definição logo após a linha de termos');k++;
 semB(box,'definição');assert.match(box.textContent,/Significado <b>& com ênfase/);k++;
 assert.equal(btn.getAttribute('aria-expanded'),'true');k++;
 const link=[...box.querySelectorAll('a,button')].find(a=>/ver no Glossário →/.test(a.textContent));assert.ok(link,'link para o Glossário');k++;
 btn.click();assert.equal(d.querySelectorAll('#lesson-m4-h .aula-termo-def').length,0,'segundo clique fecha');assert.equal(btn.getAttribute('aria-expanded'),'false');k++;
 btn.click();d.querySelector('#lesson-m4-h .aula-termo-def a, #lesson-m4-h .aula-termo-def button').click();
 assert.equal(ev('app.currentView'),'glossary');k++;
 delete main.scrollTop;w.scrollTo=oldScrollTo;void real;}
// navigating volta a false mesmo se a montagem do módulo falhar.
ev("academy._enh=academy.enhance;academy.enhance=()=>{throw new Error('falha de teste')}");
assert.throws(()=>ev("app.navigate('m4')"));
ev("academy.enhance=academy._enh");
assert.equal(ev('academy.navigating'),false);k++;
assert.equal(errors.length,0,errors.join('\n'));k++;
console.log('escape/termos ok: '+k+' verificações');
