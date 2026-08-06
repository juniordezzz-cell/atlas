/* ===================================================================
   ATLAS — Dashboard (render)
   =================================================================== */

const D = ATLAS_DATA;

/* ---- Saudação ---- */
document.getElementById('saudacao').textContent =
  `${D.usuario.saudacao}, ${D.usuario.nome}`;
document.getElementById('evoTotal').textContent = D.evolucao.total;
document.getElementById('evoVar').textContent = D.evolucao.variacao;

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
  const ctx = document.getElementById('chartEvolucao').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, 'rgba(0,191,255,0.35)');
  grad.addColorStop(1, 'rgba(0,191,255,0)');

  // escala dinâmica a partir dos dados reais
  const vals = (D.evolucao.valores && D.evolucao.valores.length) ? D.evolucao.valores : [0, 1];
  const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  const pad = Math.max((hi - lo) * 0.25, hi * 0.05, 1);
  const yMin = Math.max(0, Math.floor((lo - pad) / 1000) * 1000);
  const yMax = Math.ceil((hi + pad) / 1000) * 1000;
  const yStep = Math.max(1000, Math.round((yMax - yMin) / 5 / 1000) * 1000);

  new Chart(ctx, {
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
          ticks: { callback: (v) => (v/1000) + 'K', stepSize: yStep },
          min: yMin, max: yMax, border: { display: false },
        },
        x: { grid: { display: false }, border: { display: false } },
      },
    },
  });
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

donut('chartCategoria', 'legendCategoria', D.categoria);
donut('chartBlockchain', 'legendBlockchain', D.blockchain);

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
