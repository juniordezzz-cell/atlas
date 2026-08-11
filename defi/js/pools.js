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
    items = F.apply(items, { chain: state.chain, protocol: state.protocol, status: state.status });

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
     WIZARD — Nova Pool
     ============================================================ */
  var CHAINS = ["Solana", "Ethereum", "Base", "Arbitrum", "Polygon", "Optimism"];
  var PROTOS = ["Kamino", "Meteora", "Orca", "Raydium", "Aerodrome", "Aave", "Pendle"];
  var wz = { step: 0, chain: "", proto: "", range: "dentro" };

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
    return sb + sq;
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
     AUTOPREENCHIMENTO — tokens e pools

     Duas fontes, dois papéis distintos:

       · DeFiTokens  → símbolo -> id do CoinGecko. É o que faz o
         PREÇO sair certo (ETH x WETH, BTC x WBTC x cbBTC). Offline.

       · provedor "defillama" → catálogo de pools REAIS por chain e
         protocolo. É o que faz a DESCOBERTA (Orca, Uniswap,
         Aerodrome, PancakeSwap, Curve...). Precisa de rede uma vez;
         depois fica em localStorage.

     O DefiLlama não devolve id do CoinGecko, por isso os dois
     existem. Escolher a pool preenche o par; o par resolve o preço
     pelo DeFiTokens.
     ============================================================ */

  function llama() {
    return (window.AtlasProviders && AtlasProviders.get)
      ? AtlasProviders.get("defillama") : null;
  }

  /* datalist do autocomplete de token */
  function pintarDatalist() {
    var dl = U.qs("#dlTokens");
    if (!dl || !window.DeFiTokens) return;
    dl.innerHTML = DeFiTokens.lista().map(function (t) {
      return '<option value="' + t.symbol + '">' + esc(t.name) + '</option>';
    }).join("");
  }

  function pintarHintPool(msg) {
    var h = U.qs("#poolHint");
    if (h) h.innerHTML = msg || "";
  }

  /* Resultados da busca de pool, filtrados pela chain e protocolo já
     escolhidos nos passos anteriores — se ele escolheu Solana + Orca,
     não faz sentido oferecer pool de Uniswap. */
  function pintarPools() {
    var host = U.qs("#poolResults");
    if (!host) return;
    var L = llama();
    if (!L) { host.innerHTML = ""; return; }

    var q = (U.qs("#poolQ") && U.qs("#poolQ").value.trim()) || "";
    if (!q) { host.innerHTML = ""; return; }

    var achadas = L.buscar({ q: q, chain: wz.chain || null, limite: 8 });

    if (!achadas.length) {
      var total = L.cached().length;
      host.innerHTML = '<div class="hint">' + (total
        ? 'Nenhuma pool com "' + esc(q) + '"' + (wz.chain ? " em " + esc(wz.chain) : "") +
          '. Digite o par na mão abaixo.'
        : 'Lista de pools vazia — clique em "Atualizar lista" para baixar do DefiLlama.') +
        '</div>';
      return;
    }

    host.innerHTML = '<div class="fee-list" style="margin-top:8px">' +
      achadas.map(function (p) {
        return '<button type="button" class="fee-item" data-pool="' + esc(p.id) + '" style="width:100%;text-align:left;cursor:pointer">' +
          '<span class="fee-amt" style="min-width:120px">' + esc(p.symbol) + '</span>' +
          '<span class="fee-tag">' + esc(p.protocol) + '</span>' +
          '<span class="fee-date">' + esc(p.chain) + '</span>' +
          '<span class="muted" style="font-size:11px;margin-left:auto">' +
            (p.apr ? p.apr.toFixed(1) + '% APR · ' : '') +
            'TVL ' + U.money(p.tvl) +
          '</span>' +
        '</button>';
      }).join("") + '</div>';

    U.qsa("#poolResults [data-pool]").forEach(function (b) {
      b.addEventListener("click", function () {
        var esc_id = b.dataset.pool;
        var achada = null;
        L.cached().some(function (x) { if (x.id === esc_id) { achada = x; return true; } return false; });
        if (!achada) return;
        escolherPool(achada);
      });
    });
  }

  /* Aplica a pool escolhida no formulário. Também alinha chain e
     protocolo dos passos anteriores, senão a posição sairia gravada
     com um protocolo que não é o da pool. */
  function escolherPool(pool) {
    U.qs("#tkBase").value = pool.base;
    U.qs("#tkQuote").value = pool.quote;

    wz.chain = pool.chain;
    U.qsa("#optChain .opt").forEach(function (x) {
      x.classList.toggle("selected", x.dataset.v === pool.chain);
    });

    /* O protocolo só é aplicado se existir na lista fixa do wizard.
       Protocolo que o DefiLlama conhece e o ATLAS não fica registrado
       como texto, sem forçar uma opção errada. */
    var temNaLista = PROTOS.indexOf(pool.protocol) !== -1;
    if (temNaLista) {
      wz.proto = pool.protocol;
      U.qsa("#optProto .opt").forEach(function (x) {
        x.classList.toggle("selected", x.dataset.v === pool.protocol);
      });
    } else {
      wz.proto = pool.protocol;
    }

    if (pool.apr && U.qs("#apr") && !U.qs("#apr").value) {
      U.qs("#apr").value = pool.apr;
    }

    U.qs("#poolResults").innerHTML = "";
    U.qs("#poolQ").value = pool.symbol;
    pintarHintPool('Par preenchido: <b>' + esc(pool.symbol) + '</b> · ' +
      esc(pool.protocol) + ' · ' + esc(pool.chain) +
      (pool.meta ? ' · ' + esc(pool.meta) : '') +
      '. O APR do DefiLlama é média recente, confira antes de usar.');
    recalcularCapital();
  }

  function ligarAutopreenchimento() {
    pintarDatalist();

    var L = llama();
    var q = U.qs("#poolQ");
    if (q) {
      q.addEventListener("input", pintarPools);
      q.addEventListener("focus", pintarPools);
    }

    if (L) {
      var ts = L.atualizadoEm();
      var n = L.cached().length;
      if (n) {
        var dias = Math.floor((Date.now() - ts) / 86400000);
        pintarHintPool(n + " pools em cache" +
          (dias >= 1 ? " · atualizado há " + dias + " dia(s)" : " · atualizado hoje") + ".");
      } else {
        pintarHintPool('Nenhuma pool baixada ainda. "Atualizar lista" busca as principais de todas as chains no DefiLlama.');
      }
    } else {
      pintarHintPool("Provedor de pools não carregado nesta página.");
    }

    var btn = U.qs("#poolRefresh");
    if (btn) btn.addEventListener("click", function () {
      var L2 = llama();
      if (!L2) { pintarHintPool("Provedor de pools não carregado."); return; }
      btn.disabled = true;
      pintarHintPool("Baixando o catálogo do DefiLlama… são milhares de pools, pode levar alguns segundos.");
      L2.refresh().then(function (lista) {
        btn.disabled = false;
        pintarHintPool("Pronto: <b>" + lista.length + "</b> pools guardadas em " +
          L2.chains().length + " chains. Digite o par acima.");
        pintarPools();
      }).catch(function (err) {
        btn.disabled = false;
        pintarHintPool(esc(err && err.message ? err.message : "Falha ao atualizar."));
      });
    });
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

  U.qsa("#rngOpts .rng-opt").forEach(function (o) {
    o.addEventListener("click", function () {
      U.qsa("#rngOpts .rng-opt").forEach(function (x) { x.classList.remove("on"); });
      o.classList.add("on");
      wz.range = o.dataset.v;
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
  var CAMPOS = ["tkBase", "tkQuote", "qtyBase", "qtyQuote", "prBase", "prQuote",
                "capital", "apr", "goal", "poolQ", "rngLow", "rngHigh",
                "rngDenom", "openedAt", "tkCat"];

  function lerRascunho() {
    try { return JSON.parse(localStorage.getItem(KEY_DRAFT) || "null"); }
    catch (e) { return null; }
  }
  function gravarRascunho() {
    if (!U.qs("#modalNew") || !U.qs("#modalNew").classList.contains("open")) return;
    var d = { step: wz.step, chain: wz.chain, proto: wz.proto, range: wz.range, campos: {}, objetivos: [] };
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
    wz.range = d.range || "dentro";
    U.qsa("#optChain .opt").forEach(function (x) { x.classList.toggle("selected", x.dataset.v === wz.chain); });
    U.qsa("#optProto .opt").forEach(function (x) { x.classList.toggle("selected", x.dataset.v === wz.proto); });
    U.qsa("#rngOpts .rng-opt").forEach(function (x) { x.classList.toggle("on", x.dataset.v === wz.range); });
    pintarObjetivos();
    (d.objetivos || []).forEach(function (oid) {
      var n = U.qs('#objList .obj-item[data-id="' + oid + '"]');
      if (n) n.classList.add("on");
    });
    showStep(Math.max(0, Math.min(4, d.step || 0)));
  }

  function limparFormulario() {
    U.qsa(".opt").forEach(function (x) { x.classList.remove("selected"); });
    ["tkBase", "tkQuote", "qtyBase", "qtyQuote", "prBase", "prQuote", "capital", "apr", "goal",
     "poolQ", "rngLow", "rngHigh"]
      .forEach(function (id) { var e = U.qs("#" + id); if (e) e.value = ""; });
    var pr = U.qs("#poolResults"); if (pr) pr.innerHTML = "";
    var rd = U.qs("#rngDenom"); if (rd) rd.value = "base_por_quote";
    precoBuscado = { base: null, quote: null };
    wz = { step: 0, chain: "", proto: "", range: "dentro" };
    U.qsa("#rngOpts .rng-opt").forEach(function (x, i) { x.classList.toggle("on", i === 0); });
    var dt = U.qs("#openedAt");
    if (dt) dt.value = U.hoje();
    U.qsa("#objList .obj-item.on").forEach(function (n) { n.classList.remove("on"); });
    var st = U.qs("#capStatus"); if (st) st.textContent = "";
    U.qs("#tkCat").value = "Liquidez";
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

    var statusPool = wz.range === "fora" ? "range"
                   : wz.range === "analise" ? "analise"
                   : (apr > 0 ? "ativa" : "analise");

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
      status: statusPool,
      /* faixa numérica, quando informada — é o que permite o selo
         dentro/fora da faixa e a barra de posição na página da pool */
      rangeLow: num(U.qs("#rngLow")),
      rangeHigh: num(U.qs("#rngHigh")),
      rangeDenom: (U.qs("#rngDenom") && U.qs("#rngDenom").value) || "base_por_quote",
      rangePos: wz.range === "fora" ? 1 : 0.5,
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
  });

  ligarAutopreenchimento();

  // abre wizard automaticamente se veio de ?new=1
  if (U.param("new") === "1") setTimeout(openWizard, 250);
})();
