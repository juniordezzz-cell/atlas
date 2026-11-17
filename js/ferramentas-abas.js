/* ============================================================
   ATLAS · Ferramentas — abas dos grupos (15/11/2026)

   Monta as abas (Gerir o dinheiro, Planejar…, DeFi e renda, Estudar o
   mercado) a partir das <section class="tools-sec" id="…"> da página:
   o nome vem do .tools-sec__title, o número do .tools-sec__count e a
   frase de apoio do .tools-sec__sub. Só a seção da aba ativa aparece.

   - O endereço guarda a aba (#defi), então dá para mandar o link direto.
     A seção se chama "sec-defi", não "defi": com o mesmo nome, o
     navegador rolava a página até ela ao terminar de carregar
     (aparecia no celular, onde a página é longa).
   - Sem hash, volta à última aba aberta neste navegador.
   - Setas ← → trocam de aba quando o foco está nelas.
   - Sem JS, nada se esconde: as seções aparecem uma embaixo da outra.
   Registro: docs/ferramentas-bancada-2026-11-08.md
   ============================================================ */
(function () {
  "use strict";

  var CHAVE = "atlas.ferramentas.aba";
  var barra = document.querySelector(".tools-tabs");
  var legenda = document.querySelector(".tools-tabs__sub");
  var secoes = Array.prototype.slice.call(document.querySelectorAll(".tools-sec[data-aba]"));
  if (!barra || secoes.length < 2) return;

  function texto(sec, sel) {
    var el = sec.querySelector(sel);
    return el ? el.textContent.trim() : "";
  }

  /* Aba "Todas" (17/11/2026): o hub. Mostra todas as seções, cada uma
     com o seu título. É a aba que o grupo Ferramentas do menu lateral
     abre (#todas) e a de quem chega sem endereço nem aba guardada. */
  var TODAS = "todas";
  var total = document.querySelectorAll(".tools-sec[data-aba] .tool-card").length;
  var bTodas = document.createElement("button");
  bTodas.type = "button";
  bTodas.className = "tools-tab";
  bTodas.id = "aba-" + TODAS;
  bTodas.setAttribute("role", "tab");
  bTodas.dataset.alvo = TODAS;
  bTodas.innerHTML = '<span>Todas</span>' + (total ? '<span class="tools-tab__count">' + total + "</span>" : "");
  barra.appendChild(bTodas);

  var abas = [bTodas].concat(secoes.map(function (sec) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "tools-tab";
    b.id = "aba-" + sec.dataset.aba;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-controls", sec.id);
    b.dataset.alvo = sec.dataset.aba;

    var nome = document.createElement("span");
    nome.textContent = texto(sec, ".tools-sec__title");
    b.appendChild(nome);

    var n = texto(sec, ".tools-sec__count");
    if (n) {
      var c = document.createElement("span");
      c.className = "tools-tab__count";
      c.textContent = n;
      b.appendChild(c);
    }

    sec.setAttribute("role", "tabpanel");
    sec.setAttribute("aria-labelledby", b.id);
    barra.appendChild(b);
    return b;
  }));

  function ativar(id, foco) {
    var achou = id === TODAS || secoes.some(function (s) { return s.dataset.aba === id; });
    if (!achou) id = TODAS;
    var todas = id === TODAS;

    secoes.forEach(function (s) { s.hidden = !todas && s.dataset.aba !== id; });
    document.documentElement.classList.toggle("tools-todas", todas);
    abas.forEach(function (b) {
      var on = b.dataset.alvo === id;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
      if (on && foco) b.focus();
    });

    if (legenda) {
      var sec = document.querySelector('.tools-sec[data-aba="' + id + '"]');
      legenda.textContent = todas ? "Todas as ferramentas do ATLAS, por grupo." : texto(sec, ".tools-sec__sub");
    }

    try { localStorage.setItem(CHAVE, id); } catch (e) { /* sem storage: tudo bem */ }
    if (location.hash.slice(1) !== id && history.replaceState) {
      history.replaceState(null, "", "#" + id);
    }
  }

  barra.addEventListener("click", function (ev) {
    var b = ev.target.closest(".tools-tab");
    if (b) ativar(b.dataset.alvo);
  });

  barra.addEventListener("keydown", function (ev) {
    if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
    var i = abas.indexOf(document.activeElement);
    if (i < 0) return;
    ev.preventDefault();
    var prox = (i + (ev.key === "ArrowRight" ? 1 : -1) + abas.length) % abas.length;
    ativar(abas[prox].dataset.alvo, true);
  });

  window.addEventListener("hashchange", function () { ativar(location.hash.slice(1)); });

  var inicial = location.hash.slice(1);
  if (!inicial) {
    try { inicial = localStorage.getItem(CHAVE) || ""; } catch (e) { inicial = ""; }
  }

  document.documentElement.classList.add("tools-com-abas");
  barra.hidden = false;
  if (legenda) legenda.hidden = false;
  ativar(inicial);
})();
