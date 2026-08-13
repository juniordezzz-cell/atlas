/* ============================================================
   ATLAS · js/carteiras.js
   ------------------------------------------------------------
   CARTEIRAS & MOVIMENTAÇÕES — a tela do caixa.

   Ela responde três perguntas, nesta ordem:

     1. Onde está cada dólar?   (caixa + posições, por módulo)
     2. Quanto tenho disponível em cada carteira?
     3. Como o dinheiro chegou até aqui?  (extrato)

   Nenhum número desta tela é gravado. Caixa vem de AtlasCaixa.saldo(),
   que soma o livro de eventos; posições vêm dos leitores por módulo da
   consolidação. Se os dois discordarem, a tela mostra a diferença em
   vez de escolher um — ver `conferencia()`.
   ============================================================ */
(function () {
  "use strict";

  var CX = window.AtlasCaixa;
  var W = window.AtlasWallets;

  if (!CX || !W) {
    var raiz = document.getElementById("cxCarteiras");
    if (raiz) raiz.innerHTML = '<div class="cx-vazio">Central de carteiras não carregada nesta página.</div>';
    return;
  }

  var CORES = { trade: "#4F8CFF", hold: "#22C55E", defi: "#8B5CF6", rwa: "#22D3EE", caixa: "#5eead4" };
  var NOMES = { trade: "Trade", hold: "Hold", defi: "DeFi", rwa: "RWA", caixa: "Caixa disponível" };

  function esc(t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function money(v) {
    if (window.AtlasCurrency) return AtlasCurrency.format(v, { decimals: Math.abs(v) >= 1000 ? 0 : 2 });
    return "US$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function qs(s) { return document.querySelector(s); }
  function toast(msg, tipo) {
    if (window.AtlasUI && AtlasUI.toast) return AtlasUI.toast(msg, tipo);
    if (window.console) console.log("[carteiras]", msg);
  }

  function globais() { return W.globals ? W.globals() : []; }
  function todas() { return W.all ? W.all() : []; }

  /* ============================================================
     POSIÇÕES POR MÓDULO — lidas dos stores, não do caixa

     O caixa sabe quanto SAIU para posições (aporte − retorno). Os
     módulos sabem quanto essas posições VALEM hoje. São números
     diferentes de propósito: a diferença entre eles é o resultado.
     ============================================================ */
  function posicoesDe(walletId) {
    var out = {};
    var C = window.AtlasConsolidation;
    if (!C || !C.moduleList) return out;
    ["hold", "trade", "defi", "rwa"].forEach(function (m) {
      var v = 0;
      try {
        v = W.balanceOf ? Number(W.balanceOf(walletId, m)) || 0 : 0;
      } catch (e) { v = 0; }
      if (v) out[m] = v;
    });
    return out;
  }

  /* ============================================================
     DISTRIBUIÇÃO — "onde está cada dólar"
     ============================================================ */
  function pintarDistribuicao() {
    var host = qs("#cxDistribuicao");
    var totalHost = qs("#cxTotal");
    if (!host) return;

    var caixa = 0, porModulo = {};
    globais().forEach(function (w) {
      caixa += CX.saldo(w.id);
      var pos = posicoesDe(w.id);
      Object.keys(pos).forEach(function (m) { porModulo[m] = (porModulo[m] || 0) + pos[m]; });
    });

    var total = caixa + Object.keys(porModulo).reduce(function (a, m) { return a + porModulo[m]; }, 0);

    if (totalHost) {
      totalHost.innerHTML = money(total) +
        "<small>caixa + posições · carteiras globais</small>";
    }

    var linhas = [];
    if (caixa !== 0) linhas.push({ chave: "caixa", valor: caixa });
    Object.keys(porModulo).forEach(function (m) {
      if (porModulo[m]) linhas.push({ chave: m, valor: porModulo[m] });
    });
    linhas.sort(function (a, b) { return b.valor - a.valor; });

    if (!linhas.length) {
      host.innerHTML = '<div class="cx-vazio">Nenhum dinheiro registrado ainda.<br>' +
        'Comece com um <b>Depósito</b> — é assim que o dinheiro entra no ATLAS.</div>';
      return;
    }

    host.innerHTML = linhas.map(function (l) {
      var pct = total > 0 ? (l.valor / total) * 100 : 0;
      var cor = CORES[l.chave] || "#5B9BFF";
      return '<div class="cx-linha">' +
        '<div class="cx-linha__k"><span class="cx-ponto" style="background:' + cor + '"></span>' +
          esc(NOMES[l.chave] || l.chave) + '</div>' +
        '<div class="cx-linha__v">' + money(l.valor) + '</div>' +
        '<div class="cx-barra"><i style="width:' + Math.max(1, Math.min(100, pct)) + '%;background:' + cor + '"></i></div>' +
        '<div class="cx-linha__sub">' + pct.toFixed(1) + '% do patrimônio</div>' +
      '</div>';
    }).join("") + conferencia(total);
  }

  /* ------------------------------------------------------------
     A CONFERÊNCIA QUE NÃO PODE SER ESCONDIDA

     O livro de caixa sabe quanto entrou e saiu do ATLAS (depósitos
     menos saques). O patrimônio somado é caixa + posições. Os dois só
     divergem pelo RESULTADO — lucro ou prejuízo das posições.

     Mostrar essa diferença é o que transforma a tela num instrumento
     de auditoria: se ela crescer sem que nenhuma posição tenha
     rendido, há dinheiro aparecendo do nada em algum lugar.
     ------------------------------------------------------------ */
  function conferencia(total) {
    var externo = CX.patrimonioExterno();
    if (!externo && !total) return "";
    var resultado = total - externo;
    var sinal = resultado >= 0 ? "+" : "−";
    return '<div class="cx-linha" style="border-top:1px solid var(--atlas-border,rgba(140,170,225,.14));margin-top:6px">' +
      '<div class="cx-linha__k">Depositado − sacado</div>' +
      '<div class="cx-linha__v">' + money(externo) + '</div>' +
      '<div class="cx-linha__sub">O patrimônio acima é esse valor ' + sinal + ' ' +
        money(Math.abs(resultado)) + ' de resultado das posições. ' +
        'Só depósito e saque mudam o total — todo o resto redistribui.</div>' +
    '</div>';
  }

  /* ============================================================
     CAIXA POR CARTEIRA
     ============================================================ */
  function pintarCarteiras() {
    var host = qs("#cxCarteiras");
    if (!host) return;
    var lista = todas();
    if (!lista.length) { host.innerHTML = '<div class="cx-vazio">Nenhuma carteira.</div>'; return; }

    host.innerHTML = lista.map(function (w) {
      var s = CX.saldo(w.id);
      var pos = posicoesDe(w.id);
      var alocado = Object.keys(pos).reduce(function (a, m) { return a + pos[m]; }, 0);
      var detalhe = Object.keys(pos).map(function (m) {
        return (NOMES[m] || m) + " " + money(pos[m]);
      }).join(" · ");

      return '<div class="cx-linha">' +
        '<div class="cx-linha__k">' +
          '<span class="cx-ponto" style="background:' + esc(w.color || "#4C9AFF") + '"></span>' +
          esc(w.name) +
          ' <span style="font-size:11px;color:var(--text-3,#6b7a8f);font-weight:500">' +
            esc(W.typeTag ? W.typeTag(w) : w.type) + '</span>' +
        '</div>' +
        '<div class="cx-linha__v"' + (s < 0 ? ' style="color:var(--neg,#f87171)"' : '') + '>' + money(s) + '</div>' +
        '<div class="cx-linha__sub">' +
          (alocado ? "em posições: " + money(alocado) + (detalhe ? " — " + esc(detalhe) : "") : "sem posições") +
          (s < 0 ? ' · <b style="color:var(--neg,#f87171)">caixa negativo: há posição aberta sem depósito que a cubra</b>' : '') +
        '</div>' +
      '</div>';
    }).join("");
  }

  /* ============================================================
     EXTRATO
     ============================================================ */
  var filtroCarteira = "";

  function pintarFiltro() {
    var sel = qs("#cxFiltro");
    if (!sel) return;
    sel.innerHTML = '<option value="">Todas as carteiras</option>' +
      todas().map(function (w) {
        return '<option value="' + esc(w.id) + '"' + (w.id === filtroCarteira ? " selected" : "") + '>' +
          esc(w.name) + '</option>';
      }).join("");
    sel.onchange = function () { filtroCarteira = sel.value; pintarExtrato(); };
  }

  function nomeCarteira(id) {
    var w = W.get ? W.get(id) : null;
    return w ? w.name : "(carteira removida)";
  }

  function pintarExtrato() {
    var host = qs("#cxExtrato");
    if (!host) return;
    var evs = CX.eventos(filtroCarteira ? { walletId: filtroCarteira } : {});

    if (!evs.length) {
      host.innerHTML = '<div class="cx-vazio">Nenhuma movimentação registrada' +
        (filtroCarteira ? " nesta carteira" : "") + '.</div>';
      return;
    }

    host.innerHTML = evs.map(function (e) {
      var t = CX.TIPOS[e.tipo] || { sinal: 0 };
      /* O sinal é do ponto de vista da carteira que está sendo olhada:
         numa transferência, a mesma linha é saída para uma e entrada
         para a outra. Sem isto, o extrato filtrado por carteira
         mostraria a transferência recebida como saída. */
      var sinal = t.sinal;
      if (t.contra && filtroCarteira && e.contraWalletId === filtroCarteira) sinal = -t.sinal;

      var classe = sinal > 0 ? "is-in" : sinal < 0 ? "is-out" : "";
      var prefixo = sinal > 0 ? "+" : sinal < 0 ? "−" : "";

      var descricao = CX.rotulo(e.tipo);
      if (e.tipo === "transferencia") {
        descricao = nomeCarteira(e.walletId) + " → " + nomeCarteira(e.contraWalletId);
      } else if (e.tipo === "swap") {
        descricao = (e.qtdOrigem != null ? e.qtdOrigem + " " : "") + e.ativo +
                    " → " + (e.qtdDestino != null ? e.qtdDestino + " " : "") + (e.ativoDestino || "?");
      } else {
        descricao += " · " + nomeCarteira(e.walletId);
      }

      var meta = [e.data];
      if (e.module) meta.push(NOMES[e.module] || e.module);
      if (e.tipo !== "swap" && e.ativo && e.ativo !== "USDT") meta.push(e.ativo);
      if (e.obs) meta.push(esc(e.obs));

      return '<div class="cx-ev">' +
        '<span class="cx-ev__tipo ' + classe + '">' + esc(CX.rotulo(e.tipo)) + '</span>' +
        '<span class="cx-ev__txt">' + esc(descricao) + '</span>' +
        '<span class="cx-ev__val ' + classe + '">' + prefixo + money(e.valorUSD) + '</span>' +
        '<span class="cx-ev__meta">' + meta.join(" · ") + '</span>' +
      '</div>';
    }).join("");
  }

  /* ============================================================
     DIÁLOGO DAS AÇÕES
     ============================================================ */
  var acaoAtual = null;

  function opcoesCarteira(sel, excluir) {
    return todas().filter(function (w) { return w.id !== excluir; })
      .map(function (w) {
        return '<option value="' + esc(w.id) + '"' + (w.id === sel ? " selected" : "") + '>' +
          esc(w.name) + ' — ' + money(CX.saldo(w.id)) + ' em caixa</option>';
      }).join("");
  }

  function campo(rotulo, html, dica) {
    return '<div class="cx-campo"><label>' + rotulo + '</label>' + html +
      (dica ? '<div class="cx-dica">' + dica + '</div>' : '') + '</div>';
  }

  function hoje() {
    var d = new Date(), mm = String(d.getMonth() + 1), dd = String(d.getDate());
    return d.getFullYear() + "-" + (mm.length < 2 ? "0" + mm : mm) + "-" + (dd.length < 2 ? "0" + dd : dd);
  }

  var FORMS = {
    deposito: function () {
      return campo("Carteira de destino", '<select id="cxW">' + opcoesCarteira(W.activeGlobalId()) + '</select>',
                   "Não achou a carteira? Crie em qualquer seletor de carteira do ATLAS.") +
             campo("Ativo", '<input id="cxAtivo" value="USDT" />',
                   "O caixa é dinheiro parado — normalmente USDT ou USDC.") +
             campo("Valor (US$)", '<input id="cxValor" type="number" step="any" min="0" placeholder="0,00" />') +
             campo("Data", '<input id="cxData" type="date" value="' + hoje() + '" />') +
             campo("Observação", '<input id="cxObs" placeholder="opcional" />') +
             '<div class="cx-dica">Depósito é a única entrada de dinheiro novo no ATLAS. ' +
             'Ele <b>aumenta</b> o patrimônio total.</div>';
    },
    saque: function () {
      return campo("Carteira de origem", '<select id="cxW">' + opcoesCarteira(W.activeGlobalId()) + '</select>') +
             campo("Valor (US$)", '<input id="cxValor" type="number" step="any" min="0" placeholder="0,00" />',
                   "Só sai o que estiver em caixa. Dinheiro dentro de posição precisa ser fechado antes.") +
             campo("Data", '<input id="cxData" type="date" value="' + hoje() + '" />') +
             campo("Observação", '<input id="cxObs" placeholder="opcional" />') +
             '<div class="cx-dica">Saque <b>reduz</b> o patrimônio total: o dinheiro sai do ATLAS.</div>';
    },
    transferencia: function () {
      var ativa = W.activeGlobalId();
      return campo("De", '<select id="cxW">' + opcoesCarteira(ativa) + '</select>') +
             campo("Para", '<select id="cxW2">' + opcoesCarteira(null, ativa) + '</select>') +
             campo("Valor (US$)", '<input id="cxValor" type="number" step="any" min="0" placeholder="0,00" />') +
             campo("Data", '<input id="cxData" type="date" value="' + hoje() + '" />') +
             campo("Observação", '<input id="cxObs" placeholder="opcional" />') +
             '<div class="cx-dica">Transferência <b>não muda</b> o patrimônio total — só a distribuição.</div>';
    },
    swap: function () {
      return campo("Carteira", '<select id="cxW">' + opcoesCarteira(W.activeGlobalId()) + '</select>') +
             campo("De", '<input id="cxAtivo" placeholder="USDT" />') +
             campo("Quantidade enviada", '<input id="cxQtd1" type="number" step="any" min="0" placeholder="0" />') +
             campo("Para", '<input id="cxAtivo2" placeholder="SOL" />') +
             campo("Quantidade recebida", '<input id="cxQtd2" type="number" step="any" min="0" placeholder="0" />') +
             campo("Valor da operação (US$)", '<input id="cxValor" type="number" step="any" min="0" placeholder="0,00" />',
                   "Quanto a operação movimentou, em dólar.") +
             campo("Data", '<input id="cxData" type="date" value="' + hoje() + '" />') +
             '<div class="cx-dica">Swap troca um ativo por outro dentro da mesma carteira. ' +
             'Ele <b>não aumenta</b> o patrimônio — só muda a forma do dinheiro.</div>';
    }
  };

  var TITULOS = {
    deposito: "Depósito", saque: "Saque",
    transferencia: "Transferência entre carteiras", swap: "Swap de ativo"
  };

  function abrir(acao) {
    if (!FORMS[acao]) return;
    acaoAtual = acao;
    qs("#cxModalTitulo").textContent = TITULOS[acao];
    qs("#cxModalBody").innerHTML = FORMS[acao]();
    qs("#cxModal").hidden = false;
    var primeiro = qs("#cxModalBody select, #cxModalBody input");
    if (primeiro) { try { primeiro.focus(); } catch (e) {} }
  }

  function fechar() { qs("#cxModal").hidden = true; acaoAtual = null; }

  function valorDe(id) {
    var el = qs("#" + id);
    if (!el) return NaN;
    var v = parseFloat(String(el.value).replace(",", "."));
    return isFinite(v) ? v : NaN;
  }
  function textoDe(id) {
    var el = qs("#" + id);
    return el ? String(el.value || "").trim() : "";
  }

  function confirmar() {
    if (!acaoAtual) return;
    var valor = valorDe("cxValor");
    if (!(valor > 0)) { toast("Informe um valor maior que zero.", "warn"); return; }

    var wid = textoDe("cxW");
    if (!wid) { toast("Escolha a carteira.", "warn"); return; }

    /* ------------------------------------------------------------
       O BLOQUEIO: não sai o que não existe

       Saque e transferência gastam caixa. Sem esta verificação o
       livro aceitaria um saldo negativo — e um caixa negativo não é
       um aviso, é um erro de contabilidade que se propaga para o
       patrimônio consolidado.
       ------------------------------------------------------------ */
    if (acaoAtual === "saque" || acaoAtual === "transferencia") {
      var c = CX.podeGastar(wid, valor);
      if (!c.ok) {
        toast("Caixa insuficiente em " + nomeCarteira(wid) + ": há " + money(c.saldo) +
              " e faltam " + money(c.falta) + ".", "warn");
        return;
      }
    }

    var ev = {
      tipo: acaoAtual,
      valorUSD: valor,
      walletId: wid,
      data: textoDe("cxData"),
      ativo: textoDe("cxAtivo") || "USDT",
      obs: textoDe("cxObs")
    };

    if (acaoAtual === "transferencia") {
      ev.contraWalletId = textoDe("cxW2");
      if (!ev.contraWalletId) { toast("Escolha a carteira de destino.", "warn"); return; }
      if (ev.contraWalletId === wid) { toast("Origem e destino são a mesma carteira.", "warn"); return; }
    }
    if (acaoAtual === "swap") {
      ev.ativoDestino = textoDe("cxAtivo2");
      ev.qtdOrigem = valorDe("cxQtd1");
      ev.qtdDestino = valorDe("cxQtd2");
      if (!ev.ativo || !ev.ativoDestino) { toast("Informe os dois ativos do swap.", "warn"); return; }
    }

    var gravado = CX.registrar(ev);
    if (!gravado) { toast("Não consegui registrar — confira os campos.", "warn"); return; }

    fechar();
    toast(CX.rotulo(acaoAtual) + " de " + money(valor) + " registrado.", "ok");
    render();
  }

  /* ============================================================
     GUIA: TAXAS DE POOL
     ------------------------------------------------------------
     A taxa de uma pool não é um movimento de caixa como os outros —
     ela tem três estados e o dinheiro está em lugares diferentes em
     cada um:

       PENDENTE     ainda DENTRO da pool, exposta ao preço
       DISPONÍVEL   já saiu para o caixa da carteira, sem destino
       DESTINADA    reinvestida na pool, ou mandada para outro lugar

     "Sacar apenas as taxas" é passar de pendente para disponível sem
     tocar no principal: a posição continua aberta, e a receita vira
     caixa. Era possível fazer isso só de dentro da página de cada
     pool, uma por uma. Aqui está tudo junto.
     ============================================================ */

  function pools() {
    if (!window.DeFiStore || !DeFiStore.poolsDeTodasCarteiras) return [];
    try { return DeFiStore.poolsDeTodasCarteiras(); } catch (e) { return []; }
  }

  function resumoDe(p) {
    try { return DeFiStore.poolSummary(p) || null; } catch (e) { return null; }
  }

  function pintarTaxas() {
    var hostResumo = qs("#txResumo"), hostPools = qs("#txPools"), hostTotal = qs("#txTotal");
    if (!hostPools) return;

    var lista = pools();
    var t = { geradas: 0, pendentes: 0, disponiveis: 0, reinvestidas: 0, saidas: 0 };
    var linhas = [];

    lista.forEach(function (item) {
      var r = resumoDe(item.pool);
      if (!r || !r.taxasGeradas) return;
      t.geradas += r.taxasGeradas;
      t.pendentes += r.taxasPendentes;
      t.disponiveis += r.taxasDisponiveis;
      t.reinvestidas += r.taxasReinvestidas;
      t.saidas += r.taxasSaidas;
      linhas.push({ item: item, r: r });
    });

    if (hostTotal) {
      hostTotal.innerHTML = money(t.geradas) + "<small>desde a abertura das posições</small>";
    }

    if (hostResumo) {
      hostResumo.innerHTML = !t.geradas
        ? '<div class="cx-vazio">Nenhuma taxa registrada ainda.<br>' +
          'Registre a taxa coletada na página da posição — ela entra no caixa da carteira.</div>'
        : '<div class="cx-taxa"><div class="cx-taxa__nums" style="margin:0">' +
            '<span class="cx-taxa__n is-pend">Ainda na pool<b>' + money(t.pendentes) + '</b></span>' +
            '<span class="cx-taxa__n is-livre">Disponível em caixa<b>' + money(t.disponiveis) + '</b></span>' +
            '<span class="cx-taxa__n">Reinvestida<b>' + money(t.reinvestidas) + '</b></span>' +
            '<span class="cx-taxa__n">Mandada para outro destino<b>' + money(t.saidas) + '</b></span>' +
          '</div>' +
          '<div class="cx-linha__sub" style="grid-column:1/-1">' +
            'Taxa <b>pendente</b> está dentro da posição e some se o preço cair. ' +
            'Coletar move para o caixa sem fechar a posição — e a partir daí ela é ' +
            'dinheiro seu para decidir.</div>' +
        '</div>';
    }

    if (!linhas.length) {
      hostPools.innerHTML = '<div class="cx-vazio">Nenhuma posição de liquidez com taxa registrada.</div>';
      return;
    }

    hostPools.innerHTML = linhas.map(function (l, i) {
      var p = l.item.pool, r = l.r;
      var pendentes = (p.fees || []).filter(function (f) { return f.status === "pendente"; });
      return '<div class="cx-taxa">' +
        '<div><div class="cx-taxa__par">' + esc(p.base) + ' / ' + esc(p.quote) + '</div>' +
          '<div class="cx-taxa__meta">' + esc(p.protocol || "") + ' · ' +
          esc(nomeCarteira(l.item.walletId)) + '</div></div>' +
        '<div class="cx-linha__v">' + money(r.taxasGeradas) + '</div>' +
        '<div class="cx-taxa__nums">' +
          '<span class="cx-taxa__n is-pend">Na pool<b>' + money(r.taxasPendentes) + '</b></span>' +
          '<span class="cx-taxa__n is-livre">Disponível<b>' + money(r.taxasDisponiveis) + '</b></span>' +
          '<span class="cx-taxa__n">Reinvestida<b>' + money(r.taxasReinvestidas) + '</b></span>' +
        '</div>' +
        '<div class="cx-taxa__acoes">' +
          (pendentes.length
            ? '<button type="button" class="cx-btn cx-btn--in" data-tx-coletar="' + i + '">' +
              'Sacar taxa para o caixa (' + money(r.taxasPendentes) + ')</button>'
            : '') +
          (r.taxasDisponiveis > 0
            ? '<button type="button" class="cx-btn" data-tx-reinvestir="' + i + '">' +
              'Reinvestir na pool (' + money(r.taxasDisponiveis) + ')</button>'
            : '') +
          '<a class="cx-btn" href="defi/pool.html?id=' + esc(p.id) + '">Abrir posição</a>' +
        '</div>' +
      '</div>';
    }).join("");

    /* ---- ações ---- */
    hostPools.querySelectorAll("[data-tx-coletar]").forEach(function (b) {
      b.addEventListener("click", function () {
        var l = linhas[+b.dataset.txColetar];
        var p = l.item.pool;
        var pend = (p.fees || []).filter(function (f) { return f.status === "pendente"; });
        var total = 0;
        pend.forEach(function (f) {
          DeFiStore.collectFee(p, f.id);   // credita o caixa em cada coleta
          total += Number(f.amount) || 0;
        });
        toast("Taxa de " + p.base + "/" + p.quote + " (" + money(total) +
              ") foi para o caixa de " + nomeCarteira(l.item.walletId) + ".", "ok");
        render();
      });
    });

    hostPools.querySelectorAll("[data-tx-reinvestir]").forEach(function (b) {
      b.addEventListener("click", function () {
        var l = linhas[+b.dataset.txReinvestir];
        var p = l.item.pool;
        var valor = l.r.taxasDisponiveis;
        /* O reinvestimento tira do caixa e devolve à posição: são
           juros compostos, e o store recusa se não houver taxa livre. */
        var ev = DeFiStore.addEvent(p, { type: "reinvest", amountUSD: valor,
                                         note: "Reinvestido pela tela de Carteiras" });
        if (!ev) { toast("Não há taxa disponível para reinvestir nesta pool.", "warn"); return; }
        toast(money(valor) + " reinvestido em " + p.base + "/" + p.quote +
              " — virou capital da posição.", "ok");
        render();
      });
    });
  }

  /* ============================================================
     GUIAS
     ============================================================ */
  var guiaAtual = "movimentacoes";

  function trocarGuia(nome) {
    guiaAtual = nome;
    document.querySelectorAll("[data-guia]").forEach(function (b) {
      var on = b.dataset.guia === nome;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelectorAll("[data-painel]").forEach(function (s) {
      s.hidden = s.dataset.painel !== nome;
    });
    render();
  }

  /* ============================================================
     MONTAGEM
     ============================================================ */
  function render() {
    if (guiaAtual === "taxas") { pintarTaxas(); return; }
    pintarDistribuicao();
    pintarCarteiras();
    pintarFiltro();
    pintarExtrato();
  }

  document.querySelectorAll("[data-guia]").forEach(function (b) {
    b.addEventListener("click", function () { trocarGuia(b.dataset.guia); });
  });

  document.querySelectorAll("[data-acao]").forEach(function (b) {
    b.addEventListener("click", function () { abrir(b.dataset.acao); });
  });
  document.querySelectorAll("[data-cx-close]").forEach(function (b) {
    b.addEventListener("click", fechar);
  });
  var confirmarBtn = qs("#cxConfirmar");
  if (confirmarBtn) confirmarBtn.addEventListener("click", confirmar);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !qs("#cxModal").hidden) fechar();
  });

  /* trocar de carteira em qualquer aba redesenha aqui */
  if (W.subscribe) W.subscribe(render);
  if (CX.subscribe) CX.subscribe(render);

  render();

  window.AtlasCarteirasUI = { render: render };
})();
