/* ===================================================================
   ATLAS — Dados do dashboard (CONSOLIDAÇÃO REAL, em US$)
   -------------------------------------------------------------------
   ATLAS_DATA agora é montado dinamicamente a partir de AtlasConsolidation,
   que soma os totais reais de Trade + Hold + DeFi + RWA (só carteiras
   globais). Moeda sempre em dólar. Firebase pode substituir a fonte
   depois sem tocar no dashboard.
   =================================================================== */

/* Era um IIFE que montava ATLAS_DATA uma vez. Virou função com nome
   para o Dashboard poder REMONTAR os dados sem recarregar a página —
   criar ou excluir uma carteira muda o KPI "Carteiras" e pode mudar os
   totais. Nada dentro mudou: o corpo é o mesmo, e ATLAS_DATA continua
   sendo o resultado da primeira chamada. */
function buildAtlasData() {
  function n(v) { return (typeof v === "number" && isFinite(v)) ? v : 0; }
  /* Dinheiro — delegado ao AtlasCurrency. Os totais consolidados estão
     em USD (regra de armazenamento); a conversão é camada de exibição. */
  /* ------------------------------------------------------------
     Casas decimais adaptativas — a mesma régua do core/currency.js

     Estava cravado em `decimals: 0`. Num patrimônio de seis dígitos
     ninguém sente falta dos centavos; num de US$ 27,21 o Dashboard
     escrevia "US$ 27" ao lado do módulo DeFi mostrando "US$ 27,21",
     e a movimentação de US$ 18,46 virava "+US$ 18". Quem está
     começando — que é justamente quem tem valores pequenos — via o
     sistema errar todos os números da tela inicial.
     ------------------------------------------------------------ */
  function usd(v) {
    const x = n(v);
    const dec = Math.abs(x) >= 1000 ? 0 : 2;
    if (window.AtlasCurrency) return AtlasCurrency.format(x, { decimals: dec });
    return "US$ " + x.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function usdC(v) {
    if (window.AtlasCurrency) return AtlasCurrency.format(n(v), { decimals: 2 });
    return "US$ " + n(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pct(v) { v = n(v); return (v > 0 ? "+" : "") + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%"; }
  function tipo(v) { return v > 0 ? "pos" : v < 0 ? "neg" : "neutro"; }
  function saudacao() { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; }
  function dataBR(iso) {
    if (!iso) return "—";
    const d = new Date(iso + (String(iso).length === 10 ? "T00:00:00" : ""));
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }

  const C = window.AtlasConsolidation;
  const snap = C ? C.snapshot(30) : null;

  /* Quem está usando o sistema. Antes "Jeferson Junior" e "JJ" estavam
     CRAVADOS aqui e no HTML de três páginas — o campo "Nome do gestor"
     das Configurações existia e não mudava nada fora dos relatórios do
     Hold. AtlasSettings.profile() lê da mesma chave que aquela tela
     grava, sem criar uma segunda cópia do nome. */
  const perfil = (window.AtlasSettings && AtlasSettings.profile)
    ? AtlasSettings.profile()
    : { name: "Gestor ATLAS", initials: "GA" };

  if (!snap) {
    return {
      usuario: { nome: perfil.name, iniciais: perfil.initials, saudacao: saudacao() },
      kpis: [{ rotulo: "Patrimônio Total", valor: usd(0), variacao: "—", periodo: "", tipo: "neutro" }],
      evolucao: { total: usd(0), variacao: "—", labels: [], valores: [0], labelsCheios: [] },
      categoria: { labels: [], valores: [], cores: [] },
      blockchain: { labels: [], valores: [], cores: [] },
      movimentacoes: [], pools: [], alertas: [],
      oraculo: { mensagem: "Consolidação indisponível — verifique o carregamento dos módulos." }
    };
  }

  /* labels dos últimos 30 dias */
  const labels = [], labelsCheios = [];
  const hoje = new Date();
  const mes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(hoje); d.setDate(hoje.getDate() - i);
    const lbl = d.getDate() + " " + mes[d.getMonth()];
    labels.push(lbl);
    labelsCheios.push((i % 7 === 0 || i === 0) ? lbl : "");
  }

  /* KPIs reais */
  const kpis = [
    { rotulo: "Patrimônio Total", valor: usd(snap.total), variacao: pct(snap.pnlPct), periodo: "(30d)", tipo: tipo(snap.pnl) },
    { rotulo: "Lucro Total",      valor: usd(snap.pnl),   variacao: pct(snap.pnlPct), periodo: "(30d)", tipo: tipo(snap.pnl) },
    { rotulo: "Rentabilidade",    valor: pct(snap.pnlPct), variacao: "Período",       periodo: "", tipo: tipo(snap.pnl), destaque: true },
    { rotulo: "Renda Passiva",    valor: usd(snap.passiveIncome), variacao: "estimada", periodo: "(mês)", tipo: "pos" },
    { rotulo: "Carteiras",        valor: String(snap.wallets.total), variacao: snap.wallets.globals + " globais", periodo: "", tipo: "neutro" },
    { rotulo: "Protocolos",       valor: String(snap.protocols || 0), variacao: "Conectados", periodo: "", tipo: "neutro" }
  ];

  /* Distribuição por Categoria = por MÓDULO */
  const catTotal = snap.byModule.reduce((a, m) => a + m.value, 0) || 1;
  const categoria = {
    labels: snap.byModule.map(m => m.label),
    valores: snap.byModule.map(m => +((m.value / catTotal) * 100).toFixed(1)),
    cores: snap.byModule.map(m => m.color)
  };

  /* Distribuição por Blockchain (best-effort) */
  const bcCores = ["#22D3EE", "#4F8CFF", "#8B5CF6", "#F59E0B", "#22C55E", "#4A6480"];
  let bc = (C.blockchain ? C.blockchain() : []) || [];
  let bcData = { labels: [], valores: [], cores: [] };
  if (bc.length) {
    const top = bc.slice(0, 5);
    const resto = bc.slice(5).reduce((a, x) => a + x.value, 0);
    if (resto > 0) top.push({ label: "Outras", value: resto });
    const tot = top.reduce((a, x) => a + x.value, 0) || 1;
    bcData = {
      labels: top.map(x => x.label),
      valores: top.map(x => +((x.value / tot) * 100).toFixed(1)),
      cores: top.map((x, i) => bcCores[i % bcCores.length])
    };
  }

  /* Últimas movimentações — LIVRO-RAZÃO CENTRAL (todos os módulos)
     -------------------------------------------------------------------
     Antes este card lia RWAStore.journal(): o diário de UM módulo, com
     o rótulo "Últimas Movimentações". Quem registrava um trade ou uma
     pool não via nada aqui, e o card contradizia a promessa central do
     produto — tudo em um só lugar.

     AtlasMovements já mescla os quatro módulos (tem um adaptador para
     cada) e é a mesma fonte que a página de Relatórios usa. Passa a ser
     a fonte daqui também: uma verdade só sobre o que se movimentou. */
  const MOD_LABEL = { hold: "Hold", trade: "Trade", defi: "DeFi", rwa: "RWA" };
  const TIPO_LABEL = { entrada: "Entrada", saida: "Saída", resultado: "Resultado" };

  let movimentacoes = [];
  try {
    movimentacoes = (window.AtlasMovements ? window.AtlasMovements.list() : [])
      .slice(-4).reverse()                       // list() vem em ordem crescente
      .map(m => ({
        titulo: m.label || TIPO_LABEL[m.tipo] || "Movimento",
        origem: MOD_LABEL[m.module] || "ATLAS",
        valor: (m.tipo === "saida" ? "−" : "+") + usd(m.valorUSD).replace("US$ ", "US$ "),
        quando: dataBR(m.date),
        tipo: m.tipo === "saida" ? "neg" : "pos"
      }));
  } catch (e) { movimentacoes = []; }

  /* ------------------------------------------------------------
     POOLS ATIVAS — e as pools de verdade

     O card se chama "Pools Ativas", tem um link "Ver todas as pools"
     e montava a lista com STAKING + LENDING apenas. As posições de
     liquidez — as únicas que o ATLAS de fato chama de pool, as que a
     tela de Pools cria e a página da posição detalha — ficavam de
     fora. Com uma pool ativa registrada, o card do Dashboard aparecia
     vazio; com só staking, aparecia cheio de coisa que não é pool.

     Agora as pools vêm primeiro, com o resultado real (poolSummary),
     e staking/lending completam o espaço que sobrar.
     ------------------------------------------------------------ */
  let pools = [];
  try {
    const S = window.DeFiStore;
    const liq = S ? S.activePools().map(p => {
      const r = S.poolSummary(p);
      return {
        par: p.base + "/" + p.quote,
        dex: p.protocol,
        apr: n(r ? r.aprReal : p.apr).toFixed(2).replace(".", ",") + "%",
        lucro: usdC(r ? r.resultado : 0)
      };
    }) : [];
    const st = (S ? S.staking() : []).map(s => ({
      par: s.token, dex: s.protocol, apr: n(s.apr).toFixed(2).replace(".", ",") + "%",
      lucro: usdC(n(s.value) * n(s.apr) / 100 / 12)
    }));
    const ln = (S ? S.lending() : []).map(l => ({
      par: l.token, dex: l.protocol, apr: n(l.apy).toFixed(2).replace(".", ",") + "%",
      lucro: usdC(n(l.earned))
    }));
    pools = liq.concat(st).concat(ln).slice(0, 4);
  } catch (e) { pools = []; }

  /* Alertas inteligentes — QUATRO MÓDULOS
     -------------------------------------------------------------------
     Antes: só RWAStore.riskEngine(). O Hold já calculava os próprios
     alertas (posição sem tese, tese arquivada com posição aberta,
     concentração acima de 40%) e nunca chegavam à tela principal.
     Agora a consolidação junta Hold + RWA + DeFi + teses paradas de
     qualquer módulo, com o crítico no topo. */
  let alertas = [];
  try {
    alertas = (C && C.alerts ? C.alerts() : []).slice(0, 4).map(a => ({
      texto: a.texto,
      quando: a.quando,
      level: a.level,
      module: a.module
    }));
  } catch (e) { alertas = []; }

  return {
    usuario: { nome: perfil.name, iniciais: perfil.initials, saudacao: saudacao() },
    kpis,
    evolucao: { total: usd(snap.total), variacao: pct(snap.pnlPct) + " no período", labels, valores: snap.evolution, labelsCheios },
    categoria,
    blockchain: bcData,
    movimentacoes,
    pools,
    alertas,
    oraculo: { mensagem: "Consolidando " + snap.byModule.length + " módulos · patrimônio " + usd(snap.total) + "." }
  };
}

window.buildAtlasData = buildAtlasData;

/* `var` e não `const`: o Dashboard reatribui ATLAS_DATA ao remontar. */
var ATLAS_DATA = buildAtlasData();
