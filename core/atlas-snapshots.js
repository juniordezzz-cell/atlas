/* ============================================================
   ATLAS · core/atlas-snapshots.js — o livro de medições

   POR QUE ISTO EXISTE
   -------------------
   O gráfico "Evolução do Patrimônio" do Dashboard afirmava 90 dias de
   história do patrimônio consolidado. Auditado, ele era assim:

     · HOLD  — linha reta. A consolidação nunca perguntou a série a
               ele. (O Hold passou a medir de verdade na auditoria do
               módulo, e a medição era ignorada.)
     · TRADE — linha reta. Nunca teve série: `equity: [0, 0]`, um array
               escrito uma vez na criação da carteira.
     · DEFI  — série real, mas da CARTEIRA ATIVA, enquanto o total do
               módulo soma TODAS as carteiras globais.
     · RWA   — mesma coisa: série de uma carteira, total de todas.

   E, para os dois últimos, havia uma normalização:

       k = totalAtual / últimoPontoDaSérie;  série.map(v => v * k)

   Ela existia para o fim da curva bater com o KPI ao lado. O efeito é
   que uma série MEDIDA de uma carteira era multiplicada por uma
   constante até caber no total de todas — inventando um passado que
   não aconteceu, a partir de dados reais. Pior que a linha reta: linha
   reta ao menos se denuncia; uma curva esticada tem cara de história.

   A CAUSA: TRÊS IMPLEMENTAÇÕES DO MESMO CONCEITO
   ----------------------------------------------
   "Quanto isto valia naquele dia" é o mesmo conceito nos quatro
   módulos, e estava escrito três vezes, com três formatos e três
   escopos — cada um dentro do estado do seu módulo, invisível para
   quem está fora dele. Por isso a consolidação não conseguia somar:
   ela precisaria carregar os quatro stores e conhecer os três
   formatos.

   Aqui a medição vira uma coisa só, num lugar só, com um formato só:

       { "hold|principal": [ { d: "2026-08-14", v: 29100, c: 29400 } ] }

   `d` é o dia local (uma medição por dia por módulo por carteira),
   `v` é o valor de mercado, e o resto são medidas extras que cada
   módulo quiser guardar (o DeFi guarda `p`, o resultado; o Hold
   guarda `c`, o custo). Nada aqui é derivado nem estimado: se o dia
   não foi medido, ele não existe.

   O QUE ESTE ARQUIVO NÃO FAZ
   --------------------------
   Não calcula patrimônio. Ele recebe um número já calculado por quem
   sabe calculá-lo e carimba a data. Um livro de medições que faz
   contas viraria uma segunda fonte da verdade sobre o valor — o
   defeito que a terceira auditoria passou inteira removendo.
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasSnapshots) return;

  var KEY = "atlas.snapshots.v1";
  var MAX_POR_SERIE = 400;      /* ~13 meses de medição diária */

  /* ---------- persistência ---------- */
  var cache = null;

  function ler() {
    if (cache) return cache;
    var raw = null;
    try { raw = global.localStorage ? localStorage.getItem(KEY) : null; } catch (e) {}
    try { cache = raw ? JSON.parse(raw) : {}; } catch (e) { cache = {}; }
    if (!cache || typeof cache !== "object") cache = {};
    return cache;
  }

  function gravar() {
    try { localStorage.setItem(KEY, JSON.stringify(cache || {})); }
    catch (e) { /* sem storage: segue só em memória, como o resto do ATLAS */ }
  }

  /* ---------- data local ----------
     Data LOCAL, não UTC. `toISOString().slice(0,10)` devolve o dia de
     Greenwich: no Brasil, tudo medido depois das 21h cairia no dia
     seguinte, e a série ganharia um degrau à meia-noite errada. */
  function dia(d) {
    var x = d || new Date();
    return x.getFullYear() + "-" +
      String(x.getMonth() + 1).padStart(2, "0") + "-" +
      String(x.getDate()).padStart(2, "0");
  }

  function chave(modulo, walletId) {
    return String(modulo || "?") + "|" + String(walletId || "principal");
  }

  /* Toda chave de série tem a forma "modulo|carteira". O marcador de
     migração (__migrado) mora no mesmo objeto e NÃO é uma série —
     sem este filtro ele aparecia como um módulo chamado "__migrado"
     em porModulo(). Marcador de controle no espaço de dados é como
     um registro fantasma entra numa soma. */
  function ehSerie(k) { return k.indexOf("|") > 0; }

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  /* ============================================================
     REGISTRAR — idempotente por dia

     Abrir a mesma tela dez vezes no mesmo dia não cria dez pontos:
     atualiza o ponto de hoje. É o que torna seguro chamar isto em
     todo render.
     ============================================================ */
  function registrar(modulo, walletId, medidas) {
    if (!modulo) return null;
    medidas = medidas || {};
    var v = num(medidas.v);

    var todos = ler();
    var k = chave(modulo, walletId);
    var serie = Array.isArray(todos[k]) ? todos[k] : null;

    var hoje = dia();
    var ponto = { d: hoje, v: v };
    Object.keys(medidas).forEach(function (m) {
      if (m !== "v" && medidas[m] != null) ponto[m] = num(medidas[m]);
    });

    /* Carteira zerada e nunca medida não vira ponto. Uma fileira de
       zeros antes da primeira operação é um gráfico começando no chão
       por convenção, não por medição. */
    var ultimo = serie ? serie[serie.length - 1] : null;
    if (!ultimo && v === 0) return serie || [];
    if (!serie) serie = todos[k] = [];

    if (ultimo && ultimo.d === hoje) {
      var mudou = false;
      Object.keys(ponto).forEach(function (m) {
        if (ultimo[m] !== ponto[m]) { ultimo[m] = ponto[m]; mudou = true; }
      });
      if (!mudou) return serie;
    } else {
      serie.push(ponto);
      if (serie.length > MAX_POR_SERIE) serie.splice(0, serie.length - MAX_POR_SERIE);
    }
    gravar();
    return serie;
  }

  /* ============================================================
     SÉRIE — degrau, nunca curva inventada

     Dia sem medição repete o último valor conhecido. É a única coisa
     que o ATLAS pode afirmar sobre um dia em que ninguém abriu o
     sistema: o valor não foi observado mudar. Cada ponto diz se foi
     `medido` de fato, para a tela poder contar.

     Antes da primeira medição não há ponto — a série simplesmente
     começa depois, e uma série curta é um estado que a tela sabe
     desenhar.
     ============================================================ */
  function serieDe(chaveSerie, dias, campo) {
    var todos = ler();
    var snaps = todos[chaveSerie];
    if (!Array.isArray(snaps) || !snaps.length) return {};

    var porDia = {};
    snaps.forEach(function (p) { porDia[p.d] = p; });

    var hoje = new Date();
    var inicio = new Date(hoje); inicio.setDate(hoje.getDate() - (dias - 1));
    var iniIso = dia(inicio);

    /* valor de partida: a última medição ANTES da janela */
    var corrente = null;
    for (var k = 0; k < snaps.length; k++) {
      if (snaps[k].d <= iniIso) corrente = snaps[k];
    }

    var out = {};
    for (var i = dias - 1; i >= 0; i--) {
      var d = new Date(hoje); d.setDate(hoje.getDate() - i);
      var iso = dia(d);
      if (porDia[iso]) corrente = porDia[iso];
      if (!corrente) continue;
      out[iso] = { valor: num(corrente[campo]), medido: !!porDia[iso] };
    }
    return out;
  }

  /* Chaves que casam com o filtro pedido. Sem filtro, tudo. */
  function chaves(opts) {
    opts = opts || {};
    var mods = opts.modules ? [].concat(opts.modules) : null;
    var carts = opts.wallets ? [].concat(opts.wallets) : null;
    return Object.keys(ler()).filter(function (k) {
      if (!ehSerie(k)) return false;
      var p = k.split("|");
      if (mods && mods.indexOf(p[0]) === -1) return false;
      if (carts && carts.indexOf(p[1]) === -1) return false;
      return true;
    });
  }

  /* ============================================================
     SOMA DE SÉRIES — o ponto da consolidação

     Devolve UMA série diária somando todas as chaves que casam com o
     filtro. É isto que permite ao Dashboard perguntar "quanto valia o
     patrimônio inteiro no dia X" sem carregar quatro stores nem
     conhecer três formatos.

     `medido` de um dia é verdadeiro quando PELO MENOS uma das séries
     somadas foi realmente medida naquele dia — é o que a tela usa
     para dizer quantos dias tem de fato.
     ============================================================ */
  function serie(dias, opts) {
    dias = dias || 90;
    opts = opts || {};
    var campo = opts.campo || "v";
    var ks = chaves(opts);
    if (!ks.length) return [];

    var acumulado = {};
    ks.forEach(function (k) {
      var s = serieDe(k, dias, campo);
      Object.keys(s).forEach(function (iso) {
        if (!acumulado[iso]) acumulado[iso] = { valor: 0, medido: false };
        acumulado[iso].valor += s[iso].valor;
        if (s[iso].medido) acumulado[iso].medido = true;
      });
    });

    return Object.keys(acumulado).sort().map(function (iso) {
      return { date: iso, value: acumulado[iso].valor, medido: acumulado[iso].medido };
    });
  }

  /* Quantos dias a série tem de MEDIÇÃO, não de interpolação. */
  function medidos(dias, opts) {
    return serie(dias || 90, opts).filter(function (p) { return p.medido; }).length;
  }

  /* Uma série por módulo, mesmo eixo de datas. Para o Dashboard poder
     empilhar sem recalcular nada. */
  function porModulo(dias, opts) {
    opts = opts || {};
    var mods = {};
    chaves(opts).forEach(function (k) { mods[k.split("|")[0]] = 1; });
    var out = {};
    Object.keys(mods).forEach(function (m) {
      out[m] = serie(dias, { modules: [m], wallets: opts.wallets, campo: opts.campo });
    });
    return out;
  }

  function limpar(modulo, walletId) {
    var todos = ler();
    if (!modulo) { cache = {}; gravar(); return; }
    if (walletId) { delete todos[chave(modulo, walletId)]; }
    else {
      Object.keys(todos).forEach(function (k) {
        if (ehSerie(k) && k.split("|")[0] === modulo) delete todos[k];
      });
    }
    gravar();
  }

  /* ============================================================
     MIGRAÇÃO — as três implementações anteriores

     Hold, DeFi e RWA já mediam, cada um dentro do próprio estado e no
     próprio formato. Apagar isso seria jogar fora medição real — a
     única coisa que o sistema não consegue refazer depois, porque o
     preço de ontem não volta. Roda uma vez e marca.
     ============================================================ */
  function migrar() {
    var todos = ler();
    if (todos.__migrado) return;

    function importar(modulo, walletId, snaps, mapa) {
      if (!Array.isArray(snaps) || !snaps.length) return;
      var k = chave(modulo, walletId);
      if (Array.isArray(todos[k]) && todos[k].length) return;  // já tem: não sobrescreve
      todos[k] = snaps.map(function (p) {
        var novo = { d: p.d, v: num(p.v) };
        Object.keys(mapa || {}).forEach(function (destino) {
          var origem = mapa[destino];
          if (p[origem] != null) novo[destino] = num(p[origem]);
        });
        return novo;
      }).filter(function (p) { return p.d; });
    }

    /* Hold: HOLD_STATE.snapshots = { walletId: [{d,v,c}] } */
    lerJson("atlas.hold.state.v2", function (st) {
      var s = st.snapshots;
      if (!s || typeof s !== "object") return;
      Object.keys(s).forEach(function (wid) { importar("hold", wid, s[wid], { c: "c" }); });
    });

    /* DeFi e RWA: state.wallets[id].snapshots */
    lerJson("atlas.defi.state.v3", function (st) {
      var w = st.wallets;
      if (!w || typeof w !== "object") return;
      Object.keys(w).forEach(function (wid) { importar("defi", wid, w[wid] && w[wid].snapshots, { p: "p" }); });
    });
    lerJson("atlas.rwa.state.v3", function (st) {
      var w = st.wallets;
      if (!w || typeof w !== "object") return;
      Object.keys(w).forEach(function (wid) { importar("rwa", wid, w[wid] && w[wid].snapshots, {}); });
    });

    todos.__migrado = true;
    gravar();
  }

  function lerJson(chaveLS, fn) {
    try {
      var raw = localStorage.getItem(chaveLS);
      if (!raw) return;
      var obj = JSON.parse(raw);
      if (obj && typeof obj === "object") fn(obj);
    } catch (e) { /* chave ausente ou corrompida: não migra, não quebra */ }
  }

  migrar();

  global.AtlasSnapshots = {
    registrar: registrar,
    serie: serie,
    medidos: medidos,
    porModulo: porModulo,
    limpar: limpar,
    dia: dia,
    /* devolve a chave interna — usado só pelos testes e pela migração */
    _chave: chave,
    _reload: function () { cache = null; ler(); return true; }
  };
})(typeof window !== "undefined" ? window : this);
