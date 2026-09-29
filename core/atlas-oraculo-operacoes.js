/* Operações internas do Atlas. Sem IA, RPC de blockchain ou depósitos implícitos. */
(function(g){
  'use strict';
  function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
  const N='(?<![\\d.,])(-?\\d+(?:[.,]\\d+)?)(?!\\d|[.,]\\d)',T='([a-z][a-z0-9]{1,14})';
  function numero(s){return Number(String(s).replace(',','.'));}
  function valor(s){return Number(s).toFixed(2);}
  function curto(s){return String(Number(Number(s).toPrecision(12)));}
  function ultimo(q,rx){return [...q.matchAll(rx)].at(-1)||null;}
  function escape(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
  function tipo(q){
    if(/\b(?:fecha|feche|fechar|fechei|encerra|encerre|encerrei)\b.*\b(?:pool|posicao)\b/.test(q))return 'fechar';
    if(/\b(?:abre|abra|abrir|abri|registra|registre)\b.*\b(?:pool|posicao)\b/.test(q))return 'abrir';
    if(/\b(?:transferi|transfere|transferir|transfira)\b/.test(q))return 'transferencia';
    if(/\b(?:fiz swap|registre swap|registra swap|troquei|troca|troque|swap de)\b/.test(q))return 'swap';
    return null;
  }
  function criar(){
    let draft=null,ready=null;
    function preparar(q,k){
      const W=g.AtlasWallets,S=g.DeFiStore,C=g.AtlasCaixa;
      if(!W||!C||((k==='abrir'||k==='fechar')&&!S))throw Error('Dados indisponíveis nesta tela. Nada foi registrado.');
      if(g.AtlasDemo?.exibindo())throw Error('Saia do modo demonstração antes de registrar operações reais.');
      if(/\b(?:ontem|anteontem|amanha|semana passada|mes passado)\b|\b\d{4}-\d{2}-\d{2}\b/.test(q))throw Error('Este comando registra a operação de hoje. Para outra data, use o registro com data na tela da posição ou movimentação.');
      const wallets=W.all().filter(w=>!(w.type==='isolada'&&w.module!=='defi'));
      const mencoes=s=>wallets.filter(w=>new RegExp('(^|[^a-z0-9])'+escape(norm(w.name))+'(?=$|[^a-z0-9])').test(s));
      const citadas=k==='transferencia'?mencoes(q):(q.split(';').map(mencoes).filter(a=>a.length).at(-1)||[]);
      if(!citadas.length)throw Error('Qual carteira? Informe o nome, por exemplo: na M2R.');
      const nome=w=>w.name;
      const dupla=ultimo(q,new RegExp(N+'\\s+'+T+'\\s+(?:e|por)\\s+'+N+'\\s+'+T+'\\b','g'));
      let quantidades=dupla?[{q:numero(dupla[1]),t:dupla[2].toUpperCase()},{q:numero(dupla[3]),t:dupla[4].toUpperCase()}]:[...q.matchAll(new RegExp(N+'\\s+'+T+'\\b','g'))].filter(m=>!['a','e','dolares','usd','preco','por'].includes(m[2])).map(m=>({q:numero(m[1]),t:m[2].toUpperCase()}));
      if(k==='transferencia')quantidades=quantidades.slice(-1);
      const pair=ultimo(q,/\b([a-z][a-z0-9]{1,14})\s*[/]\s*([a-z][a-z0-9]{1,14})\b/g)||ultimo(q,/\b(?:pool|posicao)(?:\s+de)?\s+([a-z][a-z0-9]{1,14})\s+(?:e|com)\s+([a-z][a-z0-9]{1,14})\b/g);
      if(k==='fechar'){
        if(citadas.length!==1)throw Error('Informe uma única carteira para o fechamento.');
        if(!pair)throw Error('Qual par deseja fechar? Exemplo: SOL/HYPE.');
        const base=pair[1].toUpperCase(),quote=pair[2].toUpperCase();
        let ps=S.poolsDeTodasCarteiras().filter(x=>x.walletId===citadas[0].id&&((x.pool.base===base&&x.pool.quote===quote)||(x.pool.base===quote&&x.pool.quote===base)));
        const protos=q.split(';').map(s=>['orca','raydium','uniswap','pancakeswap'].filter(v=>new RegExp('\\b'+v+'\\b').test(s))).filter(a=>a.length).at(-1)||[];if(protos.length>1)throw Error('Informe um único protocolo para fechar.');const proto=protos[0];if(proto)ps=ps.filter(x=>norm(x.pool.protocol)===proto);
        const rede=redeInformada(q);if(rede)ps=ps.filter(x=>norm(x.pool.chain)===norm(rede));
        const id=q.match(/\bid\s+([a-z0-9_]+)/);if(id)ps=ps.filter(x=>norm(x.pool.id)===id[1]);
        if(ps.length!==1)throw Error(ps.length?'Há mais de uma posição desse par. Informe o protocolo e, se necessário, o ID: '+ps.map(x=>x.pool.id).join(', '):'Não encontrei essa posição aberta na carteira informada.');
        const p=ps[0].pool,r=S.poolSummary(p),v=S.poolValue(p);
        if(/\b(?:lucro|prejuizo|valor final)\b/.test(q))throw Error('O fechamento usará o resultado já registrado no Atlas. Para informar outro valor, atualize os dados da posição antes de fechar.');
        return {texto:'Fechar '+p.base+'/'+p.quote+' na '+p.protocol+' ('+p.chain+'), ID '+p.id+', carteira '+nome(citadas[0])+'. Retorno ao caixa: US$ '+valor(v)+'; resultado: US$ '+valor(r.resultado)+'. Histórico preservado.',run:()=>S.closePool(p.id,'Encerramento pelo Oráculo.'),fingerprint:JSON.stringify([p.id,v,r.resultado])};
      }
      if(k==='abrir'){
        if(citadas.length!==1)throw Error('Informe uma única carteira para abrir a posição.');
        if(!pair)throw Error('Informe o par, por exemplo: SOL/HYPE.');
        const b=pair[1].toUpperCase(),t=pair[2].toUpperCase();if(b===t)throw Error('A pool precisa de dois tokens diferentes.');
        const qb=quantidades.find(x=>x.t===b),qt=quantidades.find(x=>x.t===t);
        if(!qb||!qt||!(qb.q>0&&qt.q>0))throw Error('Informe as quantidades positivas dos dois tokens: por exemplo, 1 SOL e 5 HYPE.');
        function preco(token){const m=ultimo(q,new RegExp('preco\\s+(?:do\\s+)?'+token.toLowerCase()+'\\s*(?:de|:|=)?\\s*'+N,'g'));return m&&numero(m[1]);}
        const pb=preco(b),pt=preco(t);if(!(pb>0&&pt>0))throw Error('Informe os preços de entrada em dólares: preço '+b+' 100 e preço '+t+' 20.');
        let faixa=ultimo(q,new RegExp('faixa\\s*(?:de|:)?\\s*'+N+'\\s*(?:a|ate)\\s*'+N+'\\s+'+T+'\\s+por\\s+'+T,'g'));
        const rating=ultimo(q,new RegExp('(?:rating|range)\\s*(?:de|:)?\\s*'+N+'\\s*%','g'));
        if(faixa&&rating&&rating.index>faixa.index)faixa=null;
        if(!faixa&&!rating)throw Error('Informe a faixa e sua unidade: faixa 2 a 8 '+t+' por '+b+', ou rating 6%.');
        const r=rating&&numero(rating[1])/100;if(!faixa&&!(r>0&&r<1))throw Error('Rating deve estar entre 0% e 100%, sem incluir os extremos.');
        const low=faixa?numero(faixa[1]):pb/pt*(1-r),high=faixa?numero(faixa[2]):pb/pt*(1+r);
        if(!(Number.isFinite(low)&&Number.isFinite(high)&&low>0&&high>low))throw Error('A faixa precisa de limite inferior positivo e superior maior.');
        const den=faixa?faixa[3].toUpperCase():t,num=faixa?faixa[4].toUpperCase():b;
        if(!((den===t&&num===b)||(den===b&&num===t)))throw Error('A unidade da faixa precisa corresponder aos dois tokens da pool.');
        const protos=q.split(';').map(s=>['orca','raydium','uniswap','pancakeswap'].filter(v=>new RegExp('\\b'+v+'\\b').test(s))).filter(a=>a.length).at(-1)||[];
        if(protos.length!==1)throw Error('Informe uma plataforma: Orca, Raydium, Uniswap ou PancakeSwap.');const proto=protos[0];
        let rede=redeInformada(q);if(!rede&&['orca','raydium'].includes(proto))rede='Solana';if(!rede)throw Error('Informe a rede da posição.');
        const cap=qb.q*pb+qt.q*pt,w=citadas[0];if(!Number.isFinite(cap)||!(cap>0))throw Error('Capital inválido. Confira quantidades e preços.');if(!C.podeGastar(w.id,cap).ok)throw Error('Caixa insuficiente em '+w.name+'. Nenhum depósito será criado automaticamente.');
        const data=new Date(),hoje=data.getFullYear()+'-'+String(data.getMonth()+1).padStart(2,'0')+'-'+String(data.getDate()).padStart(2,'0');
        const p={base:b,quote:t,protocol:proto==='orca'?'Orca':proto==='raydium'?'Raydium':proto==='uniswap'?'Uniswap':'PancakeSwap',chain:rede,walletId:w.id,qtyBase:qb.q,qtyQuote:qt.q,priceBase:pb,priceQuote:pt,capital:cap,currentValue:cap,profit:0,profitPct:0,apr:0,status:'aberta',rangeLow:low,rangeHigh:high,rangeDenom:den===t?'quote_por_base':'base_por_quote',openedAt:hoje,createdAt:hoje,updatedAt:hoje,fees:[],objectives:[]};
        return {texto:'Abrir nova '+b+'/'+t+' na '+p.protocol+' ('+rede+'), carteira '+w.name+': '+qb.q+' '+b+' + '+qt.q+' '+t+', capital US$ '+valor(cap)+', faixa '+curto(low)+'–'+curto(high)+' '+den+' por '+num+'.',run:()=>S.addPool(p),fingerprint:JSON.stringify(p)};
      }
      if(k==='swap'&&citadas.length!==1)throw Error('Swap troca tokens na mesma carteira. Para mover entre carteiras, diga transferi.');
      if(k==='transferencia'&&citadas.length!==2)throw Error('Informe origem e destino: da M2R para M2P.');
      if(!quantidades.length||!(quantidades[0].q>0))throw Error('Informe a quantidade enviada e o token: por exemplo, 1 SOL.');
      if(k==='swap'&&(quantidades.length<2||!(quantidades[1].q>0)))throw Error('Informe os dois lados: troquei 1 SOL por 5 HYPE.');
      function direcao(prep){return citadas.filter(w=>new RegExp('\\b(?:'+prep+')\\s+(?:carteira\\s+)?'+escape(norm(w.name))+'(?=$|[^a-z0-9])').test(q));}
      const de=k==='transferencia'?direcao('de|da|do|origem'):[],para=k==='transferencia'?direcao('para|destino'):[];
      if(k==='transferencia'&&(de.length!==1||para.length!==1||de[0].id===para[0].id))throw Error('Informe claramente origem e destino: de M2R para M2P.');
      const origem=k==='transferencia'?de[0]:citadas[0],destino=k==='transferencia'?para[0]:null;
      const x=quantidades[0],y=quantidades[1];if(k==='swap'&&x.t===y.t)throw Error('O swap precisa de dois tokens diferentes.');
      const rede=redeInformada(q),baldes=C.caixaPorRede(origem.id).filter(z=>!rede||norm(z.rede)===norm(rede));
      const ativos=baldes.flatMap(z=>z.ativos.filter(a=>a.ativo===x.t).map(a=>({...a,rede:z.rede})));
      if(ativos.length!==1)throw Error(ativos.length?'Esse token existe em várias redes. Informe a rede da operação.':'Não encontrei saldo desse token na carteira.');
      const a=ativos[0];if(!(a.qtd>0))throw Error('A quantidade desse token no caixa não está registrada. Atualize o saldo antes de trocar ou transferir.');
      if(a.qtd+1e-8<x.q)throw Error('Saldo de '+x.t+' insuficiente em '+origem.name+'.');
      if(/\b(?:taxa|custo|gas|slippage)\b/.test(q))throw Error('Este registro inicial não calcula custos separados. Informe as quantidades líquidas recebidas sem incluir instruções de taxas; registre custos no histórico apropriado.');
      const usd=a.usd*x.q/a.qtd;if(!(usd>0))throw Error('O custo contábil do token precisa estar registrado.');
      const ev={tipo:k,walletId:origem.id,contraWalletId:destino&&destino.id,ativo:x.t,valorUSD:usd,rede:a.rede,obs:'Registrado pelo Oráculo: '+q};
      if(k==='swap'){ev.ativoDestino=y.t;ev.qtdOrigem=x.q;ev.qtdDestino=y.q;}else ev.qtd=x.q;
      return {texto:k==='swap'?'Registrar swap em '+origem.name+': '+x.q+' '+x.t+' → '+y.q+' '+y.t+'. Custo contábil transferido: US$ '+valor(usd)+'.':'Transferir '+x.q+' '+x.t+' de '+origem.name+' para '+destino.name+'. Custo contábil: US$ '+valor(usd)+'.',run:()=>C.registrar(ev),fingerprint:JSON.stringify(ev)};
    }
    function responder(text){
      const q=norm(text).trim(),k=tipo(q);
      if(q.length>4000)return 'Mensagem longa demais. Resuma a operação; nenhum registro foi feito.';
      if(q==='cancelar'){if(!draft)return null;draft=null;ready=null;return 'Operação cancelada. Nenhum registro alterado.';}
      if(q==='confirmar'){
        if(!draft||!ready)return null;
        try{const atual=preparar(draft.q,draft.k);if(atual.fingerprint!==ready.fingerprint){ready=atual;return atual.texto+' Os dados mudaram. Confira e diga confirmar novamente.';}
          const ok=atual.run();draft=null;ready=null;if(!ok)return 'Não foi possível registrar. Confira o saldo e os dados; nada foi confirmado como concluído.';
          try{if(g.dispatchEvent&&g.CustomEvent)g.dispatchEvent(new g.CustomEvent('atlas:operacao-registrada'));}catch(_e){}
          return 'Registrado no Atlas. '+atual.texto+' Recarregue a tela para atualizar os cartões.';
        }catch(e){ready=null;return e.message;}
      }
      if(!k&&!draft)return null;
      // Perguntas não completam um rascunho nem podem disparar gravação.
      if(/\?|^(?:quanto|qual|como|por que|o que|liste|mostre|explique|obrigad|ola|oi)\b/.test(q))return k?'Para registrar, faça um comando direto. Nenhuma alteração foi feita.':null;
      if(/\b(?:nao|nunca|evite)\b/.test(q)){draft=null;ready=null;return 'Nenhum registro foi feito. Pedido negativo cancela o rascunho da operação.';}
      if([/\b(?:fecha|feche|fechar|fechei|encerra|encerre|encerrei)\b/,/\b(?:abre|abra|abrir|abri)\b/,/\b(?:swap|troquei|troca|troque)\b/,/\b(?:transferi|transfere|transferir|transfira)\b/].filter(rx=>rx.test(q)).length>1){draft=null;ready=null;return 'Informe uma operação por mensagem. Nenhum registro foi feito.';}
      if(!k&&draft&&['abrir','swap'].includes(draft.k)&&/\d\s+[a-z]/.test(q)&&!/\d\s+[a-z][a-z0-9]*\s+(?:e|por)\s+\d/.test(q)&&!/(?:preco|faixa|rating|range)/.test(q)){ready=null;return 'Para corrigir quantidades, informe os dois lados juntos. Nenhum registro foi feito.';}
      if(k){draft={k,q};ready=null;}else {draft.q+='; '+q;ready=null;}
      try{ready=preparar(draft.q,draft.k);return ready.texto+' Diga confirmar para registrar ou cancelar.';}catch(e){return e.message+' Nada foi registrado. Pode completar os dados ou dizer cancelar.';}
    }
    return {responder,pendente:()=>!!draft};
  }
  function redeInformada(q){const redes=q.split(';').map(s=>['Solana','Base','Arbitrum','Ethereum','BNB Chain','Polygon','Optimism','Avalanche','Sui','HyperEVM'].filter(v=>new RegExp('\\b'+norm(v)+'\\b').test(s))).filter(a=>a.length).at(-1)||[];if(redes.length>1)throw Error('Informe uma única rede para esta operação.');return redes[0]||null;}
  g.AtlasOraculoOperacoes={criar,reconhece:q=>!!tipo(norm(q))||/^(confirmar|cancelar)$/i.test(String(q).trim())};
})(window);
