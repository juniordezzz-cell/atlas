/* ============================================================
   ATLAS · core/atlas-module-settings.js
   ------------------------------------------------------------
   ARQUIVO ÚNICO DAS CONFIGURAÇÕES POR MÓDULO.

   Antes, cada módulo tinha a própria tela de Configurações —
   Hold, Trade e DeFi, três telas, três códigos, três lugares
   para esquecer de atualizar. Agora existe UMA tela só, no
   Dashboard, e este arquivo é o cérebro dela.

   Como funciona sem tocar nos módulos
   -----------------------------------
   Cada módulo já lê as preferências dele de um lugar no
   localStorage. Em vez de reescrever os módulos, este arquivo
   grava EXATAMENTE no mesmo lugar. O Hold continua lendo
   HOLD_STATE_V2.config, o Trade continua lendo
   atlas.state.v1.prefs — eles nem sabem que a tela mudou.

   Para adicionar uma opção nova: acrescente um campo no SCHEMA
   abaixo. A tela se monta sozinha. Nenhum HTML precisa mudar.

   API
   ---
     AtlasModuleSettings.schema()            -> lista de módulos
     AtlasModuleSettings.read(modId)         -> objeto de valores
     AtlasModuleSettings.write(modId, patch) -> grava
     AtlasModuleSettings.render(host)        -> desenha os cards
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasModuleSettings) return;

  /* ============================================================
     SCHEMA — a única fonte de verdade
     ============================================================ */

  var SCHEMA = [
    {
      id: "hold",
      label: "Hold",
      desc: "Investimento de longo prazo",
      icon: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="3.5"/>',
      storage: { key: "HOLD_STATE_V2", path: "config" },
      fields: [
        { k: "nome_gestor", type: "text", def: "",
          label: "Nome do gestor",
          /* deixou de valer só para o Hold: AtlasSettings.profile() lê
             daqui e alimenta a saudação e o avatar do shell inteiro */
          desc: "Aparece na saudação do painel, no avatar e nos relatórios",
          placeholder: "Seu nome" },
        { k: "alerta_invalidacao", type: "bool", def: true,
          label: "Alertar teses invalidadas",
          desc: "Avisa quando uma tese perde a validade" },
        { k: "alerta_revisao", type: "bool", def: true,
          label: "Alertar teses em revisão",
          desc: "Avisa quando chega a data de revisar" },
        { k: "mostrar_conviccao", type: "bool", def: true,
          label: "Mostrar convicção nas listas",
          desc: "Exibe a nota de convicção junto de cada ativo" }
      ]
    },
    {
      id: "trade",
      label: "Trade",
      desc: "Operações e ciclo de trade",
      icon: '<path d="M3 17l6-6 4 4 7-8"/><path d="M21 7v5M21 7h-5"/>',
      storage: { key: "atlas.state.v1", path: "prefs" },
      fields: [
        { k: "operatorName", type: "text", def: "operador",
          label: "Nome do operador",
          desc: "Como o sistema se dirige a você",
          placeholder: "operador" },
        { k: "studyLimitH", type: "number", def: 72, min: 1,
          label: "Limite da tese (horas)",
          desc: "Prazo para transformar um estudo em decisão" },
        { k: "tradeReviewH", type: "number", def: 24, min: 1,
          label: "Revisar trade após (horas)",
          desc: "Quando o sistema cobra a análise pós-trade" }
      ],
      /* Arquivamento: era a única função da antiga tela do Trade que não
         cabia num campo. As funções archiveOld/restoreArchived continuam
         em trade/assets/js/core/state.js, mas ficaram sem tela quando a
         config local foi removida. Aqui elas voltam a ter dono. */
      actions: [
        {
          k: "arch_restore",
          label: "Restaurar arquivados",
          desc: function () {
            var n = tradeArchiveCount();
            return n ? (n + " trade(s) no arquivo. Voltam para a lista ativa.")
                     : "Nenhum trade arquivado no momento.";
          },
          enabled: function () { return tradeArchiveCount() > 0; },
          run: function () {
            var n = tradeRestoreArchived();
            return n ? ("Restaurados: " + n) : "Nada para restaurar";
          }
        }
      ]
    },
    {
      id: "defi",
      label: "DeFi",
      desc: "Pools, staking e lending",
      icon: '<path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5M3 17l9 5 9-5"/>',
      storage: null,
      fields: [],
      note: "O DeFi usa apenas as preferências globais acima (tema, idioma, moeda). O backup dos dados dele está em Dados e Backup."
    },
    {
      id: "rwa",
      label: "RWA",
      desc: "Ativos do mundo real",
      icon: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
      storage: null,
      fields: [],
      note: "O RWA usa apenas as preferências globais acima."
    }
  ];

  /* ============================================================
     Acesso ao localStorage dos módulos
     ============================================================ */

  function ls() {
    try { return window.localStorage || null; } catch (e) { return null; }
  }

  function readBlob(key) {
    var s = ls();
    if (!s) return null;
    var raw;
    try { raw = s.getItem(key); } catch (e) { return null; }
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function findMod(id) {
    for (var i = 0; i < SCHEMA.length; i++) if (SCHEMA[i].id === id) return SCHEMA[i];
    return null;
  }

  /* ------------------------------------------------------------
     Arquivo do Trade

     Espelha archivedCount()/restoreArchived() de
     trade/assets/js/core/state.js, mas operando direto no JSON.
     Assim a tela central funciona sem precisar carregar o Trade
     inteiro (store, router, módulos) só para mexer no arquivo.
     ------------------------------------------------------------ */

  var TRADE_KEY = "atlas.state.v1";

  function tradeArchiveCount() {
    var blob = readBlob(TRADE_KEY);
    var data = blob && blob.data;
    if (!data || typeof data !== "object") return 0;
    var n = 0;
    Object.keys(data).forEach(function (wid) {
      var a = data[wid] && data[wid].archive;
      if (!a) return;
      n += (a.studies ? a.studies.length : 0) + (a.trades ? a.trades.length : 0);
    });
    return n;
  }

  function tradeRestoreArchived() {
    var s = ls();
    var blob = readBlob(TRADE_KEY);
    var data = blob && blob.data;
    if (!s || !data || typeof data !== "object") return 0;

    var restored = 0;
    Object.keys(data).forEach(function (wid) {
      var wd = data[wid], a = wd && wd.archive;
      if (!a) return;
      if (!Array.isArray(wd.trades)) wd.trades = [];
      (a.trades || []).forEach(function (t) { wd.trades.push(t); restored++; });
      wd.archive = { studies: [], trades: [] };
    });

    if (restored) {
      try { s.setItem(TRADE_KEY, JSON.stringify(blob)); }
      catch (e) { return 0; }
    }
    return restored;
  }

  /** Valores atuais do módulo — cai nos defaults quando ainda não há nada salvo. */
  function read(id) {
    var mod = findMod(id);
    if (!mod) return {};
    var out = {};
    mod.fields.forEach(function (f) { out[f.k] = f.def; });
    if (!mod.storage) return out;

    var blob = readBlob(mod.storage.key);
    var bag = blob && mod.storage.path ? blob[mod.storage.path] : blob;
    if (bag && typeof bag === "object") {
      mod.fields.forEach(function (f) {
        if (bag[f.k] !== undefined && bag[f.k] !== null) out[f.k] = bag[f.k];
      });
    }
    return out;
  }

  /** Grava no MESMO lugar que o módulo já lê. Não cria chave nova. */
  function write(id, patch) {
    var mod = findMod(id);
    if (!mod || !mod.storage) return false;
    var s = ls();
    if (!s) return false;

    var blob = readBlob(mod.storage.key);
    // Se o módulo nunca rodou, não inventamos o estado inteiro dele —
    // criamos só o compartimento de preferências, que é seguro.
    if (!blob || typeof blob !== "object") blob = {};

    if (mod.storage.path) {
      if (!blob[mod.storage.path] || typeof blob[mod.storage.path] !== "object") {
        blob[mod.storage.path] = {};
      }
      Object.keys(patch).forEach(function (k) { blob[mod.storage.path][k] = patch[k]; });
    } else {
      Object.keys(patch).forEach(function (k) { blob[k] = patch[k]; });
    }

    try { s.setItem(mod.storage.key, JSON.stringify(blob)); }
    catch (e) { return false; }
    return true;
  }

  /* ============================================================
     Desenho da interface

     Reaproveita as classes da página de Configurações
     (.set-card, .set-row, .switch) — nada de CSS novo por módulo.
     ============================================================ */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function t(s) { return window.AtlasI18n ? AtlasI18n.t(s) : s; }

  function fieldRow(mod, f, val, onChange) {
    var row = document.createElement("div");
    row.className = "set-row";

    var txt = document.createElement("div");
    txt.className = "set-row-txt";
    txt.innerHTML = '<div class="set-label">' + esc(t(f.label)) + '</div>' +
                    (f.desc ? '<div class="set-desc">' + esc(t(f.desc)) + '</div>' : "");
    row.appendChild(txt);

    var ctrl = document.createElement("div");
    ctrl.className = "set-row-ctrl";

    if (f.type === "bool") {
      var sw = document.createElement("button");
      sw.type = "button";
      sw.className = "switch";
      sw.setAttribute("aria-pressed", String(!!val));
      sw.setAttribute("aria-label", t(f.label));
      sw.addEventListener("click", function () {
        var novo = sw.getAttribute("aria-pressed") !== "true";
        sw.setAttribute("aria-pressed", String(novo));
        onChange(f.k, novo);
      });
      ctrl.appendChild(sw);
    } else {
      var inp = document.createElement("input");
      inp.className = "set-input";
      inp.type = f.type === "number" ? "number" : "text";
      if (f.min != null) inp.min = String(f.min);
      if (f.placeholder) inp.placeholder = f.placeholder;
      inp.value = val == null ? "" : String(val);
      inp.addEventListener("change", function () {
        var v = inp.value;
        if (f.type === "number") {
          v = parseInt(v, 10);
          if (!(v > 0)) { v = f.def; inp.value = String(v); }
        } else {
          v = v.trim() || f.def;
          inp.value = v;
        }
        onChange(f.k, v);
      });
      ctrl.appendChild(inp);
    }

    row.appendChild(ctrl);
    return row;
  }

  function actionRow(act, redraw) {
    var row = document.createElement("div");
    row.className = "set-row";

    var desc = typeof act.desc === "function" ? act.desc() : act.desc;
    var txt = document.createElement("div");
    txt.className = "set-row-txt";
    txt.innerHTML = '<div class="set-label">' + esc(t(act.label)) + '</div>' +
                    (desc ? '<div class="set-desc">' + esc(t(desc)) + '</div>' : "");
    row.appendChild(txt);

    var ctrl = document.createElement("div");
    ctrl.className = "set-row-ctrl set-foot";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-ghost";
    btn.textContent = t(act.label);
    var livre = typeof act.enabled === "function" ? act.enabled() : true;
    if (!livre) { btn.disabled = true; btn.classList.add("is-off"); }
    btn.addEventListener("click", function () {
      var msg = act.run();
      if (window.AtlasToast) AtlasToast(msg);
      redraw();
    });
    ctrl.appendChild(btn);

    row.appendChild(ctrl);
    return row;
  }

  function card(mod, onChange, redraw) {
    var el = document.createElement("div");
    el.className = "set-card";
    el.setAttribute("data-mod", mod.id);

    var head = document.createElement("div");
    head.className = "set-card-head";
    head.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' + mod.icon + '</svg>' +
      '<h3>' + esc(mod.label) + '</h3>' +
      '<span class="eyebrow">' + esc(t(mod.desc)) + '</span>';
    el.appendChild(head);

    if (!mod.fields.length && !(mod.actions && mod.actions.length)) {
      var nota = document.createElement("div");
      nota.className = "set-row";
      nota.innerHTML = '<div class="set-row-txt"><div class="set-desc">' +
                       esc(t(mod.note || "Sem opções próprias.")) + '</div></div>';
      el.appendChild(nota);
      return el;
    }

    var vals = read(mod.id);
    mod.fields.forEach(function (f) {
      el.appendChild(fieldRow(mod, f, vals[f.k], onChange));
    });
    (mod.actions || []).forEach(function (a) {
      el.appendChild(actionRow(a, redraw));
    });
    return el;
  }

  function render(host, onSaved) {
    if (!host) return;
    function draw() {
      host.innerHTML = "";
      SCHEMA.forEach(function (mod) {
        host.appendChild(card(mod, function (k, v) {
          var patch = {}; patch[k] = v;
          var ok = write(mod.id, patch);
          if (typeof onSaved === "function") onSaved(ok, mod);
        }, draw));
      });
    }
    draw();
  }

  window.AtlasModuleSettings = {
    schema: function () { return SCHEMA.slice(); },
    read: read,
    write: write,
    render: render
  };
})();
