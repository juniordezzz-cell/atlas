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
  /* ===== Módulo 4 ===== */
  /* Gasto duplo: duas transações gastando a mesma moeda. */
  gastoduplo:()=>svg(640,250,
    caixa(10,95,120,60,'Alice','gd-alice','moeda #7 · 1 BTC')
   +linha(130,110,190,60)+linha(130,140,190,190)
   +caixa(190,30,190,60,'tx A → Bruno','gd-txa','gasta a moeda #7')+caixa(190,160,190,60,'tx B → Caio','gd-txb','gasta a moeda #7')
   +linha(380,60,450,125)+'<g class="gd-bloco">'+caixa(450,95,170,60,'Bloco 840.001','gd-bloco-c','inclui a tx A')+'</g>'
   +'<text class="gd-x" x="285" y="245" text-anchor="middle" font-size="15" font-weight="700" fill="'+C.verm+'">tx B inválida: a moeda #7 já foi gasta</text>')
   +botoes([['anterior','← Anterior'],['proximo','Próximo passo →'],['recomecar','Recomeçar']])+estado(''),
  /* Montar uma transação: escolher moedas, ver taxa e troco. */
  montartx:()=>'<p class="interativo-sub">Pagar 0,30000000 BTC a Bruno. Escolha as moedas (UTXOs) que entram.</p><div class="mt-moedas">'
   +[5e6,12e6,2e7,35e6,8e7].map((s,k)=>'<label class="mt-moeda"><input type="checkbox" data-sats="'+s+'"'+(k===3?' checked':'')+'> <span>'+fmt(s/1e8,8)+' BTC</span></label>').join('')+'</div>'
   +'<label class="interativo-rotulo">Taxa da rede agora (sat/vB) <span class="mt-taxa-txt"></span><input class="mt-taxa" type="range" min="1" max="60" step="1" value="10"></label>'
   +'<div class="mt-conta"><p>Entradas <strong class="mt-ent"></strong></p><p>Pagamento <strong>0,30000000</strong></p><p>Tamanho <strong class="mt-vb"></strong></p><p>Taxa <strong class="mt-fee"></strong></p><p>Troco <strong class="mt-troco"></strong></p></div>'+estado(''),
  /* Que tipo de endereço é este? */
  endereco:()=>'<label class="interativo-rotulo">Cole ou escolha um endereço<input class="hash-entrada en-texto" type="text" maxlength="100" autocomplete="off" spellcheck="false"></label>'
   +'<div class="cena-controles">'+[['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa','Legado'],['3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy','Script'],['bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4','SegWit'],['bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0','Taproot'],['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48','Outro']].map(([a,t])=>'<button class="btn small" type="button" data-exemplo="'+a+'">'+t+'</button>').join('')+'</div>'
   +'<p class="en-tipo"></p>'+estado(''),
  /* Halving: a recompensa cai à metade a cada 210 mil blocos. */
  halving:()=>{
   let barras='';for(let k=0;k<8;k++){const tot=21*(1-Math.pow(2,-(k+1))),h=tot/21*150;barras+='<g class="hv-era hv-era-'+k+'"><rect x="'+(50+k*72)+'" y="'+(180-h).toFixed(1)+'" width="56" height="'+h.toFixed(1)+'" rx="4" fill="'+C.linha+'"/><text x="'+(78+k*72)+'" y="200" text-anchor="middle" font-size="13" fill="'+C.mudo+'">'+(k+1)+'ª</text></g>';}
   return '<label class="interativo-rotulo">Era (cada uma dura 210.000 blocos, cerca de 4 anos) <span class="hv-txt"></span><input class="hv-era-in" type="range" min="0" max="7" step="1" value="4"></label>'
    +svg(640,220,linha(40,180,630,180)+'<line x1="40" y1="30" x2="630" y2="30" stroke="'+C.ciano+'" stroke-width="1.5" stroke-dasharray="5 5"/><text x="630" y="22" text-anchor="end" font-size="13" fill="'+C.ciano+'">limite de 21 milhões</text>'+barras+'<text x="40" y="216" font-size="12" fill="'+C.mudo+'">barras: total emitido ao fim de cada era</text>')
    +'<p class="o-info">Recompensa por bloco: <strong class="hv-sub"></strong> · emitido ao fim da era: <strong class="hv-tot"></strong></p>'+estado('');
  },
  /* Nós conferem: o minerador não escolhe quanto ganha. */
  regrasbtc:()=>'<label class="interativo-rotulo">O minerador escreve no bloco que ganha <span class="rb-txt"></span><input class="rb-valor" type="range" min="0" max="10" step="0.125" value="3.325"></label>'
   +'<p class="o-info">Regra hoje: subsídio de 3,125 + taxas do bloco (0,2 neste exemplo) = <strong>3,325 BTC</strong> no máximo</p>'
   +svg(640,90,['A','B','C'].map((l,k)=>'<g class="rb-no"><rect x="'+(10+k*212)+'" y="10" width="196" height="64" rx="8" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><text x="'+(108+k*212)+'" y="36" text-anchor="middle" font-size="16" font-weight="700" fill="'+C.texto+'">Nó '+l+'</text><text class="rb-res" x="'+(108+k*212)+'" y="60" text-anchor="middle" font-size="15" fill="'+C.mudo+'"></text></g>').join(''))+estado(''),
  /* Transação presa: esperar, RBF ou CPFP. */
  acelerar:()=>svg(640,150,'<text x="10" y="22" font-size="15" fill="'+C.mudo+'">Para entrar no próximo bloco hoje: acima de 12 sat/vB</text>'
    +'<line x1="10" y1="40" x2="630" y2="40" stroke="'+C.linha+'" stroke-width="2"/>'
    +'<g class="ac-pai"><rect x="10" y="60" width="270" height="70" rx="8" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><text x="145" y="88" text-anchor="middle" font-size="16" font-weight="700" fill="'+C.texto+'">Sua transação</text><text class="ac-pai-txt" x="145" y="114" text-anchor="middle" font-size="14" fill="'+C.mudo+'"></text></g>'
    +'<g class="ac-filho"><line x1="280" y1="95" x2="350" y2="95" stroke="'+C.ciano+'" stroke-width="2"/><rect x="350" y="60" width="280" height="70" rx="8" fill="'+C.fundo+'" stroke="'+C.ciano+'" stroke-width="2"/><text x="490" y="88" text-anchor="middle" font-size="16" font-weight="700" fill="'+C.texto+'">Filha (gasta o troco)</text><text class="ac-filho-txt" x="490" y="114" text-anchor="middle" font-size="14" fill="'+C.mudo+'"></text></g>')
   +botoes([['esperar','Esperar'],['rbf','Substituir com taxa maior (RBF)'],['cpfp','Filha paga pela mãe (CPFP)'],['recomecar','Recomeçar']])+estado(''),
  /* Canal Lightning entre Ana e Bruno. */
  canal:()=>svg(640,150,'<text x="10" y="24" font-size="16" font-weight="700" fill="'+C.texto+'">Ana</text><text x="630" y="24" text-anchor="end" font-size="16" font-weight="700" fill="'+C.texto+'">Bruno</text>'
    +'<rect x="10" y="40" width="620" height="44" rx="8" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><rect class="cn-ana" x="10" y="40" width="620" height="44" rx="8" fill="'+C.azul+'"/><line class="cn-div" x1="630" y1="34" x2="630" y2="90" stroke="'+C.texto+'" stroke-width="3"/>'
    +'<text class="cn-ana-txt" x="20" y="112" font-size="15" fill="'+C.texto+'"></text><text class="cn-bruno-txt" x="630" y="112" text-anchor="end" font-size="15" fill="'+C.texto+'"></text>'
    +'<text class="cn-cont" x="320" y="140" text-anchor="middle" font-size="14" fill="'+C.ciano+'"></text>')
   +botoes([['ana','Ana paga 10.000 sat'],['bruno','Bruno paga 5.000 sat'],['fechar','Fechar o canal'],['recomecar','Recomeçar']])+estado(''),
  /* ===== Módulo 5 ===== */
  /* Um contrato-cofre com regras: estado, chamadas e eventos. */
  cofre:()=>svg(640,150,'<rect x="10" y="10" width="300" height="130" rx="10" fill="'+C.fundo+'" stroke="'+C.azul+'" stroke-width="2"/><text x="26" y="38" font-size="16" font-weight="700" fill="'+C.texto+'">Estado do contrato</text>'
    +'<text class="cf-ana" x="26" y="68" font-size="15" fill="'+C.mudo+'"></text><text class="cf-bruno" x="26" y="94" font-size="15" fill="'+C.mudo+'"></text><text class="cf-total" x="26" y="124" font-size="15" font-weight="700" fill="'+C.ciano+'"></text>'
    +'<rect x="330" y="10" width="300" height="130" rx="10" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><text x="346" y="38" font-size="16" font-weight="700" fill="'+C.texto+'">Eventos (registro)</text>'
    +[0,1,2,3].map(k=>'<text class="cf-ev cf-ev-'+k+'" x="346" y="'+(64+k*22)+'" font-size="13" fill="'+C.mudo+'"></text>').join(''))
   +botoes([['depAna','Ana deposita 1 ETH'],['saqAna','Ana saca 0,5 ETH'],['saqBruno','Bruno tenta sacar 1 ETH'],['recomecar','Recomeçar']])+estado(''),
  /* O caminho de uma chamada, com ou sem saldo. */
  chamada:()=>'<label class="interativo-rotulo ch-op"><span><input type="checkbox" class="ch-saldo" checked> Você tem saldo suficiente</span></label>'
   +svg(640,110,linha(60,45,580,45)+['Site','Carteira','Contrato','Estado','Evento'].map((t,k)=>{const x=60+k*130;return '<g class="t-etapa t-etapa-'+k+'"><circle cx="'+x+'" cy="45" r="18" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="3"/><text x="'+x+'" y="51" text-anchor="middle" font-size="14" font-weight="700" fill="'+C.mudo+'">'+(k+1)+'</text><text class="ch-rot ch-rot-'+k+'" x="'+x+'" y="96" text-anchor="middle" font-size="15" fill="'+C.texto+'">'+t+'</text></g>';}).join(''))
   +botoes([['anterior','← Anterior'],['proximo','Próximo passo →'],['recomecar','Recomeçar']])+estado(''),
  /* Calculadora de gas. */
  gascalc:()=>'<label class="interativo-rotulo">Operação<select class="hash-entrada gc-op"><option value="21000">Enviar ETH (21.000 gas)</option><option value="50000">Enviar um token (≈ 50.000, exemplo)</option><option value="150000">Troca numa DEX (≈ 150.000, exemplo)</option></select></label>'
   +'<label class="interativo-rotulo">Taxa base (gwei) <span class="gc-base-txt"></span><input class="gc-base" type="range" min="1" max="100" step="1" value="10"></label>'
   +'<label class="interativo-rotulo">Gorjeta ao validador (gwei) <span class="gc-tip-txt"></span><input class="gc-tip" type="range" min="0" max="5" step="0.5" value="1"></label>'
   +'<label class="interativo-rotulo">Preço do ETH (US$, exemplo) <span class="gc-eth-txt"></span><input class="gc-eth" type="range" min="1000" max="6000" step="100" value="3000"></label>'
   +'<div class="mt-conta"><p>Custo em ETH <strong class="gc-total"></strong></p><p>Em dólar <strong class="gc-usd"></strong></p><p>Queimado (base) <strong class="gc-queima"></strong></p><p>Para o validador <strong class="gc-val"></strong></p></div>'+estado(''),
  /* Tudo ou nada: uma troca que confere o mínimo no fim. */
  atomico:()=>'<label class="interativo-rotulo">O preço andou contra você durante a espera <span class="at-mov-txt"></span><input class="at-mov" type="range" min="0" max="5" step="0.5" value="0.5"></label>'
   +'<label class="interativo-rotulo">Diferença máxima que você aceita (slippage) <span class="at-tol-txt"></span><input class="at-tol" type="range" min="0.5" max="5" step="0.5" value="1"></label>'
   +svg(640,90,['Tira 100 USDC','Calcula o ETH','Confere o mínimo','Entrega o ETH'].map((t,k)=>{const x=10+k*158;return '<g class="at-passo at-passo-'+k+'"><rect x="'+x+'" y="10" width="146" height="60" rx="8" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><text x="'+(x+73)+'" y="46" text-anchor="middle" font-size="15" fill="'+C.texto+'">'+t+'</text></g>';}).join(''))
   +'<p class="o-info">Seu saldo depois: <strong class="at-saldo"></strong></p>'
   +botoes([['executar','Enviar a troca'],['recomecar','Recomeçar']])+estado(''),
  /* Reentrância: o cofre com falha e o corrigido. */
  reentrancia:()=>'<div class="c-cenarios"><button class="btn small" type="button" data-acao="falha" aria-pressed="true">Versão com falha: envia, depois zera</button><button class="btn small" type="button" data-acao="corrigida" aria-pressed="false">Versão corrigida: zera, depois envia</button></div>'
   +svg(640,90,'<rect x="10" y="10" width="300" height="70" rx="10" fill="'+C.fundo+'" stroke="'+C.azul+'" stroke-width="2"/><text x="26" y="38" font-size="15" fill="'+C.mudo+'">No cofre</text><text class="re-cofre" x="26" y="66" font-size="22" font-weight="700" fill="'+C.texto+'"></text>'
    +'<rect class="re-caixa-at" x="330" y="10" width="300" height="70" rx="10" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><text x="346" y="38" font-size="15" fill="'+C.mudo+'">Com o atacante</text><text class="re-at" x="346" y="66" font-size="22" font-weight="700" fill="'+C.texto+'"></text>')
   +'<ol class="re-pilha"></ol>'+botoes([['atacar','O atacante pede o saque de 1 ETH'],['recomecar','Recomeçar']])+estado(''),
  /* Proxy atualizável e prazo de espera (timelock). */
  proxy:()=>'<label class="interativo-rotulo ch-op"><span><input type="checkbox" class="px-timelock" checked> Atualização com prazo de espera de 48 h (timelock)</span></label>'
   +svg(640,120,'<rect x="10" y="20" width="230" height="80" rx="10" fill="'+C.fundo+'" stroke="'+C.ciano+'" stroke-width="2"/><text x="125" y="52" text-anchor="middle" font-size="16" font-weight="700" fill="'+C.texto+'">Proxy</text><text x="125" y="76" text-anchor="middle" font-size="13" fill="'+C.mudo+'">endereço fixo 0xC0FE…</text>'
    +'<line x1="240" y1="60" x2="330" y2="60" stroke="'+C.mudo+'" stroke-width="2"/><text x="285" y="52" text-anchor="middle" font-size="12" fill="'+C.mudo+'">executa</text>'
    +'<rect class="px-impl" x="330" y="20" width="300" height="80" rx="10" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><text class="px-versao" x="480" y="52" text-anchor="middle" font-size="16" font-weight="700" fill="'+C.texto+'"></text><text class="px-regra" x="480" y="76" text-anchor="middle" font-size="13" fill="'+C.mudo+'"></text>')
   +'<p class="o-info">Seus fundos: <strong class="px-fundos"></strong> · <span class="px-relogio"></span></p>'
   +botoes([['propor','Admin propõe a versão 2'],['passar','Passar 24 h'],['sacar','Sacar tudo agora'],['recomecar','Recomeçar']])+estado(''),
  /* ===== Módulo 6 ===== */
  /* Juros pela utilização, com a "curva de joelho". Parâmetros de exemplo. */
  utilizacao:()=>{
   let pts=[];for(let u=0;u<=100;u+=2)pts.push((50+u*5.6).toFixed(1)+','+(190-AcademyInterativos.juros(u/100).tomar*170/0.79).toFixed(1));
   return '<label class="interativo-rotulo">Quanto do pool está emprestado (utilização) <span class="ut-txt"></span><input class="ut-u" type="range" min="0" max="100" step="1" value="60"></label>'
    +svg(640,220,linha(50,190,610,190)+linha(50,20,50,190)
     +'<line x1="498" y1="20" x2="498" y2="190" stroke="'+C.ambar+'" stroke-width="1.5" stroke-dasharray="5 5"/><text x="498" y="16" text-anchor="middle" font-size="12" fill="'+C.ambar+'">80%</text>'
     +'<polyline points="'+pts.join(' ')+'" fill="none" stroke="'+C.violeta+'" stroke-width="3"/>'
     +'<circle class="ut-ponto" cx="50" cy="190" r="7" fill="'+C.ciano+'"/>'
     +'<text x="50" y="210" font-size="12" fill="'+C.mudo+'">0%</text><text x="610" y="210" text-anchor="end" font-size="12" fill="'+C.mudo+'">100% emprestado</text><text x="58" y="34" font-size="12" fill="'+C.mudo+'">juros de quem toma</text>')
    +'<div class="mt-conta"><p>Quem toma paga <strong class="ut-tomar"></strong></p><p>Quem fornece ganha <strong class="ut-fornecer"></strong></p><p>Livre para saque <strong class="ut-livre"></strong></p></div>'+estado('');
  },
  /* Health factor. */
  hf:()=>'<label class="interativo-rotulo">ETH depositado como garantia <span class="hf-qtd-txt"></span><input class="hf-qtd" type="range" min="0.5" max="10" step="0.5" value="2"></label>'
   +'<label class="interativo-rotulo">Preço do ETH (US$) <span class="hf-preco-txt"></span><input class="hf-preco" type="range" min="500" max="6000" step="50" value="3000"></label>'
   +'<label class="interativo-rotulo">Dívida em USDC <span class="hf-div-txt"></span><input class="hf-div" type="range" min="0" max="12000" step="100" value="3000"></label>'
   +svg(640,70,'<rect x="10" y="20" width="620" height="22" rx="11" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><rect class="hf-barra" x="10" y="20" height="22" rx="11" width="0" fill="'+C.ciano+'"/>'
    +'<line x1="217" y1="12" x2="217" y2="50" stroke="'+C.verm+'" stroke-width="2"/><text x="217" y="66" text-anchor="middle" font-size="12" fill="'+C.verm+'">HF 1</text><text x="630" y="66" text-anchor="end" font-size="12" fill="'+C.mudo+'">HF 3+</text>')
   +'<div class="mt-conta"><p>Health factor <strong class="hf-valor"></strong></p><p>Pode tomar até <strong class="hf-cap"></strong></p><p>Liquidação se o ETH cair a <strong class="hf-liq"></strong></p></div>'+estado(''),
  /* Liquidação passo a passo. */
  liquidacao:()=>svg(640,110,'<rect x="10" y="10" width="300" height="90" rx="10" fill="'+C.fundo+'" stroke="'+C.azul+'" stroke-width="2"/><text x="26" y="36" font-size="15" fill="'+C.mudo+'">Garantia</text><text class="lq-gar" x="26" y="66" font-size="20" font-weight="700" fill="'+C.texto+'"></text><text class="lq-gar-usd" x="26" y="88" font-size="13" fill="'+C.mudo+'"></text>'
    +'<rect class="lq-caixa-div" x="330" y="10" width="300" height="90" rx="10" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><text x="346" y="36" font-size="15" fill="'+C.mudo+'">Dívida e HF</text><text class="lq-div" x="346" y="66" font-size="20" font-weight="700" fill="'+C.texto+'"></text><text class="lq-hf" x="346" y="88" font-size="13" fill="'+C.mudo+'"></text>')
   +botoes([['cair','O ETH cai 5%'],['pagar','Pagar 1.000 USDC da dívida'],['recomecar','Recomeçar']])+estado(''),
  /* Dívida em ativo volátil. */
  divida:()=>'<label class="interativo-rotulo">Preço do ETH hoje (US$) <span class="dv-txt"></span><input class="dv-preco" type="range" min="1000" max="4000" step="50" value="2000"></label>'
   +svg(640,90,'<rect x="10" y="10" width="300" height="70" rx="10" fill="'+C.fundo+'" stroke="'+C.azul+'" stroke-width="2"/><text x="26" y="36" font-size="15" fill="'+C.mudo+'">Garantia (estável)</text><text x="26" y="64" font-size="20" font-weight="700" fill="'+C.texto+'">4.000 USDC</text>'
    +'<rect class="dv-caixa" x="330" y="10" width="300" height="70" rx="10" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><text x="346" y="36" font-size="15" fill="'+C.mudo+'">Dívida: 1 ETH, que vale</text><text class="dv-valor" x="346" y="64" font-size="20" font-weight="700" fill="'+C.texto+'"></text>')
   +'<p class="o-info">Health factor: <strong class="dv-hf"></strong></p>'+estado(''),
  /* AMM x·y=k. */
  amm:()=>{
   let pts=[];for(let x=4;x<=20;x+=0.25)pts.push((40+(x-4)*35).toFixed(1)+','+(200-(300000/x-15000)/60000*170).toFixed(1));
   return '<label class="interativo-rotulo">Comprar ETH do pool <span class="am-txt"></span><input class="am-dx" type="range" min="0.1" max="5" step="0.1" value="1"></label>'
    +svg(640,230,linha(40,200,620,200)+linha(40,20,40,200)+'<polyline points="'+pts.join(' ')+'" fill="none" stroke="'+C.violeta+'" stroke-width="3"/>'
     +'<circle class="am-antes" r="7" fill="'+C.mudo+'"/><circle class="am-depois" r="7" fill="'+C.ciano+'"/>'
     +'<text x="620" y="218" text-anchor="end" font-size="12" fill="'+C.mudo+'">ETH no pool →</text><text x="48" y="32" font-size="12" fill="'+C.mudo+'">USDC no pool</text>')
    +'<div class="mt-conta"><p>Você paga <strong class="am-paga"></strong></p><p>Preço médio <strong class="am-medio"></strong></p><p>Impacto no preço <strong class="am-imp"></strong></p><p>Pool depois <strong class="am-pool"></strong></p></div>'+estado('');
  },
  /* Impermanent loss. */
  il:()=>'<label class="interativo-rotulo">O preço do ETH mudou (× do preço de entrada) <span class="il-txt"></span><input class="il-r" type="range" min="0" max="20" step="1" value="10"></label>'
   +svg(640,110,'<text x="10" y="30" font-size="15" fill="'+C.mudo+'">Só guardar</text><rect class="il-barra-hold" x="150" y="12" height="26" rx="4" fill="'+C.azul+'" width="0"/><text class="il-hold" x="160" y="31" font-size="15" fill="'+C.texto+'"></text>'
    +'<text x="10" y="80" font-size="15" fill="'+C.mudo+'">No pool</text><rect class="il-barra-lp" x="150" y="62" height="26" rx="4" fill="'+C.violeta+'" width="0"/><text class="il-lp" x="160" y="81" font-size="15" fill="'+C.texto+'"></text>')
   +'<p class="o-info">Perda em relação a só guardar: <strong class="il-perda"></strong></p>'+estado(''),
  /* APR, APY e o token de recompensa. */
  apy:()=>'<label class="interativo-rotulo">APR anunciado <span class="ap-apr-txt"></span><input class="ap-apr" type="range" min="1" max="100" step="1" value="20"></label>'
   +'<label class="interativo-rotulo">Reinvestimento<select class="hash-entrada ap-n"><option value="1">uma vez por ano</option><option value="12" selected>todo mês</option><option value="365">todo dia</option></select></label>'
   +'<label class="interativo-rotulo">O token da recompensa cai no ano <span class="ap-queda-txt"></span><input class="ap-queda" type="range" min="0" max="90" step="5" value="0"></label>'
   +'<div class="mt-conta"><p>APY (com reinvestimento) <strong class="ap-apy"></strong></p><p>US$ 1.000 viram <strong class="ap-fim"></strong></p><p>Rendimento real <strong class="ap-real"></strong></p></div>'+estado(''),
  /* Loop de alavancagem. */
  loop:()=>'<label class="interativo-rotulo">Quanto do limite você usa a cada volta (LTV) <span class="lp-ltv-txt"></span><input class="lp-ltv" type="range" min="0" max="75" step="5" value="50"></label>'
   +'<label class="interativo-rotulo">Voltas <span class="lp-n-txt"></span><input class="lp-n" type="range" min="0" max="6" step="1" value="3"></label>'
   +'<div class="mt-conta"><p>Exposição em ETH <strong class="lp-exp"></strong></p><p>Dívida <strong class="lp-div"></strong></p><p>Health factor <strong class="lp-hf"></strong></p><p>Liquida se o ETH cair <strong class="lp-queda"></strong></p></div>'+estado(''),
  /* Flash loan. */
  flash:()=>'<label class="interativo-rotulo">Diferença de preço entre duas corretoras <span class="fl-txt"></span><input class="fl-dif" type="range" min="0" max="0.3" step="0.01" value="0.1"></label>'
   +svg(640,90,['Toma 1 milhão','Compra barato','Vende caro','Devolve + 0,05%'].map((t,k)=>{const x=10+k*158;return '<g class="at-passo fl-passo-'+k+'"><rect x="'+x+'" y="10" width="146" height="60" rx="8" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><text x="'+(x+73)+'" y="46" text-anchor="middle" font-size="15" fill="'+C.texto+'">'+t+'</text></g>';}).join(''))
   +'<p class="o-info">Resultado: <strong class="fl-res"></strong></p>'+botoes([['executar','Executar na mesma transação']])+estado(''),
  /* ===== Módulo 7 ===== */
  /* Arbitragem que segura a paridade. */
  paridade:()=>'<label class="interativo-rotulo">Preço da stablecoin no mercado (US$) <span class="pa-txt"></span><input class="pa-preco" type="range" min="0.95" max="1.05" step="0.005" value="0.98"></label>'
   +'<label class="interativo-rotulo ch-op"><span><input type="checkbox" class="pa-resgate" checked> Você tem conta no emissor e pode resgatar a US$ 1</span></label>'
   +svg(640,90,'<line x1="20" y1="45" x2="620" y2="45" stroke="'+C.linha+'" stroke-width="2"/><line x1="320" y1="15" x2="320" y2="75" stroke="'+C.ciano+'" stroke-width="2" stroke-dasharray="4 4"/><text x="320" y="88" text-anchor="middle" font-size="12" fill="'+C.ciano+'">US$ 1,00</text>'
    +'<text x="20" y="88" font-size="12" fill="'+C.mudo+'">0,95</text><text x="620" y="88" text-anchor="end" font-size="12" fill="'+C.mudo+'">1,05</text><circle class="pa-ponto" cy="45" r="10" fill="'+C.ambar+'"/>')
   +'<p class="o-info">Arbitragem com 10.000 tokens: <strong class="pa-lucro"></strong></p>'
   +botoes([['arbitrar','Fazer a arbitragem']])+estado(''),
  /* Reservas sob corrida de resgates. */
  reservas:()=>'<label class="interativo-rotulo">Onde estão as reservas<select class="hash-entrada rs-mix"><option value="0">Dinheiro e títulos curtos do governo</option><option value="1">Metade em empréstimos a empresas</option><option value="2">Um terço em cripto</option></select></label>'
   +'<label class="interativo-rotulo">Pedidos de resgate em um dia (% de todas as moedas) <span class="rs-txt"></span><input class="rs-pedido" type="range" min="0" max="60" step="5" value="20"></label>'
   +svg(640,90,'<rect x="10" y="20" width="620" height="40" rx="8" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><rect class="rs-barra-ok" x="10" y="20" height="40" rx="8" fill="'+C.ciano+'" width="0"/><rect class="rs-barra-falta" y="20" height="40" fill="'+C.verm+'" width="0"/>'
    +'<text x="10" y="80" font-size="12" fill="'+C.mudo+'">pedidos pagos no mesmo dia (ciano) e não pagos (vermelho)</text>')
   +'<div class="mt-conta"><p>Disponível em 1 dia <strong class="rs-disp"></strong></p><p>Pedidos <strong class="rs-ped"></strong></p><p>Falta <strong class="rs-falta"></strong></p></div>'+estado(''),
  /* Stablecoin com garantia em cripto. */
  cdp:()=>'<label class="interativo-rotulo">Stablecoins emitidas contra 2 ETH <span class="cd-div-txt"></span><input class="cd-div" type="range" min="0" max="5000" step="100" value="2000"></label>'
   +'<label class="interativo-rotulo">Preço do ETH (US$) <span class="cd-preco-txt"></span><input class="cd-preco" type="range" min="500" max="5000" step="50" value="3000"></label>'
   +'<div class="mt-conta"><p>Garantia <strong class="cd-gar"></strong></p><p>Garantia ÷ dívida <strong class="cd-razao"></strong></p><p>Liquida se o ETH cair a <strong class="cd-liq"></strong></p></div>'+estado(''),
  /* Espiral de uma stablecoin algorítmica. */
  espiral:()=>svg(640,190,linha(50,160,610,160)+linha(50,20,50,160)
    +'<polyline class="es-linha-st" fill="none" stroke="'+C.ciano+'" stroke-width="3" points=""/><polyline class="es-linha-tk" fill="none" stroke="'+C.verm+'" stroke-width="3" points=""/>'
    +'<text x="58" y="34" font-size="13" fill="'+C.ciano+'">preço da stablecoin</text><text x="58" y="52" font-size="13" fill="'+C.verm+'">quantidade do token irmão</text>'
    +[0,1,2,3,4,5,6].map(k=>'<text x="'+(50+k*93)+'" y="180" text-anchor="middle" font-size="12" fill="'+C.mudo+'">dia '+k+'</text>').join(''))
   +'<div class="mt-conta"><p>Stablecoin <strong class="es-st"></strong></p><p>Token irmão emitido <strong class="es-tk"></strong></p><p>Preço do token irmão <strong class="es-tkp"></strong></p></div>'
   +botoes([['dia','Próximo dia'],['recomecar','Recomeçar']])+estado(''),
  /* Depeg numa pool rasa. */
  depeg:()=>'<label class="interativo-rotulo">Vendas da stablecoin na pool (milhões) <span class="dp-txt"></span><input class="dp-venda" type="range" min="0" max="8" step="0.5" value="0"></label>'
   +'<label class="interativo-rotulo ch-op"><span><input type="checkbox" class="dp-duvida"> Surge dúvida sobre as reservas</span></label>'
   +svg(640,80,'<rect x="10" y="15" width="620" height="34" rx="8" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><rect class="dp-barra" x="10" y="15" height="34" rx="8" fill="'+C.ciano+'" width="620"/><text class="dp-preco" x="320" y="38" text-anchor="middle" font-size="16" font-weight="700" fill="#05080f"></text>'
    +'<text x="10" y="70" font-size="12" fill="'+C.mudo+'">pool com 10 milhões de cada lado</text>')
   +estado(''),
  /* ===== Módulo 8 ===== */
  /* Quem faz o quê num RWA, e o que acontece se falhar. */
  papeisrwa:()=>'<p class="interativo-sub">Clique em cada participante.</p><div class="k-cartoes">'
   +[['Emissor','cria e vende o token'],['Veículo jurídico','empresa que é dona do ativo'],['Custodiante','guarda o ativo de verdade'],['Administrador','cobra, paga e faz a contabilidade'],['Auditor','confere contas e reservas'],['Oráculo','publica o valor na rede']]
    .map(([n,s],k)=>'<button type="button" class="k-cartao" data-k="'+k+'"><strong>'+n+'</strong><small>'+s+'</small></button>').join('')
   +'</div>'+estado('Um token de RWA só vale o que essa cadeia de pessoas e empresas entregar.'),
  /* Renda líquida de um imóvel tokenizado. */
  renda:()=>'<p class="interativo-sub">Imóvel de R$ 2 milhões dividido em 1.000 tokens (exemplo)</p>'
   +'<label class="interativo-rotulo">Aluguel bruto por mês (R$) <span class="rd-alug-txt"></span><input class="rd-alug" type="range" min="5000" max="20000" step="500" value="12000"></label>'
   +'<label class="interativo-rotulo">Meses vazio no ano <span class="rd-vac-txt"></span><input class="rd-vac" type="range" min="0" max="6" step="1" value="1"></label>'
   +'<label class="interativo-rotulo">Despesas por mês: condomínio, IPTU, manutenção (R$) <span class="rd-desp-txt"></span><input class="rd-desp" type="range" min="0" max="6000" step="250" value="2500"></label>'
   +'<label class="interativo-rotulo">Taxa da plataforma (% da renda) <span class="rd-taxa-txt"></span><input class="rd-taxa" type="range" min="0" max="20" step="1" value="10"></label>'
   +'<div class="mt-conta"><p>Bruto no ano <strong class="rd-bruto"></strong></p><p>Líquido no ano <strong class="rd-liq"></strong></p><p>Por token, por mês <strong class="rd-token"></strong></p><p>Rendimento real <strong class="rd-pct"></strong></p></div>'+estado(''),
  /* Token com lista de permitidos (estilo ERC-3643). */
  permissao:()=>'<p class="interativo-sub">Você tem 10 tokens de um fundo. Para quem dá para enviar?</p><div class="k-cartoes">'
   +[['Bruno','identidade verificada'],['Carla','verificada, mas de país não aceito'],['Carteira sem cadastro','endereço qualquer'],['Sua outra carteira','ainda não cadastrada']]
    .map(([n,s],k)=>'<button type="button" class="k-cartao" data-k="'+k+'"><strong>'+n+'</strong><small>'+s+'</small></button>').join('')
   +'</div>'+botoes([['congelar','O emissor congela sua carteira'],['recomecar','Recomeçar']])+estado(''),
  /* Fundo de títulos tokenizado: valor da cota × preço no mercado. */
  navrwa:()=>'<p class="interativo-sub">Você tem 10.000 tokens de um fundo de títulos curtos, com valor de US$ 1,00 cada e rendimento de 5% ao ano (exemplo). É sábado.</p>'
   +'<label class="interativo-rotulo">Desconto de quem compra no mercado agora <span class="nv-txt"></span><input class="nv-desc" type="range" min="0" max="5" step="0.25" value="1"></label>'
   +'<div class="mt-conta"><p>Vender agora no mercado <strong class="nv-agora"></strong></p><p>Resgatar no emissor na segunda <strong class="nv-segunda"></strong></p><p>Diferença <strong class="nv-dif"></strong></p></div>'+estado(''),
  /* ===== Módulo 9 ===== */
  /* Reserva de emergência × cripto num tombo. */
  baldes:()=>'<p class="interativo-sub">Você tem R$ 100 mil. Cenário: a cripto cai 60% e você fica 6 meses sem renda.</p>'
   +'<label class="interativo-rotulo">Quanto está em cripto <span class="bd-cr-txt"></span><input class="bd-cr" type="range" min="0" max="100" step="5" value="80"></label>'
   +'<label class="interativo-rotulo">Seus gastos por mês (R$) <span class="bd-g-txt"></span><input class="bd-g" type="range" min="2000" max="10000" step="500" value="5000"></label>'
   +'<div class="mt-conta"><p>Precisa para 6 meses <strong class="bd-prec"></strong></p><p>Em dinheiro <strong class="bd-caixa"></strong></p><p>Cripto vendida no fundo <strong class="bd-venda"></strong></p><p>Sobra depois <strong class="bd-sobra"></strong></p></div>'+estado(''),
  /* Quanto é preciso subir para recuperar uma queda. */
  recuperacao:()=>'<label class="interativo-rotulo">Queda a partir do topo <span class="rc-txt"></span><input class="rc-q" type="range" min="0" max="90" step="5" value="50"></label>'
   +svg(640,120,'<text x="10" y="32" font-size="15" fill="'+C.mudo+'">Queda</text><rect class="rc-barra-q" x="170" y="14" height="26" rx="4" fill="'+C.verm+'" width="0"/><text class="rc-qv" x="180" y="33" font-size="15" fill="'+C.texto+'"></text>'
    +'<text x="10" y="86" font-size="15" fill="'+C.mudo+'">Alta para voltar</text><rect class="rc-barra-a" x="170" y="68" height="26" rx="4" fill="'+C.ciano+'" width="0"/><text class="rc-av" x="180" y="87" font-size="15" fill="'+C.texto+'"></text>')
   +estado(''),
  /* Exposição escondida: várias posições, o mesmo risco. */
  exposicao:()=>'<p class="interativo-sub">Marque o que está na sua carteira</p><div class="mt-moedas">'
   +[['eth','ETH · R$ 4.000'],['lst','Token de staking de ETH · R$ 3.000'],['pool','Pool ETH/USDC · R$ 2.000'],['usdc','USDC · R$ 1.000'],['btc','BTC · R$ 2.000']].map(([k,t])=>'<label class="mt-moeda"><input type="checkbox" data-k="'+k+'" checked> <span>'+t+'</span></label>').join('')+'</div>'
   +svg(640,130,['Preço do ETH','Emissor do USDC','Contratos de terceiros','Preço do BTC'].map((t,k)=>'<text x="10" y="'+(26+k*30)+'" font-size="14" fill="'+C.mudo+'">'+t+'</text><rect class="ex-barra ex-barra-'+k+'" x="190" y="'+(12+k*30)+'" height="20" rx="4" fill="'+[C.violeta,C.ciano,C.ambar,C.azul][k]+'" width="0"/><text class="ex-v ex-v-'+k+'" x="200" y="'+(27+k*30)+'" font-size="13" fill="'+C.texto+'"></text>').join(''))
   +estado(''),
  /* Tamanho da posição pela perda que você aceita. */
  tamanho:()=>'<p class="interativo-sub">Carteira de R$ 50 mil</p>'
   +'<label class="interativo-rotulo">Perda máxima que você aceita na carteira toda <span class="tm-p-txt"></span><input class="tm-p" type="range" min="1" max="20" step="1" value="5"></label>'
   +'<label class="interativo-rotulo">Queda possível desse ativo num ano ruim <span class="tm-q-txt"></span><input class="tm-q" type="range" min="10" max="95" step="5" value="70"></label>'
   +'<div class="mt-conta"><p>Tamanho máximo da posição <strong class="tm-max"></strong></p><p>Fatia da carteira <strong class="tm-pct"></strong></p></div>'+estado(''),
  /* Rebalanceamento 50/50. */
  rebal:()=>'<p class="interativo-sub">Alvo: metade em BTC, metade em dólar digital. Começou com R$ 10 mil.</p>'
   +'<label class="interativo-rotulo">O BTC variou <span class="rb2-txt"></span><input class="rb2-var" type="range" min="-60" max="200" step="10" value="100"></label>'
   +svg(640,80,'<rect x="10" y="20" width="620" height="34" rx="8" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/><rect class="rb2-btc" x="10" y="20" height="34" rx="8" fill="'+C.ambar+'" width="310"/><line x1="320" y1="12" x2="320" y2="62" stroke="'+C.texto+'" stroke-width="2" stroke-dasharray="4 4"/><text x="320" y="76" text-anchor="middle" font-size="12" fill="'+C.mudo+'">alvo 50%</text>')
   +'<div class="mt-conta"><p>BTC agora <strong class="rb2-pbtc"></strong></p><p>Total <strong class="rb2-tot"></strong></p><p>Para voltar ao alvo <strong class="rb2-acao"></strong></p></div>'+estado(''),
  /* Aporte mensal × tudo de uma vez. */
  dca:()=>'<label class="interativo-rotulo">Cenário de preço em 6 meses<select class="hash-entrada dc-cen"><option value="0">Sobe sem parar</option><option value="1" selected>Cai e volta</option><option value="2">Só cai</option></select></label>'
   +svg(640,140,linha(40,120,620,120)+'<polyline class="dc-linha" fill="none" stroke="'+C.violeta+'" stroke-width="3" points=""/>'+[0,1,2,3,4,5].map(k=>'<circle class="dc-p dc-p-'+k+'" r="6" fill="'+C.ciano+'"/><text x="'+(70+k*105)+'" y="136" text-anchor="middle" font-size="12" fill="'+C.mudo+'">mês '+(k+1)+'</text>').join(''))
   +'<div class="mt-conta"><p>R$ 100 por mês: preço médio <strong class="dc-medio"></strong></p><p>Aportes no fim <strong class="dc-fim-dca"></strong></p><p>R$ 600 no mês 1 <strong class="dc-fim-tudo"></strong></p></div>'+estado(''),
  /* ===== Módulo 10 ===== */
  /* Balanço de um banco: empréstimo cria depósito. */
  balanco:()=>svg(640,160,'<rect x="10" y="10" width="300" height="140" rx="10" fill="'+C.fundo+'" stroke="'+C.azul+'" stroke-width="2"/><text x="26" y="36" font-size="16" font-weight="700" fill="'+C.texto+'">O banco tem (ativos)</text>'
    +'<text class="bl-res" x="26" y="70" font-size="15" fill="'+C.mudo+'"></text><text class="bl-emp" x="26" y="98" font-size="15" fill="'+C.mudo+'"></text>'
    +'<rect x="330" y="10" width="300" height="140" rx="10" fill="'+C.fundo+'" stroke="'+C.violeta+'" stroke-width="2"/><text x="346" y="36" font-size="16" font-weight="700" fill="'+C.texto+'">O banco deve (passivos)</text>'
    +'<text class="bl-dep" x="346" y="70" font-size="15" fill="'+C.mudo+'"></text><text class="bl-cap" x="346" y="98" font-size="15" fill="'+C.mudo+'"></text>')
   +botoes([['emprestar','Banco empresta R$ 1.000 à Ana'],['corrida','30% dos clientes pedem saque'],['recomecar','Recomeçar']])+estado(''),
  /* Remessa de US$ 500 por três caminhos. Custos de exemplo. */
  remessa:()=>'<p class="interativo-sub">Mandar US$ 500 para outro país. Custos de exemplo.</p>'
   +svg(640,150,[['Banco','tarifa fixa + câmbio caro'],['Empresa de remessa','tarifa menor + câmbio'],['Stablecoin','compra + rede + saque']].map(([t,s],k)=>'<text x="10" y="'+(30+k*46)+'" font-size="15" font-weight="700" fill="'+C.texto+'">'+t+'</text><text x="10" y="'+(48+k*46)+'" font-size="12" fill="'+C.mudo+'">'+s+'</text><rect class="rm-barra rm-barra-'+k+'" x="230" y="'+(16+k*46)+'" height="26" rx="4" fill="'+[C.azul,C.violeta,C.ciano][k]+'" width="0"/><text class="rm-v rm-v-'+k+'" x="240" y="'+(35+k*46)+'" font-size="14" fill="'+C.texto+'"></text>').join(''))
   +'<label class="interativo-rotulo">Diferença de câmbio na saída da stablecoin (no país de destino) <span class="rm-txt"></span><input class="rm-saida" type="range" min="0" max="8" step="0.5" value="1.5"></label>'+estado(''),
  /* Entrega contra pagamento. */
  dvp:()=>'<div class="c-cenarios"><button class="btn small" type="button" data-acao="separado" aria-pressed="true">Entrega e pagamento separados</button><button class="btn small" type="button" data-acao="atomico" aria-pressed="false">Entrega contra pagamento (DvP)</button></div>'
   +svg(640,110,'<rect x="10" y="10" width="300" height="90" rx="10" fill="'+C.fundo+'" stroke="'+C.azul+'" stroke-width="2"/><text x="26" y="38" font-size="16" font-weight="700" fill="'+C.texto+'">Ana (vende)</text><text class="dv2-ana" x="26" y="72" font-size="15" fill="'+C.mudo+'"></text>'
    +'<rect x="330" y="10" width="300" height="90" rx="10" fill="'+C.fundo+'" stroke="'+C.violeta+'" stroke-width="2"/><text x="346" y="38" font-size="16" font-weight="700" fill="'+C.texto+'">Bruno (compra)</text><text class="dv2-bruno" x="346" y="72" font-size="15" fill="'+C.mudo+'"></text>')
   +botoes([['ok','Fazer a operação'],['quebra','Fazer, mas Bruno quebra no meio']])+estado(''),
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
  /* ===== Módulo 4 ===== */
  gastoduplo(fig){
   passos(fig,[
    'Alice tem uma moeda (UTXO #7) de 1 BTC e assina duas transações que gastam essa mesma moeda: uma para Bruno, outra para Caio.',
    'As duas chegam à rede. Cada nó guarda na fila só a primeira que viu e recusa a outra, porque gasta uma moeda que já tem dono na fila.',
    'Um minerador inclui a tx A num bloco, e os nós conferem e aceitam o bloco.',
    'Agora a moeda #7 está gasta na história. A tx B ficou inválida para todos os nós: não existe mais moeda para gastar. Bruno, que esperou a confirmação, está seguro.'
   ]);
  },
  montartx(fig){
   const r=$(fig,'.mt-taxa'),pag=3e7,sat=v=>fmt(v/1e8,8);
   const atualizar=()=>{
    const ent=$$(fig,'.mt-moeda input').filter(i=>i.checked).map(i=>Number(i.dataset.sats));
    const soma=ent.reduce((a,b)=>a+b,0),taxa=Number(r.value),vb=11+68*ent.length+31*2,fee=vb*taxa,troco=soma-pag-fee;
    $(fig,'.mt-taxa-txt').textContent=String(taxa);
    $(fig,'.mt-ent').textContent=sat(soma)+' ('+ent.length+' moeda'+(ent.length===1?'':'s')+')';
    $(fig,'.mt-vb').textContent='≈ '+vb+' vB';$(fig,'.mt-fee').textContent=fee.toLocaleString('pt-BR')+' sat';
    $(fig,'.mt-troco').textContent=troco>=0?sat(troco):'—';
    fig.classList.toggle('mt-falta',troco<0);
    $(fig,'.cena-estado').textContent=!ent.length?'Escolha ao menos uma moeda.':troco<0?'Não fecha: as moedas escolhidas não cobrem o pagamento mais a taxa.':'Fecha. Cada moeda a mais aumenta o tamanho da transação, e a taxa é cobrada por tamanho, não por valor. Tamanhos aproximados de exemplo.';
   };
   $$(fig,'.mt-moeda input').forEach(i=>i.addEventListener('change',atualizar));r.addEventListener('input',atualizar);atualizar();
  },
  endereco(fig){
   const ent=$(fig,'.en-texto'),tipo=$(fig,'.en-tipo'),est=$(fig,'.cena-estado');
   const tipos=[
    [/^1[1-9A-HJ-NP-Za-km-z]{25,34}$/,'Legado (P2PKH), começa com 1','O formato original. Funciona, mas costuma pagar mais taxa por ocupar mais espaço.'],
    [/^3[1-9A-HJ-NP-Za-km-z]{25,34}$/,'Script (P2SH), começa com 3','Muito usado para multisig e para carteiras de transição.'],
    [/^bc1q[02-9ac-hj-np-z]{38,58}$/i,'SegWit (P2WPKH), começa com bc1q','Mais eficiente, geralmente com taxa menor.'],
    [/^bc1p[02-9ac-hj-np-z]{58}$/i,'Taproot (P2TR), começa com bc1p','O formato mais novo, de 2021, com mais privacidade para scripts complexos.'],
    [/^(tb1|[mn2])/,'Endereço de rede de teste','Moedas de teste não valem nada. Não envie bitcoin de verdade para cá.'],
    [/^0x[0-9a-fA-F]{40}$/,'Isto não é um endereço de Bitcoin','É um endereço de Ethereum e redes parecidas. Enviar bitcoin para cá não funciona.']];
   const ver=()=>{
    const v=ent.value.trim();
    if(!v){tipo.textContent='';est.textContent='Escolha um exemplo ou cole um endereço. A conferência aqui é só pelo formato; a carteira também confere a soma de verificação.';fig.classList.remove('en-ok','en-ruim');return;}
    const t=tipos.find(([re])=>re.test(v));
    tipo.textContent=t?t[1]:'Formato não reconhecido';est.textContent=t?t[2]:'Confira se copiou o endereço inteiro, sem espaços.';
    fig.classList.toggle('en-ok',!!t&&tipos.indexOf(t)<4);fig.classList.toggle('en-ruim',!t||tipos.indexOf(t)>=4);
   };
   $$(fig,'[data-exemplo]').forEach(b=>b.addEventListener('click',()=>{ent.value=b.dataset.exemplo;ver();}));
   ent.addEventListener('input',ver);ver();
  },
  halving(fig){
   const r=$(fig,'.hv-era-in');
   const atualizar=()=>{
    const k=Number(r.value),sub=50/Math.pow(2,k),tot=21e6*(1-Math.pow(2,-(k+1)));
    $(fig,'.hv-txt').textContent=(k+1)+'ª';$(fig,'.hv-sub').textContent=fmt(sub,sub<1?8:3).replace(/,?0+$/,'')+' BTC';
    $(fig,'.hv-tot').textContent=fmt(tot/1e6,2)+' milhões ('+fmt(tot/21e6*100,1)+'%)';
    $$(fig,'.hv-era').forEach((g,j)=>g.classList.toggle('feita',j<=k));
    $(fig,'.cena-estado').textContent=k===4?'É a era atual: desde abril de 2024, cada bloco cria 3,125 BTC novos.':k<4?'Era já encerrada. A recompensa era maior, e boa parte dos 21 milhões saiu nessas primeiras eras.':'Era futura. A recompensa continua caindo à metade; as últimas frações de bitcoin saem por volta de 2140.';
   };
   r.addEventListener('input',atualizar);atualizar();
  },
  regrasbtc(fig){
   const r=$(fig,'.rb-valor'),LIM=3.325;
   const atualizar=()=>{
    const v=Number(r.value),ok=v<=LIM+1e-9;
    $(fig,'.rb-txt').textContent=fmt(v,3)+' BTC';
    $$(fig,'.rb-res').forEach(t=>{t.textContent=ok?'✓ aceita':'✗ recusa';});
    fig.classList.toggle('rb-recusado',!ok);
    $(fig,'.cena-estado').textContent=ok?'Dentro da regra: os nós aceitam o bloco e o minerador recebe. (Pegar menos que o permitido também é válido.)':'Acima da regra: todo nó honesto recusa o bloco. O minerador gastou energia e não ganha nada.';
   };
   r.addEventListener('input',atualizar);atualizar();
  },
  acelerar(fig){
   const VB=140;let pai=2,filho=0,corte=12,est=$(fig,'.cena-estado');
   const mostrar=t=>{
    $(fig,'.ac-pai-txt').textContent=pai+' sat/vB · '+(pai*VB).toLocaleString('pt-BR')+' sat';
    fig.classList.toggle('ac-com-filho',filho>0);
    $(fig,'.ac-filho-txt').textContent=filho?filho.toLocaleString('pt-BR')+' sat de taxa':'';
    const media=filho?(pai*VB+filho)/(VB+110):pai,entra=media>corte;
    fig.classList.toggle('ac-entra',entra);
    est.textContent=t+(entra?' Agora entra no próximo bloco.':' Ainda fica na fila.');
   };
   acao(fig,'esperar',()=>{corte=Math.max(1,corte-5);$(fig,'svg text').textContent='Para entrar no próximo bloco hoje: acima de '+corte+' sat/vB';mostrar('A demanda caiu e o corte baixou para '+corte+' sat/vB.');});
   acao(fig,'rbf',()=>{pai=15;filho=0;mostrar('A carteira manda uma nova versão da mesma transação, gastando as mesmas moedas, com taxa maior (15 sat/vB). A substituta precisa pagar mais taxa total que a original.');});
   acao(fig,'cpfp',()=>{filho=Math.ceil((corte+1)*(VB+110)-pai*VB);mostrar('Você gasta o troco numa transação filha com taxa alta. O minerador só leva a filha se levar a mãe junto, então avalia a taxa média das duas.');});
   acao(fig,'recomecar',()=>{pai=2;filho=0;corte=12;$(fig,'svg text').textContent='Para entrar no próximo bloco hoje: acima de 12 sat/vB';mostrar('Sua transação pagou 2 sat/vB e travou.');});
   mostrar('Sua transação pagou 2 sat/vB e travou.');
  },
  canal(fig){
   const CAP=100000;let ana=CAP,pags=0,fechado=false,est=$(fig,'.cena-estado');
   const mostrar=t=>{
    const w=Math.round(ana/CAP*620);
    $(fig,'.cn-ana').setAttribute('width',String(Math.max(0,w)));$(fig,'.cn-div').setAttribute('x1',String(10+w));$(fig,'.cn-div').setAttribute('x2',String(10+w));
    $(fig,'.cn-ana-txt').textContent=ana.toLocaleString('pt-BR')+' sat';$(fig,'.cn-bruno-txt').textContent=(CAP-ana).toLocaleString('pt-BR')+' sat';
    $(fig,'.cn-cont').textContent='Na blockchain: '+(fechado?'2 transações':'1 transação')+' · fora dela: '+pags+' pagamento'+(pags===1?'':'s');
    ['ana','bruno','fechar'].forEach(a=>{$(fig,'[data-acao="'+a+'"]').disabled=fechado;});
    fig.classList.toggle('cn-fechado',fechado);est.textContent=t;
   };
   acao(fig,'ana',()=>{if(ana<10000){mostrar('Ana não tem saldo suficiente do lado dela do canal.');return;}ana-=10000;pags++;mostrar('Pagamento instantâneo: os dois assinam um novo retrato do saldo. Nada vai para a blockchain.');});
   acao(fig,'bruno',()=>{if(CAP-ana<5000){mostrar('Bruno ainda não tem saldo do lado dele.');return;}ana+=5000;pags++;mostrar('O dinheiro volta pelo mesmo canal. Só o retrato mais recente vale.');});
   acao(fig,'fechar',()=>{fechado=true;mostrar('Canal fechado: uma transação na blockchain registra o saldo final. '+pags+' pagamentos custaram só 2 transações na rede.');});
   acao(fig,'recomecar',()=>{ana=CAP;pags=0;fechado=false;mostrar('Ana abriu um canal com Bruno travando 100.000 sat numa transação na blockchain.');});
   mostrar('Ana abriu um canal com Bruno travando 100.000 sat numa transação na blockchain.');
  },
  /* ===== Módulo 5 ===== */
  cofre(fig){
   let ana=0,bruno=2,ev=[];const est=$(fig,'.cena-estado');
   const eth=v=>fmt(v,1)+' ETH';
   const mostrar=t=>{
    $(fig,'.cf-ana').textContent='saldo[Ana] = '+eth(ana);$(fig,'.cf-bruno').textContent='saldo[Bruno] = '+eth(bruno);$(fig,'.cf-total').textContent='total guardado = '+eth(ana+bruno);
    $$(fig,'.cf-ev').forEach((e,k)=>{e.textContent=ev[k]||'';});est.textContent=t;
   };
   const log=t=>{ev=[t,...ev].slice(0,4);};
   acao(fig,'depAna',()=>{ana+=1;log('Depósito(Ana, 1 ETH)');mostrar('A regra "depositar" somou 1 ETH ao saldo da Ana e registrou um evento.');});
   acao(fig,'saqAna',()=>{if(ana<0.5){fig.classList.add('cf-reverteu');mostrar('Revertido: a regra exige saldo[Ana] ≥ 0,5. Nada mudou no estado, e a taxa da tentativa foi paga.');return;}fig.classList.remove('cf-reverteu');ana-=0.5;log('Saque(Ana, 0,5 ETH)');mostrar('A regra conferiu o saldo, descontou 0,5 e enviou o ETH à Ana.');});
   acao(fig,'saqBruno',()=>{if(bruno>=1){bruno-=1;log('Saque(Bruno, 1 ETH)');fig.classList.remove('cf-reverteu');mostrar('Bruno tinha saldo: o contrato descontou e enviou.');return;}fig.classList.add('cf-reverteu');mostrar('Revertido: saldo[Bruno] é menor que 1 ETH. Ninguém, nem o criador do contrato, consegue furar essa regra.');});
   acao(fig,'recomecar',()=>{ana=0;bruno=2;ev=[];fig.classList.remove('cf-reverteu');mostrar('Um cofre simples: cada um só saca o que depositou. Bruno já tem 2 ETH lá.');});
   mostrar('Um cofre simples: cada um só saca o que depositou. Bruno já tem 2 ETH lá.');
  },
  chamada(fig){
   const ok=$(fig,'.ch-saldo');let i=0;const est=$(fig,'.cena-estado');
   const T=[
    ['O site monta a chamada: contrato, função "depositar" e valor. Ele só prepara; não tem poder sobre seu dinheiro.','O site monta a chamada: contrato, função "depositar" e valor.'],
    ['A carteira mostra o que será assinado. Você confere rede, contrato e valor, e assina.','A carteira mostra o que será assinado. Você assina e paga a taxa.'],
    ['O contrato roda na rede e confere as regras: tem saldo? o valor é válido? Tudo certo.','O contrato confere as regras e encontra um problema: falta saldo. Ele reverte.'],
    ['O estado muda: o saldo registrado no contrato aumenta. Isso fica gravado na blockchain.','Nada muda no estado: o revert desfaz tudo. Mas a taxa foi paga, porque a rede trabalhou.'],
    ['O contrato emite um evento. É assim que o site e o explorador ficam sabendo do que aconteceu.','Sem evento de sucesso. A carteira mostra "falhou" e o explorador marca a transação como revertida.']];
   const mostrar=()=>{const b=ok.checked?0:1;
    $$(fig,'.t-etapa').forEach((g,k)=>{g.classList.toggle('feito',k<i);g.classList.toggle('atual',k===i);g.classList.toggle('falhou',!ok.checked&&k>=2&&k<=i);});
    $(fig,'.ch-rot-3').textContent=ok.checked?'Estado':'Reverte';
    est.textContent=(i+1)+' de 5 · '+T[i][b];$(fig,'[data-acao="anterior"]').disabled=i===0;$(fig,'[data-acao="proximo"]').disabled=i===4;};
   acao(fig,'anterior',()=>{i=Math.max(0,i-1);mostrar();});acao(fig,'proximo',()=>{i=Math.min(4,i+1);mostrar();});acao(fig,'recomecar',()=>{i=0;mostrar();});
   ok.addEventListener('change',mostrar);mostrar();
  },
  gascalc(fig){
   const op=$(fig,'.gc-op'),b=$(fig,'.gc-base'),t=$(fig,'.gc-tip'),e=$(fig,'.gc-eth');
   const atualizar=()=>{
    const gas=Number(op.value),base=Number(b.value),tip=Number(t.value),preco=Number(e.value);
    const total=gas*(base+tip)/1e9,queima=gas*base/1e9,val=gas*tip/1e9;
    $(fig,'.gc-base-txt').textContent=String(base);$(fig,'.gc-tip-txt').textContent=fmt(tip,1);$(fig,'.gc-eth-txt').textContent=fmt(preco,0);
    $(fig,'.gc-total').textContent=fmt(total,6)+' ETH';$(fig,'.gc-usd').textContent='US$ '+fmt(total*preco);
    $(fig,'.gc-queima').textContent=fmt(queima,6)+' ETH';$(fig,'.gc-val').textContent=fmt(val,6)+' ETH';
    $(fig,'.cena-estado').textContent='Custo = gas usado × (taxa base + gorjeta). 1 gwei = 0,000000001 ETH. O valor enviado não entra na conta.';
   };
   [op,b,t,e].forEach(x=>x.addEventListener(x===op?'change':'input',atualizar));atualizar();
  },
  atomico(fig){
   const mov=$(fig,'.at-mov'),tol=$(fig,'.at-tol');let feito=false;
   const atualizar=(rodar=false)=>{
    const m=Number(mov.value),tl=Number(tol.value);$(fig,'.at-mov-txt').textContent=fmt(m,1)+'%';$(fig,'.at-tol-txt').textContent=fmt(tl,1)+'%';
    if(!rodar){feito=false;$$(fig,'.at-passo').forEach(g=>g.classList.remove('feito','falhou'));$(fig,'.at-saldo').textContent='100 USDC e 0 ETH';$(fig,'.cena-estado').textContent='Você troca 100 USDC por ETH. A troca roda em passos, mas a rede trata tudo como uma coisa só.';return;}
    const ok=m<=tl,eth=0.0333*(1-m/100);feito=true;
    $$(fig,'.at-passo').forEach((g,k)=>{g.classList.toggle('feito',ok||k<2);g.classList.toggle('falhou',!ok&&k===2);});
    $(fig,'.at-saldo').textContent=ok?'0 USDC e '+fmt(eth,4)+' ETH':'100 USDC e 0 ETH (menos a taxa da rede)';
    $(fig,'.cena-estado').textContent=ok?'Deu certo: o preço andou '+fmt(m,1)+'%, dentro do que você aceitou.':'Revertida: o preço andou '+fmt(m,1)+'%, mais que os '+fmt(tl,1)+'% aceitos. O passo 3 falhou e a rede desfez também o passo 1: seus USDC voltaram. Só a taxa foi paga.';
   };
   [mov,tol].forEach(x=>x.addEventListener('input',()=>atualizar()));
   acao(fig,'executar',()=>atualizar(true));acao(fig,'recomecar',()=>{mov.value='0.5';tol.value='1';atualizar();});
   atualizar();
  },
  reentrancia(fig){
   let falha=true,cofre=11,at=0;const pilha=$(fig,'.re-pilha'),doc=fig.ownerDocument,est=$(fig,'.cena-estado');
   const mostrar=()=>{$(fig,'.re-cofre').textContent=cofre+' ETH';$(fig,'.re-at').textContent=at+' ETH';
    $$(fig,'.c-cenarios .btn').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.acao==='falha')===falha)));fig.classList.toggle('re-roubado',at>1);};
   const linha=t=>{const li=doc.createElement('li');li.textContent=t;pilha.append(li);};
   const zerar=t=>{cofre=11;at=0;pilha.replaceChildren();mostrar();est.textContent=t||'O cofre tem 11 ETH: 10 de outras pessoas e 1 do atacante, que é um contrato.';};
   acao(fig,'falha',()=>{falha=true;zerar();});acao(fig,'corrigida',()=>{falha=false;zerar();});
   acao(fig,'atacar',()=>{
    zerar('');let rodada=0;
    if(falha){
     while(cofre>0&&rodada<11){rodada++;linha('saque() confere: saldo do atacante = 1 ETH ✓ → envia 1 ETH'+(cofre>1?' → o atacante chama saque() de novo antes do saldo zerar':''));cofre--;at++;}
     linha('só agora o cofre zera o saldo do atacante… tarde demais');
     est.textContent='O cofre envia o ETH antes de anotar o saque. O atacante, ao receber, chama saque() de novo, e o saldo dele ainda aparece como 1. Assim levou os 11 ETH.';
    }else{
     linha('saque() confere: saldo = 1 ETH ✓ → zera o saldo → envia 1 ETH');cofre--;at++;
     linha('o atacante chama saque() de novo → confere: saldo = 0 ✗ → reverte');
     est.textContent='Na versão corrigida, o cofre anota antes de enviar (conferir, atualizar, interagir). A segunda chamada encontra saldo zero e falha.';
    }
    mostrar();
   });
   acao(fig,'recomecar',()=>zerar());zerar();
  },
  proxy(fig){
   let horas=null,v=1,fundos=100,fora=false;const tl=$(fig,'.px-timelock'),est=$(fig,'.cena-estado');
   const mostrar=t=>{
    $(fig,'.px-versao').textContent='Versão '+v;$(fig,'.px-regra').textContent=v===1?'saque livre':'saque cobra 50% de taxa';fig.classList.toggle('px-v2',v===2);
    $(fig,'.px-fundos').textContent=fora?fundos+' USDC na sua carteira':fundos+' USDC no protocolo';
    $(fig,'.px-relogio').textContent=horas===null?'nenhuma atualização pendente':v===2?'versão 2 em vigor':'versão 2 entra em '+(48-horas)+' h';
    $(fig,'[data-acao="sacar"]').disabled=fora;$(fig,'[data-acao="propor"]').disabled=horas!==null;$(fig,'[data-acao="passar"]').disabled=horas===null||v===2;
    est.textContent=t;
   };
   const ativar=()=>{v=2;};
   acao(fig,'propor',()=>{horas=0;if(!tl.checked){ativar();mostrar('Sem prazo de espera: a versão 2 entrou na hora. O endereço é o mesmo, mas as regras mudaram antes que você pudesse reagir.');return;}mostrar('O admin propôs a versão 2. Com o timelock, ela só entra em 48 h, e todo mundo pode ver a proposta.');});
   acao(fig,'passar',()=>{horas=Math.min(48,horas+24);if(horas>=48){ativar();mostrar(fora?'A versão 2 entrou, mas você já tinha saído.':'A versão 2 entrou. Quem ficou paga 50% para sacar.');return;}mostrar('Faltam '+(48-horas)+' h. Ainda dá para sair pelas regras da versão 1.');});
   acao(fig,'sacar',()=>{fora=true;if(v===2){fundos=fundos/2;mostrar('Você sacou pelas regras novas e recebeu metade.');return;}mostrar('Você saiu antes da mudança, com tudo.');});
   acao(fig,'recomecar',()=>{horas=null;v=1;fundos=100;fora=false;mostrar('Você depositou 100 USDC num protocolo atualizável.');});
   tl.addEventListener('change',()=>{horas=null;v=1;fundos=100;fora=false;mostrar(tl.checked?'Com timelock: mudanças esperam 48 h.':'Sem timelock: o admin troca as regras na hora.');});
   mostrar('Você depositou 100 USDC num protocolo atualizável.');
  },
  /* ===== Módulo 6 ===== */
  utilizacao(fig){
   const r=$(fig,'.ut-u');
   const atualizar=()=>{
    const u=Number(r.value)/100,j=AcademyInterativos.juros(u);
    $(fig,'.ut-txt').textContent=fmt(u*100,0)+'%';$(fig,'.ut-tomar').textContent=fmt(j.tomar*100,1)+'% ao ano';$(fig,'.ut-fornecer').textContent=fmt(j.fornecer*100,1)+'% ao ano';
    $(fig,'.ut-livre').textContent=fmt((1-u)*1e6,0)+' USDC';
    $(fig,'.ut-ponto').setAttribute('cx',(50+u*560).toFixed(1));$(fig,'.ut-ponto').setAttribute('cy',(190-j.tomar*170/0.79).toFixed(1));
    $(fig,'.cena-estado').textContent=u>0.8?'Acima de 80% os juros disparam: o pool quer atrair depósitos e frear empréstimos, porque está faltando dinheiro para saque.':'Abaixo do "joelho", os juros sobem devagar. Quem fornece ganha menos que quem toma paga: parte fica de reserva e só o dinheiro emprestado rende. Parâmetros de exemplo, num pool de 1 milhão de USDC.';
   };
   r.addEventListener('input',atualizar);atualizar();
  },
  hf(fig){
   const q=$(fig,'.hf-qtd'),p=$(fig,'.hf-preco'),dv=$(fig,'.hf-div'),LT=0.8,LTV=0.75;
   const atualizar=()=>{
    const qtd=Number(q.value),preco=Number(p.value),div=Number(dv.value),gar=qtd*preco,hf=div?gar*LT/div:Infinity;
    $(fig,'.hf-qtd-txt').textContent=fmt(qtd,1)+' ETH';$(fig,'.hf-preco-txt').textContent='US$ '+fmt(preco,0);$(fig,'.hf-div-txt').textContent=fmt(div,0);
    $(fig,'.hf-valor').textContent=div?fmt(hf,2):'sem dívida';$(fig,'.hf-cap').textContent=fmt(gar*LTV,0)+' USDC';
    $(fig,'.hf-liq').textContent=div?'US$ '+fmt(div/(qtd*LT),0):'—';
    $(fig,'.hf-barra').setAttribute('width',String(Math.round(Math.min(3,div?hf:3)/3*620)));
    fig.classList.toggle('hf-perigo',hf<1.2);fig.classList.toggle('hf-liquidavel',hf<1);
    $(fig,'.cena-estado').textContent=!div?'Sem dívida, não há o que liquidar.':hf<1?'HF abaixo de 1: qualquer pessoa pode liquidar parte da posição agora.':hf<1.2?'Margem apertada: uma queda pequena do ETH leva à liquidação.':div>gar*LTV?'Você está acima do limite para tomar mais (LTV), mas ainda não no ponto de liquidação.':'Posição saudável. Limiar de liquidação de exemplo: 80%; limite para tomar: 75%.';
   };
   [q,p,dv].forEach(x=>x.addEventListener('input',atualizar));atualizar();
  },
  liquidacao(fig){
   let eth=2,preco=3000,div=4000;const LT=0.8,BONUS=0.05,est=$(fig,'.cena-estado');
   const hf=()=>eth*preco*LT/div;
   const mostrar=t=>{
    $(fig,'.lq-gar').textContent=fmt(eth,4)+' ETH';$(fig,'.lq-gar-usd').textContent='a US$ '+fmt(preco,0)+' = US$ '+fmt(eth*preco,0);
    $(fig,'.lq-div').textContent=fmt(div,0)+' USDC';$(fig,'.lq-hf').textContent='HF '+(div?fmt(hf(),2):'—');
    fig.classList.toggle('hf-liquidavel',div>0&&hf()<1);est.textContent=t;
   };
   acao(fig,'cair',()=>{preco=Math.round(preco*0.95);
    if(div>0&&hf()<1){const fator=hf()>0.95?0.5:1,paga=div*fator,leva=paga*(1+BONUS)/preco;div-=paga;eth=Math.max(0,eth-leva);
     mostrar('Liquidada! HF caiu abaixo de 1. Um liquidante pagou '+fmt(paga,0)+' USDC da sua dívida e levou '+fmt(leva,4)+' ETH, '+(BONUS*100)+'% a mais que o valor pago (bônus de exemplo). Você perdeu esse bônus.');return;}
    mostrar('O ETH caiu para US$ '+fmt(preco,0)+'. HF '+fmt(hf(),2)+'.');});
   acao(fig,'pagar',()=>{if(div<=0)return;div=Math.max(0,div-1000);mostrar(div?'Pagar parte da dívida sobe o HF e afasta a liquidação. HF '+fmt(hf(),2)+'.':'Dívida quitada: a garantia está livre.');});
   acao(fig,'recomecar',()=>{eth=2;preco=3000;div=4000;mostrar('2 ETH de garantia a US$ 3.000 e 4.000 USDC de dívida. Limiar de 80%: HF 1,20.');});
   mostrar('2 ETH de garantia a US$ 3.000 e 4.000 USDC de dívida. Limiar de 80%: HF 1,20.');
  },
  divida(fig){
   const r=$(fig,'.dv-preco');
   const atualizar=()=>{
    const p=Number(r.value),hf=4000*0.8/p;
    $(fig,'.dv-txt').textContent='US$ '+fmt(p,0);$(fig,'.dv-valor').textContent='US$ '+fmt(p,0);$(fig,'.dv-hf').textContent=fmt(hf,2);
    fig.classList.toggle('hf-liquidavel',hf<1);
    $(fig,'.cena-estado').textContent=hf<1?'Liquidável: a garantia não mudou, mas a dívida ficou cara demais. Você deve 1 ETH, e 1 ETH passou a valer mais de US$ 3.200.':p>2000?'Você pegou 1 ETH quando valia US$ 2.000. Ele subiu, então você deve mais em dólar sem ter pegado nada a mais.':'Com o ETH mais barato, a dívida em dólar diminui. Garantia estável não elimina o risco da dívida volátil.';
   };
   r.addEventListener('input',atualizar);atualizar();
  },
  amm(fig){
   const r=$(fig,'.am-dx'),X=10,Y=30000,K=X*Y,FEE=0.003;
   const pos=(x,y)=>[(40+(x-4)*35).toFixed(1),(200-(y-15000)/60000*170).toFixed(1)];
   const atualizar=()=>{
    const dx=Number(r.value),x2=X-dx,y2=K/x2,paga=(y2-Y)/(1-FEE),medio=paga/dx,imp=(medio/(Y/X)-1)*100;
    $(fig,'.am-txt').textContent=fmt(dx,1)+' ETH';$(fig,'.am-paga').textContent=fmt(paga,0)+' USDC';$(fig,'.am-medio').textContent='US$ '+fmt(medio,0);
    $(fig,'.am-imp').textContent='+'+fmt(imp,1)+'%';$(fig,'.am-pool').textContent=fmt(x2,1)+' ETH e '+fmt(Y+paga,0)+' USDC';
    const [ax,ay]=pos(X,Y),[bx,by]=pos(x2,y2);$(fig,'.am-antes').setAttribute('cx',ax);$(fig,'.am-antes').setAttribute('cy',ay);$(fig,'.am-depois').setAttribute('cx',bx);$(fig,'.am-depois').setAttribute('cy',by);
    $(fig,'.cena-estado').textContent='O pool começa com 10 ETH e 30.000 USDC (preço US$ 3.000). A regra x·y = k mantém o produto fixo: quanto mais ETH você tira, mais caro fica cada um. Inclui a taxa de 0,3%.';
   };
   r.addEventListener('input',atualizar);atualizar();
  },
  il(fig){
   const r=$(fig,'.il-r'),passos=[0.2,0.25,0.33,0.4,0.5,0.6,0.67,0.75,0.8,0.9,1,1.25,1.5,1.75,2,2.5,3,3.5,4,4.5,5];
   const atualizar=()=>{
    const k=passos[Number(r.value)],hold=1000+1000*k,lp=2000*Math.sqrt(k),perda=(lp/hold-1)*100,max=6000;
    $(fig,'.il-txt').textContent=fmt(k,2).replace(/,?0+$/,'')+'×';
    $(fig,'.il-barra-hold').setAttribute('width',String(Math.round(hold/max*300)));$(fig,'.il-barra-lp').setAttribute('width',String(Math.round(lp/max*300)));
    $(fig,'.il-hold').setAttribute('x',String(160+Math.round(hold/max*300)));$(fig,'.il-lp').setAttribute('x',String(160+Math.round(lp/max*300)));
    $(fig,'.il-hold').textContent='US$ '+fmt(hold,0);$(fig,'.il-lp').textContent='US$ '+fmt(lp,0);$(fig,'.il-perda').textContent=fmt(perda,1)+'%';
    $(fig,'.cena-estado').textContent=k===1?'Preço igual ao da entrada: sem perda.':'Você entrou com US$ 1.000 em ETH e US$ 1.000 em USDC. O pool vende o que sobe e compra o que cai, então você fica com menos do ativo que valorizou. Só as taxas da pool podem compensar. Não conta as taxas.';
   };
   r.addEventListener('input',atualizar);atualizar();
  },
  apy(fig){
   const a=$(fig,'.ap-apr'),n=$(fig,'.ap-n'),q=$(fig,'.ap-queda');
   const atualizar=()=>{
    const apr=Number(a.value)/100,nn=Number(n.value),queda=Number(q.value)/100,apy=Math.pow(1+apr/nn,nn)-1,real=apy*(1-queda);
    $(fig,'.ap-apr-txt').textContent=fmt(apr*100,0)+'%';$(fig,'.ap-queda-txt').textContent=fmt(queda*100,0)+'%';
    $(fig,'.ap-apy').textContent=fmt(apy*100,1)+'%';$(fig,'.ap-fim').textContent='US$ '+fmt(1000*(1+real),0);$(fig,'.ap-real').textContent=fmt(real*100,1)+'%';
    $(fig,'.cena-estado').textContent=queda>0?'O rendimento veio num token que caiu '+fmt(queda*100,0)+'%: o APY de '+fmt(apy*100,1)+'% vira '+fmt(real*100,1)+'% de verdade. Sem contar taxas de rede e de troca.':'APR não conta o reinvestimento; APY conta. A diferença cresce com taxas altas e reinvestimento frequente.';
   };
   [a,q].forEach(x=>x.addEventListener('input',atualizar));n.addEventListener('change',atualizar);atualizar();
  },
  loop(fig){
   const l=$(fig,'.lp-ltv'),nn=$(fig,'.lp-n'),LT=0.8;
   const atualizar=()=>{
    const ltv=Number(l.value)/100,n=Number(nn.value);let exp=0;for(let k=0;k<=n;k++)exp+=1000*Math.pow(ltv,k);
    const div=exp-1000,hf=div?exp*LT/div:Infinity,queda=div?(1-div/(exp*LT))*100:100;
    $(fig,'.lp-ltv-txt').textContent=fmt(ltv*100,0)+'%';$(fig,'.lp-n-txt').textContent=String(n);
    $(fig,'.lp-exp').textContent='US$ '+fmt(exp,0);$(fig,'.lp-div').textContent='US$ '+fmt(div,0);$(fig,'.lp-hf').textContent=div?fmt(hf,2):'—';
    $(fig,'.lp-queda').textContent=div?fmt(queda,1)+'%':'—';fig.classList.toggle('hf-perigo',div>0&&queda<20);
    $(fig,'.cena-estado').textContent=!div?'Sem voltas: US$ 1.000 em ETH, sem dívida.':'Cada volta pega dólar emprestado contra o ETH e compra mais ETH. Com US$ 1.000 você fica exposto a US$ '+fmt(exp,0)+', e uma queda de '+fmt(queda,1)+'% já liquida. Limiar de exemplo: 80%; não conta juros nem taxas.';
   };
   [l,nn].forEach(x=>x.addEventListener('input',atualizar));atualizar();
  },
  flash(fig){
   const r=$(fig,'.fl-dif'),EMP=1e6,FEE=0.0005,GAS=50;
   const limpar=()=>{$(fig,'.fl-txt').textContent=fmt(Number(r.value),2)+'%';$$(fig,'.at-passo').forEach(g=>g.classList.remove('feito','falhou'));$(fig,'.fl-res').textContent='—';
    $(fig,'.cena-estado').textContent='Você toma 1 milhão de USDC sem garantia, faz a arbitragem e devolve tudo na mesma transação. Taxa do empréstimo: 0,05%. Gas de exemplo: US$ 50.';};
   r.addEventListener('input',limpar);
   acao(fig,'executar',()=>{
    const lucro=EMP*Number(r.value)/100-EMP*FEE-GAS;
    const devolve=lucro+GAS>0;
    $$(fig,'.at-passo').forEach((g,k)=>{g.classList.toggle('feito',devolve||k<3);g.classList.toggle('falhou',!devolve&&k===3);});
    $(fig,'.fl-res').textContent=devolve?(lucro>=0?'lucro de US$ '+fmt(lucro,0):'devolveu, mas o gas comeu: US$ '+fmt(lucro,0)):'revertida · perdeu só o gas (US$ '+fmt(GAS,0)+')';
    $(fig,'.cena-estado').textContent=devolve?'O empréstimo voltou com a taxa de US$ '+fmt(EMP*FEE,0)+' dentro da mesma transação.':'A arbitragem rendeu menos que a taxa do empréstimo. Sem dinheiro para devolver, a transação inteira reverte: é como se o empréstimo nunca tivesse existido.';
   });
   limpar();
  },
  /* ===== Módulo 7 ===== */
  paridade(fig){
   const r=$(fig,'.pa-preco'),res=$(fig,'.pa-resgate');
   const atualizar=(texto)=>{
    const p=Number(r.value);$(fig,'.pa-txt').textContent=fmt(p,3);
    $(fig,'.pa-ponto').setAttribute('cx',(20+(p-0.95)/0.1*600).toFixed(1));
    const lucro=Math.abs(1-p)*10000;
    $(fig,'.pa-lucro').textContent=Math.abs(p-1)<0.0005?'sem diferença, sem lucro':res.checked?'US$ '+fmt(lucro):'só quem tem conta no emissor consegue';
    $(fig,'.cena-estado').textContent=texto||(p<1?'Abaixo de US$ 1: quem pode resgatar compra barato no mercado e troca por US$ 1 no emissor. Essa compra empurra o preço de volta.':p>1?'Acima de US$ 1: quem pode emitir deposita US$ 1 no emissor, recebe a moeda e vende mais caro. Essa venda empurra o preço de volta.':'Na paridade.');
   };
   r.addEventListener('input',()=>atualizar());res.addEventListener('change',()=>atualizar());
   acao(fig,'arbitrar',()=>{
    const p=Number(r.value);
    if(!res.checked){atualizar('Sem acesso ao emissor, você só pode comprar e torcer. A paridade depende de outros, com conta no emissor, fazerem a arbitragem.');return;}
    if(Math.abs(p-1)<0.0005){atualizar('Já está em US$ 1: não há o que arbitrar.');return;}
    const novo=Math.round((p+(1-p)*0.7)*1000)/1000;r.value=String(novo);atualizar((p<1?'Você comprou a '+fmt(p,3)+' e resgatou a 1,00.':'Você emitiu a 1,00 e vendeu a '+fmt(p,3)+'.')+' Lucro de US$ '+fmt(Math.abs(1-p)*10000)+', e sua operação aproximou o preço de US$ 1.');
   });
   atualizar();
  },
  reservas(fig){
   const mix=$(fig,'.rs-mix'),r=$(fig,'.rs-pedido');
   /* Quanto de cada US$ 1 de reserva vira dinheiro em 1 dia, em cada cenário (exemplo). */
   const liq=[0.98,0.5,0.6],nomes=['Dinheiro e títulos curtos vendem no mesmo dia, com pouca perda.','Empréstimos a empresas não viram dinheiro em um dia.','Cripto vende no mesmo dia, mas numa corrida o preço cai: aqui, 40% de perda.'];
   const atualizar=()=>{
    const ped=Number(r.value)/100,disp=liq[Number(mix.value)],pago=Math.min(ped,disp),falta=Math.max(0,ped-disp);
    $(fig,'.rs-txt').textContent=fmt(ped*100,0)+'%';$(fig,'.rs-disp').textContent=fmt(disp*100,0)+'% das moedas';$(fig,'.rs-ped').textContent=fmt(ped*100,0)+'%';$(fig,'.rs-falta').textContent=falta?fmt(falta*100,0)+'%':'nada';
    $(fig,'.rs-barra-ok').setAttribute('width',String(Math.round(pago*620/0.6)));$(fig,'.rs-barra-falta').setAttribute('x',String(10+Math.round(pago*620/0.6)));$(fig,'.rs-barra-falta').setAttribute('width',String(Math.round(falta*620/0.6)));
    fig.classList.toggle('rs-faltou',falta>0);
    $(fig,'.cena-estado').textContent=nomes[Number(mix.value)]+(falta?' Faltou dinheiro para parte dos pedidos: quem não conseguiu resgatar vende no mercado, e o preço cai abaixo de US$ 1.':' Todos os pedidos foram pagos.')+' Valores de exemplo.';
   };
   mix.addEventListener('change',atualizar);r.addEventListener('input',atualizar);atualizar();
  },
  cdp(fig){
   const d=$(fig,'.cd-div'),p=$(fig,'.cd-preco'),MIN=1.5;
   const atualizar=()=>{
    const div=Number(d.value),preco=Number(p.value),gar=2*preco,razao=div?gar/div:Infinity;
    $(fig,'.cd-div-txt').textContent=fmt(div,0);$(fig,'.cd-preco-txt').textContent='US$ '+fmt(preco,0);
    $(fig,'.cd-gar').textContent='US$ '+fmt(gar,0);$(fig,'.cd-razao').textContent=div?fmt(razao*100,0)+'%':'sem dívida';$(fig,'.cd-liq').textContent=div?'US$ '+fmt(div*MIN/2,0):'—';
    fig.classList.toggle('hf-liquidavel',razao<MIN);fig.classList.toggle('hf-perigo',razao<MIN*1.2);
    $(fig,'.cena-estado').textContent=!div?'Nenhuma moeda emitida.':razao<MIN?'Abaixo do mínimo de 150%: a garantia é vendida para recolher as moedas emitidas. É assim que cada moeda continua com mais de US$ 1 por trás.':'Cada moeda emitida tem mais de US$ 1 em ETH por trás. O mínimo de exemplo é 150%: a folga absorve a volatilidade do ETH.';
   };
   [d,p].forEach(x=>x.addEventListener('input',atualizar));atualizar();
  },
  espiral(fig){
   /* Modelo de exemplo, sem relação com números reais. */
   const st=[1,0.97,0.9,0.7,0.4,0.2,0.1],tk=[1,1.2,2,6,40,300,2000],tkp=[80,70,40,9,0.8,0.05,0.002];let dia=0;
   const pt=(k,v)=>(50+k*93)+','+v;
   const mostrar=()=>{
    $(fig,'.es-linha-st').setAttribute('points',st.slice(0,dia+1).map((v,k)=>pt(k,(160-v*130).toFixed(1))).join(' '));
    $(fig,'.es-linha-tk').setAttribute('points',tk.slice(0,dia+1).map((v,k)=>pt(k,(160-Math.log10(v)/Math.log10(2000)*130).toFixed(1))).join(' '));
    $(fig,'.es-st').textContent='US$ '+fmt(st[dia],2);$(fig,'.es-tk').textContent=fmt(tk[dia],1)+'×';$(fig,'.es-tkp').textContent='US$ '+fmt(tkp[dia],tkp[dia]<1?3:0);
    $(fig,'[data-acao="dia"]').disabled=dia===6;
    const t=['A stablecoin vale US$ 1 porque pode ser trocada por US$ 1 em token irmão, que o sistema cria na hora.','Saques grandes derrubam a stablecoin um pouco. Quem quer sair troca por token irmão novo.','Mais token irmão no mercado derruba o preço dele. Para pagar US$ 1, o sistema precisa criar ainda mais.','O pânico cresce: cada troca cria token irmão em quantidade cada vez maior.','A emissão explode e o token irmão quase não vale nada. Já não há o que dar em troca.','A stablecoin deixa de ser estável. Sem reservas fora do sistema, não há chão.','Fim da espiral: as duas moedas perderam quase todo o valor. Números de exemplo.'];
    $(fig,'.cena-estado').textContent='Dia '+dia+' · '+t[dia];
   };
   acao(fig,'dia',()=>{dia=Math.min(6,dia+1);mostrar();});acao(fig,'recomecar',()=>{dia=0;mostrar();});mostrar();
  },
  depeg(fig){
   const r=$(fig,'.dp-venda'),du=$(fig,'.dp-duvida'),L=10;
   const atualizar=()=>{
    const v=Number(r.value)*(du.checked?1.8:1),x=L+v,y=L*L/x,preco=y/x;
    $(fig,'.dp-txt').textContent=fmt(Number(r.value),1);$(fig,'.dp-preco').textContent='US$ '+fmt(preco,3);
    $(fig,'.dp-barra').setAttribute('width',String(Math.round(preco*620)));fig.classList.toggle('hf-liquidavel',preco<0.97);
    $(fig,'.cena-estado').textContent=v===0?'Pool equilibrada: 1 por 1.':(du.checked?'Com dúvida sobre as reservas, cada vendedor puxa outros: o volume de venda quase dobra. ':'')+'A pool vende a stablecoin cada vez mais barato. Quem confia nas reservas compra barato para resgatar a US$ 1, se puder resgatar; sem essa confiança, o desconto fica.';
   };
   r.addEventListener('input',atualizar);du.addEventListener('change',atualizar);atualizar();
  },
  /* ===== Módulo 8 ===== */
  papeisrwa(fig){
   const t=['Emissor: estrutura a oferta, cria os tokens e define as regras. Se falhar ou mentir, o token pode não representar nada.',
    'Veículo jurídico: uma empresa separada que é a dona legal do ativo, e o token dá direitos sobre ela. Se não for separada, o ativo pode entrar na falência do emissor.',
    'Custodiante: guarda o ouro, os títulos ou a escritura. Se perder ou desviar, o lastro some, e a blockchain não percebe.',
    'Administrador: cobra aluguéis ou juros, paga despesas e distribui a renda. Se parar, a renda para, mesmo com o token circulando normalmente.',
    'Auditor: confere se as contas e os ativos batem. Sem auditoria, você confia só na palavra do emissor.',
    'Oráculo: publica na rede o valor dos ativos. Se atrasar ou errar, o preço usado em empréstimos e resgates fica errado.'];
   $$(fig,'.k-cartao').forEach(b=>b.addEventListener('click',()=>{$$(fig,'.k-cartao').forEach(x=>x.classList.toggle('escolhido',x===b));$(fig,'.cena-estado').textContent=t[Number(b.dataset.k)];}));
  },
  renda(fig){
   const a=$(fig,'.rd-alug'),v=$(fig,'.rd-vac'),dp=$(fig,'.rd-desp'),tx=$(fig,'.rd-taxa'),R=v2=>'R$ '+fmt(v2,0);
   const atualizar=()=>{
    const alug=Number(a.value),vac=Number(v.value),desp=Number(dp.value),taxa=Number(tx.value)/100;
    const bruto=alug*12,recebido=alug*(12-vac),liq=Math.max(0,(recebido-desp*12)*(1-taxa));
    $(fig,'.rd-alug-txt').textContent=R(alug);$(fig,'.rd-vac-txt').textContent=String(vac);$(fig,'.rd-desp-txt').textContent=R(desp);$(fig,'.rd-taxa-txt').textContent=fmt(taxa*100,0)+'%';
    $(fig,'.rd-bruto').textContent=R(bruto);$(fig,'.rd-liq').textContent=R(liq);$(fig,'.rd-token').textContent='R$ '+fmt(liq/1000/12);
    $(fig,'.rd-pct').textContent=fmt(liq/2e6*100,1)+'% ao ano';
    $(fig,'.cena-estado').textContent='O anúncio diz "aluguel de '+R(alug)+' por mês", que daria '+fmt(bruto/2e6*100,1)+'% ao ano. Depois de vacância, despesas e taxa, sobram '+fmt(liq/2e6*100,1)+'%. Antes ainda de impostos. Valores de exemplo.';
   };
   [a,v,dp,tx].forEach(x=>x.addEventListener('input',atualizar));atualizar();
  },
  permissao(fig){
   let congelado=false;const est=$(fig,'.cena-estado');
   const r=['Enviado: Bruno está na lista de identidades verificadas.','Bloqueado: Carla é verificada, mas o fundo não aceita investidores do país dela.','Bloqueado: o contrato só aceita carteiras com identidade cadastrada.','Bloqueado: até ser cadastrada, nem uma carteira sua pode receber.'];
   $$(fig,'.k-cartao').forEach(b=>b.addEventListener('click',()=>{const k=Number(b.dataset.k);$$(fig,'.k-cartao').forEach(x=>x.classList.toggle('escolhido',x===b));
    const ok=k===0&&!congelado;fig.classList.toggle('pm-ok',ok);fig.classList.toggle('pm-bloq',!ok);
    est.textContent=congelado?'Bloqueado: sua carteira está congelada pelo emissor. Nenhuma transferência sai dela.':r[k];}));
   acao(fig,'congelar',()=>{congelado=true;fig.classList.add('pm-bloq');fig.classList.remove('pm-ok');est.textContent='O emissor congelou sua carteira, por ordem judicial ou suspeita de fraude. Nesse padrão de token, ele também pode mover seus tokens à força.';});
   acao(fig,'recomecar',()=>{congelado=false;fig.classList.remove('pm-ok','pm-bloq');$$(fig,'.k-cartao').forEach(x=>x.classList.remove('escolhido'));est.textContent='Tokens de RWA costumam só circular entre carteiras aprovadas.';});
   est.textContent='Tokens de RWA costumam só circular entre carteiras aprovadas.';
  },
  navrwa(fig){
   const r=$(fig,'.nv-desc'),Q=10000;
   const atualizar=()=>{
    const d=Number(r.value)/100,agora=Q*(1-d),segunda=Q*(1+0.05*2/365);
    $(fig,'.nv-txt').textContent=fmt(d*100,2)+'%';$(fig,'.nv-agora').textContent='US$ '+fmt(agora);$(fig,'.nv-segunda').textContent='US$ '+fmt(segunda);$(fig,'.nv-dif').textContent='US$ '+fmt(segunda-agora);
    $(fig,'.cena-estado').textContent='O fundo só resgata em dia útil. Quem precisa sair no fim de semana vende para outra pessoa, que cobra um desconto por esperar. O token vale US$ 1 no papel, mas o preço de saída depende de quem compra. Valores de exemplo.';
   };
   r.addEventListener('input',atualizar);atualizar();
  },
  /* ===== Módulo 9 ===== */
  baldes(fig){
   const c=$(fig,'.bd-cr'),g=$(fig,'.bd-g'),R=v=>'R$ '+fmt(v,0);
   const atualizar=()=>{
    const cr=Number(c.value)/100*1e5,caixa=1e5-cr,gastos=Number(g.value),prec=gastos*6,crDepois=cr*0.4,falta=Math.max(0,prec-caixa),venda=Math.min(falta,crDepois),sobra=caixa+crDepois-prec;
    $(fig,'.bd-cr-txt').textContent=fmt(Number(c.value),0)+'%';$(fig,'.bd-g-txt').textContent=R(gastos);
    $(fig,'.bd-prec').textContent=R(prec);$(fig,'.bd-caixa').textContent=R(caixa);$(fig,'.bd-venda').textContent=venda?R(venda):'nada';$(fig,'.bd-sobra').textContent=R(Math.max(0,sobra));
    fig.classList.toggle('hf-liquidavel',venda>0);
    $(fig,'.cena-estado').textContent=venda?'Sem reserva suficiente, você vende '+R(venda)+' de cripto depois da queda de 60%, no pior preço. Essa perda vira definitiva.':'A reserva em dinheiro cobre os 6 meses. A cripto pode esperar a recuperação, se ela vier.';
   };
   [c,g].forEach(x=>x.addEventListener('input',atualizar));atualizar();
  },
  recuperacao(fig){
   const r=$(fig,'.rc-q');
   const atualizar=()=>{
    const q=Number(r.value)/100,alta=q<1?(1/(1-q)-1):Infinity;
    $(fig,'.rc-txt').textContent=fmt(q*100,0)+'%';$(fig,'.rc-qv').textContent='−'+fmt(q*100,0)+'%';$(fig,'.rc-av').textContent='+'+fmt(alta*100,0)+'%';
    $(fig,'.rc-barra-q').setAttribute('width',String(Math.round(q*100*0.4)));$(fig,'.rc-barra-a').setAttribute('width',String(Math.round(Math.min(900,alta*100)*0.4)));
    $(fig,'.rc-qv').setAttribute('x',String(180+Math.round(q*100*0.4)));$(fig,'.rc-av').setAttribute('x',String(180+Math.round(Math.min(900,alta*100)*0.4)));
    $(fig,'.cena-estado').textContent=q===0?'Sem queda.':'Caiu '+fmt(q*100,0)+'%: R$ 1.000 viraram R$ '+fmt(1000*(1-q),0)+'. Para voltar a R$ 1.000, é preciso subir '+fmt(alta*100,0)+'%. Quanto mais funda a queda, mais desproporcional a volta.';
   };
   r.addEventListener('input',atualizar);atualizar();
  },
  exposicao(fig){
   /* Peso de cada risco em cada posição (R$). */
   const pos={eth:{v:4000,r:[1,0,0,0]},lst:{v:3000,r:[1,0,1,0]},pool:{v:2000,r:[0.5,0.5,1,0]},usdc:{v:1000,r:[0,1,0,0]},btc:{v:2000,r:[0,0,0,1]}};
   const atualizar=()=>{
    const on=$$(fig,'.mt-moeda input').filter(i=>i.checked).map(i=>i.dataset.k),tot=on.reduce((s,k)=>s+pos[k].v,0)||1;
    const exp=[0,1,2,3].map(j=>on.reduce((s,k)=>s+pos[k].v*pos[k].r[j],0)/tot);
    exp.forEach((e,j)=>{$(fig,'.ex-barra-'+j).setAttribute('width',String(Math.round(e*400)));$(fig,'.ex-v-'+j).setAttribute('x',String(200+Math.round(e*400)));$(fig,'.ex-v-'+j).textContent=fmt(e*100,0)+'%';});
    $(fig,'.cena-estado').textContent=on.length<2?'Marque mais de uma posição.':'São '+on.length+' posições, mas '+fmt(exp[0]*100,0)+'% da carteira depende do preço do ETH. Nomes diferentes podem esconder o mesmo risco.';
   };
   $$(fig,'.mt-moeda input').forEach(i=>i.addEventListener('change',atualizar));atualizar();
  },
  tamanho(fig){
   const p=$(fig,'.tm-p'),q=$(fig,'.tm-q');
   const atualizar=()=>{
    const perda=Number(p.value)/100,queda=Number(q.value)/100,max=Math.min(1,perda/queda)*5e4;
    $(fig,'.tm-p-txt').textContent=fmt(perda*100,0)+'% (R$ '+fmt(perda*5e4,0)+')';$(fig,'.tm-q-txt').textContent=fmt(queda*100,0)+'%';
    $(fig,'.tm-max').textContent='R$ '+fmt(max,0);$(fig,'.tm-pct').textContent=fmt(max/5e4*100,1)+'%';
    $(fig,'.cena-estado').textContent='Se o ativo pode cair '+fmt(queda*100,0)+'% e você aceita perder até R$ '+fmt(perda*5e4,0)+', a posição não deve passar de R$ '+fmt(max,0)+'. Tamanho = perda aceita ÷ queda possível.';
   };
   [p,q].forEach(x=>x.addEventListener('input',atualizar));atualizar();
  },
  rebal(fig){
   const r=$(fig,'.rb2-var');
   const atualizar=()=>{
    const v=Number(r.value)/100,btc=5000*(1+v),tot=btc+5000,pct=btc/tot,acao=btc-tot/2;
    $(fig,'.rb2-txt').textContent=(v>=0?'+':'')+fmt(v*100,0)+'%';$(fig,'.rb2-btc').setAttribute('width',String(Math.round(pct*620)));
    $(fig,'.rb2-pbtc').textContent=fmt(pct*100,0)+'% (R$ '+fmt(btc,0)+')';$(fig,'.rb2-tot').textContent='R$ '+fmt(tot,0);
    $(fig,'.rb2-acao').textContent=Math.abs(acao)<1?'nada':(acao>0?'vender R$ '+fmt(acao,0)+' de BTC':'comprar R$ '+fmt(-acao,0)+' de BTC');
    $(fig,'.cena-estado').textContent=acao>0?'O BTC subiu e passou a pesar mais que o planejado. Rebalancear vende parte do que subiu: realiza ganho e reduz o risco.':acao<0?'O BTC caiu. Rebalancear compra mais dele com o dólar digital: disciplina para comprar na baixa, sem prever nada.':'No alvo.';
   };
   r.addEventListener('input',atualizar);atualizar();
  },
  dca(fig){
   const cen=[[100,120,140,160,180,200],[100,70,50,60,80,100],[100,85,70,60,50,40]],s=$(fig,'.dc-cen');
   const atualizar=()=>{
    const p=cen[Number(s.value)],un=p.reduce((a,x)=>a+100/x,0),medio=600/un,fim=p[5];
    $(fig,'.dc-linha').setAttribute('points',p.map((x,k)=>(70+k*105)+','+(120-x/2*0.9).toFixed(1)).join(' '));
    p.forEach((x,k)=>{$(fig,'.dc-p-'+k).setAttribute('cx',String(70+k*105));$(fig,'.dc-p-'+k).setAttribute('cy',(120-x/2*0.9).toFixed(1));});
    $(fig,'.dc-medio').textContent='R$ '+fmt(medio);$(fig,'.dc-fim-dca').textContent='R$ '+fmt(un*fim);$(fig,'.dc-fim-tudo').textContent='R$ '+fmt(6*fim);
    const melhor=un*fim>6*fim?'O aporte mensal ganhou':'Comprar tudo no mês 1 ganhou';
    $(fig,'.cena-estado').textContent=melhor+' neste cenário. Aportar sempre o mesmo valor compra mais unidades quando está barato; mas, se o preço só sobe, entrar antes rende mais. Preços de exemplo.';
   };
   s.addEventListener('change',atualizar);atualizar();
  },
  /* ===== Módulo 10 ===== */
  balanco(fig){
   let res=200,emp=900,dep=1000,cap=100;const est=$(fig,'.cena-estado'),R=v=>'R$ '+fmt(v,0);
   const mostrar=t=>{$(fig,'.bl-res').textContent='Reservas: '+R(res);$(fig,'.bl-emp').textContent='Empréstimos: '+R(emp);$(fig,'.bl-dep').textContent='Depósitos dos clientes: '+R(dep);$(fig,'.bl-cap').textContent='Capital dos donos: '+R(cap);est.textContent=t;};
   acao(fig,'emprestar',()=>{emp+=1000;dep+=1000;fig.classList.remove('hf-liquidavel');mostrar('O banco não tirou dinheiro de ninguém: anotou um empréstimo de R$ 1.000 (ativo) e criou R$ 1.000 na conta da Ana (passivo). Dinheiro novo nasceu de um empréstimo.');});
   acao(fig,'corrida',()=>{const saque=Math.round(dep*0.3);if(saque>res){fig.classList.add('hf-liquidavel');mostrar('Pedidos de '+R(saque)+', mas só há '+R(res)+' em reservas. Os empréstimos não viram dinheiro na hora. Sem ajuda do banco central, o banco não paga todos: é uma corrida bancária.');return;}res-=saque;dep-=saque;mostrar('O banco pagou os saques com as reservas.');});
   acao(fig,'recomecar',()=>{res=200;emp=900;dep=1000;cap=100;fig.classList.remove('hf-liquidavel');mostrar('Um banco simples: R$ 1.100 em ativos, R$ 1.000 em depósitos e R$ 100 dos donos. Valores de exemplo.');});
   mostrar('Um banco simples: R$ 1.100 em ativos, R$ 1.000 em depósitos e R$ 100 dos donos. Valores de exemplo.');
  },
  remessa(fig){
   const r=$(fig,'.rm-saida'),V=500;
   const atualizar=()=>{
    const saida=Number(r.value)/100;
    const chega=[V-25-(V-25)*0.04,V-5-(V-5)*0.015,V*(1-0.01)-0.5-(V*(1-0.01)-0.5)*saida];
    chega.forEach((c,k)=>{const w=Math.round(c/V*380);$(fig,'.rm-barra-'+k).setAttribute('width',String(w));$(fig,'.rm-v-'+k).setAttribute('x',String(240+w));$(fig,'.rm-v-'+k).textContent='US$ '+fmt(c)+' ('+fmt((1-c/V)*100,1)+'%)';});
    $(fig,'.rm-txt').textContent=fmt(saida*100,1)+'%';
    const melhor=chega.indexOf(Math.max(...chega));
    $(fig,'.cena-estado').textContent='Neste exemplo, chega mais pelo caminho "'+['banco','empresa de remessa','stablecoin'][melhor]+'". A stablecoin só ganha se a saída para a moeda local for barata: a taxa da rede é a menor parte do custo.';
   };
   r.addEventListener('input',atualizar);atualizar();
  },
  dvp(fig){
   let atomico=false;const est=$(fig,'.cena-estado');
   const zerar=()=>{$(fig,'.dv2-ana').textContent='10 títulos · R$ 0';$(fig,'.dv2-bruno').textContent='0 títulos · R$ 10.000';fig.classList.remove('hf-liquidavel');
    $$(fig,'.c-cenarios .btn').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.acao==='atomico')===atomico)));
    est.textContent=atomico?'Os dois lados entram numa única operação: ou os títulos e o dinheiro trocam de mão juntos, ou nada acontece.':'Primeiro Ana entrega os títulos; depois Bruno paga. Entre um passo e outro, alguém fica exposto.';};
   acao(fig,'separado',()=>{atomico=false;zerar();});acao(fig,'atomico',()=>{atomico=true;zerar();});
   acao(fig,'ok',()=>{zerar();$(fig,'.dv2-ana').textContent='0 títulos · R$ 10.000';$(fig,'.dv2-bruno').textContent='10 títulos · R$ 0';est.textContent='Deu certo: títulos para Bruno, dinheiro para Ana.';});
   acao(fig,'quebra',()=>{zerar();
    if(atomico){est.textContent='Bruno quebrou, então a operação inteira não aconteceu. Ana continua com os títulos. Ninguém perdeu nada.';return;}
    $(fig,'.dv2-ana').textContent='0 títulos · R$ 0';$(fig,'.dv2-bruno').textContent='10 títulos · R$ 10.000 (presos na falência)';fig.classList.add('hf-liquidavel');
    est.textContent='Ana entregou os títulos, mas Bruno quebrou antes de pagar. Ela perdeu tudo e vira credora na fila. Foi o que aconteceu com bancos que negociavam com o Herstatt em 1974.';});
   zerar();
  },
 };
 /* Desbloqueio de exemplo (milhões de um total de 1.000): 200 no lançamento,
    400 da comunidade liberados em 48 meses e 400 de equipe e investidores
    travados por 12 meses e liberados nos 24 seguintes. */
 const circulante=m=>200+400*Math.min(m,48)/48+(m<12?0:400*Math.min(m-12,24)/24);
 /* Juros de exemplo com "joelho" em 80% de utilização: até lá sobem devagar
    (até 4% ao ano); depois disparam (até 79%). Quem fornece recebe os juros
    vezes a utilização, menos 10% de reserva. */
 const juros=u=>{const tomar=u<=0.8?0.04*u/0.8:0.04+0.75*(u-0.8)/0.2;return {tomar,fornecer:tomar*u*0.9};};
 return {html,ligar,circulante,juros,KINDS:Object.keys(html)};
})();
