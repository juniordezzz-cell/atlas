/* ============================================================
   ATLAS · /wallets/walletTypes.js
   ------------------------------------------------------------
   TIPOS, ÍCONES E RÓTULOS DE CARTEIRA.

   Tudo que descreve a APARÊNCIA e o VOCABULÁRIO de uma carteira
   (globo x cofre, iniciais x emoji, "Global" x "Local") mora aqui
   — separado da lógica de estado (walletStore) e da API pública
   (walletManager).

   O tipo interno continua "global" | "isolada" (para não quebrar
   Trade/RWA, que já gravam essa string). Na interface, "isolada"
   é mostrada como "Local".

   Exposto em: window.AtlasWalletTypes  (uso interno do pacote).
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasWalletTypes) return;

  function capitalize(s) {
    s = String(s || "");
    var map = { hold: "Hold", trade: "Trade", defi: "DeFi", rwa: "RWA" };
    return map[s] || (s.charAt(0).toUpperCase() + s.slice(1));
  }

  var T = {
    /* iniciais para o "avatar" da carteira */
    initials: function (name) {
      var p = (name || "").trim().split(/\s+/);
      if (!p[0]) return "?";
      return (p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2)).toUpperCase();
    },

    /* O que aparece no selo redondo: emoji se houver, senão iniciais. */
    badge: function (w) {
      if (!w) return "";
      if (w.emoji) return w.emoji;
      return T.initials(w.name);
    },

    /* Ícone que identifica o TIPO da carteira.
       global  → globo: soma no total do ATLAS, atravessa todos os módulos.
       isolada → cofre: vive dentro de um módulo só, fora do total. */
    typeIcon: function (type, size) {
      var s = size || 14;
      var open = '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s +
                 '" fill="none" stroke="currentColor" stroke-width="1.7" ' +
                 'stroke-linecap="round" stroke-linejoin="round">';
      if (type === "isolada") {
        return open +
          '<rect x="3" y="4" width="18" height="16" rx="2.5"/>' +
          '<circle cx="12" cy="12" r="3.6"/>' +
          '<path d="M12 8.4V6.6M12 17.4v-1.8M15.6 12h1.8M6.6 12h1.8"/>' +
          '</svg>';
      }
      return open +
        '<circle cx="12" cy="12" r="9"/>' +
        '<path d="M3 12h18"/>' +
        '<path d="M12 3c2.6 2.7 4 5.7 4 9s-1.4 6.3-4 9c-2.6-2.7-4-5.7-4-9s1.4-6.3 4-9z"/>' +
        '</svg>';
    },

    /* Paleta de ícones, em grupos. Símbolos de ativo são caracteres
       de texto (não logotipos), e os bichos das carteiras conhecidas
       são reconhecíveis sem copiar marca registrada. */
    iconGroups: function () {
      return [
        { label: "Ativos", items: [
          "\u20BF", "\u039E", "\u25CE", "\u20AE", "$",
          "\uD83E\uDE99", "\uD83D\uDC8E", "\uD83D\uDCCA"
        ]},
        { label: "Carteiras", items: [
          "\uD83E\uDD8A", "\uD83D\uDC7B", "\uD83D\uDC30", "\uD83D\uDD10",
          "\uD83C\uDFE6", "\uD83E\uDDCA", "\uD83D\uDEE1\uFE0F", "\uD83D\uDDDD\uFE0F"
        ]},
        { label: "Estratégia", items: [
          "\uD83C\uDF10", "\uD83C\uDF31", "\uD83D\uDE80", "\uD83D\uDC33",
          "\uD83D\uDD25", "\u26A1", "\uD83C\uDFAF", "\uD83E\uDDED",
          "\u2699\uFE0F", "\uD83D\uDCB0", "\uD83C\uDFD4\uFE0F", "\uD83C\uDF0A"
        ]}
      ];
    },

    /* lista achatada — mantida para quem já chamava emojiSet() */
    emojiSet: function () {
      var out = [];
      T.iconGroups().forEach(function (g) { out = out.concat(g.items); });
      return out;
    },

    /* rótulo de UI: interno "global"/"isolada", tela mostra "Local". */
    typeLabel: function (typeOrWallet) {
      var t = typeof typeOrWallet === "string" ? typeOrWallet : (typeOrWallet && typeOrWallet.type);
      return t === "isolada" ? "Local" : "Global";
    },

    typeTag: function (wallet, moduleName) {
      if (!wallet) return "Global";
      if (wallet.type === "isolada") {
        var mod = moduleName || wallet.module;
        return mod ? "Local · só no " + capitalize(mod) : "Local";
      }
      return "Global";
    },

    capitalize: capitalize
  };

  global.AtlasWalletTypes = T;
})(typeof window !== "undefined" ? window : this);
