/* ============================================================
   ATLAS · Ferramentas/calculadora-market-cap/app.js

   A tela da Calculadora de Market Cap. As contas moram em
   calculo.js (testado no Node); aqui só se busca e se desenha.
   Spec: docs/superpowers/specs/2026-10-13-calculadora-market-cap-design.md

   Dados: provedor CoinGecko do ATLAS (core/providers/coingecko.js),
   chamado com ttl 0. O cache do AtlasHttp guardaria a resposta crua
   (~97 KB por token, ~212 KB o top 250) no localStorage que as
   carteiras também usam. Guardamos aqui só a versão enxuta
   (atlas.mcap.cache.v1, no máximo 10 fichas): ela serve de cache
   (ficha 3 min, ranking 10 min) e de reserva sem rede, com o horário.

   Segurança: todo texto vindo da API passa por esc() antes de virar
   HTML, e toda URL passa por C.linkSeguro() (só http/https).
   ============================================================ */
(function () {
  "use strict";
  var C = window.AtlasMcapCalc;
  var cg = window.AtlasProviders && window.AtlasProviders.get("coingecko");
  /* Fonte reserva, gratuita e sem chave: entra quando a CoinGecko dá
     limite (429). O limite sem chave da CoinGecko é por IP, e o ATLAS
     inteiro (Academy, carteiras, ícones, Scanner) gasta do mesmo. */
  var cp = window.AtlasProviders && window.AtlasProviders.get("coinpaprika");
  var $ = function (id) { return document.getElementById(id); };
  var LS_CACHE = "atlas.mcap.cache.v1";
  var TTL_FICHA = 180000, TTL_MERCADO = 600000, MAX_FICHAS = 10;

  var estado = {
    coin: null,
    mercado: [],
    aba: "preco",
    entradas: { preco: "", investido: "100", alvo: "" }
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function iniciais(simbolo) { return esc(String(simbolo || "?").slice(0, 4).toUpperCase()); }

  /* Ícone sempre: as iniciais ficam por baixo e a imagem por cima. Se a
     imagem falhar, ela some e as iniciais aparecem (antes ficava um
     círculo vazio). */
  function iconeHTML(nome, simbolo, img, classe) {
    var src = C.linkSeguro(img);
    return '<span class="tk ' + (classe || "") + '" data-atlas-token="' + esc(simbolo) + '">' + iniciais(simbolo) +
      (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" onerror="this.remove()">' : "") +
      "</span>";
  }

  /* Dois avisos na mesma linha: o da carga ("dados de HH:MM", "régua
     indisponível") vale enquanto aqueles números estão na tela; o da
     busca é passageiro. Uma busca bem-sucedida devolve o da carga em vez
     de apagá-lo — senão número velho ficaria na tela sem aviso. */
  var avisoCarga = "";
  /* Termo difícil sublinhado com pontinhos: o clique desce até o
     dicionário no fim da página. rotulo já vem escapado ou é fixo. */
  function termo(id, rotulo) {
    return '<a class="termo" href="#g-' + id + '" title="O que é isso? Ver no dicionário">' + rotulo + "</a>";
  }

  function aviso(texto) {
    var el = $("mc-aviso");
    el.textContent = texto || "";
    el.hidden = !texto;
  }
  function avisarCarga(texto) { avisoCarga = texto || ""; aviso(avisoCarga); }

  /* ---------- cache enxuto ---------- */
  function lerCache() {
    try {
      var c = JSON.parse(localStorage.getItem(LS_CACHE) || "null");
      return c && typeof c === "object" ? { mercado: c.mercado || null, fichas: c.fichas || {} } : { mercado: null, fichas: {} };
    } catch (e) { return { mercado: null, fichas: {} }; }
  }
  function gravarCache(c) {
    c.fichas = C.podarFichas(c.fichas, MAX_FICHAS);
    try { localStorage.setItem(LS_CACHE, JSON.stringify(c)); } catch (e) {}
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

  /* Busca: CoinGecko primeiro; se ela der limite (429) ou vier vazia, a
     CoinPaprika. Cada sugestão leva a fonte, porque o id muda de uma
     para outra ("ondo-finance" × "ondo-ondo-finance"). */
  function buscaComReserva(q) {
    function marcar(lista, fonte) {
      return (lista || []).map(function (s) { s.fonte = fonte; return s; });
    }
    return cg.search(q).then(function (l) {
      if (l && l.length) return marcar(l, "coingecko");
      throw new Error("vazio");
    }).catch(function (err) {
      if (!cp) throw err;
      return cp.search(q).then(function (l) { return marcar(l, "coinpaprika"); });
    });
  }

  function buscar(q) {
    var minha = ++seqBusca;
    buscaComReserva(q).then(function (lista) {
      if (minha !== seqBusca) return;
      sugestoes = (lista || []).slice(0, 8); ativa = sugestoes.length ? 0 : -1;
      desenharSugestoes();
      aviso(avisoCarga);
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
    /* o preço sonhado do JUP não vale para o BTC */
    estado.entradas.preco = ""; estado.entradas.alvo = "";
    /* o símbolo vai junto no endereço: é com ele que a ficha acha o
       token na fonte reserva se a CoinGecko der limite ao abrir o link */
    var url = new URL(location.href);
    url.hash = "";
    url.searchParams.set("token", s.id);
    url.searchParams.set("s", s.symbol || "");
    if (s.fonte === "coinpaprika") url.searchParams.set("f", "cp"); else url.searchParams.delete("f");
    history.replaceState(null, "", url);
    carregar(s.id, s.symbol, s.fonte);
  }

  /* ---------- carga ---------- */
  /* Ranking e régua: cache enxuto de 10 min; sem rede, a última lista
     guardada (com o horário no aviso). Devolve { lista, t, velho }. */
  function carregarMercado() {
    var m = lerCache().mercado;
    if (m && Date.now() - m.t < TTL_MERCADO) return Promise.resolve({ lista: m.lista, t: m.t, velho: false });
    var pedido = { order: "market_cap_desc", perPage: 250, ttl: 0 };
    /* CoinGecko primeiro; no limite (429), o top 250 da CoinPaprika */
    return cg.topMovers(pedido).catch(function (err) {
      if (!cp) throw err;
      return cp.topMovers(pedido);
    }).then(function (cru) {
      var lista = C.enxugarMercado(cru);
      if (lista.length) {
        var c = lerCache();
        c.mercado = { t: Date.now(), lista: lista };
        gravarCache(c);
      }
      return { lista: lista, t: Date.now(), velho: false };
    }).catch(function () {
      return m ? { lista: m.lista, t: m.t, velho: true } : { lista: [], t: 0, velho: false };
    });
  }

  /* A ficha crua: da CoinGecko ou, no limite dela, da CoinPaprika. Na
     reserva o id é outro, então a CoinPaprika acha o token pelo símbolo
     na busca dela (resposta pequena — o catálogo inteiro dela pesaria
     no localStorage). Devolve { cru, fonte }. */
  function fichaComReserva(id, simbolo, fonte) {
    if (fonte === "coinpaprika" && cp) {
      return cp.assetFull(id, { ttl: 0 }).then(function (cru) { return { cru: cru, fonte: "coinpaprika" }; });
    }
    return cg.assetFull(id, { ttl: 0 }).then(function (cru) {
      if (!cru) throw new Error("A CoinGecko não devolveu dados deste token.");
      return { cru: cru, fonte: "coingecko" };
    }).catch(function (err) {
      if (!cp || !simbolo) throw err;
      return cp.search(simbolo).then(function (res) {
        var pid = C.idPeloSimbolo(res, simbolo);
        if (!pid) throw err;
        return cp.assetFull(pid, { ttl: 0 });
      }).then(function (cru) {
        if (!cru) throw err;
        return { cru: cru, fonte: "coinpaprika" };
      }, function () { throw err; });
    });
  }

  /* Ficha: cache enxuto de 3 min; sem rede, a última ficha guardada. */
  function carregarFicha(id, simbolo, fonte) {
    var f = lerCache().fichas[id];
    if (f && Date.now() - f.t < TTL_FICHA) return Promise.resolve({ coin: f.coin, t: f.t, velho: false });
    return fichaComReserva(id, simbolo, fonte).then(function (r) {
      if (!r.cru) throw new Error("Nenhuma fonte devolveu dados deste token.");
      var coin = C.enxugarFicha(r.cru, r.fonte);
      var c = lerCache();
      c.fichas[id] = { t: Date.now(), coin: coin };
      gravarCache(c);
      return { coin: coin, t: Date.now(), velho: false };
    }).catch(function (err) {
      if (f) return { coin: f.coin, t: f.t, velho: true, erro: err };
      throw err;
    });
  }

  var seqCarga = 0;
  function carregar(id, simbolo, fonte) {
    var minha = ++seqCarga;
    avisarCarga("Carregando…");
    Promise.all([carregarFicha(id, simbolo, fonte), carregarMercado()]).then(function (r) {
      if (minha !== seqCarga) return;
      var ficha = r[0], merc = r[1];
      estado.coin = ficha.coin;
      estado.mercado = merc.lista || [];
      var avisos = [];
      if (ficha.velho) {
        avisos.push(((ficha.erro && ficha.erro.message) || "Sem conexão com a CoinGecko.") +
          " Mostrando os dados de " + hora(ficha.t) + ".");
      }
      if (merc.velho) avisos.push("Régua e ranking de " + hora(merc.t) + ".");
      else if (!estado.mercado.length) avisos.push("Régua e ranking indisponíveis agora (limite das fontes de dados). Tente em instantes.");
      avisarCarga(avisos.join(" "));
      desenharTudo();
    }).catch(function (err) {
      if (minha !== seqCarga) return;
      avisarCarga((err && err.message) || "Não consegui carregar este token.");
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
          "<span><b>" + C.fmtPct(of.pctCirculando) + " " + termo("circulacao", "circulando") + "</b> · " + C.fmtQtd(of.circulante) + " tokens</span>" +
          "<span><b>" + C.fmtPct(1 - of.pctCirculando) + " " + termo("desbloqueio", "ainda vai entrar") + "</b> · " + C.fmtQtd(of.faltaEntrar) + " tokens</span>" +
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
        '<div><dt>' + termo("valor-de-mercado", "Valor de mercado") + '</dt><dd class="num">' + C.fmtUSD(mcapHoje) + "</dd></div>" +
        '<div><dt>' + termo("fdv", "FDV") + ' (tudo desbloqueado)</dt><dd class="num">' + C.fmtUSD(fdv) + "</dd></div>" +
        '<div><dt>' + termo("ranking", "Ranking") + '</dt><dd class="num">' + (c.rank ? esc(c.rank) + "º" : "—") + "</dd></div>" +
      "</dl>" + barra +
      notas.map(function (n) { return '<p class="nota">' + esc(n) + "</p>"; }).join("") +
      (links ? '<p class="nota">Para ver quando e para quem os tokens entram:</p><div class="links">' + links + "</div>" : "") +
      '<p class="nota fonte">' + (c.fonte === "coinpaprika"
        ? "Dados: CoinPaprika (fonte reserva — a CoinGecko atingiu o limite de consultas agora)."
        : "Dados: CoinGecko.") + "</p>";
    el.hidden = false;
  }

  /* ---------- calculadora ---------- */
  function regua() {
    return C.acharNaRegua(estado.mercado);
  }

  function mcapHoje() {
    var c = estado.coin, of = C.oferta(c.supply);
    return c.marketCap || C.mcapNoPreco(c.usd, of.circulante);
  }

  /* As duas colunas de todo resultado: tokens de hoje × tudo desbloqueado. */
  function colunas() {
    var of = C.oferta(estado.coin.supply);
    return [
      { titulo: "Com os tokens de hoje", qtd: of.circulante,
        semDado: "A CoinGecko não informa a circulação deste token." },
      { titulo: "Quando tudo desbloquear", qtd: of.cheia,
        semDado: "A CoinGecko não informa a oferta total deste token." }
    ];
  }

  function colunaVazia(col) {
    return '<div class="col"><h3>' + col.titulo + '</h3><p class="indisp">' + esc(col.semDado) + "</p></div>";
  }

  function textoRanking(mcap) {
    var r = C.posicaoNoRanking(mcap, rankingSemOToken());
    if (!r) return "";
    if (r.maiorQueTodos) return "Ficaria em 1º lugar do ranking, acima de " + esc(r.abaixo.name) + ".";
    if (r.foraDaLista) return "Abaixo do " + r.tamanhoLista + "º lugar do ranking.";
    return "Ficaria em " + r.posicao + "º lugar, entre " + esc(r.acima.name) + " e " + esc(r.abaixo.name) + ".";
  }

  /* A régua em frase ("21% do tamanho", "5,4 vezes o tamanho") com uma
     barrinha: "0,008×" não dizia nada para quem está começando. */
  function blocoTamanho(mcap) {
    var linhas = C.regua(mcap, regua()).map(function (p) {
      var d = C.descreverRegua(p.vezes);
      if (!d) return "";
      var larg = Math.max(d.barra * 100, 1.5).toFixed(1);
      return '<li><span class="regua__nome">' + esc(p.name) + "</span>" +
        '<span class="regua__barra" aria-hidden="true"><span style="width:' + larg + '%"></span></span>' +
        '<span class="regua__txt">' + d.texto + "</span></li>";
    }).join("");
    var rk = textoRanking(mcap);
    return (rk ? '<p class="linha">' + rk + "</p>" : "") +
      (linhas ? '<p class="linha">Comparado com projetos que você conhece, esse valor seria:</p><ul class="regua">' + linhas + "</ul>" : "");
  }

  function colunaMcap(col, preco) {
    var mcap = C.mcapNoPreco(preco, col.qtd);
    if (mcap == null) return colunaVazia(col);
    var mult = C.multiplicador(mcap, mcapHoje());
    return '<div class="col"><h3>' + col.titulo + "</h3>" +
      '<p class="grande num">' + C.fmtUSD(mcap) + "</p>" +
      (mult != null ? '<p class="linha">' + C.fmtVezes(mult) + " o " + termo("valor-de-mercado", "valor de mercado") + " de hoje</p>" : "") +
      blocoTamanho(mcap) + "</div>";
  }

  /* Os números que a resposta direta e a pergunta comum usam. */
  function dadosResumo(precoAlvo) {
    var c = estado.coin, of = C.oferta(c.supply);
    var mcapAlvo = C.mcapNoPreco(precoAlvo, of.circulante);
    var r = C.posicaoNoRanking(mcapAlvo, rankingSemOToken());
    return {
      simbolo: c.symbol, precoAtual: c.usd, precoAlvo: precoAlvo, circulante: of.circulante,
      mcapHoje: mcapHoje(), mcapAlvo: mcapAlvo, mcapAlvoCheio: C.mcapNoPreco(precoAlvo, of.cheia),
      faltaEntrar: of.faltaEntrar, pctCirculando: of.pctCirculando,
      acimaNoRanking: r && !r.foraDaLista ? r.posicao - 1 : null, maiorQueTodos: !!(r && r.maiorQueTodos),
      ath: c.ath, athDate: c.athDate
    };
  }

  /* A resposta direta, em frases, antes das colunas de números. */
  function blocoResumo(precoAlvo) {
    var frases = C.resumoSimples(dadosResumo(precoAlvo));
    if (!frases.length) return "";
    return '<div class="resumo"><p class="resumo__titulo">Em poucas palavras</p>' +
      frases.map(function (f, i) { return "<p" + (i === 0 ? ' class="resumo__forte"' : "") + ">" + esc(f) + "</p>"; }).join("") +
      "</div>";
  }

  function resultadoPreco() {
    var preco = C.lerNumero(estado.entradas.preco);
    if (preco == null) return "";
    return blocoResumo(preco) +
      '<div class="colunas">' + colunas().map(function (col) { return colunaMcap(col, preco); }).join("") + "</div>";
  }

  /* O token não compete consigo mesmo no ranking — nem quando a ficha
     veio de uma fonte e o ranking de outra (ids diferentes). */
  function rankingSemOToken() {
    var c = estado.coin || {};
    return C.semOToken(estado.mercado, c.id, c.symbol);
  }

  function resultadoDinheiro() {
    var e = estado.entradas, c = estado.coin;
    var valor = C.lerNumero(e.investido), alvo = C.lerNumero(e.alvo);
    var r = C.meuDinheiro(valor, c.usd, alvo);
    if (!r) return "";
    var cls = r.lucro >= 0 ? "pos" : "neg";
    var sinal = r.lucro >= 0 ? "+" : "−";
    return '<div class="dinheiro">' +
      '<div class="col"><h3>Você compra</h3><p class="grande num">' + C.fmtQtd(r.tokens) + " " + esc(c.symbol) + "</p></div>" +
      '<div class="col"><h3>Valeria</h3><p class="grande num">' + C.fmtUSD(r.valorFinal) + "</p></div>" +
      '<div class="col"><h3>Resultado</h3><p class="grande num ' + cls + '">' + sinal + C.fmtUSD(Math.abs(r.lucro)) +
        '</p><p class="linha num ' + cls + '">' + sinal + C.fmtPct(Math.abs(r.lucroPct) / 100) + "</p></div>" +
      "</div>" + blocoResumo(alvo) +
      '<p class="linha">Para ' + esc(c.symbol) + " chegar a " + C.fmtUSD(alvo) + ", o projeto precisa valer:</p>" +
      '<div class="colunas">' + colunas().map(function (col) { return colunaMcap(col, alvo); }).join("") + "</div>";
  }

  function renderResultado() {
    var html = estado.aba === "preco" ? resultadoPreco() : resultadoDinheiro();
    var el = $("mc-res");
    if (el) el.innerHTML = html;
  }

  function campo(id, rotulo, valor, dica) {
    return '<div class="campo"><label for="' + id + '">' + rotulo + "</label>" +
      '<input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" value="' + esc(valor) + '">' +
      (dica ? '<p class="dica">' + dica + "</p>" : "") + "</div>";
  }

  function renderPainel() {
    var e = estado.entradas, c = estado.coin, html;
    if (estado.aba === "preco") {
      html = '<div class="campos">' + campo("mc-in-preco", "Se " + esc(c.symbol) + " chegar a (US$)", e.preco,
        "Hoje: " + C.fmtUSD(c.usd) + ". Aceita 0,5 · 1 · 2.500") + "</div>";
    } else {
      html = '<div class="campos">' +
        campo("mc-in-investido", "Quanto você investe (US$)", e.investido, "") +
        campo("mc-in-alvo", "Se " + esc(c.symbol) + " chegar a (US$)", e.alvo, "Hoje: " + C.fmtUSD(c.usd)) +
        "</div>";
    }
    $("mc-painel").innerHTML = html + '<div id="mc-res" class="res"></div>';
    renderResultado();
  }

  function ligarCalculadora() {
    document.querySelector(".abas").addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-aba]");
      if (!b || !estado.coin) return;
      estado.aba = b.getAttribute("data-aba");
      document.querySelectorAll(".abas button").forEach(function (x) {
        x.setAttribute("aria-selected", String(x === b));
      });
      renderPainel();
    });
    var mapa = { "mc-in-preco": "preco", "mc-in-investido": "investido", "mc-in-alvo": "alvo" };
    $("mc-painel").addEventListener("input", function (ev) {
      var k = mapa[ev.target.id];
      if (!k) return;
      estado.entradas[k] = ev.target.value;
      renderResultado();
      /* a pergunta comum lá embaixo usa o preço digitado */
      if (k === "preco" || k === "alvo") renderExplica();
    });
  }
  /* ---------- explicação ----------
     Curta e com os números do token da tela. Sem token, fala em geral. */
  function renderExplica() {
    var c = estado.coin, el = $("mc-explica");
    var of = c ? C.oferta(c.supply) : null;
    var exemplo = "";
    if (c && of && of.circulante != null && c.usd) {
      exemplo = "<p>No " + esc(c.symbol) + ": " + C.fmtUSD(c.usd) + " × " + C.fmtQtd(of.circulante) +
        " tokens = " + C.fmtUSD(C.mcapNoPreco(c.usd, of.circulante)) + " de valor de mercado.</p>";
    }
    var fdv = "";
    if (c && of && of.pctCirculando != null && of.pctCirculando < 0.999) {
      fdv = "<p>Hoje circulam " + C.fmtPct(of.pctCirculando) + " dos tokens de " + esc(c.symbol) +
        ". Os outros " + C.fmtPct(1 - of.pctCirculando) + " ainda vão entrar no mercado. Para o preço ficar parado, " +
        "o projeto precisa crescer na mesma proporção.</p>";
    }
    /* A dúvida clássica, com o preço que a pessoa digitou (ou o "1 dólar"
       de exemplo, para quem ainda não digitou nada). */
    var pergunta = "";
    if (c) {
      var alvo = C.lerNumero(estado.aba === "dinheiro" ? estado.entradas.alvo : estado.entradas.preco) || C.alvoExemplo(c.usd);
      var pc = alvo != null ? C.perguntaComum(dadosResumo(alvo)) : null;
      if (pc) {
        pergunta = '<div class="pergunta"><p class="pergunta__q">“' + esc(pc.pergunta) + "”</p>" +
          "<p>" + esc(pc.resposta) + "</p></div>";
      }
    }
    var dic = C.glossario(c && of ? {
      simbolo: c.symbol, preco: c.usd, circulante: of.circulante, total: of.cheia, teto: of.teto,
      mcap: mcapHoje(), fdv: C.mcapNoPreco(c.usd, of.cheia), rank: c.rank, faltaEntrar: of.faltaEntrar
    } : null).map(function (t) {
      return '<div class="dic__item" id="g-' + t.id + '"><dt>' + esc(t.termo) + "</dt><dd>" + esc(t.texto) +
        (t.exemplo ? '<span class="dic__ex">' + esc(t.exemplo) + "</span>" : "") + "</dd></div>";
    }).join("");
    el.innerHTML =
      (pergunta ? "<h2>A pergunta que todo mundo faz</h2>" + pergunta : "") +
      "<h2>Como ler estes números</h2>" +
      "<h3>O tamanho da pizza, não o preço da fatia</h3>" +
      "<p>O preço de um token, sozinho, não diz se ele está barato ou caro. O que diz é o valor de mercado: " +
      "<b>preço × quantidade de tokens</b>. Um token de centavos pode valer mais que um de centenas de dólares, " +
      "porque cada projeto fatia a sua pizza em um número diferente de pedaços.</p>" + exemplo +
      "<h3>Os tokens que ainda vão entrar (FDV)</h3>" +
      "<p>Muitos projetos ainda vão liberar tokens para equipe, investidores e comunidade. O FDV é o valor de mercado " +
      "se todos os tokens já existissem. Quando a coluna \"quando tudo desbloquear\" é bem maior que a de hoje, há " +
      "pressão de venda no caminho.</p>" + fdv +
      "<h3>Ter mais unidades não é vantagem</h3>" +
      "<p>Com US$ 100 você compra milhares de um token barato ou uma fração de um caro. Se os dois projetos " +
      "dobrarem de tamanho, os dois US$ 100 viram US$ 200. O lucro vem de quanto o valor de mercado cresce, " +
      "não da quantidade de tokens.</p>" +
      "<h3>Token pequeno sobe mais fácil e cai mais fácil</h3>" +
      "<p>Um projeto pequeno precisa de menos dinheiro para dobrar, e por isso mesmo pode cair ou sumir com " +
      "pouco dinheiro saindo. O que manda é a liquidez: quanto dinheiro existe de verdade para comprar e vender.</p>" +
      '<p class="nota">Antes de sonhar com um preço, multiplique pela quantidade de tokens e pergunte: esse projeto vale isso?</p>' +
      '<h2 class="dic__titulo">Dicionário</h2><p class="nota">Os termos sublinhados na página levam até aqui.</p>' +
      '<dl class="dic">' + dic + "</dl>";
  }

  /* O que a batalha (batalha.js) reaproveita daqui: a mesma busca com
     fonte reserva, a mesma ficha com cache enxuto e o mesmo ranking. */
  window.AtlasMcapApp = {
    esc: esc, iconeHTML: iconeHTML, hora: hora,
    buscaComReserva: buscaComReserva, carregarFicha: carregarFicha, carregarMercado: carregarMercado
  };

  /* ---------- início ---------- */
  function iniciar() {
    if (!C || !cg) { aviso("Falta um arquivo do ATLAS para buscar preços. Recarregue a página."); return; }
    ligarBusca();
    ligarCalculadora();
    renderExplica();
    var qs = new URLSearchParams(location.search);
    var id = qs.get("token");
    if (id) carregar(id, qs.get("s"), qs.get("f") === "cp" ? "coinpaprika" : "coingecko");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
