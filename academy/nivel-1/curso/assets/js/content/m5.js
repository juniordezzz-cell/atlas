/* Módulo 5: Smart contracts e Web3 (formato novo, 21/10/2026). Figuras em SVG
   no topo; os interativos (kind) moram em academy-interativos.js. Fatos
   conferidos nas fontes em 21/10/2026. */
(function(){
const F='font-family="inherit"';
const C={azul:'#60a5fa',ciano:'#67e8f9',violeta:'#a78bfa',verm:'#f87171',ambar:'#fcd34d',fundo:'#111c30',linha:'#2a3b55',mudo:'#a9b8cf',texto:'#e2e8f0'};
const tx=(x,y,t,tam,cor,peso,ancora)=>'<text x="'+x+'" y="'+y+'" text-anchor="'+(ancora||'middle')+'" font-size="'+tam+'"'+(peso?' font-weight="'+peso+'"':'')+' fill="'+cor+'">'+t+'</text>';
const ret=(x,y,w,h,cor)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="10" fill="'+C.fundo+'" stroke="'+cor+'" stroke-width="2"/>';
const seta=(x1,y1,x2,y2,cor)=>'<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+(cor||C.mudo)+'" stroke-width="2"/>';

/* Ler é de graça; escrever é transação. */
const figLeitura='<svg viewBox="0 0 640 240" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +ret(15,15,295,170,C.ciano)+tx(162,45,'Ler (consulta)',18,C.texto,700)
 +tx(30,78,'"Qual é meu saldo?"',14,C.mudo,0,'start')+tx(30,104,'• um nó responde na hora',14,C.texto,0,'start')+tx(30,128,'• não vai para a blockchain',14,C.texto,0,'start')+tx(30,152,'• não paga taxa',14,C.ciano,0,'start')
 +ret(330,15,295,170,C.ambar)+tx(477,45,'Escrever (transação)',18,C.texto,700)
 +tx(345,78,'"Deposite 1 ETH"',14,C.mudo,0,'start')+tx(345,104,'• você assina',14,C.texto,0,'start')+tx(345,128,'• entra num bloco e muda o estado',14,C.texto,0,'start')+tx(345,152,'• paga gas, mesmo se falhar',14,C.ambar,0,'start')
 +tx(320,222,'Por isso abrir um site Web3 e olhar saldos não custa nada.',13,C.mudo)+'</svg>';

/* O contrato no explorador. */
const aba=(x,t,cor)=>ret(x,58,130,34,cor)+tx(x+65,80,t,14,C.texto);
const figExplorador='<svg viewBox="0 0 640 250" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +ret(10,10,620,230,C.linha)+tx(26,40,'Contrato 0xC0FE…1234',16,C.texto,700,'start')+tx(614,40,'✓ código verificado',14,C.ciano,0,'end')
 +aba(26,'Código',C.ciano)+aba(166,'Ler',C.linha)+aba(306,'Escrever',C.linha)+aba(446,'Eventos',C.linha)
 +tx(30,124,'function sacar(uint valor) {',14,C.mudo,0,'start')+tx(54,148,'require(saldo[msg.sender] >= valor);',14,C.mudo,0,'start')+tx(54,172,'saldo[msg.sender] -= valor;',14,C.mudo,0,'start')+tx(30,196,'}',14,C.mudo,0,'start')
 +tx(320,228,'Verificado = o código publicado bate com o que roda na rede. Não quer dizer seguro.',13,C.ambar)+'</svg>';

/* O contrato não acorda sozinho. */
const figAutomacao='<svg viewBox="0 0 640 230" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +ret(20,70,170,90,C.violeta)+tx(105,100,'Robô (keeper)',15,C.texto,700)+tx(105,124,'vigia e paga',13,C.mudo)+tx(105,142,'a taxa',13,C.mudo)
 +ret(235,70,170,90,C.azul)+tx(320,100,'Contrato',15,C.texto,700)+tx(320,124,'só age quando',13,C.mudo)+tx(320,142,'alguém chama',13,C.mudo)
 +ret(450,70,170,90,C.ciano)+tx(535,100,'Oráculo',15,C.texto,700)+tx(535,124,'informa o',13,C.mudo)+tx(535,142,'preço lá de fora',13,C.mudo)
 +seta(190,115,235,115)+seta(450,115,405,115)
 +tx(320,40,'Uma liquidação precisa de duas coisas: o preço e alguém que envie a transação.',13,C.texto)
 +tx(320,200,'Se o robô parar ou o oráculo atrasar, o contrato espera.',13,C.ambar)+'</svg>';

/* Camadas de confiança de um protocolo. */
const camada=(y,t,s,cor)=>ret(40,y,560,36,cor)+tx(56,y+23,t,14,C.texto,700,'start')+tx(584,y+23,s,13,C.mudo,0,'end');
const figConfianca='<svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +tx(320,20,'O que você precisa confiar ao usar um protocolo',14,C.texto,700)
 +camada(32,'Código','faz o que promete? foi auditado?',C.azul)
 +camada(74,'Chaves de admin','quem pode mudar, pausar ou atualizar?',C.ambar)
 +camada(116,'Oráculos','de onde vêm os preços?',C.violeta)
 +camada(158,'Outros contratos','tokens e protocolos dos quais depende',C.linha)
 +camada(200,'Interface','o site mostra o que o contrato faz?',C.linha)
 +tx(320,254,'Auditoria reduz o risco da primeira camada; as outras continuam.',13,C.mudo)+'</svg>';

AcademyContent.register({
 id:'m5',
 title:'Smart contracts e Web3',
 icon:'file-code-2',
 summary:'Programas que guardam dinheiro e seguem regras sozinhos: como uma chamada funciona, quanto custa, quando reverte e onde os contratos falham.',
 minutes:60,
 goals:[
  'Explicar o que é um smart contract e seguir uma chamada do site ao evento',
  'Calcular o custo em gas e entender por que uma transação revertida também paga',
  'Reconhecer reentrância e outras falhas clássicas',
  'Avaliar chaves de admin, atualizações e timelock antes de confiar num protocolo'
 ],
 flow:['Interface prepara','Carteira autoriza','Contrato verifica','Estado muda ou reverte','Evento e resultado'],
 history:{
  intro:'A ideia de um contrato que se cumpre sozinho é anterior às blockchains. Faltava um lugar onde o código rodasse sem dono e sem poder ser desligado. O Ethereum ofereceu esse lugar, e o primeiro grande tropeço mostrou quanto custa um erro de código.',
  timeline:[
   {when:'1996',title:'"Smart contracts"',text:'O cientista da computação Nick Szabo já usava o termo para contratos garantidos por software e hardware, não por tribunais. Seu exemplo favorito: a máquina de venda automática.'},
   {when:'30 jul 2015',title:'O Ethereum entra no ar',text:'Uma blockchain feita para rodar programas: qualquer pessoa pode publicar um contrato, e todos os nós executam o mesmo código.'},
   {when:'17 jun 2016',title:'The DAO é atacado',text:'Um fundo coletivo gerido por contrato perde 3,6 milhões de ETH, cerca de um terço do que guardava, por uma falha de chamadas que voltam ao contrato antes de ele terminar.'},
   {when:'20 jul 2016',title:'A rede se divide',text:'O Ethereum muda as regras para devolver o dinheiro às vítimas. Parte da comunidade recusa, e a corrente original continua como Ethereum Classic.'}
  ]
 },
 lessons:[
  {id:'o-que-e',title:'O que é um smart contract',optional:false,sources:['contracts','m5.szabo'],blocks:[
   {t:'p',text:'Um **smart contract** é um programa que mora num endereço da blockchain. Ele tem código (as regras) e estado (os dados, como saldos). Ninguém consegue mudar as regras por fora: elas valem para todos, inclusive para quem criou o contrato.'},
   {t:'interactive',kind:'cofre',caption:'Um cofre simples: cada um saca só o que depositou. Tente quebrar a regra.',alt:'Painel com o estado do contrato (saldos de Ana e Bruno e total) e o registro de eventos. Botões para depositar, sacar e tentar sacar sem saldo.'},
   {t:'data',text:'O ethereum.org compara um smart contract a uma máquina de venda automática: com as entradas certas, a saída é garantida. Qualquer pessoa pode publicar um contrato, pagando o gas da publicação.',source:'contracts',date:'2026-10-21'},
   {t:'p',text:'"Smart" não quer dizer inteligente, e "contract" não quer dizer contrato jurídico. O programa faz exatamente o que o código manda, inclusive os erros.'},
   {t:'summary',text:'Smart contract é um programa com regras e dados num endereço da blockchain; ele cumpre o código, certo ou errado.'},
   {t:'terms',terms:['Smart contract','EVM','Evento']}
  ]},
  {id:'caminho-da-chamada',title:'Do clique ao evento: o caminho de uma chamada',optional:false,sources:['contracts','tx'],blocks:[
   {t:'p',text:'Quando você aperta "Depositar" num site Web3, cinco coisas acontecem em ordem. Saber quem faz cada parte ajuda a entender onde algo pode dar errado.'},
   {t:'interactive',kind:'chamada',caption:'Avance passo a passo. Desmarque "saldo suficiente" para ver o caminho de uma chamada que reverte.',alt:'Linha com cinco etapas: site, carteira, contrato, estado e evento. Uma caixa de seleção troca entre o caminho de sucesso e o de falha.'},
   {t:'p',text:'O site só prepara a chamada; quem tem poder é a sua assinatura. Por isso um site falso é perigoso: ele monta outra chamada e espera que você assine sem ler.'},
   {t:'example',text:'Um botão "Depositar" pode pedir duas assinaturas: primeiro a aprovação do token, depois o depósito. São duas transações, cada uma com sua taxa.'},
   {t:'summary',text:'Site prepara, carteira assina, contrato confere, estado muda (ou reverte) e um evento avisa o resultado.'},
   {t:'terms',terms:['Evento','Revert','Allowance']}
  ]},
  {id:'gas',title:'Gas: quanto custa usar um contrato',optional:false,sources:['gas','m2.forks'],blocks:[
   {t:'p',text:'Cada operação de um contrato custa uma quantidade de **gas**, a unidade de trabalho do Ethereum. A taxa final é o gas usado vezes o preço por unidade, medido em **gwei** (um bilionésimo de ETH).'},
   {t:'interactive',kind:'gascalc',caption:'Escolha a operação e mexa na taxa base, na gorjeta e no preço do ETH. Só o gas da transferência simples é real; os outros são exemplos.',alt:'Seletor de operação e controles de taxa base, gorjeta e preço do ETH. Um quadro mostra o custo em ETH, em dólar, a parte queimada e a parte do validador.'},
   {t:'data',text:'Uma transferência simples de ETH usa 21.000 unidades de gas. A taxa base é queimada; a gorjeta vai para o validador.',source:'gas',date:'2026-10-21'},
   {t:'p',text:'A taxa base sobe quando a rede está cheia e cai quando está vazia. Nas redes de segunda camada o gas é muito mais barato, mas a lógica é a mesma.'},
   {t:'summary',text:'Taxa = gas usado × (taxa base + gorjeta); a base é queimada e o valor enviado não muda a conta.'},
   {t:'terms',terms:['Gas','gwei']}
  ]},
  {id:'ler-e-escrever',title:'Ler é de graça; escrever é transação',optional:false,sources:['tx','contracts'],blocks:[
   {t:'p',text:'Um site Web3 faz dois tipos de pedido. **Ler** é perguntar algo a um nó, como seu saldo: a resposta vem na hora e não custa nada. **Escrever** é mudar o estado: exige assinatura, entra num bloco e paga gas.'},
   {t:'figure',svg:figLeitura,caption:'Consultas são respondidas por um nó sem ir para a blockchain. Transações mudam o estado e pagam taxa.',alt:'Duas colunas. Ler: um nó responde na hora, não vai para a blockchain, não paga taxa. Escrever: você assina, entra num bloco e muda o estado, paga gas mesmo se falhar.'},
   {t:'data',text:'Pelo ethereum.org, funções marcadas como view ou pure não alteram o estado e, chamadas de uma conta comum, não custam gas.',source:'tx',date:'2026-10-21'},
   {t:'example',text:'Abrir um site de empréstimos e ver suas posições é leitura: de graça. Clicar em "Sacar" é escrita: a carteira pede assinatura e taxa.'},
   {t:'summary',text:'Leitura é consulta gratuita a um nó; escrita é transação assinada que muda o estado e paga gas.'},
   {t:'terms',terms:['Chamada de leitura','Gas']}
  ]},
  {id:'tudo-ou-nada',title:'Tudo ou nada: quando a transação reverte',optional:false,sources:['gas','contracts'],blocks:[
   {t:'p',text:'Uma transação é **atômica**: ou todos os passos acontecem, ou nenhum acontece. Se uma regra falha no meio, o contrato **reverte** e a rede desfaz tudo o que já tinha feito.'},
   {t:'interactive',kind:'atomico',caption:'Uma troca que confere o preço mínimo no fim. Mexa no movimento do preço e na diferença aceita, e envie.',alt:'Controles do movimento do preço e da diferença aceita, quatro passos da troca e o saldo final.'},
   {t:'data',text:'O ethereum.org diz que a taxa é paga quer a transação dê certo, quer falhe: se a execução falhar, a rede desfaz as mudanças, mas o gas gasto no trabalho é consumido.',source:'gas',date:'2026-10-21'},
   {t:'p',text:'A **slippage** é a diferença máxima de preço que você aceita numa troca. Apertada demais, a troca reverte à toa; larga demais, você aceita um preço ruim.'},
   {t:'summary',text:'Transação reverte inteira quando uma regra falha; o dinheiro volta, mas a taxa fica.'},
   {t:'terms',terms:['Revert','Slippage']}
  ]},
  {id:'explorador',title:'Ler um contrato no explorador',optional:false,sources:['contracts','nodes'],blocks:[
   {t:'p',text:'Todo contrato tem uma página no explorador de blocos. Lá dá para ver o código (se foi publicado), consultar valores, enviar chamadas e acompanhar os eventos.'},
   {t:'figure',svg:figExplorador,caption:'A página de um contrato num explorador. O selo de código verificado mostra que o código publicado é o mesmo que roda.',alt:'Página de explorador com o endereço do contrato, selo de código verificado, abas Código, Ler, Escrever e Eventos, e um trecho de código da função sacar.'},
   {t:'p',text:'"Código verificado" quer dizer que o código-fonte publicado gera exatamente o programa que está na rede. É transparência, não garantia: um código verificado pode ter falhas ou dar poderes perigosos ao dono.'},
   {t:'example',text:'Antes de interagir com um token novo, abra o contrato no explorador: o código é verificado? Há funções como "mint" ou "pause" que só o dono pode chamar?'},
   {t:'summary',text:'O explorador mostra código, leituras, escritas e eventos de um contrato; verificado é transparente, não seguro.'},
   {t:'terms',terms:['Código verificado','Explorador de blocos']}
  ]},
  {id:'automacao',title:'O contrato não acorda sozinho',optional:false,sources:['contracts','oracle'],blocks:[
   {t:'p',text:'Um contrato só roda quando alguém envia uma transação para ele. Ele não tem relógio próprio e não enxerga o mundo lá fora: para saber preços, depende de **oráculos**; para agir na hora certa, depende de robôs (keepers) que vigiam e chamam.'},
   {t:'figure',svg:figAutomacao,caption:'Liquidações, pagamentos de juros e rebalanceamentos dependem de alguém enviar a transação e de um preço disponível.',alt:'Um robô chama o contrato; um oráculo informa o preço ao contrato. Embaixo: se o robô parar ou o oráculo atrasar, o contrato espera.'},
   {t:'data',text:'O ethereum.org explica que smart contracts, sozinhos, não conseguem informação sobre eventos do mundo real; para isso existem os oráculos.',source:'contracts',date:'2026-10-21'},
   {t:'example',text:'Numa queda forte, a rede congestiona e as taxas disparam. Robôs de liquidação disputam espaço, e algumas posições são liquidadas mais tarde do que deveriam.'},
   {t:'summary',text:'Contrato só age quando chamado e só sabe o que entra por oráculo; robôs e oráculos são dependências reais.'},
   {t:'terms',terms:['Oráculo','Keeper']}
  ]},
  {id:'reentrancia',title:'Reentrância: a falha que derrubou The DAO',optional:false,sources:['solidity','m5.dao'],blocks:[
   {t:'p',text:'Quando um contrato envia dinheiro para outro contrato, entrega o controle por um instante. Se o destinatário for malicioso, pode chamar o primeiro de volta antes de ele terminar. Isso é **reentrância**.'},
   {t:'interactive',kind:'reentrancia',caption:'O mesmo cofre em duas versões. Na com falha, ele envia antes de anotar o saque.',alt:'Dois botões para escolher a versão do cofre. O ataque mostra a pilha de chamadas e os saldos do cofre e do atacante.'},
   {t:'data',text:'A documentação do Solidity recomenda o padrão conferir, atualizar e só então interagir: a chamada a outros contratos deve ser o último passo da função.',source:'solidity',date:'2026-10-21'},
   {t:'data',text:'Em 17 de junho de 2016, um ataque explorando chamadas recursivas tirou 3,6 milhões de ETH do The DAO, cerca de um terço do que ele guardava.',source:'m5.dao',date:'2026-10-21'},
   {t:'summary',text:'Reentrância acontece quando o contrato envia antes de atualizar; anote primeiro, envie por último.'},
   {t:'terms',terms:['Reentrância']}
  ]},
  {id:'auditoria',title:'Auditoria e as outras camadas de confiança',optional:false,sources:['solidity','risks'],blocks:[
   {t:'p',text:'Uma **auditoria** é a revisão do código por especialistas. Ela reduz o risco, mas tem escopo e data: vale para aquela versão, naquele momento, e pode deixar passar erros.'},
   {t:'figure',svg:figConfianca,caption:'Usar um protocolo é confiar em várias camadas ao mesmo tempo. A auditoria cobre só parte da primeira.',alt:'Cinco faixas empilhadas: código, chaves de admin, oráculos, outros contratos e interface, cada uma com a pergunta principal.'},
   {t:'p',text:'Além do código, pergunte quem tem as chaves de admin, de onde vêm os preços, de quais outros contratos o protocolo depende e se o site mostra fielmente o que o contrato faz.'},
   {t:'example',text:'Um protocolo auditado em 2023 lança uma versão nova em 2025 sem nova auditoria. O selo do site continua lá, mas fala do código antigo.'},
   {t:'summary',text:'Auditoria ajuda, mas não garante; confira também chaves de admin, oráculos, dependências e interface.'},
   {t:'terms',terms:['Auditoria']}
  ]},
  {id:'proxy',title:'Contratos atualizáveis e timelock',optional:false,sources:['m5.oz-proxy','solidity'],blocks:[
   {t:'p',text:'Muitos protocolos usam um **proxy**: um contrato de endereço fixo que repassa as chamadas para outro, a implementação. Trocando a implementação, o dono muda as regras sem mudar o endereço.'},
   {t:'interactive',kind:'proxy',caption:'O admin propõe uma versão nova que cobra 50% no saque. Compare com e sem prazo de espera.',alt:'O proxy de endereço fixo aponta para a implementação. Botões para propor a versão 2, passar o tempo e sacar; uma caixa liga e desliga o timelock.'},
   {t:'data',text:'Pela documentação da OpenZeppelin, o proxy guarda o estado e o endereço, executa o código da implementação com delegatecall, e uma atualização aponta o proxy para outra implementação. Quem controla isso pode ser uma multisig, um endereço simples ou uma DAO.',source:'m5.oz-proxy',date:'2026-10-21'},
   {t:'p',text:'O **timelock** é um prazo obrigatório entre anunciar e aplicar uma mudança. Ele dá tempo para os usuários lerem a proposta e saírem se não concordarem.'},
   {t:'summary',text:'Proxy permite trocar as regras no mesmo endereço; timelock e multisig limitam esse poder.'},
   {t:'terms',terms:['Proxy','Timelock','Multisig']}
  ]},
  {id:'composicao',title:'Peças que se encaixam e quebram juntas',optional:true,sources:['solidity','erc20'],blocks:[
   {t:'p',text:'Em DeFi, contratos usam outros contratos como peças de Lego: um empréstimo usa um token, um oráculo e uma corretora. Cada peça funciona sozinha, mas a combinação pode falhar de jeitos novos.'},
   {t:'table',caption:'Surpresas comuns na composição',headers:['Peça','Comportamento inesperado','Efeito'],rows:[
    ['Token com taxa na transferência','Depositar 100 entrega 98 ao contrato','O contrato anota 100 e fica sem lastro'],
    ['Token com saldo que muda sozinho','O saldo cresce ou cai sem transferência','Contas internas deixam de bater'],
    ['Oráculo de uma única fonte','Preço manipulado num bloco','Empréstimos baratos com garantia falsa'],
    ['Empréstimo-relâmpago','Muito capital por uma transação','Amplifica qualquer falha de preço']
   ]},
   {t:'summary',text:'Contratos combinados herdam as falhas uns dos outros; o risco do conjunto é maior que o de cada peça.'},
   {t:'terms',terms:['Smart contract','Oráculo']}
  ]},
  {id:'assinar-mensagens',title:'Assinar mensagem também pode custar caro',optional:true,sources:['safety','erc20'],blocks:[
   {t:'p',text:'Nem toda assinatura vira transação. Sites pedem para você assinar uma mensagem para provar que é dono do endereço, como um login. Isso não custa gas e, sozinho, não move nada.'},
   {t:'p',text:'Mas alguns padrões permitem que uma mensagem assinada valha como aprovação de gasto, usada depois por outra pessoa numa transação. Um site falso pode pedir uma "assinatura de login" que, na verdade, autoriza levar seus tokens.'},
   {t:'example',text:'A carteira mostra um texto longo cheio de números e endereços, e o site diz que é só para entrar. Se aparecer valor, prazo e um endereço de "spender", não é login.'},
   {t:'summary',text:'Leia toda assinatura: mensagem de login é inofensiva, mas uma mensagem pode valer como permissão de gasto.'},
   {t:'terms',terms:['Allowance']}
  ]},
  {id:'web3',title:'O que a Web3 muda e o que não muda',optional:true,sources:['contracts','risks'],blocks:[
   {t:'p',text:'Na Web3, sua conta é sua chave, os dados ficam numa rede pública e os programas rodam sem um dono que possa desligá-los. Isso muda quem controla o dinheiro.'},
   {t:'p',text:'Não muda a necessidade de cuidado: sites continuam sendo servidores comuns, contratos podem ter falhas, e erros não têm central de atendimento para desfazer.'},
   {t:'summary',text:'A Web3 troca a confiança em empresas pela confiança em código e chaves; o cuidado continua com você.'},
   {t:'terms',terms:['Smart contract','Autocustódia']}
  ]}
 ],
 quiz:[
  ['O que é um smart contract?',['Um contrato jurídico assinado digitalmente','Um programa com regras e dados num endereço da blockchain','Um aplicativo de celular','Um tipo de token'],1,'É um programa que roda na blockchain; ele não é necessariamente um contrato jurídico.'],
  ['Quem tem o poder de mover seu dinheiro numa chamada a um contrato?',['O site','O explorador','O criador do contrato','A sua assinatura, dentro das regras do contrato'],3,'O site só prepara a chamada; sem a sua assinatura e sem passar nas regras, nada acontece.'],
  ['Uma transferência simples de ETH usa 21.000 de gas. Com taxa base de 10 gwei e gorjeta de 1 gwei, quanto custa?',['0,000231 ETH','0,00021 ETH','0,021 ETH','2,1 ETH'],0,'21.000 × 11 gwei = 231.000 gwei = 0,000231 ETH.'],
  ['Consultar seu saldo num site Web3 custa gas?',['Sim, sempre','Só na rede principal','Não: é uma leitura respondida por um nó','Só se o saldo for alto'],2,'Leituras não viram transação e não pagam gas.'],
  ['Sua troca reverteu porque o preço passou do limite. O que acontece?',['Você perde os tokens','Os tokens voltam, mas a taxa é paga','Nada é cobrado','A troca é feita pela metade'],1,'A rede desfaz tudo, mas o trabalho executado é cobrado.'],
  ['O que o selo "código verificado" garante?',['Que o código publicado é o que roda na rede','Que o contrato é seguro','Que o projeto foi auditado','Que o token vai valorizar'],0,'Verificação é transparência sobre o código, não garantia de segurança.'],
  ['Um contrato de empréstimo precisa liquidar uma posição. O que é necessário?',['Nada, ele age sozinho no horário','Só o preço do oráculo','Só um robô','Um preço disponível e alguém que envie a transação'],3,'O contrato não acorda sozinho: precisa do preço e de uma transação que o chame.'],
  ['Qual é a regra que evita a reentrância?',['Enviar primeiro, anotar depois','Usar só ETH','Conferir, atualizar o estado e só então enviar','Fazer auditoria anual'],2,'Atualizando o estado antes de enviar, a chamada de volta encontra o saldo já zerado.'],
  ['Para que serve um timelock?',['Dar um prazo entre anunciar e aplicar uma mudança','Travar seus tokens para sempre','Acelerar transações','Esconder o código'],0,'O prazo permite que os usuários vejam a mudança e saiam se não concordarem.'],
  ['Um contrato auditado pode ter falhas?',['Não, nunca','Sim: a auditoria tem escopo e vale para uma versão','Só se for antigo','Só na rede de teste'],1,'Auditoria reduz o risco, mas não prova que não há erros, e versões novas exigem nova análise.']
 ],
 sources:{
  'm5.szabo':['Wikipedia · Smart contract','https://en.wikipedia.org/wiki/Smart_contract','Nick Szabo e o termo smart contract (1996), com o exemplo da máquina de venda.'],
  'm5.dao':['Wikipedia · The DAO','https://en.wikipedia.org/wiki/The_DAO','Ataque de junho de 2016 e a divisão da rede em julho.'],
  'm5.oz-proxy':['OpenZeppelin · Proxy Upgrade Pattern','https://docs.openzeppelin.com/upgrades-plugins/proxies','Como um proxy repassa chamadas e como funciona a atualização.']
 },
 glossary:[
  ['EVM','Máquina Virtual do Ethereum: o ambiente em que todos os nós executam o código dos contratos do mesmo jeito.'],
  ['Evento','Registro que um contrato emite ao executar algo, usado por sites e exploradores para acompanhar o que aconteceu.'],
  ['Revert','Quando uma regra do contrato falha e a transação é desfeita inteira. A taxa do trabalho feito é paga mesmo assim.'],
  ['gwei','Unidade de preço do gas: um bilionésimo de ETH (0,000000001 ETH).'],
  ['Chamada de leitura','Consulta a um contrato que não muda o estado. É respondida por um nó e não paga gas.'],
  ['Slippage','Diferença máxima de preço que você aceita numa troca antes de ela reverter.'],
  ['Código verificado','Código-fonte publicado que comprovadamente gera o programa que está na rede. Transparência, não segurança.'],
  ['Keeper','Robô que vigia condições e envia transações na hora certa, como em liquidações.'],
  ['Reentrância','Falha em que um contrato é chamado de volta antes de terminar, permitindo saques repetidos.'],
  ['Auditoria','Revisão do código por especialistas. Reduz o risco, com escopo e data limitados.'],
  ['Proxy','Contrato de endereço fixo que repassa as chamadas para uma implementação que pode ser trocada.'],
  ['Timelock','Prazo obrigatório entre anunciar e aplicar uma mudança num protocolo.']
 ]
});
})();
