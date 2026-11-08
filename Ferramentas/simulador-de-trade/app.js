/* ══════════════════════════════════════
   ESTADO
══════════════════════════════════════ */
let dir = 'long';
/* A banca fica guardada neste navegador (atlas.trade-sim.banca.v1). */
const CHAVE_BANCA = 'atlas.trade-sim.banca.v1';
let banca = (function(){
  try{
    const b = JSON.parse(localStorage.getItem(CHAVE_BANCA) || 'null');
    if(b && isFinite(b.inicial) && isFinite(b.atual) && Array.isArray(b.entradas)) return b;
  }catch(e){}
  return { inicial: 50, atual: 50, entradas: [] };
})();
function salvarBanca(){ try{ localStorage.setItem(CHAVE_BANCA, JSON.stringify(banca)); }catch(e){} }
/* ── MARGEM DE MANUTENCAO ──────────────────────────────────────────
   A liquidacao NAO acontece quando voce perde 100% da margem: acontece
   antes, quando o patrimonio da posicao cai abaixo da margem de
   manutencao exigida pela corretora. Ignorar isso fazia o simulador
   dizer que voce tinha mais folga do que realmente tem — erro que
   aponta para o lado perigoso.

   0,5% e a taxa tipica de pares majoritarios em alavancagem baixa
   (Binance/Bybit). Ela sobe conforme o tamanho da posicao e a
   alavancagem, entao trate o resultado como otimista, nao exato.
   Taxas de corretagem e funding tambem nao entram na conta.          */
const MMR = 0.005;

/* Deducao exata em /ferramentas-core.js, testada no Node.

   A versao que ficava aqui aplicava a margem de manutencao sobre a
   posicao ao preco de ENTRADA. A diferenca era pequena mas tinha sinal:
   no long liquidava cedo demais (lado seguro) e no SHORT tarde demais --
   dizia que voce tinha mais folga do que tem, que e o lado perigoso.  */
function limiteLiquidacao(lev){
  return window.AtlasCalculos.limiteLiquidacaoPct(lev, dir, MMR);
}

let ultimoLiquido = 0;       // resultado projetado do take profit (no alvo)
let ultimoLiquidado = false;
let ultimoPnlSaidaPct = 0;   // retorno alavancado (%) no take profit
let slInfo = null;           // { mov, pnlPct, resultado, liquidado } | null

let selectedAsset = { id:'bitcoin', symbol:'BTC', name:'Bitcoin', manual:false };

const el = id => document.getElementById(id);

/* ══════════════════════════════════════
   HELPERS DE FORMATO
══════════════════════════════════════ */
function fmt(v){ return (v<0?'-':'') + '$' + Math.abs(v).toFixed(2); }
function signed(v){ return (v>=0?'+':'-') + '$' + Math.abs(v).toFixed(2); }
function pct(v){ return (v>=0?'+':'') + v.toFixed(1) + '%'; }
function reinvestirOn(){ return el('toggle-reinvestir').checked; }
function getMargem(){ return reinvestirOn() ? banca.atual : (parseFloat(el('aposta').value) || 0); }
function decimalsForPrice(p){
  if(p >= 100) return 2;
  if(p >= 1) return 3;
  if(p >= 0.01) return 5;
  return 8;
}
function debounce(fn, ms){
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ══════════════════════════════════════
   CONTROLES
══════════════════════════════════════ */
function setDirection(d){
  dir = d;
  el('btn-long').classList.toggle('active', d==='long');
  el('btn-short').classList.toggle('active', d==='short');
  calcular();
}

function onLeverageChange(){
  const v = el('lev-slider').value;
  el('lev-val').textContent = v + 'x';
  el('cenario-lev-label').textContent = v + 'x';
  calcular();
}

/* ══════════════════════════════════════
   BUSCA DE ATIVO (CoinGecko /search)
══════════════════════════════════════ */
function applyManualMode(isManual){
  el('btn-fetch').style.display = isManual ? 'none' : 'block';
  el('preco-atual-wrap').style.display = isManual ? 'block' : 'none';
  const status = el('api-status');
  if(isManual){
    status.textContent = 'Modo manual — digite os preços abaixo.';
    status.style.color = 'var(--muted)';
  }
}

function selectAsset(asset){
  selectedAsset = asset;
  el('asset-search').value = asset.manual ? asset.name : `${asset.name} (${asset.symbol.toUpperCase()})`;
  el('chart-asset-name').textContent = asset.manual ? asset.name : `${asset.name} (${asset.symbol.toUpperCase()})`;
  closeAssetResults();
  applyManualMode(asset.manual);
  if(asset.manual){
    candleData = [];
    drawChart();
  } else {
    fetchPrice();
    fetchKlines();
  }
  calcular();
}

function closeAssetResults(){
  el('asset-search-results').classList.remove('open');
}

// texto vindo da CoinGecko ou digitado nunca entra cru no HTML
const escH = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const urlSegura = u => /^https:\/\//.test(u || '') ? u : '';

function renderAssetResults(coins, query){
  const box = el('asset-search-results');
  let html = '';
  if(coins === null){
    html += '<div class="asr-loading">Buscando…</div>';
  } else if(coins.length === 0){
    html += '<div class="asr-empty">Nenhum ativo encontrado.</div>';
  } else {
    html += coins.slice(0, 8).map(c => `
      <div class="asr-item" data-id="${escH(c.id)}" data-symbol="${escH(c.symbol)}" data-name="${escH(c.name)}" data-thumb="${escH(urlSegura(c.thumb))}">
        ${urlSegura(c.thumb) ? `<img src="${escH(c.thumb)}" alt="">` : '<span class="asr-icon-fallback"></span>'}
        <span class="asr-name">${escH(c.name)}</span>
        <span class="asr-sym">${escH(String(c.symbol || '').toUpperCase())}</span>
      </div>`).join('');
  }
  if(query && query.trim() !== ''){
    html += `<div class="asr-item asr-manual" data-manual="1">➕ Usar "${escH(query)}" como ativo manual</div>`;
  }
  box.innerHTML = html;
  box.classList.add('open');

  box.querySelectorAll('.asr-item[data-id]').forEach(item => {
    item.addEventListener('click', () => {
      selectAsset({
        id: item.dataset.id,
        symbol: item.dataset.symbol,
        name: item.dataset.name,
        manual: false
      });
    });
  });
  const manualItem = box.querySelector('.asr-manual');
  if(manualItem){
    manualItem.addEventListener('click', () => {
      selectAsset({ id:null, symbol:'', name: query.trim(), manual:true });
    });
  }
}

const runAssetSearch = debounce(async (query) => {
  if(!query || query.trim().length < 2){
    closeAssetResults();
    return;
  }
  renderAssetResults(null, query);
  try{
    const data = await AtlasHttp.getJSON(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`, { ttl: 300000 });
    renderAssetResults((data.coins || []).map(c => ({ id:c.id, symbol:c.symbol, name:c.name, thumb:c.thumb })), query);
  }catch(e){
    renderAssetResults([], query);
  }
}, 350);

function initAssetSearch(){
  const input = el('asset-search');
  input.value = `${selectedAsset.name} (${selectedAsset.symbol})`;
  input.addEventListener('input', () => runAssetSearch(input.value));
  input.addEventListener('focus', () => { if(input.value.trim().length >= 2) runAssetSearch(input.value); });
  document.addEventListener('click', (evt) => {
    if(!evt.target.closest('.asset-search-field')) closeAssetResults();
  });
}

/* ══════════════════════════════════════
   PREÇO AO VIVO
══════════════════════════════════════ */
async function fetchPrice(){
  if(selectedAsset.manual || !selectedAsset.id) return;
  const status = el('api-status');
  status.textContent = 'Buscando preço ao vivo…';
  status.style.color = 'var(--ciano)';
  try{
    const data = await AtlasHttp.getJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(selectedAsset.id)}&vs_currencies=usd`, { ttl: 60000 });
    const preco = data[selectedAsset.id].usd;
    el('entrada').value = preco;
    if((parseFloat(el('saida').value) || 0) === 0){
      el('saida').value = (preco * 1.05).toFixed(decimalsForPrice(preco));
    }
    status.textContent = 'Preço atualizado pela CoinGecko.';
    status.style.color = 'var(--verde)';
    calcular();
  }catch(e){
    status.textContent = 'Erro ao conectar à API. Digite manualmente.';
    status.style.color = 'var(--vermelho)';
  }
}

/* ══════════════════════════════════════
   BANCA
══════════════════════════════════════ */
function setBancaInicial(){
  const v = parseFloat(el('banca-inicial').value) || 0;
  const delta = banca.atual - banca.inicial;   // preserva o lucro/prejuízo já acumulado
  banca.inicial = v;
  banca.atual = banca.entradas.length ? (v + delta) : v;
  renderBanca();
  calcular();
}

function toggleReinvestir(){
  const on = reinvestirOn();
  el('aposta-wrap').style.display = on ? 'none' : 'block';
  if(!on) el('aposta').value = banca.atual.toFixed(2);
  calcular();
}

function registrarEntrada(){
  const ov = el('override').value.trim();
  let res;
  if(ov !== '' && !isNaN(parseFloat(ov))){
    res = parseFloat(ov);
  } else {
    if(getMargem() <= 0){ return; }
    res = ultimoLiquido;
  }
  banca.entradas.push({ res, antes: banca.atual, depois: banca.atual + res });
  banca.atual += res;
  el('override').value = '';
  renderBanca();
  calcular();
}

function desfazer(){
  if(!banca.entradas.length) return;
  const last = banca.entradas.pop();
  banca.atual = last.antes;
  renderBanca();
  calcular();
}

function resetarBanca(){
  banca.atual = banca.inicial;
  banca.entradas = [];
  el('override').value = '';
  renderBanca();
  calcular();
}

function renderBanca(){
  salvarBanca();
  const cresc = banca.atual - banca.inicial;
  const crescPct = banca.inicial > 0 ? (cresc / banca.inicial) * 100 : 0;
  const n = banca.entradas.length;
  const media = n ? cresc / n : 0;

  el('st-banca').textContent = fmt(banca.atual);
  el('st-cresc').textContent = signed(cresc);
  el('st-cresc').className = 'st-val ' + (cresc>=0 ? 'verde' : 'vermelho');
  el('st-cresc-pct').textContent = pct(crescPct);
  el('st-cresc-pct').className = 'st-val ' + (cresc>=0 ? 'verde' : 'vermelho');
  el('st-entradas').textContent = n;
  el('st-media').textContent = signed(media);
  el('st-media').className = 'st-val ' + (media>=0 ? 'verde' : 'vermelho');

  const hist = el('hist');
  if(!n){
    hist.innerHTML = '<div class="hist-empty">Nenhuma entrada registrada ainda.</div>';
  } else {
    hist.innerHTML = banca.entradas.map((e,i)=>{
      const cls = e.res>=0 ? 'verde' : 'vermelho';
      return `<div class="hist-item">
        <span class="hi-n">#${i+1}</span>
        <span class="hi-res ${cls}">${signed(e.res)}</span>
        <span class="hi-saldo">→ ${fmt(e.depois)}</span>
      </div>`;
    }).reverse().join('');
  }
}

/* ══════════════════════════════════════
   PROJEÇÃO DA BANCA (take profit atual)
══════════════════════════════════════ */
function atualizarPreview(assetMov, lev){
  const M = getMargem();
  const entrada = parseFloat(el('entrada').value) || 0;
  const box = el('preview-banca');

  if(entrada <= 0 || M <= 0){
    box.innerHTML = 'Preencha entrada, alvo e banca para ver a projeção.';
    ultimoLiquido = 0; ultimoLiquidado = false;
    return;
  }

  let pnlPct = assetMov * lev;
  ultimoLiquidado = pnlPct <= limiteLiquidacao(lev);
  ultimoLiquido = ultimoLiquidado ? -M : M * (pnlPct/100);

  const proj = banca.atual + ultimoLiquido;
  const pctTrade = banca.atual > 0 ? (ultimoLiquido / banca.atual) * 100 : 0;

  if(ultimoLiquidado){
    box.innerHTML = `<span class="vermelho">⚠ LIQUIDADO</span> — perda de <b>${fmt(M)}</b> (margem inteira).<br>
      Banca <b>${fmt(banca.atual)}</b> → <b class="vermelho">${fmt(proj)}</b><br>
      <span style="font-size:.72rem;opacity:.75">Liquidação estimada com margem de manutenção de ${(MMR*100).toFixed(1)}%. Taxas e funding não entram na conta.</span>`;
    return;
  }
  const cls = ultimoLiquido >= 0 ? 'verde' : 'vermelho';
  box.innerHTML = `Se bater o take profit: banca <b>${fmt(banca.atual)}</b> → <b class="${cls}">${fmt(proj)}</b><br>
    Resultado: <b class="${cls}">${signed(ultimoLiquido)} (${pct(pctTrade)})</b>`;
}

/* ══════════════════════════════════════
   CÁLCULO PRINCIPAL
══════════════════════════════════════ */
function calcular(){
  const entrada = parseFloat(el('entrada').value) || 0;
  const saida   = parseFloat(el('saida').value) || 0;
  const sl      = parseFloat(el('stop-loss').value) || 0;
  const lev     = parseInt(el('lev-slider').value) || 1;
  const M       = getMargem();

  // Badge de posição no gráfico
  const symTxt = selectedAsset.manual ? (selectedAsset.name || 'Manual') : selectedAsset.symbol.toUpperCase();
  el('chart-badge').innerHTML = `${escH(symTxt)} · <span class="badge-${dir}">${dir==='long'?'LONG':'SHORT'}</span> · Entrada ${fmt(entrada)} · ${lev}x`;

  if(entrada <= 0){ atualizarPreview(0, lev); slInfo = null; drawChart(); return; }

  const assetMov = dir==='long' ? ((saida-entrada)/entrada)*100 : ((entrada-saida)/entrada)*100;
  ultimoPnlSaidaPct = assetMov * lev;

  // Cards
  el('card-pos').textContent = fmt(M * lev);
  el('card-mov').textContent = (assetMov>=0?'+':'') + assetMov.toFixed(2) + '%';
  el('card-mov').className = assetMov>=0 ? 'verde' : 'vermelho';

  /* long:  entrada * (1 - 1/lev + MMR)   short: entrada * (1 + 1/lev - MMR)
     O termo MMR aproxima a liquidacao da entrada — e menos folga, nao mais. */
  let liq = window.AtlasCalculos.precoLiquidacao({entrada:entrada, alavancagem:lev, direcao:dir, mmr:MMR});
  if(liq < 0) liq = 0;
  el('card-liq').textContent = fmt(liq);

  // Stop loss
  if(sl > 0){
    const slMov = dir==='long' ? ((sl-entrada)/entrada)*100 : ((entrada-sl)/entrada)*100;
    const slPnlPct = slMov * lev;
    const slLiquidado = slPnlPct <= limiteLiquidacao(lev);
    const slResultado = slLiquidado ? -M : M * (slPnlPct/100);
    slInfo = { mov: slMov, pnlPct: slPnlPct, resultado: slResultado, liquidado: slLiquidado };
    el('card-sl').textContent = signed(slResultado);
    el('card-sl').className = slResultado >= 0 ? 'verde' : 'vermelho';
  } else {
    slInfo = null;
    el('card-sl').textContent = '—';
    el('card-sl').className = 'muted-val';
  }

  // Card take profit
  el('card-tp').textContent = signed(ultimoLiquido);
  el('card-tp').className = ultimoLiquido >= 0 ? 'verde' : 'vermelho';

  // Matriz por alavancagem
  let m = '';
  [1,2,3,4,5,6,7,8,9,10].forEach(L=>{
    let pnl = assetMov * L;
    let lucro = M * (pnl/100);
    let lp = dir==='long' ? entrada*(1-(1/L)) : entrada*(1+(1/L));
    if(lp < 0) lp = 0;
    let pnlTxt = (pnl>=0?'+':'') + pnl.toFixed(2) + '%';
    let lucroTxt = signed(lucro);
    let cls = pnl>=0 ? 'verde' : 'vermelho';
    if(pnl <= -100){ pnlTxt='LIQUIDADO'; lucroTxt=fmt(-M); cls='vermelho'; }
    m += `<tr><td><strong>${L}x</strong></td><td>${assetMov.toFixed(2)}%</td>
      <td class="${cls}">${pnlTxt}</td><td class="${cls}">${lucroTxt}</td>
      <td class="liq">${fmt(lp)}</td></tr>`;
  });
  el('matrix-body').innerHTML = m;

  // Cenários rápidos
  let s = '';
  [0.05,0.10,-0.05,-0.10].forEach(mov=>{
    let scP = entrada*(1+mov);
    let ret1 = dir==='long' ? mov*100 : -mov*100;
    let retA = ret1 * lev;
    let nomA = M * (retA/100);
    let txtA = (retA>=0?'+':'') + retA.toFixed(2) + '%';
    let txtN = signed(nomA);
    let cls = retA>=0 ? 'verde' : 'vermelho';
    if(retA <= -100){ txtA='LIQUIDADO'; txtN=fmt(-M); cls='vermelho'; }
    let nome = (mov>0?'🟢 Alta':'🔴 Queda') + ' ' + Math.abs(mov*100) + '%';
    s += `<tr><td><strong>${nome}</strong></td><td>${fmt(scP)}</td>
      <td class="${ret1>=0?'verde':'vermelho'}">${(ret1>=0?'+':'')}${ret1.toFixed(2)}%</td>
      <td class="${cls}">${txtA} (${txtN})</td></tr>`;
  });
  el('scenarios-body').innerHTML = s;

  // Projeção da banca
  atualizarPreview(assetMov, lev);

  // Redesenha as linhas do gráfico (entrada/TP/SL/liquidação)
  if(typeof drawChart === 'function') drawChart();
}

/* ══════════════════════════════════════
   GRÁFICO — candles Binance + linhas arrastáveis
══════════════════════════════════════ */
let candleData = [];
let chartInterval = '1h';
let chartCtx = null;
let chartW = 0, chartH = 480;
let dragTarget = null; // 'entrada' | 'saida' | 'stop-loss'
const CHART_PAD = { top:16, right:88, bottom:22, left:10 };

function tokens(){
  const cs = getComputedStyle(document.documentElement);
  return {
    ciano: (cs.getPropertyValue('--cyan')||'#22D3EE').trim(),
    verde: (cs.getPropertyValue('--green')||'#14F195').trim(),
    vermelho: (cs.getPropertyValue('--red')||'#FF4D6A').trim(),
    dourado: (cs.getPropertyValue('--gold')||'#F5B614').trim(),
    roxo: (cs.getPropertyValue('--purple')||'#9945FF').trim(),
    muted: '#9b9ba6',
    grid: 'rgba(255,255,255,.06)'
  };
}

function setupCanvas(){
  const canvas = el('trade-chart');
  const drawCanvas = el('draw-layer');
  const wrap = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const rect = wrap.getBoundingClientRect();
  chartW = rect.width;
  chartH = rect.height || 480;
  [canvas, drawCanvas].forEach(c => {
    c.width = chartW * dpr;
    c.height = chartH * dpr;
    c.style.width = chartW + 'px';
    c.style.height = chartH + 'px';
    c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  });
  chartCtx = canvas.getContext('2d');
  drawCtx = drawCanvas.getContext('2d');
}

function priceRange(){
  const entrada = parseFloat(el('entrada').value) || 0;
  const saida = parseFloat(el('saida').value) || 0;
  const sl = parseFloat(el('stop-loss').value) || 0;
  const liq = parseFloat((el('card-liq').textContent||'').replace(/[^0-9.]/g,'')) || 0;
  const precoManual = parseFloat(el('preco-atual-manual').value) || 0;
  let vals = candleData.length ? candleData.flatMap(c => [c.h, c.l]) : [];
  [entrada, saida, sl, liq, precoManual].forEach(v => { if(v > 0) vals.push(v); });
  if(!vals.length) return { min:0, max:1 };
  let min = Math.min(...vals), max = Math.max(...vals);
  if(min === max){ min *= 0.98; max *= 1.02; }
  const pad = (max - min) * 0.1;
  return { min: Math.max(0, min - pad), max: max + pad };
}

function priceToY(price, range){
  const usable = chartH - CHART_PAD.top - CHART_PAD.bottom;
  return CHART_PAD.top + (1 - (price - range.min) / (range.max - range.min)) * usable;
}
function yToPrice(y, range){
  const usable = chartH - CHART_PAD.top - CHART_PAD.bottom;
  const ratio = 1 - (y - CHART_PAD.top) / usable;
  return range.min + ratio * (range.max - range.min);
}

function drawLine(ctx, y, color, label, dashed){
  const usableRight = chartW - CHART_PAD.right;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  if(dashed) ctx.setLineDash([5,4]);
  ctx.beginPath();
  ctx.moveTo(CHART_PAD.left, y);
  ctx.lineTo(usableRight, y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = '700 10px "JetBrains Mono", monospace';
  const textW = ctx.measureText(label).width;
  const boxW = Math.max(CHART_PAD.right - 6, textW + 14);
  ctx.fillStyle = color;
  ctx.fillRect(usableRight + 4, y - 9, boxW, 18);
  ctx.fillStyle = '#04060a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, usableRight + 4 + boxW/2, y + 1);
  ctx.restore();
}

function drawChart(){
  if(!chartCtx) return;
  const ctx = chartCtx;
  const T = tokens();
  ctx.clearRect(0, 0, chartW, chartH);

  const msg = el('chart-msg');
  const semCandles = selectedAsset.manual || candleData.length === 0;
  if(msg) msg.style.display = semCandles ? 'flex' : 'none';

  const range = priceRange();

  // grid horizontal
  ctx.strokeStyle = T.grid;
  const usable = chartH - CHART_PAD.top - CHART_PAD.bottom;
  for(let i=0;i<=4;i++){
    const y = CHART_PAD.top + (usable/4)*i;
    ctx.beginPath();
    ctx.moveTo(CHART_PAD.left, y);
    ctx.lineTo(chartW - CHART_PAD.right, y);
    ctx.stroke();
  }

  // candles
  if(candleData.length){
    const n = candleData.length;
    const usableW = chartW - CHART_PAD.left - CHART_PAD.right;
    const slot = usableW / n;
    const bodyW = Math.max(1.5, slot * 0.6);
    candleData.forEach((c, i) => {
      const x = CHART_PAD.left + slot * i + slot/2;
      const yO = priceToY(c.o, range);
      const yC = priceToY(c.c, range);
      const yH = priceToY(c.h, range);
      const yL = priceToY(c.l, range);
      const up = c.c >= c.o;
      const color = up ? T.verde : T.vermelho;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yH);
      ctx.lineTo(x, yL);
      ctx.stroke();
      const top = Math.min(yO, yC);
      const h = Math.max(1, Math.abs(yC - yO));
      ctx.fillRect(x - bodyW/2, top, bodyW, h);
    });
  }

  // linhas de referência
  const entrada = parseFloat(el('entrada').value) || 0;
  const saida = parseFloat(el('saida').value) || 0;
  const sl = parseFloat(el('stop-loss').value) || 0;
  const liq = parseFloat((el('card-liq').textContent||'').replace(/[^0-9.]/g,'')) || 0;
  const precoManual = parseFloat(el('preco-atual-manual').value) || 0;

  if(precoManual > 0){
    drawLine(ctx, priceToY(precoManual, range), T.muted, 'Atual ' + precoManual.toFixed(decimalsForPrice(precoManual)), true);
  }
  if(liq > 0) drawLine(ctx, priceToY(liq, range), T.dourado, 'LIQ ' + liq.toFixed(decimalsForPrice(liq)), true);
  if(sl > 0) drawLine(ctx, priceToY(sl, range), T.vermelho, 'SL ' + sl.toFixed(decimalsForPrice(sl)) + ' (' + (slInfo? slInfo.pnlPct.toFixed(1):'0') + '%)', false);
  if(entrada > 0) drawLine(ctx, priceToY(entrada, range), T.ciano, entrada.toFixed(decimalsForPrice(entrada)), false);
  if(saida > 0) drawLine(ctx, priceToY(saida, range), T.verde, 'TP ' + saida.toFixed(decimalsForPrice(saida)) + ' (' + (ultimoPnlSaidaPct>=0?'+':'') + ultimoPnlSaidaPct.toFixed(1) + '%)', false);
}

async function fetchKlines(){
  if(selectedAsset.manual || !selectedAsset.symbol){
    candleData = [];
    drawChart();
    return;
  }
  const symbol = selectedAsset.symbol.toUpperCase() + 'USDT';
  try{
    /* Duas portas da Binance (a api.binance.com é bloqueada em alguns
       países e redes; a data-api.binance.vision é só de cotações) e, se o
       token não tiver par em USDT, as velas da CoinGecko. */
    let data = null;
    for(const host of ['https://data-api.binance.vision','https://api.binance.com']){
      try{
        const d = await AtlasHttp.getJSON(`${host}/api/v3/klines?symbol=${symbol}&interval=${chartInterval}&limit=100`, { ttl: 60000, retries: 0 });
        if(Array.isArray(d) && d.length){ data = d; break; }
      }catch(_){}
    }
    if(data){
      candleData = data.map(k => ({ t:k[0], o:+k[1], h:+k[2], l:+k[3], c:+k[4] }));
    }else{
      const days = {'15m':1,'1h':7,'4h':30,'1d':180}[chartInterval] || 7;
      const d = await AtlasHttp.getJSON(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(selectedAsset.id)}/ohlc?vs_currency=usd&days=${days}`, { ttl: 300000 });
      if(!Array.isArray(d) || !d.length) throw new Error('sem dados');
      candleData = d.slice(-100).map(k => ({ t:k[0], o:+k[1], h:+k[2], l:+k[3], c:+k[4] }));
    }
  }catch(e){
    candleData = [];
  }
  drawChart();
}

/* Interação de arrastar as linhas de entrada / TP / SL */
function hitTest(y){
  const range = priceRange();
  const entrada = parseFloat(el('entrada').value) || 0;
  const saida = parseFloat(el('saida').value) || 0;
  const sl = parseFloat(el('stop-loss').value) || 0;
  const candidates = [];
  if(entrada > 0) candidates.push(['entrada', Math.abs(y - priceToY(entrada, range))]);
  if(saida > 0) candidates.push(['saida', Math.abs(y - priceToY(saida, range))]);
  if(sl > 0) candidates.push(['stop-loss', Math.abs(y - priceToY(sl, range))]);
  candidates.sort((a,b) => a[1]-b[1]);
  if(candidates.length && candidates[0][1] <= 9) return candidates[0][0];
  return null;
}

function pointerXY(evt, canvas){
  const rect = canvas.getBoundingClientRect();
  const point = evt.touches ? evt.touches[0] : evt;
  return { x: point.clientX - rect.left, y: point.clientY - rect.top };
}

function initChartInteraction(){
  const canvas = el('trade-chart');

  function onDown(evt){
    const { y } = pointerXY(evt, canvas);
    const target = hitTest(y);
    if(target){
      dragTarget = target;
      canvas.classList.add('dragging');
      evt.preventDefault();
    }
  }
  function onMove(evt){
    if(!dragTarget) return;
    const { y } = pointerXY(evt, canvas);
    const range = priceRange();
    let price = yToPrice(y, range);
    if(price < 0) price = 0;
    price = parseFloat(price.toFixed(decimalsForPrice(price)));
    el(dragTarget).value = price;
    calcular();
    evt.preventDefault();
  }
  function onUp(){
    if(dragTarget){ dragTarget = null; canvas.classList.remove('dragging'); }
  }

  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('touchstart', onDown, { passive:false });
  window.addEventListener('touchmove', onMove, { passive:false });
  window.addEventListener('touchend', onUp);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { setupCanvas(); drawChart(); redrawDrawings(); }, 120);
  });

  el('chart-tf').addEventListener('click', (evt) => {
    const btn = evt.target.closest('button[data-tf]');
    if(!btn) return;
    document.querySelectorAll('#chart-tf button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    chartInterval = btn.dataset.tf;
    fetchKlines();
  });
}

/* ══════════════════════════════════════
   LÁPIS — desenho livre sobre o gráfico
══════════════════════════════════════ */
let drawCtx = null;
let drawMode = false;
let drawings = [];      // array de traços; cada traço é array de {xr,yr} (frações 0-1)
let currentStroke = null;

function redrawDrawings(){
  if(!drawCtx) return;
  drawCtx.clearRect(0, 0, chartW, chartH);
  drawCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim() || '#22D3EE';
  drawCtx.lineWidth = 2;
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';
  drawings.forEach(stroke => {
    if(stroke.length < 2) return;
    drawCtx.beginPath();
    drawCtx.moveTo(stroke[0].xr * chartW, stroke[0].yr * chartH);
    stroke.slice(1).forEach(p => drawCtx.lineTo(p.xr * chartW, p.yr * chartH));
    drawCtx.stroke();
  });
}

function initDrawTool(){
  const drawLayer = el('draw-layer');
  const btnPencil = el('btn-pencil');
  const btnClear = el('btn-clear-draw');

  function setDrawMode(on){
    drawMode = on;
    drawLayer.classList.toggle('draw-active', on);
    btnPencil.classList.toggle('active', on);
  }

  btnPencil.addEventListener('click', () => setDrawMode(!drawMode));
  btnClear.addEventListener('click', () => { drawings = []; redrawDrawings(); });

  function onDown(evt){
    if(!drawMode) return;
    const { x, y } = pointerXY(evt, drawLayer);
    currentStroke = [{ xr: x/chartW, yr: y/chartH }];
    drawings.push(currentStroke);
    evt.preventDefault();
  }
  function onMove(evt){
    if(!drawMode || !currentStroke) return;
    const { x, y } = pointerXY(evt, drawLayer);
    currentStroke.push({ xr: x/chartW, yr: y/chartH });
    redrawDrawings();
    evt.preventDefault();
  }
  function onUp(){ currentStroke = null; }

  drawLayer.addEventListener('mousedown', onDown);
  drawLayer.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  drawLayer.addEventListener('touchstart', onDown, { passive:false });
  drawLayer.addEventListener('touchmove', onMove, { passive:false });
  window.addEventListener('touchend', onUp);
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
window.onload = () => {
  renderBanca();
  initAssetSearch();
  applyManualMode(false);
  fetchPrice();
  setupCanvas();
  initChartInteraction();
  initDrawTool();
  fetchKlines();
};
