/* ============================================================
   ATLAS · RWA — charts.js
   Wrappers temáticos sobre Chart.js. Requer Chart.js via CDN.
   ============================================================ */
(function () {
  "use strict";
  var FONT = "Inter, sans-serif";
  var GRID = "rgba(255,255,255,0.05)";
  var TICK = "#6B7280";
  function ready() { return typeof window.Chart !== "undefined"; }
  function grad(ctx, area, c1, c2) { if (!area) return c1; var g = ctx.createLinearGradient(0, area.top, 0, area.bottom); g.addColorStop(0, c1); g.addColorStop(1, c2); return g; }

  var tooltip = {
    backgroundColor: "rgba(15,21,36,0.97)", borderColor: "rgba(255,255,255,0.14)", borderWidth: 1,
    titleColor: "#E5E7EB", bodyColor: "#9CA3AF", padding: 11, cornerRadius: 8, displayColors: false,
    titleFont: { family: FONT, size: 11 }, bodyFont: { family: "JetBrains Mono, monospace", size: 12.5, weight: "600" }
  };

  var Charts = {
    line: function (cv, points, o) {
      if (!ready() || !cv) return null; o = o || {};
      var color = o.color || "#4F8CFF", fill = o.fill || "rgba(79,140,255,0.16)";
      return new Chart(cv.getContext("2d"), {
        type: "line",
        data: { labels: points.map(function (p) { return p.date; }), datasets: [{
          data: points.map(function (p) { return p.value; }),
          borderColor: color, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: color,
          tension: 0.35, fill: true,
          backgroundColor: function (c) { var ch = c.chart; return grad(ch.ctx, ch.chartArea, fill, "rgba(79,140,255,0)"); }
        }] },
        options: {
          responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: "index" },
          plugins: { legend: { display: false }, tooltip: Object.assign({}, tooltip, { callbacks: {
            title: function (i) { return window.U ? U.date(i[0].label) : i[0].label; },
            label: function (i) { var v = i.parsed.y; return o.pctAxis ? U.pct(v) : o.plain ? U.num(v, 2) : (window.U ? U.money(v) : v); } } }) },
          scales: {
            x: { grid: { display: false }, ticks: { color: TICK, font: { size: 10 }, maxTicksLimit: 6, callback: function (v) { var l = this.getLabelForValue(v); return window.U ? U.dateShort(l) : l; } }, border: { display: false } },
            y: { grid: { color: GRID }, ticks: { color: TICK, font: { size: 10 }, maxTicksLimit: 5, callback: function (v) { return o.pctAxis ? v + "%" : o.plain ? U.num(v, 1) : (window.U ? U.compact(v) : v); } }, border: { display: false } }
          }
        }
      });
    },

    multiLine: function (cv, labels, datasets, o) {
      if (!ready() || !cv) return null; o = o || {};
      return new Chart(cv.getContext("2d"), {
        type: "line",
        data: { labels: labels, datasets: datasets.map(function (d) { return { label: d.label, data: d.data, borderColor: d.color, borderWidth: d.width || 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, fill: false, borderDash: d.dash || [] }; }) },
        options: {
          responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: "index" },
          plugins: {
            legend: { display: true, position: "top", align: "end", labels: { color: "#9CA3AF", font: { family: FONT, size: 11.5 }, usePointStyle: true, pointStyle: "circle", boxWidth: 7, padding: 14 } },
            tooltip: Object.assign({}, tooltip, { displayColors: true, usePointStyle: true, callbacks: {
              title: function (i) { return window.U ? U.date(i[0].label) : i[0].label; },
              label: function (i) { var v = i.parsed.y; return " " + i.dataset.label + ": " + (o.pctAxis ? U.pct(v) : o.plain ? U.num(v, 1) : U.compact(v)); } } })
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: TICK, font: { size: 10 }, maxTicksLimit: 6, callback: function (v) { var l = this.getLabelForValue(v); return window.U ? U.dateShort(l) : l; } }, border: { display: false } },
            y: { grid: { color: GRID }, ticks: { color: TICK, font: { size: 10 }, maxTicksLimit: 5, callback: function (v) { return o.pctAxis ? v + "%" : o.plain ? U.num(v, 0) : (window.U ? U.compact(v) : v); } }, border: { display: false } }
          }
        }
      });
    },

    donut: function (cv, items) {
      if (!ready() || !cv) return null;
      return new Chart(cv.getContext("2d"), {
        type: "doughnut",
        data: { labels: items.map(function (i) { return i.label; }), datasets: [{ data: items.map(function (i) { return i.value; }), backgroundColor: items.map(function (i) { return i.color; }), borderColor: "#0B0F1A", borderWidth: 2, hoverOffset: 5, spacing: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: "70%",
          plugins: { legend: { display: false }, tooltip: Object.assign({}, tooltip, { callbacks: { label: function (i) { return " " + i.label + ": " + U.compact(i.parsed); } } }) } }
      });
    },

    bar: function (cv, labels, values, colors, o) {
      if (!ready() || !cv) return null; o = o || {};
      return new Chart(cv.getContext("2d"), {
        type: "bar",
        data: { labels: labels, datasets: [{ data: values, backgroundColor: colors || "#4F8CFF", borderRadius: 6, maxBarThickness: 38 }] },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: o.horizontal ? "y" : "x",
          plugins: { legend: { display: false }, tooltip: Object.assign({}, tooltip, { callbacks: { label: function (i) { var val = o.horizontal ? i.parsed.x : i.parsed.y; return o.pct ? U.pct(val) : U.compact(val); } } }) },
          scales: {
            x: { grid: { display: !o.horizontal ? false : true, color: GRID }, ticks: { color: TICK, font: { size: 10 }, callback: function (v) { return o.horizontal ? (o.pct ? v + "%" : U.compact(v)) : this.getLabelForValue(v); } }, border: { display: false } },
            y: { grid: { display: o.horizontal ? false : true, color: GRID }, ticks: { color: TICK, font: { size: 10.5 }, callback: function (v) { return o.horizontal ? this.getLabelForValue(v) : (o.pct ? v + "%" : U.compact(v)); } }, border: { display: false } }
          } }
      });
    },

    spark: function (cv, values, color) {
      if (!ready() || !cv) return null;
      return new Chart(cv.getContext("2d"), {
        type: "line",
        data: { labels: values.map(function (_, i) { return i; }), datasets: [{ data: values, borderColor: color || "#4F8CFF", borderWidth: 1.6, pointRadius: 0, tension: 0.4, fill: true,
          backgroundColor: function (c) { var ch = c.chart; return grad(ch.ctx, ch.chartArea, (color || "#4F8CFF") + "22", "rgba(0,0,0,0)"); } }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } }, elements: { line: { borderJoinStyle: "round" } } }
      });
    }
  };
  window.Charts = Charts;
})();
