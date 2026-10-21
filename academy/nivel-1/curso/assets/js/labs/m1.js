/* Módulo 1: laboratórios da cifra de César e da frequência de letras. */
AcademyLabs.m1=(function(){
 const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
 /* Frase original, cifrada com caesar(...,3). */
 const SECRETO='Phqvdjhqv vhfuhwdv halvwhp kd plokduhv gh dqrv. Txhp oh vhp d fkdyh yh dshqdv ohwudv vhp vhqwlgr. Frqwdu dv ohwudv pdlv frpxqv dmxgd d ghvfreulu r vhjuhgr hvfrqglgr.';
 let decifrar=false;
 function normalize(t){return String(t).normalize('NFD').replace(/[̀-ͯ]/g,'');}
 function caesar(t,s){const k=((Math.trunc(Number(s))||0)%26+26)%26;return normalize(t).replace(/[A-Za-z]/g,c=>{const b=c<'a'?65:97;return String.fromCharCode((c.charCodeAt(0)-b+k)%26+b);});}
 function bruteForce(t){const r=[];for(let s=1;s<=25;s++)r.push({shift:s,text:caesar(t,-s)});return r;}
 function frequencies(t){const c={};let n=0;for(const ch of normalize(t).toLowerCase()){if(ch>='a'&&ch<='z'){c[ch]=(c[ch]||0)+1;n++;}}const f={};if(n)for(const k of Object.keys(c))f[k]=c[k]/n;return f;}
 const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const $=id=>document.getElementById(id);
 function desloc(){const v=Number($('cesar-deslocamento').value);return Math.min(25,Math.max(0,Number.isFinite(v)?Math.trunc(v):0));}
 function cifrar(){
  const s=desloc(),t=$('cesar-texto').value,k=decifrar?-s:s;
  $('cesar-saida').textContent=caesar(t,k);
  const baixo=A.slice((26+k)%26)+A.slice(0,(26+k)%26);
  $('cesar-alfabeto').innerHTML='<div style="white-space:pre"><span class="cesar-rotulo muted" style="display:inline-block;width:9ch">'+(decifrar?'Cifrado':'Original')+'</span><b>'+A+'</b></div><div style="white-space:pre"><span class="cesar-rotulo muted" style="display:inline-block;width:9ch">'+(decifrar?'Original':'Cifrado')+'</span><b>'+baixo+'</b></div>';
  $('cesar-modo').textContent=decifrar?'Modo: decifrar. Trocar para cifrar':'Modo: cifrar. Trocar para decifrar';
  $('cesar-modo').setAttribute('aria-pressed',String(decifrar));
 }
 function quebrar(){
  const t=$('cesar-quebrar-texto').value;
  $('cesar-forca-bruta').innerHTML=bruteForce(t).map(r=>'<li><b>Deslocamento '+r.shift+':</b> '+esc(r.text)+'</li>').join('');
 }
 function grafico(){
  const f=frequencies($('freq-texto').value),max=Math.max(0,...Object.values(f)),box=$('freq-grafico');
  if(!max){box.innerHTML='<p class="notice">Digite um texto com letras para ver a contagem.</p>';return;}
  const W=640,H=220,x0=30,y0=190,h=160,bw=(W-x0-10)/26;
  let bars='',rows='';
  for(let i=0;i<26;i++){
   const l=A[i].toLowerCase(),v=f[l]||0,bh=v/max*h,x=x0+i*bw;
   bars+='<rect x="'+(x+3).toFixed(1)+'" y="'+(y0-bh).toFixed(1)+'" width="'+(bw-6).toFixed(1)+'" height="'+bh.toFixed(1)+'" rx="2" fill="'+(v===max?'#67e8f9':'#60a5fa')+'"/>'
    +'<text x="'+(x+bw/2).toFixed(1)+'" y="208" text-anchor="middle" font-size="11" fill="#a9b8cf">'+A[i]+'</text>';
   rows+='<tr><th scope="row">'+A[i]+'</th><td>'+(v*100).toFixed(1).replace('.',',')+'%</td></tr>';
  }
  const grid=[0,.5,1].map(p=>{const y=y0-p*h;return '<line x1="'+x0+'" x2="'+(W-10)+'" y1="'+y+'" y2="'+y+'" stroke="#2a3b55"/><text x="'+(x0-4)+'" y="'+(y+4)+'" text-anchor="end" font-size="10" fill="#a9b8cf">'+(max*p*100).toFixed(0)+'%</text>';}).join('');
  const topo=Object.keys(f).sort((a,b)=>f[b]-f[a])[0].toUpperCase();
  box.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" aria-label="Gráfico de barras: percentual de cada letra no texto. A letra mais frequente é '+topo+'.">'+grid+bars+'</svg>'
   +'<p class="chart-caption">Cada barra mostra que parte das letras do texto é aquela letra. A barra mais clara é a mais comum: '+topo+'.</p>'
   +'<details><summary>Ver os valores em tabela</summary><div class="table-scroll"><table class="chart-table"><thead><tr><th scope="col">Letra</th><th scope="col">Parte do texto</th></tr></thead><tbody>'+rows+'</tbody></table></div></details>';
 }
 function html(){
  return '<section class="panel"><h2>Cifra de César: cifrar e decifrar</h2><p class="muted">A cifra de César troca cada letra por outra, andando um número fixo de casas no alfabeto. Esse número é o deslocamento e funciona como a chave. Acentos são retirados e números e sinais ficam como estão.</p>'
  +'<div class="sim-grid"><label class="sim-field" for="cesar-texto">Texto<input id="cesar-texto" value="Veni, vidi, vici"></label>'
  +'<label class="sim-field" for="cesar-deslocamento">Deslocamento (0 a 25)<input id="cesar-deslocamento" type="number" value="3" min="0" max="25" step="1"></label></div>'
  +'<button class="btn" id="cesar-modo" type="button" style="margin:18px 0" aria-pressed="false">Modo: cifrar. Trocar para decifrar</button>'
  +'<output id="cesar-saida" class="hash-output" aria-live="polite"></output>'
  +'<p class="chart-caption">Veja como o alfabeto desliza. Cada letra de cima vira a letra de baixo.</p>'
  +'<div id="cesar-alfabeto" style="font-family:monospace;letter-spacing:.12em;overflow-x:auto;white-space:nowrap"></div></section>'
  +'<section class="panel"><h2>Quebrar por tentativa</h2><p class="muted">Só existem 25 deslocamentos possíveis. Então dá para testar todos e ver qual deixa o texto legível. Isso se chama força bruta.</p>'
  +'<label class="sim-field" for="cesar-quebrar-texto">Texto cifrado<textarea id="cesar-quebrar-texto" rows="4">'+SECRETO+'</textarea></label>'
  +'<ol id="cesar-forca-bruta" style="margin-top:18px"></ol></section>'
  +'<section class="panel"><h2>Contar letras</h2><p class="muted">Em português, algumas letras aparecem mais do que outras (a, e e o costumam liderar). Mesmo sem saber a chave, a letra mais comum do texto cifrado dá uma pista de qual letra ela representa.</p>'
  +'<label class="sim-field" for="freq-texto">Texto para analisar<textarea id="freq-texto" rows="4">'+SECRETO+'</textarea></label>'
  +'<div id="freq-grafico" style="margin-top:18px"></div></section>';
 }
 function init(){
  const liga=(id,fn)=>{const el=$(id);if(el)el.oninput=fn;};
  if(!$('cesar-saida'))return;
  liga('cesar-texto',cifrar);liga('cesar-deslocamento',cifrar);liga('cesar-quebrar-texto',quebrar);liga('freq-texto',grafico);
  $('cesar-modo').onclick=()=>{decifrar=!decifrar;cifrar();};
  cifrar();quebrar();grafico();
 }
 return {normalize,caesar,bruteForce,frequencies,html,init};
})();
