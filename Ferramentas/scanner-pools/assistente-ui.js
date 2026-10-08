/* Oráculo do Scanner: a conversa.

   Desenho: coluna única, sem caixas empilhadas. Pergunta é balão à direita;
   resposta é texto aberto à esquerda, com as pools como cartões (par, onde,
   e os cinco números que decidem) em vez de um bloco de texto corrido. O
   rodapé de cada resposta (ressalvas, horário dos dados) fica miúdo, abaixo.

   Eficiência: a memória da conta é lida UMA vez por sessão (antes, a cada
   pergunta — uma ida ao servidor a mais por mensagem); saudação, conceito do
   Guia e pedido de esclarecimento respondem na hora, sem gastar a cota
   diária da IA. */
(function(g){
  'use strict';
  function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
  function iconeEnviar(){
    const ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg'),p=document.createElementNS(ns,'path');
    [['viewBox','0 0 24 24'],['width','18'],['height','18'],['fill','none'],['stroke','currentColor'],['stroke-width','2'],['stroke-linecap','round'],['stroke-linejoin','round'],['aria-hidden','true']].forEach(([k,v])=>s.setAttribute(k,v));
    p.setAttribute('d','M5 12h14M13 6l6 6-6 6');s.append(p);return s;
  }
  /* o ícone do Oráculo (a Atena do ATLAS), com o aro vermelho/azul girando;
     se a imagem não carregar, volta a estrela */
  function avatar(cls){
    const sp=el('span','sp-avatar '+(cls||''));const img=document.createElement('img');
    img.src='../../assets/atena.webp';img.alt='';img.decoding='async';
    img.onerror=()=>{img.remove();sp.textContent='✦';sp.classList.add('sp-avatar-sem-img');};
    sp.append(img);return sp;
  }
  const usdc=v=>{v=Number(v);if(!Number.isFinite(v))return '—';const a=Math.abs(v);
    if(a>=1e9)return 'US$ '+(v/1e9).toLocaleString('pt-BR',{maximumFractionDigits:2})+' bi';
    if(a>=1e6)return 'US$ '+(v/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})+' mi';
    if(a>=1e4)return 'US$ '+Math.round(v/1e3).toLocaleString('pt-BR')+' mil';
    return v.toLocaleString('pt-BR',{style:'currency',currency:'USD',maximumFractionDigits:2});};
  const num=(v,d=2)=>Number.isFinite(Number(v))?Number(v).toLocaleString('pt-BR',{maximumFractionDigits:d}):'—';
  const pct=v=>{v=Number(v);if(!Number.isFinite(v))return '—';const a=Math.abs(v);return num(v,a===0?0:a<0.001?5:a<0.01?4:a<1?3:2)+'%';};
  const EXEMPLOS=[
    ['Melhores oportunidades agora','Quais são as melhores oportunidades de mercado?'],
    ['Maior volume na Solana','Quais pools têm maior volume na Solana?'],
    ['Pools de SOL com razão acima de 3','Pools de SOL com razão acima de 3'],
    ['Quanto rende US$ 1.000 em 7 dias','Quanto rende 1000 dólares na SOL/USDC em 7 dias?'],
    ['Comparar dois pares','Compara SOL/USDC e SOL/USDT'],
    ['O que é impermanent loss?','O que é impermanent loss?']];
  /* tipos que a conta local resolve por inteiro: não gastam a IA */
  const SO_LOCAL=new Set(['saudacao','esclarecimento','conceito']);

  function cartao(x){
    const p=x.pool,c=el('div','sp-card');
    const topo=el('div','sp-card-top');
    const L=g.ScannerServidor&&p.servidor?g.ScannerServidor.linkPool(p):null;
    let nome=el('strong','sp-card-par',p.pool);
    if(L){const a=document.createElement('a');a.className='sp-card-par sp-card-link';a.href=L.url;a.target='_blank';a.rel='noopener noreferrer';a.title='Abrir em '+L.dominio+' ('+L.onde+') — site oficial';a.textContent=p.pool+' ↗';nome=a;}
    topo.append(nome,el('span','sp-card-onde',p.platform+' · '+p.network));
    if(p.sinais?.memecoin?.detectada)topo.append(el('span','sp-tag sp-tag-meme','meme'));
    if(p.fav)topo.append(el('span','sp-tag','★ favorita'));
    const ms=el('dl','sp-card-num');
    const r=Number(p.tvl)>0?p.vol24h/p.tvl:0;
    /* fee 0 com APR positivo é taxa que a fonte não informou, não taxa zero */
    [['TVL',usdc(p.tvl)],['Volume 24h',usdc(p.vol24h)],['Razão',num(r)],['Fee',Number(p.fee)>0?pct(p.fee):'não inf.'],['Nota',p.nota!=null?num(p.nota,0):'—']].forEach(([k,v])=>{
      const d=el('div');d.append(el('dt',null,k),el('dd',null,v));ms.append(d);});
    c.append(topo,ms);
    let destaque=null;
    if(x.estimativa!=null)destaque='≈ '+usdc(x.estimativa)+' em taxas no período';
    else if(x.delta!=null)destaque='TVL '+(x.delta>=0?'+':'')+usdc(x.delta)+(x.pct!=null?' ('+num(x.pct)+'%)':'')+' desde '+x.base;
    if(destaque)c.append(el('p','sp-card-destaque'+(x.delta!=null&&x.delta<0?' neg':''),destaque));
    return c;
  }

  /* separa o texto local em introdução, itens numerados e rodapé */
  function partes(texto){
    const blocos=String(texto||'').split(/\n\n+/);
    const i=blocos.findIndex(b=>/^\d+\.\s/.test(b));
    if(i<0)return {intro:texto,rodape:''};
    let j=i;while(j<blocos.length&&/^\d+\.\s/.test(blocos[j]))j++;
    return {intro:blocos.slice(0,i).join('\n\n'),rodape:blocos.slice(j).join('\n\n')};
  }

  function montar(contexto){
    const aba=document.getElementById('tab-assistente');
    const orb=el('button','sp-chat-orb','✦');orb.type='button';orb.title='Abrir Oráculo';orb.setAttribute('aria-label','Abrir Oráculo');orb.setAttribute('aria-expanded','false');
    const panel=el('section','sp-chat-panel');panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Oráculo do Scanner');
    if(!g.AtlasOraculo)document.body.append(orb,panel);
    let aberto=false,busy=false,regras=null,aiEnabled=false,memorySupported=false,lastIds=[],preferencias=null,memoriaLida=false;
    /* várias conversas salvas + a temporária de 24 h (assistente-conversas.js) */
    const CV=g.ScannerConversas;
    let conversas=CV?CV.carregar():[];
    let atual=CV?CV.nova():{mensagens:[]};
    let messages=atual.mensagens;
    function abrirConversa(c){if(busy)return;atual=c;messages=atual.mensagens;lastIds=[];fecharLista();render();}
    function novaConversa(temporaria){if(busy)return;atual=CV?CV.nova({temporaria}):{mensagens:[]};messages=atual.mensagens;lastIds=[];fecharLista();render();views.forEach(v=>v.input.focus());}
    function persistir(){if(CV)conversas=CV.salvar(conversas,atual);}
    function fecharLista(){views.forEach(v=>v.root.classList.remove('sp-lista-aberta'));}
    fetch('assistente-regras.json').then(r=>{if(!r.ok)throw Error('regras');return r.json();}).then(r=>{regras=r;}).catch(()=>{});
    const ready=g.ScannerIA?g.ScannerIA.status().then(s=>{aiEnabled=!!s.enabled;memorySupported=!!s.capabilities?.memory;render();}).catch(()=>{}):Promise.resolve();
    const logado=()=>!!g.firebase?.auth?.().currentUser;
    const views=[];

    function view(root,flutuante){
      root.classList.add('sp-oraculo');if(flutuante)root.classList.add('sp-oraculo-flutuante');
      const head=el('header','sp-head');
      const marca=el('div','sp-marca');marca.append(avatar());
      const tit=el('div');tit.append(el('h2',null,'Oráculo'),el('p','sp-sub','Pools do Scanner'));marca.append(tit);
      const mode=el('span','sp-modo');
      const temp=el('span','sp-temp');temp.hidden=true;
      const acoes=el('div','sp-head-acoes');
      const nova=el('button','sp-ghost','Nova conversa');nova.type='button';nova.onclick=()=>novaConversa(false);
      acoes.append(temp,mode,nova);
      if(!flutuante){
        const listaBtn=el('button','sp-ghost sp-lista-btn','Conversas');listaBtn.type='button';
        listaBtn.onclick=()=>root.classList.toggle('sp-lista-aberta');acoes.prepend(listaBtn);
      }
      if(flutuante){
        const full=el('button','sp-ghost','Ampliar');full.type='button';full.onclick=()=>{setOpen(false);g.switchTab('assistente');views[0].input.focus();};
        const close=el('button','sp-ghost','Fechar');close.type='button';close.setAttribute('aria-label','Fechar Oráculo');close.onclick=()=>setOpen(false);
        acoes.append(full,close);
      }
      head.append(marca,acoes);
      const log=el('div','sp-log');log.setAttribute('role','log');log.setAttribute('aria-live','polite');
      const form=el('form','sp-composer');
      const input=document.createElement('textarea');input.rows=1;input.maxLength=1200;input.placeholder='Pergunte sobre as pools…';input.setAttribute('aria-label','Pergunta ao Oráculo');
      const send=el('button','sp-enviar');send.type='submit';send.append(iconeEnviar());send.setAttribute('aria-label','Enviar pergunta');
      form.append(input,send);
      const dica=el('p','sp-dica','Enter envia · Shift+Enter quebra a linha. Respostas usam só os dados do Scanner; não são recomendação.');
      const ajusta=()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,160)+'px';input.style.overflowY=input.scrollHeight>160?'auto':'hidden';};
      input.addEventListener('input',ajusta);
      form.onsubmit=e=>{e.preventDefault();const q=input.value.trim();if(q&&!busy){input.value='';ajusta();submit(q);}};
      input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit();}};
      const pe=el('div','sp-pe');pe.append(form,dica);
      let lista=null;
      if(flutuante)root.append(head,log,pe);
      else{
        /* coluna da esquerda: nova, temporária e as conversas salvas */
        lista=el('aside','sp-lista');lista.setAttribute('aria-label','Conversas');
        const principal=el('div','sp-principal');principal.append(head,log,pe);
        root.append(lista,principal);
      }
      const v={root,mode,temp,log,input,send,pe,flutuante,lista};views.push(v);return v;
    }
    view(aba,false);view(panel,true);
    const memory=g.ScannerMemoria.montar(views[0].pe,p=>{preferencias=p;memoriaLida=true;});

    function vazio(v){
      const box=el('div','sp-vazio');
      box.append(avatar('sp-avatar-g'),el('h3',null,'O que você quer saber das pools?'),
        el('p',null,'Filtre por token, par, DEX ou rede, peça a ordem (maior volume, maior APR), limites (razão acima de 3) ou quanto rende um valor numa pool.'));
      const grade=el('div','sp-sugestoes');
      EXEMPLOS.forEach(([rot,q])=>{const b=el('button','sp-sugestao',rot);b.type='button';b.onclick=()=>submit(q);b.disabled=busy;grade.append(b);});
      box.append(grade);v.log.append(box);
    }
    function mensagem(m){
      if(m.role==='user'){const row=el('div','sp-msg sp-msg-user');row.append(el('p','sp-balao',m.text));return row;}
      const row=el('div','sp-msg sp-msg-oraculo');row.append(avatar('sp-avatar-p'));
      const body=el('div','sp-msg-corpo');
      const items=(m.items||[]).filter(x=>x&&x.pool);
      const local=partes(m.local||'');
      if(m.ia){body.append(el('p','sp-texto',m.text));}
      else if(items.length){if(local.intro)body.append(el('p','sp-texto',local.intro));}
      else body.append(el('p','sp-texto',m.text));
      if(items.length){const grade=el('div','sp-cards');items.slice(0,10).forEach(x=>grade.append(cartao(x)));body.append(grade);}
      if(!m.ia&&items.length&&local.rodape)body.append(el('p','sp-rodape',local.rodape));
      if(m.ia&&m.local){const d=el('details','sp-calc'),s=el('summary',null,'Ver dados e cálculos do Scanner');d.append(s,el('p',null,m.local));body.append(d);}
      if(m.aviso)body.append(el('p','sp-aviso',m.aviso));
      if(m.question&&memorySupported&&logado()){
        const acoes=el('div','sp-avaliar');
        const useful=el('button','sp-mini','Útil');useful.type='button';
        const correct=el('button','sp-mini','Corrigir');correct.type='button';
        const note=document.createElement('textarea');note.maxLength=800;note.rows=2;note.placeholder='O que deve melhorar? Este feedback não altera suas regras.';note.hidden=true;
        const send=el('button','sp-mini','Salvar avaliação');send.type='button';send.hidden=true;
        const msg=el('span','sp-mini-status',m.feedbackStatus||'');msg.setAttribute('role','status');
        async function evaluate(rating,comment){useful.disabled=send.disabled=true;msg.textContent='Salvando…';try{await g.ScannerIA.avaliar({rating,question:m.question.slice(0,1200),answer:m.text.slice(0,2000),comment});m.feedbackStatus='Avaliação registrada.';msg.textContent=m.feedbackStatus;}catch(e){msg.textContent=e.message||'Falha ao salvar avaliação.';}finally{useful.disabled=send.disabled=false;}}
        useful.onclick=()=>evaluate('util','');correct.onclick=()=>{note.hidden=send.hidden=false;note.focus();};send.onclick=()=>evaluate('corrigir',note.value);
        acoes.append(useful,correct,msg,note,send);body.append(acoes);
      }
      row.append(body);return row;
    }
    function dataCurta(t){const d=new Date(t),h=new Date();return d.toDateString()===h.toDateString()?d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});}
    function renderLista(v){
      if(!v.lista)return;
      v.lista.replaceChildren();
      const topo=el('div','sp-lista-topo');
      const b1=el('button','sp-lista-nova','+ Nova conversa');b1.type='button';b1.onclick=()=>novaConversa(false);
      const b2=el('button','sp-lista-temp','Conversa temporária · 24 h');b2.type='button';b2.title='Some sozinha 24 horas depois de criada';b2.onclick=()=>novaConversa(true);
      topo.append(b1,b2);v.lista.append(topo);
      if(!conversas.length){v.lista.append(el('p','sp-lista-vazia','As conversas ficam salvas aqui, neste navegador.'));return;}
      const ul=el('ul','sp-lista-itens');
      conversas.forEach(c=>{
        const li=el('li','sp-lista-item'+(c.id===atual.id?' on':'')+(c.temporaria?' temp':''));
        const abrir=el('button','sp-lista-abrir');abrir.type='button';abrir.onclick=()=>abrirConversa(c);
        abrir.append(el('span','sp-lista-titulo',c.titulo||CV.titulo(c)),el('span','sp-lista-data',c.temporaria?'⏱ '+CV.restante(c):dataCurta(c.atualizadaEm)));
        const del=el('button','sp-lista-del','×');del.type='button';del.title='Apagar esta conversa';del.setAttribute('aria-label','Apagar a conversa '+(c.titulo||''));
        del.onclick=()=>{if(busy)return;conversas=CV.apagar(conversas,c.id);if(c.id===atual.id)novaConversa(false);else render();};
        li.append(abrir,del);ul.append(li);
      });
      v.lista.append(ul);
    }
    function render(){views.forEach(v=>{
      renderLista(v);
      v.temp.hidden=!atual.temporaria;v.temp.textContent=atual.temporaria?'⏱ Temporária · '+(CV?CV.restante(atual):''):'';
      v.log.replaceChildren();
      if(!messages.length)vazio(v);
      messages.forEach(m=>v.log.append(mensagem(m)));
      if(busy){const row=el('div','sp-msg sp-msg-oraculo');row.append(avatar('sp-avatar-p'));const d=el('div','sp-digitando');d.setAttribute('aria-label','Consultando os dados do Scanner');d.append(el('i'),el('i'),el('i'));row.append(d);v.log.append(row);}
      const ia=aiEnabled&&logado();
      v.mode.textContent=ia?'IA ativa':'Respostas locais';v.mode.classList.toggle('on',ia);
      v.mode.title=ia?'Perguntas abertas usam a IA (OpenRouter gratuito) sobre os dados do Scanner.':aiEnabled?'Entre no ATLAS para usar a IA; as consultas locais funcionam sem ela.':'IA aguardando configuração; as consultas locais funcionam sem ela.';
      v.send.disabled=busy;
      v.log.scrollTop=v.log.scrollHeight;
    });}

    async function submit(q){if(busy)return 'Já estou analisando sua pergunta anterior. Aguarde um instante.';busy=true;const history=g.ScannerConversa.historico(messages);messages.push({role:'user',text:q});render();try{
      await ready;
      /* memória da conta: lida uma vez; salvar/carregar no painel atualiza */
      if(memorySupported&&logado()&&!memoriaLida){
        try{preferencias=await memory.combinar((await g.ScannerIA.memoria()).preferences);memoriaLida=true;}
        catch(_e){const text='Sua memória está indisponível. Para não ampliar os critérios sem sua autorização, suspendi esta seleção. Tente novamente ou use Carregar da conta em Minhas preferências confirmadas.';messages.push({role:'assistant',text});return text;}
      }
      const c=g.ScannerConversa.contextualizar(q,contexto(),lastIds);c.regras=regras;c.preferencias=preferencias;const r=await g.ScannerConsultas.consultar(q,c);
      lastIds=r.tipo==='ajuda'?g.ScannerIA.contexto(q,c,r).pools.map(p=>p.id):(r.items||[]).map(x=>g.ScannerConversa.identidade(x.pool));
      const m={role:'assistant',text:r.texto,local:r.texto,items:r.items||[],tipo:r.tipo,question:q,ia:false};
      if(aiEnabled&&logado()&&g.ScannerIA&&!SO_LOCAL.has(r.tipo)){
        try{
          const ia=await g.ScannerIA.responder(q,c,r,history);
          if(ia.disponivel&&ia.answer){
            m.text=ia.answer;m.ia=true;
            if(r.tipo==='ajuda')m.local='';
            if(ia.truncated)m.aviso='A resposta da IA foi interrompida pelo limite do provedor. Peça uma análise mais curta; os cálculos locais estão em Ver dados e cálculos.';
          }
        }catch(e){m.aviso='IA: '+String(e.message||'indisponível no momento.')+' Mostrando a conta local.';}
      }
      messages.push(m);
      return m.text;
    }catch(e){const text='Não consegui concluir a consulta. Tente novamente; nenhuma favorita ou decisão foi alterada.';messages.push({role:'assistant',text});return text;}finally{busy=false;persistir();render();}}
    /* a cada minuto: a temporária vencida some (e a tela volta a uma nova) */
    setInterval(()=>{
      if(!CV||busy)return;
      const antes=conversas.length;conversas=CV.podar(conversas);
      if(atual.temporaria&&Date.now()>=atual.expiraEm){novaConversa(false);return;}
      if(atual.temporaria||conversas.length!==antes||conversas.some(c=>c.temporaria))render();
    },60000);
    function setOpen(value){aberto=value;panel.hidden=!value;orb.setAttribute('aria-expanded',String(value));if(value)views[1].input.focus();else orb.focus();}
    orb.onclick=()=>setOpen(!aberto);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&aberto)setOpen(false);});
    render();
    return {perguntar:submit,abaAtiva(t){orb.hidden=t==='assistente';if(t==='assistente'){panel.hidden=true;aberto=false;orb.setAttribute('aria-expanded','false');if(memorySupported&&logado())memory.carregar();views[0].input.focus();}}};
  }
  g.ScannerChat={montar};
})(window);
