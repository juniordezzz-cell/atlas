/* ============================================================
   ATLAS · core/ui/atlas-ui.js
   ------------------------------------------------------------
   O KIT DE INTERFACE COMPARTILHADO.

   O problema
   ----------
   O ATLAS tinha CINCO implementações de toast, com três assinaturas
   diferentes — toast(msg,kind) no DeFi e no Academy, toast(title,msg,kind)
   no Hold, toast(msg) nas Configurações, mais a do RWA — e cinco CSS
   distintos, uns no canto inferior direito, outro no centro. O Trade
   não tinha toast nenhum: usava window.alert.

   E as ações destrutivas — excluir ativo, excluir tese, excluir
   registro de decisão, restaurar backup — passavam por window.confirm().
   Nada derruba mais rápido a percepção de software premium do que a
   caixa cinza do navegador. A validação de formulário era pior ainda:
   alert("Informe o ativo e o título"), que trava a tela, não aponta o
   campo errado e some sem deixar rastro.

   A solução
   ---------
   Um kit só, e ele NÃO INVENTA APARÊNCIA NOVA: reaproveita
     · as classes .awd* do diálogo de carteira (core/ui/atlas-shell.css),
       que já é a peça mais bem acabada do sistema — mesmo scrim, mesma
       caixa, mesmo fio de luz no topo, mesmos botões;
     · .is-invalid e .atlas-skeleton, que já existiam em
       themes/atlas-effects.css e nunca tinham sido usados por ninguém.

   API
   ---
     AtlasUI.toast(msg, opts)     -> {kind:"ok"|"info"|"warn"|"erro", title, duration}
     AtlasUI.confirm(opts)        -> Promise<boolean>
     AtlasUI.alert(opts)          -> Promise<void>
     AtlasUI.prompt(opts)         -> Promise<string|null>
     AtlasUI.invalid(campo, msg)  -> marca o campo e devolve false
     AtlasUI.clearInvalid(raiz)   -> limpa as marcas
     AtlasUI.skeleton(el, ligado) -> liga/desliga o esqueleto de carga

   opts do confirm/alert/prompt:
     { title, message, confirmLabel, cancelLabel, danger, placeholder,
       value, required }

   Uso:
     AtlasUI.confirm({
       title: "Excluir esta tese?",
       message: "O histórico e as versões vão junto. Não dá para desfazer.",
       confirmLabel: "Excluir", danger: true
     }).then(function (ok) { if (ok) excluir(); });

   Compatibilidade: quem chama deve sempre ter um caminho de fallback
   (`window.AtlasUI ? ... : window.confirm(...)`), para uma página que
   esqueça de carregar este arquivo não perder a função.
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasUI) return;

  function t(s) { return window.AtlasI18n ? AtlasI18n.t(s) : s; }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  var IC = {
    ok:   '<path d="M20 6 9 17l-5-5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    erro: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>'
  };
  function svg(nome) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[nome] || IC.info) + '</svg>';
  }

  /* ============================================================
     1. TOAST
     ------------------------------------------------------------
     role="status" e aria-live="polite": o leitor de tela anuncia sem
     interromper o que a pessoa está fazendo. Era o que faltava nas
     cinco versões anteriores.
     ============================================================ */

  var pilha = null;

  function container() {
    if (pilha && pilha.isConnected) return pilha;
    pilha = document.createElement("div");
    pilha.className = "atlas-toasts";
    pilha.setAttribute("role", "status");
    pilha.setAttribute("aria-live", "polite");
    /* filho direto do <body>: position:fixed deixa de valer dentro de
       qualquer ancestral com transform (a mesma armadilha documentada
       em themes/atlas-effects.css §16) */
    document.body.appendChild(pilha);
    return pilha;
  }

  function toast(msg, opts) {
    opts = opts || {};
    if (typeof opts === "string") opts = { kind: opts };   // tolera toast(msg, "ok")
    var kind = opts.kind || "ok";
    var dur = opts.duration != null ? opts.duration : 3200;

    var el = document.createElement("div");
    el.className = "atlas-toast atlas-toast--" + kind;
    el.innerHTML =
      '<span class="atlas-toast__ic">' + svg(kind) + "</span>" +
      '<span class="atlas-toast__txt">' +
        (opts.title ? '<strong>' + esc(opts.title) + "</strong>" : "") +
        "<span>" + esc(msg) + "</span>" +
      "</span>";

    container().appendChild(el);
    /* o quadro seguinte: sem isto a classe entra junto com o elemento e
       a transição de entrada não acontece */
    requestAnimationFrame(function () { el.classList.add("is-in"); });

    var timer = setTimeout(sair, dur);
    function sair() {
      clearTimeout(timer);
      el.classList.remove("is-in");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }
    el.addEventListener("click", sair);   // clicar dispensa
    return { close: sair };
  }

  /* ============================================================
     2. DIÁLOGO (confirm / alert / prompt)
     ------------------------------------------------------------
     Reaproveita as classes .awd do diálogo de carteira. Nenhum CSS de
     caixa nasce aqui.
     ============================================================ */

  var abertoAtual = null;

  function fecharAberto() {
    if (abertoAtual) abertoAtual.cancelar();
  }

  function dialogo(cfg) {
    return new Promise(function (resolve) {
      /* Um diálogo por vez. Abrir um logo após fechar outro deixava os
         dois no DOM durante a animação de saída, empilhados no mesmo
         z-index — bug já visto no diálogo de carteira. */
      fecharAberto();
      document.querySelectorAll('[data-atlas-ui="ui-dialog"]').forEach(function (n) {
        if (n.parentNode) n.parentNode.removeChild(n);
      });

      var focoAnterior = document.activeElement;

      var root = document.createElement("div");
      root.className = "awd";
      root.setAttribute("data-atlas-ui", "ui-dialog");
      root.setAttribute("role", cfg.tipo === "alert" ? "alertdialog" : "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-label", cfg.title || "");

      var temEntrada = cfg.tipo === "prompt";
      var rotuloOk = cfg.confirmLabel || (cfg.tipo === "alert" ? t("Entendi") : t("Confirmar"));
      var rotuloNao = cfg.cancelLabel || t("Cancelar");

      root.innerHTML =
        '<div class="awd__scrim"></div>' +
        '<div class="awd__box">' +
          '<div class="awd__head">' +
            '<span class="awd__scope awd__scope--' + (cfg.danger ? "isolada" : "global") + '">' +
              svg(cfg.danger ? "warn" : (cfg.tipo === "alert" ? "info" : "info")) +
              "<span>" + esc(cfg.eyebrow || (cfg.danger ? t("Atenção") : t("Confirmação"))) + "</span>" +
            "</span>" +
            '<button type="button" class="awd__x" aria-label="' + esc(t("Fechar")) + '">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
              'stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
            "</button>" +
          "</div>" +
          '<h2 class="awd__title">' + esc(cfg.title || "") + "</h2>" +
          (cfg.message ? '<p class="awd__lead">' + esc(cfg.message) + "</p>" : "") +
          (temEntrada
            ? '<label class="awd__field"><span>' + esc(cfg.label || t("Valor")) + "</span>" +
              '<input type="text" id="atlasUiInput" autocomplete="off" ' +
              'placeholder="' + esc(cfg.placeholder || "") + '" ' +
              'value="' + esc(cfg.value || "") + '"></label>'
            : "") +
          '<div class="awd__foot">' +
            (cfg.tipo === "alert" ? "" :
              '<button type="button" class="awd__btn" data-nao>' + esc(rotuloNao) + "</button>") +
            '<button type="button" class="awd__btn ' +
              (cfg.danger ? "awd__btn--danger" : "awd__btn--go") + '" data-sim>' +
              esc(rotuloOk) + "</button>" +
          "</div>" +
        "</div>";

      document.body.appendChild(root);
      requestAnimationFrame(function () { root.classList.add("is-in"); });

      var input = root.querySelector("#atlasUiInput");
      var btnSim = root.querySelector("[data-sim]");

      function terminar(valor) {
        if (abertoAtual !== api) return;
        abertoAtual = null;
        document.removeEventListener("keydown", tecla, true);
        root.classList.remove("is-in");
        setTimeout(function () { if (root.parentNode) root.parentNode.removeChild(root); }, 200);
        if (focoAnterior && focoAnterior.focus) { try { focoAnterior.focus(); } catch (e) {} }
        resolve(valor);
      }

      /* ---- Armadilha de foco ----
         Sem isto o Tab escapa do diálogo e vai navegando pela página
         ATRÁS do overlay: quem usa teclado ou leitor de tela fica
         preenchendo um formulário que não está vendo. Nenhum modal do
         sistema tinha isso. */
      function focaveis() {
        return Array.prototype.filter.call(
          root.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'),
          function (el) { return el.offsetParent !== null || el === document.activeElement; }
        );
      }

      function tecla(e) {
        if (e.key === "Escape") {
          e.preventDefault(); e.stopPropagation();
          terminar(cfg.tipo === "prompt" ? null : false);
          return;
        }
        if (e.key === "Enter" && temEntrada && e.target === input) {
          e.preventDefault(); confirmar();
          return;
        }
        if (e.key !== "Tab") return;
        var lista = focaveis();
        if (!lista.length) return;
        var primeiro = lista[0], ultimo = lista[lista.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault(); ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault(); primeiro.focus();
        } else if (!root.contains(document.activeElement)) {
          e.preventDefault(); primeiro.focus();
        }
      }

      function confirmar() {
        if (!temEntrada) { terminar(true); return; }
        var v = input.value.trim();
        if (cfg.required && !v) { invalid(input, cfg.requiredMsg || t("Preencha este campo")); return; }
        terminar(v);
      }

      var api = {
        cancelar: function () { terminar(cfg.tipo === "prompt" ? null : false); }
      };
      abertoAtual = api;

      btnSim.addEventListener("click", confirmar);
      var btnNao = root.querySelector("[data-nao]");
      if (btnNao) btnNao.addEventListener("click", api.cancelar);
      root.querySelector(".awd__x").addEventListener("click", api.cancelar);
      root.querySelector(".awd__scrim").addEventListener("click", api.cancelar);
      document.addEventListener("keydown", tecla, true);

      setTimeout(function () {
        try {
          if (input) { input.focus(); input.select(); }
          else btnSim.focus();
        } catch (e) {}
      }, 60);
    });
  }

  /* ============================================================
     3. VALIDAÇÃO DE CAMPO
     ------------------------------------------------------------
     .is-invalid já existia em themes/atlas-effects.css (borda vermelha
     + animação de shake) e NUNCA tinha sido aplicada por ninguém: toda
     validação do sistema era window.alert.
     ============================================================ */

  function invalid(campo, msg) {
    if (!campo) return false;
    campo.classList.remove("is-invalid");
    void campo.offsetWidth;            // reinicia a animação de shake
    campo.classList.add("is-invalid");
    campo.setAttribute("aria-invalid", "true");

    if (msg) {
      var alvo = campo.parentNode;
      var aviso = alvo && alvo.querySelector(".atlas-invalid-msg");
      if (!aviso && alvo) {
        aviso = document.createElement("span");
        aviso.className = "atlas-invalid-msg";
        aviso.setAttribute("role", "alert");
        alvo.appendChild(aviso);
      }
      if (aviso) aviso.textContent = msg;
    }

    try { campo.focus(); } catch (e) {}
    /* a marca some assim que a pessoa começa a corrigir — manter o
       vermelho enquanto se digita é punir quem já está resolvendo */
    campo.addEventListener("input", function limpa() {
      campo.removeEventListener("input", limpa);
      clearInvalid(campo);
    });
    return false;
  }

  function clearInvalid(raiz) {
    if (!raiz) return;
    var campos = raiz.classList && raiz.classList.contains("is-invalid")
      ? [raiz]
      : Array.prototype.slice.call(raiz.querySelectorAll ? raiz.querySelectorAll(".is-invalid") : []);
    campos.forEach(function (c) {
      c.classList.remove("is-invalid");
      c.removeAttribute("aria-invalid");
      var p = c.parentNode && c.parentNode.querySelector(".atlas-invalid-msg");
      if (p && p.parentNode) p.parentNode.removeChild(p);
    });
  }

  /* ============================================================
     4. ESQUELETO DE CARGA
     ------------------------------------------------------------
     .atlas-skeleton também já existia e nunca foi usada. Sem ela, toda
     chamada de rede do ATLAS (preço, catálogo de pools, câmbio)
     acontece em silêncio e a tela parada é lida como travada.
     ============================================================ */

  function skeleton(el, ligado) {
    if (!el) return;
    if (ligado === false) {
      el.classList.remove("atlas-skeleton");
      el.removeAttribute("aria-busy");
      if (el.dataset && el.dataset.atlasSkelTxt != null) {
        el.textContent = el.dataset.atlasSkelTxt;
        delete el.dataset.atlasSkelTxt;
      }
      return;
    }
    /* guarda o conteúdo para devolver ao desligar — sem isso o valor
       anterior se perde e a tela volta vazia se a chamada falhar */
    if (el.dataset && el.dataset.atlasSkelTxt == null) {
      el.dataset.atlasSkelTxt = el.textContent;
    }
    el.classList.add("atlas-skeleton");
    el.setAttribute("aria-busy", "true");
  }

  /* ============================================================
     5. API
     ============================================================ */

  /* ============================================================
     6. ARMADILHA DE FOCO PARA MODAIS DE TERCEIROS
     ------------------------------------------------------------
     Os diálogos DESTE kit já prendem o foco por dentro. Mas o Hold e o
     RWA têm modais próprios, anteriores ao kit, e nenhum dos dois
     prendia: com Tab o foco escapava para a página ATRÁS do overlay, e
     quem usa teclado ou leitor de tela acabava preenchendo um
     formulário que não estava vendo. Nenhum deles declarava
     role="dialog" nem aria-modal.

     Em vez de repetir a lógica em cada módulo, eles chamam isto.

       var solta = AtlasUI.trapFocus(nodeDoModal, aoFechar);
       ...
       solta();   // ao fechar: devolve o foco a quem abriu

     Marca role/aria-modal se o elemento ainda não os declarar, para o
     chamador não precisar lembrar.
     ============================================================ */
  function trapFocus(root, onEscape) {
    if (!root) return function () {};

    if (!root.getAttribute("role")) root.setAttribute("role", "dialog");
    if (!root.getAttribute("aria-modal")) root.setAttribute("aria-modal", "true");

    var anterior = document.activeElement;

    function lista() {
      return Array.prototype.filter.call(
        root.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'),
        function (el) { return !el.disabled && el.offsetParent !== null; }
      );
    }

    function onKey(e) {
      if (e.key === "Escape" && typeof onEscape === "function") {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;
      var f = lista();
      if (!f.length) return;
      var primeiro = f[0], ultimo = f[f.length - 1];
      if (!root.contains(document.activeElement)) { e.preventDefault(); primeiro.focus(); return; }
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    }

    document.addEventListener("keydown", onKey, true);

    return function soltar() {
      document.removeEventListener("keydown", onKey, true);
      /* devolver o foco é o que faz a navegação por teclado não
         recomeçar do topo da página a cada modal fechado */
      if (anterior && anterior.focus && document.contains(anterior)) {
        try { anterior.focus(); } catch (e) {}
      }
    };
  }

  window.AtlasUI = {
    toast: toast,
    trapFocus: trapFocus,
    confirm: function (o) { return dialogo(Object.assign({}, o || {}, { tipo: "confirm" })); },
    alert:   function (o) { return dialogo(Object.assign({}, o || {}, { tipo: "alert" })); },
    prompt:  function (o) { return dialogo(Object.assign({}, o || {}, { tipo: "prompt" })); },
    invalid: invalid,
    clearInvalid: clearInvalid,
    skeleton: skeleton,
    closeDialog: fecharAberto
  };
})();
