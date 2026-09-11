// Service worker do módulo Finanças (ATLAS). Escopo restrito a financas/.
// Cache-first para o app shell; navegação sem cache/rede cai em offline.html.
//
// IMPORTANTE: como é cache-first, TODA alteração em HTML/CSS/JS da
// ferramenta só chega a quem já abriu depois de subir esta versão — o
// "activate" apaga os caches de nome diferente e força o refetch.
//
// v2 = tela de Configurações ganhou a seção "Aplicativo (APK)" com o
// botão de baixar, e o css/financas.css ganhou .fx-badge / .fx-note--muted
// / .fx-btn--disabled. Sem o bump, o cache-first continuaria servindo o
// CSS e o HTML antigos, e a seção/estilos novos não apareceriam.
//
// v3 = o app virou AUTÔNOMO: saiu a sidebar/menu stand-in do ATLAS do
// shell.js (era o que travava aberto no celular) e o .fx-app deixou de
// reservar a coluna dela. Sem o bump, o cache-first continuaria servindo
// o shell.js e o CSS antigos, e o menu quebrado voltaria.
//
// v4 = o app ganhou nome ("ATLASfinances") e uma tela de boot/boas-vindas
// na abertura (css/boot.css + js/boot.js, injetados no index.html). Entram
// no precache; sem o bump o index antigo (sem a splash) seguiria em cache.
//
// v5 = o boot passou a exibir a arte de abertura (assets/boot-hero.png)
// no lugar do ícone "A". A imagem entra no precache para a splash abrir
// offline; sem o bump o index/boot antigos seguiriam em cache.
const CACHE = "financas-v5";

const ASSETS = [
  "index.html",
  "planejar.html",
  "entradas.html",
  "despesas.html",
  "investimentos.html",
  "relatorios.html",
  "analises.html",
  "configuracoes.html",
  "offline.html",
  "manifest.webmanifest",
  "css/atlas-tokens.css",
  "css/boot.css",
  "css/financas.css",
  "js/boot.js",
  "js/ui/shell.js",
  "js/ui/charts.js",
  "js/app-bridge.js",
  "js/core/format.js",
  "js/core/store.js",
  "js/core/finance.js",
  "js/core/recurrence.js",
  "js/pages/visao-geral.js",
  "js/pages/planejar.js",
  "js/pages/entradas.js",
  "js/pages/despesas.js",
  "js/pages/investimentos.js",
  "js/pages/relatorios.js",
  "js/pages/analises.js",
  "js/pages/configuracoes.js",
  "js/pwa.js",
  "assets/boot-hero.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Ignora requisições não-GET e cross-origin (ex.: Google Fonts) — deixa ir direto pra rede.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          if (req.mode === "navigate") {
            return caches.match("offline.html");
          }
          return undefined;
        });
    })
  );
});
