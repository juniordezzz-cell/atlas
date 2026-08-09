/* ============================================================
   ATLAS · sw.js — service worker

   POR QUE ISTO EXISTE
   -------------------
   Os dados do ATLAS já vivem no navegador: nada é buscado num servidor
   para o painel funcionar. Mas os ARQUIVOS do site ainda vinham da
   rede — então abrir o ATLAS sem conexão dava página em branco. Um
   sistema de patrimônio que só abre com internet é um sistema que não
   está disponível justamente no avião, no elevador, no interior.

   Este arquivo resolve isso e mais nada. Não sincroniza, não envia
   notificação push, não manda dado para lugar nenhum.

   A ESTRATÉGIA: REDE PRIMEIRO, CACHE COMO REDE DE SEGURANÇA
   ---------------------------------------------------------
   A tentação é servir do cache primeiro (mais rápido). Seria a decisão
   errada aqui. Um cache-first faz o usuário rodar a versão ANTIGA do
   sistema até o cache expirar — e num app que calcula dinheiro, correr
   código velho depois de uma correção é risco real. Como tudo é local
   e o servidor está a milissegundos, a rede primeiro custa quase nada
   e garante que a versão correta é sempre a que roda.

   O cache entra quando a rede falha. É exatamente o caso do offline.

   O QUE NÃO É CACHEADO
   --------------------
   Chamadas de API (CoinGecko, DefiLlama, câmbio) passam direto. Preço
   guardado é preço errado — e o AtlasHttp já tem o próprio cache com
   TTL, que sabe o que está velho. Duas camadas de cache discordando
   sobre a cotação é como um sistema financeiro mente sem querer.
   ============================================================ */

var VERSAO = "atlas-v2";
var CACHE = VERSAO;

/* A casca: o que precisa existir para o ATLAS abrir sem rede. Não é o
   site inteiro — as telas de módulo entram no cache conforme forem
   visitadas, que é o comportamento honesto para quem nunca abriu o
   DeFi e não deveria pagar o download dele. */
var CASCA = [
  "./",
  "dashboard.html",
  "offline.html",
  "manifest.webmanifest",
  "assets/favicon.svg",
  "themes/atlas-theme.css",
  "themes/atlas-effects.css",
  "core/atlas-storage.js",
  "core/settings.js",
  "core/i18n.js",
  "core/currency.js",
  "core/atlas-boot.js"
];

self.addEventListener("install", function (e) {
  /* addAll falha inteiro se UM arquivo falhar, e aí o service worker
     nunca instala. Cada um por si: melhor uma casca parcial do que
     nenhuma. */
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(CASCA.map(function (u) {
        return c.add(u).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(nomes.map(function (n) {
        /* Versão anterior sai na hora. Deixar cache velho conviver com
           o novo é como um arquivo antigo volta a ser servido meses
           depois, sem ninguém entender por quê. */
        return n === CACHE ? null : caches.delete(n);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function ehApi(url) {
  return /coingecko|defillama|exchangerate|frankfurter|api\./i.test(url);
}

self.addEventListener("fetch", function (e) {
  var req = e.request;

  /* Só GET. POST não se repete de cache sem mudar o significado. */
  if (req.method !== "GET") return;

  var url = req.url;

  /* Fora da origem: fonte, CDN do Chart.js, API. Deixa passar — o
     navegador já sabe cachear o que é cacheável, e API cacheada aqui
     seria preço errado servido como certo. */
  if (new URL(url).origin !== self.location.origin || ehApi(url)) return;

  e.respondWith(
    fetch(req).then(function (res) {
      /* Guarda uma cópia do que veio bem. Resposta de erro não entra:
         cachear um 404 é transformar um problema momentâneo em
         permanente. */
      if (res && res.ok) {
        var copia = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copia); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        /* Navegação sem rede e sem cache da página exata: entrega
           offline.html.

           A versão anterior entregava o dashboard.html aqui, e estava
           errada. Servido sob /trade/index.html, os caminhos relativos
           dele (css/…, js/…) passam a apontar para dentro de /trade/ —
           a página chegava sem estilo e sem script. URL de um módulo,
           conteúdo de outro, aparência de nada.

           offline.html não tem dependência nenhuma: CSS inline e um
           único link absoluto. Não há como quebrar. */
        if (req.mode === "navigate") {
          return caches.match("offline.html").then(function (o) {
            return o || Response.error();
          });
        }
        return Response.error();
      });
    })
  );
});
