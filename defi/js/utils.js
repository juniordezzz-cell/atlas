/* ============================================================
   ATLAS · DeFi — utils.js
   Formatação, helpers de DOM, ícones SVG, toasts, status.
   ============================================================ */
(function () {
  "use strict";

  var CUR = "USD";
  try { if (window.DeFiStore) CUR = DeFiStore.meta().currency || "USD"; } catch (e) {}
  var SYMBOL = { USD: "US$", BRL: "R$", EUR: "€" };

  var U = {
    /* ---------- Formatação ---------- */
    money: function (v, opts) {
      opts = opts || {};
      var sym = SYMBOL[CUR] || "US$";
      var abs = Math.abs(v);
      var dec = opts.dec != null ? opts.dec : (abs < 100 && abs !== 0 ? 2 : 0);
      var n = abs.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
      var sign = v < 0 ? "-" : "";
      return sign + sym + " " + n;
    },
    signedMoney: function (v) {
      var s = v > 0 ? "+" : (v < 0 ? "-" : "");
      var sym = SYMBOL[CUR] || "US$";
      return s + sym + " " + Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
    },
    num: function (v, dec) {
      dec = dec == null ? 2 : dec;
      return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    },
    pct: function (v, withSign) {
      var s = (withSign && v > 0) ? "+" : "";
      return s + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
    },
    date: function (iso) {
      if (!iso) return "—";
      var d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    },
    dateShort: function (iso) {
      if (!iso) return "—";
      var d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    },
    daysBetween: function (a, b) {
      var d1 = new Date(a), d2 = new Date(b || Date.now());
      return Math.max(0, Math.round((d2 - d1) / 86400000));
    },

    /* ---------- DOM ---------- */
    qs: function (s, r) { return (r || document).querySelector(s); },
    qsa: function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); },
    param: function (k) { return new URLSearchParams(location.search).get(k); },
    reveal: function (nodes) {
      U.qsa(nodes).forEach(function (n, i) { n.classList.add("reveal"); n.style.setProperty("--i", i); });
    },

    /* ---------- Iniciais / cores de token ---------- */
    coin: function (sym) {
      var c = (window.DeFiStore && DeFiStore.colorOf("token", sym)) || "#5B9BFF";
      var initials = sym.slice(0, 3).toUpperCase();
      return '<span class="coin" style="background:' + c + '">' + initials + '</span>';
    },

    /* ---------- Status ---------- */
    status: function (st) {
      var m = {
        ativa:     { label: "Ativa",         cls: "status-ativa",     chip: "chip-ativa" },
        range:     { label: "Fora do Range", cls: "status-range",     chip: "chip-range" },
        encerrada: { label: "Encerrada",     cls: "status-encerrada", chip: "chip-encerrada" },
        analise:   { label: "Em análise",    cls: "status-analise",   chip: "chip-analise" }
      };
      return m[st] || m.ativa;
    },
    statusDot: function (st) {
      var m = U.status(st);
      return '<span class="status ' + m.cls + '"><span class="pulse"></span>' + m.label + '</span>';
    },
    statusChip: function (st) {
      var m = U.status(st);
      return '<span class="status-chip ' + m.chip + '">' + m.label + '</span>';
    },
    delta: function (pct) {
      var cls = pct > 0 ? "up" : (pct < 0 ? "down" : "flat");
      return '<span class="delta ' + cls + '">' + U.pct(pct, true) + '</span>';
    },

    /* ---------- Toast ---------- */
    toast: function (msg, kind) {
      kind = kind || "ok";
      var wrap = U.qs("#toasts");
      if (!wrap) { wrap = document.createElement("div"); wrap.id = "toasts"; document.body.appendChild(wrap); }
      var ic = kind === "ok" ? U.icon("check") : kind === "warn" ? U.icon("alert") : U.icon("info");
      var t = document.createElement("div");
      t.className = "toast " + kind;
      t.innerHTML = '<span class="ic">' + ic + '</span><span>' + msg + '</span>';
      wrap.appendChild(t);
      setTimeout(function () { t.style.opacity = "0"; t.style.transform = "translateX(24px)"; setTimeout(function () { t.remove(); }, 260); }, 2800);
    },

    /* ---------- Modal ---------- */
    openModal: function (id) { var m = U.qs(id); if (m) m.classList.add("open"); },
    closeModal: function (id) { var m = U.qs(id); if (m) m.classList.remove("open"); },

    /* ---------- Ícones SVG (stroke, herdam currentColor) ---------- */
    icon: function (name) {
      var p = {
        wallet: '<path d="M3 7h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M3 7l1.5-3.5A1 1 0 0 1 5.4 3H17"/><path d="M17 12h.01"/>',
        trend: '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>',
        layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
        gauge: '<path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M13.4 12.6 19 7"/><path d="M4.6 19a9 9 0 1 1 14.8 0"/>',
        pools: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="2.5"/>',
        stake: '<path d="M12 2 3 7v6c0 5 4 8 9 9 5-1 9-4 9-9V7l-9-5Z"/><path d="m9 12 2 2 4-4"/>',
        lend: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h4.5a1.5 1.5 0 0 1 0 3H10a1.5 1.5 0 0 0 0 3H15"/>',
        chart: '<path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="7" rx="1"/><rect x="12" y="6" width="3" height="11" rx="1"/><rect x="17" y="13" width="3" height="4" rx="1"/>',
        clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
        gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        back: '<path d="m15 18-6-6 6-6"/>',
        arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        alert: '<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
        close: '<path d="M18 6 6 18M6 6l12 12"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-3.5-3.5"/>',
        in: '<path d="M12 5v14M5 12l7 7 7-7"/>',
        out: '<path d="M12 19V5M5 12l7-7 7 7"/>',
        re: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
        edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
        book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
        flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z"/><line x1="4" y1="22" x2="4" y2="15"/>',
        download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
        inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z"/>',
        oracle: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>'
      };
      var body = p[name] || p.info;
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
    }
  };

  window.U = U;
})();
