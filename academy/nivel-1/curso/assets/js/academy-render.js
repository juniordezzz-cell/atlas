/* Desenha as aulas do formato novo (blocos). Texto puro entra escapado; só **negrito** vira marcação. */
const AcademyRender = {
 VISUAL:['figure','scene','interactive'],
 /* Cadeia de 4 blocos em SVG: plano B da cena 3D (sem WebGL) e versão do celular.
    quebrada=true pinta de vermelho o bloco 2 em diante e corta as ligações. */
 cadeiaSvg(quebrada){
  const hash=['3fa9','c71e','58d2','a40b'];if(quebrada)hash[1]='9b04';
  let s='<svg viewBox="0 0 640 170" xmlns="http://www.w3.org/2000/svg" font-family="inherit">';
  for(let i=0;i<4;i++){
   const x=12+i*158,r=quebrada&&i>=1,corte=quebrada&&i===2,cor=r?'#f87171':'#60a5fa';
   if(i)s+='<line x1="'+(x-28)+'" y1="85" x2="'+x+'" y2="85" stroke="'+(corte?'#f87171':'#67e8f9')+'" stroke-width="3"'+(corte?' stroke-dasharray="5 5"':'')+'/>';
   s+='<rect x="'+x+'" y="30" width="130" height="110" rx="10" fill="#111c30" stroke="'+cor+'" stroke-width="2"/>'
    +'<text x="'+(x+65)+'" y="56" text-anchor="middle" font-size="14" font-weight="700" fill="#e2e8f0">Bloco '+(i+1)+'</text>'
    +'<text x="'+(x+65)+'" y="82" text-anchor="middle" font-size="12" fill="'+(quebrada&&i===1?'#fca5a5':'#a9b8cf')+'">'+(quebrada&&i===1?'dados alterados':'dados')+'</text>'
    +'<text x="'+(x+65)+'" y="108" text-anchor="middle" font-size="12" fill="'+(corte?'#fca5a5':'#67e8f9')+'">anterior: '+(i?['','3fa9','c71e','58d2'][i]:'—')+'</text>'
    +'<text x="'+(x+65)+'" y="128" text-anchor="middle" font-size="12" fill="#a9b8cf">hash: '+hash[i]+'</text>';
  }
  return s+'</svg>';
 },
 esc(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
 inline(text){return this.esc(text).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');},
 date(iso){const m=String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+'/'+m[2]+'/'+m[1]:this.esc(iso);},
 block(b,m){
  switch(b.t){
   case 'p':return `<p>${this.inline(b.text)}</p>`;
   case 'analogy':return `<div class="aula-analogia"><strong>Pense assim</strong>${this.inline(b.text)}</div>`;
   case 'example':return `<div class="example"><strong>Exemplo com números</strong>${this.inline(b.text)}</div>`;
   case 'figure':return `<figure class="aula-figura">${String(b.svg).replace(/^\s*<svg/,'<svg role="img" aria-label="'+this.esc(b.alt||'')+'"')}<figcaption>${this.inline(b.caption||'')}</figcaption></figure>`;
   case 'data':{const s=(typeof SOURCES!=='undefined'&&SOURCES[b.source])||null;return `<p class="aula-dado">${this.inline(b.text)} ${s?`<a href="${this.esc(s[1])}" target="_blank" rel="noopener noreferrer">${this.esc(s[0])} ↗</a>`:''} <span class="aula-data">consultado em ${this.date(b.date)}</span></p>`;}
   case 'table':return `<div class="table-scroll"><table class="chart-table comparison"><caption>${this.inline(b.caption||'')}</caption><thead><tr>${b.headers.map(h=>'<th scope="col">'+this.inline(h)+'</th>').join('')}</tr></thead><tbody>${b.rows.map(r=>'<tr>'+r.map((c,i)=>i===0?'<th scope="row">'+this.inline(c)+'</th>':'<td>'+this.inline(c)+'</td>').join('')+'</tr>').join('')}</tbody></table></div>`;
   case 'summary':return `<p class="aula-frase"><strong>Em uma frase</strong> ${this.inline(b.text)}</p>`;
   case 'scene':return `<figure class="aula-cena" data-cena="${this.esc(b.kind)}"><div class="cena-3d" aria-hidden="true"></div><div class="cena-plano" role="img" aria-label="${this.esc(b.alt||'')}"><div class="plano-inteira">${this.cadeiaSvg(false)}</div><div class="plano-quebrada" hidden>${this.cadeiaSvg(true)}</div></div><div class="cena-controles"><button class="btn small" type="button" data-acao="alterar">Alterar o bloco 2</button><button class="btn small" type="button" data-acao="restaurar" disabled>Restaurar</button></div><p class="cena-estado" aria-live="polite">Cadeia íntegra: cada bloco guarda o hash do anterior.</p><figcaption>${this.inline(b.caption||'')}</figcaption></figure>`;
   case 'interactive':return `<figure class="aula-interativo" data-interativo="${this.esc(b.kind)}"><label class="interativo-rotulo">${this.inline(b.label||'Digite um texto')}<input class="hash-entrada" type="text" maxlength="200" value="${this.esc(b.value||'')}" autocomplete="off" spellcheck="false"></label><p class="interativo-sub">SHA-256 desse texto</p><output class="hash-saida" aria-live="polite">…</output><p class="hash-mudou">Troque uma letra e veja quantos caracteres do resumo mudam.</p><figcaption>${this.inline(b.caption||'')}</figcaption></figure>`;
   case 'terms':return `<p class="aula-termos"><span>Termos desta aula:</span> ${b.terms.map(t=>`<button class="btn small" type="button" data-term="${this.esc(t)}" aria-expanded="false" onclick="academy.term(this.dataset.term,this)">${this.esc(t)}</button>`).join(' ')}</p>`;
   default:return '';
  }
 },
 lesson(m,lesson,i){
  const key=m.id+':'+lesson.id,saved=academy.state.bookmarks.includes(key),srcs=(lesson.sources||[]).filter(k=>SOURCES[k]);
  /* Figura, cena e interativo vão juntos para a coluna da direita (palco),
     no lugar onde aparece o primeiro deles; no celular ficam no meio do texto. */
  let body='',visual='',slot=false;
  for(const b of lesson.blocks){if(this.VISUAL.includes(b.t)){visual+=this.block(b,m);if(!slot){body+='\u0000';slot=true;}}else body+=this.block(b,m);}
  body=body.replace('\u0000',`<div class="aula-visual">${visual}</div>`);
  return `<article id="lesson-${m.id}-${this.esc(lesson.id)}" class="lesson${visual?' tem-visual':''}"><h2>${String(i+1).padStart(2,'0')}. ${this.esc(lesson.title)}</h2>${body}<div class="lesson-foot"><div class="source-inline">${srcs.map(k=>`<a href="${this.esc(SOURCES[k][1])}" target="_blank" rel="noopener noreferrer">${this.esc(SOURCES[k][0])} ↗</a>`).join('')}</div><button class="btn small" aria-pressed="${saved}" onclick="academy.bookmark('${key}',this)">${saved?'★ Salvo':'☆ Salvar'}</button></div></article>`;
 },
 history(m){
  const h=m.history||{intro:'',timeline:[]};
  return `<section id="historia-${m.id}" class="aula-historia"><h2 tabindex="-1">Como tudo começou</h2><p>${this.inline(h.intro||'')}</p><ol class="timeline">${(h.timeline||[]).map(t=>`<li><span class="when">${this.esc(t.when)}</span><strong class="timeline-titulo">${this.esc(t.title)}</strong><p>${this.inline(t.text)}</p></li>`).join('')}</ol></section>`;
 },
 figures(m){
  if(!AcademyContent.isNew(m))return '';
  const html=m.lessons.map(l=>l.blocks.filter(b=>b.t==='figure').map(b=>`<section class="panel aula-infografico"><h3>${this.esc(l.title)}</h3>${this.block(b,m)}</section>`).join('')).join('');
  return html?'<h2>Figuras das aulas</h2>'+html:'';
 }
};
