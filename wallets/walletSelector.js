/* ============================================================
   ATLAS · /wallets/walletSelector.js
   ------------------------------------------------------------
   O SELETOR DE CARTEIRA. Um componente, um markup, um CSS.

   Dashboard, Hold, Trade, DeFi, RWA e Relatórios montam ESTE
   componente. Não há mais "pele" por módulo: o markup abaixo é o
   único que existe, e quem o pinta é wallets/walletSelector.css.

   O que cada montagem oferece — igual em todos, sem exceção:
     · selecionar carteira global
     · selecionar carteira local
     · criar carteira global
     · criar carteira local
     · renomear carteira
     · excluir carteira

   ------------------------------------------------------------
   COMO USAR

     WalletSelector.render(host, {
       module: "hold",        // dono das carteiras locais desta tela
       scope: "module",       // "module" (padrão) | "all"
       money: fn,             // opcional: formatador de dinheiro
       balanceModule: "hold", // opcional: fatia do ledger no subtítulo
       feed: fn,              // opcional: totais que o módulo reporta
       getActive: fn,         // opcional: quem manda na carteira ativa
       onSelect: fn,          // opcional: idem
       afterChange: fn        // opcional: criou/renomeou/excluiu
     });

   Sem getActive/onSelect, o componente usa a carteira ativa por
   módulo da central (AtlasWallets.activeFor/setActiveFor) — é o que
   Dashboard e Relatórios fazem. Hold, Trade, DeFi e RWA passam os
   seus porque a partição de dados deles depende do estado interno.
   Em qualquer um dos dois caminhos a TELA é a mesma.

   ------------------------------------------------------------
   TRÊS DECISÕES QUE VIERAM DE BUGS REAIS — não desfazer:

   1) OS ÍCONES NASCEM AQUI. Este arquivo não chama helper de ícone
      de módulo. As assinaturas divergiam (Hold: icon(nome, CLASSE);
      DeFi/RWA: icon(nome); Trade: icon(nome, tamanho)), e no Hold o
      SVG saía sem width/height, esticava e transformava o "Nova
      carteira" num bloco de 226×220px.

   2) NÃO EXISTE FOLHA/SCRIM atrás do menu. Ela cobria o menu nos
      módulos, porque as topbars criam contexto de empilhamento e
      prendem o z-index do seletor lá dentro. Fechar ao clicar fora
      é o listener de captura de walletMenus.js.

   3) UM listener de clique por host (delegado, sobrevive ao
      rerender) e UMA assinatura do store por página, que repinta
      todos os seletores montados.

   Exposto em: window.WalletSelector
   ============================================================ */
(function (global) {
  "use strict";
  if (global.WalletSelector) return;

  var W = null;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function erro(e) {
    if (global.console && console.error) console.error("[WalletSelector]", e);
  }

  /* ---------------- ícones, sempre com medida ---------------- */
  function svg(size, d, extra) {
    return '<svg class="' + (extra || "") + '" viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true" focusable="false">' + d + '</svg>';
  }
  var IC = {
    chevron: function () { return svg(15, '<path d="m6 9 6 6 6-6"/>', "awsel__chev"); },
    check:   function () { return svg(15, '<path d="M20 6 9 17l-5-5"/>'); },
    plus:    function () { return svg(14, '<path d="M12 5v14M5 12h14"/>'); },
    pencil:  function () { return svg(13, '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'); },
    trash:   function () { return svg(13, '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>'); }
  };

  /* ---------------- dados de apresentação ---------------- */
  function swatch(w, extraClass) {
    var cls = "awsel__swatch" + (w.emoji ? " awsel__swatch--emoji" : "") + (extraClass ? " " + extraClass : "");
    var style = w.emoji ? "" : ' style="background:' + esc(w.color || "#4C9AFF") + '"';
    return '<span class="' + cls + '"' + style + '>' +
      (w.emoji ? esc(w.emoji) : esc(W.initials(w.name))) + '</span>';
  }
  function badge(w) {
    var local = w.type === "isolada";
    return '<span class="awsel__badge awsel__badge--' + (local ? "local" : "global") + '">' +
      (local ? "local" : "global") + '</span>';
  }
  function money(opts, v) {
    if (opts.money) { try { return opts.money(v); } catch (e) {} }
    return "US$ " + (Math.round(v * 100) / 100).toLocaleString("en-US");
  }
  function saldo(opts, id) {
    return money(opts, W.balanceOf(id, opts.balanceModule || null));
  }

  /* ---------------- escopo e carteira ativa ---------------- */
  function listFor(opts) {
    if (opts.scope === "all") return W.all();
    if (opts.scope === "globals") return W.globals();
    return W.forModule(opts.module);
  }
  function activeOf(opts) {
    if (typeof opts.getActive === "function") {
      try { var a = opts.getActive(); if (a) return a; } catch (e) { erro(e); }
    }
    return W.activeFor(opts.module);
  }

  /* ============================================================
     MARKUP — o único que existe
     ============================================================ */
  function html(opts, active, list) {
    var podeExcluir = W.globals().length > 1;

    var linhas = list.map(function (w) {
      var on = w.id === active.id;
      /* a última carteira global não pode ser excluída: o ATLAS
         precisa de pelo menos uma para consolidar patrimônio */
      var travada = w.type === "global" && !podeExcluir;
      return '' +
        '<div class="awsel__row' + (on ? " awsel__row--on" : "") + '">' +
          '<button type="button" class="awsel__opt" data-wopt="' + esc(w.id) + '" ' +
                  'aria-current="' + on + '">' +
            swatch(w) +
            '<span class="awsel__opt-txt">' +
              '<span class="awsel__opt-line">' +
                '<span class="awsel__opt-name">' + esc(w.name) + '</span>' + badge(w) +
              '</span>' +
              '<span class="awsel__opt-sub">' + saldo(opts, w.id) + '</span>' +
            '</span>' +
            (on ? '<span class="awsel__check">' + IC.check() + '</span>' : "") +
          '</button>' +
          '<span class="awsel__acts">' +
            '<button type="button" class="awsel__act" data-wren="' + esc(w.id) + '" ' +
                    'title="Renomear" aria-label="Renomear ' + esc(w.name) + '">' + IC.pencil() + '</button>' +
            '<button type="button" class="awsel__act awsel__act--del" data-wdel="' + esc(w.id) + '" ' +
                    (travada ? 'disabled title="A última carteira global não pode ser excluída" '
                             : 'title="Excluir" ') +
                    'aria-label="Excluir ' + esc(w.name) + '">' + IC.trash() + '</button>' +
          '</span>' +
        '</div>';
    }).join("");

    if (!linhas) linhas = '<div class="awsel__empty">Nenhuma carteira neste escopo.</div>';

    /* Criar local só é oferecido quando a tela tem um módulo dono —
       uma carteira local precisa saber a quem pertence. */
    var criar =
      '<button type="button" class="awsel__add" data-wadd="global">' +
        '<span class="awsel__swatch awsel__swatch--add">' + IC.plus() + '</span>' +
        '<span class="awsel__add-txt">Nova carteira global</span>' +
      '</button>' +
      (opts.module
        ? '<button type="button" class="awsel__add" data-wadd="isolada">' +
            '<span class="awsel__swatch awsel__swatch--add">' + IC.plus() + '</span>' +
            '<span class="awsel__add-txt">Nova carteira local</span>' +
          '</button>'
        : "");

    return '' +
      '<button type="button" class="awsel__btn" data-wbtn aria-haspopup="menu">' +
        swatch(active) +
        '<span class="awsel__meta">' +
          '<span class="awsel__name">' + esc(active.name) + '</span>' +
          '<span class="awsel__sub">' +
            (active.type === "isolada" ? "Local" : "Global") + ' · ' + saldo(opts, active.id) +
          '</span>' +
        '</span>' +
        IC.chevron() +
      '</button>' +
      '<div class="awsel__menu" role="menu">' +
        '<div class="awsel__head">Carteira</div>' +
        '<div class="awsel__list">' + linhas + '</div>' +
        '<div class="awsel__foot">' + criar + '</div>' +
      '</div>';
  }

  /* ============================================================
     ABRIR / FECHAR
     ============================================================ */
  function toggle(root) {
    root.setAttribute("data-open", root.getAttribute("data-open") === "true" ? "false" : "true");
  }
  function close(root) { root.setAttribute("data-open", "false"); }

  /* ============================================================
     REGISTRO DE MONTAGENS
     Uma entrada por host, sempre com as opções MAIS RECENTES. O
     listener delegado e o repintar leem daqui, então nunca operam
     sobre uma closure velha. Hosts fora da tela são varridos.
     ============================================================ */
  var MOUNTS = [];
  var subscribed = false;

  function sweep() {
    for (var i = MOUNTS.length - 1; i >= 0; i--) {
      if (!MOUNTS[i].host.isConnected) {
        MOUNTS[i].host.__atlasWsel = null;
        MOUNTS.splice(i, 1);
      }
    }
  }
  function entryFor(host, opts) {
    sweep();
    for (var i = 0; i < MOUNTS.length; i++) {
      if (MOUNTS[i].host === host) { MOUNTS[i].opts = opts; return MOUNTS[i]; }
    }
    var e = { host: host, opts: opts };
    MOUNTS.push(e);
    host.__atlasWsel = e;
    return e;
  }

  /* UMA assinatura para a página inteira, não uma por seletor.
     Qualquer mudança de carteira (criar, renomear, excluir, trocar),
     venha deste módulo, de outro ou de outra aba (evento storage),
     repinta todos os seletores montados. */
  function repintarTudo() {
    sweep();
    MOUNTS.slice().forEach(function (m) {
      try { paint(m.host, m.opts); } catch (e) { erro(e); }
    });
  }
  function ensureSubscription() {
    if (subscribed || !W || !W.subscribe) return;
    subscribed = true;
    W.subscribe(repintarTudo);
  }

  /* ============================================================
     CLIQUE — delegado no HOST, registrado UMA vez.
     O host sobrevive ao rerender (é o miolo dele que é reescrito),
     então o listener sobrevive junto. Nenhum botão tem listener
     próprio: não há nada para reconectar depois de repintar.
     ============================================================ */
  function bindOnce(host) {
    if (host.__atlasWselBound) return;
    host.__atlasWselBound = true;

    host.addEventListener("click", function (ev) {
      var e = host.__atlasWsel;
      if (!e || !ev.target || !ev.target.closest) return;
      var root = rootOf(host);
      if (!root) return;

      function alvo(sel) {
        var n = ev.target.closest(sel);
        return (n && root.contains(n)) ? n : null;
      }

      var n;
      if ((n = alvo("[data-wadd]"))) {
        ev.preventDefault(); ev.stopPropagation();
        close(root);
        abrirCriar(e.opts, n.getAttribute("data-wadd"));
        return;
      }
      if ((n = alvo("[data-wren]"))) {
        ev.preventDefault(); ev.stopPropagation();
        close(root);
        abrirRenomear(e.opts, n.getAttribute("data-wren"));
        return;
      }
      if ((n = alvo("[data-wdel]"))) {
        ev.preventDefault(); ev.stopPropagation();
        if (n.disabled) return;
        close(root);
        abrirExcluir(e.opts, n.getAttribute("data-wdel"));
        return;
      }
      if ((n = alvo("[data-wopt]"))) {
        ev.preventDefault(); ev.stopPropagation();
        close(root);
        selecionar(e.opts, n.getAttribute("data-wopt"));
        return;
      }
      if ((n = alvo("[data-wbtn]"))) {
        ev.preventDefault(); ev.stopPropagation();
        toggle(root);
      }
    });
  }

  function rootOf(host) {
    if (host.classList && host.classList.contains("awsel")) return host;
    return host.querySelector(".awsel");
  }

  /* ============================================================
     PINTAR — só desenha. Não registra listener nem assinatura, por
     isso pode ser chamado à vontade (inclusive pela assinatura).
     ============================================================ */
  function paint(host, opts) {
    W = global.AtlasWallets;
    if (!host || !W) return null;

    /* alimenta o ledger central com os totais que o módulo já sabe.
       report() grava sem emitir de propósito — se emitisse, pintar
       dispararia a assinatura que dispara pintar, em laço. */
    if (typeof opts.feed === "function" && opts.module) {
      try {
        (opts.feed() || []).forEach(function (r) {
          if (r && r.id) W.report(opts.module, r.id, r);
        });
      } catch (e) { erro(e); }
    }

    var active = activeOf(opts);
    var list = listFor(opts);

    var antes = rootOf(host);
    var estavaAberto = !!antes && antes.getAttribute("data-open") === "true";

    var root;
    if (host.classList && host.classList.contains("awsel")) {
      host.innerHTML = html(opts, active, list);
      root = host;
    } else {
      host.innerHTML = '<div class="awsel">' + html(opts, active, list) + '</div>';
      root = host.querySelector(".awsel");
    }
    if (!root) return null;
    root.setAttribute("data-open", estavaAberto ? "true" : "false");
    return root;
  }

  /* ============================================================
     RENDER — o que os módulos chamam
     ============================================================ */
  function render(host, opts) {
    W = global.AtlasWallets;
    if (!host || !W) return null;
    opts = opts || {};
    entryFor(host, opts);
    var root = paint(host, opts);
    bindOnce(host);
    ensureSubscription();
    if (global.AtlasCloseMenus) global.AtlasCloseMenus();
    return root;
  }

  /* ============================================================
     AÇÕES
     ============================================================ */
  /* O repintar depois de chamar o módulo NÃO é redundante com a
     assinatura do store. Quando o módulo guarda a carteira em uso no
     estado DELE — o caso das locais no RWA e nos Relatórios — nada é
     gravado na central, logo não há evento, logo o seletor ficaria
     mostrando a carteira anterior. Era exatamente o sintoma "cliquei
     na carteira, o relatório mudou, mas o botão continuou o mesmo".
     Repintar aqui resolve para todo módulo de uma vez, em vez de cada
     um lembrar de pedir o próprio redesenho. */
  function avisar(opts, w, acao) {
    if (typeof opts.afterChange === "function") {
      try { opts.afterChange(w, acao); } catch (e) { erro(e); }
    }
    repintarTudo();
    if (opts.reload && global.location && global.location.reload) global.location.reload();
  }

  function selecionar(opts, id) {
    var w = W.get(id);
    if (!w) return;
    if (typeof opts.onSelect === "function") opts.onSelect(id, w);
    else W.setActiveFor(opts.module, id);
    repintarTudo();
    if (opts.reload && global.location && global.location.reload) global.location.reload();
  }

  function precisaDoDialogo() {
    if (global.AtlasWalletDialog) return true;
    /* silêncio aqui era o sintoma "clico e não acontece nada":
       a página esqueceu de carregar wallets/walletDialog.js. */
    erro('AtlasWalletDialog ausente — inclua <script src="wallets/walletDialog.js"> nesta página.');
    return false;
  }

  function abrirCriar(opts, tipoPedido) {
    W = global.AtlasWallets;
    if (!precisaDoDialogo()) return;

    var local = tipoPedido === "isolada" && !!opts.module;
    global.AtlasWalletDialog.open({
      mode: "create",
      type: local ? "isolada" : "global",
      module: opts.module || null,
      allowLocal: !!opts.module,   // a chavinha Global/Local no diálogo
      onConfirm: function (d) {
        var type = (d.type === "isolada" && opts.module) ? "isolada" : "global";
        var w = W.create({
          name: d.name,
          type: type,
          module: type === "isolada" ? opts.module : null,
          emoji: d.emoji
        });
        if (!w) return;
        /* nasceu, então vira a carteira em uso — em qualquer módulo */
        if (typeof opts.onSelect === "function") opts.onSelect(w.id, w);
        else W.setActiveFor(opts.module, w.id);
        avisar(opts, w, "create");
      }
    });
  }

  function abrirRenomear(opts, id) {
    W = global.AtlasWallets;
    var w = W.get(id);
    if (!w || !precisaDoDialogo()) return;

    global.AtlasWalletDialog.open({
      mode: "rename",
      wallet: w,
      onConfirm: function (d) {
        W.rename(id, d.name);
        W.setEmoji(id, d.emoji);
        avisar(opts, W.get(id), "rename");
      }
    });
  }

  function abrirExcluir(opts, id) {
    W = global.AtlasWallets;
    var w = W.get(id);
    if (!w || !precisaDoDialogo()) return;

    global.AtlasWalletDialog.confirmDelete(w, function () {
      if (!W.remove(id)) { erro("não foi possível excluir a carteira " + id); return; }
      avisar(opts, w, "remove");
    });
  }

  global.WalletSelector = {
    render: render,
    openCreate: function (opts) { abrirCriar(opts || {}, "global"); },
    balanceOf: function (id, m) {
      return (global.AtlasWallets && global.AtlasWallets.balanceOf)
        ? global.AtlasWallets.balanceOf(id, m) : 0;
    }
  };
})(typeof window !== "undefined" ? window : this);
