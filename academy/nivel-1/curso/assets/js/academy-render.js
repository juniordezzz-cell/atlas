/* Desenha as aulas do formato novo (blocos). Texto puro entra escapado; só **negrito** vira marcação. */
const AcademyRender = {
 esc(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
 inline(text){return this.esc(text).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');},
 date(iso){const m=String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+'/'+m[2]+'/'+m[1]:this.esc(iso);},
 block(b,m){
  switch(b.t){
   case 'p':return `<p>${this.inline(b.text)}</p>`;
   case 'analogy':return `<div class="aula-analogia"><strong>Pense assim</strong>${this.inline(b.text)}</div>`;
   case 'example':return `<div class="example"><strong>Exemplo com números</strong>${this.inline(b.text)}</div>`;
   case 'figure':return `<figure class="aula-figura" role="group">${String(b.svg).replace(/^\s*<svg/,'<svg role="img" aria-label="'+this.esc(b.alt||'')+'"')}<figcaption>${this.inline(b.caption||'')}</figcaption></figure>`;
   case 'data':{const s=(typeof SOURCES!=='undefined'&&SOURCES[b.source])||null;return `<p class="aula-dado">${this.inline(b.text)} ${s?`<a href="${this.esc(s[1])}" target="_blank" rel="noopener noreferrer">${this.esc(s[0])} ↗</a>`:''} <span class="aula-data">consultado em ${this.date(b.date)}</span></p>`;}
   case 'table':return `<div class="table-scroll"><table class="chart-table comparison"><caption>${this.inline(b.caption||'')}</caption><thead><tr>${b.headers.map(h=>'<th scope="col">'+this.inline(h)+'</th>').join('')}</tr></thead><tbody>${b.rows.map(r=>'<tr>'+r.map((c,i)=>i===0?'<th scope="row">'+this.inline(c)+'</th>':'<td>'+this.inline(c)+'</td>').join('')+'</tr>').join('')}</tbody></table></div>`;
   case 'summary':return `<p class="aula-frase"><strong>Em uma frase</strong> ${this.inline(b.text)}</p>`;
   case 'terms':return `<p class="aula-termos"><span>Termos desta aula:</span> ${b.terms.map(t=>`<button class="btn small" type="button" data-term="${this.esc(t)}" onclick="academy.term(this.dataset.term)">${this.esc(t)}</button>`).join(' ')}</p>`;
   default:return '';
  }
 },
 lesson(m,lesson,i){
  const key=m.id+':'+lesson.id,saved=academy.state.bookmarks.includes(key),srcs=(lesson.sources||[]).filter(k=>SOURCES[k]);
  return `<article id="lesson-${m.id}-${this.esc(lesson.id)}" class="lesson"><h2>${String(i+1).padStart(2,'0')}. ${this.esc(lesson.title)}</h2>${lesson.blocks.map(b=>this.block(b,m)).join('')}<div class="lesson-foot"><div class="source-inline">${srcs.map(k=>`<a href="${this.esc(SOURCES[k][1])}" target="_blank" rel="noopener noreferrer">${this.esc(SOURCES[k][0])} ↗</a>`).join('')}</div><button class="btn small" aria-pressed="${saved}" onclick="academy.bookmark('${key}',this)">${saved?'★ Salvo':'☆ Salvar'}</button></div></article>`;
 },
 history(m){
  const h=m.history||{intro:'',timeline:[]};
  return `<section id="historia-${m.id}" class="aula-historia"><h2 tabindex="-1">Como tudo começou</h2><p>${this.inline(h.intro||'')}</p><ol class="timeline">${(h.timeline||[]).map(t=>`<li><span class="when">${this.esc(t.when)}</span><strong>${this.esc(t.title)}</strong><p>${this.inline(t.text)}</p></li>`).join('')}</ol></section>`;
 },
 figures(m){
  if(!AcademyContent.isNew(m))return '';
  return m.lessons.map(l=>l.blocks.filter(b=>b.t==='figure').map(b=>`<section class="panel aula-infografico"><h3>${this.esc(l.title)}</h3>${this.block(b,m)}</section>`).join('')).join('');
 }
};
