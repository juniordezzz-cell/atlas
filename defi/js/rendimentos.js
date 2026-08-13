/* ============================================================
   ATLAS · DeFi — rendimentos.js
   ------------------------------------------------------------
   A TELA DE STAKING E A DE LENDING — uma implementação só.

   As duas eram listas somente-leitura: nenhum botão, nenhum
   formulário, nenhuma função de criação no store. Apareciam no menu,
   somavam no patrimônio a partir de um campo `value` gravado, e
   abriam vazias para sempre.

   Elas são a mesma coisa com outro nome: capital que sai do caixa,
   rende ao longo do tempo, e volta. A diferença é vocabulário — APR
   contra APY, "recompensa" contra "juros" — e ela mora no objeto
   VOCAB abaixo. A mecânica do dinheiro é idêntica e fica em
   DeFiStore.addRendimento / rendimentoSummary / closeRendimento.

   Duplicar isto em dois arquivos criaria dois lugares para divergir,
   que é o defeito que a terceira auditoria passou inteira corrigindo.
   ============================================================ */
(function () {
  "use strict";

  var U = window.U, C = window.C, S = window.DeFiStore;

  var VOCAB = {
    staking: {
      titulo: "Staking", eyebrow: "Rendimento",
      taxa: "APR", campoTaxa: "apr",
      rendimento: "Recompensas", rendimentoSing: "recompensa",
      kpiTotal: "Total em Staking", icone: "stake", acento: "violet",
      novo: "Nova posição de staking",
      vazio: "Nenhum ativo em staking",
      vazioTxt: "Registre o que você tem rendendo — o capital sai do caixa da carteira e volta quando você encerrar."
    },
    lending: {
      titulo: "Lending", eyebrow: "Empréstimo",
      taxa: "APY", campoTaxa: "apy",
      rendimento: "Juros", rendimentoSing: "juros",
      kpiTotal: "Total Fornecido", icone: "lend", acento: "cyan",
      novo: "Nova posição de lending",
      vazio: "Nenhuma posição de lending",
      vazioTxt: "Registre o que você forneceu — o capital sai do caixa da carteira e volta quando você encerrar."
    }
  };

  var CHAINS = ["Solana", "Ethereum", "Base", "Arbitrum", "Polygon", "Optimism"];

  function esc(t) {
    return String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function num(sel) {
    var e = U.qs(sel);
    if (!e) return 0;
    var v = parseFloat(String(e.value).replace(",", "."));
    return isFinite(v) && v > 0 ? v : 0;
  }
  function txt(sel) {
    var e = U.qs(sel);
    return e ? String(e.value || "").trim() : "";
  }

  function montar(tipo, hosts) {
    var V = VOCAB[tipo];
    if (!V || !S) return;

    /* ---------------- KPIs ---------------- */
    function pintarKpis() {
      var itens = S.rendimentos(tipo);
      var valor = 0, rend = 0, taxaPond = 0, peso = 0;
      itens.forEach(function (it) {
        var r = S.rendimentoSummary(tipo, it);
        if (!r) return;
        valor += r.valorTotal;
        rend += r.rendimentoTotal;
        var tx = Number(it[V.campoTaxa]) || 0;
        if (tx > 0 && r.valorTotal > 0) { taxaPond += tx * r.valorTotal; peso += r.valorTotal; }
      });
      /* Média PONDERADA pelo valor. A média simples dizia que uma
         posição de US$ 10 a 300% e uma de US$ 10.000 a 5% rendiam
         152% — número que não existe em lugar nenhum. Mesma correção
         que o APR médio das pools recebeu. */
      var media = peso > 0 ? taxaPond / peso : 0;

      U.qs(hosts.kpis).innerHTML = [
        C.finCard({ label: V.kpiTotal, value: U.money(valor), icon: V.icone, accent: V.acento,
                    sub: itens.length + (itens.length === 1 ? " posição" : " posições") }),
        C.finCard({ label: V.rendimento, value: U.signedMoney(rend), icon: "trend", accent: "green",
                    sub: "gerados desde a abertura" }),
        C.finCard({ label: V.taxa + " Médio", value: U.pct(media), icon: "gauge", accent: "cyan",
                    sub: "ponderado pelo valor" })
      ].join("");
      U.reveal(hosts.kpis + " .fin-card");
    }

    /* ---------------- Cards ---------------- */
    function pintarLista() {
      var host = U.qs(hosts.grid);
      if (!host) return;
      var itens = S.rendimentos(tipo);

      if (!itens.length) {
        host.innerHTML = C.empty({ icon: V.icone, title: V.vazio, text: V.vazioTxt,
                                   actionLabel: V.novo, actionHref: "#" });
        var b = host.querySelector(".btn");
        if (b) b.addEventListener("click", function (e) { e.preventDefault(); abrirNovo(); });
        return;
      }

      host.innerHTML = itens.map(function (it) {
        var r = S.rendimentoSummary(tipo, it);
        var cls = r.resultado > 0 ? "up" : r.resultado < 0 ? "down" : "flat";
        /* Sem cotação o valor cai no preço de entrada — a tela diz,
           em vez de exibir um número derivado de um preço que não
           existe como se fosse de mercado. */
        var aviso = r.precoOk ? "" :
          '<div class="hint" style="margin-top:8px">Sem preço de <b>' + esc(it.token) +
          '</b> — o valor abaixo usa o preço de entrada. Informe o preço em qualquer ' +
          'posição que use este token.</div>';

        return '<div class="pos-card" style="cursor:default" data-id="' + esc(it.id) + '">' +
          '<div class="pos-head"><div class="pos-pair">' +
            '<div class="pair-icons">' + U.coin(it.token) + '</div>' +
            '<div><div class="pair-name">' + esc(it.token) + '</div>' +
            '<div class="pair-proto">' + esc(it.protocol || "—") + '</div></div></div>' +
            U.statusDot("ativa") +
          '</div>' +
          '<div class="pos-tags">' +
            (it.chain ? '<span class="tag tag-chain"><span class="dot" style="background:' +
              S.colorOf("chain", it.chain) + '"></span>' + esc(it.chain) + '</span>' : '') +
            (it.protocol ? '<span class="tag tag-proto">' + esc(it.protocol) + '</span>' : '') +
          '</div>' +
          '<div class="pos-metrics">' +
            '<div class="pos-metric"><div class="k">Capital</div><div class="v">' + U.money(r.capital) + '</div></div>' +
            '<div class="pos-metric"><div class="k">Valor</div><div class="v">' + U.money(r.valorAtual) + '</div></div>' +
            '<div class="pos-metric"><div class="k">' + V.rendimento + '</div>' +
              '<div class="v delta up">' + U.money(r.rendimentoTotal) + '</div></div>' +
            '<div class="pos-metric"><div class="k">Resultado</div>' +
              '<div class="v delta ' + cls + '">' + U.signedMoney(r.resultado) + '</div></div>' +
          '</div>' +
          aviso +
          '<div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">' +
            '<button class="btn btn-secondary btn-sm" data-rend="' + esc(it.id) + '">Registrar ' + V.rendimentoSing + '</button>' +
            (r.rendimentoPendente > 0
              ? '<button class="btn btn-secondary btn-sm" data-coletar="' + esc(it.id) + '">Sacar ' +
                U.money(r.rendimentoPendente) + ' para o caixa</button>' : '') +
            '<button class="btn btn-cancel btn-sm" data-fechar="' + esc(it.id) + '">Encerrar</button>' +
          '</div>' +
        '</div>';
      }).join("");

      U.reveal(hosts.grid + " .pos-card");
      ligarAcoes(host);
    }

    function ligarAcoes(host) {
      host.querySelectorAll("[data-rend]").forEach(function (b) {
        b.addEventListener("click", function () { abrirRendimento(b.dataset.rend); });
      });
      host.querySelectorAll("[data-coletar]").forEach(function (b) {
        b.addEventListener("click", function () {
          var it = S.rendimento(tipo, b.dataset.coletar);
          if (!it) return;
          var total = 0;
          (it.rewards || []).filter(function (r) { return r.status === "pendente"; })
            .forEach(function (r) { S.collectRendimentoReward(tipo, it.id, r.id); total += Number(r.amount) || 0; });
          U.toast(U.money(total) + " de " + V.rendimentoSing + " foi para o caixa.", "ok");
          repintar();
        });
      });
      host.querySelectorAll("[data-fechar]").forEach(function (b) {
        b.addEventListener("click", function () {
          var it = S.rendimento(tipo, b.dataset.fechar);
          if (!it) return;
          var r = S.rendimentoSummary(tipo, it);
          confirmar("Encerrar " + it.token + "?",
            "US$ " + r.valorTotal.toFixed(2) + " voltam para o caixa da carteira, com o resultado embutido.",
            function () {
              S.closeRendimento(tipo, it.id, "Encerramento manual.");
              U.toast(it.token + " encerrado — " + U.money(r.valorTotal) + " no caixa.", "ok");
              repintar();
            });
        });
      });
    }

    function confirmar(titulo, msg, ok) {
      if (window.AtlasUI && AtlasUI.confirm) {
        AtlasUI.confirm({ title: titulo, message: msg, confirmLabel: "Confirmar", danger: true })
          .then(function (r) { if (r) ok(); });
      } else if (window.confirm(titulo + "\n\n" + msg)) ok();
    }

    /* ---------------- Modais ---------------- */
    function modal(titulo, corpo, onSalvar, rotulo) {
      var m = U.qs("#modalRend");
      U.qs("#rendTitulo").textContent = titulo;
      U.qs("#rendBody").innerHTML = corpo;
      var btn = U.qs("#rendSalvar");
      btn.textContent = rotulo || "Salvar";
      var novo = btn.cloneNode(true);          // limpa listeners da abertura anterior
      btn.parentNode.replaceChild(novo, btn);
      novo.addEventListener("click", onSalvar);
      U.openModal("#modalRend");
      var f = m.querySelector("input,select");
      if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 60);
    }

    function abrirNovo() {
      modal(V.novo,
        '<div class="field"><label>Token</label>' +
          '<input class="input" id="rToken" placeholder="ex.: SOL" data-atlas-asset="symbol" autocomplete="off" /></div>' +
        '<div class="col-2" style="gap:0 16px">' +
          '<div class="field"><label>Quantidade</label>' +
            '<input class="input" id="rQtd" type="number" step="any" min="0" placeholder="0" /></div>' +
          '<div class="field"><label>Preço de entrada (US$)</label>' +
            '<input class="input" id="rPreco" type="number" step="any" min="0" placeholder="por unidade" />' +
            '<div class="hint" id="rPrecoDica">Buscando o preço de mercado…</div></div>' +
        '</div>' +
        '<div class="col-2" style="gap:0 16px">' +
          '<div class="field"><label>Protocolo</label>' +
            '<input class="input" id="rProto" placeholder="ex.: Marinade, Aave" /></div>' +
          '<div class="field"><label>Blockchain</label>' +
            '<select class="select" id="rChain">' +
              CHAINS.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join("") +
            '</select></div>' +
        '</div>' +
        '<div class="col-2" style="gap:0 16px">' +
          '<div class="field"><label>' + V.taxa + ' (%)</label>' +
            '<input class="input" id="rTaxa" type="number" step="any" min="0" placeholder="0" /></div>' +
          '<div class="field"><label>Data de abertura</label>' +
            '<input class="input" id="rData" type="date" value="' + U.hoje() + '" /></div>' +
        '</div>' +
        '<div class="hint" id="rCaixa"></div>',
        salvarNovo, "Abrir posição");

      /* preço sugerido pela cadeia do ATLAS, e o saldo disponível à
         vista: abrir posição sem caixa é recusado, e a pessoa precisa
         saber disso ANTES de preencher tudo */
      var tk = U.qs("#rToken");
      if (window.AtlasAssets) AtlasAssets.autoBind(U.qs("#rendBody"));
      if (tk) tk.addEventListener("change", sugerirPreco);
      if (tk) tk.addEventListener("blur", sugerirPreco);
      mostrarCaixa();
    }

    function mostrarCaixa() {
      var el = U.qs("#rCaixa");
      if (!el || !window.AtlasCaixa) return;
      var w = S.activeWallet();
      el.innerHTML = "Caixa disponível em <b>" + esc(w.name) + "</b>: <b>" +
        U.money(AtlasCaixa.saldo(w.id)) + "</b>. O capital sai daqui.";
    }

    function sugerirPreco() {
      var sim = txt("#rToken").toUpperCase();
      var dica = U.qs("#rPrecoDica"), campo = U.qs("#rPreco");
      if (!sim || !dica || !campo) return;
      if (!window.AtlasPrecos) { dica.textContent = "Informe o preço de entrada."; return; }
      dica.textContent = "Buscando o preço de " + sim + "…";
      AtlasPrecos.de(sim).then(function (r) {
        if (r && r.usd != null) {
          if (!campo.value) campo.value = r.usd;
          dica.innerHTML = "Preço de mercado: <b>" + U.money(r.usd) + "</b> · " +
            esc(AtlasPrecos.fonteLabel(r.fonte)) + ". Corrija se você entrou noutra data.";
        } else {
          dica.innerHTML = "<b>Nenhuma fonte reconheceu " + esc(sim) + ".</b> Informe o preço na mão.";
        }
      }).catch(function () { dica.textContent = "Sem conexão — informe o preço na mão."; });
    }

    function salvarNovo() {
      var token = txt("#rToken").toUpperCase();
      var qtd = num("#rQtd"), preco = num("#rPreco");
      if (!token) return U.toast("Informe o token.", "warn");
      if (!qtd) return U.toast("Informe a quantidade.", "warn");
      if (!preco) return U.toast("Informe o preço de entrada.", "warn");

      var capital = qtd * preco;
      /* Mesma regra das pools: sem caixa não abre, e a mensagem diz
         quanto falta. */
      if (window.AtlasCaixa) {
        var w = S.activeWallet();
        var c = AtlasCaixa.podeGastar(w.id, capital);
        if (!c.ok) {
          return U.toast("Caixa insuficiente em " + w.name + ": há " + U.money(c.saldo) +
                         " e a posição pede " + U.money(capital) + ".", "warn");
        }
      }

      var dados = {
        token: token, amount: qtd, precoEntrada: preco,
        protocol: txt("#rProto"), chain: txt("#rChain"),
        openedAt: txt("#rData") || U.hoje()
      };
      dados[V.campoTaxa] = num("#rTaxa");

      var it = S.addRendimento(tipo, dados);
      if (!it) return U.toast("Não consegui abrir a posição — confira os campos.", "warn");
      U.closeModal("#modalRend");
      U.toast(V.titulo + " de " + token + " aberto — " + U.money(capital) + " saíram do caixa.", "ok");
      repintar();
    }

    function abrirRendimento(id) {
      var it = S.rendimento(tipo, id);
      if (!it) return;
      modal("Registrar " + V.rendimentoSing + " · " + it.token,
        '<div class="col-2" style="gap:0 16px">' +
          '<div class="field"><label>Valor (US$)</label>' +
            '<input class="input" id="rwVal" type="number" step="any" min="0" placeholder="0,00" /></div>' +
          '<div class="field"><label>Data</label>' +
            '<input class="input" id="rwData" type="date" value="' + U.hoje() + '" /></div>' +
        '</div>' +
        '<div class="field"><label>Situação</label>' +
          '<select class="select" id="rwStatus">' +
            '<option value="pendente">Ainda na posição (pendente)</option>' +
            '<option value="coletada">Já recebido no caixa</option>' +
          '</select>' +
          '<div class="hint">Pendente fica dentro da posição e volta ao caixa quando você ' +
          'sacar ou encerrar. Recebido entra no caixa agora.</div></div>',
        function () {
          var v = num("#rwVal");
          if (!v) return U.toast("Informe o valor.", "warn");
          S.addRendimentoReward(tipo, id, {
            amount: v, date: txt("#rwData") || U.hoje(), status: txt("#rwStatus")
          });
          U.closeModal("#modalRend");
          U.toast(V.rendimento + " de " + U.money(v) + " registrado.", "ok");
          repintar();
        }, "Registrar");
    }

    /* ---------------- cotação e repintura ---------------- */
    function repintar() { pintarKpis(); pintarLista(); }

    function cotar() {
      if (!window.DeFiTokens) return;
      var simbolos = S.rendimentos(tipo).map(function (it) { return it.token; }).filter(Boolean);
      if (!simbolos.length) return;
      DeFiTokens.precosDetalhado(simbolos).then(function (d) {
        S.setPrecos(d.valores, d.fonte);
        repintar();
      }).catch(function () { /* sem preço: os cards já avisam */ });
    }

    var btnNovo = U.qs(hosts.btnNovo);
    if (btnNovo) btnNovo.addEventListener("click", abrirNovo);

    repintar();
    cotar();
  }

  window.DeFiRendimentos = { montar: montar };
})();
