/* ============================================================
   HOLD SYSTEM · js/state.js
   Estado central único. Toda a UI lê daqui e NUNCA muta dados
   diretamente — tudo passa por Store.actions.*, que:
     1) valida a regra de negócio
     2) altera o estado central
     3) registra histórico
     4) emite evento
     5) espelha no localStorage
   ============================================================ */
(function () {
  "use strict";

  var LS_KEY = "atlas.hold.state.v2";

  /* ---- Ponte com a Central de Carteiras (AtlasWallets) ----
     As POSIÇÕES do Hold passam a pertencer a uma carteira (o dinheiro
     é por carteira). Ativos e teses continuam do módulo inteiro (uma
     tese é a mesma em qualquer carteira). A carteira ativa efetiva é
     a global ativa da central, ou uma Local escolhida dentro do Hold. */
  /* Local selecionada dentro do Hold: não propaga para a central, mas
     persiste. O Hold é SPA e re-renderiza sem recarregar, então uma
     variável de memória "funcionava" durante a sessão e sumia no F5 —
     era um bug silencioso, mais difícil de notar que o do DeFi. */
  var KEY_LOCAL = "atlas.hold.wallet.v1";
  var localWalletId = (function () {
    try { return localStorage.getItem(KEY_LOCAL) || null; } catch (e) { return null; }
  })();
  function setLocalWalletId(id) {
    localWalletId = id || null;
    try {
      if (localWalletId) localStorage.setItem(KEY_LOCAL, localWalletId);
      else localStorage.removeItem(KEY_LOCAL);
    } catch (e) { /* sem storage → só memória */ }
  }

  function activeWalletId() {
    if (!window.AtlasWallets) return "principal";
    if (localWalletId) {
      var w = window.AtlasWallets.get(localWalletId);
      if (w && (w.type === "isolada" && w.module === "hold")) return localWalletId;
      setLocalWalletId(null); // carteira apagada na central: limpa o vestígio
    }
    return window.AtlasWallets.activeGlobalId();
  }

  function activeWallet() {
    if (!window.AtlasWallets) return { id: "principal", name: "Principal", type: "global" };
    return window.AtlasWallets.get(activeWalletId()) || window.AtlasWallets.activeGlobal();
  }

  /* Toda posição antiga sem walletId é adotada pela carteira principal. */
  function ensureWalletStamp() {
    var changed = false;
    (HOLD_STATE.carteira || []).forEach(function (p) {
      if (!p.walletId) { p.walletId = "principal"; changed = true; }
    });
    return changed;
  }

  /* ---- Event system (nomes travados na spec) ---- */
  var EVENTS = {
    ASSET_CREATED:    "ASSET_CREATED",
    THESIS_CREATED:   "THESIS_CREATED",
    POSITION_UPDATED: "POSITION_UPDATED",
    STUDY_CONVERTED:  "STUDY_CONVERTED",
    THESIS_UPDATED:   "THESIS_UPDATED",
    TRADE_EXECUTED:   "TRADE_EXECUTED",
    STATE_CHANGED:    "STATE_CHANGED"   // interno p/ re-render
  };

  var bus = {};
  function on(evt, fn) { (bus[evt] = bus[evt] || []).push(fn); }
  function emit(evt, payload) {
    (bus[evt] || []).forEach(function (fn) { try { fn(payload); } catch (e) { console.error(e); } });
    if (evt !== EVENTS.STATE_CHANGED) emit(EVENTS.STATE_CHANGED, { evt: evt, payload: payload });
  }

  /* ---- State ----
     `teses` é um ESPELHO somente-leitura da entidade compartilhada
     AtlasTheses (module: "hold"). Estudos deixaram de existir —
     viraram Teses com status "planejada" (migração automática). */
  var HOLD_STATE = {
    ativos: [], carteira: [], teses: [], historico: [], config: {}
  };

  function uid(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ---- persistence ----
     Teses NÃO são persistidas aqui — a fonte da verdade é a
     entidade compartilhada AtlasTheses (core/entities/theses.js). */
  function persist() {
    try {
      var copy = {};
      Object.keys(HOLD_STATE).forEach(function (k) { if (k !== "teses") copy[k] = HOLD_STATE[k]; });
      localStorage.setItem(LS_KEY, JSON.stringify(copy));
    }
    catch (e) { console.warn("localStorage indisponível:", e); }
  }

  /* Espelha as teses do módulo Hold (entidade compartilhada) no
     formato interno que as páginas já conhecem. Inclui concluídas
     (necessárias p/ regra "nenhum ativo investido sem tese"); a
     página de Teses filtra a exibição. */
  function fromEntity(t) {
    var d = t.data || {};
    return {
      id: t.id,
      ativo_id: d.ativo_id || null,
      narrativa: t.content || "",
      cenarios: d.cenarios || { bull: "", base: "", bear: "" },
      riscos: d.riscos || [],
      catalisadores: d.catalisadores || [],
      criterios_invalidacao: d.criterios_invalidacao || "",
      conviccao: d.conviccao != null ? d.conviccao : 5,
      status: t.status,             // planejada | andamento | concluida | arquivada
      version: t.version || 1,
      revisoes: Math.max(0, (t.version || 1) - 1),
      updatedAt: t.updatedAt || null,
      titulo: t.title || ""
    };
  }

  function syncTheses() {
    if (!window.AtlasTheses) { HOLD_STATE.teses = []; return; }
    HOLD_STATE.teses = window.AtlasTheses
      .byModule("hold", { includeConcluded: true })
      .map(fromEntity);
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(LS_KEY); } catch (e) {}
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        Object.keys(HOLD_STATE).forEach(function (k) {
          if (k === "teses") return;
          HOLD_STATE[k] = parsed[k] != null ? parsed[k] : HOLD_STATE[k];
        });
        if (ensureWalletStamp()) persist();
        syncTheses();
        watchEntity();
        watchWallets();
        return;
      } catch (e) { console.warn("Estado corrompido, recarregando semente."); }
    }
    // primeira execução -> semente
    var seed = window.HOLD_SEED || {};
    HOLD_STATE.ativos    = clone(seed.ativos || []);
    HOLD_STATE.carteira  = clone(seed.carteira || []);
    HOLD_STATE.historico = clone(seed.historico || []);
    HOLD_STATE.config    = clone(seed.config || {});
    ensureWalletStamp();
    persist();
    syncTheses();
    watchEntity();
    watchWallets();
  }

  var watchingWallets = false;
  function watchWallets() {
    if (watchingWallets || !window.AtlasWallets) return;
    watchingWallets = true;
    window.AtlasWallets.subscribe(function () {
      // troca de carteira global feita em qualquer módulo re-renderiza o Hold
      emit(EVENTS.STATE_CHANGED, { evt: "wallet_change" });
    });
  }

  var watching = false;
  function watchEntity() {
    if (watching || !window.AtlasTheses) return;
    watching = true;
    window.AtlasTheses.onChange(function () {
      syncTheses();
      emit(EVENTS.STATE_CHANGED, { evt: "theses_sync" });
    });
  }

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  /* ---- history helper (toda ação gera histórico) ---- */
  function logHistory(tipo_acao, subtipo, ativo_id, tese_id, justificativa, impacto) {
    HOLD_STATE.historico.unshift({
      id: uid("h"), tipo_acao: tipo_acao, subtipo: subtipo || null,
      ativo_id: ativo_id || null, tese_id: tese_id || null,
      justificativa: justificativa || "", impacto: impacto || "",
      data: new Date().toISOString()
    });
  }

  /* ============================================================
     SELECTORS (derivações — nunca alteram estado)
     ============================================================ */
  function asset(id) { return HOLD_STATE.ativos.find(function (a) { return a.id === id; }); }
  function thesis(id) { return HOLD_STATE.teses.find(function (t) { return t.id === id; }); }
  function thesisOfAsset(aid) { return HOLD_STATE.teses.find(function (t) { return t.ativo_id === aid; }); }
  function positionOf(aid) {
    var wid = activeWalletId();
    return HOLD_STATE.carteira.find(function (p) { return p.ativo_id === aid && (p.walletId || "principal") === wid; });
  }
  /* posições da carteira ativa (o que as páginas veem) */
  function walletPositions() {
    var wid = activeWalletId();
    return HOLD_STATE.carteira.filter(function (p) { return (p.walletId || "principal") === wid; });
  }
  /* posição de um ativo em QUALQUER carteira (p/ regra "investido sem tese") */
  function anyPositionOf(aid) {
    return HOLD_STATE.carteira.find(function (p) { return p.ativo_id === aid; });
  }

  function positionValue(p) {
    var a = asset(p.ativo_id); if (!a) return 0;
    return p.quantidade * a.preco_atual;
  }
  function positionCost(p) { return p.quantidade * p.preco_medio; }
  function positionPnL(p) { return positionValue(p) - positionCost(p); }
  function positionPnLPct(p) {
    var c = positionCost(p); return c === 0 ? 0 : (positionPnL(p) / c) * 100;
  }

  /* soma o valor das posições em TODAS as carteiras globais
     (o que sobe pro dashboard principal), independente da carteira ativa */
  function globalTotal() {
    var globalIds = window.AtlasWallets && window.AtlasWallets.globals
      ? window.AtlasWallets.globals().map(function (w) { return w.id; })
      : ["principal"];
    return HOLD_STATE.carteira.reduce(function (s, p) {
      var wid = p.walletId || "principal";
      return globalIds.indexOf(wid) > -1 ? s + positionValue(p) : s;
    }, 0);
  }

  function portfolioValue() {
    return walletPositions().reduce(function (s, p) { return s + positionValue(p); }, 0);
  }
  function portfolioCost() {
    return walletPositions().reduce(function (s, p) { return s + positionCost(p); }, 0);
  }
  function portfolioPnL() { return portfolioValue() - portfolioCost(); }
  function portfolioPnLPct() {
    var c = portfolioCost(); return c === 0 ? 0 : (portfolioPnL() / c) * 100;
  }
  function positionWeight(p) {
    var tot = portfolioValue(); return tot === 0 ? 0 : (positionValue(p) / tot) * 100;
  }

  function counts() {
    return {
      ativos: HOLD_STATE.ativos.length,
      investidos: HOLD_STATE.ativos.filter(function (a) { return a.status === "invested"; }).length,
      watchlist: HOLD_STATE.ativos.filter(function (a) { return a.status === "watchlist"; }).length,
      vendidos: HOLD_STATE.ativos.filter(function (a) { return a.status === "sold"; }).length,
      teses: HOLD_STATE.teses.filter(function (t) { return t.status !== "concluida"; }).length,
      teses_planejadas: HOLD_STATE.teses.filter(function (t) { return t.status === "planejada"; }).length,
      teses_andamento: HOLD_STATE.teses.filter(function (t) { return t.status === "andamento"; }).length,
      teses_concluidas: HOLD_STATE.teses.filter(function (t) { return t.status === "concluida"; }).length,
      teses_arquivadas: HOLD_STATE.teses.filter(function (t) { return t.status === "arquivada"; }).length,
      // teses_ativas era usado pelo painel mas nunca existiu aqui → "undefined teses ativas".
      // Ativa = planejada ou em andamento (fora concluídas e arquivadas).
      teses_ativas: HOLD_STATE.teses.filter(function (t) {
        return t.status === "planejada" || t.status === "andamento";
      }).length,
      posicoes: walletPositions().length,
      historico: HOLD_STATE.historico.length
    };
  }

  // Alertas derivados: teses em revisão / ativos investidos sem tese, etc.
  function alerts() {
    var out = [];
    HOLD_STATE.teses.forEach(function (t) {
      if (t.status === "planejada") {
        var a = asset(t.ativo_id);
        out.push({ level: "warn", title: "Tese planejada", sub: (a ? a.ticker : t.titulo || "—") + " aguarda início da análise.", asset: t.ativo_id });
      }
      if (t.status === "arquivada") {
        var a2 = asset(t.ativo_id);
        if (a2 && a2.status === "invested") {
          out.push({ level: "crit", title: "Tese arquivada", sub: a2.ticker + " está investido com tese arquivada. Reavalie a posição.", asset: t.ativo_id });
        }
      }
    });
    HOLD_STATE.ativos.forEach(function (a) {
      if (a.status === "invested" && !thesisOfAsset(a.id)) {
        out.push({ level: "crit", title: "Posição sem tese", sub: a.ticker + " está investido sem tese vinculada.", asset: a.id });
      }
    });
    walletPositions().forEach(function (p) {
      var pct = positionWeight(p);
      if (pct > 40) {
        var a3 = asset(p.ativo_id);
        out.push({ level: "info", title: "Concentração elevada", sub: (a3 ? a3.ticker : "—") + " representa " + pct.toFixed(0) + "% da carteira.", asset: p.ativo_id });
      }
    });
    return out;
  }

  /* ============================================================
     ACTIONS (única via de mutação)
     ============================================================ */
  var actions = {

    /* -- Ativo -- */
    createAsset: function (data) {
      /* ------------------------------------------------------------
         UM TICKER, UM ATIVO

         Nada impedia cadastrar SOL duas vezes. Medido na auditoria do
         Hold: três ativos com ticker SOL convivendo, com preços 100,
         100 e 250 — o MESMO ativo valendo coisas diferentes na mesma
         tela.

         O estrago se espalha: a lista mostra o ativo três vezes, cada
         cópia acumula a sua posição, "Atualizar preços" busca SOL três
         vezes e grava em três lugares, e a alocação por ativo conta
         como se fossem três ativos distintos — diluindo uma
         concentração real em três fatias que parecem pequenas.

         É a mesma classe de defeito que a terceira auditoria passou
         inteira removendo: um conceito com mais de uma fonte.
         ------------------------------------------------------------ */
      var tk = String(data.ticker || "").trim().toUpperCase();
      if (!tk) return { error: "Informe o ticker do ativo." };
      var existente = HOLD_STATE.ativos.filter(function (x) {
        return String(x.ticker || "").toUpperCase() === tk;
      })[0];
      if (existente) {
        return { error: tk + " já está cadastrado como \"" + existente.nome + "\". " +
                        "Um ticker, um ativo — abra o ativo existente para comprar mais.",
                 asset: existente };
      }

      var a = {
        id: uid("as"),
        nome: data.nome, ticker: tk,
        tipo: data.tipo || "Cripto",
        preco_atual: num(data.preco_atual), market_cap: num(data.market_cap),
        setor: data.setor || "", categoria: data.categoria || "",
        tese_id: null,
        status: data.status || "watchlist",
        conviccao: clampInt(data.conviccao, 0, 10)
      };
      HOLD_STATE.ativos.push(a);
      logHistory(EVENTS.ASSET_CREATED, "asset", a.id, null,
        "Ativo adicionado ao sistema.", a.ticker + " criado com status " + statusLabel(a.status) + ".");
      emit(EVENTS.ASSET_CREATED, a); persist();
      return a;
    },

    updateAsset: function (id, patch) {
      var a = asset(id); if (!a) return;
      Object.assign(a, patch);
      persist(); emit(EVENTS.STATE_CHANGED, { evt: "asset_patched", payload: a });
      return a;
    },

    updatePrice: function (id, price) {
      var a = asset(id); if (!a) return;
      a.preco_atual = num(price);
      a.precoEm = new Date().toISOString();
      logHistory(EVENTS.POSITION_UPDATED, "price", id, a.tese_id,
        "Atualização de preço de mercado.", a.ticker + " marcado a " + price + ".");
      emit(EVENTS.POSITION_UPDATED, a); persist();
    },

    /* ============================================================
       ATUALIZAR TODOS OS PREÇOS — a regra do ATLAS também aqui

       updatePrice() existia e NUNCA era chamada por tela nenhuma: o
       preço do Hold era digitado no cadastro do ativo e envelhecia em
       silêncio para sempre. Uma carteira de longo prazo marcada a
       preço de meses atrás não é uma carteira de longo prazo — é uma
       fotografia antiga com moldura de painel ao vivo.

       Passa pela cadeia única (core/atlas-precos.js): preço manual do
       usuário → id curado → busca → DEX. O que nenhuma fonte
       reconhecer volta em `faltando`, para a tela pedir o valor —
       nunca vira zero, nunca fica escondido.

       Devolve Promise<{ atualizados, faltando, divergentes }>.
       ============================================================ */
    refreshPrices: function () {
      if (!window.AtlasPrecos) {
        return Promise.reject(new Error("Camada de preços não carregada nesta página."));
      }
      var comTicker = HOLD_STATE.ativos.filter(function (a) { return a.ticker; });
      if (!comTicker.length) {
        return Promise.resolve({ atualizados: 0, faltando: [], divergentes: [] });
      }

      return window.AtlasPrecos.deVarios(comTicker.map(function (a) { return a.ticker; }))
        .then(function (d) {
          var n = 0;
          comTicker.forEach(function (a) {
            var p = d.valores[String(a.ticker).toUpperCase()];
            if (p == null || !(p > 0)) return;
            if (a.preco_atual === p) return;
            a.preco_atual = p;
            a.precoFonte = d.fonte[String(a.ticker).toUpperCase()] || null;
            a.precoEm = new Date().toISOString();
            n++;
          });
          if (n) { persist(); emit(EVENTS.STATE_CHANGED, { evt: "prices_refreshed" }); }
          return { atualizados: n, faltando: d.faltando, divergentes: d.divergentes };
        });
    },

    /* -- Tese (delegado à entidade compartilhada AtlasTheses) -- */
    createThesis: function (data) {
      if (!window.AtlasTheses) return null;
      var a = asset(data.ativo_id);
      var conv = clampInt(data.conviccao, 0, 10);
      var ent = window.AtlasTheses.create({
        module: "hold",
        asset: a ? a.ticker : "—",
        title: "Tese " + (a ? a.ticker : ""),
        content: data.narrativa || "",
        status: data.status || "andamento",
        data: {
          ativo_id: data.ativo_id,
          cenarios: { bull: data.bull || "", base: data.base || "", bear: data.bear || "" },
          riscos: toList(data.riscos),
          catalisadores: toList(data.catalisadores),
          criterios_invalidacao: data.criterios_invalidacao || "",
          conviccao: conv
        }
      });
      if (a) { a.tese_id = ent.id; a.conviccao = conv; }
      syncTheses();
      logHistory(EVENTS.THESIS_CREATED, "thesis", data.ativo_id, ent.id,
        "Tese documentada.", "Tese de " + (a ? a.ticker : "ativo") + " criada com convicção " + conv + ".");
      emit(EVENTS.THESIS_CREATED, thesis(ent.id)); persist();
      return thesis(ent.id);
    },

    updateThesis: function (id, data) {
      if (!window.AtlasTheses) return null;
      var t = thesis(id); if (!t) return;
      var patchData = {};
      if (data.bull != null || data.base != null || data.bear != null) {
        patchData.cenarios = {
          bull: data.bull != null ? data.bull : t.cenarios.bull,
          base: data.base != null ? data.base : t.cenarios.base,
          bear: data.bear != null ? data.bear : t.cenarios.bear
        };
      }
      if (data.riscos != null) patchData.riscos = toList(data.riscos);
      if (data.catalisadores != null) patchData.catalisadores = toList(data.catalisadores);
      if (data.criterios_invalidacao != null) patchData.criterios_invalidacao = data.criterios_invalidacao;
      if (data.conviccao != null) patchData.conviccao = clampInt(data.conviccao, 0, 10);

      // narrativa nova = evolução da visão (entra no histórico da tese)
      if (data.narrativa != null && data.narrativa !== t.narrativa) {
        window.AtlasTheses.addUpdate(id, data.narrativa);
      }
      window.AtlasTheses.update(id, { data: patchData }, data.motivo || "Tese revisada.");
      if (data.status != null && data.status !== t.status) {
        window.AtlasTheses.setStatus(id, data.status);
      }
      syncTheses();
      var t2 = thesis(id);
      var a = t2 ? asset(t2.ativo_id) : null;
      if (a && t2) a.conviccao = t2.conviccao;
      logHistory(EVENTS.THESIS_UPDATED, "thesis", t2 ? t2.ativo_id : null, id,
        data.motivo || "Tese revisada.", "Tese atualizada (convicção " + (t2 ? t2.conviccao : "—") + ", status " + (t2 ? t2.status : "—") + ").");
      emit(EVENTS.THESIS_UPDATED, t2); persist();
      return t2;
    },

    /** Concluir tese: sai do módulo e vai automaticamente para o Academy. */
    concludeThesis: function (id) {
      if (!window.AtlasTheses) return null;
      var t = thesis(id); if (!t) return;
      window.AtlasTheses.conclude(id);
      syncTheses();
      var a = asset(t.ativo_id);
      logHistory(EVENTS.THESIS_UPDATED, "thesis", t.ativo_id, id,
        "Tese concluída.", "Tese de " + (a ? a.ticker : "ativo") + " concluída e enviada ao Academy.");
      emit(EVENTS.THESIS_UPDATED, thesis(id)); persist();
      return thesis(id);
    },

    /** Arquivar tese (substitui a antiga "invalidação"). */
    archiveThesis: function (id, motivo) {
      if (!window.AtlasTheses) return null;
      var t = thesis(id); if (!t) return;
      window.AtlasTheses.archive(id, motivo || "Critério de invalidação atingido.");
      syncTheses();
      var a = asset(t.ativo_id);
      logHistory(EVENTS.THESIS_UPDATED, "thesis", t.ativo_id, id,
        motivo || "Critério de invalidação atingido.", "Tese de " + (a ? a.ticker : "ativo") + " arquivada.");
      emit(EVENTS.THESIS_UPDATED, thesis(id)); persist();
    },

    /* -- Carteira / trades -- */
    // Executa compra. Regra: exige tese vinculada ao ativo.
    executeBuy: function (data) {
      var a = asset(data.ativo_id); if (!a) return { error: "Ativo inexistente." };

      /* ------------------------------------------------------------
         O QUE BLOQUEIA A COMPRA É O CAIXA, NÃO A TESE

         A regra anterior recusava a compra sem tese vinculada. Ela
         nasceu de um princípio do módulo — "toda decisão nasce de uma
         tese" — mas confundia duas coisas de naturezas diferentes:

           tese  é DISCIPLINA. Ausência dela é um problema de processo,
                 e o ATLAS já sabe cobrar processo: o alerta de "posição
                 sem tese" existe, o Oráculo responde sobre teses em
                 aberto, e o histórico registra tudo.
           caixa é POSSIBILIDADE. Sem dinheiro a compra não pode
                 acontecer — não é uma escolha de método, é aritmética.

         Bloquear pela tese fazia o sistema recusar uma compra que
         REALMENTE ocorreu no mundo, e recusar registrar um fato é pior
         que registrá-lo imperfeito: o dinheiro sai da corretora de
         qualquer jeito, e o ATLAS fica sem saber.

         A tese continua sendo cobrada — a posição nasce marcada, e o
         alerta aparece até ela existir. O que ela deixou de fazer é
         impedir o registro. Decisão do dono do produto, tomada na
         auditoria do Hold.
         ------------------------------------------------------------ */
      var semTese = !thesisOfAsset(a.id);

      var qty = num(data.quantidade), price = num(data.preco);
      if (qty <= 0 || price <= 0) return { error: "Quantidade e preço devem ser positivos." };

      /* ------------------------------------------------------------
         SÓ COMPRA QUEM TEM CAIXA

         A compra criava a posição do nada: o patrimônio subia sozinho
         e nenhum dinheiro saía de lugar nenhum. Agora o custo sai do
         caixa da carteira ativa, e carteira sem caixa não compra.
         ------------------------------------------------------------ */
      var custo = qty * price;
      var widC = activeWalletId();
      if (window.AtlasCaixa) {
        var conf = window.AtlasCaixa.podeGastar(widC, custo);
        if (!conf.ok) {
          return { error: "Caixa insuficiente: há " + fmtMoney(conf.saldo) +
                          " e a compra custa " + fmtMoney(custo) +
                          ". Registre um depósito em Carteiras & Movimentações." };
        }
      }

      var pos = positionOf(a.id);
      if (pos) {
        var newQty = pos.quantidade + qty;
        pos.preco_medio = ((pos.quantidade * pos.preco_medio) + (qty * price)) / newQty;
        pos.quantidade = newQty;
      } else {
        pos = { ativo_id: a.id, quantidade: qty, preco_medio: price, status: "invested" };
        // estampa de carteira/proveniência (o dinheiro é por carteira)
        if (window.AtlasWallets) Object.assign(pos, window.AtlasWallets.stamp("hold", data.origem || "compra", activeWalletId()));
        else pos.walletId = "principal";
        HOLD_STATE.carteira.push(pos);
      }
      a.status = "invested";
      /* A posição carrega a marca até a tese existir. É o que permite
         o alerta cobrar sem o sistema ter recusado o registro. */
      pos.semTese = semTese;
      logHistory(EVENTS.TRADE_EXECUTED, "buy", a.id, a.tese_id,
        data.justificativa || "Execução dentro da faixa de acúmulo da tese.",
        "Compra de " + qty + " " + a.ticker + " a " + fmtMoney(price) + ".");
      emit(EVENTS.TRADE_EXECUTED, { position: pos, side: "buy" });
      emit(EVENTS.POSITION_UPDATED, pos); persist();
      /* O dinheiro sai do caixa e vira posição. Era gravado TAMBÉM em
         AtlasMovements.record() — a mesma compra virava um movimento
         gravado ali, um movimento derivado das posições e um evento de
         caixa aqui. O AtlasMovements passou a ser uma vista do caixa,
         então este é o único registro. */
      if (window.AtlasCaixa) {
        window.AtlasCaixa.registrar({
          tipo: "aporte", valorUSD: custo, walletId: widC,
          module: "hold", refId: "hold:" + a.id,
          data: data.data,
          obs: "Compra de " + qty + " " + (a.ticker || "")
        });
      }
      return { position: pos };
    },

    // Venda. Regra: exige invalidação OU realização declarada.
    executeSell: function (data) {
      var a = asset(data.ativo_id); if (!a) return { error: "Ativo inexistente." };
      var pos = positionOf(a.id); if (!pos) return { error: "Sem posição para vender." };
      var qty = num(data.quantidade), price = num(data.preco);
      if (qty <= 0 || qty > pos.quantidade) return { error: "Quantidade inválida." };
      if (!data.motivo) return { error: "Toda venda depende de invalidação ou realização da tese." };

      pos.quantidade -= qty;
      if (pos.quantidade <= 0.00000001) {
        HOLD_STATE.carteira = HOLD_STATE.carteira.filter(function (p) { return p !== pos; });
        // ativo só vira "vendido" se não sobrou posição em nenhuma carteira
        if (!anyPositionOf(a.id)) a.status = "sold";
      }
      logHistory(EVENTS.TRADE_EXECUTED, "sell", a.id, a.tese_id,
        data.justificativa || (data.motivo === "invalidacao" ? "Tese invalidada." : "Realização de tese."),
        "Venda de " + qty + " " + a.ticker + " a " + fmtMoney(price) + ".");
      emit(EVENTS.TRADE_EXECUTED, { position: pos, side: "sell" });
      emit(EVENTS.POSITION_UPDATED, pos); persist();
      var widS = activeWalletId();
      var apurado = qty * price;
      /* ------------------------------------------------------------
         VENDER NÃO É TIRAR DINHEIRO DO ATLAS

         A venda removia a posição e registrava uma "saída" — e o
         dinheiro sumia do sistema. Mas vender não é sacar: o apurado
         vira CAIXA da mesma carteira, disponível para a próxima
         decisão. Quem quiser tirar do ATLAS registra um saque, que é
         outro evento e reduz o patrimônio de propósito.
         ------------------------------------------------------------ */
      if (window.AtlasCaixa) {
        window.AtlasCaixa.registrar({
          tipo: "retorno", valorUSD: apurado, walletId: widS,
          module: "hold", refId: "hold:" + a.id,
          data: data.data,
          obs: "Venda de " + qty + " " + (a.ticker || "")
        });
      }
      return { position: pos };
    },

    updateConfig: function (patch) {
      Object.assign(HOLD_STATE.config, patch);
      persist(); emit(EVENTS.STATE_CHANGED, { evt: "config", payload: HOLD_STATE.config });
    },

    resetToSeed: function () {
      try { localStorage.removeItem(LS_KEY); } catch (e) {}
      load(); emit(EVENTS.STATE_CHANGED, { evt: "reset" });
    },

    exportJSON: function () { return JSON.stringify(HOLD_STATE, null, 2); },

    importJSON: function (raw) {
      try {
        var parsed = JSON.parse(raw);
        Object.keys(HOLD_STATE).forEach(function (k) {
          if (k === "teses") return; // teses vivem na entidade compartilhada
          if (parsed[k] != null) HOLD_STATE[k] = parsed[k];
        });
        // Backups antigos podem trazer teses/estudos: repassa à entidade sem duplicar.
        if (window.AtlasTheses && (parsed.teses || parsed.estudos)) {
          var tk = {};
          (HOLD_STATE.ativos || []).forEach(function (a) { tk[a.id] = a.ticker; });
          (parsed.teses || []).forEach(function (o) {
            if (window.AtlasTheses.get(o.id)) return;
            var map = { active: "andamento", review: "andamento", invalid: "arquivada" };
            window.AtlasTheses.create({
              id: o.id, module: "hold", asset: tk[o.ativo_id] || "—",
              title: "Tese " + (tk[o.ativo_id] || ""), content: o.narrativa || "",
              status: map[o.status] || o.status || "andamento",
              data: {
                ativo_id: o.ativo_id || null, cenarios: o.cenarios || {},
                riscos: o.riscos || [], catalisadores: o.catalisadores || [],
                criterios_invalidacao: o.criterios_invalidacao || "",
                conviccao: o.conviccao != null ? o.conviccao : 5
              }
            });
          });
          (parsed.estudos || []).forEach(function (o) {
            if (window.AtlasTheses.get(o.id)) return;
            window.AtlasTheses.create({
              id: o.id, module: "hold", asset: tk[o.ativo_id] || "Tema geral",
              title: o.titulo || "Estudo sem título",
              content: [o.conteudo, o.insights].filter(Boolean).join("\n\n"),
              status: "planejada",
              data: { ativo_id: o.ativo_id || null, tipo_estudo: o.tipo || null, origem: "estudo" }
            });
          });
        }
        syncTheses();
        persist(); emit(EVENTS.STATE_CHANGED, { evt: "import" });
        return { ok: true };
      } catch (e) { return { error: "JSON inválido." }; }
    }
  };

  /* ---- utils ---- */
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function clampInt(v, lo, hi) { var n = Math.round(num(v)); return Math.max(lo, Math.min(hi, n)); }
  function toList(v) {
    if (Array.isArray(v)) return v.filter(Boolean);
    if (!v) return [];
    return String(v).split(/[\n,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function statusLabel(s) {
    return { invested: "investido", watchlist: "watchlist", sold: "vendido" }[s] || s;
  }
  function fmtMoney(v) {
    var n = num(v);
    var abs = Math.abs(n);
    var opt = abs >= 1000 ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 };
    return "$" + n.toLocaleString("en-US", opt);
  }

  /* ---- public API ---- */
  window.Store = {
    EVENTS: EVENTS, state: HOLD_STATE,
    on: on, emit: emit, init: load, persist: persist, uid: uid,
    actions: actions,
    get: {
      asset: asset, thesis: thesis, thesisOfAsset: thesisOfAsset, positionOf: positionOf,
      anyPositionOf: anyPositionOf, walletPositions: walletPositions,
      positionValue: positionValue, positionCost: positionCost, positionPnL: positionPnL,
      positionPnLPct: positionPnLPct, positionWeight: positionWeight,
      portfolioValue: portfolioValue, portfolioCost: portfolioCost,
      portfolioPnL: portfolioPnL, portfolioPnLPct: portfolioPnLPct,
      globalTotal: globalTotal,
      counts: counts, alerts: alerts
    },
    /* ---- Carteiras (ponte com a central) ---- */
    wallets: {
      list: function () { return window.AtlasWallets ? window.AtlasWallets.forModule("hold") : [{ id: "principal", name: "Principal", type: "global", color: "#4C9AFF" }]; },
      active: activeWallet,
      activeId: activeWalletId,
      set: function (id) {
        if (!window.AtlasWallets) return;
        var w = window.AtlasWallets.get(id);
        if (!w) return;
        if (w.type === "global") { setLocalWalletId(null); window.AtlasWallets.setActiveGlobal(id); }
        else { setLocalWalletId(id); } // Local do Hold: fica só aqui, mas persiste
        emit(EVENTS.STATE_CHANGED, { evt: "wallet_change" });
      },
      create: function (opts) {
        if (!window.AtlasWallets) return null;
        opts = opts || {};
        return window.AtlasWallets.create({ name: opts.name, type: opts.type || "isolada", module: "hold", color: opts.color, emoji: opts.emoji });
      }
    },
    fmt: { money: fmtMoney }
  };
})();
