/* ============================================================
   HOLD SYSTEM · js/components.js
   Construtores de UI reutilizáveis + ícones + formatadores.
   Nada aqui muta estado; só produz DOM a partir de dados.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- DOM helper ---------- */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null) return;
        if (k === "class") node.className = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "text") node.textContent = v;
        else if (k === "dataset") Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
        else if (k.slice(0, 2) === "on" && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, v);
      });
    }
    (children == null ? [] : [].concat(children)).forEach(function (c) {
      if (c == null || c === false) return;
      node.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    });
    return node;
  }

  /* ---------- Icons (feather-style, stroke currentColor) ---------- */
  var PATHS = {
    dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
    wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><circle cx="16" cy="14" r="1.4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
    beaker: '<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><line x1="7" y1="15" x2="17" y2="15"/>',
    chart: '<line x1="3" y1="21" x2="21" y2="21"/><rect x="5" y="11" width="3" height="7"/><rect x="11" y="7" width="3" height="11"/><rect x="17" y="13" width="3" height="5"/>',
    history: '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l3 2"/>',
    report: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><path d="M8 18v-4"/><path d="M12 18v-7"/><path d="M16 18v-2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    chevron: '<polyline points="15 18 9 12 15 6"/>',
    arrowUp: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
    arrowDown: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
    trendUp: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
    convert: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    filter: '<polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="M16.71 13.88.7.71-.71"/>'
  };
  /* Ícone — delegado à biblioteca única (core/ui/atlas-icons.js).
     ------------------------------------------------------------------
     A assinatura do Hold é icon(nome, CLASSE), mas a do Trade é
     icon(nome, TAMANHO) — e alguém já chamou U.icon("plus", 13) aqui.
     O 13 virava class="ico 13", o SVG saía sem width/height, esticava e
     transformava o botão "Nova carteira" num bloco de 226x220px (o caso
     está documentado em wallets/walletSelector.js).

     Agora um número no segundo argumento é entendido como TAMANHO, que
     é o que quem escreveu quis dizer. A tabela local continua como
     reserva para os nomes que só o Hold tem. */
  function icon(name, cls) {
    if (window.AtlasIcons) {
      var opts = (typeof cls === "number")
        ? { size: cls, "class": "ico", strokeWidth: 2 }
        : { "class": ("ico " + (cls || "")).trim(), strokeWidth: 2 };
      var s = AtlasIcons.get(name, opts);
      if (s) return s;
    }
    return '<svg class="ico ' + (typeof cls === "number" ? "" : (cls || "")) +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (PATHS[name] || "") + '</svg>';
  }
  function iconEl(name, cls) {
    var span = document.createElement("span");
    span.innerHTML = icon(name, cls);
    return span.firstChild;
  }

  /* ---------- Formatters ---------- */
  /* ============================================================
     DINHEIRO — delegado ao AtlasCurrency
     ------------------------------------------------------------
     O Hold formatava "$1,234" com locale en-US — a única grafia
     diferente do resto do ATLAS, que usa "US$ 1.234". Agora a moeda, o
     símbolo e o locale vêm todos de core/currency.js, e escolher BRL
     nas Configurações passa a valer aqui também.

     O valor recebido está SEMPRE em USD (regra de armazenamento).
     ============================================================ */
  function money(v, dp) {
    var n = +v || 0, abs = Math.abs(n);
    var dec = dp != null ? dp : (abs >= 1000 ? 0 : 2);
    if (window.AtlasCurrency) return AtlasCurrency.format(n, { decimals: dec });
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function compact(v) {
    var n = +v || 0;
    if (window.AtlasCurrency) return AtlasCurrency.compact(n);
    if (Math.abs(n) >= 1e12) return "$" + (n / 1e12).toFixed(2) + "T";
    if (Math.abs(n) >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
    if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
    if (Math.abs(n) >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
    return "$" + n.toFixed(0);
  }
  /* toFixed imprime PONTO decimal: num produto em pt-BR o percentual
     saía "10.00%" ao lado de valores em "US$ 1.234,56". Mesma tela,
     duas convenções de número. */
  function pct(v, dp) {
    var n = +v || 0, d = dp == null ? 2 : dp;
    return (n >= 0 ? "+" : "") +
      n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) + "%";
  }
  function signClass(v) { return v > 0 ? "pos" : v < 0 ? "neg" : "neu"; }
  function qty(v) { return (+v || 0).toLocaleString("en-US", { maximumFractionDigits: 6 }); }
  function dateShort(iso) {
    try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); }
    catch (e) { return iso; }
  }
  function dateTime(iso) {
    try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return iso; }
  }

  /* ---------- Badges ---------- */
  var STATUS_BADGE = {
    invested:  { cls: "invested",  label: "Investido" },
    watchlist: { cls: "watchlist", label: "Watchlist" },
    sold:      { cls: "sold",      label: "Vendido" },
    active:    { cls: "active",    label: "Ativa" },
    review:    { cls: "review",    label: "Em revisão" },
    invalid:   { cls: "invalid",   label: "Invalidada" },
    draft:     { cls: "draft",     label: "Rascunho" },
    done:      { cls: "invested",  label: "Concluído" },
    /* status oficiais de Tese (entidade compartilhada) */
    planejada: { cls: "draft",     label: "Planejada" },
    andamento: { cls: "active",    label: "Em andamento" },
    concluida: { cls: "invested",  label: "Concluída" },
    arquivada: { cls: "invalid",   label: "Arquivada" }
  };
  function badge(status, textOverride) {
    var b = STATUS_BADGE[status] || { cls: "plain", label: status };
    var span = el("span", { class: "badge " + b.cls });
    span.appendChild(el("span", { class: "dot" }));
    span.appendChild(document.createTextNode(textOverride || b.label));
    return span;
  }
  /* typeBadge() vivia aqui e não era chamada por NINGUÉM — nem pelas
     páginas, nem internamente. Ela pintava um selo usando o próprio
     texto do tipo como classe CSS (`badge Cripto`), classe que não
     existe em folha nenhuma: se alguém a tivesse usado, o selo sairia
     sem cor. Construtor de UI sem uso e sem estilo é uma armadilha
     esperando o próximo a precisar de um selo de tipo.
     (iconEl continua, apesar de não aparecer como U.iconEl: kpi() e
     confirmar() a usam por dentro.) */



  /* ---------- Conviction meter ---------- */
  function conviction(value, showVal) {
    var v = Math.max(0, Math.min(10, Math.round(+value || 0)));
    var tier = v >= 8 ? "high" : v >= 5 ? "mid" : "low";
    var wrap = el("div", { class: "conviction " + tier });
    var segs = el("div", { class: "segs" });
    for (var i = 1; i <= 10; i++) segs.appendChild(el("span", { class: "seg" + (i <= v ? " on" : "") }));
    wrap.appendChild(segs);
    if (showVal !== false) wrap.appendChild(el("span", { class: "val", html: v + "<small>/10</small>" }));
    return wrap;
  }
  function convictionMini(value) {
    var v = Math.max(0, Math.min(10, +value || 0));
    var wrap = el("span", { class: "conviction-mini" });
    var bar = el("span", { class: "bar" });
    bar.appendChild(el("i", { style: "width:" + (v * 10) + "%" }));
    wrap.appendChild(bar);
    wrap.appendChild(el("span", { class: "n", text: v }));
    return wrap;
  }

  /* ---------- Asset cell ---------- */
  function assetCell(a) {
    if (!a) return el("span", { class: "dim", text: "—" });
    var cell = el("div", { class: "asset-cell" });
    cell.appendChild(el("div", { class: "ticker-badge", text: a.ticker.slice(0, 4) }));
    var col = el("div");
    col.appendChild(el("div", { class: "a-name", text: a.nome }));
    col.appendChild(el("div", { class: "a-tick", text: a.ticker + " · " + a.tipo }));
    cell.appendChild(col);
    return cell;
  }

  /* ---------- Card ---------- */
  /* Não existe opção `pad` aqui, e é de propósito: o .card-body já
     nasce com o espaçamento. Havia chamadas passando `pad: true`
     acreditando que ligavam alguma coisa — ele era silenciosamente
     ignorado e o resultado saía certo por acidente. Aplicar a classe
     agora somaria os dois espaçamentos. As chamadas foram limpas.

     A classe .card.pad continua no CSS para cartões montados à mão
     (sem .card-body), como os da tela de Teses. */
  function card(opts) {
    opts = opts || {};
    var c = el("div", { class: "card" + (opts.hoverable ? " hoverable" : "") });
    if (opts.title || opts.eyebrow || opts.action) {
      var head = el("div", { class: "card-head" });
      var titleWrap = el("div", { class: "grow", style: "margin-right:auto" });
      if (opts.eyebrow) titleWrap.appendChild(el("div", { class: "eyebrow", text: opts.eyebrow }));
      /* h2, não h3: o cartão é seção de primeiro nível abaixo do <h1>
         da tela. Pular de h1 para h3 quebra a árvore que o leitor de
         tela usa para navegar por títulos. */
      if (opts.title) titleWrap.appendChild(el("h2", { text: opts.title }));
      head.appendChild(titleWrap);
      if (opts.action) head.appendChild(opts.action);
      c.appendChild(head);
    }
    var body = el("div", { class: "card-body" + (opts.tight ? " tight" : "") });
    [].concat(opts.body || []).forEach(function (n) { if (n) body.appendChild(n); });
    c.appendChild(body);
    return c;
  }

  function kpi(opts) {
    var c = el("div", { class: "card kpi" });
    var label = el("div", { class: "kpi-label" });
    if (opts.icon) label.appendChild(iconEl(opts.icon));
    label.appendChild(document.createTextNode(opts.label));
    c.appendChild(label);
    c.appendChild(el("div", { class: "kpi-val", text: opts.value }));
    if (opts.delta != null) {
      var dir = opts.delta > 0 ? "up" : opts.delta < 0 ? "down" : "flat";
      var d = el("div", { class: "kpi-delta " + dir });
      d.innerHTML = icon(opts.delta > 0 ? "arrowUp" : opts.delta < 0 ? "arrowDown" : "check");
      d.appendChild(document.createTextNode(" " + opts.deltaText));
      c.appendChild(d);
    } else if (opts.sub) {
      c.appendChild(el("div", { class: "kpi-delta flat", text: opts.sub }));
    }
    if (opts.spark) {
      var s = el("div", { class: "kpi-spark" }); s.appendChild(opts.spark); c.appendChild(s);
    }
    return c;
  }

  /* ---------- Table ---------- */
  // columns: [{ head, right?, render(row)->node|string }]
  /* ============================================================
     TABELA COM ORDENAÇÃO E AÇÕES POR LINHA

     A tabela do Hold só sabia listar. Duas consequências práticas:
     não dava para perguntar "qual é a minha maior posição?" sem ler
     linha a linha, e qualquer ação exigia abrir o ativo primeiro —
     três cliques para uma compra que devia caber em um.

     Ordenação: a coluna declara `sort` (função que extrai o valor de
     comparação). Sem `sort`, o cabeçalho não vira botão — coluna que
     não ordena não deve parecer que ordena. O estado vive fora do
     render (`opts.sortKey`/`opts.onSort`) para sobreviver ao
     re-render da página.

     Ações: a coluna declara `actions: true`. O clique nela NÃO
     dispara o onRow — abrir o ativo ao tentar excluí-lo seria o tipo
     de acidente que a interface não pode oferecer.
     ============================================================ */
  function table(columns, rows, opts) {
    opts = opts || {};
    var wrap = el("div", { class: "table-wrap" });
    var t = el("table", { class: "tbl" });
    var thead = el("thead"), htr = el("tr");

    var ordenadas = rows.slice();
    var chave = opts.sortKey || null, desc = opts.sortDesc !== false;
    if (chave) {
      var alvo = columns.filter(function (c) { return (c.key || c.head) === chave && c.sort; })[0];
      if (alvo) {
        ordenadas.sort(function (a, b) {
          var x = alvo.sort(a), y = alvo.sort(b);
          if (typeof x === "string" || typeof y === "string") {
            var r = String(x).localeCompare(String(y), "pt-BR");
            return desc ? -r : r;
          }
          return desc ? (y - x) : (x - y);
        });
      }
    }

    columns.forEach(function (col) {
      var id = col.key || col.head;
      var th = el("th", { class: (col.right ? "right " : "") + (col.actions ? "acts " : "") + (col.sort ? "sortable" : "") });
      if (!col.sort) { th.textContent = col.head; htr.appendChild(th); return; }
      var ativo = chave === id;
      var b = el("button", { class: "th-sort" + (ativo ? " on" : ""), type: "button",
        "aria-label": "Ordenar por " + col.head });
      b.appendChild(document.createTextNode(col.head));
      b.appendChild(el("span", { class: "th-arrow", text: ativo ? (desc ? "↓" : "↑") : "↕" }));
      b.addEventListener("click", function () {
        if (!opts.onSort) return;
        /* Clicar de novo na mesma coluna inverte; coluna nova começa
           decrescente, que é o que se quer ver primeiro em dinheiro. */
        opts.onSort(id, ativo ? !desc : true);
      });
      th.appendChild(b);
      htr.appendChild(th);
    });
    thead.appendChild(htr); t.appendChild(thead);
    var tb = el("tbody");
    if (!ordenadas.length) {
      var tr = el("tr");
      tr.appendChild(el("td", { colspan: columns.length, class: "dim", style: "text-align:center;padding:28px", text: opts.empty || "Nenhum registro." }));
      tb.appendChild(tr);
    }
    ordenadas.forEach(function (row) {
      var tr = el("tr", { class: opts.onRow ? "clickable" : "" });
      if (opts.onRow) tr.addEventListener("click", function () { opts.onRow(row); });
      columns.forEach(function (col) {
        var td = el("td", { class: (col.right ? "right " : "") + (col.actions ? "acts" : "") });
        /* A célula de ações engole o clique: quem aperta "excluir" não
           quer, junto, abrir o ativo. */
        if (col.actions) td.addEventListener("click", function (e) { e.stopPropagation(); });
        var val = col.render(row);
        if (val == null) val = "—";
        if (typeof val === "string" || typeof val === "number") td.textContent = String(val);
        else td.appendChild(val);
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t);
    return wrap;
  }

  /* ---------- Empty state ---------- */
  function empty(iconName, title, msg, action) {
    var e = el("div", { class: "empty" });
    e.innerHTML = icon(iconName || "layers");
    e.appendChild(el("h2", { text: title }));   /* mesmo motivo do card() */
    if (msg) e.appendChild(el("p", { text: msg }));
    if (action) e.appendChild(action);
    return e;
  }

  /* ---------- Button ---------- */
  function button(label, opts) {
    opts = opts || {};
    var b = el("button", { class: "btn " + (opts.variant || "secondary") + (opts.size ? " " + opts.size : "") + (opts.block ? " block" : "") });
    if (opts.icon) b.innerHTML = icon(opts.icon);
    b.appendChild(document.createTextNode(label));
    if (opts.onClick) b.addEventListener("click", opts.onClick);
    return b;
  }

  /* ============================================================
     BOTÃO DE AÇÃO — o verbo ao alcance da linha

     Botão só de ícone, com rótulo acessível obrigatório. Um ícone sem
     nome é um enigma para quem usa leitor de tela e uma adivinhação
     para todo mundo — o `title` também alimenta a dica ao passar o
     mouse, então o mesmo texto serve aos dois.
     ============================================================ */
  function actionBtn(iconName, label, onClick, opts) {
    opts = opts || {};
    var b = el("button", {
      class: "act-btn" + (opts.danger ? " danger" : "") + (opts.primary ? " primary" : ""),
      type: "button", title: label, "aria-label": label
    });
    b.innerHTML = icon(iconName);
    if (opts.disabled) { b.disabled = true; b.title = opts.disabledHint || label; }
    else if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  /* Fileira de ações para uma linha de tabela. Aceita null no meio da
     lista, para a página poder decidir "vender só aparece se houver
     posição" sem montar arrays condicionais. */
  function rowActions(botoes) {
    var w = el("div", { class: "row-acts" });
    [].concat(botoes || []).forEach(function (b) { if (b) w.appendChild(b); });
    return w;
  }

  /* ============================================================
     MENU SUSPENSO

     Existe para tirar da linha as ações que não são do dia a dia sem
     escondê-las num submenu de configurações. Fecha ao clicar fora, ao
     apertar Esc e ao escolher — as três saídas que um menu precisa ter.
     ============================================================ */
  var menuAberto = null;
  function fecharMenu() {
    if (!menuAberto) return;
    menuAberto.remove(); menuAberto = null;
    document.removeEventListener("mousedown", foraDoMenu, true);
    document.removeEventListener("keydown", escMenu, true);
  }
  function foraDoMenu(e) { if (menuAberto && !menuAberto.contains(e.target)) fecharMenu(); }
  function escMenu(e) { if (e.key === "Escape") fecharMenu(); }

  function menu(ancora, itens) {
    fecharMenu();
    var m = el("div", { class: "menu", role: "menu" });
    itens.forEach(function (it) {
      if (!it) return;
      if (it.sep) { m.appendChild(el("div", { class: "menu-sep" })); return; }
      var b = el("button", { class: "menu-item" + (it.danger ? " danger" : ""), type: "button", role: "menuitem" });
      if (it.icon) b.innerHTML = icon(it.icon);
      b.appendChild(el("span", { text: it.label }));
      if (it.disabled) { b.disabled = true; if (it.hint) b.title = it.hint; }
      else b.addEventListener("click", function () { fecharMenu(); it.onClick(); });
      m.appendChild(b);
    });

    document.body.appendChild(m);
    var r = ancora.getBoundingClientRect();
    var alt = m.offsetHeight, larg = m.offsetWidth;
    /* Perto do rodapé, abre para cima; perto da borda direita, alinha
       pela direita. Menu que nasce fora da tela é menu que não existe. */
    var top = (r.bottom + alt + 8 > window.innerHeight) ? (r.top - alt - 6) : (r.bottom + 6);
    var left = Math.min(r.left, window.innerWidth - larg - 12);
    m.style.top = Math.max(8, top) + "px";
    m.style.left = Math.max(8, left) + "px";

    menuAberto = m;
    document.addEventListener("mousedown", foraDoMenu, true);
    document.addEventListener("keydown", escMenu, true);
    var primeiro = m.querySelector("button:not([disabled])");
    if (primeiro) primeiro.focus();
    return m;
  }

  /* Botão "⋯" que abre o menu acima. */
  function menuBtn(itens, label) {
    var b = actionBtn("more", label || "Mais ações", null);
    b.addEventListener("click", function () { menu(b, typeof itens === "function" ? itens() : itens); });
    return b;
  }

  /* ============================================================
     CONFIRMAÇÃO DE AÇÃO IRREVERSÍVEL

     O Hold não tinha nenhuma: não havia o que confirmar, porque não
     havia como apagar nada. Agora que há, a regra do ATLAS vale — o
     diálogo diz O QUE some, não pergunta "tem certeza?". "Tem certeza"
     não informa; a lista do que será perdido informa.
     ============================================================ */
  function confirmar(opts) {
    var corpo = el("div");
    if (opts.mensagem) corpo.appendChild(el("p", { style: "line-height:1.6", text: opts.mensagem }));
    if (opts.itens && opts.itens.length) {
      var ul = el("div", { class: "confirm-list" });
      opts.itens.forEach(function (i) {
        ul.appendChild(el("div", { class: "ci" }, [iconEl(i.icon || "x"), el("span", { text: i.texto })]));
      });
      corpo.appendChild(ul);
    }
    if (opts.nota) corpo.appendChild(el("div", { class: "small dim", style: "margin-top:12px", text: opts.nota }));

    var ok = button(opts.confirmar || "Confirmar", {
      variant: opts.perigo === false ? "primary" : "danger",
      icon: opts.perigo === false ? "check" : "trash",
      onClick: function () { closeModal(); opts.onConfirm(); }
    });
    modal({
      eyebrow: opts.eyebrow || "Confirmação",
      title: opts.titulo,
      body: [corpo],
      footer: [button("Cancelar", { variant: "ghost", onClick: closeModal }), el("div", { class: "spacer" }), ok]
    });
  }

  /* ---------- Modal ---------- */
  var activeScrim = null;
  var soltarFoco = null;      // devolvida por AtlasUI.trapFocus
  function modal(opts) {
    closeModal();
    var scrim = el("div", { class: "modal-scrim" });
    scrim.addEventListener("mousedown", function (e) { if (e.target === scrim) closeModal(); });
    var m = el("div", { class: "modal" + (opts.wide ? " wide" : "") });

    var head = el("div", { class: "modal-head" });
    var titleWrap = el("div");
    if (opts.eyebrow) titleWrap.appendChild(el("div", { class: "eyebrow", text: opts.eyebrow }));
    titleWrap.appendChild(el("h2", { text: opts.title || "" }));
    head.appendChild(titleWrap);
    var closeBtn = el("button", { class: "icon-btn", "aria-label": "Fechar" });
    closeBtn.innerHTML = icon("x"); closeBtn.addEventListener("click", closeModal);
    head.appendChild(closeBtn);
    m.appendChild(head);

    var body = el("div", { class: "modal-body" });
    [].concat(opts.body || []).forEach(function (n) { if (n) body.appendChild(n); });
    m.appendChild(body);

    if (opts.footer) {
      var foot = el("div", { class: "modal-foot" });
      [].concat(opts.footer).forEach(function (n) { if (n) foot.appendChild(n); });
      m.appendChild(foot);
    }
    scrim.appendChild(m);
    document.body.appendChild(scrim);
    activeScrim = scrim;
    document.addEventListener("keydown", escClose);

    /* Armadilha de foco do kit compartilhado (core/ui/atlas-ui.js).
       Sem ela o Tab escapava do modal e ia navegando pela página ATRÁS
       do overlay — quem usa teclado acabava preenchendo um formulário
       que não estava vendo. Também marca role/aria-modal, que este
       modal nunca declarou, e devolve o foco a quem abriu ao fechar. */
    if (window.AtlasUI && AtlasUI.trapFocus) {
      soltarFoco = AtlasUI.trapFocus(m, closeModal);
    }

    var firstInput = m.querySelector("input,select,textarea,button.btn");
    if (firstInput) setTimeout(function () { firstInput.focus(); }, 40);
    return { close: closeModal, node: m, body: body };
  }
  function escClose(e) { if (e.key === "Escape") closeModal(); }
  function closeModal() {
    if (soltarFoco) { soltarFoco(); soltarFoco = null; }
    if (activeScrim) { activeScrim.remove(); activeScrim = null; document.removeEventListener("keydown", escClose); }
  }

  /* ---------- Toast ---------- */
  function toast(title, msg, kind) {
    var wrap = document.querySelector(".toast-wrap");
    if (!wrap) { wrap = el("div", { class: "toast-wrap" }); document.body.appendChild(wrap); }
    var t = el("div", { class: "toast " + (kind || "") });
    var ic = { success: "check", warning: "alert", danger: "alert" }[kind] || "check";
    t.innerHTML = icon(ic);
    var col = el("div");
    col.appendChild(el("div", { class: "t-title", text: title }));
    if (msg) col.appendChild(el("div", { class: "t-msg", text: msg }));
    t.appendChild(col);
    wrap.appendChild(t);
    setTimeout(function () { t.style.opacity = "0"; t.style.transform = "translateX(16px)"; setTimeout(function () { t.remove(); }, 260); }, 3200);
  }

  /* ---------- Form field builders ---------- */
  function field(label, control, opts) {
    opts = opts || {};
    var f = el("div", { class: "field" });
    if (label) {
      var l = el("label", {}, [label]);
      if (opts.required) l.appendChild(el("span", { class: "req", text: " *" }));
      f.appendChild(l);
    }
    f.appendChild(control);
    if (opts.hint) f.appendChild(el("div", { class: "hint", text: opts.hint }));
    return f;
  }
  function input(attrs) { return el("input", Object.assign({ class: "input" }, attrs)); }
  function textarea(attrs) { return el("textarea", Object.assign({ class: "textarea" }, attrs)); }
  function select(options, value) {
    var s = el("select", { class: "select" });
    options.forEach(function (o) {
      var opt = el("option", { value: o.value, text: o.label });
      if (o.value === value) opt.selected = true;
      s.appendChild(opt);
    });
    return s;
  }

  window.UI = {
    el: el, icon: icon, iconEl: iconEl,
    money: money, compact: compact, pct: pct, signClass: signClass, qty: qty,
    dateShort: dateShort, dateTime: dateTime,
    badge: badge, conviction: conviction, convictionMini: convictionMini,
    assetCell: assetCell, card: card, kpi: kpi, table: table, empty: empty, button: button,
    actionBtn: actionBtn, rowActions: rowActions, menu: menu, menuBtn: menuBtn,
    fecharMenu: fecharMenu, confirmar: confirmar,
    modal: modal, closeModal: closeModal, toast: toast,
    field: field, input: input, textarea: textarea, select: select
  };
})();
