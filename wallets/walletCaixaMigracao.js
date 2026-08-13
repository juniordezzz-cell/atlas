/* ============================================================
   ATLAS · /wallets/walletCaixaMigracao.js
   ------------------------------------------------------------
   A ABERTURA DE SALDO — uma vez, para as posições que já existiam.

   O PROBLEMA
   ----------
   O livro de caixa (walletCaixa.js) nasceu na terceira auditoria, e
   nasceu vazio. As posições do usuário são anteriores a ele: elas
   existem, valem dinheiro, e não têm nenhum evento explicando de onde
   esse dinheiro veio.

   Sem correção, o primeiro encerramento de posição CREDITA o caixa sem
   nunca ter debitado — e o caixa fica positivo por dinheiro que o
   livro nunca viu entrar. Pior: o patrimônio mostrado passa a
   contradizer o "depositado − sacado" sem que nada tenha rendido.

   O QUE ESTA MIGRAÇÃO NÃO FAZ
   ---------------------------
   Não inventa dinheiro. O capital das posições é um fato observável —
   ele está gravado em cada módulo. O que faltava era o REGISTRO da
   entrada dele, e é só isso que se reconstrói aqui.

   E não deposita sem alocar. Registrar só o depósito faria o caixa
   ficar com X ao lado de posições que valem X, e a tela somaria 2X: o
   patrimônio dobraria de tamanho numa migração feita para corrigir a
   contabilidade. Por isso cada posição ganha o seu APORTE junto, e o
   caixa termina em zero — que é o estado verdadeiro de quem tem tudo
   alocado.

     depósito de abertura   +X   (soma do capital das posições)
     aporte por posição     −X   (uma linha por posição, rastreável)
     ----------------------------
     caixa                   0

   A partir daí o ciclo normal funciona: fechar devolve ao caixa, com
   o resultado embutido.

   QUANDO RODA
   -----------
   Uma vez, e só onde os QUATRO stores estão carregados (Dashboard e
   Carteiras). Rodar numa página com dois módulos migraria pela metade
   e marcaria como feito — o pior desfecho possível para algo que só
   acontece uma vez.

   Também não roda se o livro já tiver qualquer evento: nesse caso o
   usuário já começou a registrar movimentos, e a "abertura" chegaria
   atrasada, no meio de uma história já contada.

   Exposto em: window.AtlasCaixaMigracao
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasCaixaMigracao) return;

  var FLAG = "atlas.caixa.migrado.v1";

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  function jaRodou() {
    try { return global.localStorage.getItem(FLAG) === "1"; } catch (e) { return false; }
  }
  function marcar() {
    try { global.localStorage.setItem(FLAG, "1"); } catch (e) {}
  }

  /* Os quatro stores precisam estar TODOS presentes. */
  function storesCompletos() {
    return !!(global.DeFiStore && global.DeFiStore.all &&
              global.RWAStore && global.RWAStore.byWallet &&
              global.Store && global.Store.state &&
              global.ATLAS && global.ATLAS.app && global.ATLAS.app.getState);
  }

  /* ------------------------------------------------------------
     O que cada módulo tem aberto, por carteira.
     Devolve [{ walletId, module, refId, valor, data, rotulo }]
     ------------------------------------------------------------ */
  function levantar() {
    var out = [];

    /* ---- DeFi: capital que saiu do bolso, não a base investida ----
       `aportado` é abertura + aportes; a base inclui reinvestimento de
       taxa, que é dinheiro que a pool gerou e não que o usuário
       colocou. Usar a base faria a abertura de saldo depositar taxa
       que nunca foi depósito. */
    try {
      var d = global.DeFiStore.all();
      Object.keys(d.byWallet || {}).forEach(function (wid) {
        (d.byWallet[wid].pools || []).forEach(function (p) {
          if (p.status === "encerrada" || p.closedAt) return;
          var r = global.DeFiStore.poolSummary(p);
          var v = r ? num(r.aportado) : num(p.capital);
          if (v > 0) out.push({ walletId: wid, module: "defi", refId: p.id, valor: v,
                                data: p.openedAt || p.createdAt,
                                rotulo: "Pool " + p.base + "/" + p.quote });
        });
      });
    } catch (e) {}

    /* ---- Hold: quantidade × preço médio ---- */
    try {
      (global.Store.state.carteira || []).forEach(function (pos) {
        var v = num(pos.quantidade) * num(pos.preco_medio);
        if (!(v > 0)) return;
        var tk = "";
        try { var a = global.Store.get.asset(pos.ativo_id); tk = a ? a.ticker : ""; } catch (e2) {}
        out.push({ walletId: pos.walletId || "principal", module: "hold",
                   refId: "hold:" + pos.ativo_id, valor: v, data: pos.data,
                   rotulo: "Posição " + (tk || "Hold") });
      });
    } catch (e) {}

    /* ---- RWA: o custo informado ---- */
    try {
      var s = global.RWAStore.byWallet();
      Object.keys(s || {}).forEach(function (wid) {
        (s[wid].assets || []).forEach(function (a) {
          var v = num(a.entry);
          if (v > 0) out.push({ walletId: wid, module: "rwa", refId: "rwa:" + a.id,
                                valor: v, data: a.date,
                                rotulo: "Ativo " + (a.ticker || a.name || "RWA") });
        });
      });
    } catch (e) {}

    /* ---- Trade: só o que tem capital em dólar ----
       Trade anterior à terceira auditoria não tem sizeUSD, e o sistema
       não tem como saber quanto foi. Ele fica de fora da abertura em
       vez de entrar com um número inventado. */
    try {
      var st = global.ATLAS.app.getState();
      Object.keys(st.data || {}).forEach(function (wid) {
        (st.data[wid].trades || []).forEach(function (t) {
          if (t.status !== "aberto") return;
          var v = num(t.sizeUSD);
          if (v > 0) out.push({ walletId: wid, module: "trade", refId: t.id, valor: v,
                                data: t.openedAt, rotulo: "Trade " + (t.asset || "") });
        });
      });
    } catch (e) {}

    return out;
  }

  /* ------------------------------------------------------------
     Executa. Devolve um relatório do que foi feito — a tela mostra,
     porque uma migração silenciosa que mexe em dinheiro é a definição
     de mudança que ninguém consegue conferir depois.
     ------------------------------------------------------------ */
  function migrar(opts) {
    opts = opts || {};
    var CX = global.AtlasCaixa;
    if (!CX) return { ok: false, motivo: "Livro de caixa não carregado." };
    if (!opts.forcar && jaRodou()) return { ok: false, motivo: "Já migrado." };
    if (!storesCompletos()) return { ok: false, motivo: "Nem todos os módulos estão carregados nesta página." };
    if (!opts.forcar && CX.eventos({}).length) {
      return { ok: false, motivo: "O livro já tem movimentos registrados." };
    }

    var itens = levantar();
    if (!itens.length) {
      marcar();
      return { ok: true, carteiras: 0, posicoes: 0, total: 0,
               motivo: "Nenhuma posição anterior — o livro começa do zero." };
    }

    /* agrupa por carteira: um depósito de abertura por carteira */
    var porCarteira = {};
    itens.forEach(function (i) {
      porCarteira[i.walletId] = (porCarteira[i.walletId] || 0) + i.valor;
    });

    /* A data da abertura é a da posição MAIS ANTIGA da carteira: o
       depósito não pode ser posterior ao aporte que ele financia, ou o
       extrato ficaria com uma saída antes da entrada. */
    var maisAntiga = {};
    itens.forEach(function (i) {
      var d = i.data || null;
      if (!d) return;
      if (!maisAntiga[i.walletId] || String(d) < String(maisAntiga[i.walletId])) {
        maisAntiga[i.walletId] = d;
      }
    });

    var eventos = [];
    Object.keys(porCarteira).forEach(function (wid) {
      eventos.push({
        tipo: "deposito", valorUSD: porCarteira[wid], walletId: wid,
        data: maisAntiga[wid] || undefined,
        obs: "Abertura de saldo — capital das posições que já existiam quando o " +
             "livro de caixa foi criado"
      });
    });
    itens.forEach(function (i) {
      eventos.push({
        tipo: "aporte", valorUSD: i.valor, walletId: i.walletId,
        module: i.module, refId: i.refId, data: i.data,
        obs: "Abertura de saldo · " + i.rotulo
      });
    });

    var gravados = CX.registrarVarios(eventos);
    if (!gravados) return { ok: false, motivo: "Algum evento foi recusado — nada foi gravado." };

    marcar();
    var total = Object.keys(porCarteira).reduce(function (a, k) { return a + porCarteira[k]; }, 0);
    return {
      ok: true,
      carteiras: Object.keys(porCarteira).length,
      posicoes: itens.length,
      total: Math.round(total * 100) / 100,
      itens: itens
    };
  }

  /* Só olha, não grava — para a tela poder oferecer a migração
     dizendo antes o que ela vai fazer. */
  function previa() {
    if (!storesCompletos()) return null;
    var itens = levantar();
    var total = itens.reduce(function (a, i) { return a + i.valor; }, 0);
    return { posicoes: itens.length, total: Math.round(total * 100) / 100, itens: itens };
  }

  global.AtlasCaixaMigracao = {
    migrar: migrar,
    previa: previa,
    jaRodou: jaRodou,
    pendente: function () {
      if (jaRodou()) return false;
      if (!global.AtlasCaixa || global.AtlasCaixa.eventos({}).length) return false;
      var p = previa();
      return !!(p && p.posicoes);
    }
  };
})(typeof window !== "undefined" ? window : this);
