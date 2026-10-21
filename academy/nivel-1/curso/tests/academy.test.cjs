const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=require('node:path').resolve(__dirname,'..');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{url:'https://atlas.test/index.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,d=w.document;w.TextEncoder=TextEncoder;Object.defineProperty(w,'crypto',{value:require('node:crypto').webcrypto});w.matchMedia=()=>({matches:false});w.scrollTo=()=>{};
class TestChart{static instances={};static next=0;constructor(canvas,options){assert.ok(canvas,'Canvas necessário');this.id=++TestChart.next;this.canvas=canvas;this.data=options.data;TestChart.instances[this.id]=this;}update(){}resize(){}destroy(){delete TestChart.instances[this.id];}}
w.Chart=TestChart;
for(const file of [...fs.readFileSync(root+'/index.html','utf8').matchAll(/<script[^>]*\ssrc="(assets\/[^"]+)"/g)].map(x=>x[1]).filter(f=>f!=='assets/vendor/chart.umd.js'))vm.runInContext(fs.readFileSync(root+'/'+file,'utf8'),dom.getInternalVMContext(),{filename:file});
const ev=code=>vm.runInContext(code,dom.getInternalVMContext());
ev('academy.init()');
assert.equal(d.querySelectorAll('.module-card').length,10);
ev("app.navigate('m2');");
assert.equal(ev('chainLab.validate()'),true,'Blocos iniciais precisam ser válidos');
let assertions=2;
for(let n=1;n<=10;n++){
 ev(`app.navigate('m${n}');`);
 assert.equal(ev('app.currentView'),'m'+n);assertions++;
 assert.equal(d.querySelectorAll('h1').length,1);assertions++;
 for(let level=1;level<=3;level++){ev(`academy.setLevel(${level});`);assert.equal(d.querySelectorAll('.lesson').length,ev(`COURSE[${n-1}].sections.filter(s=>s[1]<=${level}).length`));assertions++;}
 for(const tab of ['content','labs','infographics','assessment','sources']){ev(`app.switchTab('${tab}');`);assert.equal(d.querySelector('#tab-'+tab).hidden,false);assert.equal(d.querySelectorAll('#view-container .tab-pane:not([hidden])').length,1);assertions+=2;}
 ev("app.switchTab('assessment');");
 const length=ev(`COURSE[${n-1}].quiz.length`);
 ev('academy.checkQuiz()');assert.equal(d.querySelector('#quiz-summary').textContent,'Responda todas as questões antes de conferir.');assertions++;
 for(let i=0;i<length;i++){const answer=ev(`COURSE[${n-1}].quiz[${i}][2]`);d.querySelector(`input[name="academy-q${i}"][value="${answer}"]`).checked=true;}
 ev('academy.checkQuiz()');assert.ok(ev(`academy.state.completed.includes('m${n}')`));assertions++;
 ev("app.switchTab('content');");const textarea=d.querySelector('#module-notes');textarea.value='<img src=x onerror=alert(1)> Nota '+n;ev('academy.note(document.getElementById("module-notes").value)');
 ev(`app.navigate('m${n}');academy.setLevel(3);`);assert.equal(d.querySelector('#module-notes').value,textarea.value);assertions++;
 assert.equal(d.querySelector('#module-notes img'),null);assertions++;
 const ids=[...d.querySelectorAll('#view-container [id]')].map(el=>el.id);assert.equal(new Set(ids).size,ids.length,'IDs únicos no módulo '+n);assertions++;
}
assert.equal(ev('academy.state.completed.length'),10);assertions++;
const m=ev('AcademyMath');const initial={quantity:1,price:2000,debtUnits:1000,debtPrice:1,apr:8,days:0,lt:80};
assert.deepEqual(Array.from(m.backlog(100,60,5)),[40,80,120,160,200]);assertions++;
assert.equal(m.lending(initial).hf,1.6);assert.equal(m.lending({...initial,price:1200}).hf,.96);assert.equal(m.lending({...initial,debtUnits:0}).hf,Infinity);assert.equal(m.lending({...initial,days:365}).debt,1080);assert.equal(m.lending({...initial,debtPrice:2}).hf,.8);assert.throws(()=>m.lending({...initial,quantity:0}));assert.equal(m.il(1),0);assert.ok(Math.abs(m.il(2)+.0571909584)<1e-9);assert.ok(Math.abs(m.apy(.12,12)-.1268250301)<1e-9);assert.equal(m.amm(20000,10,0,.003).output,0);assert.throws(()=>m.amm(0,10,1,.003));assertions+=11;
ev("app.navigate('m6','labs');academy.lendingPreset('drop');");assert.match(d.querySelector('#lending-status').textContent,/elegível/);assertions++;
d.querySelector('#sim-debt').value='0';ev('academy.lendingCalc()');assert.match(d.querySelector('#lending-status').textContent,/Sem dívida/);assertions++;
d.querySelector('#sim-qty').value='0';ev('academy.lendingCalc()');assert.equal(d.querySelector('#lending-error').hidden,false);assertions++;
ev("app.navigate('m2','labs');academy.transactionStep(1);");assert.equal(ev('academy.stage'),1);assertions++;
ev("chainLab.editTx(1,0,'amount','99');");assert.equal(ev('chainLab.validate()'),false);assertions++;
ev("app.navigate('m2');");assert.equal(ev('chainLab.validate()'),true);assertions++;
ev("academy.query='colateral';app.navigate('search');");assert.ok(d.querySelectorAll('.source-card').length>=5);assertions++;
ev("app.navigate('m9','labs');");const before=Object.keys(TestChart.instances).length;assert.ok(before>=2);ev("app.navigate('dashboard');");assert.equal(Object.keys(TestChart.instances).length,0);assertions+=2;
ev("app.navigate('saved');");assert.equal(d.querySelectorAll('.source-card img').length,0);assertions++;
ev("app.navigate('m5','infographics');");assert.match(d.querySelector('.chart-table').textContent,/0,00042/);assertions++;
ev("app.navigate('m7','labs');document.getElementById('dp-panic').value='0';depegLab.run();");assert.equal(ev('depegLab.last.prices.at(-1)'),1);assertions++;
ev("app.navigate('m7','labs');document.getElementById('vl-price').value='3000';document.getElementById('vl-eth').value='1';document.getElementById('vl-drop').value='0';document.getElementById('vl-debt').value='1000';vaultLab.calc();");const margin=d.getElementById('vl-margin').innerText;assert.ok(margin.includes('50.0%')||margin.includes('50,0%'));assertions++;
assert.equal(errors.length,0,errors.join('\n'));assertions++;
ev('academy.state.completed=[];academy.state.notes={};academy.load();');assert.equal(ev('academy.state.completed.length'),10);assert.ok(ev("academy.state.notes.m6.includes('Nota 6')"));assertions+=2;
for(const module of ev('COURSE')){
 assert.ok([1,2,3].every(level=>module.sections.some(s=>s[1]===level)));assertions++;
 for(const section of module.sections){assert.ok(section[4].length>0);for(const key of section[4])assert.ok(ev(`SOURCES[${JSON.stringify(key)}]`));assertions++;}
}
for(const svg of d.querySelectorAll('svg[role="img"]')){for(const id of (svg.getAttribute('aria-labelledby')||'').split(' ').filter(Boolean))assert.ok(d.getElementById(id));assertions++;}
for(const file of ['assets/vendor/chart.umd.js','assets/vendor/lucide.js'])new vm.Script(fs.readFileSync(root+'/'+file,'utf8'));
for(const url of [...d.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'))){assert.ok(!url.startsWith('javascript:'));assertions++;}
// Seletor de módulos no topo (o curso dentro do ATLAS, 20/10/2026)
ev("app.navigate('m6');");assert.equal(d.getElementById('course-current-label').textContent,'06 · DeFi');assertions++;
assert.equal(d.querySelectorAll('#module-navigation .nav-item').length,11);assert.ok(d.querySelector('#module-navigation .nav-6.active'));assertions+=2;
d.getElementById('menu-toggle').click();assert.ok(d.getElementById('sidebar').classList.contains('menu-open'));assertions++;
d.querySelector('#module-navigation .nav-7').click();assert.equal(ev('app.currentView'),'m7');assert.ok(!d.getElementById('sidebar').classList.contains('menu-open'));assertions+=2;
ev("app.navigate('glossary');");assert.equal(d.getElementById('course-current-label').textContent,'Glossário');assertions++;
console.log(`${assertions} verificações passaram: 10 módulos, 3 níveis, 5 abas, avaliações, notas, matemática e ciclo de gráficos.`);
dom.window.close();
