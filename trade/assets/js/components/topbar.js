/* ============================================================
   ATLAS — Topbar + marca
   ============================================================ */
(function (ATLAS) {
  "use strict";

  function greeting() {
    var h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }

  /* Marca construída via DOM (sem innerHTML): ícone maior + "ATLAS" e a
     tagline "o seu mapa de investimentos" empilhados, como no shell da
     raiz. A célula .brand-cell tem altura --topbar-h; o texto cabe. */
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  ATLAS.topbar = {
    mountBrand: function (host) {
      host.textContent = "";
      var img = el("img", "brand__mark");
      img.src = "../assets/iconeatlas.png";
      img.alt = "ATLAS";
      var text = el("span", "brand__text");
      text.appendChild(el("span", "brand__word", "ATLAS"));
      text.appendChild(el("span", "brand__tag", "o seu mapa de investimentos"));
      host.appendChild(img);
      host.appendChild(text);
    },
    mount: function (el) {
      var wallet = ATLAS.app.currentWallet();
      var isoTag = (wallet && wallet.type === "isolada")
        ? ' <span class="topbar__iso">carteira Local · fora do patrimônio total</span>'
        : '';
      el.innerHTML =
        '<div class="topbar__greeting">' +
          '<span class="eyebrow">ATLAS Trade</span>' +
          /* Era um <b>. A tela do Trade inteira não tinha NENHUM <h1>:
             quem navega por títulos com leitor de tela chegava numa
             página sem âncora de onde estava. <b> é peso visual, <h1>
             é estrutura — o CSS continua valendo pela classe do pai. */
          '<h1>Painel · ' + ATLAS.util.escape(wallet.name) + '</h1>' + isoTag +
        '</div>' +
        '<div class="topbar__spacer"></div>' +
        '<div class="status"><span class="status__dot"></span>Sistema ativo</div>' +
        '<div id="wallet-selector"></div>';
      ATLAS.walletSelector.mount(document.getElementById("wallet-selector"));
    }
  };
})(window.ATLAS = window.ATLAS || {});
