/* ============================================================
   ATLAS · core/ui/atlas-onboarding.js
   Os três passos da primeira sessão.

   POR QUE ISTO EXISTE
   -------------------
   O ATLAS já tinha um roteiro de início no Dashboard (item 2.3): quando
   não há nada registrado, o painel dá lugar a quatro cartões dizendo por
   onde começar. Isso resolve "o que eu faço agora".

   Não resolve o que vem ANTES disso. Na primeira sessão o sistema chama
   o usuário de "Gestor ATLAS", mostra tudo em dólar sem explicar por quê,
   e a carteira onde tudo vai ser lançado chama-se "Principal" porque
   alguém escolheu por ele. São três decisões pequenas que, tomadas em
   silêncio, fazem o produto parecer um modelo em vez de um sistema.

   São exatamente três porque três é o que se responde sem desistir — e
   porque só existem três coisas que o ATLAS não consegue inferir sozinho:

     1. o NOME de quem opera        → saudação, relatórios, exportações
     2. a MOEDA de exibição         → o dado é sempre USD; isto é leitura
     3. o NOME da primeira carteira → o balde onde tudo vai ser lançado

   Nada aqui é obrigatório: pular mantém os padrões e não pergunta de
   novo. O roteiro do Dashboard continua sendo o quarto passo natural,
   e por isso este fluxo NÃO repete o "comece por um módulo".

   ONDE FICA GUARDADO
   ------------------
   "Já respondeu" é FATO, não preferência — mesma decisão do intro. Vai
   numa chave própria (atlas.onboarding.v1), fora do objeto de settings,
   para não ser exportado como se fosse escolha nem desfeito por
   "Restaurar padrões". O que o usuário RESPONDEU, esse sim, vai para os
   lugares de sempre: o nome no Hold, a moeda em AtlasSettings, o nome da
   carteira em AtlasWallets. Nenhum dado novo, nenhuma segunda fonte.

   COMO USAR
   ---------
     AtlasOnboarding.maybeStart();   // só age na primeira sessão
     AtlasOnboarding.start();        // força (usado por Configurações)
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasOnboarding) return;

  var KEY = "atlas.onboarding.v1";
  var HOLD_KEY = "atlas.hold.state.v2";

  function jaRespondeu() {
    try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; }
  }
  function marcarRespondido() {
    try { localStorage.setItem(KEY, "1"); } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- leitura do que já existe ---------- */

  function nomeAtual() {
    try {
      var raw = localStorage.getItem(HOLD_KEY);
      if (!raw) return "";
      var n = String((JSON.parse(raw).config || {}).nome_gestor || "").trim();
      return (n === "Gestor HOLD" || n === "Gestor ATLAS") ? "" : n;
    } catch (e) { return ""; }
  }

  /* O nome vive no estado do Hold porque é lá que ele sempre viveu —
     core/settings.js apenas o LÊ (ver profile()). Duplicá-lo nas
     preferências criaria dois lugares de verdade divergindo em silêncio,
     que é o defeito que a moeda do DeFi tinha. */
  function gravarNome(nome) {
    nome = String(nome || "").trim();
    if (!nome) return false;
    try {
      var st = JSON.parse(localStorage.getItem(HOLD_KEY) || "{}");
      st.config = st.config || {};
      st.config.nome_gestor = nome;
      localStorage.setItem(HOLD_KEY, JSON.stringify(st));
      return true;
    } catch (e) { return false; }
  }

  /* A carteira a renomear é a GLOBAL ativa: é ela que soma no patrimônio
     total e que os módulos usam por padrão. AtlasWallets expõe all() e
     globals() — não list(). */
  function carteiraPadrao() {
    if (!window.AtlasWallets) return null;
    try {
      if (AtlasWallets.activeGlobal) {
        var ativa = AtlasWallets.activeGlobal();
        if (ativa) return ativa;
      }
      var globais = AtlasWallets.globals ? (AtlasWallets.globals() || []) : [];
      if (globais.length) return globais[0];
      var todas = AtlasWallets.all ? (AtlasWallets.all() || []) : [];
      return todas[0] || null;
    } catch (e) { return null; }
  }

  /* ---------- os três passos ---------- */

  var MOEDAS = [
    { code: "BRL", rotulo: "Real",  exemplo: "R$ 5.412,90" },
    { code: "USD", rotulo: "Dólar", exemplo: "US$ 1.000,00" },
    { code: "EUR", rotulo: "Euro",  exemplo: "€ 918,40" }
  ];

  function passos() {
    var carteira = carteiraPadrao();
    return [
      {
        id: "nome",
        eyebrow: "Passo 1 de 3",
        titulo: "Como devemos chamar você?",
        lead: "Aparece na saudação do painel e assina os relatórios que você exportar.",
        campo: { tipo: "texto", placeholder: "Seu nome", valor: nomeAtual(), rotulo: "Nome" },
        nota: "Fica só neste navegador, como todo o resto dos seus dados.",
        salvar: function (v) { gravarNome(v); }
      },
      {
        id: "moeda",
        eyebrow: "Passo 2 de 3",
        titulo: "Em que moeda você quer ler os números?",
        lead: "O ATLAS guarda tudo em dólar, sempre — misturar bases de moeda no " +
              "armazenamento é como um sistema financeiro se corrompe em silêncio. " +
              "A moeda escolhida aqui é a de LEITURA: converte na hora de mostrar, " +
              "nunca na hora de gravar.",
        campo: { tipo: "opcoes", opcoes: MOEDAS, valor: (window.AtlasSettings ? AtlasSettings.get("currency") : "USD") },
        nota: "Dá para trocar quando quiser, em Configurações.",
        salvar: function (v) { if (window.AtlasSettings) AtlasSettings.set("currency", v); }
      },
      {
        id: "carteira",
        eyebrow: "Passo 3 de 3",
        titulo: "Como se chama a sua carteira principal?",
        lead: "É onde os lançamentos entram por padrão. Carteira global soma no " +
              "patrimônio total; depois você pode criar outras, inclusive isoladas " +
              "por módulo.",
        campo: {
          tipo: "texto",
          placeholder: carteira ? carteira.name : "Principal",
          valor: (carteira && carteira.name !== "Principal") ? carteira.name : "",
          rotulo: "Nome da carteira"
        },
        nota: "Sem ideia agora? Deixe em branco — “" + esc(carteira ? carteira.name : "Principal") + "” continua valendo.",
        salvar: function (v) {
          v = String(v || "").trim();
          if (!v || !carteira || !window.AtlasWallets) return;
          AtlasWallets.rename(carteira.id, v);
        }
      }
    ];
  }

  /* ---------- a tela ---------- */

  var raiz = null;
  var indice = 0;
  var lista = [];
  var respostas = {};
  var liberarFoco = null;

  function fechar(concluiu) {
    if (!raiz) return;
    if (liberarFoco) { try { liberarFoco(); } catch (e) {} liberarFoco = null; }
    if (raiz.parentNode) raiz.parentNode.removeChild(raiz);
    raiz = null;
    marcarRespondido();

    /* O Dashboard mostra saudação, moeda e carteira. Se ele estiver na
       tela, repinta — senão o usuário responde três perguntas e não vê
       nada mudar, que é a pior sensação possível num onboarding. */
    if (concluiu && window.AtlasDashboard && AtlasDashboard.repintar) {
      try { AtlasDashboard.repintar(); } catch (e) {}
    }
    if (concluiu && window.AtlasUI && AtlasUI.toast) {
      AtlasUI.toast({ tipo: "ok", texto: "Pronto. O ATLAS é seu." });
    }
  }

  function campoHtml(campo) {
    if (campo.tipo === "opcoes") {
      return '<div class="aonb__opcoes" role="radiogroup">' +
        campo.opcoes.map(function (o) {
          var on = o.code === campo.valor;
          return '<button type="button" class="aonb__opcao" role="radio" ' +
                 'aria-checked="' + (on ? "true" : "false") + '" data-valor="' + esc(o.code) + '">' +
                   '<span class="aonb__opcao-cod">' + esc(o.code) + '</span>' +
                   '<span class="aonb__opcao-nome">' + esc(o.rotulo) + '</span>' +
                   '<span class="aonb__opcao-ex">' + esc(o.exemplo) + '</span>' +
                 '</button>';
        }).join("") +
      '</div>';
    }
    return '<label class="aonb__campo"><span>' + esc(campo.rotulo || "") + '</span>' +
             '<input type="text" autocomplete="off" placeholder="' + esc(campo.placeholder || "") + '" ' +
             'value="' + esc(campo.valor || "") + '"></label>';
  }

  function pintar() {
    var p = lista[indice];
    var ultimo = indice === lista.length - 1;

    /* Quem volta um passo tem de reencontrar o que respondeu. campo.valor
       é só o ponto de partida — a partir do primeiro "Continuar" a
       verdade está em respostas[]. Sem isto, voltar apagava a escolha em
       silêncio e o usuário concluía com o valor de fábrica. */
    if (respostas[p.id] !== undefined && respostas[p.id] !== "") {
      p.campo.valor = respostas[p.id];
    }

    raiz.querySelector(".aonb__box").innerHTML =
      '<div class="aonb__trilha" aria-hidden="true">' +
        lista.map(function (_, i) {
          return '<span class="aonb__marca' + (i <= indice ? " is-on" : "") + '"></span>';
        }).join("") +
      '</div>' +
      '<span class="aonb__eyebrow">' + esc(p.eyebrow) + '</span>' +
      '<h2 class="aonb__titulo">' + esc(p.titulo) + '</h2>' +
      '<p class="aonb__lead">' + esc(p.lead) + '</p>' +
      campoHtml(p.campo) +
      '<p class="aonb__nota">' + p.nota + '</p>' +
      '<div class="aonb__foot">' +
        '<button type="button" class="aonb__pular" data-pular>Pular por agora</button>' +
        (indice > 0 ? '<button type="button" class="aonb__btn" data-voltar>Voltar</button>' : "") +
        '<button type="button" class="aonb__btn aonb__btn--go" data-avancar>' +
          (ultimo ? "Concluir" : "Continuar") +
        '</button>' +
      '</div>';

    var input = raiz.querySelector(".aonb__campo input");
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); avancar(); }
      });
      setTimeout(function () { try { input.focus(); } catch (e) {} }, 30);
    }

    var opcoes = raiz.querySelectorAll(".aonb__opcao");
    Array.prototype.forEach.call(opcoes, function (b) {
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(opcoes, function (o) { o.setAttribute("aria-checked", "false"); });
        b.setAttribute("aria-checked", "true");
      });
    });

    raiz.querySelector("[data-avancar]").addEventListener("click", avancar);
    raiz.querySelector("[data-pular]").addEventListener("click", function () { fechar(false); });
    var voltar = raiz.querySelector("[data-voltar]");
    if (voltar) voltar.addEventListener("click", function () { guardar(); indice--; pintar(); });
  }

  function valorAtual() {
    var input = raiz.querySelector(".aonb__campo input");
    if (input) return input.value;
    var marcado = raiz.querySelector('.aonb__opcao[aria-checked="true"]');
    return marcado ? marcado.getAttribute("data-valor") : "";
  }

  /* Guarda em memória, não em disco. Só grava no fim — assim quem volta
     um passo ou desiste no meio não deixa metade de uma resposta. */
  function guardar() { respostas[lista[indice].id] = valorAtual(); }

  function avancar() {
    guardar();
    if (indice < lista.length - 1) { indice++; pintar(); return; }
    lista.forEach(function (p) {
      if (respostas[p.id] !== undefined) {
        try { p.salvar(respostas[p.id]); } catch (e) {}
      }
    });
    fechar(true);
  }

  function start() {
    if (raiz) return;
    lista = passos();
    indice = 0;
    respostas = {};

    raiz = document.createElement("div");
    raiz.className = "aonb";
    raiz.setAttribute("data-atlas-ui", "onboarding");
    raiz.innerHTML =
      '<div class="aonb__scrim"></div>' +
      '<div class="aonb__box" role="dialog" aria-modal="true" aria-label="Primeiros passos"></div>';
    document.body.appendChild(raiz);

    pintar();

    /* Escape fecha, como em qualquer diálogo do sistema. Fechar por
       Escape é PULAR, não concluir: nada é gravado. */
    raiz.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); fechar(false); }
    });
    if (window.AtlasUI && AtlasUI.trapFocus) {
      liberarFoco = AtlasUI.trapFocus(raiz.querySelector(".aonb__box"));
    }
  }

  function maybeStart() {
    if (jaRespondeu()) return false;
    /* Sem AtlasSettings não há onde gravar a moeda, e sem body não há
       onde montar. Em vez de meio onboarding, nenhum. */
    if (!window.AtlasSettings || !document.body) return false;
    start();
    return true;
  }

  window.AtlasOnboarding = {
    start: start,
    maybeStart: maybeStart,
    respondido: jaRespondeu,
    /* Configurações usa para oferecer "rever os primeiros passos". */
    reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} }
  };
})();
