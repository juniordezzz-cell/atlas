/* Módulo 1: Criptografia, no formato novo (história, aulas em blocos, figuras SVG próprias). */
(function(){
const F='font-family="inherit"';
/* Figura 1: mensagem, texto cifrado e mensagem de novo. */
const figCiclo='<svg viewBox="0 0 640 200" xmlns="http://www.w3.org/2000/svg" '+F+'>'
+'<rect x="10" y="30" width="180" height="96" rx="10" fill="#111c30" stroke="#2a3b55" stroke-width="2"/>'
+'<text x="100" y="62" text-anchor="middle" font-size="17" fill="#a9b8cf">Mensagem</text>'
+'<text x="100" y="106" text-anchor="middle" font-size="30" font-weight="700" fill="#e2e8f0" font-family="monospace">PAZ</text>'
+'<rect x="230" y="30" width="180" height="96" rx="10" fill="#111c30" stroke="#60a5fa" stroke-width="2"/>'
+'<text x="320" y="62" text-anchor="middle" font-size="17" fill="#a9b8cf">Texto cifrado</text>'
+'<text x="320" y="106" text-anchor="middle" font-size="30" font-weight="700" fill="#67e8f9" font-family="monospace">SDC</text>'
+'<rect x="450" y="30" width="180" height="96" rx="10" fill="#111c30" stroke="#2a3b55" stroke-width="2"/>'
+'<text x="540" y="62" text-anchor="middle" font-size="17" fill="#a9b8cf">Mensagem</text>'
+'<text x="540" y="106" text-anchor="middle" font-size="30" font-weight="700" fill="#e2e8f0" font-family="monospace">PAZ</text>'
+'<line x1="192" y1="78" x2="218" y2="78" stroke="#a9b8cf" stroke-width="2"/><polygon points="218,71 229,78 218,85" fill="#a9b8cf"/>'
+'<line x1="412" y1="78" x2="438" y2="78" stroke="#a9b8cf" stroke-width="2"/><polygon points="438,71 449,78 438,85" fill="#a9b8cf"/>'
+'<text x="210" y="160" text-anchor="middle" font-size="18" fill="#60a5fa">cifrar</text>'
+'<text x="430" y="160" text-anchor="middle" font-size="18" fill="#60a5fa">decifrar</text>'
+'<text x="320" y="190" text-anchor="middle" font-size="17" fill="#a9b8cf">as duas etapas usam a mesma chave: andar 3 letras</text>'
+'</svg>';
/* Figura 2: alfabeto de cima e alfabeto deslocado em 3. */
const top=['A','B','C','D','E','F','…','X','Y','Z'],bot=['D','E','F','G','H','I','…','A','B','C'];
let cesar='<svg viewBox="0 0 640 240" xmlns="http://www.w3.org/2000/svg" '+F+'>'
+'<text x="20" y="20" font-size="17" fill="#a9b8cf">Letra original</text>';
top.forEach((l,i)=>{const x=20+i*60,c=x+26,volta=i>6,blue=volta?'#60a5fa':'#a9b8cf';
 if(l!=='…')cesar+='<rect x="'+x+'" y="30" width="52" height="46" rx="6" fill="#111c30" stroke="#2a3b55" stroke-width="2"/>'
  +'<rect x="'+x+'" y="146" width="52" height="46" rx="6" fill="#111c30" stroke="'+(volta?'#60a5fa':'#2a3b55')+'" stroke-width="2"/>'
  +'<line x1="'+c+'" y1="80" x2="'+c+'" y2="132" stroke="'+blue+'" stroke-width="2"/><polygon points="'+(c-6)+',132 '+(c+6)+',132 '+c+',143" fill="'+blue+'"/>';
 cesar+='<text x="'+c+'" y="63" text-anchor="middle" font-size="28" font-weight="700" fill="#e2e8f0" font-family="monospace">'+l+'</text>'
  +'<text x="'+c+'" y="179" text-anchor="middle" font-size="28" font-weight="700" fill="#67e8f9" font-family="monospace">'+bot[i]+'</text>';
});
cesar+='<text x="380" y="113" text-anchor="middle" font-size="20" font-weight="700" fill="#60a5fa">+3</text>'
+'<text x="20" y="222" font-size="17" fill="#a9b8cf">Letra cifrada. No fim, X, Y e Z voltam ao começo.</text></svg>';
/* Figura 3: barras calculadas com AcademyLabs.m1.frequencies sobre a amostra citada na aula 3. */
const freq=[['E',16.4,'H'],['A',13.2,'D'],['R',9.5,'U'],['S',8.2,'V'],['O',6.8,'R'],['N',6.8,'Q'],['I',5.9,'L'],['D',5.9,'G'],['T',5.5,'W'],['C',4.5,'F']];
let barras='<svg viewBox="0 0 640 310" xmlns="http://www.w3.org/2000/svg" '+F+'>'
+'<text x="20" y="22" font-size="17" fill="#a9b8cf">Amostra: 220 letras. As 10 mais comuns.</text>'
+'<line x1="20" y1="220" x2="625" y2="220" stroke="#2a3b55" stroke-width="2"/>';
freq.forEach(([l,v,c],i)=>{const h=v/16.4*170,x=30+i*60+10,y=220-h,cx=x+20;
 barras+='<rect x="'+x+'" y="'+y.toFixed(1)+'" width="40" height="'+h.toFixed(1)+'" rx="3" fill="'+(i===0?'#67e8f9':'#60a5fa')+'"/>'
  +'<text x="'+cx+'" y="'+(y-8).toFixed(1)+'" text-anchor="middle" font-size="16" fill="#a9b8cf">'+String(v).replace('.',',')+'</text>'
  +'<text x="'+cx+'" y="248" text-anchor="middle" font-size="22" font-weight="700" fill="#e2e8f0">'+l+'</text>'
  +'<text x="'+cx+'" y="278" text-anchor="middle" font-size="20" fill="#67e8f9">'+c+'</text>';
});
barras+='<text x="20" y="303" font-size="16" fill="#a9b8cf">Em azul-claro: a mesma letra depois da cifra de César com chave 3.</text></svg>';
/* Figura 4: Vigenère cifrando CASA com a chave LUA. */
const vig=[['Mensagem',['C','A','S','A'],'#e2e8f0'],['Chave',['L','U','A','L'],'#60a5fa'],['Anda',['11','20','0','11'],'#a9b8cf'],['Cifrado',['N','U','S','L'],'#67e8f9']];
let vigenere='<svg viewBox="0 0 640 290" xmlns="http://www.w3.org/2000/svg" '+F+'>';
vig.forEach(([rot,cel,cor],r)=>{const y=14+r*62;
 vigenere+='<text x="20" y="'+(y+33)+'" font-size="19" fill="#a9b8cf">'+rot+'</text>';
 cel.forEach((t,i)=>{const x=190+i*110,dest=(i===1||i===3);
  vigenere+='<rect x="'+x+'" y="'+y+'" width="96" height="50" rx="6" fill="#111c30" stroke="'+(dest&&r!==2?'#67e8f9':'#2a3b55')+'" stroke-width="2"/>'
   +'<text x="'+(x+48)+'" y="'+(y+34)+'" text-anchor="middle" font-size="'+(r===2?20:26)+'" font-weight="700" fill="'+cor+'" font-family="monospace">'+t+'</text>';
 });
});
vigenere+='<text x="20" y="282" font-size="16" fill="#a9b8cf">As duas letras A viraram U e L: a chave muda a cada posição.</text></svg>';
/* Figura 5: duas pessoas e a mesma chave. */
const pessoa=(x,nome)=>'<circle cx="'+x+'" cy="58" r="20" fill="none" stroke="#a9b8cf" stroke-width="2"/><path d="M'+(x-32)+' 122 Q'+x+' 70 '+(x+32)+' 122 Z" fill="none" stroke="#a9b8cf" stroke-width="2"/>'
 +'<text x="'+x+'" y="150" text-anchor="middle" font-size="20" fill="#e2e8f0">'+nome+'</text>';
const chave=(x,y)=>'<circle cx="'+x+'" cy="'+y+'" r="10" fill="none" stroke="#67e8f9" stroke-width="3"/><line x1="'+(x+10)+'" y1="'+y+'" x2="'+(x+44)+'" y2="'+y+'" stroke="#67e8f9" stroke-width="3"/><line x1="'+(x+34)+'" y1="'+y+'" x2="'+(x+34)+'" y2="'+(y+10)+'" stroke="#67e8f9" stroke-width="3"/><line x1="'+(x+42)+'" y1="'+y+'" x2="'+(x+42)+'" y2="'+(y+8)+'" stroke="#67e8f9" stroke-width="3"/>';
const cadeado=(x,y,aberto)=>'<rect x="'+x+'" y="'+y+'" width="44" height="34" rx="5" fill="#111c30" stroke="#60a5fa" stroke-width="2"/><path d="M'+(x+10)+' '+y+' V'+(y-12)+' Q'+(x+22)+' '+(y-28)+' '+(x+34)+' '+(y-12)+(aberto?' V'+(y-6):' V'+y)+'" fill="none" stroke="#60a5fa" stroke-width="3"/>';
const figSimetrica='<svg viewBox="0 0 640 250" xmlns="http://www.w3.org/2000/svg" '+F+'>'
+pessoa(80,'Ana')+pessoa(560,'Bruno')+chave(58,180)+chave(538,180)
+'<rect x="240" y="40" width="160" height="96" rx="10" fill="#111c30" stroke="#2a3b55" stroke-width="2"/>'
+cadeado(298,82,false)
+'<text x="320" y="70" text-anchor="middle" font-size="16" fill="#a9b8cf">caixa trancada</text>'
+'<line x1="122" y1="88" x2="226" y2="88" stroke="#a9b8cf" stroke-width="2"/><polygon points="226,81 237,88 226,95" fill="#a9b8cf"/>'
+'<line x1="404" y1="88" x2="506" y2="88" stroke="#a9b8cf" stroke-width="2"/><polygon points="506,81 517,88 506,95" fill="#a9b8cf"/>'
+'<text x="320" y="190" text-anchor="middle" font-size="18" fill="#67e8f9">a mesma chave tranca e destranca</text>'
+'<text x="320" y="230" text-anchor="middle" font-size="18" fill="#e2e8f0">Problema: como entregar a chave sem ninguém copiar?</text></svg>';
/* Figura 6: caixa de correio com fenda pública e chave privada. */
const envelope=(x,y)=>'<rect x="'+x+'" y="'+y+'" width="56" height="36" rx="3" fill="#111c30" stroke="#a9b8cf" stroke-width="2"/><polyline points="'+x+','+y+' '+(x+28)+','+(y+20)+' '+(x+56)+','+y+'" fill="none" stroke="#a9b8cf" stroke-width="2"/>';
const figCorreio='<svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" '+F+'>'
+envelope(30,40)+envelope(30,110)+envelope(30,180)
+'<text x="58" y="250" text-anchor="middle" font-size="16" fill="#a9b8cf">qualquer pessoa</text>'
+'<line x1="96" y1="58" x2="330" y2="96" stroke="#a9b8cf" stroke-width="2"/><line x1="96" y1="128" x2="330" y2="100" stroke="#a9b8cf" stroke-width="2"/><line x1="96" y1="198" x2="330" y2="104" stroke="#a9b8cf" stroke-width="2"/>'
+'<polygon points="328,92 342,100 328,108" fill="#a9b8cf"/>'
+'<rect x="345" y="60" width="200" height="170" rx="14" fill="#111c30" stroke="#60a5fa" stroke-width="2"/>'
+'<rect x="385" y="92" width="120" height="14" rx="4" fill="#60a5fa"/>'
+'<text x="445" y="40" text-anchor="middle" font-size="18" fill="#60a5fa">fenda = chave pública</text>'
+cadeado(423,170,false)
+chave(420,248)
+'<text x="445" y="290" text-anchor="middle" font-size="18" fill="#67e8f9">chave privada: só a dona abre</text></svg>';
/* Figura 7: entradas parecidas, saídas SHA-256 totalmente diferentes (conferidas com crypto.subtle e sha256sum). */
const linhaHash=(y,a,b,c,saida)=>'<rect x="10" y="'+(y-28)+'" width="200" height="48" rx="6" fill="#111c30" stroke="#2a3b55" stroke-width="2"/>'
 +'<text x="110" y="'+(y+3)+'" text-anchor="middle" font-size="20" fill="#e2e8f0" font-family="monospace">'+a+'<tspan fill="#67e8f9" font-weight="700">'+b+'</tspan>'+c+'</text>'
 +'<line x1="212" y1="'+(y-4)+'" x2="232" y2="'+(y-4)+'" stroke="#a9b8cf" stroke-width="2"/><polygon points="232,'+(y-10)+' 242,'+(y-4)+' 232,'+(y+2)+'" fill="#a9b8cf"/>'
 +'<line x1="352" y1="'+(y-4)+'" x2="372" y2="'+(y-4)+'" stroke="#a9b8cf" stroke-width="2"/><polygon points="372,'+(y-10)+' 382,'+(y-4)+' 372,'+(y+2)+'" fill="#a9b8cf"/>'
 +'<text x="388" y="'+(y+3)+'" font-size="19" fill="#67e8f9" font-family="monospace">'+saida+'</text>';
const figHash='<svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" '+F+'>'
+'<rect x="244" y="14" width="106" height="226" rx="10" fill="#111c30" stroke="#60a5fa" stroke-width="2"/>'
+'<text x="297" y="133" text-anchor="middle" font-size="20" font-weight="700" fill="#60a5fa">SHA-256</text>'
+linhaHash(54,'Alice envia ','1','','d8cb797dbff3…')
+linhaHash(134,'Alice envia ','2','','a4ffc6189c0c…')
+linhaHash(214,'','a','lice envia 1','87162aeb4b80…')
+'</svg>';
/* Figura 8: assinar e verificar. */
const caixa=(x,y,t1,t2,cor)=>'<rect x="'+x+'" y="'+y+'" width="180" height="64" rx="8" fill="#111c30" stroke="'+cor+'" stroke-width="2"/>'
 +(t2?'<text x="'+(x+90)+'" y="'+(y+27)+'" text-anchor="middle" font-size="18" fill="#e2e8f0">'+t1+'</text><text x="'+(x+90)+'" y="'+(y+50)+'" text-anchor="middle" font-size="18" fill="#e2e8f0">'+t2+'</text>'
  :'<text x="'+(x+90)+'" y="'+(y+39)+'" text-anchor="middle" font-size="18" fill="#e2e8f0">'+t1+'</text>');
const seta=(x1,x2,y)=>'<line x1="'+x1+'" y1="'+y+'" x2="'+(x2-10)+'" y2="'+y+'" stroke="#a9b8cf" stroke-width="2"/><polygon points="'+(x2-10)+','+(y-7)+' '+x2+','+y+' '+(x2-10)+','+(y+7)+'" fill="#a9b8cf"/>';
const figAssina='<svg viewBox="0 0 640 310" xmlns="http://www.w3.org/2000/svg" '+F+'>'
+'<text x="10" y="24" font-size="17" fill="#60a5fa">1. Assinar (no seu aparelho)</text>'
+caixa(10,40,'Mensagem','','#2a3b55')+'<text x="212" y="80" text-anchor="middle" font-size="26" fill="#a9b8cf">+</text>'
+caixa(230,40,'Chave privada','','#67e8f9')+seta(412,450,72)+caixa(450,40,'Assinatura','','#60a5fa')
+'<line x1="540" y1="106" x2="540" y2="150" stroke="#60a5fa" stroke-width="2" stroke-dasharray="6 5"/>'
+'<line x1="540" y1="150" x2="100" y2="150" stroke="#60a5fa" stroke-width="2" stroke-dasharray="6 5"/>'
+'<line x1="100" y1="150" x2="100" y2="186" stroke="#60a5fa" stroke-width="2" stroke-dasharray="6 5"/><polygon points="93,186 100,197 107,186" fill="#60a5fa"/>'
+'<text x="320" y="142" text-anchor="middle" font-size="16" fill="#a9b8cf">a assinatura viaja junto com a mensagem</text>'
+caixa(10,200,'Mensagem','+ assinatura','#2a3b55')+'<text x="212" y="240" text-anchor="middle" font-size="26" fill="#a9b8cf">+</text>'
+caixa(230,200,'Chave pública','','#60a5fa')+seta(412,450,232)+caixa(450,200,'Confere?','sim ou não','#67e8f9')
+'<text x="10" y="296" font-size="17" fill="#60a5fa">2. Verificar (qualquer pessoa, sem a chave privada)</text></svg>';
/* Figura 9: direção única da chave privada até o endereço. */
const figEndereco='<svg viewBox="0 0 640 230" xmlns="http://www.w3.org/2000/svg" '+F+'>'
+caixa(10,40,'Chave','privada','#67e8f9')+seta(192,228,72)+caixa(230,40,'Chave','pública','#60a5fa')+seta(412,448,72)+caixa(450,40,'Endereço','','#60a5fa')
+'<text x="100" y="128" text-anchor="middle" font-size="16" fill="#a9b8cf">segredo</text>'
+'<text x="320" y="128" text-anchor="middle" font-size="16" fill="#a9b8cf">pode mostrar</text>'
+'<text x="540" y="128" text-anchor="middle" font-size="16" fill="#a9b8cf">pode mostrar</text>'
+'<line x1="560" y1="170" x2="90" y2="170" stroke="#a9b8cf" stroke-width="2" stroke-dasharray="6 6"/><polygon points="90,163 78,170 90,177" fill="#a9b8cf"/>'
+'<line x1="300" y1="156" x2="340" y2="184" stroke="#e2e8f0" stroke-width="3"/><line x1="340" y1="156" x2="300" y2="184" stroke="#e2e8f0" stroke-width="3"/>'
+'<text x="320" y="214" text-anchor="middle" font-size="18" fill="#e2e8f0">o caminho de volta não existe na prática</text></svg>';
/* Figura 10: árvore de Merkle com quatro itens e a prova de inclusão do item 3. */
const no=(cx,y,t,cor)=>'<rect x="'+(cx-62)+'" y="'+y+'" width="124" height="44" rx="6" fill="#111c30" stroke="'+cor+'" stroke-width="2"/><text x="'+cx+'" y="'+(y+29)+'" text-anchor="middle" font-size="18" fill="#e2e8f0">'+t+'</text>';
const liga=(x1,y1,x2,y2)=>'<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="#2a3b55" stroke-width="2"/>';
const figMerkle='<svg viewBox="0 0 640 270" xmlns="http://www.w3.org/2000/svg" '+F+'>'
+liga(320,64,160,110)+liga(320,64,480,110)+liga(160,154,80,200)+liga(160,154,240,200)+liga(480,154,400,200)+liga(480,154,560,200)
+no(320,20,'Raiz','#60a5fa')+no(160,110,'Resumo 1+2','#67e8f9')+no(480,110,'Resumo 3+4','#2a3b55')
+no(80,200,'Item 1','#2a3b55')+no(240,200,'Item 2','#2a3b55')+no(400,200,'Item 3','#60a5fa')+no(560,200,'Item 4','#67e8f9')
+'<text x="320" y="264" text-anchor="middle" font-size="16" fill="#a9b8cf">Para provar o Item 3 bastam os dois resumos em ciano.</text></svg>';

AcademyContent.register({
 id:'m1',
 title:'Criptografia',
 icon:'key-round',
 summary:'Da cifra de Júlio César à chave da sua carteira: como guardar segredos e provar quem autorizou algo.',
 minutes:40,
 goals:[
  'Explicar com suas palavras o que são mensagem, cifra e chave',
  'Cifrar e decifrar com César e entender por que ela é fácil de quebrar',
  'Diferenciar criptografia simétrica, chave pública, hash e assinatura',
  'Saber de onde vem o endereço de uma carteira e proteger a frase de recuperação'
 ],
 flow:['Mensagem','Resumo (hash)','Assinatura com chave privada','Verificação com chave pública'],
 history:{
  intro:'Desde que existe escrita, existe gente querendo mandar um recado que só o destinatário entenda. Generais, reis e comerciantes sempre tiveram segredos. A criptografia nasceu dessa vontade: transformar uma mensagem em algo ilegível para quem não tem a chave. Por séculos foi um jogo de esconder e descobrir. Cada vez que alguém criava um jeito novo de esconder, alguém criava um jeito novo de descobrir. No século XX vieram as máquinas e depois os computadores. Hoje a mesma ideia protege suas conversas no celular, suas compras pela internet e as criptomoedas. Esta linha do tempo mostra os passos principais. Você vai rever cada um nas aulas, e as fontes de cada marco estão na aba Fontes.',
  timeline:[
   {when:'Século I a.C.',title:'Júlio César troca letras',text:'Segundo o historiador romano Suetônio, César escrevia cartas secretas trocando cada letra pela que vem três posições depois: o A virava D.'},
   {when:'Século IX',title:'al-Kindi conta as letras',text:'O sábio árabe al-Kindi, de Bagdá, descreveu a análise de frequência: contar quais letras aparecem mais para descobrir o que foi trocado. Foi o fim da segurança das cifras de troca simples.'},
   {when:'1553',title:'A chave vira uma palavra',text:'O italiano Giovan Battista Bellaso publicou uma cifra que usa uma palavra como chave. Séculos depois ela foi atribuída por engano ao francês Blaise de Vigenère e ficou com o nome dele.'},
   {when:'1932 a 1945',title:'A máquina Enigma é quebrada',text:'O matemático polonês Marian Rejewski descobriu, no fim de 1932, como a Enigma alemã funcionava por dentro. Em 1939 os poloneses passaram o que sabiam aos britânicos. Em Bletchley Park, Alan Turing e colegas criaram máquinas para quebrar a Enigma durante a guerra.'},
   {when:'1976',title:'Diffie e Hellman: chave pública',text:'Whitfield Diffie e Martin Hellman publicaram "New Directions in Cryptography". A ideia: combinar um segredo com alguém sem nunca se encontrar e sem mandar a chave pelo caminho.'},
   {when:'1977',title:'DES e RSA',text:'Os Estados Unidos publicaram o DES, um padrão de criptografia para computadores. No mesmo ano, Rivest, Shamir e Adleman criaram o RSA, o primeiro sistema prático publicado de chave pública (um par de chaves: uma que se mostra e outra secreta) e de assinatura digital. O artigo saiu em 1978.'},
   {when:'2002',title:'SHA-256',text:'O NIST, órgão de padrões dos Estados Unidos, publicou o SHA-256 como padrão em agosto de 2002. Ele gera um resumo curto, uma espécie de "impressão digital", de qualquer dado.'},
   {when:'2008',title:'Bitcoin',text:'Satoshi Nakamoto anunciou o documento do Bitcoin numa lista de discussão sobre criptografia em 31 de outubro de 2008. O Bitcoin usa o SHA-256 e um método de assinatura chamado ECDSA, peças que você vai conhecer neste módulo.'}
  ]
 },
 lessons:[
  {id:'o-que-e',title:'O que é criptografia: mensagem, segredo e chave',optional:false,sources:['m1.suetonio','m1.kerckhoffs'],blocks:[
   {t:'p',text:'Imagine que você precisa mandar um bilhete pela sala de aula. Ele vai passar pela mão de várias pessoas antes de chegar ao destino. Qualquer uma pode ler. Como fazer para que só o destinatário entenda?'},
   {t:'p',text:'**Criptografia** é a arte de transformar uma mensagem em algo ilegível para quem não deveria ler. Quem tem o segredo certo consegue desfazer a transformação e ler de novo.'},
   {t:'p',text:'Três palavras aparecem o tempo todo neste módulo. A **mensagem** é o texto original, que qualquer um entende. A **cifra** é a regra usada para embaralhar a mensagem. A **chave** é o detalhe secreto que faz a regra funcionar. O resultado embaralhado se chama **texto cifrado**.'},
   {t:'analogy',text:'A cifra é como o modelo de uma fechadura, que pode ser igual em mil portas. A chave é o que torna a sua porta diferente das outras. Todo mundo pode saber qual fechadura você usa. Ninguém deve ter a sua chave.'},
   {t:'figure',svg:figCiclo,caption:'Cifrar transforma a mensagem em texto cifrado. Decifrar faz o caminho de volta. As duas etapas usam a mesma chave.',alt:'Três caixas lado a lado. A primeira tem a mensagem PAZ. Uma seta marcada cifrar leva à segunda, com o texto cifrado SDC. Outra seta marcada decifrar leva à terceira, com PAZ de novo.'},
   {t:'example',text:'Regra: troque cada letra pela que vem 3 posições depois no alfabeto. Chave: o número 3. A mensagem PAZ vira SDC. Quem sabe a regra e a chave anda 3 letras para trás e lê PAZ de novo.'},
   {t:'p',text:'Uma ideia guia a criptografia moderna: a segurança deve depender só da chave, não de esconder a regra. Ela é conhecida como princípio de Kerckhoffs, publicado em 1883 pelo holandês Auguste Kerckhoffs. As regras usadas hoje são públicas e estudadas por especialistas do mundo todo. O segredo fica só na chave.'},
   {t:'summary',text:'Criptografia usa uma regra (a cifra) e um segredo (a chave) para que só quem tem a chave consiga ler a mensagem.'},
   {t:'terms',terms:['Criptografia','Cifra','Chave','Texto cifrado']}
  ]},
  {id:'cifra-de-cesar',title:'A cifra de César',optional:false,sources:['m1.suetonio'],blocks:[
   {t:'p',text:'Há mais de dois mil anos, Júlio César trocava cartas com amigos sobre assuntos particulares. As cartas iam de mão em mão. Se caíssem nas mãos erradas, os segredos estariam expostos.'},
   {t:'p',text:'O historiador romano **Suetônio**, na obra A Vida dos Doze Césares, conta como César resolvia isso. Quando tinha algo secreto a dizer, ele trocava as letras do alfabeto. Nas cartas, cada letra aparecia trocada pela que fica três posições adiante: D no lugar de A, E no lugar de B, e assim por diante. Ou seja, cada letra anda **três posições**.'},
   {t:'figure',svg:cesar,caption:'Cada letra de cima vira a letra três posições à frente. No fim do alfabeto, a contagem volta ao começo: X vira A, Y vira B e Z vira C.',alt:'Duas fileiras de letras. Em cima: A, B, C, D, E, F, reticências, X, Y, Z. Embaixo, ligadas por setas: D, E, F, G, H, I, reticências, A, B, C. No meio, o rótulo mais 3.'},
   {t:'example',text:'Vamos cifrar ROMA com chave 3. R anda 3 e vira U. O vira R. M vira P. A vira D. Resultado: URPD. Para decifrar, ande 3 letras para trás: U volta a R, R volta a O, P volta a M e D volta a A.'},
   {t:'p',text:'Aqui a cifra é "andar no alfabeto" e a chave é o número de casas, também chamado de **deslocamento**. César usava 3, mas qualquer número de 1 a 25 funciona. Com 26 a letra voltaria a ser ela mesma, e não haveria segredo nenhum.'},
   {t:'analogy',text:'Pense em duas réguas com o alfabeto, uma em cima da outra. Deslize a de baixo três casas. Agora cada letra de cima tem uma "parceira" embaixo. Quem tem a mesma régua, deslizada do mesmo jeito, decifra na hora.'},
   {t:'p',text:'Quer testar? Na aba **Laboratórios** deste módulo você digita uma frase, escolhe o deslocamento e vê o texto cifrado mudar na hora. Experimente cifrar seu nome.'},
   {t:'summary',text:'Na cifra de César, cada letra anda um número fixo de casas no alfabeto; esse número é a chave.'},
   {t:'terms',terms:['Cifra','Chave']}
  ]},
  {id:'por-que-cesar-caiu',title:'Por que César caiu: força bruta e frequência',optional:false,sources:['m1.kindi','m1.suetonio'],blocks:[
   {t:'p',text:'A cifra de César bastava para a época de César. Hoje ela é quebrada em segundos. Existem dois jeitos simples de fazer isso.'},
   {t:'p',text:'O primeiro é a **força bruta**: testar todas as chaves possíveis, uma por uma. Na cifra de César só existem 25 deslocamentos úteis. Basta tentar os 25 e ver qual deixa o texto legível. Dá para fazer à mão em poucos minutos.'},
   {t:'example',text:'Você recebe "SDC". Tenta deslocamento 1 para trás: RCB, não faz sentido. Deslocamento 2: QBA, nada. Deslocamento 3: PAZ. Achou. No pior caso, seriam 25 tentativas.'},
   {t:'p',text:'O segundo jeito é mais esperto e foi descrito no século IX pelo sábio árabe **al-Kindi**, em Bagdá. Ele percebeu que, em qualquer língua, algumas letras aparecem muito mais do que outras. Essa técnica se chama **análise de frequência**.'},
   {t:'p',text:'Para ver isso na prática, contamos as letras deste texto de amostra, escrito para esta aula: "A criptografia nasceu da vontade de guardar um segredo. Durante séculos, generais, reis e comerciantes mandaram mensagens que só o destinatário deveria entender. Hoje a mesma ideia protege conversas no celular, compras pela internet e as carteiras de criptomoedas." O texto tem 220 letras. Contamos as letras com a mesma ferramenta do laboratório, sem considerar os acentos.'},
   {t:'figure',svg:barras,caption:'Frequência das letras na amostra acima, não a frequência oficial do português. Embaixo de cada letra, em azul-claro, está a letra que a substitui na cifra de César com chave 3.',alt:'Gráfico de barras com as 10 letras mais comuns da amostra: E 16,4 por cento, A 13,2, R 9,5, S 8,2, O 6,8, N 6,8, I 5,9, D 5,9, T 5,5 e C 4,5. Abaixo de cada letra aparece a letra cifrada: H, D, U, V, R, Q, L, G, W, F.'},
   {t:'p',text:'Agora imagine que você só tem o texto cifrado. A letra mais comum nele é o H. Em textos em português, as letras mais comuns costumam ser A e E. Se o H for o E, a chave é 3. Se for o A, a chave é 7. Você testa só essas duas em vez das 25, e a chave 3 deixa o texto legível.'},
   {t:'analogy',text:'É como reconhecer uma pessoa disfarçada pelo jeito de andar. A roupa mudou, mas o padrão ficou. A cifra de César troca as letras, mas mantém o padrão de quais aparecem mais.'},
   {t:'p',text:'Na aba **Laboratórios** você pode tentar as 25 chaves de uma vez e contar as letras de qualquer texto.'},
   {t:'summary',text:'César cai por força bruta (só 25 chaves) e por análise de frequência (as letras comuns continuam comuns depois da troca).'},
   {t:'terms',terms:['Força bruta','Análise de frequência']}
  ]},
  {id:'vigenere',title:'Vigenère: a chave vira uma palavra',optional:false,sources:['m1.vigenere','m1.vigenere-wiki'],blocks:[
   {t:'p',text:'Se o ponto fraco de César é que toda letra anda o mesmo tanto, a solução parece óbvia: fazer cada letra andar um tanto diferente. Foi isso que o italiano Giovan Battista Bellaso publicou em 1553.'},
   {t:'p',text:'Na cifra dele, a chave é uma **palavra**. Na forma que ficou famosa, cada letra da palavra diz quantas casas andar: A anda 0, B anda 1, C anda 2, e assim até Z, que anda 25. A palavra se repete ao longo da mensagem. Mais tarde a cifra foi atribuída ao francês Blaise de Vigenère e ficou conhecida como **cifra de Vigenère**.'},
   {t:'figure',svg:vigenere,caption:'Cifrando CASA com a chave LUA. L manda andar 11 casas, U manda andar 20 e A manda andar 0. A chave se repete: L, U, A, L.',alt:'Tabela com quatro linhas. Mensagem: C, A, S, A. Chave: L, U, A, L. Anda: 11, 20, 0, 11. Cifrado: N, U, S, L. As duas letras A da mensagem viraram U e L.'},
   {t:'example',text:'C anda 11 e vira N. A anda 20 e vira U. S anda 0 e continua S. A anda 11 e vira L. CASA vira NUSL. Repare: a mesma letra A virou U numa posição e L na outra.'},
   {t:'p',text:'É exatamente isso que atrapalha a análise de frequência. As letras comuns se espalham entre várias letras cifradas, e o padrão some. Por muito tempo, a cifra teve fama de indecifrável.'},
   {t:'analogy',text:'César é um cadeado de um número só. Vigenère é um cadeado de vários números, um para cada posição. Adivinhar fica bem mais trabalhoso.'},
   {t:'p',text:'Mas ela também caiu. No século XIX, estudiosos perceberam que a palavra-chave se repete. Descobrindo o tamanho da palavra, dá para separar o texto em pedaços. Cada pedaço é uma cifra de César comum, que cai por frequência. A lição ficou: **uma cifra só é tão forte quanto o seu ponto mais fraco**.'},
   {t:'summary',text:'Em Vigenère, uma palavra faz cada letra andar um tanto diferente, o que esconde as frequências, mas a repetição da chave acabou revelando o segredo.'},
   {t:'terms',terms:['Chave','Análise de frequência']}
  ]},
  {id:'maquinas-e-computadores',title:'Máquinas e computadores: da Enigma ao DES',optional:false,sources:['m1.enigma','m1.des'],blocks:[
   {t:'p',text:'No começo do século XX, cifrar à mão ficou lento demais para exércitos que trocavam milhares de mensagens. Surgiram as máquinas de cifrar. A mais famosa é a **Enigma**, usada pela Alemanha.'},
   {t:'p',text:'A Enigma parecia uma máquina de escrever. Por dentro tinha rodas giratórias, os rotores. A cada tecla apertada, os rotores giravam e a regra de troca mudava. Era como uma cifra de Vigenère com uma chave longuíssima, trocada todo dia.'},
   {t:'p',text:'Quem primeiro a quebrou foi um matemático. O polonês **Marian Rejewski** começou a estudar a Enigma em setembro de 1932. Com matemática e com documentos alemães obtidos pelo serviço secreto francês, no fim daquele ano ele descobriu como os rotores eram ligados por dentro. Em julho de 1939, pouco antes da guerra, os poloneses entregaram seus métodos a britânicos e franceses.'},
   {t:'p',text:'Na Inglaterra, em **Bletchley Park**, uma equipe que incluía **Alan Turing** continuou o trabalho. Eles construíram máquinas com motores e rodas elétricas, apelidadas de "bombes", que testavam combinações muito mais rápido que qualquer pessoa.'},
   {t:'analogy',text:'É a força bruta da aula anterior, mas feita por máquina. Quando a pessoa que quebra também tem uma máquina, a chave precisa ter muito mais combinações para continuar segura.'},
   {t:'p',text:'Depois da guerra, a criptografia saiu dos quartéis e entrou nos computadores. Bancos e empresas precisavam proteger dados. Em 15 de janeiro de 1977, o governo dos Estados Unidos publicou o **DES**, um padrão público de criptografia para computadores. Foi a primeira vez que um governo publicou uma cifra forte como padrão para qualquer empresa usar. Mais tarde o DES ficou fraco diante de computadores mais rápidos e foi substituído.'},
   {t:'example',text:'A ideia de "regra pública, chave secreta" da primeira aula virou regra prática aqui. O DES era público. A segurança estava toda na chave escolhida por cada usuário.'},
   {t:'summary',text:'Máquinas como a Enigma tornaram as cifras muito mais complexas, máquinas também as quebraram, e o DES de 1977 levou a criptografia padronizada para os computadores.'},
   {t:'terms',terms:['Força bruta','Cifra']}
  ]},
  {id:'simetrica-hoje',title:'Criptografia simétrica hoje e o problema da chave',optional:false,sources:['m1.aes'],blocks:[
   {t:'p',text:'Tudo o que vimos até agora tem algo em comum: a mesma chave serve para cifrar e para decifrar. Isso se chama **criptografia simétrica**. Simétrica porque os dois lados usam a mesma coisa.'},
   {t:'p',text:'O padrão simétrico mais usado hoje é o **AES**. Ele foi publicado pelo NIST, o órgão de padrões dos Estados Unidos, em 26 de novembro de 2001, para substituir o DES. O AES é usado, por exemplo, para proteger arquivos guardados e conexões pela internet.'},
   {t:'data',text:'O padrão AES (FIPS 197) usa chaves de 128, 192 ou 256 bits. Um bit é um zero ou um. Uma chave de 128 bits tem 2 elevado a 128 combinações possíveis, um número com 39 dígitos.',source:'m1.aes',date:'2026-10-20'},
   {t:'example',text:'César tem 25 chaves úteis. O AES com 128 bits tem cerca de 340 seguidos de 36 zeros. Testar todas, como fizemos com César, não é viável com os computadores que existem.'},
   {t:'p',text:'Então a criptografia simétrica resolve tudo? Não. Sobra um problema antigo: **como entregar a chave** para a outra pessoa. Se você mandar a chave pelo mesmo caminho da mensagem, quem espiona o caminho pega as duas. Se combinar pessoalmente, precisa encontrar cada pessoa antes. Na internet, você conversa com milhões de sites que nunca viu.'},
   {t:'figure',svg:figSimetrica,caption:'Ana e Bruno usam a mesma chave para trancar e destrancar a caixa. A pergunta que sobra é como a chave chega até Bruno sem que ninguém faça uma cópia.',alt:'Ana à esquerda e Bruno à direita, cada um com uma chave igual. No meio, uma caixa com cadeado fechado. Setas vão de Ana até a caixa e da caixa até Bruno. Embaixo: problema, como entregar a chave sem ninguém copiar.'},
   {t:'analogy',text:'É como uma casa com uma única chave para todos os moradores. Funciona bem, desde que cada morador receba a sua cópia em mãos. Mandar a chave pelo correio é arriscado.'},
   {t:'summary',text:'Na criptografia simétrica a mesma chave cifra e decifra; o AES é forte, mas resta o problema de entregar a chave com segurança.'},
   {t:'terms',terms:['Criptografia simétrica','Chave']}
  ]},
  {id:'chave-publica',title:'Chave pública e chave privada',optional:false,sources:['m1.dh','m1.rsa','m1.tls'],blocks:[
   {t:'p',text:'Em 1976, dois pesquisadores de Stanford, **Whitfield Diffie** e **Martin Hellman**, publicaram um artigo chamado "New Directions in Cryptography". Eles propuseram algo que parecia impossível: usar **duas chaves diferentes**, que formam um par.'},
   {t:'p',text:'Uma das chaves é a **chave pública**. Ela pode ser mostrada para o mundo todo. A outra é a **chave privada**. Ela fica só com o dono e nunca é mostrada. As duas são ligadas por uma conta matemática. Isso se chama **criptografia assimétrica**, porque os dois lados usam chaves diferentes. Em sistemas como o RSA, o que uma chave tranca só a outra destranca. Nas criptomoedas, o par é usado principalmente para assinar, como você vai ver na aula 9.'},
   {t:'analogy',text:'Pense numa caixa de correio na frente de uma casa. A fenda está aberta para todos: qualquer pessoa pode pôr uma carta lá dentro. Mas só a dona tem a chave da portinhola para tirar as cartas. A fenda é a chave pública. A chave da portinhola é a chave privada.'},
   {t:'figure',svg:figCorreio,caption:'Qualquer pessoa coloca mensagens pela fenda (chave pública). Só a dona, com a chave privada, abre a caixa e lê.',alt:'Três envelopes à esquerda, de qualquer pessoa, com setas até a fenda de uma caixa de correio. A fenda está marcada como chave pública. Embaixo da caixa há um cadeado e uma chave marcada como chave privada, só a dona abre.'},
   {t:'p',text:'Isso resolve o problema da aula anterior. Você não precisa entregar nenhum segredo. Basta publicar sua chave pública. Quem quiser mandar algo secreto usa essa chave, e só você consegue abrir.'},
   {t:'p',text:'Em 1977, três pesquisadores do MIT, **Rivest**, **Shamir** e **Adleman**, criaram o **RSA**, o primeiro sistema prático desse tipo a ser publicado. O artigo saiu em 1978. Um trabalho parecido foi feito em segredo no Reino Unido em 1973 e só revelado em 1997. O artigo do RSA já mostrava os dois usos do par de chaves: mandar segredos e **assinar** mensagens, que você vai ver na aula 9.'},
   {t:'example',text:'Quando você abre um site com cadeado no navegador, seu computador e o site usam chave pública para combinar, ali na hora, uma chave simétrica nova. Depois a conversa segue com criptografia simétrica, que é mais rápida. Uma técnica resolve a entrega da chave. A outra protege o volume de dados.'},
   {t:'summary',text:'Na criptografia assimétrica cada pessoa tem um par de chaves: a pública pode ser mostrada a todos, e a privada fica só com o dono.'},
   {t:'terms',terms:['Criptografia assimétrica','Chave pública','Chave privada']}
  ]},
  {id:'hash',title:'Hash: a impressão digital dos dados',optional:false,sources:['hash','m1.sha2'],blocks:[
   {t:'p',text:'Agora uma ferramenta diferente, que não esconde nada. Uma **função hash** pega qualquer dado, de uma palavra a um filme inteiro, e produz um resumo de tamanho fixo. Esse resumo também se chama hash.'},
   {t:'p',text:'O hash mais famoso nas criptomoedas é o **SHA-256**, padronizado pelo NIST em agosto de 2002. Ele sempre gera 256 bits, que aparecem escritos como 64 caracteres de 0 a 9 e de a até f.'},
   {t:'analogy',text:'O hash é como a impressão digital de uma pessoa. Ela é pequena, mas identifica alguém. Olhando a digital você não reconstrói a pessoa inteira. E duas pessoas diferentes não deveriam ter a mesma digital.'},
   {t:'figure',svg:figHash,caption:'Entradas quase iguais geram resumos SHA-256 totalmente diferentes. Mostramos só os 12 primeiros caracteres de cada resumo. Valores gerados e conferidos com crypto.subtle.',alt:'Três textos entram numa caixa marcada SHA-256. Alice envia 1 gera d8cb797dbff3. Alice envia 2 gera a4ffc6189c0c. alice envia 1, com a minúsculo, gera 87162aeb4b80. Os resumos não se parecem.'},
   {t:'example',text:'O SHA-256 de "Alice envia 1" começa com d8cb797d e termina com e65cc. O de "Alice envia 2" começa com a4ffc618 e termina com c12909. Trocou um único caractere e o resumo inteiro mudou. Isso permite detectar que um registro foi alterado.'},
   {t:'p',text:'Três propriedades tornam o hash útil. O mesmo dado gera sempre o mesmo resumo. Uma mudança pequena muda o resumo quase todo. E não existe chave que faça o caminho de volta, do resumo para o dado. Por isso o hash **não serve para esconder** uma mensagem e depois recuperá-la: ele só confere.'},
   {t:'p',text:'Duas entradas diferentes com o mesmo resumo, uma colisão, existem em teoria, porque há mais dados possíveis do que resumos. Uma boa função hash torna achar uma colisão tão difícil que, na prática, não acontece.'},
   {t:'p',text:'Atenção a um limite: o hash prova que o dado **não mudou**, não que ele é **verdadeiro**. Um registro errado também tem hash. E o resumo sozinho não diz quem escreveu o registro. Para isso existe a assinatura, na próxima aula. No laboratório "Hash real: SHA-256" você pode calcular o SHA-256 de qualquer texto.'},
   {t:'summary',text:'O hash é um resumo de tamanho fixo: mesma entrada, mesmo resumo; entrada um pouco diferente, resumo totalmente diferente; e não dá para voltar.'},
   {t:'terms',terms:['Hash']}
  ]},
  {id:'assinatura-digital',title:'Assinatura digital: provar que foi você sem mostrar a chave',optional:false,sources:['m1.dss','m1.rsa'],blocks:[
   {t:'p',text:'No papel, você prova que concorda com algo assinando. Mas uma assinatura no papel pode ser imitada. A **assinatura digital** faz o mesmo papel, com uma diferença: ninguém consegue imitá-la sem ter a sua chave privada.'},
   {t:'p',text:'O processo tem duas partes. Para **assinar**, seu aparelho combina a mensagem com a sua chave privada e gera um número: a assinatura. Para **verificar**, qualquer pessoa combina a mensagem, a assinatura e a sua chave pública. O resultado é só "confere" ou "não confere".'},
   {t:'figure',svg:figAssina,caption:'Assinar usa a chave privada e acontece no seu aparelho. Verificar usa a chave pública e qualquer pessoa pode fazer, sem nunca ver a chave privada.',alt:'Fluxo em duas faixas. Em cima, assinar: mensagem mais chave privada gera a assinatura. Uma linha tracejada leva a assinatura para baixo. Embaixo, verificar: mensagem com assinatura mais chave pública dá a resposta confere, sim ou não.'},
   {t:'analogy',text:'Imagine um carimbo que só você tem e que deixa uma marca única para cada documento. Todo mundo tem uma lupa capaz de dizer se a marca veio do seu carimbo. A lupa não permite fabricar o carimbo.'},
   {t:'p',text:'A assinatura fica presa àquela mensagem exata. Se alguém trocar uma vírgula depois, a verificação falha. É aqui que o hash ajuda: na prática, o aparelho calcula o resumo (hash) da mensagem e assina esse resumo. Os padrões de assinatura digital dos Estados Unidos estão no documento FIPS 186 do NIST.'},
   {t:'example',text:'Alice assina "transferir 1 para Bruno". Alguém intercepta e troca para "transferir 1 para Carlos". A assinatura original não confere com a mensagem nova, e os computadores que conferem as transferências rejeitam a ordem. Para mudar o destino seria preciso assinar de novo, e só Alice consegue.'},
   {t:'p',text:'Dois limites importantes. A assinatura **não esconde** a mensagem: todo mundo pode ler o que foi assinado. E ela não avalia se a operação é boa: se você assinar algo prejudicial, a assinatura é válida do mesmo jeito.'},
   {t:'summary',text:'A assinatura digital prova, com a chave pública, que o dono da chave privada autorizou aquela mensagem exata, sem revelar a chave privada.'},
   {t:'terms',terms:['Assinatura digital','Chave pública','Chave privada']}
  ]},
  {id:'da-chave-ao-endereco',title:'Da chave privada ao endereço da carteira',optional:false,sources:['m1.btcdev','m1.taproot','wallets'],blocks:[
   {t:'p',text:'Agora juntamos as peças para ver como funciona uma carteira de criptomoedas. Uma **carteira** é o aplicativo ou aparelho que guarda suas chaves e assina por você. O dinheiro em si fica registrado na blockchain, que é um registro público compartilhado por muitos computadores. Os módulos 2 e 3 explicam a blockchain e as carteiras em detalhe.'},
   {t:'p',text:'Tudo começa com a **chave privada**. No Bitcoin, ela é um número sorteado ao acaso, com 256 bits. Da chave privada se calcula a **chave pública** com uma conta matemática especial, fácil de fazer e muito difícil de desfazer. No Bitcoin, essa conta usa uma família de fórmulas chamada curva elíptica, na versão de nome secp256k1. O método de assinatura (aula 9) que usa essas chaves se chama **ECDSA**. Da chave pública, aplicando hash, se calcula o **endereço**: o código que você mostra para receber.'},
   {t:'data',text:'Segundo o guia de desenvolvimento do Bitcoin, a rede usa a assinatura ECDSA com a curva secp256k1, e uma chave privada é feita de 256 bits de dados aleatórios.',source:'m1.btcdev',date:'2026-10-20'},
   {t:'data',text:'Desde 2021, com a atualização Taproot, o Bitcoin também aceita outro tipo de assinatura, chamada Schnorr, na mesma curva. Ela ocupa 512 bits (o mesmo que 64 bytes, porque um byte é um grupo de 8 bits).',source:'m1.taproot',date:'2026-10-20'},
   {t:'figure',svg:figEndereco,caption:'Cada passo é fácil de fazer para a frente e impossível na prática de desfazer. Mostrar o endereço não revela a chave privada.',alt:'Três caixas com setas para a direita: chave privada, chave pública, endereço. A chave privada está marcada como segredo; as outras duas, como pode mostrar. Uma seta tracejada para trás está riscada com um X: o caminho de volta não existe na prática.'},
   {t:'analogy',text:'É como misturar tinta azul com amarela e obter verde. Misturar é fácil. Separar o verde de volta em azul e amarelo, não dá. A chave pública e o endereço são o verde: podem ser vistos à vontade.'},
   {t:'example',text:'Você quer receber de um amigo. Manda o seu endereço por mensagem. Ele pode publicar esse endereço num cartaz que nada acontece com o seu dinheiro. Agora, se alguém conseguir sua chave privada, pode assinar transferências em seu nome.'},
   {t:'p',text:'Os detalhes mudam de rede para rede. Bitcoin e Ethereum, por exemplo, calculam o endereço de jeitos diferentes. Mas a direção é sempre a mesma: da chave privada para a pública, da pública para o endereço, e nunca de volta.'},
   {t:'summary',text:'O endereço vem da chave pública, que vem da chave privada; o caminho só vai para a frente, por isso o endereço pode ser mostrado e a chave privada nunca.'},
   {t:'terms',terms:['Endereço','Chave privada','Chave pública','ECDSA']}
  ]},
  {id:'frase-de-recuperacao',title:'Frase de recuperação: quem tem as palavras tem o dinheiro',optional:false,sources:['m1.bip39','safety'],blocks:[
   {t:'p',text:'Uma chave privada é um número enorme, impossível de decorar e fácil de copiar errado. Por isso as carteiras mostram, ao serem criadas, uma lista de palavras comuns: a **frase de recuperação**. Ela também é chamada de frase semente ou seed.'},
   {t:'p',text:'A frase não é uma senha de login. Ela é a **própria origem das chaves**. A partir dela a carteira recalcula todas as chaves privadas e todas as contas. Quem digita as mesmas palavras em qualquer aparelho do mundo tem acesso às mesmas contas, com o mesmo dinheiro. Algumas carteiras permitem uma senha extra junto com as palavras. Se você usou uma, ela também precisa ser guardada.'},
   {t:'data',text:'O padrão BIP-39, adotado por muitas carteiras, tem uma lista de 2048 palavras. A frase tem 12, 15, 18, 21 ou 24 palavras. A última palavra carrega uma pequena verificação, que ajuda a perceber a maioria dos erros de digitação, mas não todos.',source:'m1.bip39',date:'2026-10-20'},
   {t:'analogy',text:'A senha do aplicativo é a chave da porta de um cofre que está no seu celular. A frase de recuperação é a planta para construir o cofre de novo, com tudo dentro, em qualquer lugar. Quem tem a planta não precisa da sua porta.'},
   {t:'example',text:'Você perde o celular. Se a frase está guardada, você instala a carteira em outro aparelho, digita as palavras e tudo volta. Agora o contrário: alguém fotografou sua frase. Essa pessoa leva tudo, mesmo que seu celular continue com você e com senha.'},
   {t:'p',text:'Os golpes mais comuns tentam fazer você entregar as palavras. Um falso "suporte" aparece nas redes sociais oferecendo ajuda. Um site falso pede para "validar" ou "sincronizar" a carteira. Um aplicativo falso imita uma carteira conhecida. Em todos os casos, o pedido final é o mesmo: digitar a frase.'},
   {t:'table',caption:'Frase de recuperação: o que fazer e o que não fazer',headers:['Situação','Faça','Não faça'],rows:[
    ['Ao criar a carteira','Anote as palavras à mão, na ordem, e confira','Tirar print ou foto da tela'],
    ['Onde guardar','Papel ou placa de metal em lugar seguro, longe de olhares','Salvar em nuvem, e-mail, notas do celular ou mensagem'],
    ['Alguém pede a frase','Recuse sempre: nenhum suporte de verdade precisa dela','Digitar em site, formulário ou conversa'],
    ['Site pede para validar a carteira','Feche a página e abra a carteira pelo aplicativo oficial','Seguir links recebidos por mensagem'],
    ['Quer mais proteção','Considere uma hardware wallet, um aparelho dedicado que guarda as chaves fora do celular e do computador','Comprar aparelho usado ou de vendedor não oficial'],
    ['Nos laboratórios do curso','Use só textos de teste','Usar uma frase real em qualquer simulador']
   ]},
   {t:'summary',text:'A frase de recuperação recria todas as suas chaves; quem tem as palavras tem o dinheiro, por isso ela nunca é digitada fora da carteira nem mostrada a ninguém.'},
   {t:'terms',terms:['Frase de recuperação','Chave privada','Hardware wallet']}
  ]},
  {id:'o-que-faz-e-nao-faz',title:'O que a criptografia faz e não faz nas criptomoedas',optional:false,sources:['bitcoin','m1.anuncio','m1.btcdev'],blocks:[
   {t:'p',text:'Por causa do nome, muita gente acha que criptomoedas são secretas. Não são. Na maioria das redes, como Bitcoin e Ethereum, a blockchain é **pública**. Qualquer pessoa pode ver cada transferência: de qual endereço saiu, para qual endereço foi e quanto.'},
   {t:'p',text:'Então para que serve a criptografia ali? Principalmente para **provar autorização**. A assinatura mostra que o dono da chave privada aprovou aquela transferência. O hash amarra os registros uns aos outros, de modo que mudar algo antigo fica evidente. O próprio documento do Bitcoin, anunciado em 31 de outubro de 2008, descreve as moedas como uma corrente de assinaturas digitais.'},
   {t:'analogy',text:'A blockchain pública é como um mural de vidro numa praça. Todos veem o que está lá dentro. Mas só quem tem a chave de cada gaveta consegue mexer nela. A criptografia é a fechadura das gavetas, não a cortina do mural.'},
   {t:'table',caption:'O que a criptografia garante numa blockchain pública',headers:['Pergunta','Garante?','Por quê'],rows:[
    ['Só o dono da chave move o dinheiro','Sim','Cada transferência precisa de uma assinatura válida'],
    ['Um registro antigo não foi alterado','Sim, na prática','Hashes ligam os registros e qualquer mudança aparece'],
    ['Ninguém vê meu saldo','Não','Saldos e transferências de cada endereço são públicos'],
    ['Ninguém sabe quem eu sou','Não totalmente','O endereço não tem nome, mas pode ser ligado a você por outras pistas'],
    ['O projeto ou o site é honesto','Não','A assinatura prova quem autorizou, não se a operação é boa'],
    ['Recupero o dinheiro se perder a frase e o aparelho','Não','Sem a frase, ninguém recria as chaves. Se perder só o papel, transfira tudo para uma carteira nova enquanto ainda tem o aparelho']
   ]},
   {t:'example',text:'Você paga alguém e mostra seu endereço. A partir dele, a pessoa pode consultar num explorador de blocos, um site que mostra a blockchain, todas as entradas e saídas daquele endereço. Por isso muita gente usa endereços diferentes para fins diferentes.'},
   {t:'summary',text:'Nas criptomoedas a criptografia prova quem autorizou cada movimento e protege o histórico contra alterações, mas não esconde saldos nem transferências.'},
   {t:'terms',terms:['Assinatura digital','Endereço','Hash']}
  ]},
  {id:'arvores-de-merkle',title:'Árvores de Merkle e provas compactas',optional:true,sources:['bitcoin','hash'],blocks:[
   {t:'p',text:'A blockchain guarda as transferências em grupos chamados **blocos**. Um bloco pode ter milhares de transferências. Como provar que uma delas está lá sem mostrar todas? A resposta é a **árvore de Merkle**, que usa só hashes.'},
   {t:'p',text:'Calcula-se o hash de cada item. Depois os resumos são juntados em pares e cada par recebe um novo hash. Repete-se até sobrar um único resumo: a **raiz**. Mudar qualquer item muda a raiz.'},
   {t:'figure',svg:figMerkle,caption:'Quatro itens viram dois resumos, que viram a raiz. Para provar que o Item 3 está na árvore, basta entregar o resumo do Item 4 e o Resumo 1+2.',alt:'Árvore com quatro folhas embaixo: Item 1, Item 2, Item 3 e Item 4. Acima, Resumo 1+2 e Resumo 3+4. No topo, a Raiz. Item 4 e Resumo 1+2 estão destacados como a prova do Item 3.'},
   {t:'example',text:'Numa árvore com oito itens, uma prova de inclusão usa três resumos vizinhos. Com eles, quem verifica recalcula o caminho até a raiz e compara. O documento do Bitcoin usa essa estrutura para que aparelhos leves confiram pagamentos sem baixar tudo.'},
   {t:'p',text:'O limite é o mesmo do hash: a prova mostra que o item **faz parte** daquela árvore, não que o conteúdo dele é verdadeiro no mundo lá fora.'},
   {t:'summary',text:'A árvore de Merkle resume muitos itens numa única raiz e permite provar que um item está lá com poucos hashes.'},
   {t:'terms',terms:['Árvore de Merkle','Hash']}
  ]},
  {id:'computacao-quantica',title:'Computação quântica e assinaturas',optional:true,sources:['m1.pqc','m1.taproot','m1.btcdev'],blocks:[
   {t:'p',text:'Computadores quânticos funcionam de um jeito diferente dos computadores comuns. Para alguns problemas matemáticos, eles poderiam ser muito mais rápidos. Entre esses problemas estão os que sustentam a criptografia de chave pública usada hoje, inclusive as assinaturas das criptomoedas.'},
   {t:'data',text:'Em agosto de 2024, o NIST publicou os primeiros padrões de criptografia pós-quântica, pensados para resistir a computadores quânticos. Dois deles, FIPS 204 (ML-DSA) e FIPS 205 (SLH-DSA), são de assinatura digital.',source:'m1.pqc',date:'2026-10-20'},
   {t:'p',text:'O NIST explica o motivo: um computador quântico com capacidade suficiente poderia quebrar a criptografia de chave pública atual. Ninguém sabe dizer quando, ou se, uma máquina assim vai existir. Por isso este curso não faz previsão de data.'},
   {t:'analogy',text:'É como trocar as fechaduras de um prédio antes de saber se a chave-mestra vai ser inventada. A troca leva anos, então começa cedo.'},
   {t:'example',text:'Em muitos tipos de endereço do Bitcoin, o endereço é um hash da chave pública. Enquanto o endereço nunca foi usado para enviar, a chave pública não aparece. Essa proteção é limitada: ao enviar, a chave pública fica visível na rede, e alguns tipos de endereço mais novos (Taproot) já mostram a chave pública direto. Por isso, mudar uma rede inteira para assinaturas pós-quânticas é um tema sério, e exige acordo entre muitos participantes.'},
   {t:'summary',text:'Computadores quânticos grandes poderiam ameaçar as assinaturas atuais; já existem padrões pós-quânticos, e não há data conhecida para essa ameaça.'},
   {t:'terms',terms:['Criptografia pós-quântica','Assinatura digital']}
  ]},
  {id:'dominio-da-assinatura',title:'Domínio da assinatura e segurança',optional:true,sources:['erc20','safety'],blocks:[
   {t:'p',text:'Uma assinatura vale para a mensagem exata que foi assinada. Por isso as mensagens precisam carregar contexto: qual rede, qual aplicativo, qual operação e quais valores. Esse contexto se chama domínio da assinatura. Sem ele, uma assinatura feita para um lugar poderia ser reaproveitada em outro.'},
   {t:'p',text:'Um **nonce**, um número usado uma única vez, ajuda a impedir que a mesma assinatura seja repetida. Ainda assim, se a carteira mostrar a mensagem de um jeito confuso, você pode assinar sem perceber uma permissão grande, como deixar um aplicativo gastar todas as suas moedas.'},
   {t:'example',text:'Um **token** é uma moeda ou ficha digital criada dentro de uma rede. Uma autorização de token, chamada allowance, permite que um aplicativo gaste seus tokens depois, sem pedir de novo. Antes de assinar, leia quem recebe a permissão, para qual token, com que limite e por quanto tempo.'},
   {t:'analogy',text:'Assinar uma permissão ampla é como deixar um cheque assinado em branco. A assinatura é sua e é válida. O problema é o que outra pessoa escreve nele depois.'},
   {t:'p',text:'Nos "Laboratórios originais", o hash usado é uma versão simplificada, só para aprender. O laboratório "Hash real: SHA-256" usa o SHA-256 de verdade. Nenhum dos dois deve receber senhas ou frases reais.'},
   {t:'summary',text:'Uma assinatura precisa de contexto (rede, aplicativo, operação e limite); assinar sem ler pode autorizar mais do que você imagina.'},
   {t:'terms',terms:['Token','Nonce','Allowance','Assinatura digital']}
  ]}
 ],
 quiz:[
  ['Na cifra de César com chave 3, como fica a palavra PAZ?',['QBA','MXW','PAZ','SDC'],3,'Cada letra anda 3 casas: P vira S, A vira D e Z volta ao começo do alfabeto e vira C.'],
  ['Por que a força bruta quebra a cifra de César tão rápido?',['Porque a chave fica escrita no texto','Porque só existem 25 deslocamentos úteis para testar','Porque o César usava sempre a letra E'],1,'Com apenas 25 chaves possíveis, basta testar todas e ver qual deixa o texto legível.'],
  ['O que a análise de frequência aproveita?',['Que todas as letras aparecem igualmente','Que as mensagens secretas são curtas','Que algumas letras aparecem muito mais do que outras numa língua'],2,'A troca de letras mantém o padrão: a letra mais comum do texto cifrado provavelmente representa uma letra comum da língua, como A ou E em português.'],
  ['Na cifra de Vigenère, por que a mesma letra pode virar letras diferentes?',['Porque cada letra da palavra-chave manda andar um número diferente de casas','Porque a cifra sorteia uma letra nova a cada vez','Porque ela pula as vogais'],0,'A chave é uma palavra. Cada posição anda conforme a letra da chave naquela posição, como no exemplo em que CASA virou NUSL.'],
  ['Qual é o problema principal da criptografia simétrica?',['Ela é lenta demais para a internet','Entregar a mesma chave à outra pessoa sem que ninguém a copie','Ela só funciona com letras'],1,'Os dois lados precisam da mesma chave. Mandá-la pelo mesmo caminho da mensagem é arriscado.'],
  ['Na analogia da caixa de correio, o que é a chave pública?',['A chave da portinhola, que só a dona tem','A carta dentro da caixa','A fenda, que qualquer pessoa pode usar'],2,'A chave pública pode ser mostrada a todos, como a fenda. A chave privada é a da portinhola e fica só com a dona.'],
  ['O SHA-256 de "Alice envia 1" e de "Alice envia 2" é parecido?',['Não; uma mudança pequena gera um resumo totalmente diferente','Sim; só o último caractere muda','Sim; os dois resumos são iguais'],0,'Uma boa função hash muda o resumo quase todo quando a entrada muda um pouco. Assim, qualquer alteração fica visível.'],
  ['O que uma assinatura digital válida comprova?',['Que a mensagem está escondida de todos','Que o dono da chave privada autorizou aquela mensagem exata','Que a operação é segura e vantajosa'],1,'A assinatura prova autorização e que a mensagem não mudou. Ela não esconde o conteúdo nem avalia se a operação é boa.'],
  ['Alguém que tem só o seu endereço consegue calcular a sua chave privada?',['Sim, com uma calculadora comum','Sim, se o endereço for curto','Não; o caminho vai da chave privada para o endereço e não volta'],2,'Cada passo, da chave privada à pública e da pública ao endereço, é fácil para a frente e impossível na prática de desfazer.'],
  ['Um perfil de "suporte" pede sua frase de recuperação para resolver um problema. O que fazer?',['Mandar só as primeiras palavras','Recusar: quem tem as palavras tem o dinheiro, e nenhum suporte de verdade pede a frase','Mandar, se o perfil tiver o logotipo da carteira'],1,'A frase recria todas as suas chaves em qualquer aparelho. Pedido de frase é sinal de golpe.']
 ],
 sources:{
  'm1.kerckhoffs':['Auguste Kerckhoffs · La cryptographie militaire (1883), edição de F. Petitcolas','https://www.petitcolas.net/kerckhoffs/','Artigo de 1883 com o princípio de que a segurança deve depender só da chave.'],
  'm1.vigenere-wiki':['Wikipedia · Vigenère cipher (seção History)','https://en.wikipedia.org/wiki/Vigen%C3%A8re_cipher','História da cifra de Bellaso (1553) e da atribuição a Vigenère.'],
  'm1.tls':['IETF · RFC 8446, TLS 1.3','https://www.rfc-editor.org/rfc/rfc8446','Protocolo do cadeado do navegador: combina chaves com criptografia de chave pública.'],
  'm1.sha2':['NIST · FIPS 180-2, Secure Hash Standard (2002)','https://csrc.nist.gov/pubs/fips/180-2/final','Padrão de agosto de 2002 que trouxe o SHA-256.'],
  'm1.anuncio':['Satoshi Nakamoto · Bitcoin P2P e-cash paper (lista de criptografia, 31/10/2008)','https://www.metzdowd.com/pipermail/cryptography/2008-October/014810.html','Mensagem que anunciou o documento do Bitcoin.'],
  'm1.taproot':['Bitcoin BIPs · BIP-341, Taproot','https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki','Assinaturas Schnorr de 64 bytes e chave pública direto no endereço.'],
  'm1.suetonio':['Suetônio · Vida de Júlio César, 56 (LacusCurtius)','https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Suetonius/12Caesars/Julius*.html','Texto antigo, em tradução inglesa, que descreve a cifra de César (seção 56).'],
  'm1.kindi':['Simon Singh · The Arab Code Breakers','https://simonsingh.net/media/articles/maths-and-science/arab-code-breakers','Artigo do autor de O Livro dos Códigos sobre al-Kindi e a análise de frequência.'],
  'm1.vigenere':['Britannica · Vigenère cipher','https://www.britannica.com/topic/Vigenere-cipher','Verbete sobre a cifra de Bellaso (1553), atribuída depois a Vigenère.'],
  'm1.enigma':['IEEE · Milestone: First Breaking of Enigma Code, 1932-1939','https://ethw.org/Milestones:First_Breaking_of_Enigma_Code_by_the_Team_of_Polish_Cipher_Bureau,_1932-1939','Marco histórico do IEEE sobre Rejewski, a entrega de 1939 e Bletchley Park.'],
  'm1.des':['NIST · FIPS 46, Data Encryption Standard (1977)','https://csrc.nist.gov/pubs/fips/46/final','Publicação original do DES, de 15 de janeiro de 1977.'],
  'm1.aes':['NIST · FIPS 197, Advanced Encryption Standard','https://csrc.nist.gov/pubs/fips/197/final','Padrão AES, publicado em 26/11/2001; chaves de 128, 192 e 256 bits.'],
  'm1.dh':['Diffie e Hellman · New Directions in Cryptography (1976)','https://ee.stanford.edu/~hellman/publications/24.pdf','Artigo de 1976 que propôs a criptografia de chave pública.'],
  'm1.rsa':['Rivest, Shamir e Adleman · A Method for Obtaining Digital Signatures and Public-Key Cryptosystems (CACM, 1978)','https://people.csail.mit.edu/rivest/Rsapaper.pdf','Artigo do RSA (cópia no site de Rivest, no MIT): cifra de chave pública e assinatura digital.'],
  'm1.dss':['NIST · FIPS 186-5, Digital Signature Standard','https://csrc.nist.gov/pubs/fips/186-5/final','Padrão vigente de assinatura digital, publicado em 03/02/2023.'],
  'm1.bip39':['Bitcoin BIPs · BIP-39, Mnemonic code','https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki','Padrão da frase de recuperação: lista de 2048 palavras, frases de 12 a 24 palavras.'],
  'm1.btcdev':['Bitcoin Developer Guide · Transactions','https://developer.bitcoin.org/devguide/transactions.html','Chaves, ECDSA na curva secp256k1 e endereços derivados por hash.'],
  'm1.pqc':['NIST · First 3 Finalized Post-Quantum Encryption Standards (2024)','https://www.nist.gov/news-events/news/2024/08/nist-releases-first-3-finalized-post-quantum-encryption-standards','Anúncio dos padrões pós-quânticos FIPS 203, 204 e 205.']
 },
 glossary:[
  ['ECDSA','Método de assinatura digital baseado em curva elíptica, usado pelo Bitcoin. A chave privada assina e a chave pública confere.'],
  ['Token','Moeda ou ficha digital criada dentro de uma rede de blockchain, além da moeda principal dessa rede.'],
  ['Criptografia','Técnicas para transformar uma mensagem de modo que só quem tem a chave consiga ler, e para provar autoria e integridade de dados.'],
  ['Cifra','Regra usada para embaralhar uma mensagem. Exemplo: trocar cada letra pela que vem três posições depois.'],
  ['Chave','Detalhe secreto que faz a cifra funcionar. Na cifra de César, é o número de casas que cada letra anda.'],
  ['Texto cifrado','Mensagem depois de embaralhada pela cifra. Sem a chave, parece sem sentido.'],
  ['Força bruta','Ataque que testa todas as chaves possíveis até achar a certa. Funciona quando há poucas chaves.'],
  ['Análise de frequência','Técnica de quebrar cifras contando quais letras aparecem mais no texto cifrado e comparando com a língua original.'],
  ['Criptografia simétrica','Criptografia em que a mesma chave cifra e decifra. Exemplo atual: AES.'],
  ['Criptografia assimétrica','Criptografia com um par de chaves diferentes: o que uma faz, só a outra desfaz. Também chamada de criptografia de chave pública.'],
  ['Chave pública','Metade do par de chaves que pode ser mostrada a todos. Serve para verificar assinaturas e, em sistemas como o RSA, para cifrar mensagens ao dono.'],
  ['Hash','Resumo de tamanho fixo calculado a partir de qualquer dado. Mudar a entrada muda o resumo, e não dá para voltar do resumo ao dado.'],
  ['Assinatura digital','Número gerado com a chave privada que prova, a quem tem a chave pública, que o dono autorizou aquela mensagem exata.'],
  ['Endereço','Código calculado a partir da chave pública que identifica onde receber criptomoedas. Pode ser mostrado sem risco para a chave privada.'],
  ['Frase de recuperação','Lista de palavras que recria todas as chaves de uma carteira. Quem tem as palavras controla o dinheiro.'],
  ['Árvore de Merkle','Estrutura que junta hashes em pares até uma única raiz, permitindo provar que um item está incluído com poucos resumos.'],
  ['Criptografia pós-quântica','Algoritmos pensados para resistir a computadores quânticos. O NIST publicou os primeiros padrões em 2024.']
 ]
});
})();
