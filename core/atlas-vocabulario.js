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
    { id: "resultado",  ordem: 3, termos: ["resultado", "lucro", "prejuizo", "pnl", "rendi", "rentab", "ganho", "ganhei", "perdi", "perda", "performance"] },
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
    var W = global.AtlasWallets;
    if (!W || !W.all) return null;
    var todas;
    try { todas = W.all() || []; } catch (e) { return null; }

    var cands = todas.map(function (w) { return { w: w, n: limpar(w.name) }; })
                     .filter(function (c) { return c.n.length > 2; })
                     .sort(function (a, b) { return b.n.length - a.n.length; });

    for (var i = 0; i < cands.length; i++) {
      var alvo = cands[i].n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp("(^|\\W)" + alvo + "($|\\W)").test(q)) return cands[i].w;
    }
    return null;
  }

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

    var carteira = carteiraDe(q);

    return {
      metrica: metrica,
      modulo: modulo,
      periodo: periodoDe(q),
      carteira: carteira ? { id: carteira.id, nome: carteira.name } : null,
      /* quantas dimensões foram reconhecidas — a tela usa para decidir
         se entendeu o suficiente para responder */
      dimensoes: (metrica ? 1 : 0) + (modulo ? 1 : 0) + (carteira ? 1 : 0)
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

  var RESOLVE = {

    caixa: function (Q) {
      if (!global.AtlasCaixa) return null;
      var ids = carteirasDa(Q.carteira);
      var total = 0, det = [];
      ids.forEach(function (id) {
        var s = global.AtlasCaixa.saldo(id);
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
             (!Q.carteira && det.length > 1 ? " — " + det.join(", ") : "") + nota + ".";
    },

    patrimonio: function (Q) {
      var W = global.AtlasWallets;
      if (!W || !W.balanceOf) return null;
      var ids = carteirasDa(Q.carteira);
      var caixa = 0, posic = 0, porModulo = {};

      ids.forEach(function (id) {
        if (global.AtlasCaixa) caixa += global.AtlasCaixa.saldo(id);
        ["hold", "trade", "defi", "rwa"].forEach(function (m) {
          if (Q.modulo && m !== Q.modulo) return;
          var v = num(W.balanceOf(id, m));
          if (!v) return;
          posic += v;
          porModulo[m] = (porModulo[m] || 0) + v;
        });
      });

      /* Filtrado por módulo, o caixa não entra: ele não é do módulo. */
      var total = Q.modulo ? posic : caixa + posic;
      if (!total) {
        return "Nada registrado" + onde(Q.carteira, Q.modulo) + " ainda.";
      }

      var partes = Object.keys(porModulo).map(function (m) {
        return (NOME_MODULO[m] || m) + " " + dinheiro(porModulo[m]);
      });
      if (!Q.modulo && caixa) partes.unshift("caixa " + dinheiro(caixa));

      return "Patrimônio" + onde(Q.carteira, Q.modulo) + ": " + dinheiro(total) +
             (partes.length > 1 ? " — " + partes.join(", ") : "") + ".";
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
             (n === 1 ? " posição encerrada." : " posições encerradas.");
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
    var Q = interpretar(pergunta);
    if (!Q.metrica || !RESOLVE[Q.metrica]) return null;

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
    RESOLVE: RESOLVE,
    METRICAS: METRICAS,
    MODULOS: MODULOS,
    NOME_MODULO: NOME_MODULO,
    _limpar: limpar,
    _periodo: periodoDe,
    _carteira: carteiraDe
  };
})(typeof window !== "undefined" ? window : this);
