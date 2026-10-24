// Registra o service worker do módulo Finanças (escopo restrito a financas/).
//
// 24/10/2026: quem tinha aberto o app antes seguia preso no service worker
// antigo (cache-primeiro) e não via a versão nova. Agora, ao abrir e ao
// voltar para o app, ele procura atualização; quando o service worker novo
// assume, a página recarrega uma vez sozinha, já com os arquivos novos.
if ("serviceWorker" in navigator) {
  const tinhaControle = !!navigator.serviceWorker.controller;
  let recarregou = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!tinhaControle || recarregou) return;
    recarregou = true;
    location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { scope: "./", updateViaCache: "none" })
      .then((reg) => {
        reg.update().catch(() => {});
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update().catch(() => {});
        });
      })
      .catch(() => {});
  });
}
