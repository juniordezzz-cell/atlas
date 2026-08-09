/* ============================================================
   ATLAS · DeFi — charts.js
   Wrappers temáticos sobre Chart.js (linha, donut).
   Requer Chart.js carregado via CDN antes deste script.
   ============================================================ */
(function () {
  "use strict";

  var FONT = "Inter, sans-serif";

  /* O canvas não lê variável CSS: a cromagem de gráfico ficava cravada
     em valores de tema escuro e, no tema claro, a grade sumia e o
     tooltip virava um retângulo preto. AtlasChartTheme traduz token →
     cor no tema ativo; sem ele, tudo cai nos valores antigos e o módulo
     segue funcionando. Ver core/ui/atlas-chart-theme.js. */
  function T() { return window.AtlasChartTheme; }
  function cor(c) { var t = T(); return t ? t.cor(c) : c; }
  function serie(c) { var t = T(); return t ? t.serie(c) : c; }
  function GRID() { var t = T(); return t ? t.grade() : "rgba(120,150,220,0.08)"; }
  function TICK() { var t = T(); return t ? t.tick() : "#7E8AA6"; }
  function dica(extra) {
    var t = T();
    var base = t ? t.tooltip() : {
      backgroundColor: "rgba(12,18,33,0.96)", borderColor: "rgba(120,160,255,0.30)", borderWidth: 1,
      titleColor: "#EAF0FB", bodyColor: "#C3CEE4", padding: 12, cornerRadius: 10, displayColors: false
    };
    base = Object.assign({}, base, {
      padding: 12, cornerRadius: 10,
      titleFont: { family: FONT, size: 11 },
      bodyFont: { family: "JetBrains Mono, monospace", size: 13, weight: "600" }
    });
    return Object.assign(base, extra || {});
  }

  function ready() { return typeof window.Chart !== "undefined"; }

  function gradient(ctx, area, c1, c2) {
    if (!area) return c1;
    var g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    return g;
  }

  var Charts = {
    /* ---------- Linha (evolução) ---------- */
    line: function (canvas, points, opts) {
      if (!ready() || !canvas) return null;
      opts = opts || {};
      var labels = points.map(function (p) { return p.date; });
      var data = points.map(function (p) { return p.value; });
      var base = serie(opts.color || "var(--blue-400)");
      var t = T();
      var fill = opts.fill ? cor(opts.fill) : (t ? t.alfa(base, 0.16) : "rgba(59,130,246,0.16)");
      var vazio = t ? t.alfa(base, 0) : "rgba(59,130,246,0)";

      return new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
          labels: labels,
          datasets: [{
            data: data,
            borderColor: base,
            borderWidth: 2.4,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: base,
            pointHoverBorderColor: (T() ? T().vao() : "#0A1020"),
            pointHoverBorderWidth: 2,
            tension: 0.38,
            fill: true,
            backgroundColor: function (c) {
              var ch = c.chart; return gradient(ch.ctx, ch.chartArea, fill, vazio);
            }
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { intersect: false, mode: "index" },
          plugins: {
            legend: { display: false },
            tooltip: dica({
              callbacks: {
                title: function (it) { return window.U ? U.date(it[0].label) : it[0].label; },
                label: function (it) { return window.U ? U.money(it.parsed.y) : it.parsed.y; }
              }
            })
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: TICK(), font: { family: FONT, size: 10 }, maxTicksLimit: 6,
              callback: function (v) { var l = this.getLabelForValue(v); return window.U ? U.dateShort(l) : l; } }, border: { display: false } },
            y: { grid: { color: GRID() }, ticks: { color: TICK(), font: { family: FONT, size: 10 }, maxTicksLimit: 5,
              callback: function (v) { return window.U ? U.money(v, { dec: 0 }) : v; } }, border: { display: false } }
          }
        }
      });
    },

    /* ---------- Multi-linha ---------- */
    multiLine: function (canvas, labels, datasets) {
      if (!ready() || !canvas) return null;
      return new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
          labels: labels,
          datasets: datasets.map(function (d) {
            return { label: d.label, data: d.data, borderColor: serie(d.color), borderWidth: 2.2,
              pointRadius: 0, pointHoverRadius: 4, tension: 0.38, fill: false };
          })
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { intersect: false, mode: "index" },
          plugins: {
            legend: { display: true, position: "top", align: "end",
              labels: { color: TICK(), font: { family: FONT, size: 12 }, usePointStyle: true, pointStyle: "circle", boxWidth: 7, padding: 16 } },
            tooltip: dica({ usePointStyle: true })
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: TICK(), font: { size: 10 }, maxTicksLimit: 6,
              callback: function (v) { var l = this.getLabelForValue(v); return window.U ? U.dateShort(l) : l; } }, border: { display: false } },
            y: { grid: { color: GRID() }, ticks: { color: TICK(), font: { size: 10 }, maxTicksLimit: 5 }, border: { display: false } }
          }
        }
      });
    },

    /* ---------- Donut ---------- */
    donut: function (canvas, items, opts) {
      if (!ready() || !canvas) return null;
      opts = opts || {};
      return new Chart(canvas.getContext("2d"), {
        type: "doughnut",
        data: {
          labels: items.map(function (i) { return i.label; }),
          datasets: [{
            data: items.map(function (i) { return i.value; }),
            backgroundColor: items.map(function (i) { return serie(i.color); }),
            borderColor: (T() ? T().vao() : "rgba(10,16,32,0.9)"), borderWidth: 3, hoverOffset: 6, spacing: 2
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: opts.cutout || "72%",
          plugins: {
            legend: { display: false },
            tooltip: dica({
              padding: 11, usePointStyle: true,
              callbacks: { label: function (it) { return " " + it.label + ": " + (window.U ? U.money(it.parsed) : it.parsed); } }
            })
          }
        }
      });
    },

    /* ---------- Barra (APR realizado etc.) ---------- */
    bar: function (canvas, labels, values, colors) {
      if (!ready() || !canvas) return null;
      return new Chart(canvas.getContext("2d"), {
        type: "bar",
        data: { labels: labels, datasets: [{ data: values, backgroundColor: (colors ? (colors.map ? colors.map(serie) : serie(colors)) : serie("var(--blue-400)")), borderRadius: 7, barThickness: "flex", maxBarThickness: 40 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: dica({ padding: 11,
              callbacks: { label: function (it) { return window.U ? U.pct(it.parsed.y) : it.parsed.y; } } })
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: TICK(), font: { size: 11 } }, border: { display: false } },
            y: { grid: { color: GRID() }, ticks: { color: TICK(), font: { size: 10 }, callback: function (v) { return v + "%"; } }, border: { display: false } }
          }
        }
      });
    }
  };

  window.Charts = Charts;
})();
