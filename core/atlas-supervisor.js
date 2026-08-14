/* ============================================================
   ATLAS · core/atlas-supervisor.js — o supervisor das contas

   O QUE ELE É
   -----------
   Cada módulo faz a sua parte: o Hold sabe somar posições, o DeFi sabe
   o que é uma pool, o Trade sabe o que é uma operação encerrada.
   Ninguém aqui recalcula nada disso — seria criar uma segunda fonte da
   verdade sobre valores, que é o defeito que esta auditoria passou
   inteira removendo.

   Este arquivo PERGUNTA a cada um e confere se as respostas fecham
   entre si, com as carteiras e com o que a tela principal mostra.

   POR QUE ELE EXISTE
   ------------------
   Todo erro grave desta auditoria tinha a mesma assinatura: cada
   pedaço estava certo isoladamente, e a incoerência só aparecia quando
   dois pedaços eram postos lado a lado.

     · o KPI dizia US$ 72.500 e o seletor de carteira, dois centímetros
       ao lado, dizia US$ 0;
     · o patrimônio somava as posições e ignorava o caixa — depositar
       50.000 deixava o total em zero;
     · a rentabilidade dividia o lucro realizado de um módulo pelo
       capital aberto de outro;
     · o gráfico afirmava 90 dias de história com uma medição.

   Nenhum apareceria numa revisão de fórmula, porque não havia fórmula
   errada. Precisava de alguém olhando o conjunto. É este arquivo.

   SOBRE "CONSERTAR"
   -----------------
   Um supervisor que ajusta números para a conta fechar é a pior coisa
   que se pode pôr num sistema de patrimônio: ele apaga o sintoma e
   deixa a causa, e a partir daí o erro é invisível para sempre. A
   regra de ouro nº 1 do ATLAS diz o contrário — corrigir na origem,
   nunca mascarar o resultado.

   Então `corrigir()` mexe em UMA coisa só: CACHE DERIVADO. O saldo que
   a central guarda por módulo é uma cópia do que o módulo respondeu da
   última vez; quando o módulo está carregado e discorda, a cópia está
   velha e é reescrita a partir da fonte. Isso não é ajustar um número,
   é jogar fora uma cópia vencida.

   Divergência que NÃO seja cache velho ele relata e não toca. Se o
   caixa e as posições não fecham com os depósitos, há um evento
   faltando ou sobrando — e inventar o evento que falta seria falsificar
   o extrato.
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasSupervisor) return;

  var MODULOS = ["trade", "hold", "defi", "rwa"];

  function C() { return global.AtlasContabilidade; }
  function n(v) { var x = parseFloat(v); return isFinite(x) ? x : 0; }
  function eps() { var k = C(); return k ? k.EPS : 0.005; }

  function safe(fn, fb) {
    try { var r = fn(); return (r === undefined || r === null) ? fb : r; }
    catch (e) { return fb; }
  }

  /* Um achado é sempre a MESMA forma, para a tela e os testes lerem
     sem saber de qual verificação veio. */
  function achado(nivel, area, o_que, dados) {
    var a = { nivel: nivel, area: area, o_que: o_que };
    Object.keys(dados || {}).forEach(function (k) { a[k] = dados[k]; });
    return a;
  }

  /* ------------------------------------------------------------
     QUEM RESPONDE AO VIVO NESTA PÁGINA

     `hasLive` estava escrita em wallets/walletLedger.js e não era
     chamada por NINGUÉM — nem pelo próprio ledger. Ela distingue as
     duas coisas que este arquivo precisa separar: um módulo que
     responde de verdade aqui e um número que é só a última cópia
     guardada. Comparar cache com cache não verifica nada.

     Ela vive em AtlasWalletLedger, não em AtlasWallets: o gerenciador
     copia só parte da API do ledger para a fachada. Não vale a pena
     mexer nisso agora — o objeto próprio é público e está à mão.
     ------------------------------------------------------------ */
  /* O store de cada módulo, pelo nome global. Comparar contra o que
     não está carregado é comparar contra cache — e cache velho vira
     falso positivo, que é o segundo pior defeito de um verificador. */
  var STORE_DE = { trade: "ATLAS", hold: "Store", defi: "DeFiStore", rwa: "RWAStore" };

  function respondeAoVivo(module) {
    var L = global.AtlasWalletLedger;
    /* DUAS condições, e as duas são necessárias:

       · o leitor está registrado (hasLive) — quem registra é a camada
         de consolidação, presente em toda página que a carrega;
       · o STORE do módulo está nesta página.

       Só a primeira não basta, e isso custou um falso positivo medido:
       em Configurações os quatro leitores estavam registrados e nenhum
       store existia, então `capitalOf` caía no CACHE. O supervisor
       comparou uma cópia velha do Hold (4.000) com um livro de caixa
       zerado e acusou "posição a mais do que o caixa explica" — sobre
       um módulo que a página nem tinha aberto. */
    if (!L || !L.hasLive || !L.hasLive(module)) return false;
    var nome = STORE_DE[module];
    return !!(nome && global[nome]);
  }

  function carteirasGlobais() {
    var W = global.AtlasWallets;
    if (!W || !W.globals) return [{ id: "principal", name: "Principal" }];
    return W.globals();
  }

  /* ============================================================
     VERIFICAÇÕES
     ============================================================ */

  /* ------------------------------------------------------------
     1. O QUE SAIU DO CAIXA VIROU POSIÇÃO?

     A primeira versão desta função comparava, por carteira,
     `caixa + investido` com `depositado − sacado + resultado`, usando
     `resultado = investido − alocado`. Substituindo, a igualdade se
     reduz a `caixa = depositado − sacado − alocado` — que é a própria
     definição de saldo no livro de caixa. Uma verificação que só
     confirma a aritmética de quem ela deveria vigiar não vigia nada, e
     passaria sempre.

     A pergunta com valor é entre FONTES DIFERENTES: o livro de caixa
     diz quanto saiu para cada módulo (aportes − retornos); o módulo
     diz quanto custaram as posições que ele guarda. Os dois números
     são calculados por caminhos independentes e têm de bater.

     Quando não batem, há posição sem dinheiro que a explique — ou
     dinheiro que saiu e não virou posição nenhuma. É exatamente o
     defeito que esta auditoria já encontrou uma vez, quando a compra
     era criada mesmo com o débito recusado.
     ------------------------------------------------------------ */
  function verCapitalContraCaixa() {
    var out = [];
    var CX = global.AtlasCaixa, W = global.AtlasWallets;
    if (!CX || !W) return out;

    carteirasGlobais().forEach(function (w) {
      var porMod = safe(function () { return CX.alocadoPorModulo(w.id) || {}; }, {});
      MODULOS.forEach(function (m) {
        if (!respondeAoVivo(m)) return;        /* módulo ausente: não dá para comparar daqui */
        var capital = safe(function () { return n(W.capitalOf(w.id, m)); }, null);
        if (capital === null) return;
        var saiuDoCaixa = n(porMod[m]);

        /* Tolerância maior que o EPS de centavo: o Trade reporta como
           capital o tamanho das operações ABERTAS, e o caixa registra
           aporte e retorno a cada abertura e fechamento — os dois
           coincidem, mas por caminhos com arredondamentos próprios. */
        if (Math.abs(capital - saiuDoCaixa) <= 0.01) return;

        out.push(achado("erro", "capital", "o capital do módulo não bate com o que saiu do caixa", {
          carteira: w.name || w.id, carteiraId: w.id, modulo: m,
          moduloDiz: capital, caixaDiz: saiuDoCaixa, diferenca: capital - saiuDoCaixa,
          detalhe: capital > saiuDoCaixa
            ? "Há posição a mais do que o dinheiro que saiu do caixa explica."
            : "Saiu dinheiro do caixa que não virou posição neste módulo.",
          corrigivel: false
        }));
      });
    });
    return out;
  }

  /* ------------------------------------------------------------
     2. O PATRIMÔNIO GLOBAL FECHA?

     caixa + investido = depositado − sacado + resultado

     Aqui a igualdade NÃO é circular: `resultado` vem dos módulos
     (cada um calcula o seu por conta própria), e os dois primeiros
     termos vêm do livro de caixa. São três fontes independentes.
     ------------------------------------------------------------ */
  function verPatrimonioGlobal(snap) {
    var out = [];
    var CX = global.AtlasCaixa, K = C();
    if (!CX || !K || !global.AtlasConsolidation) return out;

    var s = snap || safe(function () { return global.AtlasConsolidation.snapshot(30); }, null);
    if (!s) return out;

    var externo = n(CX.patrimonioExterno());   /* depósitos − saques, todas as carteiras */
    var r = K.conferir.dinheiroFecha({
      caixa: n(s.caixa), investido: n(s.investido),
      depositado: externo, sacado: 0, resultadoTotal: n(s.pnl)
    });
    if (!r.ok) {
      out.push(achado("erro", "patrimônio", "o patrimônio não fecha com o extrato", {
        caixa: n(s.caixa), investido: n(s.investido),
        depositadoLiquido: externo, resultado: n(s.pnl),
        esquerda: r.esquerda, direita: r.direita, diferenca: r.diferenca,
        detalhe: "caixa + investido deveria ser igual ao que entrou menos o que saiu, mais o resultado. " +
                 "Uma diferença aqui significa dinheiro sem origem ou origem sem dinheiro.",
        corrigivel: false
      }));
    }
    return out;
  }

  /* Leitor por módulo. A consolidação já registrou os leitores ao vivo
     na central; aqui só perguntamos. null = módulo não carregado. */
  function leitorDeModulo(module, walletId) {
    var W = global.AtlasWallets;
    if (!W) return null;
    if (respondeAoVivo(module)) {
      var vivo = safe(function () { return W.balanceOf(walletId, module); }, null);
      var cap = safe(function () { return W.capitalOf(walletId, module); }, null);
      if (vivo === null) return null;
      return { valorAtual: n(vivo), capital: n(cap) };
    }
    return null;
  }

  /* ---- 2. O cache da central bate com a leitura ao vivo? ----
     Esta é a única divergência que o supervisor CONSERTA, porque a
     cópia velha não é um número do usuário: é um espelho. */
  function verCacheDoLedger(corrigindo) {
    var out = [];
    var W = global.AtlasWallets;
    if (!W || !W.ledgerOf) return out;

    carteirasGlobais().forEach(function (w) {
      var led = safe(function () { return W.ledgerOf(w.id) || {}; }, {});
      MODULOS.forEach(function (m) {
        if (!respondeAoVivo(m)) return;                  /* sem leitor aqui: nada a comparar */
        var guardado = led[m] && isFinite(Number(led[m].valorAtual)) ? n(led[m].valorAtual) : null;
        var vivo = safe(function () { return n(W.balanceOf(w.id, m)); }, null);
        if (vivo === null) return;
        if (guardado === null) return;
        if (Math.abs(guardado - vivo) <= eps()) return;

        var a = achado("aviso", "cache", "o saldo guardado está velho", {
          carteira: w.name || w.id, carteiraId: w.id, modulo: m,
          guardado: guardado, aoVivo: vivo, diferenca: guardado - vivo,
          corrigivel: true
        });
        if (corrigindo) {
          /* Re-derivar da FONTE, não ajustar para caber.
             `balanceOf`/`capitalOf` já preferem o leitor ao vivo quando
             ele existe — e só chegamos aqui quando existe. Então
             reescrever o cache com eles é copiar do original, não
             fabricar um número que feche. */
          var ok = safe(function () {
            W.report(m, w.id, {
              id: w.id, module: m,
              valorAtual: vivo, saldo: vivo,
              capital: n(W.capitalOf(w.id, m)),
              assets: safe(function () { return W.assetsOf(w.id, m) || []; }, [])
            });
            return true;
          }, null);
          a.corrigido = !!ok;
        }
        out.push(a);
      });
    });
    return out;
  }

  /* ---- 3. As carteiras estão íntegras? ---- */
  function verCarteiras() {
    var out = [];
    var W = global.AtlasWallets, CX = global.AtlasCaixa;
    if (!W || !W.all) return out;

    var todas = safe(function () { return W.all(); }, []);
    var ids = {};
    todas.forEach(function (w) { ids[w.id] = w; });

    /* 3a. evento de caixa apontando para carteira que não existe */
    if (CX) {
      var orfaos = {};
      safe(function () { return CX.eventos({}); }, []).forEach(function (e) {
        if (e.walletId && !ids[e.walletId]) orfaos[e.walletId] = (orfaos[e.walletId] || 0) + 1;
      });
      Object.keys(orfaos).forEach(function (id) {
        out.push(achado("erro", "carteira", "há dinheiro numa carteira que não existe mais", {
          carteiraId: id, eventos: orfaos[id],
          detalhe: "O extrato tem " + orfaos[id] + " lançamento(s) apontando para uma carteira apagada. " +
                   "O saldo deles não aparece em lugar nenhum.",
          corrigivel: false
        }));
      });
    }

    /* 3b. carteira isolada somando no patrimônio global */
    var globais = {};
    carteirasGlobais().forEach(function (w) { globais[w.id] = true; });
    todas.forEach(function (w) {
      if (w.type === "global") return;
      if (globais[w.id]) {
        out.push(achado("erro", "carteira", "carteira isolada entrando no total global", {
          carteira: w.name || w.id, carteiraId: w.id, corrigivel: false
        }));
      }
    });

    /* 3c. caixa negativo — não deveria existir: o store recusa gastar
           além do saldo, então um negativo é lançamento manual ou
           importação de backup inconsistente */
    if (CX) {
      todas.forEach(function (w) {
        var s = n(CX.saldo(w.id));
        if (s < -eps()) {
          out.push(achado("erro", "carteira", "caixa negativo", {
            carteira: w.name || w.id, carteiraId: w.id, saldo: s,
            detalhe: "O caixa não pode ficar negativo: toda saída passa por uma verificação de saldo. " +
                     "Um negativo indica lançamento removido ou backup restaurado pela metade.",
            corrigivel: false
          }));
        }
      });
    }
    return out;
  }

  /* ---- 4. A medição de hoje bate com o valor de hoje? ---- */
  function verMedicoes() {
    var out = [];
    var SN = global.AtlasSnapshots, W = global.AtlasWallets;
    if (!SN || !W) return out;

    carteirasGlobais().forEach(function (w) {
      MODULOS.forEach(function (m) {
        if (!respondeAoVivo(m)) return;
        var vivo = safe(function () { return n(W.balanceOf(w.id, m)); }, null);
        if (vivo === null) return;
        var serie = safe(function () {
          return SN.serie(1, { modules: [m], wallets: [w.id] });
        }, []);
        if (!serie.length) return;
        var hoje = serie[serie.length - 1];
        if (!hoje.medido) return;                 /* não medido hoje: nada a comparar */
        if (Math.abs(n(hoje.value) - vivo) <= eps()) return;
        out.push(achado("aviso", "medição", "a medição de hoje não bate com o valor de agora", {
          carteira: w.name || w.id, modulo: m,
          medido: n(hoje.value), aoVivo: vivo, diferenca: n(hoje.value) - vivo,
          detalhe: "Normal se o preço mudou depois da medição — ela é remedida ao abrir o módulo.",
          corrigivel: false
        }));
      });
    });
    return out;
  }

  /* ---- 5. A tela principal concorda com os dados? ----
     Compara o TEXTO exibido com o número que a consolidação produz.
     É a verificação que teria pegado "KPI 72.500 ao lado de seletor
     em 0" no dia em que aconteceu. */
  function verTela(snap) {
    var out = [];
    if (typeof document === "undefined") return out;
    if (!global.AtlasConsolidation) return out;

    var s = snap || safe(function () { return global.AtlasConsolidation.snapshot(30); }, null);
    if (!s) return out;

    /* "US$ 49.700" / "-US$ 300,00" / "−1,02%" → número */
    function numeroDe(txt) {
      if (txt == null) return null;
      var t = String(txt).replace(/ | /g, " ");
      var neg = /-|−|\(/.test(t);
      t = t.replace(/[^\d,.]/g, "");
      if (!t) return null;
      /* pt-BR: ponto separa milhar, vírgula separa decimal */
      t = t.replace(/\./g, "").replace(",", ".");
      var v = parseFloat(t);
      if (!isFinite(v)) return null;
      return neg ? -v : v;
    }

    function conferir(rotulo, elemento, esperado, tolerancia) {
      if (!elemento) return;
      var lido = numeroDe(elemento.textContent);
      if (lido === null) return;
      var tol = tolerancia == null ? 1 : tolerancia;   /* a tela arredonda */
      if (Math.abs(lido - esperado) <= tol) return;
      out.push(achado("erro", "tela", "o que está na tela não é o que os dados dizem", {
        campo: rotulo, naTela: lido, nosDados: esperado, diferenca: lido - esperado,
        detalhe: "Exibido “" + String(elemento.textContent).trim() + "”.",
        corrigivel: false
      }));
    }

    conferir("Patrimônio (cartão de evolução)", document.getElementById("evoTotal"), s.total, 1);

    /* KPIs do painel: casados pelo rótulo, não pela posição — a ordem
       dos cartões pode mudar sem que isto quebre. */
    var mapa = {
      "Patrimônio Total": s.total,
      "Lucro Total": s.pnl
    };
    Array.prototype.forEach.call(document.querySelectorAll(".kpi"), function (k) {
      var rot = k.querySelector(".rotulo"), val = k.querySelector(".valor");
      if (!rot || !val) return;
      var chave = rot.textContent.trim();
      if (!(chave in mapa)) return;
      conferir("KPI “" + chave + "”", val, mapa[chave], 1);
    });

    /* O total tem de ser a soma das fatias do gráfico de módulos. */
    if (s.byModule && s.byModule.length && C()) {
      var somaFatias = s.byModule.reduce(function (a, x) { return a + n(x.value); }, 0);
      var esperado = n(s.investido != null ? s.investido : s.total);
      var r = C().conferir.somaBate(s.byModule.map(function (x) { return n(x.value); }), esperado);
      if (!r.ok) {
        out.push(achado("erro", "tela", "as fatias por módulo não somam o investido", {
          soma: somaFatias, investido: esperado, diferenca: r.diferenca, corrigivel: false
        }));
      }
    }
    return out;
  }

  /* ============================================================
     API
     ============================================================ */
  /* ------------------------------------------------------------
     COBERTURA — "não achei nada" só vale se houve onde procurar

     A primeira versão devolvia `ok: true` sempre que a lista de
     achados saía vazia. Medido na tela de Configurações: ela não
     carrega AtlasWallets nem AtlasCaixa, então TODAS as verificações
     pularam por falta de fonte — e o painel anunciou "tudo fecha".

     É o mesmo defeito que este arquivo existe para caçar: uma
     afirmação tranquilizadora sem nada por trás. Agora a auditoria diz
     quantas verificações puderam rodar, e quem não pôde rodar aparece
     pelo nome.
     ------------------------------------------------------------ */
  function cobertura() {
    var W = global.AtlasWallets, CX = global.AtlasCaixa, K = C();
    var vivos = MODULOS.filter(respondeAoVivo);
    var faltando = [];
    if (!W) faltando.push("carteiras (AtlasWallets)");
    if (!CX) faltando.push("livro de caixa (AtlasCaixa)");
    if (!K) faltando.push("núcleo de contas (AtlasContabilidade)");
    if (!global.AtlasConsolidation) faltando.push("consolidação");
    if (W && CX && !vivos.length) faltando.push("nenhum módulo responde ao vivo nesta página");
    return {
      modulosVivos: vivos,
      faltando: faltando,
      /* Só há o que afirmar quando dá para comparar pelo menos duas
         fontes: as carteiras e o caixa, com algum módulo respondendo. */
      podeAfirmar: !!(W && CX && K && vivos.length)
    };
  }

  function auditar(opts) {
    opts = opts || {};
    var snap = opts.snapshot || safe(function () {
      return global.AtlasConsolidation ? global.AtlasConsolidation.snapshot(30) : null;
    }, null);

    var cob = cobertura();

    var achados = []
      .concat(verCapitalContraCaixa())
      .concat(verPatrimonioGlobal(snap))
      .concat(verCacheDoLedger(false))
      .concat(verCarteiras())
      .concat(verMedicoes());
    if (opts.tela !== false) achados = achados.concat(verTela(snap));

    var erros = achados.filter(function (a) { return a.nivel === "erro"; });
    return {
      /* `ok` é uma AFIRMAÇÃO. Sem cobertura não há afirmação a fazer:
         devolve null, e a tela escreve "não deu para conferir" em vez
         de "tudo certo". */
      ok: cob.podeAfirmar ? (erros.length === 0) : null,
      cobertura: cob,
      achados: achados,
      erros: erros.length,
      avisos: achados.length - erros.length,
      corrigiveis: achados.filter(function (a) { return a.corrigivel; }).length,
      em: new Date().toISOString()
    };
  }

  function corrigir() {
    /* Só cache derivado. Ver o cabeçalho: ajustar um número para a
       conta fechar apagaria o sintoma e manteria a causa. */
    var feitos = verCacheDoLedger(true).filter(function (a) { return a.corrigido; });
    return {
      corrigidos: feitos.length,
      itens: feitos,
      naoTocado: "Divergência que não seja cache velho é relatada, nunca ajustada."
    };
  }

  /* Relatório em texto, para o console e para quem quiser colar num
     e-mail. A tela bonita é outra camada. */
  function relatorio(res) {
    res = res || auditar();
    var cob = res.cobertura || { modulosVivos: [], faltando: [] };
    var L = ["ATLAS · supervisão em " + new Date(res.em).toLocaleString("pt-BR")];
    if (res.ok === null) {
      L.push("NÃO FOI POSSÍVEL CONFERIR — falta: " + cob.faltando.join("; "));
    } else {
      L.push(res.ok ? "tudo fecha" : (res.erros + " erro(s), " + res.avisos + " aviso(s)"));
    }
    L.push("módulos conferidos: " + (cob.modulosVivos.length ? cob.modulosVivos.join(", ") : "nenhum"));
    res.achados.forEach(function (a) {
      L.push("");
      L.push("[" + a.nivel.toUpperCase() + "] " + a.area + " — " + a.o_que);
      Object.keys(a).forEach(function (k) {
        if (k === "nivel" || k === "area" || k === "o_que" || a[k] == null) return;
        L.push("   " + k + ": " + a[k]);
      });
    });
    return L.join("\n");
  }

  global.AtlasSupervisor = {
    auditar: auditar,
    cobertura: cobertura,
    corrigir: corrigir,
    relatorio: relatorio,
    /* expostas para teste e para telas de diagnóstico */
    _verificacoes: {
      capitalContraCaixa: verCapitalContraCaixa,
      patrimonioGlobal: verPatrimonioGlobal,
      cacheDoLedger: verCacheDoLedger,
      carteiras: verCarteiras,
      medicoes: verMedicoes,
      tela: verTela
    }
  };
})(typeof window !== "undefined" ? window : this);
