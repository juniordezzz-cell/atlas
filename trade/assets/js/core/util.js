/* ============================================================
   ATLAS — Utilidades (formatação, ícones, gráficos SVG)
   ============================================================ */
(function (ATLAS) {
  "use strict";

  var util = {
    // ---- Formatação -------------------------------------
    /* Dinheiro — delegado ao AtlasCurrency (core/currency.js).
       Antes o "USD" era o padrão cravado aqui e o argumento `currency`
       nunca era passado por nenhum chamador, então o Trade ficava preso
       ao dólar mesmo com a moeda global em BRL. O valor recebido está
       SEMPRE em USD (regra de armazenamento do ATLAS); a conversão é só
       camada de exibição. O argumento continua aceito para não quebrar
       chamada antiga. */
    money: function (n, currency) {
      if (window.AtlasCurrency) {
        return window.AtlasCurrency.format(n, { decimals: 0, currency: currency || undefined });
      }
      try {
        return new Intl.NumberFormat("pt-BR", {
          style: "currency", currency: currency || "USD", maximumFractionDigits: 0
        }).format(n);
      } catch (e) { return "$" + Math.round(n).toLocaleString("pt-BR"); }
    },
    /* Vírgula decimal: toFixed usa ponto e destoava do resto do ATLAS. */
    pct: function (n) {
      return (n >= 0 ? "+" : "") +
        (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
    },
    signClass: function (n) { return n >= 0 ? "up" : "down"; },
    // horas -> "Xh" ou "Xd Yh"
    dur: function (h) {
      if (h < 24) return h + "h";
      var d = Math.floor(h / 24), r = h % 24;
      return d + "d" + (r ? " " + r + "h" : "");
    },
    // timestamp -> "12/03, 14:20"
    dateTime: function (ts) {
      try {
        return new Date(ts).toLocaleString("pt-BR", {
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
        });
      } catch (e) { return ""; }
    },
    // tempo relativo curto: "agora", "há 3h", "há 2d"
    ago: function (ts) {
      var h = Math.max(0, Math.round((Date.now() - ts) / 3600000));
      if (h < 1) return "agora há pouco";
      return "há " + ATLAS.util.dur(h);
    },
    escape: function (s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    },

    // ---- Ícones (stroke currentColor) -------------------
    icon: function (name, tamanhoOuClasse) {
      /* o valor cru é repassado à biblioteca, que decide se é tamanho
         (número) ou classe (string); aqui só o número serve de medida */
      var size = (typeof tamanhoOuClasse === "number" ? tamanhoOuClasse : 0) || 20;
      var p = {
        dashboard: '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
        estudos:   '<path d="M4 4h11a3 3 0 013 3v13a2.5 2.5 0 00-2.5-2.5H4z"/><path d="M4 4v13.5A2.5 2.5 0 016.5 20H18"/>',
        rd:        '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
        trades:    '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
        analytics: '<path d="M3 3v18h18"/><path d="M7 15l3-4 3 2 5-7"/>',
        config:    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/>',
        bell:      '<path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/>',
        alert:     '<path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.4 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
        clock:     '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        send:      '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
        close:     '<path d="M18 6L6 18M6 6l12 12"/>',
        chevron:   '<path d="M6 9l6 6 6-6"/>',
        arrowUp:   '<path d="M12 19V5M5 12l7-7 7 7"/>',
        arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
        flask:     '<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/>',
        spark:     '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',
        plus:      '<path d="M12 5v14M5 12h14"/>',
        back:      '<path d="M19 12H5M12 19l-7-7 7-7"/>',
        archive:   '<path d="M3 4h18v4H3zM5 8v12h14V8M9 12h6"/>',
        check:     '<path d="M20 6L9 17l-5-5"/>',
        play:      '<path d="M6 4l14 8-14 8z"/>',
        trash:     '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
        dot:       '<circle cx="12" cy="12" r="4"/>',
        edit:      '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>'
      };
      /* Biblioteca única primeiro (core/ui/atlas-icons.js); a tabela
         acima fica como reserva para o que só o Trade tem.
         A assinatura daqui é icon(nome, TAMANHO), mas a do Hold é
         icon(nome, CLASSE) — uma string no segundo argumento passa a ser
         entendida como classe, em vez de virar width="ico". */
      if (window.AtlasIcons) {
        /* O Trade SEMPRE emitiu width/height (20 por padrão) e o CSS
           dele conta com isso. Por isso a medida vai sempre, mesmo sem
           segundo argumento — sem ela, um ícone sem regra de tamanho no
           CSS estica pela caixa toda. */
        var opts = { size: size };
        if (typeof tamanhoOuClasse === "string") opts["class"] = tamanhoOuClasse;
        var s = window.AtlasIcons.get(name, opts);
        if (s) return s;
      }
      var body = p[name] || "";
      return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size +
        '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        body + '</svg>';
    },

    // ---- Gráfico de área (SVG puro, sem libs) -----------
    areaChart: function (values, opts) {
      opts = opts || {};
      var w = opts.w || 640, h = opts.h || 150, pad = opts.pad || 4;
      var up = opts.up !== false;
      var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
      var span = (max - min) || 1;
      var stepX = (w - pad * 2) / (values.length - 1);
      var pts = values.map(function (v, i) {
        var x = pad + i * stepX;
        var y = pad + (h - pad * 2) * (1 - (v - min) / span);
        return [x, y];
      });
      var line = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
      var area = line + " L" + pts[pts.length - 1][0].toFixed(1) + " " + h + " L" + pts[0][0].toFixed(1) + " " + h + " Z";
      var stroke = up ? "var(--profit)" : "var(--loss)";
      var gid = "g" + Math.random().toString(36).slice(2, 8);
      /* Eram rgba cravados do verde e do vermelho do tema escuro. Como
         o traço já usa var(--profit)/var(--loss), o preenchimento passa a
         usar a mesma variável com stop-opacity — assim o degradê segue o
         tema em vez de ficar preso ao valor antigo. */
      var fillTop = stroke;
      var last = pts[pts.length - 1];
      return '<svg class="banca__chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
        '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="' + fillTop + '" stop-opacity="0.28"/><stop offset="1" stop-color="' + fillTop + '" stop-opacity="0"/>' +
        '</linearGradient></defs>' +
        '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
        '<path d="' + line + '" fill="none" stroke="' + stroke + '" stroke-width="2.4" ' +
        'style="filter:drop-shadow(0 3px 10px color-mix(in srgb, ' + stroke + ' 50%, transparent))"/>' +
        '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3.5" fill="' + stroke + '"/>' +
        '</svg>';
    },

    sparkline: function (values, up) {
      var w = 120, h = 34;
      /* Com UM ponto, stepX virava 120/0 = Infinity e x = 0*Infinity =
         NaN — o SVG saía com d="MNaN 32.5" e o console enchia de
         "Expected number". Acontecia sempre que uma série nascia com um
         valor só, que é o caso comum num sistema de seeds vazios.
         Com menos de dois pontos não há linha a traçar. */
      if (!values || values.length < 2) return "";
      var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
      var span = (max - min) || 1, stepX = w / (values.length - 1);
      var line = values.map(function (v, i) {
        var x = i * stepX, y = h - (h - 3) * ((v - min) / span) - 1.5;
        return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
      }).join(" ");
      var stroke = up ? "var(--profit)" : "var(--loss)";
      return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="none">' +
        '<path d="' + line + '" fill="none" stroke="' + stroke + '" stroke-width="1.8" opacity="0.9"/></svg>';
    }
  };

  /* ============================================================
     AVISOS E CONFIRMAÇÕES
     ------------------------------------------------------------
     O Trade era o único módulo SEM toast: todo aviso saía como
     window.alert, e excluir trade, tese ou registro de decisão passava
     por window.confirm. Agora usa o kit compartilhado
     (core/ui/atlas-ui.js), o mesmo do resto do sistema.

     Os três invólucros mantêm o caminho nativo como rede de segurança:
     sem o kit carregado, a função continua — só perde o acabamento.
     ============================================================ */

  /* Confirmação destrutiva. O callback só roda no "sim" — mesma
     semântica do `if (confirm(...)) { ... }` que havia antes. */
  util.perguntar = function (opts, aoConfirmar) {
    if (window.AtlasUI) {
      window.AtlasUI.confirm(opts).then(function (ok) { if (ok) aoConfirmar(); });
      return;
    }
    if (window.confirm(opts.title + "\n\n" + (opts.message || ""))) aoConfirmar();
  };

  util.toast = function (msg, kind) {
    if (window.AtlasUI) { window.AtlasUI.toast(msg, { kind: kind || "ok" }); return; }
    if (window.console) console.log("[ATLAS Trade]", msg);
  };

  /* Validação de campo. Devolve SEMPRE false, para o chamador poder
     escrever `if (!x) return util.invalido(campo, "...");`.

     Isto substitui window.alert("Informe o ativo"): o alert travava a
     tela, não dizia QUAL campo estava errado e sumia sem deixar rastro.
     Agora o próprio campo fica marcado, com a mensagem embaixo, e a
     marca some quando a pessoa começa a corrigir. */
  util.invalido = function (campo, msg) {
    if (window.AtlasUI && campo) { window.AtlasUI.invalid(campo, msg); return false; }
    if (campo && campo.focus) { try { campo.focus(); } catch (e) {} }
    util.toast(msg, "warn");
    return false;
  };

  ATLAS.util = util;
})(window.ATLAS = window.ATLAS || {});
