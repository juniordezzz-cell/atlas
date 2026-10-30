const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');

function setup(supported=true){
  class Element extends EventTarget {
    constructor(){super();this.value='';this.attrs={};this.style={};this.isConnected=true;this.maxLength=-1;this.children=[];}
    setAttribute(k,v){this.attrs[k]=String(v);}
    appendChild(e){this.children.push(e);return e;}
    insertBefore(e){return this.appendChild(e);}
    getClientRects(){return [1];} contains(e){return e===this;}
    focus(){}
  }
  const doc=new Element();doc.createElement=()=>new Element();doc.hidden=false;
  const instances=[];
  class Recognition {
    constructor(){instances.push(this);}
    start(){this.onstart();}
    stop(){this.stopped=true;}
    abort(){this.aborted=true;}
    result(text,final=true){this.onresult({results:[Object.assign([{transcript:text}],{isFinal:final})]});}
  }
  const win={SpeechRecognition:supported?Recognition:undefined};
  vm.runInNewContext(fs.readFileSync('core/atlas-oraculo-voz.js','utf8'),{window:win,document:doc,Event,setTimeout,clearTimeout});
  function mount(value=''){
    const input=new Element(),composer=new Element();input.value=value;input.parentNode=composer;composer.parentNode=new Element();
    const control=win.AtlasOraculoVoz.mount(input);
    return {input,composer,control,button:composer.children[0],status:composer.parentNode.children[0]};
  }
  return {mount,instances,doc};
}

test('fala preenche rascunho, preserva texto anterior e não envia',()=>{
  const s=setup(),v=s.mount('Minha pergunta:');let sends=0;
  v.composer.addEventListener('submit',()=>sends++);
  v.button.dispatchEvent(new Event('click'));const r=s.instances[0];
  assert.equal(r.lang,'pt-BR');r.result('quanto tenho',false);assert.equal(v.input.value,'Minha pergunta:');
  r.result('quanto tenho',true);assert.equal(v.input.value,'Minha pergunta: quanto tenho');
  r.result('quanto tenho',true);assert.equal(v.input.value,'Minha pergunta: quanto tenho');
  r.onend();assert.equal(sends,0);assert.match(v.status.textContent,/Revise/);
});
test('eventos atrasados depois de enviar não repõem texto nem confirmação',()=>{
  const s=setup(),v=s.mount();v.button.dispatchEvent(new Event('click'));const r=s.instances[0];
  r.result('confirmar');v.composer.dispatchEvent(new Event('click'));v.input.value='';
  r.result('confirmar');assert.equal(v.input.value,'');assert.equal(r.aborted,true);
});
test('permissão negada mantém digitação e permite tentar novamente',()=>{
  const s=setup(),v=s.mount('rascunho');v.button.dispatchEvent(new Event('click'));
  s.instances[0].onerror({error:'not-allowed'});
  assert.match(v.status.textContent,/permissão/i);assert.equal(v.input.value,'rascunho');
  v.button.dispatchEvent(new Event('click'));assert.equal(s.instances.length,2);v.control.cancel();
});
test('navegador sem suporte informa limitação e preserva campo',()=>{
  const s=setup(false),v=s.mount('texto');assert.equal(v.button.disabled,true);
  assert.match(v.status.textContent,/não oferece/);assert.equal(v.input.value,'texto');
});
test('somente um campo escuta por vez e ocultar página interrompe microfone',()=>{
  const s=setup(),a=s.mount(),b=s.mount();a.button.dispatchEvent(new Event('click'));
  b.button.dispatchEvent(new Event('click'));assert.equal(s.instances[0].aborted,true);
  s.doc.hidden=true;s.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(s.instances[1].aborted,true);
});
test('edição manual e limite do campo são respeitados',()=>{
  const s=setup(),v=s.mount();v.input.maxLength=5;v.button.dispatchEvent(new Event('click'));
  const r=s.instances[0];r.result('123456');assert.equal(v.input.value,'12345');
  v.input.value='editei';r.result('outra fala');assert.equal(v.input.value,'editei');assert.equal(r.aborted,true);
});
test('trocar conversa pelo menu externo interrompe fala antes de reutilizar o campo',()=>{
  const s=setup(),v=s.mount();v.button.dispatchEvent(new Event('click'));
  const r=s.instances[0];s.doc.dispatchEvent(new Event('click'));
  r.result('fala da conversa anterior');assert.equal(r.aborted,true);assert.equal(v.input.value,'');
});

