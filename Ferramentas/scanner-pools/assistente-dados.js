/* Consultas locais determinísticas. Fee segue o scanner: 0,3 = 0,3%.

   O motor entende a pergunta antes de escolher pools: token (SOL, USDC…),
   DEX, rede, ordem pedida (maior volume, maior APR…) e limites ("razão
   acima de 3"). Antes, qualquer pergunta com "pool" devolvia a mesma lista
   por nota — "pools de SOL" trazia pools da BNB Chain. Como a IA recebe as
   pools escolhidas aqui, escolher certo vale para as duas respostas. */
(function(g){
  'use strict';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const n=s=>Number(String(s).replace(/\.(?=\d{3}\b)/g,'').replace(',','.'));
  const usd=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'USD',maximumFractionDigits:2});
  /* valor curto para lista: US$ 1,25 mi · US$ 152 mil */
  const usdc=v=>{v=Number(v);if(!Number.isFinite(v))return '—';const a=Math.abs(v);
    if(a>=1e9)return 'US$ '+(v/1e9).toLocaleString('pt-BR',{maximumFractionDigits:2})+' bi';
    if(a>=1e6)return 'US$ '+(v/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})+' mi';
    if(a>=1e4)return 'US$ '+Math.round(v/1e3).toLocaleString('pt-BR')+' mil';
    return usd(v);};
  const num=(v,d=2)=>Number(v).toLocaleString('pt-BR',{maximumFractionDigits:d});
  /* percentual curto que não some: 0,0001% continua 0,0001%, não 0% */
  const pct=v=>{v=Number(v);if(!Number.isFinite(v))return '—';const a=Math.abs(v);return num(v,a===0?0:a<0.001?5:a<0.01?4:a<1?3:2);};
  const ve33=new Set(['Aerodrome','Velodrome','THENA','Pharaoh','Ramses']);
  const regrasBase='TVL mínimo US$ 100.000; razão > 0,50. Meme detectada: razão > 2 e aprovação por pool; conservadora nunca admite meme. Sólidas não significa segura. Referências por lado: conservadora 30% a 60%, 3 a 9 meses; mediana 9% a 27%, cerca de 27 dias; agressiva 3% a 9%, giro de 3 a 9 dias. Essas referências não classificam automaticamente: considerar faixa, função, prazo e ativos. Em 9%, objetivo e prazo desempatarão; entre 27% e 30%, pedir contexto. Range de 6% = −6%/+6%, não −3%/+3%; faixa assimétrica mantém os limites informados. Mediana pode admitir meme em tese com prazo e saída. BTC e ETH geralmente ficam fora de agressivas; exceções exigem justificativa confirmada. SOL pode integrar os três perfis sem virar meme. Crossovers são interesses, não aprovação automática. Não há obrigação de abrir 3, 6 ou 9 pools. Taxas agregadas não são lucro líquido nem rendimento garantido da posição concentrada.';
  function par(s){return norm(s).replace(/\s+/g,'').split(/[/\-]/).sort().join('/');}
  const razao=p=>Number(p.tvl)>0?Number(p.vol24h)/Number(p.tvl):0;
  /* taxa por dia para cada dólar: fee% × razão. É a "eficiência" do Guia. */
  const eficiencia=p=>(Number(p.fee)||0)/100*razao(p);
  const aprDe=p=>Number.isFinite(Number(p.apr))&&p.apr!==null?Number(p.apr):eficiencia(p)*365*100;
  function ordenar(ps,c){
    const preferencias=(c.preferencias?.pares||[]).map(par);
    const tokens=new Set((c.preferencias?.estrategia?.tokensFavoritos||[]).map(x=>String(x).toUpperCase()));
    const score=p=>(Number(p.nota)||0)+
      String(p.pool||'').toUpperCase().split(/[/\-]/).filter(t=>tokens.has(t.trim())).length*8+Number(!!p.fav)*6;
    return ps.slice().sort((a,b)=>Number(preferencias.includes(par(b.pool)))-Number(preferencias.includes(par(a.pool)))||score(b)-score(a)||Number(b.tvl)-Number(a.tvl));
  }
  function memeExcluida(text){return /\b(sem|nao|exclu\w*|evit\w*|remov\w*|tir\w*)\b.{0,45}\b(memes?|memecoins?)\b/.test(norm(text));}
  function memePermitida(text){const q=norm(text);if(memeExcluida(q))return false;return /\b(com|inclu\w*|aceit\w*|permit\w*|analis\w*|avali\w*|compar\w*)\b.{0,40}\b(memes?|memecoins?)\b/.test(q);}
  function eligible(c){
    const seen=new Set();
    return (c.pools||[]).filter(p=>{
      if(p.migrada||p.arquivada||!Number.isFinite(Number(p.tvl))||p.tvl<100000||!Number.isFinite(Number(p.vol24h))||p.vol24h/p.tvl<=.5)return false;
      const meme=!!p.sinais?.memecoin?.detectada;
      if(p.trilho==='barrada'||(meme&&p.vol24h/p.tvl<=2)||c.trilho(p)==='oculta')return false;
      const key=c.identidade?c.identidade(p):(p.sid||'manual:'+p.id);
      if(seen.has(key))return false;seen.add(key);return true;
    });
  }
  /* uma linha por pool, legível: par, onde, e os números que decidem */
  function linha(p,i){
    return `${i!=null?(i+1)+'. ':''}${p.pool} · ${p.platform} · ${p.network}\n   TVL ${usdc(p.tvl)} · volume 24h ${usdc(p.vol24h)} · razão ${num(razao(p))} · fee ${Number(p.fee)>0?pct(p.fee)+'%':'não informada'}`+
      (p.nota!=null?` · nota ${num(p.nota,0)}`:'');
  }
  function wrap(c,r){
    if(c.status?.doCache)r.texto+='\nDados em cache: a atualização do servidor falhou; confira a idade dos dados.';
    if(c.status?.erro&&!c.status?.doCache)r.texto+='\nColeta/leitura indisponível: o conjunto pode estar incompleto.';
    return r;
  }
  function period(q){
    let m=q.match(/(?:ultimos?\s+|em\s+|por\s+|durante\s+|de\s+)?(\d+)\s+dias?/);if(m)return Number(m[1]);
    if(/dois dias/.test(q))return 2;if(/tres dias/.test(q))return 3;
    m=q.match(/(\d+)\s+semanas?/);if(m)return Number(m[1])*7;if(/\bsemana\b/.test(q))return 7;
    m=q.match(/(\d+)\s+mes(?:es)?/);if(m)return Number(m[1])*30;if(/\bmes\b/.test(q))return 30;
    if(/\bano\b/.test(q))return 365;
    return 1;
  }

  /* ---------------- entender a pergunta ---------------- */
  const REDES=[['bnb chain',/\b(bnb chain|bsc|binance smart chain)\b/],['solana',/\bsolana\b/],['base',/\bbase\b(?!\s+(?:em|de|da|do|nisso|nos?|nas?)\b)/],
    ['arbitrum',/\b(arbitrum|arb)\b/],['ethereum',/\b(ethereum|mainnet)\b/],['polygon',/\b(polygon|matic)\b/],['optimism',/\b(optimism)\b/],
    ['avalanche',/\b(avalanche|avax)\b/],['sui',/\bsui\b/],['hyperevm',/\b(hyperevm|hyperliquid)\b/],['robinhood',/\brobinhood\b/]];
  const DEXS=['uniswap','orca','raydium','pancakeswap','aerodrome','velodrome','thena','meteora','curve','sushiswap','camelot','cetus','kamino','pharaoh','ramses','hyperswap','lfj','project x','balancer'];
  /* palavras do português (e da tela) que coincidem com símbolos de token */
  const PARADA=new Set(['A','O','E','OU','DE','DA','DO','DAS','DOS','NA','NO','NAS','NOS','EM','UM','UMA','COM','SEM','QUE','QUAL','QUAIS','POOL','POOLS','PARA','PRA','POR','MAIS','MENOS','MAIOR','MENOR','MELHOR','MELHORES','TOP','ME','MEU','MINHA','MINHAS','TEM','HA','SAO','E','HOJE','DIA','DIAS','SEMANA','MES','ANO','SIM','NAO','OK','OI','OLA','AI','VAI','PODE','QUANTO','RENDE','RENDER','GANHAR','DOLAR','DOLARES','USD','APR','APY','TVL','FEE','TAXA','TAXAS','RAZAO','GIRO','NOTA','VOLUME','REDE','DEX','LP','IL','MEME','MEMES','MEMECOIN','MEMECOINS','FAVORITA','FAVORITAS','LISTE','LISTA','MOSTRA','MOSTRE','ACIMA','ABAIXO','ENTRE','ALTA','BAIXA','ALTO','BAIXO','BOM','BOA','MIL','MI','K','M','X','VS','CONTRA','ONDE','COMO','PAR','PARES','TOKEN','TOKENS','REAL','LIQUIDEZ','EFICIENCIA','RENDIMENTO','RETORNO','SOLIDA','SOLIDAS','CONSERVADORA','AGRESSIVA','MEDIANA','PERFIL','HOJE','AGORA','ULTIMOS','ULTIMAS','COMPARA','COMPARAR']);
  function semEspaco(s){return s.replace(/\s+/g,'');}
  function entender(q,pools){
    let resto=q;const f={};
    for(const [nome,re] of REDES)if(re.test(resto)){f.rede=nome;f.redeNome=(pools.find(p=>norm(p.network)===nome)||{}).network||nome;resto=resto.replace(re,' ');break;}
    const plataformas=[...new Set(pools.map(p=>norm(p.platform)).filter(Boolean)),...DEXS];
    for(const d of plataformas){
      const curto=d.split(/[\s-]/)[0];
      const alvo=new RegExp('\\b('+d.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+(curto.length>=5&&curto!==d?'|'+curto:'')+(d.endsWith('swap')&&d.length>8?'|'+d.slice(0,-4):'')+')\\b');
      if(alvo.test(resto)){f.dex=d;f.dexCurto=d.endsWith('swap')?d.slice(0,-4):curto;f.dexNome=(pools.find(p=>norm(p.platform)===d)||{}).platform||d.replace(/\b\w/g,ch=>ch.toUpperCase());resto=resto.replace(alvo,' ');break;}
    }
    /* emissor do RWA ("SpaceX da Ondo", "pools da xStocks") */
    const EMI=[['xStocks',/\bx ?stocks?\b/],['Backpack',/\bbackpack\b/],['Binance bStocks',/\bb ?stocks?\b/],['Ondo',/\bondo\b/],['Coinbase',/\bcoinbase\b/]];
    for(const [nome,re] of EMI)if(re.test(resto)){f.emissor=nome;resto=resto.replace(re,' ');break;}
    f.pares=[];f.excluidos=[];
    let fimAnterior=0,negacaoAnterior=false;
    for(const m of resto.matchAll(/\b([a-z][a-z0-9.]{1,14})\s*\/\s*([a-z][a-z0-9.]{1,14})\b/g)){
      const ligaLista=/^\s*(?:,\s*)?(?:(?:e|ou|vs|x|contra|com)\s+)?$/.test(resto.slice(fimAnterior,m.index));
      const negativo=(negacaoAnterior&&ligaLista)||/\b(?:sem|nao|exclu\w*|evit\w*)\s+(?:\w+\s+){0,3}$/.test(resto.slice(Math.max(0,m.index-45),m.index));
      (negativo?f.excluidos:f.pares).push(par(m[1]+'/'+m[2]));
      fimAnterior=m.index+m[0].length;negacaoAnterior=negativo;
    }
    resto=resto.replace(/\b[a-z][a-z0-9.]{1,14}\s*\/\s*[a-z][a-z0-9.]{1,14}\b/g,' ');
    /* token sozinho ("pools de SOL"): só símbolos que existem nas pools */
    const simbolos=new Set();pools.forEach(p=>String(p.pool||'').toUpperCase().split(/[/\-]/).forEach(s=>{s=s.trim();if(s)simbolos.add(s);}));
    f.tokens=[...new Set((resto.toUpperCase().match(/[A-Z0-9][A-Z0-9.]{1,14}/g)||[]).filter(w=>simbolos.has(w)&&!PARADA.has(w)&&!/^\d+$/.test(w)))];
    /* ordem pedida */
    const metr=[['rendimento',/\b(rend\w*|eficien\w*|ganh\w*|lucr\w*)\b/],['volume',/\bvolume\b/],['tvl',/\b(tvl|liquidez)\b/],['apr',/\b(apr|apy)\b/],
      ['razao',/\b(razao|giro|vol\/tvl)\b/],['fee',/\b(fee|taxa)\b/],['nota',/\bnota\b/]];
    const desc=/\b(maior\w*|mais alt\w*|top|maxim\w*|melhor\w*|mais)\b/,asc=/\b(menor\w*|mais baix\w*|minim\w*|pior\w*|menos)\b/;
    for(const [m,re] of metr){
      const hit=resto.match(new RegExp('(?:'+desc.source+'|'+asc.source+')[^.?!]{0,25}?'+re.source+'|'+re.source+'[^.?!]{0,12}?(?:'+desc.source+'|'+asc.source+')'));
      if(hit){f.ordem={metrica:m,desc:!asc.test(hit[0])};break;}
    }
    if(!f.ordem&&/\brende\w* mais\b|\bque mais rende\b/.test(resto))f.ordem={metrica:'rendimento',desc:true};
    /* limites: "razão acima de 3", "tvl acima de 1 milhão", "fee até 0,3" */
    f.limites=[];
    const reLim=/\b(razao|giro|tvl|liquidez|volume|fee|taxa|apr|nota)\b\s*(?:de\s+)?(acima de|maior que|mais de|superior a|pelo menos|minim[oa] de|>=|>|abaixo de|menor que|menos de|inferior a|ate|no maximo|<=|<)\s*(?:us\$|\$|usd)?\s*([\d.,]+)\s*(bilh\w*|bi|milh\w*|mil|mi|k|m)?\b\s*%?/g;
    for(const m of resto.matchAll(reLim)){
      let v=n(m[3]);const u=m[4]||'';
      if(/^(mil|k)$/.test(u))v*=1e3;else if(/^(mi|m|milh)/.test(u))v*=1e6;else if(/^(bi|bilh)/.test(u))v*=1e9;
      const met={giro:'razao',liquidez:'tvl',taxa:'fee'}[m[1]]||m[1];
      if(Number.isFinite(v))f.limites.push({metrica:met,min:!/abaixo|menor|menos|inferior|ate|maximo|</.test(m[2]),valor:v});
    }
    f.temFiltro=!!(f.emissor||f.rede||f.dex||f.pares.length||f.tokens.length||f.ordem||f.limites.length);
    return f;
  }
  const VALOR={volume:p=>Number(p.vol24h),tvl:p=>Number(p.tvl),apr:aprDe,razao,fee:p=>Number(p.fee),nota:p=>Number(p.nota)||0,rendimento:eficiencia};
  const ROTULO={volume:'volume 24h',tvl:'TVL',apr:'APR',razao:'razão',fee:'fee',nota:'nota',rendimento:'rendimento de taxas (fee × razão)'};
  function aplicar(f,ps){
    if(f.rede)ps=ps.filter(p=>norm(p.network)===f.rede);
    if(f.dex)ps=ps.filter(p=>{const x=semEspaco(norm(p.platform));return x===semEspaco(f.dex)||x.startsWith(semEspaco(f.dexCurto||f.dex));});
    if(f.pares.length)ps=ps.filter(p=>f.pares.includes(par(p.pool)));
    if(f.excluidos.length)ps=ps.filter(p=>!f.excluidos.includes(par(p.pool)));
    if(f.emissor)ps=ps.filter(p=>String(g.ScannerServidor?.rotuloEmissor?.(p)||'').includes(f.emissor));
    if(f.tokens.length)ps=ps.filter(p=>{const s=String(p.pool||'').toUpperCase().split(/[/\-]/).map(x=>x.trim());return f.tokens.every(t=>s.includes(t));});
    for(const l of f.limites)ps=ps.filter(p=>{const v=VALOR[l.metrica](p);return l.min?v>l.valor:v<=l.valor;});
    return ps;
  }
  function filtered(q,pools){
    let ps=/favorit/.test(q)?pools.filter(p=>p.fav):pools;
    return aplicar(entender(q,pools),ps);
  }
  function ordenarPor(f,ps,c){
    if(!f.ordem)return ordenar(ps,c);
    const v=VALOR[f.ordem.metrica];
    return ps.slice().sort((a,b)=>f.ordem.desc?v(b)-v(a):v(a)-v(b));
  }
  /* o que foi entendido, numa frase — a pessoa vê se o filtro bateu */
  function resumoFiltro(f){
    const partes=[];
    if(f.tokens.length)partes.push('com '+f.tokens.join(' e '));
    if(f.pares.length)partes.push('par '+f.pares.map(x=>x.toUpperCase()).join(', '));
    if(f.emissor)partes.push('emissor '+f.emissor);
    if(f.dex)partes.push('na '+f.dexNome);
    if(f.rede)partes.push('rede '+f.redeNome);
    f.limites.forEach(l=>partes.push(ROTULO[l.metrica]+(l.min?' acima de ':' até ')+(['tvl','volume'].includes(l.metrica)?usdc(l.valor):num(l.valor))));
    if(f.ordem)partes.push('ordenadas por '+(f.ordem.desc?'maior ':'menor ')+ROTULO[f.ordem.metrica]);
    return partes.join(' · ');
  }
  function lista(items,f,extra){
    return items.map((x,i)=>linha(x.pool,i)+(f?.ordem&&!['volume','tvl','razao','fee','nota'].includes(f.ordem.metrica)?`\n   ${ROTULO[f.ordem.metrica]}: ${f.ordem.metrica==='apr'?num(aprDe(x.pool))+'%':pct(eficiencia(x.pool)*100)+'% ao dia'}`:'')+(extra?extra(x):'')).join('\n\n');
  }

  /* ---------------- Guia: conceitos sem IA ---------------- */
  function conceito(q,c){
    const secs=typeof c.guia==='function'?c.guia():[];if(!secs.length)return null;
    const termo=norm(q).replace(/\b(o que|oque|e|sao|significa|significado|como funciona|explica\w*|me|fala|sobre|defin\w*|pra que serve|para que serve|a|o|um|uma|de|da|do|no|na|qual|quais|diferenca|entre)\b/g,' ').replace(/[?!.,]/g,' ').trim();
    if(!termo)return null;
    const palavras=termo.split(/\s+/).filter(w=>w.length>=2);
    const glos=secs.flatMap(s=>s.termos||[]);
    const sinon={'impermanent':'il','perda impermanente':'il','liquidez concentrada':'clmm','faixa':'range','range':'range','clmm':'clmm','eficiencia':'eficiencia'};
    let alvo=glos.find(t=>{const k=norm(t.termo);return palavras.some(w=>k===w||k.split(/[\s/()]+/).includes(w)||k.startsWith(w+' '))||Object.entries(sinon).some(([a,b])=>termo.includes(a)&&k.startsWith(b));});
    const pontua=s=>palavras.reduce((a,w)=>a+(norm(s.titulo).includes(w)?5:0)+(norm(s.texto).split(w).length-1),0);
    const sec=secs.slice().sort((a,b)=>pontua(b)-pontua(a))[0];
    if(!alvo&&(!sec||pontua(sec)<5))return null;
    let txt=alvo?`${alvo.termo}: ${alvo.def}`:'';
    if(sec&&pontua(sec)>=5){
      const trecho=sec.texto.split(/(?<=\.)\s+/).reduce((a,fr)=>a.length<480?a+(a?' ':'')+fr:a,'');
      txt+=(txt?'\n\n':'')+trecho+`\n\nMais no Guia: tópico ${sec.num} · ${sec.titulo}.`;
    }
    return txt;
  }

  async function historyAnswer(q,c,ps){
    const days=period(q);if(days<1||days>365)return {tipo:'esclarecimento',items:[],texto:'Informe um período entre 1 e 365 dias.'};
    let unavailable=0;const items=[];
    // Limite de concorrência: evita uma chamada simultânea por favorita.
    let next=0;
    async function worker(){while(next<ps.length){const p=ps[next++];try{
      const hs=(await c.historico(p)).filter(h=>/^\d{4}-\d{2}-\d{2}$/.test(h.dia)&&Number.isFinite(Number(h.tvl))&&h.tvl>=0).sort((a,b)=>a.dia.localeCompare(b.dia));
      const last=hs.at(-1);if(!last){unavailable++;continue;}
      const now=new Date(c.agora||Date.now()).toISOString().slice(0,10);
      if(last.dia!==now){unavailable++;continue;}
      const target=new Date(last.dia+'T00:00:00Z');target.setUTCDate(target.getUTCDate()-days);
      const base=hs.find(h=>h.dia===target.toISOString().slice(0,10));
      if(!base){unavailable++;continue;}
      const delta=last.tvl-base.tvl;
      if(/aument|cresce|subi/.test(q)&&delta<=0)continue;
      items.push({id:p.id,pool:p,delta,pct:base.tvl>0?delta/base.tvl*100:null,base:base.dia,fim:last.dia,inicial:base.tvl,final:last.tvl});
    }catch(e){unavailable++;}}}
    await Promise.all(Array.from({length:Math.min(4,ps.length)},worker));items.sort((a,b)=>b.delta-a.delta);
    const rows=items.slice(0,10).map((x,i)=>`${i+1}. ${x.pool.pool} · ${x.pool.platform} · ${x.pool.network}\n   ${x.base}: ${usd(x.inicial)} → ${x.fim}: ${usd(x.final)} · Δ ${usd(x.delta)} (${x.pct===null?'base zero: percentual indefinido':num(x.pct)+'%'})`);
    return {tipo:'historico',items,indisponiveis:unavailable,texto:`TVL em ${days} dia(s), entre os registros diários de cada pool (não são 48 horas exatas). ${ps.length} pool(s) consultada(s).\n\n${rows.join('\n\n')||'Nenhuma comparação atende à pergunta.'}${items.length>10?'\nMostrando as 10 maiores variações.':''}${unavailable?'\n'+unavailable+' pool(s) com histórico insuficiente ou indisponível.':''}`};
  }

  function dinheiro(q){
    const capital=q.match(/(?:com|capital de|investindo|aplicando|aplicar|investir|colocar|coloco|colocando|botar|botando)\s*(?:us\$|\$|usd)?\s*([\d.,]+)\s*(mil|k)?/);
    const goal=q.match(/(\d+(?:[.,]\d+)?)\s*(?:a|ou|ate|e|-)\s*(\d+(?:[.,]\d+)?)\s*(?:dolares?|usd|us\$)/)||q.match(/(?:fazer|ganhar|gerar|render|devolver)\s*(?:us\$|\$)?\s*(\d+(?:[.,]\d+)?)\s*(?:dolares?|usd)/);
    let cap=capital?n(capital[1])*(capital[2]?1e3:1):null;
    /* "quanto rende 1000 dólares…": um valor só, sem meta, é o capital */
    if(cap==null&&!goal){const m=q.match(/(?:us\$|\$)\s*([\d.,]+)\s*(mil|k)?|([\d.,]+)\s*(mil|k)?\s*(?:dolares?|usd|us\$|\$)/);if(m)cap=n(m[1]||m[3])*((m[2]||m[4])?1e3:1);}
    return {capital:cap,goal};
  }

  async function consultar(pergunta,c){
    const q=norm(pergunta);const base=eligible(c);let ps=/favorit/.test(q)?base.filter(p=>p.fav):base;let r;
    const f=entender(q,base);ps=aplicar(f,ps);
    const pref=c.preferencias;
    if(memeExcluida(q)||(pref?.evitarMemes&&!memePermitida(q)))ps=ps.filter(p=>!p.sinais?.memecoin?.detectada);
    if(pref&&pref.redes?.length&&!f.rede)ps=ps.filter(p=>pref.redes.some(v=>norm(v)===norm(p.network)));
    const filtro=resumoFiltro(f);
    const vazio=()=>`Nenhuma pool atende${filtro?' a: '+filtro:''}.`+(f.dex&&!base.some(p=>semEspaco(norm(p.platform)).startsWith(semEspaco(f.dexCurto||f.dex)))?`\nNenhuma pool da ${f.dexNome} passou nos cortes do Scanner nesta coleta.`:'');
    const curta=q.trim().split(/\s+/).length<=4;
    const {capital,goal}=dinheiro(q);
    if(curta&&/^(oi|ola|opa|e ai|eai|hey|bom dia|boa tarde|boa noite|salve)\b/.test(q)){
      const h=new Date(c.agora||Date.now()).getHours();
      r={tipo:'saudacao',items:[],texto:`${h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'}. ${base.length} pools passam nos cortes agora, ${base.filter(p=>c.trilho(p)==='solida').length} delas nas Sólidas. Pergunte, por exemplo: “maior volume na Solana”, “pools de SOL com razão acima de 3” ou “quanto rende 1000 dólares na SOL/USDC em 7 dias”.`};
    }else if(curta&&/^(obrigad\w*|valeu|vlw|brigad\w*)\b/.test(q)){
      r={tipo:'saudacao',items:[],texto:'Disponha.'};
    }else if(/\b(preco|cotacao|vai subir|vai cair|amanha|previs\w*)\b/.test(q)&&!f.ordem&&!f.limites.length){
      r={tipo:'ajuda',items:[],texto:'O Scanner não prevê preço: ele lê TVL, volume, taxa e histórico das pools. Pergunte sobre pools, volume, APR, taxas ou rendimento estimado.'};
    }else if(/(?:explique|quais sao|como funciona|qual e).*\b(?:regra|rating|range)\b|\bregras\b/.test(q)&&!/tvl/.test(q)){
      r={tipo:'regras',items:[],texto:(c.regras?.resumo||regrasBase)};
    }else if(/tvl/.test(q)&&/dias?|aument|evolu|cresce/.test(q)&&!f.limites.length&&!f.ordem){
      r=await historyAnswer(q,c,ps);
    }else if(f.pares.length>=2||(/\b(compar\w*|versus|vs|contra)\b/.test(q)&&f.pares.length+f.tokens.length>=2)){
      /* comparar: a maior pool de cada par, lado a lado */
      /* a maior pool de cada par COM fee conhecida: fee não informada zera o
         "rende mais" e o veredito sairia torto */
      const grupos=f.pares.length>=2?f.pares.map(k=>base.filter(p=>par(p.pool)===k).sort((a,b)=>Number(Number(b.fee)>0)-Number(Number(a.fee)>0)||b.tvl-a.tvl)[0]):[];
      const items=grupos.filter(Boolean).map(p=>({id:p.id,pool:p}));
      const faltam=f.pares.filter(k=>!base.some(p=>par(p.pool)===k)).map(k=>k.toUpperCase());
      let veredito='';
      if(items.length>=2){
        const melhor=(fn)=>items.slice().sort((a,b)=>fn(b.pool)-fn(a.pool))[0].pool.pool;
        const semFee=items.filter(x=>!(Number(x.pool.fee)>0)).map(x=>x.pool.pool);
        veredito=`\n\n${semFee.length?'Fee não informada pela fonte: '+semFee.join(', ')+' — não dá para dizer qual rende mais.':'Rende mais em taxas por dólar: '+melhor(eficiencia)+'.'} Maior liquidez: ${melhor(p=>p.tvl)}. Maior giro: ${melhor(razao)}.`;
      }
      r={tipo:'comparar',items,texto:(items.length?`Comparação (maior pool de cada par nos cortes do Scanner):\n\n${lista(items,null,x=>`\n   rende ${pct(eficiencia(x.pool)*100)}% ao dia em taxas (fee × razão)`)}${veredito}`:'Nenhum dos pares está nas pools que passam nos cortes.')+(faltam.length?`\n\nFora dos cortes agora: ${faltam.join(', ')}.`:'')+'\n\nReferência agregada; não considera faixa, IL nem custos.'};
    }else if(capital!=null&&!goal&&(f.pares.length||f.tokens.length||f.dex||f.rede||/\b(nessa|essa|esta|nesta)\b/.test(q))&&/\b(rend\w*|ganh\w*|ger\w*|quanto|da quanto|lucr\w*|faz\w*)\b/.test(q)){
      const days=period(q);
      if(!(capital>0&&days>=1&&days<=365))r={tipo:'esclarecimento',items:[],texto:'Informe um capital positivo e um prazo entre 1 e 365 dias.'};
      else{
        const usaveis=ps.filter(p=>!ve33.has(p.platform)&&Number(p.fee)>0);
        const items=ordenarPor(f.ordem?f:{...f,ordem:{metrica:'tvl',desc:true}},usaveis,c).slice(0,5).map(p=>({id:p.id,pool:p,estimativa:capital*eficiencia(p)*days}));
        r={tipo:'projecao',items,texto:items.length?`${usd(capital)} por ${days} dia(s), referência agregada de taxas:\n\n${lista(items,null,x=>`\n   ≈ ${usd(x.estimativa)} em taxas (${pct(eficiencia(x.pool)*100)}% ao dia)`)}\n\nConta: capital × fee × volume 24h ÷ TVL × dias. Vale para liquidez espalhada na pool inteira; numa faixa concentrada pode render mais enquanto o preço fica dentro dela, e nada fora dela. Não inclui IL nem custos.`:vazio()+(ps.some(p=>ve33.has(p.platform))?'\nPools ve(3,3) (Aerodrome, Velodrome, THENA…) pagam o LP em emissões, não pela fee: ficam fora desta conta.':'')};
      }
    }else if(/\b(o que|oque|como funciona|explica\w*|significa\w*|defin\w*|pra que serve|para que serve|diferenca entre)\b/.test(q)&&!f.pares.length&&!f.dex&&(c.guia?(r=conceito(q,c)):null)){
      r={tipo:'conceito',items:[],texto:r};
    }else if(/\b(melhor\w*|oportunidad\w*|recomend\w*|merece\w*.*atencao)\b/.test(q)&&!f.ordem){
      const e=pref?.estrategia;
      ps=ps.filter(p=>c.trilho(p)==='solida'&&(!e||(
        p.tvl>=e.tvlMinUsd&&p.vol24h>=e.volume24hMinUsd&&p.vol24h/p.tvl>e.razao24hMin)));
      const total=ps.length,limite=e?.maxResultados||8;
      const items=ordenar(ps,c).slice(0,limite).map(p=>({id:p.id,pool:p}));
      r={tipo:'oportunidades',items,totalElegiveis:total,texto:`${total} pool(s) examinadas após os cortes do scanner e da sua estratégia${filtro?' ('+filtro+')':''}. As ${items.length} de maior nota:\n\n${lista(items)||vazio()}\n\nNota, pares/tokens favoritos e favoritas definem a ordem; preferência não é aprovação. Taxas e volume não são lucro líquido nem garantia.`};
    }else if(/dolar|\$|\busd\b/.test(q)&&(goal||!f.temFiltro)){
      if(!capital||!goal){r={tipo:'esclarecimento',items:[],texto:'Informe capital, meta de taxas e prazo. Exemplo: quais pools para gerar 2 a 3 dólares em um dia com 100 dólares? Ou, para uma pool: quanto rende 1000 dólares na SOL/USDC em 7 dias?'};}
      else{
        const money=capital,min=n(goal[1]),max=goal[2]?n(goal[2]):min,days=period(q);
        if(!(money>0&&min>0&&max>=min&&days>=1&&days<=365))return wrap(c,{tipo:'esclarecimento',items:[],texto:'Informe capital e meta positivos e prazo entre 1 e 365 dias.'});
        ps=ps.filter(p=>c.trilho(p)==='solida');
        if(/conservador/.test(q))ps=ps.filter(p=>!p.sinais?.memecoin?.detectada);
        const scored=ps.filter(p=>!ve33.has(p.platform)&&Number.isFinite(Number(p.fee))&&p.fee>0).map(p=>({id:p.id,pool:p,estimativa:money*(p.fee/100)*(p.vol24h/p.tvl)*days}));
        const aprovadas=scored.filter(x=>x.estimativa>=min-1e-9&&x.estimativa<=max+1e-9),porId=new Map(aprovadas.map(x=>[x.pool,x]));
        const items=ordenar(aprovadas.map(x=>x.pool),c).slice(0,10).map(p=>porId.get(p));
        r={tipo:'meta',items,texto:`Referência agregada de taxas para ${usd(money)} em ${days} dia(s), meta ${usd(min)}–${usd(max)}. ${ps.length} candidatas após filtros; ${scored.length} com taxa utilizável.\n\n${lista(items,null,x=>`\n   ≈ ${usd(x.estimativa)} em taxas`)||'Nenhuma pool atende à meta com essa referência.'}\n\nCálculo: capital × (fee% ÷ 100) × volume24h/TVL × dias. Não é projeção de posição concentrada: faixa, liquidez ativa, tempo dentro da faixa, preço e custos não estão calculados. Taxas não equivalem a lucro líquido. Protocolos de emissões não entram nesta conta.`};
      }
    }else if(/pool|favorit|conservador|median|agressiv/.test(q)||f.temFiltro){
      ps=ps.filter(p=>c.trilho(p)==='solida');if(/conservador/.test(q))ps=ps.filter(p=>!p.sinais?.memecoin?.detectada);
      const items=ordenarPor(f,ps,c).slice(0,10).map(p=>({id:p.id,pool:p}));
      r={tipo:'lista',items,totalElegiveis:ps.length,texto:items.length?`${ps.length} pool(s)${filtro?' — '+filtro:''}. ${ps.length>10?'As 10 primeiras':'Todas'}${f.ordem?'':c.preferencias?.pares?.length?', pares de interesse confirmados primeiro, depois nota':' por nota'}:\n\n${lista(items,f)}\n\nO perfil conservador, mediano ou agressivo depende da montagem, faixa, objetivo e prazo. Meme não é permitida em conservadora; ausência de detecção não certifica a categoria dos ativos.`:vazio()};
    }else r={tipo:'ajuda',items:[],texto:'Não entendi a pergunta. Posso responder sobre:\n• pools por token, par, DEX ou rede (“pools de SOL na Raydium”)\n• ordem e limites (“maior volume”, “razão acima de 3”, “TVL acima de 1 milhão”)\n• quanto rende um valor numa pool (“quanto rende 1000 dólares na SOL/USDC em 7 dias”)\n• comparar pares (“compara SOL/USDC e SOL/USDT”)\n• TVL das favoritas nos últimos dias\n• conceitos do Guia (“o que é impermanent loss”)'};
    if(r.tipo==='meta'&&c.preferencias?.pares?.length)r.texto+='\nPares de interesse confirmados priorizados antes de nota e TVL; essa preferência não confirma adequação nem ignora cortes.';
    const dated=r.items.map(x=>x.pool?.updatedAt).filter(v=>Number.isFinite(v)&&v>0);
    if(dated.length){const a=Math.min(...dated),b=Math.max(...dated),fmt=v=>new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});r.texto+='\nDados de '+(fmt(a)===fmt(b)?fmt(a):fmt(a)+' a '+fmt(b))+'.';}
    r.filtro=filtro;
    return wrap(c,r);
  }
  g.ScannerConsultas={consultar,memePermitida,memeExcluida,filtrarPergunta:filtered,ordenar,regrasBase,entender};
})(window);
