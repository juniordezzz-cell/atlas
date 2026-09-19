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
  var JOB = { tier_a: "Camada A (6h)", daily: "Diário", backfill: "Backfill", catalog: "Catálogo", report: "Relatório", probe: "Sondas" };
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
    for (var i = 0; i < execs.length; i++) if (execs[i].job === "tier_a" || execs[i].job === "daily") return execs[i];
    return execs[0] || null;
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
        [t3("Última coleta " + quando(ult && (ult.fim || ult.inicio)), "font-size:12px"), " ", botaoRecarregar()]),

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

  var seq = 0;
  window.RWACentral = {
    render: function (ctx) {
      var app = document.getElementById("app");
      if (!cfg()) return naoConfigurado(app);
      var ticker = ctx && ctx.params && ctx.params.ticker;
      var mine = ++seq;
      carregando(app);
      loadAll().then(function (d) {
        if (mine !== seq) return; // o usuário já navegou para outra tela
        if (ticker) detalhe(app, d, ticker);
        else visaoGeral(app, d);
      }).catch(function (e) {
        if (mine === seq) erro(app, e);
      });
    }
  };
})();
