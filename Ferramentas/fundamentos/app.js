/* ATLAS · Ferramentas/fundamentos/app.js   (28/11/2026)
   Tela da ferramenta Fundamentos de Protocolo. A conta mora em conta.js.

   Rede só pelo roteador (AtlasDados.pedir('defillama', ...)), que cuida de
   fila, pausa depois de limite e pedido repetido.
     catálogo   lite/protocols2           (nome, símbolo, valor de mercado)
     séries     summary/fees/<slug>?dataType=dailyFees | dailyRevenue | dailyHoldersRevenue
                summary/dexs/<slug>       (volume; protocolo que não é DEX responde erro → sem volume)
   Guardado no navegador: catálogo 6 h, séries de cada protocolo 1 h, escolha da pessoa. */
(function () {
  'use strict';
  var C = window.FundamentosConta;
  var LL = 'https://api.llama.fi';
  var PADRAO = ['uniswap', 'aero-protocol', 'pancakeswap', 'raydium', 'orca'];
  var MAX = 6;
  var K_ESCOLHA = 'atlas.fundamentos.escolha.v1', K_CAT = 'atlas.fundamentos.catalogo.v1', K_SERIE = 'atlas.fundamentos.serie.v1.';
  var TIPOS = { taxas: 'dailyFees', receita: 'dailyRevenue', token: 'dailyHoldersRevenue' };

  var $ = function (id) { return document.getElementById(id); };
  var estado = { dias: 30, escolha: [], catalogo: [], porSlug: {}, dados: {}, foco: null, metrica: 'taxas' };
  var grafico = null;

  /* ---------- guardar no navegador (falha calada: modo privado etc.) ---------- */
  function ler(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function gravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* cheio ou bloqueado */ } }

  function pedir(url, timeout) {
    if (window.AtlasDados) return AtlasDados.pedir('defillama', url, { timeout: timeout || 20000 });
    return AtlasHttp.getJSON(url, { timeout: timeout || 20000 });
  }

  /* ---------- formato ---------- */
  function usd(v) {
    if (v == null || !isFinite(v)) return '—';
    var a = Math.abs(v), f = function (n, d) { return n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); };
    if (a >= 1e9) return '$' + f(v / 1e9, 2) + ' bi';
    if (a >= 1e6) return '$' + f(v / 1e6, 1) + ' mi';
    if (a >= 1e3) return '$' + f(v / 1e3, 0) + ' mil';
    return '$' + f(v, 0);
  }
  function pct(v) { return v == null || !isFinite(v) ? '' : (v >= 0 ? '+' : '−') + Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(v) < 10 ? 1 : 0 }) + '%'; }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function limpa(e) { while (e.firstChild) e.removeChild(e.firstChild); }

  /* ---------- catálogo ---------- */
  function carregarCatalogo() {
    var g = ler(K_CAT);
    if (g && Date.now() - g.t < 6 * 3600e3 && g.lista && g.lista.length) return Promise.resolve(g.lista);
    return pedir(LL + '/lite/protocols2', 30000).then(function (lite) {
      var lista = C.catalogo(lite).slice(0, 500).map(function (p) { return { slug: p.slug, nome: p.nome, simbolo: p.simbolo, mcap: p.mcap }; });
      if (!lista.length) throw new Error('catálogo vazio');
      gravar(K_CAT, { t: Date.now(), lista: lista });
      return lista;
    }).catch(function (e) { if (g && g.lista) return g.lista; throw e; });
  }

  /* ---------- séries de um protocolo ---------- */
  function hojeUtc() { var d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000; }
  function serieDe(resp) {
    var corte = hojeUtc();   // o dia de hoje ainda está pela metade: fica de fora
    return C.limpaSerie(resp && resp.totalDataChart).filter(function (p) { return p[0] < corte; }).slice(-800);
  }
  function carregarSeries(slug) {
    var g = ler(K_SERIE + slug);
    if (g && Date.now() - g.t < 3600e3) return Promise.resolve(g.s);
    var base = '?excludeTotalDataChartBreakdown=true';
    var pedidos = [
      pedir(LL + '/summary/dexs/' + encodeURIComponent(slug) + base).then(serieDe, function () { return null; })
    ].concat(Object.keys(TIPOS).map(function (m) {
      return pedir(LL + '/summary/fees/' + encodeURIComponent(slug) + base + '&dataType=' + TIPOS[m]).then(serieDe, function () { return null; });
    }));
    return Promise.all(pedidos).then(function (r) {
      var s = { volume: r[0] && r[0].length ? r[0] : null, taxas: r[1], receita: r[2], token: r[3] };
      if (!s.volume && !s.taxas) throw new Error('sem dados para ' + slug);
      gravar(K_SERIE + slug, { t: Date.now(), s: s });
      return s;
    });
  }

  /* ---------- escolha ---------- */
  function salvarEscolha() { gravar(K_ESCOLHA, estado.escolha); }
  function adicionar(slug) {
    if (!estado.porSlug[slug] || estado.escolha.indexOf(slug) >= 0) return;
    if (estado.escolha.length >= MAX) { $('fd-status').textContent = 'Até ' + MAX + ' protocolos por vez. Tire um para pôr outro.'; return; }
    estado.escolha.push(slug); salvarEscolha(); desenhaChips(); buscarEDesenhar(slug);
  }
  function remover(slug) {
    estado.escolha = estado.escolha.filter(function (s) { return s !== slug; }); salvarEscolha();
    if (estado.foco === slug) estado.foco = estado.escolha[0] || null;
    desenhaChips(); desenhaTabela(); desenhaFoco();
  }

  function desenhaChips() {
    var box = $('fd-chips'); limpa(box);
    estado.escolha.forEach(function (slug) {
      var p = estado.porSlug[slug]; if (!p) return;
      var c = el('span', 'fd-chip');
      c.appendChild(el('span', null, p.nome + (p.simbolo ? ' · ' + p.simbolo : '')));
      var x = el('button', 'fd-chip-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Tirar ' + p.nome);
      x.addEventListener('click', function () { remover(slug); });
      c.appendChild(x); box.appendChild(c);
    });
  }

  function montaBusca() {
    var dl = $('fd-lista'); limpa(dl);
    var porTexto = {};
    estado.catalogo.forEach(function (p) {
      var t = p.nome + (p.simbolo ? ' (' + p.simbolo + ')' : '');
      porTexto[t.toLowerCase()] = p.slug;
      var o = el('option'); o.value = t; dl.appendChild(o);
    });
    var inp = $('fd-busca');
    function tenta() {
      var v = inp.value.trim().toLowerCase(); if (!v) return;
      var slug = porTexto[v];
      if (!slug) {   // símbolo ou nome digitado direto
        var achado = estado.catalogo.filter(function (p) { return (p.simbolo || '').toLowerCase() === v || p.nome.toLowerCase() === v; })[0];
        slug = achado && achado.slug;
      }
      if (slug) { adicionar(slug); inp.value = ''; }
    }
    inp.addEventListener('change', tenta);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); tenta(); } });
  }

  /* ---------- tabela ---------- */
  function celula(tr, valor, variacao, titulo) {
    var td = el('td');
    td.appendChild(el('span', 'fd-v', valor));
    if (variacao != null && isFinite(variacao)) td.appendChild(el('small', variacao >= 0 ? 'pos' : 'neg', pct(variacao)));
    if (titulo) td.title = titulo;
    tr.appendChild(td);
  }
  function desenhaTabela() {
    var tb = $('fd-tabela'); limpa(tb);
    var d = estado.dias;
    $('fd-titulo-tabela').textContent = d === 365 ? 'Comparação · último ano contra o anterior' : 'Comparação · últimos ' + d + ' dias contra os ' + d + ' anteriores';
    estado.escolha.forEach(function (slug) {
      var p = estado.porSlug[slug], s = estado.dados[slug], tr = el('tr');
      var nome = el('td', 'fd-nome'); nome.appendChild(el('b', null, p ? p.nome : slug)); if (p && p.simbolo) nome.appendChild(el('small', null, p.simbolo));
      tr.appendChild(nome);
      if (s === undefined) { var c = el('td', 'fd-carregando', 'carregando…'); c.colSpan = 6; tr.appendChild(c); tb.appendChild(tr); return; }
      if (s === null) { var e = el('td', 'fd-carregando', 'a DefiLlama não tem esses números para este protocolo'); e.colSpan = 6; tr.appendChild(e); tb.appendChild(tr); return; }
      var r = C.resumo({ nome: p.nome, simbolo: p.simbolo, mcap: p.mcap, series: s }, d);
      celula(tr, usd(r.mcap));
      celula(tr, r.volume ? usd(r.volume.soma) : '—', r.volume && r.volume.variacao, r.volume ? null : 'Não é DEX: não tem volume de negociação.');
      celula(tr, r.taxas ? usd(r.taxas.soma) : '—', r.taxas && r.taxas.variacao);
      celula(tr, r.token ? usd(r.token.soma) : '—', r.token && r.token.variacao);
      celula(tr, r.parteToken != null ? r.parteToken.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '—');
      celula(tr, r.multiploToken != null ? r.multiploToken.toLocaleString('pt-BR', { maximumFractionDigits: r.multiploToken < 10 ? 1 : 0 }) : '—',
        null, r.multiploToken != null ? 'Valor de mercado ÷ receita do token em um ano' : 'Sem receita para o token: não há como calcular.');
      tr.className = 'clicavel' + (estado.foco === slug ? ' ativa' : ''); tr.tabIndex = 0;
      var foca = function () { estado.foco = slug; desenhaTabela(); desenhaFoco(); };
      tr.addEventListener('click', foca);
      tr.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); foca(); } });
      tb.appendChild(tr);
    });
  }

  /* ---------- foco + gráfico ---------- */
  function desenhaFoco() {
    var sec = $('fd-foco'), slug = estado.foco, s = slug && estado.dados[slug], p = slug && estado.porSlug[slug];
    if (!s || !p) { sec.hidden = true; return; }
    sec.hidden = false;
    $('fd-foco-nome').textContent = p.nome + (p.simbolo ? ' · ' + p.simbolo : '');
    $('fd-leitura').textContent = C.leitura(C.resumo({ nome: p.nome, simbolo: p.simbolo, mcap: p.mcap, series: s }, estado.dias));
    var botVol = document.querySelector('#fd-metrica [data-m="volume"]');
    botVol.hidden = !s.volume;
    if (estado.metrica === 'volume' && !s.volume) estado.metrica = 'taxas';
    marca('#fd-metrica', 'm', estado.metrica);
    var serie = s[estado.metrica] ? C.media7(s[estado.metrica]).slice(-365) : [];
    $('fd-grafico-nota').textContent = serie.length ? 'Último ano, média de 7 dias por dia.' : 'A DefiLlama não tem essa série para este protocolo.';
    if (!window.Chart) return;
    var dados = { labels: serie.map(function (x) { return new Date(x[0] * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); }),
      datasets: [{ data: serie.map(function (x) { return x[1]; }), borderColor: '#5b8cff', backgroundColor: 'rgba(91,140,255,.12)', fill: true, pointRadius: 0, borderWidth: 2, tension: .25 }] };
    if (grafico) { grafico.data = dados; grafico.update(); return; }
    grafico = new Chart($('fd-grafico'), {
      type: 'line', data: dados,
      options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return usd(c.parsed.y) + ' por dia'; } } } },
        scales: { x: { ticks: { color: '#7d8aa0', maxTicksLimit: 8 }, grid: { display: false } },
          y: { ticks: { color: '#7d8aa0', callback: function (v) { return usd(v); } }, grid: { color: 'rgba(125,138,160,.12)' } } } }
    });
  }

  function marca(sel, attr, valor) {
    document.querySelectorAll(sel + ' button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset[attr] === String(valor))); });
  }

  /* ---------- carga ---------- */
  function buscarEDesenhar(slug) {
    estado.dados[slug] = undefined; desenhaTabela();
    return carregarSeries(slug).then(function (s) { estado.dados[slug] = s; }, function () { estado.dados[slug] = null; })
      .then(function () {
        if (!estado.foco && estado.dados[slug]) estado.foco = slug;
        desenhaTabela(); desenhaFoco();
      });
  }

  function iniciar() {
    document.querySelectorAll('#fd-periodo button').forEach(function (b) {
      b.addEventListener('click', function () { estado.dias = +b.dataset.dias; marca('#fd-periodo', 'dias', estado.dias); desenhaTabela(); desenhaFoco(); });
    });
    document.querySelectorAll('#fd-metrica button').forEach(function (b) {
      b.addEventListener('click', function () { estado.metrica = b.dataset.m; desenhaFoco(); });
    });
    carregarCatalogo().then(function (lista) {
      estado.catalogo = lista;
      lista.forEach(function (p) { estado.porSlug[p.slug] = p; });
      var salvo = ler(K_ESCOLHA);
      estado.escolha = (Array.isArray(salvo) && salvo.length ? salvo : PADRAO).filter(function (s) { return estado.porSlug[s]; }).slice(0, MAX);
      $('fd-status').textContent = lista.length + ' protocolos com token na lista. Valores em dólar, da DefiLlama; o dia de hoje fica de fora porque ainda não terminou.';
      montaBusca(); desenhaChips();
      // um de cada vez: o roteador já enfileira, e assim a tabela vai enchendo
      estado.escolha.reduce(function (pr, slug) { return pr.then(function () { return buscarEDesenhar(slug); }); }, Promise.resolve());
    }).catch(function () {
      $('fd-status').textContent = 'A DefiLlama não respondeu agora. Recarregue a página em alguns minutos.';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
