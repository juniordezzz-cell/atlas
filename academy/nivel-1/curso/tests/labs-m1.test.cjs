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
const L=ev('AcademyLabs.m1');
assert.equal(L.caesar('ABC',3),'DEF');n++;
assert.equal(L.caesar('xyz',3),'abc');n++;
assert.equal(L.caesar('Ação 2!',3),'Dfdr 2!');n++;
assert.equal(L.normalize('Ãção'),'Acao');n++;
assert.equal(L.caesar(L.caesar('Veni, vidi, vici',29),-3),'Veni, vidi, vici');n++;
const bf=L.bruteForce('DEF');
assert.equal(bf.length,25);assert.equal(bf[2].text,'ABC');assert.equal(bf[0].shift,1);n+=3;
assert.ok(Math.abs(L.frequencies('aab').a-2/3)<1e-9);n++;
assert.equal(Object.keys(L.frequencies('123')).length,0);n++;
assert.ok(Math.abs(Object.values(L.frequencies('Olá, mundo')).reduce((a,b)=>a+b,0)-1)<1e-9);n++;
ev('academy.init()');
ev("app.navigate('m1','labs')");
const q=id=>d.getElementById(id);
assert.equal(q('cesar-saida').textContent.trim(),'Yhql, ylgl, ylfl');n++;
// ao vivo: muda o deslocamento
const sh=q('cesar-deslocamento');sh.value='1';sh.dispatchEvent(new w.Event('input',{bubbles:true}));
assert.equal(q('cesar-saida').textContent.trim(),'Wfoj, wjej, wjdj');n++;
sh.value='3';sh.dispatchEvent(new w.Event('input',{bubbles:true}));
// alternar para decifrar
q('cesar-modo').click();
assert.equal(q('cesar-saida').textContent.trim(),'Sbkf, sfaf, sfzf');n++;
q('cesar-modo').click();
assert.equal(q('cesar-saida').textContent.trim(),'Yhql, ylgl, ylfl');n++;
// alfabeto em duas linhas
assert.match(q('cesar-alfabeto').textContent,/ABCDEFGHIJKLMNOPQRSTUVWXYZ/);n++;
assert.match(q('cesar-alfabeto').textContent,/DEFGHIJKLMNOPQRSTUVWXYZABC/);n++;
// quebrar: 25 saídas
assert.equal(d.querySelectorAll('#cesar-forca-bruta li').length,25);n++;
assert.match(q('cesar-forca-bruta').textContent,/Mensagens secretas/);n++;
// frequência: svg + tabela
const svg=q('freq-grafico').querySelector('svg');
assert.ok(svg&&svg.getAttribute('role')==='img'&&svg.getAttribute('aria-label'));n++;
assert.equal(svg.querySelectorAll('[id]').length,0);n++;
assert.equal(q('freq-grafico').querySelectorAll('details tbody tr').length,26);n++;
// o lab de SHA continua
assert.ok(q('sha-message')&&q('sha-result'));n++;
// ordem: César antes do SHA
assert.ok(q('cesar-saida').compareDocumentPosition(q('sha-message'))&4);n++;
// reabrir a aba não duplica
ev("academy.initExtraLabs()");assert.equal(d.querySelectorAll('#cesar-saida').length,1);n++;
// alinhamento: rótulos com largura fixa nas duas linhas, nos dois modos
for(const modo of [0,1]){
 if(modo)q('cesar-modo').click();
 const r=[...d.querySelectorAll('#cesar-alfabeto .cesar-rotulo')];
 assert.equal(r.length,2);assert.equal(r[0].style.width,r[1].style.width);assert.ok(r[0].style.width);
 assert.ok(r.every(x=>x.parentElement.style.whiteSpace==='pre'));n+=3;
}
// gancho genérico para qualquer módulo
ev("AcademyLabs.m4={html:()=>'<p id=\"lab-teste-m4\">x</p>',init(){this.ok=true}}");
ev("app.navigate('m4','labs')");
assert.ok(q('lab-teste-m4'));assert.equal(ev('AcademyLabs.m4.ok'),true);n+=2;
assert.deepEqual(errors,[]);n++;
console.log('labs-m1 ok: '+n+' verificações');
