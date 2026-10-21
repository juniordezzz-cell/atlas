/* Módulo 10: Sistema financeiro global (formato novo, 21/10/2026). Figuras em
   SVG no topo; os interativos (kind) moram em academy-interativos.js. Fatos
   conferidos nas fontes em 21/10/2026. */
(function(){
const F='font-family="inherit"';
const C={azul:'#60a5fa',ciano:'#67e8f9',violeta:'#a78bfa',verm:'#f87171',ambar:'#fcd34d',fundo:'#111c30',linha:'#2a3b55',mudo:'#a9b8cf',texto:'#e2e8f0'};
const tx=(x,y,t,tam,cor,peso,ancora)=>'<text x="'+x+'" y="'+y+'" text-anchor="'+(ancora||'middle')+'" font-size="'+tam+'"'+(peso?' font-weight="'+peso+'"':'')+' fill="'+cor+'">'+t+'</text>';
const ret=(x,y,w,h,cor)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="10" fill="'+C.fundo+'" stroke="'+cor+'" stroke-width="2"/>';
const seta=(x1,y1,x2,y2,cor)=>'<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+(cor||C.mudo)+'" stroke-width="2"/>';

/* As três funções do dinheiro. */
const funcao=(x,t,s1,s2,cor)=>ret(x,40,195,140,cor)+tx(x+97,74,t,16,C.texto,700)+tx(x+97,106,s1,13,C.mudo)+tx(x+97,126,s2,13,C.mudo);
const figFuncoes='<svg viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +tx(320,24,'O que faz algo ser dinheiro',14,C.texto,700)
 +funcao(10,'Meio de troca','todo mundo aceita','como pagamento',C.ciano)
 +funcao(222,'Unidade de conta','os preços são','escritos nele',C.azul)
 +funcao(434,'Reserva de valor','guardar hoje para','gastar amanhã',C.violeta)
 +tx(320,208,'O real cumpre as três no Brasil. O bitcoin cumpre algumas, para algumas pessoas.',13,C.mudo)+'</svg>';

/* Pagamento, compensação e liquidação. */
const etapa=(x,t,s,cor)=>ret(x,60,190,90,cor)+tx(x+95,94,t,16,C.texto,700)+tx(x+95,120,s,13,C.mudo);
const figLiquidacao='<svg viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +etapa(10,'Ordem','"pague R$ 100"',C.linha)+etapa(225,'Compensação','quem deve a quem',C.azul)+etapa(440,'Liquidação','o dinheiro muda de mão',C.ciano)
 +seta(200,105,225,105)+seta(415,105,440,105)
 +tx(320,40,'O pagamento só termina na liquidação',14,C.texto,700)
 +tx(320,190,'No cartão, entre a compra e a liquidação podem passar dias. Numa blockchain, as três etapas',12,C.mudo)
 +tx(320,208,'acontecem juntas, mas só na moeda da própria rede.',12,C.mudo)+'</svg>';

/* Trilhos de pagamento. */
const trilho=(y,t,s,cor)=>ret(30,y,580,34,cor)+tx(46,y+22,t,14,C.texto,700,'start')+tx(594,y+22,s,13,C.mudo,0,'end');
const figTrilhos='<svg viewBox="0 0 640 230" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +trilho(10,'Pix','instantâneo, 24 h, no Brasil, em reais',C.ciano)
 +trilho(52,'Cartão','aprova na hora; o dinheiro chega à loja depois',C.azul)
 +trilho(94,'TED e transferências bancárias','em dias úteis, no Brasil',C.linha)
 +trilho(136,'Transferência internacional','vários bancos no caminho, pode levar dias',C.ambar)
 +trilho(178,'Stablecoin numa blockchain','minutos, qualquer hora; entrar e sair custa',C.violeta)
 +tx(320,226,'Cada trilho tem custo, horário e alcance diferentes.',12,C.mudo)+'</svg>';

/* Três dinheiros digitais. */
const dinheiro=(x,t,quem,risco,cor)=>ret(x,30,195,160,cor)+tx(x+97,62,t,16,C.texto,700)+tx(x+97,96,'quem emite:',12,C.mudo)+tx(x+97,116,quem,13,C.texto)+tx(x+97,150,'risco:',12,C.mudo)+tx(x+97,170,risco,13,C.texto);
const figTres='<svg viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +dinheiro(10,'Depósito no banco','o seu banco','o banco quebrar',C.azul)
 +dinheiro(222,'Stablecoin','uma empresa','o emissor e as reservas',C.ciano)
 +dinheiro(434,'CBDC','o banco central','privacidade e controle',C.violeta)
 +tx(320,212,'Os três são "reais digitais" ou "dólares digitais", mas cada um é a promessa de alguém diferente.',12,C.mudo)+'</svg>';

/* Onde está a confiança. */
const ponto=(x,y,t,cor)=>ret(x,y,180,44,cor)+tx(x+90,y+28,t,14,C.texto);
const figConfianca='<svg viewBox="0 0 640 230" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +ret(230,90,180,50,C.ciano)+tx(320,121,'Sua operação',15,C.texto,700)
 +ponto(20,20,'Emissor da moeda',C.ambar)+ponto(230,20,'Rede e validadores',C.azul)+ponto(440,20,'Oráculos',C.violeta)
 +ponto(20,170,'Corretora de entrada',C.ambar)+ponto(230,170,'Ponte entre redes',C.ambar)+ponto(440,170,'Corretora de saída',C.ambar)
 +seta(110,64,280,90)+seta(320,64,320,90)+seta(530,64,360,90)+seta(110,170,280,140)+seta(320,170,320,140)+seta(530,170,360,140)
 +tx(320,226,'Blockchain tira alguns intermediários, não todos. Em amarelo, onde ainda há uma empresa.',12,C.mudo)+'</svg>';

AcademyContent.register({
 id:'m10',
 title:'Sistema financeiro global',
 icon:'globe',
 summary:'Como o dinheiro de verdade circula, de onde ele nasce e onde a blockchain melhora, ou não, pagamentos, remessas e a liquidação de ativos.',
 minutes:50,
 goals:[
  'Explicar as funções do dinheiro e como os bancos criam dinheiro ao emprestar',
  'Separar pagamento, compensação e liquidação',
  'Comparar trilhos de pagamento e o custo completo de uma remessa',
  'Entender entrega contra pagamento, CBDCs e onde a confiança continua'
 ],
 flow:['Pagador','Conversão / intermediário','Transferência','Liquidação','Recebedor'],
 history:{
  intro:'O sistema financeiro é uma rede de promessas entre bancos, bancos centrais e empresas de pagamento. A blockchain propõe outro jeito de registrar essas promessas, mas o problema de fundo, saber quem deve a quem e quando paga, é antigo.',
  timeline:[
   {when:'26 jun 1974',title:'O caso Herstatt',text:'Reguladores alemães fecham o banco Herstatt no fim do dia. Bancos que já tinham entregado marcos alemães ficam sem receber os dólares: nasce o nome do risco de liquidação em câmbio.'},
   {when:'2014',title:'Bancos criam dinheiro',text:'O Banco da Inglaterra explica que a maior parte do dinheiro da economia moderna é criada por bancos comerciais quando fazem empréstimos.'},
   {when:'nov 2020',title:'Pix',text:'O Banco Central do Brasil lança o Pix: transferências instantâneas, 24 horas por dia, gratuitas entre pessoas.'},
   {when:'mar 2024',title:'Moedas digitais de banco central',text:'Bancos centrais de 134 países, com 98% do PIB mundial, estudam ou testam uma moeda digital própria.'},
   {when:'2025',title:'Remessas ainda caras',text:'No terceiro trimestre, mandar US$ 200 para outro país custa em média 6,36% do valor, segundo o Banco Mundial. A meta da ONU é ficar abaixo de 3% até 2030.'}
  ]
 },
 lessons:[
  {id:'o-que-e-dinheiro',title:'O que faz algo ser dinheiro',optional:false,sources:['m10.money'],blocks:[
   {t:'p',text:'Dinheiro é o que as pessoas aceitam em troca de qualquer coisa. Para funcionar bem, ele precisa cumprir três papéis ao mesmo tempo.'},
   {t:'figure',svg:figFuncoes,caption:'As três funções clássicas do dinheiro.',alt:'Três caixas: meio de troca, unidade de conta e reserva de valor.'},
   {t:'data',text:'As funções principais do dinheiro são meio de troca, unidade de conta e reserva de valor; alguns autores incluem ainda o padrão para pagamentos futuros.',source:'m10.money',date:'2026-10-21'},
   {t:'p',text:'Uma moeda muito volátil falha como unidade de conta: ninguém quer preços que mudam toda hora. É por isso que as stablecoins, e não o bitcoin, viraram o "dinheiro" do dia a dia dentro do mercado cripto.'},
   {t:'summary',text:'Dinheiro é meio de troca, unidade de conta e reserva de valor; ativos voláteis falham principalmente na segunda.'},
   {t:'terms',terms:['Unidade de conta','Stablecoin']}
  ]},
  {id:'bancos-criam-dinheiro',title:'Bancos criam dinheiro ao emprestar',optional:false,sources:['m10.boe'],blocks:[
   {t:'p',text:'Muita gente acha que o banco empresta o dinheiro que alguém depositou. Na prática, quando o banco aprova um empréstimo, ele cria um depósito novo na conta de quem tomou. É dinheiro que não existia.'},
   {t:'interactive',kind:'balanco',caption:'Um banco simples. Faça um empréstimo e depois uma corrida de saques. Valores de exemplo.',alt:'Balanço com o que o banco tem (reservas e empréstimos) e o que deve (depósitos e capital). Botões para emprestar, simular uma corrida e recomeçar.'},
   {t:'data',text:'Pelo Banco da Inglaterra, a maior parte do dinheiro da economia moderna é criada por bancos comerciais quando fazem empréstimos, e não ao repassar depósitos de poupadores.',source:'m10.boe',date:'2026-10-21'},
   {t:'p',text:'Por isso o depósito no banco é uma promessa do banco, e o banco guarda só uma parte em reservas. Se todos pedirem ao mesmo tempo, ele não tem como pagar sem ajuda. É a mesma corrida das stablecoins, com séculos de história.'},
   {t:'summary',text:'Empréstimos criam depósitos; o saldo no banco é uma promessa, sustentada por reservas e pelo banco central.'},
   {t:'terms',terms:['Corrida de resgates','Reservas']}
  ]},
  {id:'pagamento-e-liquidacao',title:'Pagar não é o mesmo que liquidar',optional:false,sources:['m10.herstatt','bis'],blocks:[
   {t:'p',text:'Quando você paga com cartão, a compra é aprovada na hora, mas o dinheiro só chega à loja depois. Entre a ordem de pagamento e a **liquidação**, quando o dinheiro muda de mão de verdade, há etapas e prazos.'},
   {t:'figure',svg:figLiquidacao,caption:'Ordem, compensação e liquidação. Enquanto não liquida, alguém está exposto.',alt:'Três etapas em sequência: ordem, compensação e liquidação.'},
   {t:'data',text:'Em 26 de junho de 1974, o banco alemão Herstatt foi fechado no fim do dia. Bancos que já tinham pago marcos alemães esperando receber dólares em Nova York não receberam. O risco de liquidação em câmbio ganhou o nome do banco.',source:'m10.herstatt',date:'2026-10-21'},
   {t:'p',text:'Numa blockchain, ordem e liquidação acontecem na mesma transação. Mas isso só vale para o que existe na própria rede. Se a operação envolve real ou dólar de banco, as etapas antigas continuam do lado de fora.'},
   {t:'summary',text:'Pagamento só termina na liquidação; blockchain encurta isso dentro da rede, não fora dela.'},
   {t:'terms',terms:['Liquidação financeira']}
  ]},
  {id:'remessas',title:'Mandar dinheiro para outro país',optional:false,sources:['m10.remessa','stable'],blocks:[
   {t:'p',text:'Remessas internacionais passam por vários bancos e conversões de moeda. Cada etapa cobra uma taxa ou embute uma diferença no câmbio. É uma das áreas onde as stablecoins mais prometem.'},
   {t:'interactive',kind:'remessa',caption:'Três caminhos para mandar US$ 500. Mexa no custo de converter a stablecoin na moeda do destino. Custos de exemplo.',alt:'Três barras com quanto chega pelo banco, pela empresa de remessa e pela stablecoin. Um controle muda o custo de saída da stablecoin.'},
   {t:'data',text:'Segundo o Banco Mundial, no terceiro trimestre de 2025 o custo médio de mandar US$ 200 para outro país foi de 6,36% do valor. A meta da ONU é ficar abaixo de 3% até 2030.',source:'m10.remessa',date:'2026-10-21'},
   {t:'p',text:'A taxa da rede costuma ser centavos. O custo de verdade está nas pontas: comprar a stablecoin e, principalmente, trocá-la pela moeda de quem recebe. Compare o valor que chega, não a taxa anunciada.'},
   {t:'summary',text:'Remessa barata depende das pontas; compare o valor líquido recebido em cada caminho.'},
   {t:'terms',terms:['Remessa','Stablecoin']}
  ]},
  {id:'trilhos',title:'Os trilhos do dinheiro',optional:false,sources:['m10.pix','bis'],blocks:[
   {t:'p',text:'O dinheiro anda por **trilhos de pagamento**: sistemas com regras, horários e participantes próprios. O Pix mudou a vida no Brasil porque juntou velocidade, custo zero para pessoas e funcionamento 24 horas.'},
   {t:'figure',svg:figTrilhos,caption:'Cinco trilhos e o que cada um oferece.',alt:'Cinco faixas: Pix, cartão, TED, transferência internacional e stablecoin numa blockchain, cada uma com sua característica principal.'},
   {t:'data',text:'O Pix, criado e administrado pelo Banco Central do Brasil, foi lançado em novembro de 2020 e permite transferências instantâneas e gratuitas entre pessoas, em reais, 24 horas por dia.',source:'m10.pix',date:'2026-10-21'},
   {t:'p',text:'Dentro do Brasil, em reais, o Pix já faz quase tudo o que uma stablecoin faria. A vantagem da blockchain aparece entre países, entre moedas e quando o dinheiro precisa ser programável.'},
   {t:'summary',text:'Cada trilho tem seu alcance; o Pix resolve o pagamento doméstico, e a blockchain disputa o internacional e o programável.'},
   {t:'terms',terms:['Trilho de pagamento']}
  ]},
  {id:'tres-dinheiros',title:'Depósito, stablecoin e CBDC',optional:false,sources:['m10.cbdc','stable'],blocks:[
   {t:'p',text:'Existem três jeitos de ter dinheiro digital, e cada um é a promessa de alguém diferente: o depósito é do banco, a stablecoin é da empresa emissora e a **CBDC** (moeda digital de banco central) é do próprio banco central.'},
   {t:'figure',svg:figTres,caption:'Quem emite e qual o risco principal de cada dinheiro digital.',alt:'Três caixas: depósito no banco, emitido pelo banco; stablecoin, emitida por uma empresa; e CBDC, emitida pelo banco central, cada uma com seu risco.'},
   {t:'data',text:'Em março de 2024, bancos centrais de 134 países, que somam 98% do PIB mundial, estavam avaliando uma moeda digital própria. Bahamas, Jamaica e Nigéria já lançaram as suas.',source:'m10.cbdc',date:'2026-10-21'},
   {t:'p',text:'A CBDC tem o emissor mais seguro, mas levanta perguntas sobre privacidade e controle: o banco central poderia ver ou limitar cada pagamento? O desenho de cada país decide isso.'},
   {t:'summary',text:'Depósito, stablecoin e CBDC parecem iguais na tela, mas têm emissores, riscos e regras diferentes.'},
   {t:'terms',terms:['CBDC','Emissor']}
  ]},
  {id:'entrega-contra-pagamento',title:'Entrega contra pagamento',optional:false,sources:['m10.dvp','m10.herstatt'],blocks:[
   {t:'p',text:'Numa venda de títulos, um lado entrega o ativo e o outro paga. Se isso acontece em momentos diferentes, quem entregou primeiro corre o risco de o outro quebrar no meio. A **entrega contra pagamento** (DvP) faz as duas coisas juntas.'},
   {t:'interactive',kind:'dvp',caption:'Compare entrega e pagamento separados com DvP, com e sem a quebra do comprador.',alt:'Caixas de Ana, que vende, e Bruno, que compra. Botões escolhem o modo e fazem a operação, normal ou com a quebra do comprador.'},
   {t:'data',text:'DvP é a liquidação em que a entrega dos títulos e o pagamento acontecem ao mesmo tempo. Ela elimina o risco de um lado entregar o dinheiro e o outro não entregar os títulos.',source:'m10.dvp',date:'2026-10-21'},
   {t:'p',text:'Uma blockchain faz DvP naturalmente quando título e dinheiro estão na mesma rede: a troca é atômica, como você viu no Módulo 5. É um dos motivos de bancos e gestoras estudarem a tokenização.'},
   {t:'summary',text:'DvP troca ativo e dinheiro juntos e elimina o risco de um lado; blockchain faz isso quando os dois estão na rede.'},
   {t:'terms',terms:['Entrega contra pagamento','Liquidação financeira']}
  ]},
  {id:'onde-esta-a-confianca',title:'Onde a confiança continua',optional:false,sources:['bis','risks'],blocks:[
   {t:'p',text:'A blockchain tira alguns intermediários, mas não todos. Para uma operação real funcionar, ainda há emissores, corretoras de entrada e saída, pontes e oráculos. Cada um é uma empresa em que você confia.'},
   {t:'figure',svg:figConfianca,caption:'Os pontos de confiança em volta de uma operação com cripto. Em amarelo, onde ainda há uma empresa no caminho.',alt:'Uma operação no centro ligada a seis pontos: emissor da moeda, rede e validadores, oráculos, corretora de entrada, ponte entre redes e corretora de saída.'},
   {t:'p',text:'A pergunta certa não é "tem blockchain?", e sim "em quem eu preciso confiar, e o que acontece se ele falhar?". Um sistema com blockchain e um emissor fraco pode ser pior que um sistema tradicional bem regulado.'},
   {t:'example',text:'Você recebe salário em stablecoin numa corretora estrangeira e troca para reais numa corretora brasileira. A blockchain no meio funciona; as duas corretoras e o emissor são os elos frágeis.'},
   {t:'summary',text:'Mapeie todos os pontos de confiança de uma operação; a blockchain reduz alguns, não elimina a necessidade de confiar.'},
   {t:'terms',terms:['Emissor','Ponte']}
  ]},
  {id:'integracao',title:'Juntando tudo: explique uma operação inteira',optional:true,sources:['bis','risks'],blocks:[
   {t:'p',text:'Escolha uma operação real, como "mandar R$ 1.000 para um amigo em Portugal usando USDC", e explique cada passo com o que você aprendeu nos dez módulos.'},
   {t:'table',caption:'Roteiro para explicar qualquer operação',headers:['Etapa','Módulo que ajuda'],rows:[
    ['Quem autoriza e como (chaves, assinatura)','Criptografia'],
    ['Onde fica registrado e quando é final','Blockchain'],
    ['Quem guarda a chave','Carteiras'],
    ['Que contratos e taxas estão no caminho','Smart contracts e DeFi'],
    ['O que sustenta a moeda usada','Stablecoins'],
    ['Que riscos e custos se acumulam','Gestão de risco'],
    ['Por onde o dinheiro entra e sai','Sistema financeiro']
   ]},
   {t:'summary',text:'Explicar uma operação do começo ao fim é o melhor teste do que você aprendeu.'},
   {t:'terms',terms:['Liquidação financeira']}
  ]},
  {id:'dolar-digital',title:'Dólar digital em países de moeda fraca',optional:true,sources:['stable','m7.usdc'],blocks:[
   {t:'p',text:'Em países com inflação alta ou controle de câmbio, stablecoins em dólar viraram um jeito de guardar valor e receber pagamentos do exterior. É talvez o uso mais concreto das criptomoedas hoje.'},
   {t:'p',text:'O outro lado: quem faz isso troca a moeda do próprio país pela promessa de uma empresa privada estrangeira, com riscos de emissor, de corretora e de regras locais.'},
   {t:'summary',text:'Stablecoin em dólar protege da inflação local, mas troca esse risco pelo risco do emissor e das corretoras.'},
   {t:'terms',terms:['Stablecoin','Emissor']}
  ]},
  {id:'interoperabilidade',title:'Muitas redes, muitas moedas',optional:true,sources:['bridges','bis'],blocks:[
   {t:'p',text:'Hoje existem várias blockchains, várias stablecoins e vários sistemas de pagamento que não conversam entre si. Fazer o dinheiro passar de um para outro exige pontes, corretoras ou bancos.'},
   {t:'p',text:'Cada conexão é mais um ponto de confiança e de custo. A promessa de um "sistema financeiro na internet" depende de resolver essa fragmentação com segurança.'},
   {t:'summary',text:'Interoperabilidade é o desafio central: cada ponte entre sistemas soma custo e risco.'},
   {t:'terms',terms:['Ponte']}
  ]}
 ],
 quiz:[
  ['Quais são as três funções clássicas do dinheiro?',['Meio de troca, unidade de conta e reserva de valor','Rápido, barato e digital','Ouro, prata e cobre','Crédito, débito e Pix'],0,'São as funções que os livros de economia citam.'],
  ['De onde vem a maior parte do dinheiro numa economia moderna?',['Da Casa da Moeda','Dos mineradores','Dos empréstimos feitos pelos bancos comerciais','Dos impostos'],2,'Empréstimos criam depósitos novos.'],
  ['O que é liquidação?',['A ordem de pagamento','O momento em que o dinheiro muda de mão de verdade','A aprovação do cartão','Uma promoção'],1,'Antes da liquidação, alguém ainda está exposto.'],
  ['O que aconteceu no caso Herstatt, em 1974?',['Um banco criou o Pix','Uma stablecoin quebrou','Um hacker roubou bitcoins','Bancos pagaram uma moeda e não receberam a outra quando o banco foi fechado'],3,'Foi o exemplo clássico do risco de liquidação em câmbio.'],
  ['Numa remessa com stablecoin, onde costuma estar o maior custo?',['Na taxa da rede','Na entrada e, principalmente, na saída para a moeda local','No gas da ponte','Não há custo'],1,'A rede é barata; as pontas é que pesam.'],
  ['Dentro do Brasil, em reais, qual trilho já oferece pagamento instantâneo e gratuito entre pessoas?',['Pix','TED','Boleto','Cheque'],0,'O Pix funciona 24 horas e é gratuito para pessoas.'],
  ['Quem emite uma CBDC?',['Uma corretora','Um minerador','Uma empresa de stablecoin','O banco central'],3,'CBDC é a moeda digital do próprio banco central.'],
  ['O que a entrega contra pagamento (DvP) elimina?',['O risco de um lado entregar e o outro não pagar','A necessidade de dinheiro','Os impostos','O risco de preço'],0,'Ativo e dinheiro trocam de mão juntos, ou nada acontece.'],
  ['Usar blockchain elimina a necessidade de confiar em intermediários?',['Sim, totalmente','Só no Bitcoin','Não: emissores, corretoras, pontes e oráculos continuam','Só com CBDC'],2,'A blockchain reduz alguns intermediários, não todos.'],
  ['Segundo o Banco Mundial, quanto custava em média mandar US$ 200 para outro país no fim de 2025?',['Cerca de 1%','Cerca de 6,4%','Cerca de 20%','Nada'],1,'O custo médio foi de 6,36% no terceiro trimestre de 2025.']
 ],
 sources:{
  'm10.money':['Wikipedia · Money','https://en.wikipedia.org/wiki/Money','Funções do dinheiro.'],
  'm10.boe':['Bank of England · Money creation in the modern economy','https://www.bankofengland.co.uk/quarterly-bulletin/2014/q1/money-creation-in-the-modern-economy','A maior parte do dinheiro é criada por bancos ao emprestar (2014).'],
  'm10.herstatt':['Wikipedia · Herstatt risk','https://en.wikipedia.org/wiki/Herstatt_risk','Risco de liquidação em câmbio e o fechamento do Herstatt em 1974.'],
  'm10.remessa':['Wikipedia · Remittance','https://en.wikipedia.org/wiki/Remittance','Custo médio de remessas segundo o Banco Mundial e a meta da ONU.'],
  'm10.pix':['Wikipedia · Pix','https://en.wikipedia.org/wiki/Pix_(payment_system)','Sistema de pagamentos instantâneos do Banco Central do Brasil, lançado em 2020.'],
  'm10.cbdc':['Wikipedia · Central bank digital currency','https://en.wikipedia.org/wiki/Central_bank_digital_currency','Definição de CBDC e países que estudam ou já lançaram.'],
  'm10.dvp':['Wikipedia · Delivery versus payment','https://en.wikipedia.org/wiki/Delivery_versus_payment','Liquidação em que entrega e pagamento acontecem juntos.']
 },
 glossary:[
  ['Unidade de conta','Função do dinheiro de medir preços. Moeda que muda muito de valor falha nela.'],
  ['Liquidação financeira','Momento em que o dinheiro muda de mão de verdade e a obrigação termina.'],
  ['Remessa','Dinheiro enviado de um país para outro, normalmente por quem trabalha fora para a família.'],
  ['Trilho de pagamento','Sistema por onde o dinheiro circula, com regras e participantes próprios, como Pix, cartão ou SWIFT.'],
  ['CBDC','Moeda digital emitida diretamente por um banco central.'],
  ['Entrega contra pagamento','Liquidação em que ativo e dinheiro trocam de mão ao mesmo tempo, ou nenhum dos dois.']
 ]
});
})();
