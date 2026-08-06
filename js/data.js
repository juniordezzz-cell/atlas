/* ===================================================================
   ATLAS — Dados do dashboard (CONSOLIDAÇÃO REAL, em US$)
   -------------------------------------------------------------------
   ATLAS_DATA agora é montado dinamicamente a partir de AtlasConsolidation,
   que soma os totais reais de Trade + Hold + DeFi + RWA (só carteiras
   globais). Moeda sempre em dólar. Firebase pode substituir a fonte
   depois sem tocar no dashboard.
   =================================================================== */

const ATLAS_DATA = (function () {
  function n(v) { return (typeof v === "number" && isFinite(v)) ? v : 0; }
  function usd(v) { return "US$ " + Math.round(n(v)).toLocaleString("pt-BR"); }
  function usdC(v) { return "US$ " + n(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
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

  if (!snap) {
    return {
      usuario: { nome: "Jeferson Junior", iniciais: "JJ", saudacao: saudacao() },
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

  /* Últimas movimentações (journal do RWA) */
  let movimentacoes = [];
  try {
    const negTypes = { revisao: 1, reduce: 1, saida: 1 };
    movimentacoes = (window.RWAStore ? window.RWAStore.journal() : []).slice(0, 4).map(j => ({
      titulo: (j.text || "").split(".")[0],
      origem: j.ticker || "RWA",
      valor: (j.type || "nota").toUpperCase(),
      quando: dataBR(j.date),
      tipo: negTypes[j.type] ? "neg" : "pos"
    }));
  } catch (e) { movimentacoes = []; }

  /* Pools / posições ativas (staking + lending do DeFi) */
  let pools = [];
  try {
    const st = (window.DeFiStore ? window.DeFiStore.staking() : []).map(s => ({
      par: s.token, dex: s.protocol, apr: n(s.apr).toFixed(2).replace(".", ",") + "%", lucro: usdC(s.value * s.apr / 100 / 12)
    }));
    const ln = (window.DeFiStore ? window.DeFiStore.lending() : []).map(l => ({
      par: l.token, dex: l.protocol, apr: n(l.apy).toFixed(2).replace(".", ",") + "%", lucro: usdC(n(l.earned))
    }));
    pools = st.concat(ln).slice(0, 4);
  } catch (e) { pools = []; }

  /* Alertas inteligentes (Risk Engine do RWA) */
  let alertas = [];
  try {
    alertas = (window.RWAStore ? window.RWAStore.riskEngine().alerts : []).slice(0, 3).map(a => ({
      texto: typeof a === "string" ? a : (a.text || a.msg || ""),
      quando: (typeof a === "object" && a.when) ? a.when : "agora"
    }));
  } catch (e) { alertas = []; }

  return {
    usuario: { nome: "Jeferson Junior", iniciais: "JJ", saudacao: saudacao() },
    kpis,
    evolucao: { total: usd(snap.total), variacao: pct(snap.pnlPct) + " no período", labels, valores: snap.evolution, labelsCheios },
    categoria,
    blockchain: bcData,
    movimentacoes,
    pools,
    alertas,
    oraculo: { mensagem: "Consolidando " + snap.byModule.length + " módulos · patrimônio " + usd(snap.total) + "." }
  };
})();
