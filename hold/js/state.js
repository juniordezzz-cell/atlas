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
     é por carteira). Ativos continuam do módulo inteiro. A carteira
     ativa efetiva é
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

  /* ------------------------------------------------------------
     MODO "TODAS AS CARTEIRAS"

     Escolhido no seletor de carteira. Ligado, as leituras do Hold
     (posições, caixa, realizado, curva, alertas) passam a somar TODAS
     as carteiras que o Hold enxerga: as globais e as locais do Hold.
     Escolher uma carteira específica desliga o modo e mostra só ela.
     As escritas (comprar, vender, desfazer) sempre usam a carteira
     explícita da operação — nunca a soma.
     ------------------------------------------------------------ */
  var KEY_ESCOPO = "atlas.hold.escopo.v1";
  function modoTodas() {
    try { return localStorage.getItem(KEY_ESCOPO) === "todas"; } catch (e) { return false; }
  }
  function setModoTodas(on) {
    try { localStorage.setItem(KEY_ESCOPO, on ? "todas" : "carteira"); } catch (e) {}
  }
  function idsDoHold() {
    return window.AtlasWallets && window.AtlasWallets.forModule
      ? window.AtlasWallets.forModule("hold").map(function (w) { return w.id; })
      : ["principal"];
  }
  /* as carteiras que a tela está olhando agora */
  function escopoIds() { return modoTodas() ? idsDoHold() : [activeWalletId()]; }

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
    POSITION_UPDATED: "POSITION_UPDATED",
    TRADE_EXECUTED:   "TRADE_EXECUTED",
    STATE_CHANGED:    "STATE_CHANGED"   // interno p/ re-render
  };

  var bus = {};
  function on(evt, fn) { (bus[evt] = bus[evt] || []).push(fn); }
  function emit(evt, payload) {
    (bus[evt] || []).forEach(function (fn) { try { fn(payload); } catch (e) { console.error(e); } });
    if (evt !== EVENTS.STATE_CHANGED) emit(EVENTS.STATE_CHANGED, { evt: evt, payload: payload });
  }

  /* ---- State ---- */
  var HOLD_STATE = {
    ativos: [], carteira: [], historico: [], config: {},
    /* Medições diárias do valor da carteira, por carteira. Ver
       recordSnapshot(). Existe para o painel poder desenhar uma curva
       que ele MEDIU, em vez de uma que ele inventou. */
    snapshots: {},
    /* Uma linha por venda: custo baixado, apurado e o resultado entre
       os dois. Sem isto o lucro de uma venda ia para o caixa e para
       resultado nenhum — o "Lucro Total" ficava abaixo do que o
       patrimônio mostrava. Ver executeSell e realizado(). */
    vendas: [],
    /* Uma linha por compra/venda com TUDO o que ela mexeu: a posição
       como era antes, os eventos de caixa que gravou e a venda que
       apurou. É o que permite desfazer uma operação digitada errado
       sem deixar resto no caixa nem no preço médio. Ver undoLast(). */
    operacoes: []
  };

  function uid(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ---- persistence ---- */
  function persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(HOLD_STATE));
    }
    catch (e) { console.warn("localStorage indisponível:", e); }
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(LS_KEY); } catch (e) {}
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        Object.keys(HOLD_STATE).forEach(function (k) {
          /* Chave ausente no arquivo NÃO herda o que estava em memória:
             ela volta ao vazio. Sem isto, "Começar do zero" apagava as
             posições e deixava os snapshots de pé — o painel desenhava
             a curva de uma carteira que não existe mais. Vale para
             qualquer chave nova que o formato ganhe depois. */
          HOLD_STATE[k] = parsed[k] != null ? parsed[k] : (Array.isArray(HOLD_STATE[k]) ? [] : {});
        });
        var mudouCarteira = ensureWalletStamp();
        if (limparTeses() || mudouCarteira) persist();
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
    HOLD_STATE.vendas = [];
    ensureWalletStamp();
    persist();
    watchWallets();
  }

  /* ------------------------------------------------------------
     O ATLAS NÃO TEM MAIS TESES

     O módulo foi construído em volta delas: convicção no ativo, tese
     vinculada na posição, linha "Tese criada/revisada" no histórico.
     O conceito saiu do sistema (decisão do dono do produto,
     23/09/2026), e o que ele deixou gravado sai junto na primeira
     leitura — compras, vendas e preços ficam intactos.
     ------------------------------------------------------------ */
  var EVENTOS_DE_TESE = { THESIS_CREATED: 1, THESIS_UPDATED: 1, STUDY_CONVERTED: 1 };
  function limparTeses() {
    var mudou = false;
    (HOLD_STATE.ativos || []).forEach(function (a) {
      ["tese_id", "conviccao"].forEach(function (k) { if (k in a) { delete a[k]; mudou = true; } });
    });
    (HOLD_STATE.carteira || []).forEach(function (p) {
      if ("semTese" in p) { delete p.semTese; mudou = true; }
    });
    var antes = (HOLD_STATE.historico || []).length;
    HOLD_STATE.historico = (HOLD_STATE.historico || []).filter(function (h) {
      return !EVENTOS_DE_TESE[h.tipo_acao] && h.subtipo !== "thesis" && h.subtipo !== "study";
    });
    HOLD_STATE.historico.forEach(function (h) {
      if ("tese_id" in h) { delete h.tese_id; mudou = true; }
    });
    ["alerta_sem_tese", "mostrar_conviccao", "alerta_invalidacao", "alerta_revisao"].forEach(function (k) {
      if (HOLD_STATE.config && k in HOLD_STATE.config) { delete HOLD_STATE.config[k]; mudou = true; }
    });
    return mudou || HOLD_STATE.historico.length !== antes;
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

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  /* ---- history helper (toda ação gera histórico) ---- */
  function logHistory(tipo_acao, subtipo, ativo_id, justificativa, impacto, quando) {
    var h = {
      id: uid("h"), tipo_acao: tipo_acao, subtipo: subtipo || null,
      ativo_id: ativo_id || null,
      justificativa: justificativa || "", impacto: impacto || "",
      data: quando || new Date().toISOString()
    };
    HOLD_STATE.historico.unshift(h);
    return h;
  }

  /* ------------------------------------------------------------
     QUANTIDADE SEM RESTO DE PONTO FLUTUANTE

     0,7 − 0,4 dá 0,29999999999999993 em JavaScript. A tela mostrava
     "0,3", a pessoa digitava 0,3 para vender tudo e a venda era
     recusada como "Quantidade inválida" — não havia como fechar a
     posição. Toda quantidade passa a ser arredondada em 10 casas
     (mais fina que qualquer token real) antes de ser gravada ou
     comparada.
     ------------------------------------------------------------ */
  var CASAS_QTD = 1e10;
  function arredQtd(q) { return Math.round((+q || 0) * CASAS_QTD) / CASAS_QTD; }

  /* Data da operação: o dia escolhido no formulário vira um instante
     para o histórico. Hoje → agora; dia passado → meio-dia local
     daquele dia (evita o dia "pular" ao converter para UTC). */
  function instanteDe(dia) {
    var s = String(dia || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s >= diaIso()) return new Date().toISOString();
    return new Date(s + "T12:00:00").toISOString();
  }

  /* ============================================================
     SELECTORS (derivações — nunca alteram estado)
     ============================================================ */
  function asset(id) { return HOLD_STATE.ativos.find(function (a) { return a.id === id; }); }
  function posicaoReal(aid, wid) {
    return HOLD_STATE.carteira.find(function (p) { return p.ativo_id === aid && (p.walletId || "principal") === wid; });
  }
  /* O mesmo ativo em várias carteiras vira UMA linha na visão somada:
     quantidade somada e preço médio ponderado pelo custo. É só leitura
     — `partes` guarda as posições verdadeiras, e nenhuma ação grava
     neste objeto. */
  function somarPosicoes(lista) {
    if (lista.length === 1) return lista[0];
    var q = 0, custo = 0;
    lista.forEach(function (p) { q += p.quantidade; custo += p.quantidade * p.preco_medio; });
    return { ativo_id: lista[0].ativo_id, quantidade: arredQtd(q), preco_medio: q ? custo / q : 0,
             walletId: null, virtual: true, partes: lista };
  }
  /* Com carteira explícita, a posição verdadeira dela. Sem, a posição
     do que a tela está olhando (uma carteira, ou todas somadas). */
  function positionOf(aid, walletId) {
    if (walletId) return posicaoReal(aid, walletId);
    var ids = escopoIds();
    var achadas = HOLD_STATE.carteira.filter(function (p) {
      return p.ativo_id === aid && ids.indexOf(p.walletId || "principal") >= 0;
    });
    return achadas.length ? somarPosicoes(achadas) : undefined;
  }
  /* posições do que a tela está olhando — uma por ativo */
  function walletPositions(walletId) {
    if (walletId) {
      return HOLD_STATE.carteira.filter(function (p) { return (p.walletId || "principal") === walletId; });
    }
    var ids = escopoIds(), porAtivo = {}, ordem = [];
    HOLD_STATE.carteira.forEach(function (p) {
      if (ids.indexOf(p.walletId || "principal") < 0) return;
      if (!porAtivo[p.ativo_id]) { porAtivo[p.ativo_id] = []; ordem.push(p.ativo_id); }
      porAtivo[p.ativo_id].push(p);
    });
    return ordem.map(function (aid) { return somarPosicoes(porAtivo[aid]); });
  }
  /* posição de um ativo em QUALQUER carteira */
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
       · Métricas → conta "1 investido" contra 0 posições;
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
    /* Venda desfeita não conta: a linha fica no histórico, marcada. */
    var vendeu = HOLD_STATE.historico.some(function (h) {
      return h.ativo_id === a.id && h.subtipo === "sell" && !h.desfeita;
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
  /* Resultado JÁ REALIZADO em vendas de uma carteira, e o custo que o
     produziu (a base dele na rentabilidade). Andam juntos pelo mesmo
     motivo do Trade: numerador sem o seu denominador é o erro nº 2. */
  function vendasDe(walletId) {
    var ids = walletId ? [walletId] : escopoIds();
    return (HOLD_STATE.vendas || []).filter(function (v) { return ids.indexOf(v.walletId || "principal") >= 0; });
  }
  function realizado(walletId) {
    return vendasDe(walletId).reduce(function (s, v) { return s + (Number(v.resultado) || 0); }, 0);
  }
  function capitalRealizado(walletId) {
    return vendasDe(walletId).reduce(function (s, v) { return s + (Number(v.custo) || 0); }, 0);
  }
  /* O realizado de UM ativo na carteira. Sem isto, um ativo vendido
     com prejuízo aparecia na lista com "—" no resultado, e a tela dele
     dizia "Ainda não investido" — como se o dinheiro nunca tivesse
     passado por ali. */
  function realizadoDoAtivo(aid, walletId) {
    return vendasDe(walletId).filter(function (v) { return v.ativo_id === aid; })
      .reduce(function (acc, v) {
        acc.resultado += Number(v.resultado) || 0;
        acc.custo += Number(v.custo) || 0;
        acc.apurado += Number(v.apurado) || 0;
        acc.vendas++;
        return acc;
      }, { resultado: 0, custo: 0, apurado: 0, vendas: 0 });
  }

  /* A última operação desfazível de um ativo numa carteira. Só a mais
     recente: desfazer uma do meio deixaria o preço médio das seguintes
     calculado sobre uma base que deixou de existir. */
  function ultimaOperacao(aid, walletId) {
    var ids = walletId ? [walletId] : escopoIds();
    return (HOLD_STATE.operacoes || []).filter(function (o) {
      return o.ativo_id === aid && ids.indexOf(o.walletId) >= 0;
    })[0] || null;
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
  /* Mede CADA carteira do Hold pelas posições dela — não "a carteira
     ativa". No modo todas, gravar a soma sob o id da ativa poria o
     valor de todas dentro de uma só. */
  function recordSnapshot() {
    var r = null;
    idsDoHold().forEach(function (wid) {
      var ps = walletPositions(wid);
      var v = ps.reduce(function (s, p) { return s + positionValue(p); }, 0);
      var c = ps.reduce(function (s, p) { return s + positionCost(p); }, 0);
      r = registrarSnapshot(wid, v, c);
    });
    return r;
  }
  function registrarSnapshot(wid, v, c) {
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
        modules: ["hold"], wallets: escopoIds()
      }).map(function (p) { return { date: p.date, value: p.value, medido: p.medido }; });
    }
    return reservaSerie(HOLD_STATE.snapshots[escopoIds()[0]] || [], dias);
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
      posicoes: walletPositions().length,
      historico: HOLD_STATE.historico.length
    };
  }

  /* ============================================================
     PREFERÊNCIAS DO MÓDULO — que existiam e não valiam nada

     Configurações → Hold oferecia interruptores que NENHUMA linha de
     código do módulo lia. Ligar ou desligar não mudava nada na tela —
     e um controle que não controla é pior que um ausente, porque a
     pessoa desliga o alerta, continua vendo o alerta e conclui que o
     sistema está quebrado.

     Agora as preferências correspondem aos alertas que EXISTEM, e são
     lidas aqui. O limite de concentração também sai daqui: ele estava
     escrito como "40" em três lugares (o alerta, a barra de peso da
     lista e o selo da tela do ativo) — três cópias da mesma regra.
     ============================================================ */
  var PADRAO_CONFIG = {
    alerta_concentracao: true,
    limite_concentracao: 40
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

  /* Alertas derivados das posições: concentração acima do limite. */
  function alerts() {
    var out = [];
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
        setor: data.setor || "", categoria: data.categoria || ""
      };
      /* id exato da CoinGecko, quando o ativo veio do autocompletar:
         é por ele que o preço é buscado (ver refreshPrices). */
      if (data.cg_id) a.cg_id = String(data.cg_id);
      /* `status` NÃO é gravado aqui — ver statusDe(). Todo ativo nasce
         em watchlist porque é isso que ele é: cadastrado e não
         comprado. Vira "investido" quando a compra acontece. */
      HOLD_STATE.ativos.push(a);
      logHistory(EVENTS.ASSET_CREATED, "asset", a.id,
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
       ============================================================ */
    deleteAsset: function (id) {
      var a = asset(id); if (!a) return { error: "Ativo inexistente." };

      var pos = anyPositionOf(id);
      if (pos) {
        return { error: a.ticker + " tem posição aberta (" + pos.quantidade + " unidades). " +
                        "Venda antes de excluir — o apurado volta para o caixa da carteira. " +
                        "Excluir aqui faria o dinheiro sumir sem venda e sem saque." };
      }

      if (a.ticker && window.AtlasPrecos) window.AtlasPrecos.limparManual(a.ticker);

      HOLD_STATE.ativos = HOLD_STATE.ativos.filter(function (x) { return x.id !== id; });
      logHistory(EVENTS.ASSET_CREATED, "asset", id,
        "Ativo excluído do sistema.", a.ticker + " removido — não havia posição aberta.");
      emit(EVENTS.STATE_CHANGED, { evt: "asset_deleted", payload: a }); persist();
      return { deleted: a };
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
      logHistory(EVENTS.POSITION_UPDATED, "price", id,
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
      /* ------------------------------------------------------------
         SÓ CRIPTO VAI PARA A CADEIA AUTOMÁTICA

         A cadeia do ATLAS é de cripto: CoinGecko e, por último, pools
         de DEX casadas pelo SÍMBOLO. Medido em 08/10/2026: AAPL, TSLA,
         SPY e GOLD voltavam com preço — de tokens homônimos em DEX. Uma
         ação cadastrada no Hold era marcada pelo preço de um token
         qualquer, com cara de cotação. Ação, ETF, commodity e "outro"
         ficam no preço informado por você (Editar).
         ------------------------------------------------------------ */
      var todos = HOLD_STATE.ativos.filter(function (a) { return a.ticker; });
      var comTicker = todos.filter(ehCripto);
      var soManual = todos.filter(function (a) { return !ehCripto(a) && !(a.preco_atual > 0); })
        .map(function (a) { return a.ticker; });
      if (!comTicker.length) {
        return Promise.resolve({ atualizados: 0, faltando: [], divergentes: [], soManual: soManual, erro: null });
      }

      /* Quem foi cadastrado pelo autocompletar tem o id exato da
         CoinGecko. Buscar pelo id evita o casamento por símbolo, que
         é ambíguo (há dezenas de "UNI", "PEPE"...). Preço manual
         continua vencendo — ele nem entra nesta lista. */
      var prov = window.AtlasProviders && window.AtlasProviders.get && window.AtlasProviders.get("coingecko");
      var porId = comTicker.filter(function (a) {
        return a.cg_id && prov && prov.pricesRaw && !window.AtlasPrecos.manual(a.ticker);
      });
      var porSimbolo = comTicker.filter(function (a) { return porId.indexOf(a) < 0; });

      var pIds = porId.length
        ? prov.pricesRaw(porId.map(function (a) { return a.cg_id; })).catch(function (e) { return { __erro: e }; })
        : Promise.resolve({});
      var pSim = porSimbolo.length
        ? window.AtlasPrecos.deVarios(porSimbolo.map(function (a) { return a.ticker; }))
        : Promise.resolve({ valores: {}, fonte: {}, faltando: [], divergentes: [], erro: null });

      return Promise.all([pIds, pSim]).then(function (rs) {
        var mapaId = rs[0] || {}, d = rs[1];
        var n = 0, faltando = (d.faltando || []).slice();
        var erro = mapaId.__erro || d.erro || null;
        function aplicar(a, p, fonte) {
          if (p == null || !(p > 0)) return false;
          if (a.preco_atual !== p) {
            a.preco_atual = p; a.precoFonte = fonte; n++;
            a.precoEm = new Date().toISOString();
          } else if (fonte !== "manual") {
            /* conferido agora e igual: o preço continua fresco. O
               manual não — a idade dele é a de quando você o digitou. */
            a.precoEm = new Date().toISOString();
          }
          return true;
        }
        porId.forEach(function (a) {
          if (!aplicar(a, mapaId[a.cg_id], "coingecko")) faltando.push(a.ticker);
        });
        porSimbolo.forEach(function (a) {
          var k = String(a.ticker).toUpperCase();
          /* Com a fonte principal fora do ar, TODO ativo cai na DEX,
             que casa pelo símbolo — inclusive BTC e ETH, que ganhariam
             o preço de qualquer token homônimo. Melhor manter o preço
             anterior e tentar de novo. */
          if (erro && d.fonte[k] === "dex") return;
          aplicar(a, d.valores[k], d.fonte[k] || null);
        });
        persist();
        if (n) emit(EVENTS.STATE_CHANGED, { evt: "prices_refreshed" });
        return { atualizados: n, faltando: faltando, divergentes: d.divergentes || [],
                 soManual: soManual, erro: erro };
      });
    },

    /* Remarcação automática ao abrir o Hold: o preço só mudava quando
       alguém lembrava de clicar em "Atualizar preços", e a valorização
       da carteira ficava parada no preço do cadastro. Só dispara se
       algum ativo cripto estiver mais velho que `minutos`. */
    refreshIfStale: function (minutos) {
      var lim = Date.now() - (minutos || 15) * 60000;
      var velho = HOLD_STATE.ativos.some(function (a) {
        return a.ticker && ehCripto(a) && (!a.precoEm || new Date(a.precoEm).getTime() < lim);
      });
      if (!velho || !window.AtlasPrecos) return Promise.resolve(null);
      return actions.refreshPrices().catch(function () { return null; });
    },

    /* -- Carteira / trades -- */
    // Executa compra. O que decide se ela pode acontecer é o caixa.
    executeBuy: function (data) {
      var a = asset(data.ativo_id); if (!a) return { error: "Ativo inexistente." };

      var qty = arredQtd(num(data.quantidade)), price = num(data.preco);
      if (qty <= 0 || price <= 0) return { error: "Quantidade e preço devem ser positivos." };
      if (data.data && String(data.data).slice(0, 10) > diaIso()) {
        return { error: "A data da compra não pode estar no futuro." };
      }
      /* ------------------------------------------------------------
         TAXA — da corretora ou da rede, em dólar

         Na compra ela é custo de entrar na posição: sai do caixa junto
         com o valor dos tokens e entra no preço médio. Comprar 1 BTC a
         60.000 pagando 60 de taxa custa 60.060 — é a partir daí que o
         ativo precisa subir para dar lucro.
         ------------------------------------------------------------ */
      var taxa = num(data.taxa);
      if (taxa < 0) return { error: "A taxa não pode ser negativa." };

      /* ------------------------------------------------------------
         O CUSTO SAI DO CAIXA DA CARTEIRA ESCOLHIDA

         A compra criava a posição do nada: o patrimônio subia sozinho
         e nenhum dinheiro saía de lugar nenhum. Agora o custo sai do
         caixa da carteira da posição. Com data.cobrirFalta (o
         formulário), o que faltar entra antes como depósito automático
         (AtlasCaixa.cobrirFalta); sem ela, carteira sem caixa não compra.
         ------------------------------------------------------------ */
      var custo = qty * price + taxa;
      var widC = data.walletId || activeWalletId();
      if (window.AtlasWallets && (!window.AtlasWallets.get || !window.AtlasWallets.get(widC))) {
        return { error: "Carteira inválida para registrar a compra." };
      }
      var depAuto = null;
      if (data.cobrirFalta && window.AtlasCaixa && window.AtlasCaixa.cobrirFalta) {
        depAuto = window.AtlasCaixa.cobrirFalta(widC, custo, {
          module: "hold", refId: "hold:" + a.id, data: data.data,
          obs: "Depósito automático para comprar " + (a.ticker || "")
        });
        if (depAuto === false) return { error: "O caixa da carteira não pôde ser registrado." };
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
      var antes = pos ? clone(pos) : null;
      if (pos) {
        var newQty = arredQtd(pos.quantidade + qty);
        pos.preco_medio = ((pos.quantidade * pos.preco_medio) + custo) / newQty;
        pos.quantidade = newQty;
      } else {
        pos = { ativo_id: a.id, quantidade: qty, preco_medio: custo / qty, status: "invested" };
        // estampa de carteira/proveniência (o dinheiro é por carteira)
        if (window.AtlasWallets) Object.assign(pos, window.AtlasWallets.stamp("hold", data.origem || "compra", widC));
        else pos.walletId = "principal";
        /* aberta no dia da compra, não no dia do cadastro */
        if (data.data) pos.data = instanteDe(data.data);
        HOLD_STATE.carteira.push(pos);
      }
      /* `a.status = "invested"` saiu: existir posição JÁ é ser
         investido, e statusDe() lê isso direto. */
      var hBuy = logHistory(EVENTS.TRADE_EXECUTED, "buy", a.id,
        data.justificativa || "Compra registrada.",
        "Compra de " + fmtQtd(qty) + " " + a.ticker + " a " + fmtMoney(price) +
        " (total " + fmtMoney(custo) + (taxa > 0 ? ", com taxa de " + fmtMoney(taxa) : "") + ").",
        instanteDe(data.data));
      /* O dinheiro sai do caixa e vira posição. Era gravado TAMBÉM em
         AtlasMovements.record() — a mesma compra virava um movimento
         gravado ali, um movimento derivado das posições e um evento de
         caixa aqui. O AtlasMovements passou a ser uma vista do caixa,
         então este é o único registro. */
      var evAporte = null;
      if (window.AtlasCaixa) {
        evAporte = window.AtlasCaixa.registrar({
          tipo: "aporte", valorUSD: custo, walletId: widC,
          module: "hold", refId: "hold:" + a.id,
          data: data.data,
          obs: "Compra de " + fmtQtd(qty) + " " + (a.ticker || "") +
               (taxa > 0 ? " (taxa " + fmtMoney(taxa) + ")" : "")
        });
      }
      HOLD_STATE.operacoes.unshift({
        id: uid("op"), tipo: "buy", ativo_id: a.id, walletId: widC,
        quantidade: qty, preco: price, taxa: taxa, valorCaixa: custo, data: data.data || diaIso(),
        antes: antes,
        eventos: [evAporte && evAporte.id, depAuto && depAuto.id].filter(Boolean),
        histId: hBuy.id
      });
      emit(EVENTS.TRADE_EXECUTED, { position: pos, side: "buy" });
      emit(EVENTS.POSITION_UPDATED, pos); persist();
      return { position: pos, depositoAuto: depAuto ? depAuto.valorUSD : 0 };
    },

    // Venda: o apurado volta ao caixa da carteira.
    executeSell: function (data) {
      var a = asset(data.ativo_id); if (!a) return { error: "Ativo inexistente." };
      var widS = data.walletId || activeWalletId();
      var pos = positionOf(a.id, widS); if (!pos) return { error: "Sem posição para vender nesta carteira." };
      var qty = arredQtd(num(data.quantidade)), price = num(data.preco);
      var tem = arredQtd(pos.quantidade);
      if (qty <= 0) return { error: "Informe a quantidade a vender." };
      if (qty > tem) {
        return { error: "Você tem " + fmtQtd(tem) + " " + a.ticker + " nesta carteira — não dá para vender " + fmtQtd(qty) + "." };
      }
      if (data.data && String(data.data).slice(0, 10) > diaIso()) {
        return { error: "A data da venda não pode estar no futuro." };
      }
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
      /* Na venda a taxa sai do que volta: vender 1 BTC a 70.000 com 70
         de taxa devolve 69.930 ao caixa, e é sobre isso que o lucro é
         apurado. */
      var taxa = num(data.taxa);
      if (taxa < 0) return { error: "A taxa não pode ser negativa." };
      if (taxa >= qty * price) {
        return { error: "A taxa (" + fmtMoney(taxa) + ") é maior que o valor da venda (" +
                        fmtMoney(qty * price) + ") — confira os números." };
      }

      /* O resultado da venda é apurado ANTES de a quantidade baixar,
         sobre o preço médio da posição: é esse custo que sai dela. */
      var antes = clone(pos);
      var custoVendido = qty * pos.preco_medio;
      var venda = {
        id: uid("v"), ativo_id: a.id, walletId: pos.walletId || widS,
        quantidade: qty, preco: price, precoMedio: pos.preco_medio,
        taxa: taxa, custo: custoVendido, apurado: qty * price - taxa,
        resultado: qty * price - taxa - custoVendido,
        data: data.data || new Date().toISOString()
      };
      HOLD_STATE.vendas.unshift(venda);

      pos.quantidade = arredQtd(tem - qty);
      if (pos.quantidade <= 0) {
        HOLD_STATE.carteira = HOLD_STATE.carteira.filter(function (p) { return p !== pos; });
        /* O ativo vira "vendido" sozinho: sem posição em carteira
           nenhuma e com venda no histórico, statusDe() já responde. */
      }
      var resTxt = venda.resultado >= 0 ? "lucro de " + fmtMoney(venda.resultado) : "prejuízo de " + fmtMoney(-venda.resultado);
      var hSell = logHistory(EVENTS.TRADE_EXECUTED, "sell", a.id,
        data.justificativa || "Venda registrada.",
        "Venda de " + fmtQtd(qty) + " " + a.ticker + " a " + fmtMoney(price) +
        (taxa > 0 ? ", taxa de " + fmtMoney(taxa) : "") +
        " (" + resTxt + " sobre o preço médio de " + fmtMoney(venda.precoMedio) + ").",
        instanteDe(data.data));
      var widRet = pos.walletId || widS;
      var apurado = venda.apurado;
      /* ------------------------------------------------------------
         VENDER NÃO É TIRAR DINHEIRO DO ATLAS

         A venda removia a posição e registrava uma "saída" — e o
         dinheiro sumia do sistema. Mas vender não é sacar: o apurado
         vira CAIXA da mesma carteira, disponível para a próxima
         decisão. Quem quiser tirar do ATLAS registra um saque, que é
         outro evento e reduz o patrimônio de propósito.
         ------------------------------------------------------------ */
      var evRet = null;
      if (window.AtlasCaixa) {
        evRet = window.AtlasCaixa.registrar({
          tipo: "retorno", valorUSD: apurado, walletId: widRet,
          module: "hold", refId: "hold:" + a.id,
          data: data.data,
          obs: "Venda de " + fmtQtd(qty) + " " + (a.ticker || "") +
               (taxa > 0 ? " (taxa " + fmtMoney(taxa) + ")" : "")
        });
      }
      HOLD_STATE.operacoes.unshift({
        id: uid("op"), tipo: "sell", ativo_id: a.id, walletId: widRet,
        quantidade: qty, preco: price, taxa: taxa, valorCaixa: apurado, data: data.data || diaIso(),
        antes: antes, eventos: evRet ? [evRet.id] : [],
        vendaId: venda.id, histId: hSell.id
      });
      emit(EVENTS.TRADE_EXECUTED, { position: pos, side: "sell" });
      emit(EVENTS.POSITION_UPDATED, pos); persist();
      return { position: pos, venda: venda };
    },

    /* ============================================================
       DESFAZER A ÚLTIMA OPERAÇÃO — para o erro de digitação

       Não havia como corrigir uma compra lançada errado: o único
       caminho era vender (gravando um resultado que não existiu) ou
       apagar o módulo. Agora a operação mais recente de um ativo numa
       carteira pode ser desfeita por inteiro: a posição volta a ser o
       que era (quantidade E preço médio), os eventos de caixa que ela
       gravou saem do extrato — inclusive o depósito automático — e a
       venda deixa de contar no realizado.

       Só a mais recente, de propósito (ver ultimaOperacao). E venda só
       se desfaz se o dinheiro dela ainda está no caixa: se já foi
       gasto em outra compra, apagar o retorno deixaria o caixa
       negativo — desfaça a outra compra antes.

       O histórico NÃO é apagado: ganha a linha "Operação desfeita", e
       a original fica marcada. Livro de decisões não se reescreve.
       ============================================================ */
    undoLast: function (aid, walletId) {
      var op = ultimaOperacao(aid, walletId);
      if (!op) return { error: "Não há operação para desfazer nesta carteira." };
      var a = asset(aid);
      var C = window.AtlasCaixa;

      if (op.tipo === "sell" && C && op.eventos.length) {
        var apurado = op.valorCaixa != null ? op.valorCaixa : op.quantidade * op.preco;
        var conf = C.podeGastar(op.walletId, apurado);
        if (!conf.ok) {
          return { error: "O dinheiro desta venda (" + fmtMoney(apurado) + ") já não está todo no caixa — há " +
                          fmtMoney(conf.saldo) + ". Desfaça antes a operação que usou esse dinheiro." };
        }
      }

      /* posição: volta exatamente ao que era */
      var atual = positionOf(aid, op.walletId);
      HOLD_STATE.carteira = HOLD_STATE.carteira.filter(function (p) { return p !== atual; });
      if (op.antes) HOLD_STATE.carteira.push(clone(op.antes));

      if (op.vendaId) {
        HOLD_STATE.vendas = HOLD_STATE.vendas.filter(function (v) { return v.id !== op.vendaId; });
      }
      if (C && C.remover) op.eventos.forEach(function (id) { C.remover(id); });

      HOLD_STATE.operacoes = HOLD_STATE.operacoes.filter(function (o) { return o !== op; });
      HOLD_STATE.historico.forEach(function (h) { if (h.id === op.histId) h.desfeita = true; });
      logHistory(EVENTS.TRADE_EXECUTED, "undo", aid, "Operação desfeita.",
        (op.tipo === "buy" ? "Compra" : "Venda") + " de " + fmtQtd(op.quantidade) + " " +
        (a ? a.ticker : "") + " a " + fmtMoney(op.preco) + " foi desfeita — posição e caixa voltaram ao que eram.");
      emit(EVENTS.POSITION_UPDATED, op.antes); persist();
      return { desfeita: op };
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
  function ehCripto(a) { return !a.tipo || a.tipo === "Cripto"; }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function statusLabel(s) {
    return { invested: "investido", watchlist: "watchlist", sold: "vendido" }[s] || s;
  }
  /* Texto que fica GRAVADO no histórico: sempre em dólar e na grafia
     do resto do ATLAS ("US$ 1.234,56"). Era "$1,234" em en-US — a
     única tela do sistema com vírgula de milhar. Não passa pelo
     conversor de moeda de propósito: o registro não pode mudar de
     valor quando alguém troca a moeda de exibição. */
  function fmtMoney(v) {
    var n = num(v);
    var abs = Math.abs(n);
    var opt = abs >= 1000 ? { maximumFractionDigits: 0 }
      : abs > 0 && abs < 1 ? { maximumFractionDigits: 6 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    return (n < 0 ? "−" : "") + "US$ " + Math.abs(n).toLocaleString("pt-BR", opt);
  }
  function fmtQtd(q) { return (+q || 0).toLocaleString("pt-BR", { maximumFractionDigits: 8 }); }

  /* ---- public API ---- */
  window.Store = {
    EVENTS: EVENTS, state: HOLD_STATE,
    on: on, emit: emit, init: load, persist: persist, uid: uid,
    actions: actions,
    get: {
      asset: asset, positionOf: positionOf,
      anyPositionOf: anyPositionOf, walletPositions: walletPositions,
      positionValue: positionValue, positionCost: positionCost, positionPnL: positionPnL,
      positionPnLPct: positionPnLPct, positionWeight: positionWeight,
      realizado: realizado, capitalRealizado: capitalRealizado,
      realizadoDoAtivo: realizadoDoAtivo, ultimaOperacao: ultimaOperacao,
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
      /* No modo todas, `active()` devolve uma carteira-vista ("Todas as
         carteiras") para os rótulos das telas; `real()` é sempre a
         carteira de verdade — é ela que um formulário oferece. */
      todas: modoTodas,
      setTodas: function (on) {
        setModoTodas(!!on);
        emit(EVENTS.STATE_CHANGED, { evt: "wallet_change" });
      },
      escopo: escopoIds,
      real: activeWallet,
      caixa: function () {
        if (!window.AtlasCaixa) return null;
        return escopoIds().reduce(function (s, id) { return s + (window.AtlasCaixa.saldo(id) || 0); }, 0);
      },
      eventosCaixa: function () {
        if (!window.AtlasCaixa) return [];
        /* eventos() recebe { walletId }, não o id solto — com o id solto o
           filtro era ignorado e voltava o livro de TODAS as carteiras */
        return escopoIds().reduce(function (acc, id) { return acc.concat(window.AtlasCaixa.eventos({ walletId: id }) || []); }, []);
      },
      list: function () { return window.AtlasWallets ? window.AtlasWallets.forModule("hold") : [{ id: "principal", name: "Principal", type: "global", color: "#4C9AFF" }]; },
      active: function () {
        return modoTodas()
          ? { id: null, name: "Todas as carteiras", todas: true, type: "todas" }
          : activeWallet();
      },
      activeId: activeWalletId,
      set: function (id) {
        if (!window.AtlasWallets) return;
        var w = window.AtlasWallets.get(id);
        if (!w) return;
        setModoTodas(false);   // escolher uma carteira sai da soma
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
    fmt: { money: fmtMoney, qtd: fmtQtd }
  };
})();
