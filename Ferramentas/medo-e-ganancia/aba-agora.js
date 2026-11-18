/* ============================================================
   ATLAS · Ferramentas/medo-e-ganancia/aba-agora.js
   Aba "Agora": a resposta objetiva para o token escolhido.
     1. onde o preço está (queda desde o topo de 12 meses e de 90 dias);
     2. placar: quem comprou no mesmo cenário voltou ao topo? estava no lucro em 1 e 2 anos?
     3. tabela com um ciclo por linha (3m, 6m, 1 ano, 2 anos, volta ao topo, alvo, pior queda);
     4. o mesmo placar para os outros tokens, como referência;
     5. toda vez que caiu 10%, 20%... do topo, quanto demorou para voltar.
   Contas em estatistica.js (situacao, cenario, quedas). Este arquivo só desenha.
   Uso: AbaAgora.render(ctx, el). O mesmo arquivo serve o painel do Laboratório.
   Registro: docs/ferramenta-medo-ganancia-2026-11-14.md
   ============================================================ */
(function (raiz) {
  'use strict';
  var DAY = 86400;

  function serieDe(ctx, t) {
    var S = ctx.series(t), fim = Math.min(S.end, ctx.fLast), P = [];
    for (var d = S.start; d <= fim; d++) P.push(S.price(d));
    return { S: S, P: P };
  }
  function placar(cs) {
    var fechados = cs.filter(function (c) { return !c.atual; }), conta = function (lista, f) { return lista.filter(f).length; };
    var com = function (k) { return cs.filter(function (c) { return c[k] != null && !c.atual; }); };
    var voltas = fechados.map(function (c) { return c.voltou; }).sort(function (a, b) { return a - b; });
    var a1 = com('r365'), a2 = com('r730');
    return { total: cs.length, fechados: fechados.length, atual: cs.filter(function (c) { return c.atual; })[0] || null,
      voltou: fechados.length, voltas: voltas,
      lucro1: conta(a1, function (c) { return c.r365 > 0; }), n1: a1.length,
      lucro2: conta(a2, function (c) { return c.r730 > 0; }), n2: a2.length };
  }

  /* ctx: { E, series, fng, fLast, st, save, put, fmtD, fmtP, pct, cls, zone, divColor, retT, css, TOK } */
  function render(ctx, el) {
    var E = ctx.E, st = ctx.st, t = st.tok, put = ctx.put, fmtD = ctx.fmtD, fmtP = ctx.fmtP, pct = ctx.pct;
    var x = serieDe(ctx, t), S = x.S, P = x.P;
    if (P.length < 400) { put(el, '<div class="card"><p>Histórico curto demais para comparar (menos de 400 dias).</p></div>'); return; }
    st.agAlvo = st.agAlvo || {}; if (!st.agModo) st.agModo = 'medo'; if (!st.agTol) st.agTol = 0.1;
    var sit = E.situacao(P, S.start), hoje = sit.preco, morto = S.dead;
    var alvo = +st.agAlvo[t] || Math.round(sit.topo90.preco * 100) / 100; if (!(alvo > 0)) alvo = hoje * 1.5;
    var alvoRel = alvo / hoje, subir = pct(alvoRel - 1);
    var opc = { usarMedo: st.agModo === 'medo', limiar: st.thr, tolerancia: st.agTol, alvoRel: alvoRel };
    var cs = E.cenario(P, S.start, ctx.fng, opc), pl = placar(cs);
    var idx = ctx.fng(ctx.fLast), seq = 0; for (var q = ctx.fLast; ctx.fng(q) != null && ctx.fng(q) <= st.thr; q--) seq++;
    var faixa = [Math.max(-0.99, sit.topo365.queda - st.agTol), Math.min(0, sit.topo365.queda + st.agTol)];
    var crit = (opc.usarMedo ? 'medo ≤ ' + st.thr + ' e ' : '') + 'queda de ' + pct(faixa[1]) + ' a ' + pct(faixa[0]) + ' do topo de 12 meses';
    var K = function (l, v, s) { return '<div class="kpi"><span class="eyebrow">' + l + '</span><div class="k">' + v + '</div><span>' + s + '</span></div>'; };
    var h = '';

    // 1) onde está
    h += '<div class="kpis">' +
      K('Preço · ' + t, morto ? '≈ $0' : '$' + fmtP(hoje), morto ? 'colapsou em 13/05/2022' : 'fechamento de ' + fmtD(sit.dia * DAY)) +
      K('Desde o topo de ' + fmtD(sit.topo365.dia * DAY), '<span class="' + ctx.cls(sit.topo365.queda) + '">' + pct(sit.topo365.queda) + '</span>', 'maior preço dos últimos 12 meses: $' + fmtP(sit.topo365.preco) + ' · caindo há <b>' + sit.topo365.dias + ' dias</b>') +
      K('Desde o topo de ' + fmtD(sit.topo90.dia * DAY), '<span class="' + ctx.cls(sit.topo90.queda) + '">' + pct(sit.topo90.queda) + '</span>', 'maior preço dos últimos 90 dias: $' + fmtP(sit.topo90.preco) + ' · caindo há <b>' + sit.topo90.dias + ' dias</b>') +
      K('Índice hoje', '<span style="color:' + (idx <= 25 ? 'var(--fear)' : idx >= 75 ? 'var(--greed)' : 'var(--ink)') + '">' + idx + '</span>', ctx.zone(idx) + (seq ? ' · <b>' + seq + ' dia' + (seq === 1 ? '' : 's') + '</b> seguidos ≤ ' + st.thr : ' · fora do medo (≤ ' + st.thr + ')')) +
      '</div>';

    // 2) controles
    var bt = function (v, l) { return '<button type="button" data-ag-alvo="' + v + '">' + l + '</button>'; };
    h += '<div class="card"><div class="row">' +
      '<span class="lbl">Cenário parecido</span><div class="seg" role="group" aria-label="Critério">' +
      '<button type="button" data-ag-modo="medo" aria-pressed="' + (st.agModo === 'medo') + '">Medo + mesma queda</button><button type="button" data-ag-modo="queda" aria-pressed="' + (st.agModo === 'queda') + '">Só a mesma queda</button></div>' +
      '<span class="lbl">Margem</span><div class="seg" role="group" aria-label="Margem da queda">' + [0.05, 0.1, 0.15].map(function (v) { return '<button type="button" data-ag-tol="' + v + '" aria-pressed="' + (st.agTol === v) + '">±' + v * 100 + ' pts</button>'; }).join('') + '</div>' +
      '<label class="lbl" for="ag-alvo">Alvo US$</label><input class="inp" id="ag-alvo" type="number" min="0" step="any" value="' + (Math.round(alvo * 100) / 100) + '">' +
      '<div class="seg" role="group" aria-label="Alvos prontos">' + bt(sit.topo90.preco, 'Topo de 90 dias') + bt(sit.topo365.preco, 'Topo de 12 meses') + bt(hoje * 1.2, '+20%') + bt(hoje * 1.5, '+50%') + bt(hoje * 2, '2×') + '</div>' +
      '</div></div>';

    // 3) placar + tabela por ciclo
    var corN = function (n, d) { if (!d) return 'var(--base)'; var r = n / d; return r >= 0.6 ? 'var(--up)' : r >= 0.4 ? 'var(--amber)' : 'var(--down)'; };
    var faixaV = function (v) { return !v.length ? '' : v.length === 1 ? v[0] + ' dias' : v[0] + ' a ' + v[v.length - 1] + ' dias'; };
    var chegouAlvo = cs.filter(function (c) { return c.alvo != null && c.alvo <= 365 && !c.atual; }).length;
    var P4 = function (cor, n, rot, sub) { return '<div class="ag-placa" style="border-top-color:' + cor + '"><b>' + n + '</b><span>' + rot + '</span><small>' + sub + '</small></div>'; };
    h += '<div class="card"><div class="card-head"><span class="eyebrow">Resposta direta · ' + t + ' · ' + crit + '</span>' +
      '<h2>Quem comprou ' + t + ' neste mesmo cenário: o que aconteceu?</h2>' +
      '<p>Cada linha é um ciclo de queda diferente: a primeira vez que o cenário de hoje apareceu naquela queda. O ciclo acaba quando o preço volta ao topo de onde caiu; os momentos parecidos antes disso são o mesmo ciclo.</p></div>';
    if (morto) h += '<p class="ag-frase"><b>' + (ctx.TOK[t] || t) + '</b> colapsou em maio de 2022. Quem comprou no medo antes disso perdeu quase tudo: é o histórico de um token que morreu.</p>';
    else if (!cs.length) h += '<p class="ag-frase">O cenário de hoje (' + crit + ') não apareceu antes nos dados de ' + t + '. Aumente a margem ou troque para "Só a mesma queda".</p>';
    if (cs.length) {
      h += '<div class="ag-placar">' +
        P4(corN(pl.voltou, pl.fechados), pl.fechados ? pl.voltou + ' de ' + pl.fechados : '–', 'voltaram ao topo', pl.fechados ? 'em ' + faixaV(pl.voltas) : 'nenhum ciclo encerrado') +
        P4(corN(pl.lucro1, pl.n1), pl.n1 ? pl.lucro1 + ' de ' + pl.n1 : '–', 'no lucro 1 ano depois', 'segurando, sem vender na volta') +
        P4(corN(pl.lucro2, pl.n2), pl.n2 ? pl.lucro2 + ' de ' + pl.n2 : '–', 'no lucro 2 anos depois', pl.n2 ? 'segurando 2 anos' : 'nenhum ciclo com 2 anos') +
        P4(corN(chegouAlvo, pl.fechados), pl.fechados ? chegouAlvo + ' de ' + pl.fechados : '–', 'chegaram a ' + subir + ' em até 1 ano', 'o alvo de $' + fmtP(alvo) + ', medido a partir de cada compra') +
        '</div>';
      if (pl.atual) h += '<p class="ag-atual"><b>A queda de hoje começou em ' + fmtD(pl.atual.dia * DAY) + '</b> (topo de $' + fmtP(pl.atual.topo) + '). É a linha marcada "agora" na tabela e fica fora do placar, porque ainda não terminou.</p>';
      var cel = function (v, atual) {
        if (v == null) return '<td class="empty"><span class="s">' + (atual ? 'em aberto' : '—') + '</span></td>';
        var c = ctx.divColor(ctx.retT(v)); return '<td style="background:' + c.bg + ';color:' + c.ink + '"><span class="m">' + pct(v) + '</span></td>';
      };
      var tb = '<thead><tr><th class="rl">Comprou em</th><th>3 meses</th><th>6 meses</th><th>1 ano</th><th>2 anos</th><th>Voltou ao topo</th><th>Alvo ' + subir + '</th><th>Pior antes</th></tr></thead><tbody>';
      cs.forEach(function (c) {
        tb += '<tr class="' + (c.atual ? 'cur ag-agora' : '') + '"><td class="rl"><b>' + fmtD(c.dia * DAY) + '</b><small>$' + fmtP(c.preco) + ' · ' + pct(c.queda) + ' do topo de $' + fmtP(c.topo) + (c.momentos > 1 ? ' · ' + c.momentos + ' dias parecidos' : '') + '</small></td>' +
          cel(c.r90, c.atual) + cel(c.r182, c.atual) + cel(c.r365, c.atual) + cel(c.r730, c.atual) +
          '<td class="plain"><span class="m ' + (c.voltou != null ? 'pos' : '') + '">' + (c.voltou != null ? c.voltou + ' dias' : 'não') + '</span><span class="s">' + (c.voltou != null ? fmtD((c.dia + c.voltou) * DAY) : 'há ' + c.desde + ' dias') + '</span></td>' +
          '<td class="plain"><span class="m">' + (c.alvo != null ? c.alvo + ' dias' : 'não') + '</span><span class="s">$' + fmtP(c.preco) + ' → $' + fmtP(c.preco * alvoRel) + '</span></td>' +
          '<td class="plain"><span class="m ' + (c.pior < -0.005 ? 'neg' : '') + '">' + (c.pior < -0.005 ? pct(c.pior) : 'nenhuma') + '</span><span class="s">antes de voltar ao topo</span></td></tr>';
      });
      h += '<div class="scroll"><table class="hm ag-tab">' + tb + '</tbody></table></div>';
    }
    h += '<p class="ag-aviso">Isto é o que já aconteceu, não uma previsão. São poucos ciclos (o índice só existe desde 2018) e cada um teve sua história. "Voltou ao topo" e "no lucro 1 ano depois" são perguntas diferentes: o preço pode voltar ao topo e cair de novo. Só entra aqui quem sobreviveu; a LUNA mostra o outro lado.</p></div>';

    // 4) o mesmo placar nos outros tokens
    var lin = '';
    Object.keys(ctx.TOK).forEach(function (u) {
      var y = serieDe(ctx, u); if (y.P.length < 400) return;
      var s2 = E.situacao(y.P, y.S.start), c2 = E.cenario(y.P, y.S.start, ctx.fng, { usarMedo: opc.usarMedo, limiar: st.thr, tolerancia: st.agTol }), p2 = placar(c2);
      var tx = function (n, d) { return d ? '<b style="color:' + corN(n, d) + '">' + n + ' de ' + d + '</b>' : '<span style="color:var(--muted)">–</span>'; };
      lin += '<tr class="' + (u === t ? 'cur' : '') + '"><td class="rl"><b>' + u + '</b><small>' + (ctx.TOK[u] || u) + '</small></td>' +
        '<td class="plain"><span class="m ' + ctx.cls(s2.topo365.queda) + '">' + (y.S.dead ? 'morto' : pct(s2.topo365.queda)) + '</span><span class="s">há ' + s2.topo365.dias + ' dias</span></td>' +
        '<td class="plain"><span class="m">' + p2.fechados + '</span><span class="s">' + (p2.atual ? '+ 1 em aberto' : 'encerrados') + '</span></td>' +
        '<td class="plain"><span class="m">' + tx(p2.voltou, p2.fechados) + '</span><span class="s">' + (p2.voltas.length ? 'mediana ' + E.mediana(p2.voltas) + ' dias' : '&nbsp;') + '</span></td>' +
        '<td class="plain"><span class="m">' + tx(p2.lucro1, p2.n1) + '</span><span class="s">&nbsp;</span></td>' +
        '<td class="plain"><span class="m">' + tx(p2.lucro2, p2.n2) + '</span><span class="s">&nbsp;</span></td></tr>';
    });
    h += '<div class="card"><div class="card-head"><span class="eyebrow">Referência · cada token no seu cenário de hoje</span><h2>O mesmo placar nos outros tokens</h2>' +
      '<p>Cada token comparado com a própria situação de hoje (a queda dele desde o topo de 12 meses), com o mesmo critério acima. O BTC e o ETH têm o histórico mais longo dos dados.</p></div>' +
      '<div class="scroll"><table class="hm"><thead><tr><th class="rl">Token</th><th>Queda hoje</th><th>Ciclos</th><th>Voltou ao topo</th><th>Lucro em 1 ano</th><th>Lucro em 2 anos</th></tr></thead><tbody>' + lin + '</tbody></table></div></div>';

    // 5) quedas e recuperação
    var X5 = [0.1, 0.2, 0.3, 0.4, 0.5], cur = -sit.topo90.queda;
    var tq = '<thead><tr><th class="rl">Queda do topo de 90 dias</th><th>Vezes</th><th>Voltou ao topo</th><th>Dias até voltar</th><th>Mais rápida</th><th>Mais lenta</th><th>Caiu mais no caminho</th></tr></thead><tbody>';
    X5.forEach(function (xq, k) {
      var ev = E.quedas(P, S.start, xq, 90), ok = ev.filter(function (e) { return !e.aberta; }), ds = ok.map(function (e) { return e.voltou; });
      var agora = cur >= xq && (k === X5.length - 1 || cur < X5[k + 1]);
      var ult = ev.slice(-5).reverse().map(function (e) { return fmtD(e.dia * DAY) + ': ' + (e.aberta ? '<b>ainda não voltou</b>' : 'voltou em <b>' + e.voltou + ' dias</b>') + ', caiu mais ' + pct(e.pior); }).join('<br>');
      var cw = ev.length ? ctx.divColor(((ok.length / ev.length) - 0.5) / 0.35) : null;
      tq += '<tr class="' + (agora ? 'cur' : '') + '"><td class="rl"><b>' + (xq * 100) + '% ou mais</b><small>' + (agora ? t + ' está aqui hoje (' + pct(sit.topo90.queda) + ')' : '&nbsp;') + '</small></td>' +
        '<td class="plain"><span class="m">' + ev.length + '</span><span class="s">vezes</span></td>' +
        (ev.length ? '<td style="background:' + cw.bg + ';color:' + cw.ink + '" data-tip="' + ult + '"><span class="m">' + ok.length + ' de ' + ev.length + '</span><span class="s">' + (ev.length - ok.length ? (ev.length - ok.length) + ' em aberto' : 'todas') + '</span></td>' : '<td class="empty"><span class="s">–</span></td>') +
        (ds.length ? '<td class="plain"><span class="m">' + E.mediana(ds) + 'd</span><span class="s">mediana</span></td><td class="plain"><span class="m">' + Math.min.apply(null, ds) + 'd</span><span class="s">&nbsp;</span></td><td class="plain"><span class="m">' + Math.max.apply(null, ds) + 'd</span><span class="s">&nbsp;</span></td>' : '<td class="empty"><span class="s">–</span></td><td class="empty"><span class="s">–</span></td><td class="empty"><span class="s">–</span></td>') +
        (ev.length ? '<td class="plain"><span class="m neg">' + pct(E.mediana(ev.map(function (e) { return e.pior; }))) + '</span><span class="s">mediana</span></td>' : '<td class="empty"><span class="s">–</span></td>') + '</tr>';
    });
    h += '<div class="card"><div class="card-head"><span class="eyebrow">Quedas e recuperação · ' + t + ' · desde ' + fmtD(S.start * DAY) + '</span><h2>Toda vez que caiu do topo, quanto demorou para voltar</h2>' +
      '<p>Sem olhar o índice: cada vez que o preço ficou 10%, 20%... abaixo do maior preço dos 90 dias anteriores, e quantos dias levou para voltar àquele topo. Passe o mouse em "Voltou ao topo" para ver as últimas vezes.</p></div>' +
      '<div class="scroll"><table class="hm">' + tq + '</tbody></table></div></div>';

    put(el, h);

    if (!el.dataset.agLigado) {
      el.dataset.agLigado = '1';
      var refazer = function () { ctx.save(); render(ctx, el); };
      el.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.dataset.agAlvo) { st.agAlvo[st.tok] = Math.round(+b.dataset.agAlvo * 100) / 100; refazer(); }
        else if (b.dataset.agModo) { st.agModo = b.dataset.agModo; refazer(); }
        else if (b.dataset.agTol) { st.agTol = +b.dataset.agTol; refazer(); }
      });
      var tm;
      el.addEventListener('input', function (e) {
        if (e.target.id !== 'ag-alvo') return; var v = +e.target.value; if (!(v > 0)) return;
        clearTimeout(tm); tm = setTimeout(function () {
          st.agAlvo[st.tok] = v; ctx.save(); render(ctx, el);
          var i = document.getElementById('ag-alvo'); if (i) { i.focus(); var n = i.value.length; try { i.setSelectionRange(n, n); } catch (z) { /* type=number */ } }
        }, 500);
      });
    }
  }

  var api = { render: render };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.AbaAgora = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
