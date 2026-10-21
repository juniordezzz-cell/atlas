/* Academy · camada visual (piloto de 21/10/2026, Módulo 1).
   - Liga os blocos novos: interativo "hash" (SHA-256 de verdade, via
     crypto.subtle) e cena "cadeia" (3D com Three.js; sem WebGL, o SVG).
   - Monta o cenário 3D da trilha na Visão geral.
   - GSAP + ScrollTrigger: aulas e palco aparecem ao rolar, e o índice
     marca a aula que está na tela.
   academy.js chama AcademyVisual.montar() depois de cada troca de tela e
   AcademyVisual.atualizar() a cada troca de aba. Sem GSAP, sem WebGL ou com
   "menos movimento", tudo continua funcionando parado. */
const AcademyVisual={
 cenas:[],
 calmo(){return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;},
 webgl(){
  if(this._gl!==undefined)return this._gl;
  try{const c=document.createElement('canvas');this._gl=!!(window.WebGLRenderingContext&&(c.getContext('webgl2')||c.getContext('webgl')));}catch(_){this._gl=false;}
  return this._gl;
 },
 tres(){return this._tres||(this._tres=import('./academy-3d.js'));},
 /* O curso rola dentro de <main> quando ele tem barra própria; senão, a janela. */
 rolagem(){const m=document.querySelector('main');return m&&m.scrollHeight>m.clientHeight+2&&/(auto|scroll)/.test(getComputedStyle(m).overflowY)?m:window;},
 limpar(){
  this.cenas.forEach(c=>{try{c.destruir();}catch(_){}});this.cenas=[];
  if(window.ScrollTrigger)ScrollTrigger.getAll().forEach(t=>t.kill());
 },
 montar(){
  this.limpar();
  const raiz=document.getElementById('view-container');if(!raiz)return;
  raiz.querySelectorAll('.aula-interativo[data-interativo="hash"]').forEach(f=>this.hash(f));
  raiz.querySelectorAll('.aula-interativo[data-interativo]').forEach(f=>{const k=f.dataset.interativo;if(k!=='hash'&&typeof AcademyInterativos!=='undefined'&&AcademyInterativos.ligar[k])AcademyInterativos.ligar[k](f);});
  raiz.querySelectorAll('.aula-cena[data-cena="cadeia"]').forEach(f=>this.cadeia(f));
  raiz.querySelectorAll('.aula-cena[data-cena="camadas"]').forEach(f=>this.camadas(f));
  const trilha=raiz.querySelector('[data-trilha]');if(trilha)this.trilha(trilha);
  this.rolar(raiz);
 },
 /* Aba escondida mede zero; ao trocar de aba, recalcula as posições. */
 atualizar(){if(window.ScrollTrigger)ScrollTrigger.refresh();},

 async sha256(texto){
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
 },
 hash(fig){
  const ent=fig.querySelector('.hash-entrada'),saida=fig.querySelector('.hash-saida'),aviso=fig.querySelector('.hash-mudou');
  if(!ent||!saida)return;
  if(!window.crypto?.subtle){saida.textContent='Este navegador não oferece SHA-256 nesta página.';return;}
  let antes=null,vez=0;const doc=fig.ownerDocument;
  const calc=async()=>{
   const minha=++vez,h=await this.sha256(ent.value);if(minha!==vez)return;
   let mudou=0;
   /* Caractere que mudou desde a versão anterior vai num <mark>. */
   saida.replaceChildren(...[...h].map((c,i)=>{if(antes&&antes[i]!==c){mudou++;const k=doc.createElement('mark');k.textContent=c;return k;}return doc.createTextNode(c);}));
   if(aviso)aviso.textContent=antes===null?'Troque uma letra e veja quantos caracteres do resumo mudam.':antes===h?'Mesmo texto, mesmo resumo.':mudou+' de 64 caracteres mudaram.';
   antes=h;
  };
  ent.addEventListener('input',calc);calc();
 },
 cadeia(fig){
  const caixa=fig.querySelector('.cena-3d'),plano=fig.querySelector('.cena-plano'),estado=fig.querySelector('.cena-estado');
  const inteira=fig.querySelector('.plano-inteira'),quebrada=fig.querySelector('.plano-quebrada');
  const bAlt=fig.querySelector('[data-acao="alterar"]'),bRes=fig.querySelector('[data-acao="restaurar"]');
  let cena=null,q=false;
  const aplicar=v=>{
   q=v;bAlt.disabled=q;bRes.disabled=!q;
   if(inteira)inteira.hidden=q;if(quebrada)quebrada.hidden=!q;
   estado.textContent=q?'Alteração detectada: o hash do bloco 2 virou 9b04, mas o bloco 3 ainda espera c71e. A ligação se rompeu.':'Cadeia íntegra: cada bloco guarda o hash do anterior.';
   cena?.quebrar(q);
   (q?bRes:bAlt).focus({preventScroll:true});
  };
  bAlt.addEventListener('click',()=>aplicar(true));bRes.addEventListener('click',()=>aplicar(false));
  if(!this.webgl()||!caixa)return;
  this.tres().then(m=>{
   if(!fig.isConnected)return;
   /* A caixa aparece antes da cena nascer, para o renderer medir o tamanho certo. */
   fig.classList.add('com-3d');
   cena=m.cadeia(caixa);this.cenas.push(cena);
   caixa.setAttribute('role','img');caixa.setAttribute('aria-label',plano?.getAttribute('aria-label')||'');caixa.removeAttribute('aria-hidden');
   if(q)cena.quebrar(true);
  }).catch(()=>fig.classList.remove('com-3d'));
 },
 /* L1, rollup e sidechain: só olhar e girar; sem WebGL fica o SVG. */
 camadas(fig){
  const caixa=fig.querySelector('.cena-3d'),plano=fig.querySelector('.cena-plano');
  if(!this.webgl()||!caixa)return;
  this.tres().then(m=>{
   if(!fig.isConnected)return;
   fig.classList.add('com-3d');
   this.cenas.push(m.camadas(caixa));
   caixa.setAttribute('role','img');caixa.setAttribute('aria-label',plano?.getAttribute('aria-label')||'');caixa.removeAttribute('aria-hidden');
  }).catch(()=>fig.classList.remove('com-3d'));
 },
 trilha(el){
  if(!this.webgl())return;
  const mods=COURSE,st=academy.state,feitos=[...new Set([...st.completed,...st.studied])];
  const nome=el.querySelector('.trilha-nome');
  this.tres().then(m=>{
   if(!el.isConnected)return;
   el.classList.add('com-3d');
   const cena=m.trilha(el.querySelector('.trilha-3d'),{modulos:mods,feitos,atual:st.last,
    aoEscolher:i=>app.navigate(mods[i].id),
    aoPassar:i=>{if(nome)nome.textContent=i<0?'Arraste para girar. Clique num bloco para abrir o módulo.':String(i+1).padStart(2,'0')+' · '+mods[i].title;}});
   this.cenas.push(cena);
  }).catch(()=>el.classList.remove('com-3d'));
 },
 rolar(raiz){
  if(!window.gsap||!window.ScrollTrigger)return;
  gsap.registerPlugin(ScrollTrigger);
  const scroller=this.rolagem(),calmo=this.calmo();
  /* O índice começa por "Como tudo começou" e segue as aulas na mesma ordem. */
  const aulas=[...raiz.querySelectorAll('#tab-content .aula-historia, #tab-content .lesson')];
  const links=[...raiz.querySelectorAll('.lesson-toc a')].filter(l=>!/Indo além/.test(l.textContent));
  aulas.forEach((a,i)=>{
   ScrollTrigger.create({trigger:a,scroller,start:'top 45%',end:'bottom 45%',onToggle:s=>{if(s.isActive){links.forEach(l=>l.classList.remove('ativo'));links[i]?.classList.add('ativo');}}});
   if(calmo)return;
   const vis=a.querySelector('.aula-visual');
   gsap.from(a,{opacity:0,y:24,duration:0.6,ease:'power2.out',scrollTrigger:{trigger:a,scroller,start:'top 90%',once:true}});
   if(vis)gsap.from(vis,{opacity:0,x:28,duration:0.8,delay:0.12,ease:'power3.out',scrollTrigger:{trigger:a,scroller,start:'top 82%',once:true}});
  });
  const barra=raiz.querySelector('.aula-progresso i'),cont=raiz.querySelector('#tab-content');
  if(barra&&cont)ScrollTrigger.create({trigger:cont,scroller,start:'top top',end:'bottom bottom',onUpdate:s=>{barra.style.transform='scaleX('+s.progress.toFixed(3)+')';}});
 }
};
window.AcademyVisual=AcademyVisual;
