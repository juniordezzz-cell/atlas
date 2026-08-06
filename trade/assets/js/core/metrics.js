/* ============================================================
   ATLAS — Métricas (Pós-Análise → Métricas → Oráculo aprende)
   ------------------------------------------------------------
   Deriva desempenho e aprendizados a partir dos trades ENCERRADOS
   da carteira ativa. Consumido pelo módulo Analytics e pelo Oráculo.
   ============================================================ */
(function (ATLAS) {
  "use strict";

  var HOUR = 3600 * 1000;

  function closed() {
    return ATLAS.app.trades()
      .filter(function (t) { return t.status === "encerrado"; })
      .slice()
      .sort(function (a, b) { return (a.closedAt || 0) - (b.closedAt || 0); });
  }

  function holdH(t) {
    if (!t.closedAt || !t.openedAt) return 0;
    return Math.max(0, (t.closedAt - t.openedAt) / HOUR);
  }
  function avg(arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : 0; }

  var metrics = {
    closed: closed,

    summary: function () {
      var c = closed();
      var wins = c.filter(function (t) { return t.pnl > 0; });
      var losses = c.filter(function (t) { return t.pnl < 0; });
      var be = c.filter(function (t) { return t.pnl === 0; });
      var grossWin = wins.reduce(function (s, t) { return s + t.pnl; }, 0);
      var grossLoss = Math.abs(losses.reduce(function (s, t) { return s + t.pnl; }, 0));
      var reviewed = c.filter(function (t) { return t.review; });

      var byAsset = {}, bySide = { long: { n: 0, wins: 0, sum: 0 }, short: { n: 0, wins: 0, sum: 0 } };
      var run = 0, cumulative = [];
      c.forEach(function (t) {
        byAsset[t.asset] = byAsset[t.asset] || { n: 0, sum: 0 };
        byAsset[t.asset].n++; byAsset[t.asset].sum += t.pnl;
        var side = bySide[t.side] || (bySide[t.side] = { n: 0, wins: 0, sum: 0 });
        side.n++; side.sum += t.pnl; if (t.pnl > 0) side.wins++;
        run += t.pnl; cumulative.push({ ts: t.closedAt, val: run, asset: t.asset, pnl: t.pnl });
      });

      return {
        count: c.length,
        wins: wins.length, losses: losses.length, be: be.length,
        winrate: c.length ? Math.round((wins.length / c.length) * 100) : 0,
        profitFactor: grossLoss ? (grossWin / grossLoss) : (grossWin ? Infinity : 0),
        net: run,
        avg: c.length ? avg(c.map(function (t) { return t.pnl; })) : 0,
        best: c.length ? Math.max.apply(null, c.map(function (t) { return t.pnl; })) : 0,
        worst: c.length ? Math.min.apply(null, c.map(function (t) { return t.pnl; })) : 0,
        avgHoldH: avg(c.map(holdH)),
        reviewed: reviewed.length,
        adherenceRate: reviewed.length ? Math.round((reviewed.filter(function (t) { return t.review.adherence === "total"; }).length / reviewed.length) * 100) : 0,
        avgDiscipline: reviewed.length ? avg(reviewed.map(function (t) { return t.review.discipline; })) : 0,
        byAsset: byAsset, bySide: bySide, cumulative: cumulative,
        dist: { gain: wins.length, loss: losses.length, be: be.length }
      };
    },

    /** Aprendizados que o Oráculo extrai dos dados */
    insights: function () {
      var c = closed(); var out = [];
      if (c.length < 3) { out.push({ tone: "neutral", text: "Ainda há poucos trades encerrados para conclusões sólidas. Siga registrando." }); return out; }
      var s = metrics.summary();

      // Long vs Short
      var L = s.bySide.long, S = s.bySide.short;
      if (L && S && L.n >= 2 && S.n >= 2) {
        var lw = Math.round(L.wins / L.n * 100), sw = Math.round(S.wins / S.n * 100);
        if (Math.abs(lw - sw) >= 15)
          out.push({ tone: lw > sw ? "up" : "down", text: "Seu winrate em Long (" + lw + "%) é " + (lw > sw ? "maior" : "menor") + " que em Short (" + sw + "%). Considere concentrar no lado mais forte." });
      }

      // Aderência ao plano x resultado
      var reviewed = c.filter(function (t) { return t.review; });
      var full = reviewed.filter(function (t) { return t.review.adherence === "total"; });
      var notFull = reviewed.filter(function (t) { return t.review.adherence !== "total"; });
      if (full.length >= 2 && notFull.length >= 1) {
        var aF = avg(full.map(function (t) { return t.pnl; })), aN = avg(notFull.map(function (t) { return t.pnl; }));
        if (aF - aN >= 1)
          out.push({ tone: "up", text: "Quando você seguiu o plano à risca, o resultado médio (" + aF.toFixed(1) + "%) foi melhor do que quando não seguiu (" + aN.toFixed(1) + "%). Aderência compensa." });
      }

      // Segurar perdedores
      var wins = c.filter(function (t) { return t.pnl > 0; }), losses = c.filter(function (t) { return t.pnl < 0; });
      if (wins.length && losses.length) {
        var hW = avg(wins.map(holdH)), hL = avg(losses.map(holdH));
        if (hL > hW * 1.3)
          out.push({ tone: "down", text: "Você tende a segurar perdedores por mais tempo (" + ATLAS.util.dur(Math.round(hL)) + ") do que vencedores (" + ATLAS.util.dur(Math.round(hW)) + "). Cortar mais cedo pode ajudar." });
      }

      // Melhor ativo
      var best = null;
      Object.keys(s.byAsset).forEach(function (a) { if (!best || s.byAsset[a].sum > s.byAsset[best].sum) best = a; });
      if (best && s.byAsset[best].sum > 0)
        out.push({ tone: "up", text: best + " é o seu ativo mais lucrativo no período (" + ATLAS.util.pct(s.byAsset[best].sum) + " acumulado)." });

      // Pós-análise pendente
      var pend = ATLAS.app.tradesAwaitingReview().length;
      if (pend) out.push({ tone: "neutral", text: pend + " trade(s) encerrado(s) sem pós-análise. Cada análise melhora as métricas e o aprendizado." });

      if (!out.length) out.push({ tone: "neutral", text: "Desempenho consistente, sem desvios marcantes no período." });
      return out;
    }
  };

  ATLAS.metrics = metrics;
})(window.ATLAS = window.ATLAS || {});
