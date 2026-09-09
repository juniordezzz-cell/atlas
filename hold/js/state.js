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
    ativos: [], carteira: [], teses: [], historico: [], config: {},
    /* Medições diárias do valor da carteira, por carteira. Ver
       recordSnapshot(). Existe para o painel poder desenhar uma curva
       que ele MEDIU, em vez de uma que ele inventou. */
    snapshots: {}
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
          /* Chave ausente no arquivo NÃO herda o que estava em memória:
             ela volta ao vazio. Sem isto, "Começar do zero" apagava as
             posições e deixava os snapshots de pé — o painel desenhava
             a curva de uma carteira que não existe mais. Vale para
             qualquer chave nova que o formato ganhe depois. */
          HOLD_STATE[k] = parsed[k] != null ? parsed[k] : (Array.isArray(HOLD_STATE[k]) ? [] : {});
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
    /* Carteira zerada, série zerada. Medição é sobre as posições — sem
       elas, não há o que a curva possa afirmar. */
    HOLD_STATE.snapshots = {};
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
  function positionOf(aid, walletId) {
    var wid = walletId || activeWalletId();
    return HOLD_STATE.carteira.find(function (p) { return p.ativo_id === aid && (p.walletId || "principal") === wid; });
  }
  /* posições da carteira ativa (o que as páginas veem) */
  function walletPositions(walletId) {
    var wid = walletId || activeWalletId();
    return HOLD_STATE.carteira.filter(function (p) { return (p.walletId || "principal") === wid; });
  }
  /* posição de um ativo em QUALQUER carteira (p/ regra "investido sem tese") */
  function anyPositionOf(aid) {
    return HOLD_STATE.carteira.find(function (p) { return p.ativo_id === aid; });
  }

  /* ============================================================
     STATUS DO ATIVO É CONSEQUÊNCIA, NÃO DECLARAÇÃO

     `status` era um campo GRAVADO, e o formulário de "Adicionar ativo"
     oferecia "Investido" numa lista suspensa. Medido na auditoria: dá
     para cadastrar um ativo marcado como investido sem comprar nada —
     nenhuma posição, nenhum dólar saindo do caixa. A partir daí o
     módulo mente em quatro lugares ao mesmo tempo:

       · Ativos → filtro "Investidos" lista um ativo que não se possui;
       · Métricas → o funil de decisão conta "1 investido" contra
         0 posições, e a convicção média passa a incluí-lo;
       · Alertas → dispara "Posição sem tese" para uma posição que não
         existe, gastando a atenção de quem lê num fantasma;
       · o inverso também acontecia — vender tudo numa carteira e
         continuar com posição em OUTRA deixava o campo desencontrado.

     Agora o status é derivado do único fato que o determina: existe
     posição? Vendeu alguma vez? É a mesma decisão que a auditoria
     tomou no status da faixa das pools (DeFiStore.statusDe) e pelo
     mesmo motivo — dado que descreve outro dado não pode ser digitado.
     ============================================================ */
  function statusDe(a) {
    if (!a) return "watchlist";
    if (anyPositionOf(a.id)) return "invested";
    var vendeu = HOLD_STATE.historico.some(function (h) {
      return h.ativo_id === a.id && h.subtipo === "sell";
    });
    return vendeu ? "sold" : "watchlist";
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

  /* ============================================================
     A CURVA DA CARTEIRA PASSA A SER MEDIDA

     O painel desenhava "Performance da carteira" a partir de uma
     função chamada, no próprio comentário, de "série sintética
     determinística": doze pontos rotulados Jan…Dez, interpolando do
     custo até o valor atual com uma ondulação de Math.sin() por cima.
     Nada ali aconteceu. Uma carteira aberta ontem exibia um ano de
     história, com subidas e quedas que ninguém viveu — e o mesmo
     desenho alimentava o sparkline do KPI "Valor da carteira",
     colando aparência de trajetória num número que é de hoje.

     É o mesmo defeito que esta auditoria já removeu do Trade
     (Math.sin(i) * 50) e do painel macro do RWA. Preço histórico o
     ATLAS não tem — e não dá para inventá-lo de trás para frente.
     O que ele PODE afirmar é o que mediu: uma leitura por dia, por
     carteira, igual ao snapshot do DeFi (Store._serie em
     defi/js/data.js). Dia sem abrir o sistema não vira ponto: a série
     repete o último valor conhecido, em degrau.

     Antes da primeira medição a série vem vazia — e vazio é um estado
     que a tela sabe desenhar. Melhor um espaço que diz "ainda não há
     medição" do que uma curva que diz o que não houve.
     ============================================================ */
  var MAX_SNAPS = 400;   /* só p/ o caminho de reserva, abaixo */

  function walletIdsGlobais() {
    return (window.AtlasWallets && window.AtlasWallets.globals)
      ? window.AtlasWallets.globals().map(function (w) { return w.id; })
      : ["principal"];
  }

  /* ------------------------------------------------------------
     A MEDIÇÃO SAIU DAQUI

     Os snapshots do Hold moravam em HOLD_STATE.snapshots, dentro do
     estado do módulo. Funcionava para o próprio painel do Hold e era
     invisível para todo o resto: a consolidação da raiz não tinha como
     ler uma medição guardada dentro de um store que ela não carrega —
     e por isso desenhava o Hold como linha reta.

     "Quanto isto valia naquele dia" é o mesmo conceito nos quatro
     módulos, e estava escrito três vezes em três formatos. Agora é um
     lugar só: core/atlas-snapshots.js. O Hold escreve lá e lê de lá.

     O caminho de reserva abaixo existe para a página aberta em
     file:// sem o arquivo compartilhado carregado — o módulo continua
     desenhando a própria curva, só não alimenta a consolidação.
     ------------------------------------------------------------ */
  function recordSnapshot() {
    var wid = activeWalletId();
    var v = portfolioValue(), c = portfolioCost();

    if (window.AtlasSnapshots) {
      return window.AtlasSnapshots.registrar("hold", wid, { v: v, c: c });
    }

    /* reserva local */
    if (!HOLD_STATE.snapshots || typeof HOLD_STATE.snapshots !== "object") HOLD_STATE.snapshots = {};
    if (!Array.isArray(HOLD_STATE.snapshots[wid])) HOLD_STATE.snapshots[wid] = [];
    var snaps = HOLD_STATE.snapshots[wid];
    var hoje = diaIso();
    if (!snaps.length && v === 0 && c === 0) return snaps;
    var ultimo = snaps[snaps.length - 1];
    if (ultimo && ultimo.d === hoje) {
      if (ultimo.v === v && ultimo.c === c) return snaps;
      ultimo.v = v; ultimo.c = c;
    } else {
      snaps.push({ d: hoje, v: v, c: c });
      if (snaps.length > MAX_SNAPS) snaps.splice(0, snaps.length - MAX_SNAPS);
    }
    persist();
    return snaps;
  }

  function diaIso(d) {
    var x = d || new Date();
    return x.getFullYear() + "-" +
      String(x.getMonth() + 1).padStart(2, "0") + "-" +
      String(x.getDate()).padStart(2, "0");
  }

  /* Série da carteira ATIVA — o que o painel do Hold desenha. */
  function portfolioHistory(dias) {
    recordSnapshot();
    dias = dias || 90;
    if (window.AtlasSnapshots) {
      return window.AtlasSnapshots.serie(dias, {
        modules: ["hold"], wallets: [activeWalletId()]
      }).map(function (p) { return { date: p.date, value: p.value, medido: p.medido }; });
    }
    return reservaSerie(HOLD_STATE.snapshots[activeWalletId()] || [], dias);
  }

  /* Série somando TODAS as carteiras globais — o que a consolidação
     precisa, e o que ela nunca teve como pedir. `globalTotal()` já
     soma assim; esta é a mesma régua ao longo do tempo. */
  function globalHistory(dias) {
    recordSnapshot();
    dias = dias || 90;
    if (window.AtlasSnapshots) {
      return window.AtlasSnapshots.serie(dias, {
        modules: ["hold"], wallets: walletIdsGlobais()
      });
    }
    return [];
  }

  function reservaSerie(snaps, dias) {
    if (!snaps.length) return [];
    var porDia = {};
    snaps.forEach(function (x) { porDia[x.d] = x; });
    var hoje = new Date(), corrente = null;
    var inicio = new Date(hoje); inicio.setDate(hoje.getDate() - (dias - 1));
    var iniIso = diaIso(inicio);
    for (var k = 0; k < snaps.length; k++) if (snaps[k].d <= iniIso) corrente = snaps[k];
    var out = [];
    for (var i = dias - 1; i >= 0; i--) {
      var d = new Date(hoje); d.setDate(hoje.getDate() - i);
      var iso = diaIso(d);
      if (porDia[iso]) corrente = porDia[iso];
      if (!corrente) continue;
      out.push({ date: iso, value: corrente.v, cost: corrente.c, medido: !!porDia[iso] });
    }
    return out;
  }

  function counts() {
    return {
      ativos: HOLD_STATE.ativos.length,
      investidos: HOLD_STATE.ativos.filter(function (a) { return statusDe(a) === "invested"; }).length,
      watchlist: HOLD_STATE.ativos.filter(function (a) { return statusDe(a) === "watchlist"; }).length,
      vendidos: HOLD_STATE.ativos.filter(function (a) { return statusDe(a) === "sold"; }).length,
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

  /* ============================================================
     PREFERÊNCIAS DO MÓDULO — que existiam e não valiam nada

     Configurações → Hold oferecia três interruptores:
     "Alertar teses invalidadas", "Alertar teses em revisão" e
     "Mostrar convicção nas listas". NENHUM era lido por uma linha de
     código do módulo. Ligar ou desligar não mudava nada na tela — e um
     controle que não controla é pior que um ausente, porque a pessoa
     desliga o alerta, continua vendo o alerta e conclui que o sistema
     está quebrado.

     Pior: os dois primeiros falavam de "invalidada" e "em revisão",
     status que deixaram de existir quando as Teses viraram entidade
     compartilhada. Eram interruptores para alertas que o módulo não
     emite mais.

     Agora as preferências correspondem aos alertas que EXISTEM, e são
     lidas aqui. O limite de concentração também sai daqui: ele estava
     escrito como "40" em três lugares (o alerta, a barra de peso da
     lista e o selo da tela do ativo) — três cópias da mesma regra.
     ============================================================ */
  var PADRAO_CONFIG = {
    alerta_sem_tese: true,
    alerta_concentracao: true,
    limite_concentracao: 40,
    mostrar_conviccao: true
  };

  function config(chave) {
    var c = HOLD_STATE.config || {};
    var v = c[chave];
    if (v === undefined || v === null || v === "") return PADRAO_CONFIG[chave];
    if (typeof PADRAO_CONFIG[chave] === "number") {
      var n = parseFloat(v);
      return isFinite(n) ? n : PADRAO_CONFIG[chave];
    }
    if (typeof PADRAO_CONFIG[chave] === "boolean") return v !== false && v !== "false";
    return v;
  }

  /* Um número, um dono: quem quiser saber se uma posição está
     concentrada pergunta aqui. */
  function concentrada(pct) { return pct > config("limite_concentracao"); }

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
        if (a2 && statusDe(a2) === "invested") {
          out.push({ level: "crit", title: "Tese arquivada", sub: a2.ticker + " está investido com tese arquivada. Reavalie a posição.", asset: t.ativo_id });
        }
      }
    });
    HOLD_STATE.ativos.forEach(function (a) {
      if (!config("alerta_sem_tese")) return;
      if (statusDe(a) === "invested" && !thesisOfAsset(a.id)) {
        out.push({ level: "crit", title: "Posição sem tese", sub: a.ticker + " está investido sem tese vinculada.", asset: a.id });
      }
    });
    walletPositions().forEach(function (p) {
      if (!config("alerta_concentracao")) return;
      var pct = positionWeight(p);
      if (concentrada(pct)) {
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
        conviccao: clampInt(data.conviccao, 0, 10)
      };
      /* `status` NÃO é gravado aqui — ver statusDe(). Todo ativo nasce
         em watchlist porque é isso que ele é: cadastrado e não
         comprado. Vira "investido" quando a compra acontece. */
      HOLD_STATE.ativos.push(a);
      logHistory(EVENTS.ASSET_CREATED, "asset", a.id, null,
        "Ativo adicionado ao sistema.", a.ticker + " criado em " + statusLabel(statusDe(a)) + ".");
      emit(EVENTS.ASSET_CREATED, a); persist();
      return a;
    },

    updateAsset: function (id, patch) {
      var a = asset(id); if (!a) return;
      /* `status` é derivado (statusDe). Aceitar um patch de status
         aqui reabriria a porta que a auditoria fechou: um ativo
         "investido" por declaração, sem posição nenhuma. */
      var limpo = {};
      Object.keys(patch || {}).forEach(function (k) {
        if (k !== "status" && k !== "id") limpo[k] = patch[k];
      });
      Object.assign(a, limpo);
      persist(); emit(EVENTS.STATE_CHANGED, { evt: "asset_patched", payload: a });
      return a;
    },

    /* ============================================================
       EXCLUIR ATIVO — não existia, e a regra nova tornou isso caro

       O Hold nunca teve como apagar um ativo. Conviver com lixo já era
       ruim; depois de "um ticker, um ativo" virou um beco: um ticker
       digitado errado passa a BLOQUEAR o certo para sempre, e a única
       saída era apagar o módulo inteiro.

       O que a exclusão NÃO pode fazer:
         · sumir com posição aberta — o dinheiro está lá dentro. Quem
           quer sair vende, e a venda devolve o apurado ao caixa. Por
           isso a recusa quando há posição em qualquer carteira.
         · apagar o histórico. As linhas viram registro de um ativo que
           não existe mais, e as telas já sabem exibir isso ("—"). Um
           livro de decisões que se reescreve não é livro de decisões.
         · apagar a tese: ela vive na entidade compartilhada e pode ter
           ido para o Academy. Fica arquivada, com o motivo.
       ============================================================ */
    deleteAsset: function (id) {
      var a = asset(id); if (!a) return { error: "Ativo inexistente." };

      var pos = anyPositionOf(id);
      if (pos) {
        return { error: a.ticker + " tem posição aberta (" + pos.quantidade + " unidades). " +
                        "Venda antes de excluir — o apurado volta para o caixa da carteira. " +
                        "Excluir aqui faria o dinheiro sumir sem venda e sem saque." };
      }

      var t = thesisOfAsset(id);
      if (t && window.AtlasTheses && t.status !== "concluida" && t.status !== "arquivada") {
        window.AtlasTheses.archive(t.id, "Ativo " + a.ticker + " excluído do Hold.");
        syncTheses();
      }
      if (a.ticker && window.AtlasPrecos) window.AtlasPrecos.limparManual(a.ticker);

      HOLD_STATE.ativos = HOLD_STATE.ativos.filter(function (x) { return x.id !== id; });
      logHistory(EVENTS.ASSET_CREATED, "asset", id, t ? t.id : null,
        "Ativo excluído do sistema.", a.ticker + " removido — não havia posição aberta.");
      emit(EVENTS.STATE_CHANGED, { evt: "asset_deleted", payload: a }); persist();
      return { deleted: a, teseArquivada: !!(t && t.status !== "concluida" && t.status !== "arquivada") };
    },

    /* updatePrice() vivia aqui e NUNCA foi chamada por tela nenhuma —
       nem antes nem depois de o módulo ganhar remarcação de preço. Quem
       faz o trabalho hoje são refreshPrices() (todas, pela cadeia) e
       precoManual() (uma, informada por você). Uma terceira porta para
       gravar preço, sem dono, é a próxima divergência esperando
       acontecer. */


    /* ============================================================
       PREÇO NA MÃO — a regra do ATLAS, que faltava no Hold

       O botão "Atualizar preços" já dizia, quando nenhuma fonte
       reconhecia o ativo: "informe o preço na mão em Editar". Só que
       o Hold NÃO TINHA Editar — nem formulário, nem botão, nem rota.
       A instrução apontava para um lugar inexistente, e o preço de um
       ativo que nenhuma API conhece ficava travado no que foi digitado
       no cadastro, para sempre.

       O preço informado aqui vai para o registro manual central
       (core/atlas-precos.js), não para um campo solto: é ele que vence
       a API na cadeia de resolução, envelhece depois de sete dias e
       avisa quando está velho. Gravar só em `preco_atual` faria o
       próximo "Atualizar preços" apagá-lo em silêncio.
       ============================================================ */
    precoManual: function (id, usd) {
      var a = asset(id); if (!a) return { error: "Ativo inexistente." };
      var v = num(usd);
      if (!(v > 0)) return { error: "O preço precisa ser maior que zero." };
      if (!a.ticker) return { error: "O ativo precisa de ticker para ter preço." };
      if (window.AtlasPrecos) window.AtlasPrecos.definirManual(a.ticker, v);
      a.preco_atual = v;
      a.precoFonte = "manual";
      a.precoEm = new Date().toISOString();
      logHistory(EVENTS.POSITION_UPDATED, "price", id, a.tese_id,
        "Preço informado manualmente.", a.ticker + " marcado a " + fmtMoney(v) + " por você.");
      emit(EVENTS.POSITION_UPDATED, a); persist();
      return { asset: a };
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

    /* ============================================================
       INICIAR E REATIVAR TESE — as duas ações que fugiam do store

       A tela de Teses chamava `AtlasTheses.setStatus()` e
       `AtlasTheses.reopen()` DIRETO, sem passar por aqui. O cabeçalho
       deste arquivo diz que toda mutação passa por Store.actions
       porque é aqui que o histórico é escrito — e essas duas não
       escreviam. Consequência: "Iniciar" uma tese planejada e
       "Reativar" uma arquivada não apareciam no Histórico, numa tela
       que se apresenta como "registro imutável de decisões. Toda ação
       do sistema deixa rastro aqui".

       Começar a analisar um ativo e ressuscitar uma tese arquivada são
       exatamente o tipo de decisão que se quer reler meses depois.
       ============================================================ */
    startThesis: function (id) {
      if (!window.AtlasTheses) return null;
      var t = thesis(id); if (!t) return null;
      if (t.status !== "planejada") return t;
      window.AtlasTheses.setStatus(id, "andamento");
      syncTheses();
      var a = asset(t.ativo_id);
      logHistory(EVENTS.THESIS_UPDATED, "thesis", t.ativo_id, id,
        "Análise iniciada.", "Tese de " + (a ? a.ticker : t.titulo || "ativo") +
        " saiu da fila e entrou em andamento.");
      emit(EVENTS.THESIS_UPDATED, thesis(id)); persist();
      return thesis(id);
    },

    reopenThesis: function (id) {
      if (!window.AtlasTheses) return null;
      var t = thesis(id); if (!t) return null;
      var antes = t.status;
      window.AtlasTheses.reopen(id);
      syncTheses();
      var t2 = thesis(id); if (!t2) return null;
      var a2 = asset(t2.ativo_id);
      logHistory(EVENTS.THESIS_UPDATED, "thesis", t2.ativo_id, id,
        antes === "arquivada" ? "Tese desarquivada." : "Tese reaberta.",
        "Tese de " + (a2 ? a2.ticker : t2.titulo || "ativo") +
        " voltou ao andamento (versão " + t2.version + ").");
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
      var widC = data.walletId || activeWalletId();
      if (window.AtlasWallets && (!window.AtlasWallets.get || !window.AtlasWallets.get(widC))) {
        return { error: "Carteira inválida para registrar a compra." };
      }
      if (window.AtlasCaixa) {
        var conf = window.AtlasCaixa.podeGastar(widC, custo);
        if (!conf.ok) {
          return { error: "Caixa insuficiente: há " + fmtMoney(conf.saldo) +
                          " e a compra custa " + fmtMoney(custo) +
                          ". Registre um depósito em Carteiras & Movimentações." };
        }
      }

      var pos = positionOf(a.id, widC);
      if (pos) {
        var newQty = pos.quantidade + qty;
        pos.preco_medio = ((pos.quantidade * pos.preco_medio) + (qty * price)) / newQty;
        pos.quantidade = newQty;
      } else {
        pos = { ativo_id: a.id, quantidade: qty, preco_medio: price, status: "invested" };
        // estampa de carteira/proveniência (o dinheiro é por carteira)
        if (window.AtlasWallets) Object.assign(pos, window.AtlasWallets.stamp("hold", data.origem || "compra", widC));
        else pos.walletId = "principal";
        HOLD_STATE.carteira.push(pos);
      }
      /* `a.status = "invested"` saiu: existir posição JÁ é ser
         investido, e statusDe() lê isso direto. */
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
      var widS = data.walletId || activeWalletId();
      var pos = positionOf(a.id, widS); if (!pos) return { error: "Sem posição para vender nesta carteira." };
      var qty = num(data.quantidade), price = num(data.preco);
      if (qty <= 0 || qty > pos.quantidade) return { error: "Quantidade inválida." };
      /* ------------------------------------------------------------
         VENDA A PREÇO ZERO FAZIA O DINHEIRO SUMIR

         A compra validava preço positivo; a venda não. O campo já vem
         preenchido com `preco_atual`, que é ZERO em ativo cadastrado
         sem preço — e nenhuma fonte reconhecendo o ticker, ele fica
         zero. Confirmar assim apagava a posição e creditava $0 no
         caixa: o capital investido evaporava do ATLAS sem depósito,
         sem saque e sem prejuízo declarado.

         É a regra de ouro nº 4 — nenhum dinheiro pode desaparecer.
         ------------------------------------------------------------ */
      if (price <= 0) {
        return { error: "Informe o preço de venda. A " + fmtMoney(0) +
                        " a posição sairia da carteira sem nada voltar ao caixa." };
      }
      if (!data.motivo) return { error: "Toda venda depende de invalidação ou realização da tese." };

      pos.quantidade -= qty;
      if (pos.quantidade <= 0.00000001) {
        HOLD_STATE.carteira = HOLD_STATE.carteira.filter(function (p) { return p !== pos; });
        /* O ativo vira "vendido" sozinho: sem posição em carteira
           nenhuma e com venda no histórico, statusDe() já responde. */
      }
      logHistory(EVENTS.TRADE_EXECUTED, "sell", a.id, a.tese_id,
        data.justificativa || (data.motivo === "invalidacao" ? "Tese invalidada." : "Realização de tese."),
        "Venda de " + qty + " " + a.ticker + " a " + fmtMoney(price) + ".");
      emit(EVENTS.TRADE_EXECUTED, { position: pos, side: "sell" });
      emit(EVENTS.POSITION_UPDATED, pos); persist();
      var widRet = pos.walletId || widS;
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
          tipo: "retorno", valorUSD: apurado, walletId: widRet,
          module: "hold", refId: "hold:" + a.id,
          data: data.data,
          obs: "Venda de " + qty + " " + (a.ticker || "")
        });
      }
      return { position: pos };
    },

    /* updateConfig() saiu: nenhuma tela a chamava. As preferências do
       módulo são editadas em Configurações → Hold, por
       core/atlas-module-settings.js, que grava direto na chave. Manter
       um segundo caminho de escrita para o mesmo objeto é como as duas
       telas passam a discordar sobre o que está ligado. O Hold LÊ as
       preferências em config() — ver o bloco lá em cima. */


    resetToSeed: function () {
      try { localStorage.removeItem(LS_KEY); } catch (e) {}
      /* A medição vive fora do estado do módulo agora — apagar só a
         chave do Hold deixaria a curva de pé no livro compartilhado,
         descrevendo uma carteira que não existe mais. */
      if (window.AtlasSnapshots) window.AtlasSnapshots.limpar("hold");
      load(); emit(EVENTS.STATE_CHANGED, { evt: "reset" });
    },

    /* exportJSON()/importJSON() saíram. O botão que usava o primeiro
       gerava um arquivo que o segundo nunca leu — importJSON não era
       chamado por tela nenhuma. Pior, o arquivo levava POSIÇÕES sem os
       eventos de caixa que as explicam: restaurá-lo recriaria
       patrimônio sem depósito que o justifique.

       O backup do ATLAS é central (core/atlas-backup.js), cobre
       atlas.hold.state.v2 e atlas.hold.wallet.v1 e restaura tudo junto,
       caixa incluído. Um formato de backup por sistema, não um por
       módulo. */
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
      globalTotal: globalTotal, statusDe: statusDe,
      portfolioHistory: portfolioHistory, globalHistory: globalHistory,
      recordSnapshot: recordSnapshot,
      counts: counts, alerts: alerts,
      config: config, concentrada: concentrada
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
