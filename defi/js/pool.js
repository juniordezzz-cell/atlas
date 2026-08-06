/* ============================================================
   ATLAS · DeFi — pool.js
   Página da posição: abas Resumo, Performance, Diário, Timeline,
   Histórico, Movimentações + Editar / Fechar.
   ============================================================ */
(function () {
  "use strict";
  var U = window.U, C = window.C, S = window.DeFiStore;

  C.mountNav("pools");

  var id = U.param("id");
  var p = S.pool(id);
  var root = U.qs("#poolRoot");

  if (!p) {
    root.innerHTML = C.empty({
      icon: "pools", title: "Posição não encontrada",
      text: "Essa posição pode ter sido encerrada ou removida.",
      actionLabel: "Voltar às Pools", actionHref: "pools.html"
    });
    return;
  }

  var st = U.status(p.status);
  var profitCls = p.profit > 0 ? "up" : (p.profit < 0 ? "down" : "flat");
  var days = U.daysBetween(p.openedAt);

  root.innerHTML = '' +
    '<a class="nav-back" href="pools.html" style="margin-bottom:18px;display:inline-flex">' + U.icon("back") + '<span>Pools</span></a>' +

    '<div class="pool-hero">' +
      '<div class="ph-left">' +
        '<div class="pair-icons" style="transform:scale(1.25);transform-origin:left">' + U.coin(p.base) + U.coin(p.quote) + '</div>' +
        '<div>' +
          '<div class="ph-title">' + p.base + ' / ' + p.quote + '</div>' +
          '<div class="row" style="gap:10px;margin-top:2px">' + U.statusDot(p.status) +
            '<span class="dot-sep">·</span><span class="muted" style="font-size:13px">' + days + ' dias em operação</span></div>' +
          '<div class="ph-tags">' +
            '<span class="tag tag-chain"><span class="dot" style="background:' + S.colorOf("chain", p.chain) + '"></span>' + p.chain + '</span>' +
            '<span class="tag tag-proto">' + p.protocol + '</span>' +
            '<span class="tag tag-cat">' + p.category + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ph-actions">' +
        '<button class="btn btn-secondary" id="btnEdit">' + U.icon("edit") + 'Editar</button>' +
        '<button class="btn btn-danger" id="btnClose">Fechar posição</button>' +
      '</div>' +
    '</div>' +

    '<div class="pool-summary">' +
      miniCard("Capital", U.money(p.capital)) +
      miniCard("Valor atual", U.money(p.currentValue)) +
      miniCard("Lucro", '<span class="delta ' + profitCls + '">' + U.signedMoney(p.profit) + ' · ' + U.pct(p.profitPct, true) + '</span>') +
      miniCard("APR", p.apr ? U.pct(p.apr) : "—") +
    '</div>' +

    '<div class="tabs" id="tabs">' +
      tab("resumo", "Resumo", true) + tab("perf", "Performance") + tab("diario", "Diário") +
      tab("timeline", "Timeline") + tab("historico", "Histórico") + tab("mov", "Movimentações") +
    '</div>' +

    '<div class="tab-panel active" data-tab="resumo">' + resumoPanel() + '</div>' +
    '<div class="tab-panel" data-tab="perf">' +
      '<div class="panel panel-pad"><div class="panel-head"><h3>Performance da posição</h3><span class="muted" style="font-size:12px">Valor ao longo do tempo</span></div>' +
      '<div class="chart-box h-lg"><canvas id="chartPerf"></canvas></div></div>' +
    '</div>' +
    '<div class="tab-panel" data-tab="diario">' + diarioPanel() + '</div>' +
    '<div class="tab-panel" data-tab="timeline">' +
      '<div class="panel panel-pad"><div class="panel-head"><h3>Timeline da estratégia</h3></div>' + timelineHtml() + '</div>' +
    '</div>' +
    '<div class="tab-panel" data-tab="historico">' +
      '<div class="panel panel-pad"><div class="panel-head"><h3>Histórico de valor</h3></div>' + histHtml() + '</div>' +
    '</div>' +
    '<div class="tab-panel" data-tab="mov">' +
      '<div class="panel panel-pad"><div class="panel-head"><h3>Movimentações</h3></div>' + movHtml() + '</div>' +
    '</div>';

  /* ---------- helpers de markup ---------- */
  function miniCard(k, v) { return '<div class="mini-stat"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'; }
  function tab(id, label, active) { return '<button class="tab' + (active ? " active" : "") + '" data-t="' + id + '">' + label + '</button>'; }

  function resumoPanel() {
    var rangeHtml = "";
    if ((p.status === "ativa" || p.status === "range") && p.rangeHigh > 0) {
      var pos = Math.max(4, Math.min(96, (p.rangePos || 0.5) * 100));
      rangeHtml = '<div class="panel panel-pad" style="margin-top:18px">' +
        '<div class="panel-head"><h3>Range de preço</h3>' + (p.status === "range" ? U.statusChip("range") : U.statusChip("ativa")) + '</div>' +
        '<div class="spread" style="font-family:var(--font-mono);font-size:13px;color:var(--text-mut)"><span>' + p.rangeLow + '</span><span>' + p.rangeHigh + '</span></div>' +
        '<div class="range-bar' + (p.status === "range" ? " out" : "") + '" style="height:8px;margin-top:8px"><i style="left:0;width:' + pos + '%"></i></div>' +
        '</div>';
    }
    return '<div class="col-2">' +
        '<div class="panel panel-pad">' +
          '<div class="panel-head"><h3>Objetivo</h3><span class="tip"><span class="tip-icon">?</span><span class="tip-body">A tese que sustenta a posição. Nenhum ativo existe sem tese.</span></span></div>' +
          '<div class="diary-goal">' + p.goal + '</div>' +
        '</div>' +
        mercadoPanel() +
        acompanhamentoPanel() +
        taxasPanel() +
      '</div>' + rangeHtml;
  }
  function row(k, v) { return '<div class="mov-item"><div class="mov-main"><div class="t">' + k + '</div></div><div class="mov-amt">' + v + '</div></div>'; }

  /* ============================================================
     ACOMPANHAMENTO — de onde veio o resultado

     A pergunta que importa numa pool não é "quanto rendeu", é
     "rendeu por taxa ou por preço?". Ganhar 4% de taxa e perder
     3% em ativo dá +1% — e é uma posição muito diferente de +1%
     puro de valorização. Por isso as duas linhas vêm separadas.
     ============================================================ */
  function acompanhamentoPanel() {
    var r = S.poolSummary(p.id);
    if (!r) return "";

    var clsRes = r.resultado > 0 ? "up" : r.resultado < 0 ? "down" : "";
    var clsAtv = r.varAtivos > 0 ? "up" : r.varAtivos < 0 ? "down" : "";

    return '<div class="panel panel-pad">' +
      '<div class="panel-head"><div>' +
        '<div class="eyebrow">Acompanhamento</div><h3>De onde veio o resultado</h3>' +
      '</div><span class="muted" style="font-size:11.5px">' +
        (r.criadaEm ? "criada " + U.date(r.criadaEm) : "") +
        (r.atualizadaEm ? " · atualizada " + U.date(r.atualizadaEm) : "") +
      '</span></div>' +

      '<div class="cmp">' +
        '<div class="cmp-side"><span class="k">Entrou com</span>' +
          '<b>' + U.money(r.inicial) + '</b>' +
          '<small>' + (r.criadaEm ? U.date(r.criadaEm) : "—") + '</small></div>' +
        '<div class="cmp-arrow">→</div>' +
        '<div class="cmp-side"><span class="k">Vale hoje</span>' +
          '<b class="delta ' + clsRes + '">' + U.money(r.atual) + '</b>' +
          '<small>' + U.pct(r.resultadoPct, true) + ' em ' + r.dias + ' dia(s)</small></div>' +
      '</div>' +

      '<div class="mov-list" style="margin-top:12px">' +
        row('<span class="src src-a"></span> Variação dos ativos',
            '<span class="delta ' + clsAtv + '">' + U.signedMoney(r.varAtivos) + '</span>') +
        row('<span class="src src-t"></span> Taxas geradas',
            '<span class="delta up">' + U.signedMoney(r.taxasTotal) + '</span>') +
        row("APR realizado",
            '<b>' + (r.aprReal).toFixed(1) + '%</b> <span class="muted" style="font-size:11px">a.a.</span>') +
      '</div>' +

      (r.taxasTotal === 0 && r.varAtivos !== 0
        ? '<div class="hint" style="margin-top:9px">Nenhuma taxa registrada ainda — todo o resultado está sendo atribuído aos ativos. Registre as coletas abaixo para separar as duas coisas.</div>'
        : "") +
    '</div>';
  }

  /* ============================================================
     MERCADO — performance dos ativos, com preço de agora

     Este painel existe porque p.currentValue era gravado na criação
     da pool e NUNCA atualizado. Resultado: "Vale hoje" repetia o
     capital de entrada, e como varAtivos = atual - inicial - taxas,
     registrar taxa fazia a variação dos ativos ficar NEGATIVA no
     mesmo valor. Número errado com cara de certo.

     Agora o preço vem do CoinGecko (DeFiTokens.precos, uma chamada
     em lote pelos ids exatos) e alimenta o DeFiPerf. Quando a
     resposta chega, gravamos em currentValue — então o painel de
     acompanhamento passa a bater também.

     Os dois modos (benchmark HODL x composição real) estão
     explicados no defi/js/performance.js. A tela sempre diz qual
     está em uso: chamar benchmark de "valor da posição" seria
     mentira confortável.
     ============================================================ */
  var _perf = null;    // último cálculo, para não recalcular no rerender

  function mercadoPanel() {
    if (!window.DeFiPerf) return "";

    var r = _perf;
    if (!r) {
      return '<div class="panel panel-pad" id="mercadoPanel">' +
        '<div class="panel-head"><div><div class="eyebrow">Mercado</div>' +
        '<h3>Performance dos ativos</h3></div></div>' +
        '<div class="hint">Buscando preço de ' + p.base + ' e ' + p.quote + '…</div></div>';
    }

    var clsM = r.pnlMercado > 0 ? "up" : r.pnlMercado < 0 ? "down" : "";
    var clsT = r.pnlTotal > 0 ? "up" : r.pnlTotal < 0 ? "down" : "";

    /* selo de faixa, igual ao da corretora */
    var selo = "";
    if (r.temFaixa && r.dentroDaFaixa !== null) {
      selo = r.dentroDaFaixa
        ? '<span class="tag" style="background:rgba(0,200,83,.14);color:#00c853">na faixa</span>'
        : '<span class="tag" style="background:rgba(255,86,86,.14);color:#ff7676">fora da faixa</span>';
    }

    var aviso = "";
    if (!r.precoOk) {
      aviso = '<div class="hint" style="margin-top:9px">Sem preço de ' +
        r.faltando.join(" e ") + ' — usei o preço de entrada para esse lado, então o ' +
        'resultado abaixo está incompleto. Cadastre o id do CoinGecko em Configurações.</div>';
    }

    var linhaModo = r.modo === "real"
      ? '<div class="hint" style="margin-top:9px">Composição atual informada: o valor abaixo é o real da posição. ' +
        'A diferença contra o benchmark HODL é o impermanent loss.</div>'
      : '<div class="hint" style="margin-top:9px">Sem composição atual: o valor abaixo é um <b>benchmark HODL</b> ' +
        '(mesma quantidade da entrada, preço de hoje). Numa pool concentrada as quantidades mudam sozinhas — ' +
        'informe as atuais abaixo para ver o valor real e o impermanent loss.</div>';

    var pct = function (v) {
      if (v == null) return "—";
      return (v > 0 ? "+" : "") + v.toFixed(2) + "%";
    };

    return '<div class="panel panel-pad" id="mercadoPanel">' +
      '<div class="panel-head"><div>' +
        '<div class="eyebrow">Mercado</div><h3>Performance dos ativos</h3>' +
      '</div>' + selo + '</div>' +

      '<div class="cmp">' +
        '<div class="cmp-side"><span class="k">Custo de entrada</span>' +
          '<b>' + U.money(r.custo) + '</b>' +
          '<small>' + (r.precoEntradaBase ? U.money(r.precoEntradaBase) + " / " + p.base : "—") + '</small></div>' +
        '<div class="cmp-arrow">→</div>' +
        '<div class="cmp-side"><span class="k">' +
          (r.modo === "real" ? "Valor real" : "Benchmark HODL") + '</span>' +
          '<b class="delta ' + clsM + '">' + U.money(r.valorAtual) + '</b>' +
          '<small>' + (r.precoAtualBase ? U.money(r.precoAtualBase) + " / " + p.base : "—") + '</small></div>' +
      '</div>' +

      '<div class="mov-list" style="margin-top:12px">' +
        row(p.base + " desde a entrada",
            '<span class="delta ' + (r.varBase > 0 ? "up" : r.varBase < 0 ? "down" : "") + '">' + pct(r.varBase) + '</span>') +
        row(p.quote + " desde a entrada",
            '<span class="delta ' + (r.varQuote > 0 ? "up" : r.varQuote < 0 ? "down" : "") + '">' + pct(r.varQuote) + '</span>') +
        row("<b>PnL de mercado</b> <span class=\"muted\" style=\"font-size:11px\">sem taxas</span>",
            '<span class="delta ' + clsM + '">' + U.signedMoney(r.pnlMercado) + ' · ' + pct(r.pnlMercadoPct) + '</span>') +
        (r.il != null
          ? row("Impermanent loss",
                '<span class="delta ' + (r.il < 0 ? "down" : "up") + '">' + U.signedMoney(r.il) + ' · ' + pct(r.ilPct) + '</span>')
          : "") +
        row("Taxas coletadas", '<span class="delta up">' + U.signedMoney(r.feesColetadas) + '</span>') +
        row("Taxas pendentes", '<span class="muted">' + U.money(r.feesPendentes) + '</span>') +
        row("<b>PnL total</b> <span class=\"muted\" style=\"font-size:11px\">mercado + coletadas</span>",
            '<b class="delta ' + clsT + '">' + U.signedMoney(r.pnlTotal) + ' · ' + pct(r.pnlTotalPct) + '</b>') +
      '</div>' +

      (r.razao != null
        ? '<div class="hint" style="margin-top:9px">Cotação da pool agora: <b>' +
          r.razao.toFixed(7) + '</b> ' + p.base + ' por ' + p.quote +
          (r.temFaixa ? ' · faixa ' + r.rangeLow + ' – ' + r.rangeHigh : ' · faixa não cadastrada') +
          '</div>'
        : "") +

      linhaModo + aviso +

      /* ---- edição: composição atual e faixa ---- */
      '<div class="fee-form" style="margin-top:12px;grid-template-columns:1fr 1fr auto">' +
        '<div class="field" style="margin-bottom:0"><label>' + p.base + ' agora</label>' +
          '<input class="input" id="mqBase" type="number" step="any" min="0" placeholder="' +
          (p.qtyBase || 0) + '" value="' + (p.qtyBaseNow || "") + '" /></div>' +
        '<div class="field" style="margin-bottom:0"><label>' + p.quote + ' agora</label>' +
          '<input class="input" id="mqQuote" type="number" step="any" min="0" placeholder="' +
          (p.qtyQuote || 0) + '" value="' + (p.qtyQuoteNow || "") + '" /></div>' +
        '<button class="btn btn-secondary" id="mSaveQty">Salvar</button>' +
      '</div>' +
      '<div class="fee-form" style="grid-template-columns:1fr 1fr auto">' +
        '<div class="field" style="margin-bottom:0"><label>Faixa mínima</label>' +
          '<input class="input" id="mRLow" type="number" step="any" min="0" value="' + (p.rangeLow || "") + '" /></div>' +
        '<div class="field" style="margin-bottom:0"><label>Faixa máxima</label>' +
          '<input class="input" id="mRHigh" type="number" step="any" min="0" value="' + (p.rangeHigh || "") + '" /></div>' +
        '<button class="btn btn-secondary" id="mSaveRange">Salvar</button>' +
      '</div>' +
    '</div>';
  }

  /* Busca preços e recalcula. Chamado uma vez ao abrir a página. */
  function carregarMercado() {
    if (!window.DeFiPerf || !window.DeFiTokens) return;
    var r = S.poolSummary(p.id) || {};

    DeFiTokens.precos([p.base, p.quote]).then(function (precos) {
      _perf = DeFiPerf.calcular({
        base: p.base, quote: p.quote,
        qtyBase: p.qtyBase, qtyQuote: p.qtyQuote,
        priceBase: p.priceBase, priceQuote: p.priceQuote,
        qtyBaseNow: p.qtyBaseNow, qtyQuoteNow: p.qtyQuoteNow,
        feesColetadas: r.taxasColetadas, feesPendentes: r.taxasPendentes,
        rangeLow: p.rangeLow, rangeHigh: p.rangeHigh,
        rangeDenom: p.rangeDenom || "base_por_quote"
      }, precos);

      /* Grava o valor de mercado. É isto que faz o painel de
         acompanhamento parar de mentir. Só grava se o preço dos DOIS
         lados veio — meio preço daria um número pior que nenhum. */
      if (_perf && _perf.precoOk) {
        S.updatePool(p.id, {
          currentValue: Math.round(_perf.valorAtual * 100) / 100,
          profit: Math.round(_perf.pnlTotal * 100) / 100,
          profitPct: Math.round(_perf.pnlTotalPct * 100) / 100,
          updatedAt: new Date().toISOString().slice(0, 10)
        });
        p = S.pool(p.id) || p;
      }
      rerender();
    }).catch(function () {
      _perf = null;
      var host = U.qs("#mercadoPanel");
      if (host) host.innerHTML = '<div class="panel-head"><div><div class="eyebrow">Mercado</div>' +
        '<h3>Performance dos ativos</h3></div></div>' +
        '<div class="hint">Não consegui buscar os preços agora. Os valores de entrada seguem registrados.</div>';
    });
  }

  /* liga os botões de salvar do painel de mercado */
  function wireMercado() {
    var num = function (el) {
      if (!el) return 0;
      var v = parseFloat(String(el.value).replace(",", "."));
      return isFinite(v) && v >= 0 ? v : 0;
    };
    var bq = U.qs("#mSaveQty");
    if (bq) bq.addEventListener("click", function () {
      S.updatePool(p.id, {
        qtyBaseNow: num(U.qs("#mqBase")) || null,
        qtyQuoteNow: num(U.qs("#mqQuote")) || null
      });
      p = S.pool(p.id) || p;
      U.toast("Composição atual salva.", "ok");
      carregarMercado();
    });
    var br = U.qs("#mSaveRange");
    if (br) br.addEventListener("click", function () {
      var lo = num(U.qs("#mRLow")), hi = num(U.qs("#mRHigh"));
      if (lo > 0 && hi > 0 && hi <= lo) {
        U.toast("A faixa máxima tem que ser maior que a mínima.", "warn"); return;
      }
      S.updatePool(p.id, { rangeLow: lo, rangeHigh: hi });
      p = S.pool(p.id) || p;
      U.toast("Faixa salva.", "ok");
      carregarMercado();
    });
  }

  /* ============================================================
     TAXAS — histórico editável
     ============================================================ */
  function taxasPanel() {
    var r = S.poolSummary(p.id);
    var fees = (p.fees || []);

    var linhas = fees.length ? fees.map(function (f) {
      return '<div class="fee-item' + (f.status === "pendente" ? " is-pend" : "") + '" data-fee="' + f.id + '">' +
        '<span class="fee-date">' + U.date(f.date) + '</span>' +
        '<span class="fee-amt">' + U.money(f.amount) + '</span>' +
        '<span class="fee-tag">' + (f.status === "pendente" ? "pendente" : "coletada") + '</span>' +
        (f.status === "pendente"
          ? '<button class="fee-act" data-act="collect" data-fee="' + f.id + '" title="Marcar como recebida">recebi</button>'
          : '<span class="fee-act-sp"></span>') +
        '<button class="fee-del" data-act="del" data-fee="' + f.id + '" title="Remover">×</button>' +
      '</div>';
    }).join("") : '<div class="fee-empty">Nenhuma taxa registrada.</div>';

    return '<div class="panel panel-pad">' +
      '<div class="panel-head"><div>' +
        '<div class="eyebrow">Registro</div><h3>Taxas</h3></div>' +
        '<span class="muted" style="font-size:11.5px">' +
          U.money(r.taxasColetadas) + ' recebidas · ' + U.money(r.taxasPendentes) + ' pendentes' +
        '</span>' +
      '</div>' +

      '<div class="fee-form">' +
        '<input class="input" id="feeDate" type="date" value="' + new Date().toISOString().slice(0,10) + '" />' +
        '<div class="input-money"><span>US$</span><input class="input" id="feeAmt" type="number" step="any" min="0" placeholder="0,00" /></div>' +
        '<select class="select" id="feeStatus">' +
          '<option value="coletada">Já recebi</option>' +
          '<option value="pendente">Ainda na pool</option>' +
        '</select>' +
        '<button class="btn btn-primary" id="feeAdd">Registrar</button>' +
      '</div>' +

      '<div class="fee-list">' + linhas + '</div>' +
    '</div>';
  }

  /* Redesenha só a aba Resumo. Recarregar a página inteira perderia
     a aba aberta e a rolagem — e o registro de taxa é uma ação que a
     pessoa repete várias vezes seguidas. */
  function rerender() {
    p = S.pool(p.id) || p;
    var host = U.qs('.tab-panel[data-tab="resumo"]');
    if (!host) { location.reload(); return; }
    host.innerHTML = resumoPanel();
    wireTaxas();
    wireMercado();
  }

  /* liga os botões do painel de taxas depois de cada render */
  function wireTaxas() {
    var add = U.qs("#feeAdd");
    if (add) {
      add.addEventListener("click", function () {
        var v = parseFloat(String(U.qs("#feeAmt").value).replace(",", "."));
        if (!(v > 0)) { U.toast("Informe o valor da taxa.", "warn"); return; }
        S.addFee(p.id, {
          date: U.qs("#feeDate").value,
          amount: v,
          status: U.qs("#feeStatus").value
        });
        U.toast("Taxa registrada.", "ok");
        rerender();
      });
    }
    U.qsa(".fee-act[data-act=collect]").forEach(function (b) {
      b.addEventListener("click", function () {
        S.collectFee(p.id, b.dataset.fee); rerender();
      });
    });
    U.qsa(".fee-del").forEach(function (b) {
      b.addEventListener("click", function () {
        S.removeFee(p.id, b.dataset.fee); rerender();
      });
    });
  }

  function diarioPanel() {
    return '<div class="panel panel-pad">' +
      '<div class="panel-head"><div><div class="eyebrow">Tese & anotações</div><h3>Diário da estratégia</h3></div></div>' +
      '<div class="diary-goal" style="margin-bottom:18px">' + p.goal + '</div>' +
      '<div class="field"><textarea class="textarea" id="noteInput" placeholder="Adicionar anotação ao diário…"></textarea></div>' +
      '<div class="spread"><span class="hint faint">Suas anotações alimentarão o Oráculo futuramente.</span>' +
      '<button class="btn btn-primary btn-sm" id="addNote">' + U.icon("plus") + 'Adicionar</button></div>' +
      '<hr class="divider" />' +
      '<div id="notesList">' + notesHtml() + '</div>' +
      '</div>';
  }
  function notesHtml() {
    if (!p.notes.length) return '<p class="muted" style="font-size:13px">Nenhuma anotação ainda.</p>';
    return p.notes.map(function (n) {
      return '<div class="diary-note"><div class="meta">' + U.date(n.date) + '</div><div class="txt">' + n.text + '</div></div>';
    }).join("");
  }

  function timelineHtml() {
    if (!p.timeline || !p.timeline.length) return '<p class="muted" style="font-size:13px">Sem eventos registrados.</p>';
    return '<div class="timeline">' + p.timeline.map(function (e) {
      var cls = e.type === "warn" ? "warn" : e.type === "violet" ? "violet" : e.type === "end" ? "end" : "";
      return '<div class="tl-item ' + cls + '"><div class="tl-date">' + U.date(e.date) + '</div>' +
        '<div class="tl-title">' + e.title + '</div><div class="tl-desc">' + e.desc + '</div></div>';
    }).join("") + '</div>';
  }

  function histHtml() {
    return '<div class="chart-box h-md" style="margin-bottom:8px"><canvas id="chartHist"></canvas></div>';
  }

  function movHtml() {
    if (!p.movements || !p.movements.length) return '<p class="muted" style="font-size:13px">Nenhuma movimentação registrada.</p>';
    return '<div class="mov-list">' + p.movements.map(function (m) {
      var ic = m.type === "in" ? "in" : m.type === "out" ? "out" : "re";
      var icName = m.type === "in" ? "in" : m.type === "out" ? "out" : "re";
      var amt = m.amount ? U.signedMoney(m.type === "out" ? -m.amount : m.amount) : "—";
      var amtCls = m.type === "in" ? "up" : m.type === "out" ? "down" : "flat";
      return '<div class="mov-item"><div class="mov-ic ' + ic + '">' + U.icon(icName) + '</div>' +
        '<div class="mov-main"><div class="t">' + m.label + '</div><div class="d">' + U.date(m.date) + '</div></div>' +
        '<div class="mov-amt delta ' + amtCls + '">' + amt + '</div></div>';
    }).join("") + '</div>';
  }

  /* ---------- Tabs ---------- */
  var charts = {};
  U.qsa("#tabs .tab").forEach(function (t) {
    t.addEventListener("click", function () {
      U.qsa("#tabs .tab").forEach(function (x) { x.classList.remove("active"); });
      U.qsa(".tab-panel").forEach(function (x) { x.classList.remove("active"); });
      t.classList.add("active");
      var key = t.dataset.t;
      U.qs('.tab-panel[data-tab="' + key + '"]').classList.add("active");
      if (key === "perf" && !charts.perf) charts.perf = Charts.line(U.qs("#chartPerf"), p.history, { color: "#8B5CF6", fill: "rgba(139,92,246,0.16)" });
      if (key === "historico" && !charts.hist) charts.hist = Charts.line(U.qs("#chartHist"), p.history, { color: "#5B9BFF", fill: "rgba(59,130,246,0.16)" });
    });
  });

  /* ---------- Diário: adicionar nota ---------- */
  wireTaxas();
  wireMercado();
  carregarMercado();

  U.qs("#addNote").addEventListener("click", function () {
    var v = U.qs("#noteInput").value.trim();
    if (!v) { U.toast("Escreva algo para anotar.", "warn"); return; }
    S.addNote(p.id, v);
    p = S.pool(p.id);
    U.qs("#notesList").innerHTML = notesHtml();
    U.qs("#noteInput").value = "";
    U.toast("Anotação adicionada ao diário.", "ok");
  });

  /* ---------- Editar ---------- */
  U.qs("#btnEdit").addEventListener("click", function () {
    U.qs("#eVal").value = p.currentValue; U.qs("#eApr").value = p.apr; U.qs("#eStatus").value = p.status;
    U.openModal("#modalEdit");
  });
  U.qs("#saveEdit").addEventListener("click", function () {
    var val = parseFloat(U.qs("#eVal").value) || p.currentValue;
    var apr = parseFloat(U.qs("#eApr").value) || 0;
    var status = U.qs("#eStatus").value;
    var profit = val - p.capital;
    S.updatePool(p.id, { currentValue: val, apr: apr, status: status, profit: profit, profitPct: p.capital ? (profit / p.capital) * 100 : 0 });
    U.closeModal("#modalEdit");
    U.toast("Posição atualizada.", "ok");
    setTimeout(function () { location.reload(); }, 500);
  });

  /* ---------- Fechar ---------- */
  U.qs("#btnClose").addEventListener("click", function () { U.openModal("#modalClose"); });
  U.qs("#confirmClose").addEventListener("click", function () {
    var reason = U.qs("#closeReason").value.trim() || "Encerramento manual.";
    S.closePool(p.id, reason);
    U.closeModal("#modalClose");
    U.toast("Posição encerrada e movida ao Histórico.", "ok");
    setTimeout(function () { location.href = "historico.html"; }, 700);
  });

  /* fechar modais genérico */
  U.qsa("[data-close]").forEach(function (b) {
    b.addEventListener("click", function () { U.closeModal("#" + b.dataset.close); });
  });
  U.qsa(".modal-overlay").forEach(function (m) {
    m.addEventListener("click", function (e) { if (e.target === m) m.classList.remove("open"); });
  });
})();
