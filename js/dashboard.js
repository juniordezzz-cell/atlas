/* ===================================================================
   ATLAS — Dashboard (render)
   =================================================================== */

const D = ATLAS_DATA;

/* ===================================================================
   PRIMEIRO ACESSO
   -------------------------------------------------------------------
   Os seeds do ATLAS são vazios de propósito — ninguém quer começar com
   dados de mentira. Mas o Dashboard não tinha estado vazio: quem
   entrava pela primeira vez via seis KPIs em "US$ 0", um gráfico reto
   em zero, dois donuts em branco e três listas vazias. Nenhum texto,
   nenhuma seta, nada dizendo o que fazer.

   O minuto mais decisivo de um SaaS é o primeiro. Aqui ele era uma
   tela morta.

   Quando não há NADA registrado em nenhum módulo, o painel dá lugar a
   um roteiro de início. Assim que existir qualquer valor, o Dashboard
   normal volta sozinho — não há estado a limpar nem botão a apertar.
   =================================================================== */
const SEM_DADOS = !D.categoria.labels.length &&
                  !D.movimentacoes.length &&
                  !D.pools.length;

/* ---- Saudação ---- */
document.getElementById('saudacao').textContent =
  `${D.usuario.saudacao}, ${D.usuario.nome}`;
document.getElementById('evoTotal').textContent = D.evolucao.total;
document.getElementById('evoVar').textContent = D.evolucao.variacao;

/* ---- Roteiro de início (só no primeiro acesso) ---- */
if (SEM_DADOS) {
  const PASSOS = [
    { href: 'hold/index.html',    modulo: 'Hold',  titulo: 'Registre o que você carrega',
      texto: 'Ativos de longo prazo, com a tese que justifica cada posição.' },
    { href: 'trade/index.html',   modulo: 'Trade', titulo: 'Documente suas operações',
      texto: 'Estudo, registro de decisão e trade — o ciclo completo.' },
    { href: 'defi/index.html',    modulo: 'DeFi',  titulo: 'Acompanhe suas posições',
      texto: 'Pools, staking e lending, com APR e resultado real.' },
    { href: 'RWA/index.html',     modulo: 'RWA',   titulo: 'Mapeie os ativos reais',
      texto: 'Portfólio, ambiente macro e motor de risco.' }
  ];

  const inicio = document.createElement('section');
  inicio.className = 'onboard';
  inicio.innerHTML =
    '<div class="onboard-head">' +
      '<span class="onboard-eyebrow">Primeiros passos</span>' +
      '<h2>Seu ATLAS está pronto — e vazio.</h2>' +
      '<p>Nada é inventado aqui: os números aparecem conforme você registra. ' +
         'Comece por qualquer módulo; o patrimônio total se consolida sozinho.</p>' +
    '</div>' +
    '<div class="onboard-grid">' +
      PASSOS.map((p, i) =>
        '<a class="onboard-card" href="' + p.href + '">' +
          '<span class="onboard-n">' + (i + 1) + '</span>' +
          '<span class="onboard-mod">' + p.modulo + '</span>' +
          '<strong>' + p.titulo + '</strong>' +
          '<span class="onboard-txt">' + p.texto + '</span>' +
        '</a>').join('') +
    '</div>' +
    '<div class="onboard-foot">' +
      '<span>Já usava o ATLAS antes?</span>' +
      '<a href="configuracoes.html">Restaurar um backup</a>' +
    '</div>';

  const main = document.querySelector('.main');
  main.insertBefore(inicio, document.getElementById('kpis'));

  /* Gráficos e listas vazios não informam nada e ainda fazem a tela
     parecer quebrada. Ficam de fora até existir o primeiro dado. */
  ['.charts', '.bottom'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.style.display = 'none';
  });
}

/* ---- KPIs ---- */
document.getElementById('kpis').innerHTML = D.kpis.map(k => {
  const valorClass = k.destaque ? 'valor destaque' : 'valor';
  const subClass = k.tipo === 'neutro' ? 'sub neutro' : `sub ${k.tipo}`;
  const periodo = k.periodo ? `<span class="periodo">${k.periodo}</span>` : '';
  return `
    <div class="kpi">
      <div class="rotulo">${k.rotulo}</div>
      <div class="${valorClass}">${k.valor}</div>
      <div class="${subClass}">${k.variacao}${periodo}</div>
    </div>`;
}).join('');

/* ---- Movimentações ---- */
const iconEntrada = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12l7 7 7-7"/></svg>`;
const iconSaida   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
document.getElementById('movList').innerHTML = D.movimentacoes.map(m => `
  <li class="mov-item">
    <span class="mov-icon ${m.tipo === 'neg' ? 'neg' : ''}">${m.tipo === 'neg' ? iconSaida : iconEntrada}</span>
    <div class="mov-info">
      <div class="t">${m.titulo}</div>
      <div class="o">${m.origem}</div>
    </div>
    <div class="mov-right">
      <div class="v ${m.tipo}">${m.valor}</div>
      <div class="q">${m.quando}</div>
    </div>
  </li>`).join('');

/* ---- Pools ---- */
document.getElementById('poolList').innerHTML = D.pools.map(p => `
  <li class="pool-item">
    <span class="pool-icon">${p.par.split('/')[0].slice(0,3)}</span>
    <div class="pool-info">
      <div class="par">${p.par}</div>
      <div class="dex">${p.dex}</div>
    </div>
    <div class="pool-metric">
      <div class="lbl">APR</div>
      <div class="apr">${p.apr}</div>
    </div>
    <div class="pool-lucro">
      <div class="lbl">Lucro</div>
      <div class="val">${p.lucro}</div>
    </div>
  </li>`).join('');

/* ---- Alertas ---- */
const iconAlert = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>`;
document.getElementById('alertList').innerHTML = D.alertas.map(a => `
  <li class="alert-item">
    <span class="alert-ic">${iconAlert}</span>
    <div>
      <div class="alert-txt">${a.texto}</div>
      <div class="alert-when">${a.quando}</div>
    </div>
  </li>`).join('');

/* ===================================================================
   Gráficos (Chart.js)
   =================================================================== */
Chart.defaults.color = 'rgba(230,241,255,0.55)';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 11;

/* ---- Evolução Patrimonial (linha) ---- */
(function () {
  /* Sem dados, a seção inteira está oculta: desenhar num canvas de
     tamanho zero só gasta trabalho e polui o console. */
  if (SEM_DADOS) return;
  const ctx = document.getElementById('chartEvolucao').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, 'rgba(0,191,255,0.35)');
  grad.addColorStop(1, 'rgba(0,191,255,0)');

  /* A escala do eixo Y é recalculada a cada troca de período: com
     janelas diferentes o mínimo e o máximo mudam, e uma escala fixa
     deixaria a linha achatada ou cortada. */
  function escala(vals) {
    const v = (vals && vals.length) ? vals : [0, 1];
    const lo = Math.min.apply(null, v), hi = Math.max.apply(null, v);
    const pad = Math.max((hi - lo) * 0.25, hi * 0.05, 1);
    const yMin = Math.max(0, Math.floor((lo - pad) / 1000) * 1000);
    const yMax = Math.ceil((hi + pad) / 1000) * 1000;
    return { yMin, yMax, yStep: Math.max(1000, Math.round((yMax - yMin) / 5 / 1000) * 1000) };
  }

  const e0 = escala(D.evolucao.valores);

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: D.evolucao.labelsCheios,
      datasets: [{
        data: D.evolucao.valores,
        borderColor: '#00BFFF',
        borderWidth: 2.4,
        backgroundColor: grad,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#00F0FF',
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: '#0D1422', borderColor: 'rgba(0,191,255,0.3)', borderWidth: 1,
        padding: 10, displayColors: false,
        callbacks: { label: (c) => 'US$ ' + c.parsed.y.toLocaleString('pt-BR') }
      }},
      scales: {
        y: {
          grid: { color: 'rgba(160,174,192,0.08)' },
          ticks: { callback: (v) => (v/1000) + 'K', stepSize: e0.yStep },
          min: e0.yMin, max: e0.yMax, border: { display: false },
        },
        x: { grid: { display: false }, border: { display: false } },
      },
    },
  });

  /* ===================================================================
     Seletor de período — o botão "Últimos 30 dias" existia no HTML e
     não fazia nada. Agora ele troca a janela de verdade, relendo a
     consolidação com o número de dias pedido.

     A leitura é a MESMA de js/data.js (AtlasConsolidation.snapshot):
     nenhuma regra de cálculo é reescrita aqui, só o parâmetro muda.
     =================================================================== */
  const PERIODOS = [
    { dias: 7,  rotulo: 'Últimos 7 dias' },
    { dias: 30, rotulo: 'Últimos 30 dias' },
    { dias: 90, rotulo: 'Últimos 90 dias' },
  ];

  const btn = document.querySelector('.chart-evolucao .select');
  if (!btn || !window.AtlasConsolidation) return;

  const MES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  function rotulos(dias) {
    const out = [], hoje = new Date();
    /* um rótulo a cada ~1/5 da janela: em 90 dias, 90 rótulos viram
       uma tarja preta ilegível */
    const passo = Math.max(1, Math.round(dias / 5));
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(hoje); d.setDate(hoje.getDate() - i);
      out.push((i % passo === 0 || i === 0) ? (d.getDate() + ' ' + MES[d.getMonth()]) : '');
    }
    return out;
  }
  function usd(v) { return 'US$ ' + Math.round(v || 0).toLocaleString('pt-BR'); }
  function pct(v) {
    v = (typeof v === 'number' && isFinite(v)) ? v : 0;
    return (v > 0 ? '+' : '') + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  }

  function aplicar(dias, rotulo) {
    let snap;
    try { snap = window.AtlasConsolidation.snapshot(dias); }
    catch (e) { return; }                       // consolidação indisponível: mantém o que está na tela
    if (!snap) return;

    const esc = escala(snap.evolution);
    chart.data.labels = rotulos(dias);
    chart.data.datasets[0].data = snap.evolution;
    chart.options.scales.y.min = esc.yMin;
    chart.options.scales.y.max = esc.yMax;
    chart.options.scales.y.ticks.stepSize = esc.yStep;
    chart.update();

    const total = document.getElementById('evoTotal');
    const varia = document.getElementById('evoVar');
    if (total) total.textContent = usd(snap.total);
    if (varia) {
      varia.textContent = pct(snap.pnlPct) + ' no período';
      varia.className = snap.pnl < 0 ? 'neg' : 'pos';
    }
    btn.firstChild.nodeValue = rotulo + ' ';
  }

  /* O menu segue a convenção do resto do sistema (data-open) e por
     isso já herda o fechar-ao-clicar-fora de wallets/walletMenus.js. */
  const wrap = document.createElement('div');
  wrap.className = 'tb-menu tb-menu--period';
  wrap.setAttribute('data-atlas-menu', 'periodo');
  wrap.setAttribute('data-open', 'false');
  btn.parentNode.insertBefore(wrap, btn);
  wrap.appendChild(btn);
  btn.setAttribute('aria-haspopup', 'menu');
  btn.setAttribute('aria-expanded', 'false');

  const pop = document.createElement('div');
  pop.className = 'tb-menu__pop';
  pop.setAttribute('role', 'menu');
  pop.innerHTML = '<div class="tb-menu__list">' + PERIODOS.map(p =>
    '<button type="button" class="tb-menu__item" role="menuitem" data-dias="' + p.dias + '">' +
      '<span>' + p.rotulo + '</span></button>'
  ).join('') + '</div>';
  wrap.appendChild(pop);

  btn.addEventListener('click', (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const abrindo = wrap.getAttribute('data-open') !== 'true';
    document.querySelectorAll('[data-atlas-menu][data-open="true"]').forEach(n => {
      if (n !== wrap) n.setAttribute('data-open', 'false');
    });
    wrap.setAttribute('data-open', abrindo ? 'true' : 'false');
    btn.setAttribute('aria-expanded', abrindo ? 'true' : 'false');
  });

  pop.addEventListener('click', (ev) => {
    const alvo = ev.target.closest('[data-dias]');
    if (!alvo) return;
    ev.preventDefault(); ev.stopPropagation();
    const p = PERIODOS.find(x => String(x.dias) === alvo.getAttribute('data-dias'));
    if (p) aplicar(p.dias, p.rotulo);
    wrap.setAttribute('data-open', 'false');
    btn.setAttribute('aria-expanded', 'false');
  });

  if (window.AtlasCloseMenus) window.AtlasCloseMenus();
})();

/* ---- Donut helper ---- */
function donut(canvasId, legendId, cfg) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: cfg.labels,
      datasets: [{
        data: cfg.valores,
        backgroundColor: cfg.cores,
        borderColor: 'transparent',
        borderWidth: 0,
        spacing: 3,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0D1422', borderColor: 'rgba(0,191,255,0.3)', borderWidth: 1,
          padding: 10, displayColors: false,
          callbacks: { label: (c) => c.label + ': ' + c.parsed + '%' }
        },
      },
    },
  });

  document.getElementById(legendId).innerHTML = cfg.labels.map((l, i) => `
    <li>
      <span class="swatch" style="background:${cfg.cores[i]}"></span>
      <span class="nome">${l}</span>
      <span class="val">${cfg.valores[i].toString().replace('.', ',')}%</span>
    </li>`).join('');
}

if (!SEM_DADOS) {
  donut('chartCategoria', 'legendCategoria', D.categoria);
  donut('chartBlockchain', 'legendBlockchain', D.blockchain);
}

/* ===================================================================
   ATLAS — Seletor de carteira GLOBAL (Bloco 3)
   Troca a carteira global ativa da central → afeta todos os módulos.
   Só carteiras globais aparecem aqui (são as que somam no total).
   =================================================================== */
(function () {
  "use strict";
  var host = document.getElementById("walletSel");
  if (!host || !window.WalletSelector || !window.AtlasWallets) return;

  /* O Dashboard monta O MESMO componente dos módulos, com as mesmas
     opções e as mesmas funções (trocar, criar global, criar local,
     renomear, excluir). Nada aqui é específico do Dashboard.

     Sem getActive/onSelect: quem guarda a carteira em uso é a central
     (AtlasWallets.activeFor/setActiveFor). O seletor também se repinta
     sozinho quando a lista muda — deste módulo, de outro ou de outra
     aba —, por isso não existe mais um segundo render assinando
     AtlasWallets aqui.

     reload: PROVISÓRIO. Os KPIs, os gráficos e as listas do Dashboard
     são montados no load e não reagem à troca de carteira; até isso
     virar reativo, recarregar é o que mantém os números certos.
     Remoção rastreada na tarefa "remover todos os reload:true". */
  window.WalletSelector.render(host, {
    module: "atlas",
    scope: "module",
    reload: true
  });
})();
