/* ATLAS · Academy — abas e "continue de onde parou" (20/10/2026).
   O progresso do curso vem do mesmo armazenamento que o curso usa
   (atlas-academy-v1, mesma origem). Nada aqui grava dado.
   Os títulos repetem os de nivel-1/curso/assets/js/course.js: carregar
   aquele arquivo aqui traria 69 KB e declararia COURSE/SOURCES no
   escopo global do ATLAS só para ler dez nomes. */
(function () {
  "use strict";
  var ABAS = ["inicio", "cursos", "artigos", "links", "papers"];
  var CURSO = "nivel-1/";
  var MODULOS = ["Criptografia", "Blockchain", "Criptomoedas e carteiras", "Bitcoin",
    "Smart contracts e Web3", "DeFi", "Stablecoins", "RWA e tokenização",
    "Investimentos e gestão de risco", "Sistema financeiro global"];

  function lerProgresso() {
    var vazio = { aberto: false, completed: [], studied: [], scores: {}, last: "m1" };
    try {
      var s = JSON.parse(localStorage.getItem("atlas-academy-v1"));
      if (s && s.version === 1) return {
        aberto: true,
        completed: Array.isArray(s.completed) ? s.completed : [],
        studied: Array.isArray(s.studied) ? s.studied : [],
        scores: s.scores && typeof s.scores === "object" ? s.scores : {},
        last: typeof s.last === "string" && /^m\d+$/.test(s.last) ? s.last : "m1"
      };
    } catch (e) {}
    return vazio;
  }

  function abrir(aba, trocarEndereco) {
    if (ABAS.indexOf(aba) === -1) aba = "inicio";
    ABAS.forEach(function (id) {
      var b = document.getElementById("ac-tab-" + id);
      var p = document.getElementById("ac-pane-" + id);
      var on = id === aba;
      if (b) { b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; }
      if (p) p.hidden = !on;
    });
    if (trocarEndereco && location.hash !== "#" + aba) history.replaceState(null, "", "#" + aba);
  }

  function preencher() {
    var prog = lerProgresso();
    var feitos = prog.completed.length;
    /* Abrir qualquer módulo já grava o progresso (last); basta isso. */
    var comecou = prog.aberto;
    var n = Number(prog.last.slice(1));
    var mod = n >= 1 && n <= MODULOS.length ? { n: n, m: { id: prog.last, title: MODULOS[n - 1] } } : null;

    var titulo = document.getElementById("ac-continue-title");
    var detalhe = document.getElementById("ac-continue-detail");
    var botao = document.getElementById("ac-continue-btn");
    var barra = document.getElementById("ac-continue-bar");
    if (comecou && mod) {
      titulo.textContent = "Módulo " + String(mod.n).padStart(2, "0") + " · " + mod.m.title;
      detalhe.textContent = "Nível 1 · " + feitos + " de 10 módulos concluídos";
      botao.textContent = "Continuar →";
      botao.href = CURSO + "#" + mod.m.id;
    } else {
      titulo.textContent = "Comece pelo Nível 1";
      detalhe.textContent = "Trilha de criptoeconomia · 10 módulos, do básico em diante";
      botao.textContent = "Começar →";
      botao.href = CURSO;
    }
    barra.style.width = Math.round(feitos / 10 * 100) + "%";

    var n1 = document.getElementById("ac-level1-detail");
    if (n1) n1.textContent = "10 módulos · " + feitos + " concluídos";
  }

  function iniciar() {
    ABAS.forEach(function (id) {
      var b = document.getElementById("ac-tab-" + id);
      if (b) b.addEventListener("click", function () { abrir(id, true); });
    });
    document.querySelectorAll("[data-ac-ir]").forEach(function (el) {
      el.addEventListener("click", function () { abrir(el.getAttribute("data-ac-ir"), true); });
    });
    var lista = document.querySelector(".ac-tabs[role=tablist]");
    if (lista) lista.addEventListener("keydown", function (e) {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(e.key) === -1) return;
      var atual = ABAS.indexOf(String(e.target.id || "").replace("ac-tab-", ""));
      if (atual === -1) return;
      e.preventDefault();
      var n = e.key === "Home" ? 0 : e.key === "End" ? ABAS.length - 1 :
        (atual + (e.key === "ArrowRight" ? 1 : -1) + ABAS.length) % ABAS.length;
      abrir(ABAS[n], true);
      document.getElementById("ac-tab-" + ABAS[n]).focus();
    });
    window.addEventListener("hashchange", function () { abrir(location.hash.slice(1), false); });
    abrir(location.hash.slice(1) || "inicio", false);
    preencher();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
