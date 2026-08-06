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

  var MARK =
    '<svg class="brand__mark" viewBox="0 0 32 32" fill="none">' +
    '<defs><linearGradient id="axm" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#22D3EE"/><stop offset="1" stop-color="#4C9AFF"/></linearGradient></defs>' +
    '<path d="M16 3l11 26h-5.2l-1.9-4.8h-7.8L10.2 29H5L16 3z" stroke="url(#axm)" stroke-width="1.6" ' +
    'stroke-linejoin="round"/><path d="M13.4 19.8h5.2L16 12.6z" fill="url(#axm)"/>' +
    '<circle cx="16" cy="26.4" r="1.4" fill="#22D3EE"/></svg>';

  ATLAS.topbar = {
    mountBrand: function (el) {
      el.innerHTML = MARK + '<span class="brand__word">ATLAS</span>';
    },
    mount: function (el) {
      var wallet = ATLAS.app.currentWallet();
      var isoTag = (wallet && wallet.type === "isolada")
        ? ' <span class="topbar__iso">carteira Local · fora do patrimônio total</span>'
        : '';
      el.innerHTML =
        '<div class="topbar__greeting">' +
          '<span class="eyebrow">ATLAS Trade</span>' +
          '<b>Painel · ' + ATLAS.util.escape(wallet.name) + '</b>' + isoTag +
        '</div>' +
        '<div class="topbar__spacer"></div>' +
        '<div class="status"><span class="status__dot"></span>Sistema ativo</div>' +
        '<div id="wallet-selector"></div>';
      ATLAS.walletSelector.mount(document.getElementById("wallet-selector"));
    }
  };
})(window.ATLAS = window.ATLAS || {});
