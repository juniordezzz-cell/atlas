/* ATLAS · Juros Compostos (Ferramentas/juros-compostos/)
   Contas em ../_comum/calculos.js (testadas no Node). Aqui só a tela:
   lê os campos, chama as contas, desenha resultado, tabela e gráfico.
   Rede só pelo AtlasHttp: a Selic do Banco Central (série 432).
   Registro: docs/ferramentas-bancada-2026-11-08.md */
(function () {
  'use strict';
  var C = window.AtlasCalculos;
  var $ = function (id) { return document.getElementById(id); };
  var SELIC_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json';
  var CHAVE_SELIC = 'atlas.juros.selic.v1';
  var MOEDAS = { BRL: { sim: 'R$', loc: 'pt-BR' }, USD: { sim: 'US$', loc: 'en-US' }, EUR: { sim: '€', loc: 'de-DE' } };
  var moeda = 'BRL', selic = null, selicFonte = '';

  function fmt(v) {
    return new Intl.NumberFormat(MOEDAS[moeda].loc, { style: 'currency', currency: moeda, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  }
  function pct(v, casas) { return v.toLocaleString('pt-BR', { maximumFractionDigits: casas == null ? 2 : casas }) + '%'; }
  function ler(id) { var n = C.lerNumero($(id).value); return n == null ? 0 : n; }
  function meses(m) {
    var a = Math.floor(m / 12), r = m % 12;
    var t = (a ? a + (a > 1 ? ' anos' : ' ano') : '') + (a && r ? ' e ' : '') + (r ? r + (r > 1 ? ' meses' : ' mês') : '');
    return t || '0 meses';
  }
  function mesesAteMeta(ini, i, aporte, meta) {
    var m = 0, s = ini;
    if (aporte <= 0 && i <= 0) return null;
    while (s < meta && m < 1200) { s = s * (1 + i) + aporte; m++; }
    return s >= meta ? m : null;
  }
  function celulas(tr, textos) {
    textos.forEach(function (t) { var td = document.createElement('td'); td.textContent = t; tr.appendChild(td); });
  }

  function lerEntrada() {
    var taxa = ler('jz-taxa'), anual = $('jz-tipo-taxa').value === 'anual';
    var per = Math.max(0, Math.floor(ler('jz-periodo')));
    return {
      ini: ler('jz-inicial'), aporte: ler('jz-aporte'), retirada: $('jz-retirada-campo').hidden ? 0 : ler('jz-retirada'),
      i: anual ? C.anualParaMensal(taxa) : taxa / 100,
      taxaAno: anual ? taxa : C.mensalParaAnual(taxa / 100),
      meses: $('jz-tipo-periodo').value === 'anos' ? per * 12 : per,
      inflacao: ler('jz-inflacao'), meta: ler('jz-meta')
    };
  }

  function calcular() {
    var e = lerEntrada();
    var R = C.jurosCompostos({ inicial: e.ini, aporte: e.aporte, taxaMensal: e.i, meses: e.meses, retirada: e.retirada });
    $('jz-resultado').hidden = false;
    $('jz-r-final').textContent = fmt(R.saldoFinal);
    $('jz-r-investido').textContent = fmt(R.investido);
    $('jz-r-juros').textContent = fmt(R.jurosTotais);
    $('jz-r-zerou').textContent = R.mesQueZerou ? 'Com essa retirada, o saldo acaba no mês ' + R.mesQueZerou + '.' : '';

    // dinheiro de hoje
    var real = R.saldoFinal / Math.pow(1 + e.inflacao / 100, e.meses / 12);
    var ganhoReal = ((1 + e.taxaAno / 100) / (1 + e.inflacao / 100) - 1) * 100;
    $('jz-r-real').textContent = fmt(real);
    $('jz-r-real-nota').textContent = 'Com ' + pct(e.inflacao, 1) + ' de inflação ao ano, ' + fmt(R.saldoFinal) +
      ' compram o mesmo que ' + fmt(real) + ' hoje. Ganho real: ' + pct(ganhoReal, 1) + ' ao ano.';

    // meta
    $('jz-meta-box').hidden = !(e.meta > 0);
    if (e.meta > 0) {
      var liquido = e.aporte - e.retirada, nota;
      if (R.saldoFinal >= e.meta) {
        $('jz-r-meta').textContent = 'Atingida';
        var m = mesesAteMeta(e.ini, e.i, liquido, e.meta);
        nota = 'Com ' + fmt(e.aporte) + ' por mês você chega a ' + fmt(e.meta) + ' em ' + meses(m) + '.';
      } else {
        var g = Math.pow(1 + e.i, e.meses), precisa;
        if (e.meses <= 0) precisa = NaN;
        else if (e.i === 0) precisa = (e.meta - e.ini) / e.meses;
        else precisa = (e.meta - e.ini * g) * e.i / (g - 1);
        precisa += e.retirada;
        $('jz-r-meta').textContent = precisa > 0 ? fmt(precisa) + '/mês' : '—';
        var m2 = mesesAteMeta(e.ini, e.i, liquido, e.meta);
        nota = 'É o aporte mensal para chegar a ' + fmt(e.meta) + ' no prazo escolhido.' +
          (m2 != null ? ' Mantendo ' + fmt(e.aporte) + ' por mês, você chega lá em ' + meses(m2) + '.' : '');
      }
      $('jz-r-meta-nota').textContent = nota;
    }

    // renda fixa
    var linhas = [['Sua taxa', e.taxaAno]];
    if (selic) linhas.push(['100% do CDI', Math.max(0, selic - 0.1)], ['Poupança', selic > 8.5 ? C.mensalParaAnual(0.005) : selic * 0.7]);
    var tb = $('jz-cmp'); tb.textContent = '';
    linhas.forEach(function (l, k) {
      var v = C.jurosCompostos({ inicial: e.ini, aporte: e.aporte, taxaMensal: C.anualParaMensal(l[1]), meses: e.meses, retirada: e.retirada }).saldoFinal;
      var d = R.saldoFinal - v, tr = document.createElement('tr');
      celulas(tr, [l[0], pct(l[1]), fmt(v), k === 0 ? '—' : (d >= 0 ? '+' : '−') + fmt(Math.abs(d))]);
      if (k > 0) tr.lastChild.className = d >= 0 ? 'pos' : 'neg';
      tb.appendChild(tr);
    });
    $('jz-cmp-nota').textContent = selic
      ? 'Selic de ' + pct(selic) + ' (' + selicFonte + '). CDI antes do imposto de renda; poupança isenta. Mesmos aportes e mesmo prazo nas três linhas.'
      : 'Buscando a Selic no Banco Central…';

    // tabela mês a mês
    var tm = $('jz-meses'); tm.textContent = '';
    R.serie.forEach(function (p) {
      var tr = document.createElement('tr');
      celulas(tr, [String(p.mes), fmt(p.juros), fmt(p.investido), fmt(p.jurosAcumulados), fmt(p.saldo)]);
      tm.appendChild(tr);
    });
    desenhar(R.serie);
  }

  function desenhar(serie) {
    if (typeof Chart === 'undefined') return;
    var c = $('jz-grafico'), velho = Chart.getChart(c);
    if (velho) velho.destroy();
    var muitos = serie.length > 60;
    new Chart(c, {
      type: 'line',
      data: {
        labels: serie.map(function (p) { return p.mes; }),
        datasets: [
          { label: 'Total acumulado', data: serie.map(function (p) { return +p.saldo.toFixed(2); }), borderColor: '#5b8cff', backgroundColor: 'rgba(91,140,255,.08)', fill: true, pointRadius: muitos ? 0 : 2, borderWidth: 2, tension: .2 },
          { label: 'Valor investido', data: serie.map(function (p) { return +p.investido.toFixed(2); }), borderColor: '#7d8aa0', borderDash: [5, 4], fill: false, pointRadius: 0, borderWidth: 2, tension: .2 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: function (it) { return 'Mês ' + it[0].label; }, label: function (ctx) { return ctx.dataset.label + ': ' + fmt(ctx.parsed.y); } } } },
        scales: {
          x: { ticks: { color: '#556074', maxTicksLimit: 12 }, grid: { display: false } },
          y: { ticks: { color: '#556074', callback: function (v) { return v >= 1e6 ? (v / 1e6).toFixed(1) + ' mi' : v >= 1e3 ? (v / 1e3).toFixed(0) + ' mil' : v; } }, grid: { color: 'rgba(255,255,255,.04)' } }
        }
      }
    });
  }

  // Selic: guardada primeiro, depois a do Banco Central (12 h de cache no AtlasHttp)
  try {
    var c = JSON.parse(localStorage.getItem(CHAVE_SELIC) || 'null');
    if (c && c.v) { selic = c.v; selicFonte = 'guardada em ' + new Date(c.t).toLocaleDateString('pt-BR'); }
  } catch (e) {}
  AtlasHttp.getJSON(SELIC_URL, { ttl: 12 * 3600 * 1000 }).then(function (d) {
    var v = parseFloat(String(d && d[0] && d[0].valor).replace(',', '.'));
    if (!(v > 0)) return;
    selic = v; selicFonte = 'Banco Central, ' + d[0].data;
    try { localStorage.setItem(CHAVE_SELIC, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {}
    if (!$('jz-resultado').hidden) calcular();
  }).catch(function () {
    if (!selic) $('jz-cmp-nota').textContent = 'Não consegui buscar a Selic agora. A comparação com CDI e poupança volta quando o Banco Central responder.';
  });

  // eventos
  document.querySelectorAll('#jz-moeda button').forEach(function (b) {
    b.addEventListener('click', function () {
      moeda = b.dataset.cur;
      document.querySelectorAll('#jz-moeda button').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      document.querySelectorAll('.jz-sim').forEach(function (s) { s.textContent = MOEDAS[moeda].sim; });
      if (!$('jz-resultado').hidden) calcular();
    });
  });
  $('jz-calcular').addEventListener('click', calcular);
  $('jz-retiradas').addEventListener('click', function () { $('jz-retirada-campo').hidden = !$('jz-retirada-campo').hidden; });
  $('jz-limpar').addEventListener('click', function () {
    [['jz-inicial', '1.000'], ['jz-aporte', '500'], ['jz-taxa', '12'], ['jz-periodo', '10'], ['jz-inflacao', '4,5'], ['jz-meta', ''], ['jz-retirada', '0']]
      .forEach(function (p) { $(p[0]).value = p[1]; });
    $('jz-retirada-campo').hidden = true;
    $('jz-resultado').hidden = true;
  });
  document.querySelectorAll('.bloco input').forEach(function (inp) {
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') calcular(); });
  });
})();
