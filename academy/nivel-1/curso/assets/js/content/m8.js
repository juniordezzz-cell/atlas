/* Módulo 8: RWA e tokenização (formato novo, 21/10/2026). Figuras em SVG no
   topo; os interativos (kind) moram em academy-interativos.js. Fatos
   conferidos nas fontes em 21/10/2026. */
(function(){
const F='font-family="inherit"';
const C={azul:'#60a5fa',ciano:'#67e8f9',violeta:'#a78bfa',verm:'#f87171',ambar:'#fcd34d',fundo:'#111c30',linha:'#2a3b55',mudo:'#a9b8cf',texto:'#e2e8f0'};
const tx=(x,y,t,tam,cor,peso,ancora)=>'<text x="'+x+'" y="'+y+'" text-anchor="'+(ancora||'middle')+'" font-size="'+tam+'"'+(peso?' font-weight="'+peso+'"':'')+' fill="'+cor+'">'+t+'</text>';
const ret=(x,y,w,h,cor)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="10" fill="'+C.fundo+'" stroke="'+cor+'" stroke-width="2"/>';
const seta=(x1,y1,x2,y2,cor)=>'<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+(cor||C.mudo)+'" stroke-width="2"/>';

/* Do ativo real à carteira. */
const elo=(x,t,s,cor)=>ret(x,70,112,80,cor)+tx(x+56,102,t,14,C.texto,700)+tx(x+56,126,s,12,C.mudo);
const figCadeia='<svg viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +tx(160,40,'fora da blockchain',13,C.ambar)+tx(520,40,'na blockchain',13,C.ciano)
 +'<line x1="380" y1="30" x2="380" y2="180" stroke="'+C.linha+'" stroke-width="2" stroke-dasharray="6 6"/>'
 +elo(10,'Ativo','imóvel, título',C.ambar)+elo(134,'Empresa','dona do ativo',C.ambar)+elo(258,'Custódia','guarda e cobra',C.ambar)
 +elo(392,'Token','direito sobre a empresa',C.ciano)+elo(516,'Carteira','sua',C.ciano)
 +seta(122,110,134,110)+seta(246,110,258,110)+seta(370,110,392,110)+seta(504,110,516,110)
 +tx(320,206,'O token é só a última parte. Tudo à esquerda da linha depende de contratos, leis e pessoas.',13,C.mudo)+'</svg>';

/* Tipos de RWA. */
const tipo=(x,y,t,s,cor)=>ret(x,y,195,70,cor)+tx(x+97,y+30,t,15,C.texto,700)+tx(x+97,y+52,s,12,C.mudo);
const figTipos='<svg viewBox="0 0 640 210" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +tipo(10,15,'Títulos públicos','fundos de títulos curtos',C.ciano)+tipo(222,15,'Ouro e commodities','1 token = 1 onça guardada',C.ambar)+tipo(434,15,'Imóveis','frações de uma empresa dona',C.azul)
 +tipo(10,105,'Crédito privado','empréstimos a empresas',C.violeta)+tipo(222,105,'Ações e fundos','papéis de mercado',C.azul)+tipo(434,105,'Arte e colecionáveis','frações de uma obra',C.linha)
 +tx(320,200,'Mesma tecnologia, riscos muito diferentes: o ativo de baixo do token manda.',13,C.mudo)+'</svg>';

/* O que a blockchain confere e o que não confere. */
const figVerifica='<svg viewBox="0 0 640 230" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +ret(15,15,295,170,C.ciano)+tx(162,45,'A blockchain confere',17,C.texto,700)
 +tx(30,78,'✓ quem tem quantos tokens',14,C.texto,0,'start')+tx(30,104,'✓ transferências e regras do contrato',14,C.texto,0,'start')+tx(30,130,'✓ pagamentos feitos na rede',14,C.texto,0,'start')+tx(30,156,'✓ o histórico, para sempre',14,C.texto,0,'start')
 +ret(330,15,295,170,C.verm)+tx(477,45,'Não confere',17,C.texto,700)
 +tx(345,78,'✗ se o imóvel existe',14,C.texto,0,'start')+tx(345,104,'✗ se o ouro está no cofre',14,C.texto,0,'start')+tx(345,130,'✗ se há dívidas escondidas',14,C.texto,0,'start')+tx(345,156,'✗ se um juiz aceita o token',14,C.texto,0,'start')
 +tx(320,214,'O lado direito depende de auditoria, custódia e lei, não de criptografia.',13,C.mudo)+'</svg>';

/* Ativo separado × misturado ao emissor. */
const figSegregacao='<svg viewBox="0 0 640 240" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +ret(15,15,295,180,C.ciano)+tx(162,42,'Ativo separado',16,C.texto,700)
 +ret(35,60,120,60,C.linha)+tx(95,95,'Emissor',13,C.texto)+ret(170,60,120,60,C.ciano)+tx(230,88,'Empresa só',13,C.texto)+tx(230,106,'do imóvel',13,C.texto)
 +tx(162,150,'o emissor quebra; o imóvel',13,C.mudo)+tx(162,170,'continua dos donos dos tokens',13,C.ciano)
 +ret(330,15,295,180,C.verm)+tx(477,42,'Ativo misturado',16,C.texto,700)
 +ret(370,60,215,60,C.verm)+tx(477,88,'Emissor',13,C.texto)+tx(477,106,'(imóvel no balanço dele)',12,C.mudo)
 +tx(477,150,'o emissor quebra; os donos',13,C.mudo)+tx(477,170,'dos tokens viram credores na fila',13,C.verm)
 +tx(320,225,'Pergunte sempre: em nome de quem está o ativo?',13,C.mudo)+'</svg>';

AcademyContent.register({
 id:'m8',
 title:'RWA e tokenização',
 icon:'building-2',
 summary:'Títulos, imóveis e ouro na blockchain: o que o token realmente garante, quem precisa cumprir a parte de fora e quanto sobra de renda no fim.',
 minutes:50,
 goals:[
  'Explicar o que um token de RWA representa e o que fica fora da blockchain',
  'Mapear emissor, veículo jurídico, custodiante, administrador e auditor',
  'Calcular a renda líquida e entender o preço de mercado frente ao valor da cota',
  'Reconhecer tokens com lista de permitidos e o risco de falência do emissor'
 ],
 flow:['Ativo / direito real','Estrutura jurídica','Custodiante / emissor','Token na rede','Carteira do investidor'],
 history:{
  intro:'Tokenizar ativos do mundo real foi, por anos, mais promessa que prática. A virada veio quando gestoras tradicionais passaram a registrar cotas de fundos em blockchain, começando pelo que é mais simples de representar: títulos do governo americano.',
  timeline:[
   {when:'nov 2015',title:'O padrão de tokens',text:'O ERC-20 dá ao Ethereum um formato comum para tokens. Anos depois, ele seria a base de muitos tokens de RWA.'},
   {when:'2021',title:'Primeiro fundo tokenizado nos EUA',text:'A Franklin Templeton lança, como piloto, o primeiro fundo mútuo americano "tokenizado", usando uma blockchain para registrar as cotas.'},
   {when:'mar 2024',title:'BlackRock entra',text:'A maior gestora do mundo lança o BUIDL, seu primeiro fundo tokenizado, no Ethereum, com títulos do Tesouro americano. Atrai US$ 245 milhões na primeira semana.'},
   {when:'2024',title:'Regras na Europa',text:'O MiCA passa a valer na União Europeia, com as regras de stablecoins em junho e o restante em dezembro.'}
  ]
 },
 lessons:[
  {id:'o-que-e',title:'RWA: um token que aponta para fora da rede',optional:false,sources:['m8.eth-rwa'],blocks:[
   {t:'p',text:'**RWA** (real-world assets, ativos do mundo real) são tokens que representam algo que existe fora da blockchain: um título do governo, uma barra de ouro, parte de um imóvel. O token circula na rede; o ativo continua no mundo físico e jurídico.'},
   {t:'figure',svg:figCadeia,caption:'Do ativo à carteira. A blockchain cuida só da parte da direita.',alt:'Cinco elos: ativo, empresa dona, custódia, token e carteira. Uma linha tracejada separa o que está fora da blockchain do que está nela.'},
   {t:'data',text:'O ethereum.org define RWAs como tokens que representam formas de riqueza já existentes, como imóveis, ouro, ações, arte e máquinas. Tokenizar torna esses ativos divisíveis e mais fáceis de negociar.',source:'m8.eth-rwa',date:'2026-10-21'},
   {t:'p',text:'A pergunta central de qualquer RWA é: o que exatamente eu tenho direito de receber, de quem, e como cobro se não pagarem? O token não responde isso sozinho.'},
   {t:'summary',text:'RWA é um token que representa um direito sobre algo fora da rede; o valor depende de quem cumpre a parte de fora.'},
   {t:'terms',terms:['RWA','Tokenização']}
  ]},
  {id:'tipos',title:'O que já está sendo tokenizado',optional:false,sources:['m8.eth-rwa','m8.blackrock'],blocks:[
   {t:'p',text:'Quase qualquer ativo pode virar token. Os mais comuns hoje são os mais simples de guardar e avaliar: títulos públicos de curto prazo, ouro e crédito.'},
   {t:'figure',svg:figTipos,caption:'Seis famílias de RWA. A tecnologia é a mesma; o risco vem do ativo de baixo.',alt:'Seis caixas: títulos públicos, ouro e commodities, imóveis, crédito privado, ações e fundos, e arte e colecionáveis.'},
   {t:'data',text:'Em março de 2024, a BlackRock lançou o BUIDL, seu primeiro fundo tokenizado, no Ethereum. O fundo investe em títulos do Tesouro americano e acordos de recompra, e atraiu US$ 245 milhões na primeira semana.',source:'m8.blackrock',date:'2026-10-21'},
   {t:'example',text:'Um token de ouro pode ter lastro de uma onça guardada num cofre. O de um imóvel costuma ser uma fração de uma empresa que é dona do imóvel, não do imóvel em si.'},
   {t:'summary',text:'Títulos curtos, ouro, crédito, imóveis e ações já viraram token; cada um traz o risco do ativo que representa.'},
   {t:'terms',terms:['RWA']}
  ]},
  {id:'quem-faz-o-que',title:'Quem faz o quê fora da rede',optional:false,sources:['m8.eth-rwa','risks'],blocks:[
   {t:'p',text:'Um RWA depende de uma cadeia de participantes. Cada um tem uma tarefa e cada um pode falhar. Conhecer essa cadeia é a maior parte da análise.'},
   {t:'interactive',kind:'papeisrwa',caption:'Seis participantes comuns num RWA. Clique para ver o que cada um faz e o que acontece se falhar.',alt:'Seis cartões: emissor, veículo jurídico, custodiante, administrador, auditor e oráculo. Clicar mostra a função e o risco de cada um.'},
   {t:'data',text:'O ethereum.org aponta como limitações a ligação entre o ativo físico e o token, a dúvida sobre se a lei reconhece a posse pelo token e se os contratos valem num tribunal, e a regulação desigual entre países.',source:'m8.eth-rwa',date:'2026-10-21'},
   {t:'summary',text:'Emissor, veículo jurídico, custodiante, administrador, auditor e oráculo: o token vale o que essa cadeia entregar.'},
   {t:'terms',terms:['Custodiante','Veículo jurídico']}
  ]},
  {id:'fundos-de-titulos',title:'Fundos de títulos tokenizados',optional:false,sources:['m8.blackrock','m8.franklin'],blocks:[
   {t:'p',text:'O RWA que mais cresceu foi o mais simples: cotas de fundos que compram títulos curtos do governo americano. O token rende os juros dos títulos e pode ser usado na rede, inclusive como garantia em DeFi.'},
   {t:'interactive',kind:'navrwa',caption:'Precisa sair no fim de semana? Compare vender no mercado com esperar o resgate. Valores de exemplo.',alt:'Controle do desconto pedido por quem compra no mercado. Um quadro compara vender agora, resgatar na segunda e a diferença.'},
   {t:'data',text:'Em 2021, a Franklin Templeton lançou como piloto o primeiro fundo mútuo americano tokenizado, que usa uma blockchain para processar transações e registrar a posse das cotas.',source:'m8.franklin',date:'2026-10-21'},
   {t:'p',text:'O token tem o **valor da cota** (quanto valem os títulos do fundo), mas o resgate tem horário e regras. Fora delas, o preço de saída depende de quem quer comprar.'},
   {t:'summary',text:'Fundos de títulos tokenizados rendem juros reais, mas resgate tem regra; fora dela, sair custa um desconto.'},
   {t:'terms',terms:['Valor da cota','Resgate']}
  ]},
  {id:'renda-liquida',title:'Renda anunciada, renda que chega',optional:false,sources:['m8.eth-rwa'],blocks:[
   {t:'p',text:'Imóveis tokenizados costumam anunciar o aluguel. Mas entre o aluguel bruto e o que chega na sua carteira há meses vazios, condomínio, impostos, manutenção e a taxa da plataforma.'},
   {t:'interactive',kind:'renda',caption:'Um imóvel de R$ 2 milhões dividido em 1.000 tokens. Mexa no aluguel, na vacância, nas despesas e na taxa. Valores de exemplo, antes de impostos.',alt:'Controles de aluguel, meses vazios, despesas e taxa da plataforma. Um quadro mostra o bruto, o líquido, o valor por token e o rendimento real.'},
   {t:'data',text:'O ethereum.org cita como exemplo de imóvel tokenizado frações de empresas donas de imóveis que pagam o aluguel aos detentores em stablecoins.',source:'m8.eth-rwa',date:'2026-10-21'},
   {t:'example',text:'Aluguel de R$ 12 mil por mês parece 7,2% ao ano sobre R$ 2 milhões. Com um mês vazio, R$ 2.500 de despesas por mês e 10% de taxa, sobram cerca de 4,6%.'},
   {t:'summary',text:'Compare sempre a renda líquida, depois de vacância, despesas e taxas, com a anunciada.'},
   {t:'terms',terms:['RWA']}
  ]},
  {id:'acesso-restrito',title:'Token com lista de permitidos',optional:false,sources:['m8.erc3643'],blocks:[
   {t:'p',text:'Muitos RWAs são valores mobiliários, e a lei exige saber quem os tem. Por isso o token só circula entre carteiras cadastradas e aprovadas. Uma transferência para outra carteira simplesmente falha.'},
   {t:'interactive',kind:'permissao',caption:'Tente enviar para cada carteira. Depois veja o que o emissor pode fazer com a sua.',alt:'Quatro carteiras de destino; clicar mostra se a transferência passa ou é bloqueada. Um botão simula o congelamento pelo emissor.'},
   {t:'data',text:'O padrão ERC-3643 restringe as transferências a participantes elegíveis, conferidos por um registro de identidades. O emissor pode congelar carteiras e nomear agentes que fazem transferências forçadas, inclusive para recuperar tokens de quem perdeu a carteira.',source:'m8.erc3643',date:'2026-10-21'},
   {t:'p',text:'Isso protege contra fraude e cumpre a lei, mas muda a natureza do ativo: ele não é "seu" como um bitcoin na sua carteira. O emissor mantém poder sobre ele.'},
   {t:'summary',text:'Tokens de RWA costumam exigir cadastro, e o emissor pode congelar ou mover tokens; é um ativo com dono no meio.'},
   {t:'terms',terms:['Lista de permitidos']}
  ]},
  {id:'o-que-a-rede-ve',title:'O que a blockchain confere, e o que não',optional:false,sources:['m8.eth-rwa'],blocks:[
   {t:'p',text:'A blockchain é ótima para registrar quem tem quantos tokens e fazer pagamentos. Ela não tem olhos no mundo físico: não sabe se o imóvel existe, se o ouro está no cofre, se há dívidas escondidas.'},
   {t:'figure',svg:figVerifica,caption:'A parte da esquerda é garantida por criptografia; a da direita, por auditoria, custódia e lei.',alt:'Duas colunas. A blockchain confere quem tem os tokens, as transferências, os pagamentos na rede e o histórico. Não confere se o imóvel existe, se o ouro está no cofre, dívidas escondidas e se um juiz aceita o token.'},
   {t:'data',text:'Para o ethereum.org, uma prova de reservas que mostre a posse legal dos ativos por trás dos tokens é um bom sinal.',source:'m8.eth-rwa',date:'2026-10-21'},
   {t:'summary',text:'Transparência do token não é transparência do ativo; confira auditoria, custódia e base jurídica.'},
   {t:'terms',terms:['Tokenização','Custodiante']}
  ]},
  {id:'falencia',title:'E se o emissor quebrar?',optional:false,sources:['risks','m8.eth-rwa'],blocks:[
   {t:'p',text:'O teste mais duro de um RWA é a falência de quem o criou. Se o ativo está numa empresa separada (veículo jurídico), ele continua dos donos dos tokens. Se está no balanço do emissor, os donos dos tokens viram credores na fila.'},
   {t:'figure',svg:figSegregacao,caption:'A mesma falência, dois desfechos, dependendo de em nome de quem está o ativo.',alt:'À esquerda, o ativo numa empresa separada continua dos donos dos tokens. À direita, o ativo no balanço do emissor entra na falência.'},
   {t:'p',text:'Leia nos documentos: em nome de quem está o ativo, quem tem prioridade para receber, e o que acontece com a renda se o administrador parar. Essas respostas valem mais que qualquer número de rendimento.'},
   {t:'example',text:'Uma plataforma de imóveis fecha. Se cada imóvel estava numa empresa própria, outro administrador pode assumir e os aluguéis continuam. Se não, começa um processo longo.'},
   {t:'summary',text:'Ativo separado protege os donos do token na falência do emissor; ativo misturado transforma o investidor em credor.'},
   {t:'terms',terms:['Veículo jurídico']}
  ]},
  {id:'regulacao',title:'Regras pelo mundo',optional:true,sources:['m8.eth-rwa','m7.mica'],blocks:[
   {t:'p',text:'Tokenizar não tira o ativo da lei. Um token que representa uma ação continua sendo, para o regulador, um valor mobiliário.'},
   {t:'data',text:'O ethereum.org cita Singapura, Emirados Árabes, Hong Kong e Suíça entre os primeiros a regular RWAs, a União Europeia começando a regular, e os Estados Unidos ainda à espera de orientação da SEC.',source:'m8.eth-rwa',date:'2026-10-21'},
   {t:'summary',text:'Cada país trata RWAs de um jeito; o token herda as regras do ativo que representa.'},
   {t:'terms',terms:['RWA']}
  ]},
  {id:'perguntas',title:'Perguntas antes de olhar o rendimento',optional:true,sources:['risks','bis'],blocks:[
   {t:'p',text:'Antes de qualquer projeção de renda, responda às perguntas abaixo. Elas separam um RWA sério de um token com foto de prédio.'},
   {t:'table',caption:'Roteiro de análise de um RWA',headers:['Pergunta','O que procurar'],rows:[
    ['Que direito o token dá?','Propriedade, dívida, renda ou só um recibo'],
    ['Em nome de quem está o ativo?','Empresa separada, com documentos públicos'],
    ['Quem guarda e quem confere?','Custodiante e auditor independentes'],
    ['Como entra e sai a renda?','Despesas, taxas e calendário de pagamento'],
    ['Como eu saio?','Resgate, prazo, desconto no mercado'],
    ['O que o emissor pode fazer com meu token?','Congelar, mover, mudar regras']
   ]},
   {t:'summary',text:'Direito, titularidade, custódia, renda líquida, saída e poderes do emissor: seis respostas antes do número.'},
   {t:'terms',terms:['RWA','Custodiante']}
  ]},
  {id:'liquidez',title:'Tokenizar não cria comprador',optional:true,sources:['m8.eth-rwa','risks'],blocks:[
   {t:'p',text:'Dividir um imóvel em mil tokens não garante que alguém compre o seu. Liquidez depende de gente interessada, de mercados abertos e das regras de transferência.'},
   {t:'example',text:'Você quer vender 10 tokens de um prédio comercial. Só investidores cadastrados podem comprar, e há três ofertas, todas 15% abaixo do valor estimado.'},
   {t:'summary',text:'Token transferível não é token líquido; confira volume, compradores e regras antes de contar com a saída.'},
   {t:'terms',terms:['Lista de permitidos']}
  ]}
 ],
 quiz:[
  ['O que um token de RWA representa?',['Um direito sobre algo fora da blockchain','Um ativo que só existe na rede','Uma moeda nativa','Um NFT de arte digital'],0,'RWA aponta para um ativo do mundo real; o token é a representação na rede.'],
  ['A blockchain consegue conferir se o imóvel por trás de um token existe?',['Sim, automaticamente','Sim, com oráculo de preço','Só no Ethereum','Não: isso depende de auditoria, custódia e lei'],3,'A rede confere tokens e transferências, não o mundo físico.'],
  ['Qual participante guarda o ativo de verdade?',['O auditor','O custodiante','A carteira','O minerador'],1,'O custodiante guarda o ouro, os títulos ou a escritura.'],
  ['O fundo só resgata em dia útil e você precisa sair no sábado. O que costuma acontecer?',['O token vira dólar sozinho','Você recebe mais','Você vende a alguém com desconto','É proibido vender'],2,'Fora da janela de resgate, quem compra cobra um desconto por esperar.'],
  ['Aluguel de R$ 12 mil por mês num imóvel de R$ 2 milhões rende 7,2% ao ano para quem tem o token?',['Sim, exatamente','Não: vacância, despesas e taxas reduzem a renda','Rende mais, por causa da blockchain','Rende só em stablecoin'],1,'A renda líquida é bem menor que a bruta anunciada.'],
  ['Você tenta enviar um token de RWA para uma carteira sem cadastro. O que acontece?',['A transferência é bloqueada pelo contrato','Chega normalmente','Chega pela metade','Vira outro token'],0,'Tokens com lista de permitidos só circulam entre carteiras aprovadas.'],
  ['O emissor de um token no padrão ERC-3643 pode congelar sua carteira?',['Não, nunca','Só se você pedir','Sim, e também nomear agentes para transferências forçadas','Só no fim do ano'],2,'O padrão prevê congelamento e transferências forçadas por agentes.'],
  ['O emissor quebrou, mas cada imóvel estava numa empresa separada. E os donos dos tokens?',['Perdem tudo','Viram credores na fila','Recebem em ações do emissor','Mantêm o direito sobre o imóvel'],3,'O ativo separado não entra na falência do emissor.'],
  ['O que a BlackRock lançou em março de 2024?',['Um banco digital','Seu primeiro fundo tokenizado, o BUIDL','Uma stablecoin algorítmica','Uma blockchain própria'],1,'O BUIDL investe em títulos do Tesouro americano e roda no Ethereum.'],
  ['Dividir um imóvel em mil tokens garante que você vai conseguir vender o seu?',['Não: liquidez depende de compradores e regras','Sim, sempre','Sim, se for no Ethereum','Sim, pelo valor estimado'],0,'Transferível não é o mesmo que líquido.']
 ],
 sources:{
  'm8.eth-rwa':['Ethereum.org · Real-world assets','https://ethereum.org/real-world-assets/','O que são RWAs, tipos, vantagens, riscos e regulação.'],
  'm8.blackrock':['Wikipedia · BlackRock','https://en.wikipedia.org/wiki/BlackRock','Lançamento do fundo tokenizado BUIDL em março de 2024.'],
  'm8.franklin':['Wikipedia · Franklin Templeton','https://en.wikipedia.org/wiki/Franklin_Templeton','Primeiro fundo mútuo americano tokenizado, piloto de 2021.'],
  'm8.erc3643':['ERC-3643 · T-REX, Token for Regulated EXchanges','https://eips.ethereum.org/EIPS/eip-3643','Tokens com identidade verificada, congelamento e transferências forçadas.']
 },
 glossary:[
  ['Tokenização','Representar um ativo ou direito como token numa blockchain.'],
  ['Custodiante','Empresa que guarda o ativo de verdade por trás de um token.'],
  ['Veículo jurídico','Empresa separada criada só para ser dona de um ativo, protegendo-o da falência do emissor.'],
  ['Valor da cota','Quanto valem os ativos de um fundo divididos pelo número de cotas ou tokens.'],
  ['Lista de permitidos','Cadastro de carteiras autorizadas a receber um token; transferências fora dela falham.']
 ]
});
})();
