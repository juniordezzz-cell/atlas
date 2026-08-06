/* ============================================================
   ATLAS · wallets/walletDialog.js
   ------------------------------------------------------------
   DIÁLOGO ÚNICO DE CARTEIRA.

   Antes existiam três jeitos de criar uma carteira:
     · DeFi      → window.prompt() (a caixa cinza do navegador)
     · Hold      → modal próprio
     · Dashboard → outro modal
   Três aparências, três códigos, três lugares para corrigir.
   Agora é um só, e é este.

   O diálogo abre no centro da tela, escurece o fundo, deixa
   escolher um emoji para a carteira e explica em uma linha a
   diferença entre Global e Local — que é a decisão que a pessoa
   realmente precisa entender antes de confirmar.

   Uso
   ---
     AtlasWalletDialog.open({
       mode: "create" | "rename",      // padrão: create
       type: "global" | "isolada",
       module: "defi",                 // só quando isolada
       wallet: w,                      // obrigatório no rename
       onConfirm: function (dados) {   // {name, emoji, type, module}
         ...
       }
     });

     AtlasWalletDialog.confirmDelete(wallet, function () { ... });

   Criar, renomear e excluir passam TODOS por aqui. Nenhum módulo
   abre prompt, confirm ou modal próprio de carteira.
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasWalletDialog) return;

  var W = null;              // AtlasWallets, resolvido na hora de abrir
  var aberto = null;         // nó do diálogo em cena
  var focoAnterior = null;

  function t(s) { return window.AtlasI18n ? AtlasI18n.t(s) : s; }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ------------------------------------------------------------
     Texto que explica o escopo.
     Isto não é enfeite: é a única coisa que a pessoa não consegue
     descobrir sozinha depois de criar a carteira.
     ------------------------------------------------------------ */
  function explicacao(type, module, modo) {
    var renomeando = modo === "rename";
    if (type === "isolada") {
      return {
        titulo: renomeando ? t("Renomear carteira") : t("Nova carteira Local"),
        escopo: t("Local"),
        linha: t("Vive só dentro do módulo") + (module ? " " + module.toUpperCase() : "") +
               ". " + t("Não entra no patrimônio total do ATLAS.")
      };
    }
    return {
      titulo: renomeando ? t("Renomear carteira") : t("Nova carteira Global"),
      escopo: t("Global"),
      linha: t("Aparece em todos os módulos e soma no patrimônio total do ATLAS.")
    };
  }

  function fechar() {
    if (!aberto) return;
    var n = aberto;
    aberto = null;
    n.classList.remove("is-in");
    setTimeout(function () {
      if (n.parentNode) n.parentNode.removeChild(n);
      if (focoAnterior && focoAnterior.focus) { try { focoAnterior.focus(); } catch (e) {} }
      focoAnterior = null;
    }, 180);
    document.removeEventListener("keydown", aoTeclar, true);
  }

  function aoTeclar(e) {
    if (!aberto) return;
    if (e.key === "Escape") { e.preventDefault(); fechar(); }
  }

  var segCssDone = false;
  function injectSegCSS() {
    if (segCssDone || !document.head) return;
    segCssDone = true;
    if (document.getElementById("awd-seg-css")) return;
    var s = document.createElement("style");
    s.id = "awd-seg-css";
    s.textContent = [
      ".awd__seg{display:flex;gap:6px;margin:14px 0 4px;padding:4px;",
        "background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;}",
      ".awd__seg-opt{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;",
        "padding:9px 10px;border:0;border-radius:9px;cursor:pointer;background:transparent;",
        "color:#9aa7bd;font-size:13px;font-weight:600;transition:background .12s ease,color .12s ease;}",
      ".awd__seg-opt:hover{color:#cdd6e6;}",
      ".awd__seg-opt.on{background:rgba(76,154,255,.16);color:#7FB4FF;}",
      ".awd__seg-opt svg{flex:none;}"
    ].join("");
    document.head.appendChild(s);
  }

  function open(opts) {
    opts = opts || {};
    W = window.AtlasWallets;
    if (aberto) fechar();
    injectSegCSS();

    /* Renomear usa a MESMA caixa de criar \u2014 mesmo campo de nome, mesma
       paleta de \u00EDcones, mesma tipografia. A diferen\u00E7a \u00E9 s\u00F3 o que j\u00E1 vem
       preenchido, o t\u00EDtulo e o r\u00F3tulo do bot\u00E3o. Um di\u00E1logo, n\u00E3o dois. */
    var modo = opts.mode === "rename" ? "rename" : "create";
    var alvo = opts.wallet || null;
    if (modo === "rename" && !alvo) return null;

    /* no rename o tipo \u00E9 o que a carteira j\u00E1 \u00E9, e n\u00E3o muda:
       trocar global\u2194local depois de criada mudaria o dono dos dados */
    var allowLocal = modo === "create" && !!opts.allowLocal;
    var currentType = modo === "rename"
      ? (alvo.type === "isolada" ? "isolada" : "global")
      : (opts.type === "isolada" ? "isolada" : "global");
    var info = explicacao(currentType, modo === "rename" ? alvo.module : opts.module, modo);
    var grupos = (W && W.iconGroups) ? W.iconGroups()
               : [{ label: "", items: (W && W.emojiSet ? W.emojiSet() : ["\uD83C\uDF10"]) }];
    var escolhido = (modo === "rename" && alvo.emoji) ? alvo.emoji : grupos[0].items[0];

    /* Se ainda houver um diálogo saindo de cena (a saída leva 180ms),
       remove na hora. Sem isso os dois ficam empilhados no mesmo
       z-index e o antigo aparece por cima do novo. */
    var restos = document.querySelectorAll('[data-atlas-ui="wallet-dialog"]');
    Array.prototype.forEach.call(restos, function (n) {
      if (n.parentNode) n.parentNode.removeChild(n);
    });

    focoAnterior = document.activeElement;

    var root = document.createElement("div");
    root.className = "awd";
    root.setAttribute("data-atlas-ui", "wallet-dialog");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", info.titulo);

    root.innerHTML =
      '<div class="awd__scrim"></div>' +
      '<div class="awd__box">' +
        '<div class="awd__head">' +
          '<span class="awd__scope awd__scope--' + currentType + '" id="awdScope">' +
            (W && W.typeIcon ? W.typeIcon(currentType, 15) : "") +
            '<span id="awdScopeTxt">' + esc(info.escopo) + '</span>' +
          '</span>' +
          '<button type="button" class="awd__x" aria-label="' + esc(t("Fechar")) + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
            'stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>' +

        (allowLocal ?
          '<div class="awd__seg" role="tablist" aria-label="' + esc(t("Tipo de carteira")) + '">' +
            '<button type="button" class="awd__seg-opt' + (currentType === "global" ? " on" : "") + '" data-type="global">' +
              (W && W.typeIcon ? W.typeIcon("global", 14) : "") + '<span>Global</span>' +
            '</button>' +
            '<button type="button" class="awd__seg-opt' + (currentType === "isolada" ? " on" : "") + '" data-type="isolada">' +
              (W && W.typeIcon ? W.typeIcon("isolada", 14) : "") + '<span>Local</span>' +
            '</button>' +
          '</div>'
        : "") +

        '<h2 class="awd__title" id="awdTitle">' + esc(info.titulo) + '</h2>' +
        '<p class="awd__lead" id="awdLead">' + esc(info.linha) + '</p>' +

        '<div class="awd__preview">' +
          '<span class="awd__badge" id="awdBadge">' + escolhido + '</span>' +
          '<span class="awd__preview-txt" id="awdPreview">' + esc(t("Sem nome")) + '</span>' +
        '</div>' +

        '<label class="awd__field">' +
          '<span>' + esc(t("Nome da carteira")) + '</span>' +
          '<input type="text" id="awdName" maxlength="32" autocomplete="off" ' +
                 'value="' + esc(modo === "rename" ? alvo.name : "") + '" ' +
                 'placeholder="' + esc(t("Ex.: Reserva longo prazo")) + '">' +
        '</label>' +

        '<div class="awd__field">' +
          '<span>' + esc(t("Ícone")) + '</span>' +
          '<div class="awd__groups" id="awdEmojis">' +
            grupos.map(function (g, gi) {
              return (g.label ? '<div class="awd__group-lb">' + esc(g.label) + '</div>' : "") +
                '<div class="awd__emojis">' +
                g.items.map(function (e, i) {
                  var marcado = (modo === "rename" && alvo.emoji)
                    ? (e === alvo.emoji)
                    : (gi === 0 && i === 0);
                  return '<button type="button" class="awd__emoji' + (marcado ? " on" : "") +
                         '" data-e="' + esc(e) + '">' + esc(e) + '</button>';
                }).join("") +
                '</div>';
            }).join("") +
          '</div>' +
        '</div>' +

        '<div class="awd__foot">' +
          '<button type="button" class="awd__btn" id="awdCancel">' + esc(t("Cancelar")) + '</button>' +
          '<button type="button" class="awd__btn awd__btn--go" id="awdOk" disabled>' +
            esc(modo === "rename" ? t("Salvar") : t("Criar carteira")) + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(root);
    aberto = root;
    // força um frame antes de animar a entrada
    requestAnimationFrame(function () { root.classList.add("is-in"); });
    document.addEventListener("keydown", aoTeclar, true);

    var input   = root.querySelector("#awdName");
    var badge   = root.querySelector("#awdBadge");
    var preview = root.querySelector("#awdPreview");
    var btnOk   = root.querySelector("#awdOk");

    function atualizar() {
      var v = input.value.trim();
      preview.textContent = v || t("Sem nome");
      preview.classList.toggle("is-empty", !v);
      btnOk.disabled = !v;
    }

    input.addEventListener("input", atualizar);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && input.value.trim()) { e.preventDefault(); confirmar(); }
    });

    root.querySelector("#awdEmojis").addEventListener("click", function (e) {
      var b = e.target.closest(".awd__emoji");
      if (!b) return;
      root.querySelectorAll(".awd__emoji").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      escolhido = b.getAttribute("data-e");
      badge.textContent = escolhido;
      badge.classList.remove("pop");
      void badge.offsetWidth;          // reinicia a animação
      badge.classList.add("pop");
    });

    /* ---- chavinha Global/Local: troca o tipo e reescreve o texto ---- */
    function aplicarTipo(novo) {
      currentType = novo === "isolada" ? "isolada" : "global";
      var info2 = explicacao(currentType, opts.module);
      var scope = root.querySelector("#awdScope");
      var scopeTxt = root.querySelector("#awdScopeTxt");
      var titleEl = root.querySelector("#awdTitle");
      var leadEl = root.querySelector("#awdLead");
      if (scope) {
        scope.className = "awd__scope awd__scope--" + currentType;
        scope.innerHTML = (W && W.typeIcon ? W.typeIcon(currentType, 15) : "") +
          '<span id="awdScopeTxt">' + esc(info2.escopo) + '</span>';
      }
      if (scopeTxt) scopeTxt.textContent = info2.escopo;
      if (titleEl) titleEl.textContent = info2.titulo;
      if (leadEl) leadEl.textContent = info2.linha;
      root.querySelectorAll(".awd__seg-opt").forEach(function (x) {
        x.classList.toggle("on", x.getAttribute("data-type") === currentType);
      });
    }
    if (allowLocal) {
      root.querySelectorAll(".awd__seg-opt").forEach(function (b2) {
        b2.addEventListener("click", function () { aplicarTipo(b2.getAttribute("data-type")); });
      });
    }

    function confirmar() {
      var nome = input.value.trim();
      if (!nome) return;
      var dados = { name: nome, emoji: escolhido, type: currentType,
                    module: currentType === "isolada"
                      ? (modo === "rename" ? alvo.module : (opts.module || null))
                      : null };
      if (modo === "rename") dados.id = alvo.id;
      fechar();
      if (typeof opts.onConfirm === "function") opts.onConfirm(dados);
    }

    root.querySelector("#awdOk").addEventListener("click", confirmar);
    root.querySelector("#awdCancel").addEventListener("click", fechar);
    root.querySelector(".awd__x").addEventListener("click", fechar);
    root.querySelector(".awd__scrim").addEventListener("click", fechar);

    setTimeout(function () { try { input.focus(); input.select(); } catch (e) {} }, 60);
    atualizar();
    centralizar(root);
    return root;
  }

  /* ------------------------------------------------------------
     EXCLUIR — confirmação na mesma caixa do resto.

     Existia a tentação de resolver isto com window.confirm(). Seria
     a quarta aparência diferente de carteira no ATLAS (e a única que
     o CSS do produto não alcança). Aqui é a mesma .awd__box, com o
     mesmo tipo de letra e os mesmos botões do criar/renomear.
     ------------------------------------------------------------ */
  function confirmDelete(w, onConfirm) {
    if (!w) return null;
    W = window.AtlasWallets;
    if (aberto) fechar();

    var restos = document.querySelectorAll('[data-atlas-ui="wallet-dialog"]');
    Array.prototype.forEach.call(restos, function (n) {
      if (n.parentNode) n.parentNode.removeChild(n);
    });

    focoAnterior = document.activeElement;
    var isLocal = w.type === "isolada";
    var titulo = t("Excluir carteira");

    var root = document.createElement("div");
    root.className = "awd";
    root.setAttribute("data-atlas-ui", "wallet-dialog");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", titulo);

    root.innerHTML =
      '<div class="awd__scrim"></div>' +
      '<div class="awd__box">' +
        '<div class="awd__head">' +
          '<span class="awd__scope awd__scope--' + (isLocal ? "isolada" : "global") + '">' +
            (W && W.typeIcon ? W.typeIcon(isLocal ? "isolada" : "global", 15) : "") +
            '<span>' + esc(isLocal ? t("Local") : t("Global")) + '</span>' +
          '</span>' +
          '<button type="button" class="awd__x" aria-label="' + esc(t("Fechar")) + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
            'stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>' +
        '<h2 class="awd__title">' + esc(titulo) + '</h2>' +
        '<p class="awd__lead">' +
          esc(t("A carteira") + ' “' + w.name + '” ' +
              t("sai de todos os módulos e os números guardados nela são descartados.") + " " +
              t("Os registros de cada módulo continuam onde estão.")) +
        '</p>' +
        '<div class="awd__preview">' +
          '<span class="awd__badge">' + (w.emoji || (W && W.initials ? W.initials(w.name) : "?")) + '</span>' +
          '<span class="awd__preview-txt">' + esc(w.name) + '</span>' +
        '</div>' +
        '<div class="awd__foot">' +
          '<button type="button" class="awd__btn" id="awdCancel">' + esc(t("Cancelar")) + '</button>' +
          '<button type="button" class="awd__btn awd__btn--danger" id="awdDel">' +
            esc(t("Excluir")) + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(root);
    aberto = root;
    requestAnimationFrame(function () { root.classList.add("is-in"); });
    document.addEventListener("keydown", aoTeclar, true);

    root.querySelector("#awdDel").addEventListener("click", function () {
      fechar();
      if (typeof onConfirm === "function") onConfirm();
    });
    root.querySelector("#awdCancel").addEventListener("click", fechar);
    root.querySelector(".awd__x").addEventListener("click", fechar);
    root.querySelector(".awd__scrim").addEventListener("click", fechar);

    centralizar(root);
    return root;
  }

  /* ------------------------------------------------------------
     Garantia de centralização

     O CSS já centraliza (position:fixed + place-items:center). Mas se
     algum ancestral tiver transform/filter/backdrop-filter, o "fixed"
     deixa de valer e a caixa desce na tela — foi o que aconteceu no
     DeFi. Aqui a gente MEDE: se o centro da caixa não bater com o
     centro da janela, assume o controle e posiciona na mão.
     ------------------------------------------------------------ */
  function centralizar(root) {
    if (!root || !root.getBoundingClientRect || !window.requestAnimationFrame) return;

    function corrigir() {
      var box = root.querySelector(".awd__box");
      if (!box) return;
      var r = box.getBoundingClientRect();
      if (!r.height) return;

      var centroJanela = window.innerHeight / 2;
      var centroCaixa  = r.top + r.height / 2;
      if (Math.abs(centroCaixa - centroJanela) <= 3) return;   // já está certo

      if (window.console) {
        console.warn("[AtlasWalletDialog] centralização por CSS não valeu " +
                     "(provável ancestral com transform/filter). Corrigindo por JS.");
      }
      root.style.display = "block";
      box.style.position = "fixed";
      box.style.left = "50%";
      box.style.top  = "50%";
      box.style.margin = "0";
      box.style.transform = "translate(-50%, -50%)";
      // a animação de entrada usa transform; a partir daqui ela fica
      // por conta do opacity, para não brigar com o translate
      root.classList.add("awd--pinned");
    }

    requestAnimationFrame(function () { requestAnimationFrame(corrigir); });
    window.addEventListener("resize", corrigir, { passive: true });
  }

  window.AtlasWalletDialog = { open: open, confirmDelete: confirmDelete, close: fechar };
})();
