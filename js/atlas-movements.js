/* ============================================================
   ATLAS · js/atlas-movements.js
   ------------------------------------------------------------
   APRESENTAÇÃO DOS MOVIMENTOS — não mais uma segunda fonte deles.

   O QUE ESTE ARQUIVO ERA, E POR QUE MUDOU
   ---------------------------------------
   Ele era um SEGUNDO livro-razão. Tinha armazenamento próprio
   (atlas.movements.v1), uma função record() que os módulos chamavam, e
   quatro adaptadores que DERIVAVAM movimentos lendo as posições de
   cada módulo — pool.events, carteira do Hold, trades encerrados,
   ativos do RWA.

   Fazia sentido enquanto o ATLAS não tinha um livro de dinheiro. Na
   terceira auditoria ele passou a ter: wallets/walletCaixa.js, onde o
   saldo de cada carteira é a soma de eventos e nada é gravado duas
   vezes.

   A partir daí havia DUAS respostas para "que movimentos existem" — e
   elas discordavam por construção. O Hold gravava aqui via record() E
   registrava um aporte no caixa; a mesma compra aparecia como um
   movimento gravado, um movimento derivado e um evento de caixa. Somar
   errado era questão de tempo, e a Regra de Ouro do projeto é explícita:
   uma fonte única por conceito.

   O QUE ELE É AGORA
   -----------------
   Uma VISTA sobre o livro de caixa, no vocabulário que os Relatórios
   já falam (entrada / saída / resultado), mais as funções de
   agrupamento por período que só existem para apresentar. Zero
   armazenamento próprio, zero adaptador, zero record().

   COMO O CAIXA VIRA ENTRADA E SAÍDA
   ---------------------------------
   O sinal é o do CAIXA da carteira que está sendo olhada:

     deposito                  → entrada
     retorno de posição        → entrada
     transferência recebida    → entrada
     saque                     → saída
     aporte em posição         → saída
     transferência enviada     → saída
     swap                      → fica fora: não move dinheiro, só troca
                                 a forma dele

   E O "RESULTADO"
   ---------------
   Nenhum evento de caixa é lucro — o lucro está EMBUTIDO no retorno,
   que devolve capital mais resultado num valor só. Mas ele é derivável
   sem ambiguidade: para cada posição, resultado = tudo que voltou
   menos tudo que saiu (Σ retorno − Σ aporte, pelo refId). Uma linha
   por posição que já devolveu algo, datada no último retorno.

   Isso é derivação de UMA fonte, não uma segunda fonte: some o caixa,
   e não sobra nada aqui para discordar dele.

   API (inalterada para quem consome)
   ----------------------------------
     AtlasMovements.list(opts)                  {walletId, from, to, module, tipo}
     AtlasMovements.summarize(list)
     AtlasMovements.groupByPeriod(list, period) "month"|"quarter"|"semester"|"year"
     AtlasMovements.compareBuckets(buckets)
     AtlasMovements.walletsWithActivity()
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasMovements) return;

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function safe(fn, fb) { try { return fn(); } catch (e) { return fb; } }

  function toDay(v) {
    if (v == null || v === "") return null;
    var d;
    if (v instanceof Date) d = v;
    else if (typeof v === "number") d = new Date(v);
    else {
      var s = String(v);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      d = new Date(s);
    }
    if (isNaN(d.getTime())) return null;
    var mm = String(d.getMonth() + 1), dd = String(d.getDate());
    return d.getFullYear() + "-" + (mm.length < 2 ? "0" + mm : mm) + "-" + (dd.length < 2 ? "0" + dd : dd);
  }

  function caixa() { return global.AtlasCaixa || null; }

  var NOME_MODULO = { hold: "Hold", trade: "Trade", defi: "DeFi", rwa: "RWA" };

  function nomeCarteira(id) {
    return safe(function () {
      var w = global.AtlasWallets && global.AtlasWallets.get ? global.AtlasWallets.get(id) : null;
      return w ? w.name : id;
    }, id);
  }

  /* ------------------------------------------------------------
     Um evento de caixa vira (ou não) um movimento de relatório.

     `walletId` do filtro importa: numa transferência, a MESMA linha é
     saída para uma carteira e entrada para a outra. Sem esse cuidado,
     o relatório da carteira que RECEBEU mostraria uma saída.
     ------------------------------------------------------------ */
  function comoMovimento(ev, walletIdFiltro) {
    var CX = caixa();
    var def = CX && CX.TIPOS ? CX.TIPOS[ev.tipo] : null;
    if (!def || !def.sinal) return null;          // swap não é fluxo

    var sinal = def.sinal;
    var carteira = ev.walletId;
    if (def.contra && walletIdFiltro && ev.contraWalletId === walletIdFiltro) {
      sinal = -sinal;
      carteira = ev.contraWalletId;
    }

    var rotulo = CX.rotulo(ev.tipo);
    if (ev.tipo === "transferencia") {
      rotulo = sinal > 0
        ? "Transferência de " + nomeCarteira(ev.walletId)
        : "Transferência para " + nomeCarteira(ev.contraWalletId);
    } else if (ev.obs) {
      rotulo = ev.obs;
    }

    return {
      id: "cx:" + ev.id,
      date: ev.data,
      tipo: sinal > 0 ? "entrada" : "saida",
      valorUSD: ev.valorUSD,
      module: ev.module || null,
      walletId: carteira,
      origem: "caixa",
      label: rotulo,
      ref: ev.refId || null
    };
  }

  /* ------------------------------------------------------------
     RESULTADO POR POSIÇÃO — derivado, não gravado

     Σ retorno − Σ aporte de um mesmo refId. Só entra quando a posição
     já devolveu alguma coisa: enquanto ela está aberta, o resultado
     ainda não foi realizado e afirmá-lo seria inventar.
     ------------------------------------------------------------ */
  function resultados(eventos) {
    var porRef = {};
    eventos.forEach(function (e) {
      if (e.tipo !== "aporte" && e.tipo !== "retorno") return;
      if (!e.refId) return;
      var r = porRef[e.refId] || (porRef[e.refId] = {
        aporte: 0, retorno: 0, ultima: null, module: e.module,
        walletId: e.walletId, rotulo: e.obs || ""
      });
      if (e.tipo === "aporte") r.aporte += e.valorUSD;
      else {
        r.retorno += e.valorUSD;
        if (!r.ultima || e.data > r.ultima) { r.ultima = e.data; r.rotulo = e.obs || r.rotulo; }
      }
    });

    var out = [];
    Object.keys(porRef).forEach(function (ref) {
      var r = porRef[ref];
      if (!r.retorno || !r.ultima) return;
      var valor = Math.round((r.retorno - r.aporte) * 1e6) / 1e6;
      if (!valor) return;
      out.push({
        id: "res:" + ref,
        date: r.ultima,
        tipo: "resultado",
        valorUSD: valor,
        module: r.module || null,
        walletId: r.walletId,
        origem: "derivado",
        label: "Resultado" + (r.module && NOME_MODULO[r.module] ? " · " + NOME_MODULO[r.module] : "") +
               (r.rotulo ? " — " + r.rotulo : ""),
        ref: ref
      });
    });
    return out;
  }

  function passa(mv, o) {
    if (o.walletId && mv.walletId !== o.walletId) return false;
    if (o.module && mv.module !== o.module) return false;
    if (o.tipo && mv.tipo !== o.tipo) return false;
    if (o.from && mv.date < toDay(o.from)) return false;
    if (o.to && mv.date > toDay(o.to)) return false;
    return true;
  }

  function periodKey(day, period) {
    var y = day.slice(0, 4), m = parseInt(day.slice(5, 7), 10);
    switch (period) {
      case "year":     return { key: y, label: y };
      case "semester": var s = m <= 6 ? 1 : 2; return { key: y + "-S" + s, label: "S" + s + "/" + y };
      case "quarter":  var q = Math.ceil(m / 3); return { key: y + "-Q" + q, label: "Q" + q + "/" + y };
      default:         return { key: day.slice(0, 7), label: day.slice(0, 7) };
    }
  }

  var API = {
    list: function (opts) {
      opts = opts || {};
      var CX = caixa();
      if (!CX) return [];

      /* Todos os eventos: o filtro por carteira acontece DEPOIS de
         decidir o sinal, senão a transferência recebida seria
         descartada por estar gravada na carteira de origem. */
      var eventos = safe(function () { return CX.eventos({}); }, []);

      var out = [];
      eventos.forEach(function (e) {
        var mv = comoMovimento(e, opts.walletId);
        if (mv) out.push(mv);
      });
      resultados(eventos).forEach(function (r) { out.push(r); });

      out = out.filter(function (m) { return passa(m, opts); });
      out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      return out;
    },

    summarize: function (list) {
      var r = { entrada: 0, saida: 0, resultado: 0, net: 0, count: (list || []).length };
      (list || []).forEach(function (m) {
        if (m.tipo === "entrada") r.entrada += m.valorUSD;
        else if (m.tipo === "saida") r.saida += m.valorUSD;
        else if (m.tipo === "resultado") r.resultado += m.valorUSD;
      });
      /* net é fluxo de caixa: entradas menos saídas. Resultado é
         performance e não entra — ele já está dentro das entradas de
         retorno, e somá-lo de novo contaria duas vezes. */
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

    /* ------------------------------------------------------------
       Lê os EVENTOS, não a lista já montada.

       list({}) sem filtro de carteira resolve a transferência do ponto
       de vista da ORIGEM — é a única leitura possível quando não se
       pergunta por uma carteira específica. Consequência: uma carteira
       que só recebeu transferências não aparecia em lugar nenhum, e o
       seletor do relatório não a oferecia. Aqui os dois lados contam.
       ------------------------------------------------------------ */
    walletsWithActivity: function () {
      var CX = caixa();
      if (!CX) return [];
      var ids = {};
      safe(function () { return CX.eventos({}); }, []).forEach(function (e) {
        if (e.walletId) ids[e.walletId] = 1;
        if (e.contraWalletId) ids[e.contraWalletId] = 1;
      });
      return Object.keys(ids);
    },

    _toDay: toDay
  };

  global.AtlasMovements = API;
})(typeof window !== "undefined" ? window : this);
