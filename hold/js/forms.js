/* ============================================================
   HOLD SYSTEM · js/forms.js
   Fluxos de criação/edição via modal. Todos chamam Store.actions.*
   (a UI nunca muta estado direto).
   ============================================================ */
(function () {
  "use strict";
  var U = window.UI, S = window.Store;

  function assetOptions(filter) {
    return S.state.ativos
      .filter(filter || function () { return true; })
      .map(function (a) { return { value: a.id, label: a.ticker + " · " + a.nome }; });
  }

  function afterChange() { if (window.Router) window.Router.rerender(); }

  /* ---------- Novo ativo ---------- */
  function newAsset() {
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
    var status = U.select([
      { value: "watchlist", label: "Watchlist (candidato)" },
      { value: "invested", label: "Investido" }
    ], "watchlist");

    var body = U.el("div", {}, [
      U.field("Nome", nome, { required: true }),
      U.el("div", { class: "form-row" }, [U.field("Ticker", ticker, { required: true }), U.field("Tipo", tipo)]),
      U.el("div", { class: "form-row" }, [U.field("Preço atual (USD)", preco), U.field("Market cap (USD)", mcap)]),
      U.el("div", { class: "form-row" }, [U.field("Setor", setor), U.field("Categoria", categoria)]),
      U.field("Status inicial", status, { hint: "Nenhum ativo é investido sem tese — para investir, crie a tese em seguida." })
    ]);

    var save = U.button("Adicionar ativo", { variant: "primary", icon: "plus", onClick: function () {
      if (!nome.value.trim() || !ticker.value.trim()) return U.toast("Campos obrigatórios", "Nome e ticker são necessários.", "warning");
      var a = S.actions.createAsset({
        nome: nome.value.trim(), ticker: ticker.value.trim(), tipo: tipo.value,
        preco_atual: preco.value, market_cap: mcap.value, setor: setor.value.trim(),
        categoria: categoria.value.trim(), status: status.value
      });
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

  /* ---------- Nova tese ---------- */
  function newThesis(presetAssetId) {
    var candidates = assetOptions(function (a) { return !S.get.thesisOfAsset(a.id); });
    if (!candidates.length) return U.toast("Sem ativos disponíveis", "Todos os ativos já possuem tese. Adicione um ativo primeiro.", "warning");

    var ativo = U.select(candidates, presetAssetId || candidates[0].value);
    var narrativa = U.textarea({ placeholder: "Narrativa principal da tese — por que este ativo, por que agora, por quanto tempo." });
    var bull = U.textarea({ placeholder: "Cenário otimista", style: "min-height:64px" });
    var base = U.textarea({ placeholder: "Cenário base", style: "min-height:64px" });
    var bear = U.textarea({ placeholder: "Cenário pessimista", style: "min-height:64px" });
    var riscos = U.textarea({ placeholder: "Um por linha ou separados por vírgula", style: "min-height:64px" });
    var catalisadores = U.textarea({ placeholder: "Um por linha ou separados por vírgula", style: "min-height:64px" });
    var inval = U.textarea({ placeholder: "O que precisa acontecer para a tese ser considerada errada.", style: "min-height:64px" });
    var conv = U.input({ type: "range", min: "0", max: "10", value: "6", class: "input", style: "padding:0" });
    var convOut = U.el("span", { class: "num", text: "6", style: "min-width:20px;display:inline-block" });
    conv.addEventListener("input", function () { convOut.textContent = conv.value; });
    var statusSel = U.select([
      { value: "planejada", label: "Planejada (fila de pesquisa)" },
      { value: "andamento", label: "Em andamento" }
    ], "andamento");

    var body = U.el("div", {}, [
      U.field("Ativo", ativo, { required: true }),
      U.field("Narrativa principal", narrativa, { required: true }),
      U.el("div", { class: "eyebrow", text: "Cenários", style: "margin:4px 0 8px" }),
      U.el("div", { class: "form-row-3" }, [U.field("Bull", bull), U.field("Base", base), U.field("Bear", bear)]),
      U.el("div", { class: "form-row" }, [U.field("Riscos", riscos), U.field("Catalisadores", catalisadores)]),
      U.field("Critérios de invalidação", inval, { required: true }),
      U.el("div", { class: "form-row" }, [
        U.field("Status inicial", statusSel),
        U.field(U.el("span", {}, ["Convicção — ", convOut, " / 10"]), conv)
      ])
    ]);

    var save = U.button("Criar tese", { variant: "primary", icon: "check", onClick: function () {
      if (!narrativa.value.trim() || !inval.value.trim())
        return U.toast("Campos obrigatórios", "Narrativa e critérios de invalidação são necessários.", "warning");
      S.actions.createThesis({
        ativo_id: ativo.value, narrativa: narrativa.value.trim(),
        bull: bull.value.trim(), base: base.value.trim(), bear: bear.value.trim(),
        riscos: riscos.value, catalisadores: catalisadores.value,
        criterios_invalidacao: inval.value.trim(), conviccao: conv.value, status: statusSel.value
      });
      U.closeModal(); U.toast("Tese criada", "Convicção " + conv.value + "/10 registrada.", "success"); afterChange();
    }});

    U.modal({ wide: true, eyebrow: "Documentar decisão", title: "Nova tese de investimento", body: body,
      footer: [U.button("Cancelar", { variant: "ghost", onClick: U.closeModal }), U.el("div", { class: "spacer" }), save] });
  }

  /* ---------- Editar / revisar tese ---------- */
  function editThesis(thesisId) {
    var t = S.get.thesis(thesisId); if (!t) return;
    var a = S.get.asset(t.ativo_id);
    var narrativa = U.textarea({ style: "min-height:96px" }); narrativa.value = t.narrativa;
    var bull = U.textarea({ style: "min-height:64px" }); bull.value = t.cenarios.bull;
    var base = U.textarea({ style: "min-height:64px" }); base.value = t.cenarios.base;
    var bear = U.textarea({ style: "min-height:64px" }); bear.value = t.cenarios.bear;
    var riscos = U.textarea({ style: "min-height:64px" }); riscos.value = t.riscos.join("\n");
    var catalisadores = U.textarea({ style: "min-height:64px" }); catalisadores.value = t.catalisadores.join("\n");
    var inval = U.textarea({ style: "min-height:64px" }); inval.value = t.criterios_invalidacao;
    var status = U.select([
      { value: "planejada", label: "Planejada" },
      { value: "andamento", label: "Em andamento" },
      { value: "arquivada", label: "Arquivada" }
    ], t.status === "concluida" ? "andamento" : t.status);
    var conv = U.input({ type: "range", min: "0", max: "10", value: t.conviccao, style: "padding:0" });
    var convOut = U.el("span", { class: "num", text: t.conviccao, style: "min-width:20px;display:inline-block" });
    conv.addEventListener("input", function () { convOut.textContent = conv.value; });
    var motivo = U.input({ placeholder: "Motivo da revisão (registrado no histórico)" });

    var body = U.el("div", {}, [
      U.field("Narrativa principal", narrativa),
      U.el("div", { class: "form-row-3" }, [U.field("Bull", bull), U.field("Base", base), U.field("Bear", bear)]),
      U.el("div", { class: "form-row" }, [U.field("Riscos", riscos), U.field("Catalisadores", catalisadores)]),
      U.field("Critérios de invalidação", inval),
      U.el("div", { class: "form-row" }, [U.field("Status", status), U.field(U.el("span", {}, ["Convicção — ", convOut, " / 10"]), conv)]),
      U.field("Motivo da revisão", motivo, { hint: "Toda tese pode ser revisada — a mudança gera histórico." })
    ]);

    var save = U.button("Salvar revisão", { variant: "primary", icon: "check", onClick: function () {
      S.actions.updateThesis(thesisId, {
        narrativa: narrativa.value.trim(), bull: bull.value.trim(), base: base.value.trim(), bear: bear.value.trim(),
        riscos: riscos.value, catalisadores: catalisadores.value, criterios_invalidacao: inval.value.trim(),
        conviccao: conv.value, status: status.value, motivo: motivo.value.trim() || "Tese revisada."
      });
      U.closeModal(); U.toast("Tese atualizada", (a ? a.ticker : "Tese") + " revisada.", "success"); afterChange();
    }});

    U.modal({ wide: true, eyebrow: "Revisar tese · " + (a ? a.ticker : ""), title: "Editar tese", body: body,
      footer: [U.button("Cancelar", { variant: "ghost", onClick: U.closeModal }), U.el("div", { class: "spacer" }), save] });
  }

  /* ---------- Trade (compra/venda) ---------- */
  function trade(assetId, side) {
    var a = S.get.asset(assetId); if (!a) return;
    var pos = S.get.positionOf(assetId);
    var isSell = side === "sell";

    if (!isSell && !S.get.thesisOfAsset(assetId)) {
      return U.toast("Tese obrigatória", "Crie a tese antes de investir em " + a.ticker + ".", "warning");
    }
    if (isSell && !pos) return U.toast("Sem posição", "Não há posição de " + a.ticker + " para vender.", "warning");

    var seg = U.el("div", { class: "segmented" });
    var buyBtn = U.el("button", { class: side === "buy" ? "on" : "", text: "Comprar" });
    var sellBtn = U.el("button", { class: side === "sell" ? "on" : "", text: "Vender" });
    seg.appendChild(buyBtn); seg.appendChild(sellBtn);

    var qtdI = U.input({ type: "number", step: "any", placeholder: "0.00" });
    var precoI = U.input({ type: "number", step: "any", value: a.preco_atual });
    var just = U.textarea({ placeholder: "Justificativa (registrada no histórico)", style: "min-height:64px" });
    var motivo = U.select([
      { value: "realizacao", label: "Realização da tese (alvo atingido)" },
      { value: "invalidacao", label: "Invalidação da tese" }
    ], "realizacao");

    var motivoField = U.field("Motivo da venda", motivo, { hint: "Toda venda depende de invalidação ou realização da tese." });
    motivoField.classList.toggle("hidden", !isSell);

    var posInfo = pos ? U.el("div", { class: "small dim", text: "Posição atual: " + U.qty(pos.quantidade) + " " + a.ticker + " · PM " + U.money(pos.preco_medio) }) : null;

    var body = U.el("div", {}, [
      U.el("div", { class: "between", style: "margin-bottom:16px" }, [U.assetCellSafe(a), seg]),
      posInfo,
      U.el("div", { class: "form-row" }, [
        U.field("Quantidade", qtdI, { required: true }),
        U.field("Preço (USD)", precoI, { required: true })
      ]),
      motivoField,
      U.field("Justificativa", just)
    ]);

    var currentSide = side;
    function setSide(sd) {
      currentSide = sd;
      buyBtn.classList.toggle("on", sd === "buy");
      sellBtn.classList.toggle("on", sd === "sell");
      motivoField.classList.toggle("hidden", sd !== "sell");
      confirmBtn.className = "btn " + (sd === "sell" ? "danger" : "primary");
      confirmBtn.lastChild.textContent = sd === "sell" ? "Registrar venda" : "Registrar compra";
    }
    buyBtn.addEventListener("click", function () { setSide("buy"); });
    sellBtn.addEventListener("click", function () {
      if (!S.get.positionOf(assetId)) return U.toast("Sem posição", "Não há o que vender.", "warning");
      setSide("sell");
    });

    var confirmBtn = U.button(isSell ? "Registrar venda" : "Registrar compra", {
      variant: isSell ? "danger" : "primary", icon: "check", onClick: function () {
        var payload = { ativo_id: assetId, quantidade: qtdI.value, preco: precoI.value, justificativa: just.value.trim() };
        var res;
        if (currentSide === "sell") { payload.motivo = motivo.value; res = S.actions.executeSell(payload); }
        else res = S.actions.executeBuy(payload);
        if (res && res.error) return U.toast("Não foi possível", res.error, "warning");
        U.closeModal();
        U.toast(currentSide === "sell" ? "Venda registrada" : "Compra registrada", a.ticker + " atualizado.", "success");
        afterChange();
      }
    });

    U.modal({ eyebrow: "Executar decisão", title: "Operar " + a.ticker, body: body,
      footer: [U.button("Cancelar", { variant: "ghost", onClick: U.closeModal }), U.el("div", { class: "spacer" }), confirmBtn] });
  }

  // helper pra assetCell dentro de modal sem quebrar se UI ainda não tiver
  U.assetCellSafe = function (a) { return U.assetCell(a); };

  window.Forms = {
    newAsset: newAsset, newThesis: newThesis, editThesis: editThesis,
    trade: trade
  };
})();
