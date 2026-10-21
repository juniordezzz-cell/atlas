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
// inline
assert.equal(ev("AcademyRender.inline('1 < 2 & **forte**')"),'1 &lt; 2 &amp; <strong>forte</strong>');n++;
ev("localStorage.setItem('atlas-academy-v1',JSON.stringify({version:1,completed:['m3'],studied:[],scores:{},notes:{},bookmarks:['m3-0','m3:a','m3:zzz','m2-0','m2-99','lixo'],last:'m1',level:2}))");
ev('academy.init()');
assert.deepEqual(Array.from(ev('academy.state.bookmarks')),['m3:a','m2-0']);n++;
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
assert.ok(d.querySelector('#lesson-m3-a figure.aula-figura[role=group] svg[role=img][aria-label="x"]'));n++;
assert.ok(d.querySelector('#lesson-m3-a .source-inline a'));n++;
// favoritos
d.querySelector('#lesson-m3-b .lesson-foot button').click();
assert.ok(ev("academy.state.bookmarks.includes('m3:b')"));n++;
// infográficos
ev("app.switchTab('infographics')");
assert.equal(d.querySelector('#btn-infographics').textContent,'Infográficos');n++;
assert.ok(d.querySelector('#tab-infographics .aula-figura'));n++;
assert.match(d.querySelector('#tab-infographics').textContent,/Primeira aula/);n++;
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
