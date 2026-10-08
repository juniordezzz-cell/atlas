/* ============================================================
   HOLD SYSTEM · js/forms.js
   Fluxos de criação/edição via modal. Todos chamam Store.actions.*
   (a UI nunca muta estado direto).
   ============================================================ */
(function () {
  "use strict";
  var U = window.UI, S = window.Store;

  function afterChange() { if (window.Router) window.Router.rerender(); }

  /* ---------- Novo ativo ---------- */
  function newAsset() {
    /* modo demonstração: limpar antes de cadastrar dado real (core/atlas-demo.js) */
    if (window.AtlasDemo && AtlasDemo.bloquear(function () { newAsset(); })) return;
    var nome = U.input({ placeholder: "Ex.: Bitcoin" });
    var ticker = U.input({ placeholder: "BTC", style: "text-transform:uppercase" });
    var tipo = U.select([
      { value: "Cripto", label: "Cripto" }, { value: "Ação", label: "Ação" },
      { value: "ETF", label: "ETF" }, { value: "Commodity", label: "Commodity" }, { value: "Outro", label: "Outro" }
    ], "Cripto");
    var preco = U.input({ type: "number", step: "any", placeholder: "0.00" });
    var mcap = U.input({ type: "number", step: "any", placeholder: "0" });
    var setor = U.input({ placeholder: "Ex.: Reserva de Valor" });
    var categoria = U.input({ placeholder: "Ex.: Layer 1" });

    /* ------------------------------------------------------------
       O "STATUS INICIAL" SAIU DO FORMULÁRIO

       Havia aqui uma lista com "Watchlist (candidato)" e "Investido".
       Escolher "Investido" cadastrava um ativo marcado como possuído
       sem nenhuma compra: sem posição, sem um dólar saindo do caixa. A
       partir daí o filtro "Investidos" listava o que não se tem, o
       funil das Métricas contava investimento inexistente.

       Status virou consequência (Store.get.statusDe): tem posição, é
       investido. Todo ativo nasce em watchlist, que é o que ele é —
       cadastrado e não comprado. Para investir, use Comprar.
       ------------------------------------------------------------ */
    /* Market cap, setor e categoria são acessórios: ficam recolhidos
       para o cadastro caber em quatro campos. */
    var extras = U.el("details", { class: "form-extras" }, [
      U.el("summary", { text: "Mais detalhes (opcional)" }),
      U.el("div", { class: "form-row" }, [U.field("Market cap (USD)", mcap), U.el("div")]),
      U.el("div", { class: "form-row" }, [U.field("Setor", setor), U.field("Categoria", categoria)])
    ]);
    var body = U.el("div", {}, [
      U.field("Nome", nome, { required: true }),
      U.el("div", { class: "form-row" }, [U.field("Ticker", ticker, { required: true }), U.field("Tipo", tipo)]),
      U.field("Preço atual (USD)", preco, { hint: "Preenchido sozinho quando você escolhe a moeda na lista." }),
      extras,
      U.el("div", { class: "small dim", style: "margin-top:4px",
        text: "Em \"Adicionar e comprar\" você informa em seguida a quantidade, o preço que pagou, a taxa, a data e a carteira." })
    ]);

    /* moeda escolhida no autocompletar: o id dela só vale enquanto o
       ticker continuar sendo o daquela moeda */
    var escolhido = null;
    /* ------------------------------------------------------------
       CADASTRAR JÁ LEVA À COMPRA

       O formulário cadastrava o ativo e parava: não havia onde pôr a
       quantidade. Quem chega aqui quase sempre JÁ comprou — então o
       botão principal cadastra e abre na hora o registro da compra
       (quantidade, preço pago, taxa, data, carteira). "Só watchlist"
       continua para quem está só acompanhando.
       ------------------------------------------------------------ */
    function salvar(comprar) {
      if (!nome.value.trim() || !ticker.value.trim()) return U.toast("Campos obrigatórios", "Nome e ticker são necessários.", "warning");
      var a = S.actions.createAsset({
        nome: nome.value.trim(), ticker: ticker.value.trim(), tipo: tipo.value,
        preco_atual: preco.value, market_cap: mcap.value, setor: setor.value.trim(),
        categoria: categoria.value.trim(),
        cg_id: (escolhido && tipo.value === "Cripto" &&
                escolhido.symbol === ticker.value.trim().toUpperCase()) ? escolhido.id : null
      });
      /* createAsset passou a RECUSAR ticker repetido. Sem este ramo, o
         botão não faria nada e a pessoa não saberia por quê — e a linha
         abaixo quebraria em a.ticker de um objeto de erro. */
      if (a && a.error) {
        /* já existe: em vez de travar, leva à compra do existente */
        if (comprar && a.asset) {
          U.closeModal(); afterChange();
          U.toast("Ativo já cadastrado", a.asset.ticker + " já existia — registrando a compra nele.", "success");
          return trade(a.asset.id, "buy");
        }
        return U.toast("Ticker já cadastrado", a.error, "warning");
      }
      U.closeModal(); afterChange();
      if (comprar) return trade(a.id, "buy");
      U.toast("Ativo adicionado", a.ticker + " entrou na watchlist.", "success");
    }
    var save = U.button("Adicionar e comprar", { variant: "primary", icon: "plus", onClick: function () { salvar(true); } });
    var soWatch = U.button("Só watchlist", { variant: "secondary", icon: "eye", onClick: function () { salvar(false); } });

    U.modal({ eyebrow: "Novo registro", title: "Adicionar ativo", body: body,
      footer: [U.button("Cancelar", { variant: "ghost", onClick: U.closeModal }), U.el("div", { class: "spacer" }), soWatch, save] });

    // Autocomplete de ativos — preenche Nome + Ticker juntos
    if (window.AtlasAssets) {
      var fillBoth = function (coin) {
        nome.value = coin.name;
        ticker.value = coin.symbol;
        escolhido = coin.id ? { id: coin.id, symbol: String(coin.symbol || "").toUpperCase() } : null;

        /* ------------------------------------------------------------
           O PREÇO VEM PELA CADEIA, NÃO DIRETO DO PROVEDOR

           Chamava AtlasAssets.priceFull(), que fala com a CoinGecko e
           mais ninguém. Consequências: um preço que o usuário já tinha
           informado à mão era ignorado, e um ativo que a CoinGecko não
           lista voltava vazio sem explicação — mesmo quando existe uma
           pool com liquidez cotando ele.

           AtlasPrecos aplica a ordem do sistema: manual do usuário →
           id curado → busca → DEX. O market cap continua vindo do
           provedor, porque só ele tem esse número.
           ------------------------------------------------------------ */
        var pedir = window.AtlasPrecos
          ? AtlasPrecos.de(coin.symbol)
          : (AtlasAssets.priceFull ? AtlasAssets.priceFull(coin.id) : Promise.resolve(null));

        pedir.then(function (r) {
          if (r && r.usd != null && !preco.value) preco.value = r.usd;
          if (!r) {
            U.toast("Sem preço para " + coin.symbol,
                    "Nenhuma fonte reconheceu este ativo. Informe o preço na mão — " +
                    "ele passa a valer até você mandar atualizar.", "warning");
          }
        }).catch(function (err) {
          U.toast("Preço indisponível", (err && err.message) || "Não foi possível buscar o preço agora. Preencha manualmente.", "warning");
        });

        if (coin.id && mcap && !mcap.value && AtlasAssets.priceFull) {
          AtlasAssets.priceFull(coin.id).then(function (info) {
            if (info && info.marketCap != null && !mcap.value) mcap.value = info.marketCap;
          }).catch(function () { /* market cap é acessório */ });
        }
      };
      AtlasAssets.attach(nome, { value: "name", onSelect: fillBoth });
      AtlasAssets.attach(ticker, { value: "symbol", onSelect: fillBoth });
    }
  }

  /* ============================================================
     EDITAR ATIVO — a tela que o próprio sistema mandava abrir

     O Hold não tinha edição. Depois de cadastrado, um ativo ficava
     congelado: setor errado continuava errado, e — o que importa de
     verdade — o preço de um ativo que nenhuma API reconhece ficava
     preso ao que foi digitado no cadastro, para sempre. O aviso de
     "Atualizar preços" dizia "informe o preço na mão em Editar",
     apontando para um lugar que não existia.

     A regra do ATLAS é a mesma nos quatro módulos: a API é o caminho
     principal e, quando nenhuma fonte reconhece o ativo, quem informa
     o preço é o dono do dado. O valor daqui vai para o registro manual
     central (core/atlas-precos.js) — é ele que vence a API na cadeia,
     envelhece em sete dias e avisa quando está velho. Gravar só no
     ativo faria o próximo "Atualizar preços" apagá-lo em silêncio.

     Ticker não se edita: ele é a identidade do ativo (um ticker, um
     ativo) e o que amarra preço, posições e histórico.
     ============================================================ */
  function editAsset(assetId) {
    var a = S.get.asset(assetId); if (!a) return;

    var nome = U.input({ value: a.nome || "" });
    var tipo = U.select([
      { value: "Cripto", label: "Cripto" }, { value: "Ação", label: "Ação" },
      { value: "ETF", label: "ETF" }, { value: "Commodity", label: "Commodity" }, { value: "Outro", label: "Outro" }
    ], a.tipo || "Cripto");
    var setor = U.input({ value: a.setor || "" });
    var categoria = U.input({ value: a.categoria || "" });
    var mcap = U.input({ type: "number", step: "any", value: a.market_cap || "" });
    var preco = U.input({ type: "number", step: "any", value: a.preco_atual || "" });

    var m = (window.AtlasPrecos && a.ticker) ? AtlasPrecos.manual(a.ticker) : null;
    var dicaPreco = m
      ? ("Preço informado por você" + (m.vencido ? " há " + m.dias + " dias — vale reconferir." : ".") +
         " Ele vence a API até você limpar o campo.")
      : "Informe só se nenhuma fonte reconhecer " + (a.ticker || "o ativo") +
        ". O valor passa a valer sobre a API, e o campo vazio devolve a busca automática.";

    var body = U.el("div", {}, [
      U.el("div", { class: "small dim", style: "margin-bottom:12px",
        text: "Ticker " + a.ticker + " — a identidade do ativo não muda. Para outro ativo, cadastre outro." }),
      U.field("Nome", nome, { required: true }),
      U.el("div", { class: "form-row" }, [U.field("Tipo", tipo), U.field("Market cap (USD)", mcap)]),
      U.el("div", { class: "form-row" }, [U.field("Setor", setor), U.field("Categoria", categoria)]),
      U.field("Preço (USD)", preco, { hint: dicaPreco })
    ]);

    var save = U.button("Salvar", { variant: "primary", icon: "check", onClick: function () {
      if (!nome.value.trim()) return U.toast("Campo obrigatório", "O nome não pode ficar vazio.", "warning");

      S.actions.updateAsset(assetId, {
        nome: nome.value.trim(), tipo: tipo.value,
        setor: setor.value.trim(), categoria: categoria.value.trim(),
        market_cap: parseFloat(mcap.value) || 0
      });

      var txt = String(preco.value).trim();
      if (txt === "") {
        /* Campo esvaziado = devolver o ativo à busca automática. */
        if (window.AtlasPrecos && a.ticker) AtlasPrecos.limparManual(a.ticker);
      } else {
        var v = parseFloat(txt);
        if (!(v > 0)) return U.toast("Preço inválido", "O preço precisa ser maior que zero.", "warning");
        if (v !== a.preco_atual || !m) {
          var r = S.actions.precoManual(assetId, v);
          if (r && r.error) return U.toast("Preço não salvo", r.error, "warning");
        }
      }
      U.closeModal();
      U.toast("Ativo atualizado", a.ticker + " salvo.", "success");
      afterChange();
    }});

    U.modal({ eyebrow: "Editar · " + a.ticker, title: "Editar ativo", body: body,
      footer: [U.button("Cancelar", { variant: "ghost", onClick: U.closeModal }), U.el("div", { class: "spacer" }), save] });
  }

  /* ---------- Trade (compra/venda) ---------- */
  function trade(assetId, side) {
    /* modo demonstração: limpar antes de cadastrar dado real (core/atlas-demo.js) */
    if (side !== "sell" && window.AtlasDemo && AtlasDemo.bloquear(function () { trade(assetId, side); })) return;
    var a = S.get.asset(assetId); if (!a) return;
    var isSell = side === "sell";
    var carteiras = (S.wallets && S.wallets.list) ? S.wallets.list() : [{ id: "principal", name: "Principal" }];
    /* A carteira oferecida é sempre uma carteira de verdade. Com a tela
       em "Todas as carteiras", vale a ativa; para vender, a primeira
       que tem a posição (começando pela ativa). */
    var carteiraAtiva = (S.wallets && S.wallets.real) ? S.wallets.real()
      : (S.wallets && S.wallets.active) ? S.wallets.active() : null;
    var idPadrao = (carteiraAtiva && carteiraAtiva.id) || (carteiras[0] && carteiras[0].id);
    if (isSell && !S.get.positionOf(assetId, idPadrao)) {
      var comPos = carteiras.filter(function (w) { return S.get.positionOf(assetId, w.id); })[0];
      if (comPos) idPadrao = comPos.id;
    }
    var walletSel = U.select(carteiras.map(function (w) {
      var p = S.get.positionOf(assetId, w.id);
      return { value: w.id, label: w.name + (p ? " · " + U.qty(p.quantidade) + " " + a.ticker : "") };
    }), idPadrao);

    if (isSell && !S.get.positionOf(assetId, walletSel.value)) {
      return U.toast("Sem posição", "Não há posição de " + a.ticker + " para vender nesta carteira.", "warning");
    }

    var seg = U.el("div", { class: "segmented" });
    var buyBtn = U.el("button", { class: side === "buy" ? "on" : "", text: "Comprar" });
    var sellBtn = U.el("button", { class: side === "sell" ? "on" : "", text: "Vender" });
    seg.appendChild(buyBtn); seg.appendChild(sellBtn);

    var qtdI = U.input({ type: "number", step: "any", min: "0", placeholder: "0,00" });
    var precoI = U.input({ type: "number", step: "any", min: "0", value: a.preco_atual > 0 ? a.preco_atual : "" });
    /* ------------------------------------------------------------
       VALOR TOTAL, DATA E "MÁX"

       · Total: quem compra pensa "coloquei US$ 500 em BTC", não em
         0,00833 BTC. Os dois campos se calculam um pelo outro.
       · Data: toda operação era gravada com a data de HOJE. Para
         registrar uma carteira de hold — comprada ao longo de meses —
         o extrato, o histórico e a rentabilidade ficavam todos no dia
         do cadastro.
       · Máx: vender tudo exigia redigitar a quantidade exata da
         posição, com todas as casas decimais.
       ------------------------------------------------------------ */
    var totalI = U.input({ type: "number", step: "any", min: "0", placeholder: "0,00" });
    /* Taxa da corretora ou da rede, em dólar. Na compra entra no custo
       (e no preço médio); na venda sai do que volta ao caixa. */
    var taxaI = U.input({ type: "number", step: "any", min: "0", placeholder: "0,00" });
    var hojeIso = (function () {
      var d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    })();
    var dataI = U.input({ type: "date", value: hojeIso, max: hojeIso });
    var dicaData = U.el("div", { class: "hint" });
    var maxBtn = U.el("button", { type: "button", class: "btn ghost sm", text: "Máx", title: "Vender a posição inteira" });
    var just = U.textarea({ placeholder: "Justificativa (registrada no histórico)", style: "min-height:64px" });
    var posInfo = U.el("div", { class: "small dim" });
    var previa = U.el("div", { class: "trade-previa" });

    /* ------------------------------------------------------------
       O CAIXA DISPONÍVEL, NA TELA ONDE ELE É GASTO

       O Hold passou a exigir caixa para comprar e não mostrava o saldo
       em lugar nenhum: a pessoa preenchia quantidade e preço para só
       então descobrir que não tinha dinheiro. O número que decide a
       operação tem de estar visível antes dela.
       ------------------------------------------------------------ */
    var infoCaixa = U.el("div", { class: "small dim", style: "margin-bottom:10px" });

    var body = U.el("div", {}, [
      U.el("div", { class: "between", style: "margin-bottom:16px" }, [U.assetCellSafe(a), seg]),
      U.field("Carteira da posição", walletSel, { required: true, hint: "Compra e venda desta posição caem nesta carteira." }),
      infoCaixa,
      posInfo,
      U.el("div", { class: "form-row" }, [
        U.field("Quantidade", U.el("div", { class: "input-acao" }, [qtdI, maxBtn]), { required: true }),
        U.field("Preço unitário (USD)", precoI, { required: true })
      ]),
      U.el("div", { class: "form-row" }, [
        U.field("Valor total (USD)", totalI, { hint: "Quantidade × preço. Preencha este para comprar por valor." }),
        (function () { var f = U.field("Data da operação", dataI, { required: true }); f.appendChild(dicaData); return f; })()
      ]),
      U.field("Taxa (USD)", taxaI, { hint: "Da corretora ou da rede. Deixe vazio se não houve." }),
      previa,
      U.field("Justificativa", just)
    ]);

    var currentSide = side;
    function carteiraSelecionada() {
      var wid = walletSel.value;
      var lista = (S.wallets && S.wallets.list) ? S.wallets.list() : [];
      for (var i = 0; i < lista.length; i++) if (lista[i].id === wid) return lista[i];
      return null;
    }
    function atualizarResumoCarteira() {
      var w = carteiraSelecionada();
      var caixa = (window.AtlasCaixa && w) ? AtlasCaixa.saldo(w.id) : null;
      var p = S.get.positionOf(assetId, w ? w.id : null);
      if (currentSide !== "sell" && caixa != null && w) {
        var custo = (parseFloat(qtdI.value) || 0) * (parseFloat(precoI.value) || 0) +
                    Math.max(0, parseFloat(taxaI.value) || 0);
        var falta = AtlasCaixa.faltaPara ? AtlasCaixa.faltaPara(w.id, custo) : 0;
        infoCaixa.textContent = "Caixa em " + w.name + ": " + U.money(caixa) +
          " — é daqui que sai o valor da compra." +
          (falta > 0 ? " Faltam " + U.money(falta) + ", que entram como depósito automático nesta carteira." : "");
        infoCaixa.style.display = "";
      } else {
        infoCaixa.textContent = "";
        infoCaixa.style.display = "none";
      }
      if (p) {
        posInfo.textContent = "Posição atual: " + U.qty(p.quantidade) + " " + a.ticker + " · PM " + U.money(p.preco_medio);
        posInfo.style.display = "";
      } else {
        posInfo.textContent = "Sem posição de " + a.ticker + " nesta carteira.";
        posInfo.style.display = currentSide === "sell" ? "" : "none";
      }
      maxBtn.style.display = currentSide === "sell" && p ? "" : "none";
      desenharPrevia(p);
    }

    /* O que a operação vai fazer, antes de ela acontecer: na compra, o
       novo preço médio; na venda, o lucro ou prejuízo sobre o preço
       médio. A pessoa confere o número que vai ficar gravado. */
    function desenharPrevia(p) {
      var q = parseFloat(qtdI.value) || 0, pr = parseFloat(precoI.value) || 0;
      var tx = Math.max(0, parseFloat(taxaI.value) || 0);
      previa.textContent = "";
      if (!(q > 0 && pr > 0)) { previa.style.display = "none"; return; }
      var linhas = [];
      if (currentSide === "sell") {
        if (!p) { previa.style.display = "none"; return; }
        var res = q * (pr - p.preco_medio) - tx;
        var custoV = q * p.preco_medio;
        var pctR = custoV > 0 ? (res / custoV) * 100 : 0;
        linhas.push(["Volta para o caixa", U.money(q * pr - tx) + (tx > 0 ? " (já sem a taxa)" : ""), ""]);
        linhas.push([res >= 0 ? "Lucro realizado" : "Prejuízo realizado", U.money(res) + " (" + U.pct(pctR, 1) + ")", U.signClass(res)]);
        var resta = Math.round((p.quantidade - q) * 1e10) / 1e10;
        linhas.push(["Fica na posição", resta > 0 ? U.qty(resta) + " " + a.ticker : "posição encerrada", ""]);
      } else {
        var novoQ = (p ? p.quantidade : 0) + q;
        var novoPM = ((p ? p.quantidade * p.preco_medio : 0) + q * pr + tx) / novoQ;
        linhas.push(["Sai do caixa", U.money(q * pr + tx) + (tx > 0 ? " (com a taxa)" : ""), ""]);
        linhas.push(["Posição depois", U.qty(novoQ) + " " + a.ticker, ""]);
        linhas.push([p ? "Novo preço médio" : "Preço médio", U.money(novoPM) +
          (p ? " (era " + U.money(p.preco_medio) + ")" : ""), ""]);
      }
      linhas.forEach(function (l) {
        previa.appendChild(U.el("div", { class: "tp-linha" }, [
          U.el("span", { class: "tp-k", text: l[0] }),
          U.el("span", { class: "tp-v num " + l[2], text: l[1] })
        ]));
      });
      previa.style.display = "";
    }

    function setSide(sd) {
      currentSide = sd;
      buyBtn.classList.toggle("on", sd === "buy");
      sellBtn.classList.toggle("on", sd === "sell");
      confirmBtn.className = "btn " + (sd === "sell" ? "danger" : "primary");
      confirmBtn.lastChild.textContent = sd === "sell" ? "Registrar venda" : "Registrar compra";
      atualizarResumoCarteira();
    }
    buyBtn.addEventListener("click", function () { setSide("buy"); });
    sellBtn.addEventListener("click", function () {
      if (!S.get.positionOf(assetId, walletSel.value)) {
        return U.toast("Sem posição", "Não há o que vender nesta carteira.", "warning");
      }
      setSide("sell");
    });

    /* Quantidade, preço e total: quem foi editado por último manda.
       Mudar o preço com o total preenchido por último recalcula a
       quantidade (comprar por valor); senão, recalcula o total. */
    var ultimoEditado = "qtd";
    function arred(n, casas) { var f = Math.pow(10, casas); return Math.round(n * f) / f; }
    function sincronizar(origem) {
      var q = parseFloat(qtdI.value), pr = parseFloat(precoI.value), t = parseFloat(totalI.value);
      if (origem === "total" || (origem === "preco" && ultimoEditado === "total")) {
        if (pr > 0 && t > 0) qtdI.value = arred(t / pr, 10);
      } else if (pr > 0 && q > 0) {
        totalI.value = arred(q * pr, 2);
      }
      if (origem !== "preco") ultimoEditado = origem;
      atualizarResumoCarteira();
    }
    walletSel.addEventListener("change", atualizarResumoCarteira);
    qtdI.addEventListener("input", function () { sincronizar("qtd"); });
    precoI.addEventListener("input", function () { sincronizar("preco"); });
    totalI.addEventListener("input", function () { sincronizar("total"); });
    taxaI.addEventListener("input", atualizarResumoCarteira);
    maxBtn.addEventListener("click", function () {
      var p = S.get.positionOf(assetId, walletSel.value);
      if (!p) return;
      qtdI.value = p.quantidade;
      sincronizar("qtd");
    });

    /* Data passada: oferece o fechamento daquele dia, sem sobrescrever
       um preço que a pessoa digitou. O histórico é o fechamento em UTC,
       não o instante da operação — a dica diz isso. */
    var precoDigitado = false;
    precoI.addEventListener("input", function () { precoDigitado = true; });
    dataI.addEventListener("change", function () {
      dicaData.textContent = "";
      var d = dataI.value;
      if (!d) return;
      if (d > hojeIso) { dataI.value = hojeIso; dicaData.textContent = "Data no futuro não vale — voltou para hoje."; return; }
      if (d === hojeIso || !window.AtlasPrecos || !AtlasPrecos.emData || (a.tipo && a.tipo !== "Cripto")) return;
      dicaData.textContent = "Buscando o preço de " + d.split("-").reverse().join("/") + "…";
      AtlasPrecos.emData(a.ticker, d).then(function (r) {
        if (dataI.value !== d) return;
        if (!r || !(r.usd > 0)) { dicaData.textContent = "Sem preço histórico para esse dia — informe o preço que você pagou."; return; }
        r.usd = r.usd >= 1 ? Math.round(r.usd * 100) / 100 : Number(r.usd.toPrecision(6));
        dicaData.textContent = "Fechamento do dia: " + U.money(r.usd) + " (aproximado). ";
        var usar = U.el("button", { type: "button", class: "link-btn", text: "Usar este preço" });
        usar.addEventListener("click", function () { precoI.value = r.usd; precoDigitado = true; sincronizar("preco"); });
        dicaData.appendChild(usar);
        if (!precoDigitado) { precoI.value = r.usd; sincronizar("preco"); }
      }).catch(function () {
        if (dataI.value === d) dicaData.textContent = "Não consegui buscar o preço desse dia — informe o que você pagou.";
      });
    });

    var confirmBtn = U.button(isSell ? "Registrar venda" : "Registrar compra", {
      variant: isSell ? "danger" : "primary", icon: "check", onClick: function () {
        var payload = {
          ativo_id: assetId, quantidade: qtdI.value, preco: precoI.value,
          justificativa: just.value.trim(), walletId: walletSel.value,
          data: dataI.value || hojeIso,
          taxa: taxaI.value
        };
        var res;
        if (currentSide === "sell") res = S.actions.executeSell(payload);
        else { payload.cobrirFalta = true; res = S.actions.executeBuy(payload); }
        if (res && res.error) return U.toast("Não foi possível", res.error, "warning");
        U.closeModal();
        U.toast(currentSide === "sell" ? "Venda registrada" : "Compra registrada",
          a.ticker + " atualizado." +
          (res && res.venda ? " " + (res.venda.resultado >= 0 ? "Lucro" : "Prejuízo") + " realizado: " + U.money(res.venda.resultado) + "." : "") +
          (res && res.depositoAuto > 0 ? " Depósito de " + U.money(res.depositoAuto) + " registrado automaticamente." : "") +
          " Errou? Use \"Desfazer última operação\" no ativo.",
          "success");
        afterChange();
      }
    });

    U.modal({ eyebrow: "Executar decisão", title: "Operar " + a.ticker, body: body,
      footer: [U.button("Cancelar", { variant: "ghost", onClick: U.closeModal }), U.el("div", { class: "spacer" }), confirmBtn] });
    atualizarResumoCarteira();
  }

  // helper pra assetCell dentro de modal sem quebrar se UI ainda não tiver
  U.assetCellSafe = function (a) { return U.assetCell(a); };

  window.Forms = {
    newAsset: newAsset, editAsset: editAsset,
    trade: trade
  };
})();
