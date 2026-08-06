/* ============================================================
   ATLAS · core/ui/atlas-calendar.js   (Etapa 3 — 3B)
   ------------------------------------------------------------
   Calendário compartilhado do site inteiro. Vanilla/IIFE.

   Duas formas:
     AtlasCalendar.field(opts)  → campo de data (botão + popover)
                                   p/ formulários alimentarem record()
     AtlasCalendar.month(opts)  → visão de mês embutida, com os
                                   movimentos marcados (relatórios)

   opts comuns:
     value      "YYYY-MM-DD" inicial
     min, max   "YYYY-MM-DD" (limites opcionais)
     onSelect(key) / onChange(key)   callback ao escolher um dia
     markers    { "YYYY-MM-DD": {net,count} }  OU  fn(key)->marker
                se omitido e vier walletId, puxa do AtlasMovements
     walletId   marca os dias com movimento daquela carteira

   Idioma: nomes de mês/dia via Intl + AtlasSettings.lang().
   Formato do campo: AtlasSettings.formatDate() se existir.
   Cores: 100% tokens --atlas-* (claro/escuro automático).
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasCalendar) return;

  var doc = global.document;

  /* ---------- idioma / datas ---------- */
  function lang() { return (global.AtlasSettings ? AtlasSettings.get("lang") : "pt-BR") || "pt-BR"; }
  function locale() { return lang() === "en" ? "en-US" : "pt-BR"; }
  function t(s) { return global.AtlasI18n ? AtlasI18n.t(s) : s; }

  function pad(n) { return String(n).length < 2 ? "0" + n : String(n); }
  function toKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseKey(s) {
    if (!s) return null;
    var p = String(s).slice(0, 10).split("-");
    if (p.length < 3) return null;
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d.getTime()) ? null : d;
  }
  function todayKey() { return toKey(new Date()); }

  function monthTitle(y, m) {
    return new Intl.DateTimeFormat(locale(), { month: "long", year: "numeric" }).format(new Date(y, m, 1));
  }
  function dowNames() {
    var f = new Intl.DateTimeFormat(locale(), { weekday: "short" }), out = [];
    for (var i = 0; i < 7; i++) out.push(f.format(new Date(2023, 0, 1 + i)).replace(".", "")); // Jan 1 2023 = domingo
    return out;
  }
  function fmtDisplay(key) {
    var d = parseKey(key);
    if (!d) return "";
    if (global.AtlasSettings && AtlasSettings.formatDate) {
      try { var s = AtlasSettings.formatDate(d); if (s) return s; } catch (e) {}
    }
    try { return new Intl.DateTimeFormat(locale()).format(d); } catch (e) { return key; }
  }

  /* ---------- ícones ---------- */
  var ICO_CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>';
  var ICO_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>';
  var ICO_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>';

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- resolução de marcadores ---------- */
  function autoMarkers(opts, y, m) {
    if (typeof opts.markers === "function" || (opts.markers && typeof opts.markers === "object")) return opts.markers;
    if (opts.walletId && global.AtlasMovements) {
      var from = y + "-" + pad(m + 1) + "-01", to = y + "-" + pad(m + 1) + "-31", map = {};
      try {
        AtlasMovements.list({ walletId: opts.walletId, from: from, to: to }).forEach(function (mv) {
          var b = map[mv.date] || (map[mv.date] = { net: 0, count: 0 });
          b.count++; b.net += (mv.tipo === "saida" ? -mv.valorUSD : mv.valorUSD);
        });
      } catch (e) {}
      return map;
    }
    return null;
  }
  function markerFor(markers, key) {
    if (!markers) return null;
    if (typeof markers === "function") { try { return markers(key); } catch (e) { return null; } }
    return markers[key] || null;
  }

  /* ============================================================
     Fábrica de instância de calendário
     ============================================================ */
  function makeCalendar(opts, inline) {
    opts = opts || {};
    var root = doc.createElement("div");
    root.className = "atlas-cal" + (inline ? " atlas-cal--inline" : "");

    var value = opts.value || null;
    var base = parseKey(value) || new Date();
    var viewY = base.getFullYear(), viewM = base.getMonth();
    var minD = parseKey(opts.min), maxD = parseKey(opts.max);

    function disabled(d) {
      if (minD && d < stripTime(minD)) return true;
      if (maxD && d > stripTime(maxD)) return true;
      return false;
    }
    function stripTime(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

    function render() {
      var markers = autoMarkers(opts, viewY, viewM);
      var first = new Date(viewY, viewM, 1);
      var startDow = first.getDay();               // 0=Dom
      var gridStart = new Date(viewY, viewM, 1 - startDow);
      var tk = todayKey();

      var dows = dowNames();
      var html = '<div class="atlas-cal__head">' +
        '<button type="button" class="atlas-cal__nav" data-nav="-1" aria-label="' + esc(t("Mês anterior")) + '">' + ICO_L + '</button>' +
        '<div class="atlas-cal__title">' + esc(monthTitle(viewY, viewM)) + '</div>' +
        '<button type="button" class="atlas-cal__nav" data-nav="1" aria-label="' + esc(t("Próximo mês")) + '">' + ICO_R + '</button>' +
        '</div><div class="atlas-cal__grid">';

      for (var w = 0; w < 7; w++) html += '<div class="atlas-cal__dow">' + esc(dows[w]) + "</div>";

      for (var i = 0; i < 42; i++) {
        var d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
        var key = toKey(d);
        var cls = "atlas-cal__day";
        if (d.getMonth() !== viewM) cls += " is-muted";
        if (key === tk) cls += " is-today";
        if (value && key === value) cls += " is-selected";
        var dis = disabled(d);
        var mk = markerFor(markers, key);
        var dot = "";
        if (mk) {
          var sign = (mk.net > 0 ? " pos" : mk.net < 0 ? " neg" : "");
          dot = '<span class="atlas-cal__dot' + sign + '"></span>';
        }
        html += '<button type="button" class="' + cls + '" data-key="' + key + '"' + (dis ? " disabled" : "") + ">" +
                d.getDate() + dot + "</button>";
      }
      html += "</div>";

      html += '<div class="atlas-cal__foot">' +
        '<button type="button" class="atlas-cal__today-btn" data-today>' + esc(t("Hoje")) + "</button>" +
        (opts.clearable ? '<button type="button" class="atlas-cal__clear-btn" data-clear>' + esc(t("Limpar")) + "</button>" : "") +
        "</div>";

      root.innerHTML = html;
    }

    function onClick(e) {
      var nav = e.target.closest("[data-nav]");
      if (nav) {
        viewM += parseInt(nav.getAttribute("data-nav"), 10);
        if (viewM < 0) { viewM = 11; viewY--; }
        else if (viewM > 11) { viewM = 0; viewY++; }
        render(); return;
      }
      if (e.target.closest("[data-today]")) {
        var n = new Date(); viewY = n.getFullYear(); viewM = n.getMonth(); render(); return;
      }
      if (e.target.closest("[data-clear]")) {
        value = null; render(); if (opts.onSelect) opts.onSelect(null); return;
      }
      var day = e.target.closest(".atlas-cal__day");
      if (day && !day.hasAttribute("disabled")) {
        value = day.getAttribute("data-key");
        var pd = parseKey(value); viewY = pd.getFullYear(); viewM = pd.getMonth();
        render();
        if (opts.onSelect) opts.onSelect(value);
      }
    }
    root.addEventListener("click", onClick);

    // relabel ao trocar idioma/tema
    var settingsHandler = null;
    if (global.AtlasSettings && AtlasSettings.on) {
      settingsHandler = function () { render(); };
      AtlasSettings.on(settingsHandler);
    }

    render();

    return {
      el: root,
      getValue: function () { return value; },
      setValue: function (key) { value = key || null; var pd = parseKey(value); if (pd) { viewY = pd.getFullYear(); viewM = pd.getMonth(); } render(); },
      setMonth: function (y, m) { viewY = y; viewM = m; render(); },
      setMarkers: function (mk) { opts.markers = mk; render(); },
      setWallet: function (id) { opts.walletId = id; render(); },
      refresh: render,
      destroy: function () {
        root.removeEventListener("click", onClick);
        if (settingsHandler && global.AtlasSettings && AtlasSettings.off) AtlasSettings.off(settingsHandler);
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  /* ============================================================
     API pública
     ============================================================ */
  var API = {

    /* Visão de mês embutida (relatórios / overview). */
    month: function (opts) { return makeCalendar(opts || {}, true); },

    /* Campo de data com popover (formulários). */
    field: function (opts) {
      opts = opts || {};
      var wrap = doc.createElement("div");
      wrap.className = "atlas-calfield";

      var btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "atlas-calfield__btn";
      btn.setAttribute("aria-haspopup", "dialog");
      btn.setAttribute("aria-expanded", "false");

      var pop = doc.createElement("div");
      pop.className = "atlas-cal__pop";

      var value = opts.value || null;

      function label() {
        var v = value ? fmtDisplay(value) : (opts.placeholder || t("Selecionar data"));
        btn.innerHTML = ICO_CAL + '<span class="atlas-calfield__val' + (value ? "" : " is-empty") + '">' + esc(v) + "</span>";
      }

      var cal = makeCalendar({
        value: value, min: opts.min, max: opts.max, clearable: opts.clearable,
        onSelect: function (key) {
          value = key; label();
          close();
          if (opts.onChange) opts.onChange(key);
        }
      }, false);
      pop.appendChild(cal.el);

      function open() {
        pop.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
        doc.addEventListener("mousedown", outside, true);
        doc.addEventListener("keydown", onEsc, true);
      }
      function close() {
        pop.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
        doc.removeEventListener("mousedown", outside, true);
        doc.removeEventListener("keydown", onEsc, true);
      }
      function toggle() { pop.classList.contains("open") ? close() : open(); }
      function outside(e) { if (!wrap.contains(e.target)) close(); }
      function onEsc(e) { if (e.key === "Escape") close(); }

      btn.addEventListener("click", toggle);
      label();
      wrap.appendChild(btn);
      wrap.appendChild(pop);

      return {
        el: wrap,
        getValue: function () { return value; },
        setValue: function (key) { value = key || null; cal.setValue(value); label(); },
        open: open, close: close,
        destroy: function () { close(); cal.destroy(); if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }
      };
    },

    _fmtDisplay: fmtDisplay,
    _toKey: toKey,
    _parseKey: parseKey
  };

  /* dicionário próprio do calendário */
  if (global.AtlasI18n) {
    AtlasI18n.add("en", {
      "Mês anterior": "Previous month",
      "Próximo mês": "Next month",
      "Hoje": "Today",
      "Limpar": "Clear",
      "Selecionar data": "Select date"
    });
  }

  global.AtlasCalendar = API;
})(typeof window !== "undefined" ? window : this);
