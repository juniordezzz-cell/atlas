/* Cenas 3D do Academy (Three.js 0.170, assets/vendor). Carregado sob demanda
   por academy-visual.js, só quando há WebGL. Duas cenas:
   - trilha(el, opts): os 10 módulos como blocos encadeados. Concluído = bloco
     cheio; atual = pulsa devagar; os outros = só contorno. Clique abre o módulo,
     arrastar gira.
   - cadeia(el, opts): 4 blocos ligados por hash; quebrar(true) altera o bloco 2
     e mostra a ligação com o 3 rompida.
   Visual sereno com exceção de piloto: sem brilho, sem neon. Com "menos
   movimento" a cena fica parada e só redesenha quando algo muda. */
import * as THREE from '../../../../../assets/vendor/three-0.170.0/three.module.min.js';

const COR={azul:0x60a5fa,ciano:0x67e8f9,violeta:0xa78bfa,vermelho:0xf87171,linha:0x2a3b55,fundo:0x111c30,texto:'#e2e8f0',mudo:'#a9b8cf'};
const calmo=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* Base comum: renderer, câmera, luz, arrastar para girar, pausa fora da tela. */
/* encaixe: proporção (largura/altura) em que a cena cabe inteira; em caixa
   mais estreita que isso, a câmera se afasta. */
function palco(el,{distancia,altura=0,encaixe=0}){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
 renderer.setClearColor(0x000000,0);
 el.appendChild(renderer.domElement);
 const cena=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(38,1,0.1,100);
 camera.position.set(0,altura,distancia);camera.lookAt(0,0,0);
 cena.add(new THREE.AmbientLight(0xffffff,0.55));
 const sol=new THREE.DirectionalLight(0xffffff,1.1);sol.position.set(4,6,8);cena.add(sol);
 const grupo=new THREE.Group();cena.add(grupo);
 const s={renderer,cena,camera,grupo,el,giro:{x:0,y:0},alvo:{x:0,y:0},arrastando:false,visivel:true,vivo:true,sujo:true,quadro:null,tick:null};
 const medir=()=>{const w=el.clientWidth||1,h=el.clientHeight||1;renderer.setSize(w,h,false);camera.aspect=w/h;const k=Math.max(1,encaixe/camera.aspect);camera.position.set(0,altura*k,distancia*k);camera.lookAt(0,0,0);camera.updateProjectionMatrix();s.sujo=true;s.laco?.();};
 medir();
 const ro=new ResizeObserver(medir);ro.observe(el);
 const io=new IntersectionObserver(([e])=>{s.visivel=e.isIntersecting;if(s.visivel)laco();},{threshold:0});io.observe(el);
 let px=0,py=0,moveu=0;
 const dom=renderer.domElement;
 dom.style.touchAction='pan-y';
 dom.addEventListener('pointerdown',e=>{s.arrastando=true;moveu=0;px=e.clientX;py=e.clientY;});
 window.addEventListener('pointerup',s.soltar=()=>{s.arrastando=false;});
 dom.addEventListener('pointermove',e=>{if(!s.arrastando)return;const dx=e.clientX-px,dy=e.clientY-py;moveu+=Math.abs(dx)+Math.abs(dy);px=e.clientX;py=e.clientY;s.alvo.y+=dx*0.008;s.alvo.x=Math.max(-0.6,Math.min(0.6,s.alvo.x+dy*0.005));s.sujo=true;laco();});
 s.foiArraste=()=>moveu>6;
 const relogio=new THREE.Clock();
 function laco(){
  if(s.quadro||!s.vivo)return;
  s.quadro=requestAnimationFrame(()=>{
   s.quadro=null;if(!s.vivo)return;
   const t=relogio.getElapsedTime(),mover=!calmo();
   s.giro.x+=(s.alvo.x-s.giro.x)*0.12;s.giro.y+=(s.alvo.y-s.giro.y)*0.12;
   const parado=Math.abs(s.alvo.x-s.giro.x)<1e-3&&Math.abs(s.alvo.y-s.giro.y)<1e-3;
   grupo.rotation.x=s.giro.x;grupo.rotation.y=s.giro.y+(mover?Math.sin(t*0.15)*0.18:0);
   if(s.tick)s.tick(t,mover);
   renderer.render(cena,camera);s.sujo=false;
   if(s.visivel&&(mover||!parado||s.sujo))laco();
  });
 }
 s.laco=laco;
 s.destruir=()=>{s.vivo=false;if(s.quadro)cancelAnimationFrame(s.quadro);ro.disconnect();io.disconnect();window.removeEventListener('pointerup',s.soltar);
  cena.traverse(o=>{o.geometry?.dispose?.();const m=o.material;(Array.isArray(m)?m:m?[m]:[]).forEach(x=>{x.map?.dispose?.();x.dispose();});});
  renderer.dispose();dom.remove();};
 return s;
}

/* Etiqueta de texto desenhada num canvas (número do módulo, dados do bloco). */
function etiqueta(linhas,{w=256,h=256,tamanho=44,cores}={}){
 const c=document.createElement('canvas');c.width=w;c.height=h;
 const g=c.getContext('2d');g.textAlign='center';g.textBaseline='middle';
 const passo=h/(linhas.length+1);
 linhas.forEach((l,i)=>{g.font=(i===0?'700 ':'500 ')+(i===0?tamanho:Math.round(tamanho*0.62))+'px system-ui, sans-serif';g.fillStyle=cores?.[i]||(i===0?COR.texto:COR.mudo);g.fillText(l,w/2,passo*(i+1));});
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
 return tex;
}

function cubo(tam,cor,cheio){
 const geo=new THREE.BoxGeometry(tam,tam,tam);
 const corpo=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:cheio?cor:COR.fundo,transparent:true,opacity:cheio?0.82:0.35,roughness:0.55,metalness:0.1}));
 const borda=new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color:cor}));
 corpo.add(borda);
 return corpo;
}

function ligacao(a,b,cor){
 const geo=new THREE.BufferGeometry().setFromPoints([a,b]);
 return new THREE.Line(geo,new THREE.LineBasicMaterial({color:cor}));
}

export function trilha(el,{modulos,feitos=[],atual,aoEscolher,aoPassar}){
 const s=palco(el,{distancia:10.5,altura:2.4,encaixe:2.2});
 const n=modulos.length,blocos=[];
 /* Fileira levemente curva: o meio recua, as pontas avançam, e a altura ondula. */
 const pos=i=>{const u=i/(n-1)-0.5;return new THREE.Vector3(u*10.8,Math.sin(i*0.9)*0.35,-Math.cos(u*Math.PI)*1.6+0.6);};
 for(let i=0;i<n;i++){
  const feito=feitos.includes(modulos[i].id),eAtual=modulos[i].id===atual;
  const cor=feito?COR.ciano:eAtual?COR.azul:COR.violeta;
  const b=cubo(1.15,cor,feito||eAtual);
  b.position.copy(pos(i));b.rotation.y=-pos(i).x*0.12;
  const rotulo=new THREE.Mesh(new THREE.PlaneGeometry(1.05,1.05),new THREE.MeshBasicMaterial({map:etiqueta([String(i+1).padStart(2,'0')],{tamanho:96}),transparent:true,depthWrite:false}));
  rotulo.position.z=0.585;b.add(rotulo);
  b.userData={i,eAtual};
  s.grupo.add(b);blocos.push(b);
  if(i)s.grupo.add(ligacao(pos(i-1),pos(i),feitos.includes(modulos[i-1].id)&&feito?COR.ciano:COR.linha));
 }
 const ray=new THREE.Raycaster(),ptr=new THREE.Vector2();let sobre=-1;
 const achar=e=>{const r=s.renderer.domElement.getBoundingClientRect();ptr.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ptr,s.camera);const hit=ray.intersectObjects(blocos,false)[0];return hit?hit.object.userData.i:-1;};
 s.renderer.domElement.addEventListener('pointermove',e=>{if(s.arrastando)return;const i=achar(e);if(i!==sobre){sobre=i;s.renderer.domElement.style.cursor=i<0?'grab':'pointer';aoPassar?.(i);s.sujo=true;s.laco();}});
 s.renderer.domElement.addEventListener('pointerleave',()=>{sobre=-1;aoPassar?.(-1);s.sujo=true;s.laco();});
 s.renderer.domElement.addEventListener('click',e=>{if(s.foiArraste())return;const i=achar(e);if(i>=0)aoEscolher?.(i);});
 s.tick=(t,mover)=>{blocos.forEach((b,i)=>{const alvo=i===sobre?1.15:b.userData.eAtual&&mover?1+Math.sin(t*1.6)*0.06:1;b.scale.setScalar(b.scale.x+(alvo-b.scale.x)*0.2);if(mover)b.position.y=pos(i).y+Math.sin(t*0.8+i)*0.06;});};
 s.laco();
 return {destruir:s.destruir};
}

export function cadeia(el){
 const s=palco(el,{distancia:7.4,altura:1.1,encaixe:2.1});
 const hash=['3fa9','c71e','58d2','a40b'],ant=['—','3fa9','c71e','58d2'];
 const xs=[-3.3,-1.1,1.1,3.3],blocos=[],faces=[],links=[];
 let quebrada=false,tremor=0;
 const face=(i)=>etiqueta(['Bloco '+(i+1),(quebrada&&i===1)?'dados alterados':'dados','anterior: '+ant[i],'hash: '+(quebrada&&i===1?'9b04':hash[i])],{tamanho:50,cores:[COR.texto,quebrada&&i===1?'#fca5a5':COR.mudo,quebrada&&i===2?'#fca5a5':'#67e8f9',COR.mudo]});
 for(let i=0;i<4;i++){
  const b=cubo(1.3,COR.azul,false);b.position.x=xs[i];
  const f=new THREE.Mesh(new THREE.PlaneGeometry(1.24,1.24),new THREE.MeshBasicMaterial({map:face(i),transparent:true,depthWrite:false}));
  f.position.z=0.66;b.add(f);faces.push(f);
  s.grupo.add(b);blocos.push(b);
  if(i){const l=ligacao(new THREE.Vector3(xs[i-1]+0.65,0,0),new THREE.Vector3(xs[i]-0.65,0,0),COR.ciano);s.grupo.add(l);links.push(l);}
 }
 const pintar=()=>{
  blocos.forEach((b,i)=>{const r=quebrada&&i>=1,cor=r?COR.vermelho:COR.azul;b.children[0].material.color.setHex(cor);b.material.color.setHex(r?0x3a1620:COR.fundo);
   const f=faces[i];f.material.map.dispose();f.material.map=face(i);f.material.needsUpdate=true;});
  links.forEach((l,i)=>l.material.color.setHex(quebrada&&i===1?COR.vermelho:COR.ciano));
 };
 s.tick=(t,mover)=>{
  blocos.forEach((b,i)=>{const alvoX=xs[i]+(quebrada&&i>=2?0.3:0);b.position.x+=(alvoX-b.position.x)*0.15;
   b.position.y=(i===1&&tremor>0?Math.sin(tremor*1.3)*0.08:0)+(mover?Math.sin(t*0.9+i)*0.04:0);});
  if(tremor>0)tremor--;
  /* A ligação 2→3 acompanha o bloco 3 quando ele se afasta. */
  const l=links[1],p=l.geometry.attributes.position;p.setX(1,blocos[2].position.x-0.65);p.needsUpdate=true;
 };
 s.laco();
 return {
  quebrar(v){quebrada=!!v;tremor=calmo()?0:24;pintar();s.sujo=true;s.laco();if(calmo())for(let k=0;k<30;k++)s.tick(0,false);},
  destruir:s.destruir
 };
}

/* L1 embaixo, rollup em cima juntando transações em lotes que descem para a
   L1, e sidechain ao lado, com consenso próprio, ligada por uma ponte. */
export function camadas(el){
 const s=palco(el,{distancia:7.2,altura:2.6,encaixe:1.7});
 const placa=(w,d,cor,y,x=0)=>{const g=new THREE.BoxGeometry(w,0.25,d);const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:COR.fundo,transparent:true,opacity:0.6,roughness:0.6}));m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g),new THREE.LineBasicMaterial({color:cor})));m.position.set(x,y,0);s.grupo.add(m);return m;};
 const rotulo=(txt,sub,x,y,z,cor)=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.6),new THREE.MeshBasicMaterial({map:etiqueta([txt,sub],{w:512,h:256,tamanho:64,cores:[cor,COR.mudo]}),transparent:true,depthWrite:false}));p.position.set(x,y,z);s.grupo.add(p);return p;};
 placa(8,3.2,COR.azul,-1.4);rotulo('L1','rede base',-2.6,-0.75,1.7,'#93c5fd');
 placa(3.6,2.2,COR.ciano,1.2,-1.6);rotulo('Rollup','executa fora',-1.6,2.35,1.2,'#67e8f9');
 placa(2.6,2.2,COR.violeta,1.2,2.6);rotulo('Sidechain','consenso próprio',2.6,2.35,1.2,'#c4b5fd');
 const ponte=ligacao(new THREE.Vector3(2.6,1.05,0),new THREE.Vector3(2.6,-1.25,0),COR.violeta);s.grupo.add(ponte);
 /* Transações pequenas no rollup; de tempos em tempos viram um lote que desce. */
 const txs=[];for(let k=0;k<6;k++){const c=cubo(0.22,COR.ciano,true);c.position.set(-2.9+(k%3)*0.55,1.5,-0.5+Math.floor(k/3)*0.6);s.grupo.add(c);txs.push(c);}
 const lote=cubo(0.5,COR.ciano,true);lote.position.set(-1.6,1.2,0);lote.visible=false;s.grupo.add(lote);
 const blocosL1=[];for(let k=0;k<5;k++){const b=cubo(0.42,COR.azul,false);b.position.set(-1.6+k*0.7,-1.05,-0.8);s.grupo.add(b);blocosL1.push(b);}
 s.tick=(t,mover)=>{
  const fase=mover?(t%4)/4:0.99;
  txs.forEach((c,k)=>{c.visible=fase<0.45;c.position.y=1.5+(mover?Math.sin(t*2+k)*0.05:0);});
  lote.visible=fase>=0.45;lote.position.y=1.2-(Math.max(0,fase-0.5)/0.5)*2.2;
  blocosL1.forEach((b,k)=>{b.material.color.setHex(fase>0.95&&k===0?COR.ciano:COR.fundo);});
 };
 s.laco();
 return {destruir:s.destruir};
}
