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
function buildAtlasDataReal() {
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
  /* null = sem base para afirmar rentabilidade (ver snapshot.pnlPct).
     Vira "—", não "0,00%": zero é uma afirmação ("ficou de lado"), e o
     Oráculo, perguntado, responde "sem rentabilidade" — a tela não
     pode dizer outra coisa. */
  function pct(v) {
    if (v == null || !isFinite(v)) return "—";
    v = n(v); return (v > 0 ? "+" : "") + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%"; }
  function tipo(v) { return v > 0 ? "pos" : v < 0 ? "neg" : "neutro"; }
  function saudacao() { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; }
  function dataBR(iso) {
    if (!iso) return "—";
    const d = new Date(iso + (String(iso).length === 10 ? "T00:00:00" : ""));
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }

  const C = window.AtlasConsolidation;
  const snap = C ? C.snapshot(30) : null;
  /* recorte do seletor do topo: null = todas as carteiras */
  const escopoId = C && C.escopo ? C.escopo() : null;
  const escopo = escopoId && window.AtlasWallets ? AtlasWallets.get(escopoId) : null;

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

  /* KPIs reais

     pnl e pnlPct são ACUMULADOS — resultado desde a entrada em cada
     posição, sobre o capital próprio — depositado − sacado (core/atlas-contabilidade.js).
     O snapshot não os recorta por período: trocar 7/30/90 dias no
     gráfico não muda o número. Os rótulos diziam "(30d)" e "Período",
     e o Oráculo, ao explicar a conta, teria de desmentir a tela. */
  /* "Acumulada" respondia "quanto", nunca "desde quando" — e a janela
     de 7/30/90 dias do gráfico ao lado sugeria um período que este
     número não tem. Agora ele diz a data do primeiro movimento. */
  const desde = snap.desde ? dataBR(snap.desde) : null;

  const kpis = [
    { rotulo: "Patrimônio Total", valor: usd(snap.total), variacao: pct(snap.pnlPct), periodo: "(acumulado)", tipo: tipo(snap.pnl) },
    { rotulo: "Lucro Total",      valor: usd(snap.pnl),   variacao: pct(snap.pnlPct), periodo: "(acumulado)", tipo: tipo(snap.pnl) },
    { rotulo: "Rentabilidade",    valor: pct(snap.pnlPct), variacao: "Acumulada",
      periodo: desde ? "(desde " + desde + ")" : "", tipo: tipo(snap.pnl), destaque: true },
    /* Renda passiva só aparece quando ALGUMA posição declara APR/APY.
       Sem isso o cartão afirmava "US$ 0,00 por mês", que é uma resposta
       errada para uma pergunta que o ATLAS não tinha como responder. */
    ...(snap.passiveIncome == null ? [] : [
      { rotulo: "Renda Passiva", valor: usd(snap.passiveIncome), variacao: "estimada pelo APR", periodo: "(mês)", tipo: "pos" }
    ]),
    /* com uma carteira escolhida, o cartão diz QUAL — "11 carteiras"
       ao lado de números de uma só confundiria a leitura */
    (escopo
      ? { rotulo: "Carteira", valor: "1", variacao: escopo.name, periodo: "", tipo: "neutro" }
      : { rotulo: "Carteiras", valor: String(snap.wallets.total), variacao: snap.wallets.globals + " globais", periodo: "", tipo: "neutro" }),
    { rotulo: "Protocolos",       valor: String(snap.protocols || 0), variacao: "em uso", periodo: "", tipo: "neutro" }
  ];

  /* Top 5 + "Outras", em percentual — a régua dos dois donuts. */
  function distribuicao(lista, paleta, corFixa) {
    if (!lista.length) return { labels: [], valores: [], cores: [] };
    const top = lista.slice(0, 5);
    const resto = lista.slice(5).reduce((a, x) => a + x.value, 0);
    if (resto > 0) top.push({ label: "Outras", value: resto });
    const tot = top.reduce((a, x) => a + x.value, 0) || 1;
    let i = 0;
    return {
      labels: top.map(x => x.label),
      valores: top.map(x => +((x.value / tot) * 100).toFixed(1)),
      cores: top.map(x => (corFixa && corFixa[x.label]) || paleta[i++ % paleta.length])
    };
  }

  /* Distribuição por Plataforma — ONDE o dinheiro está (Orca,
     PancakeSwap, Uniswap...), da maior para a menor. Substituiu a "por
     categoria" em 24/09/2026. O caixa parado entra como "Carteira /
     Caixa", sempre na mesma cor, e o resto da cauda vira "Outras". */
  const CAIXA_COR = "#5eead4";
  const platCores = ["#8B5CF6", "#4F8CFF", "#F59E0B", "#22D3EE", "#22C55E", "#4A6480"];
  const plat = (C.plataforma ? C.plataforma() : []) || [];
  const categoria = distribuicao(plat, platCores,
    { [C.CAIXA_ROTULO || "Carteira / Caixa"]: CAIXA_COR, "Outras": "#4A6480" });

  /* Distribuição por Blockchain (best-effort) */
  const bcCores = ["#22D3EE", "#4F8CFF", "#8B5CF6", "#F59E0B", "#22C55E", "#4A6480"];
  const bcData = distribuicao((C.blockchain ? C.blockchain() : []) || [], bcCores, { "Outras": "#4A6480" });

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
    movimentacoes = (window.AtlasMovements ? window.AtlasMovements.list(escopoId ? { walletId: escopoId } : undefined) : [])
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
    /* As pools do RECORTE do seletor: a carteira escolhida, ou todas as
       globais em "Todas as carteiras". activePools() era a carteira
       ativa dentro do DeFi — em "Todas" o card mostrava uma só. */
    const ids = {};
    (escopoId ? [escopoId] : (window.AtlasWallets ? AtlasWallets.globals().map(w => w.id) : []))
      .forEach(id => { ids[id] = 1; });
    const doEscopo = (lista) => (S && S.poolsDeTodasCarteiras && Object.keys(ids).length)
      ? lista.filter(x => ids[x.walletId]) : null;
    const poolsEsc = S ? doEscopo(S.poolsDeTodasCarteiras()) : null;
    const liq = S ? (poolsEsc ? poolsEsc.map(x => x.pool) : S.activePools()).map(p => {
      const r = S.poolSummary(p);
      return {
        par: p.base + "/" + p.quote,
        dex: p.protocol,
        apr: n(r ? r.aprReal : p.apr).toFixed(2).replace(".", ",") + "%",
        lucro: usdC(r ? r.resultado : 0)
      };
    }) : [];
    const rend = (t, lista) => {
      const e = S && S.rendimentosDeTodasCarteiras ? doEscopo(S.rendimentosDeTodasCarteiras(t)) : null;
      return e ? e.map(x => x.item) : lista;
    };
    const st = rend("staking", S ? S.staking() : []).map(s => ({
      par: s.token, dex: s.protocol, apr: n(s.apr).toFixed(2).replace(".", ",") + "%",
      lucro: usdC(n(s.value) * n(s.apr) / 100 / 12)
    }));
    const ln = rend("lending", S ? S.lending() : []).map(l => ({
      par: l.token, dex: l.protocol, apr: n(l.apy).toFixed(2).replace(".", ",") + "%",
      lucro: usdC(n(l.earned))
    }));
    pools = liq.concat(st).concat(ln).slice(0, 4);
  } catch (e) { pools = []; }

  /* Alertas inteligentes — QUATRO MÓDULOS
     -------------------------------------------------------------------
     Antes: só RWAStore.riskEngine(). O Hold já calculava os próprios
     alertas (concentração acima de 40%) e nunca chegavam à tela principal.
     Agora a consolidação junta Hold + RWA + DeFi + a supervisão das
     contas, com o crítico no topo. */
  let alertas = [];
  try {
    alertas = (C && C.alerts ? C.alerts() : []).slice(0, 4).map(a => ({
      texto: a.texto,
      quando: a.quando,
      level: a.level,
      module: a.module,
      detalhe: a.detalhe || null,
      href: a.href || null
    }));
  } catch (e) { alertas = []; }

  return {
    usuario: { nome: perfil.name, iniciais: perfil.initials, saudacao: saudacao() },
    kpis,
    evolucao: { total: usd(snap.total), variacao: pct(snap.pnlPct) + " acumulado",
                labels, valores: snap.evolution, labelsCheios,
                /* quantos dias a serie tem de MEDICAO — ver
                   evolutionMedidos em js/atlas-consolidation.js */
                medidos: snap.evolutionMedidos, dias: snap.evolutionDias },
    categoria,
    blockchain: bcData,
    movimentacoes,
    pools,
    alertas,
    oraculo: { mensagem: "Consolidando " + snap.byModule.length + " módulos · patrimônio " + usd(snap.total) + "." }
  };
}

/* ------------------------------------------------------------
   MODO DEMONSTRAÇÃO (core/atlas-demo.js)

   Num ATLAS sem nenhum dado real, o Dashboard mostra números de exemplo
   em vez do roteiro de primeiro acesso — até a pessoa clicar em "Limpar
   demonstração". Este é o ÚNICO lugar que decide, porque é o único que
   enxerga os quatro módulos juntos:
     - há dado real      → estado "limpo" (quem tem dado nunca vê exemplo
                           e nunca é barrado nos módulos) e o real;
     - vazio, não limpo  → estado "ativo" e os exemplos;
     - vazio, já limpo   → o real (zerado).
   "Vazio" é o mesmo critério do roteiro de primeiro acesso (dashboard.js,
   calcularSemDados). Nada fictício é gravado — só a exibição muda.
   ------------------------------------------------------------ */
function buildAtlasData() {
  const real = buildAtlasDataReal();
  const D = window.AtlasDemo;
  if (!D) return real;
  /* Carteira escolhida no seletor: mostra o real dela, mesmo vazia. A
     demonstração é sobre o ATLAS inteiro estar vazio, e isso só se
     decide olhando todas as carteiras. */
  if (window.AtlasConsolidation && AtlasConsolidation.escopo && AtlasConsolidation.escopo()) return real;
  const vazio = !real.categoria.labels.length && !real.movimentacoes.length && !real.pools.length;
  if (!vazio) { D.encerrar(); return real; }
  if (D.estado() === "limpo") return real;
  D.ativar();
  return D.dados(real.usuario);
}

window.buildAtlasData = buildAtlasData;

/* `var` e não `const`: o Dashboard reatribui ATLAS_DATA ao remontar. */
var ATLAS_DATA = buildAtlasData();
