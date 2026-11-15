/* ============================================================
   ATLAS · Ferramentas — abas dos grupos (15/11/2026)

   Monta as abas (Gerir o dinheiro, Planejar…, DeFi e renda, Estudar o
   mercado) a partir das <section class="tools-sec" id="…"> da página:
   o nome vem do .tools-sec__title, o número do .tools-sec__count e a
   frase de apoio do .tools-sec__sub. Só a seção da aba ativa aparece.

   - O endereço guarda a aba (#defi), então dá para mandar o link direto.
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
  var secoes = Array.prototype.slice.call(document.querySelectorAll(".tools-sec[id]"));
  if (!barra || secoes.length < 2) return;

  function texto(sec, sel) {
    var el = sec.querySelector(sel);
    return el ? el.textContent.trim() : "";
  }

  var abas = secoes.map(function (sec) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "tools-tab";
    b.id = "aba-" + sec.id;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-controls", sec.id);
    b.dataset.alvo = sec.id;

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
  });

  function ativar(id, foco) {
    var achou = secoes.some(function (s) { return s.id === id; });
    if (!achou) id = secoes[0].id;

    secoes.forEach(function (s) { s.hidden = s.id !== id; });
    abas.forEach(function (b) {
      var on = b.dataset.alvo === id;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
      if (on && foco) b.focus();
    });

    if (legenda) {
      var sec = document.getElementById(id);
      legenda.textContent = texto(sec, ".tools-sec__sub");
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
