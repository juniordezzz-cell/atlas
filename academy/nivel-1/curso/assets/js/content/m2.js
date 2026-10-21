/* Módulo 2: Blockchain (formato novo, 21/10/2026). Figuras em SVG no topo;
   os interativos (kind) moram em academy-interativos.js e a cena "camadas"
   em academy-3d.js. Fatos conferidos nas fontes em 21/10/2026. */
(function(){
const F='font-family="inherit"';
const C={azul:'#60a5fa',ciano:'#67e8f9',violeta:'#a78bfa',verm:'#f87171',fundo:'#111c30',linha:'#2a3b55',mudo:'#a9b8cf',texto:'#e2e8f0'};
const tx=(x,y,t,tam,cor,peso,ancora)=>'<text x="'+x+'" y="'+y+'" text-anchor="'+(ancora||'middle')+'" font-size="'+tam+'"'+(peso?' font-weight="'+peso+'"':'')+' fill="'+cor+'">'+t+'</text>';
const ret=(x,y,w,h,cor)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="8" fill="'+C.fundo+'" stroke="'+cor+'" stroke-width="2"/>';
const seta=(x1,y1,x2,y2,cor)=>'<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+(cor||C.mudo)+'" stroke-width="2"/>';

/* Quatro nós com a mesma cópia do registro. */
const copia=(x,y,nome)=>ret(x,y,140,92,C.azul)+tx(x+70,y+22,nome,14,C.texto,700)
 +tx(x+12,y+44,'#1 Ana → Bruno 2',11,C.mudo,0,'start')+tx(x+12,y+62,'#2 Bruno → Caio 1',11,C.mudo,0,'start')+tx(x+12,y+80,'#3 Caio → Davi 1',11,C.mudo,0,'start');
const figLivro='<svg viewBox="0 0 640 240" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +copia(10,20,'Nó A')+copia(170,20,'Nó B')+copia(330,20,'Nó C')+copia(490,20,'Nó D')
 +seta(150,66,170,66)+seta(310,66,330,66)+seta(470,66,490,66)
 +tx(320,150,'Cada nó guarda a mesma lista e confere as regras sozinho.',14,C.texto)
 +tx(320,178,'Se um nó mudar a cópia dele, os outros não aceitam.',13,C.mudo)
 +tx(320,212,'Ninguém precisa confiar num livro central.',13,C.ciano)+'</svg>';

/* Cabeçalho de um bloco do Bitcoin. */
const campo=(y,t,cor)=>ret(30,y,300,34,cor)+tx(46,y+22,t,13,C.texto,0,'start');
const figCabecalho='<svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +tx(180,22,'Cabeçalho do bloco',14,C.texto,700)
 +campo(36,'hash do bloco anterior',C.ciano)+campo(76,'raiz de Merkle das transações',C.azul)+campo(116,'horário e dificuldade',C.linha)+campo(156,'nonce',C.violeta)
 +ret(370,36,250,154,C.linha)+tx(495,62,'Transações',14,C.texto,700)
 +['Ana → Bruno','Caio → Eva','Davi → Ana','…'].map((t,k)=>tx(390,90+k*24,t,12,C.mudo,0,'start')).join('')
 +seta(330,93,370,93,C.azul)
 +tx(320,222,'Mudar uma transação muda a raiz; mudar a raiz muda o hash do bloco,',12,C.mudo)
 +tx(320,242,'e o bloco seguinte deixa de apontar para ele.',12,C.mudo)+'</svg>';

/* Bloco que quebra as regras é recusado por todos os nós honestos. */
const figRegras='<svg viewBox="0 0 640 230" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +ret(20,70,200,90,C.verm)+tx(120,100,'Bloco proposto',14,C.texto,700)+tx(120,124,'cria 1.000 moedas',12,C.mudo)+tx(120,142,'fora da regra',12,C.mudo)
 +[0,1,2].map(k=>{const y=20+k*70;return seta(220,115,400,y+25)+ret(400,y,220,50,C.linha)+tx(510,y+30,'Nó '+'ABC'[k]+': ✗ recusa',13,C.texto);}).join('')
 +tx(320,222,'Quem produz o bloco propõe; quem verifica decide se aceita.',13,C.ciano)+'</svg>';

AcademyContent.register({
 id:'m2',
 title:'Blockchain',
 icon:'boxes',
 summary:'Blocos de dados ligados por hash, conferidos por milhares de computadores: veja como uma rede registra, ordena e protege cada transação.',
 minutes:70,
 goals:[
  'Explicar o que uma blockchain registra e por que os blocos ficam encadeados',
  'Seguir uma transação da carteira até a finalidade',
  'Comparar prova de trabalho e prova de participação',
  'Diferenciar UTXO e contas, L1, rollup e sidechain, e entender taxas e oráculos'
 ],
 flow:['Carteira assina','Nó recebe e propaga','Transação pendente','Produtor propõe bloco','Nós verificam','Confirmação / finalidade'],
 history:{
  intro:'Antes do Bitcoin já existiam as peças: carimbos de data feitos com hash e um jeito de provar que alguém gastou trabalho de computador. Faltava juntar tudo numa rede sem dono, em que qualquer um confere e ninguém consegue reescrever o passado sozinho.',
  timeline:[
   {when:'1991',title:'Carimbo de data com hash',text:'Stuart Haber e W. Scott Stornetta publicaram "How to time-stamp a digital document". A ideia: encadear registros com hashes, para que mudar um documento antigo fique evidente. O documento do Bitcoin cita esse trabalho.'},
   {when:'1997',title:'Hashcash: prova de trabalho',text:'Adam Back propôs o Hashcash, um "selo" que custa processamento para fabricar e é fácil de conferir. Era um freio contra spam. O Bitcoin usou uma prova de trabalho parecida.'},
   {when:'3 jan 2009',title:'Nasce a rede Bitcoin',text:'Satoshi Nakamoto minerou o bloco gênese. Dentro dele ficou o título do jornal The Times daquele dia, sobre um novo socorro aos bancos.'},
   {when:'30 jul 2015',title:'Ethereum entra no ar',text:'A rede Ethereum começou a funcionar, com contas e contratos que rodam código.'},
   {when:'15 set 2022',title:'The Merge',text:'O Ethereum trocou a prova de trabalho pela prova de participação. Mineradores saíram e validadores com ETH em stake entraram.'},
   {when:'13 mar 2024',title:'Dados mais baratos para rollups',text:'A atualização Dencun criou os "blobs", um espaço de dados mais barato pensado para as redes de segunda camada.'}
  ]
 },
 lessons:[
  {id:'o-que-registra',title:'O que uma blockchain registra',optional:false,sources:['bitcoin','nodes'],blocks:[
   {t:'p',text:'Uma **blockchain** é uma lista de registros que só cresce. Cada registro diz quem passou o quê para quem. Os registros são agrupados em **blocos**, e cada bloco aponta para o anterior. Daí o nome: corrente de blocos.'},
   {t:'figure',svg:figLivro,caption:'A mesma lista existe em milhares de computadores, os nós. Cada um confere as regras por conta própria.',alt:'Quatro caixas, Nó A, B, C e D, cada uma com a mesma lista de três transferências. Embaixo: ninguém precisa confiar num livro central.'},
   {t:'p',text:'A lista não fica num servidor de uma empresa. Ela é copiada em milhares de computadores, os **nós**. Cada nó recebe as novidades, confere se seguem as regras e guarda sua cópia.'},
   {t:'analogy',text:'Imagine um caderno de contas da turma, copiado por todo mundo. Se alguém apagar uma linha no próprio caderno, os outros cadernos continuam iguais e denunciam a mudança.'},
   {t:'p',text:'Ter cópias espalhadas não basta. Quando duas pessoas propõem novidades ao mesmo tempo, a rede precisa escolher uma única ordem. Essa escolha é o **consenso**, assunto das próximas aulas.'},
   {t:'example',text:'Alice tem 2 moedas e tenta pagar 2 a Bruno e 2 a Caio ao mesmo tempo. As regras só deixam um desses pagamentos entrar na história aceita. Esse golpe se chama gasto duplo.'},
   {t:'summary',text:'Uma blockchain é uma lista de transações agrupadas em blocos encadeados, copiada e conferida por muitos nós, que precisam concordar sobre uma única ordem.'},
   {t:'terms',terms:['Blockchain','Bloco','Nó','Consenso']}
  ]},
  {id:'bloco',title:'Bloco: dados com ligação ao passado',optional:false,sources:['m2.btc-chain','bitcoin'],blocks:[
   {t:'p',text:'Um bloco tem duas partes: o **cabeçalho** e a lista de transações. No Bitcoin, o cabeçalho guarda o hash do bloco anterior, a raiz de Merkle das transações e um número chamado **nonce**.'},
   {t:'figure',svg:figCabecalho,caption:'O cabeçalho resume o bloco. A raiz de Merkle resume todas as transações, e o hash do anterior prende o bloco ao passado.',alt:'Cabeçalho do bloco com quatro campos: hash do bloco anterior, raiz de Merkle das transações, horário e dificuldade, nonce. Ao lado, a lista de transações.'},
   {t:'scene',kind:'cadeia',caption:'Cada bloco guarda o hash do bloco anterior. Mude os dados de um bloco e o hash dele muda: o bloco seguinte deixa de bater. Os hashes aqui são encurtados e ilustrativos.',alt:'Quatro blocos em fila, ligados. Cada um mostra o próprio hash e o hash do anterior. Ao alterar o bloco 2, o hash dele muda e a ligação com o bloco 3 se rompe.'},
   {t:'p',text:'Lembra do hash, do Módulo 1? Mudar uma vírgula muda o resumo inteiro. Se alguém altera uma transação antiga, a raiz de Merkle muda, o hash do bloco muda e o bloco seguinte, que guardava o hash antigo, deixa de bater.'},
   {t:'p',text:'O encadeamento torna a mudança **visível**, mas não a torna impossível sozinho. Quem quisesse mentir poderia recalcular todos os blocos seguintes. O que impede isso é o custo de refazer o trabalho ou de perder o stake, como você vai ver adiante.'},
   {t:'summary',text:'Cada bloco guarda o hash do anterior, então mudar algo antigo quebra a corrente de forma visível; o consenso é o que torna caro refazê-la.'},
   {t:'terms',terms:['Bloco','Hash','Árvore de Merkle','Nonce']}
  ]},
  {id:'carteira-no-explorador',title:'Carteira, nó e explorador: cada um faz uma coisa',optional:false,sources:['nodes','tx'],blocks:[
   {t:'p',text:'Três peças aparecem sempre que você usa uma blockchain. A **carteira** monta a transação e assina com sua chave privada. O **nó** recebe, confere as regras e repassa. O **explorador de blocos** é um site que lê os dados de um nó e mostra de um jeito fácil.'},
   {t:'interactive',kind:'papeis',caption:'Avance passo a passo e veja a transação sair da carteira, passar pelos nós e aparecer no explorador.',alt:'Diagrama: Carteira, Seu nó, três outros nós e o Explorador. Um pacote marcado tx anda entre eles a cada passo.'},
   {t:'p',text:'Muitas carteiras não rodam um nó próprio. Elas usam um serviço RPC, que é o nó de uma empresa. Funciona, mas você passa a confiar no que esse serviço responde.'},
   {t:'p',text:'O explorador é uma vitrine, não a rede. Se o site estiver fora do ar ou mostrar algo errado, a blockchain continua igual. Para conferir de verdade, só rodando um nó.'},
   {t:'example',text:'A carteira mostra "enviado", mas o explorador não acha nada. Confira se você está olhando a rede certa (Ethereum, Base, Arbitrum…) e use o identificador da transação, o hash dela.'},
   {t:'summary',text:'A carteira assina, o nó confere e repassa, e o explorador só mostra; quem confere as regras é sempre o nó.'},
   {t:'terms',terms:['Nó','Explorador de blocos','Chave privada']}
  ]},
  {id:'transacao',title:'A vida de uma transação, do clique à finalidade',optional:false,sources:['tx','pos'],blocks:[
   {t:'p',text:'Uma transação passa por várias etapas antes de virar história. Você monta, assina, transmite, ela espera numa fila, entra num bloco e, com o tempo, fica cada vez mais difícil de desfazer.'},
   {t:'interactive',kind:'transacao',caption:'As seis etapas de uma transação e o status que a carteira costuma mostrar em cada uma.',alt:'Linha do tempo com seis etapas: Montar, Assinar, Transmitir, Fila, Bloco e Finalidade. A etapa atual fica destacada.'},
   {t:'p',text:'A fila de transações pendentes se chama **mempool**. Cada nó tem a sua, e elas não são idênticas. Quando há muita procura, quem paga taxa maior tende a entrar antes.'},
   {t:'p',text:'No Ethereum, cada conta tem um contador chamado **nonce**, que coloca as transações dela em ordem. A transação de número 8 só entra depois da 7.'},
   {t:'example',text:'Você enviou uma transação com taxa baixa e ela travou. Algumas carteiras deixam "acelerar": reenviar com o mesmo nonce e taxa maior. Só uma das duas pode entrar, porque as duas ocupam o mesmo número.'},
   {t:'summary',text:'Montar, assinar, transmitir, esperar na fila, entrar num bloco e ganhar finalidade: "enviado" na carteira ainda não é "registrado".'},
   {t:'terms',terms:['Mempool','Nonce','Finalidade']}
  ]},
  {id:'regras-e-historia',title:'Conferir regras é diferente de escolher a história',optional:false,sources:['nodes','bitcoin'],blocks:[
   {t:'p',text:'Duas coisas diferentes acontecem numa blockchain. A **validação** confere se um bloco segue as regras: assinaturas certas, ninguém gastando o que não tem, nenhuma moeda criada fora da regra. O **consenso** escolhe uma ordem única quando aparecem propostas concorrentes.'},
   {t:'figure',svg:figRegras,caption:'Um bloco que quebra as regras é recusado pelos nós honestos, não importa quem o produziu.',alt:'Um bloco proposto que cria mil moedas fora da regra envia setas para três nós. Cada nó mostra um X: recusa.'},
   {t:'p',text:'Quem produz o bloco só propõe. Um minerador grande ou um validador importante não consegue fazer um nó honesto aceitar uma transação inválida. O nó simplesmente descarta o bloco.'},
   {t:'analogy',text:'O juiz da partida escolhe quem bate o pênalti, mas não pode decidir que o gol vale três pontos. As regras do jogo valem para todos, e cada torcedor com o livro de regras pode conferir.'},
   {t:'summary',text:'Validar é conferir as regras; consenso é escolher a ordem entre blocos válidos. Produzir um bloco não dá o poder de mudar as regras.'},
   {t:'terms',terms:['Consenso','Nó']}
  ]},
  {id:'prova-de-trabalho',title:'Prova de trabalho: gastar energia para propor',optional:false,sources:['bitcoin','m2.btc-chain'],blocks:[
   {t:'p',text:'No Bitcoin, para propor um bloco é preciso achar um **nonce** que faça o hash do cabeçalho ficar abaixo de um alvo, ou seja, começar com muitos zeros. Não há atalho: é tentar número após número. Isso é a **mineração**.'},
   {t:'interactive',kind:'mineracao',caption:'Hash SHA-256 calculado de verdade no seu navegador. Com 4 zeros, a busca pode levar alguns segundos. A dificuldade real do Bitcoin é incomparavelmente maior.',alt:'Campo com os dados do bloco, escolha de dificuldade, o nonce atual, o hash resultante e a contagem de tentativas.'},
   {t:'p',text:'Achar é difícil, conferir é fácil. Qualquer nó refaz um único hash e vê se o bloco cumpre o alvo. Por isso a prova de trabalho é uma prova: mostra que alguém gastou processamento de verdade.'},
   {t:'data',text:'A cada 2.016 blocos, a rede Bitcoin recalcula a dificuldade, mirando duas semanas para esse grupo de blocos. Isso dá, em média, um bloco a cada 10 minutos.',source:'m2.btc-chain',date:'2026-10-21'},
   {t:'p',text:'Quando surgem dois blocos válidos ao mesmo tempo, os nós seguem a corrente que exigiu mais trabalho acumulado. Para reescrever o passado, um atacante teria de refazer esse trabalho mais rápido que o resto da rede inteira.'},
   {t:'example',text:'Muito poder de mineração permitiria a um atacante reorganizar blocos recentes e censurar transações. Não permitiria gastar as moedas de outra pessoa: para isso ele precisaria das chaves dela.'},
   {t:'summary',text:'Na prova de trabalho, propor um bloco custa processamento, conferir é barato e a rede segue a corrente com mais trabalho acumulado.'},
   {t:'terms',terms:['Prova de trabalho','Mineração','Nonce']}
  ]},
  {id:'prova-de-participacao',title:'Prova de participação: dinheiro em jogo',optional:false,sources:['pos','m2.forks'],blocks:[
   {t:'p',text:'Na **prova de participação**, ninguém queima energia para propor. Os **validadores** travam moedas como garantia, o **stake**. A rede sorteia quem propõe cada bloco, e os outros votam se ele está certo.'},
   {t:'interactive',kind:'validadores',caption:'Sorteie quem propõe e veja que mais stake significa mais chances. Depois veja o que acontece com quem vota em dois blocos ao mesmo tempo.',alt:'Cinco validadores com barras de stake de tamanhos diferentes. Botões sorteiam quem propõe e simulam uma punição por voto duplo.'},
   {t:'data',text:'No Ethereum, o tempo é dividido em slots de 12 segundos e épocas de 32 slots. Para virar validador, é preciso depositar 32 ETH no contrato de depósito.',source:'pos',date:'2026-10-21'},
   {t:'p',text:'A punição é o que dá segurança. Quem assina votos que se contradizem, ou propõe dois blocos no mesmo slot, sofre **slashing**: parte do stake é destruída e o validador é expulso. Ficar fora do ar dá uma penalidade menor, que é outra coisa.'},
   {t:'data',text:'O Ethereum trocou a prova de trabalho pela prova de participação em 15 de setembro de 2022, na atualização chamada Paris, conhecida como The Merge.',source:'m2.forks',date:'2026-10-21'},
   {t:'summary',text:'Na prova de participação, validadores arriscam o próprio stake: quem tem mais stake propõe mais, e quem trapaceia perde parte dele.'},
   {t:'terms',terms:['Prova de participação','Validador','Staking','Slashing']}
  ]},
  {id:'confirmacao-e-finalidade',title:'Confirmação, reorganização e finalidade',optional:false,sources:['pos','m2.btc-chain'],blocks:[
   {t:'p',text:'Entrar num bloco é o começo, não o fim. Às vezes dois blocos válidos aparecem quase juntos e a rede se divide por um instante. Os nós seguem o lado que crescer mais. O bloco do outro lado é abandonado: isso é uma **reorganização**.'},
   {t:'interactive',kind:'reorg',caption:'Faça os dois ramos crescerem. Quando o ramo B passa o A, a rede troca de história e a transação do bloco A3 volta para a fila.',alt:'Dois blocos em comum se dividem em ramo A e ramo B. Botões acrescentam blocos a cada ramo. O ramo seguido fica destacado.'},
   {t:'p',text:'Cada bloco que entra depois do seu é uma **confirmação**. Quanto mais confirmações, mais trabalho um atacante teria de refazer, e menor o risco de reorganização. Não existe um número mágico: depende da rede e do valor em jogo.'},
   {t:'data',text:'No Ethereum, quando um par de checkpoints recebe votos de pelo menos dois terços de todo o ETH em stake, o mais antigo fica finalizado. Desfazer um bloco finalizado exigiria destruir uma enorme quantidade de ETH.',source:'pos',date:'2026-10-21'},
   {t:'example',text:'Uma loja que vende um café pode aceitar o pagamento assim que ele entra num bloco. Uma imobiliária deveria esperar a finalidade, ou várias confirmações no Bitcoin.'},
   {t:'summary',text:'Inclusão, confirmações e finalidade são graus crescentes de segurança; reorganizações recentes são possíveis, e o tempo de espera deve acompanhar o valor.'},
   {t:'terms',terms:['Confirmação','Reorganização','Finalidade']}
  ]},
  {id:'utxo-e-contas',title:'UTXO e contas: duas formas de guardar saldo',optional:false,sources:['utxo','m2.btc-tx'],blocks:[
   {t:'p',text:'O Bitcoin não guarda "saldos". Ele guarda moedas soltas, as **UTXOs** (saídas ainda não gastas). Seu saldo é a soma das moedas que suas chaves podem gastar, como notas na carteira.'},
   {t:'interactive',kind:'utxo',caption:'O mesmo pagamento nos dois modelos. Do lado do Bitcoin, as moedas gastas ficam vermelhas e viram pagamento mais troco. Valores de exemplo.',alt:'Controle para escolher o valor. À esquerda, três moedas de 0,5, 0,3 e 0,2 que viram pagamento e troco. À direita, uma conta cujo saldo diminui.'},
   {t:'p',text:'Uma moeda é sempre gasta **inteira**. Se você tem uma de 0,5 e quer pagar 0,3, a transação consome a de 0,5 e cria duas novas: 0,3 para quem recebe e o troco para você. O que sobra entre entradas e saídas fica de taxa.'},
   {t:'p',text:'O Ethereum usa o **modelo de contas**: cada endereço tem um saldo que sobe e desce, como uma conta bancária. Fica mais simples para contratos, que precisam guardar estado.'},
   {t:'example',text:'Você junta três moedas pequenas para pagar algo grande. Quem olhar a transação vê que as três pertencem à mesma pessoa. No UTXO, a escolha das moedas afeta a privacidade.'},
   {t:'summary',text:'No UTXO, moedas inteiras são gastas e geram troco; no modelo de contas, um saldo sobe e desce. Nenhum dos dois é melhor para tudo.'},
   {t:'terms',terms:['UTXO','Modelo de contas']}
  ]},
  {id:'taxas-e-espaco',title:'Taxas, espaço no bloco e demanda',optional:false,sources:['gas','m2.forks'],blocks:[
   {t:'p',text:'Cada bloco tem espaço limitado. Quando há mais transações do que espaço, começa um leilão: quem oferece mais taxa tende a entrar primeiro. Por isso a taxa muda com a hora do dia e com a agitação do mercado.'},
   {t:'interactive',kind:'taxas',caption:'Escolha sua taxa e veja se você entra nos 5 lugares do próximo bloco. Na hora de pico, chegam transações dispostas a pagar mais. Valores de exemplo.',alt:'Controle da sua taxa, cinco vagas do próximo bloco preenchidas pelas maiores taxas e a fila de quem ficou de fora.'},
   {t:'p',text:'No Ethereum, o trabalho de cada operação é medido em **gas**. Uma transferência simples de ETH usa 21.000 unidades; chamar um contrato complexo usa bem mais. O valor transferido não importa: mandar 1 ou 1.000 ETH custa o mesmo gas.'},
   {t:'data',text:'Desde a atualização London, de 5 de agosto de 2021, a taxa do Ethereum tem duas partes: a taxa base, que é queimada e sai de circulação, e a gorjeta para o validador, que ajuda a entrar antes.',source:'m2.forks',date:'2026-10-21'},
   {t:'summary',text:'Espaço no bloco é escasso: com muita demanda, a taxa sobe. No Ethereum, o custo depende do gas gasto pela operação, não do valor enviado.'},
   {t:'terms',terms:['Gas','Mempool']}
  ]},
  {id:'l1-rollup-sidechain',title:'L1, rollup e sidechain',optional:false,sources:['scaling','bridges'],blocks:[
   {t:'p',text:'A **L1** é a rede base, como o Ethereum. Ela é segura, mas cara e com espaço limitado. Para caber mais gente, surgiram redes que rodam por cima ou ao lado dela.'},
   {t:'scene',kind:'camadas',caption:'O rollup junta muitas transações num lote e manda para a L1 os dados ou uma prova. A sidechain tem consenso próprio e conversa com a L1 por uma ponte. Arraste para girar.',alt:'Uma placa larga embaixo, a L1. Em cima, à esquerda, o rollup, de onde um lote desce para a L1. À direita, a sidechain, ligada à L1 por uma ponte tracejada.'},
   {t:'p',text:'O **rollup** executa as transações fora da L1 e publica nela um resumo. No rollup otimista, tudo vale até que alguém conteste com uma prova de fraude. No rollup de conhecimento zero (ZK), cada lote vem com uma prova de validade que a L1 confere.'},
   {t:'p',text:'A **sidechain** é uma blockchain separada, com suas próprias regras de consenso, ligada à L1 por uma **ponte**. A segurança dela é dela, não da L1.'},
   {t:'example',text:'Uma taxa de centavos num rollup não garante a mesma proteção da L1. Pergunte: dá para sair com meus fundos se o operador sumir? Quem controla as chaves de atualização? Como funciona a ponte?'},
   {t:'summary',text:'Rollups publicam resumos e provas na L1 e herdam parte da segurança dela; sidechains têm consenso próprio e dependem da ponte.'},
   {t:'terms',terms:['Rollup','Camada 2','Sidechain','Ponte']}
  ]},
  {id:'oraculos',title:'Oráculos: dados de fora entram com hipóteses',optional:false,sources:['oracle','m2.chainlink'],blocks:[
   {t:'p',text:'Uma blockchain só sabe o que está dentro dela. Ela não sabe o preço do ouro, o resultado de um jogo ou a temperatura de hoje. Para isso existem os **oráculos**: serviços que trazem dados de fora para dentro da rede.'},
   {t:'interactive',kind:'oraculo',caption:'Mexa no preço lá fora e passe o tempo. O contrato só vê o valor novo quando o oráculo atualiza. Regras de exemplo.',alt:'Fontes externas, o oráculo e o contrato. Um controle muda o preço lá fora; o contrato mostra o último valor recebido, a diferença e há quantas horas foi a última atualização.'},
   {t:'data',text:'Nos feeds de preço da Chainlink, vários operadores independentes publicam valores, e um contrato junta as respostas. O feed atualiza quando o preço se afasta mais que um limite de desvio ou quando passa um tempo máximo, o que acontecer primeiro.',source:'m2.chainlink',date:'2026-10-21'},
   {t:'p',text:'O oráculo é um ponto de confiança. Pergunte de onde vêm os dados, quantas fontes existem, de quanto em quanto tempo atualizam e o que acontece se pararem.'},
   {t:'example',text:'Um protocolo de empréstimo usa o preço do oráculo para decidir quem será liquidado. Se o preço atrasar numa queda rápida, o protocolo pode liquidar tarde demais ou na hora errada.'},
   {t:'summary',text:'Oráculos trazem dados externos para a blockchain; eles podem atrasar ou errar, e o contrato herda essas fraquezas.'},
   {t:'terms',terms:['Oráculo']}
  ]},
  {id:'disponibilidade-de-dados',title:'Disponibilidade de dados',optional:true,sources:['scaling','m2.forks'],blocks:[
   {t:'p',text:'Conferir uma prova não basta se ninguém consegue baixar os dados por trás dela. Sem os dados, não dá para reconstruir os saldos nem contestar um resultado errado. Esse problema se chama **disponibilidade de dados**.'},
   {t:'p',text:'Rollups publicam seus dados na L1 justamente para que qualquer um possa recalcular tudo. Algumas soluções guardam os dados fora da L1 para economizar. Fica mais barato, mas você passa a confiar em quem guarda.'},
   {t:'data',text:'A atualização Dencun do Ethereum, de 13 de março de 2024, trouxe os blobs (EIP-4844), um espaço de dados mais barato pensado para rollups.',source:'m2.forks',date:'2026-10-21'},
   {t:'summary',text:'Além de a conta estar certa, os dados precisam estar disponíveis para que qualquer pessoa possa conferir e sair sem depender do operador.'},
   {t:'terms',terms:['Disponibilidade de dados','Rollup']}
  ]},
  {id:'mev-e-ordem',title:'MEV: quem escolhe a ordem pode lucrar',optional:true,sources:['mev','risks'],blocks:[
   {t:'p',text:'Quem monta o bloco decide a ordem das transações. Às vezes a ordem vale dinheiro: arbitragens, liquidações e o ataque sanduíche, em que alguém compra antes de você e vende logo depois. Esse lucro se chama **MEV**.'},
   {t:'p',text:'A tolerância de preço (slippage) da sua troca limita o estrago, mas uma tolerância larga demais vira convite. Simular a operação e usar envio protegido ajudam, cada um com suas próprias hipóteses.'},
   {t:'example',text:'Você pede uma troca aceitando até 5% de diferença. Um robô vê sua ordem na fila, compra antes e empurra o preço para perto desse limite, e você executa no pior preço que aceitou.'},
   {t:'summary',text:'A ordem das transações vale dinheiro; tolerância de preço apertada e envio protegido reduzem a exposição ao MEV.'},
   {t:'terms',terms:['MEV','Mempool']}
  ]},
  {id:'forks-e-governanca',title:'Forks e governança',optional:true,sources:['m2.forks','risks'],blocks:[
   {t:'p',text:'Um **fork** é uma mudança de regras. Se todos atualizam, a rede segue junta. Se uma parte recusa, podem surgir duas redes com histórias incompatíveis.'},
   {t:'p',text:'Quem decide? Desenvolvedores propõem, quem roda nós escolhe se atualiza, validadores e mineradores produzem blocos e usuários decidem o que usar. Em redes governadas por token, poucos detentores grandes podem concentrar o voto.'},
   {t:'example',text:'Uma votação aprovada por três carteiras grandes muda a taxa de um protocolo. O código é público, mas a decisão foi de poucos. Código aberto não quer dizer decisão distribuída.'},
   {t:'summary',text:'Forks mudam as regras; vale olhar quem propõe, quem aprova e quem pode recusar uma mudança.'},
   {t:'terms',terms:['Fork']}
  ]},
  {id:'avaliar-uma-rede',title:'Como avaliar uma rede sem slogans',optional:true,sources:['nodes','scaling','bridges'],blocks:[
   {t:'p',text:'"Rápida", "barata" e "segura" são promessas. Para comparar redes de verdade, faça as mesmas perguntas a todas e anote as respostas com fonte.'},
   {t:'table',caption:'Perguntas para comparar redes',headers:['Pergunta','Por que importa'],rows:[
    ['Qualquer pessoa consegue rodar um nó?','Se só datacenters conseguem, poucos conferem as regras'],
    ['Quantos produzem blocos e quem são?','Poucos produtores facilitam censura e conluio'],
    ['Quanto tempo até a finalidade?','Define quanto esperar antes de considerar um pagamento definitivo'],
    ['Onde ficam os dados?','Sem dados disponíveis, ninguém confere nem sai sozinho'],
    ['Quem pode mudar o código?','Chaves de atualização concentradas são um risco'],
    ['Como funcionam as pontes?','Pontes estão entre os alvos de ataque mais frequentes']
   ]},
   {t:'summary',text:'Compare redes com as mesmas perguntas sobre verificação, produção de blocos, finalidade, dados, governança e pontes, não pelo número de transações por segundo.'},
   {t:'terms',terms:['Nó','Ponte']}
  ]}
 ],
 quiz:[
  ['Por que mudar uma transação antiga fica evidente numa blockchain?',['Porque o explorador avisa por e-mail','Porque o hash do bloco muda e o bloco seguinte deixa de bater','Porque a transação fica com outra cor','Porque a carteira trava'],1,'Cada bloco guarda o hash do anterior. Mudar uma transação muda a raiz de Merkle e o hash do bloco, e a corrente se rompe.'],
  ['Quem confere se um bloco segue as regras?',['O explorador de blocos','A marca da carteira','Os nós, cada um por conta própria','Só quem produziu o bloco'],2,'Cada nó confere as regras sozinho e recusa blocos inválidos, não importa quem os produziu.'],
  ['A carteira mostra "enviado". O que isso garante?',['Que a transação já está finalizada','Que ela foi transmitida, mas talvez ainda esteja na fila','Que o destinatário já gastou o dinheiro','Nada, a carteira inventa o status'],1,'Enviado quer dizer transmitido. A transação ainda precisa entrar num bloco e ganhar confirmações ou finalidade.'],
  ['Na prova de trabalho, o que é difícil e o que é fácil?',['Achar o nonce é difícil; conferir é fácil','Os dois são fáceis','Conferir é difícil; achar é fácil','Os dois são impossíveis'],0,'Achar exige muitas tentativas de hash; conferir exige refazer um único cálculo.'],
  ['O que acontece com um validador que vota em dois blocos conflitantes no Ethereum?',['Ganha um bônus','Nada','Sofre slashing: perde parte do stake e é expulso','Vira minerador'],2,'Votos contraditórios são punidos com slashing, que destrói parte do stake e remove o validador.'],
  ['O que é uma reorganização?',['A rede trocar para um ramo com mais trabalho ou mais votos, abandonando blocos recentes','Apagar a blockchain inteira','Trocar a senha da carteira','Mudar o preço do token'],0,'Quando outro ramo válido fica mais pesado, os nós passam a segui-lo, e os blocos do ramo antigo saem da história.'],
  ['Você tem moedas (UTXOs) de 0,5 e quer pagar 0,3 BTC. O que acontece?',['A moeda de 0,5 é cortada ao meio','A moeda de 0,5 é gasta inteira e gera 0,3 para o destinatário mais troco para você','O pagamento é recusado','O saldo da conta diminui sem troco'],1,'No UTXO, moedas são gastas inteiras. A transação cria uma saída para quem recebe e outra de troco; a diferença vira taxa.'],
  ['No Ethereum, mandar 1 ETH ou 1.000 ETH numa transferência simples custa…',['1.000 vezes mais gas','Um percentual do valor','O mesmo gas: 21.000 unidades','Nada'],2,'O gas mede o trabalho da operação, não o valor. Uma transferência simples usa 21.000 unidades.'],
  ['Uma sidechain tem a mesma segurança da L1?',['Sim, sempre','Sim, se usar EVM','Não: tem consenso próprio e depende da ponte','Só aos domingos'],2,'A sidechain tem suas próprias regras de consenso. Usar a mesma linguagem de contratos não transfere a segurança da L1.'],
  ['Por que um contrato precisa de um oráculo para saber o preço do ouro?',['Porque a blockchain só conhece o que está dentro dela','Porque o ouro é proibido em blockchain','Porque o oráculo minera ouro','Não precisa, ele descobre sozinho'],0,'Dados externos não chegam sozinhos. O oráculo traz esses dados, e o contrato passa a depender dele.']
 ],
 sources:{
  'm2.btc-chain':['Bitcoin Developer Guide · Block Chain','https://developer.bitcoin.org/devguide/block_chain.html','Cabeçalho do bloco, ajuste de dificuldade a cada 2.016 blocos e forks.'],
  'm2.btc-tx':['Bitcoin Developer Guide · Transactions','https://developer.bitcoin.org/devguide/transactions.html','UTXOs gastos inteiros e saída de troco.'],
  'm2.forks':['Ethereum.org · Histórico de atualizações','https://ethereum.org/ethereum-forks/','Datas do Frontier (2015), London (2021), Paris/The Merge (2022) e Dencun (2024).'],
  'm2.chainlink':['Chainlink · Data Feeds Architecture','https://docs.chain.link/architecture-overview/architecture-decentralized-model','Vários operadores, agregação no contrato, limite de desvio e tempo máximo.'],
  'm2.hashcash':['Wikipedia · Hashcash','https://en.wikipedia.org/wiki/Hashcash','Proposto por Adam Back em 1997.'],
  'm2.historia':['Wikipedia · History of bitcoin','https://en.wikipedia.org/wiki/History_of_bitcoin','Bloco gênese em 3 de janeiro de 2009 e o título do The Times.']
 },
 glossary:[
  ['Blockchain','Lista de registros agrupados em blocos, em que cada bloco guarda o hash do anterior. É copiada e conferida por muitos computadores.'],
  ['Bloco','Pacote de transações com um cabeçalho que guarda, entre outras coisas, o hash do bloco anterior.'],
  ['Nó','Computador que guarda uma cópia da blockchain, confere as regras e repassa transações e blocos.'],
  ['Consenso','Mecanismo pelo qual a rede escolhe uma única ordem de blocos quando há propostas concorrentes.'],
  ['Explorador de blocos','Site que lê os dados de um nó e mostra transações, blocos e endereços. Não é a rede, só uma vitrine.'],
  ['Mempool','Fila de transações transmitidas que ainda não entraram num bloco. Cada nó tem a sua.'],
  ['Prova de trabalho','Consenso em que propor um bloco exige achar, por tentativa, um hash abaixo de um alvo. Usado pelo Bitcoin.'],
  ['Mineração','Busca, por tentativa e erro, de um nonce que deixe o hash do bloco abaixo do alvo da rede.'],
  ['Prova de participação','Consenso em que validadores travam moedas como garantia e podem perdê-las se trapacearem. Usado pelo Ethereum desde 2022.'],
  ['Validador','Participante que travou stake e propõe e vota em blocos numa rede de prova de participação.'],
  ['Slashing','Punição que destrói parte do stake de um validador que assinou votos contraditórios ou propôs dois blocos no mesmo slot.'],
  ['Confirmação','Cada bloco que entra depois do bloco que contém sua transação.'],
  ['Reorganização','Troca do ramo seguido pela rede, que tira da história os blocos recentes do ramo abandonado.'],
  ['Modelo de contas','Forma de guardar estado em que cada endereço tem um saldo que sobe e desce. Usado pelo Ethereum.'],
  ['Camada 2','Rede construída sobre uma L1 para processar mais transações, apoiando-se na segurança dela. Rollups são o tipo principal.'],
  ['Sidechain','Blockchain separada, com consenso próprio, ligada a outra rede por uma ponte.'],
  ['Ponte','Sistema que move ativos ou mensagens entre redes diferentes. Tem suas próprias regras e riscos.'],
  ['Disponibilidade de dados','Garantia de que os dados de um bloco ou lote podem ser baixados por qualquer pessoa para conferir o resultado.'],
  ['MEV','Valor que quem ordena as transações de um bloco consegue extrair escolhendo a ordem, incluindo ou excluindo transações.'],
  ['Fork','Mudança nas regras de uma blockchain. Se parte da rede não acompanha, podem surgir duas redes separadas.']
 ]
});
})();
