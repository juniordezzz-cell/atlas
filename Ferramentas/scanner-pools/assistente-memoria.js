(function(g){
  'use strict';
  function montar(root,onChange){
    const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Minhas preferências confirmadas';details.append(summary);
    const info=document.createElement('p');info.textContent='Salvas na sua conta. A conversa e o feedback não alteram estas regras automaticamente. O JSON aplica pisos adicionais e prioriza tokens favoritos, sem aprovar pools automaticamente. Enquanto não for salvo, vale o modelo inicial desta página.';details.append(info);
    const form=document.createElement('form'),meme=document.createElement('input');meme.type='checkbox';meme.checked=true;
    const label=document.createElement('label');label.append(meme,document.createTextNode(' Evitar memecoins por padrão'));form.append(label);
    function field(title,area){const label=document.createElement('label');label.style.display='block';label.textContent=title;const input=document.createElement(area?'textarea':'input');input.style.width='100%';input.maxLength=area?2000:500;if(area)input.rows=3;label.append(input);form.append(label);return input;}
    const redes=field('Redes preferidas, separadas por vírgula'),pares=field('Pares de interesse, separados por vírgula'),notas=field('Critérios confirmados: faixa, prazo, custos e exceções',true);
    const estrategia=field('Estratégia de pools (JSON)',true);estrategia.rows=9;
    const save=document.createElement('button');save.type='submit';save.textContent='Salvar preferências';
    const reset=document.createElement('button');reset.type='button';reset.textContent='Restaurar preferências iniciais';
    const load=document.createElement('button');load.type='button';load.textContent='Carregar da conta';
    const forget=document.createElement('button');forget.type='button';forget.textContent='Apagar avaliações anteriores';
    const status=document.createElement('p');status.setAttribute('role','status');form.append(save,reset,load,forget,status);details.append(form);root.append(details);
    let pending=false,base=null;
    const baseReady=g.fetch('estrategia-pools.json').then(r=>{if(!r.ok)throw Error('JSON inicial indisponível');return r.json();}).then(j=>{base=j;return j;}).catch(()=>null);
    const combinar=p=>({...p,estrategia:p?.estrategia||base});
    function show(p){const atual=combinar(p);meme.checked=atual.evitarMemes!==false;redes.value=(atual.redes||[]).join(', ');pares.value=(atual.pares||[]).join(', ');notas.value=atual.notas||'';estrategia.value=atual.estrategia?JSON.stringify(atual.estrategia,null,2):'';onChange(atual);}
    async function run(work,text,exigeEstrategia=false){if(pending)return;pending=true;save.disabled=reset.disabled=load.disabled=true;status.textContent='Consultando sua memória…';try{await baseReady;const data=await work();if(exigeEstrategia&&!data.preferences?.estrategia)throw Error('A função do Supabase ainda não aceita o JSON. A estratégia não foi confirmada; outros campos podem ter sido salvos.');show(data.preferences);status.textContent=text;}catch(e){status.textContent=e.message||'Memória indisponível; nada foi confirmado como salvo.';}finally{pending=false;save.disabled=reset.disabled=load.disabled=false;}}
    const split=value=>value.split(',').map(x=>x.trim()).filter(Boolean);
    form.onsubmit=e=>{e.preventDefault();let json;try{json=JSON.parse(estrategia.value);}catch(_e){status.textContent='Corrija o JSON antes de salvar.';return;}run(()=>g.ScannerIA.salvarMemoria({evitarMemes:meme.checked,redes:split(redes.value),pares:split(pares.value),notas:notas.value,estrategia:json}),'Preferências e estratégia salvas na sua conta.',true);};
    reset.onclick=()=>run(()=>{if(!base)throw Error('JSON inicial indisponível; restauração cancelada.');return g.ScannerIA.salvarMemoria({evitarMemes:true,redes:[],pares:[],notas:'',estrategia:base});},'Preferências restauradas; critérios pessoais anteriores removidos.',true);
    load.onclick=()=>run(()=>g.ScannerIA.memoria(),'Memória carregada da sua conta.');
    forget.onclick=async()=>{forget.disabled=true;try{await g.ScannerIA.apagarAvaliacoes();status.textContent='Avaliações anteriores apagadas. Preferências preservadas.';}catch(e){status.textContent=e.message;}finally{forget.disabled=false;}};
    return {carregar:()=>run(()=>g.ScannerIA.memoria(),'Memória carregada da sua conta.'),combinar:async p=>{await baseReady;return combinar(p);}};
  }
  g.ScannerMemoria={montar};
})(window);
