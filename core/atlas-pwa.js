/* ============================================================
   ATLAS · core/atlas-pwa.js
   Registrar o service worker — e saber quando NÃO registrar.

   O trabalho pesado está em sw.js. Aqui só se decide se ele entra,
   e essa decisão tem duas regras que importam:

   1. file:// NÃO REGISTRA
      O ATLAS abre por file:// (o README diz isso). Service worker
      exige origem segura; tentar registrar ali só produz um erro no
      console em toda carga, sem nada em troca.

   2. localhost REGISTRA
      É origem segura por definição, e é onde o sistema é servido hoje.

   Sobre a atualização: sw.js usa skipWaiting e clients.claim, então a
   versão nova assume assim que baixa. Não há caixa "atualização
   disponível" de propósito — o service worker aqui serve para abrir
   offline, não para gerenciar releases, e um aviso a mais na tela
   custaria mais atenção do que entrega.
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasPWA) return;

  function podeRegistrar() {
    if (!("serviceWorker" in navigator)) return false;
    /* isSecureContext cobre https e localhost, e é falso em file://
       — que é exatamente a distinção que interessa. */
    return !!window.isSecureContext && location.protocol !== "file:";
  }

  /* A raiz muda conforme a profundidade da página: um módulo vive um
     nível abaixo. Registrar com escopo errado faz o service worker
     controlar só a pasta do módulo, e o Dashboard ficaria de fora. */
  function raiz() {
    if (window.AtlasShell && AtlasShell.raiz) return AtlasShell.raiz();
    return /\/(hold|trade|defi|RWA|academy)\//i.test(location.pathname) ? "../" : "";
  }

  function registrar() {
    if (!podeRegistrar()) return null;
    var base = raiz();
    return navigator.serviceWorker.register(base + "sw.js", { scope: base || "./" })
      .catch(function (e) {
        /* Falhar aqui não pode derrubar nada: sem service worker o
           ATLAS funciona exatamente como sempre funcionou, só não abre
           sem rede. */
        if (window.console && console.warn) console.warn("[ATLAS] service worker não registrado:", e && e.message);
        return null;
      });
  }

  window.AtlasPWA = {
    registrar: registrar,
    disponivel: podeRegistrar,
    /* Usado por Configurações para desinstalar e limpar o cache de
       arquivos. Não toca em NENHUM dado do usuário — o localStorage
       fica intacto. */
    limpar: function () {
      if (!("serviceWorker" in navigator)) return Promise.resolve(false);
      return navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (r) { return r.unregister(); }));
      }).then(function () {
        return (window.caches && caches.keys) ? caches.keys().then(function (ns) {
          return Promise.all(ns.map(function (n) { return caches.delete(n); }));
        }) : null;
      }).then(function () { return true; });
    }
  };

  /* Depois do load: registrar durante o carregamento disputa banda com
     o que a tela precisa para pintar. */
  if (document.readyState === "complete") registrar();
  else window.addEventListener("load", registrar);
})();
