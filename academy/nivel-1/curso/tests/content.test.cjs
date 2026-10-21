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
const slug=s=>String(s).normalize('NFD').replace(/[\u{300}-\u{36f}]/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const TYPES=['p','analogy','example','figure','data','table','summary','terms','scene','interactive'];
// Blocos do piloto visual (21/10/2026): só os tipos que academy-visual.js sabe ligar.
const KINDS={scene:['cadeia','camadas'],interactive:['hash','papeis','transacao','mineracao','validadores','reorg','utxo','taxas','oraculo','ticker','custodia','assinatura','envenenado','fdv','desbloqueio','allowance','multisig','gastoduplo','montartx','endereco','halving','regrasbtc','acelerar','canal','cofre','chamada','gascalc','atomico','reentrancia','proxy']};
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
const realDate=s=>{const x=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!x)return false;const t=new Date(Date.UTC(+x[1],+x[2]-1,+x[3]));return !isNaN(t)&&t.toISOString().slice(0,10)===s;};
const strList=v=>Array.isArray(v)&&v.length>0&&v.every(str);
for(const m of novos){
 const M='módulo '+m.id;
 for(const k of ['title','icon','summary'])if(!str(m[k]))bad(M,k+' deve ser um texto não vazio');
 if(typeof m.minutes!=='number'||!Number.isFinite(m.minutes)||m.minutes<=0)bad(M,'minutes deve ser um número positivo');
 for(const k of ['goals','flow'])if(!strList(m[k]))bad(M,k+' deve ser uma lista não vazia de textos');
 if(!Array.isArray(m.glossary))bad(M,'glossary deve ser uma lista');
 else m.glossary.forEach((g,i)=>{if(!Array.isArray(g)||!str(g[0])||!str(g[1]))bad(M+' glossário #'+(i+1),'use [termo, significado] com textos não vazios')});
 if(!m.history||!str(m.history.intro))bad(M,'history.intro vazio');
 if(!m.history||!Array.isArray(m.history.timeline)||m.history.timeline.length<3)bad(M,'history.timeline precisa de pelo menos 3 itens');
 if(m.history&&Array.isArray(m.history.timeline))m.history.timeline.forEach((t,i)=>{if(!obj(t)||!str(t.when)||!str(t.title)||!str(t.text))bad(M+' linha do tempo #'+(i+1),'precisa de when, title e text não vazios')});
 if(!Array.isArray(m.lessons))m.lessons=[];
 m.lessons.forEach((l,i)=>{if(!obj(l))bad(M+' aula #'+(i+1),'aula inválida (não é um objeto)')});
 const lessons=m.lessons.filter(obj);
 const principais=lessons.filter(l=>!l.optional);
 if(principais.length<8||principais.length>15)bad(M,'aulas principais devem ser entre 8 e 15 (há '+principais.length+')');
 const ids=new Set();
 for(const l of lessons){if(ids.has(l.id))bad(M,'id de aula repetido: '+l.id);ids.add(l.id)}
 if(!Array.isArray(m.quiz))bad(M,'quiz deve ser uma lista');
 else if(m.quiz.length<8||m.quiz.length>12)bad(M,'quiz deve ter entre 8 e 12 questões (há '+m.quiz.length+')');
 const quiz=Array.isArray(m.quiz)?m.quiz:[];
 quiz.forEach((q,i)=>{
  const Q=M+' questão '+(i+1);
  if(!Array.isArray(q)){bad(Q,'questão inválida (não é uma lista)');return}
  if(!str(q[0]))bad(Q,'enunciado vazio');
  if(!Array.isArray(q[1])||q[1].length<2)bad(Q,'precisa de pelo menos 2 alternativas');
  else if(!Number.isInteger(q[2])||q[2]<0||q[2]>=q[1].length)bad(Q,'indiceCerto inválido: '+q[2]);
  if(!str(q[3]))bad(Q,'explicação vazia');
 });
 {const idx=quiz.filter(q=>Array.isArray(q)&&Number.isInteger(q[2])).map(q=>q[2]);
  if(idx.length){const cnt={};for(const i of idx)cnt[i]=(cnt[i]||0)+1;const vals=Object.keys(cnt);
   if(vals.length<3)bad(M,'quiz: a resposta certa precisa variar entre pelo menos 3 posições (usa '+vals.length+': '+vals.join(', ')+')');
   for(const [i,n] of Object.entries(cnt))if(n>idx.length/2)bad(M,'quiz: a posição '+i+' é a certa em '+n+' de '+idx.length+' questões (máximo: metade)');}}
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
   if(['p','analogy','example','summary','data'].includes(b.t)&&!str(b.text))bad(B,'text vazio');
   if(b.t==='table'){
    if(!Array.isArray(b.headers)||!b.headers.length||!b.headers.every(h=>typeof h==='string'))bad(B,'headers deve ser uma lista de textos');
    if(!Array.isArray(b.rows)||!b.rows.every(Array.isArray))bad(B,'rows deve ser uma lista de listas');
    else if(Array.isArray(b.headers))b.rows.forEach((r,j)=>{if(r.length!==b.headers.length)bad(B,'linha '+(j+1)+' tem '+r.length+' células; headers tem '+b.headers.length)});
   }
   if(b.t==='scene'||b.t==='interactive'){
    if(!KINDS[b.t].includes(b.kind))bad(B,'kind desconhecido: '+b.kind);
    if(!str(b.caption))bad(B,'caption vazio');
    if(!str(b.alt))bad(B,'alt vazio');
   }
   if(b.t==='figure'){
    if(!str(b.caption))bad(B,'caption vazio');
    if(!str(b.alt))bad(B,'alt vazio');
    const s=b.svg||'';
    if(!/^<svg/.test(s))bad(B,'svg deve começar com <svg');
    if(/<script/i.test(s))bad(B,'svg contém <script');
    if(/\bon\w+\s*=/i.test(s))bad(B,'svg contém atributo on*=');
    if(/href\s*=\s*["']https?/i.test(s))bad(B,'svg contém href remoto');
    if(/\sid\s*=/i.test(s))bad(B,'svg contém id= (a figura aparece duas vezes na página)');
    if(/href\s*=\s*["']?\s*(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(s))bad(B,'svg contém href com endereço // (remoto)');
    if(/url\(\s*["']?\s*(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(s)||/url\(\s*["']?\s*http/i.test(s))bad(B,'svg contém url() remoto');
    if(/<image\b/i.test(s))bad(B,'svg contém <image');
    if(/<foreignObject/i.test(s))bad(B,'svg contém <foreignObject');
    if(/\srole\s*=/i.test(s))bad(B,'svg contém role= (o render já põe role="img")');
   }
   if(b.t==='data'){
    if(!Object.prototype.hasOwnProperty.call(SOURCES,b.source))bad(B,'source inexistente: '+b.source);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date||''))bad(B,'date deve ser AAAA-MM-DD');
    else if(!realDate(b.date))bad(B,'date não é uma data real: '+b.date);
   }
   if(b.t==='terms'){if(!Array.isArray(b.terms))bad(B,'terms deve ser uma lista');else for(const t of b.terms)if(!termSet.has(String(t).toLowerCase()))bad(B,'termo fora do glossário: '+t)}
  });
 }
}
if(errs.length){console.error('content FALHOU ('+errs.length+'):\n - '+errs.join('\n - '));process.exit(1)}
console.log(novos.length?'content ok: '+novos.length+' módulo(s) no formato novo ('+[...novosIds].join(', ')+')':'content ok: nenhum módulo no formato novo ainda');
