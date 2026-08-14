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

    /* O Trade valia o último ponto de `equity` — um array decorativo,
       zerado desde a semente. Agora vale o capital dentro das
       operações abertas. Ver trade/assets/js/core/state.js. */
    trade: function (walletId) {
      return safe(function () {
        var A = trade(); if (!A || !A.app || !A.app.valorEmPosicoes) return null;
        var v = n(A.app.valorEmPosicoes(walletId));
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

    /* Lê RWAStore.byWallet(), não all().byWallet — `all()` devolve a
       visão MESCLADA da carteira atual e nunca teve `byWallet`. O
       resultado era o RWA entrando com zero no patrimônio consolidado,
       com o módulo cheio. Ver o comentário em RWA/js/store.js. */
    rwa: function (walletId) {
      return safe(function () {
        if (!global.RWAStore || !global.RWAStore.byWallet) return null;
        var wd = global.RWAStore.byWallet()[walletId];
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

    /* ------------------------------------------------------------
       E CARIMBA A MEDIÇÃO DO DIA, MÓDULO POR MÓDULO E CARTEIRA POR
       CARTEIRA

       O gráfico "Evolução do Patrimônio" desta página afirmava 90 dias
       de história. Auditado: Hold e Trade entravam como LINHA RETA
       (nunca foram perguntados — o Trade nem tinha o que responder), e
       DeFi e RWA entravam com a série da carteira ATIVA esticada por
       uma constante até o fim bater com o total de TODAS as carteiras.
       Uma medição real multiplicada até caber é pior que a linha reta:
       linha reta se denuncia, curva esticada tem cara de história.

       Esta página é a única que carrega os quatro stores ao mesmo
       tempo — é o único lugar onde dá para medir tudo com o mesmo
       relógio. O leitor por carteira que já existe acima responde
       "quanto vale hoje"; aqui esse número ganha data e vai para o
       livro compartilhado (core/atlas-snapshots.js).

       É assim que o Trade passa a ter série sem precisar de um
       mecanismo próprio: ele não guarda medição nenhuma, mas sabe
       dizer quanto vale. Guardar é problema de outro arquivo.
       ------------------------------------------------------------ */
    safe(function () {
      if (!global.AtlasSnapshots) return null;
      var globais = globalIds();
      globais.forEach(function (id) {
        Object.keys(LEITORES).forEach(function (m) {
          var r = LEITORES[m](id);
          /* null = store ausente nesta página. Registrar zero aqui
             seria afirmar que o módulo valia nada naquele dia, quando
             o que houve foi ausência de leitura. */
          if (!r) return;
          global.AtlasSnapshots.registrar(m, id, { v: n(r.valorAtual), c: n(r.capital) });
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
  /* Resultado do Trade = soma dos pnlUSD realizados. Era a diferença
     entre o primeiro e o último ponto de `equity` — dois zeros, para
     sempre, em qualquer carteira. */
  function tradePnl() {
    return safe(function () {
      var A = trade(); if (!A || !A.app || !A.app.getState) return 0;
      var st = A.app.getState(), p = 0;
      globalIds().forEach(function (id) {
        var d = st.data && st.data[id];
        (d && d.trades ? d.trades : []).forEach(function (t) {
          if (t.status === "encerrado") p += n(t.pnlUSD);
        });
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
  /* vals() saiu junto com a normalização: ela era a única a usar essa
     conversão de formato, porque cada módulo devolvia a série num
     formato diferente. Com o livro compartilhado há um formato só. */

  /* ============================================================
     A SÉRIE DE UM MÓDULO — MEDIDA, NUNCA ESTICADA

     O que havia aqui:

       · o Hold e o Trade nem eram perguntados → linha reta;
       · o DeFi e o RWA respondiam com a série da carteira ATIVA;
       · e então `k = totalAtual / últimoPonto` multiplicava a série
         inteira até o fim bater com o total de TODAS as carteiras.

     A normalização foi escrita para resolver um sintoma real (a curva
     terminava num número diferente do KPI ao lado). Só que a causa era
     de escopo: série de uma carteira contra total de várias. Esticar
     uma medição real por uma constante produz um passado que não
     aconteceu — e com aparência de dado, não de placeholder.

     Agora todos os quatro leem do mesmo livro de medições, já somado
     pelas carteiras GLOBAIS — o mesmo conjunto que produz o total. Sem
     fator de correção, porque não há mais o que corrigir: as duas
     pontas são a mesma régua.

     Módulo sem medição nenhuma continua entrando como linha reta no
     total atual, e isso agora é REPORTADO (ver `medidos` no snapshot):
     a tela pode dizer quantos dias foram medidos de fato em vez de
     deixar 90 pontos sugerirem 90 dias de história.
     ============================================================ */
  function moduleHistory(key, currentTotal, days) {
    var serie = safe(function () {
      if (!global.AtlasSnapshots) return null;
      return global.AtlasSnapshots.serie(days, { modules: [key], wallets: globalIds() });
    }, null);

    var out = [], j;
    /* Sem livro de medições (página que não carrega o arquivo): linha
       reta no total atual. Não é histórico — é a única coisa que não
       contradiz o KPI ao lado. */
    function plana() {
      var f = []; for (j = 0; j < days; j++) f.push(currentTotal); return f;
    }
    if (!global.AtlasSnapshots) return plana();
    if (!serie || !serie.length) { for (j = 0; j < days; j++) out.push(null); return out; }

    out = serie.map(function (p) { return n(p.value); });
    /* ------------------------------------------------------------
       ANTES DA PRIMEIRA MEDIÇÃO NÃO HÁ LINHA

       O impulso é repetir o primeiro valor conhecido para a esquerda,
       preenchendo a janela. Mas isso AFIRMA que o patrimônio era
       aquele valor num dia em que ninguém mediu nada — e num sistema
       recém-aberto pinta 89 dias de estabilidade que não existiram.

       `null` faz o gráfico simplesmente não desenhar ali. A linha
       começa onde a medição começou, e o buraco à esquerda é a
       resposta honesta: não sabemos.
       ------------------------------------------------------------ */
    while (out.length < days) out.unshift(null);
    return out.slice(-days);
  }

  /* Quantos dias da janela têm medição de verdade, somando os módulos.
     É o número que separa "90 dias de história" de "90 pontos". */
  function diasMedidos(days) {
    return safe(function () {
      if (!global.AtlasSnapshots) return 0;
      return global.AtlasSnapshots.medidos(days, { wallets: globalIds() });
    }, 0);
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

    /* ------------------------------------------------------------
       SOMA QUE PRESERVA O "NÃO SABEMOS"

       Antes: `evo` começava com 90 zeros e cada módulo somava por
       cima — então um dia sem medição de NINGUÉM saía como zero, e o
       gráfico desenhava o patrimônio despencando a zero no passado.

       Agora um dia só existe se ALGUM módulo o mediu. Onde nenhum
       mediu, o ponto é null e o gráfico não desenha. E um módulo sem
       medição naquele dia não contribui zero: ele contribui nada, o
       que é diferente — zero é uma afirmação sobre o valor.
       ------------------------------------------------------------ */
    var series = present.map(function (m) { return moduleHistory(m.key, n(m.total), days); });
    var evo = [];
    for (var i = 0; i < days; i++) {
      var soma = 0, algum = false;
      for (var s = 0; s < series.length; s++) {
        var v = series[s][i];
        if (v == null) continue;
        soma += n(v); algum = true;
      }
      evo.push(algum ? soma : null);
    }

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

    /* ============================================================
       AS CONTAS SAEM DO NÚCLEO (core/atlas-contabilidade.js)

       Dois erros de matemática viviam exatamente aqui, e nenhum era de
       aritmética:

       1. O CAIXA NÃO ENTRAVA NO PATRIMÔNIO. `total` somava só o valor
          das posições. Medido: depositar US$ 50.000 deixava o
          "Patrimônio Total" em ZERO, e comprar US$ 30.000 o fazia
          "subir" para 30.000 — como se o dinheiro nascesse na compra e
          sumisse na venda. A regra de ouro nº 4 diz o contrário: o
          patrimônio só muda com depósito ou saque. Ela já decidia esta
          questão; a conta é que não obedecia.

       2. A RENTABILIDADE MISTURAVA RÉGUAS. `pnl` inclui o resultado
          REALIZADO do Trade (operações encerradas) e `cost` só tinha o
          capital das ABERTAS. Medido: +5.000 do Trade sobre 30.000 de
          custo do Hold = +16,67% exibidos. Agora quem informa
          resultado realizado informa a base dele, e sem base a
          rentabilidade sai NULA — a tela diz que não sabe, em vez de
          dividir por um denominador alheio.
       ============================================================ */
    var C = global.AtlasContabilidade;

    /* Caixa das carteiras globais. É dinheiro do usuário parado, e
       patrimônio é o que se tem, não só o que está aplicado. */
    var caixa = safe(function () {
      if (!global.AtlasCaixa) return 0;
      return globalIds().reduce(function (a, id) { return a + n(global.AtlasCaixa.saldo(id)); }, 0);
    }, 0);

    /* Base do resultado realizado — hoje só o Trade tem resultado
       fechado dentro do consolidado. Módulo que passe a ter precisa
       informar a sua base aqui, senão a rentabilidade fica nula de
       propósito. */
    var baseRealizada = safe(function () {
      var A = trade(); if (!A || !A.app || !A.app.capitalRealizado) return 0;
      return globalIds().reduce(function (a, id) { return a + n(A.app.capitalRealizado(id)); }, 0);
    }, 0);
    var realizado = tradePnl();

    /* `pnl` é a SOMA DO QUE OS MÓDULOS RELATAM, e ela não é
       `valor − custo`: o resultado do DeFi inclui taxa já coletada,
       que saiu da posição e foi para o caixa. Por isso o resultado
       aberto é informado, não derivado — ver o bloco em
       core/atlas-contabilidade.js. O que o núcleo garante é que o
       número exibido como resultado é o mesmo que entra na
       rentabilidade. */
    var contas = C ? C.patrimonio({
      caixa: caixa,
      posicoes: [{ valor: total, custo: cost }],
      resultadoAberto: pnl - realizado,   /* Hold + DeFi + RWA */
      realizado: realizado,
      baseRealizada: baseRealizada
    }) : null;

    return {
      capital: cost,
      /* `total` passa a ser o PATRIMÔNIO (caixa incluído). `investido`
         continua disponível para quem quer só o aplicado — são dois
         números legítimos, e o erro era ter um só com o nome do outro. */
      total: contas ? contas.patrimonio : total,
      investido: total,
      caixa: caixa,
      pnl: pnl,
      /* null = não há base para afirmar rentabilidade. A tela escreve
         "—". Antes isto era 0, que se lê como "ficou de lado". */
      pnlPct: contas ? contas.rentabilidade : (cost > 0 ? (pnl / cost) * 100 : null),
      pnlBaseIncompleta: contas ? contas.baseIncompleta : false,
      passiveIncome: passiveIncome(),
      protocols: protocolsCount(),
      byModule: byModule,
      evolution: evo,
      /* Quantos pontos da série vieram de MEDIÇÃO. Sem isto a tela não
         tem como distinguir 90 dias de história de 90 pontos, dos
         quais 88 são o último valor conhecido repetido. */
      evolutionMedidos: diasMedidos(days),
      evolutionDias: days,
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
       perda impermanente.

       ALERTA CRÍTICO EM CIMA DE UM CAMPO DIGITADO

       A condição era `p.status === "range"` — o campo que o usuário
       escolhia num botão do wizard ("Dentro do range" / "Fora do
       range") e que só a tela do Dashboard do DeFi reescrevia, e só
       quando havia cotação dos dois lados. Um token que nenhuma API
       reconhece congelava a escolha original, e o ATLAS passava a
       emitir alerta CRÍTICO, para sempre, sobre uma posição que
       ninguém tinha avaliado.

       Agora pergunta a quem calcula. Sem veredito (sem preço, sem
       faixa cadastrada) não há alerta: a ausência de conclusão não é
       uma conclusão ruim. */
    safe(function () {
      var S = global.DeFiStore;
      if (!S || !S.activePools || !S.statusDe) return null;
      S.activePools().forEach(function (p) {
        var st = S.statusDe(p);
        if (st && st.status === "range") {
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

  /* ============================================================
     COTAÇÃO DO DEFI — para o alerta de faixa poder existir AQUI

     O alerta "pool fora da faixa" passou a perguntar a quem calcula
     (DeFiStore.statusDe) em vez de ler um campo gravado. Só que
     calcular exige preço, e o Dashboard da raiz não busca preço
     nenhum: sem isto, todo alerta de faixa desapareceria desta tela —
     trocar um alerta errado por alerta nenhum não é conserto.

     Esta função cota as pools de todas as carteiras GLOBAIS e entrega
     ao store. Quem chama redesenha depois. Devolve null quando o DeFi
     não está carregado na página, e nunca rejeita: falha de cotação
     não pode derrubar o Dashboard inteiro.
     ============================================================ */
  function cotarDeFi() {
    var S = global.DeFiStore;
    if (!S || !S.setPrecos || !global.DeFiTokens || !global.DeFiPerf) {
      return Promise.resolve(null);
    }
    var pools = safe(function () {
      var out = [];
      var byWallet = (S.all() || {}).byWallet || {};
      globalIds().forEach(function (id) {
        ((byWallet[id] || {}).pools || []).forEach(function (p) {
          if (p.status !== "encerrada" && !p.closedAt) out.push(p);
        });
      });
      return out;
    }, []);
    if (!pools.length) return Promise.resolve(null);

    return global.DeFiTokens.precosDetalhado(global.DeFiPerf.simbolos(pools))
      .then(function (d) { S.setPrecos(d.valores, d.fonte); return d; })
      .catch(function () { return null; });
  }

  global.AtlasConsolidation = {
    snapshot: snapshot,
    moduleList: moduleList,
    blockchain: blockchain,
    alerts: alerts,
    cotarDeFi: cotarDeFi
  };
})(window);
