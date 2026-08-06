/* ============================================================
   ATLAS · DeFi — data.js
   Camada de dados única do módulo. Toda a app lê/escreve por aqui.
   Persistência: localStorage com fallback em memória (file://).
   No futuro o Oráculo consumirá exatamente estes dados.
   ============================================================ */
(function () {
  "use strict";

  var KEY = "atlas_defi_state_v3";
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
  var KEY_LOCAL = "atlas_defi_local_wallet";
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

  /* ---------- Gerador determinístico de séries (para mock estável) ---------- */
  function series(days, start, driftPct, vol, seed) {
    var out = [], v = start, s = seed || 7;
    var today = new Date();
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(today); d.setDate(today.getDate() - i);
      s = (s * 9301 + 49297) % 233280;
      var rnd = s / 233280;
      v = v * (1 + driftPct / 100 + (rnd - 0.5) * vol / 100);
      out.push({ date: d.toISOString().slice(0, 10), value: Math.round(v) });
    }
    return out;
  }

  /* ---------- Estado semente ---------- */
  function seed() {
    return {
      meta: {
        currency: "USD",
        theme: "dark",
        lang: "pt-BR",
        updatedAt: new Date().toISOString()
      },
      /* Estado inicial LIMPO — sem dados de demonstração. */
      portfolioHistory: series(45, 0, 0, 0, 11),
      profitHistory:    series(45, 0, 0, 0, 23),

      currentWalletId: "principal",
      byWallet: {
        principal: emptyWallet()
      }
    };
  }

  /* posições de uma carteira (o "dinheiro" — é o que é por carteira) */
  function emptyWallet() {
    return { pools: [], closed: [], staking: [], lending: [] };
  }

  /* Ajusta as séries do topo para terminarem no patrimônio/lucro reais
     da carteira ATIVA, preservando o formato — gráfico e cards batem. */
  function _reconcile(s) {
    var wd = _wallet(s);
    var total = wd.pools.reduce(function (a, p) { return a + p.currentValue; }, 0)
      + wd.staking.reduce(function (a, p) { return a + p.value; }, 0)
      + wd.lending.reduce(function (a, p) { return a + p.value; }, 0);
    var ph = s.portfolioHistory, lastP = ph[ph.length - 1].value;
    var scaleP = lastP ? total / lastP : 1;
    ph.forEach(function (p) { p.value = Math.round(p.value * scaleP); });

    var profit = wd.pools.reduce(function (a, p) { return a + p.profit; }, 0);
    var pf = s.profitHistory, lastF = pf[pf.length - 1].value;
    var scaleF = lastF ? profit / lastF : 1;
    pf.forEach(function (p) { p.value = Math.round(p.value * scaleF); });
    return s;
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
        portfolioHistory: old.portfolioHistory || series(45, 0, 0, 0, 11),
        profitHistory: old.profitHistory || series(45, 0, 0, 0, 23),
        currentWalletId: "principal",
        byWallet: {
          principal: {
            pools: old.pools || [], closed: old.closed || [],
            staking: old.staking || [], lending: old.lending || []
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
      _mem = _migrateOld() || _reconcile(seed());
    }
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

    reset: function () { _mem = _reconcile(seed()); _persist(); return _mem; },

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

    /* soma o patrimônio de TODAS as carteiras globais — é o que sobe
       pro dashboard principal, independente da carteira ativa no módulo */
    globalTotal: function () {
      var s = _read();
      var globalIds = (W && W.globals) ? W.globals().map(function (w) { return w.id; }) : ["principal"];
      var total = 0;
      globalIds.forEach(function (id) {
        var wd = s.byWallet[id]; if (!wd) return;
        total += (wd.pools || []).reduce(function (a, p) { return a + p.currentValue; }, 0);
        total += (wd.staking || []).reduce(function (a, p) { return a + p.value; }, 0);
        total += (wd.lending || []).reduce(function (a, p) { return a + p.value; }, 0);
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
      p.id = "p" + (Date.now().toString(36));
      if (W && W.stamp) Object.assign(p, W.stamp("defi", p.origem || "manual", s.currentWalletId));
      else { p.walletId = s.currentWalletId; p.module = "defi"; p.data = new Date().toISOString(); }
      p.history = p.history || [{ date: new Date().toISOString().slice(0, 10), value: p.capital }];
      p.notes = p.notes || [];
      p.timeline = p.timeline || [{ date: new Date().toISOString().slice(0, 10), title: "Abertura", desc: "Posição criada com capital US$ " + p.capital + ".", type: "open" }];
      p.movements = p.movements || [{ date: new Date().toISOString().slice(0, 10), type: "in", label: "Aporte inicial", amount: p.capital }];
      wd.pools.unshift(p); _persist(); return p;
    },
    updatePool: function (id, patch) {
      var p = this.pool(id); if (!p) return null;
      Object.assign(p, patch); _persist(); return p;
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
        date: entry.date || new Date().toISOString().slice(0, 10),
        amount: Number(entry.amount) || 0,
        status: entry.status === "pendente" ? "pendente" : "coletada",
        note: entry.note || ""
      });
      p.updatedAt = new Date().toISOString().slice(0, 10);
      _persist(); return p;
    },
    removeFee: function (id, feeId) {
      var p = this.pool(id); if (!p || !p.fees) return null;
      p.fees = p.fees.filter(function (f) { return f.id !== feeId; });
      p.updatedAt = new Date().toISOString().slice(0, 10);
      _persist(); return p;
    },
    /* marca uma taxa pendente como recebida */
    collectFee: function (id, feeId) {
      var p = this.pool(id); if (!p || !p.fees) return null;
      p.fees.forEach(function (f) {
        if (f.id === feeId) { f.status = "coletada"; f.collectedAt = new Date().toISOString().slice(0, 10); }
      });
      p.updatedAt = new Date().toISOString().slice(0, 10);
      _persist(); return p;
    },

    /* ------------------------------------------------------------
       RESUMO DA POSIÇÃO

       Separa as DUAS origens do resultado. Numa pool dá para ganhar
       taxa e perder em ativo ao mesmo tempo — somar tudo num número
       só esconde impermanent loss, que é justamente o risco.
       ------------------------------------------------------------ */
    poolSummary: function (id) {
      var p = this.pool(id); if (!p) return null;
      var fees = p.fees || [];
      var coletadas = fees.filter(function (f) { return f.status === "coletada"; })
                          .reduce(function (a, f) { return a + f.amount; }, 0);
      var pendentes = fees.filter(function (f) { return f.status === "pendente"; })
                          .reduce(function (a, f) { return a + f.amount; }, 0);

      var inicial = Number(p.capital) || 0;
      var atual   = Number(p.currentValue) || inicial;
      var totalTaxas = coletadas + pendentes;
      // o que sobra depois de tirar a taxa é variação de ativo
      var varAtivos = atual - inicial - totalTaxas;

      var dias = 0;
      try {
        var d0 = new Date(p.createdAt || p.openedAt);
        dias = Math.max(1, Math.round((Date.now() - d0.getTime()) / 86400000));
      } catch (e) { dias = 1; }

      // APR realizado: taxa gerada por dia, anualizada sobre o capital
      var aprReal = inicial > 0 ? (totalTaxas / inicial) * (365 / dias) * 100 : 0;

      return {
        inicial: inicial,
        atual: atual,
        resultado: atual - inicial,
        resultadoPct: inicial > 0 ? ((atual - inicial) / inicial) * 100 : 0,
        taxasColetadas: coletadas,
        taxasPendentes: pendentes,
        taxasTotal: totalTaxas,
        varAtivos: varAtivos,
        dias: dias,
        aprReal: aprReal,
        criadaEm: p.createdAt || p.openedAt || null,
        atualizadaEm: p.updatedAt || null
      };
    },

    addNote: function (id, text) {
      var p = this.pool(id); if (!p) return null;
      p.notes.unshift({ date: new Date().toISOString().slice(0, 10), text: text });
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
      var hoje = new Date().toISOString().slice(0, 10);

      wd.pools = wd.pools.filter(function (x) { return x.id !== id; });

      var arquivo = JSON.parse(JSON.stringify(p));   // cópia integral
      arquivo.status = "encerrada";
      arquivo.closedAt = hoje;
      arquivo.updatedAt = hoje;
      arquivo.reason = reason || "Encerramento manual.";
      arquivo.finalValue = p.currentValue;
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
      p.updatedAt = new Date().toISOString().slice(0, 10);
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
      var poolsVal = s.pools.reduce(function (a, p) { return a + p.currentValue; }, 0);
      var stakeVal = s.staking.reduce(function (a, p) { return a + p.value; }, 0);
      var lendVal = s.lending.reduce(function (a, p) { return a + p.value; }, 0);
      var total = poolsVal + stakeVal + lendVal;

      var profit = s.pools.reduce(function (a, p) { return a + p.profit; }, 0);
      var active = s.pools.filter(function (p) { return p.status === "ativa" || p.status === "range"; });
      var aprList = active.filter(function (p) { return p.apr > 0; });
      var avgApr = aprList.length ? aprList.reduce(function (a, p) { return a + p.apr; }, 0) / aprList.length : 0;

      var ph = root.portfolioHistory || [];
      var last = ph.length ? ph[ph.length - 1].value : total;
      var prev = ph.length > 7 ? ph[ph.length - 8].value : last;
      var change = prev ? ((last - prev) / prev) * 100 : 0;

      return {
        total: total, profit: profit, activeCount: active.length,
        avgApr: avgApr, change: change,
        pools: poolsVal, staking: stakeVal, lending: lendVal
      };
    },

    /* ---------- Distribuições ---------- */
    distribution: function (by) {
      var s = _wallet(_read()), map = {};
      function add(key, val) { map[key] = (map[key] || 0) + val; }
      s.pools.forEach(function (p) {
        if (by === "chain") add(p.chain, p.currentValue);
        else if (by === "protocol") add(p.protocol, p.currentValue);
        else if (by === "category") add(p.category, p.currentValue);
        else if (by === "token") { add(p.base, p.currentValue / 2); add(p.quote, p.currentValue / 2); }
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
      var arr = Object.keys(map).map(function (k) {
        return { label: k, value: Math.round(map[k]), color: colorOf(kind, k) };
      }).sort(function (a, b) { return b.value - a.value; });
      var tot = arr.reduce(function (a, x) { return a + x.value; }, 0) || 1;
      arr.forEach(function (x) { x.pct = (x.value / tot) * 100; });
      return arr;
    },

    portfolioHistory: function () { return _read().portfolioHistory.slice(); },
    profitHistory: function () { return _read().profitHistory.slice(); }
  };

  window.DeFiStore = Store;
})();
