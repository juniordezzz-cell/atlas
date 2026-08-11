/* ===================================================================
   ATLAS — Camada de consolidação (Bloco 3)
   -------------------------------------------------------------------
   Lê os TOTAIS REAIS de cada módulo (Trade, Hold, DeFi, RWA) direto das
   suas camadas de dados, soma tudo em US$ e devolve um snapshot para o
   dashboard principal.

   Regra de carteiras (via AtlasWallets):
     • carteiras GLOBAIS  → somam no patrimônio principal
     • carteiras ISOLADAS → ficam só no módulo (excluídas daqui)

   Tudo é defensivo: se um módulo não carregar, ele contribui 0 e o
   restante do dashboard continua funcionando.
   =================================================================== */
(function (global) {
  "use strict";

  function n(v) { return (typeof v === "number" && isFinite(v)) ? v : 0; }
  function safe(fn, fb) {
    try { var r = fn(); return (r === null || r === undefined) ? fb : r; }
    catch (e) { if (global.console) global.console.warn("[AtlasConsolidation]", e && e.message); return fb; }
  }

  var COLORS = { trade: "#4F8CFF", hold: "#22C55E", defi: "#8B5CF6", rwa: "#22D3EE" };

  /* ---- inicialização preguiçosa dos stores que precisam de init() ---- */
  function trade() {
    var A = global.ATLAS;
    if (A && A.app && A.app.init && !A.__consInit) { A.app.init(); A.__consInit = true; }
    return A;
  }
  function hold() {
    var S = global.Store; /* Hold expõe window.Store */
    if (S && S.init && !S.__consInit) { S.init(); S.__consInit = true; }
    return S;
  }

  function globalIds() {
    var W = global.AtlasWallets;
    return W && W.globals ? W.globals().map(function (w) { return w.id; }) : ["principal"];
  }

  /* ============================================================
     LEITORES POR CARTEIRA — a fonte única de "quanto vale"
     ------------------------------------------------------------
     Havia DOIS caminhos para responder a mesma pergunta:

       1. esta camada, lendo os stores ao vivo  → KPIs do Dashboard
       2. wallets/walletLedger, lendo o que cada módulo reportou
          → saldo mostrado no seletor de carteira

     E eles divergiam. Medido antes desta mudança, com Hold em
     US$ 60.000 e DeFi em US$ 12.500 na mesma carteira: o KPI dizia
     US$ 72.500 e o seletor, dois centímetros ao lado, dizia US$ 0.

     Duas causas somadas: DeFi e RWA nunca reportavam nada, e o cache
     dos que reportavam ficava velho.

     Agora existe UM leitor por módulo, aqui. Ele é usado:
       · pelos totais desta camada (somando as carteiras globais);
       · pelo ledger, registrado como leitor ao vivo — então na página
         em que o store existe, o cache nunca fala mais alto que a
         verdade.

     Devolve null quando o módulo não está carregado nesta página; é
     assim que o ledger sabe cair no cache.
     ============================================================ */

  function pacote(module, walletId, valor, capital) {
    return { id: walletId, module: module,
             capital: n(capital), saldo: n(valor), valorAtual: n(valor), assets: [] };
  }

  var LEITORES = {
    hold: function (walletId) {
      return safe(function () {
        var S = hold(); if (!S || !S.get || !S.state) return null;
        var pos = (S.state.carteira || []).filter(function (p) {
          return (p.walletId || "principal") === walletId;
        });
        var v = pos.reduce(function (a, p) { return a + n(S.get.positionValue(p)); }, 0);
        var c = pos.reduce(function (a, p) { return a + n(S.get.positionCost(p)); }, 0);
        return pacote("hold", walletId, v, c);
      }, null);
    },

    trade: function (walletId) {
      return safe(function () {
        var A = trade(); if (!A || !A.app || !A.app.getState) return null;
        var d = (A.app.getState().data || {})[walletId];
        var eq = d && d.equity;
        var v = (eq && eq.length) ? n(eq[eq.length - 1]) : 0;
        return pacote("trade", walletId, v, v);
      }, null);
    },

    defi: function (walletId) {
      return safe(function () {
        var S = global.DeFiStore;
        if (!S || !S.all) return null;
        var wd = (S.all().byWallet || {})[walletId];
        if (!wd) return pacote("defi", walletId, 0, 0);
        /* Delegado a DeFiStore.walletValue/walletCapital. A cópia que
           existia aqui somava só currentValue e esquecia a TAXA
           PENDENTE — dinheiro do usuário parado na pool, ausente do
           patrimônio consolidado. E "capital" somava p.capital, que
           depois dos eventos de fluxo passou a incluir reinvestimento:
           dinheiro que nunca saiu do bolso entrava como aporte. */
        return pacote("defi", walletId, S.walletValue(wd), S.walletCapital(wd));
      }, null);
    },

    rwa: function (walletId) {
      return safe(function () {
        if (!global.RWAStore || !global.RWAStore.all) return null;
        var wd = (global.RWAStore.all().byWallet || {})[walletId];
        var ativos = (wd && wd.assets) || [];
        var v = ativos.reduce(function (a, x) { return a + n(x.current); }, 0);
        var c = ativos.reduce(function (a, x) { return a + n(x.entry); }, 0);
        return pacote("rwa", walletId, v, c);
      }, null);
    }
  };

  /* Registra os leitores no ledger. O Dashboard carrega os quatro
     stores, então aqui TODOS respondem ao vivo — era exatamente o que
     faltava para o seletor parar de mostrar cache velho ao lado de um
     KPI correto. */
  (function registrarNoLedger() {
    var W = global.AtlasWallets;
    if (!W || !W.registerLive) return;

    Object.keys(LEITORES).forEach(function (m) {
      W.registerLive(m, LEITORES[m]);
    });

    /* E, de passagem, CURA o cache inteiro.

       O cache é só tão fresco quanto a última visita ao módulo — dentro
       do Hold não há DeFiStore para conferir, então a fatia de DeFi vale
       o que o DeFi gravou por último. Como esta página é a única que
       carrega os quatro stores ao mesmo tempo, ela é o único lugar onde
       dá para reescrever tudo com valor conferido.

       Custa quatro leituras por carteira, uma vez, no load. Em troca,
       passar pelo Dashboard deixa o saldo certo em todos os módulos. */
    safe(function () {
      W.all().forEach(function (w) {
        Object.keys(LEITORES).forEach(function (m) {
          var r = LEITORES[m](w.id);
          if (r) W.report(m, w.id, r);
        });
      });
      return true;
    }, null);
  })();

  /* ---------- TOTAIS (US$) — null = módulo ausente ----------
     Somam as carteiras GLOBAIS pelo mesmo leitor de cima. Antes cada
     um destes tinha a sua própria forma de perguntar ao store. */
  function totalGlobalDe(module) {
    var algum = false, sum = 0;
    globalIds().forEach(function (id) {
      var r = LEITORES[module](id);
      if (r) { algum = true; sum += n(r.valorAtual); }
    });
    return algum ? sum : null;      // null = módulo não carregado
  }

  function tradeTotal() { return totalGlobalDe("trade"); }
  function holdTotal()  { return totalGlobalDe("hold"); }
  function defiTotal()  { return totalGlobalDe("defi"); }
  function rwaTotal()   { return totalGlobalDe("rwa"); }

  /* ---------- P&L por módulo (best-effort) ---------- */
  function tradePnl() {
    return safe(function () {
      var A = trade(); if (!A || !A.app || !A.app.getState) return 0;
      var st = A.app.getState(), p = 0;
      globalIds().forEach(function (id) {
        var d = st.data && st.data[id];
        if (d && d.equity && d.equity.length > 1) p += d.equity[d.equity.length - 1] - d.equity[0];
      });
      return p;
    }, 0);
  }
  function holdPnl() { return safe(function () { var S = hold(); return (S && S.get && S.get.portfolioPnL) ? n(S.get.portfolioPnL()) : 0; }, 0); }
  /* O resultado do DeFi vinha de kpis().profit, que olha SÓ a carteira
     ATIVA no módulo. O patrimônio ao lado somava TODAS as globais: o
     card mostrava um total de quatro carteiras com o lucro de uma. Com
     duas carteiras globais, o mesmo painel exibia US$ 30.000 de
     patrimônio e o resultado de apenas uma delas, sem nada indicando
     que as réguas eram diferentes. */
  function defiPnl() {
    return safe(function () {
      var S = global.DeFiStore;
      if (!S) return 0;
      return n(S.globalProfit ? S.globalProfit() : S.kpis().profit);
    }, 0);
  }
  function rwaPnl()  { return safe(function () { return global.RWAStore ? n(global.RWAStore.kpis().pnlAbs) : 0; }, 0); }

  function moduleList() {
    return [
      { key: "trade", name: "Trade", total: tradeTotal(), color: COLORS.trade },
      { key: "hold",  name: "Hold",  total: holdTotal(),  color: COLORS.hold },
      { key: "defi",  name: "DeFi",  total: defiTotal(),  color: COLORS.defi },
      { key: "rwa",   name: "RWA",   total: rwaTotal(),   color: COLORS.rwa }
    ];
  }

  /* ---------- Histórico p/ evolução ----------
     Normaliza cada série do módulo para terminar no total ATUAL daquele
     módulo (reconcilia o endpoint com o KPI). Módulos sem série viram
     linha plana no total atual. Soma tudo elemento a elemento. */
  function vals(arr) { return (arr || []).map(function (p) { return typeof p === "number" ? p : n(p.value); }); }

  /* ------------------------------------------------------------
     SÉRIE DEGENERADA NÃO É SÉRIE

     A normalização (`k = totalAtual / último`) supõe que a série
     termina num valor comparável ao total de hoje. O RWA guarda
     equityCurves geradas com valor inicial ZERO — 90 zeros. Nesse
     caso `último` virava 1 pelo `|| 1`, k virava o total, e o
     resultado era 90 zeros vezes qualquer coisa: zero.

     Efeito na tela: o módulo entrava com o valor cheio no
     "Patrimônio Total" e com ZERO na curva de evolução — inclusive
     no ponto de HOJE. O gráfico terminava num número diferente do
     KPI logo acima dele.

     Série ausente ou degenerada agora vira linha reta no total atual:
     não é histórico (o módulo não mede), mas ao menos não contradiz
     o número ao lado.
     ------------------------------------------------------------ */
  function moduleHistory(key, currentTotal, days) {
    var series = null;
    if (key === "rwa")  series = safe(function () { return global.RWAStore ? vals(global.RWAStore.equityCurves().total) : null; }, null);
    if (key === "defi") series = safe(function () { return global.DeFiStore ? vals(global.DeFiStore.portfolioHistory(days)) : null; }, null);

    var out = [], j;
    function plana() {
      var f = []; for (j = 0; j < days; j++) f.push(currentTotal); return f;
    }
    if (!series || !series.length) return plana();

    var tail = series.slice(-days);
    var last = tail[tail.length - 1];
    /* último ponto zerado com total diferente de zero = série sem
       relação com a realidade do módulo */
    if (!isFinite(last) || (last === 0 && currentTotal !== 0)) return plana();

    var k = last ? (currentTotal / last) : 1;
    out = tail.map(function (v) { return v * k; });
    while (out.length < days) out.unshift(out[0]);
    return out.slice(-days);
  }

  /* ---------- Exposição por blockchain (best-effort) ---------- */
  function blockchain() {
    var map = {};
    function add(k, v) { if (!k) return; map[k] = (map[k] || 0) + n(v); }
    safe(function () {
      if (!global.RWAStore) return null;
      global.RWAStore.assets().forEach(function (a) {
        var chain = null;
        (a.token || []).forEach(function (t) { if (t && /blockchain/i.test(t.k || "")) chain = t.v; });
        add((chain || "Outros").split("/")[0].trim(), a.current);
      });
      return true;
    }, null);
    safe(function () {
      if (!global.DeFiStore || !global.DeFiStore.distribution) return null;
      (global.DeFiStore.distribution("chain") || []).forEach(function (d) { add(String(d.label).split("/")[0].trim(), d.value); });
      return true;
    }, null);
    return Object.keys(map).map(function (k) { return { label: k, value: Math.round(map[k]) }; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  /* ---------- Renda passiva estimada (APR/APY do DeFi) ---------- */
  function passiveIncome() {
    return safe(function () {
      if (!global.DeFiStore) return 0;
      var y = 0;
      (global.DeFiStore.staking() || []).forEach(function (s) { y += n(s.value) * n(s.apr) / 100; });
      (global.DeFiStore.lending() || []).forEach(function (l) { y += n(l.value) * n(l.apy) / 100; });
      return y / 12; /* mensal */
    }, 0);
  }

  function protocolsCount() {
    return safe(function () {
      if (!global.DeFiStore) return 0;
      var set = {};
      (global.DeFiStore.staking() || []).concat(global.DeFiStore.lending() || []).forEach(function (x) { if (x.protocol) set[x.protocol] = 1; });
      return Object.keys(set).length;
    }, 0);
  }

  /* ---------- SNAPSHOT ---------- */
  function snapshot(days) {
    days = days || 30;
    var mods = moduleList();
    var present = mods.filter(function (m) { return m.total !== null; });
    var total = present.reduce(function (a, m) { return a + n(m.total); }, 0);
    var pnl = tradePnl() + holdPnl() + defiPnl() + rwaPnl();

    var evo = []; for (var i = 0; i < days; i++) evo.push(0);
    present.forEach(function (m) {
      var h = moduleHistory(m.key, n(m.total), days);
      for (var j = 0; j < days; j++) evo[j] += n(h[j]);
    });

    var byModule = present
      .map(function (m) { return { label: m.name, value: n(m.total), color: m.color }; })
      .filter(function (x) { return x.value > 0; });

    var W = global.AtlasWallets;
    var wallets = W ? { total: safe(function () { return W.all().length; }, 0), globals: globalIds().length } : { total: 0, globals: 0 };

    /* ------------------------------------------------------------
       ARREDONDAMENTO É TRABALHO DA TELA, NÃO DA CAMADA DE DADOS

       total, pnl, passiveIncome e a série inteira saíam daqui já
       passados por Math.round(). Num patrimônio de seis dígitos não
       faz diferença; num de US$ 27,21 o snapshot devolvia 27 e TODA
       tela que consome a consolidação — Dashboard, Oráculo,
       Relatórios — passava a operar com o número truncado, sem chance
       de recuperar os centavos. Pior: o percentual era calculado
       depois, sobre os valores cheios, e não fechava com os inteiros
       exibidos ao lado.

       Aqui sai o valor cheio. Quem exibe decide as casas.
       ------------------------------------------------------------ */
    /* ------------------------------------------------------------
       O CAPITAL INVESTIDO É LIDO, NÃO DEDUZIDO

       `cost = total − pnl` é uma identidade contábil que só vale se
       "pnl" for exatamente "valor menos custo" em todos os módulos —
       e não é: no DeFi o resultado inclui taxa coletada, que já saiu
       da posição. A dedução dava 23,44 onde o capital real era 23,46,
       e a rentabilidade da tela principal não fechava com a da página
       da posição por uma diferença que ninguém saberia explicar.

       Os leitores por módulo já devolvem `capital`. Usar o número
       lido, com a dedução só como reserva para módulo que não informa.
       ------------------------------------------------------------ */
    var capital = 0, temCapital = false;
    present.forEach(function (m) {
      globalIds().forEach(function (id) {
        var r = LEITORES[m.key](id);
        if (r && isFinite(Number(r.capital))) { capital += n(r.capital); temCapital = true; }
      });
    });
    var cost = temCapital ? capital : (total - pnl);

    return {
      capital: cost,
      total: total,
      pnl: pnl,
      pnlPct: cost > 0 ? (pnl / cost) * 100 : 0,
      passiveIncome: passiveIncome(),
      protocols: protocolsCount(),
      byModule: byModule,
      evolution: evo,
      wallets: wallets,
      modules: mods
    };
  }

  /* ============================================================
     ALERTAS CONSOLIDADOS
     ------------------------------------------------------------
     O card "Alertas Inteligentes" do Dashboard lia SÓ o motor de
     risco do RWA. O nome prometia o sistema inteiro e entregava um
     módulo de quatro — e o Hold já calculava alertas próprios
     (Store.get.alerts) que nunca chegavam à tela principal.

     Aqui cada módulo contribui com o que ELE sabe. Nada é inventado:
     toda regra abaixo ou já existia no módulo, ou lê um estado que o
     próprio módulo define como problema.

     Formato de saída: { level, module, texto, quando }
       level: "crit" | "warn" | "info"  (ordena a lista)
     ============================================================ */

  var PESO = { crit: 0, warn: 1, info: 2 };

  function alerts() {
    var out = [];

    function add(level, module, texto, quando) {
      if (!texto) return;
      out.push({
        level: PESO[level] != null ? level : "info",
        module: module,
        texto: String(texto),
        quando: quando || "agora"
      });
    }

    /* ---- Hold: regras que o módulo já calculava e ninguém via ---- */
    safe(function () {
      var S = hold();
      if (!S || !S.get || !S.get.alerts) return null;
      S.get.alerts().forEach(function (a) {
        add(a.level, "hold", a.title + " — " + a.sub);
      });
      return true;
    }, null);

    /* ---- RWA: motor de risco (a única fonte que já aparecia) ----
       O riskEngine emite um item com level "ok" quando NÃO há nada
       errado ("Nenhuma sobre-exposição relevante"). Dentro da tela do
       RWA isso é um selo de tudo certo; num card chamado "Alertas
       Inteligentes" vira uma tranquilização com cara de aviso. Fica
       de fora — a ausência de alerta já é a mensagem. */
    var NIVEL_RWA = { neg: "crit", warn: "warn", info: "info" };
    safe(function () {
      if (!global.RWAStore || !global.RWAStore.riskEngine) return null;
      (global.RWAStore.riskEngine().alerts || []).forEach(function (a) {
        var nivel = (a && a.level) || "warn";
        if (nivel === "ok") return;
        add(NIVEL_RWA[nivel] || "warn", "rwa",
            typeof a === "string" ? a : (a.text || a.msg || ""),
            (a && a.when) || "agora");
      });
      return true;
    }, null);

    /* ---- DeFi: posição fora da faixa de preço ----
       Pool fora do range para de render taxa e começa a acumular
       perda impermanente. O módulo já marca esse estado; faltava
       alguém avisar fora da tela do DeFi. */
    safe(function () {
      if (!global.DeFiStore || !global.DeFiStore.activePools) return null;
      global.DeFiStore.activePools().forEach(function (p) {
        if (p.status === "range") {
          add("crit", "defi", "Pool " + p.base + "/" + p.quote + " (" + p.protocol +
                              ") está fora da faixa de preço.");
        }
      });
      return true;
    }, null);

    /* ---- Todos os módulos: tese aberta há mais de 72h ----
       Mesma régua que o Oráculo já usa (core/ui/atlas-shell.js). Uma
       tese parada é decisão adiada, que é o problema que o ATLAS
       existe para combater. */
    safe(function () {
      var T = global.AtlasTheses;
      if (!T || !T.open) return null;
      var LIM = 72 * 3600 * 1000;
      var paradas = T.open().filter(function (t) {
        return t.createdAt && (Date.now() - new Date(t.createdAt).getTime()) > LIM;
      });
      /* uma linha por módulo, não uma por tese: dez teses paradas no
         Trade viravam dez alertas iguais e enterravam o resto */
      var porModulo = {};
      paradas.forEach(function (t) {
        var m = t.module || "atlas";
        porModulo[m] = (porModulo[m] || 0) + 1;
      });
      Object.keys(porModulo).forEach(function (m) {
        var n = porModulo[m];
        add("warn", m, n + (n === 1 ? " tese aberta" : " teses abertas") +
                       " há mais de 72h — vale concluir ou arquivar.");
      });
      return true;
    }, null);

    /* crítico primeiro; dentro do mesmo nível, preserva a ordem de
       chegada (que é a ordem dos módulos acima) */
    return out.sort(function (a, b) { return PESO[a.level] - PESO[b.level]; });
  }

  global.AtlasConsolidation = {
    snapshot: snapshot,
    moduleList: moduleList,
    blockchain: blockchain,
    alerts: alerts
  };
})(window);
