/* ==========================================================================
   ATLASfinances — js/boot.js
   Orquestra a tela de boot da ABERTURA do app: preenche a barra por etapas,
   troca o texto de status e, ao chegar em 100%, revela o app por trás.

   Regras:
   · Só existe em index.html (a tela de abertura / start_url do PWA).
   · Roda UMA vez por sessão: voltar para "Início" dentro do app não
     repete a splash (sessionStorage). Cada vez que o app é aberto de
     novo (nova sessão) ela aparece — comportamento de splash de app.
   · Respeita prefers-reduced-motion: revela quase na hora, sem etapas.
   · Sem dependências, sem rede.
   ========================================================================== */
(function () {
  "use strict";
  var boot = document.getElementById("fxBoot");
  if (!boot) return;

  var bar = document.getElementById("fxBootBar");
  var pct = document.getElementById("fxBootPct");
  var status = document.getElementById("fxBootStatus");

  var JA_ABRIU = "atlasfinances-booted";
  var root = document.documentElement;

  function revelar() {
    boot.classList.add("is-done");
    root.classList.remove("boot-lock");
    /* Depois do fade, tira do fluxo e do leitor de tela. */
    setTimeout(function () { boot.hidden = true; }, 520);
  }

  /* Já rodou nesta sessão? Então nem mostra — o app aparece direto. */
  var jaRodou = false;
  try { jaRodou = sessionStorage.getItem(JA_ABRIU) === "1"; } catch (e) {}
  if (jaRodou) { boot.hidden = true; return; }

  root.classList.add("boot-lock");
  try { sessionStorage.setItem(JA_ABRIU, "1"); } catch (e) {}

  var reduzido = window.matchMedia &&
                 window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduzido) {
    if (bar) bar.style.width = "100%";
    if (pct) pct.textContent = "100%";
    setTimeout(revelar, 500);
    return;
  }

  /* Etapas (rótulo · % alvo · duração). Total ≈ 3,2s — splash de app é
     curta de propósito; o boot de 7s é do site, não daqui. */
  var STEPS = [
    { label: "Ligando sistema…",        to: 18,  dur: 420 },
    { label: "Carregando o painel…",    to: 46,  dur: 620 },
    { label: "Somando o mês…",          to: 72,  dur: 620 },
    { label: "Preparando gráficos…",    to: 92,  dur: 520 },
    { label: "Pronto.",                 to: 100, dur: 360 }
  ];

  var i = 0;
  function proxima() {
    if (i >= STEPS.length) { setTimeout(revelar, 260); return; }
    var s = STEPS[i++];
    if (status) status.textContent = s.label;
    if (bar) bar.style.width = s.to + "%";
    if (pct) pct.textContent = s.to + "%";
    setTimeout(proxima, s.dur);
  }
  /* dá um tique pra primeira transição de largura pegar */
  setTimeout(proxima, 60);
})();
