/* ============================================================
   ATLAS · RWA — central.js
   Central RWA (primeira tela, só leitura): lê o que o backend
   (central-rwa/, GitHub Actions + Supabase) coletou.

   Fonte: visões public.crwa_* do Supabase, pela API REST, com a
   chave publicável de core/atlas-supabase-config.js.
   Rotas: #/central  e  #/central/:ticker

   Tudo é montado por DOM (createElement + textContent), sem innerHTML:
   símbolos e nomes de token vêm de APIs de terceiros e são conteúdo
   não confiável. As mesmas classes do UI.kpi/UI.panel são reproduzidas
   para manter o visual do módulo.
   ============================================================ */
(function () {
  "use strict";

  var U = window.U;
  var GATILHO_PCT = 5;        // seção 5.2 da especificação
  var DESCOLADO_PCT = 2;      // seção 7.2: token × ativo
  var CACHE_MS = 60 * 1000;   // o backend atualiza a cada 6h; 1 min de cache basta
  var cache = {};

  /* ---------------- DOM ---------------- */

  /* h("td", {class:"num", title:"x"}, "texto", outroNo, [lista]) */
  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v == null || v === false) return;
        if (k === "class") el.className = v;
        else if (k === "style") el.style.cssText = v;
        else if (k === "on") Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
        else el.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  /* Ícone: o SVG vem da biblioteca do próprio ATLAS (markup estático, confiável). */
  function icon(name) {
    var svg = U.icon(name) || "";
    var doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    var root = doc.documentElement;
    return root && root.nodeName.toLowerCase() === "svg" ? document.importNode(root, true) : document.createTextNode("");
  }
  function mount(app) {
    var kids = Array.prototype.slice.call(arguments, 1);
    while (app.firstChild) app.removeChild(app.firstChild);
    add(app, kids);
  }

  function kpi(o) {
    return h("div", { class: "panel kpi " + (o.accent || "") },
      h("div", { class: "kpi-top" }, h("span", { class: "kpi-k" }, o.k), h("span", { class: "kpi-ic" }, icon(o.icon))),
      h("div", { class: "kpi-v" }, o.v),
      o.foot ? h("div", { class: "kpi-foot" }, h("span", { class: "sub" }, o.foot)) : null);
  }
  function panel(title, body, right, eyebrow) {
    return h("div", { class: "panel panel-pad" },
      h("div", { class: "panel-head" },
        h("div", null, eyebrow ? h("div", { class: "eyebrow" }, eyebrow) : null, h("h2", null, title)),
        right || null),
      body);
  }
  function empty(ic, title, text) {
    return h("div", { class: "empty" }, h("div", { class: "empty-art" }, icon(ic)), h("h2", null, title), h("p", null, text));
  }
  function t3(text, style) { return h("span", { class: "t3", style: style || "font-size:11.5px" }, text); }

  /* ---------------- dados ---------------- */

  function cfg() {
    var c = window.ATLAS_SUPABASE || {};
    return c.url && c.publishableKey ? c : null;
  }

  function get(view, query) {
    var c = cfg();
    var url = c.url.replace(/\/+$/, "") + "/rest/v1/" + view + "?" + (query || "select=*");
    var hit = cache[url];
    if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.data);
    return fetch(url, { headers: { apikey: c.publishableKey, Accept: "application/json" } }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error("Supabase respondeu " + r.status + " em " + view + (t ? ": " + t.slice(0, 160) : ""));
        });
      }
      return r.json();
    }).then(function (data) {
      cache[url] = { at: Date.now(), data: data };
      return data;
    });
  }

  function loadAll() {
    return Promise.all([
      get("crwa_ativos", "select=*"),
      get("crwa_tokens", "select=*"),
      get("crwa_tbills", "select=*"),
      get("crwa_execucoes", "select=*&order=id.desc&limit=12")
    ]).then(function (r) { return { ativos: r[0], tokens: r[1], tbills: r[2], execs: r[3] }; });
  }

  /* ---------------- cálculos ---------------- */

  function pct(a, b) { return a != null && b ? (a - b) / b * 100 : null; }

  function tokensDe(tokens, ticker) {
    return tokens.filter(function (t) { return t.ticker === ticker; })
      .sort(function (a, b) { return (b.liquidez || 0) - (a.liquidez || 0); });
  }

  function linha(a, tokens) {
    var ts = tokensDe(tokens, a.ticker);
    var melhor = ts[0] || null;
    var ref = a.ref_preco != null ? a.ref_preco : a.ult_fechamento;
    var varDia = a.ref_preco != null ? pct(a.ref_preco, a.ref_fechamento_anterior) : pct(a.ult_fechamento, a.fechamento_anterior);
    return {
      a: a, tokens: ts, melhor: melhor, ref: ref, varDia: varDia,
      descolamento: melhor && ref && a.classe !== "tbill" ? pct(melhor.preco, ref) : null,
      liquidez: ts.reduce(function (s, t) { return s + (t.liquidez || 0); }, 0),
      volume: ts.reduce(function (s, t) { return s + (t.volume_24h || 0); }, 0),
      confirmados: ts.filter(function (t) { return t.fontes_confirmadas >= 2; }).length
    };
  }

  /* ---------------- formatação (US$: são preços de mercado dos EUA) ---------------- */

  function usd(v, dec) {
    if (v == null || !isFinite(v)) return "—";
    if (dec == null) dec = Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 1 ? 2 : 4;
    return "US$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function compacto(v) {
    if (v == null || !isFinite(v) || v === 0) return "—";
    var a = Math.abs(v);
    if (a >= 1e9) return "US$ " + U.num(v / 1e9, 1) + " bi";
    if (a >= 1e6) return "US$ " + U.num(v / 1e6, 1) + " mi";
    if (a >= 1e3) return "US$ " + U.num(v / 1e3, 0) + " mil";
    return usd(v, 0);
  }
  function varPct(v) {
    if (v == null || !isFinite(v)) return t3("—", "");
    var cls = v > 0 ? "up" : v < 0 ? "down" : "flat";
    return [h("span", { class: "delta " + cls }, U.pct(v, true)),
      Math.abs(v) > GATILHO_PCT ? [" ", h("span", { class: "crwa-tag", title: "Acima do gatilho de " + GATILHO_PCT + "%" }, "gatilho")] : null];
  }
  function descolado(v) {
    if (v == null || !isFinite(v)) return t3("—", "");
    return h("span", { class: Math.abs(v) > DESCOLADO_PCT ? "crwa-warn" : "t2", title: "Preço do token vs. ativo de referência" },
      (v > 0 ? "+" : "") + U.num(v, 2) + "%");
  }
  function quando(iso) {
    if (!iso) return "—";
    var min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return "agora";
    if (min < 60) return "há " + min + " min";
    var hr = Math.round(min / 60);
    if (hr < 48) return "há " + hr + " h";
    return "há " + Math.round(hr / 24) + " dias";
  }
  var REDE = { solana: "Solana", ethereum: "Ethereum", bnb_chain: "BNB Chain", robinhood_chain: "Robinhood Chain" };
  var CLASSE = { stock: "Ação", etf: "ETF", commodity: "Commodity", tbill: "T-bill", br_stock: "Ação BR" };
  var JOB = { tier_a: "Camada A (6h)", daily: "Diário", backfill: "Backfill", catalog: "Catálogo", report: "Relatório", probe: "Sondas", agents: "Agentes" };
  var SUB = "Ações, ETFs, commodities e T-bills tokenizados, com o ativo tradicional como referência.";

  /* ---------------- blocos ---------------- */

  function head(sub, right) {
    return h("div", { class: "view-head" },
      h("div", null, h("div", { class: "eyebrow" }, "Central RWA"), h("h1", { class: "view-title" }, "Central RWA"), h("div", { class: "view-sub" }, sub)),
      h("div", { class: "vh-right" }, right || null));
  }
  function botaoRecarregar() {
    return h("button", { class: "rbtn rbtn-ghost", type: "button", on: { click: function () { cache = {}; if (window.Router) Router.resolve(); } } }, "Recarregar");
  }
  function tabela(cols, rows, vazio) {
    if (!rows.length) return h("p", { class: "t3", style: "margin:0;font-size:13px" }, vazio);
    return h("div", { class: "table-wrap" },
      h("table", { class: "dtable crwa-table" },
        h("thead", null, h("tr", null, cols.map(function (c) { return h("th", { class: c.num ? "num" : null }, c.t); }))),
        h("tbody", null, rows)));
  }
  function td(content, cls) { return h("td", { class: cls || null }, content); }
  function ativoCell(a) { return td([h("b", null, a.ticker), " ", t3(CLASSE[a.classe] || a.classe || "")]); }
  function tokenCell(m) { return m ? td([m.simbolo, " ", t3(REDE[m.rede] || m.rede)]) : td(t3("sem token com preço")); }
  function irPara(ticker) { return function () { location.hash = "#/central/" + encodeURIComponent(ticker); }; }

  /* ---------------- telas ---------------- */

  function naoConfigurado(app) {
    mount(app, head(SUB), h("div", { class: "section" }, panel("Conectar ao backend",
      empty("layers", "Supabase ainda não configurado",
        "Preencha a Project URL e a Publishable key em core/atlas-supabase-config.js para a Central ler os dados coletados pelo backend."))));
  }

  function erro(app, e) {
    mount(app, head(SUB, botaoRecarregar()), h("div", { class: "section" }, panel("Não foi possível carregar", [
      h("p", { class: "t2", style: "margin:0;line-height:1.6" }, String((e && e.message) || e)),
      h("p", { class: "t3", style: "margin:10px 0 0;font-size:12px" },
        "Se o erro citar uma visão crwa_*, rode o workflow “Central RWA · backfill” com migrate marcado.")])));
  }

  function ultimaColeta(execs) {
    /* Só camada A e diário coletam preço; backfill/relatório não contam. */
    for (var i = 0; i < execs.length; i++) if (execs[i].job === "tier_a" || execs[i].job === "daily") return execs[i];
    return null;
  }

  function visaoGeral(app, d) {
    var linhas = d.ativos.map(function (a) { return linha(a, d.tokens); });
    var A = linhas.filter(function (l) { return l.a.camada === "A"; }).sort(function (x, y) { return x.a.ticker < y.a.ticker ? -1 : 1; });
    var B = linhas.filter(function (l) { return l.a.camada === "B"; }).sort(function (x, y) { return y.liquidez - x.liquidez; });
    var comPreco = d.tokens.length;
    var conf = d.tokens.filter(function (t) { return t.fontes_confirmadas >= 2; }).length;
    var ult = ultimaColeta(d.execs);
    var gatilhos = linhas.filter(function (l) { return l.varDia != null && Math.abs(l.varDia) > GATILHO_PCT; });

    mount(app,
      head(SUB + " Atualiza a cada 6h (lista de observação) e 1× por dia (demais).",
        [t3(ult ? "Última coleta " + quando(ult.fim || ult.inicio) : "Nenhuma coleta de preços ainda", "font-size:12px"), " ", botaoRecarregar()]),

      h("div", { class: "grid g-4" },
        kpi({ k: "Ativos monitorados", v: String(linhas.length), icon: "layers", foot: A.length + " na observação · " + B.length + " acima de US$ 100 mil" }),
        kpi({ k: "Tokens com preço", v: String(comPreco), icon: "coins", foot: "nas 4 redes" }),
        kpi({ k: "Confirmados por 2 fontes", v: comPreco ? U.num(conf / comPreco * 100, 0) + "%" : "—", icon: "shield", foot: conf + " de " + comPreco }),
        kpi({ k: "Acima do gatilho (" + GATILHO_PCT + "%)", v: String(gatilhos.length), icon: "pulse", accent: gatilhos.length ? "awarn" : "", foot: "variação do último pregão" })),

      h("div", { class: "section" }, panel("Lista de observação", tabelaA(A), t3("clique num ativo para ver os tokens", "font-size:12px"), "Camada A · a cada 6h")),
      h("div", { class: "section" }, panel("Demais ativos acima do piso", tabelaB(B), null, "Camada B · diário")),
      h("div", { class: "grid g-2 section" },
        panel("T-bills (Tesouro dos EUA)", tabelaTbills(d.tbills), null, "Rendimento anual"),
        panel("Saúde do sistema", tabelaExecs(d.execs), null, "Últimas execuções")));
  }

  function tabelaA(A) {
    return tabela(
      [{ t: "Ativo" }, { t: "Preço (ativo)", num: 1 }, { t: "Var. pregão", num: 1 }, { t: "Token mais líquido" }, { t: "Preço (token)", num: 1 },
       { t: "Token × ativo", num: 1 }, { t: "Liquidez on-chain", num: 1 }, { t: "Tokens", num: 1 }, { t: "Histórico", num: 1 }],
      A.map(function (l) {
        var a = l.a, m = l.melhor;
        return h("tr", { class: "clickable", on: { click: irPara(a.ticker) } },
          ativoCell(a), td(usd(l.ref), "num"), td(varPct(l.varDia), "num"), tokenCell(m),
          td(m ? usd(m.preco) : "—", "num"), td(descolado(l.descolamento), "num"), td(compacto(l.liquidez), "num"),
          td(String(l.tokens.length), "num"), td(a.pregoes ? U.num(a.pregoes, 0) + " pregões" : "—", "num t2"));
      }),
      "A lista de observação ainda não foi coletada. Rode o workflow “Central RWA · camada A”.");
  }

  function tabelaB(B) {
    return tabela(
      [{ t: "Ativo" }, { t: "Token mais líquido" }, { t: "Preço (token)", num: 1 }, { t: "Var. pregão", num: 1 },
       { t: "Liquidez on-chain", num: 1 }, { t: "Volume 24h", num: 1 }, { t: "Tokens", num: 1 }],
      B.slice(0, 80).map(function (l) {
        var a = l.a, m = l.melhor;
        return h("tr", { class: "clickable", on: { click: irPara(a.ticker) } },
          ativoCell(a), tokenCell(m), td(m ? usd(m.preco) : "—", "num"), td(varPct(l.varDia), "num"),
          td(compacto(l.liquidez), "num"), td(compacto(l.volume), "num"), td(String(l.tokens.length), "num"));
      }),
      "Nenhum ativo acima do piso ainda. A camada B é montada pelo job diário.");
  }

  function tabelaTbills(rows) {
    var semanas = function (p) { return parseInt(p, 10) || 0; };
    rows = rows.slice().sort(function (a, b) { return semanas(a.prazo) - semanas(b.prazo); });
    return tabela([{ t: "Prazo" }, { t: "Taxa", num: 1 }, { t: "Data" }],
      rows.map(function (r) {
        return h("tr", null, td(semanas(r.prazo) + " semanas"), td(h("b", null, U.num(r.taxa, 2) + "%"), "num"), td(r.dia, "t2"));
      }), "Sem taxas ainda.");
  }

  function tabelaExecs(rows) {
    var cor = { ok: "var(--pos)", parcial: "var(--warn)", erro: "var(--neg)" };
    return tabela([{ t: "Job" }, { t: "Status" }, { t: "Quando" }, { t: "Duração", num: 1 }],
      rows.slice(0, 8).map(function (r) {
        return h("tr", null, td(JOB[r.job] || r.job), td(h("span", { style: "color:" + (cor[r.status] || "inherit") }, r.status)),
          td(quando(r.fim || r.inicio), "t2"), td(r.duracao_s != null ? U.num(r.duracao_s, 0) + " s" : "—", "num t2"));
      }), "Nenhuma execução registrada.");
  }

  function detalhe(app, d, ticker) {
    var a = d.ativos.filter(function (x) { return x.ticker === ticker; })[0];
    var voltar = h("a", { class: "bck", href: "#/central" }, icon("back"), " Central RWA");
    if (!a) { mount(app, head("Ativo não encontrado."), h("div", { class: "section" }, voltar)); return; }
    var l = linha(a, d.tokens);
    var msg = h("p", { class: "t3", style: "font-size:12px;margin:8px 0 0" });
    var cv = h("canvas");

    mount(app,
      h("div", { class: "view-head" },
        h("div", null, voltar,
          h("h1", { class: "view-title" }, a.ticker, a.nome ? [" ", h("span", { class: "t3", style: "font-size:16px;font-weight:500" }, a.nome)] : null),
          h("div", { class: "view-sub" }, (CLASSE[a.classe] || a.classe || "") + " · camada " + a.camada +
            (a.historico_desde ? " · histórico desde " + a.historico_desde + " (" + U.num(a.pregoes || 0, 0) + " pregões)" : ""))),
        h("div", { class: "vh-right" }, botaoRecarregar())),

      h("div", { class: "grid g-4" },
        kpi({ k: "Preço do ativo", v: usd(l.ref), icon: "building", foot: (a.ref_fonte || "fechamento") + " · " + quando(a.ref_em) }),
        kpi({ k: "Variação do pregão", v: l.varDia != null ? U.pct(l.varDia, true) : "—", icon: "pulse",
              accent: l.varDia != null && Math.abs(l.varDia) > GATILHO_PCT ? "awarn" : "", foot: "gatilho em " + GATILHO_PCT + "%" }),
        kpi({ k: "Liquidez on-chain", v: compacto(l.liquidez), icon: "drop", foot: "volume 24h " + compacto(l.volume) }),
        kpi({ k: "Tokens", v: String(l.tokens.length), icon: "coins", foot: l.confirmados + " confirmados por 2 fontes" })),

      h("div", { class: "section" }, panel("Preço do ativo de referência", [h("div", { class: "chart-box h-lg" }, cv), msg], null, "Últimos 13 meses")),

      h("div", { class: "section" }, panel("Tokens deste ativo", tabela(
        [{ t: "Token" }, { t: "Rede" }, { t: "Emissor" }, { t: "Preço", num: 1 }, { t: "× ativo", num: 1 },
         { t: "Liquidez", num: 1 }, { t: "Volume 24h", num: 1 }, { t: "Fontes" }, { t: "Atualizado" }],
        l.tokens.map(function (t) {
          var fontes = t.fontes_confirmadas >= 2
            ? h("span", { style: "color:var(--pos)" }, "2 fontes")
            : t.divergencia_pct != null
              ? h("span", { class: "crwa-warn", title: "Divergência entre fontes" }, "diverge " + U.num(t.divergencia_pct, 1) + "%")
              : t3("1 fonte", "");
          return h("tr", null, td(h("b", null, t.simbolo)), td(REDE[t.rede] || t.rede, "t2"), td(t.emissor || "", "t2"),
            td(usd(t.preco), "num"), td(descolado(a.classe === "tbill" ? null : pct(t.preco, l.ref)), "num"),
            td(compacto(t.liquidez), "num"), td(compacto(t.volume_24h), "num"),
            td([fontes, " ", t3(t.fonte || "", "font-size:11px")]), td(quando(t.em), "t3"));
        }), "Nenhum token com preço para este ativo."), null, "Todas as redes")));

    get("crwa_historico", "select=dia,fechamento&ticker=eq." + encodeURIComponent(ticker) + "&order=dia.asc").then(function (rows) {
      if (!rows.length) { msg.textContent = "Sem histórico para este ativo ainda."; return; }
      if (!window.Charts || !window.Chart) { msg.textContent = "Gráfico indisponível (Chart.js não carregou)."; return; }
      Charts.line(cv, rows.map(function (r) { return { date: r.dia, value: r.fechamento }; }), { plain: true, color: "var(--accent)" });
      msg.textContent = rows.length + " pregões · fonte: histórico diário do backend";
    }).catch(function (e) {
      msg.textContent = "Não foi possível carregar o histórico: " + ((e && e.message) || e);
    });
  }

  function carregando(app) {
    mount(app, head("Carregando dados do backend…"), h("div", { class: "section" }, h("p", { class: "t3" }, "Carregando…")));
  }

  /* ============================================================
     EVENTOS (Fase 3) — seção 12/13 da especificação
     ============================================================ */

  var TIPO = { queda_brusca: "Queda brusca", alta_brusca: "Alta brusca", intradiario: "Intradiário" };
  var NIVEL_COR = { EXTREMO: "var(--neg)", ATENCAO: "var(--warn)", INFO: "var(--text-2)" };
  var NIVEL_TXT = { EXTREMO: "Extremo", ATENCAO: "Atenção", INFO: "Info" };

  function num2(v, suf) { return v == null || !isFinite(v) ? "—" : (v > 0 ? "+" : "") + U.num(v, 1) + (suf || "%"); }

  function eventos(app, atual) {
    return get("crwa_eventos", "select=*&order=dia.desc,id.desc&limit=200").then(function (rows) {
      if (!atual()) return;
      var ext = rows.filter(function (e) { return e.nivel === "EXTREMO"; }).length;
      var quedas = rows.filter(function (e) { return e.tipo === "queda_brusca"; }).length;
      mount(app,
        h("div", { class: "view-head" },
          h("div", null, h("div", { class: "eyebrow" }, "Central RWA"), h("h1", { class: "view-title" }, "Eventos"),
            h("div", { class: "view-sub" }, "Movimentos acima de " + GATILHO_PCT + "% no pregão, nos últimos 180 dias, com o que aconteceu depois em eventos semelhantes dos últimos 10 anos.")),
          h("div", { class: "vh-right" }, botaoRecarregar())),
        h("div", { class: "grid g-4" },
          kpi({ k: "Eventos em 180 dias", v: String(rows.length), icon: "pulse", foot: "ativos monitorados" }),
          kpi({ k: "Quedas bruscas", v: String(quedas), icon: "down", foot: (rows.length - quedas) + " altas bruscas" }),
          kpi({ k: "Extremos", v: String(ext), icon: "alert", accent: ext ? "awarn" : "", foot: "acima de 10% ou raros no ativo" }),
          kpi({ k: "Base histórica", v: "10 anos", icon: "layers", foot: "estatística só com o passado de cada data" })),
        h("div", { class: "section" }, panel("Eventos detectados", tabelaEventos(rows),
          t3("“Eventos semelhantes tiveram historicamente este comportamento” — não é previsão.", "font-size:12px"), "Últimos 180 dias")));
    });
  }

  function tabelaEventos(rows) {
    return tabela(
      [{ t: "Pregão" }, { t: "Ativo" }, { t: "Evento" }, { t: "Variação", num: 1 }, { t: "Volume", num: 1 }, { t: "Nível" },
       { t: "Semelhantes", num: 1 }, { t: "Mediana 7d", num: 1 }, { t: "Subiu em 7d", num: 1 }, { t: "+3% em 5d", num: 1 }, { t: "Pior em 10d", num: 1 }],
      rows.map(function (e) {
        var s = e.estatistica || {};
        var med = s.mediana && s.mediana["7"], pos = s.pct_positivo && s.pct_positivo["7"];
        return h("tr", { class: "clickable", on: { click: irPara(e.ticker) } },
          td(e.dia, "t2"), td([h("b", null, e.ticker), " ", t3(CLASSE[e.classe] || "")]), td(TIPO[e.tipo] || e.tipo),
          td(h("span", { class: "delta " + (e.variacao_pct > 0 ? "up" : "down") }, U.pct(e.variacao_pct, true)), "num"),
          td(e.volume_x_media ? U.num(e.volume_x_media, 1) + "× média" : "—", "num t2"),
          td(h("span", { style: "color:" + (NIVEL_COR[e.nivel] || "inherit") + ";font-weight:600" }, NIVEL_TXT[e.nivel] || e.nivel)),
          td(s.n != null ? String(s.n) : "—", "num"),
          td(h("span", { class: med > 0 ? "delta up" : med < 0 ? "delta down" : "t3" }, num2(med)), "num"),
          td(pos != null ? U.num(pos, 0) + "%" : "—", "num"),
          td(s.pct_sobe_3_em_5d != null ? U.num(s.pct_sobe_3_em_5d, 0) + "%" : "—", "num"),
          td(num2(s.pior_10d), "num t2"));
      }),
      "Nenhum evento ainda. Os eventos aparecem depois que o job diário (ou o backfill) roda com a migration de eventos.");
  }

  /* ============================================================
     AGENTES (Fase 4) — um agente por CESTA, cada um com página própria.
     Placar em três períodos: treino (antes do corte, onde as regras foram
     escolhidas), validação (depois do corte, que a escolha nunca viu) e
     ao vivo. O número que vale é o da validação.
     ============================================================ */

  var PERIODO = { treino: "Treino", validacao: "Validação", ao_vivo: "Ao vivo" };
  var AMOSTRA_PEQUENA = 20;

  function periodosDe(placar, id) {
    var out = {};
    placar.forEach(function (p) { if (p.agente === id) out[p.periodo] = p; });
    return out;
  }

  /* Veredito honesto, olhando a VALIDAÇÃO contra o "não fazer nada". */
  function veredito(per) {
    var v = per.validacao;
    if (!v || !v.fechadas) return { cls: "t3", txt: "Sem operações na validação ainda." };
    var ganha = v.retorno_medio_pct != null && v.base_media_pct != null && v.retorno_medio_pct > v.base_media_pct;
    var pouca = v.fechadas < AMOSTRA_PEQUENA;
    if (ganha && !pouca) return { cls: "crwa-ok", txt: "A vantagem se manteve em dados que a escolha das regras nunca viu." };
    if (ganha) return { cls: "t2", txt: "Promissor: ganhou de “não fazer nada” na validação, mas com só " + v.fechadas + " operações — ainda não é prova." };
    return { cls: "crwa-warn", txt: "Não se sustentou: na validação rendeu menos do que ficar comprado num dia qualquer" +
      (pouca ? " (com só " + v.fechadas + " operações)." : ".") };
  }

  function regrasTexto(r) {
    r = r || {};
    var setups = (r.setups || []).map(function (s) { return (TIPO[s] || s).toLowerCase(); }).join(" e ");
    var alvo = r.alvo_modo === "nenhum" ? "sem alvo — sai no stop ou no prazo"
      : r.alvo_modo === "mediana_max" ? "alvo = " + U.num(r.alvo_fator || 1, 1) + "× a alta típica dos semelhantes em " + r.prazo_pregoes + " pregões"
      : "alvo = " + (r.alvo_fator && r.alvo_fator !== 1 ? U.num(r.alvo_fator, 1) + "× " : "") + "a mediana dos semelhantes em " + r.prazo_pregoes + " pregões";
    var stop = r.stop_modo === "fixo" ? "stop fixo de " + num2(r.stop_fixo_pct)
      : "stop = queda típica dos semelhantes (" + (r.stop_modo === "p50" ? "mediana" : "percentil 20") + "), entre " + num2(r.stop_minimo_pct) + " e " + num2(r.stop_maximo_pct);
    return [
      "Olha eventos com variação acima de " + U.num(r.gatilho_pct, 1) + "% no pregão; opera " + setups + ".",
      "Só opera com pelo menos " + r.amostra_minima + " eventos semelhantes, se ≥ " + U.num(r.pct_positivo_minimo, 0) + "% deles subiram em " + r.prazo_pregoes + " pregões e a mediana passou de " + num2(r.mediana_minima_pct) + ".",
      "Entra na abertura seguinte; " + alvo + "; " + stop + ".",
      "Prazo de " + r.prazo_pregoes + " pregões (máximo " + r.prazo_maximo_pregoes + "). Se alvo e stop cabem no mesmo pregão, conta o stop.",
      "Desconta " + U.num(r.custo_ida_volta_pct, 1) + "% de custo por operação. Sem venda a descoberto: quando o histórico é de queda, fica de fora."
    ];
  }

  function cestaChips(cesta) {
    return h("div", { class: "crwa-chips" }, (cesta || []).map(function (t) {
      return h("a", { class: "crwa-chip", href: "#/central/" + encodeURIComponent(t) }, t);
    }));
  }

  function numPeriodo(p, campo) { return p && p.fechadas ? num2(p[campo]) : "—"; }

  function cartaoAgente(a, per) {
    var ve = veredito(per), v = per.validacao, t = per.treino, lv = per.ao_vivo;
    return h("div", { class: "panel panel-pad crwa-agent", on: { click: function () { location.hash = "#/agentes/" + encodeURIComponent(a.id); } } },
      h("div", { class: "panel-head" },
        h("div", null, h("div", { class: "eyebrow" }, (a.cesta || []).length + " ativos"), h("h2", null, a.nome)),
        h("span", { class: "t3", style: "font-size:12px" }, "abrir →")),
      h("p", { class: "t2", style: "margin:0 0 10px;font-size:13px;line-height:1.55" }, a.descricao),
      cestaChips(a.cesta),
      h("div", { class: "crwa-strip" },
        h("div", null, h("span", { class: "k" }, "Treino"), h("b", null, numPeriodo(t, "retorno_medio_pct")), t3((t ? t.fechadas : 0) + " op.")),
        h("div", null, h("span", { class: "k" }, "Validação"), h("b", { class: v && v.retorno_medio_pct > (v.base_media_pct || 0) ? "delta up" : "delta down" }, numPeriodo(v, "retorno_medio_pct")), t3((v ? v.fechadas : 0) + " op.")),
        h("div", null, h("span", { class: "k" }, "Não fazer nada"), h("b", null, numPeriodo(v, "base_media_pct")), t3("na validação")),
        h("div", null, h("span", { class: "k" }, "Ao vivo"), h("b", null, lv ? (lv.fechadas ? num2(lv.retorno_medio_pct) : "—") : "—"),
          t3(lv ? (lv.abertas || 0) + " aberta(s)" : "sem posições"))),
      h("p", { class: ve.cls, style: "margin:10px 0 0;font-size:12.5px;line-height:1.5" }, ve.txt));
  }

  function agentes(app, atual) {
    return Promise.all([get("crwa_agentes", "select=*&order=id"), get("crwa_placar_periodo", "select=*")]).then(function (r) {
      if (!atual()) return;
      var ags = r[0], placar = r[1];
      mount(app,
        h("div", { class: "view-head" },
          h("div", null, h("div", { class: "eyebrow" }, "Central RWA"), h("h1", { class: "view-title" }, "Agentes"),
            h("div", { class: "view-sub" }, "Cada agente opera uma cesta de ativos com regras próprias, em paper trading — posições SIMULADAS, nenhuma ordem real. As regras foram escolhidas só com os pregões de antes do corte; a validação mostra o que aconteceu depois, em dados que a escolha nunca viu.")),
          h("div", { class: "vh-right" }, botaoRecarregar())),
        ags.length
          ? h("div", { class: "grid g-2 section" }, ags.map(function (a) { return cartaoAgente(a, periodosDe(placar, a.id)); }))
          : h("div", { class: "section" }, panel("Nenhum agente ainda", h("p", { class: "t3", style: "margin:0" },
              "Os agentes aparecem depois do próximo deploy do backend (config/agents.yaml)."))));
    });
  }

  function agentePagina(app, atual, id) {
    return Promise.all([
      get("crwa_agentes", "select=*&id=eq." + encodeURIComponent(id)),
      get("crwa_placar_periodo", "select=*&agente=eq." + encodeURIComponent(id)),
      get("crwa_placar_setup", "select=*&agente=eq." + encodeURIComponent(id) + "&modo=eq.backtest&order=soma_pct.desc"),
      get("crwa_posicoes", "select=*&agente=eq." + encodeURIComponent(id) + "&modo=eq.live&order=entrada_dia.desc&limit=50"),
      get("crwa_posicoes", "select=*&agente=eq." + encodeURIComponent(id) + "&modo=eq.backtest&order=entrada_dia.desc&limit=40")
    ]).then(function (r) {
      if (!atual()) return;
      var a = r[0][0];
      var voltar = h("a", { class: "bck", href: "#/agentes" }, icon("back"), " Agentes");
      if (!a) { mount(app, head("Agente não encontrado."), h("div", { class: "section" }, voltar)); return; }
      var per = {};
      r[1].forEach(function (p) { per[p.periodo] = p; });
      var ve = veredito(per);
      var abertas = r[3].filter(function (p) { return p.status === "aberta"; });
      var fechadasVivo = r[3].filter(function (p) { return p.status === "fechada"; });

      mount(app,
        h("div", { class: "view-head" },
          h("div", null, voltar, h("h1", { class: "view-title" }, a.nome), h("div", { class: "view-sub" }, a.descricao)),
          h("div", { class: "vh-right" }, botaoRecarregar())),
        h("div", { class: "section" }, cestaChips(a.cesta)),
        h("p", { class: ve.cls, style: "margin:0 0 4px;font-size:13.5px;line-height:1.55" }, "Veredito: " + ve.txt),

        h("div", { class: "section" }, panel("Placar por período", tabelaPeriodos(per, a.corte_validacao), null,
          "Corte da validação: " + a.corte_validacao)),
        h("div", { class: "section" }, panel("Posições abertas agora", tabelaPosicoes(abertas, true), null, "Ao vivo")),
        h("div", { class: "grid g-2 section" },
          panel("Resultado por ativo", tabelaSetup(r[2].filter(function (s) { return s.fechadas; })), null, "Treino + validação"),
          panel("Regras", h("ul", { class: "t2", style: "margin:0;padding-left:18px;line-height:1.7;font-size:13px" },
            regrasTexto(a.regras).map(function (x) { return h("li", null, x); })), null, "config/agents.yaml")),
        fechadasVivo.length ? h("div", { class: "section" }, panel("Operações ao vivo encerradas", tabelaPosicoes(fechadasVivo, false), null, "Ao vivo")) : null,
        h("div", { class: "section" }, panel("Últimas operações simuladas no histórico", tabelaPosicoes(r[4], false), null, "Treino + validação")));
    });
  }

  function tabelaPeriodos(per, corte) {
    var ordem = ["treino", "validacao", "ao_vivo"];
    var sub = { treino: "antes de " + corte + " · regras escolhidas aqui", validacao: "depois de " + corte + " · dados nunca vistos", ao_vivo: "desde a ativação" };
    return tabela(
      [{ t: "Período" }, { t: "Operações", num: 1 }, { t: "Acerto", num: 1 }, { t: "Médio / op.", num: 1 }, { t: "Mediana", num: 1 },
       { t: "Pior", num: 1 }, { t: "Melhor", num: 1 }, { t: "Não fazer nada", num: 1 }, { t: "Soma", num: 1 }],
      ordem.map(function (k) {
        var p = per[k];
        if (!p) return h("tr", null, td([h("b", null, PERIODO[k]), " ", t3(sub[k])]), td("0", "num"), td("—", "num"), td("—", "num"), td("—", "num"), td("—", "num"), td("—", "num"), td("—", "num"), td("—", "num"));
        var ganha = p.retorno_medio_pct != null && p.base_media_pct != null && p.retorno_medio_pct > p.base_media_pct;
        return h("tr", null,
          td([h("b", null, PERIODO[k]), " ", t3(sub[k])]),
          td(String(p.fechadas) + (p.abertas ? " (+" + p.abertas + " abertas)" : ""), "num"),
          td(p.taxa_acerto_pct != null ? U.num(p.taxa_acerto_pct, 0) + "%" : "—", "num"),
          td(h("span", { class: p.fechadas ? (ganha ? "delta up" : "delta down") : "t3" }, numPeriodo(p, "retorno_medio_pct")), "num"),
          td(numPeriodo(p, "retorno_mediano_pct"), "num t2"), td(numPeriodo(p, "pior_pct"), "num t2"), td(numPeriodo(p, "melhor_pct"), "num t2"),
          td(numPeriodo(p, "base_media_pct"), "num t2"), td(numPeriodo(p, "soma_pct"), "num t2"));
      }), "");
  }

  function tabelaPosicoes(rows, abertas) {
    return tabela(
      [{ t: "Ativo" }, { t: "Setup" }, { t: "Entrada" }, { t: "Preço", num: 1 }, { t: "Alvo", num: 1 }, { t: "Stop", num: 1 },
       { t: abertas ? "Via" : "Saída" }, { t: abertas ? "Racional" : "Resultado", num: !abertas }],
      rows.map(function (p) {
        var res = p.retorno_liquido_pct;
        var alvo = p.alvo_pct >= 999 ? "sem alvo" : num2(p.alvo_pct);
        return h("tr", { class: "clickable", on: { click: irPara(p.ticker) } },
          td(h("b", null, p.ticker)), td(TIPO[p.setup] || p.setup, "t2"), td(p.entrada_dia, "t2"), td(usd(p.entrada_preco), "num"),
          td(alvo, "num t2"), td(num2(p.stop_pct), "num t2"),
          abertas ? td(p.token ? [p.token, " ", t3(REDE[p.rede] || p.rede || "")] : t3("ativo de referência")) : td([p.saida_dia || "—", " ", t3(p.motivo_saida || "")], "t2"),
          abertas ? td(p.racional || "", "t3") : td(h("span", { class: res > 0 ? "delta up" : "delta down" }, num2(res)), "num"));
      }),
      abertas ? "Nenhuma posição aberta agora." : "Sem operações ainda.");
  }

  function tabelaSetup(rows) {
    return tabela([{ t: "Ativo" }, { t: "Setup" }, { t: "Operações", num: 1 }, { t: "Acerto", num: 1 }, { t: "Médio", num: 1 }, { t: "Soma", num: 1 }],
      rows.map(function (s) {
        return h("tr", { class: "clickable", on: { click: irPara(s.ticker) } },
          td(h("b", null, s.ticker)), td(TIPO[s.setup] || s.setup, "t2"), td(String(s.fechadas), "num"),
          td(s.taxa_acerto_pct != null ? U.num(s.taxa_acerto_pct, 0) + "%" : "—", "num"),
          td(h("span", { class: s.retorno_medio_pct > 0 ? "delta up" : "delta down" }, num2(s.retorno_medio_pct)), "num"),
          td(num2(s.soma_pct), "num t2"));
      }), "Sem operações ainda.");
  }

  var seq = 0;
  function run(fn) {
    var app = document.getElementById("app");
    if (!cfg()) return naoConfigurado(app);
    var mine = ++seq;
    carregando(app);
    fn(app, function () { return mine === seq; }).catch(function (e) {
      if (mine === seq) erro(app, e);
    });
  }

  window.RWACentral = {
    render: function (ctx) {
      var ticker = ctx && ctx.params && ctx.params.ticker;
      run(function (app, atual) {
        return loadAll().then(function (d) {
          if (!atual()) return; // o usuário já navegou para outra tela
          if (ticker) detalhe(app, d, ticker);
          else visaoGeral(app, d);
        });
      });
    },
    eventos: function () { run(eventos); },
    agentes: function () { run(agentes); },
    agente: function (ctx) {
      var id = ctx && ctx.params && ctx.params.id;
      run(function (app, atual) { return agentePagina(app, atual, id); });
    }
  };
})();
