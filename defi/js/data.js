/* ============================================================
   ATLAS · DeFi — data.js
   Camada de dados única do módulo. Toda a app lê/escreve por aqui.
   Persistência: localStorage com fallback em memória (file://).
   No futuro o Oráculo consumirá exatamente estes dados.
   ============================================================ */
(function () {
  "use strict";

  var KEY = "atlas.defi.state.v3";
  var KEY_OLD = "atlas_defi_state_v2"; // migração de dados existentes

  /* ---- Ponte com a Central de Carteiras (AtlasWallets) ----
     O DeFi passa a guardar as posições (pools/staking/lending/closed)
     por carteira. Só carteiras GLOBAIS somam no dashboard principal. */
  var W = (typeof window !== "undefined") ? window.AtlasWallets : null;

  /* Carteira Local do DeFi: não propaga para a central, mas PRECISA
     persistir. O DeFi é multi-página e o seletor dá location.reload()
     depois de trocar — se isto fosse só uma variável de memória, a
     seleção morreria no próprio reload e a Local nunca poderia ser
     escolhida. Foi exatamente o bug. */
  var KEY_LOCAL = "atlas.defi.wallet.v1";
  var _localWalletId = (function () {
    try { return localStorage.getItem(KEY_LOCAL) || null; } catch (e) { return null; }
  })();
  function _setLocal(id) {
    _localWalletId = id || null;
    try {
      if (_localWalletId) localStorage.setItem(KEY_LOCAL, _localWalletId);
      else localStorage.removeItem(KEY_LOCAL);
    } catch (e) { /* file:// sem storage → só memória */ }
  }

  function principalId() { return (W && W.activeGlobal) ? W.activeGlobal().id : "principal"; }
  function currentWalletId() {
    if (_localWalletId) {
      var w = W && W.get ? W.get(_localWalletId) : null;
      if (w && w.type === "isolada" && w.module === "defi") return _localWalletId;
      _setLocal(null); // carteira apagada na central: limpa o vestígio
    }
    return principalId();
  }

  /* ---------- Paletas (cores de marca por entidade) ---------- */
  var PALETTE = {
    chain: {
      Solana:   "#14F195", Ethereum: "#627EEA", Base: "#0052FF",
      Arbitrum: "#28A0F0", Polygon:  "#8247E5", BNB:  "#F0B90B", Optimism: "#FF0420"
    },
    proto: {
      Kamino: "#5B9BFF", Meteora: "#8B5CF6", Orca: "#22D3EE", Raydium: "#3B82F6",
      Aave:   "#B6509E", Marinade: "#4B9BFF", Jito: "#67E8F9", Pendle: "#3B82F6", Aerodrome: "#0052FF"
    },
    token: {
      SOL: "#14F195", ETH: "#627EEA", USDC: "#2775CA", ORCA: "#22D3EE", JUP: "#C7F284",
      mSOL: "#4B9BFF", JitoSOL: "#67E8F9", ARB: "#28A0F0", cbETH: "#0052FF", RAY: "#3B82F6"
    },
    category: {
      "Liquidez": "#3B82F6", "Staking": "#8B5CF6", "Lending": "#22D3EE",
      "Yield": "#5B9BFF", "Estável": "#34D399"
    }
  };

  function colorOf(kind, name) {
    var m = PALETTE[kind] || {};
    return m[name] || "#5B9BFF";
  }

  /* "YYYY-MM-DD" lido como MEIA-NOITE LOCAL. Sem o T00:00:00 o
     navegador interpreta como UTC e, no Brasil, a data volta um dia —
     o que jogava a posição criada hoje para "ontem" e fazia o APR
     realizado dividir por um dia que não existiu. */
  function _dia(v) {
    if (!v) return null;
    var s = String(v);
    var d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + "T00:00:00" : s);
    return isNaN(d.getTime()) ? null : d;
  }

  /* ------------------------------------------------------------
     HOJE, NO FUSO DE QUEM ESTÁ OLHANDO

     Todo o módulo carimbava data com `new Date().toISOString()
     .slice(0, 10)` — que devolve a data em UTC, não a do usuário. No
     Brasil (UTC−3), qualquer coisa registrada depois das 21h ganhava a
     data de AMANHÃ: taxa coletada na noite de terça aparecia como
     quarta, o snapshot diário criava dois pontos para o mesmo dia, e o
     campo de data do formulário abria já no dia seguinte.

     Erro pequeno, mas do tipo que corrói: some no dia a dia e reaparece
     como uma linha do tempo fora de ordem meses depois.
     ------------------------------------------------------------ */
  function _hoje(d) {
    d = d || new Date();
    var mm = String(d.getMonth() + 1);
    var dd = String(d.getDate());
    return d.getFullYear() + "-" + (mm.length < 2 ? "0" + mm : mm) + "-" + (dd.length < 2 ? "0" + dd : dd);
  }

  /* ---------- Estado semente ----------
     Sem séries sintéticas. A evolução do patrimônio passou a ser
     MEDIDA (byWallet[id].snapshots) em vez de gerada — ver a seção
     "HISTÓRICO DE PATRIMÔNIO" mais abaixo. Um gerador de números
     bonitos num sistema que calcula dinheiro é uma armadilha: a linha
     sobe, ninguém confere, e o gráfico vira ficção com aparência de
     medição. */
  function seed() {
    return {
      meta: {
        currency: "USD",
        theme: "dark",
        lang: "pt-BR",
        updatedAt: new Date().toISOString()
      },
      currentWalletId: "principal",
      byWallet: {
        principal: emptyWallet()
      }
    };
  }

  /* posições de uma carteira (o "dinheiro" — é o que é por carteira) */
  function emptyWallet() {
    return { pools: [], closed: [], staking: [], lending: [], snapshots: [] };
  }

  /* ---------- Persistência (multi-carteira) ---------- */
  var _mem = null;

  /* devolve o balde de posições da carteira ativa, criando se preciso */
  function _wallet(s) {
    s = s || _mem;
    var id = s.currentWalletId || "principal";
    if (!s.byWallet[id]) s.byWallet[id] = emptyWallet();
    return s.byWallet[id];
  }

  /* migra o formato antigo (v2: pools/closed/staking/lending na raiz)
     para a carteira principal do novo formato (v3: byWallet) */
  function _migrateOld() {
    try {
      var raw = localStorage.getItem(KEY_OLD);
      if (!raw) return null;
      var old = JSON.parse(raw);
      var s = {
        meta: old.meta || seed().meta,
        currentWalletId: "principal",
        byWallet: {
          principal: {
            pools: old.pools || [], closed: old.closed || [],
            staking: old.staking || [], lending: old.lending || [],
            snapshots: []
          }
        }
      };
      return s;
    } catch (e) { return null; }
  }

  function _read() {
    if (_mem) { _mem.currentWalletId = currentWalletId(); return _mem; }
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { _mem = JSON.parse(raw); }
    } catch (e) { /* file:// sem storage → memória */ }
    if (!_mem || !_mem.byWallet) {
      _mem = _migrateOld() || seed();
    }
    /* estados gravados antes do snapshot diário trazem as duas séries
       sintéticas na raiz; ficam para trás sem migração porque não
       continham medição nenhuma — eram 45 zeros. */
    if (_mem.portfolioHistory) { delete _mem.portfolioHistory; delete _mem.profitHistory; }
    _mem.currentWalletId = currentWalletId();
    _wallet(_mem); // garante balde da carteira ativa
    _persist();
    return _mem;
  }
  function _persist() {
    try { localStorage.setItem(KEY, JSON.stringify(_mem)); } catch (e) { /* memória apenas */ }
  }

  /* ---------- API pública ---------- */
  var Store = {
    palette: PALETTE,
    colorOf: colorOf,

    all: function () { return _read(); },
    meta: function () { return _read().meta; },
    setMeta: function (patch) { Object.assign(_read().meta, patch); _persist(); },

    reset: function () { _mem = seed(); _persist(); return _mem; },

    /* Descarta o cache em memória e volta a ler do localStorage.

       Existe porque _mem sobrevive a uma reescrita externa do
       armazenamento: quem restaura um backup, ou roda a bateria de
       testes (defi/testes.html), deixa o localStorage certo e a
       memória errada — e a próxima gravação do módulo devolve o
       estado errado ao disco. A tela de Configurações resolve isso
       recarregando a página; quem não pode recarregar chama isto. */
    _reload: function () { _mem = null; return _read(); },

    /* ---------- Carteiras (ponte com a central) ---------- */
    wallets: function () {
      if (W && W.forModule) return W.forModule("defi");
      return [{ id: "principal", name: "Principal", type: "global", color: "#5B9BFF" }];
    },
    activeWallet: function () {
      var id = currentWalletId();
      return (W && W.get ? W.get(id) : null) || { id: "principal", name: "Principal", type: "global", color: "#5B9BFF" };
    },
    activeWalletId: currentWalletId,
    setWallet: function (id) {
      if (!W) return;
      var w = W.get(id); if (!w) return;
      if (w.type === "global") { _setLocal(null); W.setActiveGlobal(id); }
      else { _setLocal(id); }
      if (_mem) { _mem.currentWalletId = currentWalletId(); _wallet(_mem); _persist(); }
    },
    /* criar carteira NÃO tem caminho próprio aqui: quem cria é o
       seletor central (WalletSelector → AtlasWalletDialog → AtlasWallets
       .create). Um createWallet local só existia como segunda porta de
       entrada, sem uso, pronta para divergir. */
    onWalletChange: function (fn) { if (W && W.subscribe) return W.subscribe(fn); },

    /* ------------------------------------------------------------
       QUANTO VALE UMA POSIÇÃO — uma definição, todos os somatórios

       Havia quatro somatórios de "currentValue" espalhados (kpis,
       globalTotal, components.totaisDe e a consolidação da raiz), e
       todos esqueciam a MESMA coisa: a taxa pendente. Ela é dinheiro
       do usuário, parada dentro da pool, e ficava fora do patrimônio
       em todas as telas ao mesmo tempo — erro consistente é erro que
       ninguém percebe.

       Aqui é o único lugar que responde "quanto vale". Quem soma,
       soma por esta função.
       ------------------------------------------------------------ */
    poolValue: function (p) {
      if (!p) return 0;
      var v = Number(p.currentValue);
      if (!isFinite(v)) v = Number(p.capital) || 0;
      var pend = (p.fees || []).reduce(function (a, f) {
        return a + (f.status === "pendente" ? (Number(f.amount) || 0) : 0);
      }, 0);
      return v + pend;
    },
    walletValue: function (wd) {
      if (!wd) return 0;
      var t = (wd.pools || []).reduce(function (a, p) { return a + Store.poolValue(p); }, 0);
      t += (wd.staking || []).reduce(function (a, x) { return a + (Number(x.value) || 0); }, 0);
      t += (wd.lending || []).reduce(function (a, x) { return a + (Number(x.value) || 0); }, 0);
      return t;
    },
    walletCapital: function (wd) {
      if (!wd) return 0;
      var t = (wd.pools || []).reduce(function (a, p) {
        var f = Store.capitalFlows(p);
        return a + (f ? f.aportadoLiquido : (Number(p.capital) || 0));
      }, 0);
      t += (wd.staking || []).reduce(function (a, x) { return a + (Number(x.value) || 0); }, 0);
      t += (wd.lending || []).reduce(function (a, x) { return a + (Number(x.value) || 0); }, 0);
      return t;
    },

    /* soma o patrimônio de TODAS as carteiras globais — é o que sobe
       pro dashboard principal, independente da carteira ativa no módulo */
    globalTotal: function () {
      var s = _read();
      var globalIds = (W && W.globals) ? W.globals().map(function (w) { return w.id; }) : ["principal"];
      var total = 0;
      globalIds.forEach(function (id) { total += Store.walletValue(s.byWallet[id]); });
      return total;
    },

    /* Resultado (PnL) somado das pools de TODAS as carteiras globais.
       Existe porque a consolidação da raiz pedia o lucro por kpis(),
       que só olha a carteira ATIVA: o patrimônio vinha das globais e o
       resultado de uma carteira só — duas réguas no mesmo card. */
    globalProfit: function () {
      var s = _read();
      var globalIds = (W && W.globals) ? W.globals().map(function (w) { return w.id; }) : ["principal"];
      var total = 0;
      globalIds.forEach(function (id) {
        var wd = s.byWallet[id]; if (!wd) return;
        (wd.pools || []).forEach(function (p) {
          var r = Store.poolSummary(p);
          if (r) total += r.resultado;
        });
      });
      return total;
    },

    /* pools */
    pools: function () { return _wallet(_read()).pools.slice(); },
    activePools: function () { return _wallet(_read()).pools.filter(function (p) { return p.status !== "encerrada"; }); },
    pool: function (id) {
      return _wallet(_read()).pools.filter(function (p) { return p.id === id; })[0] || null;
    },
    addPool: function (p) {
      var s = _read(), wd = _wallet(s);
      /* ------------------------------------------------------------
         Date.now() SOZINHO COLIDE

         Duas pools criadas no mesmo milissegundo ganhavam o MESMO id.
         A partir daí, S.pool(id) devolve sempre a primeira da lista:
         editar uma alterava a outra, registrar taxa na segunda
         creditava a primeira, e excluir uma sumia com as duas.

         É exatamente o bug que o registro de taxas já tinha e que
         Store._uid foi escrito para resolver — a correção nunca subiu
         um nível, até esta auditoria. Na criação manual é raro; numa
         restauração de backup ou importação em laço, é o caso comum.
         ------------------------------------------------------------ */
      p.id = Store._uid("p");
      if (W && W.stamp) Object.assign(p, W.stamp("defi", p.origem || "manual", s.currentWalletId));
      else { p.walletId = s.currentWalletId; p.module = "defi"; p.data = new Date().toISOString(); }
      var abertura = p.openedAt || p.createdAt || _hoje();
      p.history = p.history || [{ date: abertura, value: p.capital }];
      p.notes = p.notes || [];
      p.timeline = p.timeline || [{ date: abertura, title: "Abertura", desc: "Posição criada com capital US$ " + p.capital + ".", type: "open" }];
      p.movements = p.movements || [{ date: abertura, type: "in", label: "Aporte inicial", amount: p.capital }];
      /* O evento de abertura nasce junto com a pool. Ele é a raiz do
         livro de fluxos: sem ele, aporte e reinvestimento não teriam
         contra qual base ser medidos. */
      p.events = p.events || [{
        id: Store._uid("e"), date: abertura, type: "abertura",
        amountUSD: Number(p.capital) || 0, note: "Capital inicial da posição.",
        origem: "externo"
      }];
      wd.pools.unshift(p); _persist(); return p;
    },
    updatePool: function (id, patch) {
      var p = this.pool(id); if (!p) return null;
      Object.assign(p, patch);
      Store._syncDerivados(p);
      _persist(); return p;
    },

    /* ------------------------------------------------------------
       CAMPOS DERIVADOS — gravados, mas nunca calculados fora daqui

       p.profit e p.profitPct são lidos por quem não tem como chamar
       poolSummary: o card da lista, o histórico, o ledger de carteiras
       e a consolidação da raiz. Enquanto CADA UM desses gravava o
       próprio número, havia três definições de "lucro" convivendo no
       mesmo dado:

         motor de mercado (dashboard) → mercado + taxa coletada
         modal "Editar posição"       → valorAtual − capital
         nada                         → 0, o valor de criação

       Quem salvasse por último ganhava. Agora os dois campos são só um
       ESPELHO de poolSummary, reescrito a cada mutação — continua
       existindo por compatibilidade, mas deixou de ser uma segunda
       fonte de verdade.
       ------------------------------------------------------------ */
    _syncDerivados: function (p) {
      if (!p) return p;
      var r = Store.poolSummary(p);
      if (!r) return p;
      p.profit = Math.round(r.resultado * 1e6) / 1e6;
      p.profitPct = Math.round(r.resultadoPct * 1e4) / 1e4;

      /* A série da própria posição também é MEDIDA, um ponto por dia.
         p.history nascia com um único ponto (o capital de abertura) e
         nunca mais crescia: as abas "Performance" e "Histórico"
         desenhavam um gráfico de um ponto só — uma linha invisível com
         moldura de gráfico. */
      var hoje = _hoje();
      var valor = Math.round(r.valorTotal * 100) / 100;
      if (!Array.isArray(p.history)) p.history = [];
      var ult = p.history[p.history.length - 1];
      if (ult && ult.date === hoje) ult.value = valor;
      else p.history.push({ date: hoje, value: valor });
      if (p.history.length > 400) p.history.splice(0, p.history.length - 400);
      return p;
    },
    /* ------------------------------------------------------------
       TAXAS — histórico com data

       Cada coleta é um registro, não um número que sobrescreve o
       anterior. Assim dá para ver o ritmo de geração de taxa ao
       longo do tempo, que é o que diz se a pool ainda vale a pena.

       status: "coletada" = já está na carteira
               "pendente" = acumulada na pool, ainda não sacada
       ------------------------------------------------------------ */
    /* Date.now() sozinho colide: duas taxas registradas no mesmo
       milissegundo ganhavam o MESMO id, e remover uma apagava as
       duas. O contador garante unicidade dentro da sessão. */
    _seq: 0,
    _uid: function (prefixo) {
      Store._seq = (Store._seq + 1) % 100000;
      return prefixo + Date.now().toString(36) + Store._seq.toString(36);
    },

    addFee: function (id, entry) {
      var p = this.pool(id); if (!p) return null;
      p.fees = p.fees || [];
      p.fees.unshift({
        id: Store._uid("f"),
        date: entry.date || _hoje(),
        amount: Number(entry.amount) || 0,
        status: entry.status === "pendente" ? "pendente" : "coletada",
        note: entry.note || ""
      });
      p.updatedAt = _hoje();
      Store._syncDerivados(p);
      _persist(); return p;
    },
    removeFee: function (id, feeId) {
      var p = this.pool(id); if (!p || !p.fees) return null;
      p.fees = p.fees.filter(function (f) { return f.id !== feeId; });
      p.updatedAt = _hoje();
      Store._syncDerivados(p);
      _persist(); return p;
    },
    /* marca uma taxa pendente como recebida */
    collectFee: function (id, feeId) {
      var p = this.pool(id); if (!p || !p.fees) return null;
      p.fees.forEach(function (f) {
        if (f.id === feeId) { f.status = "coletada"; f.collectedAt = _hoje(); }
      });
      p.updatedAt = _hoje();
      Store._syncDerivados(p);
      _persist(); return p;
    },

    /* ============================================================
       EVENTOS DE CAPITAL — aporte, reinvestimento, retirada

       A pool deixou de ser "um capital e um valor atual". Ela é um
       CONJUNTO DE FLUXOS datados, e é isso que permite responder a
       pergunta que interessa: o capital cresceu porque você colocou
       mais dinheiro, porque reinvestiu a taxa, ou porque a posição
       valorizou?

       Sem isto, "capital de US$ 50 virou US$ 55" é ambíguo: pode ser
       lucro de 10% ou aporte de cinco dólares. São coisas opostas.

       Tipos:
         abertura   capital inicial (nasce com a pool)
         aporte     dinheiro NOVO, do bolso do usuário
         reinvest   taxa já coletada devolvida à posição (juros
                    compostos) — NÃO é dinheiro novo
         retirada   saque de principal para o bolso

       Taxas continuam em p.fees[] — são de outra natureza (receita,
       não fluxo de capital) e têm o próprio painel.
       ============================================================ */
    EVENT_TYPES: ["abertura", "aporte", "reinvest", "retirada"],

    /* Toda pool responde com uma lista de eventos, mesmo as criadas
       antes deste modelo: a abertura é derivada de capital+createdAt.
       Assim nenhuma leitura precisa saber se a pool é velha ou nova. */
    events: function (id) {
      var p = (typeof id === "object" && id) ? id : this.pool(id);
      if (!p) return [];
      var evs = (p.events || []).slice();
      var temAbertura = evs.some(function (e) { return e.type === "abertura"; });
      if (!temAbertura) {
        evs.push({
          id: "e0",
          date: p.createdAt || p.openedAt || _hoje(),
          type: "abertura",
          amountUSD: Number(p.capital) || 0,
          note: "Capital inicial da posição.",
          derivado: true
        });
      }
      return evs.sort(function (a, b) {
        return String(a.date) < String(b.date) ? -1 : String(a.date) > String(b.date) ? 1 : 0;
      });
    },

    addEvent: function (id, entry) {
      var p = this.pool(id); if (!p || !entry) return null;
      var tipo = String(entry.type || "").toLowerCase();
      if (Store.EVENT_TYPES.indexOf(tipo) === -1) return null;

      /* Math.abs() aqui CORRIGIA em silêncio: um aporte de −5 (dedo
         escorregado no sinal) virava um aporte de +5 e entrava no
         livro como se fosse intencional. O sinal está no TIPO do
         evento; um valor negativo é erro de entrada, não uma forma
         alternativa de escrever retirada. */
      var valor = Number(entry.amountUSD);
      if (!isFinite(valor) || valor <= 0) return null;

      /* ------------------------------------------------------------
         INVARIANTES DO MODELO — no store, não na tela

         Estas duas regras estavam só no formulário da página da
         posição. Um store que aceita o que a tela recusa é um store
         com duas versões da verdade: qualquer outro caminho de
         escrita (restauração de backup, importação, uma tela futura)
         entraria por baixo da regra.

           reinvest > taxa coletada disponível
             criaria capital do nada. A base da posição subiria sem
             que nenhum dinheiro tivesse existido, e o resultado
             passaria a mostrar MENOS lucro do que houve.

           retirada > valor da posição
             sacaria mais do que existe. A base ficaria negativa e a
             variação dos ativos, positiva por construção.
         ------------------------------------------------------------ */
      var r = Store.poolSummary(p);
      if (r) {
        if (tipo === "reinvest" && valor > (r.taxasColetadas - r.reinvestido) + 1e-9) return null;
        if (tipo === "retirada" && valor > r.valorTotal + 1e-9) return null;
      }

      /* Materializa a abertura derivada antes de acrescentar o
         primeiro evento real. Sem isso a abertura sumiria da lista no
         momento em que a pool ganhasse um aporte. */
      if (!p.events || !p.events.length) p.events = Store.events(p);

      var ev = {
        id: Store._uid("e"),
        date: entry.date || _hoje(),
        type: tipo,
        amountUSD: valor,
        note: entry.note || "",
        /* reinvestimento aponta para a origem do dinheiro: é o que
           permite auditar "de onde vieram estes cinco dólares" */
        origem: tipo === "reinvest" ? "taxas" : (entry.origem || "externo")
      };
      p.events.push(ev);
      p.updatedAt = _hoje();

      /* O capital REGISTRADO da pool acompanha a base investida. É o
         número que o card da lista mostra como "Capital", e ele tem de
         incluir aporte e reinvestimento — senão a pool aparece com
         capital de US$ 50 e valor de US$ 62 depois de dois aportes. */
      var f = Store.capitalFlows(p);
      p.capital = Math.round(f.baseInvestida * 1e6) / 1e6;

      Store._syncDerivados(p);
      _persist();
      return ev;
    },

    removeEvent: function (id, evId) {
      var p = this.pool(id); if (!p || !p.events) return null;
      var alvo = p.events.filter(function (e) { return e.id === evId; })[0];
      if (!alvo || alvo.type === "abertura") return null;   // abertura não se apaga
      p.events = p.events.filter(function (e) { return e.id !== evId; });
      p.capital = Math.round(Store.capitalFlows(p).baseInvestida * 1e6) / 1e6;
      p.updatedAt = _hoje();
      Store._syncDerivados(p);
      _persist(); return p;
    },

    /* ------------------------------------------------------------
       FLUXOS DE CAPITAL — a conta que sustenta todo o resto

         A  aportadoBruto   tudo que saiu do BOLSO (abertura+aportes)
         W  retirado        principal sacado de volta para o bolso
         R  reinvestido     taxa coletada devolvida à posição

         baseInvestida = A + R − W     custo da posição hoje
         aportadoLiquido = A − W       exposição de dinheiro próprio

       capitalDias é a integral capital×tempo. É o que torna o APR
       honesto quando existem aportes: dobrar o capital no último dia
       não pode dividir o APR por dois.
       ------------------------------------------------------------ */
    capitalFlows: function (id) {
      var p = (typeof id === "object" && id) ? id : this.pool(id);
      if (!p) return null;
      var evs = Store.events(p);
      var hoje = new Date();

      var A = 0, W = 0, R = 0;
      evs.forEach(function (e) {
        var v = Math.abs(Number(e.amountUSD) || 0);
        if (e.type === "abertura" || e.type === "aporte") A += v;
        else if (e.type === "retirada") W += v;
        else if (e.type === "reinvest") R += v;
      });

      /* integral capital×dias, percorrendo a linha do tempo */
      var capitalDias = 0, corrente = 0, anterior = null;
      evs.forEach(function (e) {
        var d = _dia(e.date);
        if (anterior && d) capitalDias += corrente * Math.max(0, (d - anterior) / 86400000);
        var v = Math.abs(Number(e.amountUSD) || 0);
        if (e.type === "retirada") corrente -= v; else corrente += v;
        if (d) anterior = d;
      });
      if (anterior) capitalDias += corrente * Math.max(0, (hoje - anterior) / 86400000);

      /* Dias COMPLETOS desde a abertura. Com Math.round, a posição
         aberta há 9 dias virava "10 dias" ao passar do meio-dia — e o
         APR realizado, que divide por este número, mudava sozinho no
         almoço. Math.floor conta o que de fato passou. */
      var inicio = _dia(evs.length ? evs[0].date : null);
      var dias = inicio ? Math.max(1, Math.floor((hoje - inicio) / 86400000)) : 1;

      return {
        aportadoBruto: A,
        retirado: W,
        reinvestido: R,
        aportadoLiquido: A - W,
        baseInvestida: A + R - W,
        capitalDias: capitalDias,
        /* capital médio ponderado no tempo — denominador honesto do APR */
        capitalMedio: dias > 0 ? capitalDias / dias : 0,
        dias: dias,
        inicio: inicio ? _hoje(inicio) : null,
        eventos: evs
      };
    },

    /* ------------------------------------------------------------
       RESUMO DA POSIÇÃO

       Separa as DUAS origens do resultado. Numa pool dá para ganhar
       taxa e perder em ativo ao mesmo tempo — somar tudo num número
       só esconde impermanent loss, que é justamente o risco.

       O ERRO QUE ESTA FUNÇÃO TINHA
       ----------------------------
       varAtivos era "atual − inicial − taxas". Parecia razoável e era
       uma subtração a mais: p.currentValue guarda o valor de MERCADO
       da posição, que NÃO inclui a taxa pendente (é assim que Raydium
       e Orca mostram, e é assim que o motor de performance grava).
       Tirar a taxa dali descontava um dinheiro que nunca tinha sido
       somado.

       Efeito medido, com a pool real do usuário (entrada US$ 18,46,
       posição US$ 19,08 pelo preço de mercado, taxa pendente
       US$ 0,68): a variação dos ativos saía −US$ 0,06 — NEGATIVA —
       numa posição que estava ganhando dos dois lados. Registrar a
       taxa era o gatilho: quanto mais taxa a pool gerava, mais
       "negativa" a posição ficava.

       A conta certa fecha por dois caminhos independentes, e o objeto
       devolvido carrega os dois para poderem ser conferidos:

         PnL = (V + Fp + Fc − R + W) − A
         PnL = resultadoAtivos + resultadoTaxas
       ------------------------------------------------------------ */
    poolSummary: function (id) {
      var p = (typeof id === "object" && id) ? id : this.pool(id);
      if (!p) return null;

      var fees = p.fees || [];
      var coletadas = fees.filter(function (f) { return f.status === "coletada"; })
                          .reduce(function (a, f) { return a + (Number(f.amount) || 0); }, 0);
      var pendentes = fees.filter(function (f) { return f.status === "pendente"; })
                          .reduce(function (a, f) { return a + (Number(f.amount) || 0); }, 0);
      var totalTaxas = coletadas + pendentes;

      var f = Store.capitalFlows(p);
      var A = f.aportadoBruto, W = f.retirado, R = f.reinvestido;
      var base = f.baseInvestida;

      /* V = valor de MERCADO da posição, sem a taxa pendente.
         Pool recém-criada e nunca atualizada vale a própria base. */
      var V = (p.currentValue == null || !isFinite(Number(p.currentValue)))
        ? base : Number(p.currentValue);

      var resultadoAtivos = V - base;
      var resultadoTaxas  = totalTaxas;
      var pnl = resultadoAtivos + resultadoTaxas;

      /* Patrimônio da posição hoje: mercado + taxa que ainda está lá
         dentro. A taxa já coletada saiu para a carteira (menos a que
         voltou como reinvestimento) — não pode ser somada aqui, ou
         seria contada duas vezes. */
      var valorTotal = V + pendentes;

      var dias = f.dias;
      /* APR realizado sobre o capital MÉDIO no tempo. Usar o capital
         inicial fazia um aporte recente inflar o APR retroativamente. */
      var basePr = f.capitalMedio > 0 ? f.capitalMedio : base;
      var aprReal = basePr > 0 ? (totalTaxas / basePr) * (365 / dias) * 100 : 0;

      return {
        /* --- fluxos --- */
        aportado: A,                 // do bolso, bruto
        retirado: W,
        reinvestido: R,
        aportadoLiquido: A - W,
        baseInvestida: base,
        capitalMedio: f.capitalMedio,

        /* --- valores --- */
        valorPosicao: V,             // mercado, sem taxa pendente
        valorTotal: valorTotal,      // mercado + taxa pendente
        /* nomes antigos, mantidos para não quebrar quem já lia daqui:
           "inicial" passa a significar a BASE investida (que é o que a
           tela sempre quis dizer), e "atual" o valor de mercado. */
        inicial: base,
        atual: V,

        /* --- resultado --- */
        resultado: pnl,
        resultadoPct: A > 0 ? (pnl / A) * 100 : 0,
        varAtivos: resultadoAtivos,
        varAtivosPct: base > 0 ? (resultadoAtivos / base) * 100 : 0,

        /* --- taxas --- */
        taxasColetadas: coletadas,
        taxasPendentes: pendentes,
        taxasTotal: totalTaxas,

        dias: dias,
        aprReal: aprReal,
        criadaEm: f.inicio || p.createdAt || p.openedAt || null,
        atualizadaEm: p.updatedAt || null,

        /* prova de consistência: as duas contas têm de dar o mesmo.
           Fica no objeto para o teste poder afirmar sobre ela. */
        _conferencia: (V + pendentes + coletadas - R + W) - A
      };
    },

    addNote: function (id, text) {
      var p = this.pool(id); if (!p) return null;
      p.notes.unshift({ date: _hoje(), text: text });
      _persist(); return p;
    },
    /* ------------------------------------------------------------
       ENCERRAR POOL — preserva TUDO

       A versão anterior montava um objeto novo com 12 campos e
       descartava o resto: taxas, objetivos, diário, timeline,
       movimentações, quantidades e preços de entrada iam para o
       lixo. Quem encerrasse uma posição perdia justamente o que
       fazia dela uma estratégia — sobrava só o número.

       Agora a pool inteira vai para o histórico, acrescida do
       fechamento e de uma fotografia do resultado no momento em
       que foi encerrada.
       ------------------------------------------------------------ */
    closePool: function (id, reason) {
      var s = _read(), wd = _wallet(s), p = this.pool(id); if (!p) return null;

      var resumo = this.poolSummary(id);   // calcula ANTES de tirar da lista ativa
      var hoje = _hoje();

      wd.pools = wd.pools.filter(function (x) { return x.id !== id; });

      var arquivo = JSON.parse(JSON.stringify(p));   // cópia integral
      arquivo.status = "encerrada";
      arquivo.closedAt = hoje;
      arquivo.updatedAt = hoje;
      arquivo.reason = reason || "Encerramento manual.";
      /* Valor final é o PATRIMÔNIO da posição, não só o de mercado: a
         taxa pendente estava lá dentro no momento do encerramento e
         some da fotografia se for ignorada. */
      arquivo.finalValue = Store.poolValue(p);
      /* fotografia do desfecho: como o valor atual para de ser
         atualizado depois do encerramento, guardamos o resultado
         já decomposto para o histórico não precisar recalcular. */
      arquivo.closeSummary = resumo || null;

      /* a última linha do diário conta o fim da história */
      arquivo.timeline = (arquivo.timeline || []).slice();
      arquivo.timeline.unshift({
        date: hoje,
        title: "Encerramento",
        desc: (reason || "Encerramento manual.") +
              (resumo ? " Resultado: US$ " + resumo.resultado.toFixed(2) +
                        " (taxas US$ " + resumo.taxasTotal.toFixed(2) +
                        ", ativos US$ " + resumo.varAtivos.toFixed(2) + ")." : ""),
        type: "close"
      });

      wd.closed.unshift(arquivo);
      _persist(); return true;
    },

    /* reabre uma pool encerrada por engano, com o histórico intacto */
    reopenPool: function (id) {
      var s = _read(), wd = _wallet(s);
      var a = wd.closed.filter(function (x) { return x.id === id; })[0];
      if (!a) return null;
      wd.closed = wd.closed.filter(function (x) { return x.id !== id; });
      var p = JSON.parse(JSON.stringify(a));
      p.status = "ativa";
      p.closedAt = null;
      p.updatedAt = _hoje();
      delete p.closeSummary;
      wd.pools.unshift(p);
      _persist(); return p;
    },

    /* histórico / staking / lending */
    closed: function () { return _wallet(_read()).closed.slice(); },
    staking: function () { return _wallet(_read()).staking.slice(); },
    lending: function () { return _wallet(_read()).lending.slice(); },

    /* ---------- KPIs agregados ---------- */
    kpis: function () {
      var root = _read(), s = _wallet(root);
      var poolsVal = s.pools.reduce(function (a, p) { return a + Store.poolValue(p); }, 0);
      var stakeVal = s.staking.reduce(function (a, p) { return a + (Number(p.value) || 0); }, 0);
      var lendVal = s.lending.reduce(function (a, p) { return a + (Number(p.value) || 0); }, 0);
      var total = poolsVal + stakeVal + lendVal;

      /* O lucro vem do resumo, não de p.profit. p.profit é um campo
         GRAVADO por quem passou por último (o motor de mercado grava
         uma definição, o modal de edição gravava outra), e somar campo
         gravado é somar a versão desatualizada. poolSummary recalcula
         a partir dos fluxos e das taxas — sempre a mesma conta. */
      var profit = 0, capital = 0;
      s.pools.forEach(function (p) {
        var r = Store.poolSummary(p);
        if (r) { profit += r.resultado; capital += r.aportadoLiquido; }
      });

      var active = s.pools.filter(function (p) { return p.status === "ativa" || p.status === "range"; });
      /* APR médio PONDERADO pelo valor da posição. A média simples
         dizia que uma pool de US$ 10 a 300% e uma de US$ 10.000 a 5%
         rendiam 152% — número que não existe em lugar nenhum. */
      var pesoTot = 0, aprPond = 0;
      active.forEach(function (p) {
        var apr = Number(p.apr) || 0;
        if (apr <= 0) return;
        var peso = Store.poolValue(p);
        if (peso <= 0) return;
        pesoTot += peso; aprPond += apr * peso;
      });
      var avgApr = pesoTot > 0 ? aprPond / pesoTot : 0;

      /* Variação de 7 dias medida sobre a série real de patrimônio
         (snapshot diário). Antes lia portfolioHistory, uma série que
         nascia zerada e NUNCA era regravada: o card dizia "0,0% vs. 7
         dias" para sempre, com qualquer carteira. */
      var change = Store.changePct(7);

      return {
        total: total, profit: profit, capital: capital,
        activeCount: active.length,
        avgApr: avgApr, change: change,
        pools: poolsVal, staking: stakeVal, lending: lendVal
      };
    },

    /* ---------- Distribuições ---------- */
    distribution: function (by) {
      var s = _wallet(_read()), map = {};
      function add(key, val) { if (!key) return; map[key] = (map[key] || 0) + val; }
      s.pools.forEach(function (p) {
        var v = Store.poolValue(p);
        if (by === "chain") add(p.chain, v);
        else if (by === "protocol") add(p.protocol, v);
        else if (by === "category") add(p.category, v);
        else if (by === "token") {
          /* ------------------------------------------------------
             A divisão era `v/2` para cada lado — "toda pool é 50/50".
             Numa pool de liquidez CONCENTRADA isso é falso quase
             sempre: é justamente o preço andando que desbalanceia os
             lados, e no extremo da faixa a posição fica 100% num só
             token. Uma pool SOL/USDC totalmente convertida em USDC
             aparecia como metade SOL — exposição que não existe, num
             gráfico cujo trabalho é justamente mostrar exposição.

             Agora usa a composição real (quantidade × preço de
             entrada) quando ela existe, e só cai no meio a meio
             quando a pool não tem quantidade registrada — dizendo,
             pelo menos, que é uma estimativa.
             ------------------------------------------------------ */
          var qB = Number(p.qtyBaseNow) || Number(p.qtyBase) || 0;
          var qQ = Number(p.qtyQuoteNow) || Number(p.qtyQuote) || 0;
          var pB = Number(p.priceBase) || 0, pQ = Number(p.priceQuote) || 0;
          var lB = qB * pB, lQ = qQ * pQ, soma = lB + lQ;
          if (soma > 0) { add(p.base, v * (lB / soma)); add(p.quote, v * (lQ / soma)); }
          else { add(p.base, v / 2); add(p.quote, v / 2); }
        }
      });
      s.staking.forEach(function (p) {
        if (by === "chain") add(p.chain, p.value);
        else if (by === "protocol") add(p.protocol, p.value);
        else if (by === "category") add("Staking", p.value);
        else if (by === "token") add(p.token, p.value);
      });
      s.lending.forEach(function (p) {
        if (by === "chain") add(p.chain, p.value);
        else if (by === "protocol") add(p.protocol, p.value);
        else if (by === "category") add("Lending", p.value);
        else if (by === "token") add(p.token, p.value);
      });
      var kind = (by === "chain") ? "chain" : (by === "protocol") ? "proto" : (by === "token") ? "token" : "category";
      /* Sem Math.round por fatia: numa pool de US$ 18 as duas metades
         arredondavam para 9 e 9, e o donut passava a mostrar uma
         distribuição que não é a dos dados. O arredondamento é
         trabalho da camada de exibição, não da de cálculo. */
      var arr = Object.keys(map).map(function (k) {
        return { label: k, value: map[k], color: colorOf(kind, k) };
      }).sort(function (a, b) { return b.value - a.value; });
      var tot = arr.reduce(function (a, x) { return a + x.value; }, 0) || 1;
      arr.forEach(function (x) { x.pct = (x.value / tot) * 100; });
      return arr;
    },

    /* ============================================================
       HISTÓRICO DE PATRIMÔNIO — medido, não simulado

       portfolioHistory e profitHistory eram 45 pontos gerados por um
       gerador pseudoaleatório com drift ZERO e valor inicial ZERO —
       ou seja, 45 zeros. E só eram "reconciliados" na semente, uma
       única vez, o que na prática nunca acontecia com dados reais.

       Consequência medida: o gráfico de evolução do DeFi era uma
       linha reta no zero mesmo com pools registradas; o card
       "Patrimônio Total · vs. 7 dias" mostrava 0,0% para sempre; e o
       Analytics desenhava dois gráficos vazios com ar de gráfico.

       Agora existe um SNAPSHOT DIÁRIO real, por carteira: uma medição
       por dia do valor e do resultado. É pouco sofisticado de
       propósito — é a única série que o ATLAS pode afirmar, porque é
       a única que ele mediu. Dia sem abrir o sistema não vira ponto
       inventado: a série interpola com o último valor conhecido só na
       leitura, e o gráfico diz quantos dias foram medidos.
       ============================================================ */
    MAX_SNAPS: 400,

    _snaps: function (s) {
      var wd = _wallet(s || _read());
      if (!Array.isArray(wd.snapshots)) wd.snapshots = [];
      return wd.snapshots;
    },

    /* Registra (ou atualiza) a medição de hoje. Idempotente: abrir a
       tela dez vezes no mesmo dia não cria dez pontos. */
    recordSnapshot: function () {
      var s = _read(), wd = _wallet(s);
      var snaps = Store._snaps(s);
      var hoje = _hoje();

      var valor = Store.walletValue(wd);
      var lucro = (wd.pools || []).reduce(function (a, p) {
        var r = Store.poolSummary(p); return a + (r ? r.resultado : 0);
      }, 0);

      var ultimo = snaps[snaps.length - 1];
      if (ultimo && ultimo.d === hoje) {
        if (ultimo.v === valor && ultimo.p === lucro) return snaps;
        ultimo.v = valor; ultimo.p = lucro;
      } else {
        snaps.push({ d: hoje, v: valor, p: lucro });
        if (snaps.length > Store.MAX_SNAPS) snaps.splice(0, snaps.length - Store.MAX_SNAPS);
      }
      _persist();
      return snaps;
    },

    /* Série diária contínua nos últimos `dias`, preenchendo os dias
       sem medição com o último valor conhecido (degrau, não curva
       inventada). Devolve [] quando nunca houve medição — e uma lista
       vazia é um estado que a tela sabe desenhar. */
    _serie: function (dias, campo) {
      var snaps = Store.recordSnapshot();
      if (!snaps.length) return [];
      dias = dias || 45;

      var porDia = {};
      snaps.forEach(function (x) { porDia[x.d] = x; });

      var out = [], hoje = new Date(), corrente = null;
      /* valor de partida: a última medição ANTES da janela */
      var inicio = new Date(hoje); inicio.setDate(hoje.getDate() - (dias - 1));
      var iniIso = _hoje(inicio);
      for (var k = 0; k < snaps.length; k++) {
        if (snaps[k].d <= iniIso) corrente = snaps[k];
      }

      for (var i = dias - 1; i >= 0; i--) {
        var d = new Date(hoje); d.setDate(hoje.getDate() - i);
        var iso = _hoje(d);
        if (porDia[iso]) corrente = porDia[iso];
        if (!corrente) continue;                 // antes da primeira medição: sem ponto
        out.push({ date: iso, value: corrente[campo], medido: !!porDia[iso] });
      }
      return out;
    },

    portfolioHistory: function (dias) { return Store._serie(dias || 45, "v"); },
    profitHistory: function (dias) { return Store._serie(dias || 45, "p"); },

    /* Variação percentual do patrimônio em N dias. Devolve 0 quando
       não há medição anterior suficiente — nunca um número inventado. */
    changePct: function (dias) {
      var serie = Store.portfolioHistory((dias || 7) + 1);
      if (serie.length < 2) return 0;
      var atual = serie[serie.length - 1].value;
      var antes = serie[0].value;
      if (!antes) return 0;
      return ((atual - antes) / antes) * 100;
    },
    /* Quantos dias a série realmente MEDIU (para a tela poder dizer
       "3 dias de histórico" em vez de fingir 45). */
    snapshotCount: function () { return Store._snaps().length; },

    /* Quando a cotação de mercado foi gravada pela última vez, olhando
       TODAS as pools da carteira. É o que permite a tela dizer "estes
       valores são de terça" em vez de deixar o número velho passar por
       novo quando a API falha. */
    ultimaCotacao: function () {
      var wd = _wallet(_read());
      var maior = null;
      (wd.pools || []).forEach(function (p) {
        if (p.precoEm && (!maior || p.precoEm > maior)) maior = p.precoEm;
      });
      return maior;
    }
  };

  window.DeFiStore = Store;
})();
