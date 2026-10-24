// Service worker do módulo Finanças (ATLAS). Escopo restrito a financas/.
//
// 23/10/2026 — REDE PRIMEIRO. Até a v9 era cache-primeiro: toda mudança
// em HTML/CSS/JS só chegava depois de trocar o nome do cache, e quem já
// tinha aberto o app seguia vendo a versão velha ("não pegou"). Agora a
// rede manda; o cache só serve quando não há conexão, e a navegação sem
// rede e sem cópia cai em offline.html.

const CACHE = "financas-v13";

const ASSETS = [
  "index.html",
  "oraculo.html",
  "lancamentos.html",
  "investimentos.html",
  "planejar.html",
  "configuracoes.html",
  "offline.html",
  "manifest.webmanifest",
  "css/atlas-tokens.css",
  "css/boot.css",
  "css/financas.css",
  "css/painel.css",
  "js/boot.js",
  "js/pwa.js",
  "js/app-bridge.js",
  "js/ui/shell.js",
  "js/ui/fundo-fluxo.js",
  "js/ui/comum.js",
  "js/core/dinheiro.js",
  "js/core/datas.js",
  "js/core/livro.js",
  "js/core/store.js",
  "js/core/categorias.js",
  "js/core/interpretador.js",
  "js/core/conversa.js",
  "js/core/extrato.js",
  "js/core/sincronia.js",
  "js/ui/nuvem.js",
  "js/telas/painel.js",
  "js/telas/oraculo.js",
  "js/telas/lancamentos.js",
  "js/telas/investimentos.js",
  "js/telas/planejar.js",
  "js/pages/configuracoes.js",
  "assets/boot-hero.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .catch(() => {})
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

  // Fora do escopo do app (ex.: /core/ e /assets/ do ATLAS) — vai direto pra rede.
  if (!req.url.startsWith(self.registration.scope)) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((cached) => {
          if (cached) return cached;
          if (req.mode === "navigate") return caches.match("offline.html");
          return Response.error();
        })
      )
  );
});
