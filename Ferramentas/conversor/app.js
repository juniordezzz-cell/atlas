/* =========================================================
   ATLAS · Conversor e Câmbio (Ferramentas/conversor/)
   Registro: docs/ferramentas-bancada-2026-11-08.md
   BRL / USD / EUR ⇄ as maiores criptos do mercado
   Estilo tradutor: inverte direção com ⇄
   ========================================================= */

const API = 'https://api.coingecko.com/api/v3';

/* Rede só pelo AtlasHttp (core/http.js): timeout, nova tentativa e
   cache. O resto do script foi escrito sobre fetch (r.ok / r.json()),
   então cgFetch devolve um objeto com essa mesma cara. Lista grande de
   mercado fica 10 min em cache, gráfico 5 min, preço 1 min. */
function ttlDe(url) {
  if (/per_page=250/.test(url)) return 600000;
  if (/market_chart/.test(url)) return 300000;
  return 60000;
}
async function cgFetch(url) {
  try {
    const d = await AtlasHttp.getJSON(url, { ttl: ttlDe(url), timeout: 12000 });
    return { ok: true, status: 200, json: async () => d };
  } catch (e) {
    return { ok: false, status: e.status || 0, json: async () => null };
  }
}

const FIATS = {
  brl: { code:'BRL', simbolo:'R$', nome:'Real (BRL)',  artigo:'Real brasileiro' },
  usd: { code:'USD', simbolo:'$',  nome:'Dólar (USD)', artigo:'Dólar americano' },
  eur: { code:'EUR', simbolo:'€',  nome:'Euro (EUR)',  artigo:'Euro' },
};

const POPULARES = ['bitcoin','ethereum','solana','ripple','dogecoin','aave'];
const POPULARES_SYM = { bitcoin:'BTC', ethereum:'ETH', solana:'SOL', ripple:'XRP', dogecoin:'DOGE', aave:'AAVE' };
const QUANTIDADES = [1, 5, 10, 50, 100, 500, 1000];

// ---------- estado ----------
let LISTA = [];            // maiores por market cap: {id, sym, nome, img, rank}
let fiatAtual = 'brl';
let moedaAtual = { id:'bitcoin', sym:'BTC', nome:'Bitcoin', img:'' };
let precosFiat = null;     // { brl, usd, eur } — preço de 1 token
let diasGrafico = 7;
let ultimoCampo = 'fiat';
let focoDropdown = -1;

// ---------- formatação pt-BR ----------
const fmtMoeda = (v, fiat = fiatAtual) =>
  (v == null || isNaN(v))
    ? '—'
    : v.toLocaleString('pt-BR', { style:'currency', currency:FIATS[fiat].code, maximumFractionDigits: v < 1 ? 6 : 2 });
const fmtNum = (v, dec) =>
  (v == null || isNaN(v)) ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: dec });
const fmtCompacto = v => {
  if (v == null || isNaN(v)) return '—';
  const s = FIATS[fiatAtual].simbolo + ' ';
  if (v >= 1e12) return s + fmtNum(v/1e12, 2) + ' tri';
  if (v >= 1e9)  return s + fmtNum(v/1e9, 2)  + ' bi';
  if (v >= 1e6)  return s + fmtNum(v/1e6, 2)  + ' mi';
  return fmtMoeda(v);
};
const decCripto = v => v >= 100 ? 2 : v >= 1 ? 4 : 8;
// número digitado no formato brasileiro ("1.000", "0,5"): contas comuns da bancada
const lerInput = el => window.AtlasCalculos.lerNumero(el.value);
const esc = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ---------- top 500 (carregada sob demanda + cache) ----------
const CACHE_LISTA = 'atlas.conversor.top.v1';
const CACHE_HORAS = 12;
let listaPromise = null;

// só carrega a lista quando realmente precisa (foco na busca)
function garantirLista() {
  if (LISTA.length) return Promise.resolve();
  if (!listaPromise) {
    listaPromise = carregarTop500()
      .then(() => { montarChips(); })
      .catch(e => { listaPromise = null; throw e; });
  }
  return listaPromise;
}

async function carregarTop500() {
  // 1) tenta o cache do navegador
  try {
    const raw = localStorage.getItem(CACHE_LISTA);
    if (raw) {
      const { t, lista } = JSON.parse(raw);
      if (Date.now() - t < CACHE_HORAS * 3600e3 && Array.isArray(lista) && lista.length) {
        LISTA = lista;
        return;
      }
    }
  } catch (e) { /* cache inválido: ignora */ }

  // 2) busca na CoinGecko (2 chamadas, só desta vez)
  const paginas = await Promise.all([1, 2].map(p =>
    cgFetch(`${API}/coins/markets?vs_currency=brl&order=market_cap_desc&per_page=250&page=${p}&sparkline=false`)
      .then(r => { if (!r.ok) throw new Error('top500 ' + r.status); return r.json(); })
  ));
  LISTA = paginas.flat().map((c, i) => ({
    id: c.id, sym: (c.symbol || '').toUpperCase(),
    nome: c.name || c.id, img: c.image || '', rank: c.market_cap_rank || (i + 1),
  }));

  // 3) guarda em cache pra não buscar de novo nas próximas visitas
  try { localStorage.setItem(CACHE_LISTA, JSON.stringify({ t: Date.now(), lista: LISTA })); } catch (e) {}
}

// ---------- busca / autocomplete ----------
const dropdown = document.getElementById('dropdown');
const inputBusca = document.getElementById('input-busca');

function abrirDropdown(filtro = '') {
  focoDropdown = -1;
  const termo = filtro.trim().toLowerCase();
  let resultados;
  if (!termo) {
    const pop = POPULARES.map(id => LISTA.find(c => c.id === id)).filter(Boolean);
    resultados = pop.length ? pop : LISTA.slice(0, 8);
  } else {
    const comeca = LISTA.filter(c => c.sym.toLowerCase().startsWith(termo) || c.nome.toLowerCase().startsWith(termo));
    const contem = LISTA.filter(c => !comeca.includes(c) &&
      (c.sym.toLowerCase().includes(termo) || c.nome.toLowerCase().includes(termo)));
    resultados = [...comeca, ...contem].slice(0, 8);
  }
  if (!LISTA.length) {
    dropdown.innerHTML = '<div class="vazio">Carregando lista de tokens…</div>';
  } else if (!resultados.length) {
    dropdown.innerHTML = '<div class="vazio">Nenhum token encontrado.</div>';
  } else {
    dropdown.innerHTML =
      (!termo ? '<div class="populares">Mais buscados:</div>' : '') +
      resultados.map((c, i) => `
        <div class="item" role="option" data-i="${i}" data-id="${esc(c.id)}">
          <img src="${esc(c.img)}" alt="" loading="lazy" onerror="this.style.display='none'">
          <span class="sym">${esc(c.sym)}</span>
          <span class="nome">${esc(c.nome)}</span>
          <span class="rank">#${c.rank}</span>
        </div>`).join('');
    dropdown.querySelectorAll('.item').forEach(el => {
      el.addEventListener('mousedown', e => { e.preventDefault(); selecionarPorId(el.dataset.id); });
    });
  }
  dropdown.classList.add('aberto');
}
function fecharDropdown() { dropdown.classList.remove('aberto'); focoDropdown = -1; }

inputBusca.addEventListener('focus', () => {
  inputBusca.select();
  const filtro = () => inputBusca.value === moedaAtual.sym ? '' : inputBusca.value;
  abrirDropdown(filtro());                       // mostra "carregando…" ou populares na hora
  garantirLista()
    .then(() => { if (document.activeElement === inputBusca) abrirDropdown(filtro()); })
    .catch(() => {});
});
inputBusca.addEventListener('input', () => abrirDropdown(inputBusca.value));
inputBusca.addEventListener('blur', () => setTimeout(() => { fecharDropdown(); inputBusca.value = moedaAtual.sym; }, 120));
inputBusca.addEventListener('keydown', e => {
  const itens = dropdown.querySelectorAll('.item');
  if (!itens.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    focoDropdown = e.key === 'ArrowDown'
      ? Math.min(focoDropdown + 1, itens.length - 1)
      : Math.max(focoDropdown - 1, 0);
    itens.forEach((el, i) => el.classList.toggle('foco', i === focoDropdown));
    itens[focoDropdown].scrollIntoView({ block:'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const alvo = itens[focoDropdown >= 0 ? focoDropdown : 0];
    if (alvo) selecionarPorId(alvo.dataset.id);
    inputBusca.blur();
  } else if (e.key === 'Escape') {
    fecharDropdown(); inputBusca.blur();
  }
});

function selecionarPorId(id) {
  const c = LISTA.find(m => m.id === id);
  if (!c) return;
  moedaAtual = c;
  history.replaceState(null, '', `?fiat=${fiatAtual}&cripto=${c.id}`);
  precosFiat = null;
  // zera o valor do ativo anterior e recomeça em "1 [nova cripto]"
  ultimoCampo = 'cripto';
  document.getElementById('input-cripto').value = '1';
  document.getElementById('input-fiat').value = '';
  atualizarRotulos();
  montarChips();
  fecharDropdown();
  iniciar();
}

// ---------- rótulos ----------
function atualizarRotulos() {
  const m = moedaAtual, f = FIATS[fiatAtual];
  document.getElementById('h1-fiat').textContent = f.nome;
  document.getElementById('h1-moeda').textContent = `${m.nome} (${m.sym})`;
  document.getElementById('taxa-sym').textContent = m.sym;
  document.getElementById('grafico-titulo').textContent = `${m.sym}/${f.code}`;
  document.getElementById('stats-nome').textContent = m.nome;
  document.querySelectorAll('.tab-sym').forEach(el => el.textContent = m.sym);
  document.querySelectorAll('.tab-fiat').forEach(el => el.textContent = f.code);
  document.title = `${f.code} para ${m.sym} — Converter ${f.artigo} em ${m.nome} — ATLAS`;
  inputBusca.value = m.sym;
  const img = document.getElementById('token-img');
  if (m.img) { img.src = m.img; img.style.display = 'block'; } else { img.style.display = 'none'; }
}

// ---------- chips de pares ----------
function montarChips() {
  const wrap = document.getElementById('chips-pares');
  const pares = [];
  // fiats diferentes pro token atual
  Object.keys(FIATS).filter(f => f !== fiatAtual).forEach(f =>
    pares.push({ fiat: f, id: moedaAtual.id, sym: moedaAtual.sym }));
  // tokens populares no fiat atual (usa o símbolo da lista, ou o fixo se ela ainda não carregou)
  POPULARES.filter(id => id !== moedaAtual.id).forEach(id => {
    const c = LISTA.find(m => m.id === id);
    const sym = c ? c.sym : POPULARES_SYM[id];
    if (sym) pares.push({ fiat: fiatAtual, id, sym });
  });
  wrap.innerHTML = pares.map(p =>
    `<a href="?fiat=${p.fiat}&cripto=${encodeURIComponent(p.id)}">${FIATS[p.fiat].code} → ${esc(p.sym)}</a>`
  ).join('');
}

// ---------- dados de mercado ----------
async function carregarDados() {
  // 1 chamada: preço do token nas três moedas (alimenta o conversor e a linha tri-fiat)
  const rSimple = await cgFetch(`${API}/simple/price?ids=${moedaAtual.id}&vs_currencies=brl,usd,eur`);
  if (!rSimple.ok) throw new Error('simple ' + rSimple.status);
  const dSimple = (await rSimple.json())[moedaAtual.id];
  if (!dSimple) throw new Error('sem preço');
  precosFiat = { brl: dSimple.brl, usd: dSimple.usd, eur: dSimple.eur };
  try { localStorage.setItem('atlas.conversor.cripto.' + moedaAtual.id, JSON.stringify({ p: precosFiat, t: Date.now() })); } catch (e) {}

  // 1 chamada: estatísticas completas no fiat selecionado
  const rMkt = await cgFetch(`${API}/coins/markets?vs_currency=${fiatAtual}&ids=${moedaAtual.id}&price_change_percentage=24h`);
  if (!rMkt.ok) throw new Error('markets ' + rMkt.status);
  const [d] = await rMkt.json();
  if (!d) throw new Error('sem dados');

  // hidrata identidade do token a partir desta mesma resposta (sem chamada extra)
  moedaAtual.sym  = (d.symbol || moedaAtual.sym).toUpperCase();
  moedaAtual.nome = d.name || moedaAtual.nome;
  moedaAtual.img  = d.image || moedaAtual.img;
  atualizarRotulos();
  montarChips();

  const preco = precosFiat[fiatAtual];

  // hero
  document.getElementById('taxa-valor').textContent = fmtMoeda(preco);
  const varEl = document.getElementById('taxa-var');
  const v = d.price_change_percentage_24h ?? 0;
  varEl.textContent = ` ${v >= 0 ? '▲' : '▼'} ${fmtNum(Math.abs(v), 2)}% (24h)`;
  varEl.className = 'variacao ' + (v >= 0 ? 'up' : 'down');
  document.getElementById('tri-fiat').innerHTML =
    `1 ${esc(moedaAtual.sym)} = <b>${fmtMoeda(precosFiat.brl,'brl')}</b><span class="sep">·</span>` +
    `<b>${fmtMoeda(precosFiat.usd,'usd')}</b><span class="sep">·</span>` +
    `<b>${fmtMoeda(precosFiat.eur,'eur')}</b>`;
  document.getElementById('atualizado').textContent =
    'Atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  document.getElementById('taxa-inversa').textContent =
    `${FIATS[fiatAtual].simbolo} 1 ≈ ${fmtNum(1 / preco, decCripto(1 / preco))} ${moedaAtual.sym}`;

  // estatísticas
  document.getElementById('st-min').textContent  = fmtMoeda(d.low_24h);
  document.getElementById('st-max').textContent  = fmtMoeda(d.high_24h);
  const stVar = document.getElementById('st-var');
  stVar.textContent = `${v >= 0 ? '+' : ''}${fmtNum(v, 2)}%`;
  stVar.className = 'valor ' + (v >= 0 ? 'up' : 'down');
  document.getElementById('st-mcap').textContent   = fmtCompacto(d.market_cap);
  document.getElementById('st-vol').textContent    = fmtCompacto(d.total_volume);
  document.getElementById('st-supply').textContent = fmtNum(d.circulating_supply, 0) + ' ' + moedaAtual.sym;
  document.getElementById('st-ath').textContent    = fmtMoeda(d.ath);
  const dist = ((preco - d.ath) / d.ath) * 100;
  const athEl = document.getElementById('st-ath-dist');
  athEl.textContent = `${fmtNum(dist, 1)}%`;
  athEl.className = 'valor ' + (dist >= 0 ? 'up' : 'down');

  montarTabelas();
  recalcular();
}

// ---------- tabelas dinâmicas ----------
function montarTabelas() {
  const preco = precosFiat[fiatAtual];
  const f = FIATS[fiatAtual];
  const tb1 = document.querySelector('#tabela-fiat tbody');
  const tb2 = document.querySelector('#tabela-cripto tbody');
  tb1.innerHTML = QUANTIDADES.map(q => {
    const eq = q / preco;
    return `<tr><td>${fmtMoeda(q)}</td><td>${fmtNum(eq, decCripto(eq))} ${moedaAtual.sym}</td></tr>`;
  }).join('');
  tb2.innerHTML = QUANTIDADES.map(q =>
    `<tr><td>${fmtNum(q, 0)} ${moedaAtual.sym}</td><td>${fmtMoeda(q * preco)}</td></tr>`
  ).join('');
}

// ---------- conversor bidirecional ----------
function recalcular() {
  if (!precosFiat) return;
  const preco = precosFiat[fiatAtual];
  const inFiat = document.getElementById('input-fiat');
  const inCri = document.getElementById('input-cripto');
  if (ultimoCampo === 'fiat') {
    const v = lerInput(inFiat);
    inCri.value = v === null ? '' : fmtNum(v / preco, decCripto(v / preco));
  } else {
    const v = lerInput(inCri);
    inFiat.value = v === null ? '' : fmtNum(v * preco, 2);
  }
}

document.getElementById('input-fiat').addEventListener('input', () => { ultimoCampo = 'fiat'; recalcular(); });
document.getElementById('input-cripto').addEventListener('input', () => { ultimoCampo = 'cripto'; recalcular(); });

// inverter direção (estilo Google Tradutor)
document.getElementById('btn-swap').addEventListener('click', () => {
  document.getElementById('tradutor').classList.toggle('invertido');
  ultimoCampo = ultimoCampo === 'fiat' ? 'cripto' : 'fiat';
  recalcular();
});

// troca de fiat
document.getElementById('select-fiat').addEventListener('change', e => {
  fiatAtual = e.target.value;
  history.replaceState(null, '', `?fiat=${fiatAtual}&cripto=${moedaAtual.id}`);
  atualizarRotulos();
  montarChips();
  // o conversor já tem os 3 preços em cache; só stats e gráfico precisam recarregar
  if (precosFiat) { recalcular(); montarTabelas(); }
  iniciar();
});

// ---------- gráfico SVG (sem biblioteca) ----------
async function carregarGrafico() {
  const wrap = document.getElementById('grafico-wrap');
  wrap.innerHTML = '<p class="grafico-vazio">Carregando gráfico…</p>';
  const r = await cgFetch(`${API}/coins/${moedaAtual.id}/market_chart?vs_currency=${fiatAtual}&days=${diasGrafico}`);
  if (!r.ok) throw new Error('chart ' + r.status);
  const d = await r.json();
  const pontos = d.prices;
  if (!pontos || pontos.length < 2) { wrap.innerHTML = '<p class="grafico-vazio">Sem dados para este período.</p>'; return; }

  const precos = pontos.map(p => p[1]);
  const min = Math.min(...precos), max = Math.max(...precos);
  const primeiro = precos[0], ultimo = precos[precos.length - 1];
  const variou = ((ultimo - primeiro) / primeiro) * 100;
  const subiu = variou >= 0;
  const cor = subiu ? '#14f195' : '#ff5470';

  document.getElementById('grafico-preco').textContent = fmtMoeda(ultimo);
  const gv = document.getElementById('grafico-var');
  gv.textContent = ` ${subiu ? '▲' : '▼'} ${fmtNum(Math.abs(variou), 2)}% no período`;
  gv.className = 'variacao ' + (subiu ? 'up' : 'down');

  const W = 900, H = 260, PAD = 8;
  const range = (max - min) || 1;
  const x = i => PAD + (i / (precos.length - 1)) * (W - PAD * 2);
  const y = v => H - PAD - ((v - min) / range) * (H - PAD * 2);

  let linha = `M ${x(0)} ${y(precos[0])}`;
  for (let i = 1; i < precos.length; i++) linha += ` L ${x(i)} ${y(precos[i])}`;
  const area = linha + ` L ${x(precos.length - 1)} ${H - PAD} L ${x(0)} ${H - PAD} Z`;

  wrap.innerHTML = `
    <svg id="grafico" viewBox="0 0 ${W} ${H}" role="img"
         aria-label="Gráfico de preço de ${esc(moedaAtual.nome)}">
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${cor}" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="${cor}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#grad)"/>
      <path d="${linha}" fill="none" stroke="${cor}" stroke-width="2.4"
            stroke-linejoin="round" stroke-linecap="round"/>
      <text x="${PAD}" y="16" fill="#9b9ba6" font-size="12" font-family="Space Grotesk">máx ${fmtMoeda(max)}</text>
      <text x="${PAD}" y="${H - 12}" fill="#9b9ba6" font-size="12" font-family="Space Grotesk">mín ${fmtMoeda(min)}</text>
    </svg>`;
}

document.querySelectorAll('.periodos button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.periodos button').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    diasGrafico = Number(btn.dataset.dias);
    carregarGrafico().catch(mostrarErro);
  });
});

// ---------- orquestração ----------
// "08/11 às 14:32": a cotação guardada diz de quando é
function quandoFoi(t) {
  const d = new Date(t);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function mostrarErro(e) {
  console.error(e);
  const at = document.getElementById('atualizado');
  if (/atualizando…$/.test(at.textContent)) at.textContent = at.textContent.replace('atualizando…', 'sem conexão agora');
  document.getElementById('erro-api').style.display = 'block';
}

async function iniciar() {
  document.getElementById('erro-api').style.display = 'none';
  try {
    // Apenas 3 chamadas no início: preço + estatísticas + gráfico.
    // A lista de tokens carrega sob demanda (ao focar na busca),
    // evitando o bloqueio por excesso de requisições da CoinGecko grátis.
    await carregarDados();
    await carregarGrafico();
  } catch (e) {
    mostrarErro(e);
  }
}

// atualização automática da cotação a cada 60s (sem recarregar gráfico,
// pra respeitar o rate limit da CoinGecko gratuita)
setInterval(() => { if (LISTA.length) carregarDados().catch(() => {}); }, 60000);


/* =========================================================
   Modo câmbio: BRL / USD / EUR / GBP / USDT / USDC entre si.
   Cotação via stablecoin, base USD.
   ========================================================= */
const CB = (function () {
  const MOEDAS = {
    brl:  { code:'BRL',  simbolo:'R$', nome:'Real (BRL)',      label:'🇧🇷 BRL — Real' },
    usd:  { code:'USD',  simbolo:'$',  nome:'Dólar (USD)',     label:'🇺🇸 USD — Dólar' },
    eur:  { code:'EUR',  simbolo:'€',  nome:'Euro (EUR)',      label:'🇪🇺 EUR — Euro' },
    gbp:  { code:'GBP',  simbolo:'£',  nome:'Libra (GBP)',     label:'🇬🇧 GBP — Libra' },
    usdt: { code:'USDT', simbolo:'',   nome:'Tether (USDT)',   label:'🟢 USDT — Tether' },
    usdc: { code:'USDC', simbolo:'',   nome:'USD Coin (USDC)', label:'🔵 USDC — USD Coin' },
  };
  const QUANTIDADES = [1, 5, 10, 50, 100, 500, 1000];
  const CHAVE = 'atlas.conversor.cambio.v1';
  let de = 'brl', para = 'usd', valorUSD = null, ultimo = 'de', iniciado = false;
  const $ = id => document.getElementById(id);
  const hora = t => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const ler = el => window.AtlasCalculos.lerNumero(el.value);
  const fmt = (v, m) => {
    const M = MOEDAS[m], casas = v !== 0 && Math.abs(v) < 1 ? 6 : 2;
    const n = v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: casas });
    return M.simbolo ? `${M.simbolo} ${n}` : `${n} ${M.code}`;
  };
  const fmtCampo = v => (v === null || !isFinite(v)) ? '' : v.toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(v) < 1 && v !== 0 ? 6 : 2 });
  const conv = (v, a, b) => window.AtlasCalculos.converterMoeda(v, valorUSD[a], valorUSD[b]);

  async function carregar() {
    const r = await cgFetch(`${API}/simple/price?ids=tether,usd-coin&vs_currencies=usd,brl,eur,gbp`);
    if (!r.ok) throw new Error('cotacao');
    const d = await r.json(), t = d['tether'], c = d['usd-coin'];
    if (!t || !c) throw new Error('dados');
    const FC = window.AtlasCalculos;
    valorUSD = { usd: 1, brl: FC.valorEmDolar(t.usd, t.brl), eur: FC.valorEmDolar(t.usd, t.eur),
                 gbp: FC.valorEmDolar(t.usd, t.gbp), usdt: t.usd, usdc: c.usd };
    try { localStorage.setItem(CHAVE, JSON.stringify({ v: valorUSD, t: Date.now() })); } catch (e) {}
    $('cb-atualizado').textContent = 'Atualizado às ' + hora(Date.now());
  }
  function recalc(origem) {
    if (!valorUSD) return;
    if (origem === 'de') { const v = ler($('cb-input-de')); $('cb-input-para').value = v === null ? '' : fmtCampo(conv(v, de, para)); }
    else { const v = ler($('cb-input-para')); $('cb-input-de').value = v === null ? '' : fmtCampo(conv(v, para, de)); }
    $('cb-h1-de').textContent = MOEDAS[de].nome; $('cb-h1-para').textContent = MOEDAS[para].nome;
    $('cb-taxa-de').textContent = MOEDAS[de].code;
    $('cb-taxa-valor').textContent = fmt(conv(1, de, para), para);
    $('cb-taxa-inversa').textContent = `1 ${MOEDAS[para].code} = ${fmt(conv(1, para, de), de)}`;
    $('cb-tab-titulo').textContent = `${MOEDAS[de].code} → ${MOEDAS[para].code}`;
    $('cb-th-de').textContent = MOEDAS[de].code; $('cb-th-para').textContent = MOEDAS[para].code;
    const corpo = $('cb-tabela-corpo'); corpo.textContent = '';
    QUANTIDADES.forEach(q => {
      const tr = document.createElement('tr'), a = document.createElement('td'), b = document.createElement('td');
      a.className = 'num'; a.textContent = fmt(q, de); b.className = 'res'; b.textContent = fmt(conv(q, de, para), para);
      tr.append(a, b); corpo.appendChild(tr);
    });
  }
  async function iniciar() {
    $('cb-erro-api').style.display = 'none';
    try { await carregar(); recalc(ultimo); }
    catch (e) {
      if (!valorUSD) { $('cb-erro-api').style.display = 'block'; $('cb-atualizado').textContent = 'Erro ao carregar.'; }
      else $('cb-atualizado').textContent = $('cb-atualizado').textContent.replace('atualizando…', 'sem conexão agora');
    }
  }
  function abrir() {
    if (iniciado) return; iniciado = true;
    Object.entries(MOEDAS).forEach(([k, m]) => {
      ['cb-select-de', 'cb-select-para'].forEach(id => { const o = document.createElement('option'); o.value = k; o.textContent = m.label; $(id).appendChild(o); });
    });
    $('cb-select-de').value = de; $('cb-select-para').value = para;
    $('cb-input-de').value = '1.000';
    try {
      const c = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      if (c && c.v) { valorUSD = c.v; recalc('de'); $('cb-atualizado').textContent = 'Cotação salva em ' + quandoFoi(c.t) + ' · atualizando…'; }
    } catch (e) {}
    $('cb-input-de').addEventListener('input', () => { ultimo = 'de'; recalc('de'); });
    $('cb-input-para').addEventListener('input', () => { ultimo = 'para'; recalc('para'); });
    $('cb-select-de').addEventListener('change', () => { de = $('cb-select-de').value;
      if (de === para) { para = Object.keys(MOEDAS).find(k => k !== de); $('cb-select-para').value = para; } recalc(ultimo); });
    $('cb-select-para').addEventListener('change', () => { para = $('cb-select-para').value;
      if (para === de) { de = Object.keys(MOEDAS).find(k => k !== para); $('cb-select-de').value = de; } recalc(ultimo); });
    $('cb-swap').addEventListener('click', () => { [de, para] = [para, de];
      $('cb-select-de').value = de; $('cb-select-para').value = para;
      [$('cb-input-de').value, $('cb-input-para').value] = [$('cb-input-para').value, $('cb-input-de').value]; recalc(ultimo); });
    $('cb-retry').addEventListener('click', iniciar);
    iniciar();
    setInterval(() => { if (!$('modo-cambio').hidden) carregar().then(() => recalc(ultimo)).catch(() => {}); }, 60000);
  }
  return { abrir };
})();

function setModo(m) {
  document.querySelectorAll('[data-modo]').forEach(b => { const on = b.dataset.modo === m; b.classList.toggle('ativo', on); b.setAttribute('aria-selected', on); });
  document.getElementById('modo-cripto').hidden = m !== 'cripto';
  document.getElementById('modo-cambio').hidden = m !== 'cambio';
  if (m === 'cambio') CB.abrir();
  const u = new URL(location.href);
  if (m === 'cambio') u.searchParams.set('modo', 'cambio'); else u.searchParams.delete('modo');
  history.replaceState(null, '', u);
}
document.querySelectorAll('[data-modo]').forEach(b => b.addEventListener('click', () => setModo(b.dataset.modo)));

// ---------- partida ----------
(function partida() {
  const params = new URLSearchParams(location.search);
  const f = params.get('fiat');
  if (f && FIATS[f]) { fiatAtual = f; document.getElementById('select-fiat').value = f; }
  const id = params.get('cripto');
  if (id) moedaAtual = { id, sym: id.toUpperCase().slice(0, 6), nome: id, img: '' };
  atualizarRotulos();
  montarChips();
  // abre mostrando "1 [cripto] = preço dela" (sem valor antigo pendurado)
  ultimoCampo = 'cripto';
  document.getElementById('input-cripto').value = '1';
  document.getElementById('input-fiat').value = '';
  // Mostra na hora a última cotação guardada, enquanto a nova carrega
  try {
    const c = JSON.parse(localStorage.getItem('atlas.conversor.cripto.' + moedaAtual.id) || 'null');
    if (c && c.p && c.p[fiatAtual]) {
      precosFiat = c.p; recalcular();
      document.getElementById('taxa-valor').textContent = fmtMoeda(c.p[fiatAtual]);
      document.getElementById('atualizado').textContent = 'Cotação salva em ' + quandoFoi(c.t) + ' · atualizando…';
    }
  } catch (e) {}
  if (params.get('modo') === 'cambio') setModo('cambio');
  iniciar();
})();
