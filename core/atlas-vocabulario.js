/* ============================================================
   ATLAS · core/atlas-vocabulario.js
   ------------------------------------------------------------
   O VOCABULÁRIO DO ORÁCULO — pergunta vira consulta estruturada.

   POR QUE ISTO EXISTE
   -------------------
   O Oráculo respondia por uma cadeia de `if (/regex/)`. Cada padrão
   levava a uma resposta pronta, e isso tem um teto intransponível:
   uma expressão regular reconhece UMA dimensão. "Quanto rendi em pool
   no mês passado na carteira Principal" tem quatro — métrica, módulo,
   período e carteira — e nenhuma cadeia de `if` cruza as quatro sem
   virar uma combinatória impossível de manter.

   Aqui a pergunta é DECOMPOSTA antes de ser respondida:

     "quanto rendi em pool no mês passado na Principal"
        → { metrica: "resultado", modulo: "defi",
            periodo: {de:"2026-07-01", ate:"2026-07-31"},
            carteira: "principal" }

   E aí uma função por métrica responde, recebendo os filtros já
   resolvidos. Acrescentar um período novo não mexe nas métricas;
   acrescentar uma métrica não mexe nos períodos. É a diferença entre
   somar e multiplicar trabalho.

   CARTEIRA É UMA DIMENSÃO DE PRIMEIRA CLASSE
   ------------------------------------------
   O ATLAS é multi-carteira desde sempre, e o Oráculo respondia sempre
   pelo consolidado — "quanto tenho na Principal?" e "quanto tenho na
   Reserva?" davam a mesma resposta. Aqui o nome da carteira é
   reconhecido no texto, com acento e caixa normalizados e
   correspondência parcial, porque ninguém digita "Carteira Principal
   de Longo Prazo" por exteso.

   ESTE ARQUIVO NÃO DESENHA NADA
   -----------------------------
   Ele não conhece o painel do Oráculo, não monta HTML e não depende
   de tela. Recebe texto, devolve texto — o que o torna testável na
   bateria (defi/testes.html) como qualquer conta de dinheiro.

   Exposto em: window.AtlasVocabulario
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasVocabulario) return;

  /* ============================================================
     NORMALIZAÇÃO
     ============================================================ */

  /* Minúsculas e SEM acento, para "posição", "Posicao" e "POSIÇÃO"
     casarem com o mesmo termo.

     Os diacríticos são escritos como ̀-ͯ e não como os
     caracteres literais: combinantes não têm forma própria no fonte —
     eles se grudam na letra anterior — e quem abrir o arquivo depois
     não teria como saber o que a expressão está casando. A bateria de
     testes já registra a mesma armadilha com o espaço não separável. */
  function limpar(s) {
    var t = String(s == null ? "" : s).toLowerCase();
    return t.normalize ? t.normalize("NFD").replace(/[̀-ͯ]/g, "") : t;
  }

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  function dia(d) {
    var mm = String(d.getMonth() + 1), dd = String(d.getDate());
    return d.getFullYear() + "-" + (mm.length < 2 ? "0" + mm : mm) +
           "-" + (dd.length < 2 ? "0" + dd : dd);
  }

  /* ============================================================
     DIMENSÃO 1 — MÉTRICA

     Cada métrica lista os termos que a invocam. A ordem importa:
     `ordem` menor é avaliada primeiro, para "quanto tenho em caixa"
     não cair em patrimônio só porque contém "quanto".
     ============================================================ */
  var METRICAS = [
    { id: "caixa",      ordem: 1, termos: ["caixa", "disponivel", "disponiveis", "livre", "parado", "sobrou", "cash"] },
    { id: "taxas",      ordem: 2, termos: ["taxa", "taxas", "rendimento", "recompensa", "juros", "fee", "fees", "apr", "apy"] },
    /* "lucr" e as formas de "render" por extenso: só "lucro" e "rendi"
       deixavam "quanto lucrei no trade?" e "quanto rendeu minha pool?"
       sem métrica — e sem métrica o filtro de módulo se perdia, e a
       resposta vinha do consolidado. */
    { id: "resultado",  ordem: 3, termos: ["resultado", "lucr", "prejuizo", "pnl", "rendi", "rendeu", "renderam", "rende ", "rentab", "ganho", "ganhei", "perdi", "perda", "performance"] },
    { id: "movimentos", ordem: 4, termos: ["movimento", "movimentacao", "movimentacoes", "extrato", "fluxo", "entrada", "entradas", "saida", "saidas", "deposito", "depositos", "saque", "saques", "transferencia", "aporte"] },
    { id: "posicoes",   ordem: 5, termos: ["posicao", "posicoes", "aberta", "abertas", "alocado", "investido", "aplicado"] },
    { id: "teses",      ordem: 6, termos: ["tese", "teses", "estudo", "estudos"] },
    { id: "patrimonio", ordem: 7, termos: ["patrimonio", "quanto tenho", "quanto eu tenho", "total", "vale", "worth", "saldo"] }
  ];

  /* ============================================================
     DIMENSÃO 2 — MÓDULO

     Inclui o vocabulário do usuário, não só o nome do módulo: quem
     tem uma pool diz "pool", não "DeFi".
     ============================================================ */
  var MODULOS = [
    { id: "defi",  termos: ["defi", "pool", "pools", "liquidez", "staking", "lending", "emprestimo"] },
    { id: "trade", termos: ["trade", "trades", "operacao", "operacoes", "swing", "day"] },
    { id: "hold",  termos: ["hold", "longo prazo", "carteira longa"] },
    { id: "rwa",   termos: ["rwa", "ativo real", "ativos reais", "tokenizad", "acao tokenizada"] }
  ];

  var NOME_MODULO = { defi: "DeFi", trade: "Trade", hold: "Hold", rwa: "RWA" };

  /* ============================================================
     DIMENSÃO 3 — PERÍODO

     Devolve { de, ate, rotulo } ou null quando a pergunta não cita
     período — e null é resposta legítima: significa "desde sempre",
     que é o padrão certo para patrimônio e caixa.
     ============================================================ */
  var MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho",
               "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  function periodoDe(q) {
    var hoje = new Date();
    var y = hoje.getFullYear(), m = hoje.getMonth();

    function faixa(ini, fim, rotulo) { return { de: dia(ini), ate: dia(fim), rotulo: rotulo }; }

    if (/\bhoje\b/.test(q)) return faixa(hoje, hoje, "hoje");
    if (/\bontem\b/.test(q)) {
      var o = new Date(hoje); o.setDate(o.getDate() - 1);
      return faixa(o, o, "ontem");
    }
    if (/mes passado|ultimo mes|mes anterior/.test(q)) {
      return faixa(new Date(y, m - 1, 1), new Date(y, m, 0), "no mês passado");
    }
    if (/este mes|neste mes|mes atual|do mes\b/.test(q)) {
      return faixa(new Date(y, m, 1), hoje, "neste mês");
    }
    if (/ano passado|ultimo ano/.test(q)) {
      return faixa(new Date(y - 1, 0, 1), new Date(y - 1, 11, 31), "no ano passado");
    }
    if (/este ano|neste ano|ano atual|no ano\b/.test(q)) {
      return faixa(new Date(y, 0, 1), hoje, "neste ano");
    }
    if (/semana/.test(q)) {
      var s = new Date(hoje); s.setDate(s.getDate() - 7);
      return faixa(s, hoje, "nos últimos 7 dias");
    }

    /* "últimos 30 dias", "nos últimos 90 dias" */
    var mDias = q.match(/ultimos?\s+(\d{1,4})\s*dias?/);
    if (mDias) {
      var n = parseInt(mDias[1], 10);
      var d0 = new Date(hoje); d0.setDate(d0.getDate() - n);
      return faixa(d0, hoje, "nos últimos " + n + " dias");
    }

    /* mês por nome: "em agosto", "em março de 2025" */
    for (var i = 0; i < MESES.length; i++) {
      if (q.indexOf(MESES[i]) === -1) continue;
      var mAno = q.match(/(\d{4})/);
      var ano = mAno ? parseInt(mAno[1], 10) : y;
      return faixa(new Date(ano, i, 1), new Date(ano, i + 1, 0),
                   "em " + MESES[i] + " de " + ano);
    }

    var mAnoSo = q.match(/\bem\s+(\d{4})\b|\bde\s+(\d{4})\b/);
    if (mAnoSo) {
      var a2 = parseInt(mAnoSo[1] || mAnoSo[2], 10);
      return faixa(new Date(a2, 0, 1), new Date(a2, 11, 31), "em " + a2);
    }

    return null;
  }

  /* ============================================================
     DIMENSÃO 4 — CARTEIRA

     O ATLAS é multi-carteira desde sempre, e o Oráculo respondia
     sempre pelo consolidado. Aqui o nome é procurado no texto.

     Correspondência por PALAVRA INTEIRA, da mais longa para a mais
     curta: com carteiras "Reserva" e "Reserva Longa", perguntar pela
     segunda não pode casar com a primeira. E nomes muito curtos (uma
     ou duas letras) são ignorados — casariam com qualquer coisa.
     ============================================================ */
  function carteiraDe(q) {
    return carteirasDe(q)[0] || null;
  }

  /* TODAS as carteiras citadas, na ordem em que aparecem no texto.
     "compara a M4P com a M1P" tem duas, e a resposta é uma comparação.

     Da mais longa para a mais curta, e o trecho casado é APAGADO antes
     da próxima busca: com "Reserva" e "Reserva Longa", a pergunta pela
     segunda não pode casar também com a primeira. */
  function carteirasDe(q) {
    var W = global.AtlasWallets;
    if (!W || !W.all) return [];
    var todas;
    try { todas = W.all() || []; } catch (e) { return []; }

    var cands = todas.map(function (w) { return { w: w, n: limpar(w.name) }; })
                     .filter(function (c) { return c.n.length > 2; })
                     .sort(function (a, b) { return b.n.length - a.n.length; });

    var resto = " " + q + " ", achadas = [];
    cands.forEach(function (c) {
      var alvo = c.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      var rx = new RegExp("(^|\\W)" + alvo + "($|\\W)");
      var m = resto.match(rx);
      if (!m) return;
      /* Nome repetido (duas "M3p"): o texto não diz de qual se fala.
         Todas as homônimas entram, marcadas, e a resposta pede para
         renomear em vez de escolher uma em silêncio. */
      var iguais = cands.filter(function (o) { return o.n === c.n; });
      iguais.forEach(function (o, k) {
        achadas.push({ w: o.w, pos: m.index + k / 100, ambigua: iguais.length > 1, ordem: k });
      });
      resto = resto.slice(0, m.index) + " " + new Array(m[0].length).join("#") + resto.slice(m.index + m[0].length);
    });
    /* homônimas já entraram juntas; não voltam a casar na próxima volta */
    var vistos = {};
    return achadas.sort(function (a, b) { return a.pos - b.pos; })
      .filter(function (x) { if (vistos[x.w.id]) return false; vistos[x.w.id] = 1; return true; })
      .map(function (x) { var w = Object.create(x.w); w.__ambigua = x.ambigua; w.__ordem = x.ordem; return w; });
  }

  function refCarteira(w) {
    return { id: w.id, nome: w.name, tipo: w.type === "isolada" ? "isolada" : "global", modulo: w.module || null,
             ambigua: !!w.__ambigua, ordem: w.__ordem || 0 };
  }

  /* "qual carteira tem mais?", "compara as carteiras", "por carteira" */
  var RX_COMPARAR = /compar|versus|\bvs\b|diferenca entre|qual (a |das )?carteira|quais (das )?carteiras|ranking|por carteira|cada carteira|todas as carteiras/;

  /* ============================================================
     INTERPRETAÇÃO
     ============================================================ */
  function interpretar(pergunta) {
    var q = limpar(pergunta);

    var metrica = null, melhor = 999;
    METRICAS.forEach(function (m) {
      if (m.ordem >= melhor) return;
      for (var i = 0; i < m.termos.length; i++) {
        if (q.indexOf(m.termos[i]) !== -1) { metrica = m.id; melhor = m.ordem; return; }
      }
    });

    var modulo = null;
    for (var i = 0; i < MODULOS.length && !modulo; i++) {
      for (var j = 0; j < MODULOS[i].termos.length; j++) {
        if (q.indexOf(MODULOS[i].termos[j]) !== -1) { modulo = MODULOS[i].id; break; }
      }
    }

    var carteiras = carteirasDe(q).map(refCarteira);
    var comparar = carteiras.length > 1 || RX_COMPARAR.test(q);

    /* Carteira citada sem assunto — "o que tem na M4P?", "e a M1P?" —
       é pergunta pelo que há nela. `metricaPadrao` marca que o assunto
       foi SUPOSTO: numa continuação ("quanto rendeu a M4P?" → "e a
       M1P?") o assunto da pergunta anterior tem de prevalecer. */
    var metricaPadrao = false;
    if (!metrica && (carteiras.length || comparar)) { metrica = "patrimonio"; metricaPadrao = true; }

    return {
      metrica: metrica,
      metricaPadrao: metricaPadrao,
      modulo: modulo,
      periodo: periodoDe(q),
      carteira: carteiras[0] || null,
      carteiras: carteiras,
      comparar: comparar,
      /* quantas dimensões foram reconhecidas — a tela usa para decidir
         se entendeu o suficiente para responder */
      dimensoes: (metrica && !metricaPadrao ? 1 : 0) + (modulo ? 1 : 0) + (carteiras.length ? 1 : 0)
    };
  }

  /* ============================================================
     RESOLUÇÃO — uma função por métrica, filtros já resolvidos

     Nenhuma delas sabe interpretar texto: recebem {modulo, carteira,
     periodo} prontos. É isso que faz acrescentar um período novo não
     encostar em nenhuma métrica, e vice-versa.

     Todas devolvem null quando não têm como responder — a tela cai no
     comportamento anterior em vez de inventar.
     ============================================================ */

  function dinheiro(v) {
    if (global.AtlasCurrency) return global.AtlasCurrency.format(v);
    return "US$ " + num(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* Carteiras que a consulta alcança: a citada, ou todas as globais. */
  function carteirasDa(c) {
    var W = global.AtlasWallets;
    if (c) return [c.id];
    if (W && W.globals) { try { return W.globals().map(function (w) { return w.id; }); } catch (e) {} }
    return ["principal"];
  }

  function onde(c, modulo) {
    var p = [];
    if (modulo) p.push("em " + (NOME_MODULO[modulo] || modulo));
    if (c) p.push("na carteira " + c.nome);
    return p.length ? " " + p.join(" ") : "";
  }

  /* ------------------------------------------------------------
     AS MESMAS FONTES DO DASHBOARD

     Caixa a MERCADO (caixaMercadoDe), não AtlasCaixa.saldo(), que é o
     custo do depósito: com SOL parado, o Oráculo dizia um número e o
     seletor de carteira, ao lado, outro. Resultado pela regra de cada
     módulo (AtlasConsolidation.resultadoDe), a mesma soma que forma o
     "Lucro Total". Sem a consolidação na página, cai no que existe.
     ------------------------------------------------------------ */
  var MODS = ["hold", "trade", "defi", "rwa"];

  function C() { return global.AtlasConsolidation || null; }

  function caixaDe(id) {
    var c = C();
    if (c && c.caixaMercadoDe) return num(c.caixaMercadoDe(id));
    return global.AtlasCaixa ? num(global.AtlasCaixa.saldo(id)) : 0;
  }

  function valorDe(id, m) {
    var c = C();
    if (c && c.valorDe) { var v = c.valorDe(id, m); if (v != null) return num(v); }
    var W = global.AtlasWallets;
    return (W && W.balanceOf) ? num(W.balanceOf(id, m)) : 0;
  }

  function capitalDe(id, m) {
    var c = C();
    if (c && c.capitalDe) { var v = c.capitalDe(id, m); if (v != null) return num(v); }
    var W = global.AtlasWallets;
    return (W && W.capitalOf) ? num(W.capitalOf(id, m)) : 0;
  }

  /* null quando nenhum módulo pedido está carregado nesta página */
  function resultadoAbertoDe(id, modulo) {
    var c = C();
    if (!c || !c.resultadoDe) return null;
    var soma = 0, algum = false;
    MODS.forEach(function (m) {
      if (modulo && m !== modulo) return;
      var v = c.resultadoDe(id, m);
      if (v != null) { algum = true; soma += v; }
    });
    return algum ? soma : null;
  }

  function sinalDe(v) { return (v >= 0 ? "+" : "−") + dinheiro(Math.abs(v)); }

  function notaLocal(c) {
    if (!c || c.tipo !== "isolada") return "";
    return " (carteira local" + (c.modulo ? " do " + (NOME_MODULO[c.modulo] || c.modulo) : "") +
           " — não soma no patrimônio total)";
  }

  /* Uma carteira em números, filtrada por módulo quando pedido. Base de
     patrimônio, caixa, resultado e da comparação — uma leitura só. */
  function numerosDa(id, modulo) {
    var porModulo = {}, posic = 0, capital = 0;
    MODS.forEach(function (m) {
      if (modulo && m !== modulo) return;
      var v = valorDe(id, m);
      capital += capitalDe(id, m);
      if (!v) return;
      porModulo[m] = v;
      posic += v;
    });
    var caixa = modulo ? 0 : caixaDe(id);
    return { caixa: caixa, posic: posic, total: caixa + posic, porModulo: porModulo,
             capital: capital, resultado: resultadoAbertoDe(id, modulo) };
  }

  function listaDe(Q) {
    if (Q.carteiras && Q.carteiras.length) return Q.carteiras;
    return Q.carteira ? [Q.carteira] : [];
  }

  var RESOLVE = {

    caixa: function (Q) {
      if (!global.AtlasCaixa) return null;
      var ids = carteirasDa(Q.carteira);
      var total = 0, det = [];
      ids.forEach(function (id) {
        var s = caixaDe(id);
        total += s;
        var w = global.AtlasWallets && global.AtlasWallets.get ? global.AtlasWallets.get(id) : null;
        if (s !== 0 && w) det.push(w.name + " " + dinheiro(s));
      });
      /* Módulo não filtra caixa: dinheiro parado não pertence a módulo
         nenhum — é justamente o que ainda não foi alocado. Dizer isso
         é melhor que responder o consolidado como se filtrasse. */
      var nota = Q.modulo
        ? " (o caixa não é de módulo nenhum — é o que ainda não foi alocado)"
        : "";
      return "Caixa disponível" + (Q.carteira ? " na carteira " + Q.carteira.nome : "") +
             ": " + dinheiro(total) +
             (!Q.carteira && det.length > 1 ? " — " + det.join(", ") : "") + nota +
             notaLocal(Q.carteira) + ".";
    },

    patrimonio: function (Q) {
      var W = global.AtlasWallets;
      if (!W || !W.balanceOf) return null;
      var ids = carteirasDa(Q.carteira);
      var caixa = 0, posic = 0, porModulo = {};

      ids.forEach(function (id) {
        /* Filtrado por módulo, o caixa não entra: ele não é do módulo. */
        var nd = numerosDa(id, Q.modulo);
        caixa += nd.caixa;
        posic += nd.posic;
        Object.keys(nd.porModulo).forEach(function (m) {
          porModulo[m] = (porModulo[m] || 0) + nd.porModulo[m];
        });
      });

      var total = caixa + posic;
      if (!total) {
        return "Nada registrado" + onde(Q.carteira, Q.modulo) + " ainda." + notaLocal(Q.carteira);
      }

      var partes = Object.keys(porModulo).map(function (m) {
        return (NOME_MODULO[m] || m) + " " + dinheiro(porModulo[m]);
      });
      if (!Q.modulo && caixa) partes.unshift("caixa " + dinheiro(caixa));

      return "Patrimônio" + onde(Q.carteira, Q.modulo) + ": " + dinheiro(total) +
             (partes.length > 1 ? " — " + partes.join(", ") : "") + "." + notaLocal(Q.carteira);
    },

    /* ------------------------------------------------------------
       COMPARAR CARTEIRAS

       "compara a M4P com a M1P", "qual carteira tem mais?", "qual
       carteira rende mais no DeFi?". Sem carteira citada, entram
       TODAS — as locais também, marcadas, porque a pergunta é sobre
       elas, não sobre o patrimônio total.

       Rendimento é comparado em PORCENTAGEM do capital: US$ 50 sobre
       US$ 100 rende mais que US$ 80 sobre US$ 10.000, e ordenar pelo
       valor em dólar premiaria a carteira maior, não a melhor.
       ------------------------------------------------------------ */
    comparar: function (Q) {
      var W = global.AtlasWallets;
      if (!W || !W.all) return null;
      var alvo = listaDe(Q);
      if (alvo.length < 2) {
        try { alvo = (W.all() || []).map(refCarteira); } catch (e) { return null; }
      }
      if (!alvo.length) return "Nenhuma carteira cadastrada.";

      var porResultado = Q.metrica === "resultado";
      var linhas = alvo.map(function (c) {
        var nd = numerosDa(c.id, Q.modulo);
        var valor = Q.metrica === "caixa" ? nd.caixa
                  : Q.metrica === "posicoes" ? nd.posic
                  : porResultado ? nd.resultado
                  : nd.total;
        var pct = (porResultado && nd.capital > 0 && nd.resultado != null)
          ? (nd.resultado / nd.capital) * 100 : null;
        return { c: c, valor: valor, pct: pct, nd: nd };
      });

      if (porResultado && linhas.every(function (l) { return l.valor == null; })) return null;

      /* Em resultado, quem tem capital (e portanto porcentagem) vem
         antes, ordenado pela porcentagem; carteira só com caixa não tem
         rendimento a comparar e vai para o fim. Misturar as duas réguas
         num comparador só deixaria a ordem dependente da ordem de
         entrada. */
      linhas.sort(function (a, b) {
        if (porResultado) {
          var ta = a.pct != null ? 0 : 1, tb = b.pct != null ? 0 : 1;
          if (ta !== tb) return ta - tb;
          if (ta === 0) return b.pct - a.pct;
        }
        return num(b.valor) - num(a.valor);
      });

      var rotulo = { caixa: "Caixa", posicoes: "Alocado", resultado: "Resultado" }[Q.metrica] || "Patrimônio";
      var cab = rotulo + " por carteira" + (Q.modulo ? " em " + (NOME_MODULO[Q.modulo] || Q.modulo) : "") + ":";
      var contaNome = {};
      linhas.forEach(function (l) { var k = limpar(l.c.nome); contaNome[k] = (contaNome[k] || 0) + 1; });
      var temRepetido = false;
      var corpo = linhas.map(function (l) {
        var rep = contaNome[limpar(l.c.nome)] > 1;
        if (rep) temRepetido = true;
        var txt = "• " + l.c.nome + (l.c.tipo === "isolada" ? " (local)" : "") + (rep ? " (nome repetido)" : "") + ": ";
        if (porResultado) {
          txt += l.valor == null ? "—" : sinalDe(l.valor) +
                 (l.pct != null ? " (" + (l.pct >= 0 ? "+" : "") + l.pct.toFixed(2).replace(".", ",") + "% sobre " + dinheiro(l.nd.capital) + ")" : "");
        } else {
          txt += dinheiro(num(l.valor));
          var mods = Object.keys(l.nd.porModulo);
          if (!Q.modulo && Q.metrica !== "caixa" && (mods.length || l.nd.caixa)) {
            var p = mods.map(function (m) { return (NOME_MODULO[m] || m) + " " + dinheiro(l.nd.porModulo[m]); });
            if (l.nd.caixa && Q.metrica !== "posicoes") p.unshift("caixa " + dinheiro(l.nd.caixa));
            if (p.length > 1) txt += " — " + p.join(", ");
          }
        }
        return txt;
      });

      var topo = linhas[0];
      var fecho = "";
      if (linhas.length > 1 && topo && num(topo.valor) !== num(linhas[1].valor)) {
        fecho = porResultado
          ? (topo.pct != null ? "Rende mais, em proporção ao capital: " + topo.c.nome + "." : "Maior resultado: " + topo.c.nome + ".")
          : "Maior: " + topo.c.nome + ".";
      }
      var locais = linhas.some(function (l) { return l.c.tipo === "isolada"; })
        ? "Carteiras locais não somam no patrimônio total." : "";
      var aviso = temRepetido ? "Há carteiras com o mesmo nome — renomeie uma delas para distingui-las." : "";
      return [cab].concat(corpo, [fecho, locais, aviso].filter(Boolean)).join("\n");
    },

    posicoes: function (Q) {
      var r = RESOLVE.patrimonio({ carteira: Q.carteira, modulo: Q.modulo || null, periodo: null });
      if (!r) return null;
      return r.replace("Patrimônio", "Alocado em posições");
    },

    /* ------------------------------------------------------------
       Resultado e movimentos saem do MESMO livro (AtlasMovements, que
       é uma vista sobre o caixa) — por isso aceitam período, e as
       outras métricas não. Patrimônio e caixa são fotografias de
       AGORA; perguntar "meu patrimônio no mês passado" exigiria uma
       série medida por carteira, que o ATLAS não guarda. Responder
       assim mesmo seria inventar.
       ------------------------------------------------------------ */
    resultado: function (Q) {
      /* ------------------------------------------------------------
         SEM PERÍODO: o resultado inteiro, pela regra de cada módulo

         Esta métrica contava só "resultado realizado" (movimento de
         encerramento). "Quanto rendeu a M4P no DeFi?", com a pool
         aberta e rendendo, respondia "nenhum resultado" — e o Lucro
         Total do Dashboard, ao lado, mostrava o lucro dela. Agora sem
         período vale a mesma soma do Dashboard (AtlasConsolidation.
         resultadoDe). COM período continua o realizado: resultado de
         posição aberta não tem data em que "aconteceu".
         ------------------------------------------------------------ */
      if (!Q.periodo) {
        var idsR = carteirasDa(Q.carteira);
        var soma = 0, algum = false, cap = 0, porMod = {};
        idsR.forEach(function (id) {
          MODS.forEach(function (m) {
            if (Q.modulo && m !== Q.modulo) return;
            var c = C(); var v = (c && c.resultadoDe) ? c.resultadoDe(id, m) : null;
            if (v == null) return;
            algum = true; soma += v;
            if (v) porMod[m] = (porMod[m] || 0) + v;
          });
          cap += numerosDa(id, Q.modulo).capital;
        });
        if (algum) {
          var partesR = Object.keys(porMod).map(function (m) { return (NOME_MODULO[m] || m) + " " + sinalDe(porMod[m]); });
          var pctR = cap > 0 ? " (" + (soma >= 0 ? "+" : "") + ((soma / cap) * 100).toFixed(2).replace(".", ",") + "% sobre " + dinheiro(cap) + " investidos)" : "";
          if (!soma && !partesR.length) {
            return "Nenhum resultado" + onde(Q.carteira, Q.modulo) + " ainda." + notaLocal(Q.carteira);
          }
          return "Resultado" + onde(Q.carteira, Q.modulo) + ": " + sinalDe(soma) + pctR +
                 (!Q.modulo && partesR.length > 1 ? " — " + partesR.join(", ") : "") + "." + notaLocal(Q.carteira);
        }
      }

      var M = global.AtlasMovements;
      if (!M || !M.list) return null;
      var ids = carteirasDa(Q.carteira);
      var total = 0, n = 0;
      ids.forEach(function (id) {
        var o = { walletId: id, tipo: "resultado" };
        if (Q.modulo) o.module = Q.modulo;
        if (Q.periodo) { o.from = Q.periodo.de; o.to = Q.periodo.ate; }
        M.list(o).forEach(function (mv) { total += mv.valorUSD; n++; });
      });
      var quando = Q.periodo ? " " + Q.periodo.rotulo : "";
      if (!n) {
        return "Nenhum resultado realizado" + onde(Q.carteira, Q.modulo) + quando +
               ". Resultado aparece quando uma posição é encerrada.";
      }
      return "Resultado realizado" + onde(Q.carteira, Q.modulo) + quando + ": " +
             (total >= 0 ? "+" : "") + dinheiro(total) + " em " + n +
             (n === 1 ? " posição encerrada." : " posições encerradas.") +
             (Q.periodo ? " Posição ainda aberta não entra: o resultado dela não tem data em que aconteceu." : "");
    },

    movimentos: function (Q) {
      var M = global.AtlasMovements;
      if (!M || !M.list) return null;
      var ids = carteirasDa(Q.carteira);
      var acc = { entrada: 0, saida: 0, count: 0 };
      ids.forEach(function (id) {
        var o = { walletId: id };
        if (Q.modulo) o.module = Q.modulo;
        if (Q.periodo) { o.from = Q.periodo.de; o.to = Q.periodo.ate; }
        var r = M.summarize(M.list(o));
        acc.entrada += r.entrada; acc.saida += r.saida; acc.count += r.count;
      });
      var quando = Q.periodo ? " " + Q.periodo.rotulo : "";
      if (!acc.count) return "Nenhum movimento" + onde(Q.carteira, Q.modulo) + quando + ".";
      return acc.count + " movimento(s)" + onde(Q.carteira, Q.modulo) + quando +
             ": entradas " + dinheiro(acc.entrada) + ", saídas " + dinheiro(acc.saida) +
             ", líquido " + dinheiro(acc.entrada - acc.saida) + ".";
    },

    /* Taxas de pool e rendimento de staking/lending — só o DeFi tem, e
       só quando o store está carregado nesta página. */
    taxas: function (Q) {
      var S = global.DeFiStore;
      if (!S || !S.poolSummary) return null;
      if (Q.modulo && Q.modulo !== "defi") {
        return "Taxa e rendimento existem no DeFi (pools, staking e lending). " +
               (NOME_MODULO[Q.modulo] || Q.modulo) + " não gera taxa.";
      }
      var alvo = Q.carteira ? Q.carteira.id : null;
      var geradas = 0, disponiveis = 0, pendentes = 0, n = 0;

      try {
        var byWallet = (S.all() || {}).byWallet || {};
        /* Pools ENCERRADAS entram na conta.

           Contar só as abertas fazia "quanto de taxa eu gerei?"
           responder "nenhuma" logo depois de encerrar uma pool que
           gerou US$ 25 — a taxa tinha sido gerada, recebida e gasta, e
           a pergunta é sobre o passado. Taxa gerada é fato histórico;
           o que só vale para posição aberta é a taxa PENDENTE, que
           ainda está lá dentro. */
        Object.keys(byWallet).forEach(function (wid) {
          if (alvo && wid !== alvo) return;
          var w = byWallet[wid];
          (w.pools || []).concat(w.closed || []).forEach(function (p) {
            var fechada = p.status === "encerrada" || p.closedAt;
            var r = fechada && p.closeSummary ? p.closeSummary : S.poolSummary(p);
            if (!r || !r.taxasGeradas) return;
            geradas += r.taxasGeradas;
            if (!fechada) {
              disponiveis += r.taxasDisponiveis;
              pendentes += r.taxasPendentes;
            }
            n++;
          });
        });
      } catch (e) { return null; }

      if (!n) return "Nenhuma taxa registrada" + (Q.carteira ? " na carteira " + Q.carteira.nome : "") + " ainda.";
      return "Taxas geradas" + (Q.carteira ? " na carteira " + Q.carteira.nome : "") + ": " +
             dinheiro(geradas) + " em " + n + " posição(ões)" +
             (pendentes || disponiveis
               ? " — " + dinheiro(pendentes) + " ainda dentro das pools e " +
                 dinheiro(disponiveis) + " disponível em caixa."
               : " (todas encerradas — a taxa já foi para o caixa).");
    }
  };

  /* ------------------------------------------------------------
     A porta única: texto entra, texto sai.

     Devolve null quando não reconheceu métrica ou quando a métrica
     não tem como responder nesta tela — e null faz o Oráculo cair no
     comportamento anterior, que continua valendo para teses, alertas,
     moeda e backup.
     ------------------------------------------------------------ */
  function responder(pergunta) {
    return responderQ(interpretar(pergunta));
  }

  function respostaAmbigua(amb, Q) {
    var porNome = {};
    amb.forEach(function (c) { (porNome[limpar(c.nome)] = porNome[limpar(c.nome)] || []).push(c); });
    var blocos = Object.keys(porNome).map(function (k) {
      var lista = porNome[k];
      var linhas = lista.map(function (c, i) {
        var nd = numerosDa(c.id, Q.modulo);
        var idade = lista.length > 1 ? (i === 0 ? ", a mais antiga" : (i === lista.length - 1 ? ", a mais recente" : "")) : "";
        return "• " + c.nome + " (" + (c.tipo === "isolada" ? "local" : "global") + idade + "): " +
               dinheiro(nd.total) + (Q.modulo ? " em " + (NOME_MODULO[Q.modulo] || Q.modulo) : "");
      });
      return "Há " + lista.length + " carteiras chamadas “" + lista[0].nome + "”:\n" + linhas.join("\n");
    });
    return blocos.join("\n") + "\nRenomeie uma delas (lápis ao lado do nome, no seletor de carteira) " +
           "para eu saber de qual você está falando.";
  }

  /* A mesma porta, para quem já tem a consulta montada. O Oráculo usa
     para a CONTINUAÇÃO: "quanto rendi em pool?" → "e no mês passado?"
     troca só o período da consulta anterior e mantém métrica e
     módulo — sem colar textos, que duplicaria o período antigo. */
  function responderQ(Q) {
    if (!Q || !Q.metrica || !RESOLVE[Q.metrica]) return null;

    /* Nome de carteira que pertence a mais de uma: mostra as duas, com
       o que se sabe para distingui-las, e pede para renomear. Responder
       por uma delas seria escolher no escuro. */
    var amb = (Q.carteiras || []).filter(function (c) { return c.ambigua; });
    if (amb.length) return respostaAmbigua(amb, Q);

    /* Duas carteiras citadas, ou "qual carteira…": comparação. Com
       período não: a comparação é da fotografia de agora, e resultado
       por período é outro número (só o realizado). */
    if (Q.comparar && !Q.periodo &&
        /^(patrimonio|caixa|posicoes|resultado)$/.test(Q.metrica)) {
      var cmp = null;
      try { cmp = RESOLVE.comparar(Q); } catch (e) { cmp = null; }
      if (cmp) return cmp;
    }

    /* Período pedido numa métrica que é fotografia de agora: dizer
       isso é mais útil que devolver o valor atual como se fosse o
       daquela data. */
    if (Q.periodo && (Q.metrica === "patrimonio" || Q.metrica === "caixa" || Q.metrica === "posicoes")) {
      var agora = RESOLVE[Q.metrica](Q);
      if (!agora) return null;
      return agora + " (Este é o valor de AGORA — o ATLAS não guarda o " +
             "patrimônio por carteira dia a dia, então não sei dizer quanto era " +
             Q.periodo.rotulo + ". Resultado e movimentos, sim, aceitam período.)";
    }

    try { return RESOLVE[Q.metrica](Q); } catch (e) { return null; }
  }

  global.AtlasVocabulario = {
    interpretar: interpretar,
    responder: responder,
    responderQ: responderQ,
    RESOLVE: RESOLVE,
    METRICAS: METRICAS,
    MODULOS: MODULOS,
    NOME_MODULO: NOME_MODULO,
    _limpar: limpar,
    _periodo: periodoDe,
    _carteira: carteiraDe
  };
})(typeof window !== "undefined" ? window : this);
