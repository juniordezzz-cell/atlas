/* ============================================================
   ATLAS · academy/js/dashboard.js
   GLOBAL CRYPTO & RWA COMMAND CENTER
   window.renderDashboard(el)

   Layout de 3 colunas com hero central (globo ambiente) no estilo
   "Sci-Fi Operations Command Center". Abas no topo (Mercado Geral,
   DeFi, RWA, Analytics, Yields). Todo número é real (CoinGecko +
   DefiLlama, via AcademyData); o tráfego do globo é ambiente. Campo
   ausente = "indisponível"; painel sem dado = "indisponível".
   ============================================================ */
(function () {
  "use strict";

  /* ---------- formatação ---------- */
  function money(v){ if(v==null||!isFinite(v))return"—"; var a=Math.abs(v);
    if(a>=1e12)return"$"+(v/1e12).toFixed(2)+"T"; if(a>=1e9)return"$"+(v/1e9).toFixed(2)+"B";
    if(a>=1e6)return"$"+(v/1e6).toFixed(2)+"M"; if(a>=1)return"$"+v.toLocaleString("en-US",{maximumFractionDigits:2});
    return"$"+v.toLocaleString("en-US",{maximumFractionDigits:6}); }
  function big(v){ if(v==null||!isFinite(v))return"—"; var a=Math.abs(v);
    if(a>=1e12)return"$"+(v/1e12).toFixed(2)+"T"; if(a>=1e9)return"$"+(v/1e9).toFixed(1)+"B";
    if(a>=1e6)return"$"+(v/1e6).toFixed(1)+"M"; return"$"+Math.round(v).toLocaleString("en-US"); }
  function pct(v){ if(v==null||!isFinite(v))return"—"; return(v>=0?"+":"")+v.toFixed(2)+"%"; }
  function pctS(v){ if(v==null||!isFinite(v))return"—"; return(v>=0?"+":"")+v.toFixed(1)+"%"; }
  function cls(v){ return v==null?"":(v>=0?"up":"down"); }
  function hhmm(d){ d=d||new Date(); return("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2); }

  function h(tag,c,t){ var e=document.createElement(tag); if(c)e.className=c; if(t!=null)e.textContent=t; return e; }

  var refreshers = [];      // loaders re-chamados no auto-refresh
  var globeCtl = null;      // controlador do globo (para parar)
  var chainFocusSubs = [];  // reagem ao clique numa rede do globo
  function emitChainFocus(chain) { chainFocusSubs.forEach(function (f) { try { f(chain); } catch (e) {} }); }

  /* moldura de painel HUD */
  function panelFrame(title, hint) {
    var p = h("section","hpanel");
    var head = h("div","hpanel-head");
    head.appendChild(h("span","hpanel-title",title));
    if (hint) head.appendChild(h("span","hpanel-hint",hint));
    var body = h("div","hpanel-body");
    p.appendChild(head); p.appendChild(body);
    p.setState=function(n){ while(body.firstChild)body.removeChild(body.firstChild); body.appendChild(n); };
    p.loading=function(){ p.setState(h("div","hloading","carregando…")); };
    p.unavailable=function(retry){ var b=h("div","hempty"); b.appendChild(h("span",null,"indisponível"));
      var r=h("button","hretry","tentar de novo"); r.type="button"; r.addEventListener("click",retry); b.appendChild(r); p.setState(b); };
    p.loading();
    return p;
  }
  function assetLink(id,symbol){ return function(){ window.__academyAssetHint={id:id,symbol:symbol}; AcademyRouter.go("/ativo/"+id); }; }

  /* ---------- barra de abas + status ---------- */
  var TABS = ["Mercado Geral","DeFi","RWA","Analytics","Yields"];
  function topBar(active, onTab) {
    var bar = h("div","cc-topbar");
    var left = h("div","cc-brand");
    left.appendChild(h("span","cc-title","GLOBAL CRYPTO & RWA COMMAND CENTER"));
    var nav = h("nav","cc-tabs");
    TABS.forEach(function(t){
      var b=h("button","cc-tab"+(t===active?" active":""),t); b.type="button";
      b.addEventListener("click",function(){ onTab(t); });
      nav.appendChild(b);
    });
    left.appendChild(nav);
    var right = h("div","cc-status");
    var live=h("span","cc-live"); live.appendChild(h("span","cc-dot")); live.appendChild(h("span",null,"LIVE"));
    var clock=h("span","cc-clock"); var utc=h("span","cc-utc");
    function tick(){ var d=new Date();
      clock.textContent=("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2)+":"+("0"+d.getSeconds()).slice(-2);
      utc.textContent="UTC "+d.toISOString().slice(11,16); }
    tick(); bar._clock=setInterval(tick,1000);
    right.appendChild(live); right.appendChild(clock); right.appendChild(utc);
    bar.appendChild(left); bar.appendChild(right);
    return bar;
  }

  /* ---------- barra de métricas centrais ---------- */
  function metricsBar() {
    var strip = h("div","cc-metrics");
    var defs=[["TVL DeFi","tvl"],["RWA · TVL","rwa"],["Volume 24h","vol"],["Yield médio","apy"],["Domin. BTC","dbtc"],["Domin. ETH","deth"]];
    var cells={};
    defs.forEach(function(d){ var c=h("div","cc-metric"); c.appendChild(h("span","cc-mlabel",d[0]));
      var v=h("span","cc-mvalue","…"); c.appendChild(v); var s=h("span","cc-mdelta",""); c.appendChild(s);
      cells[d[1]]={v:v,s:s}; strip.appendChild(c); });
    function load(){
      Promise.all([
        AcademyData.defiTvl(), AcademyData.rwaTvl(40), AcademyData.global().catch(function(){return null;}),
        AcademyData.defiYields(), AcademyData.markets().catch(function(){return[];})
      ]).then(function(r){
        var tvl=r[0], rwa=r[1]||[], g=r[2], y=r[3], mk=r[4]||[];
        if(tvl){ cells.tvl.v.textContent=big(tvl.current); if(tvl.change24h!=null){ cells.tvl.s.textContent=pctS(tvl.change24h); cells.tvl.s.className="cc-mdelta "+cls(tvl.change24h);} }
        else cells.tvl.v.textContent="indisponível";
        var rwaSum=rwa.reduce(function(s,p){return s+(p.tvl||0);},0);
        cells.rwa.v.textContent=rwaSum? big(rwaSum):"indisponível";
        cells.vol.v.textContent=g? big(g.volume24h):"indisponível";
        cells.apy.v.textContent=y&&y.avgApy!=null? y.avgApy.toFixed(2)+"%":"indisponível";
        cells.dbtc.v.textContent=g&&g.btcDominance!=null? g.btcDominance.toFixed(1)+"%":"indisponível";
        var eth=mk.filter(function(x){return x.symbol==="ETH";})[0];
        cells.deth.v.textContent=(eth&&g&&g.marketCap)? (eth.marketCap/g.marketCap*100).toFixed(1)+"%":"indisponível";
      }).catch(function(){});
    }
    load(); refreshers.push(load);
    return strip;
  }

  /* ---------- globo central = mapa de redes DeFi (interativo) ---------- */
  var GLOBE_COORDS = [[18,10],[-8,72],[42,-78],[-28,150],[12,-140],[52,34],[-20,-46],[34,110]];
  function globeStage() {
    var stage = h("div","cc-globe-stage");
    var label = h("div","cc-globe-label");
    label.appendChild(h("span","cc-globe-title","MAPA GLOBAL DE LIQUIDEZ"));
    label.appendChild(h("span","cc-globe-sub","hubs = redes reais · tamanho = TVL · cor = 24h · clique p/ filtrar"));
    var globeBox = h("div","cc-globe");
    var chipsBar = h("div","cc-globe-chips");
    stage.appendChild(label); stage.appendChild(globeBox); stage.appendChild(chipsBar);

    var chipById = {};
    function buildChips(nodes) {
      while (chipsBar.firstChild) chipsBar.removeChild(chipsBar.firstChild);
      chipById = {};
      nodes.forEach(function (n) {
        var chip = h("div","cc-chip");
        chip.appendChild(h("span","cc-chip-badge", CHAIN_ABBR[n.id] || n.label));
        var col = h("span","cc-chip-col");
        col.appendChild(h("span","cc-chip-tvl", big(n.tvl)));
        col.appendChild(h("span","cc-chip-chg "+cls(n.change24h), pctS(n.change24h)));
        chip.appendChild(col);
        chip.title = n.id;
        chipById[n.id] = chip;
        chipsBar.appendChild(chip);
      });
    }
    function highlight(id) {
      Object.keys(chipById).forEach(function (k) { chipById[k].classList.toggle("active", k === id); });
    }

    Promise.all([AcademyData.defiChains(7), AcademyData.defiTvl()]).then(function (r) {
      var chains = r[0]||[], tvlInfo = r[1];
      if (!chains.length) { chipsBar.appendChild(h("span","cc-ro-hint","indisponível")); return; }
      var nodes = chains.map(function (c, i) {
        return { id:c.name, label:CHAIN_ABBR[c.name]||c.name.slice(0,4).toUpperCase(),
                 tvl:c.tvl, change24h:c.change24h, lat:GLOBE_COORDS[i%GLOBE_COORDS.length][0], lon:GLOBE_COORDS[i%GLOBE_COORDS.length][1] };
      });
      buildChips(nodes);
      setTimeout(function(){
        if (window.AcademyGlobe && document.body.contains(globeBox)) {
          if (globeCtl) { try{globeCtl.stop();}catch(e){} }
          globeCtl = AcademyGlobe.mount(globeBox, {
            nodes: nodes,
            onHover: function(n){ highlight(n ? n.id : null); },
            onSelect: function(n){ emitChainFocus(n ? n.id : null); }
          });
        }
      }, 40);
    }).catch(function(){ chipsBar.appendChild(h("span","cc-ro-hint","indisponível")); });
    return stage;
  }

  /* ---------- painéis de dados ---------- */
  // ranking de cryptos (barras) — gainers
  function cryptosPanel() {
    var p=panelFrame("Cryptos em alta","24h · top 7");
    function load(){ p.loading(); AcademyData.gainers().then(function(rows){
      if(!rows||!rows.length)return p.unavailable(load);
      var top=rows.slice(0,7); var max=Math.max.apply(null,top.map(function(r){return Math.abs(r.change24h)||1;}));
      var list=h("div","bar-list");
      top.forEach(function(r,i){ var row=h("button","bar-row"); row.type="button"; row.addEventListener("click",assetLink(r.id,r.symbol));
        row.appendChild(h("span","bar-rank",String(i+1))); row.appendChild(h("span","bar-sym",r.symbol));
        var tr=h("span","bar-track"); var fl=h("span","bar-fill"); fl.style.width=Math.max(6,(Math.abs(r.change24h)/max)*100)+"%"; tr.appendChild(fl); row.appendChild(tr);
        row.appendChild(h("span","bar-val",money(r.usd))); row.appendChild(h("span","bar-chg "+cls(r.change24h),pctS(r.change24h)));
        list.appendChild(row); });
      p.setState(list); }).catch(function(){p.unavailable(load);}); }
    load(); refreshers.push(load); return p;
  }

  // RWAs em alta por TVL (DefiLlama) — barras de volume/TVL
  function rwaTvlPanel() {
    var p=panelFrame("RWAs em alta","por TVL");
    function load(){ p.loading(); AcademyData.rwaTvl(7).then(function(rows){
      if(!rows||!rows.length)return p.unavailable(load);
      var max=rows[0].tvl||1; var list=h("div","bar-list");
      rows.forEach(function(r){ var row=h("div","bar-row bar-row-static");
        row.appendChild(h("span","bar-rank","◆")); row.appendChild(h("span","bar-sym2",r.name));
        var tr=h("span","bar-track"); var fl=h("span","bar-fill bar-fill-gold"); fl.style.width=Math.max(6,(r.tvl/max)*100)+"%"; tr.appendChild(fl); row.appendChild(tr);
        row.appendChild(h("span","bar-val",big(r.tvl))); row.appendChild(h("span","bar-chg "+cls(r.change24h),pctS(r.change24h)));
        list.appendChild(row); });
      p.setState(list); }).catch(function(){p.unavailable(load);}); }
    load(); refreshers.push(load); return p;
  }

  // setores (donut)
  var SECTOR_COLORS=["#00BFFF","#00F0FF","#00E28A","#FFD700","#9B8CFF","#FF8FA3","#5B9BFF","#6C7A99"];
  function sectorsPanel() {
    var p=panelFrame("Setores","por capital");
    function load(){ p.loading(); setTimeout(fetchCats,700); }
    function fetchCats(){ AcademyData.categories().then(function(cats){
      var top=(cats||[]).filter(function(c){return c.marketCap;}).sort(function(a,b){return b.marketCap-a.marketCap;}).slice(0,6);
      if(!top.length)return p.unavailable(load);
      var segs=top.map(function(c,i){return{value:c.marketCap,color:SECTOR_COLORS[i%SECTOR_COLORS.length]};});
      var wrap=h("div","sector-wrap"); var dbox=h("div","donut-box"); wrap.appendChild(dbox);
      var legend=h("div","sector-legend");
      top.forEach(function(c,i){ var it=h("div","legend-item"); var dot=h("span","legend-dot"); dot.style.background=SECTOR_COLORS[i%SECTOR_COLORS.length];
        it.appendChild(dot); it.appendChild(h("span","legend-name",c.name)); it.appendChild(h("span","legend-val "+cls(c.change24h),pctS(c.change24h))); legend.appendChild(it); });
      wrap.appendChild(legend); p.setState(wrap); AcademyChart.donut(dbox,segs,{});
    }).catch(function(){p.unavailable(load);}); }
    load(); refreshers.push(load); return p;
  }

  // TVL por rede (DefiLlama)
  var CHAIN_ABBR={"Ethereum":"ETH","Solana":"SOL","BSC":"BNB","Base":"BASE","Arbitrum":"ARB","Tron":"TRX","Bitcoin":"BTC","Polygon":"POL","Avalanche":"AVAX","Optimism":"OP"};
  function chainsPanel() {
    var p=panelFrame("TVL por rede","DeFi · pontes");
    var rowsByChain = {};
    function load(){ p.loading(); rowsByChain={}; AcademyData.defiChains(6).then(function(rows){
      if(!rows||!rows.length)return p.unavailable(load);
      var list=h("div","chain-list");
      rows.forEach(function(c){ var row=h("div","chainrow");
        row.appendChild(h("span","chainrow-badge",CHAIN_ABBR[c.name]||c.name.slice(0,3).toUpperCase()));
        row.appendChild(h("span","chainrow-name",c.name));
        row.appendChild(h("span","chainrow-tvl",big(c.tvl)));
        row.appendChild(h("span","chainrow-chg "+cls(c.change24h),pctS(c.change24h)));
        rowsByChain[c.name]=row; list.appendChild(row); });
      p.setState(list); }).catch(function(){p.unavailable(load);}); }
    load(); refreshers.push(load);
    // reage ao clique numa rede do globo: destaca a linha (dim nas outras)
    chainFocusSubs.push(function(chain){
      Object.keys(rowsByChain).forEach(function(name){
        var row=rowsByChain[name];
        row.classList.toggle("chainrow-focus", !!chain && name===chain);
        row.classList.toggle("chainrow-dim", !!chain && name!==chain);
      });
    });
    return p;
  }

  // TVL DeFi — tendência (linha com glow)
  function tvlTrendPanel() {
    var p=panelFrame("TVL DeFi","90 dias");
    function load(){ p.loading(); AcademyData.defiTvl().then(function(t){
      if(!t||!t.series||!t.series.length)return p.unavailable(load);
      var box=h("div","trend-box"); p.setState(box);
      var up=t.series[t.series.length-1][1]>=t.series[0][1];
      AcademyChart.line(box,t.series,{up:up});
    }).catch(function(){p.unavailable(load);}); }
    load(); refreshers.push(load); return p;
  }

  // alertas ao vivo (cripto + DeFi/RWA)
  function alertsPanel(big_) {
    var p=panelFrame("Alertas ao vivo","sinais");
    if (big_) p.classList.add("hpanel-tall");
    function load(){ p.loading();
      Promise.all([AcademyData.markets(),AcademyData.feargreed().catch(function(){return null;}),
        AcademyData.rwaTvl(8),AcademyData.protocolFlows(6)]).then(function(r){
        var mk=r[0],fg=r[1],rwa=r[2]||[],flows=r[3]||[];
        if(!mk||!mk.length)return p.unavailable(load);
        var withMc=mk.filter(function(x){return x.marketCap>5e7&&x.change24h!=null;});
        var byGain=withMc.slice().sort(function(a,b){return b.change24h-a.change24h;});
        var byVol=mk.filter(function(x){return x.marketCap>0&&x.volume24h>0;}).map(function(x){x._r=x.volume24h/x.marketCap;return x;}).sort(function(a,b){return b._r-a._r;});
        var A=[];
        var bigFlow=flows.slice().sort(function(a,b){return Math.abs(b.flowUsd)-Math.abs(a.flowUsd);})[0];
        if(bigFlow) A.push({sev:Math.abs(bigFlow.flowUsd)>3e8?"HIGH":"MED",txt:(bigFlow.flowUsd>=0?"Entrada de ":"Saída de ")+big(Math.abs(bigFlow.flowUsd))+" em "+bigFlow.name});
        if(byGain[0]) A.push({sev:byGain[0].change24h>=15?"HIGH":"MED",txt:byGain[0].symbol+" dispara "+pctS(byGain[0].change24h)+" em 24h",id:byGain[0].id,sym:byGain[0].symbol});
        if(rwa[0]&&rwa[0].change24h!=null) A.push({sev:"MED",txt:"RWA "+rwa[0].name+" "+(rwa[0].change24h>=0?"cresce ":"recua ")+pctS(rwa[0].change24h)+" em TVL"});
        var last=byGain[byGain.length-1];
        if(last&&last.change24h<0) A.push({sev:last.change24h<=-15?"HIGH":"MED",txt:last.symbol+" cai "+pctS(last.change24h)+" em 24h",id:last.id,sym:last.symbol});
        if(byVol[0]) A.push({sev:"MED",txt:"Volume anormal em "+byVol[0].symbol+" ("+byVol[0]._r.toFixed(1)+"x cap)",id:byVol[0].id,sym:byVol[0].symbol});
        if(fg){ if(fg.value<=25)A.push({sev:"HIGH",txt:"Medo extremo (F&G "+fg.value+")"}); else if(fg.value>=75)A.push({sev:"HIGH",txt:"Ganância extrema (F&G "+fg.value+")"}); }
        if(byGain[1]) A.push({sev:"LOW",txt:byGain[1].symbol+" avança "+pctS(byGain[1].change24h)+" em 24h",id:byGain[1].id,sym:byGain[1].symbol});
        var last2=byGain[byGain.length-2]; if(last2&&last2.change24h<0) A.push({sev:"MED",txt:last2.symbol+" recua "+pctS(last2.change24h)+" em 24h",id:last2.id,sym:last2.symbol});
        if(byVol[1]) A.push({sev:"LOW",txt:"Volume elevado em "+byVol[1].symbol+" ("+byVol[1]._r.toFixed(1)+"x cap)",id:byVol[1].id,sym:byVol[1].symbol});
        if(byGain[2]) A.push({sev:"LOW",txt:byGain[2].symbol+" sobe "+pctS(byGain[2].change24h)+" em 24h",id:byGain[2].id,sym:byGain[2].symbol});
        var now=new Date(); var list=h("div","alert-list");
        A.slice(0, big_?10:7).forEach(function(a,i){ var t=new Date(now.getTime()-i*137000);
          var row=a.id?h("button","alert-row"):h("div","alert-row"); if(a.id){row.type="button"; row.addEventListener("click",assetLink(a.id,a.sym));}
          row.appendChild(h("span","alert-time",hhmm(t))); row.appendChild(h("span","alert-txt",a.txt)); row.appendChild(h("span","alert-sev sev-"+a.sev,a.sev)); list.appendChild(row); });
        p.setState(list);
      }).catch(function(){p.unavailable(load);}); }
    load(); refreshers.push(load); return p;
  }

  // fluxo de protocolos (entradas/saídas) — barras divergentes
  function flowsPanel() {
    var p=panelFrame("Fluxo de protocolos","TVL 24h");
    var curChain=null;
    function setHint(chain){ var hEl=p.querySelector(".hpanel-hint"); if(hEl) hEl.textContent=chain?("● "+chain):"TVL 24h"; }
    function load(){ p.loading(); AcademyData.protocolFlows(8,curChain).then(function(rows){
      if(!rows||!rows.length){ if(curChain){ p.setState(h("div","hempty",curChain+": sem protocolos relevantes")); return; } return p.unavailable(load); }
      var max=Math.max.apply(null,rows.map(function(r){return Math.abs(r.flowUsd)||1;}));
      var list=h("div","flow-list");
      rows.forEach(function(r){ var row=h("div","flow-row");
        row.appendChild(h("span","flow-name",r.name));
        var barwrap=h("span","flow-barwrap"); var bar=h("span","flow-bar "+(r.flowUsd>=0?"pos":"neg"));
        bar.style.width=Math.max(4,(Math.abs(r.flowUsd)/max)*100)+"%"; barwrap.appendChild(bar); row.appendChild(barwrap);
        row.appendChild(h("span","flow-val "+(r.flowUsd>=0?"up":"down"),(r.flowUsd>=0?"+":"−")+big(Math.abs(r.flowUsd))));
        list.appendChild(row); });
      p.setState(list); }).catch(function(){p.unavailable(load);}); }
    load(); refreshers.push(load);
    chainFocusSubs.push(function(chain){ curChain=chain||null; setHint(curChain); load(); });
    return p;
  }

  // heatmap (analytics)
  function heatmapPanel() {
    var p=panelFrame("Mapa do mercado","24h · top 40");
    function load(){ p.loading(); AcademyData.markets().then(function(rows){
      if(!rows||!rows.length)return p.unavailable(load);
      var top=rows.filter(function(r){return r.marketCap&&r.change24h!=null;}).slice(0,40);
      var grid=h("div","heat-grid");
      top.forEach(function(r,i){ var tile=h("button","heat-tile"); tile.type="button";
        if(i<2)tile.classList.add("heat-xl"); else if(i<8)tile.classList.add("heat-lg");
        var v=r.change24h, mag=Math.min(1,Math.abs(v)/12), color=v>=0?"0,226,138":"255,84,112";
        tile.style.background="rgba("+color+","+(0.10+mag*0.5).toFixed(2)+")"; tile.style.borderColor="rgba("+color+","+(0.25+mag*0.4).toFixed(2)+")";
        tile.appendChild(h("span","heat-sym",r.symbol)); tile.appendChild(h("span","heat-chg",pctS(v)));
        tile.addEventListener("click",assetLink(r.id,r.symbol)); grid.appendChild(tile); });
      p.setState(grid); }).catch(function(){p.unavailable(load);}); }
    load(); refreshers.push(load); return p;
  }

  // dominância
  var STABLES={USDT:1,USDC:1,DAI:1,FDUSD:1,TUSD:1,USDE:1,PYUSD:1,USDS:1};
  function dominancePanel() {
    var p=panelFrame("Dominância","por capital");
    function load(){ p.loading(); Promise.all([AcademyData.markets(),AcademyData.global().catch(function(){return null;})]).then(function(r){
      var rows=r[0]; if(!rows||!rows.length)return p.unavailable(load);
      var total=0,btc=0,eth=0,stab=0; rows.forEach(function(a){var mc=a.marketCap||0;total+=mc;if(a.symbol==="BTC")btc+=mc;else if(a.symbol==="ETH")eth+=mc;else if(STABLES[a.symbol])stab+=mc;});
      if(!total)return p.unavailable(load);
      var segs=[["Bitcoin",btc/total*100,"var(--dourado)"],["Ethereum",eth/total*100,"var(--azul-principal)"],["Stablecoins",stab/total*100,"var(--verde)"],["Outros",Math.max(0,(total-btc-eth-stab))/total*100,"rgba(160,174,192,0.5)"]];
      var wrap=h("div","domin-list");
      segs.forEach(function(s){ var row=h("div","domin-row"); var top=h("div","domin-top"); top.appendChild(h("span","domin-name",s[0])); top.appendChild(h("span","domin-pct",s[1].toFixed(1)+"%")); row.appendChild(top);
        var tr=h("span","domin-track"); var fl=h("span","domin-fill"); fl.style.width=s[1]+"%"; fl.style.background=s[2]; tr.appendChild(fl); row.appendChild(tr); wrap.appendChild(row); });
      p.setState(wrap); }).catch(function(){p.unavailable(load);}); }
    load(); refreshers.push(load); return p;
  }

  // BTC trend
  function btcTrendPanel() {
    var p=panelFrame("Bitcoin","7 dias");
    function load(){ p.loading(); AcademyData.chart("bitcoin","BTC",7).then(function(c){
      if(!c||!c.points||!c.points.length)return p.unavailable(load);
      var box=h("div","trend-box"); p.setState(box); var up=c.points[c.points.length-1][1]>=c.points[0][1]; AcademyChart.line(box,c.points,{up:up});
    }).catch(function(){p.unavailable(load);}); }
    load(); refreshers.push(load); return p;
  }

  // tabela de yields (top pools por APY)
  function yieldsPanel(wide) {
    var p=panelFrame("Melhores yields","APY · pools grandes");
    function load(){ p.loading(); AcademyData.defiYields().then(function(y){
      if(!y||!y.pools||!y.pools.length)return p.unavailable(load);
      var list=h("div","yield-list"+(wide?" yield-wide":""));
      y.pools.forEach(function(pl){ var row=h("div","yield-row");
        row.appendChild(h("span","yield-proj",pl.project)); row.appendChild(h("span","yield-sym",pl.symbol));
        row.appendChild(h("span","yield-chain",pl.chain)); row.appendChild(h("span","yield-tvl",big(pl.tvlUsd)));
        row.appendChild(h("span","yield-apy",pl.apy.toFixed(1)+"%")); list.appendChild(row); });
      p.setState(list); }).catch(function(){p.unavailable(load);}); }
    load(); refreshers.push(load); return p;
  }

  // RWAs em alta = AÇÕES TOKENIZADAS (TSLAX, GOOGLX, MSTRX…)
  // Só o CoinGecko tem a categoria; damos um respiro (dodge do burst) e
  // tentamos de novo se vier vazio (429 keyless), antes de dizer "indisponível".
  function tokenizedStocksPanel() {
    var p=panelFrame("RWAs em alta","ações tokenizadas");
    var tries=0;
    function load(){ tries=0; p.loading(); setTimeout(fetchStocks, 1100); }
    function fetchStocks(){
      AcademyData.tokenizedStocks().then(function(rows){
        if(!rows||!rows.length){ if(tries<2){ tries++; setTimeout(fetchStocks, 1800); return; } return p.unavailable(load); }
        var max=Math.max.apply(null,rows.map(function(r){return Math.abs(r.change24h)||1;}));
        var list=h("div","bar-list");
        rows.forEach(function(r,i){ var row=h("button","bar-row"); row.type="button"; row.addEventListener("click",assetLink(r.id,r.symbol));
          row.appendChild(h("span","bar-rank",String(i+1))); row.appendChild(h("span","bar-sym",r.symbol));
          var tr=h("span","bar-track"); var fl=h("span","bar-fill bar-fill-gold"); fl.style.width=Math.max(6,(Math.abs(r.change24h)/max)*100)+"%"; tr.appendChild(fl); row.appendChild(tr);
          row.appendChild(h("span","bar-val",money(r.usd))); row.appendChild(h("span","bar-chg "+cls(r.change24h),pctS(r.change24h)));
          list.appendChild(row); });
        p.setState(list);
      }).catch(function(){ if(tries<2){ tries++; setTimeout(fetchStocks, 1800); return; } p.unavailable(load); });
    }
    load(); refreshers.push(load); return p;
  }

  // Dominância das stablecoins (USDT domina ~59%, dado real)
  function stablecoinsPanel() {
    var p=panelFrame("Dominância das Stablecoins","market cap");
    function load(){ p.loading(); AcademyData.stablecoins(6).then(function(d){
      if(!d||!d.list||!d.list.length)return p.unavailable(load);
      var segs=d.list.map(function(s,i){return {value:s.mcap,color:SECTOR_COLORS[i%SECTOR_COLORS.length]};});
      var wrap=h("div","sector-wrap"); var dbox=h("div","donut-box"); wrap.appendChild(dbox);
      var legend=h("div","sector-legend");
      d.list.forEach(function(s,i){ var it=h("div","legend-item"); var dot=h("span","legend-dot"); dot.style.background=SECTOR_COLORS[i%SECTOR_COLORS.length];
        it.appendChild(dot); it.appendChild(h("span","legend-name",s.symbol)); it.appendChild(h("span","legend-val",s.share.toFixed(1)+"%")); legend.appendChild(it); });
      wrap.appendChild(legend); p.setState(wrap);
      AcademyChart.donut(dbox,segs,{ center: d.list[0] ? d.list[0].share.toFixed(0)+"%" : null });
    }).catch(function(){p.unavailable(load);}); }
    load(); refreshers.push(load); return p;
  }

  // Dominância de RWAs por protocolo/empresa (onde está o dinheiro RWA)
  function rwaDominancePanel() {
    var p=panelFrame("Dominância de RWAs","por protocolo");
    function load(){ p.loading(); AcademyData.rwaDominance(8).then(function(d){
      if(!d||!d.list||!d.list.length)return p.unavailable(load);
      var max=d.list[0].share||1; var list=h("div","domdist-list");
      d.list.forEach(function(r,i){ var row=h("div","domdist-row");
        var top=h("div","domdist-top"); top.appendChild(h("span","domdist-name",r.name)); top.appendChild(h("span","domdist-pct",r.share.toFixed(1)+"%")); row.appendChild(top);
        var tr=h("span","domin-track"); var fl=h("span","domin-fill"); fl.style.width=Math.max(3,(r.share/max)*100)+"%"; fl.style.background=SECTOR_COLORS[i%SECTOR_COLORS.length]; tr.appendChild(fl); row.appendChild(tr);
        var sub=h("span","domdist-sub",big(r.tvl)+" TVL · "+pctS(r.change24h)); row.appendChild(sub);
        list.appendChild(row); });
      p.setState(list); }).catch(function(){p.unavailable(load);}); }
    load(); refreshers.push(load); return p;
  }

  // TVL DeFi: gráfico com área colorida + dominância por categoria (DefiLlama-style)
  function tvlDefiPanel() {
    var p=panelFrame("TVL DeFi","total + dominância");
    function load(){ p.loading();
      Promise.all([AcademyData.defiTvl(), AcademyData.defiCategories(7)]).then(function(r){
        var tvl=r[0], cats=r[1];
        if(!tvl||!tvl.series||!tvl.series.length)return p.unavailable(load);
        var wrap=h("div","tvldefi");
        // topo: valor grande + variação + gráfico
        var head=h("div","tvldefi-head");
        var big1=h("span","tvldefi-value",big(tvl.current)); head.appendChild(big1);
        head.appendChild(h("span","tvldefi-delta "+cls(tvl.change24h),pctS(tvl.change24h)+" 24h"));
        wrap.appendChild(head);
        var box=h("div","tvldefi-chart"); wrap.appendChild(box);
        var up=tvl.series[tvl.series.length-1][1]>=tvl.series[0][1];
        // dominância por categoria
        if(cats&&cats.list&&cats.list.length){
          var dom=h("div","defidom");
          dom.appendChild(h("div","defidom-title","Dominância no DeFi · por categoria"));
          var bar=h("div","defidom-bar");
          cats.list.forEach(function(c,i){ var seg=h("span","defidom-seg"); seg.style.width=c.share+"%"; seg.style.background=SECTOR_COLORS[i%SECTOR_COLORS.length]; seg.title=c.cat+" "+c.share.toFixed(1)+"%"; bar.appendChild(seg); });
          dom.appendChild(bar);
          var leg=h("div","defidom-legend");
          cats.list.slice(0,6).forEach(function(c,i){ var it=h("span","defidom-item"); var dot=h("span","legend-dot"); dot.style.background=SECTOR_COLORS[i%SECTOR_COLORS.length]; it.appendChild(dot); it.appendChild(h("span","defidom-cat",c.cat)); it.appendChild(h("span","defidom-pct",c.share.toFixed(1)+"%")); leg.appendChild(it); });
          dom.appendChild(leg);
          wrap.appendChild(dom);
        }
        p.setState(wrap);
        AcademyChart.line(box, tvl.series, { up: up });
      }).catch(function(){p.unavailable(load);}); }
    load(); refreshers.push(load); return p;
  }

  // movers table
  function moversPanel(title,hint,loader) {
    var p=panelFrame(title,hint);
    function load(){ p.loading(); loader().then(function(rows){
      if(!rows||!rows.length)return p.unavailable(load);
      var list=h("div","mv-list");
      rows.slice(0,6).forEach(function(r){ var row=h("button","mv-row"); row.type="button"; row.addEventListener("click",assetLink(r.id,r.symbol));
        var badge=h("span","mv-badge"); if(r.image){var img=document.createElement("img");img.src=r.image;img.alt=r.symbol;img.loading="lazy";badge.appendChild(img);} else badge.textContent=(r.symbol||"?").slice(0,3);
        row.appendChild(badge); row.appendChild(h("span","mv-sym",r.symbol)); row.appendChild(h("span","mv-price",money(r.usd))); row.appendChild(h("span","mv-chg "+cls(r.change24h),pctS(r.change24h))); list.appendChild(row); });
      p.setState(list); }).catch(function(){p.unavailable(load);}); }
    load(); refreshers.push(load); return p;
  }

  function col(cls_){ return h("div","cc-col "+cls_); }

  /* ---------- montagem por aba ---------- */
  function buildTab(tab, mount) {
    refreshers = [];
    chainFocusSubs = [];
    if (globeCtl) { try{globeCtl.stop();}catch(e){} globeCtl=null; }

    if (tab === "Mercado Geral") {
      mount.appendChild(metricsBar());
      var grid=h("div","cc-grid");
      // esquerda: Criptos -> RWAs (ações tokenizadas) -> Stablecoins
      var L=col("cc-l"); L.appendChild(cryptosPanel()); L.appendChild(tokenizedStocksPanel()); L.appendChild(stablecoinsPanel());
      // centro: globo grande + TVL DeFi (com dominância)
      var C=col("cc-c"); C.appendChild(globeStage()); C.appendChild(tvlDefiPanel());
      // direita: TVL por rede -> Alertas (caixa maior)
      var R=col("cc-r"); R.appendChild(chainsPanel()); R.appendChild(alertsPanel(true));
      grid.appendChild(L); grid.appendChild(C); grid.appendChild(R); mount.appendChild(grid);
      var mv=h("div","movers-grid movers-grid-3");
      mv.appendChild(moversPanel("Tokens em alta","24h",function(){return AcademyData.gainers();}));
      mv.appendChild(moversPanel("Maiores quedas","24h",function(){return AcademyData.losers();}));
      mv.appendChild(moversPanel("Volume anormal","vol/cap",function(){return AcademyData.abnormalVolume();}));
      mount.appendChild(mv);

    } else if (tab === "DeFi") {
      mount.appendChild(metricsBar());
      var g2=h("div","cc-grid");
      var L2=col("cc-l"); L2.appendChild(chainsPanel()); L2.appendChild(flowsPanel());
      var C2=col("cc-c"); C2.appendChild(globeStage()); C2.appendChild(tvlTrendPanel());
      var R2=col("cc-r"); R2.appendChild(yieldsPanel()); R2.appendChild(alertsPanel());
      g2.appendChild(L2); g2.appendChild(C2); g2.appendChild(R2); mount.appendChild(g2);

    } else if (tab === "RWA") {
      mount.appendChild(metricsBar());
      var g3=h("div","cc-grid cc-grid-2");
      var L3=col("cc-l"); L3.appendChild(rwaTvlPanel());
      var C3=col("cc-c"); C3.appendChild(moversPanel("RWAs em alta (mercado)","24h",function(){return AcademyData.rwa();}));
      var R3=col("cc-r"); R3.appendChild(alertsPanel());
      g3.appendChild(L3); g3.appendChild(C3); g3.appendChild(R3); mount.appendChild(g3);

    } else if (tab === "Analytics") {
      var g4=h("div","cc-grid");
      var L4=col("cc-l"); L4.appendChild(dominancePanel()); L4.appendChild(sectorsPanel());
      var C4=col("cc-c"); C4.appendChild(heatmapPanel());
      var R4=col("cc-r"); R4.appendChild(btcTrendPanel()); R4.appendChild(tvlTrendPanel());
      g4.appendChild(L4); g4.appendChild(C4); g4.appendChild(R4); mount.appendChild(g4);

    } else if (tab === "Yields") {
      mount.appendChild(metricsBar());
      var yw=h("div","cc-single"); yw.appendChild(yieldsPanel(true)); mount.appendChild(yw);
    }
  }

  /* ---------- render principal ---------- */
  window.renderDashboard = function (el) {
    var current = (window.__academyTab && TABS.indexOf(window.__academyTab)>-1) ? window.__academyTab : "Mercado Geral";
    var root = h("div","cc-console");
    var content = h("div","cc-content");

    function draw(tab) {
      window.__academyTab = tab;
      if (bar && bar._clock) clearInterval(bar._clock);
      while (root.firstChild) root.removeChild(root.firstChild);
      bar = topBar(tab, function(t){ if(t!==window.__academyTab) draw(t); });
      root.appendChild(bar);
      while (content.firstChild) content.removeChild(content.firstChild);
      root.appendChild(content);
      buildTab(tab, content);
    }
    var bar = null;
    draw(current);
    el.appendChild(root);

    // auto-refresh 60s: re-chama os loaders sem tocar no globo nem no DOM
    var timer=setInterval(function(){
      if(!document.body.contains(root)){ clearInterval(timer); return; }
      refreshers.forEach(function(f){ try{f();}catch(e){} });
    },60000);
    window.__academyOnLeave=function(){ clearInterval(timer); if(bar&&bar._clock)clearInterval(bar._clock); if(globeCtl){try{globeCtl.stop();}catch(e){} globeCtl=null;} };
  };
})();
