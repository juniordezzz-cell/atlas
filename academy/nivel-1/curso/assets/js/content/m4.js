/* Módulo 4: Bitcoin (formato novo, 21/10/2026). Figuras em SVG no topo; os
   interativos (kind) moram em academy-interativos.js. Fatos conferidos nas
   fontes em 21/10/2026. Mineração, UTXO básico e reorganização já estão no
   Módulo 2; aqui o foco é o que é próprio do Bitcoin. */
(function(){
const F='font-family="inherit"';
const C={azul:'#60a5fa',ciano:'#67e8f9',violeta:'#a78bfa',verm:'#f87171',ambar:'#fcd34d',fundo:'#111c30',linha:'#2a3b55',mudo:'#a9b8cf',texto:'#e2e8f0'};
const tx=(x,y,t,tam,cor,peso,ancora)=>'<text x="'+x+'" y="'+y+'" text-anchor="'+(ancora||'middle')+'" font-size="'+tam+'"'+(peso?' font-weight="'+peso+'"':'')+' fill="'+cor+'">'+t+'</text>';
const ret=(x,y,w,h,cor)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="10" fill="'+C.fundo+'" stroke="'+cor+'" stroke-width="2"/>';

/* 1 BTC em satoshis. */
const figSats='<svg viewBox="0 0 640 230" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +ret(20,20,600,64,C.ambar)+tx(320,50,'1 BTC = 100.000.000 satoshis',20,C.texto,700)+tx(320,72,'o satoshi (sat) é a menor parte de um bitcoin',13,C.mudo)
 +[['0,01 BTC','1.000.000 sat',20],['0,0001 BTC','10.000 sat',225],['0,00000001 BTC','1 sat',430]].map(([b,s,x])=>ret(x,110,190,70,C.linha)+tx(x+95,140,b,15,C.texto,700)+tx(x+95,164,s,14,C.ciano)).join('')
 +tx(320,214,'Ninguém precisa comprar um bitcoin inteiro: dá para ter qualquer fração.',13,C.mudo)+'</svg>';

/* Recompensa do minerador: subsídio + taxas. Taxas ilustrativas. */
const eras=[[50,0.2],[25,0.3],[12.5,0.5],[6.25,0.6],[3.125,0.7],[1.5625,0.8]];
const figRecompensa='<svg viewBox="0 0 640 250" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +'<line x1="40" y1="200" x2="620" y2="200" stroke="'+C.linha+'" stroke-width="2"/>'
 +eras.map(([s,t],k)=>{const x=60+k*92,hs=s/50*160,ht=t/50*160*6;return '<rect x="'+x+'" y="'+(200-hs).toFixed(1)+'" width="60" height="'+hs.toFixed(1)+'" rx="3" fill="'+C.violeta+'"/>'
  +'<rect x="'+x+'" y="'+(200-hs-ht).toFixed(1)+'" width="60" height="'+ht.toFixed(1)+'" rx="3" fill="'+C.ciano+'"/>'
  +tx(x+30,218,(k+1)+'ª era',12,C.mudo)+tx(x+30,(200-hs-ht-8).toFixed(1),String(s).replace('.',','),12,C.texto);}).join('')
 +'<rect x="380" y="14" width="14" height="14" fill="'+C.violeta+'"/>'+tx(400,26,'subsídio (BTC novos)',13,C.texto,0,'start')
 +'<rect x="380" y="36" width="14" height="14" fill="'+C.ciano+'"/>'+tx(400,48,'taxas (ilustrativas, ampliadas)',13,C.texto,0,'start')
 +tx(320,244,'O subsídio cai à metade a cada era; com o tempo, as taxas precisam pagar a segurança.',13,C.mudo)+'</svg>';

/* Formas de ter exposição ao bitcoin. */
const forma=(x,y,t,s1,s2,cor)=>ret(x,y,295,82,cor)+tx(x+16,y+28,t,16,C.texto,700,'start')+tx(x+16,y+50,s1,13,C.mudo,0,'start')+tx(x+16,y+70,s2,13,C.mudo,0,'start');
const figExposicao='<svg viewBox="0 0 640 230" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +forma(15,15,'BTC na sua carteira','você tem a chave','risco: perder a chave ou a frase',C.ciano)
 +forma(330,15,'BTC na corretora','crédito com a empresa','risco: a empresa quebrar ou travar saques',C.ambar)
 +forma(15,115,'Fundo (ETF) na bolsa','cota de um fundo que guarda BTC','não dá para sacar bitcoin',C.azul)
 +forma(330,115,'Token "BTC" em outra rede','recibo de um custodiante ou ponte','risco: custodiante ou ponte falhar',C.violeta)
 +tx(320,222,'Todos sobem e descem com o preço; só o primeiro é bitcoin seu, na rede.',13,C.mudo)+'</svg>';

AcademyContent.register({
 id:'m4',
 title:'Bitcoin',
 icon:'bitcoin',
 summary:'Dinheiro digital sem banco: como o Bitcoin impede o gasto duplo, monta transações, emite moedas e escala com a Lightning.',
 minutes:60,
 goals:[
  'Explicar o gasto duplo e como a rede o impede',
  'Montar uma transação: moedas, troco e taxa em sat/vB',
  'Entender o halving, o limite de 21 milhões e por que os nós mandam nas regras',
  'Acelerar uma transação presa e comparar as formas de ter bitcoin'
 ],
 flow:['UTXO disponível','Assinatura','Entradas consumidas','Saídas + troco','Nós verificam'],
 history:{
  intro:'O Bitcoin nasceu de um documento de nove páginas e de um programa que qualquer um podia rodar. Ninguém autorizou, ninguém é dono, e as regras mudaram poucas vezes, sempre com a maioria dos nós aceitando.',
  timeline:[
   {when:'31 out 2008',title:'O documento',text:'Satoshi Nakamoto publicou "Bitcoin: A Peer-to-Peer Electronic Cash System", que propõe resolver o gasto duplo com uma rede de pares, sem um intermediário de confiança.'},
   {when:'3 jan 2009',title:'O primeiro bloco',text:'A rede começou com o bloco gênese, que trazia o título de um jornal sobre socorro a bancos.'},
   {when:'22 mai 2010',title:'Duas pizzas',text:'O programador Laszlo Hanyecz pagou 10.000 BTC por duas pizzas, a primeira compra conhecida de um bem físico com bitcoin.'},
   {when:'ago 2017',title:'SegWit',text:'Uma atualização compatível mudou a forma de guardar as assinaturas e abriu caminho para endereços bc1 e para a Lightning.'},
   {when:'nov 2021',title:'Taproot',text:'Outra atualização trouxe os endereços bc1p, com mais privacidade e flexibilidade para scripts.'},
   {when:'abr 2024',title:'Quarto halving',text:'A recompensa por bloco caiu de 6,25 para 3,125 BTC.'}
  ]
 },
 lessons:[
  {id:'gasto-duplo',title:'O problema do gasto duplo',optional:false,sources:['bitcoin','m2.btc-tx'],blocks:[
   {t:'p',text:'Um arquivo digital se copia à vontade. Se dinheiro digital fosse só um arquivo, daria para gastar a mesma moeda duas vezes. Esse é o **gasto duplo**, e por décadas só um intermediário, como um banco, resolvia.'},
   {t:'interactive',kind:'gastoduplo',caption:'Alice tenta pagar Bruno e Caio com a mesma moeda. Avance e veja onde a segunda tentativa morre.',alt:'Alice com uma moeda de 1 BTC, duas transações que gastam a mesma moeda e um bloco que inclui só a primeira. A segunda fica marcada como inválida.'},
   {t:'data',text:'O documento do Bitcoin diz que assinaturas digitais resolvem parte do problema, mas que a vantagem se perde se ainda for preciso um terceiro de confiança para impedir o gasto duplo. A proposta é resolver isso com uma rede de pares.',source:'bitcoin',date:'2026-10-21'},
   {t:'p',text:'A rede resolve com duas peças. Cada moeda (UTXO) só pode ser gasta uma vez, e todos os nós conferem isso. E o consenso escolhe uma única ordem: a transação que entrar primeiro na história vale; a outra vira inválida.'},
   {t:'example',text:'Quem vende um carro e recebe em bitcoin deve esperar confirmações. Se aceitar só a transação na fila, Alice pode tentar mandar outra, gastando a mesma moeda, com taxa maior.'},
   {t:'summary',text:'Cada moeda só pode ser gasta uma vez, e a ordem única da blockchain decide qual gasto vale.'},
   {t:'terms',terms:['Gasto duplo','UTXO','Confirmação']}
  ]},
  {id:'satoshi',title:'Bitcoin em pedaços: o satoshi',optional:false,sources:['m4.wiki-btc'],blocks:[
   {t:'p',text:'Ninguém precisa comprar um bitcoin inteiro. Cada BTC se divide em cem milhões de partes, chamadas **satoshis** em homenagem ao criador. Carteiras e taxas costumam usar satoshis (sat) para os valores pequenos.'},
   {t:'figure',svg:figSats,caption:'Um bitcoin tem 100 milhões de satoshis. A taxa da rede, por exemplo, é medida em satoshis por unidade de tamanho.',alt:'Uma faixa diz que 1 BTC vale 100 milhões de satoshis. Abaixo, três exemplos: 0,01 BTC são 1 milhão de sat, 0,0001 BTC são 10 mil sat e 0,00000001 BTC é 1 sat.'},
   {t:'data',text:'O satoshi é um centésimo milionésimo de bitcoin, a menor quantidade possível na rede.',source:'m4.wiki-btc',date:'2026-10-21'},
   {t:'example',text:'Comprar o equivalente a R$ 50 em bitcoin dá uma fração como 0,00012 BTC, ou 12.000 sat. Você tem bitcoin de verdade, só que uma parte pequena.'},
   {t:'summary',text:'1 BTC = 100.000.000 sat; dá para ter e enviar qualquer fração.'},
   {t:'terms',terms:['Satoshi']}
  ]},
  {id:'montar-transacao',title:'Montar uma transação: moedas, troco e taxa',optional:false,sources:['m2.btc-tx','utxo'],blocks:[
   {t:'p',text:'Uma transação de bitcoin junta moedas que você tem (as entradas) e cria moedas novas (as saídas): o pagamento e o **troco**, que volta para você. O que sobra entre entradas e saídas fica para o minerador como taxa.'},
   {t:'interactive',kind:'montartx',caption:'Escolha quais moedas entram e veja o tamanho, a taxa e o troco. Tamanho calculado com valores aproximados de exemplo.',alt:'Cinco moedas para marcar, um controle da taxa em sat/vB e um quadro com entradas, pagamento, tamanho, taxa e troco.'},
   {t:'data',text:'Pelo guia de desenvolvedores do Bitcoin, as transações pagam taxa pelo tamanho em bytes da transação assinada, e o preço por byte sobe e desce com a procura por espaço no bloco.',source:'m2.btc-tx',date:'2026-10-21'},
   {t:'p',text:'Por isso o valor não importa para a taxa: mandar 0,001 ou 10 BTC custa o mesmo se a transação tiver o mesmo tamanho. O que pesa é quantas moedas entram. A taxa é dada em **sat/vB**, satoshis por byte virtual.'},
   {t:'example',text:'Juntar dez moedinhas para um pagamento deixa a transação grande e cara. Muitas carteiras juntam moedas pequenas em dias de taxa baixa para economizar depois.'},
   {t:'summary',text:'Entradas viram pagamento, troco e taxa; a taxa depende do tamanho (número de moedas), não do valor enviado.'},
   {t:'terms',terms:['Troco','sat/vB','UTXO']}
  ]},
  {id:'enderecos',title:'Tipos de endereço: 1, 3, bc1q e bc1p',optional:false,sources:['m4.design','m4.bip350'],blocks:[
   {t:'p',text:'Ao longo dos anos, o Bitcoin ganhou formatos novos de endereço. Todos funcionam juntos: dá para mandar de um tipo para outro. O começo do endereço conta qual é o formato.'},
   {t:'interactive',kind:'endereco',caption:'Os exemplos vêm de documentos públicos do Bitcoin (bloco gênese e vetores de teste do BIP-350). A conferência aqui olha só o formato.',alt:'Campo para colar um endereço e cinco botões de exemplo. Embaixo aparece o tipo detectado e uma explicação.'},
   {t:'data',text:'Pelo guia de design do Bitcoin, endereços legados começam com 1, de script com 3, SegWit com bc1q e Taproot com bc1p.',source:'m4.design',date:'2026-10-21'},
   {t:'p',text:'Endereços que começam com 0x são de Ethereum e redes parecidas, não de Bitcoin. E endereços de rede de teste existem só para desenvolvedores: as moedas de lá não valem nada.'},
   {t:'summary',text:'1 = legado, 3 = script, bc1q = SegWit, bc1p = Taproot; todos se comunicam, e os mais novos costumam pagar menos taxa.'},
   {t:'terms',terms:['SegWit','Taproot','Endereço']}
  ]},
  {id:'halving',title:'Halving e o limite de 21 milhões',optional:false,sources:['m4.wiki-btc','m2.historia'],blocks:[
   {t:'p',text:'Os bitcoins novos nascem como recompensa para quem minera cada bloco: o **subsídio**. A regra é fixa e conhecida: a cada 210 mil blocos, cerca de quatro anos, o subsídio cai à metade. Isso é o **halving**.'},
   {t:'interactive',kind:'halving',caption:'Escolha a era e veja a recompensa por bloco e quanto do total já terá sido emitido ao fim dela.',alt:'Gráfico de barras com o total emitido ao fim de cada era, chegando perto da linha de 21 milhões. Um controle escolhe a era.'},
   {t:'data',text:'A recompensa cai à metade a cada 210.000 blocos, e a emissão continua até chegar a 21 milhões de bitcoins no total.',source:'m4.wiki-btc',date:'2026-10-21'},
   {t:'data',text:'O quarto halving aconteceu em abril de 2024 e reduziu a recompensa de 6,25 para 3,125 bitcoins por bloco.',source:'m2.historia',date:'2026-10-21'},
   {t:'p',text:'Como a recompensa vai caindo à metade, a soma nunca passa de 21 milhões. Mais de 90% já foi emitido; o resto sai cada vez mais devagar.'},
   {t:'summary',text:'O subsídio cai à metade a cada 210 mil blocos, e a oferta total se aproxima de 21 milhões sem passar disso.'},
   {t:'terms',terms:['Halving','Subsídio do bloco']}
  ]},
  {id:'recompensa',title:'Quem paga os mineradores',optional:false,sources:['bitcoin','m4.wiki-btc'],blocks:[
   {t:'p',text:'O minerador que acha um bloco ganha duas coisas: o subsídio, em bitcoins novos, e as taxas de todas as transações que colocou no bloco. É o que paga a energia e as máquinas.'},
   {t:'figure',svg:figRecompensa,caption:'O subsídio (violeta) cai à metade a cada era. As taxas (ciano) são ilustrativas e foram ampliadas para aparecer no gráfico.',alt:'Barras por era: a parte do subsídio cai pela metade a cada era, de 50 para 1,5625; uma faixa menor de taxas fica por cima.'},
   {t:'data',text:'O documento do Bitcoin diz que a primeira transação de cada bloco cria moedas novas para quem fez o bloco, um incentivo para apoiar a rede e uma forma de distribuir as moedas sem uma autoridade central.',source:'bitcoin',date:'2026-10-21'},
   {t:'p',text:'Com o subsídio encolhendo, a segurança do Bitcoin vai depender cada vez mais das taxas. Essa transição é um dos debates abertos sobre o futuro da rede.'},
   {t:'summary',text:'Recompensa = subsídio + taxas; o subsídio encolhe a cada halving, e as taxas ganham peso.'},
   {t:'terms',terms:['Subsídio do bloco','Mineração']}
  ]},
  {id:'nos-conferem',title:'Os nós mandam nas regras, não os mineradores',optional:false,sources:['bitcoin','nodes'],blocks:[
   {t:'p',text:'Os mineradores escrevem os blocos, mas quem decide se um bloco vale são os nós, que conferem cada regra. Um minerador não consegue se pagar mais do que a regra permite nem criar moedas do nada.'},
   {t:'interactive',kind:'regrasbtc',caption:'Escolha quanto o minerador escreve que ganha. Acima do subsídio mais as taxas, os nós recusam. Taxas do bloco de exemplo.',alt:'Controle do valor que o minerador se paga e três nós que mostram se aceitam ou recusam o bloco.'},
   {t:'p',text:'Rodar um nó não exige minerar. Qualquer pessoa com um computador comum pode baixar a blockchain e conferir sozinha todas as regras, sem confiar em ninguém.'},
   {t:'example',text:'Se a maioria dos mineradores quisesse aumentar o limite de 21 milhões, os nós que não atualizassem simplesmente recusariam esses blocos. Mudar a regra exige convencer quem roda nó, não só quem minera.'},
   {t:'summary',text:'Mineradores propõem; nós conferem e recusam qualquer bloco fora da regra, inclusive o que paga demais ao minerador.'},
   {t:'terms',terms:['Nó','Mineração']}
  ]},
  {id:'acelerar',title:'Transação presa: esperar, RBF ou CPFP',optional:false,sources:['m4.bip125','m2.btc-tx'],blocks:[
   {t:'p',text:'Quando a rede está cheia, uma transação com taxa baixa pode ficar horas ou dias na fila. Há três saídas: esperar a demanda cair, substituir a transação ou pagar pela mãe com uma filha.'},
   {t:'interactive',kind:'acelerar',caption:'Sua transação pagou 2 sat/vB e travou. Teste as três saídas. Tamanhos e valores de exemplo.',alt:'Sua transação presa e, ao lado, uma transação filha que aparece no CPFP. Botões para esperar, usar RBF e usar CPFP.'},
   {t:'p',text:'No **RBF** (substituir pela taxa), a carteira manda outra versão da mesma transação, gastando as mesmas moedas, com taxa maior. No **CPFP** (a filha paga pela mãe), você gasta o troco ainda não confirmado com uma taxa alta; para levar a filha, o minerador precisa levar a mãe.'},
   {t:'data',text:'Pelo BIP-125, uma transação pode sinalizar que aceita ser substituída, e a substituta precisa pagar uma taxa total pelo menos igual à soma do que as originais pagavam.',source:'m4.bip125',date:'2026-10-21'},
   {t:'summary',text:'Transação presa se resolve esperando, substituindo com taxa maior (RBF) ou gastando o troco com taxa alta (CPFP).'},
   {t:'terms',terms:['RBF','CPFP','Mempool']}
  ]},
  {id:'lightning',title:'Lightning: pagamentos rápidos fora da blockchain',optional:false,sources:['m4.lightning','m4.wiki-btc'],blocks:[
   {t:'p',text:'O Bitcoin faz um bloco a cada 10 minutos, em média, e cada bloco tem espaço limitado. Para pagar um café na hora, surgiu a **Lightning Network**, uma rede por cima do Bitcoin.'},
   {t:'interactive',kind:'canal',caption:'Ana e Bruno abrem um canal e trocam pagamentos. Veja quantas transações vão de fato para a blockchain.',alt:'Barra dividida entre Ana e Bruno que muda a cada pagamento, com o contador de transações dentro e fora da blockchain.'},
   {t:'p',text:'Duas pessoas abrem um **canal de pagamento** travando bitcoin numa transação na blockchain. Depois trocam pagamentos à vontade, só atualizando entre si o retrato do saldo. Ao fechar, uma última transação registra o saldo final.'},
   {t:'data',text:'O site da Lightning descreve canais de pagamento nos dois sentidos, em que os dois assinam cada atualização e só a versão mais recente vale, garantida por scripts na blockchain.',source:'m4.lightning',date:'2026-10-21'},
   {t:'example',text:'Pagamentos podem passar por vários canais até o destino, sem que você abra canal com cada loja. O custo é ficar online e confiar no software da carteira Lightning.'},
   {t:'summary',text:'Na Lightning, muitos pagamentos instantâneos cabem entre a abertura e o fechamento de um canal, que são as únicas transações na blockchain.'},
   {t:'terms',terms:['Lightning Network','Canal de pagamento']}
  ]},
  {id:'exposicao',title:'Bitcoin seu ou promessa de bitcoin?',optional:false,sources:['risks','m3.mtgox'],blocks:[
   {t:'p',text:'Há várias formas de "ter bitcoin", e todas sobem e descem com o preço. Mas só uma é bitcoin seu, registrado na rede e controlado pela sua chave. As outras são promessas de alguém.'},
   {t:'figure',svg:figExposicao,caption:'Quatro formas de exposição ao bitcoin e o risco principal de cada uma.',alt:'Quatro caixas: BTC na sua carteira, BTC na corretora, fundo (ETF) na bolsa e token BTC em outra rede, cada uma com quem guarda e o risco principal.'},
   {t:'p',text:'Na corretora, você tem um crédito. No fundo negociado em bolsa (ETF), você tem uma cota e não pode sacar bitcoin. Num token "BTC" em outra rede, você depende de quem guarda o bitcoin original e da ponte.'},
   {t:'example',text:'Em 2014, clientes da Mt. Gox viam saldo em bitcoin na tela, mas o bitcoin não estava lá. Só quem tinha sacado para a própria carteira manteve as moedas.'},
   {t:'summary',text:'Exposição ao preço não é posse: só o bitcoin na sua carteira dispensa a promessa de terceiros.'},
   {t:'terms',terms:['Autocustódia','Custódia']}
  ]},
  {id:'privacidade',title:'Privacidade: endereços e moedas misturadas',optional:true,sources:['bitcoin','m4.design'],blocks:[
   {t:'p',text:'Bitcoin não é anônimo: é pseudônimo. Todos veem as transações; ninguém vê nomes. Mas pistas ligam endereços entre si e, às vezes, a uma pessoa.'},
   {t:'data',text:'O documento do Bitcoin recomenda um par de chaves novo para cada transação e avisa que transações com várias entradas revelam que essas entradas tinham o mesmo dono.',source:'bitcoin',date:'2026-10-21'},
   {t:'data',text:'O guia de design do Bitcoin desaconselha receber várias vezes no mesmo endereço, porque isso facilita ligar suas transações.',source:'m4.design',date:'2026-10-21'},
   {t:'example',text:'Você junta uma moeda recebida do salário com outra recebida de um amigo para pagar algo. Quem olhar a transação conclui que as duas são suas.'},
   {t:'summary',text:'Use endereço novo a cada recebimento e lembre que juntar moedas revela que são do mesmo dono.'},
   {t:'terms',terms:['Reutilização de endereço']}
  ]},
  {id:'segwit-e-taproot',title:'SegWit e Taproot: como o Bitcoin muda',optional:true,sources:['m4.wiki-btc','m4.bip350'],blocks:[
   {t:'p',text:'O Bitcoin muda devagar e com cuidado. As atualizações costumam ser compatíveis: nós antigos continuam aceitando os blocos novos, e quem quer usa os recursos novos.'},
   {t:'data',text:'A atualização SegWit foi ativada em agosto de 2017, e a Taproot, em novembro de 2021.',source:'m4.wiki-btc',date:'2026-10-21'},
   {t:'data',text:'Pelo BIP-350, os endereços SegWit da versão 0 continuam no formato bech32, e os da versão 1 em diante, como os de Taproot, usam o formato bech32m.',source:'m4.bip350',date:'2026-10-21'},
   {t:'summary',text:'SegWit (2017) e Taproot (2021) chegaram como atualizações compatíveis, trazendo os endereços bc1q e bc1p.'},
   {t:'terms',terms:['SegWit','Taproot']}
  ]},
  {id:'emissao-e-preco',title:'Oferta previsível não garante preço',optional:true,sources:['bitcoin','risks'],blocks:[
   {t:'p',text:'A regra de emissão diz quantos bitcoins vão existir e quando. Ela não diz quanto cada um vai valer: o preço sai de quem quer comprar e de quem quer vender.'},
   {t:'p',text:'Halvings costumam ser lembrados como gatilho de alta, mas a data de cada halving é conhecida com anos de antecedência. Uma oferta previsível convive com quedas fortes e longas no preço.'},
   {t:'summary',text:'A oferta é fixa e previsível; o preço depende da demanda e pode cair muito mesmo assim.'},
   {t:'terms',terms:['Halving']}
  ]}
 ],
 quiz:[
  ['O que é gasto duplo?',['Pagar a taxa duas vezes','Mandar para dois endereços seus','Tentar gastar a mesma moeda em duas transações','Minerar dois blocos seguidos'],2,'Gasto duplo é usar a mesma moeda em duas transações. A rede só deixa uma delas entrar na história.'],
  ['Quantos satoshis tem 1 bitcoin?',['100.000.000','1.000','21.000.000','1.000.000'],0,'O satoshi é um centésimo milionésimo de bitcoin.'],
  ['Você paga 0,3 BTC usando uma moeda de 0,35 BTC. Para onde vai o resto?',['Fica perdido','Vai todo para o minerador','Volta para a moeda original','Vira troco para você, menos a taxa'],3,'A moeda é gasta inteira; a transação cria o pagamento e o troco, e a diferença vira taxa.'],
  ['A taxa de uma transação de bitcoin depende principalmente de quê?',['Do valor enviado','Do tamanho da transação e da procura por espaço','Do horário do país do remetente','Do tipo de carteira'],1,'A taxa é cobrada por tamanho (sat/vB). O valor enviado não importa.'],
  ['Um endereço começa com bc1p. Qual é o formato?',['Legado','Script','Taproot','Ethereum'],2,'bc1p é o formato Taproot; bc1q é SegWit, 1 é legado e 3 é script.'],
  ['De quanto em quanto tempo acontece o halving?',['A cada 210.000 blocos, cerca de 4 anos','Todo ano','Quando o preço dobra','Quando os mineradores votam'],0,'A regra é fixa: a recompensa cai à metade a cada 210 mil blocos.'],
  ['Um minerador escreve que ganha 10 BTC num bloco, acima da regra. O que acontece?',['Recebe os 10 BTC','Os nós recusam o bloco','Recebe só 3,125 e o resto some','Os outros mineradores votam'],1,'Os nós conferem cada regra e descartam o bloco inválido; o minerador não ganha nada.'],
  ['Sua transação travou com taxa baixa e você quer substituí-la por outra com taxa maior. Isso se chama…',['CPFP','Halving','Lightning','RBF'],3,'RBF é substituir pela taxa. CPFP é gastar o troco com taxa alta para puxar a mãe.'],
  ['Numa conversa pela Lightning, quantas transações vão para a blockchain em cada canal?',['Uma por pagamento','Nenhuma','A abertura e o fechamento','Uma por minuto'],2,'Os pagamentos ficam entre os dois; só abrir e fechar o canal vão para a blockchain.'],
  ['Qual dessas formas é bitcoin seu, registrado na rede e controlado por você?',['BTC na sua própria carteira','Cota de ETF de bitcoin','Saldo de BTC numa corretora','Token "BTC" em outra rede'],0,'As outras formas são promessas de uma empresa, um fundo ou um custodiante.']
 ],
 sources:{
  'm4.wiki-btc':['Wikipedia · Bitcoin','https://en.wikipedia.org/wiki/Bitcoin','Satoshi, halving a cada 210.000 blocos, limite de 21 milhões, SegWit e Taproot.'],
  'm4.design':['Bitcoin Design Guide · Address','https://bitcoin.design/guide/glossary/address/','Tipos de endereço (1, 3, bc1q, bc1p) e reutilização de endereço.'],
  'm4.bip350':['Bitcoin BIPs · BIP-350, Bech32m','https://github.com/bitcoin/bips/blob/master/bip-0350.mediawiki','Formato bech32m para endereços SegWit versão 1 em diante (Taproot).'],
  'm4.bip125':['Bitcoin BIPs · BIP-125, Replace-by-Fee','https://github.com/bitcoin/bips/blob/master/bip-0125.mediawiki','Sinal de substituição e regra de taxa da transação substituta.'],
  'm4.lightning':['Lightning Network','https://lightning.network/','Canais de pagamento bidirecionais e pagamentos fora da blockchain.']
 },
 glossary:[
  ['Gasto duplo','Tentar gastar a mesma moeda em duas transações. A rede só deixa uma entrar na história.'],
  ['Satoshi','A menor parte de um bitcoin: 0,00000001 BTC. Também chamado de sat.'],
  ['Troco','Saída de uma transação que devolve ao remetente o que sobrou da moeda gasta, menos a taxa.'],
  ['sat/vB','Satoshis por byte virtual: a unidade da taxa no Bitcoin. A taxa total é esse valor vezes o tamanho da transação.'],
  ['Halving','Corte pela metade do subsídio dos mineradores, a cada 210.000 blocos.'],
  ['Subsídio do bloco','Bitcoins novos criados em cada bloco para quem o minerou. Hoje são 3,125 BTC.'],
  ['SegWit','Atualização de 2017 que mudou onde ficam as assinaturas e trouxe os endereços bc1q.'],
  ['Taproot','Atualização de 2021 que trouxe os endereços bc1p, com mais privacidade e flexibilidade para scripts.'],
  ['RBF','Substituir pela taxa: mandar outra versão da mesma transação, com taxa maior, para acelerar.'],
  ['CPFP','A filha paga pela mãe: gastar o troco de uma transação presa com taxa alta para que as duas entrem juntas.'],
  ['Lightning Network','Rede por cima do Bitcoin para pagamentos instantâneos em canais, fora da blockchain.'],
  ['Canal de pagamento','Acordo entre duas pessoas, aberto e fechado na blockchain, em que os pagamentos do meio só atualizam o saldo entre elas.'],
  ['Reutilização de endereço','Receber várias vezes no mesmo endereço, o que facilita ligar suas transações.']
 ]
});
})();
