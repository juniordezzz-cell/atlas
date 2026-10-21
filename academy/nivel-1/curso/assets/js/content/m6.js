/* Módulo 6: DeFi (formato novo, 21/10/2026). Figuras em SVG no topo; os
   interativos (kind) moram em academy-interativos.js. Fatos conferidos nas
   fontes em 21/10/2026. */
(function(){
const F='font-family="inherit"';
const C={azul:'#60a5fa',ciano:'#67e8f9',violeta:'#a78bfa',verm:'#f87171',ambar:'#fcd34d',fundo:'#111c30',linha:'#2a3b55',mudo:'#a9b8cf',texto:'#e2e8f0'};
const tx=(x,y,t,tam,cor,peso,ancora)=>'<text x="'+x+'" y="'+y+'" text-anchor="'+(ancora||'middle')+'" font-size="'+tam+'"'+(peso?' font-weight="'+peso+'"':'')+' fill="'+cor+'">'+t+'</text>';
const ret=(x,y,w,h,cor)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="10" fill="'+C.fundo+'" stroke="'+cor+'" stroke-width="2"/>';

/* As camadas do DeFi. */
const faixa=(y,t,s,cor)=>ret(40,y,560,38,cor)+tx(56,y+24,t,15,C.texto,700,'start')+tx(584,y+24,s,13,C.mudo,0,'end');
const figCamadas='<svg viewBox="0 0 640 250" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +faixa(10,'Interface','sites e carteiras',C.linha)
 +faixa(56,'Agregadores','procuram a melhor rota e taxa',C.violeta)
 +faixa(102,'Protocolos','empréstimo, troca, staking',C.ciano)
 +faixa(148,'Ativos','ETH, stablecoins, tokens',C.azul)
 +faixa(194,'Rede','Ethereum e redes de segunda camada',C.ambar)
 +tx(320,246,'Cada camada usa a de baixo; um problema embaixo atinge tudo o que está em cima.',13,C.mudo)+'</svg>';

/* LTV e limiar de liquidação, com o exemplo da Aave (garantia de US$ 10.000, limiar de 80%). */
const figLtv='<svg viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +tx(20,26,'Garantia: US$ 10.000 em ETH',15,C.texto,700,'start')
 +'<rect x="20" y="40" width="600" height="40" rx="8" fill="'+C.fundo+'" stroke="'+C.linha+'" stroke-width="2"/>'
 +'<rect x="20" y="40" width="360" height="40" rx="8" fill="'+C.azul+'" opacity="0.55"/>'+tx(200,66,'dívida: US$ 6.000',14,C.texto,700)
 +'<line x1="470" y1="32" x2="470" y2="90" stroke="'+C.ambar+'" stroke-width="3"/>'+tx(470,108,'limite para tomar (LTV)',13,C.ambar)
 +'<line x1="500" y1="32" x2="500" y2="132" stroke="'+C.verm+'" stroke-width="3"/>'+tx(500,148,'limiar de liquidação: 80%',13,C.verm)
 +tx(320,186,'HF = 10.000 × 0,8 ÷ 6.000 = 1,33',16,C.ciano,700)
 +tx(320,210,'Posição de LTV ilustrativa; o limiar e o HF são os do exemplo da Aave.',12,C.mudo)+'</svg>';

/* Aave e Compound III: duas arquiteturas. */
const figAaveCompound='<svg viewBox="0 0 640 250" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +ret(10,10,300,200,C.violeta)+tx(160,38,'Aave',17,C.texto,700)
 +['ETH','USDC','WBTC','DAI'].map((a,k)=>ret(30+(k%2)*140,52+Math.floor(k/2)*70,120,56,C.linha)+tx(90+(k%2)*140,78+Math.floor(k/2)*70,a,15,C.texto,700)+tx(90+(k%2)*140,96+Math.floor(k/2)*70,'fornece e toma',11,C.mudo)).join('')
 +tx(160,200,'vários ativos que rendem e podem ser tomados',12,C.mudo)
 +ret(330,10,300,200,C.ciano)+tx(480,38,'Compound III',17,C.texto,700)
 +ret(400,52,160,56,C.ciano)+tx(480,78,'USDC (base)',15,C.texto,700)+tx(480,96,'o único que rende',11,C.mudo)
 +['ETH','WBTC','LINK'].map((a,k)=>ret(345+k*95,130,85,50,C.linha)+tx(387+k*95,160,a,14,C.texto)).join('')
 +tx(480,200,'garantias não rendem juros',12,C.mudo)
 +tx(320,240,'Os ativos acima são ilustrativos; cada mercado tem sua lista.',12,C.mudo)+'</svg>';

/* Três jeitos de fazer staking de ETH. */
const via=(x,t,s1,s2,cor)=>ret(x,40,190,150,cor)+tx(x+95,72,t,16,C.texto,700)+tx(x+95,104,s1,13,C.mudo)+tx(x+95,126,s2,13,C.mudo);
const figStaking='<svg viewBox="0 0 640 240" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +tx(320,24,'Do mais trabalhoso ao mais prático',14,C.texto,700)
 +via(15,'Solo','32 ETH e um','computador ligado',C.ciano)+tx(110,160,'você responde por tudo',12,C.ciano)
 +via(225,'Em grupo (pool)','qualquer valor;','um operador valida',C.azul)+tx(320,160,'depende do operador',12,C.azul)
 +via(435,'Staking líquido','recebe um token','que pode ser vendido',C.violeta)+tx(530,160,'o token pode descolar',12,C.violeta)
 +tx(320,226,'Quanto mais prático, mais contratos e intermediários no caminho.',13,C.mudo)+'</svg>';

/* De onde vem o rendimento. */
const fonte=(x,y,t,s,cor)=>ret(x,y,295,74,cor)+tx(x+16,y+30,t,16,C.texto,700,'start')+tx(x+16,y+54,s,13,C.mudo,0,'start');
const figRendimento='<svg viewBox="0 0 640 230" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +fonte(15,15,'Juros','pagos por quem toma emprestado',C.ciano)
 +fonte(330,15,'Taxas de troca','pagas por quem negocia na pool',C.ciano)
 +fonte(15,105,'Recompensa de staking','paga pela rede aos validadores',C.azul)
 +fonte(330,105,'Emissão de token','token novo criado pelo projeto',C.ambar)
 +tx(320,212,'As três primeiras vêm de alguém pagando por um serviço. A última pode só diluir.',13,C.mudo)+'</svg>';

AcademyContent.register({
 id:'m6',
 title:'DeFi',
 icon:'landmark',
 summary:'Emprestar, tomar, trocar e render sem banco: como os juros se formam, quando uma posição é liquidada e de onde vem (de verdade) o rendimento.',
 minutes:90,
 goals:[
  'Explicar como pools de empréstimo formam os juros pela utilização',
  'Calcular health factor e o preço de liquidação de uma posição',
  'Entender AMMs, impacto no preço e impermanent loss',
  'Separar rendimento real de emissão de token e avaliar loops e flash loans'
 ],
 flow:['Fornecer garantia','Habilitar quando necessário','Consultar limite','Tomar ativo','Monitorar HF','Pagar e retirar'],
 history:{
  intro:'Em poucos anos, contratos na blockchain passaram a fazer o que bancos e corretoras fazem: emprestar, trocar, pagar juros. Tudo aberto, 24 horas, sem cadastro, e com riscos novos que vieram junto.',
  timeline:[
   {when:'2017',title:'MakerDAO e o DAI',text:'Surge uma plataforma em que qualquer um deposita garantia e toma emprestado DAI, uma stablecoin atrelada ao dólar.'},
   {when:'2 nov 2018',title:'Uniswap',text:'Hayden Adams lança uma corretora sem livro de ofertas: as trocas acontecem contra pools de liquidez, com preço dado por uma fórmula.'},
   {when:'2020',title:'Começa o yield farming',text:'O Compound passa a pagar quem empresta e quem toma com seu token, o COMP. Outros protocolos copiam, e nasce a corrida por rendimento.'},
   {when:'2021',title:'Mais de US$ 180 bilhões',text:'Protocolos como MakerDAO, Compound, Aave e Uniswap levam o valor total depositado em DeFi a mais de US$ 180 bilhões.'}
  ]
 },
 lessons:[
  {id:'o-que-e-defi',title:'DeFi: serviços financeiros feitos de contratos',optional:false,sources:['m6.wiki-defi','contracts'],blocks:[
   {t:'p',text:'**DeFi** (finanças descentralizadas) são serviços financeiros rodando em smart contracts: empréstimos, trocas, rendimentos. Você usa com a sua carteira, sem cadastro, a qualquer hora.'},
   {t:'figure',svg:figCamadas,caption:'O DeFi é feito de camadas que se apoiam umas nas outras.',alt:'Cinco faixas empilhadas: interface, agregadores, protocolos, ativos e rede.'},
   {t:'p',text:'A ausência de banco tem dois lados. Ninguém bloqueia sua conta nem escolhe quem pode usar. Mas ninguém devolve dinheiro perdido por erro, golpe ou falha de contrato.'},
   {t:'data',text:'Em 2021, protocolos como MakerDAO, Compound, Aave e Uniswap levaram o valor total depositado em DeFi (TVL) a mais de US$ 180 bilhões.',source:'m6.wiki-defi',date:'2026-10-21'},
   {t:'summary',text:'DeFi são serviços financeiros abertos feitos de contratos empilhados; liberdade e responsabilidade vêm juntas.'},
   {t:'terms',terms:['DeFi','TVL']}
  ]},
  {id:'fornecer-e-tomar',title:'Quem fornece, quem toma e de onde vêm os juros',optional:false,sources:['aave','comet'],blocks:[
   {t:'p',text:'Num protocolo de empréstimo, quem **fornece** deposita num pool comum e ganha juros. Quem **toma** pega desse pool, dando garantia, e paga juros. Não existe um "par" de pessoas: todos negociam com o pool.'},
   {t:'interactive',kind:'utilizacao',caption:'Mexa na utilização e veja os juros dos dois lados. Curva e parâmetros de exemplo, no formato usado pelos protocolos.',alt:'Gráfico dos juros de quem toma em função da utilização, com um joelho em 80%. Um controle move a utilização e mostra os juros e o dinheiro livre para saque.'},
   {t:'p',text:'Os juros dependem da **utilização**: a parte do pool que está emprestada. Quando quase tudo está emprestado, os juros disparam para atrair depósitos e frear empréstimos, porque falta dinheiro para quem quer sacar.'},
   {t:'example',text:'O site mostra 8% ao ano para fornecer USDC. Na semana seguinte a utilização cai e o rendimento vira 3%. A taxa é variável, não uma promessa.'},
   {t:'summary',text:'Juros saem da utilização do pool: muito emprestado, juros altos e saque difícil; pouco emprestado, juros baixos.'},
   {t:'terms',terms:['Utilização','Pool de liquidez']}
  ]},
  {id:'garantia-e-ltv',title:'Garantia, LTV e limiar de liquidação',optional:false,sources:['collateral','health'],blocks:[
   {t:'p',text:'Para tomar emprestado em DeFi, você deposita uma **garantia** (colateral) que vale mais do que a dívida. Se a dívida chegar perto do valor da garantia, o protocolo vende parte dela para se proteger.'},
   {t:'figure',svg:figLtv,caption:'O LTV limita quanto você pode tomar; o limiar de liquidação marca quando a posição pode ser liquidada.',alt:'Barra da garantia de US$ 10.000 com uma dívida de US$ 6.000, uma linha do limite para tomar e outra do limiar de liquidação de 80%. Embaixo, o cálculo HF = 1,33.'},
   {t:'data',text:'Na Aave, o LTV define a proporção máxima para abrir um empréstimo novo, e o limiar de liquidação (LT) define a proporção em que a posição pode ser liquidada.',source:'collateral',date:'2026-10-21'},
   {t:'p',text:'Os dois números não são o mesmo, e nenhum deles é uma meta. Tomar o máximo permitido deixa você a um passo da liquidação.'},
   {t:'summary',text:'LTV é o teto para pegar; o limiar de liquidação é onde a posição pode ser vendida. Fique bem abaixo dos dois.'},
   {t:'terms',terms:['Colateral','LTV','Limiar de liquidação']}
  ]},
  {id:'health-factor',title:'Health factor: a margem da sua posição',optional:false,sources:['health'],blocks:[
   {t:'p',text:'O **health factor** (HF) resume a saúde de um empréstimo num número só. Acima de 1, a posição está protegida. Abaixo de 1, pode ser liquidada.'},
   {t:'interactive',kind:'hf',caption:'Mude a garantia, o preço do ETH e a dívida. Limiar de 80% e LTV de 75%, valores de exemplo.',alt:'Controles de ETH depositado, preço do ETH e dívida. Uma barra mostra o HF com a marca do 1; um quadro mostra o HF, quanto ainda dá para tomar e o preço de liquidação.'},
   {t:'data',text:'Pela Aave, HF = valor total da garantia × limiar de liquidação médio ÷ valor total da dívida. No exemplo dela, US$ 10.000 em ETH com limiar de 80% e US$ 6.000 de dívida dão HF de 1,333.',source:'health',date:'2026-10-21'},
   {t:'p',text:'O HF muda sozinho, sem você fazer nada: cai se a garantia desvaloriza, se o ativo da dívida valoriza ou se os juros fazem a dívida crescer.'},
   {t:'summary',text:'HF = garantia × limiar ÷ dívida; abaixo de 1 a posição pode ser liquidada, e o número muda com o mercado.'},
   {t:'terms',terms:['Health factor']}
  ]},
  {id:'liquidacao',title:'Liquidação: o que acontece quando o HF passa de 1',optional:false,sources:['health'],blocks:[
   {t:'p',text:'Quando o HF cai abaixo de 1, qualquer pessoa pode **liquidar** a posição: paga parte da sua dívida e leva parte da sua garantia, com um desconto. Esse desconto é o prêmio de quem liquida e o seu prejuízo.'},
   {t:'interactive',kind:'liquidacao',caption:'Derrube o preço do ETH até a liquidação, ou pague parte da dívida antes. Bônus de liquidação de exemplo: 5%.',alt:'Caixa da garantia e caixa da dívida com o HF. Botões para derrubar o preço do ETH em 5%, pagar parte da dívida e recomeçar.'},
   {t:'data',text:'Na Aave, a liquidação é aberta a qualquer pessoa e disputada por robôs. Com HF acima de 0,95 (e posições de pelo menos US$ 2.000), até 50% da dívida pode ser liquidada de uma vez; com HF de 0,95 ou menos, até 100%.',source:'health',date:'2026-10-21'},
   {t:'p',text:'Para se proteger, há dois caminhos antes da hora: depositar mais garantia ou pagar parte da dívida. Esperar o preço voltar é uma aposta.'},
   {t:'summary',text:'Abaixo de HF 1, liquidantes pagam parte da dívida e levam garantia com desconto; reforce a garantia ou pague antes.'},
   {t:'terms',terms:['Liquidação','Health factor']}
  ]},
  {id:'aave-e-compound',title:'Aave e Compound III: dois desenhos',optional:false,sources:['m6.compound','aave'],blocks:[
   {t:'p',text:'Os dois maiores protocolos de empréstimo funcionam de jeitos diferentes. Na Aave, cada mercado tem vários ativos que rendem e podem ser tomados. No Compound III, cada mercado gira em torno de um único **ativo base**.'},
   {t:'figure',svg:figAaveCompound,caption:'Na Aave, vários ativos rendem; no Compound III, só o ativo base rende e é emprestado, e as garantias ficam paradas.',alt:'À esquerda, a Aave com quatro ativos que podem ser fornecidos e tomados. À direita, o Compound III com o USDC como base e três garantias que não rendem.'},
   {t:'data',text:'Na documentação do Compound III, as garantias depositadas não rendem juros; só o ativo base fornecido rende.',source:'m6.compound',date:'2026-10-21'},
   {t:'p',text:'Por isso fórmulas, telas e regras de liquidação de um não valem automaticamente para o outro. Antes de usar, leia os parâmetros daquele mercado específico.'},
   {t:'summary',text:'Aave tem vários ativos por mercado; Compound III tem um ativo base e garantias que não rendem.'},
   {t:'terms',terms:['Ativo base','Colateral']}
  ]},
  {id:'divida-volatil',title:'Dívida em ativo que sobe e desce',optional:false,sources:['health','borrow'],blocks:[
   {t:'p',text:'Uma dívida é contada no ativo que você tomou. Se você pegou 1 ETH, deve 1 ETH, não um valor em dólar. Se o ETH sobe, sua dívida em dólar sobe junto.'},
   {t:'interactive',kind:'divida',caption:'Garantia de 4.000 USDC e dívida de 1 ETH, tomada quando o ETH valia US$ 2.000. Limiar de exemplo: 80%.',alt:'Controle do preço do ETH. A caixa da garantia fica fixa em 4.000 USDC; a da dívida mostra quanto vale 1 ETH; o HF muda.'},
   {t:'p',text:'Isso surpreende quem acha que garantia estável é sinônimo de segurança. A garantia não mexe, mas a dívida pode crescer até a liquidação.'},
   {t:'example',text:'Alguém deposita dólar digital e pega ETH emprestado para vender, apostando na queda. Se o ETH dobrar, a dívida em dólar dobra.'},
   {t:'summary',text:'Dívida em ativo volátil cresce quando ele sobe; garantia estável não protege contra isso.'},
   {t:'terms',terms:['Health factor','Colateral']}
  ]},
  {id:'staking',title:'Staking: solo, em grupo ou líquido',optional:false,sources:['staking','pooled','pos'],blocks:[
   {t:'p',text:'Fazer **staking** de ETH é travar moedas para ajudar a validar a rede e receber recompensas. Dá para fazer sozinho, em grupo ou por um protocolo que devolve um token negociável.'},
   {t:'figure',svg:figStaking,caption:'Três caminhos para o mesmo staking, com trocas diferentes entre trabalho, valor mínimo e risco.',alt:'Três caixas: solo, com 32 ETH e um computador ligado; em grupo, com qualquer valor e um operador; e staking líquido, que dá um token que pode ser vendido.'},
   {t:'data',text:'Pelo ethereum.org, o staking líquido entrega um token que representa o ETH em stake e suas recompensas. Entre os riscos: falhas de contrato, preço do token abaixo do ETH por trás dele, mudanças por governança e concentração de operadores.',source:'pooled',date:'2026-10-21'},
   {t:'p',text:'O **staking líquido** dá liquidez: você pode vender o token em vez de esperar a fila de saída. Mas o preço de mercado do token pode ficar abaixo do ETH que ele representa, justamente quando muita gente quer sair.'},
   {t:'summary',text:'Staking solo exige 32 ETH e trabalho; em grupo e líquido facilitam, mas somam contratos, operadores e risco de descolamento.'},
   {t:'terms',terms:['Staking','Staking líquido']}
  ]},
  {id:'amm',title:'AMM: trocar sem livro de ofertas',optional:false,sources:['amm','m6.uniswap'],blocks:[
   {t:'p',text:'Numa corretora comum, compradores e vendedores deixam ofertas. Num **AMM** (formador de mercado automático), você troca direto com um pool de dois ativos, e uma fórmula define o preço.'},
   {t:'interactive',kind:'amm',caption:'Um pool de 10 ETH e 30.000 USDC. Aumente a compra e veja o preço médio e o impacto subirem.',alt:'Curva x vezes y igual a k, com o ponto do pool antes e depois da compra. Um controle define quanto ETH comprar; um quadro mostra o valor pago, o preço médio, o impacto e o pool depois.'},
   {t:'p',text:'Na fórmula clássica, x · y = k: o produto das duas reservas fica constante. Cada ETH que sai deixa o próximo mais caro. Esse é o **impacto no preço**: quanto maior a compra perto do tamanho do pool, pior o preço médio.'},
   {t:'data',text:'No Uniswap v2, 0,3% de todo o volume negociado é distribuído aos provedores de liquidez, na proporção da participação de cada um.',source:'amm',date:'2026-10-21'},
   {t:'summary',text:'AMM troca contra um pool com preço dado por fórmula; ordens grandes em pools rasos pagam caro pelo impacto.'},
   {t:'terms',terms:['AMM','Impacto no preço','Provedor de liquidez']}
  ]},
  {id:'impermanent-loss',title:'Impermanent loss: ganhar menos do que só guardar',optional:false,sources:['amm'],blocks:[
   {t:'p',text:'Quem coloca dois ativos num pool é um **provedor de liquidez** e ganha as taxas das trocas. Mas o pool vende o ativo que sobe e compra o que cai. No fim, você tem menos do que valorizou.'},
   {t:'interactive',kind:'il',caption:'Escolha quanto o preço do ETH mudou desde a entrada e compare ficar no pool com só guardar os dois ativos. Taxas não incluídas.',alt:'Duas barras: o valor de só guardar e o valor no pool, com a perda percentual entre elas. Um controle muda o preço do ETH de 0,2 a 5 vezes.'},
   {t:'data',text:'Pela Uniswap, se o preço dobra, a posição no pool vale 5,7% menos do que só guardar; se triplica, 13,4% menos; se quintuplica, 25,5% menos. A perda é a mesma para subida ou queda na mesma proporção.',source:'amm',date:'2026-10-21'},
   {t:'p',text:'Chama-se "impermanente" porque some se o preço voltar ao de entrada. Se você sair antes, ela vira permanente. As taxas podem compensar, mas não há garantia.'},
   {t:'summary',text:'Em pool, você perde em relação a guardar quando os preços se afastam; as taxas precisam pagar essa diferença.'},
   {t:'terms',terms:['Impermanent loss','Provedor de liquidez']}
  ]},
  {id:'apr-e-apy',title:'APR, APY e o rendimento que sobra de verdade',optional:false,sources:['m6.apy','risks'],blocks:[
   {t:'p',text:'**APR** é a taxa anual simples. **APY** inclui o efeito de reinvestir os ganhos. Com 20% de APR reinvestido todo mês, o APY passa de 21%. Sites gostam de mostrar o maior dos dois.'},
   {t:'interactive',kind:'apy',caption:'Escolha o APR, a frequência de reinvestimento e quanto o token da recompensa cai no ano.',alt:'Controles de APR, frequência de reinvestimento e queda do token de recompensa. Um quadro mostra APY, valor final de US$ 1.000 e rendimento real.'},
   {t:'data',text:'A fórmula do APY é (1 + r/n)^n − 1, em que r é a taxa anual nominal e n é o número de vezes que os ganhos são reinvestidos no ano.',source:'m6.apy',date:'2026-10-21'},
   {t:'p',text:'O número anunciado também esconde em que moeda você recebe. Se o rendimento vem num token que cai pela metade, metade do rendimento some. E cada reinvestimento paga taxa de rede.'},
   {t:'example',text:'Um pool anuncia 80% de APY, pago no token do próprio projeto. O token cai 70% no ano. O rendimento de verdade fica perto de 24%, antes das taxas.'},
   {t:'summary',text:'APY inclui reinvestimento; rendimento real desconta a queda do token pago e as taxas.'},
   {t:'terms',terms:['APR / APY']}
  ]},
  {id:'de-onde-vem',title:'De onde vem o rendimento',optional:false,sources:['m6.wiki-defi','risks'],blocks:[
   {t:'p',text:'Todo rendimento tem alguém pagando. Antes de entrar, pergunte: quem paga, e por quê? Se ninguém paga por um serviço, o rendimento vem de token novo, e isso dilui todo mundo.'},
   {t:'figure',svg:figRendimento,caption:'Quatro fontes de rendimento. Juros, taxas e recompensas de staking vêm de quem usa um serviço; emissão é token novo.',alt:'Quatro caixas: juros pagos por quem toma emprestado, taxas de troca, recompensas de staking e emissão de token.'},
   {t:'data',text:'Pela Wikipedia, quando o Compound passou a pagar quem empresta e quem toma com seu token COMP, outras plataformas copiaram, dando origem ao "yield farming".',source:'m6.wiki-defi',date:'2026-10-21'},
   {t:'p',text:'O **yield farming** empilha camadas: deposita, recebe um recibo, coloca o recibo em outro lugar, recebe recompensa e reinveste. Cada camada soma um contrato, um preço e uma saída que podem falhar.'},
   {t:'summary',text:'Rendimento sustentável vem de alguém pagando por um serviço; rendimento pago em emissão é diluição com outro nome.'},
   {t:'terms',terms:['Yield farming']}
  ]},
  {id:'loops',title:'Loops e alavancagem',optional:true,sources:['health','borrow'],blocks:[
   {t:'p',text:'Um **loop** deposita ETH, pega dólar emprestado, compra mais ETH, deposita de novo e repete. A exposição cresce a cada volta, e a margem até a liquidação encolhe.'},
   {t:'interactive',kind:'loop',caption:'Escolha quanto do limite usar e quantas voltas dar, partindo de US$ 1.000 em ETH. Limiar de exemplo: 80%; juros e taxas não incluídos.',alt:'Controles de LTV usado e número de voltas. Um quadro mostra a exposição, a dívida, o HF e a queda que liquida.'},
   {t:'summary',text:'Loop multiplica a exposição e encurta a distância até a liquidação; usar o LTV máximo é pedir para ser liquidado.'},
   {t:'terms',terms:['Alavancagem','Health factor']}
  ]},
  {id:'flash-loans',title:'Flash loans: emprestado e devolvido no mesmo instante',optional:true,sources:['m6.aave-flash'],blocks:[
   {t:'p',text:'Um **flash loan** empresta qualquer valor, sem garantia, desde que seja devolvido dentro da mesma transação. Se não voltar, a transação inteira reverte, e é como se nada tivesse acontecido.'},
   {t:'interactive',kind:'flash',caption:'Arbitragem com 1 milhão emprestado por um instante. Diferença de preço e gas de exemplo; taxa de 0,05% da Aave.',alt:'Controle da diferença de preço entre duas corretoras e os quatro passos do flash loan. O resultado mostra lucro, prejuízo do gas ou reversão.'},
   {t:'data',text:'Na Aave V3, a taxa do flash loan começa em 0,05% e pode ser mudada por votação de governança. Se o tomador não devolver, a transação reverte.',source:'m6.aave-flash',date:'2026-10-21'},
   {t:'summary',text:'Flash loan é capital enorme por uma transação; serve para arbitragem e refinanciamento, e também amplifica falhas de preço.'},
   {t:'terms',terms:['Flash loan']}
  ]},
  {id:'oraculo-e-peg',title:'Quando o preço de referência falha',optional:true,sources:['oracle','stable'],blocks:[
   {t:'p',text:'Empréstimos dependem de preços. Se o oráculo atrasa, se um ativo que deveria valer 1 dólar descola, ou se dois ativos que andavam juntos se separam, posições "seguras" deixam de ser.'},
   {t:'example',text:'Você deposita um token de staking líquido e pega ETH, achando que os dois andam juntos. Numa corrida de saques, o token cai 5% em relação ao ETH, e o HF despenca sem o ETH ter mexido.'},
   {t:'summary',text:'Oráculo atrasado, descolamento de paridade e correlação que some são riscos que os números do site não mostram.'},
   {t:'terms',terms:['Oráculo','Depeg']}
  ]},
  {id:'roteiro',title:'Roteiro antes de montar uma estratégia',optional:true,sources:['risks','allocation'],blocks:[
   {t:'p',text:'Antes de colocar dinheiro numa estratégia DeFi, responda por escrito às perguntas abaixo. Se alguma ficar sem resposta, o risco está escondido ali.'},
   {t:'table',caption:'Perguntas para cada estratégia',headers:['Pergunta','Por que importa'],rows:[
    ['De onde vem o rendimento?','Emissão de token não é rendimento sustentável'],
    ['O que pode me liquidar?','Preço da garantia, da dívida, juros e oráculo'],
    ['Como eu saio, e quanto custa?','Fila de saque, liquidez da pool e taxas'],
    ['Quem pode mudar as regras?','Chaves de admin, governança, timelock'],
    ['De quais contratos isso depende?','Cada camada é um ponto de falha'],
    ['E se o ETH cair 40% amanhã?','Testar o cenário ruim antes de entrar']
   ]},
   {t:'summary',text:'Fonte do rendimento, gatilhos de liquidação, saída, poder de admin, dependências e o pior cenário: responda antes de entrar.'},
   {t:'terms',terms:['DeFi']}
  ]}
 ],
 quiz:[
  ['Você deposita ETH e pega USDC emprestado. Qual é a garantia?',['ETH','USDC','O token de governança','Nenhuma'],0,'O ETH é o colateral; o USDC é a dívida a devolver com juros.'],
  ['O que acontece com os juros quando quase todo o pool está emprestado?',['Caem a zero','Ficam iguais','Sobem forte, para atrair depósitos e frear empréstimos','O pool fecha'],2,'Alta utilização encarece o empréstimo e paga mais a quem fornece.'],
  ['Qual a diferença entre LTV e limiar de liquidação?',['São o mesmo número','LTV limita quanto você pode tomar; o limiar marca quando pode ser liquidado','O limiar é sempre menor','LTV só existe no Bitcoin'],1,'São parâmetros diferentes: um para abrir a dívida, outro para a liquidação.'],
  ['Garantia de US$ 10.000, limiar de 80% e dívida de US$ 4.000. Qual é o HF?',['0,8','1,25','2,5','2'],3,'HF = 10.000 × 0,8 ÷ 4.000 = 2.'],
  ['O HF da sua posição caiu para 0,98. O que pode acontecer?',['Nada, só abaixo de 0,5','Qualquer pessoa pode liquidar parte da posição','O protocolo perdoa a dívida','Seu ETH dobra'],1,'Abaixo de 1, a posição fica liquidável, e robôs disputam essa liquidação.'],
  ['No Compound III, as garantias depositadas rendem juros?',['Não; só o ativo base fornecido rende','Sim, todas','Só às sextas','Sim, em COMP'],0,'Pela documentação, garantias depositadas não rendem juros.'],
  ['Você deve 1 ETH com garantia em USDC. O ETH dobra de preço. E agora?',['A dívida cai','Nada muda','A dívida em dólar dobra e o HF cai','A garantia dobra'],2,'A dívida é contada em ETH; em dólar, ela acompanha o preço do ETH.'],
  ['Num AMM x·y=k, por que comprar muito de uma vez sai caro?',['Por causa do imposto','Porque o site cobra mais','Porque é proibido','Cada unidade retirada deixa a próxima mais cara'],3,'A fórmula mantém o produto constante; tirar muito de um lado encarece o preço médio.'],
  ['O preço do ETH dobrou desde que você entrou num pool ETH/USDC. Segundo a Uniswap, quanto você tem a menos do que se tivesse só guardado?',['Nada','Cerca de 5,7%','50%','100%'],1,'Com o preço 2 vezes maior, o impermanent loss é de 5,7%, antes das taxas.'],
  ['Um pool paga 100% ao ano num token que cai 80%. O que sobra?',['Cerca de 20%, antes das taxas','100%','180%','Nada muda'],0,'O rendimento vem no token; se ele perde 80%, sobra cerca de um quinto.']
 ],
 sources:{
  'm6.wiki-defi':['Wikipedia · Decentralized finance','https://en.wikipedia.org/wiki/Decentralized_finance','MakerDAO (2017), recompensas do Compound e yield farming, TVL de 2021.'],
  'm6.uniswap':['Wikipedia · Uniswap','https://en.wikipedia.org/wiki/Uniswap','Lançamento em novembro de 2018 e o modelo de pools com produto constante.'],
  'm6.compound':['Compound III · Collateral and Borrowing','https://docs.compound.xyz/collateral-and-borrowing/','Ativo base, garantias que não rendem e fatores de garantia.'],
  'm6.aave-flash':['Aave V3 · Flash Loans','https://aave.com/docs/aave-v3/guides/flash-loans','Empréstimo devolvido na mesma transação e taxa de 0,05%.'],
  'm6.apy':['Wikipedia · Annual percentage yield','https://en.wikipedia.org/wiki/Annual_percentage_yield','Fórmula do APY: (1 + r/n)^n − 1, com n reinvestimentos por ano.']
 },
 glossary:[
  ['DeFi','Finanças descentralizadas: empréstimos, trocas e rendimentos feitos por smart contracts, sem banco.'],
  ['TVL','Valor total depositado nos contratos de um protocolo ou de todo o DeFi.'],
  ['Utilização','Parte de um pool de empréstimo que está emprestada. Define os juros.'],
  ['Pool de liquidez','Reserva comum de ativos num contrato, usada para empréstimos ou trocas.'],
  ['Limiar de liquidação','Proporção da garantia em que a posição pode ser liquidada.'],
  ['Liquidação','Venda forçada de parte da garantia, com desconto, para pagar uma dívida que ficou arriscada.'],
  ['Ativo base','No Compound III, o único ativo de um mercado que rende juros e pode ser tomado.'],
  ['Staking líquido','Staking feito por um protocolo que devolve um token negociável representando o ETH em stake.'],
  ['Impacto no preço','Quanto a sua própria ordem piora o preço numa pool, por mexer nas reservas.'],
  ['Provedor de liquidez','Quem deposita ativos numa pool e recebe parte das taxas das trocas.'],
  ['Yield farming','Estratégia de buscar rendimento empilhando depósitos, recompensas e reinvestimentos.'],
  ['Alavancagem','Aumentar a exposição usando dinheiro emprestado; amplia ganhos e perdas.'],
  ['Flash loan','Empréstimo sem garantia que precisa ser devolvido na mesma transação, ou tudo reverte.']
 ]
});
})();
