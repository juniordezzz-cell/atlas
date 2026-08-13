/* ============================================================
   ATLAS · DeFi — pools.js
   Lista de pools + wizard de nova pool.
   ============================================================ */
(function () {
  "use strict";
  var U = window.U, C = window.C, S = window.DeFiStore, F = window.Filters, Sr = window.Search;

  C.mountNav("pools");

  var grid = U.qs("#poolsGrid");
  var state = { q: "", chain: "", protocol: "", status: "" };

  function render() {
    var items = S.pools();
    items = Sr.match(items, state.q, ["base", "quote", "protocol", "chain", "category"]);
    items = F.apply(items, { chain: state.chain, protocol: state.protocol });
    /* O filtro de status compara com o status CALCULADO. Passar
       `status` ao F.apply compararia com o campo gravado, que agora
       vale só "aberta"/"encerrada" — o filtro devolveria vazio
       sempre. */
    if (state.status) {
      items = items.filter(function (p) {
        var st = S.statusDe(p);
        return st && st.status === state.status;
      });
    }

    var filtering = state.q || state.chain || state.protocol || state.status;
    if (!items.length) {
      grid.style.display = "block";
      grid.innerHTML = C.empty({
        icon: "pools",
        title: filtering ? "Nenhuma pool encontrada" : "Nenhuma pool ainda",
        text: filtering
          ? "Ajuste os filtros ou a busca para ver outras posições."
          : "Você ainda não tem pools. Crie sua primeira posição para começar.",
        actionLabel: "Nova Pool", actionHref: "#"
      });
      var b = grid.querySelector(".btn");
      if (b) b.addEventListener("click", function (e) { e.preventDefault(); openWizard(); });
      return;
    }
    grid.style.display = "";
    grid.innerHTML = items.map(C.poolCard).join("");
    U.reveal("#poolsGrid .pos-card");
  }

  // popular filtros
  F.populate(U.qs("#fChain"), S.pools(), "chain", "Blockchain");
  F.populate(U.qs("#fProto"), S.pools(), "protocol", "Protocolo");

  Sr.bind(U.qs("#search"), function (v) { state.q = v; rerun(); });
  U.qs("#fChain").addEventListener("change", function (e) { state.chain = e.target.value; rerun(); });
  U.qs("#fProto").addEventListener("change", function (e) { state.protocol = e.target.value; rerun(); });
  U.qs("#fStatus").addEventListener("change", function (e) { state.status = e.target.value; rerun(); });

  function rerun() { render(); }

  render();

  /* ============================================================
     COTAÇÃO — esta tela decidia sem dado

     A lista de Pools nunca buscou preço. Desenhava o selo a partir
     do campo p.status, gravado no wizard e reescrito só quando o
     usuário passava pelo Dashboard. Uma pool podia dizer "Fora do
     Range" aqui e "na faixa" na própria página dela, no mesmo
     minuto, e as duas telas estariam sendo fiéis à sua fonte.

     Agora a origem é a mesma das outras telas: cota, entrega ao
     store, redesenha. Sem cotação os cards nascem "Faixa não
     avaliada" e mudam quando o preço chega — em vez de exibirem uma
     conclusão que ninguém calculou.
     ============================================================ */
  function cotar() {
    if (!window.DeFiTokens || !window.DeFiPerf) return;
    var abertas = S.activePools();
    if (!abertas.length) return;

    DeFiTokens.precosDetalhado(DeFiPerf.simbolos(abertas)).then(function (d) {
      S.setPrecos(d.valores, d.fonte);
      render();
      avisar(d);
    }).catch(function (err) {
      avisar({ erro: err, faltando: [], vencidos: [] });
    });
  }

  /* Uma faixa de aviso acima da grade, só quando há o que dizer. */
  function avisar(d) {
    var host = U.qs("#poolsGrid");
    if (!host) return;
    var el = U.qs("#poolsAviso");
    if (!el) {
      el = document.createElement("div");
      el.id = "poolsAviso";
      el.className = "hint";
      el.style.margin = "0 0 12px";
      host.parentNode.insertBefore(el, host);
    }
    if (d.erro) {
      el.innerHTML = "⚠ " + esc(d.erro.message || "Não consegui buscar os preços agora.") +
        " Os selos de faixa das posições sem preço ficam sem veredito.";
    } else if (d.faltando && d.faltando.length) {
      el.innerHTML = "⚠ Nenhuma fonte reconheceu <b>" + d.faltando.map(esc).join("</b>, <b>") +
        "</b>. Abra a posição e informe o preço na mão em <b>Atualizar pool</b>.";
    } else if (d.vencidos && d.vencidos.length) {
      el.innerHTML = "⚠ Preço de <b>" + d.vencidos.map(esc).join("</b>, <b>") +
        "</b> informado por você há mais de " +
        (window.AtlasPrecos ? AtlasPrecos.VALIDADE_DIAS : 7) + " dias.";
    } else {
      el.innerHTML = "";
      el.style.display = "none";
      return;
    }
    el.style.display = "";
  }

  cotar();

  /* ============================================================
     WIZARD — Nova Pool
     ============================================================ */
  var CHAINS = ["Solana", "Ethereum", "Base", "Arbitrum", "Polygon", "Optimism"];
  var PROTOS = ["Kamino", "Meteora", "Orca", "Raydium", "Aerodrome", "Aave", "Pendle"];
  /* wz.range NÃO existe mais. Havia três botões no passo 4 ("Dentro do
     range" / "Fora do range" / "Em análise") cuja escolha era gravada
     como p.status e virava o selo do card — um veredito digitado por
     quem não tinha como conferir, que sobrevivia meses sem ninguém
     recalcular. O selo agora sai de DeFiStore.statusDe(); o que o
     usuário informa é a FAIXA (mínima, máxima, denominação), que é
     dado, não conclusão. */
  var wz = { step: 0, chain: "", proto: "" };

  /* ------------------------------------------------------------
     Objetivos da estratégia

     São os cinco motivos reais de se abrir uma pool. Ter isso em
     caixinha (em vez de só texto livre) permite, depois, comparar
     objetivo declarado com resultado obtido — que é a pergunta
     que interessa: "as pools que abri por taxa realmente pagaram
     taxa?".

     Os dois primeiros usam o nome do token digitado no passo 3.
     ------------------------------------------------------------ */
  function objetivos() {
    var b = (U.qs("#tkBase") && U.qs("#tkBase").value.trim().toUpperCase()) || "o ativo base";
    var q = (U.qs("#tkQuote") && U.qs("#tkQuote").value.trim().toUpperCase()) || "o ativo par";
    return [
      { id: "acc_base",  label: "Acumular mais " + b,
        desc: "Aceito ficar mais exposto a " + b + " se o preço cair." },
      { id: "acc_quote", label: "Acumular mais " + q,
        desc: "Aceito ficar mais exposto a " + q + " se o preço cair." },
      { id: "acc_ambos", label: "Adicionar os dois ativos",
        desc: "Quero aumentar a posição em " + b + " e " + q + " ao mesmo tempo." },
      { id: "fees",      label: "Foco 100% em taxas",
        desc: "O que importa é a taxa coletada, não a variação dos ativos." },
      { id: "apr_fast",  label: "APR alto — entrar, coletar e sair",
        desc: "Posição curta, aproveitando um pico de rendimento." },
      { id: "hedge",     label: "Manter exposição / hedge",
        desc: "Quero seguir posicionado sem aumentar risco direcional." },
      /* Declarar a intenção de compor importa: é o que permite, depois,
         comparar "eu disse que reinvestiria" com os eventos de
         reinvestimento realmente registrados na posição. */
      { id: "compor",    label: "Fazer juros compostos",
        desc: "Pretendo reinvestir as taxas na própria pool." }
    ];
  }

  function pintarObjetivos() {
    var host = U.qs("#objList");
    if (!host) return;
    var marcados = {};
    U.qsa("#objList .obj-item.on").forEach(function (n) { marcados[n.dataset.id] = 1; });

    host.innerHTML = objetivos().map(function (o) {
      return '<button type="button" class="obj-item' + (marcados[o.id] ? " on" : "") +
             '" data-id="' + o.id + '">' +
               '<span class="obj-box"></span>' +
               '<span class="obj-txt"><b>' + esc(o.label) + '</b><small>' + esc(o.desc) + '</small></span>' +
             '</button>';
    }).join("");

    U.qsa("#objList .obj-item").forEach(function (n) {
      n.addEventListener("click", function () { n.classList.toggle("on"); });
    });
  }

  function esc(t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ------------------------------------------------------------
     Capital calculado a partir das quantidades

     Busca o preço sozinho, mas o campo continua editável: uma
     posição aberta há três dias não vale o preço de hoje, e só
     quem abriu sabe o preço de entrada.
     ------------------------------------------------------------ */
  var precoBuscado = { base: null, quote: null };

  function num(el) {
    if (!el) return 0;
    var v = parseFloat(String(el.value).replace(",", "."));
    return isFinite(v) && v > 0 ? v : 0;
  }

  function fmtUSD(v) {
    return "US$ " + (v || 0).toLocaleString("pt-BR",
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function recalcularCapital() {
    var qb = num(U.qs("#qtyBase")),  qq = num(U.qs("#qtyQuote"));
    var pb = num(U.qs("#prBase")),   pq = num(U.qs("#prQuote"));
    var sb = qb * pb, sq = qq * pq;

    var simB = (U.qs("#tkBase").value.trim().toUpperCase()) || "—";
    var simQ = (U.qs("#tkQuote").value.trim().toUpperCase()) || "—";

    var linhas = U.qsa("#capCalc .cap-line");
    if (linhas[0]) linhas[0].querySelector(".cap-qty").textContent = qb ? (qb + " " + simB) : "—";
    if (linhas[1]) linhas[1].querySelector(".cap-qty").textContent = qq ? (qq + " " + simQ) : "—";

    U.qs("#subBase").textContent  = fmtUSD(sb);
    U.qs("#subQuote").textContent = fmtUSD(sq);
    U.qs("#capTotal").textContent = fmtUSD(sb + sq);
    U.qs("#capital").value = String(sb + sq);
    pintarDenom(simB, simQ, pb, pq);
    return sb + sq;
  }

  /* ------------------------------------------------------------
     A DENOMINAÇÃO DA FAIXA, COM OS TOKENS E OS NÚMEROS DE VERDADE

     O seletor tinha dois rótulos fixos cujos exemplos contradiziam a
     própria definição (ver o comentário em pools.html). Escolher
     errado ali não dá erro nenhum: a faixa é gravada, a razão é
     calculada na denominação oposta, e a posição aparece
     permanentemente "fora do range" — com todos os dados corretos.

     Agora cada opção mostra o par na ordem certa e, quando já há
     preço, QUANTO dá hoje nessa denominação. A pessoa compara com o
     número da corretora e escolhe o que se parece. Não sobra
     ambiguidade para interpretar.
     ------------------------------------------------------------ */
  function pintarDenom(simB, simQ, precoB, precoQ) {
    var sel = U.qs("#rngDenom");
    if (!sel) return;
    var b = simB && simB !== "—" ? simB : "BASE";
    var q = simQ && simQ !== "—" ? simQ : "PAR";
    var escolhido = sel.value;

    /* mesma conta de DeFiPerf.faixa: base_por_quote = aQ/aB */
    var rBQ = (precoB > 0 && precoQ > 0) ? (precoQ / precoB) : null;
    var rQB = (precoB > 0 && precoQ > 0) ? (precoB / precoQ) : null;

    function fmt(v) {
      if (v == null) return "";
      return " — hoje ≈ " + (v >= 1 ? v.toFixed(2) : v.toFixed(8));
    }

    sel.innerHTML =
      '<option value="base_por_quote">' + esc(b) + ' por ' + esc(q) +
        ' (quantos ' + esc(b) + ' valem 1 ' + esc(q) + ')' + fmt(rBQ) + '</option>' +
      '<option value="quote_por_base">' + esc(q) + ' por ' + esc(b) +
        ' (quantos ' + esc(q) + ' valem 1 ' + esc(b) + ')' + fmt(rQB) + '</option>';
    sel.value = escolhido || "base_por_quote";

    var hint = U.qs("#rngDenomHint");
    if (hint && rBQ != null) {
      hint.innerHTML = "Escolha a opção cujo número de hoje se parece com o da sua corretora — " +
        "é o que garante que a faixa seja lida na mesma ordem em que você a copiou.";
    }
  }

  function buscarPrecos() {
    var status = U.qs("#capStatus");
    var simB = U.qs("#tkBase").value.trim().toUpperCase();
    var simQ = U.qs("#tkQuote").value.trim().toUpperCase();

    if (!num(U.qs("#qtyBase")) && !num(U.qs("#qtyQuote"))) {
      if (status) status.textContent = "Digite as quantidades no passo anterior.";
      return;
    }
    if (!window.AtlasPrice) {
      if (status) status.textContent = "Preencha os preços manualmente.";
      return;
    }
    if (status) status.textContent = "Buscando preços…";

    Promise.all([
      simB ? AtlasPrice.bySymbol(simB) : Promise.resolve(null),
      simQ ? AtlasPrice.bySymbol(simQ) : Promise.resolve(null)
    ]).then(function (r) {
      var achou = 0, faltou = [];
      if (r[0] && r[0].usd) {
        precoBuscado.base = r[0].usd;
        if (!num(U.qs("#prBase"))) U.qs("#prBase").value = r[0].usd; 
        achou++;
      } else if (simB) faltou.push(simB);

      if (r[1] && r[1].usd) {
        precoBuscado.quote = r[1].usd;
        if (!num(U.qs("#prQuote"))) U.qs("#prQuote").value = r[1].usd;
        achou++;
      } else if (simQ) faltou.push(simQ);

      recalcularCapital();
      if (status) {
        status.textContent = faltou.length
          ? "Não achei preço de " + faltou.join(" e ") + " — preencha na mão."
          : (achou ? "Preço de mercado agora. Corrija se a posição é de outra data." : "");
      }
    }).catch(function () {
      if (status) status.textContent = "Sem conexão — preencha os preços na mão.";
    });
  }

  /* ============================================================
     AUTOPREENCHIMENTO — só o TOKEN, nunca a pool

     Existiam duas fontes aqui, e uma delas saiu na terceira auditoria.

       · DeFiTokens (fica)  → símbolo -> id do CoinGecko. É o que faz o
         PREÇO sair certo (ETH x WETH, BTC x WBTC x cbBTC). Offline,
         instantâneo, e alimenta o datalist dos dois campos de token.

       · DefiLlama (saiu)   → catálogo de pools por chain e protocolo,
         com um campo "Buscar a pool" que preenchia o par sozinho.

     POR QUE A BUSCA DE POOL SAIU

     Ela não achava a maioria das pools reais. O catálogo é filtrado
     por TVL mínimo (250 mil dólares) e cortado em 60 por chain — pool
     nova, pequena ou de protocolo fora da lista nunca aparecia. Um
     campo que responde "nenhuma pool encontrada" para uma pool que
     existe ensina o usuário a desconfiar da ferramenta inteira.

     E quando achava, era pior: escolherPool() gravava base e quote na
     ordem do DefiLlama, DESFAZENDO a ordem que a pessoa tinha
     digitado. ORCA/SOL virava SOL/ORCA sem aviso — e a ordem do par é
     o que define a denominação da faixa, que por sua vez decide o selo
     dentro/fora. Uma conveniência que reordenava dado.

     O par agora é 100% manual, na ordem digitada. Ver validate() e o
     espelho do par abaixo.
     ============================================================ */

  /* datalist do autocomplete de token */
  function pintarDatalist() {
    var dl = U.qs("#dlTokens");
    if (!dl || !window.DeFiTokens) return;
    dl.innerHTML = DeFiTokens.lista().map(function (t) {
      return '<option value="' + t.symbol + '">' + esc(t.name) + '</option>';
    }).join("");
  }

  /* ------------------------------------------------------------
     ESPELHO DO PAR — a ordem digitada, visível enquanto se digita

     A regra "o 1º token é o primeiro do par" só vale se a pessoa
     puder conferir antes de criar. Sem isso a ordem seria uma
     convenção invisível, e trocar dois campos de lugar mudaria
     silenciosamente a denominação da faixa lá na frente.
     ------------------------------------------------------------ */
  function pintarEspelhoPar() {
    var el = U.qs("#parEspelho");
    if (!el) return;
    var b = (U.qs("#tkBase") && U.qs("#tkBase").value.trim().toUpperCase()) || "";
    var q = (U.qs("#tkQuote") && U.qs("#tkQuote").value.trim().toUpperCase()) || "";
    if (!b && !q) {
      el.innerHTML = "O par vai ficar exatamente na ordem que você digitar.";
      return;
    }
    el.innerHTML = "O par vai ficar como <b>" + esc(b || "…") + " / " + esc(q || "…") +
      "</b> — na ordem que você digitou. Para inverter, troque o conteúdo dos dois campos.";
  }

  function ligarAutopreenchimento() {
    pintarDatalist();
    ["#tkBase", "#tkQuote"].forEach(function (sel) {
      var el = U.qs(sel);
      if (el) {
        el.addEventListener("input", pintarEspelhoPar);
        el.addEventListener("change", pintarEspelhoPar);
      }
    });
    pintarEspelhoPar();
  }

  function swatch(kind, name) {
    var c = S.colorOf(kind, name);
    return '<span class="swatch" style="background:' + c + '">' + name.slice(0, 2).toUpperCase() + '</span>';
  }

  U.qs("#optChain").innerHTML = CHAINS.map(function (c) {
    return '<div class="opt" data-v="' + c + '">' + swatch("chain", c) + c + '</div>';
  }).join("");
  U.qs("#optProto").innerHTML = PROTOS.map(function (p) {
    return '<div class="opt" data-v="' + p + '">' + swatch("proto", p) + p + '</div>';
  }).join("");

  U.qsa("#optChain .opt").forEach(function (o) {
    o.addEventListener("click", function () {
      U.qsa("#optChain .opt").forEach(function (x) { x.classList.remove("selected"); });
      o.classList.add("selected"); wz.chain = o.dataset.v;
    });
  });
  U.qsa("#optProto .opt").forEach(function (o) {
    o.addEventListener("click", function () {
      U.qsa("#optProto .opt").forEach(function (x) { x.classList.remove("selected"); });
      o.classList.add("selected"); wz.proto = o.dataset.v;
    });
  });

  function showStep(n) {
    wz.step = n;
    U.qsa(".wizard-panel").forEach(function (p) { p.classList.toggle("active", +p.dataset.panel === n); });
    U.qsa(".wstep").forEach(function (s) {
      var i = +s.dataset.s;
      s.classList.toggle("active", i === n);
      s.classList.toggle("done", i < n);
    });
    U.qs("#wPrev").style.visibility = n === 0 ? "hidden" : "visible";
    U.qs("#wNext").textContent = n === 4 ? "Criar posição" : "Continuar";

    // passo 4 (Capital): busca os preços ao chegar
    if (n === 3) { recalcularCapital(); buscarPrecos(); }
    // passo 5 (Objetivo): rótulos usam os tokens digitados
    if (n === 4) pintarObjetivos();
  }

  function validate(n) {
    if (n === 0 && !wz.chain) { U.toast("Selecione a blockchain.", "warn"); return false; }
    if (n === 1 && !wz.proto) { U.toast("Selecione o protocolo.", "warn"); return false; }
    if (n === 2 && (!U.qs("#tkBase").value.trim() || !U.qs("#tkQuote").value.trim())) { U.toast("Informe os dois tokens.", "warn"); return false; }
    /* Com o par 100% manual não há mais um catálogo para conferir o
       que foi digitado. O mesmo token nos dois campos produziria uma
       razão de 1 para sempre, e a faixa nunca faria sentido. */
    if (n === 2 && U.qs("#tkBase").value.trim().toUpperCase() === U.qs("#tkQuote").value.trim().toUpperCase()) {
      U.toast("Os dois tokens do par não podem ser o mesmo.", "warn"); return false;
    }
    if (n === 2 && !(num(U.qs("#qtyBase")) > 0) && !(num(U.qs("#qtyQuote")) > 0)) {
      U.toast("Informe a quantidade de pelo menos um token.", "warn"); return false;
    }
    if (n === 3 && !(parseFloat(U.qs("#capital").value) > 0)) {
      U.toast("O capital ficou zerado — confira quantidade e preço.", "warn"); return false;
    }
    return true;
  }

  /* ============================================================
     RASCUNHO DO WIZARD

     São cinco passos, com par de tokens, quantidades, preços, faixa e
     objetivos. Um clique fora do modal — ou fechar a aba no meio —
     apagava tudo, sem aviso e sem volta. Formulário longo que perde o
     que foi digitado é formulário que a pessoa não preenche duas
     vezes.

     O rascunho é gravado a cada mudança e restaurado ao abrir. Ele só
     é apagado quando a posição é criada, ou quando o usuário escolhe
     descartar — fechar não descarta.
     ============================================================ */
  var KEY_DRAFT = "atlas.defi.poolDraft.v1";
  /* "poolQ" saiu com a busca de pool do DefiLlama. Rascunho antigo que
     ainda tenha a chave é ignorado: aplicarRascunho() só escreve em
     campos que existem no DOM. */
  var CAMPOS = ["tkBase", "tkQuote", "qtyBase", "qtyQuote", "prBase", "prQuote",
                "capital", "apr", "goal", "rngLow", "rngHigh",
                "rngDenom", "openedAt", "tkCat"];

  function lerRascunho() {
    try { return JSON.parse(localStorage.getItem(KEY_DRAFT) || "null"); }
    catch (e) { return null; }
  }
  function gravarRascunho() {
    if (!U.qs("#modalNew") || !U.qs("#modalNew").classList.contains("open")) return;
    var d = { step: wz.step, chain: wz.chain, proto: wz.proto, campos: {}, objetivos: [] };
    CAMPOS.forEach(function (id) { var e = U.qs("#" + id); if (e) d.campos[id] = e.value; });
    U.qsa("#objList .obj-item.on").forEach(function (n) { d.objetivos.push(n.dataset.id); });
    d.em = Date.now();
    try { localStorage.setItem(KEY_DRAFT, JSON.stringify(d)); } catch (e) { /* sem storage: segue sem rascunho */ }
  }
  function limparRascunho() {
    try { localStorage.removeItem(KEY_DRAFT); } catch (e) {}
  }
  function temRascunho() {
    var d = lerRascunho();
    if (!d) return false;
    /* rascunho só conta se tiver ALGO preenchido — abrir e fechar o
       modal sem digitar nada não deve gerar "restaurar rascunho" */
    if (d.chain || d.proto || (d.objetivos && d.objetivos.length)) return true;
    return CAMPOS.some(function (id) {
      return d.campos && d.campos[id] && String(d.campos[id]).trim() &&
             id !== "openedAt" && id !== "tkCat" && id !== "rngDenom";
    });
  }

  function aplicarRascunho(d) {
    if (!d) return;
    CAMPOS.forEach(function (id) {
      var e = U.qs("#" + id);
      if (e && d.campos && d.campos[id] != null) e.value = d.campos[id];
    });
    wz.chain = d.chain || "";
    wz.proto = d.proto || "";
    U.qsa("#optChain .opt").forEach(function (x) { x.classList.toggle("selected", x.dataset.v === wz.chain); });
    U.qsa("#optProto .opt").forEach(function (x) { x.classList.toggle("selected", x.dataset.v === wz.proto); });
    pintarObjetivos();
    (d.objetivos || []).forEach(function (oid) {
      var n = U.qs('#objList .obj-item[data-id="' + oid + '"]');
      if (n) n.classList.add("on");
    });
    pintarEspelhoPar();
    showStep(Math.max(0, Math.min(4, d.step || 0)));
  }

  function limparFormulario() {
    U.qsa(".opt").forEach(function (x) { x.classList.remove("selected"); });
    ["tkBase", "tkQuote", "qtyBase", "qtyQuote", "prBase", "prQuote", "capital", "apr", "goal",
     "rngLow", "rngHigh"]
      .forEach(function (id) { var e = U.qs("#" + id); if (e) e.value = ""; });
    var rd = U.qs("#rngDenom"); if (rd) rd.value = "base_por_quote";
    precoBuscado = { base: null, quote: null };
    wz = { step: 0, chain: "", proto: "" };
    var dt = U.qs("#openedAt");
    if (dt) dt.value = U.hoje();
    U.qsa("#objList .obj-item.on").forEach(function (n) { n.classList.remove("on"); });
    var st = U.qs("#capStatus"); if (st) st.textContent = "";
    U.qs("#tkCat").value = "Liquidez";
    pintarEspelhoPar();
  }

  function openWizard() {
    limparFormulario();
    var d = temRascunho() ? lerRascunho() : null;
    if (d) aplicarRascunho(d); else showStep(0);
    pintarAvisoRascunho(!!d, d);
    U.openModal("#modalNew");
  }

  /* Restaurar em silêncio seria pior que perder: a pessoa abriria o
     wizard achando que está começando do zero e criaria uma posição
     com dados de outra tentativa. A faixa diz o que aconteceu e dá a
     saída para descartar. */
  function pintarAvisoRascunho(mostrar, d) {
    var host = U.qs("#draftBar");
    if (!host) return;
    if (!mostrar) { host.innerHTML = ""; host.style.display = "none"; return; }
    var quando = d && d.em ? new Date(d.em).toLocaleString("pt-BR") : "";
    host.style.display = "";
    host.innerHTML = '<span>Rascunho restaurado' + (quando ? " de " + esc(quando) : "") + '.</span>' +
      '<button type="button" class="btn btn-cancel btn-sm" id="draftDrop">Descartar e começar do zero</button>';
    var b = U.qs("#draftDrop");
    if (b) b.addEventListener("click", function () {
      limparRascunho(); limparFormulario(); showStep(0); pintarAvisoRascunho(false);
    });
  }

  U.qs("#btnNew").addEventListener("click", openWizard);
  U.qs("#closeNew").addEventListener("click", function () { gravarRascunho(); U.closeModal("#modalNew"); });
  U.qs("#modalNew").addEventListener("click", function (e) {
    if (e.target.id === "modalNew") { gravarRascunho(); U.closeModal("#modalNew"); }
  });
  /* Fechar a aba no meio do preenchimento também preserva. */
  window.addEventListener("beforeunload", gravarRascunho);
  /* Qualquer digitação ou clique dentro do modal grava — inclusive a
     troca de passo, a seleção de chain/protocolo e os objetivos. */
  ["input", "change", "click"].forEach(function (ev) {
    U.qs("#modalNew").addEventListener(ev, function () { setTimeout(gravarRascunho, 0); });
  });

  U.qs("#wPrev").addEventListener("click", function () { if (wz.step > 0) showStep(wz.step - 1); });
  U.qs("#wNext").addEventListener("click", function () {
    if (!validate(wz.step)) return;
    if (wz.step < 4) { showStep(wz.step + 1); return; }
    // criar
    var cap = parseFloat(U.qs("#capital").value);
    var apr = parseFloat(U.qs("#apr").value) || 0;
    var goal = U.qs("#goal").value.trim();
    var marcados = U.qsa("#objList .obj-item.on").map(function (n) { return n.dataset.id; });
    var rotulos  = U.qsa("#objList .obj-item.on").map(function (n) {
      return n.querySelector("b").textContent;
    });
    var hoje = U.hoje();
    /* A data que a pessoa informou manda. Sem isso, uma pool aberta mês
       passado entraria como criada hoje e o APR realizado sairia errado. */
    var dtAbertura = (U.qs("#openedAt") && U.qs("#openedAt").value) || hoje;
    if (dtAbertura > hoje) dtAbertura = hoje;      // nada de data no futuro

    /* ------------------------------------------------------------
       SÓ ABRE POSIÇÃO QUEM TEM CAIXA

       Antes, criar uma pool de US$ 50 não perguntava nada a ninguém: o
       dinheiro aparecia do nada dentro da posição e o patrimônio total
       subia sozinho. Agora o capital sai do caixa da carteira ativa, e
       carteira sem caixa não abre posição.

       A mensagem diz QUANTO falta e onde depositar — "saldo
       insuficiente" sem número obriga a pessoa a sair da tela para
       descobrir o que fazer.
       ------------------------------------------------------------ */
    if (window.AtlasCaixa) {
      var carteira = S.activeWallet();
      var conf = AtlasCaixa.podeGastar(carteira.id, cap);
      if (!conf.ok) {
        U.toast("Caixa insuficiente em " + carteira.name + ": há " +
                U.money(conf.saldo) + " e a posição pede " + U.money(cap) +
                ". Registre um depósito em Carteiras & Movimentações.", "warn");
        return;
      }
    }

    var p = S.addPool({
      base: U.qs("#tkBase").value.trim().toUpperCase(),
      quote: U.qs("#tkQuote").value.trim().toUpperCase(),
      protocol: wz.proto, chain: wz.chain, category: U.qs("#tkCat").value,

      /* quantidade e preço de entrada — a base de todo o
         acompanhamento posterior (valorização x taxa) */
      qtyBase:   num(U.qs("#qtyBase")),
      qtyQuote:  num(U.qs("#qtyQuote")),
      priceBase: num(U.qs("#prBase")),
      priceQuote:num(U.qs("#prQuote")),

      capital: cap, currentValue: cap, profit: 0, profitPct: 0, apr: apr,
      /* status guarda só o CICLO DE VIDA da posição. O selo
         dentro/fora sai de DeFiStore.statusDe(), calculado do preço
         contra a faixa — não é mais um campo. */
      status: "aberta",
      /* faixa numérica, quando informada — é o que permite o selo
         dentro/fora da faixa e a barra de posição na página da pool */
      rangeLow: num(U.qs("#rngLow")),
      rangeHigh: num(U.qs("#rngHigh")),
      rangeDenom: (U.qs("#rngDenom") && U.qs("#rngDenom").value) || "base_por_quote",
      openedAt: dtAbertura, closedAt: null,

      /* acompanhamento */
      createdAt: dtAbertura,
      updatedAt: hoje,
      fees: [],                    // histórico de coletas
      objectives: marcados,
      objectiveLabels: rotulos,
      goal: goal || (rotulos.length ? rotulos.join(" · ") : "Sem objetivo definido ainda.")
    });
    /* Criou: o rascunho cumpriu o papel e sai de cena. */
    limparRascunho();
    pintarAvisoRascunho(false);
    U.closeModal("#modalNew");
    U.toast("Pool " + p.base + "/" + p.quote + " criada.", "ok");
    rerun();
    /* Cota de novo: a posição recém-criada traz tokens que talvez não
       estivessem na última busca, e sem isso o card dela nasceria
       "Faixa não avaliada" até o próximo F5. */
    cotar();
  });

  ligarAutopreenchimento();

  // abre wizard automaticamente se veio de ?new=1
  if (U.param("new") === "1") setTimeout(openWizard, 250);
})();
