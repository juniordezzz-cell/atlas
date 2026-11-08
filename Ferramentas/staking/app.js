/* ATLAS · Staking (Ferramentas/staking/)
   Contas em ../_comum/calculos.js: staking, aprParaApy, apyParaApr.
   Rede só pelo AtlasHttp: busca e preço do token (busca-token.js) e o
   dólar em reais pela cotação do USDT. Registro: docs/ferramentas-bancada-2026-11-08.md */
(function () {
  'use strict';
  var C = window.AtlasCalculos;
  var $ = function (id) { return document.getElementById(id); };
  var modo = 'valor', horizonte = 12, dolar = null, ultimo = null;
  var NOMES = { 1: '1 mês', 3: '3 meses', 6: '6 meses', 12: '1 ano', 24: '2 anos', 60: '5 anos' };

  function ler(id) { var n = C.lerNumero($(id).value); return n == null ? 0 : n; }
  function tok(v) { return v.toLocaleString('pt-BR', { maximumFractionDigits: v >= 100 ? 2 : v >= 1 ? 4 : 6 }); }
  function usd(v) { return 'US$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: Math.abs(v) < 1 && v !== 0 ? 6 : 2 }); }
  function brl(v) { return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pct(v) { return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%'; }
  function ganho(qtd, taxaPct, meses) { return C.staking({ quantidade: qtd, taxaPct: taxaPct, meses: meses, modo: $('sk-tipo').value }).rendimento; }
  function celulas(tr, textos) { textos.forEach(function (t) { var td = document.createElement('td'); td.textContent = t; tr.appendChild(td); }); }
  function status(t) { $('sk-status').textContent = t || ''; }

  function calcular() {
    var preco = ler('sk-preco'), taxa = ler('sk-taxa');
    var qtd = modo === 'valor' ? (preco > 0 ? ler('sk-valor') / preco : 0) : ler('sk-qtd');
    var sym = ($('sk-sym').value || 'TOKEN').trim().toUpperCase();
    ultimo = { preco: preco, taxa: taxa, qtd: qtd, sym: sym, infl: ler('sk-infl'), cen: ler('sk-cen') / 100 };
    $('sk-resultado').hidden = false;

    // projeção
    var tb = $('sk-proj'); tb.textContent = '';
    [1, 3, 6, 12, 24, 60].forEach(function (m) {
      var g = ganho(qtd, taxa, m), tr = document.createElement('tr');
      if (m === horizonte) tr.className = 'ativa';
      celulas(tr, [NOMES[m], '+' + tok(g), tok(qtd + g), preco ? usd(g * preco) : '—', preco && dolar ? brl(g * preco * dolar) : '—']);
      tr.children[1].className = 'pos';
      tb.appendChild(tr);
    });
    destaque();

    // taxa equivalente e rendimento real
    var apy = $('sk-tipo').value === 'apy' ? taxa : C.aprParaApy(taxa, 365);
    if ($('sk-tipo').value === 'apy') { $('sk-r-equiv').textContent = pct(C.apyParaApr(taxa, 365)) + ' APR'; $('sk-r-equiv-nota').textContent = 'o mesmo rendimento sem reinvestir'; }
    else { $('sk-r-equiv').textContent = pct(apy) + ' APY'; $('sk-r-equiv-nota').textContent = 'reinvestindo o rendimento todo dia'; }
    var real = ((1 + apy / 100) / (1 + ultimo.infl / 100) - 1) * 100;
    var re = $('sk-r-real'); re.textContent = (real >= 0 ? '+' : '') + pct(real); re.className = 'res__valor ' + (real >= 0 ? 'pos' : 'neg');

    // cenário de preço em 1 ano
    var tot = qtd + ganho(qtd, taxa, 12), hoje = qtd * preco;
    $('sk-r-cen').textContent = preco ? usd(tot * preco * (1 + ultimo.cen)) : '—';
    $('sk-r-cen-nota').textContent = preco ? 'preço ' + (ultimo.cen >= 0 ? '+' : '') + Math.round(ultimo.cen * 100) + '% · hoje vale ' + usd(hoje) : 'informe o preço do token';
    var tc = $('sk-cenarios'); tc.textContent = '';
    [-0.5, -0.25, 0, 0.25, 0.5, 1].forEach(function (v) {
      var com = tot * preco * (1 + v), sem = qtd * preco * (1 + v), r = com - hoje, tr = document.createElement('tr');
      celulas(tr, [(v >= 0 ? '+' : '') + Math.round(v * 100) + '%', preco ? usd(com) : '—', preco ? usd(sem) : '—', preco ? (r >= 0 ? '+' : '−') + usd(Math.abs(r)) : '—']);
      if (preco) tr.lastChild.className = r >= 0 ? 'pos' : 'neg';
      tc.appendChild(tr);
    });
    grafico();
  }

  function destaque() {
    if (!ultimo) return;
    var g = ganho(ultimo.qtd, ultimo.taxa, horizonte);
    $('sk-r-tokens').textContent = tok(g) + ' ' + ultimo.sym;
    $('sk-r-periodo').textContent = 'em ' + NOMES[horizonte];
    $('sk-r-usd').textContent = ultimo.preco ? usd(g * ultimo.preco) : '—';
    $('sk-r-brl').textContent = ultimo.preco && dolar ? brl(g * ultimo.preco * dolar) : '—';
    $('sk-r-fx').textContent = dolar ? 'US$ 1 = ' + brl(dolar) : 'buscando o dólar…';
    var linhas = $('sk-proj').rows, idx = { 1: 0, 3: 1, 6: 2, 12: 3, 24: 4, 60: 5 }[horizonte];
    for (var i = 0; i < linhas.length; i++) linhas[i].className = i === idx ? 'ativa' : '';
  }

  function grafico() {
    if (typeof Chart === 'undefined' || !ultimo) return;
    var rot = [], tk = [], tkReal = [];
    for (var m = 0; m <= 60; m += 3) {
      rot.push(m % 12 === 0 ? (m / 12) + (m === 12 ? ' ano' : ' anos') : '');
      var t = ultimo.qtd + ganho(ultimo.qtd, ultimo.taxa, m);
      tk.push(t); tkReal.push(t / Math.pow(1 + ultimo.infl / 100, m / 12));
    }
    var c = $('sk-grafico'), velho = Chart.getChart(c); if (velho) velho.destroy();
    new Chart(c, {
      type: 'line',
      data: { labels: rot, datasets: [
        { label: 'Tokens na carteira', data: tk, borderColor: '#2ec785', backgroundColor: 'rgba(46,199,133,.08)', fill: true, pointRadius: 0, borderWidth: 2, tension: .2 },
        { label: 'Descontando a inflação do token', data: tkReal, borderColor: '#f5b942', borderDash: [5, 4], pointRadius: 0, borderWidth: 2, tension: .2 }
      ] },
      options: { responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { labels: { color: '#7d8aa0', boxWidth: 12 } }, tooltip: { callbacks: { label: function (x) { return x.dataset.label + ': ' + tok(x.parsed.y); } } } },
        scales: { x: { ticks: { color: '#556074', autoSkip: false, maxRotation: 0 }, grid: { display: false } },
                  y: { ticks: { color: '#556074', callback: function (v) { return tok(v); } }, grid: { color: 'rgba(255,255,255,.04)' } } } }
    });
  }

  // token
  AtlasBuscaToken.ligar({
    input: $('sk-busca'), lista: $('sk-sugestoes'), aoErro: status,
    aoEscolher: function (t) {
      status('Buscando o preço…');
      $('sk-ficha').hidden = false; $('sk-ficha-nome').textContent = t.nome + ' (' + t.sym + ')';
      var img = $('sk-ficha-img'); img.hidden = !t.img; if (t.img) img.src = t.img;
      $('sk-sym').value = t.sym;
      AtlasBuscaToken.mercado(t.id).then(function (m) {
        $('sk-preco').value = String(+m.preco.toPrecision(8)).replace('.', ',');
        status('Preço de hoje: ' + usd(m.preco) + '.'); calcular();
      }).catch(function (e) { status('Não consegui buscar o preço (' + e.message + '). Digite o preço à mão.'); });
    }
  });

  // dólar em reais (cotação do USDT)
  AtlasHttp.getJSON('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=brl,usd', { ttl: 600000 }).then(function (d) {
    var t = d && d.tether; if (t && t.brl > 0 && t.usd > 0) { dolar = t.brl / t.usd; if (ultimo) calcular(); }
  }).catch(function () { if (ultimo) destaque(); });

  // eventos
  document.querySelectorAll('#sk-modo button').forEach(function (b) {
    b.addEventListener('click', function () {
      modo = b.dataset.modo;
      document.querySelectorAll('#sk-modo button').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      $('sk-campo-valor').hidden = modo !== 'valor'; $('sk-campo-qtd').hidden = modo !== 'qtd';
    });
  });
  document.querySelectorAll('#sk-horizonte button').forEach(function (b) {
    b.addEventListener('click', function () {
      horizonte = +b.dataset.m;
      document.querySelectorAll('#sk-horizonte button').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      destaque();
    });
  });
  $('sk-calcular').addEventListener('click', calcular);
  ['sk-infl', 'sk-cen', 'sk-tipo'].forEach(function (id) { $(id).addEventListener(id === 'sk-tipo' ? 'change' : 'input', function () { if (ultimo) calcular(); }); });
  document.querySelectorAll('.bloco input').forEach(function (inp) {
    if (inp.id === 'sk-busca') return;
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') calcular(); });
  });
})();
