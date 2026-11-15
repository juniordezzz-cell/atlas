/* ============================================================
   ATLAS · Ferramentas/medo-e-ganancia/app.js
   Tela da ferramenta Medo e Ganância: 7 abas (Gráfico, Retornos, Tokens,
   Ondas de pânico, Medo → Lucro, Aportes, Guia). As contas ficam em
   estatistica.js; aqui só dados, desenho e controles.
   Dados: window.AtlasDados (velasLongas, medoGanancia). Nenhum fetch direto.
   Gráfico: Lightweight Charts 4.2.0 (assets/vendor/).
   Registro: docs/ferramenta-medo-ganancia-2026-11-14.md
   ============================================================ */
(function () {
  'use strict';
  var E = window.AtlasMedoGanancia, D = window.AtlasDados, LWC = window.LightweightCharts;
  var $ = function (id) { return document.getElementById(id); };
  var put = function (el, html) { var r = document.createRange(); r.selectNodeContents(el); el.replaceChildren(r.createContextualFragment(html)); };
  var DAY = 86400;
  var TOK = { BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', BNB: 'BNB', XRP: 'XRP', ADA: 'Cardano', DOGE: 'Dogecoin', LUNA: 'Terra (morto)' };
  var TFS = [['15m', '15m'], ['1h', '1h'], ['4h', '4h'], ['1d', '1D'], ['1w', '1S']];
  var DESDE = { '15m': 30, '1h': 180, '4h': 730 };
  var HZ = [7, 30, 90, 180, 365, 730], HZL = { 7: '7d', 30: '30d', 90: '3m', 180: '6m', 365: '1a', 730: '2a' };
  var INICIO = Date.UTC(2018, 0, 1);
  var fmtD = function (t) { return new Date(t * 1000).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }).replace('.', ''); };
  var fmtP = function (p) { return p == null ? '–' : p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 0 }) : p >= 1 ? p.toFixed(2) : p.toPrecision(4); };
  var pct = function (x, d) { return (x >= 0 ? '+' : '') + (x * 100).toFixed(d || 0) + '%'; };
  var cls = function (x) { return x >= 0 ? 'pos' : 'neg'; };
  var zone = function (v) { return v == null ? '' : v <= 25 ? 'Medo extremo' : v <= 45 ? 'Medo' : v <= 54 ? 'Neutro' : v <= 74 ? 'Ganância' : 'Ganância extrema'; };
  var ROOT = document.querySelector('.mg');
  var css = function (n) { return getComputedStyle(ROOT).getPropertyValue(n).trim(); };
  var rgba = function (h, a) { h = h.replace('#', ''); return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')'; };
  var usd = function (x) { return '$' + Math.round(x).toLocaleString('en-US'); };

  var st = { tok: 'BTC', tf: '1d', thr: 25, log: true, vol: true, band: true, mk: true, tab: 'agora', agAlvo: {}, agModo: 'medo', agTol: 0.1, hmM: 'med', tkM: 'win', epSort: 'rec',
    luEntry: 'first', luMin: 3, dcaAmt: 100, dcaFreq: 7, dcaFrom: 2018, dcaMult: 2, dcaView: 'val' };
  try { var sv = JSON.parse(localStorage.getItem('atlas.medoGanancia.v1') || '{}'); for (var k in st) if (k in sv) st[k] = sv[k]; if (!TOK[st.tok]) st.tok = 'BTC'; } catch (e) { /* sem armazenamento */ }
  var save = function () { try { localStorage.setItem('atlas.medoGanancia.v1', JSON.stringify(st)); } catch (e) { /* cheio ou bloqueado */ } };

  /* ---------- dados ---------- */
  var FNG = null, fLast = 0, DAILY = {}, LIVE = {};
  var fng = function (day) { var v = FNG.v[day - FNG.start]; return v == null ? null : v; };
  var deRoteador = function (cs) { return cs.map(function (c) { return { time: Math.floor(c.t / 1000), open: c.o, high: c.h, low: c.l, close: c.c, v: c.v || 0 }; }); };
  function deCompacto(o) {
    var n = o.c.length, out = new Array(n), t = o.t0;
    for (var i = 0; i < n; i++) { if (i > 0) t += (o.dt ? o.dt[i - 1] : 1) * o.s; out[i] = { time: t, open: o.o[i], high: o.h[i], low: o.l[i], close: o.c[i], v: o.v[i] }; }
    return out;
  }
  function weekly(d) {
    var out = [], w = null;
    d.forEach(function (c) {
      var day = Math.floor(c.time / DAY), wk = day - ((day + 3) % 7);
      if (!w || w.wk !== wk) { w = { wk: wk, time: wk * DAY, open: c.open, high: c.high, low: c.low, close: c.close, v: 0 }; out.push(w); }
      w.high = Math.max(w.high, c.high); w.low = Math.min(w.low, c.low); w.close = c.close; w.v += c.v;
    });
    return out;
  }
  var SER = {};
  function series(t) {
    if (SER[t]) return SER[t];
    var d = DAILY[t], p = new Map();
    d.forEach(function (c) { p.set(Math.floor(c.time / DAY), c.close); });
    var start = Math.floor(d[0].time / DAY), end = Math.floor(d[d.length - 1].time / DAY), dead = t === 'LUNA', last = d[d.length - 1].close;
    var price = function (i) {
      if (i < start) return null;
      if (i > end) return dead && i <= fLast ? last : null;
      var v = p.get(i), k = i; while (v == null && k > start) { k--; v = p.get(k); }
      return v;
    };
    return (SER[t] = { start: start, end: end, dead: dead, okEnd: dead ? fLast : end, price: price });
  }
  var memo = {};
  function rets(t, H) { var k = t + H; if (memo[k]) return memo[k]; var S = series(t); return (memo[k] = E.retornos(S.price, fng, Math.max(S.start, FNG.start), Math.min(S.end, fLast), H, S.okEnd)); }
  function episodesOf(t) { var S = series(t); return E.episodios(fng, Math.max(S.start, FNG.start), Math.min(S.end, fLast), st.thr, 10, 3); }
  var memoKey = function () { memo = {}; };

  /* ---------- cores ---------- */
  var hex = function (h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); };
  var mix = function (a, b, t) { return a.map(function (x, i) { return Math.round(x + (b[i] - x) * t); }); };
  function divColor(t) {
    var n = hex(css('--hm-neg')), m = hex(css('--hm-mid')), p = hex(css('--hm-pos'));
    t = Math.max(-1, Math.min(1, t)); var c = t < 0 ? mix(m, n, -t) : mix(m, p, t);
    return { bg: 'rgb(' + c + ')', ink: Math.abs(t) > 0.5 ? css('--hm-ink-strong') : css('--ink') };
  }
  var retT = function (r) { return Math.log(1 + Math.max(r, -0.999)) / Math.log(3); };
  var winT = function (w) { return (w - 0.5) / 0.35; };

  /* ---------- dica ao passar o mouse ---------- */
  var tip = $('tip');
  document.addEventListener('pointerover', function (e) { var el = e.target.closest && e.target.closest('[data-tip]'); if (!el) { tip.hidden = true; return; } put(tip, el.dataset.tip); tip.hidden = false; });
  document.addEventListener('pointermove', function (e) { if (tip.hidden) return; var w = tip.offsetWidth, h = tip.offsetHeight; tip.style.left = Math.min(e.clientX + 14, innerWidth - w - 8) + 'px'; tip.style.top = Math.max(8, e.clientY - h - 12) + 'px'; });

  /* ---------- gráfico principal ---------- */
  var chart, fchart, cs, vs, bs, bs2, fs, dcaChart, dcaS = [], LASTBAR = null, FGLINES = [], BARMAP = new Map(), FGMAP = new Map(), ZERO = null;
  function chartTheme() {
    return { layout: { background: { type: 'solid', color: css('--panel') }, textColor: css('--muted'), fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
      grid: { vertLines: { color: css('--grid') }, horzLines: { color: css('--grid') } },
      rightPriceScale: { borderColor: css('--line') }, timeScale: { borderColor: css('--line') },
      crosshair: { vertLine: { color: css('--muted'), labelBackgroundColor: css('--panel2') }, horzLine: { color: css('--muted'), labelBackgroundColor: css('--panel2') } } };
  }
  function initChart() {
    chart = LWC.createChart($('chart'), { autoSize: true, timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 6, visible: false },
      rightPriceScale: { scaleMargins: { top: 0.04, bottom: 0.04 }, minimumWidth: 84 }, localization: { locale: 'pt-BR', priceFormatter: function (p) { return fmtP(p); } } });
    chart.applyOptions(chartTheme());
    fchart = LWC.createChart($('chart-fg'), { autoSize: true, timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 6 },
      rightPriceScale: { scaleMargins: { top: 0.08, bottom: 0.08 }, minimumWidth: 84 }, localization: { locale: 'pt-BR', priceFormatter: function (p) { return Math.round(p) + ''; } } });
    fchart.applyOptions(chartTheme());
    var fixo01 = function () { return { priceRange: { minValue: 0, maxValue: 1 } }; };
    bs = chart.addHistogramSeries({ priceScaleId: 'bg', lastValueVisible: false, priceLineVisible: false, base: 0, autoscaleInfoProvider: fixo01, color: css('--fear-band') });
    chart.priceScale('bg').applyOptions({ scaleMargins: { top: 0, bottom: 0 }, visible: false });
    bs2 = fchart.addHistogramSeries({ priceScaleId: 'bg', lastValueVisible: false, priceLineVisible: false, base: 0, autoscaleInfoProvider: fixo01, color: css('--fear-band') });
    fchart.priceScale('bg').applyOptions({ scaleMargins: { top: 0, bottom: 0 }, visible: false });
    vs = chart.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });
    cs = chart.addCandlestickSeries({ priceLineVisible: true, upColor: css('--up'), downColor: css('--down'), wickUpColor: css('--up'), wickDownColor: css('--down'), borderVisible: false });
    var f = css('--fear'), g = css('--greed');
    fs = fchart.addBaselineSeries({ baseValue: { type: 'price', price: 50 }, lineWidth: 2, priceFormat: { type: 'custom', formatter: function (v) { return Math.round(v) + ''; } },
      autoscaleInfoProvider: function () { return { priceRange: { minValue: 0, maxValue: 100 } }; }, lastValueVisible: true, priceLineVisible: false,
      topLineColor: g, topFillColor1: rgba(g, 0.33), topFillColor2: rgba(g, 0.03), bottomLineColor: f, bottomFillColor1: rgba(f, 0.03), bottomFillColor2: rgba(f, 0.33) });
    var lock = false;
    var link = function (a, b) { a.timeScale().subscribeVisibleLogicalRangeChange(function (r) { if (lock || !r) return; lock = true; b.timeScale().setVisibleLogicalRange(r); lock = false; }); };
    link(chart, fchart); link(fchart, chart);
    var onMove = function (p, src) {
      if (!p.time) { head(LASTBAR); [chart, fchart].forEach(function (c) { if (c.clearCrosshairPosition) c.clearCrosshairPosition(); }); return; }
      var bar = BARMAP.get(p.time); if (bar) head(Object.assign({}, bar, { fg: FGMAP.get(p.time) }));
      var other = src === chart ? fchart : chart;
      if (other.setCrosshairPosition) { var v = src === chart ? FGMAP.get(p.time) : (bar && bar.close); if (v != null) other.setCrosshairPosition(v, p.time, src === chart ? fs : cs); }
    };
    chart.subscribeCrosshairMove(function (p) { if (lock) return; lock = true; onMove(p, chart); lock = false; });
    fchart.subscribeCrosshairMove(function (p) { if (lock) return; lock = true; onMove(p, fchart); lock = false; });
  }
  function head(b) {
    if (!b) { put($('chead'), ''); return; }
    var ch = b.close / b.open - 1, fg = b.fg, c = fg == null ? null : divColor((fg - 50) / 40);
    put($('chead'), '<span class="sym">' + st.tok + '/USDT · ' + TFS.filter(function (x) { return x[0] === st.tf; })[0][1] + '</span>' +
      '<span><span class="k">A</span> ' + fmtP(b.open) + '</span><span><span class="k">M</span> ' + fmtP(b.high) + '</span><span><span class="k">m</span> ' + fmtP(b.low) + '</span><span><span class="k">F</span> ' + fmtP(b.close) + '</span>' +
      '<span class="' + cls(ch) + '">' + pct(ch, 2) + '</span>' +
      (fg != null ? '<span><span class="k">Medo e Ganância</span> <span class="fg" style="background:' + c.bg + ';color:' + c.ink + '">' + Math.round(fg) + '</span> <span class="k">' + zone(fg) + '</span></span>' : ''));
  }
  var pedidoGrafico = 0;
  function candlesDe(tok, tf) {
    if (tf === '1w') return Promise.resolve(weekly(DAILY[tok]));
    if (tf === '1d') return Promise.resolve(DAILY[tok]);
    var key = tok + tf; if (LIVE[key]) return Promise.resolve(LIVE[key]);
    return D.velasLongas(tok, tf, Date.now() - DESDE[tf] * 864e5).then(function (r) { return (LIVE[key] = deRoteador(r.velas)); });
  }
  function drawChart() {
    if (!chart) return;
    if (st.tok === 'LUNA' && st.tf !== '1d' && st.tf !== '1w') { st.tf = '1d'; syncButtons(); }
    var meu = ++pedidoGrafico; $('loading').hidden = false; $('loading').textContent = 'carregando velas…';
    candlesDe(st.tok, st.tf).then(function (data) {
      if (meu !== pedidoGrafico) return;
      var up = css('--up'), dn = css('--down');
      var fgOf = function (c) {
        var day = Math.floor(c.time / DAY);
        if (st.tf === '1w') { var s = 0, n = 0; for (var d = 0; d < 7; d++) { var v = fng(day + d); if (v != null) { s += v; n++; } } return n ? s / n : null; }
        return fng(day);
      };
      var fg = data.map(fgOf);
      cs.setData(data.map(function (c) { return { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }; }));
      vs.setData(data.map(function (c) { return { time: c.time, value: c.v, color: rgba(c.close >= c.open ? up : dn, 0.35) }; }));
      var band = data.map(function (c, i) { return fg[i] != null && fg[i] <= st.thr ? { time: c.time, value: 1 } : { time: c.time }; });
      bs.setData(band); bs2.setData(band);
      BARMAP = new Map(data.map(function (c) { return [c.time, c]; })); FGMAP = new Map(data.map(function (c, i) { return [c.time, fg[i]]; }));
      fs.setData(data.map(function (c, i) { return fg[i] == null ? { time: c.time } : { time: c.time, value: fg[i] }; }));
      FGLINES.forEach(function (l) { fs.removePriceLine(l); });
      FGLINES = [fs.createPriceLine({ price: st.thr, color: css('--fear'), lineStyle: 2, lineWidth: 1, axisLabelVisible: true, title: 'limiar' }),
        fs.createPriceLine({ price: 75, color: css('--greed'), lineStyle: 3, lineWidth: 1, axisLabelVisible: false, title: '' })];
      var mk = [];
      if (st.mk) episodesOf(st.tok).forEach(function (e) {
        var t0 = e.start * DAY, c = null; for (var i = 0; i < data.length; i++) if (data[i].time >= t0) { c = data[i]; break; }
        if (c && c.time - t0 < 8 * DAY) mk.push({ time: c.time, position: 'belowBar', color: css('--fear'), shape: 'arrowUp', text: 'medo ' + e.minV });
      });
      cs.setMarkers(mk);
      applyOpts();
      LASTBAR = Object.assign({}, data[data.length - 1], { fg: fg[fg.length - 1] }); head(LASTBAR);
      var n = data.length, show = { '15m': 300, '1h': 400, '4h': 500, '1d': 900, '1w': n }[st.tf];
      chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - show), to: n + 6 });
      $('loading').hidden = true;
    }, function () {
      if (meu !== pedidoGrafico) return;
      $('loading').textContent = 'Não deu para buscar as velas deste tempo gráfico agora. O diário e o semanal continuam.';
    });
  }
  function applyOpts() {
    chart.priceScale('right').applyOptions({ mode: st.log ? 1 : 0 });
    vs.applyOptions({ visible: st.vol }); bs.applyOptions({ visible: st.band }); bs2.applyOptions({ visible: st.band });
  }

  /* ---------- números de topo do gráfico ---------- */
  function kpis() {
    var today = fng(fLast), streak = 0; for (var i = fLast; fng(i) != null && fng(i) <= 25; i--) streak++;
    var s30 = 0, n30 = 0; for (var j = fLast - 29; j <= fLast; j++) { var v = fng(j); if (v != null) { s30 += v; n30++; } }
    var b0 = Math.floor(today / 10) * 10, faixa = function (x) { return x[1] >= b0 && x[1] < b0 + 10; };
    var sm = E.resumo(rets(st.tok, 365).filter(faixa).map(function (x) { return x[2]; })), sm2 = E.resumo(rets(st.tok, 730).filter(faixa).map(function (x) { return x[2]; }));
    var lastLow = null; for (var d = fLast - streak; d >= FNG.start; d--) { var w = fng(d); if (w != null && w <= today) { lastLow = d; break; } }
    put($('kpis'),
      '<div class="kpi"><span class="eyebrow">Índice hoje</span><div class="k" style="color:var(--fear)">' + today + ' <span style="font-size:14px;font-weight:500;color:var(--ink2)">' + zone(today) + '</span></div><div class="meter"><b style="left:' + today + '%"></b></div></div>' +
      '<div class="kpi"><span class="eyebrow">Sequência no medo extremo</span><div class="k">' + streak + ' dia' + (streak === 1 ? '' : 's') + '</div><span>média de 30 dias: <b class="num">' + (s30 / n30).toFixed(0) + '</b>' + (lastLow ? ' · última vez em ' + today + ' ou menos: ' + fmtD(lastLow * DAY) : '') + '</span></div>' +
      '<div class="kpi"><span class="eyebrow">' + st.tok + ' · 1 ano depois de dias com índice ' + b0 + '–' + (b0 + 9) + '</span><div class="k ' + (sm ? cls(sm.med) : '') + '">' + (sm ? pct(sm.med) : '–') + '</div><span>' + (sm ? 'mediana · <b class="num">' + (sm.win * 100).toFixed(0) + '%</b> no lucro · ' + sm.n + ' dias' : 'sem histórico suficiente') + '</span></div>' +
      '<div class="kpi"><span class="eyebrow">' + st.tok + ' · 2 anos depois, mesma faixa</span><div class="k ' + (sm2 ? cls(sm2.med) : '') + '">' + (sm2 ? pct(sm2.med) : '–') + '</div><span>' + (sm2 ? 'mediana · <b class="num">' + (sm2.win * 100).toFixed(0) + '%</b> no lucro · pior caso ' + pct(sm2.min) : 'sem histórico suficiente') + '</span></div>');
  }
  function lessons() {
    var w = function (t, H) { return E.resumo(rets(t, H).filter(function (x) { return x[1] <= 25; }).map(function (x) { return x[2]; })); };
    var b3 = w('BTC', 90), b2 = w('BTC', 730), a2 = w('ADA', 730), P = function (r) { return r ? (r.win * 100).toFixed(0) : '–'; };
    var L = [[P(b3) + '%', 'O prazo é o filtro principal', 'Só ' + P(b3) + '% das compras de BTC no medo extremo estavam no lucro 3 meses depois. Com 2 anos, ' + P(b2) + '%. O sinal serve para quem segura.'],
      [P(a2) + '%', 'O índice mede o humor do Bitcoin', 'Em ADA, ' + P(a2) + '% das compras no medo extremo estavam no lucro após 2 anos. O índice não diz nada sobre a saúde de cada token.'],
      ['−99,99%', 'Token morto não volta', 'Quem comprou LUNA no pânico de maio de 2022 perdeu quase tudo. Fundamentos vêm antes do sentimento.'],
      ['meses', 'Medo dura meses', 'Nos invernos de 2018 e 2022, o preço continuou caindo depois do primeiro dia de medo. A aba Ondas de pânico mostra a queda extra de cada onda.']];
    put($('lessons'), L.map(function (l) { return '<div class="lesson"><span class="big">' + l[0] + '</span><h3>' + l[1] + '</h3><p>' + l[2] + '</p></div>'; }).join(''));
  }

  /* ---------- retornos ---------- */
  function hmBucket() {
    var M = st.hmM, today = fng(fLast), all = HZ.map(function (H) { return rets(st.tok, H); });
    var h = '<thead><tr><th class="rl">Índice</th>' + HZ.map(function (H) { return '<th>' + HZL[H] + '</th>'; }).join('') + '</tr></thead><tbody>';
    [[0, 10], [10, 20], [20, 30], [30, 40], [40, 50], [50, 60], [60, 70], [70, 80], [80, 90], [90, 101]].forEach(function (ab) {
      var a = ab[0], b = ab[1], z = divColor((a + 5 - 50) / 40), dentro = function (x) { return x[1] >= a && x[1] < b; };
      var n = all[1].filter(dentro).length, top = Math.min(b, 100) - (b > 100 ? 0 : 1);
      h += '<tr class="' + (today >= a && today < b ? 'cur' : '') + '"><td class="rl"><b><span class="chip" style="background:' + z.bg + '"></span>' + a + '–' + top + '</b><small>' + zone(a + 5) + ' · ' + n + ' dias</small></td>';
      HZ.forEach(function (H, j) {
        var s = E.resumo(all[j].filter(dentro).map(function (x) { return x[2]; }));
        if (!s || s.n < 10) { h += '<td class="empty"><span class="s">–</span></td>'; return; }
        var c = divColor(M === 'win' ? winT(s.win) : retT(M === 'min' ? s.min : s.med));
        var main = M === 'win' ? (s.win * 100).toFixed(0) + '%' : pct(M === 'min' ? s.min : s.med), sub = M === 'win' ? 'med. ' + pct(s.med) : M === 'min' ? 'pior caso' : (s.win * 100).toFixed(0) + '% ✓';
        h += '<td style="background:' + c.bg + ';color:' + c.ink + '" data-tip="Índice <b>' + a + '–' + Math.min(b, 100) + '</b> · hold de <b>' + HZL[H] + '</b><br>Mediana <b>' + pct(s.med) + '</b> · no lucro <b>' + (s.win * 100).toFixed(0) + '%</b><br>25%–75%: <b>' + pct(s.p25) + '</b> a <b>' + pct(s.p75) + '</b><br>Pior <b>' + pct(s.min) + '</b> · ' + s.n + ' compras"><span class="m">' + main + '</span><span class="s">' + sub + '</span></td>';
      });
      h += '</tr>';
    });
    put($('hm-bucket'), h + '</tbody>');
    $('sc-ret-a').textContent = M === 'win' ? '15% no lucro' : 'perda'; $('sc-ret-b').textContent = M === 'win' ? '85% no lucro' : 'ganho (satura em −67% e +200%)';
  }
  function dist() {
    var rows = HZ.map(function (H) { var r = rets(st.tok, H); return [H, E.resumo(r.filter(function (x) { return x[1] <= st.thr; }).map(function (x) { return x[2]; })), E.resumo(r.map(function (x) { return x[2]; }))]; });
    var vals = []; rows.forEach(function (r) { [r[1], r[2]].forEach(function (s) { if (s) vals.push(s.p10, s.p90); }); });
    if (!vals.length) { put($('dist'), '<p>Sem dados suficientes.</p>'); return; }
    var L = function (x) { return Math.log(1 + Math.max(x, -0.99)); };
    var lo = Math.min.apply(null, vals.map(L).concat(L(-0.2))), hi = Math.max.apply(null, vals.map(L).concat(L(0.2)));
    var W = 1200, ML = 70, MR = 20, RH = 26, G = 14, top = 24, H = top + rows.length * (RH * 2 + G) + 20, X = function (x) { return ML + (L(x) - lo) / (hi - lo) * (W - ML - MR); };
    var mu = css('--muted'), ink = css('--ink'), ink2 = css('--ink2'), fear = css('--fear'), base = css('--base');
    var s = [-0.9, -0.75, -0.5, -0.25, 0, 0.5, 1, 2, 4, 9, 19, 49].filter(function (x) { return L(x) >= lo && L(x) <= hi; }).map(function (x) {
      return '<line x1="' + X(x) + '" x2="' + X(x) + '" y1="' + (top - 6) + '" y2="' + (H - 18) + '" stroke="' + (x === 0 ? ink2 : css('--grid')) + '" ' + (x === 0 ? 'stroke-dasharray="4 3"' : '') + '/><text x="' + X(x) + '" y="' + (top - 10) + '" text-anchor="middle" font-size="11" fill="' + mu + '" font-family="JetBrains Mono">' + (x === 0 ? '0%' : pct(x)) + '</text>';
    }).join('');
    rows.forEach(function (row, i) {
      var y = top + i * (RH * 2 + G);
      s += '<text x="0" y="' + (y + RH + 4) + '" font-size="13" font-weight="600" fill="' + ink + '" font-family="JetBrains Mono">' + HZL[row[0]] + '</text>';
      [[row[1], fear, 'medo'], [row[2], base, 'qualquer']].forEach(function (it, k) {
        var m = it[0]; if (!m) return; var yy = y + k * RH + RH / 2;
        s += '<g data-tip="<b>' + HZL[row[0]] + '</b> · ' + (it[2] === 'medo' ? 'compras no medo ≤ ' + st.thr : 'qualquer dia') + '<br>10%: <b>' + pct(m.p10) + '</b> · 25%: <b>' + pct(m.p25) + '</b><br>Mediana: <b>' + pct(m.med) + '</b><br>75%: <b>' + pct(m.p75) + '</b> · 90%: <b>' + pct(m.p90) + '</b><br>No lucro: <b>' + (m.win * 100).toFixed(0) + '%</b> · ' + m.n + ' compras">' +
          '<rect x="' + ML + '" y="' + (yy - RH / 2) + '" width="' + (W - ML - MR) + '" height="' + RH + '" fill="transparent"/>' +
          '<line x1="' + X(m.p10) + '" x2="' + X(m.p90) + '" y1="' + yy + '" y2="' + yy + '" stroke="' + it[1] + '" stroke-width="2" opacity=".7"/>' +
          '<rect x="' + X(m.p25) + '" y="' + (yy - 7) + '" width="' + Math.max(2, X(m.p75) - X(m.p25)) + '" height="14" rx="4" fill="' + it[1] + '" opacity="' + (k ? 0.55 : 0.85) + '"/>' +
          '<line x1="' + X(m.med) + '" x2="' + X(m.med) + '" y1="' + (yy - 10) + '" y2="' + (yy + 10) + '" stroke="' + ink + '" stroke-width="2.5"/>' +
          '<text x="' + Math.min(X(m.p90) + 8, W - 60) + '" y="' + (yy + 4) + '" font-size="11.5" fill="' + ink2 + '" font-family="JetBrains Mono">' + pct(m.med) + ' · ' + (m.win * 100).toFixed(0) + '%</text></g>';
      });
    });
    s += '<g font-family="Inter" font-size="12" fill="' + ink2 + '"><rect x="' + ML + '" y="' + (H - 12) + '" width="14" height="8" rx="2" fill="' + fear + '"/><text x="' + (ML + 20) + '" y="' + (H - 4) + '">Compras no medo ≤ ' + st.thr + '</text><rect x="' + (ML + 220) + '" y="' + (H - 12) + '" width="14" height="8" rx="2" fill="' + base + '"/><text x="' + (ML + 240) + '" y="' + (H - 4) + '">Dia qualquer</text><text x="' + (W - MR) + '" y="' + (H - 4) + '" text-anchor="end" fill="' + mu + '">mediana · % no lucro</text></g>';
    put($('dist'), '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Distribuição de retornos por prazo">' + s + '</svg>');
  }

  /* ---------- tokens ---------- */
  function hmTokens() {
    var M = st.tkM, h = '<thead><tr><th class="rl">Token</th>' + HZ.map(function (H) { return '<th>' + HZL[H] + '</th>'; }).join('') + '</tr></thead><tbody>';
    Object.keys(TOK).forEach(function (t) {
      h += '<tr><td class="rl"><b>' + t + '</b><small>' + TOK[t] + '</small></td>';
      HZ.forEach(function (H) {
        var r = rets(t, H), f = E.resumo(r.filter(function (x) { return x[1] <= st.thr; }).map(function (x) { return x[2]; })), a = E.resumo(r.map(function (x) { return x[2]; }));
        if (!f || f.n < 10) { h += '<td class="empty"><span class="s">–</span></td>'; return; }
        var d = (f.win - a.win) * 100, c = divColor(M === 'win' ? winT(f.win) : M === 'med' ? retT(f.med) : d / 25);
        var main = M === 'win' ? (f.win * 100).toFixed(0) + '%' : M === 'med' ? pct(f.med) : (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(0) + ' pts';
        var sub = M === 'win' ? (d >= 0 ? '▲' : '▼') + ' ' + Math.abs(d).toFixed(0) + ' pts' : M === 'med' ? (f.win * 100).toFixed(0) + '% ✓' : (f.win * 100).toFixed(0) + '% × ' + (a.win * 100).toFixed(0) + '%';
        h += '<td style="background:' + c.bg + ';color:' + c.ink + '" data-tip="<b>' + t + '</b> · medo ≤ ' + st.thr + ' · hold <b>' + HZL[H] + '</b><br>No lucro: <b>' + (f.win * 100).toFixed(0) + '%</b> (dia qualquer ' + (a.win * 100).toFixed(0) + '%)<br>Mediana <b>' + pct(f.med) + '</b> (dia qualquer ' + pct(a.med) + ')<br>Pior <b>' + pct(f.min) + '</b> · ' + f.n + ' compras"><span class="m">' + main + '</span><span class="s">' + sub + '</span></td>';
      });
      h += '</tr>';
    });
    put($('hm-tokens'), h + '</tbody>');
    $('sc-win-a').textContent = M === 'win' ? '15% no lucro' : M === 'med' ? 'perda' : 'medo pior (−25 pts)';
    $('sc-win-b').textContent = M === 'win' ? '85% no lucro' : M === 'med' ? 'ganho' : 'medo melhor (+25 pts)';
  }
  function tkRank() {
    var rows = Object.keys(TOK).map(function (t) { var r = rets(t, 730); return { t: t, f: E.resumo(r.filter(function (x) { return x[1] <= st.thr; }).map(function (x) { return x[2]; })), a: E.resumo(r.map(function (x) { return x[2]; })) }; })
      .filter(function (x) { return x.f && x.f.n >= 10; }).sort(function (x, y) { return y.f.win - x.f.win; });
    put($('tk-rank'), rows.map(function (x) {
      var d = (x.f.win - x.a.win) * 100;
      return '<div class="rk"><span class="rk-t"><b>' + x.t + '</b><small>' + TOK[x.t] + '</small></span><span class="rk-b">' +
        '<span class="rk-bar"><i style="width:' + x.f.win * 100 + '%;background:var(--fear)"></i><em>' + (x.f.win * 100).toFixed(0) + '% no medo</em></span>' +
        '<span class="rk-bar"><i style="width:' + x.a.win * 100 + '%;background:var(--base)"></i><em>' + (x.a.win * 100).toFixed(0) + '% dia qualquer</em></span></span>' +
        '<span class="rk-v ' + (d >= 0 ? 'pos' : 'neg') + '">' + (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(0) + ' pts<small>mediana ' + pct(x.f.med) + '</small></span></div>';
    }).join('') || '<p>Sem histórico de 2 anos neste limiar.</p>');
  }

  /* ---------- ondas de pânico ---------- */
  function pill(x) { if (x == null) return '<span class="pill na">aguardando</span>'; var c = divColor(retT(x)); return '<span class="pill" style="background:' + c.bg + ';color:' + c.ink + '">' + pct(x) + '</span>'; }
  function eps() {
    var S = series(st.tok), list = episodesOf(st.tok).map(function (e) { return Object.assign({}, e, E.depoisDaOnda(S.price, e, S.okEnd)); });
    var done = list.filter(function (e) { return e.r365 != null; }), med = E.mediana;
    var K = function (l, v, s) { return '<div class="kpi"><span class="eyebrow">' + l + '</span><div class="k">' + v + '</div><span>' + s + '</span></div>'; };
    put($('ep-kpis'), list.length ?
      K('Ondas de medo', list.length, 'desde ' + fmtD(list[0].start * DAY)) +
      K('Duração mediana', med(list.map(function (e) { return e.days; })) + ' dias', 'a mais longa: ' + Math.max.apply(null, list.map(function (e) { return e.days; })) + ' dias de medo') +
      K('Queda extra mediana', '<span class="neg">' + pct(med(list.map(function (e) { return e.dd; }))) + '</span>', 'a pior: ' + pct(Math.min.apply(null, list.map(function (e) { return e.dd; }))) + ' depois do 1º dia') +
      K('Dias até o fundo', med(list.map(function (e) { return e.toBottom; })) + ' dias', 'mediana, contados do 1º dia de medo') +
      K('No lucro após 1 ano', done.length ? done.filter(function (e) { return e.r365 > 0; }).length + ' de ' + done.length : '–', done.length ? 'retorno mediano de 1 ano: ' + pct(med(done.map(function (e) { return e.r365; }))) : 'nenhuma onda completou 1 ano')
      : K('Ondas de medo', '0', 'nenhuma onda de 3 dias ou mais neste limiar'));
    if (st.epSort === 'rec') list.reverse(); else if (st.epSort === 'len') list.sort(function (a, b) { return b.days - a.days; }); else list.sort(function (a, b) { return a.dd - b.dd; });
    var maxD = Math.max.apply(null, [1].concat(list.map(function (e) { return e.days; })));
    var h = '<div class="ep h"><span>Início</span><span>Duração</span><span>Preço: −60d → +1 ano</span><span>Queda extra</span><span>Até o fundo</span><span>3 meses</span><span>1 ano</span><span>2 anos</span></div>';
    list.forEach(function (e) {
      var a = Math.max(S.start, e.start - 60), b = Math.min(e.start + 365, S.okEnd), pts = [];
      for (var i = a; i <= b; i++) { var p = S.price(i); if (p) pts.push([i, Math.log(p)]); }
      var lo = Math.min.apply(null, pts.map(function (q) { return q[1]; })), hi = Math.max.apply(null, pts.map(function (q) { return q[1]; }));
      var W = 300, Hh = 40, X = function (i) { return (i - (e.start - 60)) / 425 * W; }, Y = function (v) { return Hh - 2 - (v - lo) / ((hi - lo) || 1) * (Hh - 4); };
      var d = pts.map(function (q, k) { return (k ? 'L' : 'M') + X(q[0]).toFixed(1) + ',' + Y(q[1]).toFixed(1); }).join('');
      var sp = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" preserveAspectRatio="none" style="height:40px;width:100%;display:block"><rect x="' + X(e.start) + '" y="0" width="' + Math.max(2, X(e.end) - X(e.start)) + '" height="' + Hh + '" fill="' + css('--fear-band') + '"/><line x1="' + X(e.start) + '" x2="' + X(e.start) + '" y1="0" y2="' + Hh + '" stroke="' + css('--fear') + '" stroke-width="1"/><path d="' + d + '" fill="none" stroke="' + css('--ink2') + '" stroke-width="1.4" vector-effect="non-scaling-stroke"/>' + (e.mi > e.start ? '<circle cx="' + X(e.mi) + '" cy="' + Y(Math.log(e.mn)) + '" r="3" fill="' + css('--down') + '"/>' : '') + '</svg>';
      h += '<div class="ep"><span class="d">' + fmtD(e.start * DAY) + '<small>' + fmtP(e.p0) + ' · índice mín. ' + e.minV + '</small></span>' +
        '<span class="dur"><i style="width:' + Math.max(4, e.days / maxD * 60) + 'px"></i>' + e.days + 'd</span>' +
        '<span data-tip="Fundo em ' + fmtD(e.mi * DAY) + ': <b>' + fmtP(e.mn) + '</b> (' + pct(e.dd) + ')<br>' + e.toBottom + ' dias depois do 1º dia de medo">' + sp + '</span>' +
        '<span class="dd">' + (e.dd < -0.005 ? '<i style="width:' + Math.min(50, -e.dd * 70) + 'px"></i><span class="neg">' + pct(e.dd) + '</span>' : '<span style="color:var(--muted)">era o fundo</span>') + '</span>' +
        '<span class="num" style="font-size:12px;color:var(--ink2)">' + (e.toBottom ? e.toBottom + 'd' : '–') + '</span>' + pill(e.r90) + pill(e.r365) + pill(e.r730) + '</div>';
    });
    if (!list.length) h += '<p style="padding:10px 0">Nenhum episódio de 3 dias ou mais neste limiar.</p>';
    put($('eps'), h);
  }

  /* ---------- medo → lucro ---------- */
  var MS = [1.5, 2, 3, 5, 10], MSL = { 1.5: '+50%', 2: '2×', 3: '3×', 5: '5×', 10: '10×' };
  var fx = function (m) { return m >= 10 ? m.toFixed(0) + '×' : m.toFixed(1).replace('.', ',') + '×'; };
  function runOf(t, e, mode) { var S = series(t), en = E.entrada(S.price, e, mode), m = E.marcos(S.price, en.d0, en.P, S.end, MS); return Object.assign({ e: e, P: en.P, dead: S.dead }, m); }
  function runsOf(t) { return episodesOf(t).filter(function (e) { return e.days >= st.luMin; }).map(function (e) { return runOf(t, e, st.luEntry); }); }
  function lucro() {
    var R = runsOf(st.tok), EL = { first: 'no 1º dia de medo', avg: 'pelo preço médio da onda', last: 'no último dia de medo' }[st.luEntry], med = E.mediana;
    var porDias = R.slice().sort(function (a, b) { return b.e.days - a.e.days; })[0], porPico = R.slice().sort(function (a, b) { return b.mx - a.mx; })[0];
    var dobrou = R.slice().reverse().filter(function (r) { return r.hit[2] != null; })[0];
    var cand = [['Onda mais longa', porDias], ['Maior lucro', porPico], ['Dobrou mais recente', dobrou], ['Onda mais recente', R[R.length - 1]]], pick = [];
    cand.forEach(function (c) { if (c[1] && !pick.some(function (x) { return x[1] === c[1]; })) pick.push(c); });
    put($('lu-phr'), pick.slice(0, 3).map(function (c) {
      var r = c[1], steps = MS.filter(function (k) { return r.hit[k] != null; }).map(function (k) { return '<b>' + MSL[k] + '</b> em <b>' + r.hit[k] + '</b> dias'; });
      return '<div class="phr"><span class="eyebrow">' + c[0] + '</span><p><b>' + st.tok + '</b> ficou <b>' + r.e.days + ' dias</b> no medo a partir de <b>' + fmtD(r.e.start * DAY) + '</b>. Comprando ' + EL + ', a <b>$' + fmtP(r.P) + '</b>: ' +
        (steps.length ? steps.join(', ') + '.' : 'ainda não chegou a +50%.') + ' ' + (r.mx > 1.01 ? 'Pico de <b>' + fx(r.mx) + '</b> após ' + r.mxd + ' dias.' : '') + ' ' + (r.mn < 0.97 ? 'No caminho chegou a <span class="neg">' + pct(r.mn - 1) + '</span>.' : '') + '</p></div>';
    }).join('') || '<p>Nenhuma onda com essa duração neste limiar. Reduza a duração mínima ou aumente o limiar.</p>');
    var K = function (l, v, s) { return '<div class="kpi"><span class="eyebrow">' + l + '</span><div class="k">' + v + '</div><span>' + s + '</span></div>'; };
    var h2 = R.filter(function (r) { return r.hit[2] != null; }), h3 = R.filter(function (r) { return r.hit[3] != null; }), open = R.filter(function (r) { return r.hit[2] == null && r.span < 730; }).length;
    put($('lu-kpis'), R.length ?
      K('Ondas analisadas', R.length, 'com ' + st.luMin + ' dias de medo ou mais') +
      K('Chegaram a 2×', h2.length + ' de ' + R.length, open ? open + ' ainda com menos de 2 anos' : 'todas com 2 anos ou mais de histórico') +
      K('Tempo até 2×', h2.length ? med(h2.map(function (r) { return r.hit[2]; })) + ' dias' : '–', h2.length ? 'mais rápida: ' + Math.min.apply(null, h2.map(function (r) { return r.hit[2]; })) + ' dias · mais lenta: ' + Math.max.apply(null, h2.map(function (r) { return r.hit[2]; })) : 'nenhuma dobrou') +
      K('Pico mediano', fx(med(R.map(function (r) { return r.mx; }))), 'maior pico: ' + fx(Math.max.apply(null, R.map(function (r) { return r.mx; }))) + ' · ' + h3.length + ' de ' + R.length + ' fizeram 3×') +
      K('Pior momento mediano', '<span class="neg">' + pct(med(R.map(function (r) { return r.mn; })) - 1) + '</span>', 'prejuízo temporário antes do pico')
      : K('Ondas analisadas', '0', 'nada neste filtro'));
    var maxSpan = Math.min(1460, Math.max.apply(null, [365].concat(R.map(function (r) { return r.span; })))), W = 560, H = 50, X = function (d) { return 10 + Math.min(d, maxSpan) / maxSpan * (W - 20); };
    var up = css('--up'), dn = css('--down'), mu = css('--muted'), ink = css('--ink'), ln = css('--line'), pn = css('--panel');
    var ticks = [[0, 'compra'], [180, '6m'], [365, '1a'], [730, '2a'], [1095, '3a'], [1460, '4a']].filter(function (t) { return t[0] <= maxSpan; });
    var h = '<div class="lu h"><span>Onda</span><span>Entrada</span><span><svg viewBox="0 0 ' + W + ' 16" style="display:block;width:100%;height:16px">' + ticks.map(function (t) { return '<text x="' + X(t[0]) + '" y="12" text-anchor="' + (t[0] ? 'middle' : 'start') + '" font-size="10.5" fill="' + mu + '" font-family="JetBrains Mono">' + t[1] + '</text>'; }).join('') + '</svg></span><span>Pico</span><span>Hoje</span></div>';
    R.slice().reverse().forEach(function (r) {
      var s = ticks.map(function (t) { return '<line x1="' + X(t[0]) + '" x2="' + X(t[0]) + '" y1="6" y2="' + (H - 6) + '" stroke="' + ln + '"/>'; }).join('');
      s += '<line x1="' + X(0) + '" x2="' + X(r.span) + '" y1="' + H / 2 + '" y2="' + H / 2 + '" stroke="' + mu + '" stroke-width="2" stroke-linecap="round"/>';
      if (r.mn < 0.97) s += '<path d="M' + (X(r.mnd) - 5) + ',' + (H / 2 + 4) + ' l5,8 l5,-8z" fill="' + dn + '"/><text x="' + X(r.mnd) + '" y="' + (H - 1) + '" text-anchor="middle" font-size="10" fill="' + dn + '" font-family="JetBrains Mono">' + pct(r.mn - 1) + '</text>';
      var lastX = -99, flip = false;
      MS.forEach(function (k, i) {
        var d = r.hit[k]; if (d == null) return; var x = X(d); flip = x - lastX < 26 ? !flip : false; lastX = x;
        s += '<circle cx="' + x + '" cy="' + H / 2 + '" r="' + (4 + i * 0.6) + '" fill="' + up + '" stroke="' + pn + '" stroke-width="1.5"/><text x="' + x + '" y="' + (flip ? H / 2 + 4 : H / 2 - 9) + '" dx="' + (flip ? 8 : 0) + '" text-anchor="' + (flip ? 'start' : 'middle') + '" font-size="10.5" font-weight="600" fill="' + ink + '" font-family="JetBrains Mono">' + MSL[k] + '</text>';
      });
      var tipTxt = MS.map(function (k) { return MSL[k] + ': <b>' + (r.hit[k] != null ? r.hit[k] + ' dias' : 'não chegou') + '</b>'; }).join('<br>');
      h += '<div class="lu"><span class="d">' + fmtD(r.e.start * DAY) + '<small>' + r.e.days + ' dias de medo · mín. ' + r.e.minV + '</small></span><span class="num">$' + fmtP(r.P) + '</span>' +
        '<span data-tip="Compra ' + EL + '<br>' + tipTxt + '<br>Pior momento: <b>' + pct(r.mn - 1) + '</b> no dia ' + r.mnd + '"><svg viewBox="0 0 ' + W + ' ' + H + '" style="display:block;width:100%;height:' + H + 'px">' + s + '</svg></span>' +
        '<span class="num"><b class="' + (r.mx > 1.01 ? 'pos' : '') + '">' + (r.mx > 1.01 ? fx(r.mx) : '–') + '</b><small>' + (r.mx > 1.01 ? 'em ' + r.mxd + ' dias' : 'sem alta ainda') + '</small></span>' +
        '<span class="num ' + cls(r.cur - 1) + '"><b>' + (r.dead ? '≈ 0' : fx(r.cur)) + '</b><small>' + (r.dead ? 'colapsou' : pct(r.cur - 1)) + '</small></span></div>';
    });
    put($('lu-rows'), R.length ? h : '<p>Nenhuma onda neste filtro.</p>');
    var cell = function (n, d) { if (!d) return '<td class="empty"><span class="s">–</span></td>'; var c = divColor(winT(n / d)); return '<td style="background:' + c.bg + ';color:' + c.ink + '"><span class="m">' + (n / d * 100).toFixed(0) + '%</span><span class="s">' + n + ' de ' + d + '</span></td>'; };
    var plain = function (v, s2) { return '<td class="plain"><span class="m">' + v + '</span><span class="s">' + s2 + '</span></td>'; };
    var vazio = '<td class="empty"><span class="s">–</span></td>';
    var all = episodesOf(st.tok).map(function (e) { return runOf(st.tok, e, st.luEntry); });
    var hd = '<thead><tr><th class="rl">Dias de medo</th><th>+50%</th><th>2×</th><th>3×</th><th>Até 2×</th><th>Pico</th></tr></thead><tbody>';
    [[3, 9], [10, 29], [30, 89], [90, 99999]].forEach(function (ab) {
      var g = all.filter(function (r) { return r.e.days >= ab[0] && r.e.days <= ab[1]; }), g2 = g.filter(function (r) { return r.hit[2] != null; });
      hd += '<tr><td class="rl"><b>' + (ab[1] > 9999 ? ab[0] + '+' : ab[0] + '–' + ab[1]) + ' dias</b><small>' + g.length + ' onda' + (g.length === 1 ? '' : 's') + '</small></td>' +
        cell(g.filter(function (r) { return r.hit[1.5] != null; }).length, g.length) + cell(g2.length, g.length) + cell(g.filter(function (r) { return r.hit[3] != null; }).length, g.length) +
        (g2.length ? plain(med(g2.map(function (r) { return r.hit[2]; })) + 'd', 'mediana') : vazio) + (g.length ? plain(fx(med(g.map(function (r) { return r.mx; }))), 'mediano') : vazio) + '</tr>';
    });
    put($('lu-dur'), hd + '</tbody>');
    var ht = '<thead><tr><th class="rl">Token</th><th>2×</th><th>3×</th><th>Até 2×</th><th>Pico</th><th>Pior momento</th></tr></thead><tbody>';
    Object.keys(TOK).forEach(function (t) {
      var g = runsOf(t), g2 = g.filter(function (r) { return r.hit[2] != null; });
      ht += '<tr><td class="rl"><b>' + t + '</b><small>' + g.length + ' onda' + (g.length === 1 ? '' : 's') + '</small></td>' + cell(g2.length, g.length) + cell(g.filter(function (r) { return r.hit[3] != null; }).length, g.length) +
        (g2.length ? plain(med(g2.map(function (r) { return r.hit[2]; })) + 'd', 'mediana') : vazio) +
        (g.length ? plain(fx(med(g.map(function (r) { return r.mx; }))), 'mediano') + plain('<span class="neg">' + pct(med(g.map(function (r) { return r.mn; })) - 1) + '</span>', 'mediano') : vazio + vazio) + '</tr>';
    });
    put($('lu-tok'), ht + '</tbody>');
  }

  /* ---------- aportes ---------- */
  var DK = { fixo: ['Fixo', '--s1'], res: ['Reserva para o medo', '--s2'], cal: ['Calibrado', '--s3'], real: ['Calibrado + realização', '--s4'] };
  function dca() {
    var S = series(st.tok), y0 = Date.UTC(st.dcaFrom, 0, 1) / 864e5, a = Math.max(S.start, FNG.start, y0), b = Math.min(S.okEnd, fLast);
    var A = Math.max(1, +st.dcaAmt || 100), step = st.dcaFreq;
    var R = E.simularAportes({ preco: S.price, indice: fng, a: a, b: b, passo: step, aporte: A, mult: st.dcaMult, limiar: st.thr, fimCompra: S.end }), s = R.estrategias;
    var best = null; Object.keys(s).forEach(function (k) { if (!best || s[k].mult > s[best].mult) best = k; });
    put($('dca-kpis'), Object.keys(s).map(function (k) { var o = s[k]; return '<div class="dk ' + (k === best ? 'best' : '') + '"><span class="t"><i style="background:var(' + DK[k][1] + ')"></i>' + DK[k][0] + (k === best ? ' · melhor' : '') + '</span><span class="k ' + cls(o.mult - 1) + '">' + o.mult.toFixed(2) + '×</span><small>pôs ' + usd(o.inv) + ' · vale ' + usd(o.val) + '</small></div>'; }).join(''));
    var pctView = st.dcaView === 'pct';
    if (!dcaChart) {
      dcaChart = LWC.createChart($('dca-chart'), { autoSize: true, rightPriceScale: { scaleMargins: { top: 0.08, bottom: 0.06 } }, timeScale: { rightOffset: 2 } });
      dcaChart.applyOptions(chartTheme());
      dcaS = [dcaChart.addLineSeries({ lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })].concat(Object.keys(DK).map(function () { return dcaChart.addLineSeries({ lineWidth: 2, priceLineVisible: false }); }));
    }
    dcaChart.applyOptions({ localization: { locale: 'pt-BR', priceFormatter: pctView ? function (p) { return (p >= 0 ? '+' : '') + Math.round(p) + '%'; } : function (p) { return '$' + Math.round(p).toLocaleString('en-US'); } } });
    var pts = function (arr, k) { return arr.map(function (x) { return { time: x[0] * DAY, value: x[1] * (k || 1) }; }); };
    dcaS[0].applyOptions({ color: css('--muted'), visible: !pctView }); dcaS[0].setData(pts(R.investido));
    Object.keys(DK).forEach(function (k, i) { dcaS[i + 1].applyOptions({ color: css(DK[k][1]) }); dcaS[i + 1].setData(pctView ? pts(s[k].res, 100) : pts(s[k].line)); });
    if (ZERO) { dcaS[1].removePriceLine(ZERO); ZERO = null; }
    if (pctView) ZERO = dcaS[1].createPriceLine({ price: 0, color: css('--ink2'), lineStyle: 2, lineWidth: 1, axisLabelVisible: false, title: '' });
    dcaChart.priceScale('right').applyOptions({ mode: pctView ? 0 : 1 }); dcaChart.timeScale().fitContent();
    $('dca-title').textContent = pctView ? 'Lucro ou prejuízo sobre o total investido' : 'Valor da carteira ao longo do tempo';
    $('dca-note').textContent = 'De ' + fmtD(a * DAY) + ' a ' + fmtD(b * DAY) + ', aporte base de US$ ' + A + ' ' + { 7: 'a cada 7 dias', 14: 'a cada 14 dias', 30: 'a cada 30 dias' }[step] + ', no preço de fechamento, sem taxas. ' +
      (pctView ? 'Abaixo da linha tracejada a carteira valia menos do que o total investido.' : 'Linha tracejada: total investido no plano fixo. Eixo em escala log.') + (S.dead ? ' Depois do colapso da LUNA os aportes ficam em caixa.' : '');
    var maxM = Math.max.apply(null, [1].concat(Object.keys(s).map(function (k) { return s[k].mult; })));
    var h = '<thead><tr><th>Estratégia</th><th>Investido</th><th>Vale hoje</th><th>Múltiplo</th><th>Preço médio</th><th>Pior momento</th><th>Tempo no prejuízo</th><th>Caixa / vendido</th></tr></thead><tbody>';
    Object.keys(s).forEach(function (k) {
      var o = s[k], under = o.n ? o.under / o.n : 0;
      h += '<tr><td><i class="sw" style="background:var(' + DK[k][1] + ')"></i>' + DK[k][0] + '</td><td>' + usd(o.inv) + '</td><td>' + usd(o.val) + '</td>' +
        '<td><span class="bar"><span class="' + cls(o.mult - 1) + '">' + o.mult.toFixed(2) + '×</span><span class="track"><span class="fill" style="width:' + o.mult / maxM * 100 + '%;background:var(' + DK[k][1] + ')"></span></span></span></td>' +
        '<td>' + (o.avg ? '$' + fmtP(o.avg) : '–') + '</td><td class="neg"' + (o.minT ? ' data-tip="Pior momento em ' + fmtD(o.minT * DAY) + '"' : '') + '>' + (o.minR < 0 ? pct(o.minR) : 'nunca negativo') + '</td>' +
        '<td><span class="bar"><span>' + (under * 100).toFixed(0) + '%</span><span class="track"><span class="fill" style="width:' + under * 100 + '%;background:var(--down)"></span></span></span></td>' +
        '<td>' + (o.cash > 1 ? usd(o.cash) : '–') + (o.sold > 1 ? ' <small>(vendeu ' + usd(o.sold) + ')</small>' : '') + '</td></tr>';
    });
    put($('dca-tbl'), h + '</tbody>');
    var anos = Object.keys(s.fixo.yr).sort(), hy = '<thead><tr><th class="rl">Ano</th><th>Fixo</th><th>Reserva</th><th>Calibrado</th></tr></thead><tbody>';
    anos.forEach(function (y) {
      var f = s.fixo.yr[y]; if (!f || !f[1]) return; var m = f[0] / f[1];
      hy += '<tr><td class="rl"><b>' + y + '</b><small>' + usd(f[0]) + ' no fixo</small></td><td class="plain"><span class="m">$' + fmtP(m) + '</span><span class="s">referência</span></td>';
      ['res', 'cal'].forEach(function (k) {
        var r = s[k].yr[y]; if (!r || !r[1]) { hy += '<td class="empty"><span class="s">sem compra</span></td>'; return; }
        var pp = r[0] / r[1], d = pp / m - 1, c = divColor(-d / 0.25);
        hy += '<td style="background:' + c.bg + ';color:' + c.ink + '" data-tip="<b>' + DK[k][0] + '</b> em ' + y + '<br>Aportou <b>' + usd(r[0]) + '</b><br>Preço médio pago <b>$' + fmtP(pp) + '</b><br>Aporte fixo pagou <b>$' + fmtP(m) + '</b>"><span class="m">' + pct(d) + '</span><span class="s">$' + fmtP(pp) + '</span></td>';
      });
      hy += '</tr>';
    });
    put($('dca-year'), hy + '</tbody>');
  }

  /* ---------- barra de tokens ---------- */
  function tokens() {
    put($('tokens'), Object.keys(TOK).map(function (t) {
      var d = DAILY[t], ok = d && d.length > 1;
      var c = ok ? d[d.length - 1] : null, p = ok ? d[d.length - 2] : null, ch = ok ? c.close / p.close - 1 : 0;
      return '<button class="tok" type="button" data-t="' + t + '" aria-pressed="' + (t === st.tok) + '"' + (ok ? '' : ' disabled') + '><b>' + t + '</b><span class="px">' + (t === 'LUNA' ? 'colapsou' : ok ? fmtP(c.close) : 'sem dados') + '</span><span class="nm">' + TOK[t] + '</span><span class="ch ' + (t === 'LUNA' || !ok ? '' : cls(ch)) + '">' + (t === 'LUNA' ? 'mai/22' : ok ? pct(ch, 2) : '') + '</span></button>';
    }).join(''));
  }
  function syncButtons() {
    document.querySelectorAll('.tok').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.t === st.tok); });
    document.querySelectorAll('#tf button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.tf === st.tf); b.disabled = st.tok === 'LUNA' && b.dataset.tf !== '1d' && b.dataset.tf !== '1w'; });
    $('thr').value = st.thr; $('thr-out').textContent = st.thr;
    document.querySelectorAll('.thr-echo').forEach(function (e) { e.textContent = st.thr; }); document.querySelectorAll('.tok-echo').forEach(function (e) { e.textContent = st.tok; });
    ['log', 'vol', 'band', 'mk'].forEach(function (k) { $('o-' + k).checked = st[k]; });
  }
  function scales() { var n = []; for (var i = 0; i <= 10; i++) n.push(divColor(i / 5 - 1).bg); var g = 'linear-gradient(90deg,' + n.join(',') + ')'; $('sc-ret').style.background = g; $('sc-win').style.background = g; }

  /* ---------- aba Agora (arquivo compartilhado com o Laboratório) ---------- */
  var CTX = { E: E, series: series, fng: function (d) { return fng(d); }, get fLast() { return fLast; }, st: st, save: save, put: put,
    fmtD: fmtD, fmtP: fmtP, pct: pct, cls: cls, zone: zone, divColor: divColor, retT: retT, css: css, get TOK() { return TOK; } };

  /* ---------- abas ---------- */
  var TABS = [['agora', 'Agora'], ['grafico', 'Gráfico'], ['estudo', 'Estudo'], ['ondas', 'Ondas de pânico'], ['aportes', 'Aportes']];
  var ALIAS = { retornos: 'estudo', tokens: 'estudo', lucro: 'ondas', guia: 'agora' };
  var RENDER = { agora: function () { if (window.AbaAgora) window.AbaAgora.render(CTX, $('ag')); }, grafico: function () { kpis(); drawChart(); }, estudo: function () { hmBucket(); dist(); hmTokens(); tkRank(); }, ondas: function () { eps(); lucro(); }, aportes: dca };
  var dirty = new Set(TABS.map(function (t) { return t[0]; })), READY = false;
  function show(tab, push) {
    tab = ALIAS[tab] || tab; if (!RENDER[tab]) tab = 'agora'; st.tab = tab;
    TABS.forEach(function (t) { $('t-' + t[0]).hidden = t[0] !== tab; });
    document.querySelectorAll('#tabs button').forEach(function (b) { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (READY && dirty.has(tab)) { dirty.delete(tab); RENDER[tab](); }
    if (push && location.hash !== '#' + tab) { try { history.replaceState(null, '', '#' + tab); } catch (e) { location.hash = tab; } }
    save();
  }
  function invalidate() { memoKey(); dirty = new Set(TABS.map(function (t) { return t[0]; })); show(st.tab); }
  put($('tabs'), TABS.map(function (t) { return '<button type="button" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join(''));
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) show(b.dataset.tab, true); });
  addEventListener('hashchange', function () { var h = location.hash.slice(1); h = ALIAS[h] || h; if (RENDER[h] && h !== st.tab) show(h); });
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-go]'); if (b) { show(b.dataset.go, true); window.scrollTo({ top: 0 }); } });

  function seg(id, opts, key, tab) {
    var el = $(id);
    put(el, opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join(''));
    var sync = function () { el.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(st[key]) === b.dataset.v); }); }; sync();
    el.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; var o = opts.filter(function (x) { return String(x[0]) === b.dataset.v; })[0]; st[key] = o[0]; sync(); save(); dirty.add(tab); show(st.tab); });
  }
  seg('hm-m', [['med', 'Retorno mediano'], ['win', 'Chance de lucro'], ['min', 'Pior caso']], 'hmM', 'estudo');
  seg('tk-m', [['win', 'Chance de lucro'], ['med', 'Retorno mediano'], ['edge', 'Vantagem sobre dia qualquer']], 'tkM', 'estudo');
  seg('ep-sort', [['rec', 'Mais recentes'], ['len', 'Mais longas'], ['dd', 'Maior queda']], 'epSort', 'ondas');
  seg('lu-entry', [['first', '1º dia de medo'], ['avg', 'Preço médio da onda'], ['last', 'Último dia de medo']], 'luEntry', 'ondas');
  seg('lu-min', [[3, '3+ dias'], [7, '7+'], [14, '14+'], [30, '30+']], 'luMin', 'ondas');
  seg('dca-freq', [[7, 'Semanal'], [14, 'Quinzenal'], [30, 'Mensal']], 'dcaFreq', 'aportes');
  seg('dca-from', [[2018, '2018'], [2020, '2020'], [2022, '2022'], [2024, '2024']], 'dcaFrom', 'aportes');
  seg('dca-mult', [[2, '2×'], [3, '3×'], [5, '5×']], 'dcaMult', 'aportes');
  seg('dca-view', [['val', 'Valor em US$'], ['pct', 'Resultado em %']], 'dcaView', 'aportes');
  $('dca-amt').value = st.dcaAmt;
  var ta; $('dca-amt').addEventListener('input', function (e) { var v = +e.target.value; if (!(v >= 1)) return; st.dcaAmt = v; clearTimeout(ta); ta = setTimeout(function () { save(); dirty.add('aportes'); show(st.tab); }, 250); });

  /* ---------- guia ---------- */
  /* "Como ler" no topo de cada aba (substitui a antiga aba Guia) */
  var GUIA = [['agora','Responde: o token está caindo; quem comprou neste mesmo cenário, o que aconteceu?','No topo, onde o preço está: queda desde o topo de 12 meses e de 90 dias, e há quantos dias. Depois, o placar e a tabela: cada linha é um ciclo de queda diferente, com o resultado de quem comprou na primeira vez que o cenário de hoje apareceu naquele ciclo (3 meses, 6 meses, 1 ano, 2 anos), se voltou ao topo e quanto caiu antes. A linha "agora" é a queda atual, ainda em aberto.','"Voltou ao topo" e "no lucro 1 ano depois" são perguntas diferentes: o preço pode voltar e cair de novo. Conte ciclos, não dias. Troque o critério e a margem para ver se a resposta muda muito; se muda, a amostra é frágil.'],['grafico','Responde: como o preço e o humor do mercado andaram juntos?','Velas do token em cima e o índice embaixo, no mesmo eixo de tempo, de 15 minutos a semanal. As faixas vermelhas são os dias de medo e as setas marcam o começo de cada onda.','Use para ver onde o medo apareceu: em fundos, no meio de quedas ou em sustos passageiros.'],['estudo','Responde: comprar com o índice em tal faixa rendeu quanto, e em quais tokens?','Mapa de calor com as faixas do índice nas linhas e os prazos nas colunas; a distribuição do pior ao melhor caso; e a mesma regra aplicada aos 8 tokens.','Aqui cada dia conta como uma compra, então os números são mais suaves que os da aba Agora. Serve para comparar faixas e tokens, não para responder "e agora?".'],['ondas','Responde: depois que o medo começa, quanto ainda cai, e em quantos dias dobra?','Cada onda de medo com duração, queda extra, dias até o fundo e retornos; depois, os marcos de +50%, 2×, 3×, 5× e 10× a partir da compra no 1º dia, no preço médio ou no último dia da onda.','Mostra o custo emocional do hold: quase nunca o primeiro dia de medo é o fundo.'],['aportes','Responde: vale a pena usar o índice para decidir o tamanho do aporte?','Quatro estratégias de aporte recorrente com valor, frequência, ano de início e multiplicador no medo. Mostra valor, resultado em %, pior momento e preço médio por ano.','Compare o múltiplo com o tempo no prejuízo e o caixa parado: a que rende mais nem sempre é a mais fácil de aguentar.']];
  GUIA.forEach(function (g) { var sec = $('t-' + g[0]); if (sec) sec.insertAdjacentHTML('afterbegin', '<details class="como-ler"><summary>' + g[1] + '</summary><p><b>O que mostra.</b> ' + g[2] + '</p><p><b>Como ler.</b> ' + g[3] + '</p></details>'); });

  /* ---------- controles ---------- */
  put($('tf'), TFS.map(function (t) { return '<button type="button" data-tf="' + t[0] + '">' + t[1] + '</button>'; }).join(''));
  $('tf').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b || b.disabled) return; st.tf = b.dataset.tf; syncButtons(); save(); drawChart(); });
  $('tokens').addEventListener('click', function (e) { var b = e.target.closest('.tok'); if (!b || b.disabled) return; st.tok = b.dataset.t; syncButtons(); invalidate(); });
  ['log', 'vol', 'band'].forEach(function (k) { $('o-' + k).addEventListener('change', function (e) { st[k] = e.target.checked; save(); if (chart) applyOpts(); }); });
  $('o-mk').addEventListener('change', function (e) { st.mk = e.target.checked; save(); drawChart(); });
  var tt; $('thr').addEventListener('input', function (e) { st.thr = +e.target.value; $('thr-out').textContent = st.thr; document.querySelectorAll('.thr-echo').forEach(function (x) { x.textContent = st.thr; }); clearTimeout(tt); tt = setTimeout(invalidate, 150); });

  /* ---------- início ---------- */
  var status = $('mg-status');
  var h0 = location.hash.slice(1); h0 = ALIAS[h0] || h0; show(RENDER[h0] ? h0 : st.tab);
  if (!E || !D) { status.textContent = 'Faltou carregar uma peça da página. Recarregue.'; return; }
  var vivos = Object.keys(TOK).filter(function (t) { return t !== 'LUNA'; });
  Promise.all([
    D.medoGanancia(),
    Promise.all(vivos.map(function (t) { return D.velasLongas(t, '1d', INICIO).then(function (r) { return deRoteador(r.velas); }, function () { return null; }); }))
  ]).then(function (rs) {
    var f = rs[0], ser = f.serie, a = Math.floor(ser[0].t / 864e5), b = Math.floor(ser[ser.length - 1].t / 864e5), v = new Array(b - a + 1).fill(null);
    ser.forEach(function (p) { v[Math.floor(p.t / 864e5) - a] = p.v; });
    FNG = { start: a, v: v }; fLast = b;
    vivos.forEach(function (t, i) { if (rs[1][i] && rs[1][i].length > 30) DAILY[t] = rs[1][i]; });
    if (window.MEDO_LUNA_1D) DAILY.LUNA = deCompacto(window.MEDO_LUNA_1D);
    Object.keys(TOK).forEach(function (t) { if (!DAILY[t]) delete TOK[t]; });
    if (!DAILY[st.tok]) st.tok = Object.keys(TOK)[0];
    var hoje = fng(fLast);
    $('now-v').textContent = hoje; $('now-label').textContent = zone(hoje); $('now-date').textContent = fmtD(fLast * DAY);
    $('now-src').textContent = f.guardado ? 'série guardada de ' + D.quandoTexto(f.quando) : 'alternative.me';
    $('last-date').textContent = fmtD(fLast * DAY);
    var faltou = vivos.filter(function (t) { return !DAILY[t]; });
    status.textContent = faltou.length ? 'Sem histórico agora para: ' + faltou.join(', ') + '. O resto do painel funciona.' : '';
    status.hidden = !faltou.length && !f.guardado;
    if (f.guardado) status.textContent = 'O índice não respondeu agora; usando a série guardada de ' + D.quandoTexto(f.quando) + '. ' + status.textContent;
    tokens(); syncButtons(); scales(); lessons();
    if (LWC) initChart(); else $('loading').textContent = 'A biblioteca do gráfico não carregou.';
    READY = true; show(st.tab);
  }).catch(function (e) {
    if (window.console) console.warn('Medo e Ganância: falha ao carregar', e);
    if (READY) return;
    status.textContent = 'Não deu para buscar o índice de medo e ganância agora, e não há série guardada neste navegador. Tente de novo em alguns minutos.';
    $('loading').textContent = 'sem dados';
  });
})();
