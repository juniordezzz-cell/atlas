/* ============================================================
   ATLAS · RWA — utils.js
   Formatação, DOM, ícones, helpers de regime/status/score, toast.
   ============================================================ */
(function () {
  "use strict";

  /* ============================================================
     DINHEIRO — delegado ao AtlasCurrency
     ------------------------------------------------------------
     Estas funções cravavam "US$" e o locale pt-BR. core/currency.js
     existe desde a Fase 0 com conversão real (três fontes de câmbio em
     cascata, cache de 6h, validação das taxas) e NENHUM módulo o usava:
     escolher BRL nas Configurações não mudava nada em lugar nenhum.

     O valor recebido está SEMPRE em USD — é a regra de armazenamento do
     ATLAS. A conversão acontece só na hora de exibir.

     O caminho antigo fica como reserva: o RWA carrega as dependências
     como opcionais de propósito, e sem o AtlasCurrency o módulo tem de
     continuar mostrando número.
     ============================================================ */
  function fmt(v, dec) {
    if (window.AtlasCurrency) return AtlasCurrency.format(v, { decimals: dec });
    var n = Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return (v < 0 ? "-" : "") + "US$ " + n;
  }

  var U = {
    money: function (v, dec) {
      dec = dec == null ? (Math.abs(v) < 100 && v !== 0 ? 2 : 0) : dec;
      return fmt(v, dec);
    },
    money0: function (v) { return fmt(v, 0); },
    compact: function (v) {
      if (window.AtlasCurrency) return AtlasCurrency.compact(v);
      var a = Math.abs(v), s = v < 0 ? "-" : "";
      if (a >= 1e6) return s + "US$ " + (a / 1e6).toFixed(2) + "M";
      if (a >= 1e3) return s + "US$ " + (a / 1e3).toFixed(1) + "K";
      return s + "US$ " + a.toFixed(0);
    },
    /* o "+" é do RWA (ganho/perda), não da moeda: o sinal negativo já
       vem do próprio formatador */
    signed: function (v) { return (v > 0 ? "+" : "") + fmt(v, 0); },
    pct: function (v, sign) { return (sign && v > 0 ? "+" : "") + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%"; },
    num: function (v, dec) { return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 2 : dec }); },
    date: function (iso) { if (!iso) return "—"; var d = new Date(iso + (iso.length === 10 ? "T00:00:00" : "")); return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); },
    dateShort: function (iso) { if (!iso) return "—"; var d = new Date(iso + (iso.length === 10 ? "T00:00:00" : "")); return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); },

    qs: function (s, r) { return (r || document).querySelector(s); },
    qsa: function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); },
    reveal: function (sel) { U.qsa(sel).forEach(function (n, i) { n.classList.add("reveal"); n.style.setProperty("--i", i); }); },

    /* token badge (iniciais coloridas) */
    tkn: function (a) {
      var init = a.ticker.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
      return '<span class="asset-tkn" style="background:' + a.color + '">' + init + '</span>';
    },

    /* regime chip */
    regime: function (id, small) {
      var m = RWAStore.regimeMeta(id);
      return '<span class="regime ' + m.cls + (small ? ' small' : '') + '"><span class="rd"></span>' + m.label + (small ? '' : ' · ' + m.tag) + '</span>';
    },

    /* status */
    status: function (st) {
      var m = { core: { c: "st-core", l: "Core" }, watch: { c: "st-watch", l: "Watch" }, reduce: { c: "st-reduce", l: "Reduce" } }[st] || { c: "st-core", l: st };
      return '<span class="status ' + m.c + '"><span class="d"></span>' + m.l + '</span>';
    },

    /* score bar */
    score: function (s) {
      var c = RWAStore.scoreColor(s);
      return '<span class="score"><span class="score-bar"><i style="width:' + s + '%;background:' + c + '"></i></span><span class="score-v" style="color:' + c + '">' + s + '</span></span>';
    },

    /* sensibilidade a regime → badge colorido */
    sens: function (label) {
      var map = { "Risk-On": "regime-riskon", "Risk-Off": "regime-riskoff", "Liquidity": "regime-liqexp", "Neutral": "regime-trans" };
      var cls = map[label] || "regime-trans";
      return '<span class="regime ' + cls + ' small"><span class="rd"></span>' + label + '</span>';
    },

    delta: function (pct) { var c = pct > 0 ? "up" : pct < 0 ? "down" : "flat"; return '<span class="delta ' + c + '">' + U.pct(pct, true) + '</span>'; },

    toast: function (msg, kind) {
      kind = kind || "ok";
      var wrap = U.qs("#toasts"); if (!wrap) { wrap = document.createElement("div"); wrap.id = "toasts"; document.body.appendChild(wrap); }
      var ic = kind === "ok" ? U.icon("check") : kind === "warn" ? U.icon("alert") : U.icon("info");
      var t = document.createElement("div"); t.className = "toast " + kind;
      t.innerHTML = ic + "<span>" + msg + "</span>"; wrap.appendChild(t);
      setTimeout(function () { t.style.opacity = "0"; t.style.transform = "translateX(20px)"; setTimeout(function () { t.remove(); }, 240); }, 2600);
    },

    icon: function (name) {
      var p = {
        grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
        portfolio: '<path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6" rx="1"/><rect x="12" y="7" width="3" height="10" rx="1"/><rect x="17" y="13" width="3" height="4" rx="1"/>',
        macro: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
        risk: '<path d="M12 2 2 21h20L12 2Z"/><path d="M12 9v5M12 17h.01"/>',
        narrative: '<path d="M4 5h16M4 12h10M4 19h16"/><circle cx="18" cy="12" r="2.4"/>',
        journal: '<path d="M4 4h13l3 3v13H4Z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
        wallet: '<path d="M3 7h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M3 7l1.5-3.5A1 1 0 0 1 5.4 3H17"/>',
        trend: '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>',
        shield: '<path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/>',
        pulse: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
        layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
        building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01"/>',
        gauge: '<path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M13.4 12.6 19 7"/><path d="M4.6 19a9 9 0 1 1 14.8 0"/>',
        coins: '<circle cx="8" cy="8" r="5"/><path d="M18.1 6.2a5 5 0 0 1 0 9.6M14 14a5 5 0 0 1-6 4.8"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-3.5-3.5"/>',
        back: '<path d="m15 18-6-6 6-6"/>',
        arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
        up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
        down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        alert: '<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
        menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
        flame: '<path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s0 2 2 2c0-3 2-5 2-9Z"/>',
        drop: '<path d="M12 3s6 6 6 10a6 6 0 0 1-12 0c0-4 6-10 6-10Z"/>',
        bank: '<path d="M3 10 12 4l9 6"/><path d="M5 10v9M19 10v9M9 10v9M15 10v9M3 21h18"/>'
      };
      /* Biblioteca única primeiro (core/ui/atlas-icons.js); a tabela
         acima fica como reserva para o que só o RWA tem. */
      if (window.AtlasIcons) {
        var s = AtlasIcons.get(name, { strokeWidth: 1.7 });
        if (s) return s;
      }
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (p[name] || p.info) + '</svg>';
    }
  };

  window.U = U;
})();
