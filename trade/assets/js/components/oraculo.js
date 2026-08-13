/* ============================================================
   ATLAS — Oráculo
   ------------------------------------------------------------
   Assistente onipresente. O conhecimento vem dos dados do próprio
   ATLAS (teses, trades, alertas da carteira ativa) — não é um
   chatbot genérico. Nesta Fundação o "cérebro" é baseado em regras
   sobre os dados; nos próximos Sprints ganha linguagem natural.
   ============================================================ */
(function (ATLAS) {
  "use strict";

  var LIMIT_STUDY_H = 72;   // limite oficial de tese aberta
  var REVIEW_TRADE_H = 24;  // trade "antigo" a revisar

  // ---- Cérebro: consultas respondidas a partir do estado -----
  var brain = {
    stalledStudies: function () {
      var lim = ATLAS.app.pref("studyLimitH") || 72;
      return ATLAS.app.studies().filter(function (s) {
        return s.state === "andamento" && ATLAS.app.studyOpenHours(s) > lim;
      });
    },
    pendingStudies: function () {
      return ATLAS.app.studies().filter(function (s) { return s.state !== "concluido"; });
    },
    reviewTrades: function () {
      return ATLAS.app.tradesToReview(ATLAS.app.pref("tradeReviewH") || 24);
    },

    answer: function (q) {
      q = (q || "").toLowerCase();
      var u = ATLAS.util, app = ATLAS.app, w = app.currentWallet();

      if (/parad|72|atras|venc|tempo demais/.test(q)) {
        var st = brain.stalledStudies();
        var lim = ATLAS.app.pref("studyLimitH") || 72;
        if (!st.length) return "Nenhuma tese passou do limite de " + lim + "h na carteira " + w.name + ". Fluxo em dia.";
        return "Atenção: " + st.length + " tese(s) além das " + lim + "h — " +
          st.map(function (s) { return s.asset + " (" + u.dur(app.studyOpenHours(s)) + ")"; }).join(", ") +
          ". Recomendo concluir ou arquivar antes de abrir novos.";
      }
      if (/pendent|abert|fila|futur|planejad/.test(q) && /estud|tese/.test(q)) {
        var ps = brain.pendingStudies();
        if (!ps.length) return "Sem teses pendentes na carteira " + w.name + ".";
        return ps.length + " tese(s) em aberto: " +
          ps.map(function (s) { return s.asset + " — " + s.title; }).join("; ") + ".";
      }
      if (/trade|opera|revis|encerr/.test(q)) {
        var tr = brain.reviewTrades();
        if (!tr.length) return "Nenhum trade aberto exige revisão agora.";
        return tr.length + " trade(s) para reavaliar: " +
          tr.map(function (t) { return t.asset + " " + t.side + " (" + u.dur(app.tradeAgeHours(t)) + ", " + u.pct(t.pnl) + ")"; }).join(", ") + ".";
      }
      if (/\brd\b|decis|registr/.test(q)) {
        var aw = ATLAS.app.studiesAwaitingRd();
        if (!aw.length) return "Nenhuma tese concluída aguardando Registro de Decisão. Fluxo em dia.";
        return aw.length + " tese(s) concluída(s) sem RD: " +
          aw.map(function (s) { return s.asset + " — " + s.title; }).join("; ") +
          ". Toda entrada deve passar por um Registro de Decisão.";
      }
      if (/desempenh|winrate|m[eé]tric|analytic|result|profit|lucro no per/.test(q)) {
        if (!ATLAS.metrics) return brain.summaryText();
        var m = ATLAS.metrics.summary();
        if (!m.count) return "Ainda não há trades encerrados nesta carteira para calcular desempenho.";
        var pf = m.profitFactor === Infinity ? "∞" : m.profitFactor.toFixed(2);
        var first = ATLAS.metrics.insights()[0];
        return "Nesta carteira: winrate " + m.winrate + "%, profit factor " + pf + ", resultado líquido " + ATLAS.util.pct(m.net) +
          " em " + m.count + " trades encerrados." + (first ? " " + first.text : "");
      }
      if (/p[oó]s.?an[aá]lis|avalia|revis[aã]o de trade/.test(q)) {
        var pr = ATLAS.app.tradesAwaitingReview();
        if (!pr.length) return "Nenhum trade encerrado sem pós-análise. Aprendizado em dia.";
        return pr.length + " trade(s) encerrado(s) sem pós-análise: " +
          pr.map(function (t) { return t.asset + " (" + ATLAS.util.pct(t.pnl) + ")"; }).join(", ") + ".";
      }
      if (/resum|evolu|como estou|banca|patrim/.test(q)) {
        return brain.summaryText();
      }
      // fallback com orientação
      return "Posso responder sobre esta carteira: teses pendentes, teses paradas, " +
        "trades a revisar e o resumo da banca. Toque numa sugestão abaixo.";
    },

    summaryText: function () {
      var u = ATLAS.util, app = ATLAS.app;
      var chg = app.changePct(), st = brain.stalledStudies().length, tr = brain.reviewTrades().length;
      var aw = app.studiesAwaitingRd ? app.studiesAwaitingRd().length : 0;
      var pr = app.tradesAwaitingReview ? app.tradesAwaitingReview().length : 0;
      var parts = [];
      /* "no período" descrevia uma variação medida ao longo do tempo,
         que o Trade nunca teve. changePct virou resultado REALIZADO
         sobre o depositado — o texto tinha de acompanhar, senão o
         número certo continua contando a história errada. */
      parts.push("Banca em " + u.money(app.balance()) + " (" + u.pct(chg) + " do depositado, realizado).");
      if (st) parts.push(st + " tese(s) parada(s) além do limite.");
      if (aw) parts.push(aw + " tese(s) aguardando Registro de Decisão.");
      if (tr) parts.push(tr + " trade(s) aguardando revisão.");
      if (pr) parts.push(pr + " trade(s) aguardando pós-análise.");
      if (!st && !tr && !aw && !pr) parts.push("Nenhuma pendência crítica — processo em dia.");
      return parts.join(" ");
    }
  };

  var CHIPS = [
    { q: "Quais teses estão paradas há tempo demais?", label: "Teses paradas" },
    { q: "Quais teses aguardam Registro de Decisão?",  label: "RD pendente" },
    { q: "Como está meu desempenho?",                    label: "Desempenho" },
    { q: "Quais trades preciso revisar?",                label: "Revisar trades" }
  ];

  function el(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }

  var oraculo = {
    root: null,

    mount: function (mount) {
      var u = ATLAS.util;
      mount.innerHTML =
        '<div class="oraculo" data-open="false">' +
          '<div class="oraculo__panel" role="dialog" aria-label="Oráculo">' +
            '<div class="oraculo__panel-head">' +
              '<span class="oraculo__badge"><i></i></span>' +
              '<div><h3>Oráculo</h3><p>Inteligência do ATLAS</p></div>' +
              '<button class="oraculo__close" aria-label="Fechar">' + u.icon("close", 18) + '</button>' +
            '</div>' +
            '<div class="oraculo__log"></div>' +
            '<div class="oraculo__chips">' +
              CHIPS.map(function (c) { return '<button class="oraculo__chip" data-q="' + u.escape(c.q) + '">' + c.label + '</button>'; }).join("") +
            '</div>' +
            '<div class="oraculo__composer">' +
              '<input class="oraculo__input" placeholder="Pergunte ao Oráculo…" aria-label="Mensagem">' +
              '<button class="oraculo__send" aria-label="Enviar">' + u.icon("send", 18) + '</button>' +
            '</div>' +
          '</div>' +
          '<button class="oraculo__orb" aria-label="Abrir Oráculo">' +
            '<span class="oraculo__ring"></span><span class="oraculo__ring"></span>' +
            '<span class="oraculo__core"></span><span class="oraculo__dot"></span>' +
            '<span class="oraculo__pin" hidden></span>' +
          '</button>' +
        '</div>';

      oraculo.root = mount.querySelector(".oraculo");
      var orb = mount.querySelector(".oraculo__orb");
      var input = mount.querySelector(".oraculo__input");

      orb.addEventListener("click", function (e) { e.stopPropagation(); oraculo.toggle(); });
      mount.querySelector(".oraculo__close").addEventListener("click", function () { oraculo.setOpen(false); });
      mount.querySelector(".oraculo__send").addEventListener("click", function () { oraculo.submit(input); });
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") oraculo.submit(input); });
      mount.querySelectorAll(".oraculo__chip").forEach(function (c) {
        c.addEventListener("click", function () { oraculo.ask(c.dataset.q); });
      });

      // Mensagem de boas-vindas com o resumo atual
      oraculo.bot(brain.summaryText());
      oraculo.refresh();

      // Reage à troca de carteira
      ATLAS.app.subscribe(function () { oraculo.refresh(); });
    },

    toggle: function () { oraculo.setOpen(oraculo.root.dataset.open !== "true"); },
    setOpen: function (v) { oraculo.root.dataset.open = v ? "true" : "false"; },

    push: function (text, who) {
      var log = oraculo.root.querySelector(".oraculo__log");
      log.appendChild(el('<div class="oraculo__msg oraculo__msg--' + who + '">' + ATLAS.util.escape(text) + '</div>'));
      log.scrollTop = log.scrollHeight;
    },
    bot: function (t) { oraculo.push(t, "bot"); },

    submit: function (input) {
      var q = input.value.trim(); if (!q) return; input.value = "";
      oraculo.ask(q);
    },
    ask: function (q) {
      oraculo.setOpen(true);
      oraculo.push(q, "user");
      setTimeout(function () { oraculo.bot(brain.answer(q)); }, 260);
    },

    /** Atualiza o selo de avisos conforme a carteira ativa */
    refresh: function () {
      var count = brain.stalledStudies().length + brain.reviewTrades().length;
      var pin = oraculo.root.querySelector(".oraculo__pin");
      if (count > 0) { pin.hidden = false; pin.textContent = count; }
      else { pin.hidden = true; }
    },

    summaryText: function () { return brain.summaryText(); }
  };

  ATLAS.oraculo = oraculo;
})(window.ATLAS = window.ATLAS || {});
