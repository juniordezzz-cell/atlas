/* ============================================================
   ATLAS · core/ui/atlas-chart-theme.js
   A ponte de tema para dentro do <canvas>.

   POR QUE ISTO EXISTE
   -------------------
   Todo o sistema de cor do ATLAS vive em variáveis CSS. O canvas não
   enxerga variável CSS: mandar "var(--pos)" para o Chart.js resulta em
   cor inválida — na prática, preto ou nada. Por isso cada módulo acabou
   com a sua própria paleta de gráfico cravada em hexadecimal, e essas
   paletas foram desenhadas só para o tema escuro. No tema claro a grade
   fica branca sobre branco (some), o tick fica cinza-médio e o tooltip
   fica um retângulo preto no meio de uma tela clara.

   Este arquivo é o tradutor: resolve token → cor real, no tema que está
   ativo agora, e oferece a cromagem de gráfico (grade, tick, tooltip)
   já derivada dos tokens do tema.

   COMO USAR
   ---------
     AtlasChartTheme.cor("var(--pos)")   → "#0A6B61" no claro
     AtlasChartTheme.cor("#8B5CF6")      → devolve igual (não é token)
     AtlasChartTheme.grade()             → cor da grade do tema
     AtlasChartTheme.tick()              → cor dos rótulos de eixo
     AtlasChartTheme.tooltip()           → objeto pronto do Chart.js
     AtlasChartTheme.alfa(cor, 0.16)     → mesma cor com transparência

   COMPATIBILIDADE
   ---------------
   Cada wrapper de gráfico deve usá-lo com guarda:

     var T = window.AtlasChartTheme;
     var cor = T ? T.cor(c) : c;

   Assim uma página que ainda não carregou este script continua
   funcionando exatamente como antes.
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasChartTheme) return;

  var raiz = document.documentElement;

  /* Resolver var() custa uma leitura de estilo computado. Como um donut
     pede a mesma cor dez vezes, guardamos — e limpamos quando o tema
     muda, que é a única coisa capaz de invalidar o valor. */
  var cache = {};
  var temaDoCache = null;

  function temaAtual() {
    return (raiz.getAttribute("data-theme") || "dark") + "|" +
           (raiz.getAttribute("data-module") || "atlas");
  }

  function limparSeMudou() {
    var t = temaAtual();
    if (t !== temaDoCache) { cache = {}; temaDoCache = t; }
  }

  /* "var(--pos)" e "var(--pos, #fff)" → o valor computado no <html>.
     Qualquer outra coisa volta intacta: hexadecimal, rgb(), gradiente
     do Chart.js, função — nada disso deve ser tocado. */
  function cor(valor) {
    if (typeof valor !== "string") return valor;
    var m = valor.match(/^\s*var\(\s*(--[\w-]+)\s*(?:,([^)]*))?\)\s*$/);
    if (!m) return valor;
    limparSeMudou();
    if (cache[m[1]] !== undefined) return cache[m[1]];
    var v = getComputedStyle(raiz).getPropertyValue(m[1]).trim();
    if (!v && m[2]) v = m[2].trim();          // usa o fallback do var()
    cache[m[1]] = v || valor;
    return cache[m[1]];
  }

  /* Aplica opacidade a uma cor já resolvida. Substitui o velho truque
     de concatenar "22" no fim do hexadecimal, que quebra em rgb(),
     em color() e em qualquer hexadecimal de 4 ou 8 dígitos. */
  function alfa(valor, a) {
    var c = cor(valor);
    if (typeof c !== "string") return c;
    c = c.trim();
    var h = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (h) {
      var s = h[1];
      if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
      return "rgba(" + parseInt(s.substr(0, 2), 16) + "," +
                       parseInt(s.substr(2, 2), 16) + "," +
                       parseInt(s.substr(4, 2), 16) + "," + a + ")";
    }
    var r = c.match(/^rgba?\(([^)]+)\)$/i);
    if (r) {
      var p = r[1].split(/[,\/\s]+/).filter(Boolean);
      return "rgba(" + p[0] + "," + p[1] + "," + p[2] + "," + a + ")";
    }
    /* color(srgb …) e outros espaços: color-mix resolve sem eu ter de
       saber o formato. */
    return "color-mix(in srgb, " + c + " " + Math.round(a * 100) + "%, transparent)";
  }

  function claro() { return raiz.getAttribute("data-theme") === "light"; }

  /* ----------------------------------------------------------------
     COR DE SÉRIE — a linha, a barra, a fatia.

     As paletas de gráfico dos módulos foram escolhidas para brilhar
     sobre fundo escuro: menta #34D399, azul #5B9BFF, lima #A3E635. Em
     cima de um cartão branco elas dão 1,9 a 2,6 de contraste — a linha
     existe, mas quase não se vê. E gráfico é dado, não enfeite: a
     WCAG pede 3,0 para elemento gráfico que carrega informação.

     Em vez de reescrever a paleta de cinco módulos, escurecemos a cor
     no tema claro até ela passar de 3,0 contra o cartão — no máximo
     seis passos, preservando o matiz. No tema escuro é passagem
     direta: nada muda no que já funciona.
     ---------------------------------------------------------------- */
  function canal(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }

  function rgbDe(c) {
    if (typeof c !== "string") return null;
    c = c.trim();
    var h = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (h) {
      var s = h[1];
      if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
      return [parseInt(s.substr(0, 2), 16), parseInt(s.substr(2, 2), 16), parseInt(s.substr(4, 2), 16)];
    }
    var r = c.match(/^rgba?\(([^)]+)\)$/i);
    if (r) {
      var p = r[1].split(/[,\/\s]+/).filter(Boolean).map(Number);
      if (p.length >= 3 && p.every(function (n) { return !isNaN(n); })) return p.slice(0, 3);
    }
    return null;
  }

  function lumin(p) { return 0.2126 * canal(p[0]) + 0.7152 * canal(p[1]) + 0.0722 * canal(p[2]); }
  function razao(a, b) {
    var x = lumin(a), y = lumin(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function hexDe(p) {
    return "#" + p.map(function (v) {
      var s = Math.round(Math.max(0, Math.min(255, v))).toString(16);
      return s.length < 2 ? "0" + s : s;
    }).join("");
  }

  function serie(valor) {
    var c = cor(valor);
    if (!claro()) return c;
    var p = rgbDe(c);
    var fundo = rgbDe(vao()) || [255, 255, 255];
    if (!p) return c;                     // gradiente, função, formato exótico
    for (var i = 0; i < 6 && razao(p, fundo) < 3; i++) {
      p = [p[0] * 0.82, p[1] * 0.82, p[2] * 0.82];
    }
    return hexDe(p);
  }

  /* A grade e os ticks são cromagem, não dado: derivam do texto do tema
     para acompanharem qualquer mudança de paleta sem edição aqui. */
  function grade() { return alfa("var(--atlas-text-mut)", claro() ? 0.16 : 0.10); }
  function tick()  { return cor("var(--atlas-text-mut)"); }

  function tooltip() {
    return {
      backgroundColor: claro() ? alfa("var(--atlas-bg-raise)", 0.98)
                               : alfa("var(--atlas-surface-solid)", 0.97),
      borderColor: cor("var(--atlas-border-hi)"),
      borderWidth: 1,
      titleColor: cor("var(--atlas-text-hi)"),
      bodyColor: cor("var(--atlas-text)"),
      padding: 11, cornerRadius: 8, displayColors: false
    };
  }

  /* Cor do vão entre fatias de um donut: tem de ser a cor do CARTÃO,
     não um preto fixo — senão o donut ganha aro preto no tema claro. */
  function vao() { return cor("var(--atlas-surface-solid)"); }

  window.AtlasChartTheme = {
    cor: cor, serie: serie, alfa: alfa, grade: grade, tick: tick,
    tooltip: tooltip, vao: vao, claro: claro
  };
})();
