/* Módulo 7: Stablecoins (formato novo, 21/10/2026). Figuras em SVG no topo;
   os interativos (kind) moram em academy-interativos.js. Fatos conferidos
   nas fontes em 21/10/2026. */
(function(){
const F='font-family="inherit"';
const C={azul:'#60a5fa',ciano:'#67e8f9',violeta:'#a78bfa',verm:'#f87171',ambar:'#fcd34d',fundo:'#111c30',linha:'#2a3b55',mudo:'#a9b8cf',texto:'#e2e8f0'};
const tx=(x,y,t,tam,cor,peso,ancora)=>'<text x="'+x+'" y="'+y+'" text-anchor="'+(ancora||'middle')+'" font-size="'+tam+'"'+(peso?' font-weight="'+peso+'"':'')+' fill="'+cor+'">'+t+'</text>';
const ret=(x,y,w,h,cor)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="10" fill="'+C.fundo+'" stroke="'+cor+'" stroke-width="2"/>';
const seta=(x1,y1,x2,y2,cor)=>'<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+(cor||C.mudo)+'" stroke-width="2"/>';

/* Três jeitos de segurar o preço. */
const tipo=(x,t,s1,s2,risco,cor)=>ret(x,30,195,170,cor)+tx(x+97,62,t,16,C.texto,700)+tx(x+97,94,s1,13,C.mudo)+tx(x+97,114,s2,13,C.mudo)+tx(x+97,170,risco,13,cor);
const figTipos='<svg viewBox="0 0 640 230" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +tx(320,20,'O que está por trás de cada moeda',14,C.texto,700)
 +tipo(10,'Reservas','dólares e títulos','guardados por uma empresa','risco: o emissor',C.ciano)
 +tipo(222,'Cripto como garantia','mais de US$ 1 em cripto','travado por moeda','risco: a cripto despencar',C.azul)
 +tipo(434,'Algorítmica','regras de emissão','e incentivos','risco: a confiança sumir',C.verm)
 +tx(320,222,'Exemplos: USDC e USDT (reservas), DAI e USDS (cripto). Algorítmicas puras quase sumiram.',12,C.mudo)+'</svg>';

/* Atestação × auditoria. */
const figAtestacao='<svg viewBox="0 0 640 230" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +ret(15,15,295,170,C.ambar)+tx(162,45,'Atestação',18,C.texto,700)
 +tx(30,78,'• um contador confere uma',14,C.texto,0,'start')+tx(30,98,'  afirmação da empresa',14,C.texto,0,'start')+tx(30,124,'• vale para uma data',14,C.texto,0,'start')+tx(30,150,'• escopo combinado com a empresa',14,C.mudo,0,'start')
 +ret(330,15,295,170,C.ciano)+tx(477,45,'Auditoria',18,C.texto,700)
 +tx(345,78,'• exame completo das contas',14,C.texto,0,'start')+tx(345,104,'• controles, passivos e riscos',14,C.texto,0,'start')+tx(345,130,'• cobre um período',14,C.texto,0,'start')+tx(345,156,'• mais cara e mais demorada',14,C.mudo,0,'start')
 +tx(320,214,'"Reservas atestadas" é uma foto de um dia, não uma garantia permanente.',13,C.mudo)+'</svg>';

/* Para que se usa stablecoin. */
const uso=(x,y,t,s,cor)=>ret(x,y,295,72,cor)+tx(x+16,y+30,t,16,C.texto,700,'start')+tx(x+16,y+54,s,13,C.mudo,0,'start');
const figUsos='<svg viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +uso(15,15,'Pagamentos','preço estável, sem vender cripto',C.ciano)
 +uso(330,15,'Enviar para fora','pela internet, a qualquer hora',C.ciano)
 +uso(15,100,'DeFi','emprestar, tomar e trocar',C.azul)
 +uso(330,100,'Reserva em dólar','para quem vive com moeda fraca',C.violeta)
 +tx(320,205,'Em todos os casos, você troca o risco do preço pelo risco do emissor.',13,C.mudo)+'</svg>';

/* Stablecoin em outra rede via ponte. */
const figPonte='<svg viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +ret(15,40,180,110,C.ciano)+tx(105,72,'Emissor',15,C.texto,700)+tx(105,98,'emite na rede A',13,C.mudo)+tx(105,120,'e paga o resgate',13,C.mudo)
 +ret(230,60,180,70,C.ambar)+tx(320,90,'Ponte',15,C.texto,700)+tx(320,112,'trava e emite',13,C.mudo)
 +ret(445,40,180,110,C.violeta)+tx(535,72,'Rede B',15,C.texto,700)+tx(535,98,'versão da ponte',13,C.mudo)+tx(535,120,'(ex.: USDC.e)',13,C.mudo)
 +seta(195,95,230,95)+seta(410,95,445,95)
 +tx(320,190,'A versão da ponte depende do emissor e da ponte. Se a ponte cair, ela descola.',13,C.mudo)+'</svg>';

AcademyContent.register({
 id:'m7',
 title:'Stablecoins',
 icon:'circle-dollar-sign',
 summary:'O dólar digital que move o mercado cripto: como a paridade se mantém, o que há nas reservas e por que algumas stablecoins quebram.',
 minutes:50,
 goals:[
  'Diferenciar stablecoins com reservas, com garantia em cripto e algorítmicas',
  'Explicar como a arbitragem e o resgate seguram a paridade',
  'Ler reservas, atestações e o risco de uma corrida de resgates',
  'Reconhecer depeg, espiral algorítmica e o papel das pontes e das leis'
 ],
 flow:['Emissão','Reservas / garantias','Mercado secundário','Arbitragem / resgate','Paridade-alvo'],
 history:{
  intro:'Stablecoins nasceram para dar ao mercado cripto um dólar que roda na blockchain. Viraram a peça mais usada do sistema, e também a lição mais repetida: o "estável" depende do que está por trás.',
  timeline:[
   {when:'out 2014',title:'Tether',text:'Os primeiros tokens do Tether, anunciado meses antes como Realcoin, são emitidos na blockchain do Bitcoin.'},
   {when:'dez 2017',title:'DAI',text:'Chega ao Ethereum uma stablecoin garantida por cripto: quem deposita ETH pode emitir DAI como empréstimo.'},
   {when:'set 2018',title:'USDC',text:'A Circle, com a Coinbase, lança o USDC, anunciado em maio daquele ano.'},
   {when:'mai 2022',title:'Colapso da Terra',text:'A stablecoin algorítmica UST perde a paridade a partir de 9 de maio. Em uma semana, quase US$ 45 bilhões em valor de mercado desaparecem.'},
   {when:'mar 2023',title:'USDC e o banco SVB',text:'A Circle informa que US$ 3,3 bilhões das reservas, cerca de 8%, estavam presos no Silicon Valley Bank, que quebrou. O USDC perde a paridade e a recupera quatro dias depois.'},
   {when:'jul 2025',title:'Lei nos EUA',text:'O GENIUS Act vira lei e exige que stablecoins sejam lastreadas um para um em dólares ou outros ativos de baixo risco.'}
  ]
 },
 lessons:[
  {id:'o-que-e',title:'O que segura o preço de uma stablecoin',optional:false,sources:['stable','m7.dai'],blocks:[
   {t:'p',text:'Uma **stablecoin** tenta valer sempre o mesmo que outra coisa, quase sempre US$ 1. O nome promete estabilidade, mas o que importa é o que está por trás de cada moeda.'},
   {t:'figure',svg:figTipos,caption:'Três modelos e o risco principal de cada um.',alt:'Três caixas: reservas, com dólares e títulos guardados por uma empresa; cripto como garantia, com mais de US$ 1 em cripto por moeda; e algorítmica, com regras e incentivos.'},
   {t:'data',text:'O ethereum.org descreve as stablecoins lastreadas em moeda como representações digitais do dólar e de outras moedas, emitidas 1 para 1 contra reservas. A vantagem é escapar da volatilidade cripto; a desvantagem é depender de um emissor e de auditorias.',source:'stable',date:'2026-10-21'},
   {t:'p',text:'Paridade é uma meta, não uma lei da natureza. Uma moeda que busca US$ 1 pode ser negociada a US$ 0,97 se o mercado duvidar dela.'},
   {t:'summary',text:'Stablecoin busca valer US$ 1; o que a sustenta são reservas, garantia em cripto ou regras, cada uma com seu risco.'},
   {t:'terms',terms:['Stablecoin','Paridade']}
  ]},
  {id:'arbitragem',title:'Arbitragem e resgate: o que puxa o preço de volta',optional:false,sources:['stable','m7.usdc'],blocks:[
   {t:'p',text:'O que mantém o preço perto de US$ 1 é a possibilidade de **resgate**: trocar a moeda por US$ 1 no emissor. Se ela cai para US$ 0,98 no mercado, quem pode resgatar compra barato e troca por US$ 1.'},
   {t:'interactive',kind:'paridade',caption:'Mexa no preço de mercado e faça a arbitragem. Depois desmarque o acesso ao emissor e veja o que muda.',alt:'Escala de 0,95 a 1,05 com a marca de US$ 1 e o ponto do preço atual. Uma caixa liga e desliga o acesso ao resgate; um botão faz a arbitragem.'},
   {t:'p',text:'Essa **arbitragem** é o elástico da paridade. Mas quase sempre só empresas com conta no emissor resgatam direto. A pessoa comum depende de que alguém faça isso por ela.'},
   {t:'example',text:'Numa crise, a pergunta que importa é: o emissor está pagando os resgates? Se sim, o desconto dura pouco. Se ele suspende, o elástico arrebenta.'},
   {t:'summary',text:'Resgate a US$ 1 e arbitragem puxam o preço de volta; sem resgate confiável, a paridade fica sem chão.'},
   {t:'terms',terms:['Resgate','Arbitragem']}
  ]},
  {id:'reservas',title:'O que tem nas reservas',optional:false,sources:['m7.tether','m7.usdc'],blocks:[
   {t:'p',text:'Numa stablecoin com reservas, cada moeda deveria ter US$ 1 guardado. Mas "guardado onde?" faz toda a diferença: dinheiro e títulos curtos do governo viram dinheiro rápido; empréstimos e cripto, nem sempre.'},
   {t:'interactive',kind:'reservas',caption:'Escolha onde estão as reservas e quanta gente quer resgatar num único dia. Proporções de exemplo.',alt:'Seletor da composição das reservas e controle dos pedidos de resgate. Uma barra mostra a parte paga no mesmo dia e a parte que faltou.'},
   {t:'data',text:'Em maio de 2021, um relatório do Tether mostrava cerca de 2,9% das moedas lastreadas em dólar e mais de 49,6% em papéis comerciais. Em outubro de 2021, a empresa pagou multa de US$ 41,6 milhões à CFTC por afirmar, sem ser verdade, lastro total em dólar.',source:'m7.tether',date:'2026-10-21'},
   {t:'p',text:'Depois disso, o Tether trocou os papéis comerciais por títulos do Tesouro americano. A lição continua: leia a composição e a data do relatório, não só a palavra "lastreada".'},
   {t:'summary',text:'Reserva boa vira dinheiro no mesmo dia; reserva ruim só aparece no dia da corrida.'},
   {t:'terms',terms:['Reservas','Corrida de resgates']}
  ]},
  {id:'atestacao',title:'Atestação não é auditoria',optional:false,sources:['m7.tether','m7.usdc'],blocks:[
   {t:'p',text:'Emissores publicam relatórios sobre as reservas. A maioria é **atestação**: um contador confere, numa data, uma afirmação da própria empresa. Uma **auditoria** completa é outra coisa, mais ampla e mais rara.'},
   {t:'figure',svg:figAtestacao,caption:'Os dois tipos de relatório e o que cada um cobre.',alt:'Duas colunas. Atestação: confere uma afirmação da empresa, vale para uma data, escopo combinado. Auditoria: exame completo, controles e passivos, cobre um período.'},
   {t:'data',text:'Desde julho de 2022, o Tether publica atestações trimestrais da BDO Italia. Pela Wikipedia, em 2026 a KPMG concluiu a primeira auditoria completa da empresa, mas o relatório não foi divulgado.',source:'m7.tether',date:'2026-10-21'},
   {t:'example',text:'A atestação diz que, em 30 de junho, havia reservas suficientes. Ela não diz nada sobre 1º de julho, nem sobre dívidas da empresa que não entraram na conta.'},
   {t:'summary',text:'Atestação é uma foto combinada de um dia; auditoria é um exame completo; leia data, escopo e quem assina.'},
   {t:'terms',terms:['Atestação']}
  ]},
  {id:'cripto-garantia',title:'Stablecoin com garantia em cripto',optional:false,sources:['m7.dai','stable'],blocks:[
   {t:'p',text:'O DAI nasceu sem conta em banco: quem quer emitir deposita cripto, como ETH, num contrato e recebe as moedas como empréstimo. Para cada US$ 1 emitido há mais de US$ 1 em garantia. Isso é **sobrecolateralização**.'},
   {t:'interactive',kind:'cdp',caption:'Emita moedas contra 2 ETH e derrube o preço do ETH. Mínimo de garantia de exemplo: 150%.',alt:'Controles da quantidade emitida e do preço do ETH. Um quadro mostra a garantia, a proporção entre garantia e dívida e o preço de liquidação.'},
   {t:'data',text:'O DAI chegou ao Ethereum em 18 de dezembro de 2017. Se a proporção de garantia de um empréstimo cai abaixo do mínimo, qualquer pessoa pode disparar a venda de parte da garantia e recebe uma recompensa.',source:'m7.dai',date:'2026-10-21'},
   {t:'p',text:'A folga absorve quedas normais. Numa queda violenta, as liquidações em massa podem não dar conta. Em agosto de 2024, a MakerDAO mudou de nome para Sky, e a moeda principal passou a ser o USDS.'},
   {t:'summary',text:'Stablecoin com garantia em cripto tem mais de US$ 1 em cripto por moeda e liquida a garantia quando a folga acaba.'},
   {t:'terms',terms:['Sobrecolateralização','Liquidação']}
  ]},
  {id:'algoritmica',title:'Algorítmica: a espiral da Terra',optional:false,sources:['m7.terra'],blocks:[
   {t:'p',text:'Uma **stablecoin algorítmica** não guarda dólares. Ela promete que 1 moeda sempre pode ser trocada por US$ 1 em outro token do mesmo sistema, criado na hora. Funciona enquanto esse outro token vale alguma coisa.'},
   {t:'interactive',kind:'espiral',caption:'Avance os dias e veja a stablecoin e o token irmão se arrastarem um ao outro. Números de exemplo, só para mostrar o mecanismo.',alt:'Gráfico com o preço da stablecoin caindo e a quantidade do token irmão explodindo, dia a dia. Botões avançam o dia e recomeçam.'},
   {t:'data',text:'A UST, stablecoin da Terra, seguia a paridade trocando moedas por LUNA recém-criada. A partir de 9 de maio de 2022 ela perdeu a paridade, a emissão de LUNA disparou e quase US$ 45 bilhões em valor de mercado sumiram em uma semana.',source:'m7.terra',date:'2026-10-21'},
   {t:'p',text:'O problema é circular: o lastro da moeda é a confiança no próprio sistema. Quando a confiança vai embora, os dois tokens caem juntos.'},
   {t:'summary',text:'Algorítmica sem reservas depende de um token irmão; numa corrida, a emissão dele dispara e as duas moedas afundam.'},
   {t:'terms',terms:['Stablecoin algorítmica']}
  ]},
  {id:'depeg',title:'Depeg: quando a stablecoin descola',optional:false,sources:['m7.usdc','risks'],blocks:[
   {t:'p',text:'**Depeg** é quando a stablecoin passa a ser negociada longe de US$ 1. Basta muita gente querer vender ao mesmo tempo numa pool sem fundo, ou uma dúvida sobre as reservas.'},
   {t:'interactive',kind:'depeg',caption:'Venda a stablecoin numa pool de 10 milhões de cada lado. Depois marque a dúvida sobre as reservas.',alt:'Controle do volume vendido e caixa da dúvida sobre as reservas. Uma barra mostra o preço na pool.'},
   {t:'data',text:'Em 11 de março de 2023, o USDC perdeu a paridade depois que a Circle informou que US$ 3,3 bilhões, cerca de 8% das reservas, estavam presos no Silicon Valley Bank, que havia quebrado. A paridade voltou quatro dias depois.',source:'m7.usdc',date:'2026-10-21'},
   {t:'p',text:'O caso mostra que mesmo uma stablecoin com reservas de verdade pode descolar. O preço no mercado reage antes de as respostas chegarem.'},
   {t:'summary',text:'Depeg vem de venda concentrada e de dúvida; reservas boas trazem a paridade de volta, mas não impedem o susto.'},
   {t:'terms',terms:['Depeg','Corrida de resgates']}
  ]},
  {id:'usos',title:'Para que as pessoas usam stablecoins',optional:false,sources:['stable','bis'],blocks:[
   {t:'p',text:'Stablecoins são o dinheiro do mercado cripto. Servem para pagar, mandar dinheiro, emprestar em DeFi e guardar valor em dólar sem banco americano.'},
   {t:'figure',svg:figUsos,caption:'Quatro usos comuns. Em todos, a troca é a mesma: sai o risco do preço, entra o risco do emissor.',alt:'Quatro caixas: pagamentos, enviar para fora, DeFi e reserva em dólar.'},
   {t:'data',text:'O ethereum.org cita usos como compras do dia a dia sem vender ETH, emprestar stablecoins para render juros, tomar stablecoins com garantia em cripto e pagar trabalhos e recompensas.',source:'stable',date:'2026-10-21'},
   {t:'example',text:'Alguém no Brasil guarda parte das economias em USDC para se proteger da inflação do real. Fugiu do risco do câmbio, mas passou a depender da Circle, das reservas e da carteira que usa.'},
   {t:'summary',text:'Stablecoins servem para pagar, enviar, render e guardar em dólar, trocando o risco de preço pelo risco do emissor.'},
   {t:'terms',terms:['Stablecoin','Emissor']}
  ]},
  {id:'redes-e-pontes',title:'A mesma stablecoin em várias redes',optional:false,sources:['bridges','m3.arbitrum'],blocks:[
   {t:'p',text:'Uma stablecoin pode existir em várias redes. Às vezes o próprio emissor emite em cada uma (versão nativa). Às vezes uma ponte trava a moeda numa rede e emite uma cópia em outra.'},
   {t:'figure',svg:figPonte,caption:'A versão da ponte soma o risco da ponte ao risco do emissor.',alt:'O emissor emite na rede A; a ponte trava e emite uma versão na rede B, como o USDC.e.'},
   {t:'data',text:'Na Arbitrum, o USDC nativo é emitido direto pela Circle, enquanto o USDC.e é o USDC do Ethereum que passou pela ponte da própria Arbitrum.',source:'m3.arbitrum',date:'2026-10-21'},
   {t:'example',text:'Duas moedas aparecem como "USDC" na mesma carteira, com saldos diferentes. Uma é a nativa, outra a da ponte. Para sacar numa corretora, ela pode aceitar só uma delas.'},
   {t:'summary',text:'Prefira a versão nativa; a versão de ponte depende também da ponte.'},
   {t:'terms',terms:['Ponte','Token embrulhado']}
  ]},
  {id:'regulacao',title:'As leis chegaram',optional:true,sources:['m7.mica','m7.genius'],blocks:[
   {t:'p',text:'Por anos, stablecoins funcionaram sem regra específica. Isso mudou na Europa e nos Estados Unidos, com exigências de reservas e de autorização para emitir.'},
   {t:'data',text:'Na União Europeia, as regras do MiCA para stablecoins passaram a valer em 30 de junho de 2024, e o restante do regulamento, em 30 de dezembro de 2024.',source:'m7.mica',date:'2026-10-21'},
   {t:'data',text:'Nos Estados Unidos, o GENIUS Act virou lei em 18 de julho de 2025 e exige lastro um para um em dólares ou outros ativos de baixo risco.',source:'m7.genius',date:'2026-10-21'},
   {t:'summary',text:'Europa (MiCA, 2024) e Estados Unidos (GENIUS Act, 2025) passaram a exigir reservas e autorização dos emissores.'},
   {t:'terms',terms:['Reservas','Emissor']}
  ]},
  {id:'concentracao',title:'Concentração: o risco que se repete',optional:true,sources:['risks','bis'],blocks:[
   {t:'p',text:'Uma stablecoin usada como garantia em vários protocolos espalha o próprio risco por todos eles. Cinco pools com a mesma moeda não são cinco riscos separados: são o mesmo risco, cinco vezes.'},
   {t:'example',text:'No susto do USDC em 2023, pools e empréstimos que usavam USDC sofreram juntos, inclusive stablecoins que tinham USDC como garantia.'},
   {t:'summary',text:'Diversificar entre protocolos não ajuda se todos dependem da mesma stablecoin.'},
   {t:'terms',terms:['Stablecoin']}
  ]},
  {id:'ler-relatorio',title:'Como ler um relatório de reservas',optional:true,sources:['bis','m7.tether'],blocks:[
   {t:'p',text:'Relatórios de reservas parecem técnicos, mas dá para conferir o essencial com poucas perguntas.'},
   {t:'table',caption:'Perguntas para cada relatório',headers:['Pergunta','O que procurar'],rows:[
    ['Qual a data?','Quanto mais antigo, menos diz sobre hoje'],
    ['É atestação ou auditoria?','Atestação confere uma afirmação; auditoria examina tudo'],
    ['O que compõe as reservas?','Dinheiro e títulos curtos são mais líquidos'],
    ['Quem pode resgatar, e como?','Prazo, valor mínimo e quem tem acesso'],
    ['Vale para qual rede e versão?','A versão de ponte pode ficar de fora']
   ]},
   {t:'summary',text:'Data, tipo de relatório, composição, regras de resgate e versão coberta: cinco perguntas para cada relatório.'},
   {t:'terms',terms:['Atestação','Reservas']}
  ]}
 ],
 quiz:[
  ['Uma stablecoin sempre vale exatamente US$ 1?',['Sim, por lei','Não: a paridade é uma meta e pode falhar','Só nos fins de semana','Só as algorítmicas'],1,'O preço de mercado pode se afastar de US$ 1 quando há dúvida ou venda concentrada.'],
  ['A stablecoin está a US$ 0,98. O que faz quem pode resgatar no emissor?',['Vende mais','Espera','Compra no mercado e resgata a US$ 1','Reclama nas redes'],2,'A arbitragem compra barato e resgata a US$ 1, empurrando o preço para cima.'],
  ['Por que o tipo de reserva importa numa corrida?',['Não importa','Porque só reservas que viram dinheiro rápido pagam todos os pedidos','Porque reservas rendem juros','Por causa do logotipo'],1,'Dinheiro e títulos curtos pagam no mesmo dia; empréstimos e cripto podem não pagar.'],
  ['Qual a diferença entre atestação e auditoria?',['Nenhuma','A atestação é mais completa','A auditoria vale só um dia','A atestação confere uma afirmação numa data; a auditoria examina as contas inteiras'],3,'"Reservas atestadas" é uma foto de um dia, com escopo combinado.'],
  ['O que é sobrecolateralização?',['Ter mais de US$ 1 em garantia por moeda emitida','Ter menos garantia que dívida','Usar só dólar','Emitir sem garantia'],0,'A folga absorve quedas da garantia em cripto.'],
  ['O que derrubou a UST da Terra em 2022?',['Um ataque hacker ao Bitcoin','Uma lei nova','Uma corrida que fez a emissão de LUNA disparar e as duas moedas caírem','A falência de um banco'],2,'Sem reservas, o lastro era o token irmão; quando ele afundou, a paridade foi junto.'],
  ['Por que o USDC descolou em março de 2023?',['Por um erro de digitação','Parte das reservas ficou presa num banco que quebrou','A Circle fechou','Foi proibido'],1,'Cerca de 8% das reservas estavam no Silicon Valley Bank.'],
  ['Ao guardar dinheiro em stablecoin, que risco você troca pelo quê?',['O risco do preço pelo risco do emissor','Nenhum','O risco do emissor pelo risco do preço','O risco da rede pelo do banco'],0,'Sai a volatilidade da cripto, entra a dependência do emissor e das reservas.'],
  ['A versão de uma stablecoin trazida por ponte depende de quê?',['Só do emissor','Só da rede','Do emissor e da ponte','De nada'],2,'Se a ponte falhar, a versão dela pode descolar mesmo com o emissor bem.'],
  ['Cinco pools diferentes com a mesma stablecoin diversificam o risco?',['Sim, totalmente','Sim, se forem em redes diferentes','Só se forem auditadas','Não: todas dependem do mesmo emissor'],3,'O risco do emissor se repete em todas elas.']
 ],
 sources:{
  'm7.tether':['Wikipedia · Tether','https://en.wikipedia.org/wiki/Tether_(cryptocurrency)','Lançamento em 2014, composição das reservas, multa da CFTC em 2021, atestações e auditoria.'],
  'm7.usdc':['Wikipedia · USD Coin','https://en.wikipedia.org/wiki/USD_Coin','Lançamento em 2018 e o descolamento de março de 2023 com o Silicon Valley Bank.'],
  'm7.dai':['Wikipedia · Dai','https://en.wikipedia.org/wiki/Dai_(cryptocurrency)','Lançamento em 2017, empréstimos sobrecolateralizados, liquidação e a mudança para Sky/USDS.'],
  'm7.terra':['Wikipedia · Terra (blockchain)','https://en.wikipedia.org/wiki/Terra_(blockchain)','Mecanismo da UST com LUNA e o colapso de maio de 2022.'],
  'm7.mica':['Wikipedia · Markets in Crypto-Assets','https://en.wikipedia.org/wiki/Markets_in_Crypto-Assets','Datas de aplicação do MiCA na União Europeia.'],
  'm7.genius':['Wikipedia · GENIUS Act','https://en.wikipedia.org/wiki/GENIUS_Act','Lei americana de stablecoins, de julho de 2025.']
 },
 glossary:[
  ['Paridade','O valor que uma stablecoin tenta manter, normalmente US$ 1.'],
  ['Resgate','Trocar a stablecoin pelo valor de referência diretamente com o emissor.'],
  ['Arbitragem','Comprar onde está barato e vender onde está caro, o que aproxima os preços.'],
  ['Reservas','Ativos guardados pelo emissor para pagar os resgates.'],
  ['Corrida de resgates','Muita gente querendo resgatar ao mesmo tempo, mais do que as reservas pagam na hora.'],
  ['Atestação','Conferência, por um contador, de uma afirmação da empresa numa data. Mais estreita que uma auditoria.'],
  ['Sobrecolateralização','Ter mais garantia do que dívida, como mais de US$ 1 em cripto por moeda emitida.'],
  ['Stablecoin algorítmica','Stablecoin sem reservas externas, que tenta manter o preço com regras de emissão e um token irmão.'],
  ['Emissor','Empresa ou sistema que cria a stablecoin e responde pelos resgates.']
 ]
});
})();
