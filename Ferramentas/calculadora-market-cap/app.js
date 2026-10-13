/* ============================================================
   ATLAS · Ferramentas/calculadora-market-cap/app.js

   A tela da Calculadora de Market Cap. As contas moram em
   calculo.js (testado no Node); aqui só se busca e se desenha.
   Spec: docs/superpowers/specs/2026-10-13-calculadora-market-cap-design.md

   Dados: provedor CoinGecko do ATLAS (core/providers/coingecko.js),
   que já tem cache e retry. O AtlasHttp não devolve dado vencido
   quando a rede falha, então guardamos o último resultado bom aqui
   (atlas.mcap.ultimo.v1) para mostrar "dados de HH:MM" sem rede.

   Segurança: todo texto vindo da API passa por esc() antes de virar
   HTML, e toda URL passa por C.linkSeguro() (só http/https).
   ============================================================ */
(function () {
  "use strict";
  var C = window.AtlasMcapCalc;
  var cg = window.AtlasProviders && window.AtlasProviders.get("coingecko");
  var $ = function (id) { return document.getElementById(id); };
  var LS_ULTIMO = "atlas.mcap.ultimo.v1";

  var estado = {
    coin: null,
    mercado: [],
    aba: "preco",
    entradas: { preco: "", valer: "solana", valerUsd: "", investido: "100", alvo: "" }
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function iniciais(simbolo) { return esc(String(simbolo || "?").slice(0, 4).toUpperCase()); }

  /* Ícone sempre: imagem da CoinGecko; sem imagem, as iniciais. */
  function iconeHTML(nome, simbolo, img, classe) {
    var src = C.linkSeguro(img);
    return '<span class="tk ' + (classe || "") + '" data-atlas-token="' + esc(simbolo) + '">' +
      (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" onerror="this.remove()">' : iniciais(simbolo)) +
      "</span>";
  }

  function aviso(texto) {
    var el = $("mc-aviso");
    el.textContent = texto || "";
    el.hidden = !texto;
  }

  /* ---------- cache do último resultado bom ---------- */
  function guardarUltimo(coin, mercado) {
    try { localStorage.setItem(LS_ULTIMO, JSON.stringify({ t: Date.now(), coin: coin, mercado: mercado })); } catch (e) {}
  }
  function lerUltimo(id) {
    try {
      var u = JSON.parse(localStorage.getItem(LS_ULTIMO) || "null");
      return u && u.coin && u.coin.id === id ? u : null;
    } catch (e) { return null; }
  }
  function hora(t) {
    var d = new Date(t);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  /* ---------- busca ---------- */
  var timerBusca = null, sugestoes = [], ativa = -1, seqBusca = 0;

  function fecharSugestoes() {
    var ul = $("mc-sugestoes");
    ul.hidden = true; ul.textContent = "";
    $("mc-busca").setAttribute("aria-expanded", "false");
    sugestoes = []; ativa = -1;
  }

  function desenharSugestoes() {
    var ul = $("mc-sugestoes");
    if (!sugestoes.length) { fecharSugestoes(); return; }
    ul.innerHTML = sugestoes.map(function (s, i) {
      return '<li role="option" id="mc-sug-' + i + '" data-i="' + i + '" aria-selected="' + (i === ativa) + '">' +
        iconeHTML(s.name, s.symbol, s.thumb) +
        "<span>" + esc(s.name) + ' <span class="sim">' + esc(s.symbol) + "</span></span>" +
        '<span class="rank">' + (s.rank && s.rank < 9999 ? "#" + esc(s.rank) : "") + "</span></li>";
    }).join("");
    ul.hidden = false;
    $("mc-busca").setAttribute("aria-expanded", "true");
    $("mc-busca").setAttribute("aria-activedescendant", ativa >= 0 ? "mc-sug-" + ativa : "");
  }

  function buscar(q) {
    var minha = ++seqBusca;
    cg.search(q).then(function (lista) {
      if (minha !== seqBusca) return;
      sugestoes = (lista || []).slice(0, 8); ativa = sugestoes.length ? 0 : -1;
      desenharSugestoes();
      aviso("");
    }).catch(function (err) {
      if (minha !== seqBusca) return;
      fecharSugestoes();
      aviso((err && err.message) || "Não consegui buscar agora. Tente em instantes.");
    });
  }

  function ligarBusca() {
    var input = $("mc-busca");
    input.addEventListener("input", function () {
      clearTimeout(timerBusca);
      var q = input.value.trim();
      if (q.length < 2) { seqBusca++; fecharSugestoes(); return; }
      timerBusca = setTimeout(function () { buscar(q); }, 350);
    });
    input.addEventListener("keydown", function (e) {
      if ($("mc-sugestoes").hidden) return;
      if (e.key === "ArrowDown") { e.preventDefault(); ativa = Math.min(ativa + 1, sugestoes.length - 1); desenharSugestoes(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); ativa = Math.max(ativa - 1, 0); desenharSugestoes(); }
      else if (e.key === "Enter" && ativa >= 0) { e.preventDefault(); escolher(sugestoes[ativa]); }
      else if (e.key === "Escape") { fecharSugestoes(); }
    });
    $("mc-sugestoes").addEventListener("mousedown", function (e) {
      var li = e.target.closest("li[data-i]");
      if (!li) return;
      e.preventDefault();
      escolher(sugestoes[+li.getAttribute("data-i")]);
    });
    input.addEventListener("blur", function () { setTimeout(fecharSugestoes, 120); });
  }

  function escolher(s) {
    if (!s) return;
    fecharSugestoes();
    $("mc-busca").value = s.name + " (" + s.symbol + ")";
    var url = new URL(location.href);
    url.searchParams.set("token", s.id);
    history.replaceState(null, "", url);
    carregar(s.id);
  }

  /* ---------- carga ---------- */
  function carregarMercado() {
    return cg.topMovers({ order: "market_cap_desc", perPage: 250, ttl: 600000 })
      .catch(function () { return []; });
  }

  var seqCarga = 0;
  function carregar(id) {
    var minha = ++seqCarga;
    aviso("Carregando…");
    Promise.all([cg.assetFull(id), carregarMercado()]).then(function (r) {
      if (minha !== seqCarga) return;
      if (!r[0]) throw new Error("A CoinGecko não devolveu dados deste token.");
      estado.coin = r[0];
      estado.mercado = r[1] || [];
      if (estado.mercado.length) guardarUltimo(estado.coin, estado.mercado);
      aviso(estado.mercado.length ? "" : "Régua e ranking indisponíveis agora (limite da CoinGecko). Tente em instantes.");
      desenharTudo();
    }).catch(function (err) {
      if (minha !== seqCarga) return;
      var msg = (err && err.message) || "Não consegui carregar este token.";
      var u = lerUltimo(id);
      if (u) {
        estado.coin = u.coin; estado.mercado = u.mercado || [];
        aviso(msg + " Mostrando os dados de " + hora(u.t) + ".");
        desenharTudo();
      } else {
        aviso(msg);
      }
    });
  }

  function desenharTudo() {
    renderFicha();
    $("mc-calc").hidden = false;
    renderPainel();
    renderExplica();
  }

  /* ---------- ficha ---------- */
  function renderFicha() {
    var c = estado.coin, el = $("mc-ficha");
    var of = C.oferta(c.supply);
    var mcapHoje = c.marketCap || C.mcapNoPreco(c.usd, of.circulante);
    /* FDV pela mesma conta das colunas, para a ficha e a calculadora
       nunca discordarem; o da CoinGecko só se faltar oferta. */
    var fdv = C.mcapNoPreco(c.usd, of.cheia) || c.fdv;

    var barra;
    if (of.pctCirculando != null) {
      barra =
        '<div class="oferta__barra" role="img" aria-label="' + esc(C.fmtPct(of.pctCirculando)) + ' circulando">' +
          '<span style="width:' + (of.pctCirculando * 100).toFixed(2) + '%"></span></div>' +
        '<div class="oferta__leg">' +
          "<span><b>" + C.fmtPct(of.pctCirculando) + " circulando</b> · " + C.fmtQtd(of.circulante) + " tokens</span>" +
          "<span><b>" + C.fmtPct(1 - of.pctCirculando) + " ainda vai entrar</b> · " + C.fmtQtd(of.faltaEntrar) + " tokens</span>" +
        "</div>";
    } else if (of.circulante == null) {
      barra = '<p class="nota">A CoinGecko não informa quantos tokens estão em circulação.</p>';
    } else {
      barra = '<p class="nota">A CoinGecko não informa a oferta total deste token. Circulando: ' + C.fmtQtd(of.circulante) + " tokens.</p>";
    }

    var notas = [];
    if (of.semTeto && of.base === "total") notas.push("Sem teto de emissão: a conta do desbloqueio usa a oferta total de hoje, que pode crescer.");
    if (of.base === "total" && of.teto != null && of.teto > of.cheia * 1.001) {
      notas.push("O contrato permite até " + C.fmtQtd(of.teto) + " tokens, mas hoje existem " + C.fmtQtd(of.cheia) +
        " (o resto foi queimado ou ainda não foi criado). A conta usa os que existem, como a CoinGecko.");
    }
    if (of.inconsistente) notas.push("A fonte informa mais tokens circulando do que o total. Tratamos como 100% circulando.");

    var links = C.linksDoToken(c).map(function (l) {
      return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + esc(l.rotulo) + " ↗</a>";
    }).join("");

    el.innerHTML =
      '<div class="ficha__cab">' + iconeHTML(c.name, c.symbol, c.image, "tk--g") +
        "<h2>" + esc(c.name) + ' <span class="sim">' + esc(c.symbol) + "</span></h2></div>" +
      '<dl class="faixa">' +
        '<div><dt>Preço</dt><dd class="num">' + C.fmtUSD(c.usd) + "</dd></div>" +
        '<div><dt>Valor de mercado</dt><dd class="num">' + C.fmtUSD(mcapHoje) + "</dd></div>" +
        '<div><dt>FDV (tudo desbloqueado)</dt><dd class="num">' + C.fmtUSD(fdv) + "</dd></div>" +
        '<div><dt>Ranking</dt><dd class="num">' + (c.rank ? esc(c.rank) + "º" : "—") + "</dd></div>" +
      "</dl>" + barra +
      notas.map(function (n) { return '<p class="nota">' + esc(n) + "</p>"; }).join("") +
      (links ? '<p class="nota">Para ver quando e para quem os tokens entram:</p><div class="links">' + links + "</div>" : "");
    el.hidden = false;
  }

  /* As próximas duas funções ganham corpo nas Tasks 4 e 5. */
  function renderPainel() { $("mc-painel").textContent = ""; }
  function renderExplica() { $("mc-explica").textContent = ""; }

  /* ---------- início ---------- */
  function iniciar() {
    if (!C || !cg) { aviso("Falta um arquivo do ATLAS para buscar preços. Recarregue a página."); return; }
    ligarBusca();
    renderExplica();
    var id = new URLSearchParams(location.search).get("token");
    if (id) carregar(id);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
