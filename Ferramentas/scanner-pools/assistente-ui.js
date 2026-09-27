(function(g){
  'use strict';
  function montar(contexto){
    const aba=document.getElementById('tab-assistente');
    const orb=document.createElement('button');orb.type='button';orb.className='sp-chat-orb';orb.textContent='✦';orb.title='Abrir assistente do Scanner';orb.setAttribute('aria-label','Abrir assistente do Scanner');orb.setAttribute('aria-expanded','false');
    const panel=document.createElement('section');panel.className='sp-chat-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Assistente do Scanner');
    document.body.append(orb,panel);
    let aberto=false,busy=false,regras=null,aiEnabled=false;
    const messages=[];
    fetch('assistente-regras.json').then(r=>{if(!r.ok)throw Error('regras');return r.json();}).then(r=>{regras=r;}).catch(()=>{});
    if(g.ScannerIA)g.ScannerIA.status().then(s=>{aiEnabled=!!s.enabled;render();}).catch(()=>{});
    const views=[];
    function view(root,flutuante){
      const head=document.createElement('div');head.className='sp-chat-head';
      const title=document.createElement('h2');title.textContent='Assistente do Scanner';head.append(title);
      if(flutuante){
        const full=document.createElement('button');full.type='button';full.textContent='Ampliar';full.onclick=()=>{setOpen(false);g.switchTab('assistente');views[0].input.focus();};head.append(full);
        const close=document.createElement('button');close.type='button';close.textContent='Fechar ×';close.onclick=()=>setOpen(false);head.append(close);
      }
      const mode=document.createElement('p');mode.className='sp-chat-mode';
      const log=document.createElement('div');log.className='sp-chat-log';log.setAttribute('role','log');log.setAttribute('aria-live','polite');
      const empty=document.createElement('p');empty.className='sp-chat-empty';empty.textContent='Pergunte sobre as pools disponíveis, suas favoritas ou as regras do scanner.';log.append(empty);
      const examples=document.createElement('div');examples.className='sp-chat-examples';
      ['Liste minhas favoritas','Quais favoritas aumentaram o TVL nos últimos dois dias?','Quais pools para gerar 2 a 3 dólares em um dia com 100 dólares?','Explique as regras'].forEach(q=>{const b=document.createElement('button');b.type='button';b.textContent=q;b.onclick=()=>submit(q);examples.append(b);});
      const form=document.createElement('form');form.className='sp-chat-form';
      const input=document.createElement('textarea');input.rows=2;input.maxLength=1200;input.placeholder='Pergunte sobre as pools…';input.setAttribute('aria-label','Pergunta ao assistente');
      const send=document.createElement('button');send.type='submit';send.textContent='Enviar';form.append(input,send);
      const status=document.createElement('p');status.className='sp-chat-status';status.setAttribute('role','status');
      form.onsubmit=e=>{e.preventDefault();const q=input.value.trim();if(q&&!busy){input.value='';submit(q);}};
      input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit();}};
      root.append(head,mode,log,examples,form,status);const v={root,mode,log,input,send,examples,status};views.push(v);return v;
    }
    view(aba,false);view(panel,true);
    function render(){views.forEach(v=>{
      v.log.replaceChildren();if(!messages.length){const p=document.createElement('p');p.className='sp-chat-empty';p.textContent='Faça uma pergunta para começar. Consulte todas as candidatas ou apenas suas favoritas.';v.log.append(p);}
      messages.forEach(m=>{const el=document.createElement('div');el.className='sp-chat-message sp-chat-'+m.role;const label=document.createElement('strong');label.textContent=m.role==='user'?'Você':'Assistente';const text=document.createElement('p');text.textContent=m.text;el.append(label,text);v.log.append(el);});
      v.mode.textContent=aiEnabled?'IA OpenRouter gratuita · dados do Scanner':'Consultas locais · IA aguardando chave/função';
      v.send.disabled=busy;v.examples.querySelectorAll('button').forEach(b=>b.disabled=busy);v.status.textContent=busy?'Consultando os dados do scanner…':'';v.log.scrollTop=v.log.scrollHeight;
    });}
    async function submit(q){if(busy)return;busy=true;messages.push({role:'user',text:q});render();try{
      const c=contexto();c.regras=regras;const r=await g.ScannerConsultas.consultar(q,c);
      let answer=r.texto;
      if(aiEnabled&&g.ScannerIA){
        try{
          const ia=await g.ScannerIA.responder(q,c,r);
          if(ia.disponivel&&ia.answer){
            answer=ia.answer;
            if(r.tipo==='meta'||r.tipo==='historico')answer+='\n\nDados calculados pelo Scanner:\n'+r.texto;
          }
        }catch(e){answer=r.texto+'\n\nIA: '+String(e.message||'Indisponível no momento.');}
      }
      messages.push({role:'assistant',text:answer});
    }catch(e){messages.push({role:'assistant',text:'Não consegui concluir a consulta. Tente novamente; nenhuma favorita ou decisão foi alterada.'});}finally{busy=false;render();}}
    function setOpen(value){aberto=value;panel.hidden=!value;orb.setAttribute('aria-expanded',String(value));if(value)views[1].input.focus();else orb.focus();}
    orb.onclick=()=>setOpen(!aberto);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&aberto)setOpen(false);});
    return {abaAtiva(t){orb.hidden=t==='assistente';if(t==='assistente'){panel.hidden=true;aberto=false;orb.setAttribute('aria-expanded','false');}}};
  }
  g.ScannerChat={montar};
})(window);
