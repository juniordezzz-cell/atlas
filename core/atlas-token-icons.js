/* ============================================================
   ATLAS · core/atlas-token-icons.js — a imagem de cada token

   POR QUE ISTO EXISTE
   -------------------
   Hold, DeFi, RWA, o Dashboard e a tela de Carteiras desenhavam cada
   token como uma bolinha colorida com as iniciais ("SPC", "HYP",
   "PLT"). Só a tela de Carteiras mostrava imagem — e só quando o
   depósito tinha sido escolhido no autocompletar. Regra do dono do
   produto (24/09/2026): onde aparece um ativo, aparece o ícone dele.

   COMO FUNCIONA
   -------------
   Quem desenha a bolinha continua desenhando a bolinha, e só a MARCA
   com o símbolo:

       <span class="coin" data-atlas-token="SOL">SOL</span>

   Este arquivo observa a página e, para cada marca, põe a imagem do
   token por cima das iniciais. Sem imagem (token desconhecido, sem
   rede, imagem quebrada), as iniciais continuam lá — nunca fica um
   buraco. Nenhum módulo precisa saber de onde vem a imagem.

   DE ONDE VEM A IMAGEM, nesta ordem
   ---------------------------------
     1. já conhecida no próprio ATLAS: a imagem guardada no extrato
        quando o token foi escolhido num depósito ou troca;
     2. o id conferido em core/atlas-tokens.js → CoinGecko /coins/
        markets, em LOTE (uma chamada para vários tokens);
     3. busca pelo símbolo na CoinGecko: só aceita resultado com o
        símbolo EXATO, e entre eles o de melhor ranking.
   O resultado fica guardado neste navegador (30 dias; "não achei"
   por 3 dias, para tentar de novo depois sem martelar a API).

   Exposto em: window.AtlasTokenIcons
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasTokenIcons) return;
  var doc = global.document;
  if (!doc) return;

  var KEY = "atlas.token.icons.v1";
  var TTL_OK = 30 * 24 * 3600 * 1000;
  var TTL_NADA = 3 * 24 * 3600 * 1000;
  var CG = "https://api.coingecko.com/api/v3";

  function sym(s) { return String(s == null ? "" : s).trim().toUpperCase(); }

  /* ---------------- cache ---------------- */
  var cache = null;
  function lerCache() {
    if (cache) return cache;
    try { cache = JSON.parse(global.localStorage.getItem(KEY) || "{}") || {}; } catch (e) { cache = {}; }
    return cache;
  }
  function gravarCache() {
    try { global.localStorage.setItem(KEY, JSON.stringify(cache || {})); } catch (e) {}
  }
  function doCache(s) {
    var c = lerCache()[s];
    if (!c) return undefined;
    var ttl = c.u ? TTL_OK : TTL_NADA;
    if (Date.now() - (c.t || 0) > ttl) return undefined;   /* vencido: tenta de novo */
    return c.u || null;
  }
  function guardar(s, url) {
    lerCache()[s] = { u: url || null, t: Date.now() };
  }

  /* 1. imagem que o próprio ATLAS já guardou no extrato */
  function doExtrato(s) {
    var CX = global.AtlasCaixa;
    if (!CX || !CX.eventos) return null;
    try {
      var evs = CX.eventos({});
      for (var i = 0; i < evs.length; i++) {
        var e = evs[i];
        if (sym(e.ativo) === s && e.ativoThumb) return e.ativoThumb;
        if (sym(e.ativoDestino) === s && e.ativoDestinoThumb) return e.ativoDestinoThumb;
      }
    } catch (e) {}
    return null;
  }

  /* ---------------- resolução em lote ---------------- */
  var fila = {}, emVoo = {}, timer = null;

  /* ------------------------------------------------------------
     ESPERA QUANDO A API RECUSA

     Sem isto, uma falha virava laço: sem resposta nada era guardado, a
     próxima pintura pedia de novo, e a página martelava a CoinGecko
     até ser bloqueada — medido na verificação (a API passou a recusar
     tudo, "Failed to fetch"). Agora cada falha dobra a espera (1, 2,
     4... até 15 minutos) e só UMA nova tentativa fica agendada.
     ------------------------------------------------------------ */
  var esperaAte = 0, espera = 0, retentativa = null;
  function falhou() {
    espera = Math.min(espera ? espera * 2 : 60000, 15 * 60000);
    esperaAte = Date.now() + espera;
    clearTimeout(retentativa);
    retentativa = setTimeout(function () { hidratar(doc); }, espera + 50);
  }
  function deuCerto() { espera = 0; esperaAte = 0; }

  /* chave do cache: o símbolo, ou "SÍMBOLO#id" quando a busca por
     símbolo é proibida (ativo que não é cripto) — as duas respostas
     podem ser diferentes e não podem se misturar */
  function chave(s, semBusca) { return semBusca ? s + "#id" : s; }

  function pedir(s, semBusca) {
    var k = chave(s, semBusca);
    if (!s || emVoo[k] || fila[k]) return;
    if (Date.now() < esperaAte) return;              /* em espera: a retentativa já está agendada */
    fila[k] = { s: s, semBusca: !!semBusca };
    clearTimeout(timer);
    timer = setTimeout(resolverFila, 250);
  }

  function getJSON(url) {
    return fetch(url, { headers: { accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) { deuCerto(); return j; }, function (e) { falhou(); throw e; });
  }

  function resolverFila() {
    var pedidos = fila;
    var simbolos = Object.keys(pedidos);
    fila = {};
    if (!simbolos.length) return;
    simbolos.forEach(function (k) { emVoo[k] = true; });

    /* porId: id → [chaves]; semId: chaves que vão para a busca */
    var porId = {}, semId = [];
    function paraBusca(k) {
      if (pedidos[k].semBusca) guardar(k, null);     /* não é cripto: sem busca por símbolo */
      else semId.push(k);
    }
    simbolos.forEach(function (k) {
      var s = pedidos[k].s;
      var local = doExtrato(s);
      if (local) { guardar(k, local); return; }
      var id = global.AtlasTokens && global.AtlasTokens.cgId ? global.AtlasTokens.cgId(s) : null;
      if (id) (porId[id] = porId[id] || []).push(k); else paraBusca(k);
    });

    var passos = [];
    var ids = Object.keys(porId);
    if (ids.length) {
      passos.push(getJSON(CG + "/coins/markets?vs_currency=usd&per_page=250&ids=" + encodeURIComponent(ids.join(",")))
        .then(function (lista) {
          var achou = {};
          (lista || []).forEach(function (c) {
            if (c && c.id && porId[c.id] && c.image) {
              porId[c.id].forEach(function (k) { guardar(k, c.image); });
              achou[c.id] = true;
            }
          });
          /* id conferido sem imagem na resposta: tenta pela busca */
          ids.forEach(function (id) { if (!achou[id]) porId[id].forEach(paraBusca); });
        })
        .catch(function () { /* sem rede ou recusado: tenta de novo depois da espera */ }));
    }

    Promise.all(passos).then(function () {
      /* uma busca por símbolo, em sequência curta — a API pública
         aceita poucas chamadas por minuto */
      return semId.reduce(function (p, k) {
        var s = pedidos[k].s;
        return p.then(function () {
          if (Date.now() < esperaAte) return;         /* a API acabou de recusar: não insiste */
          return getJSON(CG + "/search?query=" + encodeURIComponent(s)).then(function (r) {
            var exatos = ((r && r.coins) || []).filter(function (c) { return sym(c.symbol) === s; });
            exatos.sort(function (a, b) {
              return (a.market_cap_rank || 1e9) - (b.market_cap_rank || 1e9);
            });
            guardar(k, exatos.length ? (exatos[0].large || exatos[0].thumb || null) : null);
          }).catch(function () { /* sem rede: não grava "não achei" */ });
        });
      }, Promise.resolve());
    }).then(function () {
      simbolos.forEach(function (k) { delete emVoo[k]; });
      gravarCache();
      hidratar(doc);
    });
  }

  /* ---------------- pintar ---------------- */
  var ESTILO = "[data-atlas-token]{position:relative;overflow:hidden}" +
    ".atlas-tkimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" +
    "border-radius:inherit;background:var(--atlas-surface-solid,#0d1422);display:block}";

  function estilo() {
    if (doc.getElementById("atlas-token-icons-css")) return;
    var st = doc.createElement("style");
    st.id = "atlas-token-icons-css";
    st.textContent = ESTILO;
    (doc.head || doc.documentElement).appendChild(st);
  }

  function pintarUm(el) {
    var s = sym(el.getAttribute("data-atlas-token"));
    if (!s) return;
    /* data-atlas-token-busca="nao": ativo que não é cripto (ação do
       Hold). A busca por símbolo acharia uma moeda homônima qualquer —
       ícone errado é pior que iniciais. Só tabela conferida e extrato. */
    var semBusca = el.getAttribute("data-atlas-token-busca") === "nao";
    var atual = el.querySelector(":scope > img.atlas-tkimg");
    if (atual && atual.getAttribute("data-sym") === s) return;
    var url = doCache(chave(s, semBusca));
    if (url === undefined) { pedir(s, semBusca); return; }
    if (!url) return;                                  /* sem imagem: ficam as iniciais */
    if (atual) atual.remove();
    var img = doc.createElement("img");
    img.className = "atlas-tkimg";
    img.alt = "";
    img.setAttribute("data-sym", s);
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.onerror = function () { img.remove(); };       /* imagem quebrada: volta às iniciais */
    img.src = url;
    el.appendChild(img);
  }

  function hidratar(raiz) {
    if (!raiz || !raiz.querySelectorAll) return;
    if (raiz.nodeType === 1 && raiz.hasAttribute && raiz.hasAttribute("data-atlas-token")) pintarUm(raiz);
    Array.prototype.forEach.call(raiz.querySelectorAll("[data-atlas-token]"), pintarUm);
  }

  /* As telas se redesenham o tempo todo (filtros, cotação chegando,
     troca de carteira). Observar a página é o que deixa a regra valer
     "sempre" sem cada módulo lembrar de chamar nada. */
  var agendado = false;
  function agendar() {
    if (agendado) return;
    agendado = true;
    /* setTimeout, não requestAnimationFrame: este congela em aba que
       não está visível, e a imagem só chegava quando a pessoa voltava */
    setTimeout(function () { agendado = false; hidratar(doc); }, 30);
  }

  function iniciar() {
    estilo();
    hidratar(doc);
    if (global.MutationObserver) {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].addedNodes && muts[i].addedNodes.length) { agendar(); return; }
          if (muts[i].type === "attributes") { agendar(); return; }
        }
      }).observe(doc.documentElement, { childList: true, subtree: true,
                                        attributes: true, attributeFilter: ["data-atlas-token"] });
    }
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();

  global.AtlasTokenIcons = {
    /* a URL já conhecida (ou null) — para quem desenha <img> direto */
    url: function (s, semBusca) {
      var k = chave(sym(s), semBusca), u = doCache(k);
      return u === undefined ? (pedir(sym(s), semBusca), null) : u;
    },
    hidratar: hidratar,
    /* diagnóstico */
    _cache: function () { return lerCache(); }
  };
})(typeof window !== "undefined" ? window : this);
