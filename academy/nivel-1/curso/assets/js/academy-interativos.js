/* Academy · interativos das aulas (bloco {t:'interactive', kind}).
   html[kind]() devolve o esqueleto fixo (SVG e controles), que o render põe na
   página; ligar[kind](fig) dá vida a ele mexendo só em texto, atributos e
   classes. Todos os números são de exemplo, exceto o SHA-256 da mineração,
   que é calculado de verdade. O interativo "hash" mora em academy-visual.js. */
const AcademyInterativos=(()=>{
 const C={azul:'#60a5fa',ciano:'#67e8f9',violeta:'#a78bfa',verm:'#f87171',fundo:'#111c30',linha:'#2a3b55',mudo:'#a9b8cf',texto:'#e2e8f0'};
 const svg=(w,h,corpo)=>'<svg viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg" font-family="inherit" aria-hidden="true">'+corpo+'</svg>';
 const caixa=(x,y,w,h,t,cls,sub)=>'<g class="'+cls+'"><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="8" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><text x="'+(x+w/2)+'" y="'+(y+h/2+(sub?-2:5))+'" text-anchor="middle" font-size="17" font-weight="700" fill="'+C.texto+'">'+t+'</text>'+(sub?'<text x="'+(x+w/2)+'" y="'+(y+h/2+18)+'" text-anchor="middle" font-size="13" fill="'+C.mudo+'">'+sub+'</text>':'')+'</g>';
 const linha=(x1,y1,x2,y2)=>'<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+C.linha+'" stroke-width="2"/>';
 const botoes=bs=>'<div class="cena-controles">'+bs.map(([acao,t])=>'<button class="btn small" type="button" data-acao="'+acao+'">'+t+'</button>').join('')+'</div>';
 const estado=t=>'<p class="cena-estado" aria-live="polite">'+t+'</p>';
 const fmt=(n,c=2)=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:c,maximumFractionDigits:c});
 const $=(fig,s)=>fig.querySelector(s),$$=(fig,s)=>[...fig.querySelectorAll(s)];
 const acao=(fig,nome,fn)=>{const b=$(fig,'[data-acao="'+nome+'"]');if(b)b.addEventListener('click',fn);return b;};

 /* Passo a passo genérico: fig recebe a classe "passo-N" e o texto do passo. */
 function passos(fig,lista,{aoMudar}={}){
  let i=0;
  const mostrar=()=>{
   lista.forEach((_,k)=>fig.classList.toggle('passo-'+k,k===i));
   $(fig,'.cena-estado').textContent=(i+1)+' de '+lista.length+' · '+lista[i];
   const ant=$(fig,'[data-acao="anterior"]'),prox=$(fig,'[data-acao="proximo"]');
   if(ant)ant.disabled=i===0;if(prox)prox.disabled=i===lista.length-1;
   aoMudar?.(i);
  };
  acao(fig,'anterior',()=>{i=Math.max(0,i-1);mostrar();});
  acao(fig,'proximo',()=>{i=Math.min(lista.length-1,i+1);mostrar();});
  acao(fig,'recomecar',()=>{i=0;mostrar();});
  mostrar();
 }

 const html={
  /* Carteira → nó → rede → explorador. */
  papeis:()=>svg(640,250,
    linha(170,95,250,95)+linha(390,95,470,45)+linha(390,95,470,95)+linha(390,95,470,145)+linha(320,120,320,180)
   +caixa(30,65,140,60,'Carteira','p-carteira','prepara e assina')
   +caixa(250,65,140,60,'Seu nó','p-no','confere as regras')
   +['A','B','C'].map((l,k)=>caixa(470,25+k*50,130,40,'Nó '+l,'p-rede p-rede-'+k)).join('')
   +caixa(250,180,140,56,'Explorador','p-explorador','só mostra o que lê')
   +'<g class="p-pacote"><rect x="-14" y="-10" width="28" height="20" rx="4" fill="'+C.ciano+'"/><text x="0" y="5" text-anchor="middle" font-size="11" font-weight="700" fill="#05080f">tx</text></g>')
   +botoes([['anterior','← Anterior'],['proximo','Próximo passo →'],['recomecar','Recomeçar']])+estado(''),
  /* Linha do tempo da transação. */
  transacao:()=>{
   const et=['Montar','Assinar','Transmitir','Fila','Bloco','Finalidade'];
   return svg(640,120,linha(50,50,590,50)+et.map((t,k)=>{const x=50+k*108;return '<g class="t-etapa t-etapa-'+k+'"><circle cx="'+x+'" cy="50" r="16" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="3"/><text x="'+x+'" y="55" text-anchor="middle" font-size="13" font-weight="700" fill="'+C.mudo+'">'+(k+1)+'</text><text x="'+x+'" y="96" text-anchor="middle" font-size="13" fill="'+C.texto+'">'+t+'</text></g>';}).join(''))
    +'<p class="t-status">Status na carteira: <strong class="t-status-valor">rascunho</strong></p>'
    +botoes([['anterior','← Anterior'],['proximo','Próximo passo →'],['recomecar','Recomeçar']])+estado('');
  },
  /* Prova de trabalho com SHA-256 de verdade. */
  mineracao:()=>'<div class="m-grade"><label class="interativo-rotulo">Dados do bloco<input class="hash-entrada m-dados" type="text" maxlength="120" value="Bloco 7 · Ana paga 2 a Bruno" autocomplete="off" spellcheck="false"></label>'
   +'<label class="interativo-rotulo">Dificuldade<select class="hash-entrada m-dif"><option value="1">o hash começa com 0</option><option value="2">começa com 00</option><option value="3" selected>começa com 000</option><option value="4">começa com 0000</option></select></label></div>'
   +'<p class="interativo-sub">Nonce (o número que o minerador troca)</p><output class="m-nonce hash-saida">0</output>'
   +'<p class="interativo-sub">SHA-256 de dados + nonce</p><output class="m-hash hash-saida">…</output>'
   +'<p class="m-tentativas">Tentativas: <strong>0</strong></p>'
   +botoes([['tentar','Tentar o próximo nonce'],['minerar','Minerar até achar'],['parar','Parar']])+estado('Mude o nonce até o hash começar com a quantidade de zeros pedida.'),
  /* Prova de participação: sorteio pelo peso e slashing. */
  validadores:()=>{
   const v=['Ana','Bia','Caio','Davi','Eva'];
   return svg(640,250,v.map((n,k)=>{const y=20+k*44;return '<g class="v-linha v-'+k+'"><text x="10" y="'+(y+20)+'" font-size="14" font-weight="700" fill="'+C.texto+'">'+n+'</text><rect class="v-barra" x="80" y="'+(y+4)+'" width="0" height="24" rx="4" fill="'+C.violeta+'"/><text class="v-valor" x="90" y="'+(y+21)+'" font-size="12" fill="'+C.mudo+'"></text><text class="v-sorteios" x="630" y="'+(y+21)+'" text-anchor="end" font-size="12" fill="'+C.ciano+'"></text></g>';}).join(''))
    +botoes([['sortear','Sortear quem propõe'],['sortear100','Sortear 100 vezes'],['trapaca','Caio vota em dois blocos'],['recomecar','Recomeçar']])+estado('');
  },
  /* Dois ramos concorrentes: a rede segue o de mais trabalho. */
  reorg:()=>{
   let s=caixa(10,95,70,50,'1','r-base')+caixa(100,95,70,50,'2','r-base')+linha(80,120,100,120)+linha(170,120,200,60)+linha(170,120,200,180);
   for(const [ramo,y] of [['a',35],['b',155]])for(let k=0;k<5;k++)s+='<g class="r-bloco r-'+ramo+'-'+k+'"><rect x="'+(200+k*86)+'" y="'+y+'" width="70" height="50" rx="8" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><text x="'+(235+k*86)+'" y="'+(y+30)+'" text-anchor="middle" font-size="13" font-weight="700" fill="'+C.texto+'">'+(ramo.toUpperCase()+(k+3))+'</text>'+(ramo==='a'&&k===0?'<text x="'+(235+k*86)+'" y="'+(y+46)+'" text-anchor="middle" font-size="10" fill="'+C.ciano+'">sua tx</text>':'')+'</g>';
   s+='<text x="630" y="30" text-anchor="end" font-size="12" fill="'+C.mudo+'">ramo A</text><text x="630" y="225" text-anchor="end" font-size="12" fill="'+C.mudo+'">ramo B</text>';
   return svg(640,240,s)+botoes([['a','Novo bloco no ramo A'],['b','Novo bloco no ramo B'],['recomecar','Recomeçar']])+estado('');
  },
  /* UTXO × contas pagando o mesmo valor. */
  utxo:()=>'<label class="interativo-rotulo">Pagar a Bruno <span class="u-valor-txt">0,6</span><input class="u-valor" type="range" min="0.1" max="0.9" step="0.1" value="0.6"></label>'
   +'<div class="u-lados"><div class="u-lado"><p class="interativo-sub">Bitcoin · moedas (UTXOs)</p>'
   +svg(300,170,[0.5,0.3,0.2].map((v,k)=>'<g class="u-nota u-nota-'+k+'"><rect x="'+(10+k*96)+'" y="10" width="86" height="46" rx="8" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><text x="'+(53+k*96)+'" y="39" text-anchor="middle" font-size="14" font-weight="700" fill="'+C.texto+'">'+fmt(v,1)+'</text></g>').join('')
    +'<text x="10" y="86" font-size="12" fill="'+C.mudo+'">viram novas saídas:</text>'
    +'<g><rect x="10" y="98" width="135" height="46" rx="8" fill="'+C.fundo+'" stroke="'+C.ciano+'" stroke-width="2"/><text class="u-bruno" x="77" y="127" text-anchor="middle" font-size="13" fill="'+C.texto+'"></text></g>'
    +'<g><rect x="155" y="98" width="135" height="46" rx="8" fill="'+C.fundo+'" stroke="'+C.azul+'" stroke-width="2"/><text class="u-troco" x="222" y="127" text-anchor="middle" font-size="13" fill="'+C.texto+'"></text></g>'
    +'<text class="u-taxa" x="10" y="164" font-size="12" fill="'+C.mudo+'"></text>')
   +'</div><div class="u-lado"><p class="interativo-sub">Ethereum · conta com saldo</p>'
   +svg(300,170,'<rect x="10" y="10" width="280" height="64" rx="10" fill="'+C.fundo+'" stroke="'+C.violeta+'" stroke-width="2"/><text x="24" y="34" font-size="12" fill="'+C.mudo+'">saldo antes: 1,0000</text><text class="u-conta" x="24" y="60" font-size="16" font-weight="700" fill="'+C.texto+'"></text>'
    +'<text class="u-conta-obs" x="10" y="104" font-size="12" fill="'+C.mudo+'">O número sobe e desce. Não sobra troco.</text>')
   +'</div></div>'+estado(''),
  /* Espaço no bloco: quem paga mais entra primeiro. */
  taxas:()=>'<label class="interativo-rotulo">Sua taxa <span class="x-taxa-txt">5</span><input class="x-taxa" type="range" min="1" max="20" step="1" value="5"></label>'
   +svg(640,170,'<text x="10" y="20" font-size="16" fill="'+C.mudo+'">Próximo bloco: 5 lugares</text>'
    +[0,1,2,3,4].map(k=>'<g class="x-vaga x-vaga-'+k+'"><rect x="'+(10+k*126)+'" y="32" width="114" height="60" rx="8" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><text class="x-vaga-txt" x="'+(67+k*126)+'" y="69" text-anchor="middle" font-size="18" font-weight="700" fill="'+C.texto+'"></text></g>').join('')
    +'<text x="10" y="124" font-size="16" fill="'+C.mudo+'">Fila:</text><text class="x-fila" x="60" y="124" font-size="16" fill="'+C.texto+'"></text>'
    +'<text class="x-corte" x="10" y="156" font-size="15" fill="'+C.ciano+'"></text>')
   +botoes([['pico','Hora de pico'],['calmo','Rede calma']])+estado(''),
  /* Oráculo: atualiza por desvio ou por tempo. */
  oraculo:()=>'<label class="interativo-rotulo">Preço lá fora (média das fontes) <span class="o-fora-txt">100,00</span><input class="o-fora" type="range" min="90" max="110" step="0.1" value="100"></label>'
   +svg(640,130,caixa(10,30,150,70,'Fontes','o-fontes','bolsas e corretoras')+linha(160,65,240,65)
    +caixa(240,30,160,70,'Oráculo','o-portao','vários nós votam')+linha(400,65,480,65)
    +'<g class="o-contrato"><rect x="480" y="30" width="150" height="70" rx="8" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><text x="555" y="58" text-anchor="middle" font-size="17" font-weight="700" fill="'+C.texto+'">Contrato</text><text class="o-dentro" x="555" y="84" text-anchor="middle" font-size="18" fill="'+C.ciano+'">100,00</text></g>')
   +'<p class="o-info">Diferença: <strong class="o-dif">0,00%</strong> · última atualização há <strong class="o-horas">0 h</strong></p>'
   +botoes([['hora','Passar 1 hora'],['recomecar','Recomeçar']])+estado(''),
  /* ===== Módulo 3 ===== */
  /* Qual é o token de verdade? Endereços reais do USDC conferidos na Circle em 21/10/2026. */
  ticker:()=>'<p class="interativo-sub">Quatro tokens chamados USDC. Clique em cada um.</p><div class="k-cartoes">'
   +[['USDC','Ethereum','0xA0b8…eB48','emitido pela Circle'],['USDC','Ethereum','0xA0b8…eB49','criado ontem · 3 donos'],['USDC.e','Arbitrum','0xFF97…5CC8','veio por uma ponte'],['USDC','Base','0x8335…2913','emitido pela Circle']]
    .map(([n,r,a,s],k)=>'<button type="button" class="k-cartao" data-k="'+k+'"><strong>'+n+'</strong><span>rede: '+r+'</span><code>'+a+'</code><small>'+s+'</small></button>').join('')
   +'</div>'+estado('Nome e símbolo qualquer um copia. O que identifica o token é a rede mais o endereço do contrato.'),
  /* Custódia: a mesma situação nos dois modelos. */
  custodia:()=>'<div class="c-cenarios">'+[['quebra','A empresa quebra'],['celular','Você perde o celular'],['frase','Alguém copia sua frase'],['senha','Você esquece a senha do app']].map(([a,t])=>'<button class="btn small" type="button" data-acao="'+a+'">'+t+'</button>').join('')+'</div>'
   +'<div class="c-lados"><div class="c-lado"><p class="interativo-sub">Corretora (custodial)</p><p class="c-quem">Quem tem a chave: <strong>a empresa</strong></p><p class="c-res c-res-corretora">Escolha uma situação.</p></div>'
   +'<div class="c-lado"><p class="interativo-sub">Autocustódia</p><p class="c-quem">Quem tem a chave: <strong>você</strong></p><p class="c-res c-res-auto">Escolha uma situação.</p></div></div>',
  /* Hardware wallet: o que o computador mostra × o que o aparelho mostra. */
  assinatura:()=>'<div class="h-telas"><div class="h-tela h-pc"><p class="interativo-sub">Tela do computador</p><p class="h-msg h-msg-pc"></p></div>'
   +'<div class="h-tela h-aparelho"><p class="interativo-sub">Tela da hardware wallet</p><p class="h-msg h-msg-dev"></p></div></div>'
   +botoes([['confirmar','Confirmar no aparelho'],['recusar','Recusar'],['outra','Próxima situação']])+estado(''),
  /* Envenenamento de endereço: escolher o endereço certo no histórico. */
  envenenado:()=>'<p class="interativo-sub">Seu contato salvo: Bruno · <code class="e-salvo"></code></p><p class="interativo-sub">Histórico recente. Qual é o Bruno de verdade?</p><div class="e-lista"></div>'+estado('Olhe também o meio do endereço, não só o começo e o fim.'),
  /* Capitalização × FDV. */
  fdv:()=>'<label class="interativo-rotulo">Preço (US$) <span class="f-preco-txt"></span><input class="f-preco" type="range" min="0.1" max="10" step="0.1" value="2"></label>'
   +'<label class="interativo-rotulo">Em circulação (milhões) <span class="f-circ-txt"></span><input class="f-circ" type="range" min="10" max="1000" step="10" value="100"></label>'
   +'<label class="interativo-rotulo">Oferta total (milhões) <span class="f-total-txt"></span><input class="f-total" type="range" min="10" max="1000" step="10" value="1000"></label>'
   +svg(640,120,'<text x="10" y="30" font-size="16" fill="'+C.mudo+'">Capitalização</text><rect class="f-barra-cap" x="170" y="12" height="28" rx="4" fill="'+C.ciano+'" width="0"/><text class="f-cap" x="180" y="32" font-size="16" fill="'+C.texto+'"></text>'
    +'<text x="10" y="84" font-size="16" fill="'+C.mudo+'">FDV</text><rect class="f-barra-fdv" x="170" y="66" height="28" rx="4" fill="'+C.violeta+'" width="0"/><text class="f-fdv" x="180" y="86" font-size="16" fill="'+C.texto+'"></text>')
   +estado(''),
  /* Calendário de desbloqueio e diluição. */
  desbloqueio:()=>{
   let pts=[];for(let m=0;m<=48;m++)pts.push((40+m*12)+','+(200-AcademyInterativos.circulante(m)/1000*170).toFixed(1));
   return '<label class="interativo-rotulo">Meses desde o lançamento <span class="d-mes-txt">0</span><input class="d-mes" type="range" min="0" max="48" step="1" value="0"></label>'
    +svg(640,230,linha(40,200,620,200)+linha(40,30,40,200)
     +'<text x="34" y="34" text-anchor="end" font-size="13" fill="'+C.mudo+'">1.000</text><text x="34" y="204" text-anchor="end" font-size="13" fill="'+C.mudo+'">0</text>'
     +[0,12,24,36,48].map(m=>'<text x="'+(40+m*12)+'" y="222" text-anchor="middle" font-size="13" fill="'+C.mudo+'">'+m+'</text>').join('')
     +'<polyline points="'+pts.join(' ')+'" fill="none" stroke="'+C.violeta+'" stroke-width="3"/>'
     +'<line class="d-guia" x1="40" y1="30" x2="40" y2="200" stroke="'+C.ciano+'" stroke-width="1.5" stroke-dasharray="4 4"/><circle class="d-ponto" cx="40" cy="166" r="7" fill="'+C.ciano+'"/>')
    +'<p class="o-info">Em circulação: <strong class="d-circ"></strong> milhões · diluição desde o lançamento: <strong class="d-dil"></strong></p>'+estado('');
  },
  /* Aprovação (allowance) e revogação. */
  allowance:()=>svg(640,120,'<rect x="10" y="10" width="300" height="100" rx="10" fill="'+C.fundo+'" stroke="'+C.azul+'" stroke-width="2"/><text x="26" y="40" font-size="15" fill="'+C.mudo+'">Seu saldo</text><text class="a-saldo" x="26" y="80" font-size="28" font-weight="700" fill="'+C.texto+'"></text>'
    +'<rect class="a-caixa-perm" x="330" y="10" width="300" height="100" rx="10" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><text x="346" y="40" font-size="15" fill="'+C.mudo+'">O contrato pode gastar</text><text class="a-perm" x="346" y="80" font-size="28" font-weight="700" fill="'+C.texto+'"></text>')
   +botoes([['aprovar100','Aprovar 100'],['aprovarTudo','Aprovar ilimitado'],['trocar','Fazer a troca (usa 100)'],['invadido','O contrato é invadido'],['revogar','Revogar'],['recomecar','Recomeçar']])+estado(''),
  /* Multisig 2 de 3. */
  multisig:()=>'<label class="interativo-rotulo">Assinaturas exigidas (limite) <select class="hash-entrada g-limite"><option value="1">1 de 3</option><option value="2" selected>2 de 3</option><option value="3">3 de 3</option></select></label>'
   +'<p class="interativo-sub">Transação pendente: enviar 5 ETH para a conta da empresa</p><div class="g-donos">'+['Ana','Bia','Caio'].map((n,k)=>'<button type="button" class="g-dono" data-k="'+k+'" aria-pressed="false">'+n+'<small>não assinou</small></button>').join('')+'</div>'
   +botoes([['executar','Executar'],['roubo','A chave da Bia é roubada'],['recomecar','Recomeçar']])+estado(''),
 };

 const ligar={
  papeis(fig){
   const pos=[[100,50],[320,50],[440,95],[412,208]];
   passos(fig,[
    'A carteira monta a transação e assina com a chave privada. Nada saiu do seu aparelho ainda.',
    'Seu nó (ou o serviço RPC que a carteira usa) recebe e confere: assinatura válida, saldo suficiente, formato certo.',
    'O nó repassa para outros nós. Cada um confere de novo por conta própria, sem confiar no anterior.',
    'O explorador lê de um nó e mostra a transação. Ele é uma vitrine: se o nó dele errar, a vitrine erra junto.'
   ],{aoMudar:i=>{const p=$(fig,'.p-pacote');if(p){p.style.transform='translate('+pos[i][0]+'px,'+pos[i][1]+'px)';}
    [['.p-carteira',0],['.p-no',1],['.p-rede',2],['.p-explorador',3]].forEach(([s,k])=>$$(fig,s).forEach(g=>g.classList.toggle('aceso',k===i)));}});
  },
  transacao(fig){
   const st=['rascunho','assinada','enviada','pendente','incluída (1 confirmação)','finalizada'];
   passos(fig,[
    'Você escolhe rede, destinatário, valor e taxa. Confira tudo aqui: depois de assinar, não há "desfazer".',
    'A carteira assina com a chave privada. A assinatura prova que o dono autorizou, sem revelar a chave.',
    'A transação é transmitida para os nós. "Enviado" na tela ainda não quer dizer "registrado".',
    'Ela espera na fila de pendentes (mempool). Com muita demanda, quem paga mais taxa tende a entrar antes.',
    'Um produtor de blocos inclui a transação. Cada bloco novo por cima conta como mais uma confirmação.',
    'No Ethereum, depois de cerca de duas épocas, o bloco é finalizado: desfazê-lo exigiria destruir muito ETH em stake.'
   ],{aoMudar:i=>{$$(fig,'.t-etapa').forEach((g,k)=>{g.classList.toggle('feito',k<i);g.classList.toggle('atual',k===i);});$(fig,'.t-status-valor').textContent=st[i];}});
  },
  mineracao(fig){
   const dados=$(fig,'.m-dados'),dif=$(fig,'.m-dif'),nonceEl=$(fig,'.m-nonce'),hashEl=$(fig,'.m-hash'),tent=$(fig,'.m-tentativas strong'),est=$(fig,'.cena-estado');
   let nonce=0,tentativas=0,rodando=false,vez=0;
   const alvo=()=>'0'.repeat(Number(dif.value));
   const conferir=async()=>{
    const minha=++vez,h=await AcademyVisual.sha256(dados.value+nonce);if(minha!==vez)return h;
    nonceEl.textContent=String(nonce);hashEl.textContent=h;tent.textContent=tentativas.toLocaleString('pt-BR');
    const ok=h.startsWith(alvo());fig.classList.toggle('m-ok',ok);
    est.textContent=ok?'Bloco válido! Achar levou '+tentativas.toLocaleString('pt-BR')+' tentativas; qualquer nó confere com um cálculo só.':'Ainda não: o hash precisa começar com '+alvo()+'.';
    return h;
   };
   const parar=$(fig,'[data-acao="parar"]');parar.disabled=true;
   acao(fig,'tentar',()=>{nonce++;tentativas++;conferir();});
   acao(fig,'minerar',async()=>{
    if(rodando)return;rodando=true;parar.disabled=false;fig.classList.add('m-rodando');
    const a=alvo();
    while(rodando&&fig.isConnected){
     let achou=false;
     for(let k=0;k<200;k++){nonce++;tentativas++;const h=await AcademyVisual.sha256(dados.value+nonce);if(h.startsWith(a)){achou=true;break;}}
     await conferir();if(achou)break;
     await new Promise(r=>setTimeout(r,0));
    }
    rodando=false;parar.disabled=true;fig.classList.remove('m-rodando');
   });
   parar.addEventListener('click',()=>{rodando=false;});
   /* Mudar os dados invalida o trabalho feito: o hash muda e a contagem recomeça. */
   const refazer=()=>{rodando=false;nonce=0;tentativas=0;conferir();};
   dados.addEventListener('input',refazer);dif.addEventListener('change',refazer);
   if(window.crypto?.subtle)conferir();else est.textContent='Este navegador não oferece SHA-256 nesta página.';
  },
  validadores(fig){
   const base=[32,64,32,96,32];let stake=[...base],sorteios=[0,0,0,0,0],fora=[false,false,false,false,false];
   const est=$(fig,'.cena-estado');
   const desenhar=(destaque=-1)=>{
    $$(fig,'.v-linha').forEach((g,k)=>{
     g.querySelector('.v-barra').setAttribute('width',String(Math.round(stake[k]/96*360)));
     g.querySelector('.v-valor').setAttribute('x',String(90+Math.round(stake[k]/96*360)));
     g.querySelector('.v-valor').textContent=fora[k]?stake[k]+' (expulso)':stake[k]+' em stake';
     g.querySelector('.v-sorteios').textContent=sorteios.some(Boolean)?sorteios[k]+'×':'';
     g.classList.toggle('escolhido',k===destaque);g.classList.toggle('punido',fora[k]);
    });
   };
   const sortear=()=>{const ativos=stake.map((s,k)=>fora[k]?0:s),t=ativos.reduce((a,b)=>a+b,0);let r=Math.random()*t;for(let k=0;k<5;k++){r-=ativos[k];if(r<0)return k;}return 4;};
   const nomes=['Ana','Bia','Caio','Davi','Eva'];
   acao(fig,'sortear',()=>{const k=sortear();sorteios[k]++;desenhar(k);est.textContent=nomes[k]+' propõe o próximo bloco. Os outros conferem e votam (atestam). Quem tem mais em stake é sorteado mais vezes.';});
   acao(fig,'sortear100',()=>{for(let n=0;n<100;n++)sorteios[sortear()]++;desenhar();est.textContent='Davi tem 3 vezes o stake de Ana; ao longo de muitos sorteios, ele propõe cerca de 3 vezes mais blocos.';});
   acao(fig,'trapaca',()=>{if(fora[2])return;stake[2]=Math.round(stake[2]*0.5);fora[2]=true;desenhar();est.textContent='Caio assinou dois votos que se contradizem. A prova vai para a rede, parte do stake dele é destruída e ele é expulso (slashing). Valores de exemplo.';});
   acao(fig,'recomecar',()=>{stake=[...base];sorteios=[0,0,0,0,0];fora=[false,false,false,false,false];desenhar();est.textContent='Cinco validadores com stakes diferentes (valores de exemplo).';});
   desenhar();est.textContent='Cinco validadores com stakes diferentes (valores de exemplo).';
  },
  reorg(fig){
   let a=1,b=0;const est=$(fig,'.cena-estado');
   const desenhar=()=>{
    for(let k=0;k<5;k++){$(fig,'.r-a-'+k).classList.toggle('visivel',k<a);$(fig,'.r-b-'+k).classList.toggle('visivel',k<b);}
    const segue=a>=b?'a':'b';
    $$(fig,'.r-bloco').forEach(g=>g.classList.toggle('seguido',g.classList.contains('visivel')&&g.getAttribute('class').includes('r-'+segue+'-')));
    $(fig,'[data-acao="a"]').disabled=a>=5;$(fig,'[data-acao="b"]').disabled=b>=5;
    if(segue==='a')est.textContent='Os nós seguem o ramo A, o de mais trabalho acumulado. Sua transação está no bloco A3 e tem '+a+' confirmação'+(a>1?'ões':'')+'.';
    else est.textContent='Reorganização! O ramo B passou a ter mais trabalho e os nós trocaram de história. O bloco A3 saiu; sua transação volta para a fila e precisa ser incluída de novo.';
    fig.classList.toggle('r-reorg',segue==='b');
   };
   acao(fig,'a',()=>{a=Math.min(5,a+1);desenhar();});
   acao(fig,'b',()=>{b=Math.min(5,b+1);desenhar();});
   acao(fig,'recomecar',()=>{a=1;b=0;desenhar();});
   desenhar();
  },
  utxo(fig){
   const notas=[0.5,0.3,0.2],taxa=0.0001,r=$(fig,'.u-valor');
   const atualizar=()=>{
    const v=Number(r.value);$(fig,'.u-valor-txt').textContent=fmt(v,1);
    let soma=0;const usa=[];for(let k=0;k<3&&soma<v+taxa;k++){usa.push(k);soma+=notas[k];}
    $$(fig,'.u-nota').forEach((g,k)=>g.classList.toggle('gasta',usa.includes(k)));
    $(fig,'.u-bruno').textContent='Bruno: '+fmt(v,1);
    const troco=Math.max(0,soma-v-taxa);
    $(fig,'.u-troco').textContent=soma>=v+taxa?'troco: '+fmt(troco,4):'saldo insuficiente';
    $(fig,'.u-taxa').textContent='taxa = entradas − saídas = '+fmt(taxa,4);
    $(fig,'.u-conta').textContent='saldo depois: '+fmt(1-v-taxa,4);
    $(fig,'.cena-estado').textContent=soma>=v+taxa?'Para pagar '+fmt(v,1)+', a carteira gasta '+usa.length+' moeda'+(usa.length>1?'s':'')+' inteira'+(usa.length>1?'s':'')+' ('+fmt(soma,1)+') e cria o troco. A conta só diminui o saldo.':'Faltam moedas para cobrir valor e taxa.';
   };
   r.addEventListener('input',atualizar);atualizar();
  },
  taxas(fig){
   const calmo=[3,9,1,6,12,4,2,7],pico=[3,9,1,6,12,4,2,7,14,18,11,16,15];
   let fila=calmo;const r=$(fig,'.x-taxa');
   const atualizar=()=>{
    const minha=Number(r.value);$(fig,'.x-taxa-txt').textContent=String(minha);
    const todas=[...fila.map(t=>({t,eu:false})),{t:minha,eu:true}].sort((x,y)=>y.t-x.t||(x.eu?1:-1));
    const bloco=todas.slice(0,5),resto=todas.slice(5);
    $$(fig,'.x-vaga').forEach((g,k)=>{g.querySelector('.x-vaga-txt').textContent=bloco[k].eu?'você · '+bloco[k].t:String(bloco[k].t);g.classList.toggle('minha',bloco[k].eu);});
    $(fig,'.x-fila').textContent=resto.map(x=>x.eu?'você ('+x.t+')':x.t).join(' · ');
    const corte=bloco[4].t;
    $(fig,'.x-corte').textContent='Para entrar agora: taxa acima de '+corte+'.';
    $(fig,'.cena-estado').textContent=bloco.some(x=>x.eu)?'Você entra no próximo bloco.':'Você fica na fila. Espere a demanda cair ou aumente a taxa.';
   };
   r.addEventListener('input',atualizar);
   acao(fig,'pico',()=>{fila=pico;atualizar();});acao(fig,'calmo',()=>{fila=calmo;atualizar();});
   atualizar();
  },
  oraculo(fig){
   const LIMITE=1,PULSO=24;let dentro=100,horas=0,motivo='valor inicial';const r=$(fig,'.o-fora');
   const atualizar=(passou=false)=>{
    const fora=Number(r.value);$(fig,'.o-fora-txt').textContent=fmt(fora);
    if(passou)horas++;
    let dif=Math.abs(fora-dentro)/dentro*100;
    if(dif>LIMITE){dentro=fora;horas=0;motivo='desvio maior que '+LIMITE+'%';dif=0;}
    else if(horas>=PULSO){dentro=fora;horas=0;motivo='passaram '+PULSO+' h sem atualizar';dif=0;}
    $(fig,'.o-dentro').textContent=fmt(dentro);$(fig,'.o-dif').textContent=fmt(dif)+'%';$(fig,'.o-horas').textContent=horas+' h';
    fig.classList.toggle('o-defasado',dif>0.3);
    $(fig,'.cena-estado').textContent='Última atualização: '+motivo+'. Regra deste exemplo: atualiza se a diferença passar de '+LIMITE+'% ou a cada '+PULSO+' h, o que vier primeiro. Entre uma e outra, o contrato usa o valor antigo.';
   };
   r.addEventListener('input',()=>atualizar());acao(fig,'hora',()=>atualizar(true));
   acao(fig,'recomecar',()=>{r.value='100';dentro=100;horas=0;motivo='valor inicial';atualizar();});
   atualizar();
  },
  /* ===== Módulo 3 ===== */
  ticker(fig){
   const txt=['Este é o USDC oficial na rede Ethereum: o endereço bate com a lista publicada pela Circle, a emissora.',
    'Golpe: mesmo nome, mesmo símbolo e endereço parecido, mas é outro contrato. Ele não vale nada e pode nem deixar você vender.',
    'Representação: um USDC que atravessou uma ponte. Vale enquanto a ponte funcionar e honrar o resgate; tem riscos que o oficial não tem.',
    'Oficial também, mas na rede Base. Mesmo nome, outra rede, outro endereço. Mandar para a rede errada pode fazer o dinheiro sumir da sua vista.'];
   $$(fig,'.k-cartao').forEach(b=>b.addEventListener('click',()=>{const k=Number(b.dataset.k);$$(fig,'.k-cartao').forEach(x=>x.classList.toggle('escolhido',x===b));$(fig,'.cena-estado').textContent=txt[k];}));
  },
  custodia(fig){
   const r={quebra:['Você vira credor na fila da falência. Em 2014 (Mt. Gox) e 2022 (FTX), clientes ficaram sem acesso aos fundos por anos.','Nada muda: a empresa da carteira não guarda seu dinheiro. Você instala outro app e usa a mesma frase.'],
    celular:['Sem problema: você entra na conta por outro aparelho, com senha e verificação.','Sem problema, se a frase está guardada: você recria a carteira em outro aparelho. Sem a frase, o dinheiro fica preso para sempre.'],
    frase:['Não se aplica: quem guarda as chaves é a empresa.','A pessoa leva tudo, e ninguém pode desfazer. É o maior risco da autocustódia.'],
    senha:['A empresa recupera seu acesso depois de confirmar sua identidade.','A senha só tranca o app no aparelho. Com a frase, você recria a carteira e escolhe outra senha.']};
   const ruim={quebra:[1,0],celular:[0,0],frase:[0,1],senha:[0,0]};
   Object.keys(r).forEach(a=>acao(fig,a,()=>{$(fig,'.c-res-corretora').textContent=r[a][0];$(fig,'.c-res-auto').textContent=r[a][1];
    $(fig,'.c-res-corretora').classList.toggle('ruim',!!ruim[a][0]);$(fig,'.c-res-auto').classList.toggle('ruim',!!ruim[a][1]);
    $$(fig,'.c-cenarios .btn').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.acao===a)));}));
  },
  assinatura(fig){
   const casos=[{pc:'Enviar 100 USDC para 0x7a3f…c9d2',dev:'Enviar 100 USDC para 0x7a3f…c9d2',bom:true},
    {pc:'Enviar 100 USDC para 0xB0b5…9F21',dev:'Enviar 100 USDC para 0x5e1d…0aa7',bom:false},
    {pc:'Entrar no site (assinatura de login)',dev:'Aprovar: gastar USDC ilimitado para 0x5e1d…0aa7',bom:false}];
   let i=0;const est=$(fig,'.cena-estado');
   const mostrar=()=>{$(fig,'.h-msg-pc').textContent=casos[i].pc;$(fig,'.h-msg-dev').textContent=casos[i].dev;fig.classList.remove('h-certo','h-errado');est.textContent='Situação '+(i+1)+' de '+casos.length+'. Compare as duas telas e decida.';};
   const decidir=conf=>{const ok=conf===casos[i].bom;fig.classList.toggle('h-certo',ok);fig.classList.toggle('h-errado',!ok);
    est.textContent=(ok?'Boa decisão. ':'Cuidado. ')+(casos[i].bom?'As duas telas dizem a mesma coisa; pode confirmar.':'O computador foi invadido e mostra uma coisa, mas o aparelho mostra o que você está assinando de verdade. Vale o que está na tela do aparelho.');};
   acao(fig,'confirmar',()=>decidir(true));acao(fig,'recusar',()=>decidir(false));
   acao(fig,'outra',()=>{i=(i+1)%casos.length;mostrar();});
   mostrar();
  },
  envenenado(fig){
   const certo='0x9C4e2a7B5d81F03c6E1a4b2D7f9083Ac5E21d7F3';
   const lista=[['0x9C4e8f1A3b60C27d9E5f0a4B6c1D8e7F3a90d7F3','há 2 horas · 0 USDC'],[certo,'há 3 dias · 250 USDC'],['0x9C4e2a7B5d81F03c6E1a4b2D7f9083Ac5E21d7F8','há 1 hora · 0 USDC']];
   $(fig,'.e-salvo').textContent=certo;
   const caixa=$(fig,'.e-lista'),doc=fig.ownerDocument,est=$(fig,'.cena-estado');
   lista.forEach(([end,info])=>{
    const b=doc.createElement('button');b.type='button';b.className='e-item';
    const c=doc.createElement('code');[...end].forEach((ch,k)=>{if(ch!==certo[k]){const m=doc.createElement('mark');m.textContent=ch;c.append(m);}else c.append(doc.createTextNode(ch));});
    const s=doc.createElement('small');s.textContent=info;b.append(c,s);
    b.addEventListener('click',()=>{fig.classList.add('e-revelado');$$(fig,'.e-item').forEach(x=>x.classList.toggle('escolhido',x===b));
     est.textContent=end===certo?'Certo. Os outros dois copiam o começo e o fim do endereço do Bruno e chegaram com 0 USDC só para aparecer no seu histórico. As diferenças agora estão marcadas.':'Golpe! Esse endereço imita o começo e o fim do Bruno. Ele mandou 0 USDC só para entrar no seu histórico. Copie sempre dos contatos salvos e confira o endereço inteiro.';});
    caixa.append(b);
   });
  },
  fdv(fig){
   const p=$(fig,'.f-preco'),c=$(fig,'.f-circ'),t=$(fig,'.f-total');
   const mi=v=>v>=1000?'US$ '+fmt(v/1000,2)+' bi':'US$ '+fmt(v,0)+' mi';
   const atualizar=()=>{
    if(Number(t.value)<Number(c.value))t.value=c.value;
    const preco=Number(p.value),circ=Number(c.value),total=Number(t.value),cap=preco*circ,fdv=preco*total,max=10*1000;
    $(fig,'.f-preco-txt').textContent=fmt(preco);$(fig,'.f-circ-txt').textContent=fmt(circ,0);$(fig,'.f-total-txt').textContent=fmt(total,0);
    $(fig,'.f-barra-cap').setAttribute('width',String(Math.max(2,Math.round(cap/max*300))));$(fig,'.f-barra-fdv').setAttribute('width',String(Math.max(2,Math.round(fdv/max*300))));
    $(fig,'.f-cap').setAttribute('x',String(180+Math.max(2,Math.round(cap/max*300))));$(fig,'.f-fdv').setAttribute('x',String(180+Math.max(2,Math.round(fdv/max*300))));
    $(fig,'.f-cap').textContent=mi(cap);$(fig,'.f-fdv').textContent=mi(fdv);
    const pct=circ/total*100;
    $(fig,'.cena-estado').textContent='Só '+fmt(pct,0)+'% dos tokens circulam. '+(pct<50?'Ainda vão entrar '+fmt(total-circ,0)+' milhões no mercado: se a demanda não acompanhar, o preço sofre.':'A maior parte já circula, então a diluição futura é menor.');
   };
   [p,c,t].forEach(x=>x.addEventListener('input',atualizar));atualizar();
  },
  desbloqueio(fig){
   const r=$(fig,'.d-mes');
   const atualizar=()=>{
    const m=Number(r.value),c=AcademyInterativos.circulante(m),x=40+m*12,y=200-c/1000*170;
    $(fig,'.d-mes-txt').textContent=String(m);$(fig,'.d-circ').textContent=fmt(c,0);$(fig,'.d-dil').textContent=fmt((c/200-1)*100,0)+'%';
    $(fig,'.d-guia').setAttribute('x1',String(x));$(fig,'.d-guia').setAttribute('x2',String(x));$(fig,'.d-ponto').setAttribute('cx',String(x));$(fig,'.d-ponto').setAttribute('cy',y.toFixed(1));
    $(fig,'.cena-estado').textContent=m<12?'Antes do mês 12, só o lote da comunidade vai sendo liberado aos poucos. Equipe e investidores ainda estão travados (período de carência).':m===12?'Mês 12: acaba a carência. A partir daqui, a parte da equipe e dos investidores começa a sair todo mês.':'Cada token de quem comprou no lançamento agora é uma fatia menor do total em circulação. Valores de exemplo.';
   };
   r.addEventListener('input',atualizar);atualizar();
  },
  allowance(fig){
   let saldo=1000,perm=0;const est=$(fig,'.cena-estado');
   const mostrar=t=>{$(fig,'.a-saldo').textContent=fmt(saldo,0)+' USDC';$(fig,'.a-perm').textContent=perm===Infinity?'ilimitado':fmt(perm,0)+' USDC';fig.classList.toggle('a-perigo',perm===Infinity);est.textContent=t;};
   acao(fig,'aprovar100',()=>{perm=100;mostrar('Aprovado só o que a troca precisa. Aprovar não move nada: só dá permissão.');});
   acao(fig,'aprovarTudo',()=>{perm=Infinity;mostrar('Permissão ilimitada: o contrato pode tirar qualquer quantia, quando quiser, sem pedir de novo.');});
   acao(fig,'trocar',()=>{if(perm<100){mostrar('A troca falha: o contrato não tem permissão para gastar 100 USDC.');return;}saldo-=100;if(perm!==Infinity)perm-=100;mostrar('O contrato usou 100 USDC na troca.'+(perm===Infinity?' A permissão continua ilimitada depois disso.':' A permissão acabou junto.'));});
   acao(fig,'invadido',()=>{const leva=Math.min(saldo,perm);saldo-=leva;if(perm!==Infinity)perm-=leva;mostrar(leva?'O invasor usa a permissão que você deu e leva '+fmt(leva,0)+' USDC.':'O invasor não leva nada: não há permissão sobrando.');});
   acao(fig,'revogar',()=>{perm=0;mostrar('Permissão revogada (é uma transação, com taxa). Agora o contrato não pode gastar nada.');});
   acao(fig,'recomecar',()=>{saldo=1000;perm=0;mostrar('Você tem 1.000 USDC e quer trocar 100 numa corretora descentralizada.');});
   mostrar('Você tem 1.000 USDC e quer trocar 100 numa corretora descentralizada.');
  },
  multisig(fig){
   let ass=[false,false,false],roubada=false,feito=false;const lim=$(fig,'.g-limite'),est=$(fig,'.cena-estado'),nomes=['Ana','Bia','Caio'];
   const mostrar=t=>{
    const n=ass.filter(Boolean).length,need=Number(lim.value);
    $$(fig,'.g-dono').forEach((b,k)=>{b.setAttribute('aria-pressed',String(ass[k]));b.querySelector('small').textContent=ass[k]?(roubada&&k===1?'assinou (ladrão)':'assinou'):'não assinou';b.classList.toggle('roubado',roubada&&k===1);});
    $(fig,'[data-acao="executar"]').disabled=feito||n<need;
    est.textContent=t||(feito?'Executada.':n+' de '+need+' assinaturas exigidas.');
   };
   $$(fig,'.g-dono').forEach((b,k)=>b.addEventListener('click',()=>{if(feito)return;ass[k]=!ass[k];mostrar();}));
   lim.addEventListener('change',()=>mostrar());
   acao(fig,'executar',()=>{feito=true;mostrar(roubada&&ass.filter(Boolean).length===1?'Executada só com a chave roubada: com limite 1 de 3, um ladrão basta.':'Executada: '+ass.map((a,k)=>a?nomes[k]:null).filter(Boolean).join(' e ')+' assinaram. Cada dono confere a transação no próprio aparelho.');});
   acao(fig,'roubo',()=>{ass=[false,true,false];roubada=true;feito=false;const need=Number(lim.value);mostrar(need>1?'O ladrão assina como Bia, mas sozinho não alcança '+need+' assinaturas. Ana e Caio recusam e o dinheiro fica parado.':'Com limite 1 de 3, a assinatura do ladrão já basta para executar.');});
   acao(fig,'recomecar',()=>{ass=[false,false,false];roubada=false;feito=false;mostrar();});
   mostrar();
  },
 };
 /* Desbloqueio de exemplo (milhões de um total de 1.000): 200 no lançamento,
    400 da comunidade liberados em 48 meses e 400 de equipe e investidores
    travados por 12 meses e liberados nos 24 seguintes. */
 const circulante=m=>200+400*Math.min(m,48)/48+(m<12?0:400*Math.min(m-12,24)/24);
 return {html,ligar,circulante,KINDS:Object.keys(html)};
})();
