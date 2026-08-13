/* ============================================================
   ATLAS · DeFi — pool.js
   Página da posição: abas Resumo, Performance, Diário, Timeline,
   Histórico, Movimentações + Editar / Fechar.

   ORGANIZAÇÃO DO RESUMO
   ---------------------
   A ordem não é decorativa; ela responde três perguntas em sequência:

     1. como está a POSIÇÃO?      (esquerda: performance da pool)
     2. como estão os ATIVOS?     (direita: mercado, benchmark, faixa)
     3. de ONDE veio o resultado? (abaixo: taxa x variação de ativo)

   O painel "Objetivo" era o primeiro e ocupava metade da largura para
   exibir uma linha de texto — meia tela vazia antes de qualquer
   número. Ele passa a ser uma faixa compacta, depois dos números,
   porque é contexto de leitura, não indicador.
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

  /* ---------- estado da página ---------- */
  var _perf = null;      // último cálculo de mercado
  var _mercadoErro = null;
  var _precoFonte = {};
  var _semPreco = [];    // símbolos que nenhuma fonte reconheceu
  var _vencidos = [];    // preço manual mais velho que a validade
  var charts = {};

  function esc(t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function num(el) {
    if (!el) return 0;
    var v = parseFloat(String(el.value).replace(",", "."));
    return isFinite(v) && v >= 0 ? v : 0;
  }
  /* Percentuais passam por U.pct: o painel de Mercado montava o texto
     na mão com toFixed(2) e imprimia "0.00%" com PONTO decimal, ao lado
     de "+5,7%" com vírgula vindo do formatador — dois idiomas de número
     na mesma tela. */
  function pctTxt(v) {
    if (v == null || !isFinite(v)) return "—";
    return U.pct(v, true, 2);
  }
  function cls(v) { return v > 0 ? "up" : v < 0 ? "down" : ""; }

  /* ------------------------------------------------------------
     O SELO DESTA PÁGINA É O MESMO DO CARD

     Aqui existiam DOIS veredictos convivendo: o cabeçalho mostrava
     U.statusDot(p.status) — o campo gravado, escolhido no wizard — e
     o painel de Mercado, dez centímetros abaixo, mostrava "na faixa"
     calculado do preço. A mesma tela podia dizer as duas coisas ao
     mesmo tempo, e dizia.

     Agora tudo passa por DeFiStore.statusDe(), que é o que o card, a
     lista, o KPI e o alerta do Dashboard também usam.
     ------------------------------------------------------------ */
  function statusAtual() {
    var st = S.statusDe && S.statusDe(p);
    return st || { status: "naoavaliada", dentro: null, posFaixa: null,
                   faltando: [], motivo: "", temFaixa: false };
  }

  /* ============================================================
     CABEÇALHO
     ============================================================ */
  function heroHtml() {
    var r = S.poolSummary(p.id);
    var dias = r ? r.dias : (U.daysBetween(p.openedAt) || 0);

    return '' +
      '<a class="nav-back" href="pools.html" style="margin-bottom:18px;display:inline-flex">' + U.icon("back") + '<span>Pools</span></a>' +

      '<div class="pool-hero">' +
        '<div class="ph-left">' +
          '<div class="pair-icons" style="transform:scale(1.25);transform-origin:left">' + U.coin(p.base) + U.coin(p.quote) + '</div>' +
          '<div>' +
            '<div class="ph-title">' + esc(p.base) + ' / ' + esc(p.quote) + '</div>' +
            /* O selo tem hospedeiro próprio porque agora ele MUDA: o
               veredito da faixa depende da cotação, que chega depois do
               primeiro desenho, e volta a mudar quando o usuário informa
               um preço na mão. O cabeçalho era pintado uma vez só. */
            '<div class="row" style="gap:10px;margin-top:2px">' +
              '<span id="poolStatus">' + U.statusDot(statusAtual().status, "pool") + '</span>' +
              '<span class="dot-sep">·</span><span class="muted" style="font-size:13px">' + dias + ' dia(s) em operação</span></div>' +
            '<div class="ph-tags">' +
              '<span class="tag tag-chain"><span class="dot" style="background:' + S.colorOf("chain", p.chain) + '"></span>' + esc(p.chain) + '</span>' +
              '<span class="tag tag-proto">' + esc(p.protocol) + '</span>' +
              '<span class="tag tag-cat">' + esc(p.category) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ph-actions">' +
          '<button class="btn btn-secondary" id="btnEdit">' + U.icon("edit") + 'Editar</button>' +
          '<button class="btn btn-danger" id="btnClose">Fechar posição</button>' +
        '</div>' +
      '</div>' +

      '<div class="pool-summary" id="poolMini">' + miniHtml() + '</div>';
  }

  /* Os quatro números do topo saem TODOS de poolSummary. Antes vinham
     de campos gravados na pool (p.capital, p.currentValue, p.profit) —
     três valores escritos por rotinas diferentes, que passaram a
     divergir assim que existiram aporte e reinvestimento. */
  /* ------------------------------------------------------------
     OS QUATRO NÚMEROS, SEPARADOS — a regra central da Fase 4

     O card "Valor atual" mostrava r.valorTotal, que é mercado MAIS
     taxa pendente. Numa pool de US$ 50 que valorizou para 52 e gerou
     3 de taxa, ele exibia US$ 55 — exatamente o número que o briefing
     proíbe, porque lido de relance ele diz "a posição valorizou de 50
     para 55". A legenda embaixo ("inclui US$ 3 de taxa") não desfaz
     isso: o olho lê o número grande.

     Valorização de ativo e receita de taxa são coisas de naturezas
     diferentes. Numa pool dá para ganhar taxa e perder em ativo ao
     mesmo tempo — somar as duas num número só esconde o impermanent
     loss, que é justamente o risco que se está correndo.

       Capital colocado        o que saiu do bolso
       Valor da posição        só os ativos dentro da pool (mercado)
       Valorização             variação desses ativos
       Taxas geradas           receita da pool, com o que sobra livre
     ------------------------------------------------------------ */
  function miniHtml() {
    var r = S.poolSummary(p.id);
    if (!r) return "";
    return miniCard("Capital colocado", U.money(r.aportado),
                    r.reinvestido ? "+" + U.money(r.reinvestido) + " de taxa reinvestida" : "do seu bolso") +
           miniCard("Valor da posição", U.money(r.valorPosicao),
                    "só os ativos, sem taxa") +
           miniCard("Valorização",
                    '<span class="delta ' + cls(r.varAtivos) + '">' + U.signedMoney(r.varAtivos) + '</span>',
                    U.pct(r.varAtivosPct, true) + " sobre a base") +
           miniCard("Taxas geradas",
                    '<span class="delta up">' + U.signedMoney(r.taxasGeradas) + '</span>',
                    r.taxasDisponiveis > 0
                      ? U.money(r.taxasDisponiveis) + " disponível"
                      : (r.taxasPendentes > 0 ? U.money(r.taxasPendentes) + " ainda na pool" : "tudo destinado"));
  }
  function miniCard(k, v, sub) {
    return '<div class="mini-stat"><div class="k">' + k + '</div><div class="v">' + v + '</div>' +
      (sub ? '<div class="muted" style="font-size:11px;margin-top:2px">' + sub + '</div>' : '') + '</div>';
  }
  function tab(id, label, active) {
    return '<button class="tab' + (active ? " active" : "") + '" data-t="' + id + '">' + label + '</button>';
  }

  /* ============================================================
     RESUMO — a ordem do briefing
     ============================================================ */
  function resumoPanel() {
    return '<div class="col-2">' +
             performancePoolPanel() +
             mercadoPanel() +
           '</div>' +
           objetivoPanel() +
           acompanhamentoPanel() +
           fluxosPanel() +
           taxasPanel() +
           rangePanel();
  }

  function row(k, v) {
    return '<div class="mov-item"><div class="mov-main"><div class="t">' + k + '</div></div><div class="mov-amt">' + v + '</div></div>';
  }

  /* ------------------------------------------------------------
     ESQUERDA — PERFORMANCE DA POOL

     Estava só na aba "Performance", que quase ninguém abria: o
     Resumo mostrava taxas e mercado, mas não mostrava a própria
     evolução da posição. Agora ela abre a tela, e a aba continua
     existindo com o gráfico grande.
     ------------------------------------------------------------ */
  function performancePoolPanel() {
    var r = S.poolSummary(p.id);
    var c = cls(r.resultado), ca = cls(r.varAtivos);
    var serie = (p.history || []);

    return '<div class="panel panel-pad">' +
      '<div class="panel-head"><div>' +
        '<div class="eyebrow">Posição</div><h3>Performance da pool</h3>' +
      '</div><span class="muted" style="font-size:11.5px">' + r.dias + ' dia(s)</span></div>' +

      '<div class="cmp">' +
        '<div class="cmp-side"><span class="k">Resultado</span>' +
          '<b class="delta ' + c + '">' + U.signedMoney(r.resultado) + '</b>' +
          '<small>' + U.pct(r.resultadoPct, true) + ' sobre o capital colocado</small></div>' +
        '<div class="cmp-arrow">·</div>' +
        '<div class="cmp-side"><span class="k">Valor da posição</span>' +
          '<b>' + U.money(r.valorTotal) + '</b>' +
          '<small>base ' + U.money(r.baseInvestida) + '</small></div>' +
      '</div>' +

      (serie.length > 1
        ? '<div class="chart-box h-sm" style="margin-top:12px"><canvas id="chartResumo"></canvas></div>'
        : '<div class="hint" style="margin-top:12px">A curva da posição aparece a partir do segundo dia medido. ' +
          'O ATLAS registra um ponto por dia em que você abre a posição.</div>') +

      '<div class="mov-list" style="margin-top:12px">' +
        row("Taxas geradas", '<span class="delta up">' + U.signedMoney(r.taxasTotal) + '</span>') +
        row("Variação dos ativos", '<span class="delta ' + ca + '">' + U.signedMoney(r.varAtivos) + '</span>') +
        row("APR realizado", '<b>' + U.pct(r.aprReal) + '</b> <span class="muted" style="font-size:11px">a.a.</span>') +
      '</div>' +
    '</div>';
  }

  /* ------------------------------------------------------------
     DIREITA — MERCADO / PERFORMANCE DOS ATIVOS

     Os dois modos (benchmark HODL x composição real) estão
     explicados em defi/js/performance.js. A tela sempre diz qual
     está em uso: chamar benchmark de "valor da posição" seria
     mentira confortável.
     ------------------------------------------------------------ */
  function mercadoPanel() {
    if (!window.DeFiPerf) return "";
    var r = _perf;

    if (!r) {
      var corpo = _mercadoErro
        ? '<div class="hint">⚠ ' + esc(_mercadoErro) + ' Os preços de entrada seguem registrados; ' +
          'você pode informar o valor atual na mão em <b>Editar</b>.</div>'
        : '<div class="hint">Buscando preço de ' + esc(p.base) + ' e ' + esc(p.quote) + '…</div>';
      return '<div class="panel panel-pad" id="mercadoPanel">' +
        '<div class="panel-head"><div><div class="eyebrow">Mercado</div>' +
        '<h3>Performance dos ativos</h3></div></div>' + corpo + '</div>';
    }

    var st = statusAtual();
    var selo = "";
    if (st.dentro !== null) {
      selo = st.dentro
        ? '<span class="tag" style="background:rgba(0,200,83,.14);color:#00c853">na faixa</span>'
        : '<span class="tag" style="background:rgba(255,86,86,.14);color:#ff7676">fora da faixa</span>';
    }

    var avisos = "";
    if (!r.precoOk) {
      avisos += '<div class="hint" style="margin-top:9px">⚠ Sem preço de <b>' +
        esc(r.faltando.join(" e ")) + '</b> — usei o preço de entrada para esse lado, então o ' +
        'resultado deste painel está incompleto e a faixa fica sem veredito. ' +
        (_mercadoErro ? esc(_mercadoErro) + ' ' : '') +
        'Informe o preço na mão em <b>Editar</b> — é a regra do ATLAS quando nenhuma ' +
        'fonte reconhece o ativo.</div>';
    }
    /* Preço informado por você, e velho. Continua valendo (é o único
       que existe), mas o painel diz a idade em vez de exibir o número
       com cara de cotação de agora. */
    if (_vencidos && _vencidos.length) {
      avisos += '<div class="hint" style="margin-top:9px">⚠ Preço de <b>' +
        esc(_vencidos.join(" e ")) + '</b> foi informado por você há mais de ' +
        (window.AtlasPrecos ? AtlasPrecos.VALIDADE_DIAS : 7) +
        ' dias. Os números deste painel usam esse preço.</div>';
    }
    if (r.composicaoParcial) {
      avisos += '<div class="hint" style="margin-top:9px">⚠ Você informou a quantidade atual de um lado só. ' +
        'Se a posição realmente ficou com um token só, está certo; se foi esquecimento, ' +
        'o valor abaixo está pela metade.</div>';
    }

    /* ------------------------------------------------------------
       QUANDO OS DOIS PAINÉIS MEDEM CONTRA BASES DIFERENTES

       "Custo de entrada" aqui é quantidade × preço de entrada. A
       "base" do painel da esquerda é o fluxo de capital (abertura +
       aportes + reinvestimentos − retiradas).

       Enquanto a pool não recebe nada, os dois são o mesmo número. Ao
       registrar um aporte de US$ 5, porém, a base sobe e as
       quantidades NÃO — porque o ATLAS não tem como saber quantos SOL
       e quantos RAY aquele aporte comprou. A partir daí os dois
       painéis mostram percentuais diferentes para a mesma posição, e
       ambos estão certos dentro da própria régua.

       Em vez de esconder, a tela aponta a divergência e diz o que
       fazer: atualizar as quantidades em Editar reconcilia as duas.
       ------------------------------------------------------------ */
    var resumo = S.poolSummary(p.id);
    var difBase = Math.abs(resumo.baseInvestida - r.custo);
    if (resumo.baseInvestida > 0 && difBase / resumo.baseInvestida > 0.02) {
      avisos += '<div class="hint" style="margin-top:9px">⚠ Este painel mede contra o <b>custo de entrada</b> (' +
        U.money(r.custo) + '), calculado das quantidades registradas. O painel da esquerda mede contra a ' +
        '<b>base da posição</b> (' + U.money(resumo.baseInvestida) + '), que inclui aportes e reinvestimentos. ' +
        'A diferença de ' + U.money(difBase) + ' existe porque as quantidades de ' + esc(p.base) + ' e ' +
        esc(p.quote) + ' não foram atualizadas depois do aporte — corrija em <b>Editar</b> para os dois baterem.</div>';
    }

    var linhaModo = r.modo === "real"
      ? '<div class="hint" style="margin-top:9px">Composição atual informada: o valor abaixo é o real da posição. ' +
        'A diferença contra o benchmark HODL é o impermanent loss.</div>'
      : '<div class="hint" style="margin-top:9px">Sem composição atual: o valor abaixo é um <b>benchmark HODL</b> ' +
        '(mesma quantidade da entrada, preço de hoje). Numa pool concentrada as quantidades mudam sozinhas — ' +
        'informe as atuais em <b>Editar</b> para ver o valor real e o impermanent loss.</div>';

    return '<div class="panel panel-pad" id="mercadoPanel">' +
      '<div class="panel-head"><div>' +
        '<div class="eyebrow">Mercado</div><h3>Performance dos ativos</h3>' +
      '</div>' + selo + '</div>' +

      '<div class="cmp">' +
        '<div class="cmp-side"><span class="k">Custo de entrada</span>' +
          '<b>' + U.money(r.custo) + '</b>' +
          '<small>' + (r.precoEntradaBase ? U.money(r.precoEntradaBase) + " / " + esc(p.base) : "—") + '</small></div>' +
        '<div class="cmp-arrow">→</div>' +
        '<div class="cmp-side"><span class="k">' +
          (r.modo === "real" ? "Valor real" : "Benchmark HODL") + '</span>' +
          '<b class="delta ' + cls(r.pnlMercado) + '">' + U.money(r.valorAtual) + '</b>' +
          '<small>' + (r.precoAtualBase ? U.money(r.precoAtualBase) + " / " + esc(p.base) : "—") + '</small></div>' +
      '</div>' +

      '<div class="mov-list" style="margin-top:12px">' +
        row(esc(p.base) + " desde a entrada",
            '<span class="delta ' + cls(r.varBase) + '">' + pctTxt(r.varBase) + '</span>') +
        row(esc(p.quote) + " desde a entrada",
            '<span class="delta ' + cls(r.varQuote) + '">' + pctTxt(r.varQuote) + '</span>') +
        row("<b>PnL de mercado</b> <span class=\"muted\" style=\"font-size:11px\">sem taxas</span>",
            '<span class="delta ' + cls(r.pnlMercado) + '">' + U.signedMoney(r.pnlMercado) + ' · ' + pctTxt(r.pnlMercadoPct) + '</span>') +
        (r.il != null
          ? row("Impermanent loss",
                '<span class="delta ' + (r.il < 0 ? "down" : "up") + '">' + U.signedMoney(r.il) + ' · ' + pctTxt(r.ilPct) + '</span>')
          : "") +
        row("Taxas coletadas", '<span class="delta up">' + U.signedMoney(r.feesColetadas) + '</span>') +
        row("Taxas pendentes", '<span class="muted">' + U.money(r.feesPendentes) + '</span>') +
        /* Rótulo explícito: este é o número que bate com a corretora
           (mercado + taxa realizada), não o resultado econômico da
           posição — que está no painel da esquerda e inclui a taxa
           pendente. Dois números diferentes com o mesmo nome era a
           origem de metade da confusão desta tela. */
        row("<b>PnL como na corretora</b> <span class=\"muted\" style=\"font-size:11px\">mercado + coletadas</span>",
            '<b class="delta ' + cls(r.pnlTotal) + '">' + U.signedMoney(r.pnlTotal) + ' · ' + pctTxt(r.pnlTotalPct) + '</b>') +
      '</div>' +

      (r.razao != null
        ? '<div class="hint" style="margin-top:9px">Cotação da pool agora: <b>' +
          r.razao.toFixed(8) + '</b> ' + esc(p.base) + ' por ' + esc(p.quote) +
          (r.temFaixa ? ' · faixa ' + r.rangeLow + ' – ' + r.rangeHigh : ' · faixa não cadastrada') +
          '</div>'
        : "") +

      linhaModo + avisos + fontePrecoHtml();
  }

  /* De onde veio cada preço, e de quando. Sem isto, "US$ 142,50" é um
     número sem procedência — e a auditoria pediu exatamente que toda
     métrica saiba responder de onde veio. */
  function fontePrecoHtml() {
    var partes = [];
    [p.base, p.quote].forEach(function (s) {
      var f = _precoFonte[String(s || "").toUpperCase()];
      var nome = f === "stable" ? "stablecoin (US$ 1 por definição)"
               : f === "registro" ? "CoinGecko (id do registro)"
               : f === "busca" ? "CoinGecko (busca por símbolo — confira o id)"
               : "sem preço";
      partes.push("<b>" + esc(s) + "</b>: " + nome);
    });
    var quando = p.precoEm ? " · lido em " + new Date(p.precoEm).toLocaleString("pt-BR") : "";
    return '<div class="hint" style="margin-top:9px">Fonte do preço — ' + partes.join(" · ") + quando +
      (p.precoFonte === "manual" ? ' · <b>valor da posição informado manualmente</b>' : '') + '</div>' +
      '</div>';
  }

  /* ------------------------------------------------------------
     OBJETIVO — faixa compacta, não meio painel vazio
     ------------------------------------------------------------ */
  function objetivoPanel() {
    var rotulos = (p.objectiveLabels || []);
    var chips = rotulos.length
      ? rotulos.map(function (o) { return '<span class="tag tag-cat">' + esc(o) + '</span>'; }).join("")
      : "";
    var texto = p.goal || "";
    /* Quando não há texto próprio, o wizard grava os rótulos marcados
       como "goal". Mostrar os dois é imprimir a mesma frase duas vezes,
       uma em prosa e outra em etiqueta. */
    if (rotulos.length && texto === rotulos.join(" · ")) texto = "";

    return '<div class="panel panel-pad" style="margin-top:18px;padding-top:14px;padding-bottom:14px">' +
      '<div class="row" style="gap:12px;align-items:flex-start;flex-wrap:wrap">' +
        '<div class="eyebrow" style="min-width:70px;padding-top:2px">Objetivo</div>' +
        '<div style="flex:1;min-width:220px">' +
          (texto ? '<div style="font-size:13.5px;line-height:1.5">' + esc(texto) + '</div>' : '') +
          (chips ? '<div class="ph-tags"' + (texto ? ' style="margin-top:7px"' : '') + '>' + chips + '</div>' : '') +
          (!texto && !chips ? '<div class="muted" style="font-size:13px">Sem objetivo definido ainda.</div>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ------------------------------------------------------------
     DE ONDE VEIO O RESULTADO

     A pergunta que importa numa pool não é "quanto rendeu", é
     "rendeu por taxa ou por preço?". Ganhar 4% de taxa e perder
     3% em ativo dá +1% — e é uma posição muito diferente de +1%
     puro de valorização. Por isso as duas linhas vêm separadas.
     ------------------------------------------------------------ */
  function acompanhamentoPanel() {
    var r = S.poolSummary(p.id);
    if (!r) return "";

    var clsRes = cls(r.resultado), clsAtv = cls(r.varAtivos);

    return '<div class="panel panel-pad" style="margin-top:18px">' +
      '<div class="panel-head"><div>' +
        '<div class="eyebrow">Acompanhamento</div><h3>De onde veio o resultado</h3>' +
      '</div><span class="muted" style="font-size:11.5px">' +
        (r.criadaEm ? "criada " + U.date(r.criadaEm) : "") +
        (r.atualizadaEm ? " · atualizada " + U.date(r.atualizadaEm) : "") +
      '</span></div>' +

      '<div class="cmp">' +
        '<div class="cmp-side"><span class="k">Você colocou</span>' +
          '<b>' + U.money(r.aportado) + '</b>' +
          '<small>' + (r.criadaEm ? U.date(r.criadaEm) : "—") +
            (r.retirado ? " · " + U.money(r.retirado) + " retirado" : "") + '</small></div>' +
        '<div class="cmp-arrow">→</div>' +
        '<div class="cmp-side"><span class="k">Vale hoje</span>' +
          '<b class="delta ' + clsRes + '">' + U.money(r.valorTotal) + '</b>' +
          '<small>' + U.pct(r.resultadoPct, true) + ' em ' + r.dias + ' dia(s)</small></div>' +
      '</div>' +

      '<div class="mov-list" style="margin-top:12px">' +
        row('<span class="src src-a"></span> Variação dos ativos',
            '<span class="delta ' + clsAtv + '">' + U.signedMoney(r.varAtivos) + '</span>') +
        row('<span class="src src-t"></span> Taxas geradas',
            '<span class="delta up">' + U.signedMoney(r.taxasTotal) + '</span>') +
        row('<b>Resultado</b>',
            '<b class="delta ' + clsRes + '">' + U.signedMoney(r.resultado) + '</b>') +
      '</div>' +

      /* A conta aberta, para o número não precisar de fé. */
      '<div class="hint" style="margin-top:9px">' +
        U.money(r.valorPosicao) + ' (posição) + ' + U.money(r.taxasPendentes) + ' (taxa pendente) + ' +
        U.money(r.taxasColetadas) + ' (taxa coletada)' +
        (r.reinvestido ? ' − ' + U.money(r.reinvestido) + ' (reinvestido, já dentro da posição)' : '') +
        (r.retirado ? ' + ' + U.money(r.retirado) + ' (retirado)' : '') +
        ' − ' + U.money(r.aportado) + ' (capital colocado) = <b>' + U.signedMoney(r.resultado) + '</b>' +
      '</div>' +

      (r.taxasTotal === 0 && r.varAtivos !== 0
        ? '<div class="hint" style="margin-top:9px">Nenhuma taxa registrada ainda — todo o resultado está sendo atribuído aos ativos. Registre as coletas abaixo para separar as duas coisas.</div>'
        : "") +
    '</div>';
  }

  /* ============================================================
     FLUXOS DE CAPITAL — aporte, reinvestimento, retirada

     Sem este registro, "o capital era 50 e virou 55" é ambíguo:
     pode ser lucro de 10% ou cinco dólares novos do bolso. São
     coisas opostas, e o sistema não tinha como distinguir.
     ============================================================ */
  var TIPO_EVENTO = {
    abertura: { label: "Abertura", desc: "capital inicial", sinal: "+" },
    aporte:   { label: "Aporte",   desc: "dinheiro novo",   sinal: "+" },
    reinvest: { label: "Reinvestimento", desc: "taxa devolvida à posição", sinal: "↻" },
    retirada: { label: "Retirada", desc: "saque de principal", sinal: "−" }
  };

  function fluxosPanel() {
    var r = S.poolSummary(p.id);
    var evs = S.events(p.id).slice().reverse();   // mais recente primeiro
    var maxReinvest = Math.max(0, r.taxasColetadas - r.reinvestido);

    var linhas = evs.map(function (e) {
      var meta = TIPO_EVENTO[e.type] || { label: e.type, desc: "", sinal: "" };
      var cor = e.type === "retirada" ? "down" : e.type === "reinvest" ? "" : "up";
      return '<div class="fee-item" data-ev="' + esc(e.id) + '">' +
        '<span class="fee-date">' + U.date(e.date) + '</span>' +
        '<span class="fee-amt">' + meta.sinal + U.money(e.amountUSD) + '</span>' +
        '<span class="fee-tag">' + meta.label + '</span>' +
        '<span class="muted" style="font-size:11px;flex:1">' + esc(e.note || meta.desc) + '</span>' +
        (e.type === "abertura"
          ? '<span class="fee-act-sp"></span>'
          : '<button class="fee-del" data-act="delev" data-ev="' + esc(e.id) + '" title="Remover evento">×</button>') +
      '</div>';
    }).join("");

    return '<div class="panel panel-pad" style="margin-top:18px">' +
      '<div class="panel-head"><div>' +
        '<div class="eyebrow">Registro</div><h3>Capital e reinvestimentos</h3></div>' +
        '<span class="muted" style="font-size:11.5px">' +
          U.money(r.aportado) + ' colocado · ' + U.money(r.reinvestido) + ' reinvestido' +
          (r.retirado ? ' · ' + U.money(r.retirado) + ' retirado' : '') +
        '</span>' +
      '</div>' +

      '<div class="fee-form" style="grid-template-columns:auto 1fr 1fr auto">' +
        '<input class="input" id="evDate" type="date" value="' + U.hoje() + '" />' +
        '<select class="select" id="evTipo">' +
          '<option value="aporte">Aporte — dinheiro novo</option>' +
          '<option value="reinvest">Reinvestimento — taxa de volta à pool</option>' +
          '<option value="retirada">Retirada — saque de principal</option>' +
        '</select>' +
        '<div class="input-money"><span>US$</span><input class="input" id="evAmt" type="number" step="any" min="0" placeholder="0,00" /></div>' +
        '<button class="btn btn-primary" id="evAdd">Registrar</button>' +
      '</div>' +
      '<div class="field" style="margin-bottom:0"><input class="input" id="evNote" placeholder="Observação (opcional)" /></div>' +

      /* O reinvestimento sai de um dinheiro que EXISTE: a taxa já
         coletada. Deixar reinvestir mais do que foi coletado criaria
         capital do nada — e o resultado passaria a mentir para menos. */
      '<div class="hint" style="margin-top:8px">Disponível para reinvestir: <b>' + U.money(maxReinvest) + '</b> ' +
        '(taxa coletada que ainda não voltou para a pool). Reinvestir <b>não</b> é aporte: ' +
        'o dinheiro já era seu, então ele aumenta a base da posição sem aumentar o capital colocado.</div>' +

      '<div class="fee-list">' + (linhas || '<div class="fee-empty">Nenhum evento além da abertura.</div>') + '</div>' +
    '</div>';
  }

  /* ============================================================
     TAXAS — histórico editável
     ============================================================ */
  function taxasPanel() {
    var r = S.poolSummary(p.id);
    var fees = (p.fees || []);

    var linhas = fees.length ? fees.map(function (f) {
      return '<div class="fee-item' + (f.status === "pendente" ? " is-pend" : "") + '" data-fee="' + esc(f.id) + '">' +
        '<span class="fee-date">' + U.date(f.date) + '</span>' +
        '<span class="fee-amt">' + U.money(f.amount) + '</span>' +
        '<span class="fee-tag">' + (f.status === "pendente" ? "pendente" : "coletada") + '</span>' +
        (f.status === "pendente"
          ? '<button class="fee-act" data-act="collect" data-fee="' + esc(f.id) + '" title="Marcar como recebida">recebi</button>'
          : '<span class="fee-act-sp"></span>') +
        '<button class="fee-del" data-act="del" data-fee="' + esc(f.id) + '" title="Remover">×</button>' +
      '</div>';
    }).join("") : '<div class="fee-empty">Nenhuma taxa registrada.</div>';

    return '<div class="panel panel-pad" style="margin-top:18px">' +
      '<div class="panel-head"><div>' +
        '<div class="eyebrow">Registro</div><h3>Taxas</h3></div>' +
        '<span class="muted" style="font-size:11.5px">' +
          U.money(r.taxasColetadas) + ' recebidas · ' + U.money(r.taxasPendentes) + ' pendentes' +
        '</span>' +
      '</div>' +

      '<div class="fee-form">' +
        '<input class="input" id="feeDate" type="date" value="' + U.hoje() + '" />' +
        '<div class="input-money"><span>US$</span><input class="input" id="feeAmt" type="number" step="any" min="0" placeholder="0,00" /></div>' +
        '<select class="select" id="feeStatus">' +
          '<option value="pendente">Ainda na pool</option>' +
          '<option value="coletada">Já recebi</option>' +
        '</select>' +
        '<button class="btn btn-primary" id="feeAdd">Registrar</button>' +
      '</div>' +

      '<div class="hint" style="margin-top:8px">Taxa <b>pendente</b> está acumulada dentro da pool e entra no ' +
        '"valor atual". Taxa <b>coletada</b> já saiu para a sua carteira. As duas contam como resultado; ' +
        'só uma delas continua exposta ao preço.</div>' +

      '<div class="fee-list">' + linhas + '</div>' +
    '</div>';
  }

  /* ---------- Faixa de preço ----------
     A barra caía em p.rangePos quando não havia cálculo — e p.rangePos
     era gravado pelo wizard como 1 (topo) ou 0,5 (meio), conforme o
     botão que o usuário apertou. Uma barra desenhada a partir de um
     palpite, com aparência de medição. Sem veredito, agora não há
     barra: há o motivo de não haver. */
  function rangePanel() {
    if (!(p.rangeLow > 0 && p.rangeHigh > 0)) return "";
    var st = statusAtual();
    var denom = (p.rangeDenom === "quote_por_base")
      ? esc(p.quote) + " por " + esc(p.base)
      : esc(p.base) + " por " + esc(p.quote);

    var corpo;
    if (st.dentro === null) {
      corpo = '<div class="hint">' + esc(st.motivo) + '</div>';
    } else {
      var largura = Math.max(4, Math.min(96, (st.posFaixa != null ? st.posFaixa : 0.5) * 100));
      corpo =
        '<div class="spread" style="font-family:var(--font-mono);font-size:13px;color:var(--text-mut)">' +
          '<span>' + p.rangeLow + '</span><span>' + p.rangeHigh + '</span></div>' +
        '<div class="range-bar' + (st.dentro ? "" : " out") + '" style="height:8px;margin-top:8px">' +
          '<i style="left:0;width:' + largura + '%"></i></div>' +
        '<div class="hint" style="margin-top:8px">Faixa em <b>' + denom + '</b>' +
          (st.razao != null ? ' · cotação agora: <b>' + st.razao.toFixed(8) + '</b>' : '') + '</div>';
    }

    return '<div class="panel panel-pad" style="margin-top:18px">' +
      '<div class="panel-head"><h3>Faixa de preço</h3>' +
        U.statusChip(st.status, "pool") + '</div>' +
      corpo +
    '</div>';
  }

  /* ============================================================
     MERCADO — busca de preço
     ============================================================ */
  function carregarMercado() {
    if (!window.DeFiPerf || !window.DeFiTokens) return;
    var r = S.poolSummary(p.id) || {};

    DeFiTokens.precosDetalhado([p.base, p.quote]).then(function (d) {
      _precoFonte = d.fonte || {};
      _mercadoErro = d.erro ? d.erro.message : null;
      _semPreco = d.faltando || [];
      _vencidos = d.vencidos || [];

      /* O store passa a conhecer a cotação: é dela que sai o selo da
         faixa, aqui e no card da lista — a mesma função, o mesmo
         número. */
      S.setPrecos(d.valores, d.fonte);

      _perf = DeFiPerf.calcular({
        base: p.base, quote: p.quote,
        qtyBase: p.qtyBase, qtyQuote: p.qtyQuote,
        priceBase: p.priceBase, priceQuote: p.priceQuote,
        qtyBaseNow: p.qtyBaseNow, qtyQuoteNow: p.qtyQuoteNow,
        feesColetadas: r.taxasColetadas, feesPendentes: r.taxasPendentes,
        reinvestido: r.reinvestido,
        rangeLow: p.rangeLow, rangeHigh: p.rangeHigh,
        rangeDenom: p.rangeDenom || "base_por_quote"
      }, S.precos([p.base, p.quote]));

      /* Grava o valor de mercado — e SÓ ele. O resultado é recalculado
         por DeFiStore.poolSummary a partir dos fluxos.

         Só grava com o preço dos DOIS lados: meio preço produz um
         valor menor que o real, e um patrimônio que encolhe sozinho
         assusta mais do que um campo vazio.

         A PRIORIDADE DO MANUAL MUDOU DE LUGAR

         Antes a proteção era aqui: `p.precoFonte !== "manual"` impedia
         a API de sobrescrever um valor TOTAL digitado no modal. Com o
         preço manual por ATIVO (core/atlas-precos.js), quem tem
         prioridade é o preço, não o total — e a proteção vive lá, na
         cadeia de resolução. Aqui o valor volta a ser o que sempre
         deveria ter sido: quantidade × preço, seja o preço de onde
         for. O campo precoFonte agora só REGISTRA a origem dominante. */
      if (_perf && _perf.precoOk) {
        var fB = _precoFonte[String(p.base).toUpperCase()];
        var fQ = _precoFonte[String(p.quote).toUpperCase()];
        S.updatePool(p.id, {
          currentValue: Math.round(_perf.valorAtual * 100) / 100,
          precoFonte: (fB === "manual" || fQ === "manual") ? "manual" : "api",
          precoEm: new Date().toISOString(),
          updatedAt: U.hoje()
        });
        p = S.pool(p.id) || p;
      }
      rerender();
    }).catch(function (e) {
      _perf = null;
      _mercadoErro = (e && e.message) || "Não consegui buscar os preços agora.";
      rerender();
    });
  }

  /* ============================================================
     EDITAR POSIÇÃO — estado atual, não um campo solto

     O modal antigo pedia três coisas: "valor atual", APR e status.
     Quem abria não tinha como saber o que o sistema já sabia — nem
     quantidade, nem preço, nem taxa, nem de onde o número tinha
     vindo. Digitar um valor ali sobrescrevia o cálculo do motor de
     mercado sem dizer que estava sobrescrevendo.

     Agora o modal MOSTRA o estado conhecido (com a fonte de cada
     dado) e permite corrigir cada peça. Automação primeiro,
     correção manual como saída — nessa ordem.
     ============================================================ */
  function abrirEdicao() {
    var r = S.poolSummary(p.id);
    var host = U.qs("#editBody");
    if (!host) return;

    var pb = S.precoDe(p.base), pq = S.precoDe(p.quote);
    var fonteB = _precoFonte[String(p.base).toUpperCase()];
    var fonteQ = _precoFonte[String(p.quote).toUpperCase()];
    function fonteTxt(f) {
      return window.AtlasPrecos ? AtlasPrecos.fonteLabel(f) : (f || "sem preço");
    }
    /* preço manual já gravado para cada lado (se houver) */
    function manual(sim) {
      return window.AtlasPrecos ? AtlasPrecos.manual(sim) : null;
    }
    var manB = manual(p.base), manQ = manual(p.quote);

    /* " — hoje ≈ 73.57". Mesma conta de DeFiPerf.faixa: a razão da
       denominação "X por Y" é preço(Y) / preço(X). */
    function razaoTxt(numerador, denominador) {
      if (!(numerador > 0 && denominador > 0)) return "";
      var v = numerador / denominador;
      return " — hoje ≈ " + (v >= 1 ? v.toFixed(2) : v.toFixed(8));
    }

    /* Campo de preço manual de um lado. Vem VAZIO quando não há
       manual gravado — com o preço da API só de placeholder. Assim
       abrir o modal e salvar não transforma a cotação da API em
       "informado por você" sem o usuário ter digitado nada. */
    function campoPreco(sim, id, man, precoApi, fonte) {
      var temApi = precoApi != null && !man;
      return '<div class="field"><label>Preço de ' + esc(sim) + ' (US$)</label>' +
        '<div class="input-money"><span>US$</span>' +
        '<input class="input" id="' + id + '" type="number" step="any" min="0" ' +
        'value="' + (man ? man.usd : "") + '" ' +
        'placeholder="' + (temApi ? precoApi : "informe o preço") + '" /></div>' +
        '<div class="hint">' +
          (man
            ? "Informado por você" + (man.em ? " em " + new Date(man.em).toLocaleDateString("pt-BR") : "") +
              (man.vencido ? " — <b>há mais de " + AtlasPrecos.VALIDADE_DIAS + " dias</b>" : "") +
              ". Apague o campo para voltar a usar a API."
            : (temApi
                ? "Vindo da API (" + esc(fonteTxt(fonte)) + "). Preencha só se estiver errado."
                : "<b>Nenhuma fonte reconheceu " + esc(sim) + ".</b> Sem este preço a posição não tem " +
                  "valor de mercado nem veredito de faixa.")) +
        '</div></div>';
    }

    host.innerHTML =
      '<div class="panel panel-pad" style="margin-bottom:14px">' +
        '<div class="panel-head"><div><div class="eyebrow">Estado conhecido</div>' +
        '<h3>' + U.money(r.valorTotal) + '</h3></div>' +
        '<span class="muted" style="font-size:11.5px">' +
          (p.precoFonte === "manual" ? "informado por você" : "calculado pela API") +
          (p.precoEm ? " · " + new Date(p.precoEm).toLocaleString("pt-BR") : "") +
        '</span></div>' +
        '<div class="mov-list">' +
          row(esc(p.base) + " — quantidade atual",
              '<b>' + (p.qtyBaseNow || p.qtyBase || 0) + '</b> <span class="muted" style="font-size:11px">' +
              (p.qtyBaseNow ? "informada" : "da entrada") + '</span>') +
          row(esc(p.quote) + " — quantidade atual",
              '<b>' + (p.qtyQuoteNow || p.qtyQuote || 0) + '</b> <span class="muted" style="font-size:11px">' +
              (p.qtyQuoteNow ? "informada" : "da entrada") + '</span>') +
          row("Preço atual " + esc(p.base),
              '<b>' + (pb ? U.money(pb) : "—") + '</b> <span class="muted" style="font-size:11px">' + fonteTxt(fonteB) + '</span>') +
          row("Preço atual " + esc(p.quote),
              '<b>' + (pq ? U.money(pq) : "—") + '</b> <span class="muted" style="font-size:11px">' + fonteTxt(fonteQ) + '</span>') +
          row("Taxas pendentes", '<b>' + U.money(r.taxasPendentes) + '</b>') +
          row("Taxas coletadas", '<b>' + U.money(r.taxasColetadas) + '</b>') +
          row("Capital colocado", '<b>' + U.money(r.aportado) + '</b>') +
          row("Base da posição", '<b>' + U.money(r.baseInvestida) + '</b> <span class="muted" style="font-size:11px">com reinvestimentos</span>') +
        '</div>' +
        '<div class="row" style="gap:8px;margin-top:12px">' +
          '<button class="btn btn-secondary btn-sm" id="eRefresh">' + U.icon("re") + 'Atualizar pela API</button>' +
          (_mercadoErro ? '<span class="muted" style="font-size:11.5px">⚠ ' + esc(_mercadoErro) + '</span>' : '') +
        '</div>' +
      '</div>' +

      '<div class="eyebrow" style="margin-bottom:8px">Composição atual (o que a corretora mostra hoje)</div>' +
      '<div class="col-2" style="gap:0 16px">' +
        '<div class="field"><label>' + esc(p.base) + ' agora</label>' +
          '<input class="input" id="eQtyBase" type="number" step="any" min="0" placeholder="' +
          (p.qtyBase || 0) + '" value="' + (p.qtyBaseNow || "") + '" /></div>' +
        '<div class="field"><label>' + esc(p.quote) + ' agora</label>' +
          '<input class="input" id="eQtyQuote" type="number" step="any" min="0" placeholder="' +
          (p.qtyQuote || 0) + '" value="' + (p.qtyQuoteNow || "") + '" /></div>' +
      '</div>' +

      '<div class="eyebrow" style="margin:6px 0 8px">Faixa de preço</div>' +
      '<div class="col-2" style="gap:0 16px">' +
        '<div class="field"><label>Mínima</label>' +
          '<input class="input" id="eRLow" type="number" step="any" min="0" value="' + (p.rangeLow || "") + '" /></div>' +
        '<div class="field"><label>Máxima</label>' +
          '<input class="input" id="eRHigh" type="number" step="any" min="0" value="' + (p.rangeHigh || "") + '" /></div>' +
      '</div>' +
      /* As duas denominações com a cotação de HOJE ao lado. Escolher a
         errada não produz erro visível: a faixa é gravada, a razão é
         calculada de cabeça para baixo, e a posição fica "fora do
         range" para sempre com todos os dados certos. Comparar com o
         número da corretora é o que desfaz a ambiguidade. */
      '<div class="field"><label>Denominação da faixa</label>' +
        '<select class="select" id="eRDenom">' +
          '<option value="base_por_quote"' + (p.rangeDenom !== "quote_por_base" ? " selected" : "") + '>' +
            esc(p.base) + ' por ' + esc(p.quote) + razaoTxt(pq, pb) + '</option>' +
          '<option value="quote_por_base"' + (p.rangeDenom === "quote_por_base" ? " selected" : "") + '>' +
            esc(p.quote) + ' por ' + esc(p.base) + razaoTxt(pb, pq) + '</option>' +
        '</select>' +
        '<div class="hint">Escolha a que bate com o número da sua corretora.</div></div>' +

      /* ------------------------------------------------------------
         PREÇO DOS ATIVOS — a regra do ATLAS, aplicada aqui

         O campo antigo era um só: "Valor da posição (sem taxas), US$".
         Um TOTAL digitado. Com ele o sistema não conseguia calcular
         nada — nem a variação de cada lado, nem a razão do par, que é
         o que decide dentro/fora da faixa. Uma pool sem cotação ficava
         eternamente sem veredito mesmo com o usuário sabendo o preço.

         Agora o que se informa é o PREÇO DE CADA ATIVO. Dele saem o
         valor da posição (quantidade × preço), a valorização em US$ e
         em %, e o selo da faixa. Valor volta a ser consequência.

         A API continua sendo o caminho principal: estes campos só
         precisam ser preenchidos quando nenhuma fonte reconhece o
         token — e, uma vez preenchidos, mandam até serem apagados.
         ------------------------------------------------------------ */
      '<div class="eyebrow" style="margin:6px 0 8px">Preço dos ativos</div>' +
      '<div class="col-2" style="gap:0 16px">' +
        campoPreco(p.base, "ePrBase", manB, pb, fonteB) +
        campoPreco(p.quote, "ePrQuote", manQ, pq, fonteQ) +
      '</div>' +

      '<div class="field"><label>APR declarado (%)</label>' +
        '<input class="input" id="eApr" type="number" step="any" value="' + (p.apr || "") + '" />' +
        '<div class="hint">É o APR da corretora. O APR realizado o ATLAS calcula das taxas.</div></div>';
      /* O <select> de Status saiu daqui. Dentro ou fora da faixa é
         conclusão do preço contra a faixa, não uma opção de menu —
         ver DeFiStore.statusDe(). */

    var bt = U.qs("#eRefresh");
    if (bt) bt.addEventListener("click", function () {
      S.updatePool(p.id, { precoFonte: "api" });
      p = S.pool(p.id) || p;
      U.toast("Buscando preços…", "info");
      carregarMercado();
      setTimeout(abrirEdicao, 900);
    });

    U.openModal("#modalEdit");
  }

  function salvarEdicao() {
    var lo = num(U.qs("#eRLow")), hi = num(U.qs("#eRHigh"));
    if (lo > 0 && hi > 0 && hi <= lo) {
      U.toast("A faixa máxima tem que ser maior que a mínima.", "warn");
      return;
    }

    var patch = {
      qtyBaseNow: num(U.qs("#eQtyBase")) || null,
      qtyQuoteNow: num(U.qs("#eQtyQuote")) || null,
      rangeLow: lo, rangeHigh: hi,
      rangeDenom: U.qs("#eRDenom").value,
      apr: num(U.qs("#eApr")),
      updatedAt: U.hoje()
    };

    /* ------------------------------------------------------------
       PREÇO MANUAL — campo vazio APAGA, campo preenchido MANDA

       O preço é do ativo, não da posição: fica no AtlasPrecos, e vale
       para qualquer pool que use o mesmo token (e, na Fase 3, para
       Hold, Trade e RWA). Apagar o campo devolve o token à API.
       ------------------------------------------------------------ */
    function aplicarPreco(sim, id) {
      if (!window.AtlasPrecos) return;
      var el = U.qs("#" + id);
      if (!el) return;
      var txt = String(el.value || "").trim();
      if (txt === "") { AtlasPrecos.limparManual(sim); return; }
      var v = parseFloat(txt.replace(",", "."));
      if (isFinite(v) && v > 0) AtlasPrecos.definirManual(sim, v);
    }
    aplicarPreco(p.base, "ePrBase");
    aplicarPreco(p.quote, "ePrQuote");

    S.updatePool(p.id, patch);
    p = S.pool(p.id) || p;
    U.closeModal("#modalEdit");
    U.toast("Posição atualizada.", "ok");
    carregarMercado();
    rerender();
  }

  /* ============================================================
     ABAS SECUNDÁRIAS
     ============================================================ */
  function diarioPanel() {
    return '<div class="panel panel-pad">' +
      '<div class="panel-head"><div><div class="eyebrow">Tese & anotações</div><h3>Diário da estratégia</h3></div></div>' +
      '<div class="diary-goal" style="margin-bottom:18px">' + esc(p.goal || "Sem objetivo definido ainda.") + '</div>' +
      '<div class="field"><textarea class="textarea" id="noteInput" placeholder="Adicionar anotação ao diário…"></textarea></div>' +
      '<div class="spread"><span class="hint faint">Suas anotações alimentarão o Oráculo futuramente.</span>' +
      '<button class="btn btn-primary btn-sm" id="addNote">' + U.icon("plus") + 'Adicionar</button></div>' +
      '<hr class="divider" />' +
      '<div id="notesList">' + notesHtml() + '</div>' +
      '</div>';
  }
  function notesHtml() {
    if (!p.notes || !p.notes.length) return '<p class="muted" style="font-size:13px">Nenhuma anotação ainda.</p>';
    return p.notes.map(function (n) {
      return '<div class="diary-note"><div class="meta">' + U.date(n.date) + '</div><div class="txt">' + esc(n.text) + '</div></div>';
    }).join("");
  }

  /* A Timeline passa a incluir os eventos de capital e as taxas — o
     objetivo dela é contar a história da posição, e metade da história
     acontecia em painéis que ela não lia. */
  function timelineHtml() {
    var itens = (p.timeline || []).map(function (e) {
      return { date: e.date, title: e.title, desc: e.desc, tipo: e.type };
    });

    S.events(p.id).forEach(function (e) {
      if (e.type === "abertura") return;      // já está na timeline como "Abertura"
      var meta = TIPO_EVENTO[e.type] || { label: e.type, desc: "" };
      itens.push({
        date: e.date, title: meta.label,
        desc: U.money(e.amountUSD) + " — " + (e.note || meta.desc),
        tipo: e.type === "retirada" ? "warn" : "violet"
      });
    });

    (p.fees || []).forEach(function (f) {
      itens.push({
        date: f.date, title: f.status === "coletada" ? "Taxa coletada" : "Taxa acumulada",
        desc: U.money(f.amount) + (f.note ? " — " + f.note : ""), tipo: ""
      });
    });

    if (!itens.length) return '<p class="muted" style="font-size:13px">Sem eventos registrados.</p>';
    itens.sort(function (a, b) { return String(a.date) < String(b.date) ? 1 : -1; });

    return '<div class="timeline">' + itens.map(function (e) {
      var c = e.tipo === "warn" ? "warn" : e.tipo === "violet" ? "violet" : e.tipo === "end" ? "end" : "";
      return '<div class="tl-item ' + c + '"><div class="tl-date">' + U.date(e.date) + '</div>' +
        '<div class="tl-title">' + esc(e.title) + '</div><div class="tl-desc">' + e.desc + '</div></div>';
    }).join("") + '</div>';
  }

  function histHtml() {
    var serie = p.history || [];
    if (serie.length < 2) {
      return '<div class="hint">A curva precisa de pelo menos dois dias medidos. ' +
        'Hoje há ' + serie.length + '. O ATLAS grava um ponto por dia em que a posição é aberta.</div>';
    }
    return '<div class="chart-box h-md" style="margin-bottom:8px"><canvas id="chartHist"></canvas></div>';
  }

  function movHtml() {
    /* As movimentações passam a sair dos EVENTOS de capital, que são a
       fonte real. p.movements era gravado uma vez na criação e nunca
       mais — a aba mostrava "Aporte inicial" para sempre, mesmo depois
       de três aportes. */
    var evs = S.events(p.id).slice().reverse();
    if (!evs.length) return '<p class="muted" style="font-size:13px">Nenhuma movimentação registrada.</p>';
    return '<div class="mov-list">' + evs.map(function (e) {
      var meta = TIPO_EVENTO[e.type] || { label: e.type };
      var saida = e.type === "retirada";
      var ic = saida ? "out" : e.type === "reinvest" ? "re" : "in";
      return '<div class="mov-item"><div class="mov-ic ' + ic + '">' + U.icon(ic) + '</div>' +
        '<div class="mov-main"><div class="t">' + meta.label + (e.note ? ' · ' + esc(e.note) : '') + '</div>' +
        '<div class="d">' + U.date(e.date) + '</div></div>' +
        '<div class="mov-amt delta ' + (saida ? "down" : e.type === "reinvest" ? "flat" : "up") + '">' +
        U.signedMoney(saida ? -e.amountUSD : e.amountUSD) + '</div></div>';
    }).join("") + '</div>';
  }

  /* ============================================================
     MONTAGEM
     ============================================================ */
  function montar() {
    root.innerHTML = heroHtml() +
      '<div class="tabs" id="tabs">' +
        tab("resumo", "Resumo", true) + tab("perf", "Performance") + tab("diario", "Diário") +
        tab("timeline", "Timeline") + tab("historico", "Histórico") + tab("mov", "Movimentações") +
      '</div>' +
      '<div class="tab-panel active" data-tab="resumo">' + resumoPanel() + '</div>' +
      '<div class="tab-panel" data-tab="perf">' +
        '<div class="panel panel-pad"><div class="panel-head"><h3>Performance da posição</h3>' +
        '<span class="muted" style="font-size:12px">Valor ao longo do tempo</span></div>' +
        (( p.history || []).length > 1
          ? '<div class="chart-box h-lg"><canvas id="chartPerf"></canvas></div>'
          : '<div class="hint">Ainda não há dois dias medidos para desenhar a curva.</div>') +
        '</div>' +
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

    ligarTabs();
    ligarHero();
    ligarResumo();
    desenharResumoChart();
  }

  /* Redesenha só a aba Resumo e o topo. Recarregar a página inteira
     perderia a aba aberta e a rolagem — e registrar taxa é uma ação
     que a pessoa repete várias vezes seguidas. */
  function rerender() {
    p = S.pool(p.id) || p;
    var host = U.qs('.tab-panel[data-tab="resumo"]');
    if (!host) { montar(); return; }
    host.innerHTML = resumoPanel();
    var mini = U.qs("#poolMini");
    if (mini) mini.innerHTML = miniHtml();
    var selo = U.qs("#poolStatus");
    if (selo) selo.innerHTML = U.statusDot(statusAtual().status, "pool");
    ligarResumo();
    desenharResumoChart();
  }

  function desenharResumoChart() {
    var cv = U.qs("#chartResumo");
    if (!cv || !window.Charts) return;
    if (charts.resumo) { charts.resumo.destroy(); charts.resumo = null; }
    charts.resumo = Charts.line(cv, (p.history || []).slice(-30),
      { color: "#00E28A", fill: "rgba(0,226,138,0.16)" });
  }

  function ligarTabs() {
    U.qsa("#tabs .tab").forEach(function (t) {
      t.addEventListener("click", function () {
        U.qsa("#tabs .tab").forEach(function (x) { x.classList.remove("active"); });
        U.qsa(".tab-panel").forEach(function (x) { x.classList.remove("active"); });
        t.classList.add("active");
        var key = t.dataset.t;
        var painel = U.qs('.tab-panel[data-tab="' + key + '"]');
        if (painel) painel.classList.add("active");
        if (key === "perf" && !charts.perf && U.qs("#chartPerf")) {
          charts.perf = Charts.line(U.qs("#chartPerf"), p.history, { color: "#8B5CF6", fill: "rgba(139,92,246,0.16)" });
        }
        if (key === "historico" && !charts.hist && U.qs("#chartHist")) {
          charts.hist = Charts.line(U.qs("#chartHist"), p.history, { color: "#5B9BFF", fill: "rgba(59,130,246,0.16)" });
        }
      });
    });

    var add = U.qs("#addNote");
    if (add) add.addEventListener("click", function () {
      var v = U.qs("#noteInput").value.trim();
      if (!v) { U.toast("Escreva algo para anotar.", "warn"); return; }
      S.addNote(p.id, v);
      p = S.pool(p.id);
      U.qs("#notesList").innerHTML = notesHtml();
      U.qs("#noteInput").value = "";
      U.toast("Anotação adicionada ao diário.", "ok");
    });
  }

  function ligarHero() {
    var be = U.qs("#btnEdit");
    if (be) be.addEventListener("click", abrirEdicao);
    var bc = U.qs("#btnClose");
    if (bc) bc.addEventListener("click", function () { U.openModal("#modalClose"); });
  }

  /* ---------- taxas + eventos, religados a cada render ---------- */
  function ligarResumo() {
    var addFee = U.qs("#feeAdd");
    if (addFee) addFee.addEventListener("click", function () {
      var v = parseFloat(String(U.qs("#feeAmt").value).replace(",", "."));
      if (!(v > 0)) { U.toast("Informe o valor da taxa.", "warn"); return; }
      var d = U.qs("#feeDate").value;
      if (d && d > U.hoje()) {
        U.toast("Taxa com data no futuro não existe ainda.", "warn"); return;
      }
      S.addFee(p.id, { date: d, amount: v, status: U.qs("#feeStatus").value });
      U.toast("Taxa registrada.", "ok");
      rerender();
    });

    U.qsa(".fee-act[data-act=collect]").forEach(function (b) {
      b.addEventListener("click", function () { S.collectFee(p.id, b.dataset.fee); rerender(); });
    });
    U.qsa(".fee-del[data-act=del]").forEach(function (b) {
      b.addEventListener("click", function () { S.removeFee(p.id, b.dataset.fee); rerender(); });
    });

    var addEv = U.qs("#evAdd");
    if (addEv) addEv.addEventListener("click", function () {
      var v = parseFloat(String(U.qs("#evAmt").value).replace(",", "."));
      if (!(v > 0)) { U.toast("Informe o valor.", "warn"); return; }
      var tipo = U.qs("#evTipo").value;
      var d = U.qs("#evDate").value;
      if (d && d > U.hoje()) {
        U.toast("Evento com data no futuro não existe ainda.", "warn"); return;
      }

      var r = S.poolSummary(p.id);
      /* Reinvestir mais do que foi coletado criaria capital do nada, e
         o resultado passaria a mostrar menos lucro do que existe. */
      if (tipo === "reinvest") {
        var disp = r.taxasColetadas - r.reinvestido;
        if (v > disp + 1e-9) {
          U.toast("Só dá para reinvestir taxa já coletada. Disponível: " + U.money(disp) + ".", "warn");
          return;
        }
      }
      /* Retirar mais do que existe na posição também não. */
      if (tipo === "retirada" && v > r.valorTotal + 1e-9) {
        U.toast("A retirada é maior que o valor da posição (" + U.money(r.valorTotal) + ").", "warn");
        return;
      }

      S.addEvent(p.id, { type: tipo, amountUSD: v, date: d, note: U.qs("#evNote").value.trim() });
      U.toast(TIPO_EVENTO[tipo].label + " registrado.", "ok");
      rerender();
    });

    U.qsa(".fee-del[data-act=delev]").forEach(function (b) {
      b.addEventListener("click", function () { S.removeEvent(p.id, b.dataset.ev); rerender(); });
    });
  }

  /* ---------- Fechar posição ---------- */
  var cc = U.qs("#confirmClose");
  if (cc) cc.addEventListener("click", function () {
    var reason = U.qs("#closeReason").value.trim() || "Encerramento manual.";
    S.closePool(p.id, reason);
    U.closeModal("#modalClose");
    U.toast("Posição encerrada e movida ao Histórico.", "ok");
    setTimeout(function () { location.href = "historico.html"; }, 700);
  });

  var se = U.qs("#saveEdit");
  if (se) se.addEventListener("click", salvarEdicao);

  /* fechar modais genérico */
  U.qsa("[data-close]").forEach(function (b) {
    b.addEventListener("click", function () { U.closeModal("#" + b.dataset.close); });
  });
  U.qsa(".modal-overlay").forEach(function (m) {
    m.addEventListener("click", function (e) { if (e.target === m) m.classList.remove("open"); });
  });

  montar();
  carregarMercado();
})();
