/* ════════════════════════════════════════════════════════════
   ATLAS · Comparador de Ativos (Ferramentas/comparador-de-ativos/)
   Busca-uma-vez (maior período) + cache + fila por provedor +
   re-tentativa + falha visível. Trocar período/moeda não refaz
   requisição. Rede só pelo AtlasHttp, sem chave de API no navegador.
   Cripto: Binance + CoinGecko | Ouro (PAXG) e ações (xStocks): tokens
   na CoinGecko | CDI e IPCA: Banco Central.
   Registro: docs/ferramentas-bancada-2026-11-08.md
   ════════════════════════════════════════════════════════════ */

/* ┌────────────────────────────────────────────────────────┐
   │ REGISTRO DE ATIVOS — edite/expanda livremente            │
   │ Cores de linha bem distintas entre si                    │
   └────────────────────────────────────────────────────────┘ */
const ASSETS = {
  // ── CRIPTO (CoinGecko) ──
  bitcoin:     {name:"Bitcoin",   sym:"BTC",   type:"crypto", cg:"bitcoin",     color:"#F5A623"},
  ethereum:    {name:"Ethereum",  sym:"ETH",   type:"crypto", cg:"ethereum",    color:"#6F8BFF"},
  solana:      {name:"Solana",    sym:"SOL",   type:"crypto", cg:"solana",      color:"#9D71FF"},
  binancecoin: {name:"BNB",       sym:"BNB",   type:"crypto", cg:"binancecoin", color:"#C6E84A"},
  ripple:      {name:"XRP",       sym:"XRP",   type:"crypto", cg:"ripple",      color:"#22D3EE"},
  dogecoin:    {name:"Dogecoin",  sym:"DOGE",  type:"crypto", cg:"dogecoin",    color:"#D6A84B"},
  aave:        {name:"Aave",      sym:"AAVE",  type:"crypto", cg:"aave",        color:"#B6509E"},
  morpho:      {name:"Morpho",    sym:"MORPHO",type:"crypto", cg:"morpho",      color:"#2D6BFF"},
  uniswap:     {name:"Uniswap",   sym:"UNI",   type:"crypto", cg:"uniswap",     color:"#FF5CAA"},
  // ── TRADICIONAL, em token (cotado em US$) ──
  // Ouro: PAX Gold, lastreado em ouro físico (par PAXG/USDT na Binance, histórico longo).
  // Ações e índices: xStocks na CoinGecko, desde meados de 2025 (≈1 ano de histórico).
  gold:        {name:"Ouro (PAXG)",       sym:"PAXG",  type:"tok", cg:"pax-gold",      bn:"PAXG", color:"#B87333"},
  nvidia:      {name:"Nvidia (token)",    sym:"NVDA",  type:"tok", cg:"nvidia-xstock",   cgOnly:true, color:"#76B900"},
  google:      {name:"Google (token)",    sym:"GOOGL", type:"tok", cg:"alphabet-xstock", cgOnly:true, color:"#EA4335"},
  spy:         {name:"S&P 500 (token)",   sym:"SPY",   type:"tok", cg:"sp500-xstock",    cgOnly:true, color:"#18A0A0"},
  qqq:         {name:"Nasdaq 100 (token)",sym:"QQQ",   type:"tok", cg:"nasdaq-xstock",   cgOnly:true, color:"#FF7AB6"},
  // ── RENDA FIXA (BACEN SGS) ──
  cdi:         {name:"CDI",       sym:"CDI",   type:"bacen", sgs:12,  color:"#64748B"},
  ipca:        {name:"IPCA",      sym:"IPCA",  type:"bacen", sgs:433, color:"#E2674A"},
};

/* Ativos fixos do painel (7) — os 2 slots de cripto vêm da busca */
const FIXED = ["gold","nvidia","google","spy","qqq","cdi"];

/* Rival de cada cripto (preenche o 2º slot cripto) */
const RIVALS = {
  bitcoin:"ethereum", ethereum:"bitcoin", solana:"ethereum", binancecoin:"ethereum",
  ripple:"bitcoin", dogecoin:"bitcoin", aave:"morpho", morpho:"aave", uniswap:"ethereum"
};
function rivalOf(key){ return RIVALS[key] || (key==="ethereum"?"bitcoin":"ethereum"); }

/* ════════════════ ESTADO ════════════════ */
const STATE = {
  currency:"brl", primary:"bitcoin", set:[], hidden:{},
  s1days:365, s1key:"1A", s2days:365, s2key:"1A",
  amountBuy:1000, amountCmp:1000,
};
const SYM = {brl:"R$", usd:"US$"};
const LOC = {brl:"pt-BR", usd:"en-US"};
let fxRate = 5.4;                       // USD->BRL (atualizado em loadFx)
const RAW = {};                         // key -> {status, series, err, promise}  (série canônica em US$ / índice)
const chartInst = {s1:null,s2:null,s3:null};
/* Rede só pelo AtlasHttp (timeout, re-tentativa, cache). Séries longas
   ficam fora do cache em localStorage (ttl 0): o RAW em memória já guarda. */
const getJ = (u, ttl) => AtlasHttp.getJSON(u, { ttl: ttl || 0, timeout: 15000, retries: 1 });
const sleep = ms => new Promise(r=>setTimeout(r,ms));

/* ════════════════ FORMATAÇÃO ════════════════ */
function fmtMoney(v,cur){ cur=cur||STATE.currency; return new Intl.NumberFormat(LOC[cur],{style:"currency",currency:cur.toUpperCase(),maximumFractionDigits:2}).format(v); }
function fmtNum(v,d){ return new Intl.NumberFormat("pt-BR",{maximumFractionDigits:d==null?2:d}).format(v); }
function fmtPct(v){ return (v>=0?"+":"")+v.toFixed(2)+"%"; }
function compact(v){ if(Math.abs(v)>=1e6)return(v/1e6).toFixed(1)+"M"; if(Math.abs(v)>=1e3)return(v/1e3).toFixed(0)+"k"; return (+v).toFixed(0); }
function hexA(hex,a){ const h=hex.replace("#",""); return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`; }
const PALETTE=["#F5A623","#6F8BFF","#9D71FF","#22D3EE","#FF5CAA","#10B981","#E2674A","#4AA3DF","#C6E84A","#B6509E"];
let palI=0; function pickColor(){ return PALETTE[(palI++)%PALETTE.length]; }

/* converte valor canônico (US$) para a moeda escolhida; bacen é índice (sem moeda) */
function toCur(v,a){ if(a.type==="bacen") return v; return STATE.currency==="brl" ? v*fxRate : v; }

/* ════════════════ CÂMBIO ════════════════ */
async function loadFx(){
  // dólar em reais pela cotação do USDT (mesmo critério do Conversor)
  try{ const d=await getJ("https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=brl,usd", 600000); const t=d&&d.tether; if(t&&t.brl>0&&t.usd>0) fxRate=t.brl/t.usd; }catch(e){}
}

/* ════════════════ LIMITE POR PROVEDOR (token bucket) ════════════════
   Permite um "burst" e repõe devagar — respeita os limites do free tier
   sem disparar tudo de uma vez (era a causa dos ativos sumirem).        */
function tokenBucket(max, refillMs){
  let tokens=max; const q=[];
  function pump(){ while(tokens>0 && q.length){ tokens--; (q.shift())(); } }
  setInterval(()=>{ if(tokens<max){ tokens++; pump(); } }, refillMs);
  return fn => new Promise((res,rej)=>{ q.push(()=>fn().then(res,rej)); pump(); });
}
const cgBucket = tokenBucket(5, 4000);   // CoinGecko

async function withRetry(fn, tries){
  tries=tries||3; let err;
  for(let i=0;i<tries;i++){
    try{ return await fn(); }
    catch(e){ err=e; await sleep(1200*(i+1)); }
  }
  throw err;
}

/* ════════════════ FETCH CANÔNICO (uma vez, maior período) ════════════════ */
/* Cripto: Binance (histórico longo, grátis, sem chave) + fallback CoinGecko (máx 365d) */
async function binanceKlines(sym, interval, limit){
  const u=`https://data-api.binance.vision/api/v3/klines?symbol=${sym}USDT&interval=${interval}&limit=${limit}`;
  const d=await getJ(u); if(!Array.isArray(d)||!d.length) throw new Error("bnb-vazio");
  return d.map(k=>({t:k[0], v:parseFloat(k[4])})).filter(p=>isFinite(p.v));
}
async function cgFallback(a){
  const u=`https://api.coingecko.com/api/v3/coins/${a.cg}/market_chart?vs_currency=usd&days=365`;
  const d=await getJ(u); if(!d||!d.prices||!d.prices.length) throw new Error("cg-vazio");
  return d.prices.map(p=>({t:p[0], v:p[1]}));
}
async function rawCrypto(a){
  const sym=(a.bn||a.sym||"").toUpperCase();
  let weekly=[], daily=[];
  if(sym && !a.cgOnly){
    try{ weekly=await binanceKlines(sym,"1w",750); }catch(e){}   // ~14 anos semanal
    try{ daily =await binanceKlines(sym,"1d",1000); }catch(e){}  // ~2,7 anos diário (detalhe recente)
  }
  if(weekly.length || daily.length){
    const dStart = daily.length ? daily[0].t : Infinity;
    return weekly.filter(p=>p.t<dStart).concat(daily).sort((x,y)=>x.t-y.t);  // US$ (≈USDT)
  }
  return await cgFallback(a);                                    // Binance não tem o par → CoinGecko (1 ano)
}
async function rawBacen(a){
  const end=new Date(), start=new Date(Date.now()-3650*864e5);
  const fmt=dt=>`${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
  const u=`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${a.sgs}/dados?formato=json&dataInicial=${fmt(start)}&dataFinal=${fmt(end)}`;
  const d=await getJ(u, 6*3600*1000); if(!Array.isArray(d)||!d.length) throw new Error("bacen-vazio");
  let acc=1; const out=[];
  for(const row of d){ const [dd,mm,yy]=row.data.split("/"); const t=new Date(+yy,+mm-1,+dd).getTime(); const rate=parseFloat(String(row.valor).replace(",","."))/100; acc*=(1+rate); out.push({t,v:acc}); }
  return out;                                            // índice acumulado
}

/* garante que o ativo está em cache; busca uma única vez */
function ensureAsset(key){
  const a=ASSETS[key]; if(!a) return Promise.resolve();
  const cur=RAW[key];
  if(cur && (cur.status==="ok"||cur.status==="loading")) return cur.promise||Promise.resolve();
  const entry=RAW[key]={status:"loading",series:null,err:null,promise:null};
  let job;
  if(a.type==="crypto"||a.type==="tok") job=()=>cgBucket(()=>withRetry(()=>rawCrypto(a)));
  else                    job=()=>withRetry(()=>rawBacen(a));
  entry.promise=job()
    .then(series=>{ entry.series=series; entry.status="ok"; })
    .catch(err=>{ entry.status="error"; entry.err=err; })
    .then(()=>{ updateLegends(); scheduleRedraw(); renderTdNotice(); });
  return entry.promise;
}
function retryAsset(key){ if(RAW[key]) RAW[key].status=null; ensureAsset(key); updateLegends(); }

/* ════════════════ ALINHAMENTO / FATIAMENTO ════════════════ */
function resample(series, targets){
  if(!series||!series.length) return targets.map(()=>null);
  const s=series.slice().sort((x,y)=>x.t-y.t);
  const out=[]; let i=0, last=null;
  for(const t of targets){ while(i<s.length && s[i].t<=t){ last=s[i].v; i++; } out.push(last); }
  return out;
}
function buildTargets(days,n){ const end=Date.now(), start=end-days*864e5, step=(end-start)/(n-1); const a=[]; for(let k=0;k<n;k++)a.push(Math.round(start+step*k)); return a; }
function labelFor(ts,days){ const d=new Date(ts); if(days<=30) return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`; return `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getFullYear()).slice(2)}`; }
function resolveDays(d){ if(d==="ytd"){ const now=new Date(); return Math.max(7,Math.round((now-new Date(now.getFullYear(),0,1))/864e5)); } return parseInt(d,10); }
function periodLong(k){ return {"7D":"7 dias","30D":"30 dias","6M":"6 meses","YTD":"o início do ano","1A":"1 ano","5A":"5 anos","10A":"10 anos"}[k]||k; }

/* ════════════════ CHART BASE ════════════════ */
function baseChartOpts(extra){
  return Object.assign({
    responsive:true, maintainAspectRatio:false,
    interaction:{mode:"index",intersect:false},
    plugins:{
      legend:{display:false},
      tooltip:{backgroundColor:"rgba(13,17,32,.96)",borderColor:"rgba(255,255,255,.1)",borderWidth:1,titleColor:"#94a3b8",bodyColor:"#e2e8f0",padding:11,usePointStyle:true}
    },
    scales:{
      x:{ticks:{color:"#475569",font:{size:10},maxTicksLimit:10,autoSkip:true},grid:{color:"rgba(255,255,255,.04)"}},
      y:{ticks:{color:"#475569",font:{size:10}},grid:{color:"rgba(255,255,255,.04)"}}
    }
  }, extra||{});
}
function lineDS(a,data,isPrim,hidden){
  return {label:a.name,data,borderColor:a.color,backgroundColor:hexA(a.color,.05),
    pointRadius:0,borderWidth:isPrim?3:2,tension:.18,fill:false,hidden:!!hidden,
    borderDash:(a.type==="bacen")?[6,4]:[]};
}

/* ════════════════ SEÇÃO 1 — COTAÇÃO DO ATIVO PRINCIPAL ════════════════ */
function renderS1(){
  const a=ASSETS[STATE.primary]; if(!a) return;
  document.getElementById("s1-asset").textContent=a.name;
  const r=RAW[STATE.primary];
  if(!r || r.status!=="ok"){
    document.getElementById("s1-price").textContent = r&&r.status==="error" ? "indisponível" : "carregando…";
    document.getElementById("s1-chg").textContent="";
    return;
  }
  const days=STATE.s1days, targets=buildTargets(days, 90);
  const vals=resample(r.series, targets);
  const labels=targets.map(t=>labelFor(t,days));
  const first=vals.find(v=>v!=null), last=[...vals].reverse().find(v=>v!=null);
  const chg=first?((last/first-1)*100):0;
  const dataCur=vals.map(v=>v==null?null:toCur(v,a));

  document.getElementById("s1-price").textContent = a.type==="bacen" ? ("índice "+fmtNum(last,3)) : fmtMoney(toCur(last,a));
  const chgEl=document.getElementById("s1-chg");
  chgEl.textContent=`${fmtPct(chg)} (${STATE.s1key})`;
  chgEl.className="primary-chg "+(chg>=0?"up":"down");

  if(chartInst.s1) chartInst.s1.destroy();
  chartInst.s1=new Chart(document.getElementById("s1-chart"),{type:"line",
    data:{labels,datasets:[{label:a.name,data:dataCur,borderColor:a.color,backgroundColor:hexA(a.color,.10),pointRadius:0,borderWidth:2.2,tension:.18,fill:true}]},
    options:baseChartOpts({spanGaps:true,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${a.type==="bacen"?fmtNum(c.parsed.y,3):fmtMoney(c.parsed.y)}`}}},scales:{y:{ticks:{color:"#475569",font:{size:10},callback:v=>compact(v)}}}})
  });

  // "quanto você compra"
  document.getElementById("s1-buy-prefix").textContent=SYM[STATE.currency];
  const price=toCur(last,a);
  let units = (a.type==="bacen"||!price) ? 0 : STATE.amountBuy/price;
  document.getElementById("s1-buy-units").textContent = a.type==="bacen" ? "—" : `${fmtNum(units, units<1?6:3)} ${a.sym}`;
  // "se você tivesse investido"
  document.getElementById("s1-inv-prefix").textContent=SYM[STATE.currency];
  document.getElementById("s1-inv-amount").textContent=fmtNum(STATE.amountBuy,0);
  document.getElementById("s1-inv-period").textContent=periodLong(STATE.s1key);
  const res=(first&&last)?STATE.amountBuy*(last/first):0;
  const invEl=document.getElementById("s1-inv-result");
  invEl.textContent=fmtMoney(res);
  invEl.style.color=(res>=STATE.amountBuy)?"var(--green)":"var(--red)";

  renderRetorno(r.series);
}
function renderRetorno(full){
  const box=document.getElementById("s1-ret");
  const periods=[["1 mês",30],["3 meses",90],["1 ano",365],["2 anos",730],["5 anos",1825]];
  const now=full[full.length-1];
  box.innerHTML=periods.map(([lab,dd])=>{
    const cut=Date.now()-dd*864e5;
    const past=full.filter(p=>p.t<=cut).pop();
    if(!past||!now){ return `<div class="ret-box"><div class="rl">${lab}</div><div class="rv">—</div></div>`; }
    const pct=(now.v/past.v-1)*100;
    return `<div class="ret-box"><div class="rl">${lab}</div><div class="rv ${pct>=0?"up":"down"}">${fmtPct(pct)}</div></div>`;
  }).join("");
}

/* ════════════════ SEÇÕES 2 e 3 — COMPARAÇÃO ════════════════ */
function renderCompare(){
  const days=STATE.s2days, targets=buildTargets(days,64), labels=targets.map(t=>labelFor(t,days));
  const dsMoney=[], dsPct=[], rows=[];
  for(const key of STATE.set){
    const a=ASSETS[key], r=RAW[key];
    if(!a||!r||r.status!=="ok") continue;
    const rs=resample(r.series, targets);
    const base=rs.find(v=>v!=null); if(!base) continue;
    const hidden=!!STATE.hidden[key], isPrim=key===STATE.primary;
    const money=rs.map(v=>v==null?null:STATE.amountCmp*(v/base));
    const pct=rs.map(v=>v==null?null:(v/base-1)*100);
    dsMoney.push(lineDS(a,money,isPrim,hidden));
    dsPct.push(lineDS(a,pct,isPrim,hidden));
    rows.push({a,key,hidden,rs,lastMoney:[...money].reverse().find(v=>v!=null),lastPct:[...pct].reverse().find(v=>v!=null)});
  }
  if(chartInst.s2) chartInst.s2.destroy();
  chartInst.s2=new Chart(document.getElementById("s2-chart"),{type:"line",
    data:{labels,datasets:dsMoney},
    options:baseChartOpts({spanGaps:true,plugins:{tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${fmtMoney(c.parsed.y)}`}}},scales:{y:{ticks:{color:"#475569",font:{size:10},callback:v=>compact(v)}}}})
  });
  if(chartInst.s3) chartInst.s3.destroy();
  chartInst.s3=new Chart(document.getElementById("s3-chart"),{type:"line",
    data:{labels,datasets:dsPct},
    options:baseChartOpts({spanGaps:true,plugins:{tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${fmtPct(c.parsed.y)}`}}},scales:{y:{ticks:{color:"#475569",font:{size:10},callback:v=>v.toFixed(0)+"%"}}}})
  });
  /* ── RANKING: TODO MUNDO A PARTIR DA MESMA DATA ─────────────────
     No grafico cada ativo comeca onde tem dado, e isso esta certo: nao
     existe retorno antes do ativo existir. Mas comparar "+180%" de uma
     moeda de tres meses com "+45%" do CDI de cinco anos nao responde
     pergunta nenhuma. Aqui o ranking mede todo mundo a partir da data em
     que o ULTIMO ativo entrou -- e a tela diz qual foi essa data.      */
  /* A conta mora em /ferramentas-core.js, testada no Node. */
  const FC = window.AtlasCalculos;
  const vis = rows.filter(r => !r.hidden);
  const janela = FC.janelaComum(vis.map(r => r.rs));
  const iComum = janela.indice;
  const janelaCurta = janela.recortou;
  const limitante = janela.quemLimita >= 0 ? vis[janela.quemLimita] : null;

  vis.forEach(r => {
    const ret = FC.retornoDesde(r.rs, iComum);
    r.cmpMoney = ret ? STATE.amountCmp * ret.multiplo : null;
    r.cmpPct = ret ? ret.pct : null;
  });

  const notaJanela = janelaCurta && limitante
    ? `<div class="muted-line" style="margin-bottom:8px">Comparação a partir de <b>${labels[iComum]}</b>` +
      ` — é desde quando ${limitante.a.name} tem histórico. Antes disso não daria para comparar.</div>`
    : '';

  const byMoney=[...vis].sort((x,y)=>(y.cmpMoney||0)-(x.cmpMoney||0));
  document.getElementById("s2-list").innerHTML = notaJanela + byMoney.map(r=>{
    if(r.cmpMoney==null) return `<div class="cmp-row"><span class="cmp-badge" style="background:${r.a.color}">${r.a.sym}</span><span class="cmp-text">${r.a.name}: sem histórico no período</span></div>`;
    const cls=r.cmpMoney>=STATE.amountCmp?"pos":"neg";
    return `<div class="cmp-row"><span class="cmp-badge" style="background:${r.a.color}">${r.a.sym}</span><span class="cmp-text">${fmtMoney(STATE.amountCmp)} em ${r.a.name} hoje seriam <b class="${cls}">${fmtMoney(r.cmpMoney)}</b></span></div>`;
  }).join("");

  const byPct=[...vis].sort((x,y)=>(y.cmpPct==null?-1e9:y.cmpPct)-(x.cmpPct==null?-1e9:x.cmpPct));
  document.getElementById("s3-list").innerHTML = notaJanela + byPct.map(r=>{
    if(r.cmpPct==null) return `<div class="cmp-row"><span class="cmp-badge" style="background:${r.a.color}">${r.a.sym}</span><span class="cmp-text">${r.a.name}: sem histórico no período</span></div>`;
    const cls=r.cmpPct>=0?"pos":"neg";
    return `<div class="cmp-row"><span class="cmp-badge" style="background:${r.a.color}">${r.a.sym}</span><span class="cmp-text">${r.a.name}: <b class="${cls}">${fmtPct(r.cmpPct)}</b> no período</span></div>`;
  }).join("");

  updateLegends();
}

/* ════════════════ LEGENDA INTERATIVA (bolinhas) ════════════════ */
function legendHTML(){
  return STATE.set.map(key=>{
    const a=ASSETS[key]; if(!a) return "";
    const r=RAW[key]||{}; let cls="lg-chip", status="";
    if(STATE.hidden[key]) cls+=" off";
    if(r.status==="loading"){ cls+=" loading"; status=`<span class="lg-status">…</span>`; }
    else if(r.status==="error"){ cls+=" error"; status=`<span class="lg-status">erro · tocar</span>`; }
    return `<span class="${cls}" data-k="${key}"><span class="lg-dot" style="background:${a.color}"></span><span class="lg-name">${a.name}</span>${status}</span>`;
  }).join("");
}
function updateLegends(){ ["s2-legend","s3-legend"].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML=legendHTML(); }); }
function onLegendClick(e){
  const chip=e.target.closest(".lg-chip"); if(!chip) return;
  const key=chip.dataset.k, r=RAW[key];
  if(r&&r.status==="error"){ retryAsset(key); return; }
  if(!r||r.status!=="ok") return;
  STATE.hidden[key]=!STATE.hidden[key];
  updateLegends(); renderCompare();
}

/* ════════════════ MONTAGEM DO PAINEL DE 9 ════════════════ */
function buildSet(primary){
  let set=[];
  const a=ASSETS[primary];
  if(a && a.type==="crypto"){ set.push(primary, rivalOf(primary)); }
  else { set.push("bitcoin","ethereum"); if(primary && set.indexOf(primary)<0) set.push(primary); }
  FIXED.forEach(k=>{ if(set.indexOf(k)<0) set.push(k); });
  return [...new Set(set)].filter(k=>ASSETS[k]).slice(0,10);
}

/* ════════════════ REDRAW (debounced) ════════════════ */
let redrawT=null;
function scheduleRedraw(){ clearTimeout(redrawT); redrawT=setTimeout(()=>{ renderS1(); renderCompare(); }, 140); }

/* ════════════════ DEFINIR ATIVO PRINCIPAL ════════════════ */
function setPrimary(key){
  if(!ASSETS[key]) return;
  STATE.primary=key; STATE.set=buildSet(key); STATE.hidden={};
  renderPeers(); updateLegends();
  STATE.set.forEach(k=>ensureAsset(k));
  scheduleRedraw();
}

/* ════════════════ CHIPS "COMPARANDO" ════════════════ */
function renderPeers(){
  const row=document.getElementById("peers-row");
  row.innerHTML=STATE.set.map(k=>{
    const a=ASSETS[k], prim=k===STATE.primary;
    return `<span class="chip ${prim?"primary":""}"><span class="dot" style="background:${a.color}"></span>${a.name}${prim?" ⭐":""}${prim?"":`<span class="x" onclick="removeAsset('${k}')">✕</span>`}</span>`;
  }).join("") + `<span class="chip chip-add" onclick="document.getElementById('search-input').focus()">+ adicionar</span>`;
  const a=ASSETS[STATE.primary];
  document.getElementById("peers-note").textContent=`Ativo principal: ${a.name}. Painel: 2 criptos (pesquisado + rival) + Ouro, Nvidia, Google, S&P 500, Nasdaq 100 e CDI. Clique nas bolinhas para isolar.`;
}
function removeAsset(k){ if(k===STATE.primary) return; STATE.set=STATE.set.filter(x=>x!==k); delete STATE.hidden[k]; renderPeers(); updateLegends(); renderCompare(); }

/* ════════════════ BUSCA ════════════════ */
let searchTimer=null;
function onSearchInput(e){
  const q=e.target.value.trim(), dd=document.getElementById("search-dd");
  clearTimeout(searchTimer);
  if(q.length<2){ dd.classList.remove("open"); dd.innerHTML=""; return; }
  dd.classList.add("open"); dd.innerHTML=`<div class="sd-loading">Buscando…</div>`;
  searchTimer=setTimeout(()=>doSearch(q),320);
}
async function doSearch(q){
  const dd=document.getElementById("search-dd"), ql=q.toLowerCase();
  const trad=Object.keys(ASSETS).filter(k=>ASSETS[k].type!=="crypto" && (ASSETS[k].name.toLowerCase().includes(ql)||ASSETS[k].sym.toLowerCase().includes(ql)));
  let coins=[];
  try{ const d=await getJ("https://api.coingecko.com/api/v3/search?query="+encodeURIComponent(q), 300000); coins=(d.coins||[]).slice(0,8); }catch(e){}
  let html="";
  if(trad.length){ html+=`<div class="sd-group">Mercado tradicional</div>`+trad.map(k=>{const a=ASSETS[k];return sdItem(k,a.name,a.sym,a.color,null,"trad");}).join(""); }
  if(coins.length){ html+=`<div class="sd-group">Criptomoedas</div>`+coins.map(c=>sdItem("cg:"+c.id,c.name,(c.symbol||"").toUpperCase(),"#F5A623",c.thumb,"cripto")).join(""); }
  dd.innerHTML = html || `<div class="sd-empty">Nada encontrado para "${escH(q)}".</div>`;
}
const escH = s => String(s==null?"":s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const jsAttr = v => escH(JSON.stringify(v));
function sdItem(key,name,sym,color,img,tag){
  const ico=img&&/^https:\/\//.test(img)?`<img src="${escH(img)}" alt="">`:escH(sym.slice(0,3));
  return `<div class="sd-item" onclick="caPick(${jsAttr(key)},${jsAttr(name)},${jsAttr(sym)})">
    <span class="sd-ico" style="background:${color}">${ico}</span>
    <div><div class="sd-name">${name}</div><div class="sd-sym">${sym}</div></div>
    <span class="sd-tag ${tag}">${tag}</span></div>`;
}
function caPick(key,name,sym){
  document.getElementById("search-dd").classList.remove("open");
  document.getElementById("search-input").value="";
  if(key.indexOf("cg:")===0){ const id=key.slice(3); if(!ASSETS[id]) ASSETS[id]={name,sym,type:"crypto",cg:id,color:pickColor()}; key=id; }
  setPrimary(key);
}
function caQuickPick(key){ setPrimary(key); }

/* ════════════════ CONTROLES ════════════════ */
function caSetCurrency(cur){
  STATE.currency=cur;
  document.querySelectorAll(".cur-btn").forEach(b=>b.classList.toggle("active",b.dataset.cur===cur));
  document.getElementById("s2-prefix").textContent=SYM[cur];
  buildPresets();
  renderS1(); renderCompare();          // sem refazer requisição
}
function buildPresets(){
  const vals=[1000,5000,10000];
  document.getElementById("s2-presets").innerHTML=vals.map(v=>`<button class="preset-btn" onclick="setCmpAmount(${v})">${SYM[STATE.currency]} ${fmtNum(v,0)}</button>`).join("");
}
function setCmpAmount(v){ STATE.amountCmp=v; document.getElementById("s2-amount").value=v; renderCompare(); }
function bindPeriod(id, apply){
  document.querySelectorAll(`#${id} .period-btn`).forEach(btn=>{
    btn.addEventListener("click",()=>{ document.querySelectorAll(`#${id} .period-btn`).forEach(b=>b.classList.remove("active")); btn.classList.add("active"); apply(btn.dataset.d, btn.dataset.k); });
  });
}
function syncPeriodButtons(){
  ["s2-period","s3-period"].forEach(id=>{ document.querySelectorAll(`#${id} .period-btn`).forEach(b=>b.classList.toggle("active", resolveDays(b.dataset.d)===STATE.s2days)); });
}

/* ════════════════ AVISO TWELVE DATA ════════════════ */
function renderTdNotice(){
  const el=document.getElementById("td-notice");
  const errs=STATE.set.filter(k=>RAW[k]&&RAW[k].status==="error").map(k=>ASSETS[k].name);
  el.innerHTML = errs.length ? `<div class="notice info">ℹ️ Não carregou: ${[...new Set(errs)].join(", ")}. Pode ser limite momentâneo da API ou símbolo a ajustar. Toque na bolinha do ativo (legenda) pra tentar de novo.</div>` : "";
}

/* ════════════════ TICKER ════════════════ */
async function loadTicker(){
  try{ const d=await getJ("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true", 60000); setTick("btc",d.bitcoin); setTick("eth",d.ethereum); }catch(e){}
  document.getElementById("tk-usd").textContent="R$ "+fxRate.toFixed(2).replace(".",",");
  document.getElementById("tk-time").textContent=new Date().toLocaleTimeString("pt-BR");
}
function setTick(id,o){ if(!o)return; document.getElementById("tk-"+id).textContent="US$ "+o.usd.toLocaleString("en-US"); const c=o.usd_24h_change||0, el=document.getElementById("tk-"+id+"-c"); el.textContent=(c>=0?"▲ +":"▼ ")+c.toFixed(2)+"%"; el.className="ticker-chg "+(c>=0?"up":"down"); }



/* ════════════════ INIT ════════════════ */
async function init(){
  document.getElementById("search-input").addEventListener("input",onSearchInput);
  document.addEventListener("click",e=>{ if(!e.target.closest(".search-wrap")) document.getElementById("search-dd").classList.remove("open"); });
  document.getElementById("s1-buy-amount").addEventListener("input",e=>{ STATE.amountBuy=parseFloat(e.target.value)||0; renderS1(); });
  document.getElementById("s2-amount").addEventListener("input",e=>{ STATE.amountCmp=parseFloat(e.target.value)||0; renderCompare(); });
  document.getElementById("s2-legend").addEventListener("click",onLegendClick);
  document.getElementById("s3-legend").addEventListener("click",onLegendClick);

  bindPeriod("s1-period",(d,k)=>{ STATE.s1days=resolveDays(d); STATE.s1key=k; renderS1(); });
  bindPeriod("s2-period",(d,k)=>{ STATE.s2days=resolveDays(d); STATE.s2key=k; renderCompare(); });
  bindPeriod("s3-period",(d,k)=>{ STATE.s2days=resolveDays(d); STATE.s2key=k; syncPeriodButtons(); renderCompare(); });

  buildPresets();
  renderTdNotice();
  await loadFx();
  loadTicker(); setInterval(loadTicker,60000);
  /* ?token= vindo da pagina do ativo. Precisa ser AQUI: setPrimary roda
     depois de um await, entao qualquer bloco externo era sobrescrito. */
  setPrimary(ativoInicial());
}
function ativoInicial(){
  var t=(new URLSearchParams(location.search).get('token')||'').toLowerCase();
  if(!t) return 'bitcoin';
  if(ASSETS[t]) return t;
  var k=Object.keys(ASSETS).find(function(k){
    return (ASSETS[k].sym||'').toLowerCase()===t || (ASSETS[k].cg||'')===t;});
  return k||'bitcoin';
}
init();
