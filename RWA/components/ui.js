/* ============================================================
   ATLAS · RWA — components/ui.js
   Peças de UI reutilizáveis pelas views.
   ============================================================ */
(function () {
  "use strict";
  var U = window.U;

  var UI = {
    kpi: function (o) {
      // { k, v, icon, accent('','a2','apos','awarn'), foot(html) }
      return '<div class="panel kpi ' + (o.accent || "") + '">' +
        '<div class="kpi-top"><span class="kpi-k">' + o.k + '</span><span class="kpi-ic">' + U.icon(o.icon) + '</span></div>' +
        '<div class="kpi-v">' + o.v + '</div>' +
        (o.foot ? '<div class="kpi-foot">' + o.foot + '</div>' : '') +
      '</div>';
    },

    panel: function (title, bodyHtml, headRight, eyebrow) {
      return '<div class="panel panel-pad">' +
        '<div class="panel-head"><div>' + (eyebrow ? '<div class="eyebrow">' + eyebrow + '</div>' : '') + '<h3>' + title + '</h3></div>' + (headRight || '') + '</div>' +
        bodyHtml + '</div>';
    },

    meter: function (o) {
      // { k, v, pct(0-100), color, foot }
      var color = o.color || "#4F8CFF";
      return '<div class="meter">' +
        '<div class="m-top"><span class="m-k">' + o.k + '</span><span class="m-v">' + o.v + '</span></div>' +
        '<div class="m-track"><i style="left:0;width:' + Math.max(2, Math.min(100, o.pct)) + '%;background:' + color + '"></i></div>' +
        (o.foot ? '<div class="m-foot">' + o.foot + '</div>' : '') +
      '</div>';
    },

    legend: function (items) {
      return '<div class="legend">' + items.map(function (i) {
        return '<div class="legend-item"><span class="l"><span class="sw" style="background:' + i.color + '"></span>' + i.label + '</span><span class="v">' + U.pct(i.pct) + '</span></div>';
      }).join("") + '</div>';
    },

    empty: function (o) {
      return '<div class="empty"><div class="empty-art">' + U.icon(o.icon || "info") + '</div><h3>' + o.title + '</h3><p>' + o.text + '</p></div>';
    }
  };

  window.UI = UI;
})();
