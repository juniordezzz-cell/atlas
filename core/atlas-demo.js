/* ============================================================
   ATLAS · core/atlas-demo.js — MODO DEMONSTRAÇÃO
   ------------------------------------------------------------
   Num ATLAS vazio, o Dashboard abre com números de EXEMPLO em vez do
   cartão "Seu ATLAS está pronto — e vazio", com uma faixa avisando e
   um botão para limpar. Decisão do dono do produto (2026-09-19): o
   primeiro contato mostra o sistema funcionando; o passo a passo fica
   num vídeo.

   O que este arquivo garante
   --------------------------
   1. NADA FICTÍCIO É GRAVADO. Os exemplos são uma camada de exibição:
      dados() devolve um objeto no formato de buildAtlasData() (js/data.js)
      e nenhum store de módulo, caixa ou snapshot é tocado. A única chave
      é atlas.demo.v1 — e por isso nada falso chega à nuvem
      (core/atlas-cloud.js) quando ela for ligada.
   2. QUEM TEM DADO REAL NUNCA VÊ EXEMPLO. Quem decide é o Dashboard, o
      único lugar que enxerga os quatro módulos juntos (js/data.js).
   3. NINGUÉM MISTURA REAL COM EXEMPLO. Enquanto a demonstração está
      "ativa", toda função que abre formulário de criação chama
      bloquear() primeiro: aviso → "Limpar e continuar".

   Estados de atlas.demo.v1
   ------------------------
     ausente  ainda não decidido — não bloqueia nada (quem tem dado
              real e abre direto um módulo não é barrado)
     "ativo"  o Dashboard exibiu a demonstração — criação pede limpar
     "limpo"  limpo pela pessoa, ou o Dashboard achou dado real — nunca
              mais aparece

   Fica fora do AtlasSettings de propósito: "Restaurar padrões" zera as
   preferências e traria a demonstração de volta. "Apagar todos os
   dados" (Configurações) regrava "limpo" depois de apagar.
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasDemo) return;

  var KEY = "atlas.demo.v1";

  function ler() {
    try { var v = window.localStorage.getItem(KEY); return (v === "ativo" || v === "limpo") ? v : null; }
    catch (e) { return null; }
  }
  function gravar(v) { try { window.localStorage.setItem(KEY, v); } catch (e) {} }

  /* ---------------- série determinística ----------------
     Random walk com semente fixa: a curva é a mesma a cada abertura
     (um gráfico de exemplo que muda sozinho a cada F5 pareceria dado
     vivo). 90 pontos, terminando exatamente no total. */
  var TOTAL = 48320, INICIO = 41900, DIAS = 90, RENDA = 312;
  var SERIE = (function () {
    var s = 20260919;
    function rnd() { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }
    var passos = [], acc = 0;
    for (var i = 0; i < DIAS - 1; i++) { var p = (rnd() - 0.42) * 900; passos.push(p); acc += p; }
    /* corrige a deriva para a série sair de INICIO e chegar em TOTAL */
    var ajuste = ((TOTAL - INICIO) - acc) / passos.length;
    var out = [INICIO], v = INICIO;
    for (var j = 0; j < passos.length; j++) { v += passos[j] + ajuste; out.push(Math.round(v)); }
    out[out.length - 1] = TOTAL;
    return out;
  })();

  function snapshot(dias) {
    dias = Math.max(1, Math.min(DIAS, dias | 0 || 30));
    var evo = SERIE.slice(-dias);
    var ini = evo[0], pnl = TOTAL - ini;
    return {
      total: TOTAL, pnl: pnl, pnlPct: ini ? (pnl / ini) * 100 : 0,
      evolution: evo, evolutionMedidos: dias, evolutionDias: dias
    };
  }

  /* ---------------- formatação (mesma régua de js/data.js) ---------------- */
  function usd(x, dec) {
    if (dec == null) dec = Math.abs(x) >= 1000 ? 0 : 2;
    if (window.AtlasCurrency) return window.AtlasCurrency.format(x, { decimals: dec });
    return "US$ " + x.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function pct(v) { return (v > 0 ? "+" : "") + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%"; }
  function diaCurto(delta) {
    var d = new Date(); d.setDate(d.getDate() - delta);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }

  /* composição: caixa + quatro módulos = TOTAL. Fora de dados() para o
     Oráculo ler os valores exatos, não reconstruí-los das porcentagens
     arredondadas do gráfico. */
  var PARTES = [
    { label: "Caixa disponível", value: 5320,  color: "#5eead4" },
    { label: "Hold",             value: 21400, color: "#22C55E" },
    { label: "DeFi",             value: 12650, color: "#8B5CF6" },
    { label: "RWA",              value: 6150,  color: "#22D3EE" },
    { label: "Trade",            value: 2800,  color: "#4F8CFF" }
  ];

  function dados(usuario) {
    var s30 = snapshot(30);
    var mes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    var labels = [], labelsCheios = [], hoje = new Date();
    for (var i = 29; i >= 0; i--) {
      var d = new Date(hoje); d.setDate(hoje.getDate() - i);
      var l = d.getDate() + " " + mes[d.getMonth()];
      labels.push(l); labelsCheios.push((i % 7 === 0 || i === 0) ? l : "");
    }
    var partes = PARTES;
    var soma = partes.reduce(function (a, p) { return a + p.value; }, 0) || 1;
    var bc = [["Solana", 38], ["Ethereum", 27], ["Base", 14], ["Arbitrum", 11], ["Bitcoin", 10]];
    var bcCores = ["#22D3EE", "#4F8CFF", "#8B5CF6", "#F59E0B", "#22C55E"];

    return {
      usuario: usuario || { nome: "Gestor ATLAS", iniciais: "GA", saudacao: "Olá" },
      kpis: [
        { rotulo: "Patrimônio Total", valor: usd(TOTAL), variacao: pct(s30.pnlPct), periodo: "(30d)", tipo: "pos" },
        { rotulo: "Lucro Total",      valor: usd(s30.pnl), variacao: pct(s30.pnlPct), periodo: "(30d)", tipo: "pos" },
        { rotulo: "Rentabilidade",    valor: pct(s30.pnlPct), variacao: "Período", periodo: "", tipo: "pos", destaque: true },
        { rotulo: "Renda Passiva",    valor: usd(RENDA), variacao: "estimada", periodo: "(mês)", tipo: "pos" },
        { rotulo: "Carteiras",        valor: "3", variacao: "2 globais", periodo: "", tipo: "neutro" },
        { rotulo: "Protocolos",       valor: "4", variacao: "Conectados", periodo: "", tipo: "neutro" }
      ],
      evolucao: {
        total: usd(TOTAL), variacao: pct(s30.pnlPct) + " no período",
        labels: labels, valores: s30.evolution, labelsCheios: labelsCheios,
        medidos: 30, dias: 30
      },
      categoria: {
        labels: partes.map(function (p) { return p.label; }),
        valores: partes.map(function (p) { return +((p.value / soma) * 100).toFixed(1); }),
        cores: partes.map(function (p) { return p.color; }),
        sub: null
      },
      blockchain: {
        labels: bc.map(function (x) { return x[0]; }),
        valores: bc.map(function (x) { return x[1]; }),
        cores: bcCores
      },
      movimentacoes: [
        { titulo: "Compra de 0,05 BTC",      origem: "Hold", valor: "−" + usd(3120), quando: diaCurto(1),  tipo: "neg" },
        { titulo: "Taxas coletadas SOL/USDC", origem: "DeFi", valor: "+" + usd(84.6), quando: diaCurto(3),  tipo: "pos" },
        { titulo: "Depósito",                 origem: "ATLAS", valor: "+" + usd(5000), quando: diaCurto(6),  tipo: "pos" },
        { titulo: "Tesouro EUA 2029",         origem: "RWA",  valor: "−" + usd(2000), quando: diaCurto(11), tipo: "neg" }
      ],
      pools: [
        { par: "SOL/USDC",  dex: "Raydium", apr: "38,40%", lucro: usd(212.35, 2) },
        { par: "JUP/SOL",   dex: "Orca",    apr: "52,10%", lucro: usd(96.80, 2) },
        { par: "ETH/USDC",  dex: "Uniswap", apr: "21,75%", lucro: usd(143.10, 2) },
        { par: "USDC",      dex: "Aave",    apr: "4,90%",  lucro: usd(18.40, 2) }
      ],
      alertas: [
        { texto: "Concentração elevada — BTC representa 42% do Hold.", quando: "hoje", level: "warn", module: "hold" },
        { texto: "Pool JUP/SOL fora da faixa de preço há 2 dias.",      quando: "há 2 dias", level: "crit", module: "defi" },
        { texto: "Trade de SOL aberto há 3 dias sem revisão.",           quando: "há 5 dias", level: "info", module: "trade" }
      ],
      oraculo: { mensagem: "Modo demonstração · números ilustrativos." }
    };
  }

  /* ---------------- aviso "limpe primeiro" ---------------- */
  var TXT = {
    titulo: "Modo demonstração",
    msg: "Primeiro limpe os dados de demonstração para cadastrar os seus.",
    ok: "Limpar e continuar",
    nao: "Cancelar"
  };

  function limpar() {
    gravar("limpo");
    try { document.dispatchEvent(new CustomEvent("atlas:demo", { detail: { estado: "limpo" } })); } catch (e) {}
  }

  function bloquear(continuar) {
    if (ler() !== "ativo") return false;
    var pedido = (window.AtlasUI && window.AtlasUI.confirm)
      ? window.AtlasUI.confirm({ title: TXT.titulo, message: TXT.msg, confirmLabel: TXT.ok, cancelLabel: TXT.nao })
      : Promise.resolve(window.confirm(TXT.msg));
    Promise.resolve(pedido).then(function (ok) {
      if (!ok) return;
      limpar();
      if (typeof continuar === "function") continuar();
    });
    return true;
  }

  window.AtlasDemo = {
    estado: ler,
    exibindo: function () { return ler() === "ativo"; },
    ativar: function () { if (ler() === null) gravar("ativo"); },
    encerrar: function () { if (ler() !== "limpo") gravar("limpo"); },
    limpar: limpar,
    dados: dados,
    snapshot: snapshot,
    rendaPassiva: RENDA,
    composicao: function () { return PARTES.map(function (p) { return { label: p.label, value: p.value }; }); },
    bloquear: bloquear,
    TEXTOS: TXT
  };
})();
