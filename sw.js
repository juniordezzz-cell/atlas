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
   Chamadas de API (CoinGecko, GeckoTerminal, câmbio) passam direto.
   Preço guardado é preço errado — e o AtlasHttp já tem o próprio cache
   com TTL, que sabe o que está velho. Duas camadas de cache
   discordando sobre a cotação é como um sistema financeiro mente sem
   querer.

   Fontes e Chart.js NÃO são mais exceção: eles passaram a ser
   servidos pelo próprio ATLAS (assets/fonts, assets/vendor), então
   caem na regra normal e entram no cache offline como qualquer
   arquivo nosso.
   ============================================================ */

/* Sobe a cada mudança que precise chegar a quem já abriu o ATLAS: a
   ativação apaga todo cache de versão diferente (ver o "activate"
   abaixo). v4 = terceira auditoria, fase 1 — o status da faixa deixou
   de ser um campo gravado, e as telas passaram a carregar arquivos
   novos (core/atlas-precos.js). Sem o bump, o dashboard continuaria
   servindo o HTML antigo, sem esses <script>, e o alerta de faixa
   simplesmente não apareceria.

   v5 = fases 2 e 3. Saiu o provedor do DefiLlama, entraram a fonte
   secundária de preço (core/providers/geckoterminal.js) e o registro
   central de ativos (core/atlas-tokens.js), e o RWA mudou de modelo.
   O HTML de cinco telas ganhou <script> novo — sem o bump, elas
   continuariam sendo servidas do cache sem esses arquivos, e o
   sintoma seria "a correção não pegou".

   v6 = fases 4 e 5. Entraram o livro de caixa (wallets/walletCaixa.js)
   e a tela Carteiras & Movimentações, e TODA página que tem carteira
   passou a carregar o livro. Sem o bump, a tela nova abriria sem o
   arquivo que produz o saldo dela.

   v7 = fechamento das fases 4 e 5. Trade, Hold e RWA passaram a
   debitar e creditar o caixa, e o Trade ganhou capital em dólar
   (sizeUSD/pnlUSD). Quem rodasse a versão anterior de um desses
   stores abriria posição sem tirar dinheiro do caixa.

   v29 = a rota principal (index.html) deixou de pular a apresentação
   nas visitas seguintes — o desvio para pages/login.html saiu, e o
   boot volta a rodar sempre. O index.html vive na CASCA ("./"): sem o
   bump, quem já abriu o ATLAS continuaria recebendo do cache o HTML
   antigo, com o redirect, e "a correção não pegaria".

   v30 = o caixa passou a valer a PREÇO DE MERCADO no centro
   (AtlasConsolidation.caixaMercadoDe), então o chip do header, o
   Patrimônio Total do Dashboard e a tela de Carteiras mostram o mesmo
   número. Mexeu em atlas-consolidation.js, walletSelector.js,
   dashboard.js e carteiras.js — o bump garante que a versão nova
   chegue a quem já tinha o ATLAS aberto.

   v31 = o Dashboard ganhou o caixa na curva de Evolução (série
   derivada do extrato) e a Distribuição por Categoria passou a incluir
   o Caixa disponível com a quebra por ativo (nível 2). Mexeu em
   atlas-consolidation.js, data.js, dashboard.js.

   v32 = a bancada de Ferramentas. O menu central (core/ui/atlas-shell.js)
   ganhou o item "Ferramentas", e nasceu a página pages/ferramentas.html
   que lista as tools (a primeira é o Finanças). atlas-shell.js roda em
   TODA página — sem o bump, quem já abriu o ATLAS continuaria recebendo
   do cache a versão sem o novo item de menu, e o botão não apareceria. */
/* v33 = o Academy deixou de ser a biblioteca de teses e virou a central
   de mercado (command center + página dedicada por ativo). O módulo foi
   reescrito (academy/index.html, academy/js/*, academy/css/academy.css) e
   ganhou uma camada de provedores nova (core/providers/*: coinpaprika,
   binance, coinlore, defillama, feargreed, id-map, e a cadeia de fallback
   no registry). Sem o bump, quem já abriu o ATLAS continuaria recebendo do
   cache o Academy antigo. A entidade compartilhada AtlasTheses
   (core/entities/theses.js) foi MANTIDA — Hold/Trade/RWA/DeFi gravam nela. */
/* v34 = o dashboard do Academy virou o Global Command Center (3 colunas
   com globo central em Canvas, abas Mercado/DeFi/RWA/Analytics/Yields e
   metricas de TVL/RWA/yields via DefiLlama). Entrou academy/js/academy-globe.js
   e o DefiLlama ganhou dados de DeFi/RWA. Bump para a versao nova chegar. */
var VERSAO = "atlas-v36";
var CACHE = VERSAO;

/* A casca: o que precisa existir para o ATLAS abrir sem rede. Não é o
   site inteiro — as telas de módulo entram no cache conforme forem
   visitadas, que é o comportamento honesto para quem nunca abriu o
   DeFi e não deveria pagar o download dele. */
var CASCA = [
  "./",
  "pages/dashboard.html",
  "pages/offline.html",
  "manifest.webmanifest",
  "assets/iconeatlas.png",
  /* As fontes entram na casca agora que são NOSSAS. Enquanto vinham do
     Google, o fetch abaixo as deixava passar por serem de outra origem
     — e a promessa de "abre sem internet" valia para o layout mas não
     para a tipografia: as colunas de números perdiam a monoespaçada e
     desalinhavam. */
  "themes/atlas-fonts.css",
  "assets/fonts/inter-latin.woff2",
  "assets/fonts/jetbrains-mono-latin.woff2",
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

  /* Fora da origem: só sobra API agora. Deixa passar — o
     navegador já sabe cachear o que é cacheável, e API cacheada aqui
     seria preço errado servido como certo. */
  if (new URL(url).origin !== self.location.origin || ehApi(url)) return;

  /* ------------------------------------------------------------
     REDE PRIMEIRO DE VERDADE — o detalhe que faltava

     `fetch(req)` cru NÃO garante ida à rede: ele passa pelo cache HTTP
     do navegador antes. Um servidor estático que não manda
     Cache-Control (o `python -m http.server` do desenvolvimento é
     exatamente isso) faz o navegador aplicar cache heurístico, e a
     resposta vem do disco sem nem tocar no servidor.

     Foi um erro MEDIDO durante a auditoria: com o data.js do DeFi já
     corrigido em disco e servido corretamente por HTTP, a página
     continuou executando a versão anterior mesmo depois de recarregar.
     Ou seja: a estratégia documentada aqui como "rede primeiro,
     porque rodar código velho num app que calcula dinheiro é risco
     real" não estava valendo — o cache-first que este arquivo diz
     recusar acontecia uma camada abaixo dele.

     `cache: "no-cache"` não desliga o cache: obriga uma REVALIDAÇÃO
     condicional. Arquivo sem mudança volta como 304, quase sem custo;
     arquivo alterado volta inteiro. O offline continua funcionando —
     revalidação sem rede falha, e o .catch() abaixo serve o cache.
     ------------------------------------------------------------ */
  e.respondWith(
    fetch(req, { cache: "no-cache" }).then(function (res) {
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
          return caches.match("pages/offline.html").then(function (o) {
            return o || Response.error();
          });
        }
        return Response.error();
      });
    })
  );
});
