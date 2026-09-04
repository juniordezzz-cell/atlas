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
  function safePaint(nome, fn) {
    try { fn(); }
    catch (e) {
      if (window.console && console.error) console.error("[carteiras][" + nome + "]", e);
    }
  }
  function qtd(v) {
    return (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 8 });
  }

  function globais() { return W.globals ? W.globals() : []; }
  function todas() { return W.all ? W.all() : []; }
  var chartHero = null;
  var chartDonut = null;
  var precosCaixa = {};
  var atualizacaoPatrimonio = null;

  function pct(v, t) {
    if (!(t > 0)) return 0;
    return (Number(v) || 0) * 100 / t;
  }

  function corSerie(chave) {
    var base = CORES[chave] || "#5B9BFF";
    var T = window.AtlasChartTheme;
    return (T && T.serie) ? T.serie(base) : base;
  }

  function precoMercadoSimbolo(simbolo, fallback) {
    var s = String(simbolo || "").toUpperCase();
    if (!s) return null;
    if (window.AtlasPrecos && AtlasPrecos.isStable && AtlasPrecos.isStable(s)) return 1;
    var p = Number(precosCaixa[s]);
    if (isFinite(p) && p > 0) return p;
    var f = Number(fallback);
    return (isFinite(f) && f > 0) ? f : null;
  }

  function valorMercadoAtivoCaixa(a) {
    var q = Number(a && a.qtd) || 0;
    var base = Number(a && a.usd) || 0;
    if (Math.abs(q) <= 1e-8) return base;
    var p = precoMercadoSimbolo(a.ativo, q ? (base / q) : null);
    return (p > 0) ? (q * p) : base;
  }

  function caixaMercadoDaCarteira(walletId) {
    if (!CX.caixaPorAtivo) return Number(CX.saldo(walletId)) || 0;
    var ativos = CX.caixaPorAtivo(walletId) || [];
    return ativos.reduce(function (s, a) { return s + valorMercadoAtivoCaixa(a); }, 0);
  }

  function simbolosCaixaGlobais() {
    if (!CX.caixaPorAtivo) return [];
    var seen = {};
    var out = [];
    globais().forEach(function (w) {
      (CX.caixaPorAtivo(w.id) || []).forEach(function (a) {
        var q = Number(a && a.qtd) || 0;
        var sym = String(a && a.ativo || "").toUpperCase();
        if (!(Math.abs(q) > 1e-8) || !sym || seen[sym]) return;
        seen[sym] = 1;
        out.push(sym);
      });
    });
    return out;
  }

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

  function dadosCarteira(walletId) {
    var pos = posicoesDe(walletId);
    var caixa = caixaMercadoDaCarteira(walletId);
    var buckets = [
      { chave: "caixa", nome: "Parado na carteira", valor: caixa },
      { chave: "hold", nome: "Hold", valor: Number(pos.hold) || 0 },
      { chave: "defi", nome: "DeFi", valor: Number(pos.defi) || 0 },
      { chave: "trade", nome: "Trade", valor: Number(pos.trade) || 0 },
      { chave: "rwa", nome: "RWA", valor: Number(pos.rwa) || 0 }
    ];
    var total = buckets.reduce(function (s, b) { return s + b.valor; }, 0);
    return { caixa: caixa, pos: pos, buckets: buckets, total: total };
  }

  function carteiraAtiva() {
    var id = W.activeGlobalId ? W.activeGlobalId() : null;
    var w = id && W.get ? W.get(id) : null;
    if (w) return w;
    var g = globais();
    return g.length ? g[0] : null;
  }

  /* ============================================================
     A HISTÓRIA DO DINHEIRO — o que ENTROU vs o que VALORIZOU
     ------------------------------------------------------------
     O delta do card mostrava `valor_de_hoje − saldo_de_30_dias_atrás`.
     Numa carteira nova, "30 dias atrás" é ZERO (o dinheiro ainda não
     existia), então o depósito inteiro virava "ganho" e a % zerava —
     "US$ 97,28 apareceu do nada". Errado: patrimônio só muda com
     depósito/saque (regra de ouro nº 4). O que valoriza é o MERCADO.

     `aportadoLiquido` é o dinheiro que a carteira recebeu de fora:
     depósitos (+), saques (−) e transferências que a tocam. Swap,
     aporte e retorno redistribuem valor DENTRO dela — não é dinheiro
     novo, ficam de fora. A valorização é então `patrimônio − aportado`.
     ============================================================ */
  function aportadoLiquido(walletId) {
    if (!CX || !CX.eventos) return 0;
    var total = 0;
    CX.eventos({ walletId: walletId }).forEach(function (ev) {
      var v = Number(ev.valorUSD) || 0;
      if (ev.tipo === "deposito" && ev.walletId === walletId) total += v;
      else if (ev.tipo === "saque" && ev.walletId === walletId) total -= v;
      else if (ev.tipo === "transferencia") {
        if (ev.walletId === walletId) total -= v;
        if (ev.contraWalletId === walletId) total += v;
      }
    });
    return Math.round(total * 1e6) / 1e6;
  }

  /* Data do primeiro movimento que tocou a carteira — rotula a
     valorização ("desde 1 set") em vez de um "30 dias" fixo que não
     corresponde a nada quando a carteira acabou de nascer. */
  function primeiraDataMovimento(walletId) {
    if (!CX || !CX.eventos) return null;
    var min = null;
    CX.eventos({ walletId: walletId }).forEach(function (ev) {
      if (!ev.data) return;
      if (min === null || ev.data < min) min = ev.data;
    });
    return min;
  }

  var MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  function dataCurta(iso) {
    var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return "";
    return String(Number(m[3])) + " " + (MESES_CURTOS[Number(m[2]) - 1] || "");
  }

  /* Caixa quebrado por ativo (valor de MERCADO), somando as carteiras
     globais. Alimenta o nível 2 da distribuição — "dentro do Caixa". É
     a mesma conta da seção "Caixa por ativo"; aqui numa forma enxuta. */
  function ativosDoCaixa() {
    if (!CX || !CX.caixaPorAtivo) return [];
    var mapa = {};
    globais().forEach(function (w) {
      CX.caixaPorAtivo(w.id).forEach(function (a) {
        var k = a.ativo;
        if (!mapa[k]) mapa[k] = { ativo: k, nome: a.nome || k, usd: 0, qtd: 0 };
        mapa[k].usd += Number(a.usd) || 0;
        mapa[k].qtd += Number(a.qtd) || 0;
      });
    });
    return Object.keys(mapa).map(function (k) {
      var m = valorMercadoAtivoCaixa({ ativo: mapa[k].ativo, usd: mapa[k].usd, qtd: mapa[k].qtd });
      return { ativo: mapa[k].ativo, nome: mapa[k].nome, usd: Math.round(m * 1e6) / 1e6 };
    }).filter(function (a) { return Math.abs(a.usd) > 1e-6; })
      .sort(function (a, b) { return Math.abs(b.usd) - Math.abs(a.usd); });
  }

  function diasISO(dias) {
    var out = [];
    var n = dias || 30;
    var hoje = new Date();
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(hoje);
      d.setDate(hoje.getDate() - i);
      out.push(d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0"));
    }
    return out;
  }

  function sinalDoEventoNaCarteira(ev, walletId) {
    var t = CX.TIPOS[ev.tipo];
    if (!t) return 0;
    var v = Number(ev.valorUSD) || 0;
    var s = 0;
    if (ev.walletId === walletId) s += t.sinal * v;
    if (t.contra && ev.contraWalletId === walletId) s += -t.sinal * v;
    return s;
  }

  function serieCaixaCarteira(walletId, dias) {
    var datas = diasISO(dias);
    var de = datas[0];
    var ix = {};
    datas.forEach(function (d, i) { ix[d] = i; });
    var delta = datas.map(function () { return 0; });
    var base = 0;
    var evs = CX.eventos({ walletId: walletId }).slice().reverse();

    evs.forEach(function (ev) {
      var s = sinalDoEventoNaCarteira(ev, walletId);
      if (!s) return;
      if (ev.data < de) { base += s; return; }
      if (ix[ev.data] != null) delta[ix[ev.data]] += s;
    });

    var running = base;
    return datas.map(function (d, i) {
      running += delta[i];
      return { date: d, value: Math.round(running * 1e6) / 1e6 };
    });
  }

  function seriePosicoesCarteira(walletId, dias) {
    if (!window.AtlasSnapshots || !AtlasSnapshots.serie) return {};
    var arr = AtlasSnapshots.serie(dias, {
      modules: ["hold", "trade", "defi", "rwa"],
      wallets: [walletId],
      campo: "v"
    });
    var out = {};
    arr.forEach(function (p) { out[p.date] = Number(p.value) || 0; });
    return out;
  }

  function seriePatrimonioCarteira(walletId, dias) {
    var caixa = serieCaixaCarteira(walletId, dias || 30);
    var pos = seriePosicoesCarteira(walletId, dias || 30);
    return caixa.map(function (c) {
      return { date: c.date, value: c.value + (pos[c.date] || 0) };
    });
  }

  function formatarDelta(v) {
    var n = Number(v) || 0;
    var sinal = n >= 0 ? "+" : "−";
    return sinal + money(Math.abs(n));
  }

  function pintarHero() {
    var totalEl = qs("#cxHeroTotal");
    var deltaEl = qs("#cxHeroDelta");
    var nomeEl = qs("#cxHeroWalletNome");
    var totWalletEl = qs("#cxHeroWalletTotal");
    var splitEl = qs("#cxHeroWalletSplit");
    var ativa = carteiraAtiva();
    if (!totalEl || !deltaEl || !nomeEl || !totWalletEl || !splitEl || !ativa) return;

    var dados = dadosCarteira(ativa.id);
    var fim = Number(dados.total) || 0;

    /* Valorização = patrimônio de hoje − o que foi APORTADO na carteira.
       O depósito não conta como ganho; só o que o mercado moveu. */
    var aportado = aportadoLiquido(ativa.id);
    var valorizou = fim - aportado;
    var valorizouPct = aportado > 0 ? (valorizou / aportado) * 100 : null;
    var desde = dataCurta(primeiraDataMovimento(ativa.id));

    totalEl.textContent = money(fim);
    deltaEl.textContent = formatarDelta(valorizou) +
      (valorizouPct != null
        ? " (" + (valorizou >= 0 ? "+" : "") +
          valorizouPct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%)"
        : "") +
      (desde ? " desde " + desde : "");
    deltaEl.classList.toggle("is-up", valorizou >= 0);
    deltaEl.classList.toggle("is-down", valorizou < 0);

    /* A linha que separa o que ENTROU do que RENDEU — para o número
       nunca parecer que apareceu do nada. (textContent: sem HTML.) */
    var storyEl = qs("#cxHeroStory");
    if (storyEl) {
      if (aportado > 0) {
        storyEl.textContent = "Depositado " + money(aportado) +
          " · Valorizou " + formatarDelta(valorizou);
        storyEl.hidden = false;
      } else {
        storyEl.hidden = true;
      }
    }

    nomeEl.textContent = ativa.name;
    totWalletEl.textContent = money(dados.total);

    splitEl.innerHTML = '<div class="cx-split">' + dados.buckets.map(function (b) {
      var p = pct(b.valor, dados.total);
      return '<div class="cx-split__row">' +
        '<div class="cx-split__k"><span class="cx-ponto" style="background:' + corSerie(b.chave) + '"></span>' + esc(b.nome) + '</div>' +
        '<div class="cx-split__v">' + money(b.valor) + '</div>' +
        '<div class="cx-split__p">' + p.toFixed(1) + '%</div>' +
      '</div>';
    }).join("") + '</div>';

    /* Série do gráfico, recortada ao 1º dia com dinheiro — antes disso
       a carteira não existia e a "linha" seria só zero encostado no
       chão, virando um paredão no dia do depósito. */
    var serie = seriePatrimonioCarteira(ativa.id, 30);
    if (!serie.length) serie = [{ date: "", value: fim }];
    serie[serie.length - 1].value = fim;
    var corte = 0;
    while (corte < serie.length - 1 && (Number(serie[corte].value) || 0) === 0) corte++;
    serie = serie.slice(corte);

    /* Histórico ainda raso: nunca deixa vazio — mostra a mensagem. Com
       ao menos dois pontos desenha a linha e, se ainda são poucos dias,
       avisa que a curva completa se forma com o tempo. */
    var msgEl = qs("#cxHeroChartMsg");
    var canvasEl = document.getElementById("cxHeroChart");
    var semCurva = serie.length < 2;
    if (msgEl) {
      if (semCurva) {
        msgEl.textContent = "Ainda coletando o histórico — a curva aparece conforme os dias passam.";
        msgEl.hidden = false;
      } else if (serie.length < 7) {
        msgEl.textContent = "Ainda coletando o histórico — a curva completa se forma conforme os dias passam.";
        msgEl.hidden = false;
      } else {
        msgEl.hidden = true;
      }
    }
    if (canvasEl) canvasEl.hidden = semCurva;
    if (semCurva) return;   // sem dois pontos não há linha a traçar

    if (window.Chart && document.getElementById("cxHeroChart")) {
      try {
        var T = window.AtlasChartTheme;
        var canvas = document.getElementById("cxHeroChart");
        var ctx = canvas.getContext("2d");
        if (!ctx) return;
        var labels = serie.map(function (p) { return p.date.slice(5); });
        var valores = serie.map(function (p) { return Number(p.value) || 0; });
        var grad = ctx.createLinearGradient(0, 0, 0, canvas.height || 140);
        grad.addColorStop(0, T && T.alfa ? T.alfa("var(--pos)", 0.30) : "rgba(52,211,153,.30)");
        grad.addColorStop(1, T && T.alfa ? T.alfa("var(--pos)", 0.03) : "rgba(52,211,153,.03)");

        if (chartHero) {
          chartHero.data.labels = labels;
          chartHero.data.datasets[0].data = valores;
          chartHero.update();
        } else {
          chartHero = new Chart(ctx, {
            type: "line",
            data: { labels: labels, datasets: [{
              data: valores,
              borderColor: corSerie("caixa"),
              backgroundColor: grad,
              fill: true,
              borderWidth: 2.2,
              tension: 0.28,
              pointRadius: 0
            }]},
            options: {
              responsive: true, maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: Object.assign((T && T.tooltip ? T.tooltip() : {}), {
                  displayColors: false,
                  callbacks: { label: function (c) { return money(c.parsed.y); } }
                })
              },
              scales: {
                x: { display: false, grid: { display: false }, border: { display: false } },
                y: { display: false, grid: { display: false }, border: { display: false } }
              }
            }
          });
        }
      } catch (e) {
        if (window.console && console.warn) console.warn("[carteiras][hero-chart]", e && e.message);
      }
    }
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
      caixa += caixaMercadoDaCarteira(w.id);
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
      var lz = qs("#cxDonutLegend");
      if (lz) lz.innerHTML = "";
      if (chartDonut) { chartDonut.destroy(); chartDonut = null; }
      return;
    }

    host.innerHTML = linhas.map(function (l) {
      var pctv = total > 0 ? (l.valor / total) * 100 : 0;
      var cor = CORES[l.chave] || "#5B9BFF";

      /* NÍVEL 2: dentro do Caixa, a quebra por ativo (USDC/JUP/SOL/RAY),
         conectada logo abaixo da fatia de Caixa do donut. Só aparece se
         houver mais de um ativo — com um só, a fatia já conta a história. */
      var nested = "";
      if (l.chave === "caixa") {
        var ativos = ativosDoCaixa();
        if (ativos.length > 1) {
          nested = '<div class="cx-sub"><div class="cx-sub__cab">Dentro do Caixa, por ativo</div>' +
            ativos.map(function (a) {
              var pa = caixa > 0 ? (a.usd / caixa) * 100 : 0;
              return '<div class="cx-sub__row">' +
                '<span class="cx-sub__k">' + esc(a.ativo) + '</span>' +
                '<span class="cx-sub__v">' + money(a.usd) + '</span>' +
                '<span class="cx-sub__p">' + pa.toFixed(1) + '%</span>' +
              '</div>';
            }).join("") + '</div>';
        }
      }

      return '<div class="cx-linha">' +
        '<div class="cx-linha__k"><span class="cx-ponto" style="background:' + cor + '"></span>' +
          esc(NOMES[l.chave] || l.chave) + '</div>' +
        '<div class="cx-linha__v">' + money(l.valor) + '</div>' +
        '<div class="cx-barra"><i style="width:' + Math.max(1, Math.min(100, pctv)) + '%;background:' + cor + '"></i></div>' +
        '<div class="cx-linha__sub">' + pctv.toFixed(1) + '% do patrimônio</div>' +
      '</div>' + nested;
    }).join("") + conferencia(total);

    var legend = qs("#cxDonutLegend");
    var cDonut = document.getElementById("cxDonut");
    if (legend) {
      legend.innerHTML = linhas.map(function (l) {
        var p = total > 0 ? (l.valor / total) * 100 : 0;
        return "<li>" +
          '<span class="sw" style="background:' + corSerie(l.chave) + '"></span>' +
          '<span class="nm">' + esc(NOMES[l.chave] || l.chave) + '</span>' +
          '<span class="pc">' + p.toFixed(1) + '%</span>' +
          '<span class="vl">' + money(l.valor) + '</span>' +
        "</li>";
      }).join("");
    }

    if (window.Chart && cDonut && linhas.length) {
      try {
        var T = window.AtlasChartTheme;
        var labels = linhas.map(function (l) { return NOMES[l.chave] || l.chave; });
        var valores = linhas.map(function (l) { return Math.abs(l.valor); });
        var cores = linhas.map(function (l) { return corSerie(l.chave); });
        if (chartDonut) {
          chartDonut.data.labels = labels;
          chartDonut.data.datasets[0].data = valores;
          chartDonut.data.datasets[0].backgroundColor = cores;
          chartDonut.update();
        } else {
          var donutCtx = cDonut.getContext("2d");
          if (!donutCtx) return;
          chartDonut = new Chart(donutCtx, {
            type: "doughnut",
            data: { labels: labels, datasets: [{
              data: valores,
              backgroundColor: cores,
              borderColor: (T && T.vao) ? T.vao() : "transparent",
              borderWidth: 2,
              spacing: 3,
              hoverOffset: 4
            }]},
            options: {
              responsive: true, maintainAspectRatio: false,
              cutout: "72%",
              plugins: {
                legend: { display: false },
                tooltip: Object.assign((T && T.tooltip ? T.tooltip() : {}), {
                  displayColors: false,
                  callbacks: {
                    label: function (c) {
                      var i = c.dataIndex;
                      var p = total > 0 ? (valores[i] / total) * 100 : 0;
                      return labels[i] + ": " + money(valores[i]) + " (" + p.toFixed(1) + "%)";
                    }
                  }
                })
              }
            }
          });
        }
      } catch (e) {
        if (window.console && console.warn) console.warn("[carteiras][donut]", e && e.message);
      }
    }
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
        money(Math.abs(resultado)) + ' de variação (posições + tokens em caixa). ' +
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
      var d = dadosCarteira(w.id);
      var total = d.total;
      var stack = d.buckets.map(function (b) {
        var p = Math.max(0, pct(b.valor, total));
        return '<i style="width:' + Math.max(1, p) + '%;background:' + corSerie(b.chave) + '"></i>';
      }).join("");
      var mods = d.buckets.map(function (b) {
        return '<div class="cx-wallet-mod">' +
          '<div class="cx-wallet-mod__k"><span class="cx-ponto" style="background:' + corSerie(b.chave) + '"></span>' + esc(b.nome) + '</div>' +
          '<div class="cx-wallet-mod__v">' + money(b.valor) + '</div>' +
        '</div>';
      }).join("");

      return '<article class="cx-wallet-card">' +
        '<div class="cx-wallet-card__head">' +
          '<div class="cx-wallet-card__name">' +
            '<span class="cx-ponto" style="background:' + esc(w.color || "#4C9AFF") + ';width:10px;height:10px"></span>' +
            esc(w.name) +
            ' <span class="cx-wallet-card__tag">' + esc(W.typeTag ? W.typeTag(w) : w.type) + '</span>' +
          '</div>' +
          '<div class="cx-wallet-card__tot">' + money(total) + '</div>' +
        '</div>' +
        '<div class="cx-wallet-stack">' + stack + '</div>' +
        '<div class="cx-wallet-mods">' + mods + '</div>' +
        (d.caixa < 0 ? '<div class="cx-linha__sub" style="margin-top:8px;color:var(--neg,#f87171)">Caixa negativo: há posição aberta sem depósito que a cubra.</div>' : '') +
      '</article>';
    }).join("");
  }

  function badgeAtivo(a) {
    if (a && a.thumb) {
      return '<span class="cx-asset__ico"><img src="' + esc(a.thumb) + '" alt=""></span>';
    }
    var sigla = String((a && a.ativo) || "?").slice(0, 2).toUpperCase();
    return '<span class="cx-asset__ico cx-asset__ico--txt">' + esc(sigla) + '</span>';
  }

  function precoLinha(a) {
    if (!(Math.abs(a.qtd) > 1e-8)) return null;
    return precoMercadoSimbolo(a.ativo, a.usdBase / a.qtd);
  }

  function pintarAtivosParados() {
    var host = qs("#cxAtivosParados");
    if (!host || !CX.caixaPorAtivo) return;

    var mapa = {};
    globais().forEach(function (w) {
      CX.caixaPorAtivo(w.id).forEach(function (a) {
        var key = a.ativo;
        if (!mapa[key]) mapa[key] = { ativo: key, nome: a.nome || key, thumb: a.thumb || "", usd: 0, qtd: 0 };
        if (!mapa[key].thumb && a.thumb) mapa[key].thumb = a.thumb;
        if (!mapa[key].nome && a.nome) mapa[key].nome = a.nome;
        mapa[key].usd += Number(a.usd) || 0;
        mapa[key].qtd += Number(a.qtd) || 0;
      });
    });

    var lista = Object.keys(mapa).map(function (k) {
      var base = Math.round(mapa[k].usd * 1e6) / 1e6;
      var q = Math.round(mapa[k].qtd * 1e8) / 1e8;
      var m = valorMercadoAtivoCaixa({ ativo: mapa[k].ativo, usd: base, qtd: q });
      return {
        ativo: mapa[k].ativo,
        nome: mapa[k].nome || mapa[k].ativo,
        thumb: mapa[k].thumb || "",
        usdBase: base,
        usd: Math.round(m * 1e6) / 1e6,
        qtd: q
      };
    }).filter(function (a) {
      return Math.abs(a.usd) > 1e-6 || Math.abs(a.qtd) > 1e-8;
    }).sort(function (a, b) {
      return Math.abs(b.usd) - Math.abs(a.usd);
    });
    var totalAtivos = lista.reduce(function (s, x) { return s + (Number(x.usd) || 0); }, 0);

    if (!lista.length) {
      host.innerHTML = '<div class="cx-vazio">Sem dinheiro parado em caixa por ativo.<br>' +
        'Deposite para começar a separar o caixa das posições.</div>';
      return;
    }

    host.innerHTML =
      '<div class="cx-assets-table">' +
        '<div class="cx-assets-head">' +
          '<span>Asset</span><span>Value/Balance</span><span>Price</span><span>Allocation</span><span>Actions</span>' +
        '</div>' +
        lista.map(function (a) {
          var temQtd = Math.abs(a.qtd) > 1e-8;
          var preco = precoLinha(a);
          var p = pct(a.usd, totalAtivos);
          return '<div class="cx-asset-row">' +
            '<div class="cx-asset-col cx-asset-col--asset">' +
              badgeAtivo(a) +
              '<div class="cx-asset-col__stack">' +
                '<strong>' + esc(a.ativo) + '</strong>' +
                '<span>' + esc(a.nome && a.nome !== a.ativo ? a.nome : "Token em caixa") + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="cx-asset-col">' +
              '<strong>' + money(a.usd) + '</strong>' +
              '<span>' + (temQtd ? qtd(a.qtd) + " " + esc(a.ativo) : "—") + '</span>' +
            '</div>' +
            '<div class="cx-asset-col">' +
              '<strong>' + (preco != null ? money(preco) : "—") + '</strong>' +
              '<span>preço atual</span>' +
            '</div>' +
            '<div class="cx-asset-col">' +
              '<strong>' + p.toFixed(1) + '%</strong>' +
              '<span>do caixa por ativo</span>' +
            '</div>' +
            '<div class="cx-asset-col cx-asset-col--action">' +
              '<a class="cx-pill-btn" href="trade/index.html">Trade</a>' +
            '</div>' +
          '</div>';
        }).join("") +
      '</div>';
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
          esc(w.name) + ' — ' + money(caixaMercadoDaCarteira(w.id)) + ' em caixa</option>';
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

  function numeroOpcionalDe(id) {
    var el = qs("#" + id);
    if (!el) return null;
    var bruto = String(el.value || "").trim();
    if (!bruto) return null;
    var v = parseFloat(bruto.replace(",", "."));
    return isFinite(v) ? v : NaN;
  }

  function lerAtivo(id, padrao) {
    var el = qs("#" + id);
    var digitado = textoDe(id).toUpperCase();
    var symbol = digitado || (padrao != null ? String(padrao).toUpperCase() : "");
    var escolhido = el ? String(el.dataset.assetSymbol || "").toUpperCase() : "";
    var mesmaEscolha = !!escolhido && escolhido === symbol;
    return {
      symbol: symbol,
      name: (el && mesmaEscolha) ? (el.dataset.assetName || null) : null,
      thumb: (el && mesmaEscolha) ? (el.dataset.assetThumb || null) : null
    };
  }

  var _autoValorTimer = null;
  var _autoValorReq = 0;
  var _autoValorUltimo = "";

  function formatarUSDInput(v) {
    var n = Number(v);
    if (!isFinite(n) || n <= 0) return "";
    var dec = n >= 1000 ? 2 : n >= 1 ? 4 : 6;
    var p = Math.pow(10, dec);
    return String(Math.round(n * p) / p);
  }

  function precoDe(simbolo) {
    var s = String(simbolo || "").trim().toUpperCase();
    if (!s) return Promise.resolve(null);
    if (window.AtlasPrecos && AtlasPrecos.de) {
      return AtlasPrecos.de(s).then(function (r) {
        return (r && typeof r.usd === "number" && isFinite(r.usd) && r.usd > 0) ? r.usd : null;
      }).catch(function () { return null; });
    }
    if (window.AtlasTokens && AtlasTokens.cgId && window.AtlasAssets && AtlasAssets.price) {
      var id = AtlasTokens.cgId(s);
      if (!id) return Promise.resolve(null);
      return AtlasAssets.price(id).then(function (usd) {
        return (typeof usd === "number" && isFinite(usd) && usd > 0) ? usd : null;
      }).catch(function () { return null; });
    }
    return Promise.resolve(null);
  }

  function autoPreencherValorUSD() {
    if (!acaoAtual) return;
    if (acaoAtual !== "deposito" && acaoAtual !== "saque" &&
        acaoAtual !== "transferencia" && acaoAtual !== "swap") return;

    var campoValor = qs("#cxValor");
    if (!campoValor) return;

    var qtdId = acaoAtual === "swap" ? "cxQtd1" : "cxQtd";
    var qtdMov = numeroOpcionalDe(qtdId);
    if (!(qtdMov > 0)) return;

    var ativo = lerAtivo("cxAtivo", "USDT");
    if (!ativo.symbol) return;

    var valorAtual = String(campoValor.value || "").trim();
    if (valorAtual && valorAtual !== _autoValorUltimo) return;

    var req = ++_autoValorReq;
    precoDe(ativo.symbol).then(function (usd) {
      if (req !== _autoValorReq) return;
      if (!(usd > 0)) return;
      var total = formatarUSDInput(qtdMov * usd);
      if (!total) return;
      campoValor.value = total;
      _autoValorUltimo = total;
    });
  }

  function agendarAutoPreencherValorUSD() {
    clearTimeout(_autoValorTimer);
    _autoValorTimer = setTimeout(autoPreencherValorUSD, 220);
  }

  function ligarAutoPreencherValorUSD() {
    var campoValor = qs("#cxValor");
    if (!campoValor) return;
    _autoValorUltimo = String(campoValor.value || "").trim();

    var qtd1 = qs("#cxQtd");
    var qtd2 = qs("#cxQtd1");
    var ativo = qs("#cxAtivo");
    [qtd1, qtd2, ativo].forEach(function (el) {
      if (!el) return;
      el.addEventListener("input", agendarAutoPreencherValorUSD);
      el.addEventListener("change", agendarAutoPreencherValorUSD);
    });
  }

  function ligarAutocompleteAtivos() {
    if (!window.AtlasAssets || !AtlasAssets.attach) return;
    ["cxAtivo", "cxAtivo2"].forEach(function (id) {
      var el = qs("#" + id);
      if (!el) return;
      AtlasAssets.attach(el, {
        value: "symbol",
        onSelect: function (coin, input) {
          if (!input || !coin) return;
          input.dataset.assetSymbol = String(coin.symbol || "").toUpperCase();
          input.dataset.assetName = String(coin.name || "");
          input.dataset.assetThumb = String(coin.thumb || "");
          agendarAutoPreencherValorUSD();
        }
      });
      el.addEventListener("input", function () {
        var current = String(el.value || "").trim().toUpperCase();
        var chosen = String(el.dataset.assetSymbol || "").toUpperCase();
        if (current !== chosen) {
          el.dataset.assetSymbol = "";
          el.dataset.assetName = "";
          el.dataset.assetThumb = "";
        }
        agendarAutoPreencherValorUSD();
      });
    });
  }

  var FORMS = {
    deposito: function () {
      return campo("Carteira de destino", '<select id="cxW">' + opcoesCarteira(W.activeGlobalId()) + '</select>',
                   "Não achou a carteira? Crie em qualquer seletor de carteira do ATLAS.") +
             campo("Ativo", '<input id="cxAtivo" value="USDT" data-atlas-asset="symbol" />',
                   "O caixa é dinheiro parado — normalmente USDT ou USDC.") +
             campo("Quantidade (opcional)", '<input id="cxQtd" type="number" step="any" min="0" placeholder="0" />',
                   "Use quando quiser acompanhar a quantidade por token no caixa.") +
             campo("Valor (US$)", '<input id="cxValor" type="number" step="any" min="0" placeholder="0,00" />') +
             campo("Data", '<input id="cxData" type="date" value="' + hoje() + '" />') +
             campo("Observação", '<input id="cxObs" placeholder="opcional" />') +
             '<div class="cx-dica">Depósito é a única entrada de dinheiro novo no ATLAS. ' +
             'Ele <b>aumenta</b> o patrimônio total.</div>';
    },
    saque: function () {
      return campo("Carteira de origem", '<select id="cxW">' + opcoesCarteira(W.activeGlobalId()) + '</select>') +
             campo("Ativo", '<input id="cxAtivo" value="USDT" data-atlas-asset="symbol" />') +
             campo("Quantidade (opcional)", '<input id="cxQtd" type="number" step="any" min="0" placeholder="0" />',
                   "Use quando o saque for de um token específico do caixa.") +
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
             campo("Ativo", '<input id="cxAtivo" value="USDT" data-atlas-asset="symbol" />') +
             campo("Quantidade (opcional)", '<input id="cxQtd" type="number" step="any" min="0" placeholder="0" />') +
             campo("Valor (US$)", '<input id="cxValor" type="number" step="any" min="0" placeholder="0,00" />') +
             campo("Data", '<input id="cxData" type="date" value="' + hoje() + '" />') +
             campo("Observação", '<input id="cxObs" placeholder="opcional" />') +
             '<div class="cx-dica">Transferência <b>não muda</b> o patrimônio total — só a distribuição.</div>';
    },
    swap: function () {
      return campo("Carteira", '<select id="cxW">' + opcoesCarteira(W.activeGlobalId()) + '</select>') +
             campo("De", '<input id="cxAtivo" placeholder="USDT" data-atlas-asset="symbol" />') +
             campo("Quantidade enviada", '<input id="cxQtd1" type="number" step="any" min="0" placeholder="0" />') +
             campo("Para", '<input id="cxAtivo2" placeholder="SOL" data-atlas-asset="symbol" />') +
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
    ligarAutocompleteAtivos();
    ligarAutoPreencherValorUSD();
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

    var ativoOrigem = lerAtivo("cxAtivo", "USDT");
    var qtdBase = numeroOpcionalDe("cxQtd");
    if (qtdBase !== null && !(qtdBase > 0)) { toast("Quantidade inválida.", "warn"); return; }

    var ev = {
      tipo: acaoAtual,
      valorUSD: valor,
      walletId: wid,
      data: textoDe("cxData"),
      ativo: ativoOrigem.symbol,
      ativoNome: ativoOrigem.name,
      ativoThumb: ativoOrigem.thumb,
      qtd: qtdBase,
      obs: textoDe("cxObs")
    };

    if (acaoAtual === "transferencia") {
      ev.contraWalletId = textoDe("cxW2");
      if (!ev.contraWalletId) { toast("Escolha a carteira de destino.", "warn"); return; }
      if (ev.contraWalletId === wid) { toast("Origem e destino são a mesma carteira.", "warn"); return; }
    }
    if (acaoAtual === "swap") {
      var ativoDestino = lerAtivo("cxAtivo2", "");
      var qtdOrigem = numeroOpcionalDe("cxQtd1");
      var qtdDestino = numeroOpcionalDe("cxQtd2");
      if (qtdOrigem !== null && !(qtdOrigem > 0)) { toast("Quantidade enviada inválida.", "warn"); return; }
      if (qtdDestino !== null && !(qtdDestino > 0)) { toast("Quantidade recebida inválida.", "warn"); return; }
      ev.ativoDestino = ativoDestino.symbol;
      ev.ativoDestinoNome = ativoDestino.name;
      ev.ativoDestinoThumb = ativoDestino.thumb;
      ev.qtdOrigem = qtdOrigem;
      ev.qtdDestino = qtdDestino;
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
     ABERTURA DE SALDO

     As posições do usuário são anteriores ao livro de caixa. Sem um
     registro da entrada delas, o primeiro encerramento credita o caixa
     sem nunca ter debitado — e o patrimônio passa a contradizer o
     "depositado − sacado" sem que nada tenha rendido.

     A faixa mostra o que a migração VAI fazer antes de fazer. Uma
     correção de contabilidade aplicada em silêncio é uma mudança que
     ninguém consegue conferir depois.
     ============================================================ */
  function pintarMigracao() {
    var host = qs("#cxMigracao");
    if (!host) return;
    var M = window.AtlasCaixaMigracao;
    if (!M || !M.pendente || !M.pendente()) { host.innerHTML = ""; return; }

    var p = M.previa();
    if (!p || !p.posicoes) { host.innerHTML = ""; return; }

    host.innerHTML =
      '<div class="panel" style="margin-bottom:20px;border-color:rgba(94,234,212,.28)">' +
        '<div style="padding:16px 18px">' +
          '<div class="eyebrow">Abertura de saldo</div>' +
          '<h2 style="margin:2px 0 8px">O livro de caixa começa hoje, suas posições não</h2>' +
          '<p class="cx-linha__sub" style="margin:0 0 12px;font-size:12.5px;line-height:1.65">' +
            'Encontrei <b>' + p.posicoes + ' posição(ões)</b> abertas, somando <b>' +
            money(p.total) + '</b> de capital, criadas antes deste livro existir. ' +
            'Sem registrá-las, a primeira que você fechar vai <b>creditar</b> o caixa sem ' +
            'nunca ter <b>debitado</b>.<br><br>' +
            'A abertura registra um depósito com esse valor e, junto, o aporte de cada ' +
            'posição — o caixa termina em <b>zero</b>, que é o estado de quem está com tudo ' +
            'alocado. Nenhum dinheiro é criado: o capital já está gravado em cada módulo, ' +
            'o que faltava era o registro da entrada dele.' +
            (p.posicoes ? '' : '') +
          '</p>' +
          '<div class="cx-taxa__acoes" style="margin:0">' +
            '<button type="button" class="cx-btn cx-btn--in" id="cxMigrar">Registrar abertura de ' + money(p.total) + '</button>' +
            '<button type="button" class="cx-btn" id="cxMigrarNao">Agora não</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var b = qs("#cxMigrar");
    if (b) b.addEventListener("click", function () {
      var r = M.migrar();
      if (!r.ok) { toast(r.motivo || "Não consegui registrar a abertura.", "warn"); return; }
      toast("Abertura registrada: " + money(r.total) + " em " + r.posicoes +
            " posição(ões), " + r.carteiras + " carteira(s).", "ok");
      render();
    });
    var n = qs("#cxMigrarNao");
    if (n) n.addEventListener("click", function () { host.innerHTML = ""; });
  }

  function atualizarPrecosCaixa() {
    var simbolos = simbolosCaixaGlobais();
    if (!simbolos.length || !window.AtlasPrecos || !AtlasPrecos.deVarios) {
      precosCaixa = {};
      return Promise.resolve({ atualizados: 0 });
    }
    return AtlasPrecos.deVarios(simbolos).then(function (r) {
      precosCaixa = (r && r.valores) ? r.valores : {};
      return r;
    });
  }

  function atualizarPatrimonioAoEntrar() {
    if (atualizacaoPatrimonio) return atualizacaoPatrimonio;
    var walletIds = globais().map(function (w) { return w.id; });
    var tarefas = [atualizarPrecosCaixa()];
    /* Também abastece o cache central de caixa a mercado, para o chip do
       header desta página mostrar o mesmo valor de mercado que os cards. */
    if (window.AtlasConsolidation && AtlasConsolidation.atualizarCaixa) tarefas.push(AtlasConsolidation.atualizarCaixa());
    if (window.Store && window.Store.actions && window.Store.actions.refreshPrices) tarefas.push(window.Store.actions.refreshPrices());
    if (window.AtlasConsolidation && window.AtlasConsolidation.cotarDeFi) tarefas.push(Promise.resolve(window.AtlasConsolidation.cotarDeFi()));
    if (window.RWAStore && window.RWAStore.refreshPrices) tarefas.push(window.RWAStore.refreshPrices({ walletIds: walletIds }));

    atualizacaoPatrimonio = Promise.allSettled(tarefas).then(function () {
      render();
    }).finally(function () {
      atualizacaoPatrimonio = null;
    });
    return atualizacaoPatrimonio;
  }

  /* ============================================================
     MONTAGEM
     ============================================================ */
  function render() {
    safePaint("migracao", pintarMigracao);
    if (guiaAtual === "taxas") { safePaint("taxas", pintarTaxas); return; }
    safePaint("hero", pintarHero);
    safePaint("distribuicao", pintarDistribuicao);
    safePaint("carteiras", pintarCarteiras);
    safePaint("ativos-parados", pintarAtivosParados);
    safePaint("filtro", pintarFiltro);
    safePaint("extrato", pintarExtrato);
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

  /* Seletor de carteira ativa, ao lado da barra de ações. Reaproveita
     o componente central (/wallets/walletSelector.js) — a mesma
     convenção do Dashboard: escolher aqui chama setActiveGlobal, e o
     afterChange repinta esta tela. Montado UMA vez (fora do render, que
     roda a cada mudança). */
  (function montarSeletor() {
    var host = qs("#cxWalletSel");
    if (!host || !window.WalletSelector) return;
    WalletSelector.render(host, {
      module: "atlas",
      scope: "module",
      afterChange: function () { render(); }
    });
  })();

  /* trocar de carteira em qualquer aba redesenha aqui */
  if (W.subscribe) W.subscribe(render);
  if (CX.subscribe) CX.subscribe(render);

  render();
  atualizarPatrimonioAoEntrar();
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) atualizarPatrimonioAoEntrar();
  });

  window.AtlasCarteirasUI = { render: render };
})();
