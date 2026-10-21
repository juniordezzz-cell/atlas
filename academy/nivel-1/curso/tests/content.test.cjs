const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=require('node:path').resolve(__dirname,'..');
const vc=new VirtualConsole();
const html=fs.readFileSync(root+'/index.html','utf8');
const dom=new JSDOM(html,{url:'https://atlas.test/index.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;w.TextEncoder=TextEncoder;Object.defineProperty(w,'crypto',{value:require('node:crypto').webcrypto});w.matchMedia=()=>({matches:false});w.scrollTo=()=>{};
w.Chart=class{constructor(c,o){this.data=o.data}update(){}resize(){}destroy(){}};
const ctx=dom.getInternalVMContext(),ev=code=>vm.runInContext(code,ctx);
const files=[...html.matchAll(/<script[^>]*\ssrc="(assets\/[^"]+)"/g)].map(x=>x[1]).filter(f=>f!=='assets/vendor/chart.umd.js');
for(const f of files)vm.runInContext(fs.readFileSync(root+'/'+f,'utf8'),ctx,{filename:f});
// Dados extraídos do contexto do curso como JSON puro (evita objetos de outro realm).
const data=JSON.parse(ev("JSON.stringify({course:COURSE.map(m=>({m:m,isNew:AcademyContent.isNew(m)})),sources:SOURCES,glossary:GLOSSARY})"));
const SOURCES=data.sources,GLOSSARY=data.glossary;
const slug=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const TYPES=['p','analogy','example','figure','data','table','summary','terms'];
const errs=[];const bad=(where,msg)=>errs.push(where+': '+msg);
const obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const str=v=>typeof v==='string'&&v.trim().length>0;
const novos=data.course.filter(c=>c.isNew).map(c=>c.m);
const novosIds=new Set(novos.map(m=>m.id));
// Slugs do glossário: únicos no conjunto todo (termos de módulos novos contra tudo).
const bySlug=new Map();
for(const [term,,mid] of GLOSSARY){const s=slug(term);if(!bySlug.has(s))bySlug.set(s,[]);bySlug.get(s).push({term,mid})}
for(const [s,list] of bySlug)if(list.length>1&&list.some(x=>novosIds.has(x.mid)))bad('glossário','slug "'+s+'" repetido: '+list.map(x=>x.mid+'/'+x.term).join(' | '));
const termSet=new Set(GLOSSARY.map(g=>String(g[0]).toLowerCase()));
for(const m of novos){
 const M='módulo '+m.id;
 if(!m.history||!str(m.history.intro))bad(M,'history.intro vazio');
 if(!m.history||!Array.isArray(m.history.timeline)||m.history.timeline.length<3)bad(M,'history.timeline precisa de pelo menos 3 itens');
 if(!Array.isArray(m.lessons))m.lessons=[];
 m.lessons.forEach((l,i)=>{if(!obj(l))bad(M+' aula #'+(i+1),'aula inválida (não é um objeto)')});
 const lessons=m.lessons.filter(obj);
 const principais=lessons.filter(l=>!l.optional);
 if(principais.length<8||principais.length>15)bad(M,'aulas principais devem ser entre 8 e 15 (há '+principais.length+')');
 const ids=new Set();
 for(const l of lessons){if(ids.has(l.id))bad(M,'id de aula repetido: '+l.id);ids.add(l.id)}
 if(!Array.isArray(m.quiz)||m.quiz.length<8||m.quiz.length>12)bad(M,'quiz deve ter entre 8 e 12 questões (há '+(m.quiz||[]).length+')');
 (m.quiz||[]).forEach((q,i)=>{
  const Q=M+' questão '+(i+1);
  if(!Array.isArray(q)){bad(Q,'questão inválida (não é uma lista)');return}
  if(!str(q[0]))bad(Q,'enunciado vazio');
  if(!Array.isArray(q[1])||q[1].length<2)bad(Q,'precisa de pelo menos 2 alternativas');
  else if(!Number.isInteger(q[2])||q[2]<0||q[2]>=q[1].length)bad(Q,'indiceCerto inválido: '+q[2]);
  if(!str(q[3]))bad(Q,'explicação vazia');
 });
 for(const [k,v] of Object.entries(m.sources||{})){
  if(!k.startsWith(m.id+'.'))bad(M,'fonte "'+k+'" sem prefixo '+m.id+'.');
  if(!Array.isArray(v)||!/^https:\/\//.test(v[1]||''))bad(M,'fonte "'+k+'" precisa de url https://');
 }
 for(const l of lessons){
  const L=M+' aula "'+l.id+'"';
  if(!/^[a-z0-9-]+$/.test(l.id||''))bad(L,'id de aula inválido (use a-z, 0-9 e hífen)');
  if(!Array.isArray(l.sources)||l.sources.length<1)bad(L,'precisa de pelo menos 1 fonte');
  for(const k of Array.isArray(l.sources)?l.sources:[])if(!Object.prototype.hasOwnProperty.call(SOURCES,k))bad(L,'fonte inexistente: '+k);
  if(!Array.isArray(l.blocks))bad(L,'blocks deve ser uma lista');
  const blocks=Array.isArray(l.blocks)?l.blocks:[];
  blocks.forEach((b,i)=>{if(!obj(b))bad(L+' bloco '+(i+1),'bloco inválido (não é um objeto)')});
  if(!blocks.some(b=>obj(b)&&b.t==='summary'))bad(L,'falta bloco summary');
  blocks.forEach((b,i)=>{
   if(!obj(b))return;
   const B=L+' bloco '+(i+1)+' ('+b.t+')';
   if(!TYPES.includes(b.t)){bad(B,'tipo de bloco desconhecido');return}
   if(b.t==='figure'){
    if(!str(b.caption))bad(B,'caption vazio');
    if(!str(b.alt))bad(B,'alt vazio');
    const s=b.svg||'';
    if(!/^<svg/.test(s))bad(B,'svg deve começar com <svg');
    if(/<script/i.test(s))bad(B,'svg contém <script');
    if(/\bon\w+\s*=/i.test(s))bad(B,'svg contém atributo on*=');
    if(/href\s*=\s*["']https?/i.test(s))bad(B,'svg contém href remoto');
    if(/\sid\s*=/i.test(s))bad(B,'svg contém id= (a figura aparece duas vezes na página)');
   }
   if(b.t==='data'){
    if(!Object.prototype.hasOwnProperty.call(SOURCES,b.source))bad(B,'source inexistente: '+b.source);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date||''))bad(B,'date deve ser AAAA-MM-DD');
   }
   if(b.t==='terms'){if(!Array.isArray(b.terms))bad(B,'terms deve ser uma lista');else for(const t of b.terms)if(!termSet.has(String(t).toLowerCase()))bad(B,'termo fora do glossário: '+t)}
  });
 }
}
if(errs.length){console.error('content FALHOU ('+errs.length+'):\n - '+errs.join('\n - '));process.exit(1)}
console.log(novos.length?'content ok: '+novos.length+' módulo(s) no formato novo ('+[...novosIds].join(', ')+')':'content ok: nenhum módulo no formato novo ainda');
