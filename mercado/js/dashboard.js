/* ============================================================
   ATLAS · mercado/js/dashboard.js   (reescrito em 26/11/2026)
   Painel do Mercado: quatro abas centralizadas — DeFi · Tokens · RWA ·
   Rendimentos. Sempre abre em DeFi.

   Esqueleto igual em todas: esteira de cotações, abas, frase do dia
   (montada a partir dos números), faixa de 5 números, miolo em três
   colunas com o mapa de calor no centro, três painéis embaixo e tabela.
   Design aprovado: docs/superpowers/specs/2026-11-26-mercado-painel-design.md

   Regras: nenhum número inventado (campo ausente = "—", painel sem dado
   = "indisponível" + "Tentar de novo"); "O que mudou hoje" mostra a hora
   em que os dados chegaram; listas de tokens passam pelo filtro de
   qualidade. Dados: AcademyData (mercado/js/market-data.js).
   ============================================================ */
(function () {
  "use strict";

  /* ---------- formatação (pt-BR) ---------- */
  function n(v, casas) { return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }); }
  function big(v) {
    if (v == null || !isFinite(v)) return "—";
    var a = Math.abs(v), s = v < 0 ? "−" : "";
    if (a >= 1e12) return s + "$" + n(a / 1e12, 2) + " tri";
    if (a >= 1e9) return s + "$" + n(a / 1e9, a >= 1e11 ? 0 : 1) + " bi";
    if (a >= 1e6) return s + "$" + n(a / 1e6, a >= 1e8 ? 0 : 1) + " mi";
    if (a >= 1e3) return s + "$" + n(a / 1e3, 0) + " mil";
    return s + "$" + n(a, 0);
  }
  function money(v) {
    if (v == null || !isFinite(v)) return "—";
    var a = Math.abs(v);
    return "$" + n(v, a >= 1000 ? 0 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6);
  }
  function pc(v, casas) { if (v == null || !isFinite(v)) return "—"; return (v >= 0 ? "+" : "−") + n(Math.abs(v), casas == null ? 1 : casas) + "%"; }
  function apy(v) { return v == null || !isFinite(v) ? "—" : n(v, v >= 10 ? 1 : 2) + "%"; }
  function cls(v) { return v == null || !isFinite(v) ? "" : (v >= 0 ? "up" : "down"); }
  function hhmm(t) { var d = t ? new Date(t) : new Date(); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }

  function h(tag, c, t) { var e = document.createElement(tag); if (c) e.className = c; if (t != null) e.textContent = t; return e; }
  function add(p) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) p.appendChild(arguments[i]); return p; }
  function limpa(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function nada() { return null; }

  function assetLink(id, symbol) { return function () { window.__academyAssetHint = { id: id, symbol: symbol }; AcademyRouter.go("/ativo/" + id); }; }
  function abrirFora(url) { return function () { var a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener"; a.click(); }; }

  var refreshers = [];

  /* ---------- painel ---------- */
  function painel(titulo, dica) {
    var p = h("section", "mk-p");
    var head = add(h("header", "mk-p-head"), h("h3", "mk-p-titulo", titulo));
    var dicaEl = h("span", "mk-p-dica", dica || "");
    head.appendChild(dicaEl);
    var body = h("div", "mk-p-corpo");
    add(p, head, body);
    p.corpo = body;
    p.dica = function (t) { dicaEl.textContent = t; };
    p.estado = function (node) { limpa(body); body.appendChild(node); };
    p.carregando = function () { p.estado(h("div", "mk-vazio", "Carregando…")); };
    p.indisponivel = function (retry, texto) {
      var b = add(h("div", "mk-vazio"), h("span", null, texto || "Dados indisponíveis no momento."));
      if (retry) { var r = h("button", "mk-retry", "Tentar de novo"); r.type = "button"; r.addEventListener("click", retry); b.appendChild(r); }
      p.estado(b);
    };
    p.carregando();
    return p;
  }
  function linha(nome, valor, variacao, aoClicar, extra) {
    var r = h(aoClicar ? "button" : "div", "mk-linha");
    if (aoClicar) { r.type = "button"; r.addEventListener("click", aoClicar); }
    var nm = h("span", "mk-linha-nome", nome);
    if (extra) nm.appendChild(h("small", null, extra));
    var v = h("span", "mk-linha-valor", valor + (variacao !== undefined ? " " : ""));
    if (variacao !== undefined) v.appendChild(h("span", cls(variacao), pc(variacao)));
    return add(r, nm, v);
  }
  /* linha de ativo (27/11): ícone (regra do dono: todo ativo mostra a
     imagem), símbolo com o nome embaixo, preço com a variação embaixo.
     Sem imagem, fica a bolinha com as iniciais. */
  function icone(img, simbolo) {
    var bola = h("span", "mk-ico", String(simbolo || "?").slice(0, 3).toUpperCase());
    if (!img) return bola;
    var i = document.createElement("img");
    i.className = "mk-ico"; i.alt = ""; i.loading = "lazy"; i.decoding = "async"; i.width = 30; i.height = 30;
    i.addEventListener("error", function () { if (i.parentNode) i.parentNode.replaceChild(bola, i); });
    i.src = img;
    return i;
  }
  function linhaAtivo(x, valor, variacao, aoClicar, legenda) {
    var r = h(aoClicar ? "button" : "div", "mk-linha");
    if (aoClicar) { r.type = "button"; r.addEventListener("click", aoClicar); }
    var esq = add(h("span", "mk-ativo"), icone(x.image, x.symbol),
      add(h("span", "mk-ativo-txt"), h("b", null, x.symbol), h("small", null, legenda != null ? legenda : (x.name || ""))));
    var dir = add(h("span", "mk-ativo-num"), h("b", null, valor),
      variacao !== undefined ? h("small", cls(variacao), pc(variacao)) : null);
    return add(r, esq, dir);
  }
  function lista(linhas) { var l = h("div", "mk-lista"); linhas.forEach(function (x) { l.appendChild(x); }); return l; }
  /* [{nome, valor, rotulo, cor?}]; teto opcional: barra para de crescer ali
     (uma pool de 250% achataria todas as outras), o rótulo mostra o valor real */
  function barras(itens, teto) {
    var max = Math.max.apply(null, itens.map(function (x) { return Math.abs(x.valor) || 0; }).concat([1e-9]));
    if (teto && max > teto) max = teto;
    var w = h("div", "mk-barras");
    itens.forEach(function (x) {
      var b = h("div", "mk-barra"); var trilho = h("span", "mk-barra-trilho"); var i = h("i");
      i.style.width = Math.max(2, Math.min(1, Math.abs(x.valor) / max) * 100) + "%";
      i.style.background = x.cor || (x.valor >= 0 ? "var(--verde)" : "var(--vermelho)");
      trilho.appendChild(i);
      add(b, h("span", "mk-barra-nome", x.nome), trilho, h("span", "mk-barra-val " + (x.cor ? "" : cls(x.valor)), x.rotulo));
      w.appendChild(b);
    });
    return w;
  }
  var SEV = { alta: "alta", media: "média", baixa: "baixa" };
  function sinais(p, itens, quando) {
    if (!itens.length) return p.indisponivel(null, "Nada fora do comum agora.");
    p.dica("dados de " + hhmm(quando));
    var l = h("div", "mk-sinais");
    itens.forEach(function (s) {
      var r = h(s.aoClicar ? "button" : "div", "mk-sinal");
      if (s.aoClicar) { r.type = "button"; r.addEventListener("click", s.aoClicar); }
      add(r, h("time", null, hhmm(quando)), h("span", null, s.txt), h("span", "mk-sev sev-" + s.sev, SEV[s.sev]));
      l.appendChild(r);
    });
    p.estado(l);
  }
  function sevDe(v, forte, medio) { var a = Math.abs(v || 0); return a >= forte ? "alta" : a >= medio ? "media" : "baixa"; }

  /* tabela ordenável: cols [{rot, val(r), fmt(v,r), num:true}] */
  function tabela(p, cols, rows, opts) {
    opts = opts || {};
    var ordem = { i: opts.ordem != null ? opts.ordem : 2, desc: true }, limite = opts.limite || 25;
    function desenha() {
      var rs = rows.slice().sort(function (a, b) {
        var va = cols[ordem.i].val(a), vb = cols[ordem.i].val(b);
        if (va == null) return 1; if (vb == null) return -1;
        if (typeof va === "string") return ordem.desc ? vb.localeCompare(va) : va.localeCompare(vb);
        return ordem.desc ? vb - va : va - vb;
      });
      var w = h("div", "mk-tabela-rolagem"); var t = h("table", "mk-tabela"); var tr = h("tr");
      cols.forEach(function (c, i) {
        var th = h("th", c.num ? "num" : null);
        var b = h("button", null, c.rot + (ordem.i === i ? (ordem.desc ? " ↓" : " ↑") : "")); b.type = "button";
        b.addEventListener("click", function () { if (ordem.i === i) ordem.desc = !ordem.desc; else { ordem.i = i; ordem.desc = !!c.num; } desenha(); });
        th.appendChild(b); tr.appendChild(th);
      });
      add(t, add(h("thead"), tr));
      var tb = h("tbody");
      rs.slice(0, limite).forEach(function (r) {
        var linhaT = h("tr");
        if (opts.aoClicar) { linhaT.className = "clicavel"; linhaT.tabIndex = 0; linhaT.addEventListener("click", function () { opts.aoClicar(r); });
          linhaT.addEventListener("keydown", function (e) { if (e.key === "Enter") opts.aoClicar(r); }); }
        cols.forEach(function (c) {
          var v = c.val(r); var td = h("td", c.num ? "num" : null);
          var txt = c.fmt ? c.fmt(v, r) : (v == null ? "—" : String(v));
          if (c.cor) td.className += " " + cls(v);
          td.textContent = txt; linhaT.appendChild(td);
        });
        tb.appendChild(linhaT);
      });
      add(t, tb); w.appendChild(t);
      var box = h("div"); box.appendChild(w);
      if (rows.length > limite) {
        var mais = h("button", "mk-mais", "Mostrar mais " + Math.min(25, rows.length - limite)); mais.type = "button";
        mais.addEventListener("click", function () { limite += 25; desenha(); }); box.appendChild(mais);
      }
      p.estado(box);
    }
    desenha();
  }

  /* ---------- esteira de cotações (fica como estava) ---------- */
  var STABLE_SYM = { USDT:1, USDC:1, DAI:1, USDE:1, FDUSD:1, PYUSD:1, TUSD:1, USDD:1, BUSD:1, USDS:1, USD1:1, BUIDL:1, USDG:1, USDTB:1, RLUSD:1, USD0:1, SUSDE:1, SUSDS:1, USDF:1, USYC:1, A7A5:1, EURC:1, XAUT:0 };
  function tickerTape() {
    var tape = h("div", "cc-tape atlas-marquee");
    tape.setAttribute("aria-label", "Cotações das maiores criptomoedas");
    tape.style.display = "none";
    function trilho(rows, copia) {
      var tr = h("div", "atlas-marquee__track");
      if (copia) tr.setAttribute("aria-hidden", "true");
      rows.forEach(function (r) {
        var it = h("button", "cc-tape-item"); it.type = "button";
        if (copia) it.tabIndex = -1;
        add(it, h("span", "cc-tape-sym", r.symbol), h("span", "cc-tape-px", money(r.usd)), h("span", "cc-tape-chg " + cls(r.change24h), pc(r.change24h, 2)));
        it.addEventListener("click", assetLink(r.id, r.symbol));
        tr.appendChild(it);
      });
      return tr;
    }
    function load() {
      AcademyData.markets().then(function (rows) {
        rows = (rows || []).filter(function (r) { return r.usd && !STABLE_SYM[r.symbol]; }).slice(0, 20);
        if (!rows.length) return;
        limpa(tape);
        tape.style.setProperty("--atlas-marquee-dur", (rows.length * 3.2) + "s");
        add(tape, trilho(rows, false), trilho(rows, true));
        tape.style.display = "";
      }).catch(function () {});
    }
    load(); refreshers.push(load);
    return tape;
  }

  /* ---------- topo: frase + 5 números ---------- */
  function topo(rotulos) {
    var hero = h("div", "mk-hero");
    var frase = h("p", "mk-frase", " ");
    var faixa = h("div", "mk-kpis");
    var cel = rotulos.map(function (r) {
      var d = h("div", "mk-kpi"); var v = h("b", null, "…"); var s = h("small", null, " ");
      add(d, h("span", null, r), v, s); faixa.appendChild(d);
      return { set: function (valor, sub, classe) { v.textContent = valor == null ? "—" : valor; s.textContent = sub || " "; s.className = classe || ""; } };
    });
    add(hero, frase, faixa);
    return { el: hero, kpi: cel, frase: function (t) { frase.textContent = t || " "; } };
  }
  function rotuloFG(v) { return v == null ? "" : v <= 25 ? "medo extremo" : v < 45 ? "medo" : v <= 55 ? "neutro" : v < 75 ? "ganância" : "ganância extrema"; }
  function classeFG(v) { return v == null ? "" : v < 45 ? "aviso" : v > 55 ? "up" : ""; }

  /* ---------- nomes em português ---------- */
  var CATEGORIA = { "Lending": "Empréstimo", "Liquid Staking": "Staking líquido", "Dexs": "DEX", "Derivatives": "Perpétuos",
    "Restaking": "Restaking", "Liquid Restaking": "Restaking líquido", "CDP": "Dólar com garantia", "Basis Trading": "Dólar sintético",
    "Yield": "Rendimento", "Staking Pool": "Staking", "RWA": "RWA", "RWA Lending": "Crédito RWA", "Yield Aggregator": "Agregador",
    "Prediction Market": "Previsões", "Launchpad": "Lançamentos", "Privacy": "Privacidade", "Options": "Opções", "Farm": "Fazenda",
    "Restaked BTC": "BTC em restaking", "Anchor BTC": "BTC", "Decentralized BTC": "BTC", "Stablecoin Issuer": "Stablecoin",
    "Services": "Serviços", "Insurance": "Seguro", "Algo-Stables": "Dólar algorítmico", "Leveraged Farming": "Alavancagem" };
  function cat(c) { return CATEGORIA[c] || c || "—"; }
  function rede(r) { return r ? String(r).replace(/ L1$/, "").replace(/^Binance$/, "BSC") : "—"; }

  /* ==========================================================
     ABA DEFI
     ========================================================== */
  function abaDefi(mount) {
    var T = topo(["TVL DeFi", "Volume 24h", "Taxas 24h", "Stablecoins", "Medo e ganância"]);
    mount.appendChild(T.el);
    var grade = h("div", "mk-miolo");
    var pRedes = painel("Redes", "TVL · 7 dias");
    var pMapa = painel("Onde está o dinheiro", "tamanho = TVL · cor = 7 dias");
    pMapa.classList.add("mk-p-mapa");
    var pSinais = painel("O que mudou hoje", "");
    add(grade, pRedes, pMapa, pSinais); mount.appendChild(grade);
    var baixo = h("div", "mk-baixo");
    var pFluxo = painel("Fluxo da semana", "entrou · saiu, por rede");
    var pVol = painel("Maior volume 24h", "DEX e perpétuos");
    var pTaxas = painel("Maiores taxas 24h", "quem mais fatura");
    add(baixo, pFluxo, pVol, pTaxas); mount.appendChild(baixo);
    var pTab = painel("Protocolos", "clique no título da coluna para ordenar");
    pTab.classList.add("mk-p-tabela"); mount.appendChild(pTab);

    var D = null, redeSel = null;

    function volDe(k) {
      if (!D) return null;
      var v = D.vol && D.vol.porGrupo[k] ? D.vol.porGrupo[k].v24h : 0;
      if (k === "hyperliquid" && D.hl) v += D.hl.total24h;
      return v || null;
    }
    function taxaDe(k) { return D && D.taxas && D.taxas.porGrupo[k] ? D.taxas.porGrupo[k].v24h : null; }
    function abrirProto(p) { return p.geckoId ? assetLink(p.geckoId, null) : abrirFora(p.link); }

    function desenhaMapa() {
      var ps = D.protos;
      var caixa = h("div", "mk-mapa");
      if (redeSel) {
        var its = ps.filter(function (p) { return p.redes && p.redes[redeSel] > 0; })
          .sort(function (a, b) { return b.redes[redeSel] - a.redes[redeSel]; }).slice(0, 24)
          .map(function (p) { return { nome: p.nome, valor: p.redes[redeSel], variacao: p.change7d, detalhe: big(p.redes[redeSel]), aoClicar: abrirProto(p) }; });
        if (!its.length) return pMapa.indisponivel(null, "Sem protocolos de " + rede(redeSel) + " na lista.");
        pMapa.estado(caixa);
        AcademyTreemap.render(caixa, [{ nome: rede(redeSel), itens: its }], { titulos: false, escala: 10 });
        pMapa.dica(rede(redeSel) + " · clique na rede de novo para ver todas");
        return;
      }
      var porRede = {};
      ps.forEach(function (p) { var r = p.redePrincipal || "Outras"; (porRede[r] || (porRede[r] = [])).push(p); });
      var redes = Object.keys(porRede).map(function (r) { return { r: r, tvl: porRede[r].reduce(function (s, p) { return s + p.tvl; }, 0) }; })
        .sort(function (a, b) { return b.tvl - a.tvl; });
      var principais = redes.slice(0, 7).map(function (x) { return x.r; });
      var grupos = principais.map(function (r) {
        return { nome: rede(r), chave: r, itens: porRede[r].slice(0, 9).map(function (p) {
          return { nome: p.nome, valor: p.tvl, variacao: p.change7d, detalhe: big(p.tvl), aoClicar: abrirProto(p) }; }) };
      });
      var outras = [];
      redes.slice(7).forEach(function (x) { porRede[x.r].forEach(function (p) { outras.push(p); }); });
      outras.sort(function (a, b) { return b.tvl - a.tvl; });
      if (outras.length) grupos.push({ nome: "Outras redes", itens: outras.slice(0, 10).map(function (p) {
        return { nome: p.nome, valor: p.tvl, variacao: p.change7d, detalhe: big(p.tvl) + " · " + rede(p.redePrincipal), aoClicar: abrirProto(p) }; }) });
      pMapa.estado(caixa);
      AcademyTreemap.render(caixa, grupos, { escala: 10, aoClicarGrupo: function (g) { if (g.chave) escolheRede(g.chave); } });
      pMapa.dica("tamanho = TVL · cor = 7 dias · clique numa rede para abrir só ela");
    }
    function desenhaRedes() {
      if (!D.chains || !D.chains.length) return pRedes.indisponivel(carregar);
      pRedes.estado(lista(D.chains.map(function (c) {
        var l = linha(rede(c.name), big(c.tvl), c.change7d, function () { escolheRede(c.name); });
        if (redeSel === c.name) l.classList.add("ativa");
        return l;
      })));
    }
    function desenhaTabela() {
      var rows = D.protos.filter(function (p) { return !redeSel || (p.redes && p.redes[redeSel] > 0); });
      tabela(pTab, [
        { rot: "Protocolo", val: function (r) { return r.nome; } },
        { rot: "Categoria", val: function (r) { return cat(r.categoria); } },
        { rot: redeSel ? "TVL em " + rede(redeSel) : "TVL", num: true, val: function (r) { return redeSel ? r.redes[redeSel] : r.tvl; }, fmt: big },
        { rot: "Volume 24h", num: true, val: function (r) { return volDe(r.chave); }, fmt: big },
        { rot: "Taxas 24h", num: true, val: function (r) { return taxaDe(r.chave); }, fmt: big },
        { rot: "Rede principal", val: function (r) { return rede(r.redePrincipal); } },
        { rot: "7 dias", num: true, cor: true, val: function (r) { return r.change7d; }, fmt: function (v) { return pc(v); } }
      ], rows, { ordem: 2, aoClicar: function (r) { abrirProto(r)(); } });
      pTab.dica(redeSel ? "filtrado por " + rede(redeSel) + " · clique numa linha para abrir" : "clique no título da coluna para ordenar · clique numa linha para abrir");
    }
    function escolheRede(r) { redeSel = redeSel === r ? null : r; desenhaRedes(); desenhaMapa(); desenhaTabela(); }

    function carregar() {
      Promise.all([
        AcademyData.defiProtocolos().catch(nada), AcademyData.defiChains(8).catch(nada), AcademyData.defiTvl().catch(nada),
        AcademyData.defiVolume().catch(nada), AcademyData.defiTaxas().catch(nada), AcademyData.stablecoinsTotal().catch(nada),
        AcademyData.feargreed().catch(nada), AcademyData.hlVolume().catch(nada)
      ]).then(function (r) {
        D = { protos: r[0] || [], chains: r[1] || [], tvl: r[2], vol: r[3], taxas: r[4], st: r[5], fg: r[6], hl: r[7] };
        var quando = AcademyData.idade.protocolos || Date.now();
        // números
        T.kpi[0].set(D.tvl ? big(D.tvl.current) : null, D.tvl && D.tvl.change24h != null ? pc(D.tvl.change24h) + " em 24h" : "", cls(D.tvl && D.tvl.change24h));
        var volTot = (D.vol && D.vol.total24h || 0) + (D.hl ? D.hl.total24h : 0);
        T.kpi[1].set(volTot ? big(volTot) : null, D.hl ? "DEX + Hyperliquid" : "DEX", "mute");
        T.kpi[2].set(D.taxas ? big(D.taxas.total24h) : null, "pagas pelos usuários", "mute");
        T.kpi[3].set(D.st ? big(D.st.total) : null, D.st && D.st.change7d != null ? pc(D.st.change7d) + " em 7 dias" : "", cls(D.st && D.st.change7d));
        T.kpi[4].set(D.fg ? String(D.fg.value) : null, rotuloFG(D.fg && D.fg.value), classeFG(D.fg && D.fg.value));
        // frase do dia
        var cs = (D.chains || []).filter(function (c) { return c.change7d != null; });
        // só conta como "ganha/perde" quem andou pelo menos 0,5% na semana
        var sobe = cs.slice().sort(function (a, b) { return b.change7d - a.change7d; }).filter(function (c) { return c.change7d >= 0.5; }).slice(0, 2);
        var cai = cs.slice().sort(function (a, b) { return a.change7d - b.change7d; }).filter(function (c) { return c.change7d <= -0.5; }).slice(0, 2);
        function nomes(l) { return l.map(function (c) { return rede(c.name); }).join(" e "); }
        var f = [];
        if (D.tvl) f.push("DeFi " + (Math.abs(D.tvl.change24h || 0) < 1 ? "estável em " : (D.tvl.change24h > 0 ? "sobe para " : "cai para ")) + big(D.tvl.current) + ".");
        if (sobe.length && cai.length) f.push(nomes(sobe) + (sobe.length > 1 ? " ganham" : " ganha") + " dinheiro na semana; " + nomes(cai) + (cai.length > 1 ? " perdem." : " perde."));
        else if (sobe.length) f.push(nomes(sobe) + (sobe.length > 1 ? " ganham" : " ganha") + " dinheiro na semana.");
        else if (cai.length) f.push(nomes(cai) + (cai.length > 1 ? " perdem" : " perde") + " mais dinheiro na semana.");
        if (D.fg) f.push("Mercado com " + rotuloFG(D.fg.value) + ".");
        T.frase(f.join(" "));
        if (!D.protos.length) { pMapa.indisponivel(carregar); pTab.indisponivel(carregar); }
        else { desenhaMapa(); desenhaTabela(); }
        desenhaRedes();
        // fluxo da semana
        var fl = (D.chains || []).filter(function (c) { return c.delta7d != null; }).sort(function (a, b) { return b.delta7d - a.delta7d; });
        if (fl.length) pFluxo.estado(barras(fl.map(function (c) { return { nome: rede(c.name), valor: c.delta7d, rotulo: (c.delta7d >= 0 ? "+" : "") + big(c.delta7d) }; })));
        else pFluxo.indisponivel(carregar);
        // maior volume
        var vs = [];
        if (D.vol) Object.keys(D.vol.porGrupo).forEach(function (k) { var g = D.vol.porGrupo[k]; vs.push({ nome: g.nome, chave: k, v: volDe(k), c: g.change1d }); });
        if (D.hl && !D.vol) vs.push({ nome: "Hyperliquid", chave: "hyperliquid", v: D.hl.total24h, c: null });
        if (D.hl && D.vol && !D.vol.porGrupo.hyperliquid) vs.push({ nome: "Hyperliquid", chave: "hyperliquid", v: D.hl.total24h, c: null });
        vs.sort(function (a, b) { return b.v - a.v; });
        if (vs.length) pVol.estado(lista(vs.slice(0, 6).map(function (x) {
          return linha(x.nome, big(x.v), x.chave === "hyperliquid" ? undefined : x.c, null, x.chave === "hyperliquid" && D.hl ? "inclui perpétuos" : null);
        }))); else pVol.indisponivel(carregar);
        // maiores taxas
        if (D.taxas) {
          var ts = Object.keys(D.taxas.porGrupo).map(function (k) { return D.taxas.porGrupo[k]; }).sort(function (a, b) { return b.v24h - a.v24h; }).slice(0, 6);
          pTaxas.estado(lista(ts.map(function (x) { return linha(x.nome, big(x.v24h), x.change1d); })));
        } else pTaxas.indisponivel(carregar);
        // o que mudou hoje
        var S = [];
        var cMov = cs.slice().sort(function (a, b) { return Math.abs(b.change7d) - Math.abs(a.change7d); })[0];
        if (cMov && Math.abs(cMov.change7d) >= 2) S.push({ sev: sevDe(cMov.change7d, 15, 5), txt: rede(cMov.name) + (cMov.change7d >= 0 ? " ganha " : " perde ") + pc(Math.abs(cMov.change7d)).replace(/^[+−]/, "") + " do TVL na semana", aoClicar: function () { escolheRede(cMov.name); } });
        var grandes = D.protos.filter(function (p) { return p.tvl > 5e8 && p.change7d != null; });
        var g1 = grandes.slice().sort(function (a, b) { return b.change7d - a.change7d; })[0];
        var g2 = grandes.slice().sort(function (a, b) { return a.change7d - b.change7d; })[0];
        if (g1 && g1.change7d >= 3) S.push({ sev: sevDe(g1.change7d, 20, 8), txt: g1.nome + " cresce " + pc(g1.change7d).slice(1) + " em 7 dias (" + big(g1.tvl) + ")", aoClicar: abrirProto(g1) });
        if (g2 && g2.change7d <= -3) S.push({ sev: sevDe(g2.change7d, 20, 8), txt: g2.nome + " perde " + pc(g2.change7d).slice(1) + " em 7 dias (" + big(g2.tvl) + ")", aoClicar: abrirProto(g2) });
        if (D.hl) S.push({ sev: "baixa", txt: "Hyperliquid negocia " + big(D.hl.total24h) + " em perpétuos em 24h" });
        if (D.vol && D.vol.change1d != null && Math.abs(D.vol.change1d) >= 10) S.push({ sev: sevDe(D.vol.change1d, 30, 10), txt: "Volume das DEX " + (D.vol.change1d > 0 ? "sobe " : "cai ") + pc(Math.abs(D.vol.change1d)).slice(1) + " em 24h" });
        if (D.st && D.st.change7d != null) S.push({ sev: sevDe(D.st.change7d, 3, 1), txt: "Stablecoins " + (D.st.change7d >= 0 ? "somam " : "perdem ") + big(Math.abs(D.st.total - D.st.total / (1 + D.st.change7d / 100))) + " em 7 dias" });
        if (D.fg && (D.fg.value <= 25 || D.fg.value >= 75)) S.push({ sev: "alta", txt: "Medo e ganância em " + D.fg.value + " (" + rotuloFG(D.fg.value) + ")" });
        sinais(pSinais, S, quando);
      });
    }
    carregar(); refreshers.push(carregar);
  }

  /* ==========================================================
     ABA TOKENS
     ========================================================== */
  /* Filtro de qualidade: valor de mercado ≥ US$ 50 mi, volume 24h ≥ US$ 1 mi,
     sem stablecoins. Variação acima de 200% num dia, com esse tamanho, é
     quase sempre erro de dado da fonte (ex.: A7A5 +550% em 26/11). */
  function qualidade(rows) {
    return (rows || []).filter(function (r) {
      if (!(r.marketCap >= 5e7 && r.volume24h >= 1e6) || r.change24h == null || Math.abs(r.change24h) > 200) return false;
      if (STABLE_SYM[r.symbol] || /^(usd|eur)/i.test(r.symbol || "")) return false;
      var cravadoEm1 = Math.abs((r.usd || 0) - 1) < 0.02 && Math.abs(r.change24h) < 2; // dólar com outro nome
      return !cravadoEm1;
    });
  }
  var SETORES = [["artificial-intelligence", "IA"], ["decentralized-finance-defi", "DeFi"], ["layer-1", "Camada 1"],
    ["meme-token", "Memes"], ["real-world-assets-rwa", "RWA"], ["depin", "DePIN"], ["privacy-coins", "Privacidade"], ["gaming", "Jogos"], ["layer-2", "Camada 2"]];

  function abaTokens(mount) {
    var T = topo(["Valor de mercado", "Volume 24h", "Dominância BTC", "Subindo / caindo", "Medo e ganância"]);
    mount.appendChild(T.el);
    var grade = h("div", "mk-miolo");
    var pAlta = painel("Maiores altas 24h", "acima de $50 mi");
    var pMapa = painel("Mapa do mercado", "tamanho = valor de mercado · cor = 24h"); pMapa.classList.add("mk-p-mapa");
    var pQueda = painel("Maiores quedas 24h", "acima de $50 mi");
    add(grade, pAlta, pMapa, pQueda); mount.appendChild(grade);
    var baixo = h("div", "mk-baixo");
    var pVolAn = painel("Volume fora do normal", "volume ÷ valor de mercado");
    var pSet = painel("Setores 24h", "valor de mercado");
    var pSinais = painel("O que mudou hoje", "");
    add(baixo, pVolAn, pSet, pSinais); mount.appendChild(baixo);
    var pTab = painel("Tokens", "filtro de qualidade ligado"); pTab.classList.add("mk-p-tabela"); mount.appendChild(pTab);

    function carregar() {
      Promise.all([AcademyData.markets().catch(nada), AcademyData.global().catch(nada), AcademyData.feargreed().catch(nada)]).then(function (r) {
        var mk = r[0] || [], g = r[1], fg = r[2], quando = Date.now();
        if (!mk.length) { [pAlta, pMapa, pQueda, pVolAn, pTab].forEach(function (p) { p.indisponivel(carregar); }); }
        var Q = qualidade(mk);
        var top100 = Q.slice().sort(function (a, b) { return b.marketCap - a.marketCap; }).slice(0, 100);
        var up = top100.filter(function (x) { return x.change24h > 0; }).length;
        T.kpi[0].set(g ? big(g.marketCap) : null, "todas as criptomoedas", "mute");
        T.kpi[1].set(g ? big(g.volume24h) : null, "corretoras e DEX", "mute");
        T.kpi[2].set(g && g.btcDominance != null ? n(g.btcDominance, 1) + "%" : null, "do valor de mercado", "mute");
        T.kpi[3].set(top100.length ? up + " / " + (top100.length - up) : null, "dos " + top100.length + " maiores", up >= top100.length / 2 ? "up" : "down");
        T.kpi[4].set(fg ? String(fg.value) : null, rotuloFG(fg && fg.value), classeFG(fg && fg.value));
        var btc = mk.filter(function (x) { return x.symbol === "BTC"; })[0];
        var altas = Q.slice().sort(function (a, b) { return b.change24h - a.change24h; });
        var quedas = Q.slice().sort(function (a, b) { return a.change24h - b.change24h; });
        var f = [];
        if (btc) f.push("Bitcoin " + (btc.change24h >= 0 ? "sobe " : "cai ") + pc(btc.change24h).slice(1) + " em 24h.");
        if (top100.length) f.push(up >= top100.length * 0.6 ? "A maioria dos tokens sobe." : up <= top100.length * 0.4 ? "A maioria dos tokens cai." : "Mercado dividido.");
        if (altas[0] && altas[0].change24h > 0) f.push(altas[0].symbol + " lidera as altas (" + pc(altas[0].change24h) + ")" + (quedas[0] && quedas[0].change24h < 0 ? "; " + quedas[0].symbol + " lidera as quedas (" + pc(quedas[0].change24h) + ")." : "."));
        T.frase(f.join(" "));
        function lt(x) { return linhaAtivo(x, money(x.usd), x.change24h, assetLink(x.id, x.symbol)); }
        if (altas.length) pAlta.estado(lista(altas.filter(function (x) { return x.change24h > 0; }).slice(0, 8).map(lt)));
        if (quedas.length) pQueda.estado(lista(quedas.filter(function (x) { return x.change24h < 0; }).slice(0, 8).map(lt)));
        // mapa: 30 maiores sem stablecoins
        var mapa = mk.filter(function (x) { return x.marketCap > 0 && !STABLE_SYM[x.symbol] && !/^(usd|eur)/i.test(x.symbol || ""); })
          .sort(function (a, b) { return b.marketCap - a.marketCap; }).slice(0, 30);
        if (mapa.length) {
          var caixa = h("div", "mk-mapa"); pMapa.estado(caixa);
          AcademyTreemap.render(caixa, [{ nome: "Tokens", itens: mapa.map(function (x) {
            return { nome: x.symbol, valor: x.marketCap, variacao: x.change24h, detalhe: big(x.marketCap), aoClicar: assetLink(x.id, x.symbol) }; }) }],
            { titulos: false, escala: 6 });
        }
        // volume fora do normal
        var va = Q.map(function (x) { return { x: x, r: x.volume24h / x.marketCap }; }).sort(function (a, b) { return b.r - a.r; }).slice(0, 6);
        if (va.length) pVolAn.estado(lista(va.map(function (o) { return linhaAtivo(o.x, n(o.r, 1) + "×", o.x.change24h, assetLink(o.x.id, o.x.symbol), "volume " + big(o.x.volume24h)); })));
        // tabela
        if (Q.length) tabela(pTab, [
          { rot: "Token", val: function (r) { return r.symbol; } },
          { rot: "Nome", val: function (r) { return r.name; } },
          { rot: "Valor de mercado", num: true, val: function (r) { return r.marketCap; }, fmt: big },
          { rot: "Preço", num: true, val: function (r) { return r.usd; }, fmt: money },
          { rot: "Volume 24h", num: true, val: function (r) { return r.volume24h; }, fmt: big },
          { rot: "24h", num: true, cor: true, val: function (r) { return r.change24h; }, fmt: function (v) { return pc(v); } }
        ], Q, { ordem: 2, aoClicar: function (r) { assetLink(r.id, r.symbol)(); } });
        // sinais
        var S = [];
        if (quedas[0] && quedas[0].change24h <= -5) S.push({ sev: sevDe(quedas[0].change24h, 15, 8), txt: quedas[0].symbol + " cai " + pc(quedas[0].change24h).slice(1) + " em 24h", aoClicar: assetLink(quedas[0].id, quedas[0].symbol) });
        if (altas[0] && altas[0].change24h >= 5) S.push({ sev: sevDe(altas[0].change24h, 15, 8), txt: altas[0].symbol + " sobe " + pc(altas[0].change24h).slice(1) + " em 24h", aoClicar: assetLink(altas[0].id, altas[0].symbol) });
        if (va[0] && va[0].r >= 1) S.push({ sev: va[0].r >= 2 ? "media" : "baixa", txt: "Volume de " + va[0].x.symbol + " em " + n(va[0].r, 1) + "× o valor de mercado", aoClicar: assetLink(va[0].x.id, va[0].x.symbol) });
        if (btc && Math.abs(btc.change24h) >= 3) S.push({ sev: sevDe(btc.change24h, 8, 3), txt: "Bitcoin " + (btc.change24h > 0 ? "sobe " : "cai ") + pc(btc.change24h).slice(1) + " em 24h", aoClicar: assetLink(btc.id, "BTC") });
        if (fg && (fg.value <= 25 || fg.value >= 75)) S.push({ sev: "alta", txt: "Medo e ganância em " + fg.value + " (" + rotuloFG(fg.value) + ")" });
        sinais(pSinais, S, quando);
      });
      // setores (CoinGecko, chamada separada: não segura o resto)
      setTimeout(function () {
        AcademyData.categories().then(function (cats) {
          var byId = {}; (cats || []).forEach(function (c) { byId[c.id] = c; });
          var it = SETORES.map(function (s) { var c = byId[s[0]]; return c && c.change24h != null ? { nome: s[1], valor: c.change24h, rotulo: pc(c.change24h) } : null; })
            .filter(Boolean).sort(function (a, b) { return b.valor - a.valor; });
          if (it.length) pSet.estado(barras(it)); else pSet.indisponivel(carregar);
        }).catch(function () { pSet.indisponivel(carregar); });
      }, 600);
    }
    carregar(); refreshers.push(carregar);
  }

  /* ==========================================================
     ABA RWA
     Valores por classe vêm das categorias da CoinGecko (a DefiLlama zerou
     BUIDL, Ondo e os ouros no /protocols em nov/2026). Ações uma a uma
     pela categoria tokenized-stock.
     ========================================================== */
  var CLASSES_RWA = [["tokenized-private-credit", "Crédito privado"], ["tokenized-treasuries", "Tesouro"],
    ["tokenized-gold", "Ouro"], ["tokenized-silver", "Prata"]];

  function abaRwa(mount) {
    var T = topo(["Ativos tokenizados", "Crédito privado", "Tesouro tokenizado", "Ouro tokenizado", "Ações tokenizadas"]);
    mount.appendChild(T.el);
    var grade = h("div", "mk-miolo");
    var pAlta = painel("Ações em alta", "24h");
    var pMapa = painel("Mapa das ações tokenizadas", "tamanho = valor de mercado · cor = 24h"); pMapa.classList.add("mk-p-mapa");
    var pQueda = painel("Ações em queda", "24h");
    add(grade, pAlta, pMapa, pQueda); mount.appendChild(grade);
    var baixo = h("div", "mk-baixo");
    var pClasses = painel("Classes de ativo", "valor de mercado · 24h");
    var pNeg = painel("Ações mais negociadas", "volume 24h");
    var pSinais = painel("O que mudou hoje", "");
    add(baixo, pClasses, pNeg, pSinais); mount.appendChild(baixo);
    var pTab = painel("Ações tokenizadas", "preço na rede"); pTab.classList.add("mk-p-tabela"); mount.appendChild(pTab);

    var C = null, A = null;
    function kpi(i, id, sub) {
      var c = C && C[id];
      T.kpi[i].set(c ? big(c.valor) : null, c && c.change24h != null ? pc(c.change24h) + " em 24h" : (sub || ""), c ? cls(c.change24h) : "mute");
    }
    /* o dono pediu RWA = ações tokenizadas: o mapa mostra as ações; as
       classes (crédito, Tesouro, ouro) ficam nos números e na lista */
    function desenhaMapa() {
      if (!A) return;
      var ord = A.filter(function (x) { return x.marketCap > 0; }).sort(function (a, b) { return b.marketCap - a.marketCap; });
      if (!ord.length) return pMapa.indisponivel(carregar);
      var itens = ord.slice(0, 30).map(function (x) { return { nome: x.symbol, valor: x.marketCap, variacao: x.change24h, detalhe: big(x.marketCap), aoClicar: assetLink(x.id, x.symbol) }; });
      var caixa = h("div", "mk-mapa"); pMapa.estado(caixa);
      AcademyTreemap.render(caixa, [{ nome: "Ações", itens: itens }], { titulos: false, escala: 4 });
      pMapa.dica("30 maiores · tamanho = valor de mercado · cor = 24h");
    }
    function frase() {
      var f = [];
      var tot = C && C["tokenized-products"];
      if (tot) f.push("Ativos tokenizados somam " + big(tot.valor) + (tot.change24h != null ? " (" + pc(tot.change24h) + " em 24h)." : "."));
      if (A && A.length) {
        var media = A.reduce(function (s, x) { return s + x.change24h; }, 0) / A.length;
        var lider = A.slice().sort(function (a, b) { return b.change24h - a.change24h; })[0];
        f.push("Ações tokenizadas " + (media >= 0 ? "sobem " : "caem ") + pc(Math.abs(media)).slice(1) + " em média" + (lider && lider.change24h > 0 ? ", com " + lider.symbol + " na frente." : "."));
      }
      T.frase(f.join(" "));
    }
    function sinaisRwa() {
      var S = [];
      if (C) CLASSES_RWA.concat([["tokenized-stock", "Ações tokenizadas"]]).forEach(function (k) {
        var c = C[k[0]]; if (c && c.change24h != null && Math.abs(c.change24h) >= 2) S.push({ sev: sevDe(c.change24h, 6, 3), txt: k[1] + (c.change24h >= 0 ? " sobe " : " cai ") + pc(Math.abs(c.change24h)).slice(1) + " em 24h (" + big(c.valor) + ")" });
      });
      if (A && A.length) {
        var al = A.slice().sort(function (a, b) { return b.change24h - a.change24h; })[0];
        var qu = A.slice().sort(function (a, b) { return a.change24h - b.change24h; })[0];
        if (al && al.change24h >= 3) S.push({ sev: sevDe(al.change24h, 10, 5), txt: al.symbol + " sobe " + pc(al.change24h).slice(1) + " em 24h", aoClicar: assetLink(al.id, al.symbol) });
        if (qu && qu.change24h <= -3) S.push({ sev: sevDe(qu.change24h, 10, 5), txt: qu.symbol + " cai " + pc(qu.change24h).slice(1) + " em 24h", aoClicar: assetLink(qu.id, qu.symbol) });
      }
      sinais(pSinais, S, AcademyData.idade.acoes || AcademyData.idade.catrwa || Date.now());
    }

    function carregar() {
      AcademyData.categoriasRwa().then(function (c) { C = c; }).catch(function () { C = null; }).then(function () {
        kpi(0, "tokenized-products", "todas as classes"); kpi(1, "tokenized-private-credit"); kpi(2, "tokenized-treasuries");
        kpi(3, "tokenized-gold"); kpi(4, "tokenized-stock");
        if (C) pClasses.estado(lista(CLASSES_RWA.concat([["tokenized-stock", "Ações"]]).filter(function (k) { return C[k[0]]; })
          .sort(function (a, b) { return C[b[0]].valor - C[a[0]].valor; })
          .map(function (k) { return linha(k[1], big(C[k[0]].valor), C[k[0]].change24h); })));
        else pClasses.indisponivel(carregar);
        desenhaMapa(); frase();
        // ações uma a uma (CoinGecko de novo: um respiro para não bater no limite)
        setTimeout(function () {
          AcademyData.tokenizedStocksAll().then(function (acoes) {
            A = (acoes || []).filter(function (x) { return x.change24h != null; });
            desenhaMapa(); frase();
            var altas = A.slice().sort(function (a, b) { return b.change24h - a.change24h; });
            var quedas = A.slice().sort(function (a, b) { return a.change24h - b.change24h; });
            function la(x) { return linhaAtivo(x, money(x.usd), x.change24h, assetLink(x.id, x.symbol)); }
            var al = altas.filter(function (x) { return x.change24h > 0; }).slice(0, 8), qu = quedas.filter(function (x) { return x.change24h < 0; }).slice(0, 8);
            if (al.length) pAlta.estado(lista(al.map(la))); else pAlta.indisponivel(null, "Nenhuma ação subindo agora.");
            if (qu.length) pQueda.estado(lista(qu.map(la))); else pQueda.indisponivel(null, "Nenhuma ação caindo agora.");
            var neg = A.filter(function (x) { return x.volume24h > 0; }).sort(function (a, b) { return b.volume24h - a.volume24h; }).slice(0, 7);
            if (neg.length) pNeg.estado(lista(neg.map(function (x) { return linhaAtivo(x, big(x.volume24h), x.change24h, assetLink(x.id, x.symbol)); })));
            else pNeg.indisponivel(carregar);
            tabela(pTab, [
              { rot: "Ação", val: function (r) { return r.symbol; } },
              { rot: "Nome", val: function (r) { return r.name; } },
              { rot: "Valor de mercado", num: true, val: function (r) { return r.marketCap; }, fmt: big },
              { rot: "Preço", num: true, val: function (r) { return r.usd; }, fmt: money },
              { rot: "Volume 24h", num: true, val: function (r) { return r.volume24h; }, fmt: big },
              { rot: "24h", num: true, cor: true, val: function (r) { return r.change24h; }, fmt: function (v) { return pc(v); } }
            ], A, { ordem: 2, aoClicar: function (r) { assetLink(r.id, r.symbol)(); } });
            sinaisRwa();
          }).catch(function () {
            A = null;
            [pAlta, pQueda, pNeg, pTab, pMapa].forEach(function (p) { p.indisponivel(carregar, "A lista de ações tokenizadas não respondeu (limite da CoinGecko)."); });
            sinaisRwa();
          });
        }, 900);
      });
    }
    carregar(); refreshers.push(carregar);
  }

  /* ==========================================================
     ABA RENDIMENTOS
     ========================================================== */
  var COR_RISCO = { baixo: "var(--verde)", medio: "var(--dourado)", alto: "var(--vermelho)" };
  var NOME_RISCO = { baixo: "baixo", medio: "médio", alto: "alto" };
  function linhaRend(x) {
    var r = h("div", "mk-rend");
    var nome = add(h("span", "mk-rend-nome", x.projeto + " · " + x.simbolo), h("span", "mk-risco risco-" + x.risco, NOME_RISCO[x.risco]));
    add(r, nome, h("b", "mk-rend-apy", apy(x.apy)), h("small", null, rede(x.rede) + " · " + big(x.tvl) + " aplicados"));
    return r;
  }

  function abaRendimentos(mount) {
    var T = topo(["Tesouro americano", "Dólar na Aave", "ETH em staking", "SOL em staking", "Melhor pool do Scanner"]);
    mount.appendChild(T.el);
    var grade = h("div", "mk-miolo");
    var pDolar = painel("Dólar parado", "stablecoins · maiores");
    var pRisco = painel("Rendimento × risco", "risco estimado pelo tipo de produto"); pRisco.classList.add("mk-p-mapa");
    var pStk = painel("Staking", "rende na própria moeda");
    add(grade, pDolar, pRisco, pStk); mount.appendChild(grade);
    var pTab = painel("Melhores pools do Scanner", "Sólidas · maior nota primeiro · clique para simular"); pTab.classList.add("mk-p-tabela"); mount.appendChild(pTab);

    function carregar() {
      Promise.all([AcademyData.rendimentos().catch(nada), AcademyData.scannerPools(8).catch(function () { return []; })]).then(function (r) {
        var R = r[0], pools = r[1] || [];
        if (!R) { [pDolar, pRisco, pStk].forEach(function (p) { p.indisponivel(carregar); }); }
        var regua = R && R.regua;
        function acha(lst, slug, sym) { return (lst || []).filter(function (x) { return x.slug === slug && (!sym || x.simbolo === sym); })[0]; }
        var aave = R && (acha(R.dolar, "aave-v3", "USDC") || acha(R.dolar, "aave-v3"));
        var eth = R && acha(R.staking, "lido"), sol = R && (acha(R.staking, "jito-liquid-staking") || acha(R.staking, "jupiter-staked-sol"));
        var melhor = pools[0];
        T.kpi[0].set(regua ? apy(regua) : null, "régua · BUIDL (BlackRock)", "mute");
        T.kpi[1].set(aave ? apy(aave.apy) : null, aave ? aave.simbolo + " · " + rede(aave.rede) : "", "mute");
        T.kpi[2].set(eth ? apy(eth.apy) : null, eth ? "Lido (" + eth.simbolo + ")" : "", "mute");
        T.kpi[3].set(sol ? apy(sol.apy) : null, sol ? sol.projeto + " (" + sol.simbolo + ")" : "", "mute");
        T.kpi[4].set(melhor ? apy(melhor.apr) : null, melhor ? melhor.pool + " · nota " + n(melhor.nota || 0, 1) : "Scanner sem resposta", "mute");
        if (R) {
          var f = [];
          if (aave && regua) f.push("Dólar rende " + apy(aave.apy) + " na Aave, " + (aave.apy >= regua ? "acima" : "abaixo") + " do Tesouro americano (" + apy(regua) + ").");
          else if (regua) f.push("O Tesouro americano tokenizado paga " + apy(regua) + ".");
          if (regua) f.push("Acima dessa régua, alguém está pagando por risco.");
          T.frase(f.join(" "));
          pDolar.estado(lista(R.dolar.map(linhaRend)));
          pStk.estado(lista(R.staking.map(linhaRend)));
          // barras: régua + dólar + staking + 3 melhores pools
          var itens = R.dolar.slice(0, 5).concat(R.staking.slice(0, 3)).map(function (x) { return { nome: x.projeto + " " + x.simbolo, valor: x.apy, rotulo: apy(x.apy), cor: COR_RISCO[x.risco] }; });
          pools.slice(0, 3).forEach(function (p) { itens.push({ nome: p.pool + " · " + p.platform, valor: p.apr, rotulo: apy(p.apr), cor: COR_RISCO[regua && p.apr > regua * 2 ? "alto" : "medio"] }); });
          itens.sort(function (a, b) { return a.valor - b.valor; });
          var box = h("div", "mk-risco-box");
          if (regua) box.appendChild(add(h("div", "mk-regua"), h("span", null, "Régua: Tesouro americano tokenizado"), h("b", null, apy(regua))));
          box.appendChild(barras(itens, Math.max(20, (regua || 4) * 8)));
          box.appendChild(h("p", "mk-nota", "Verde risco baixo, amarelo médio, vermelho alto. O risco é estimado pelo tipo de produto (Tesouro, empréstimo nos grandes e staking = baixo; dólar sintético ou mais de 2× a régua = alto). Não é recomendação."));
          pRisco.estado(box);
        }
        if (pools.length) tabela(pTab, [
          { rot: "Pool", val: function (p) { return p.pool; } },
          { rot: "Rede · DEX", val: function (p) { return rede(p.network) + " · " + p.platform; } },
          { rot: "Nota", num: true, val: function (p) { return p.nota; }, fmt: function (v) { return v == null ? "—" : n(v, 1); } },
          { rot: "Rendimento", num: true, val: function (p) { return p.apr; }, fmt: apy },
          { rot: "TVL", num: true, val: function (p) { return p.tvl; }, fmt: big },
          { rot: "Volume 24h", num: true, val: function (p) { return p.vol24h; }, fmt: big }
        ], pools, { ordem: 2, aoClicar: function (p) { location.href = "../Ferramentas/simulador-de-pool/?pool=" + encodeURIComponent(p.sid); } });
        else pTab.indisponivel(carregar, "As pools do Scanner não responderam agora.");
      });
    }
    carregar(); refreshers.push(carregar);
  }

  /* ---------- abas ---------- */
  var TABS = ["DeFi", "Tokens", "RWA", "Rendimentos"];
  var MONTA = { "DeFi": abaDefi, "Tokens": abaTokens, "RWA": abaRwa, "Rendimentos": abaRendimentos };

  window.renderDashboard = function (el) {
    // sempre abre em DeFi; a aba escolhida só vale enquanto a página está aberta
    var atual = TABS.indexOf(window.__academyTab) > -1 ? window.__academyTab : "DeFi";
    var root = h("div", "mk");
    var conteudo = h("div", "mk-conteudo");
    var nav = h("nav", "mk-abas"); nav.setAttribute("aria-label", "Mercados");
    var trilho = h("div", "mk-abas-trilho"); nav.appendChild(trilho);
    var botoes = {};
    TABS.forEach(function (t) {
      var b = h("button", "mk-aba", t); b.type = "button";
      b.addEventListener("click", function () { if (t !== window.__academyTab) desenha(t); });
      trilho.appendChild(b); botoes[t] = b;
    });

    /* Cada aba é montada UMA vez e fica guardada (27/11/2026). Antes, trocar
       de aba apagava tudo, mostrava "Carregando…" e montava de novo: a tela
       piscava. Agora trocar só mostra ou esconde. A aba guarda as próprias
       funções de atualização e a hora da última leitura; se voltar a
       aparecer com mais de 5 min, atualiza no lugar, sem apagar nada. */
    var CINCO_MIN = 300000;
    var abas = {}; // tab -> { corpo, atualiza: [], quando }
    function atualizaAba(a) {
      a.quando = Date.now();
      a.atualiza.forEach(function (f) { try { f(); } catch (e) {} });
    }
    function desenha(tab) {
      window.__academyTab = tab;
      TABS.forEach(function (t) {
        botoes[t].classList.toggle("ativa", t === tab);
        botoes[t].setAttribute("aria-pressed", String(t === tab));
        if (abas[t]) abas[t].corpo.hidden = t !== tab;
      });
      var a = abas[tab];
      if (!a) {
        var corpo = h("div", "mk-aba-corpo");
        conteudo.appendChild(corpo);
        refreshers = [];               // as abas registram aqui o seu carregar()
        MONTA[tab](corpo);
        abas[tab] = { corpo: corpo, atualiza: refreshers, quando: Date.now() };
      } else if (Date.now() - a.quando > CINCO_MIN) {
        atualizaAba(a);
      }
    }
    refreshers = [];
    var esteira = tickerTape();
    var atualizaEsteira = refreshers.slice();
    add(root, esteira, nav, conteudo);
    desenha(atual);
    el.appendChild(root);

    // atualiza a cada 5 min só a esteira e a aba aberta (os resumos ficam
    // guardados por 5 a 10 min); as outras atualizam quando voltarem
    var timer = setInterval(function () {
      if (!document.body.contains(root)) { clearInterval(timer); return; }
      atualizaEsteira.forEach(function (f) { try { f(); } catch (e) {} });
      if (abas[window.__academyTab]) atualizaAba(abas[window.__academyTab]);
    }, CINCO_MIN);
    window.__academyOnLeave = function () { clearInterval(timer); };
  };
})();
