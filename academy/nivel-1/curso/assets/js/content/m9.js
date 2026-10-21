/* Módulo 9: Investimentos e gestão de risco (formato novo, 21/10/2026).
   Figuras em SVG no topo; os interativos (kind) moram em
   academy-interativos.js. Fatos conferidos nas fontes em 21/10/2026.
   Nada aqui é recomendação de investimento. */
(function(){
const F='font-family="inherit"';
const C={azul:'#60a5fa',ciano:'#67e8f9',violeta:'#a78bfa',verm:'#f87171',ambar:'#fcd34d',fundo:'#111c30',linha:'#2a3b55',mudo:'#a9b8cf',texto:'#e2e8f0'};
const tx=(x,y,t,tam,cor,peso,ancora)=>'<text x="'+x+'" y="'+y+'" text-anchor="'+(ancora||'middle')+'" font-size="'+tam+'"'+(peso?' font-weight="'+peso+'"':'')+' fill="'+cor+'">'+t+'</text>';
const ret=(x,y,w,h,cor)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="10" fill="'+C.fundo+'" stroke="'+cor+'" stroke-width="2"/>';
const linhaPts=(pts,cor,larg)=>'<polyline points="'+pts+'" fill="none" stroke="'+cor+'" stroke-width="'+(larg||3)+'"/>';

/* Correlação que muda na crise (séries ilustrativas). */
const figCorrelacao='<svg viewBox="0 0 640 240" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +'<line x1="40" y1="190" x2="620" y2="190" stroke="'+C.linha+'" stroke-width="2"/>'
 +'<rect x="400" y="20" width="220" height="170" fill="'+C.verm+'" opacity="0.08"/>'+tx(510,38,'crise',13,C.verm)
 +linhaPts('40,120 80,100 120,125 160,95 200,115 240,90 280,110 320,85 360,100 400,90 440,130 480,160 520,175 560,170 600,165',C.ambar)
 +linhaPts('40,90 80,115 120,95 160,120 200,100 240,118 280,95 320,112 360,92 400,100 440,135 480,158 520,170 560,168 600,160',C.violeta)
 +'<rect x="50" y="200" width="14" height="14" fill="'+C.ambar+'"/>'+tx(70,212,'ativo A',13,C.texto,0,'start')
 +'<rect x="160" y="200" width="14" height="14" fill="'+C.violeta+'"/>'+tx(180,212,'ativo B',13,C.texto,0,'start')
 +tx(220,40,'em dias normais, um sobe quando o outro cai',13,C.mudo)
 +tx(320,234,'Séries ilustrativas. Na crise, ativos que se compensavam podem cair juntos.',13,C.mudo)+'</svg>';

/* Simulação: um leque de cenários, não uma previsão. */
const figCenarios='<svg viewBox="0 0 640 240" xmlns="http://www.w3.org/2000/svg" '+F+'>'
 +'<line x1="40" y1="120" x2="620" y2="120" stroke="'+C.linha+'" stroke-width="1.5" stroke-dasharray="4 4"/>'
 +'<polygon points="40,120 620,20 620,220" fill="'+C.violeta+'" opacity="0.12"/>'
 +'<polygon points="40,120 620,60 620,180" fill="'+C.violeta+'" opacity="0.18"/>'
 +linhaPts('40,120 620,95',C.ciano)
 +tx(612,30,'cenário bom',12,C.mudo,0,'end')+tx(612,214,'cenário ruim',12,C.mudo,0,'end')+tx(612,88,'mediana',12,C.ciano,0,'end')
 +'<circle cx="560" cy="232" r="0"/>'+tx(48,140,'hoje',12,C.mudo,0,'start')
 +tx(320,236,'O modelo mostra o que acontece se as hipóteses estiverem certas. A realidade pode sair do leque.',12,C.mudo)+'</svg>';

AcademyContent.register({
 id:'m9',
 title:'Investimentos e gestão de risco',
 icon:'line-chart',
 summary:'Retorno sempre vem junto com risco: como pensar em objetivo, prazo, quedas, diversificação de verdade e tamanho de posição. Ferramentas para decidir, não recomendações.',
 minutes:50,
 goals:[
  'Separar dinheiro por objetivo e prazo e montar uma reserva de emergência',
  'Entender drawdown, correlação e por que vários ativos podem ser o mesmo risco',
  'Dimensionar uma posição pela perda que você aceita',
  'Usar rebalanceamento e aportes mensais, e ler simulações com as hipóteses'
 ],
 flow:['Objetivo e prazo','Exposições','Cenários adversos','Liquidez e saída','Acompanhamento'],
 history:{
  intro:'Gestão de risco não nasceu com as criptomoedas. As ideias que valem aqui foram pensadas para ações e títulos há mais de 70 anos, e as quedas do mercado cripto só deixaram as lições mais visíveis.',
  timeline:[
   {when:'1949',title:'Aportes regulares',text:'Benjamin Graham descreve em "O Investidor Inteligente" a prática de investir a mesma quantia todo mês ou trimestre.'},
   {when:'1952',title:'Teoria das carteiras',text:'Harry Markowitz publica "Portfolio Selection": juntar ativos que não andam juntos reduz o risco da carteira.'},
   {when:'1990',title:'Nobel',text:'Markowitz divide o Nobel de Economia com William Sharpe, que simplificou o modelo.'},
   {when:'2022',title:'O inverno cripto',text:'O colapso da Terra, em maio, e a falência da FTX, em novembro, mostram ao mesmo tempo risco de preço, de emissor e de custódia.'}
  ]
 },
 lessons:[
  {id:'objetivo-e-prazo',title:'Objetivo, prazo e reserva de emergência',optional:false,sources:['allocation','m9.mpt'],blocks:[
   {t:'p',text:'Antes de escolher o que comprar, defina para que serve o dinheiro e quando vai precisar dele. Dinheiro para daqui a seis meses não pode estar num ativo que cai 60% num ano ruim.'},
   {t:'interactive',kind:'baldes',caption:'Mude quanto está em cripto e seus gastos, e veja se você precisaria vender na baixa. Cenário de exemplo.',alt:'Controles da parte em cripto e dos gastos mensais. Um quadro mostra quanto precisa para 6 meses, quanto está em dinheiro, quanto de cripto precisaria vender e o que sobra.'},
   {t:'p',text:'A **reserva de emergência** existe para que uma crise na sua vida não obrigue você a vender investimentos no pior momento. Só depois dela faz sentido pensar em risco.'},
   {t:'example',text:'Duas pessoas têm a mesma cripto. Uma tem seis meses de gastos guardados; a outra não. Na mesma queda, a primeira espera; a segunda vende no fundo e transforma a queda em perda.'},
   {t:'summary',text:'Separe o dinheiro por objetivo e prazo; reserva de emergência primeiro, risco depois.'},
   {t:'terms',terms:['Reserva de emergência']}
  ]},
  {id:'drawdown',title:'Quedas e a matemática da recuperação',optional:false,sources:['m9.drawdown'],blocks:[
   {t:'p',text:'**Drawdown** é a queda a partir do topo. Ele mede quanto dói segurar um investimento. E tem uma matemática cruel: para recuperar uma queda, é preciso subir mais do que caiu.'},
   {t:'interactive',kind:'recuperacao',caption:'Escolha a queda e veja a alta necessária para voltar ao ponto de partida.',alt:'Controle da queda a partir do topo e duas barras: a queda e a alta necessária para voltar.'},
   {t:'data',text:'O drawdown máximo é a pior queda de um topo até um fundo desde o início do investimento.',source:'m9.drawdown',date:'2026-10-21'},
   {t:'p',text:'Uma queda de 50% exige alta de 100%. Uma de 80%, que já aconteceu várias vezes em cripto, exige alta de 400%. Evitar quedas fundas vale mais do que pegar a alta máxima.'},
   {t:'summary',text:'Depois de cair X%, é preciso subir mais que X% para voltar; quedas fundas custam caro.'},
   {t:'terms',terms:['Drawdown']}
  ]},
  {id:'diversificacao',title:'Diversificar de verdade',optional:false,sources:['m9.mpt','risks'],blocks:[
   {t:'p',text:'Ter muitos ativos não é o mesmo que estar diversificado. Se todos dependem do mesmo preço, do mesmo emissor ou da mesma ponte, a carteira tem um risco só, repetido.'},
   {t:'interactive',kind:'exposicao',caption:'Marque e desmarque posições e veja quanto da carteira depende de cada risco.',alt:'Cinco posições para marcar e quatro barras: preço do ETH, emissor do USDC, contratos de terceiros e preço do BTC.'},
   {t:'data',text:'A teoria de Markowitz mostra que juntar ativos cujos retornos não andam exatamente juntos (correlação abaixo de 1) reduz o risco da carteira. O ganho depende de como os ativos se movem entre si.',source:'m9.mpt',date:'2026-10-21'},
   {t:'example',text:'ETH, um token de staking de ETH e uma pool ETH/USDC parecem três investimentos. Numa queda do ETH, os três caem juntos.'},
   {t:'summary',text:'Diversifique por riscos (preço, emissor, contrato, custódia), não pelo número de nomes.'},
   {t:'terms',terms:['Diversificação','Correlação']}
  ]},
  {id:'correlacao',title:'Correlação muda quando mais importa',optional:false,sources:['m9.mpt','risks'],blocks:[
   {t:'p',text:'**Correlação** mede o quanto dois ativos andam juntos. Calculada num período calmo, ela pode enganar: numa crise, todo mundo vende o que dá para vender, e ativos que se compensavam caem juntos.'},
   {t:'figure',svg:figCorrelacao,caption:'Duas séries ilustrativas: compensam-se em dias normais e afundam juntas na crise.',alt:'Gráfico com dois ativos que se movem em direções opostas em dias normais e caem juntos numa faixa marcada como crise.'},
   {t:'p',text:'Por isso, não confie numa correlação calculada como se fosse fixa. Pergunte: numa venda em pânico, esses ativos ainda se protegem?'},
   {t:'summary',text:'Correlação é uma média do passado e pode subir na crise; proteja-se pensando no pior momento.'},
   {t:'terms',terms:['Correlação']}
  ]},
  {id:'tamanho-da-posicao',title:'O tamanho da posição',optional:false,sources:['risks','allocation'],blocks:[
   {t:'p',text:'O risco de um investimento depende muito do quanto você coloca nele. Uma aposta arriscada pequena pode fazer sentido; a mesma aposta com metade da carteira, não.'},
   {t:'interactive',kind:'tamanho',caption:'Defina a perda que aceita na carteira toda e quanto o ativo pode cair. O resultado é o tamanho máximo.',alt:'Controles da perda máxima aceita e da queda possível do ativo. Um quadro mostra o tamanho máximo da posição e a fatia da carteira.'},
   {t:'p',text:'A conta é simples: tamanho máximo = perda que você aceita ÷ queda possível. Se o ativo pode cair 70% e você aceita perder 5% da carteira, a posição não passa de cerca de 7% dela.'},
   {t:'summary',text:'Defina antes quanto aceita perder e dimensione a posição por isso, não pelo quanto espera ganhar.'},
   {t:'terms',terms:['Tamanho de posição']}
  ]},
  {id:'rebalanceamento',title:'Rebalancear: disciplina sem previsão',optional:false,sources:['allocation','m9.mpt'],blocks:[
   {t:'p',text:'Você define uma divisão-alvo, por exemplo metade em BTC e metade em dólar digital. Com o tempo, o que sobe passa a pesar mais. **Rebalancear** é vender um pouco do que subiu e comprar do que caiu para voltar ao alvo.'},
   {t:'interactive',kind:'rebal',caption:'Mexa na variação do BTC e veja o quanto a carteira se afasta do alvo de 50/50.',alt:'Controle da variação do BTC e uma barra com o peso do BTC na carteira frente ao alvo de 50%. Um quadro mostra o peso, o total e a ação para voltar ao alvo.'},
   {t:'p',text:'Rebalancear força a comprar barato e vender caro sem precisar adivinhar nada. Custa taxas e pode gerar imposto, então costuma ser feito em datas fixas ou quando o desvio passa de um limite.'},
   {t:'summary',text:'Rebalancear devolve a carteira ao alvo, realizando parte dos ganhos e comprando na baixa.'},
   {t:'terms',terms:['Rebalanceamento']}
  ]},
  {id:'aporte-mensal',title:'Aporte mensal × tudo de uma vez',optional:false,sources:['m9.dca'],blocks:[
   {t:'p',text:'Investir a mesma quantia todo mês, o **aporte mensal** (DCA), compra mais unidades quando o preço está baixo e menos quando está alto. Tira a pressão de acertar o momento.'},
   {t:'interactive',kind:'dca',caption:'Compare R$ 100 por mês com R$ 600 no primeiro mês, em três cenários de preço de exemplo.',alt:'Seletor de cenário e gráfico dos preços em seis meses. Um quadro mostra o preço médio do aporte mensal e o valor final das duas estratégias.'},
   {t:'data',text:'Benjamin Graham descreveu em 1949 o investimento da mesma quantia todo mês ou trimestre. Em simulações históricas da Vanguard, investir de uma vez uma quantia que já se tinha ganhou do investimento em etapas cerca de dois terços das vezes, porque o mercado tendeu a subir.',source:'m9.dca',date:'2026-10-21'},
   {t:'p',text:'Para quem investe parte do salário todo mês, a questão nem se coloca: o aporte mensal é o natural. A disciplina de manter os aportes nas quedas é o que mais pesa.'},
   {t:'summary',text:'Aporte mensal compra mais na baixa e reduz o risco de entrar no pior momento; de uma vez tende a ganhar quando o mercado sobe.'},
   {t:'terms',terms:['Aporte mensal (DCA)']}
  ]},
  {id:'simulacao',title:'Simulação não é previsão',optional:false,sources:['risks','m9.mpt'],blocks:[
   {t:'p',text:'Simuladores mostram leques de cenários: o bom, o ruim, a mediana. São úteis para pensar, mas cada número depende das hipóteses: retorno esperado, volatilidade, correlação.'},
   {t:'figure',svg:figCenarios,caption:'Um leque de cenários. O modelo diz o que acontece dentro das hipóteses; eventos fora delas não aparecem.',alt:'Leque que se abre do presente para o futuro, com a mediana ao centro e os cenários bom e ruim nas bordas.'},
   {t:'p',text:'Depeg, falência de emissor, invasão de contrato: modelos simples não enxergam esses eventos. Um "pior cenário" do modelo não é o pior cenário real.'},
   {t:'example',text:'O simulador diz que, em 90% dos casos, a carteira perde no máximo 30%. Isso vale para o modelo. Uma falência de corretora pode levar 100% do que estava lá.'},
   {t:'summary',text:'Use simulações para pensar, não para prever; o pior cenário real pode estar fora do leque.'},
   {t:'terms',terms:['Cenário']}
  ]},
  {id:'mapa-de-risco',title:'Mapa de risco de uma posição',optional:true,sources:['risks'],blocks:[
   {t:'p',text:'Para cada posição importante, preencha um mapa com os riscos e o que aconteceria em cada um. Ele mostra onde você está concentrado.'},
   {t:'table',caption:'Riscos para mapear em cada posição',headers:['Risco','Pergunta'],rows:[
    ['Preço','Quanto pode cair num ano ruim?'],
    ['Liquidez','Consigo sair rápido, e com que desconto?'],
    ['Custódia','Quem tem a chave?'],
    ['Contrato','Que códigos e auditorias estão no caminho?'],
    ['Emissor','Quem promete pagar, e se quebrar?'],
    ['Concentração','Quanto da carteira depende disso?']
   ]},
   {t:'summary',text:'Preço, liquidez, custódia, contrato, emissor e concentração: escreva cada um para cada posição grande.'},
   {t:'terms',terms:['Diversificação']}
  ]},
  {id:'vieses',title:'Os vieses que atrapalham',optional:true,sources:['allocation'],blocks:[
   {t:'p',text:'Os maiores erros costumam ser de comportamento, não de cálculo: comprar porque todo mundo está comprando, vender em pânico no fundo, não aceitar realizar uma perda e dobrar a aposta.'},
   {t:'example',text:'O preço sobe 80% em um mês e as redes sociais só falam disso. É exatamente quando o risco de entrar é maior e a vontade também.'},
   {t:'summary',text:'Regras escritas antes (alvo, tamanho, rebalanceamento) protegem contra decisões tomadas no calor do momento.'},
   {t:'terms',terms:['Rebalanceamento']}
  ]},
  {id:'custos',title:'Custos que comem o retorno',optional:true,sources:['allocation','gas'],blocks:[
   {t:'p',text:'Taxas de corretora, diferença entre compra e venda, taxas de rede, taxas de saque e impostos somam. Um rendimento de 10% com 4% de custos é um rendimento de 6%.'},
   {t:'example',text:'Mexer na carteira toda semana parece cuidado, mas cada troca paga taxa e pode gerar imposto. Menos movimento costuma render mais.'},
   {t:'summary',text:'Some todos os custos antes de comparar retornos; giro alto costuma custar caro.'},
   {t:'terms',terms:['Cenário']}
  ]}
 ],
 quiz:[
  ['Para que serve a reserva de emergência?',['Para não precisar vender investimentos no pior momento','Para render mais','Para comprar cripto na alta','Para pagar impostos'],0,'Ela cobre imprevistos e evita vender na baixa.'],
  ['Depois de cair 50%, quanto um investimento precisa subir para voltar?',['50%','25%','100%','200%'],2,'R$ 500 precisam dobrar para voltar a R$ 1.000.'],
  ['ETH, token de staking de ETH e pool ETH/USDC formam uma carteira diversificada?',['Sim, são três ativos','Sim, se forem em redes diferentes','Só se tiver BTC','Não: todos dependem do preço do ETH'],3,'Nomes diferentes, mesmo risco principal.'],
  ['O que pode acontecer com a correlação numa crise?',['Ativos que se compensavam podem cair juntos','Ela some para sempre','Fica sempre igual','Vira negativa'],0,'Numa venda em pânico, quase tudo cai junto.'],
  ['Você aceita perder 5% da carteira e o ativo pode cair 50%. Qual o tamanho máximo da posição?',['50% da carteira','10% da carteira','5% da carteira','100% da carteira'],1,'Tamanho = perda aceita ÷ queda possível = 5% ÷ 50% = 10%.'],
  ['Seu alvo é 50/50 e o BTC dobrou. O que o rebalanceamento manda fazer?',['Comprar mais BTC','Não fazer nada','Vender tudo','Vender parte do BTC e voltar ao alvo'],3,'O BTC passou a pesar mais que o alvo; vende-se o excesso.'],
  ['Qual a vantagem do aporte mensal (DCA)?',['Garante lucro','Compra mais unidades quando o preço está baixo','Sempre ganha de investir tudo de uma vez','Evita taxas'],1,'Valor fixo compra mais quando está barato; não garante lucro.'],
  ['O simulador diz que no pior caso você perde 30%. Isso é o pior que pode acontecer?',['Sim','Sim, se for um bom simulador','Não: eventos fora das hipóteses, como uma falência, não entram no modelo','Só em cripto'],2,'O modelo só enxerga o que foi colocado nele.'],
  ['O que Markowitz mostrou em 1952?',['Que juntar ativos que não andam juntos reduz o risco','Que cripto é seguro','Que o mercado sempre sobe','Que diversificar aumenta o risco'],0,'A diversificação reduz o risco conforme a correlação entre os ativos.'],
  ['Qual destes é um custo que reduz o retorno?',['Diferença entre compra e venda','Taxa de rede','Imposto','Todos os anteriores'],3,'Todos somam e precisam entrar na conta.']
 ],
 sources:{
  'm9.mpt':['Wikipedia · Modern portfolio theory','https://en.wikipedia.org/wiki/Modern_portfolio_theory','Markowitz (1952), o Nobel de 1990 e a diversificação pela correlação.'],
  'm9.drawdown':['Wikipedia · Drawdown (economics)','https://en.wikipedia.org/wiki/Drawdown_(economics)','Definição de drawdown e de drawdown máximo.'],
  'm9.dca':['Wikipedia · Dollar cost averaging','https://en.wikipedia.org/wiki/Dollar_cost_averaging','Aporte regular, Benjamin Graham (1949) e a comparação com investir de uma vez.']
 },
 glossary:[
  ['Reserva de emergência','Dinheiro guardado em algo seguro e fácil de sacar, para imprevistos.'],
  ['Diversificação','Espalhar o dinheiro por riscos diferentes, para que um problema não atinja tudo.'],
  ['Correlação','Quanto dois ativos costumam subir e cair juntos. Pode mudar, principalmente em crises.'],
  ['Tamanho de posição','Quanto da carteira vai num ativo, definido pela perda que você aceita.'],
  ['Rebalanceamento','Vender o que passou do alvo e comprar o que ficou abaixo, para voltar à divisão planejada.'],
  ['Aporte mensal (DCA)','Investir a mesma quantia em intervalos regulares, qualquer que seja o preço.'],
  ['Cenário','Hipótese sobre o futuro usada para testar uma decisão. Não é previsão.']
 ]
});
})();
