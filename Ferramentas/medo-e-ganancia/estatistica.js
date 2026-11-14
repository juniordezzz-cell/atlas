/* ============================================================
   ATLAS · Ferramentas/medo-e-ganancia/estatistica.js
   Contas puras da ferramenta Medo e Ganância: sem DOM, sem rede.
   Testes: node --test Ferramentas/medo-e-ganancia/estatistica.test.cjs

   Convenção: o tempo é contado em DIAS desde 01/01/1970 (UTC), inteiros.
   Quem chama passa duas funções:
     preco(d) -> fechamento do dia d (ou null)
     indice(d) -> valor do medo e ganância no dia d, 0 a 100 (ou null)

   Exposto em: window.AtlasMedoGanancia. No Node: require(...).
   ============================================================ */
(function (raiz) {
  'use strict';

  /* percentil pelo índice mais próximo (sem interpolar), sobre lista ordenada */
  function q(s, p) { return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))]; }

  /* resumo de uma lista de retornos (0.25 = +25%) */
  function resumo(lista) {
    if (!lista || !lista.length) return null;
    var s = lista.slice().sort(function (a, b) { return a - b; });
    var ganhos = 0; for (var i = 0; i < s.length; i++) if (s[i] > 0) ganhos++;
    return { n: s.length, win: ganhos / s.length, med: q(s, 0.5), p10: q(s, 0.1), p25: q(s, 0.25),
      p75: q(s, 0.75), p90: q(s, 0.9), min: s[0], max: s[s.length - 1] };
  }
  function mediana(lista) { var r = resumo(lista); return r ? r.med : null; }

  /* retorno de comprar no dia d e segurar H dias, para cada dia de d0 a d1.
     fimValido: último dia em que o preço de saída vale (para token morto, o
     dia de hoje: o preço fica parado no último valor). */
  function retornos(preco, indice, d0, d1, H, fimValido) {
    var out = [];
    for (var d = d0; d <= d1; d++) {
      var v = indice(d); if (v == null || d + H > fimValido) continue;
      var a = preco(d), b = preco(d + H); if (!a || b == null) continue;
      out.push([d, v, b / a - 1]);
    }
    return out;
  }

  /* ondas de medo: dias com índice <= limiar; dias separados por até "folga"
     dias sem medo contam como a mesma onda. Só ficam ondas com minDias. */
  function episodios(indice, d0, d1, limiar, folga, minDias) {
    folga = folga == null ? 10 : folga; minDias = minDias == null ? 3 : minDias;
    var eps = [], cur = null;
    for (var d = d0; d <= d1; d++) {
      var v = indice(d); if (v == null || v > limiar) continue;
      if (cur && d - cur.end <= folga) { cur.end = d; cur.days++; cur.minV = Math.min(cur.minV, v); cur.list.push(d); }
      else { cur = { start: d, end: d, days: 1, minV: v, list: [d] }; eps.push(cur); }
    }
    return eps.filter(function (e) { return e.days >= minDias; });
  }

  /* depois de uma onda: queda extra no ano seguinte, dias até o fundo e retornos */
  function depoisDaOnda(preco, e, fimValido) {
    var p0 = preco(e.start), mn = p0, mi = e.start, lim = Math.min(e.start + 365, fimValido);
    for (var d = e.start; d <= lim; d++) { var p = preco(d); if (p != null && p < mn) { mn = p; mi = d; } }
    var r = function (H) { return e.start + H > fimValido ? null : preco(e.start + H) / p0 - 1; };
    return { p0: p0, mn: mn, mi: mi, dd: mn / p0 - 1, toBottom: mi - e.start, r90: r(90), r365: r(365), r730: r(730) };
  }

  /* preço de entrada numa onda: 1º dia, último dia ou média dos dias de medo */
  function entrada(preco, e, modo) {
    if (modo === 'last') return { d0: e.end, P: preco(e.end) };
    if (modo === 'avg') {
      var s = 0, n = 0;
      for (var i = 0; i < e.list.length; i++) { var p = preco(e.list[i]); if (p) { s += p; n++; } }
      return { d0: e.end, P: n ? s / n : preco(e.end) };
    }
    return { d0: e.start, P: preco(e.start) };
  }

  /* marcos de lucro depois de comprar a P no dia d0, até o dia "fim":
     em quantos dias bateu cada múltiplo, pico, pior momento antes do pico e valor atual */
  function marcos(preco, d0, P, fim, metas) {
    metas = metas || [1.5, 2, 3, 5, 10];
    var hit = {}, mx = 1, mxd = 0, cur = 1, serie = [];
    for (var d = d0 + 1; d <= fim; d++) {
      var p = preco(d); if (!p) continue;
      var m = p / P; serie.push([d - d0, m]); cur = m;
      if (m > mx) { mx = m; mxd = d - d0; }
      for (var k = 0; k < metas.length; k++) if (hit[metas[k]] == null && m >= metas[k]) hit[metas[k]] = d - d0;
    }
    var mn = 1, mnd = 0;
    for (var j = 0; j < serie.length; j++) {
      if (mxd > 0 && serie[j][0] > mxd) break;
      if (serie[j][1] < mn) { mn = serie[j][1]; mnd = serie[j][0]; }
    }
    return { hit: hit, mx: mx, mxd: mxd, mn: mn, mnd: mnd, cur: cur, span: fim - d0 };
  }

  /* aportes recorrentes de "aporte" a cada "passo" dias, de a até b.
     fimCompra: último dia em que dá para comprar (token morto: depois disso
     o dinheiro fica em caixa). Quatro estratégias:
       fixo  sempre o mesmo valor
       res   guarda o aporte e gasta todo o caixa quando há medo
       cal   aporte × mult no medo, metade na ganância extrema (>= 75)
       real  como cal e vende 3% da posição a cada período com índice >= 80 */
  function simularAportes(o) {
    var preco = o.preco, indice = o.indice, A = o.aporte, M = o.mult, L = o.limiar;
    var mk = function () { return { inv: 0, q: 0, qb: 0, cash: 0, spent: 0, sold: 0, line: [], res: [], minR: 0, minT: null, under: 0, n: 0, yr: {} }; };
    var s = { fixo: mk(), res: mk(), cal: mk(), real: mk() }, inv = [], pFim = null;
    for (var d = o.a; d <= o.b; d += o.passo) {
      var p = preco(d), v = indice(d); if (!p || v == null) continue;
      var ok = d <= o.fimCompra, fear = v <= L, y = new Date(d * 864e5).getUTCFullYear();
      var buy = function (st, m) {
        if (m <= 0) return;
        if (ok) { st.q += m / p; st.qb += m / p; st.spent += m; if (!st.yr[y]) st.yr[y] = [0, 0]; st.yr[y][0] += m; st.yr[y][1] += m / p; }
        else st.cash += m;
      };
      s.fixo.inv += A; buy(s.fixo, A);
      s.res.inv += A; s.res.cash += A; if (fear && ok) { var c = s.res.cash; s.res.cash = 0; buy(s.res, c); }
      var m = fear ? A * M : v >= 75 ? A / 2 : A;
      s.cal.inv += m; buy(s.cal, m);
      s.real.inv += m; buy(s.real, m);
      if (v >= 80 && ok && s.real.q > 0) { var x = s.real.q * 0.03; s.real.q -= x; s.real.cash += x * p; s.real.sold += x * p; }
      for (var k in s) {
        var st = s[k], val = st.q * p + st.cash, r = val / st.inv - 1;
        st.line.push([d, val]); st.res.push([d, r]); st.n++;
        if (r < 0) st.under++;
        if (r < st.minR) { st.minR = r; st.minT = d; }
      }
      inv.push([d, s.fixo.inv]); pFim = p;
    }
    var pUlt = preco(o.b) || pFim;
    for (var k2 in s) {
      var t = s[k2];
      t.val = t.q * pUlt + t.cash; t.mult = t.inv ? t.val / t.inv : 0; t.avg = t.qb ? t.spent / t.qb : null;
    }
    return { estrategias: s, investido: inv };
  }

  var api = { resumo: resumo, mediana: mediana, retornos: retornos, episodios: episodios, depoisDaOnda: depoisDaOnda,
    entrada: entrada, marcos: marcos, simularAportes: simularAportes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.AtlasMedoGanancia = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
