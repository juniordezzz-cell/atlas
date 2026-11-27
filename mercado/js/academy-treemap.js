/* ============================================================
   ATLAS · mercado/js/academy-treemap.js   (26/11/2026)
   Mapa de calor em dois níveis (grupo → itens), no lugar do globo.
   Tamanho = valor (TVL, valor de mercado…); cor = variação.

   AcademyTreemap.render(caixa, grupos, opts)
     grupos: [{ nome, itens: [{ nome, valor, variacao, detalhe, aoClicar }] }]
     opts.titulos  (padrão true): faixa com o nome do grupo
     opts.escala   (padrão 8): variação (%) que pinta a cor mais forte
     opts.aoClicarGrupo(grupo): clique no título do grupo

   Algoritmo "squarified" (Bruls, Huizing e van Wijk): retângulos o mais
   perto possível de quadrados. Tudo em porcentagem da caixa, então o
   mapa acompanha a largura da tela sem recalcular.
   ============================================================ */
(function () {
  "use strict";
  if (window.AcademyTreemap) return;

  function pior(linha, lado) {
    var s = 0, mx = 0, mn = Infinity;
    linha.forEach(function (r) { s += r.a; if (r.a > mx) mx = r.a; if (r.a < mn) mn = r.a; });
    var s2 = s * s, l2 = lado * lado;
    return Math.max(l2 * mx / s2, s2 / (l2 * mn));
  }

  /* itens: [{a: área}] já em ordem decrescente; devolve [{x,y,w,h}] na mesma ordem */
  function squarify(itens, x, y, w, h) {
    var out = [], resto = itens.slice(), linha = [];
    function fecha() {
      var s = linha.reduce(function (t, r) { return t + r.a; }, 0);
      if (w >= h) {               // linha vertical à esquerda
        var lw = s / h, yy = y;
        linha.forEach(function (r) { var rh = r.a / lw; out.push({ it: r, x: x, y: yy, w: lw, h: rh }); yy += rh; });
        x += lw; w -= lw;
      } else {                    // linha horizontal em cima
        var lh = s / w, xx = x;
        linha.forEach(function (r) { var rw = r.a / lh; out.push({ it: r, x: xx, y: y, w: rw, h: lh }); xx += rw; });
        y += lh; h -= lh;
      }
      linha = [];
    }
    while (resto.length) {
      var lado = Math.min(w, h), prox = resto[0];
      if (!linha.length || pior(linha.concat([prox]), lado) <= pior(linha, lado)) { linha.push(prox); resto.shift(); }
      else fecha();
    }
    if (linha.length) fecha();
    return out;
  }

  function layout(valores, x, y, w, h) {
    var tot = valores.reduce(function (s, v) { return s + v.valor; }, 0);
    if (!(tot > 0)) return [];
    var itens = valores.map(function (v, i) { return { a: v.valor / tot * w * h, i: i }; })
                       .sort(function (a, b) { return b.a - a.a; });
    return squarify(itens, x, y, w, h).map(function (r) { return { i: r.it.i, x: r.x, y: r.y, w: r.w, h: r.h }; });
  }

  function cor(v, escala) {
    if (v == null || !isFinite(v)) return "var(--mapa-neutro, #2a3446)";
    var m = Math.min(1, Math.abs(v) / escala);
    if (m < 0.04) return "var(--mapa-neutro, #2a3446)";
    var base = v >= 0 ? "var(--mapa-alta, #12955c)" : "var(--mapa-queda, #c43b48)";
    return "color-mix(in srgb, " + base + " " + Math.round(28 + m * 72) + "%, var(--mapa-neutro, #2a3446))";
  }

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function pc(v) { return v == null || !isFinite(v) ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1).replace(".", ",") + "%"; }

  function render(caixa, grupos, opts) {
    opts = opts || {};
    var titulos = opts.titulos !== false, escala = opts.escala || 8;
    while (caixa.firstChild) caixa.removeChild(caixa.firstChild);
    caixa.classList.add("tmap");
    // espaço de cálculo com a proporção real da caixa; a tela usa %
    var prop = opts.proporcao || (caixa.clientWidth > 0 && caixa.clientHeight > 0 ? caixa.clientHeight / caixa.clientWidth : 0.62);
    var W = 1000, H = 1000 * prop;
    var gs = grupos.map(function (g) {
      return { g: g, valor: g.itens.reduce(function (s, it) { return s + (it.valor > 0 ? it.valor : 0); }, 0) };
    }).filter(function (g) { return g.valor > 0; });
    layout(gs, 0, 0, W, H).forEach(function (r) {
      var G = gs[r.i].g;
      var bloco = el("div", "tmap-grupo");
      bloco.style.left = (r.x / W * 100) + "%"; bloco.style.top = (r.y / H * 100) + "%";
      bloco.style.width = (r.w / W * 100) + "%"; bloco.style.height = (r.h / H * 100) + "%";
      var faixa = 0;
      var largo = r.w / W * 100 > 9 && r.h / H * 100 > 12;
      if (titulos && largo) {
        var t = el(opts.aoClicarGrupo ? "button" : "div", "tmap-titulo", G.nome);
        if (opts.aoClicarGrupo) { t.type = "button"; t.addEventListener("click", function () { opts.aoClicarGrupo(G); }); }
        bloco.appendChild(t); faixa = 20;
      }
      var area = el("div", "tmap-area"); area.style.top = (faixa || 3) + "px";
      bloco.appendChild(area);
      var its = G.itens.filter(function (it) { return it.valor > 0; });
      layout(its, 0, 0, r.w, r.h).forEach(function (c) {
        var it = its[c.i];
        var b = el("button", "tmap-celula");
        b.type = "button";
        b.style.left = (c.x / r.w * 100) + "%"; b.style.top = (c.y / r.h * 100) + "%";
        b.style.width = (c.w / r.w * 100) + "%"; b.style.height = (c.h / r.h * 100) + "%";
        b.style.background = cor(it.variacao, escala);
        var areaRel = (c.w / W) * (c.h / H);
        b.title = it.nome + (it.detalhe ? " · " + it.detalhe : "") + " · " + pc(it.variacao);
        if (areaRel > 0.0035) {
          b.appendChild(el("b", null, it.nome));
          var s = el("span", null, (areaRel > 0.012 && it.detalhe ? it.detalhe + " " : "") + pc(it.variacao));
          b.appendChild(s);
        } else if (areaRel > 0.0012) {
          b.appendChild(el("b", "tmap-mini", it.nome));
        }
        if (it.aoClicar) b.addEventListener("click", it.aoClicar); else b.tabIndex = -1;
        area.appendChild(b);
      });
      caixa.appendChild(bloco);
    });
  }

  window.AcademyTreemap = { render: render, _squarify: squarify, _layout: layout };
})();
