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
  /* Uma frase por módulo, para o mapa do Início. */
  var PROMESSAS = [
    "Da cifra de César à chave da sua carteira: hash, assinatura e frase de recuperação.",
    "Blocos ligados por hash, mineração de verdade, validadores e reorganizações.",
    "Token verdadeiro × golpe, custódia, hardware wallet, aprovações e FDV.",
    "Gasto duplo, troco e taxa em sat/vB, halving, RBF e Lightning.",
    "Como um contrato funciona, quanto custa, quando reverte e como é atacado.",
    "Juros por utilização, health factor, liquidação, AMM e impermanent loss.",
    "Paridade, reservas, depeg e por que algumas stablecoins quebram.",
    "Títulos, imóveis e ouro em token: o que fica fora da rede.",
    "Reserva, quedas, diversificação de verdade e tamanho de posição.",
    "Como o dinheiro nasce, circula e onde a blockchain muda o jogo."
  ];
  /* Contados do conteúdo do curso em 21/10/2026 (content/m1.js … m10.js).
     Atualize se aulas forem acrescentadas. */
  var NUMEROS = [["10", "módulos"], ["132", "aulas"], ["60", "simulações e cenas 3D"], ["99", "fontes"], ["~10 h", "de estudo"]];

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
    if (n1) n1.textContent = "10 módulos · 132 aulas · " + feitos + " concluídos";

    vitrine(prog);
  }

  /* Faixa de números, mapa dos módulos e trilha (botões e, com WebGL, 3D). */
  function el(tag, cls, texto) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto != null) e.textContent = texto;
    return e;
  }
  function vitrine(prog) {
    var feitos = prog.completed.concat(prog.studied);
    var nums = document.querySelector(".ac-numeros");
    if (nums && !nums.children.length) NUMEROS.forEach(function (n) {
      var li = el("li"); li.append(el("strong", null, n[0]), el("span", null, n[1])); nums.append(li);
    });
    var mapa = document.querySelector(".ac-mapa");
    if (mapa && !mapa.children.length) MODULOS.forEach(function (t, i) {
      var id = "m" + (i + 1), a = el("a", "ac-mod");
      a.href = CURSO + "#" + id;
      var topo = el("span", "ac-mod-topo");
      topo.append(el("span", "ac-mod-n", String(i + 1).padStart(2, "0")),
        el("span", "ac-mod-st", prog.completed.indexOf(id) !== -1 ? "✓ concluído" : feitos.indexOf(id) !== -1 ? "estudado" : ""));
      a.append(topo, el("b", null, t), el("span", "ac-mod-p", PROMESSAS[i]));
      mapa.append(a);
    });
    var plano = document.querySelector(".ac-trilha-plano");
    if (plano && !plano.children.length) MODULOS.forEach(function (t, i) {
      var id = "m" + (i + 1), li = el("li"), a = el("a", "ac-bloco" + (feitos.indexOf(id) !== -1 ? " feito" : id === prog.last && prog.aberto ? " atual" : ""), String(i + 1).padStart(2, "0"));
      a.href = CURSO + "#" + id; a.title = String(i + 1).padStart(2, "0") + " · " + t; a.setAttribute("aria-label", "Módulo " + (i + 1) + ": " + t);
      li.append(a); plano.append(li);
    });
    trilha3d(prog, feitos);
  }
  function webgl() {
    try { var c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); } catch (e) { return false; }
  }
  function trilha3d(prog, feitos) {
    var caixa = document.getElementById("ac-trilha");
    if (!caixa || caixa.dataset.montado || !webgl()) return;
    caixa.dataset.montado = "1";
    caixa.classList.add("com-3d");
    var nome = caixa.querySelector(".ac-trilha-nome");
    import("../nivel-1/curso/assets/js/academy-3d.js").then(function (m) {
      m.trilha(caixa.querySelector(".ac-trilha-canvas"), {
        modulos: MODULOS.map(function (t, i) { return { id: "m" + (i + 1), title: t }; }),
        feitos: feitos, atual: prog.aberto ? prog.last : "m1",
        aoEscolher: function (i) { location.href = CURSO + "#m" + (i + 1); },
        aoPassar: function (i) { if (nome) nome.textContent = i < 0 ? "Arraste para girar. Clique num bloco para abrir o módulo." : String(i + 1).padStart(2, "0") + " · " + MODULOS[i]; }
      });
    }).catch(function () { caixa.classList.remove("com-3d"); });
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
