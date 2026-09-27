/* Consultas locais determinísticas. Fee segue o scanner: 0,3 = 0,3%. */
(function(g){
  'use strict';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const n=s=>Number(String(s).replace(',','.'));
  const usd=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'USD',maximumFractionDigits:2});
  const ve33=new Set(['Aerodrome','Velodrome','THENA','Pharaoh','Ramses']);
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
  function describe(p){return `${p.pool} · ${p.network} · ${p.platform} · fee ${p.fee}% · ${p.sid||'manual:'+p.id}`;}
  function wrap(c,r){
    if(c.status?.doCache)r.texto+='\nDados em cache: a atualização do servidor falhou; confira a idade dos dados.';
    if(c.status?.erro&&!c.status?.doCache)r.texto+='\nColeta/leitura indisponível: o conjunto pode estar incompleto.';
    return r;
  }
  function period(q){const m=q.match(/(?:ultimos?\s+|em\s+)(\d+)\s+dias?/);return m?Number(m[1]):/dois dias/.test(q)?2:/tres dias/.test(q)?3:1;}
  function filtered(q,pools){
    let ps=/favorit/.test(q)?pools.filter(p=>p.fav):pools;
    const nets=['solana','base','arbitrum','ethereum','bnb chain','polygon','optimism','avalanche','sui','hyperevm','robinhood'];
    const network=nets.find(v=>new RegExp('\\b'+v+'\\b').test(q));
    if(network)ps=ps.filter(p=>norm(p.network)===network);
    const dex=['uniswap','orca','raydium','pancakeswap','aerodrome'].find(v=>new RegExp('\\b'+v+'\\b').test(q));
    if(dex)ps=ps.filter(p=>norm(p.platform)===dex);
    return ps;
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
    const rows=items.slice(0,10).map(x=>`${describe(x.pool)}\n${x.base}: ${usd(x.inicial)} → ${x.fim}: ${usd(x.final)}; Δ ${usd(x.delta)} (${x.pct===null?'base zero: percentual indefinido':x.pct.toFixed(2)+'%'}).`);
    return {tipo:'historico',items,indisponiveis:unavailable,texto:`TVL: comparação de ${days} dias entre registros diários disponíveis de cada pool, não 48 horas exatas. ${ps.length} pool(s) consultada(s).\n\n${rows.join('\n\n')||'Nenhuma comparação atende à pergunta.'}${items.length>10?'\nMostrando as 10 maiores variações.':''}${unavailable?'\n'+unavailable+' pool(s) com histórico insuficiente ou indisponível.':''}`};
  }
  async function consultar(pergunta,c){
    const q=norm(pergunta);let ps=filtered(q,eligible(c));let r;
    if(/(?:explique|quais sao|como funciona|qual e).*\b(?:regra|rating|range)\b|\bregras\b/.test(q)&&!/tvl/.test(q)){
      r={tipo:'regras',items:[],texto:(c.regras?.resumo||'TVL mínimo US$ 100.000; razão > 0,50. Meme: razão > 2 e análise pendente. Conservadora não admite meme; o perfil depende da montagem. Range de 6% significa −6%/+6%.')};
    }else if(/tvl/.test(q)&&/dias?|aument|evolu|cresce/.test(q)){
      r=await historyAnswer(q,c,ps);
    }else if(/dolar|\$|usd/.test(q)){
      const capital=q.match(/(?:com|capital de|investindo|aplicando)\s*(?:us\$|\$|usd)?\s*(\d+(?:[.,]\d+)?)/);
      const goal=q.match(/(\d+(?:[.,]\d+)?)\s*(?:a|ou|ate|e|-)\s*(\d+(?:[.,]\d+)?)\s*(?:dolares?|usd|us\$)/)||q.match(/(?:fazer|ganhar|gerar|render|devolver)\s*(?:us\$|\$)?\s*(\d+(?:[.,]\d+)?)\s*(?:dolares?|usd)/);
      if(!capital||!goal){r={tipo:'esclarecimento',items:[],texto:'Informe capital, meta de taxas e prazo. Exemplo: quais pools para gerar 2 a 3 dólares em um dia com 100 dólares?'};}
      else{
        const money=n(capital[1]),min=n(goal[1]),max=goal[2]?n(goal[2]):min,days=period(q);
        if(!(money>0&&min>0&&max>=min&&days>=1&&days<=365))return wrap(c,{tipo:'esclarecimento',items:[],texto:'Informe capital e meta positivos e prazo entre 1 e 365 dias.'});
        ps=ps.filter(p=>c.trilho(p)==='solida');
        if(/conservador/.test(q))ps=ps.filter(p=>!p.sinais?.memecoin?.detectada);
        const scored=ps.filter(p=>!ve33.has(p.platform)&&Number.isFinite(Number(p.fee))&&p.fee>0).map(p=>({id:p.id,pool:p,estimativa:money*(p.fee/100)*(p.vol24h/p.tvl)*days}));
        const items=scored.filter(x=>x.estimativa>=min-1e-9&&x.estimativa<=max+1e-9).sort((a,b)=>(b.pool.nota||0)-(a.pool.nota||0)||b.pool.tvl-a.pool.tvl).slice(0,10);
        r={tipo:'meta',items,texto:`Referência agregada de taxas para ${usd(money)} em ${days} dia(s), meta ${usd(min)}–${usd(max)}. ${ps.length} candidatas após filtros; ${scored.length} com taxa utilizável.\n\n${items.map(x=>describe(x.pool)+'\nTVL '+usd(x.pool.tvl)+'; volume24h '+usd(x.pool.vol24h)+'; razão '+(x.pool.vol24h/x.pool.tvl).toFixed(2)+'; referência '+usd(x.estimativa)+'; nota '+(x.pool.nota??'não informada')+'.').join('\n\n')||'Nenhuma pool atende à meta com essa referência.'}\n\nCálculo: capital × (fee% ÷ 100) × volume24h/TVL × dias. Não é projeção de posição concentrada: faixa, liquidez ativa, tempo dentro da faixa, preço e custos não estão calculados. Taxas não equivalem a lucro líquido. Ordenação por nota e TVL não substitui sua análise pessoal. Protocolos de emissões não entram nesta conta.`};
      }
    }else if(/pool|favorit|conservador|median|agressiv/.test(q)){
      ps=ps.filter(p=>c.trilho(p)==='solida');if(/conservador/.test(q))ps=ps.filter(p=>!p.sinais?.memecoin?.detectada);
      const items=ps.slice().sort((a,b)=>(b.nota||0)-(a.nota||0)||b.tvl-a.tvl).slice(0,10).map(p=>({id:p.id,pool:p}));
      r={tipo:'lista',items,texto:`${ps.length} pool(s) após filtros. Mostrando até 10 por nota e TVL.\n\n${items.map(x=>describe(x.pool)+'\nTVL '+usd(x.pool.tvl)+'; volume24h '+usd(x.pool.vol24h)+'.').join('\n\n')||'Nenhuma candidata.'}\n\nO perfil conservador, mediano ou agressivo depende da montagem, faixa, objetivo e prazo. Meme não é permitida em conservadora; ausência de detecção não certifica a categoria dos ativos.`};
    }else r={tipo:'ajuda',items:[],texto:'Nesta etapa respondo consultas locais: liste minhas favoritas; quais pools para gerar 2 a 3 dólares em um dia com 100 dólares; quais favoritas aumentaram o TVL nos últimos dois dias; explique as regras. O modelo de IA ainda não está conectado. Não consigo interpretar livremente outras perguntas.'};
    const dated=r.items.map(x=>x.pool?.updatedAt).filter(v=>Number.isFinite(v)&&v>0);
    if(dated.length)r.texto+='\nAtualizações das candidatas: '+new Date(Math.min(...dated)).toLocaleString('pt-BR')+' a '+new Date(Math.max(...dated)).toLocaleString('pt-BR')+'.';
    return wrap(c,r);
  }
  g.ScannerConsultas={consultar};
})(window);
