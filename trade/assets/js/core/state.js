/* ============================================================
   ATLAS — Estado da aplicação (reativo)
   ------------------------------------------------------------
   Camada de domínio. A interface conversa SÓ com este módulo,
   que lê e grava pelo DataStore (store.js). Trocar o backend de
   dados no futuro não afeta nenhuma tela.

   Sprint 2: CRUD de estudos (criar, editar tese, evoluir histórico,
   mudar de estado, arquivar) — a base genérica que RD e Trades
   vão reutilizar nos próximos Sprints.
   ============================================================ */
(function (ATLAS) {
  "use strict";

  /* O store do Trade prefixa com "atlas.", então a chave final é
     "atlas.trade.state.v1". Era "state.v1" → "atlas.state.v1", nome que
     parecia estado GLOBAL do sistema e não do módulo. Renomear aqui é o
     que fecha a convenção atlas.<módulo>.<coisa>.v<N>; a migração do
     dado já gravado está em core/atlas-storage.js. */
  var STATE_KEY = "trade.state.v1";
  var subscribers = [];
  var state = null;

  var HOUR = 3600 * 1000;
  var global = window;
  function now() { return Date.now(); }
  function emit() { subscribers.forEach(function (fn) { fn(state); }); }
  function persist() { ATLAS.store.set(STATE_KEY, state); }
  function genId(prefix) { return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ---- Ponte com a Central de Carteiras do Atlas ----
     A central (AtlasWallets) decide QUAIS carteiras existem e QUAL
     está ativa. O Trade guarda os DADOS de cada carteira em state.data.
     Aqui garantimos que cada carteira visível no Trade tenha seu balde
     de dados, e alinhamos a carteira ativa local com a central. */
  function syncWithCentral() {
    if (!global.AtlasWallets) return; // roda standalone se a central não existir
    var visiveis = global.AtlasWallets.forModule("trade"); // globais + isoladas do trade
    if (!state.data) state.data = {};

    visiveis.forEach(function (w) {
      if (!state.data[w.id]) {
        // carteira nova (veio da central): começa vazia
        state.data[w.id] = emptyWalletData();
      }
    });

    /* Carteira ativa efetiva.

       Regra: uma Local (isolada) do Trade que já estava selecionada MANDA.
       Ela vive dentro de state.currentWallet, que é persistido, então
       precisa sobreviver ao boot. Em qualquer outro caso — carteira
       global, carteira apagada na central, ou primeira execução — vale a
       global ativa da central, que é o que propaga entre os módulos.

       Aqui existia um "state.currentWallet = activeGlobalId()" sem
       condição nenhuma. Ele salvava a isolada direito e pisava em cima
       dela no boot seguinte: a Local do Trade era impossível de manter. */
    var centralId = global.AtlasWallets.activeGlobalId();
    var salva = state.currentWallet, visivel = null;
    if (salva) {
      for (var i = 0; i < visiveis.length; i++) {
        if (visiveis[i].id === salva) { visivel = visiveis[i]; break; }
      }
    }
    var manterLocal = !!(visivel && visivel.type === "isolada" && visivel.module === "trade");
    if (!manterLocal) state.currentWallet = centralId;
    if (!state.data[state.currentWallet]) state.data[state.currentWallet] = emptyWalletData();
  }

  /* Converte os "hoursAgo" da semente em timestamps reais (uma vez) */
  function hydrate() {
    Object.keys(state.data).forEach(function (wid) {
      var wd = state.data[wid];
      if (!wd.rds) wd.rds = [];
      (wd.studies || []).forEach(function (s) {
        if (s.createdAt) return; // já hidratado
        s.createdAt = now() - (s.hoursAgo || 0) * HOUR;
        s.history = (s.history || []).map(function (h) {
          return { ts: now() - (h.hoursAgo || 0) * HOUR, text: h.text };
        }).sort(function (a, b) { return a.ts - b.ts; });
        s.updatedAt = s.history.length ? s.history[s.history.length - 1].ts : s.createdAt;
        if (!s.thesis && s.history.length) s.thesis = s.history[s.history.length - 1].text;
        delete s.hoursAgo;
      });
      (wd.rds || []).forEach(function (r) {
        if (r.createdAt) return;
        r.createdAt = now() - (r.hoursAgo || 0) * HOUR;
        r.updatedAt = r.createdAt;
        delete r.hoursAgo;
      });
      (wd.trades || []).forEach(function (t) {
        if (t.openedAt) return;
        t.openedAt = now() - (t.hoursAgo || 0) * HOUR;
        if (t.closedHoursAgo != null) t.closedAt = now() - t.closedHoursAgo * HOUR;
        t.events = (t.events || []).map(function (e) {
          return { ts: now() - (e.hoursAgo || 0) * HOUR, type: e.type, text: e.text };
        }).sort(function (a, b) { return a.ts - b.ts; });
        t.partials = (t.partials || []).map(function (p) {
          return { ts: now() - (p.hoursAgo || 0) * HOUR, price: p.price, portion: p.portion, note: p.note };
        }).sort(function (a, b) { return a.ts - b.ts; });
        if (t.review && !t.review.createdAt) {
          t.review.createdAt = now() - (t.review.hoursAgo || 0) * HOUR;
          delete t.review.hoursAgo;
        }
        t.updatedAt = t.closedAt || t.openedAt;
        delete t.hoursAgo; delete t.closedHoursAgo;
      });
    });
    persist();
  }

  var DEFAULT_PREFS = { operatorName: "operador", studyLimitH: 72, tradeReviewH: 24 };

  function ensurePrefs() {
    if (!state.prefs) state.prefs = JSON.parse(JSON.stringify(DEFAULT_PREFS));
    Object.keys(DEFAULT_PREFS).forEach(function (k) { if (state.prefs[k] == null) state.prefs[k] = DEFAULT_PREFS[k]; });
  }

  function emptyWalletData() {
    return { equity: [0, 0], kpis: { winrate: 0, trades: 0, avgHold: "—", profitFactor: 0 }, studies: [], rds: [], trades: [], alerts: [], archive: { studies: [], trades: [] } };
  }

  var app = {
    init: function () {
      state = ATLAS.store.get(STATE_KEY);
      if (!state || state.version !== ATLAS.seed.version) {
        state = JSON.parse(JSON.stringify(ATLAS.seed));
        persist();
        hydrate();
      }
      ensurePrefs();
      syncWithCentral();
      persist();
      /* reage a trocas de carteira feitas em qualquer módulo/aba */
      if (global.AtlasWallets && global.AtlasWallets.subscribe) {
        global.AtlasWallets.subscribe(function () { syncWithCentral(); emit(); });
      }
      /* reage a mudanças nas teses (ex.: reabertura feita no Academy) */
      if (global.AtlasTheses && global.AtlasTheses.onChange) {
        global.AtlasTheses.onChange(function () { emit(); });
      }
      return app;
    },

    subscribe: function (fn) { subscribers.push(fn); return app; },
    getState: function () { return state; },

    /* carteiras vêm da central (globais + isoladas do trade).
       Fallback para a lista local se a central não estiver presente. */
    wallets: function () {
      if (global.AtlasWallets) return global.AtlasWallets.forModule("trade");
      return state.wallets;
    },

    currentWallet: function () {
      if (global.AtlasWallets) {
        var w = global.AtlasWallets.get(state.currentWallet) || global.AtlasWallets.activeGlobal();
        return w;
      }
      var id = state.currentWallet;
      return state.wallets.filter(function (x) { return x.id === id; })[0] || state.wallets[0];
    },

    walletData: function () {
      if (!state.data[state.currentWallet]) state.data[state.currentWallet] = emptyWalletData();
      return state.data[state.currentWallet];
    },

    // Leitura read-only de TODAS as carteiras (usado pela camada de relatórios).
    allWalletData: function () { return state.data || {}; },

    setWallet: function (id) {
      if (state.currentWallet === id) return;
      state.currentWallet = id;
      /* se for global, propaga para a central (afeta todos os módulos).
         se for isolada do trade, fica só aqui. */
      if (global.AtlasWallets) {
        var w = global.AtlasWallets.get(id);
        if (w && w.type === "global") global.AtlasWallets.setActiveGlobal(id);
      }
      if (!state.data[id]) state.data[id] = emptyWalletData();
      persist(); emit();
    },

    /* ============================================================
       A BANCA — caixa mais o que está dentro das operações

       Era o último ponto de `equity`, o array [0,0] que ninguém
       escrevia: o painel mostrava "Banca US$ 0" com dinheiro na
       carteira, e changePct fazia (0 − 0) / 0 = NaN, exibido como
       percentual ao lado.

       Agora é o que existe de verdade: o caixa da carteira (livro de
       eventos) mais o capital dentro das operações abertas.
       ============================================================ */
    balance: function (walletId) {
      var wid = walletId || state.currentWallet;
      var caixa = global.AtlasCaixa ? global.AtlasCaixa.saldo(wid) : 0;
      return caixa + app.valorEmPosicoes(wid);
    },

    /* Resultado realizado sobre o que foi depositado. Não é "variação
       no período" — para isso seria preciso uma série MEDIDA, que o
       Trade não tem. Afirmar um período sem medir é o que a versão
       anterior fazia. */
    changePct: function (walletId) {
      var wid = walletId || state.currentWallet;
      if (!global.AtlasCaixa) return 0;
      var base = global.AtlasCaixa.patrimonioExterno();
      if (!(base > 0)) return 0;
      return (app.resultadoRealizado(wid) / base) * 100;
    },

    resultadoRealizado: function (walletId) {
      var d = (state.data || {})[walletId || state.currentWallet];
      if (!d || !d.trades) return 0;
      return d.trades.reduce(function (a, t) {
        return a + (t.status === "encerrado" ? (Number(t.pnlUSD) || 0) : 0);
      }, 0);
    },

    /* ------------------------------------------------------------
       KPIs CALCULADOS DAS OPERAÇÕES

       walletData().kpis era { winrate: 0, trades: 0, avgHold: "—",
       profitFactor: 0 } — escrito na semente e NUNCA atualizado. O
       painel exibia winrate 0% e profit factor 0,00 para quem tinha
       operações encerradas com lucro.
       ------------------------------------------------------------ */
    kpisReais: function (walletId) {
      var d = (state.data || {})[walletId || state.currentWallet];
      var fechados = (d && d.trades ? d.trades : []).filter(function (t) {
        return t.status === "encerrado";
      });
      if (!fechados.length) {
        return { winrate: 0, trades: 0, avgHold: "—", profitFactor: 0, medidos: 0 };
      }
      var ganhos = 0, somaG = 0, somaP = 0, horas = 0;
      fechados.forEach(function (t) {
        var v = Number(t.pnlUSD) || 0;
        if (v > 0) { ganhos++; somaG += v; } else { somaP += Math.abs(v); }
        horas += app.tradeAgeHours(t);
      });
      var media = horas / fechados.length;
      return {
        trades: fechados.length,
        winrate: Math.round((ganhos / fechados.length) * 100),
        /* sem prejuízo nenhum o fator é infinito — mostrar o número de
           ganhos é mais honesto que exibir Infinity */
        profitFactor: somaP > 0 ? (somaG / somaP) : (somaG > 0 ? Infinity : 0),
        avgHold: media >= 24 ? Math.round(media / 24) + "d" : Math.round(media) + "h",
        medidos: fechados.length
      };
    },

    // ---- Teses (entidade compartilhada AtlasTheses) ------------
    // O Trade não guarda mais estudos por carteira: as teses vivem
    // em core/entities/theses.js (module: "trade"). Este shim
    // mantém a API e o vocabulário antigos (futuro/andamento/
    // concluido) para Dashboard, RD, Trades e Oráculo continuarem
    // funcionando sem alteração.
    _toOld: { planejada: "futuro", andamento: "andamento", concluida: "concluido", arquivada: "arquivada" },
    _toNew: { futuro: "planejada", andamento: "andamento", concluido: "concluida", arquivada: "arquivada" },

    _shimThesis: function (t) {
      if (!t) return null;
      return {
        id: t.id,
        asset: t.asset || "—",
        title: t.title || "Sem título",
        state: app._toOld[t.status] || t.status,   // vocabulário antigo
        status: t.status,                           // vocabulário oficial
        thesis: t.content || "",
        history: t.history || [],
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        closedAt: t.concludedAt || null,
        version: t.version || 1
      };
    },

    /** Todas as teses do Trade (inclui concluídas p/ fluxo de RD; exclui arquivadas). */
    studies: function () {
      if (!global.AtlasTheses) return app.walletData().studies || [];
      return global.AtlasTheses.byModule("trade", { includeConcluded: true })
        .filter(function (t) { return t.status !== "arquivada"; })
        .map(app._shimThesis);
    },

    getStudy: function (id) {
      if (!global.AtlasTheses) {
        return (app.walletData().studies || []).filter(function (s) { return s.id === id; })[0] || null;
      }
      var t = global.AtlasTheses.get(id);
      return (t && t.module === "trade") ? app._shimThesis(t) : null;
    },

    /** Horas desde a abertura do estudo (base da regra das 72h) */
    studyOpenHours: function (s) {
      return Math.max(0, Math.round((now() - (s.createdAt || now())) / HOUR));
    },

    addStudy: function (data) {
      if (!global.AtlasTheses) return null;
      var t = global.AtlasTheses.create({
        module: "trade",
        asset: (data.asset || "").toUpperCase(),
        title: data.title || "Sem título",
        content: data.thesis || "",
        status: app._toNew[data.state] || data.state || "planejada",
        data: { walletId: state.currentWallet || null }
      });
      emit();
      return app._shimThesis(t);
    },

    /** Registra uma nova visão: vira a tese atual e entra no histórico */
    addStudyUpdate: function (id, text) {
      if (!global.AtlasTheses || !text) return;
      var t = global.AtlasTheses.addUpdate(id, text);
      emit();
      return app._shimThesis(t);
    },

    setStudyState: function (id, newState) {
      if (!global.AtlasTheses) return;
      var cur = global.AtlasTheses.get(id); if (!cur) return;
      var target = app._toNew[newState] || newState;
      var t;
      if (target === "concluida") {
        t = global.AtlasTheses.conclude(id);            // → Academy
      } else if ((cur.status === "concluida" || cur.status === "arquivada") && target === "andamento") {
        t = global.AtlasTheses.reopen(id);              // volta do Academy (nova versão)
      } else {
        t = global.AtlasTheses.setStatus(id, target);
      }
      emit();
      return app._shimThesis(t);
    },

    updateStudyMeta: function (id, patch) {
      if (!global.AtlasTheses) return;
      var p = {};
      if (patch.asset != null) p.asset = patch.asset.toUpperCase();
      if (patch.title != null) p.title = patch.title;
      var t = global.AtlasTheses.update(id, p, "Metadados da tese atualizados.");
      emit();
      return app._shimThesis(t);
    },

    removeStudy: function (id) {
      if (!global.AtlasTheses) return;
      global.AtlasTheses.remove(id);
      emit();
    },

    // ---- Registro de Decisão (CRUD) ---------------------------
    rds: function () { return app.walletData().rds || []; },

    getRd: function (id) {
      return app.rds().filter(function (r) { return r.id === id; })[0] || null;
    },

    /** RDs ligados a um estudo específico */
    rdsForStudy: function (studyId) {
      return app.rds().filter(function (r) { return r.studyId === studyId; });
    },

    /** Estudos concluídos que ainda não têm nenhum RD (pendência do fluxo) */
    studiesAwaitingRd: function () {
      var withRd = {};
      app.rds().forEach(function (r) { if (r.studyId) withRd[r.studyId] = true; });
      return app.studies().filter(function (s) { return s.state === "concluido" && !withRd[s.id]; });
    },

    addRd: function (data) {
      var t = now();
      var r = {
        id: genId("rd"),
        studyId: data.studyId || null,
        asset: (data.asset || "").toUpperCase(),
        decision: data.decision || "entrar",
        confidence: data.confidence || 3,
        rationale: data.rationale || "",
        technical: data.technical || "",
        risk: { stop: (data.risk && data.risk.stop) || "", size: (data.risk && data.risk.size) || "", rr: (data.risk && data.risk.rr) || "" },
        leverage: data.leverage || "",
        notes: data.notes || "",
        status: "aberto",
        createdAt: t,
        updatedAt: t
      };
      app.walletData().rds.unshift(r);
      persist(); emit();
      return r;
    },

    updateRd: function (id, patch) {
      var r = app.getRd(id); if (!r) return;
      ["asset", "decision", "confidence", "rationale", "technical", "leverage", "notes", "status", "studyId"].forEach(function (k) {
        if (patch[k] != null) r[k] = k === "asset" ? patch[k].toUpperCase() : patch[k];
      });
      if (patch.risk) r.risk = { stop: patch.risk.stop || "", size: patch.risk.size || "", rr: patch.risk.rr || "" };
      r.updatedAt = now();
      persist(); emit();
      return r;
    },

    removeRd: function (id) {
      var arr = app.walletData().rds;
      var i = arr.map(function (r) { return r.id; }).indexOf(id);
      if (i > -1) { arr.splice(i, 1); persist(); emit(); }
    },

    // ---- Trades (CRUD + ciclo de vida) ------------------------
    trades: function () { return app.walletData().trades || []; },
    getTrade: function (id) { return app.trades().filter(function (t) { return t.id === id; })[0] || null; },

    /** Horas desde a abertura (base do alerta de trade antigo) */
    tradeAgeHours: function (t) {
      var end = t.status === "encerrado" && t.closedAt ? t.closedAt : now();
      return Math.max(0, Math.round((end - (t.openedAt || now())) / HOUR));
    },

    /** Trades abertos há mais de `h` horas (padrão 24) — reavaliação */
    tradesToReview: function (h) {
      h = h || 24;
      return app.trades().filter(function (t) { return t.status === "aberto" && app.tradeAgeHours(t) > h; });
    },

    tradesForStudy: function (studyId) { return app.trades().filter(function (t) { return t.studyId === studyId; }); },

    /* ============================================================
       PONTE COM O CAIXA DA CARTEIRA

       Era aqui que estava o buraco descrito no briefing. O Trade
       guardava `equity: [0, 0]` — um array escrito UMA vez, na criação
       da carteira, e nunca mais tocado. Abrir um trade não tirava
       dinheiro de lugar nenhum; fechar não devolvia. O "saldo que some
       ao fechar" nunca existiu para sumir.

       Agora o trade tem capital em dólar (sizeUSD): ele sai do caixa
       ao abrir e volta, com o resultado embutido, ao fechar.
       ============================================================ */
    _caixa: function (tipo, tr, valor, obs) {
      if (!global.AtlasCaixa || !(valor > 0)) return null;
      return global.AtlasCaixa.registrar({
        tipo: tipo, valorUSD: valor,
        walletId: state.currentWallet,
        module: "trade", refId: tr.id, obs: obs || ""
      });
    },

    /** Abre um trade — normalmente a partir de um RD "entrar" */
    openTrade: function (data) {
      var t = now();
      var capital = Number(data.sizeUSD);
      if (!isFinite(capital) || capital < 0) capital = 0;
      /* Sem caixa a operação nem nasce. O livro recusaria o débito de
         qualquer forma, mas aí sobraria um trade aberto sem dinheiro
         por trás — patrimônio do nada. A tela checa antes para poder
         dizer quanto falta; esta é a trava de qualquer caminho. */
      if (capital > 0 && global.AtlasCaixa &&
          !global.AtlasCaixa.podeGastar(state.currentWallet, capital).ok) return null;
      var tr = {
        id: genId("t"),
        asset: (data.asset || "").toUpperCase(),
        side: data.side || "long",
        studyId: data.studyId || null,
        rdId: data.rdId || null,
        status: "aberto",
        entry: data.entry != null ? data.entry : null,
        stop: data.stop != null ? data.stop : null,
        target: data.target != null ? data.target : null,
        /* sizeUSD é o CAPITAL, numérico. `size` continua sendo a regra
           de risco em texto ("2% risco") — descrevem coisas
           diferentes, e juntá-las num campo só foi o que impediu o
           módulo de participar do fluxo de caixa. */
        sizeUSD: capital,
        size: data.size || "",
        leverage: data.leverage || "",
        pnl: 0,
        pnlUSD: 0,
        openedAt: t,
        updatedAt: t,
        events: [{ ts: t, type: "abertura", text: data.note || "Trade aberto." }],
        partials: []
      };
      app.walletData().trades.unshift(tr);
      if (tr.rdId) { var rd = app.getRd(tr.rdId); if (rd) { rd.status = "convertido"; } }
      persist();
      app._caixa("aporte", tr, capital, "Abertura de trade " + tr.asset);
      emit();
      return tr;
    },

    addTradeEvent: function (id, type, text) {
      var tr = app.getTrade(id); if (!tr || !text) return;
      var t = now();
      tr.events.push({ ts: t, type: type || "nota", text: text });
      tr.updatedAt = t;
      persist(); emit();
      return tr;
    },

    addPartial: function (id, data) {
      var tr = app.getTrade(id); if (!tr) return;
      var t = now();
      tr.partials.push({ ts: t, price: data.price, portion: data.portion || "", note: data.note || "" });
      tr.events.push({ ts: t, type: "parcial", text: "Parcial" + (data.portion ? " de " + data.portion : "") + (data.price ? " em " + data.price : "") + (data.note ? " — " + data.note : "") });
      tr.updatedAt = t;
      persist(); emit();
      return tr;
    },

    /** Atualiza stop / alvo / tamanho e registra no gerenciamento */
    manageTrade: function (id, patch) {
      var tr = app.getTrade(id); if (!tr) return;
      var msgs = [];
      if (patch.stop != null && patch.stop !== tr.stop) { msgs.push("Stop movido para " + patch.stop); tr.stop = patch.stop; }
      if (patch.target != null && patch.target !== tr.target) { msgs.push("Alvo ajustado para " + patch.target); tr.target = patch.target; }
      if (patch.pnl != null) tr.pnl = patch.pnl;
      if (msgs.length) tr.events.push({ ts: now(), type: "gerenciamento", text: msgs.join(" · ") });
      tr.updatedAt = now();
      persist(); emit();
      return tr;
    },

    closeTrade: function (id, data) {
      var tr = app.getTrade(id); if (!tr) return;
      var t = now();
      tr.status = "encerrado";
      tr.exit = data.exit != null ? data.exit : tr.exit;
      if (data.pnl != null) tr.pnl = data.pnl;
      tr.result = data.result || (tr.pnl > 0 ? "gain" : (tr.pnl < 0 ? "loss" : "be"));
      tr.closedAt = t;
      tr.updatedAt = t;

      /* ------------------------------------------------------------
         O RESULTADO EM DÓLAR, E POR QUE ELE É DERIVADO DO PERCENTUAL

         `tr.pnl` é percentual — é assim que o módulo sempre registrou,
         e é como o trader pensa ("fiz +8%"). O caixa precisa de
         dólares. Com o capital conhecido, a conversão é uma conta, não
         um chute: 8% de US$ 250 são US$ 20.

         Se quem chamou já tem o valor em dólar (fechamento parcial,
         importação), ele manda pnlUSD e essa conta não acontece.
         ------------------------------------------------------------ */
      var capital = Number(tr.sizeUSD) || 0;
      var resultado = (data.pnlUSD != null && isFinite(Number(data.pnlUSD)))
        ? Number(data.pnlUSD)
        : capital * (Number(tr.pnl) || 0) / 100;
      tr.pnlUSD = Math.round(resultado * 100) / 100;

      tr.events.push({ ts: t, type: "encerramento",
        text: data.note || ("Trade encerrado (" + (tr.pnl >= 0 ? "+" : "") + tr.pnl + "%" +
              (capital ? ", " + (tr.pnlUSD >= 0 ? "+" : "") + "US$ " + Math.abs(tr.pnlUSD).toFixed(2) : "") + ").") });
      persist();

      /* Capital + resultado voltam ao caixa. Um trade que perdeu tudo
         devolve zero — e devolver zero é diferente de não devolver:
         o primeiro é um evento no livro, o segundo é dinheiro que
         some sem rastro. */
      var devolver = Math.max(0, capital + tr.pnlUSD);
      app._caixa("retorno", tr, devolver,
        "Encerramento de " + tr.asset + " · resultado US$ " + tr.pnlUSD.toFixed(2));

      emit();
      return tr;
    },

    /* Excluir um trade ABERTO desfaz o aporte: o dinheiro nunca chegou
       a ser operado. Trade encerrado já teve o retorno registrado, e
       apagar os dois lançamentos manteria o livro coerente. */
    _desfazerCaixa: function (tr) {
      if (!global.AtlasCaixa || !tr) return 0;
      return global.AtlasCaixa.removerPorRef("trade", tr.id);
    },

    removeTrade: function (id) {
      var arr = app.walletData().trades;
      var i = arr.map(function (t) { return t.id; }).indexOf(id);
      if (i > -1) {
        app._desfazerCaixa(arr[i]);
        arr.splice(i, 1); persist(); emit();
      }
    },

    /* ------------------------------------------------------------
       QUANTO O TRADE VALE NUMA CARTEIRA

       Era o último ponto da curva de `equity` — um array decorativo.
       Agora é o capital que está DENTRO das operações abertas: é o
       que o módulo de fato tem alocado, e o que sobra em dinheiro
       está no caixa, que tem casa própria.
       ------------------------------------------------------------ */
    valorEmPosicoes: function (walletId) {
      var d = (state.data || {})[walletId];
      if (!d || !d.trades) return 0;
      return d.trades.reduce(function (a, t) {
        return a + (t.status === "aberto" ? (Number(t.sizeUSD) || 0) : 0);
      }, 0);
    },

    /** Grava a pós-análise de um trade encerrado */
    setTradeReview: function (id, data) {
      var tr = app.getTrade(id); if (!tr) return;
      tr.review = {
        adherence: data.adherence || "total",
        discipline: data.discipline || 3,
        worked: data.worked || "",
        failed: data.failed || "",
        lesson: data.lesson || "",
        tags: data.tags || [],
        createdAt: (tr.review && tr.review.createdAt) || now()
      };
      tr.updatedAt = now();
      persist(); emit();
      return tr;
    },

    /** Trades encerrados que ainda não têm pós-análise */
    tradesAwaitingReview: function () {
      return app.trades().filter(function (t) { return t.status === "encerrado" && !t.review; });
    },

    // ---- Preferências -----------------------------------------
    prefs: function () { ensurePrefs(); return state.prefs; },
    pref: function (k) { ensurePrefs(); return state.prefs[k]; },
    setPrefs: function (patch) {
      ensurePrefs();
      Object.keys(patch).forEach(function (k) { if (patch[k] != null && patch[k] !== "") state.prefs[k] = patch[k]; });
      persist(); emit();
      return state.prefs;
    },

    // ---- Carteiras (CRUD) -------------------------------------
    addWallet: function (data) {
      data = data || {};
      var id;
      if (global.AtlasWallets) {
        // nasce na central. type: "global" | "isolada" (isolada => module: "trade")
        var w = global.AtlasWallets.create({
          name: data.name || "Nova carteira",
          type: data.type === "isolada" ? "isolada" : "global",
          module: "trade",
          color: data.color || "#4C9AFF"
        });
        id = w.id;
      } else {
        id = genId("w");
        state.wallets.push({ id: id, name: data.name || "Nova carteira", tag: data.tag || "Carteira", color: data.color || "#4C9AFF" });
      }
      var wd = emptyWalletData();
      var bal = parseFloat(data.balance);
      if (!isNaN(bal)) wd.equity = [bal, bal];
      state.data[id] = wd;
      persist(); emit();
      return id;
    },
    updateWallet: function (id, patch) {
      if (global.AtlasWallets) {
        if (patch.name != null) global.AtlasWallets.rename(id, patch.name);
        emit();
        return;
      }
      var w = state.wallets.filter(function (x) { return x.id === id; })[0]; if (!w) return;
      ["name", "tag", "color"].forEach(function (k) { if (patch[k] != null) w[k] = patch[k]; });
      persist(); emit();
    },
    removeWallet: function (id) {
      if (global.AtlasWallets) {
        var ok = global.AtlasWallets.remove(id);
        if (!ok) return false;
        delete state.data[id];
        syncWithCentral();
        persist(); emit();
        return true;
      }
      if (state.wallets.length <= 1) return false;
      if (state.currentWallet === id) {
        state.currentWallet = state.wallets.filter(function (w) { return w.id !== id; })[0].id;
      }
      state.wallets = state.wallets.filter(function (w) { return w.id !== id; });
      delete state.data[id];
      persist(); emit();
      return true;
    },

    // ---- Backup / arquivamento --------------------------------
    exportData: function () { return JSON.stringify(state, null, 2); },
    importData: function (json) {
      var parsed = typeof json === "string" ? JSON.parse(json) : json;
      if (!parsed || !parsed.wallets || !parsed.data) throw new Error("Arquivo inválido.");
      state = parsed;
      ensurePrefs();
      persist(); emit();
      return true;
    },
    resetAll: function () {
      state = JSON.parse(JSON.stringify(ATLAS.seed));
      persist(); hydrate(); ensurePrefs(); persist(); emit();
    },

    /** Move trades antigos para o arquivo (continua salvo e restaurável).
        Teses concluídas não são mais arquivadas aqui — ficam na
        Biblioteca do Academy, sempre pesquisáveis. */
    archiveOld: function (days) {
      var cutoff = now() - (days || 90) * 24 * HOUR, moved = 0;
      Object.keys(state.data).forEach(function (wid) {
        var wd = state.data[wid];
        if (!wd.archive) wd.archive = { studies: [], trades: [] };
        var keepT = [];
        (wd.trades || []).forEach(function (t) {
          if (t.status === "encerrado" && (t.closedAt || 0) < cutoff) { wd.archive.trades.push(t); moved++; }
          else keepT.push(t);
        });
        wd.trades = keepT;
      });
      persist(); emit();
      return moved;
    },
    archivedCount: function () {
      var n = 0;
      Object.keys(state.data).forEach(function (wid) {
        var a = state.data[wid].archive;
        if (a) n += (a.studies ? a.studies.length : 0) + (a.trades ? a.trades.length : 0);
      });
      return n;
    },
    restoreArchived: function () {
      var restored = 0;
      Object.keys(state.data).forEach(function (wid) {
        var wd = state.data[wid], a = wd.archive;
        if (!a) return;
        (a.trades || []).forEach(function (t) { wd.trades.push(t); restored++; });
        /* estudos arquivados antigos já foram migrados para AtlasTheses */
        wd.archive = { studies: [], trades: [] };
      });
      persist(); emit();
      return restored;
    }
  };

  ATLAS.app = app;
})(window.ATLAS = window.ATLAS || {});
