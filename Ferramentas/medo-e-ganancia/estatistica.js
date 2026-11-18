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

  /* ---------- aba Agora: situação de hoje e momentos parecidos ----------
     Trabalha sobre a série diária contínua P (P[i] = fechamento do dia d0 + i,
     dias sem vela repetem o anterior). */

  /* máximo móvel: para cada i, o maior P[k] com i - janela < k <= i, e onde foi */
  function maxMovel(P, janela) {
    var out = new Array(P.length), fila = [];
    for (var i = 0; i < P.length; i++) {
      while (fila.length && P[fila[fila.length - 1]] <= P[i]) fila.pop();
      fila.push(i);
      while (fila[0] <= i - janela) fila.shift();
      out[i] = fila[0];
    }
    return out;
  }

  /* onde o preço está hoje: queda desde o topo de 1 ano e de 90 dias */
  function situacao(P, d0) {
    var n = P.length - 1, m365 = maxMovel(P, 365), m90 = maxMovel(P, 90);
    return { dia: d0 + n, preco: P[n],
      topo365: { dia: d0 + m365[n], preco: P[m365[n]], queda: P[n] / P[m365[n]] - 1, dias: n - m365[n] },
      topo90: { dia: d0 + m90[n], preco: P[m90[n]], queda: P[n] / P[m90[n]] - 1, dias: n - m90[n] } };
  }

  /* quedas de X (0.2 = 20%) a partir do topo da janela: quando aconteceram,
     em quantos dias voltaram ao topo e quanto caíram no caminho. Depois que uma
     queda volta ao topo, a busca recomeça do dia seguinte. */
  function quedas(P, d0, X, janela) {
    janela = janela || 90;
    var m = maxMovel(P, janela), ev = [], i = 0;
    while (i < P.length) {
      var topo = P[m[i]];
      if (P[i] <= topo * (1 - X)) {
        var rec = null, mn = P[i], mnd = i;
        for (var j = i + 1; j < P.length; j++) {
          if (P[j] < mn) { mn = P[j]; mnd = j; }
          if (P[j] >= topo) { rec = j; break; }
        }
        ev.push({ dia: d0 + i, topo: topo, diaTopo: d0 + m[i], preco: P[i], voltou: rec == null ? null : rec - i,
          pior: mn / P[i] - 1, diaPior: d0 + mnd, aberta: rec == null });
        if (rec == null) break;
        i = rec + 1; continue;
      }
      i++;
    }
    return ev;
  }

  /* momentos parecidos com hoje: queda desde o topo de 1 ano dentro de
     ±tolerancia da queda de hoje e, se usarMedo, índice <= limiar.
     Dias próximos (folga) viram um momento só. Para cada um: em quantos dias
     chegou ao alvo (alvoRel = alvo / preço de hoje, aplicado ao preço daquele
     dia), a +20%, a pior queda antes disso e o resultado de 1 ano. O momento
     que encosta em hoje (dentro da folga) é a situação atual e não entra. */
  function analogos(P, d0, indice, o) {
    var n = P.length - 1, m365 = maxMovel(P, 365), quedaHoje = P[n] / P[m365[n]] - 1;
    var tol = o.tolerancia == null ? 0.1 : o.tolerancia, folga = o.folga == null ? 10 : o.folga;
    var grupos = [], cur = null;
    /* começa no dia 90: nos primeiros meses do token o topo é o maior preço desde a listagem */
    for (var i = 90; i <= n; i++) {
      var dd = P[i] / P[m365[i]] - 1;
      if (Math.abs(dd - quedaHoje) > tol) continue;
      var v = indice(d0 + i);
      if (o.usarMedo && (v == null || v > o.limiar)) continue;
      if (cur && i - cur.fim <= folga) { cur.fim = i; cur.dias++; }
      else { cur = { ini: i, fim: i, dias: 1, indice: v, queda: dd }; grupos.push(cur); }
    }
    /* o momento que chega até hoje é a própria situação atual: fica de fora */
    if (grupos.length && grupos[grupos.length - 1].fim >= n - folga) grupos.pop();
    return grupos.map(function (g) {
      var p0 = P[g.ini], alvo = p0 * o.alvoRel, hit = null, hit20 = null, mn = p0;
      for (var j = g.ini + 1; j <= n; j++) {
        if (hit == null && P[j] < mn) mn = P[j];
        if (hit20 == null && P[j] >= p0 * 1.2) hit20 = j - g.ini;
        if (P[j] >= alvo) { hit = j - g.ini; break; }
      }
      return { dia: d0 + g.ini, preco: p0, diasNaZona: g.dias, indice: g.indice, queda: g.queda,
        alvo: hit, mais20: hit20, pior: mn / p0 - 1, ano: g.ini + 365 <= n ? P[g.ini + 365] / p0 - 1 : null, desde: n - g.ini };
    });
  }

  /* cenário de hoje, um ciclo por linha.
     Momento parecido: queda desde o topo dos 365 dias anteriores dentro de
     ±tolerancia da queda de hoje (e índice <= limiar, se usarMedo).
     Ciclo = a mesma queda: começa no primeiro momento parecido e dura até o
     preço voltar ao topo de onde aquela queda foi medida. Momentos antes da
     volta pertencem ao mesmo ciclo. A linha do ciclo é a compra no primeiro
     momento dele. O ciclo que ainda não voltou ao topo e chega até hoje é a
     queda atual (atual: true). Prazos: 90, 182, 365 e 730 dias. */
  function cenario(P, d0, indice, o) {
    var n = P.length - 1, m365 = maxMovel(P, 365), quedaHoje = P[n] / P[m365[n]] - 1;
    var tol = o.tolerancia == null ? 0.1 : o.tolerancia, alvoRel = o.alvoRel || null, ciclos = [], cur = null;
    var parecido = function (i) {
      if (Math.abs(P[i] / P[m365[i]] - 1 - quedaHoje) > tol) return false;
      if (!o.usarMedo) return true;
      var v = indice(d0 + i); return v != null && v <= o.limiar;
    };
    for (var i = 90; i <= n; i++) {
      if (cur && cur.volta == null && P[i] >= cur.topo) { cur.volta = i; cur = null; }
      if (!parecido(i)) continue;
      if (cur) { cur.momentos++; continue; }
      cur = { ini: i, topo: P[m365[i]], diaTopo: m365[i], momentos: 1, volta: null };
      ciclos.push(cur);
    }
    var H = function (c, h) { return c.ini + h <= n ? P[c.ini + h] / P[c.ini] - 1 : null; };
    return ciclos.filter(function (c) { return c.volta != null || c.ini < n - 10; }).map(function (c) {
      var fim = c.volta == null ? n : c.volta, mn = P[c.ini], alvo = null;
      for (var j = c.ini; j <= fim; j++) if (P[j] < mn) mn = P[j];
      if (alvoRel) for (var k = c.ini + 1; k <= n; k++) if (P[k] >= P[c.ini] * alvoRel) { alvo = k - c.ini; break; }
      return { dia: d0 + c.ini, preco: P[c.ini], topo: c.topo, diaTopo: d0 + c.diaTopo, queda: P[c.ini] / c.topo - 1, momentos: c.momentos,
        r90: H(c, 90), r182: H(c, 182), r365: H(c, 365), r730: H(c, 730),
        voltou: c.volta == null ? null : c.volta - c.ini, pior: mn / P[c.ini] - 1, alvo: alvo, atual: c.volta == null, desde: n - c.ini };
    });
  }

  var api = { cenario: cenario, resumo: resumo, mediana: mediana, retornos: retornos, episodios: episodios, depoisDaOnda: depoisDaOnda,
    entrada: entrada, marcos: marcos, simularAportes: simularAportes,
    maxMovel: maxMovel, situacao: situacao, quedas: quedas, analogos: analogos };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.AtlasMedoGanancia = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
