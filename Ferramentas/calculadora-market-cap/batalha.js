/* ============================================================
   ATLAS · Ferramentas/calculadora-market-cap/batalha.js

   A BATALHA: de 2 a 4 tokens no mesmo preço-alvo, lado a lado.
   "Se JUP, ONDO e MET chegarem a US$ 1, quanto cada projeto precisa
   valer?" A lição: com o mesmo alvo, o token mais barato é o que mais
   precisa crescer.

   As contas e as frases moram em calculo.js (linhaBatalha,
   vereditoBatalha, batalhaParaUrl/DaUrl), testadas no Node. A busca, a
   ficha com cache enxuto e o ranking vêm de app.js (AtlasMcapApp) —
   mesma fonte reserva (CoinPaprika), mesmo cache.

   Endereço: ?modo=batalha&ba=<alvo comum>&b=<tokens> (compartilhável).
   Segurança: todo texto vindo da API passa por esc().
   ============================================================ */
(function () {
  "use strict";
  var C = window.AtlasMcapCalc;
  var A = window.AtlasMcapApp;
  var $ = function (id) { return document.getElementById(id); };
  if (!C || !A) return;
  var esc = A.esc;
  var MAX = 4;

  var estado = { alvo: "1", itens: [], mercado: [], mercadoPedido: false, editando: null };

  /* ---------- modo: Um token | Batalha ---------- */
  function mudarModo(modo, semUrl) {
    var batalha = modo === "batalha";
    $("modo-um").hidden = batalha;
    $("modo-batalha").hidden = !batalha;
    document.querySelectorAll(".modos button").forEach(function (b) {
      b.setAttribute("aria-selected", String(b.getAttribute("data-modo") === modo));
    });
    if (!semUrl) {
      var url = new URL(location.href);
      url.hash = "";
      if (batalha) url.searchParams.set("modo", "batalha"); else url.searchParams.delete("modo");
      history.replaceState(null, "", url);
    }
    if (batalha) render();
  }

  function gravarUrl() {
    var u = C.batalhaParaUrl({ alvo: estado.alvo, itens: estado.itens });
    var url = new URL(location.href);
    url.hash = "";
    url.searchParams.set("modo", "batalha");
    url.searchParams.set("ba", u.alvo);
    if (u.b) url.searchParams.set("b", u.b); else url.searchParams.delete("b");
    history.replaceState(null, "", url);
  }

  function aviso(texto) {
    var el = $("bt-aviso");
    el.textContent = texto || "";
    el.hidden = !texto;
  }

  /* ---------- busca (mesma busca com reserva do modo um token) ---------- */
  var timer = null, sugestoes = [], ativa = -1, seq = 0;

  function fecharSugestoes() {
    var ul = $("bt-sugestoes");
    ul.hidden = true; ul.textContent = "";
    $("bt-busca").setAttribute("aria-expanded", "false");
    sugestoes = []; ativa = -1;
  }

  function desenharSugestoes() {
    var ul = $("bt-sugestoes");
    if (!sugestoes.length) { fecharSugestoes(); return; }
    ul.innerHTML = sugestoes.map(function (s, i) {
      return '<li role="option" id="bt-sug-' + i + '" data-i="' + i + '" aria-selected="' + (i === ativa) + '">' +
        A.iconeHTML(s.name, s.symbol, s.thumb) +
        "<span>" + esc(s.name) + ' <span class="sim">' + esc(s.symbol) + "</span></span>" +
        '<span class="rank">' + (s.rank && s.rank < 9999 ? "#" + esc(s.rank) : "") + "</span></li>";
    }).join("");
    ul.hidden = false;
    $("bt-busca").setAttribute("aria-expanded", "true");
  }

  function buscar(q) {
    var minha = ++seq;
    A.buscaComReserva(q).then(function (lista) {
      if (minha !== seq) return;
      sugestoes = (lista || []).slice(0, 8); ativa = sugestoes.length ? 0 : -1;
      desenharSugestoes();
    }).catch(function (err) {
      if (minha !== seq) return;
      fecharSugestoes();
      aviso((err && err.message) || "Não consegui buscar agora. Tente em instantes.");
    });
  }

  function ligarBusca() {
    var input = $("bt-busca");
    input.addEventListener("input", function () {
      clearTimeout(timer);
      var q = input.value.trim();
      if (q.length < 2) { seq++; fecharSugestoes(); return; }
      timer = setTimeout(function () { buscar(q); }, 350);
    });
    input.addEventListener("keydown", function (e) {
      if ($("bt-sugestoes").hidden) return;
      if (e.key === "ArrowDown") { e.preventDefault(); ativa = Math.min(ativa + 1, sugestoes.length - 1); desenharSugestoes(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); ativa = Math.max(ativa - 1, 0); desenharSugestoes(); }
      else if (e.key === "Enter" && ativa >= 0) { e.preventDefault(); adicionar(sugestoes[ativa]); }
      else if (e.key === "Escape") { fecharSugestoes(); }
    });
    $("bt-sugestoes").addEventListener("mousedown", function (e) {
      var li = e.target.closest("li[data-i]");
      if (!li) return;
      e.preventDefault();
      adicionar(sugestoes[+li.getAttribute("data-i")]);
    });
    input.addEventListener("blur", function () { setTimeout(fecharSugestoes, 120); });
  }

  /* ---------- tokens da batalha ---------- */
  function adicionar(s) {
    if (!s) return;
    clearTimeout(timer); seq++;
    fecharSugestoes();
    $("bt-busca").value = "";
    var sim = String(s.symbol || "").toUpperCase();
    var repetido = estado.itens.some(function (i) { return i.id === s.id || (sim && String(i.symbol).toUpperCase() === sim); });
    if (repetido) { aviso(sim + " já está na batalha."); return; }
    if (estado.itens.length >= MAX) { aviso("A batalha tem no máximo " + MAX + " tokens. Tire um para colocar outro."); return; }
    aviso("");
    var item = { id: s.id, symbol: s.symbol || "", name: s.name || "", fonte: s.fonte || "coingecko", alvoProprio: "", coin: null, erro: null };
    estado.itens.push(item);
    gravarUrl();
    carregarItem(item);
    render();
  }

  function remover(id) {
    estado.itens = estado.itens.filter(function (i) { return i.id !== id; });
    if (estado.editando === id) estado.editando = null;
    gravarUrl();
    render();
  }

  /* Um token de cada vez: uma batalha de 4 não dispara 4 consultas
     juntas na CoinGecko (o limite sem chave é baixo). */
  var fila = Promise.resolve();
  function carregarItem(item) {
    if (!estado.mercadoPedido) {
      estado.mercadoPedido = true;
      fila = fila.then(function () {
        return A.carregarMercado().then(function (m) { estado.mercado = (m && m.lista) || []; render(); });
      });
    }
    fila = fila.then(function () {
      if (estado.itens.indexOf(item) < 0) return null;   // saiu antes de carregar
      return A.carregarFicha(item.id, item.symbol, item.fonte).then(function (r) {
        item.coin = r.coin; item.velho = r.velho; item.t = r.t;
        if (!item.name) item.name = r.coin.name;
        if (!item.symbol) item.symbol = r.coin.symbol;
      }).catch(function (err) {
        item.erro = (err && err.message) || "Não carregou.";
      }).then(render);
    });
  }

  /* ---------- desenho ---------- */
  function alvoDoItem(item) {
    return C.lerNumero(item.alvoProprio) || C.lerNumero(estado.alvo);
  }

  function termoB(id, rotulo) {
    return '<a class="termo" href="#gb-' + id + '" title="O que é isso? Ver no dicionário">' + rotulo + "</a>";
  }

  function renderFichas() {
    $("bt-fichas").innerHTML = estado.itens.map(function (i) {
      var c = i.coin || {};
      var status = i.erro ? '<span class="bt-ficha__st bt-ficha__st--erro">não carregou</span>'
        : !i.coin ? '<span class="bt-ficha__st">carregando…</span>' : "";
      return '<span class="bt-ficha">' + A.iconeHTML(c.name || i.name, c.symbol || i.symbol, c.image) +
        "<b>" + esc(c.symbol || i.symbol) + "</b>" + status +
        '<button type="button" class="bt-ficha__x" data-remover="' + esc(i.id) + '" aria-label="Tirar ' + esc(c.symbol || i.symbol) + ' da batalha">×</button></span>';
    }).join("");
    $("bt-busca").disabled = estado.itens.length >= MAX;
    $("bt-busca").placeholder = estado.itens.length >= MAX ? "Batalha cheia (4 tokens)" : "Ex.: JUP, ONDO, MET";
  }

  /* O alvo de cada coluna: o comum, ou o próprio (✎). vista separa a
     tabela dos cartões do celular, que existem juntos no HTML. */
  function celulaAlvo(item, l, vista) {
    var proprio = !!C.lerNumero(item.alvoProprio);
    var txt = esc(C.fmtUSD(l.usd)) + " → " + esc(C.fmtUSD(l.alvo));
    if (estado.editando === item.id) {
      return '<span class="bt-alvo-ed">' + txt + '<input type="text" inputmode="decimal" autocomplete="off" ' +
        'data-alvo-de="' + esc(item.id) + '" data-vista="' + vista + '" value="' + esc(item.alvoProprio) + '" ' +
        'placeholder="' + esc(estado.alvo) + '" aria-label="Alvo só de ' + esc(item.symbol) + ' (US$)">' +
        (proprio ? '<button type="button" class="bt-mini" data-alvo-comum="' + esc(item.id) + '">voltar ao alvo comum</button>' : "") +
        "</span>";
    }
    return txt + ' <button type="button" class="bt-mini" data-editar="' + esc(item.id) + '" aria-label="Mudar o alvo só de ' +
      esc(item.symbol) + '">✎</button>' + (proprio ? ' <span class="bt-proprio">alvo próprio</span>' : "");
  }

  function textoPosicao(l) {
    if (l.posicao) return l.posicao + "º";
    if (l.foraDaLista) return "abaixo do " + l.tamanhoLista + "º";
    return "—";
  }

  function textoRecorde(l) {
    if (!l.ath) return "—";
    var quando = C.mesAno(l.athDate);
    var marca = l.jaPassou === true ? ' <span class="bt-ok">já passou do alvo</span>'
      : l.jaPassou === false ? ' <span class="bt-nao">nunca chegou ao alvo</span>' : "";
    return esc(C.fmtUSD(l.ath)) + (quando ? " (" + esc(quando) + ")" : "") + marca;
  }

  function textoCresce(l) {
    if (l.mult == null) return "—";
    return l.mult < 1 ? "já está acima do alvo" : esc(C.fmtVezes(l.mult));
  }

  function barraOferta(l) {
    if (l.pctCirculando == null) return "—";
    return '<span class="bt-oferta"><span class="bt-oferta__barra"><span style="width:' + (l.pctCirculando * 100).toFixed(1) + '%"></span></span>' +
      esc(C.fmtPct(l.pctCirculando)) + " / " + esc(C.fmtPct(1 - l.pctCirculando)) + "</span>";
  }

  var LINHAS = [
    { rotulo: function () { return "Preço hoje → alvo"; }, valor: function (l, i, v) { return celulaAlvo(i, l, v); } },
    { rotulo: function () { return "O preço precisa subir"; }, valor: function (l) { return '<b class="num">' + textoCresce(l) + "</b>"; } },
    { rotulo: function () { return termoB("valor-de-mercado", "Valor de mercado") + " hoje"; }, valor: function (l) { return '<span class="num">' + esc(C.fmtUSD(l.mcapHoje)) + "</span>"; } },
    { rotulo: function () { return "Valor necessário no alvo"; }, valor: function (l) { return '<b class="num">' + esc(C.fmtUSD(l.mcapAlvo)) + "</b>"; } },
    { rotulo: function () { return termoB("circulacao", "Circulando") + " / " + termoB("desbloqueio", "falta entrar"); }, valor: function (l) { return barraOferta(l); } },
    { rotulo: function () { return "Com tudo desbloqueado (" + termoB("fdv", "FDV") + ")"; }, valor: function (l) { return '<span class="num">' + esc(C.fmtUSD(l.mcapAlvoCheio)) + "</span>"; } },
    { rotulo: function () { return termoB("ranking", "Ranking") + " no alvo"; }, valor: function (l) { return '<span class="num">' + esc(textoPosicao(l)) + "</span>"; } },
    { rotulo: function () { return "Recorde (ATH)"; }, valor: function (l) { return textoRecorde(l); } }
  ];

  function cabecalho(l, perto) {
    return A.iconeHTML(l.name, l.symbol, l.image) + "<b>" + esc(l.symbol) + "</b>" +
      (perto ? '<span class="bt-selo">mais perto do alvo</span>' : "");
  }

  function renderResultado(prontos) {
    var el = $("bt-resultado");
    if (prontos.length < 2) {
      el.innerHTML = '<p class="nota">' + (estado.itens.length < 2
        ? "Escolha pelo menos 2 tokens para começar a batalha."
        : "Carregando os tokens…") + "</p>";
      return;
    }
    var linhas = prontos.map(function (i) { return C.linhaBatalha(i.coin, alvoDoItem(i), estado.mercado); });
    var perto = C.maisPerto(linhas);

    var tabela = '<div class="bt-tabela-wrap"><table class="bt-tabela"><thead><tr><th scope="col"></th>' +
      linhas.map(function (l) {
        return '<th scope="col"' + (l.id === perto ? ' class="bt-vence"' : "") + ">" + cabecalho(l, l.id === perto) + "</th>";
      }).join("") + "</tr></thead><tbody>" +
      LINHAS.map(function (r) {
        return '<tr><th scope="row">' + r.rotulo() + "</th>" + linhas.map(function (l, k) {
          return "<td" + (l.id === perto ? ' class="bt-vence"' : "") + ">" + r.valor(l, prontos[k], "tabela") + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>";

    var cartoes = '<div class="bt-cartoes">' + linhas.map(function (l, k) {
      return '<div class="bt-cartao' + (l.id === perto ? " bt-vence" : "") + '"><div class="bt-cartao__cab">' + cabecalho(l, l.id === perto) + "</div><dl>" +
        LINHAS.map(function (r) { return "<dt>" + r.rotulo() + "</dt><dd>" + r.valor(l, prontos[k], "cartao") + "</dd>"; }).join("") +
        "</dl></div>";
    }).join("") + "</div>";

    /* Barras: quanto cada um precisa crescer, na mesma escala. */
    var maxMult = Math.max.apply(null, linhas.map(function (l) { return l.mult || 0; }).concat([1]));
    var barras = '<div class="bt-barras"><p class="resumo__titulo">Quanto cada um precisa crescer</p>' +
      linhas.map(function (l) {
        var w = l.mult ? Math.max(l.mult / maxMult * 100, 2) : 0;
        return '<div class="bt-barra"><span class="bt-barra__nome">' + esc(l.symbol) + "</span>" +
          '<span class="bt-barra__trilho"><span class="' + (l.id === perto ? "bt-barra--vence" : "") + '" style="width:' + w.toFixed(1) + '%"></span></span>' +
          '<span class="bt-barra__val num">' + textoCresce(l) + "</span></div>";
      }).join("") + "</div>";

    var frases = C.vereditoBatalha(linhas);
    var veredito = frases.length ? '<div class="resumo"><p class="resumo__titulo">Veredito da batalha</p>' +
      frases.map(function (f, i) { return "<p" + (i === 0 ? ' class="resumo__forte"' : "") + ">" + esc(f) + "</p>"; }).join("") + "</div>" : "";

    var velhos = prontos.filter(function (i) { return i.velho; }).map(function (i) { return i.symbol; });
    var notaVelho = velhos.length ? '<p class="nota">Sem conexão agora: ' + esc(velhos.join(", ")) + " com os últimos dados guardados.</p>" : "";

    el.innerHTML = veredito + barras + tabela + cartoes + notaVelho;
  }

  function renderDicionario() {
    var el = $("bt-dicionario");
    if (el.getAttribute("data-pronto")) return;
    el.setAttribute("data-pronto", "1");
    el.innerHTML = '<h2 class="dic__titulo">Dicionário</h2><p class="nota">Os termos sublinhados na tabela levam até aqui.</p>' +
      '<dl class="dic">' + C.glossario(null).map(function (t) {
        return '<div class="dic__item" id="gb-' + t.id + '"><dt>' + esc(t.termo) + "</dt><dd>" + esc(t.texto) + "</dd></div>";
      }).join("") + "</dl>";
  }

  /* Redesenha guardando o foco: quem está digitando o alvo próprio de
     uma coluna continua no mesmo campo, com o cursor no fim. */
  function render() {
    if ($("modo-batalha").hidden) return;
    var foco = document.activeElement;
    var campoAlvo = foco && foco.getAttribute && foco.getAttribute("data-alvo-de");
    var vista = campoAlvo && foco.getAttribute("data-vista");
    renderFichas();
    renderResultado(estado.itens.filter(function (i) { return i.coin && !i.erro; }));
    renderDicionario();
    if (campoAlvo) {
      var de = document.querySelector('input[data-alvo-de="' + CSS.escape(campoAlvo) + '"][data-vista="' + vista + '"]');
      if (de) { de.focus(); var n = de.value.length; try { de.setSelectionRange(n, n); } catch (e) {} }
    }
  }

  function ligar() {
    document.querySelector(".modos").addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-modo]");
      if (b) mudarModo(b.getAttribute("data-modo"));
    });
    $("bt-fichas").addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-remover]");
      if (b) remover(b.getAttribute("data-remover"));
    });
    $("bt-alvo").addEventListener("input", function (ev) {
      estado.alvo = ev.target.value;
      gravarUrl();
      render();
    });
    $("bt-resultado").addEventListener("click", function (ev) {
      var ed = ev.target.closest("button[data-editar]");
      if (ed) {
        estado.editando = ed.getAttribute("data-editar");
        render();
        var wrap = document.querySelector(".bt-tabela-wrap");
        var vistaVisivel = wrap && getComputedStyle(wrap).display !== "none" ? "tabela" : "cartao";
        var inp = document.querySelector('input[data-alvo-de="' + CSS.escape(estado.editando) + '"][data-vista="' + vistaVisivel + '"]');
        if (inp) inp.focus();
        return;
      }
      var volta = ev.target.closest("button[data-alvo-comum]");
      if (volta) {
        var id = volta.getAttribute("data-alvo-comum");
        estado.itens.forEach(function (i) { if (i.id === id) i.alvoProprio = ""; });
        estado.editando = null;
        gravarUrl();
        render();
      }
    });
    $("bt-resultado").addEventListener("input", function (ev) {
      var id = ev.target.getAttribute && ev.target.getAttribute("data-alvo-de");
      if (!id) return;
      estado.itens.forEach(function (i) { if (i.id === id) i.alvoProprio = ev.target.value; });
      gravarUrl();
      render();
    });
    $("bt-resultado").addEventListener("focusout", function (ev) {
      /* sair do campo de alvo próprio fecha a edição (sem perder o valor) */
      var id = ev.target.getAttribute && ev.target.getAttribute("data-alvo-de");
      if (!id) return;
      setTimeout(function () {
        var ativo = document.activeElement;
        if (ativo && ativo.getAttribute && ativo.getAttribute("data-alvo-de") === id) return;
        if (ativo && ativo.getAttribute && ativo.getAttribute("data-alvo-comum") === id) return;
        if (estado.editando === id) { estado.editando = null; render(); }
      }, 150);
    });
  }

  function iniciar() {
    ligarBusca();
    ligar();
    var qs = new URLSearchParams(location.search);
    if (qs.get("modo") !== "batalha") return;
    var b = C.batalhaDaUrl(qs.get("ba"), qs.get("b"));
    estado.alvo = b.alvo;
    $("bt-alvo").value = b.alvo;
    b.itens.forEach(function (i) {
      var item = { id: i.id, symbol: i.symbol, name: "", fonte: i.fonte, alvoProprio: i.alvoProprio, coin: null, erro: null };
      estado.itens.push(item);
      carregarItem(item);
    });
    mudarModo("batalha", true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
