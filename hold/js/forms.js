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
    var body = U.el("div", {}, [
      U.field("Nome", nome, { required: true }),
      U.el("div", { class: "form-row" }, [U.field("Ticker", ticker, { required: true }), U.field("Tipo", tipo)]),
      U.el("div", { class: "form-row" }, [
        U.field("Preço atual (USD)", preco, { hint: "Opcional — \"Atualizar preços\" busca sozinho pelo ticker." }),
        U.field("Market cap (USD)", mcap)
      ]),
      U.el("div", { class: "form-row" }, [U.field("Setor", setor), U.field("Categoria", categoria)])
    ]);

    var save = U.button("Adicionar ativo", { variant: "primary", icon: "plus", onClick: function () {
      if (!nome.value.trim() || !ticker.value.trim()) return U.toast("Campos obrigatórios", "Nome e ticker são necessários.", "warning");
      var a = S.actions.createAsset({
        nome: nome.value.trim(), ticker: ticker.value.trim(), tipo: tipo.value,
        preco_atual: preco.value, market_cap: mcap.value, setor: setor.value.trim(),
        categoria: categoria.value.trim()
      });
      /* createAsset passou a RECUSAR ticker repetido. Sem este ramo, o
         botão não faria nada e a pessoa não saberia por quê — e a linha
         abaixo quebraria em a.ticker de um objeto de erro. */
      if (a && a.error) return U.toast("Ticker já cadastrado", a.error, "warning");
      U.closeModal(); U.toast("Ativo adicionado", a.ticker + " entrou no sistema.", "success"); afterChange();
    }});

    U.modal({ eyebrow: "Novo registro", title: "Adicionar ativo", body: body,
      footer: [U.button("Cancelar", { variant: "ghost", onClick: U.closeModal }), U.el("div", { class: "spacer" }), save] });

    // Autocomplete de ativos — preenche Nome + Ticker juntos
    if (window.AtlasAssets) {
      var fillBoth = function (coin) {
        nome.value = coin.name;
        ticker.value = coin.symbol;

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
    var carteiraAtiva = (S.wallets && S.wallets.active) ? S.wallets.active() : null;
    var walletSel = U.select(carteiras.map(function (w) {
      return { value: w.id, label: w.name };
    }), (carteiraAtiva && carteiraAtiva.id) || (carteiras[0] && carteiras[0].id));

    if (isSell && !S.get.positionOf(assetId, walletSel.value)) {
      return U.toast("Sem posição", "Não há posição de " + a.ticker + " para vender nesta carteira.", "warning");
    }

    var seg = U.el("div", { class: "segmented" });
    var buyBtn = U.el("button", { class: side === "buy" ? "on" : "", text: "Comprar" });
    var sellBtn = U.el("button", { class: side === "sell" ? "on" : "", text: "Vender" });
    seg.appendChild(buyBtn); seg.appendChild(sellBtn);

    var qtdI = U.input({ type: "number", step: "any", placeholder: "0.00" });
    var precoI = U.input({ type: "number", step: "any", value: a.preco_atual });
    var just = U.textarea({ placeholder: "Justificativa (registrada no histórico)", style: "min-height:64px" });
    var posInfo = U.el("div", { class: "small dim" });

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
        U.field("Quantidade", qtdI, { required: true }),
        U.field("Preço (USD)", precoI, { required: true })
      ]),
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
        var custo = (parseFloat(qtdI.value) || 0) * (parseFloat(precoI.value) || 0);
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
    walletSel.addEventListener("change", atualizarResumoCarteira);
    qtdI.addEventListener("input", atualizarResumoCarteira);
    precoI.addEventListener("input", atualizarResumoCarteira);

    var confirmBtn = U.button(isSell ? "Registrar venda" : "Registrar compra", {
      variant: isSell ? "danger" : "primary", icon: "check", onClick: function () {
        var payload = {
          ativo_id: assetId, quantidade: qtdI.value, preco: precoI.value,
          justificativa: just.value.trim(), walletId: walletSel.value
        };
        var res;
        if (currentSide === "sell") res = S.actions.executeSell(payload);
        else { payload.cobrirFalta = true; res = S.actions.executeBuy(payload); }
        if (res && res.error) return U.toast("Não foi possível", res.error, "warning");
        U.closeModal();
        U.toast(currentSide === "sell" ? "Venda registrada" : "Compra registrada",
          a.ticker + " atualizado." +
          (res && res.depositoAuto > 0 ? " Depósito de " + U.money(res.depositoAuto) + " registrado automaticamente." : ""),
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
