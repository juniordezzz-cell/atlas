/* ============================================================
   ATLAS · js/atlas-movements.js  (Etapa 3 — 3A)
   ------------------------------------------------------------
   LIVRO-RAZÃO ÚNICO DE MOVIMENTOS DATADOS — o coração dos
   Relatórios. Todo relatório é POR CARTEIRA: escolhe-se um
   walletId (global OU local) e a query devolve só os movimentos
   daquela carteira, no período pedido.

   Formato canônico de um movimento
   --------------------------------
     {
       id,                       // único
       date,     "YYYY-MM-DD"    // normalizado
       tipo,     "entrada"|"saida"|"resultado"
       valorUSD, Number          // sempre em USD (regra do sistema)
       module,   "hold"|"trade"|"defi"|"rwa"|null
       walletId,                 // a que carteira pertence
       origem,   "manual"|"derivado"|...
       label                     // rótulo humano
     }

   Duas fontes que convivem (design híbrido)
   -----------------------------------------
     1. GRAVADOS  — record()/recordMany() persistem em localStorage
        (atlas.movements.v1). Fonte da verdade, precisa, POR CARTEIRA.
        É o que os módulos passam a alimentar (3C).
     2. DERIVADOS — adaptadores extraem movimentos do que cada módulo
        já guarda hoje (backfill best-effort). Isolados aqui → o dia
        que virar Firebase, troca-se só esta camada.

   API
   ---
     AtlasMovements.record(mv) / recordMany(arr) / remove(id) / clearRecorded()
     AtlasMovements.registerAdapter(fn)         // fn(opts) -> [mv...]
     AtlasMovements.list(opts)                  // {walletId, from, to, module, tipo, includeDerived}
     AtlasMovements.summarize(list)             // {entrada, saida, resultado, net, count}
     AtlasMovements.groupByPeriod(list, period) // "month"|"quarter"|"semester"|"year"
     AtlasMovements.compareBuckets(buckets)     // anota delta vs bucket anterior
     AtlasMovements.walletsWithActivity()       // [walletId...]
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasMovements) return;

  var LS_KEY = "atlas.movements.v1";
  var TIPOS = { entrada: 1, saida: 1, resultado: 1 };
  var adapters = [];

  /* ---------- utilidades ---------- */

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  function safe(fn, fb) { try { return fn(); } catch (e) { return fb; } }

  // Normaliza date (epoch ms, Date, ISO ou "YYYY-MM-DD") -> "YYYY-MM-DD"
  function toDay(v) {
    if (v == null || v === "") return null;
    var d;
    if (v instanceof Date) d = v;
    else if (typeof v === "number") d = new Date(v);
    else {
      var s = String(v);
      // já é YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      d = new Date(s);
    }
    if (isNaN(d.getTime())) return null;
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mm + "-" + dd;
  }

  function genId() {
    return "mv_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function normalize(mv) {
    if (!mv) return null;
    var day = toDay(mv.date != null ? mv.date : (mv.data != null ? mv.data : mv.ts));
    var tipo = String(mv.tipo || mv.type || "").toLowerCase();
    if (tipo === "in") tipo = "entrada";
    if (tipo === "out") tipo = "saida";
    if (!TIPOS[tipo]) return null;
    var valor = num(mv.valorUSD != null ? mv.valorUSD : (mv.amount != null ? mv.amount : mv.value));
    if (!day || !valor) return null;               // sem data ou sem valor → não é movimento útil

    /* ------------------------------------------------------------
       O SINAL DO "RESULTADO" NÃO PODE SER DESCARTADO

       Math.abs() estava aplicado a TODOS os tipos. Para entrada e
       saída faz sentido: o sinal está no tipo, e uma entrada de −100
       seria só um jeito confuso de escrever uma saída.

       Para "resultado" era destrutivo: um prejuízo de US$ 500 entrava
       no livro-razão como US$ 500 de LUCRO. Nos Relatórios, uma
       carteira que perdeu dinheiro aparecia com resultado positivo, e
       quanto pior o prejuízo, melhor o número. O sinal aqui é a
       informação inteira.
       ------------------------------------------------------------ */
    return {
      id: mv.id || genId(),
      date: day,
      tipo: tipo,
      valorUSD: tipo === "resultado" ? valor : Math.abs(valor),
      module: mv.module || null,
      walletId: mv.walletId || (global.AtlasWallets ? AtlasWallets.activeGlobalId() : "principal"),
      origem: mv.origem || "manual",
      label: mv.label || "",
      ref: mv.ref || null
    };
  }

  /* ---------- persistência dos GRAVADOS ---------- */

  function readStore() {
    return safe(function () {
      var raw = global.localStorage.getItem(LS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }, []);
  }

  function writeStore(arr) {
    safe(function () { global.localStorage.setItem(LS_KEY, JSON.stringify(arr)); });
  }

  /* ---------- derivação via adaptadores ---------- */

  function derived(opts) {
    var out = [];
    adapters.forEach(function (fn) {
      var got = safe(function () { return fn(opts) || []; }, []);
      for (var i = 0; i < got.length; i++) {
        var mv = normalize(got[i]);
        if (mv) { mv.origem = mv.origem === "manual" ? "derivado" : mv.origem; out.push(mv); }
      }
    });
    return out;
  }

  /* ---------- filtros ---------- */

  function pass(mv, o) {
    if (o.walletId && mv.walletId !== o.walletId) return false;
    if (o.module && mv.module !== o.module) return false;
    if (o.tipo && mv.tipo !== o.tipo) return false;
    if (o.from && mv.date < toDay(o.from)) return false;
    if (o.to && mv.date > toDay(o.to)) return false;
    return true;
  }

  /* ---------- períodos ---------- */

  function periodKey(day, period) {
    var y = day.slice(0, 4), m = parseInt(day.slice(5, 7), 10);
    switch (period) {
      case "year":     return { key: y, label: y };
      case "semester": var s = m <= 6 ? 1 : 2; return { key: y + "-S" + s, label: "S" + s + "/" + y };
      case "quarter":  var q = Math.ceil(m / 3); return { key: y + "-Q" + q, label: "Q" + q + "/" + y };
      default:         return { key: day.slice(0, 7), label: day.slice(0, 7) }; // month YYYY-MM
    }
  }

  /* ---------- API ---------- */

  var API = {

    record: function (mv) {
      var n = normalize(mv);
      if (!n) return null;
      var arr = readStore();
      arr.push(n); writeStore(arr);
      safe(function () {
        global.document.dispatchEvent(new global.CustomEvent("atlas:movement", { detail: n }));
      });
      return n;
    },

    recordMany: function (list) {
      var arr = readStore(), added = [];
      (list || []).forEach(function (mv) {
        var n = normalize(mv);
        if (n) { arr.push(n); added.push(n); }
      });
      if (added.length) writeStore(arr);
      return added;
    },

    remove: function (id) {
      var arr = readStore(), next = arr.filter(function (m) { return m.id !== id; });
      if (next.length !== arr.length) { writeStore(next); return true; }
      return false;
    },

    clearRecorded: function () { writeStore([]); },

    /* Só os GRAVADOS (sem rodar adaptadores) — usado no dedup dos adaptadores. */
    recorded: function () { return readStore().map(normalize).filter(Boolean); },

    /* Conjunto de refs já gravados por módulo (p/ adaptador pular a fonte). */
    recordedRefs: function (module) {
      var set = {};
      readStore().forEach(function (m) {
        if (m && m.ref && (!module || m.module === module)) set[m.ref] = 1;
      });
      return set;
    },

    registerAdapter: function (fn) { if (typeof fn === "function") adapters.push(fn); return fn; },

    /* Lista mesclada (gravados + derivados), filtrada e ordenada por data. */
    list: function (opts) {
      opts = opts || {};
      var recorded = readStore().map(normalize).filter(Boolean);
      var all = recorded;
      if (opts.includeDerived !== false) {
        var seen = {};
        recorded.forEach(function (m) { seen[m.id] = 1; });
        derived(opts).forEach(function (m) { if (!seen[m.id]) { seen[m.id] = 1; all.push(m); } });
      }
      all = all.filter(function (m) { return pass(m, opts); });
      all.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      return all;
    },

    summarize: function (list) {
      var r = { entrada: 0, saida: 0, resultado: 0, net: 0, count: (list || []).length };
      (list || []).forEach(function (m) {
        if (m.tipo === "entrada") r.entrada += m.valorUSD;
        else if (m.tipo === "saida") r.saida += m.valorUSD;
        else if (m.tipo === "resultado") r.resultado += m.valorUSD;
      });
      // net do fluxo de caixa: entradas - saídas (resultado é performance, não fluxo)
      r.net = r.entrada - r.saida;
      return r;
    },

    groupByPeriod: function (list, period) {
      period = period || "month";
      var map = {}, order = [];
      (list || []).forEach(function (m) {
        var pk = periodKey(m.date, period);
        if (!map[pk.key]) {
          map[pk.key] = { key: pk.key, label: pk.label, entrada: 0, saida: 0, resultado: 0, net: 0, count: 0 };
          order.push(pk.key);
        }
        var b = map[pk.key];
        if (m.tipo === "entrada") b.entrada += m.valorUSD;
        else if (m.tipo === "saida") b.saida += m.valorUSD;
        else if (m.tipo === "resultado") b.resultado += m.valorUSD;
        b.count++;
      });
      order.sort();
      return order.map(function (k) { var b = map[k]; b.net = b.entrada - b.saida; return b; });
    },

    /* Anota cada bucket com a variação vs o anterior (comparação mês/ano). */
    compareBuckets: function (buckets) {
      (buckets || []).forEach(function (b, i) {
        if (i === 0) { b.deltaNet = null; b.deltaPct = null; b.positivo = b.net >= 0; return; }
        var prev = buckets[i - 1];
        b.deltaNet = b.net - prev.net;
        b.deltaPct = prev.net !== 0 ? (b.deltaNet / Math.abs(prev.net)) * 100 : null;
        b.positivo = b.deltaNet >= 0;
      });
      return buckets;
    },

    /* Carteiras que têm QUALQUER movimento (para o seletor do relatório). */
    walletsWithActivity: function () {
      var ids = {};
      API.list({ includeDerived: true }).forEach(function (m) { ids[m.walletId] = 1; });
      return Object.keys(ids);
    },

    _normalize: normalize,   // exposto p/ testes
    _toDay: toDay
  };

  /* ============================================================
     ADAPTADOR: DeFi  (o módulo com livro-razão mais completo)
     Lê DeFiStore.all().byWallet[*] — pool.movements[] + closed[].
     ============================================================ */
  API.registerAdapter(function (opts) {
    var S = global.DeFiStore;
    if (!S || !S.all) return [];
    var state = safe(function () { return S.all(); }, null);
    if (!state || !state.byWallet) return [];
    var out = [];
    Object.keys(state.byWallet).forEach(function (wid) {
      if (opts && opts.walletId && wid !== opts.walletId) return;
      var wd = state.byWallet[wid] || {};

      /* ------------------------------------------------------------
         A fonte é p.events, não p.movements

         p.movements era escrito UMA vez, na criação da pool, com o
         aporte inicial — e nunca mais. Aporte, reinvestimento e
         retirada registrados depois não apareciam em lugar nenhum
         fora da página da posição: nem no Dashboard, nem nos
         Relatórios, nem no extrato da carteira. O livro-razão do
         ATLAS ignorava justamente os fluxos de capital.

         p.events é o registro vivo (ver defi/js/data.js). O
         reinvestimento entra como "resultado", não como entrada: o
         dinheiro não veio de fora, veio da própria pool — tratá-lo
         como aporte inflaria o capital investido da carteira.
         ------------------------------------------------------------ */
      var TIPO_MV = { abertura: "entrada", aporte: "entrada", retirada: "saida", reinvest: "resultado" };
      var ROTULO = { abertura: "Abertura", aporte: "Aporte", retirada: "Retirada", reinvest: "Reinvestimento" };

      (wd.pools || []).forEach(function (p) {
        var par = (p.base || "") + (p.quote ? "/" + p.quote : "");
        var evs = (p.events && p.events.length)
          ? p.events
          : [{ id: "e0", date: p.createdAt || p.openedAt, type: "abertura", amountUSD: p.capital }];

        evs.forEach(function (e, idx) {
          var tipo = TIPO_MV[e.type];
          if (!tipo) return;
          out.push({
            id: "der:defi:" + (p.id || "p") + ":" + (e.id || idx),
            date: e.date, tipo: tipo, valorUSD: e.amountUSD,
            module: "defi", walletId: p.walletId || wid,
            origem: "derivado",
            label: (ROTULO[e.type] || "Movimento") + (par ? " · " + par : "")
          });
        });

        /* Taxa coletada é receita realizada da carteira — ela saiu da
           pool e entrou no seu bolso. Ficava fora do livro-razão. */
        (p.fees || []).forEach(function (f) {
          if (f.status !== "coletada") return;
          out.push({
            id: "der:defi:fee:" + (p.id || "p") + ":" + (f.id || f.date),
            date: f.collectedAt || f.date, tipo: "resultado", valorUSD: f.amount,
            module: "defi", walletId: p.walletId || wid, origem: "derivado",
            label: "Taxa coletada" + (par ? " · " + par : "")
          });
        });
      });
      (wd.closed || []).forEach(function (c) {
        if (c.profit == null || !c.closedAt) return;
        out.push({
          id: "der:defi:closed:" + (c.id || Math.random().toString(36).slice(2)),
          date: c.closedAt, tipo: "resultado", valorUSD: c.profit,
          module: "defi", walletId: c.walletId || wid, origem: "derivado",
          label: "Resultado " + (c.base || "pool") + (c.quote ? "/" + c.quote : "")
        });
      });
    });
    return out;
  });

  /* ============================================================
     ADAPTADOR: Hold
     Lê Store.state.carteira[] (todas as carteiras). Cada posição
     vira uma "entrada" = custo investido (qtd × preço médio), na
     data em que a posição nasceu (stamp .data). Vendas precisas
     virão via record() (3C) — o histórico do Hold não guarda valor.
     ============================================================ */
  API.registerAdapter(function (opts) {
    var S = global.Store;
    if (!S || !S.state || !Array.isArray(S.state.carteira)) return [];
    var rec = API.recorded();               // gravados (fonte da verdade)
    var out = [];
    S.state.carteira.forEach(function (p) {
      var wid = p.walletId || "principal";
      if (opts && opts.walletId && wid !== opts.walletId) return;
      var custo = num(p.quantidade) * num(p.preco_medio);
      if (!custo) return;
      // quanto dessa posição já está GRAVADO (entrada − saída) → deriva só o resto
      var ref = "hold:" + (p.ativo_id || "a") + ":" + wid, recNet = 0;
      rec.forEach(function (m) {
        if (m.ref === ref) recNet += (m.tipo === "saida" ? -m.valorUSD : m.valorUSD);
      });
      var resto = custo - recNet;
      if (resto <= 0.01) return;             // já coberto pelos movimentos gravados
      var tk = safe(function () { var a = S.get.asset(p.ativo_id); return a ? a.ticker : ""; }, "");
      out.push({
        id: "der:hold:" + (p.ativo_id || "a") + ":" + wid,
        date: p.data || p.createdAt, tipo: "entrada", valorUSD: resto,
        module: "hold", walletId: wid, origem: "derivado",
        label: "Posição" + (tk ? " " + tk : "")
      });
    });
    return out;
  });

  /* ============================================================
     ADAPTADOR: Trade
     Lê ATLAS.app.allWalletData() → data[walletId].trades[].
     Trade fechado (closedAt) vira "resultado" = pnl na data de
     fechamento. Aportes/saques de banca virão via record() (3C).
     ============================================================ */
  API.registerAdapter(function (opts) {
    var A = global.ATLAS;
    if (!A || !A.app || !A.app.allWalletData) return [];
    var data = safe(function () { return A.app.allWalletData(); }, null);
    if (!data) return [];
    var out = [];
    Object.keys(data).forEach(function (wid) {
      if (opts && opts.walletId && wid !== opts.walletId) return;
      /* ------------------------------------------------------------
         t.pnl DO TRADE É PERCENTUAL, NÃO DÓLAR

         O módulo Trade grava o resultado de cada operação em % (veja
         closeTrade em trade/assets/js/core/state.js, que escreve
         "Trade encerrado (+8%)"). Este adaptador jogava esse número
         direto no campo valorUSD do livro-razão: um trade de +8%
         entrava nos Relatórios como "resultado US$ 8,00", somado a
         entradas e saídas que são dólares de verdade.

         Somar porcentagem com dinheiro não dá um número errado — dá um
         número sem significado. Sem o tamanho da posição não há como
         converter, e INVENTAR uma base seria pior.

         A conversão só é feita quando o próprio trade traz um valor em
         dólar (pnlUSD ou size numérico); nos demais casos o trade fica
         FORA do livro-razão, e o relatório deixa de exibir um valor
         que ele não tem como afirmar.
         ------------------------------------------------------------ */
      (data[wid].trades || []).forEach(function (t) {
        if (!t.closedAt || t.pnl == null) return;

        var usd = null;
        if (t.pnlUSD != null && isFinite(Number(t.pnlUSD))) {
          usd = Number(t.pnlUSD);
        } else {
          var tamanho = Number(String(t.size == null ? "" : t.size).replace(",", "."));
          if (isFinite(tamanho) && tamanho > 0) usd = tamanho * (Number(t.pnl) / 100);
        }
        if (usd == null || !isFinite(usd) || !usd) return;

        out.push({
          id: "der:trade:" + (t.id || Math.random().toString(36).slice(2)),
          date: t.closedAt, tipo: "resultado", valorUSD: usd,
          module: "trade", walletId: wid, origem: "derivado",
          label: "Resultado " + (t.asset || t.ticker || t.side || "trade")
        });
      });
    });
    return out;
  });

  /* ============================================================
     ADAPTADOR: RWA
     Lê RWAStore.all().byWallet[*].assets[]. Onde o ativo tem data
     de compra, vira "entrada" = custo (entry). Sem data, ignora —
     a precisão vem de record() (3C).
     ============================================================ */
  API.registerAdapter(function (opts) {
    var S = global.RWAStore;
    /* byWallet(), não all().byWallet: `all()` é a visão mesclada da
       carteira atual e nunca teve essa chave, então este adaptador
       saía cedo e NENHUM movimento de RWA chegava aos Relatórios. */
    if (!S || !S.byWallet) return [];
    var byWallet = safe(function () { return S.byWallet(); }, null);
    if (!byWallet) return [];
    var refs = API.recordedRefs("rwa");
    var out = [];
    Object.keys(byWallet).forEach(function (wid) {
      if (opts && opts.walletId && wid !== opts.walletId) return;
      (byWallet[wid].assets || []).forEach(function (a) {
        var aid = a.id || a.ticker;
        if (refs["rwa:" + aid + ":" + wid]) return;   // já gravado → não deriva
        var when = a.date || a.buyDate || a.openedAt || a.createdAt;
        if (!when || a.entry == null) return;
        out.push({
          id: "der:rwa:" + (aid || Math.random().toString(36).slice(2)) + ":" + wid,
          date: when, tipo: "entrada", valorUSD: a.entry,
          module: "rwa", walletId: wid, origem: "derivado",
          label: "Ativo " + (a.ticker || a.name || "RWA")
        });
      });
    });
    return out;
  });

  global.AtlasMovements = API;
})(typeof window !== "undefined" ? window : this);
