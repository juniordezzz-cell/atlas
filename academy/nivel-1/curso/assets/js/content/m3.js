/* Módulo 3: Criptomoedas e carteiras (formato novo, 21/10/2026). Figuras em
   SVG no topo; os interativos (kind) moram em academy-interativos.js.
   Fatos conferidos nas fontes em 21/10/2026. */
(function(){
const F='font-family="inherit"';
const C={azul:'#60a5fa',ciano:'#67e8f9',violeta:'#a78bfa',verm:'#f87171',ambar:'#fcd34d',fundo:'#111c30',linha:'#2a3b55',mudo:'#a9b8cf',texto:'#e2e8f0'};
const tx=(x,y,t,tam,cor,peso,ancora)=>'<text x="'+x+'" y="'+y+'" text-anchor="'+(ancora||'middle')+'" font-size="'+tam+'"'+(peso?' font-weight="'+peso+'"':'')+' fill="'+cor+'">'+t+'</text>';
const ret=(x,y,w,h,cor)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="10" fill="'+C.fundo+'" stroke="'+cor+'" stroke-width="2"/>';
const seta=(x1,y1,x2,y2,cor)=>'<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+(cor||C.mudo)+'" stroke-width="2"/>';

/* A carteira é uma janela: as chaves ficam com você, os ativos ficam na rede. */
const figCarteira='<svg viewBox="0 0 640 230" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +ret(20,40,170,120,C.azul)+tx(105,72,'Aplicativo',17,C.texto,700)+tx(105,98,'mostra o saldo',13,C.mudo)+tx(105,118,'e pede sua',13,C.mudo)+tx(105,138,'confirmação',13,C.mudo)
 +ret(235,60,150,80,C.violeta)+tx(310,94,'Chave privada',15,C.texto,700)+tx(310,118,'assina',13,C.mudo)
 +ret(430,30,190,140,C.ciano)+tx(525,62,'Blockchain',17,C.texto,700)+tx(525,90,'0x7a3f… : 250 USDC',13,C.mudo)+tx(525,112,'0x7a3f… : 0,8 ETH',13,C.mudo)+tx(525,134,'os ativos moram aqui',13,C.ciano)
 +seta(190,100,235,100)+seta(385,100,430,100)
 +tx(320,212,'Trocar de aplicativo não move nada: com a mesma chave, a conta é a mesma.',13,C.mudo)+'</svg>';

/* Do mais conectado ao mais isolado. */
const nivel=(x,t,s,cor)=>ret(x,60,140,90,cor)+tx(x+70,96,t,15,C.texto,700)+tx(x+70,120,s,12,C.mudo);
const figQuenteFria='<svg viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +'<line x1="20" y1="30" x2="620" y2="30" stroke="'+C.linha+'" stroke-width="6" stroke-linecap="round"/>'
 +tx(20,20,'mais conectado, mais prático',12,C.ambar,0,'start')+tx(620,20,'mais isolado, mais trabalhoso',12,C.ciano,0,'end')
 +nivel(10,'Corretora','a empresa guarda',C.ambar)+nivel(165,'App no celular','chave no aparelho',C.ambar)
 +nivel(320,'Hardware wallet','chave num dispositivo',C.ciano)+nivel(475,'Papel / metal','frase guardada offline',C.ciano)
 +tx(320,190,'Use cada uma para um fim: pouco dinheiro no app do dia a dia,',13,C.mudo)+tx(320,210,'a reserva longe da internet.',13,C.mudo)+'</svg>';

/* Mesmo endereço, redes diferentes. */
const figRede='<svg viewBox="0 0 640 230" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +ret(220,20,200,56,C.azul)+tx(320,46,'Seu endereço',15,C.texto,700)+tx(320,66,'0x7a3f…c9d2',13,C.ciano)
 +[['Ethereum','100 USDC',30],['Base','0 USDC',240],['Arbitrum','40 USDC',450]].map(([r,s,x])=>seta(320,76,x+80,130)+ret(x,130,160,64,C.linha)+tx(x+80,156,r,15,C.texto,700)+tx(x+80,180,s,13,C.mudo)).join('')
 +tx(320,222,'O mesmo endereço existe em cada rede compatível, com saldos separados.',13,C.mudo)+'</svg>';

/* Token embrulhado: trava de um lado, emite do outro. */
const figWrapped='<svg viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +ret(20,40,180,110,C.azul)+tx(110,72,'Rede A',15,C.texto,700)+tx(110,98,'100 USDC',14,C.mudo)+tx(110,122,'travados na ponte',13,C.ambar)
 +ret(230,70,180,50,C.ambar)+tx(320,100,'Ponte',15,C.texto,700)
 +ret(440,40,180,110,C.violeta)+tx(530,72,'Rede B',15,C.texto,700)+tx(530,98,'100 USDC.e',14,C.mudo)+tx(530,122,'emitidos pela ponte',13,C.ambar)
 +seta(200,95,230,95)+seta(410,95,440,95)
 +tx(320,186,'O token da rede B é um recibo. Se a ponte falhar ou for invadida,',13,C.mudo)+tx(320,206,'o recibo pode perder o lastro.',13,C.mudo)+'</svg>';

AcademyContent.register({
 id:'m3',
 title:'Criptomoedas e carteiras',
 icon:'coins',
 summary:'Saber qual token é o verdadeiro, quem guarda a chave e quantos tokens ainda vão chegar ao mercado: o básico para não perder dinheiro.',
 minutes:65,
 goals:[
  'Diferenciar moeda nativa, token e representação, e identificar um token pelo contrato',
  'Comparar custódia na corretora e autocustódia, carteira quente e fria',
  'Reconhecer golpes de assinatura, envenenamento de endereço e aprovação ilimitada',
  'Calcular capitalização e FDV e entender desbloqueios'
 ],
 flow:['Rede','Conta / endereço','Chaves autorizam','Ativos registrados','Carteira mostra o estado'],
 history:{
  intro:'As carteiras nasceram como um arquivo de chaves dentro do programa do Bitcoin. Com o tempo vieram as frases de recuperação, os tokens, as corretoras e, junto, as grandes quebras que ensinaram uma lição repetida: quem guarda a chave controla o dinheiro.',
  timeline:[
   {when:'fev 2012',title:'Carteiras HD',text:'O BIP-32 recebeu seu número e descreveu as carteiras hierárquicas determinísticas: uma única semente gera uma árvore inteira de chaves. É a base das frases de recuperação de hoje.'},
   {when:'fev 2014',title:'Mt. Gox quebra',text:'A maior corretora de bitcoin da época suspendeu os negócios e pediu proteção contra credores no Japão. Ela disse ter perdido quase 750 mil bitcoins de clientes.'},
   {when:'19 nov 2015',title:'Nasce o ERC-20',text:'Fabian Vogelsteller e Vitalik Buterin propuseram o padrão de tokens do Ethereum. Com ele, qualquer carteira passou a entender qualquer token que siga as mesmas funções.'},
   {when:'11 nov 2022',title:'FTX pede falência',text:'Dois dias depois de parar os saques, a FTX pediu falência nos Estados Unidos. A empresa tinha emprestado dinheiro de clientes a outra empresa do mesmo dono.'}
  ]
 },
 lessons:[
  {id:'moeda-nativa-e-token',title:'Moeda nativa, token e representação',optional:false,sources:['erc20','m3.circle','m3.arbitrum'],blocks:[
   {t:'p',text:'Cada rede tem uma **moeda nativa**, que faz parte das regras dela e paga as taxas: BTC no Bitcoin, ETH no Ethereum. Já um **token** é criado por um contrato dentro da rede. Qualquer pessoa pode criar um, com o nome e o símbolo que quiser.'},
   {t:'interactive',kind:'ticker',caption:'Quatro tokens com o mesmo nome. Os endereços do USDC oficial foram conferidos na lista da Circle, e o do USDC.e na documentação da Arbitrum. O segundo cartão é inventado.',alt:'Quatro cartões chamados USDC, cada um com rede e endereço. Clicar mostra se é o oficial, um golpe, uma representação por ponte ou o oficial em outra rede.'},
   {t:'p',text:'Por isso o nome não prova nada. O que identifica um token é a **rede** mais o **endereço do contrato**. Confira sempre no site oficial do emissor ou em mais de uma fonte confiável.'},
   {t:'data',text:'O endereço do USDC oficial na rede Ethereum, segundo a Circle, é 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48. Em cada rede o endereço é outro.',source:'m3.circle',date:'2026-10-21'},
   {t:'p',text:'Há ainda as **representações**: tokens que dizem valer outro ativo, como um BTC "embrulhado" no Ethereum ou um USDC que atravessou uma ponte. Eles dependem de quem guarda o original e de a ponte funcionar.'},
   {t:'summary',text:'Moeda nativa vem da própria rede; token é um contrato que qualquer um cria. Identifique pelo par rede + endereço, nunca pelo nome.'},
   {t:'terms',terms:['Moeda nativa','Token','Stablecoin']}
  ]},
  {id:'carteira-e-rede',title:'A carteira guarda chaves; a rede guarda os ativos',optional:false,sources:['wallets','m3.bip32'],blocks:[
   {t:'p',text:'Parece que o dinheiro está "dentro" do aplicativo, mas não está. Os ativos ficam registrados na blockchain. A carteira guarda a **chave privada** e serve de janela: mostra o saldo e pede sua confirmação para assinar.'},
   {t:'figure',svg:figCarteira,caption:'O aplicativo lê o saldo da blockchain e usa a chave para assinar. Os ativos nunca saem da rede.',alt:'Três caixas: aplicativo, chave privada e blockchain. O aplicativo usa a chave para assinar; os saldos aparecem na caixa da blockchain.'},
   {t:'p',text:'Por isso dá para trocar de aplicativo quando quiser. Com a mesma frase de recuperação, outra carteira compatível recalcula as mesmas chaves e mostra as mesmas contas.'},
   {t:'data',text:'O padrão BIP-32, numerado em fevereiro de 2012, descreve como uma única semente gera uma árvore de chaves. É o que permite uma frase só cuidar de muitas contas.',source:'m3.bip32',date:'2026-10-21'},
   {t:'example',text:'Seu celular quebrou. Você instala outro aplicativo de carteira, digita a frase e vê os mesmos 250 USDC. Nada foi "transferido": o saldo sempre esteve na rede.'},
   {t:'summary',text:'A carteira é uma janela com a chave; o dinheiro está na blockchain. Quem tem a chave acessa de qualquer aplicativo.'},
   {t:'terms',terms:['Chave privada','Carteira HD','Frase de recuperação']}
  ]},
  {id:'custodia',title:'Corretora ou autocustódia: quem tem a chave?',optional:false,sources:['wallets','m3.mtgox','m3.ftx'],blocks:[
   {t:'p',text:'Numa corretora, a empresa guarda as chaves. Você tem um saldo na conta dela, como um crédito. Isso é **custódia**. Na **autocustódia**, a chave fica com você, e ninguém pode bloquear nem perder seu dinheiro por você.'},
   {t:'interactive',kind:'custodia',caption:'A mesma situação nos dois modelos. Em vermelho, quando o resultado é perder o dinheiro ou ficar sem acesso.',alt:'Quatro botões de situação. Para cada uma, dois quadros mostram o que acontece na corretora e na autocustódia.'},
   {t:'p',text:'Nenhum dos dois é perfeito. A corretora protege contra o seu próprio erro, mas você depende dela. A autocustódia tira o intermediário, mas o erro é seu e não tem volta.'},
   {t:'data',text:'Em fevereiro de 2014, a corretora Mt. Gox pediu proteção contra credores e disse ter perdido quase 750 mil bitcoins de clientes.',source:'m3.mtgox',date:'2026-10-21'},
   {t:'data',text:'Em 11 de novembro de 2022, a FTX pediu falência, dois dias depois de parar os saques. Ela tinha emprestado dinheiro de clientes a outra empresa do grupo.',source:'m3.ftx',date:'2026-10-21'},
   {t:'summary',text:'Na corretora você confia na empresa; na autocustódia, em você mesmo. Escolha sabendo qual risco está assumindo.'},
   {t:'terms',terms:['Custódia','Autocustódia']}
  ]},
  {id:'quente-e-fria',title:'Carteira quente e carteira fria',optional:false,sources:['wallets','safety'],blocks:[
   {t:'p',text:'A **carteira quente** guarda a chave num aparelho conectado à internet, como o celular ou uma extensão do navegador. É prática para o dia a dia, mas fica exposta a vírus, sites falsos e roubo do aparelho.'},
   {t:'figure',svg:figQuenteFria,caption:'Quanto mais longe da internet, mais segura e mais trabalhosa. Não são moedas diferentes: é onde a chave fica.',alt:'Uma linha do mais conectado ao mais isolado: corretora, app no celular, hardware wallet e papel ou metal.'},
   {t:'p',text:'A **carteira fria** mantém a chave longe da internet. O exemplo mais comum é a hardware wallet, um aparelho dedicado. A frase guardada em papel ou numa placa de metal também é "fria".'},
   {t:'analogy',text:'A carteira quente é o dinheiro no bolso: fácil de usar, ruim de perder. A fria é o cofre: dá trabalho abrir, mas é onde fica a reserva.'},
   {t:'summary',text:'Quente é prática e exposta; fria é isolada e trabalhosa. Separe o dinheiro do dia a dia da reserva.'},
   {t:'terms',terms:['Carteira quente','Carteira fria','Hardware wallet']}
  ]},
  {id:'hardware-wallet',title:'Hardware wallet: confira na tela do aparelho',optional:false,sources:['safety','wallets'],blocks:[
   {t:'p',text:'Uma **hardware wallet** guarda a chave dentro do aparelho e assina lá dentro. O computador só manda o pedido e recebe a assinatura pronta. Mesmo com vírus no computador, a chave não sai.'},
   {t:'interactive',kind:'assinatura',caption:'Três situações. Em duas, o computador foi invadido e mostra uma coisa enquanto pede para assinar outra.',alt:'Duas telas lado a lado: a do computador e a da hardware wallet. Botões para confirmar, recusar e passar à próxima situação.'},
   {t:'p',text:'O aparelho não sabe se a operação é boa: ele assina o que você confirmar. Por isso a regra de ouro é ler a tela do aparelho. Se ela mostra outro endereço, outro valor ou uma permissão que você não pediu, recuse.'},
   {t:'data',text:'O ethereum.org considera a hardware wallet a forma mais segura de guardar chaves, porque a chave privada nunca toca a internet.',source:'safety',date:'2026-10-21'},
   {t:'summary',text:'A hardware wallet protege a chave, não o seu julgamento: vale o que aparece na tela do aparelho.'},
   {t:'terms',terms:['Hardware wallet','Chave privada']}
  ]},
  {id:'endereco-e-rede',title:'Endereço certo, rede certa',optional:false,sources:['wallets','m3.circle'],blocks:[
   {t:'p',text:'Ethereum, Base, Arbitrum e outras redes compatíveis usam o mesmo formato de endereço. A mesma chave controla o mesmo endereço em todas elas, mas os saldos são separados: cada rede tem o seu registro.'},
   {t:'figure',svg:figRede,caption:'Um endereço, três redes, três saldos diferentes. A carteira mostra a rede selecionada.',alt:'Um endereço no topo ligado a três caixas: Ethereum com 100 USDC, Base com 0 e Arbitrum com 40.'},
   {t:'p',text:'Ao enviar, confira as duas coisas: o endereço e a rede. Mandar para a rede errada nem sempre perde o dinheiro, mas pode deixá-lo num lugar onde quem recebe não tem acesso, como o endereço de uma corretora que não lê aquela rede.'},
   {t:'example',text:'A corretora mostra o endereço de depósito para a rede Ethereum. Você envia pela rede Base, que é mais barata. Se a corretora não aceitar depósitos na Base, o dinheiro chega, mas ela não credita.'},
   {t:'summary',text:'O mesmo endereço existe em várias redes, com saldos separados; confira endereço e rede antes de enviar.'},
   {t:'terms',terms:['Endereço']}
  ]},
  {id:'golpes',title:'Golpes comuns: falso suporte e endereço envenenado',optional:false,sources:['safety','m3.envenenamento'],blocks:[
   {t:'p',text:'A maioria dos golpes não quebra a criptografia: engana você. O falso **suporte** aparece em grupos e redes sociais oferecendo ajuda e pede a frase. Nenhum serviço de verdade pede a frase de recuperação, nunca.'},
   {t:'interactive',kind:'envenenado',caption:'Os endereços são inventados para o exercício. Depois de escolher, as diferenças em relação ao contato salvo aparecem marcadas.',alt:'O endereço salvo do Bruno e três endereços parecidos no histórico. Ao escolher um, os caracteres diferentes ficam destacados.'},
   {t:'p',text:'No **envenenamento de endereço**, o golpista cria um endereço com o mesmo começo e o mesmo fim de alguém com quem você negocia. Ele manda uma transferência de valor zero só para aparecer no seu histórico, esperando que você copie o endereço errado.'},
   {t:'data',text:'O suporte da MetaMask orienta a conferir o endereço inteiro, inclusive o meio, a não copiar endereços do histórico e a salvar os contatos frequentes depois de conferi-los.',source:'m3.envenenamento',date:'2026-10-21'},
   {t:'summary',text:'Nunca entregue a frase, não copie endereços do histórico e confira o endereço inteiro, não só o começo e o fim.'},
   {t:'terms',terms:['Envenenamento de endereço','Frase de recuperação']}
  ]},
  {id:'aprovacao',title:'Aprovar não é transferir: cuidado com o ilimitado',optional:false,sources:['erc20','m3.eip20','safety'],blocks:[
   {t:'p',text:'Para um aplicativo mexer nos seus tokens, como numa troca, você primeiro dá uma **aprovação** (allowance): autoriza um contrato a gastar até certo valor. Aprovar não move nada; a transferência vem depois, feita pelo próprio contrato.'},
   {t:'interactive',kind:'allowance',caption:'Compare aprovar 100 com aprovar ilimitado, faça a troca e veja o que um contrato invadido consegue levar em cada caso.',alt:'Duas caixas: seu saldo e quanto o contrato pode gastar. Botões para aprovar, trocar, simular uma invasão e revogar.'},
   {t:'data',text:'No padrão ERC-20, proposto em 19 de novembro de 2015, a função approve deixa o contrato autorizado retirar várias vezes, até o valor aprovado.',source:'m3.eip20',date:'2026-10-21'},
   {t:'p',text:'Muitos sites pedem aprovação ilimitada para você não pagar taxa de novo na próxima vez. É cômodo, mas se aquele contrato for invadido, o invasor pode levar todo o saldo daquele token.'},
   {t:'data',text:'O ethereum.org recomenda não dar limite ilimitado e aprovar só o necessário para cada operação, porque um gasto ilimitado pode permitir esvaziar a carteira.',source:'safety',date:'2026-10-21'},
   {t:'summary',text:'Aprovação é permissão para gastar depois; prefira o valor exato e revogue o que não usa mais.'},
   {t:'terms',terms:['Allowance','Revogação']}
  ]},
  {id:'oferta-e-fdv',title:'Capitalização, oferta e FDV',optional:false,sources:['m3.cg-metodo','m3.cg-fdv'],blocks:[
   {t:'p',text:'O preço sozinho não diz se um token é "barato". Um token de US$ 0,01 pode valer mais, no total, que um de US$ 100. O que importa é o preço vezes a quantidade.'},
   {t:'interactive',kind:'fdv',caption:'Mexa no preço, na quantidade em circulação e na oferta total. Valores de exemplo.',alt:'Três controles: preço, tokens em circulação e oferta total. Duas barras comparam capitalização e FDV.'},
   {t:'data',text:'A CoinGecko calcula a capitalização como preço vezes oferta circulante. Para tokens de contrato, a oferta circulante é a oferta total menos os tokens travados.',source:'m3.cg-metodo',date:'2026-10-21'},
   {t:'p',text:'O **FDV** (valor totalmente diluído) imagina todos os tokens já em circulação. Quando o FDV é muito maior que a capitalização, há muitos tokens ainda por chegar ao mercado.'},
   {t:'data',text:'Num texto de estudo da CoinGecko, o FDV é o preço vezes a oferta total. O texto avisa que alguns tokens não têm FDV porque não têm oferta máxima.',source:'m3.cg-fdv',date:'2026-10-21'},
   {t:'summary',text:'Capitalização = preço × circulante; FDV = preço × oferta total. A distância entre os dois mostra quanta oferta ainda vem.'},
   {t:'terms',terms:['Capitalização de mercado','Oferta circulante','Oferta total','FDV']}
  ]},
  {id:'desbloqueios',title:'Desbloqueios e diluição',optional:false,sources:['m3.cg-metodo','risks'],blocks:[
   {t:'p',text:'Muitos projetos lançam só uma parte dos tokens. O resto fica travado e é liberado aos poucos, num calendário de **desbloqueio**: para a equipe, para investidores e para a comunidade.'},
   {t:'interactive',kind:'desbloqueio',caption:'Calendário de exemplo: 200 milhões no lançamento, 400 da comunidade liberados em 48 meses e 400 de equipe e investidores travados por 12 meses e liberados nos 24 seguintes.',alt:'Gráfico da oferta em circulação ao longo de 48 meses. Um controle move o mês e mostra a quantidade em circulação e a diluição.'},
   {t:'p',text:'Quando a carência acaba, quem comprou barato pode vender. Mais tokens no mercado sem mais compradores pressionam o preço. Isso é **diluição**: sua fatia do total diminui.'},
   {t:'example',text:'Você compra no lançamento, quando circulam 200 milhões. Dois anos depois circulam 600 milhões. Se a demanda não triplicou, o mesmo dinheiro total se divide entre o triplo de tokens.'},
   {t:'summary',text:'Confira o calendário de desbloqueio antes de comprar: carências que acabam podem trazer muita oferta de uma vez.'},
   {t:'terms',terms:['Desbloqueio','Diluição']}
  ]},
  {id:'multisig',title:'Multisig: mais de uma chave para mover',optional:false,sources:['m3.safe','wallets'],blocks:[
   {t:'p',text:'Uma conta **multisig** exige mais de uma assinatura para mover o dinheiro, por exemplo 2 de 3. Empresas, tesourarias de projetos e famílias usam para não depender de uma pessoa só.'},
   {t:'interactive',kind:'multisig',caption:'Escolha o limite, assine com os donos e veja o que acontece quando uma das chaves é roubada.',alt:'Três donos, Ana, Bia e Caio, que podem assinar uma transação pendente. Um seletor define quantas assinaturas são exigidas.'},
   {t:'data',text:'Na documentação da Safe, o limite (threshold) é o número de confirmações dos donos que uma transação precisa para poder ser executada.',source:'m3.safe',date:'2026-10-21'},
   {t:'p',text:'Com 2 de 3, perder uma chave não trava o dinheiro e roubar uma não basta. O custo é mais coordenação: cada dono precisa conferir e assinar. A conta é um contrato, então o código dele também precisa ser confiável.'},
   {t:'summary',text:'Multisig divide o poder entre várias chaves: um roubo ou uma perda sozinha não decide.'},
   {t:'terms',terms:['Multisig','Smart contract']}
  ]},
  {id:'recuperacao-e-heranca',title:'Plano de recuperação e herança',optional:true,sources:['safety','wallets'],blocks:[
   {t:'p',text:'Autocustódia sem plano é um risco para você e para sua família. Se só você sabe onde está a frase, ninguém recupera o dinheiro se algo acontecer.'},
   {t:'table',caption:'Perguntas para montar seu plano',headers:['Pergunta','Boa prática'],rows:[
    ['Onde está a frase?','Em papel ou metal, em lugar seguro, longe de fotos e da nuvem'],
    ['Existe uma senha extra (passphrase)?','Guardada separada da frase, com o mesmo cuidado'],
    ['Já testei a recuperação?','Testar com uma carteira nova e valor pequeno, nunca digitando em site'],
    ['Quem recupera se eu não puder?','Instruções lacradas para uma pessoa de confiança, sem a frase escrita junto'],
    ['Quanto fica em cada carteira?','Dia a dia no app; reserva na carteira fria']
   ]},
   {t:'summary',text:'Guarde a frase offline, teste a recuperação e deixe instruções para alguém de confiança.'},
   {t:'terms',terms:['Frase de recuperação','Autocustódia']}
  ]},
  {id:'poderes-do-contrato',title:'O que o dono do contrato pode fazer',optional:true,sources:['erc20','solidity'],blocks:[
   {t:'p',text:'Um token é um contrato, e o contrato pode dar poderes especiais a quem o administra. O site do projeto pode prometer uma coisa e o código permitir outra.'},
   {t:'table',caption:'Poderes comuns em contratos de token',headers:['Poder','O que permite','Risco para quem tem o token'],rows:[
    ['Emitir (mint)','Criar tokens novos','Diluição sem aviso'],
    ['Pausar','Travar transferências','Você não consegue vender'],
    ['Lista de bloqueio','Congelar endereços','Seu saldo pode ficar preso'],
    ['Atualizar (proxy)','Trocar o código do contrato','As regras mudam depois da compra'],
    ['Taxa na transferência','Cobrar a cada envio','Venda devolve menos que o esperado']
   ]},
   {t:'summary',text:'Leia quem controla o contrato e o que ele pode fazer; promessa no site não substitui o código.'},
   {t:'terms',terms:['Token','Smart contract']}
  ]},
  {id:'wrapped-e-pontes',title:'Tokens embrulhados e pontes',optional:true,sources:['bridges','m3.arbitrum'],blocks:[
   {t:'p',text:'Para levar um ativo de uma rede para outra, uma ponte trava o original numa rede e emite um "recibo" na outra. Esse recibo é um **token embrulhado** (wrapped).'},
   {t:'figure',svg:figWrapped,caption:'O original fica travado na ponte; o token da outra rede vale enquanto a ponte guardar e devolver o original.',alt:'Rede A com 100 USDC travados, uma ponte no meio e rede B com 100 USDC.e emitidos pela ponte.'},
   {t:'data',text:'A documentação da Arbitrum chama o USDC.e de USDC do Ethereum que passou pela ponte da Arbitrum, que trava de um lado e emite do outro. O USDC nativo na Arbitrum é emitido direto pela Circle.',source:'m3.arbitrum',date:'2026-10-21'},
   {t:'summary',text:'Token embrulhado é um recibo de ponte: herda os riscos da ponte e de quem guarda o original.'},
   {t:'terms',terms:['Token embrulhado','Ponte']}
  ]}
 ],
 quiz:[
  ['O que identifica um token de verdade?',['O nome e o símbolo','O logotipo','A rede e o endereço do contrato','O preço'],2,'Nome e símbolo qualquer um copia. O par rede + endereço do contrato é único.'],
  ['Onde ficam os seus ativos quando você usa uma carteira de autocustódia?',['Na blockchain; a carteira guarda a chave','Dentro do aplicativo','No servidor da empresa da carteira','No chip do celular'],0,'A carteira é uma janela com a chave. O saldo está registrado na rede.'],
  ['Uma corretora quebra. O que acontece com quem deixou o saldo lá?',['Nada, o dinheiro está na blockchain em nome dele','Recebe tudo de volta no dia seguinte','Vira credor e pode ficar anos sem acesso, ou perder parte','A corretora devolve em ações'],2,'Na custódia, a chave é da empresa. Foi o que aconteceu com clientes da Mt. Gox e da FTX.'],
  ['A tela do computador diz um endereço e a hardware wallet mostra outro. O que fazer?',['Confiar no computador','Confirmar duas vezes','Desligar o aparelho e confirmar no computador','Recusar: vale o que está na tela do aparelho'],3,'O computador pode estar invadido. O aparelho mostra o que você está assinando de verdade.'],
  ['Alguém do "suporte" pede sua frase de recuperação para resolver um problema. É…',['Golpe: nenhum serviço de verdade pede a frase','Normal, faz parte do atendimento','Seguro, se for por mensagem privada','Necessário para sacar'],0,'Quem tem a frase leva tudo. Nenhum serviço legítimo pede a frase.'],
  ['O que é envenenamento de endereço?',['Um vírus que apaga a carteira','Um endereço parecido que aparece no seu histórico para você copiar errado','Uma taxa extra da rede','Um token tóxico'],1,'O golpista imita o começo e o fim de um endereço conhecido e manda uma transferência de zero para aparecer no histórico.'],
  ['Aprovar um token para um contrato é o mesmo que transferir?',['Sim','Só com stablecoins','Só na rede Base','Não: dá permissão para o contrato gastar depois'],3,'A aprovação é permissão. A transferência é feita depois, pelo contrato autorizado.'],
  ['Preço de US$ 2, 100 milhões em circulação e oferta total de 1 bilhão. Qual é o FDV?',['US$ 200 milhões','US$ 2 bilhões','US$ 1 bilhão','US$ 100 milhões'],1,'FDV = preço × oferta total = 2 × 1 bilhão = US$ 2 bilhões. A capitalização seria US$ 200 milhões.'],
  ['O que costuma acontecer quando acaba a carência de equipe e investidores?',['A oferta em circulação cai','O token vira moeda nativa','Entram muitos tokens no mercado, e o preço pode sofrer','Nada muda'],2,'Desbloqueios aumentam a oferta. Sem demanda nova, isso pressiona o preço.'],
  ['Numa multisig 2 de 3, o ladrão roubou uma das chaves. Ele consegue mover o dinheiro?',['Não, precisa de outra assinatura','Sim, uma chave basta','Sim, se for de madrugada','Só metade do dinheiro'],0,'Com limite 2, uma chave sozinha não alcança o número de assinaturas exigido.']
 ],
 sources:{
  'm3.circle':['Circle · USDC Contract Addresses','https://developers.circle.com/stablecoins/usdc-contract-addresses','Endereços oficiais do USDC em cada rede.'],
  'm3.arbitrum':['Arbitrum Docs · USDC on Arbitrum One','https://docs.arbitrum.io/arbitrum-bridge/usdc-arbitrum-one','Diferença entre o USDC nativo e o USDC.e da ponte.'],
  'm3.eip20':['EIP-20 · Token Standard','https://eips.ethereum.org/EIPS/eip-20','Padrão ERC-20 (2015): transfer, approve, allowance e transferFrom.'],
  'm3.bip32':['Bitcoin BIPs · BIP-32, Hierarchical Deterministic Wallets','https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki','Uma semente gera uma árvore de chaves (2012).'],
  'm3.mtgox':['Wikipedia · Mt. Gox','https://en.wikipedia.org/wiki/Mt._Gox','Quebra da corretora em fevereiro de 2014.'],
  'm3.ftx':['Wikipedia · Bankruptcy of FTX','https://en.wikipedia.org/wiki/Bankruptcy_of_FTX','Falência da FTX em novembro de 2022 e uso de fundos de clientes.'],
  'm3.envenenamento':['MetaMask Support · Address poisoning scams','https://support.metamask.io/stay-safe/protect-yourself/wallet-and-hardware/address-poisoning-scams/','Como funciona o envenenamento de endereço e como se proteger.'],
  'm3.cg-metodo':['CoinGecko · Methodology','https://www.coingecko.com/en/methodology','Cálculo da capitalização e da oferta circulante.'],
  'm3.cg-fdv':['CoinGecko Learn · Fully Diluted Valuation','https://www.coingecko.com/learn/what-is-fully-diluted-valuation-fdv-in-crypto','FDV = preço × oferta total.'],
  'm3.safe':['Safe Docs · Glossary','https://docs.safe.global/home/glossary','Conta multi-assinatura, donos e limite de confirmações.']
 },
 glossary:[
  ['Moeda nativa','Moeda que faz parte das regras de uma rede e paga as taxas dela, como BTC no Bitcoin e ETH no Ethereum.'],
  ['Stablecoin','Token feito para acompanhar o valor de outro ativo, normalmente o dólar, como USDC e USDT.'],
  ['Carteira HD','Carteira em que uma única semente gera uma árvore de chaves (padrão BIP-32). É o que faz uma frase cuidar de várias contas.'],
  ['Custódia','Quando uma empresa guarda as chaves por você. Seu saldo é um crédito com ela.'],
  ['Autocustódia','Quando você mesmo guarda as chaves. Ninguém bloqueia seu dinheiro, mas ninguém desfaz seus erros.'],
  ['Carteira quente','Carteira cuja chave fica num aparelho conectado à internet, como o celular ou o navegador.'],
  ['Carteira fria','Carteira cuja chave fica longe da internet, como numa hardware wallet ou numa frase guardada offline.'],
  ['Envenenamento de endereço','Golpe em que um endereço parecido com um conhecido aparece no histórico para que você o copie por engano.'],
  ['Revogação','Transação que zera uma aprovação dada a um contrato, para que ele não possa mais gastar seus tokens.'],
  ['Capitalização de mercado','Preço do token vezes a quantidade em circulação.'],
  ['Oferta circulante','Quantidade de tokens que já pode ser negociada. Exclui os travados.'],
  ['Oferta total','Todos os tokens que já existem, incluindo os travados, menos os queimados.'],
  ['FDV','Valor totalmente diluído: preço vezes a oferta total, como se todos os tokens já circulassem.'],
  ['Desbloqueio','Liberação programada de tokens que estavam travados, por exemplo de equipe e investidores.'],
  ['Diluição','Queda da fatia de cada token no total quando novos tokens entram em circulação.'],
  ['Multisig','Conta que exige um número mínimo de assinaturas de vários donos para mover o dinheiro, como 2 de 3.'],
  ['Token embrulhado','Token emitido numa rede como recibo de um ativo travado em outra, por meio de uma ponte.']
 ]
});
})();
