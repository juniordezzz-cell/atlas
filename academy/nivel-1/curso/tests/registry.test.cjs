const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const root=require('node:path').resolve(__dirname,'..');
function fresh(){
 const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only'});
 const ctx=dom.getInternalVMContext();
 for(const f of ['assets/js/course.js','assets/js/content/registry.js'])vm.runInContext(fs.readFileSync(root+'/'+f,'utf8'),ctx);
 return code=>vm.runInContext(code,ctx);
}
const mod=(extra)=>JSON.stringify(Object.assign({id:'m1',title:'T',icon:'x',summary:'s',minutes:5,goals:[],flow:[],history:{intro:'i',timeline:[]},lessons:[],quiz:[],sources:{},glossary:[]},extra));
let ev=fresh(),n=0;
ev(`AcademyContent.register(${mod({sources:{'m1.x':['T','https://e.x','d']},glossary:[['Cifra','c']]})})`);
assert.equal(ev('COURSE[0].id'),'m1');n++;
assert.equal(ev('AcademyContent.isNew(COURSE[0])'),true);n++;
assert.equal(ev('AcademyContent.isNew(COURSE[1])'),false);n++;
assert.equal(ev('COURSE.length'),10);n++;
assert.equal(ev("SOURCES['m1.x'][0]"),'T');n++;
assert.equal(ev("GLOSSARY.some(g=>g[0]==='Cifra'&&g[2]==='m1')"),true);n++;
assert.equal(ev('typeof AcademyLabs'),'object');n++;
assert.throws(()=>ev(`AcademyContent.register(${mod({id:'m2',sources:{'m1.x':['T','u','d']}})})`),/Fonte duplicada: m1\.x/);n++;
assert.equal(ev('COURSE[1].id'),'m2');assert.equal(ev('isNewM2=AcademyContent.isNew(COURSE[1])'),false);n+=2;
assert.throws(()=>ev(`AcademyContent.register(${mod({id:'m3',glossary:[['colateral','x']]})})`),/Termo duplicado/);n++;
assert.equal(ev('AcademyContent.isNew(COURSE[2])'),false);n++;
assert.throws(()=>ev(`AcademyContent.register(${mod({id:'m99'})})`),/m99/);n++;
console.log('registry ok: '+n+' verificações');
