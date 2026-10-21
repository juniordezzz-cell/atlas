// Piloto visual (21/10/2026): palco à direita, cena "cadeia", interativo "hash" e trilha.
// Sem WebGL nem GSAP no jsdom: confere o caminho sem 3D, que é o do plano B.
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=require('node:path').resolve(__dirname,'..');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const html=fs.readFileSync(root+'/index.html','utf8');
const dom=new JSDOM(html,{url:'https://atlas.test/index.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,d=w.document;w.TextEncoder=TextEncoder;Object.defineProperty(w,'crypto',{value:require('node:crypto').webcrypto});w.matchMedia=()=>({matches:false});w.scrollTo=()=>{};
w.Chart=class{constructor(c,o){this.data=o.data}update(){}resize(){}destroy(){}};
const ctx=dom.getInternalVMContext(),ev=code=>vm.runInContext(code,ctx);
const files=[...html.matchAll(/<script[^>]*\ssrc="(assets\/[^"]+)"/g)].map(x=>x[1]).filter(f=>f!=='assets/vendor/chart.umd.js');
for(const f of files)vm.runInContext(fs.readFileSync(root+'/'+f,'utf8'),ctx,{filename:f});
const tick=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let n=0;
 await tick(100);ev('academy.init()');
 // Visão geral: fileira de botões dos 10 módulos, sem 3D quando não há WebGL.
 ev("app.navigate('dashboard')");
 const bl=d.querySelectorAll('.trilha .trilha-bloco');assert.equal(bl.length,10);n++;
 assert.ok(!d.querySelector('.trilha').classList.contains('com-3d'));n++;
 bl[2].click();assert.equal(ev('app.currentView'),'m3');n++;
 // Módulo 1: toda aula com figura/cena/interativo ganha a coluna do palco.
 ev("app.navigate('m1')");
 const aulas=[...d.querySelectorAll('#tab-content .lesson')];
 for(const a of aulas){const v=a.querySelectorAll(':scope > .aula-visual');assert.equal(a.classList.contains('tem-visual'),v.length===1,a.id);assert.ok(v.length<=1,a.id);n++;}
 assert.ok(aulas.filter(a=>a.classList.contains('tem-visual')).length>=11);n++;
 // Bloco visual nunca fica fora do palco.
 assert.equal(d.querySelectorAll('#tab-content .lesson > figure').length,0);n++;
 // Interativo hash: SHA-256 de verdade e contagem do que mudou.
 const h=d.querySelector('.aula-interativo[data-interativo="hash"]');assert.ok(h);n++;
 await tick(250);
 assert.equal(h.querySelector('.hash-saida').textContent,'d8cb797dbff3cd588ba2e727b168af10465aad8114f8e512541b1af4f50e65cc');n++;
 const inp=h.querySelector('.hash-entrada');inp.value='Alice envia 2';inp.dispatchEvent(new w.Event('input'));await tick(250);
 assert.equal(h.querySelector('.hash-saida').textContent,'a4ffc6189c0c1f67b5ea6bcf3db0986dc5ec416e822ceb252b133a5f81c12909');n++;
 const marks=h.querySelectorAll('.hash-saida mark').length;assert.ok(marks>40);n++;
 assert.equal(h.querySelector('.hash-mudou').textContent,marks+' de 64 caracteres mudaram.');n++;
 // Texto digitado entra como texto, nunca como marcação.
 inp.value='<img src=x onerror=alert(1)>';inp.dispatchEvent(new w.Event('input'));await tick(250);
 assert.equal(h.querySelector('.hash-saida img'),null);assert.match(h.querySelector('.hash-saida').textContent,/^[0-9a-f]{64}$/);n++;
 // Cena cadeia sem WebGL: os dois SVGs se alternam e os botões trocam de estado.
 const c=d.querySelector('.aula-cena[data-cena="cadeia"]');assert.ok(c);n++;
 const alt=c.querySelector('[data-acao="alterar"]'),res=c.querySelector('[data-acao="restaurar"]');
 assert.ok(!c.querySelector('.plano-inteira').hidden&&c.querySelector('.plano-quebrada').hidden&&res.disabled);n++;
 alt.click();
 assert.ok(c.querySelector('.plano-inteira').hidden&&!c.querySelector('.plano-quebrada').hidden&&alt.disabled&&!res.disabled);n++;
 assert.match(c.querySelector('.cena-estado').textContent,/9b04.*c71e/);n++;
 res.click();assert.ok(!c.querySelector('.plano-inteira').hidden&&!alt.disabled);n++;
 // SVG da cadeia segue as regras das figuras (aparece duas vezes: sem id=).
 for(const q of [false,true]){const s=ev('AcademyRender.cadeiaSvg('+q+')');assert.ok(/^<svg/.test(s)&&!/\sid\s*=/.test(s)&&!/<script/i.test(s));n++;}
 assert.ok(ev('AcademyRender.cadeiaSvg(true)').includes('9b04')&&!ev('AcademyRender.cadeiaSvg(false)').includes('9b04'));n++;
 // Kind vem escapado no atributo.
 assert.ok(!ev(`AcademyRender.block({t:'scene',kind:'"><b>x',caption:'c',alt:'a'})`).includes('"><b>'));n++;
 // Índice ganhou a barra de progresso.
 assert.ok(d.querySelector('.lesson-toc .aula-progresso i'));n++;
 // ===== Módulo 2: toda aula principal tem visual, e cada interativo responde. =====
 ev("app.navigate('m2')");
 const principais=[...d.querySelectorAll('#tab-content > .lesson-layout > div > .lesson')];
 assert.equal(principais.length,12);n++;
 for(const a of principais){assert.ok(a.classList.contains('tem-visual'),a.id);n++;}
 const fig=k=>d.querySelector('.aula-interativo[data-interativo="'+k+'"]');
 const clica=(f,a)=>f.querySelector('[data-acao="'+a+'"]').click();
 const muda=(el,v)=>{el.value=String(v);el.dispatchEvent(new w.Event('input'));};
 // Papéis e transação: passo a passo.
 assert.match(fig('papeis').querySelector('.cena-estado').textContent,/^1 de 4/);clica(fig('papeis'),'proximo');
 assert.match(fig('papeis').querySelector('.cena-estado').textContent,/^2 de 4/);assert.ok(fig('papeis').querySelector('.p-no').classList.contains('aceso'));n+=2;
 clica(fig('transacao'),'proximo');clica(fig('transacao'),'proximo');
 assert.equal(fig('transacao').querySelector('.t-status-valor').textContent,'enviada');n++;
 assert.ok(fig('transacao').querySelector('[data-acao="anterior"]').disabled===false);n++;
 // Mineração: com 1 zero, acha rápido e o hash confere.
 const mi=fig('mineracao');mi.querySelector('.m-dif').value='1';mi.querySelector('.m-dif').dispatchEvent(new w.Event('change'));
 clica(mi,'minerar');for(let k=0;k<40&&!mi.classList.contains('m-ok');k++)await tick(50);
 assert.ok(mi.classList.contains('m-ok'));assert.match(mi.querySelector('.m-hash').textContent,/^0[0-9a-f]{63}$/);n+=2;
 const crypto=require('node:crypto');
 assert.equal(crypto.createHash('sha256').update(mi.querySelector('.m-dados').value+mi.querySelector('.m-nonce').textContent).digest('hex'),mi.querySelector('.m-hash').textContent);n++;
 // Validadores: 100 sorteios somam 100; trapaça expulsa Caio.
 const va=fig('validadores');clica(va,'sortear100');
 assert.equal([...va.querySelectorAll('.v-sorteios')].reduce((s,t)=>s+parseInt(t.textContent,10),0),100);n++;
 clica(va,'trapaca');assert.ok(va.querySelector('.v-2').classList.contains('punido'));assert.match(va.querySelector('.v-2 .v-valor').textContent,/expulso/);n+=2;
 // Reorganização: B passa A.
 const re=fig('reorg');assert.ok(!re.classList.contains('r-reorg'));clica(re,'b');clica(re,'b');
 assert.ok(re.classList.contains('r-reorg'));assert.match(re.querySelector('.cena-estado').textContent,/volta para a fila/);n+=2;
 clica(re,'recomecar');assert.ok(!re.classList.contains('r-reorg'));n++;
 // UTXO: pagar 0,6 gasta 0,5 + 0,3 e devolve 0,1999.
 const ut=fig('utxo');muda(ut.querySelector('.u-valor'),0.6);
 assert.equal(ut.querySelector('.u-troco').textContent,'troco: 0,1999');assert.equal(ut.querySelector('.u-conta').textContent,'saldo depois: 0,3999');n+=2;
 assert.deepEqual([...ut.querySelectorAll('.u-nota')].map(g=>g.classList.contains('gasta')),[true,true,false]);n++;
 // Taxas: 20 entra, 1 fica na fila; na hora de pico, 5 não basta.
 const tx=fig('taxas'),tr=tx.querySelector('.x-taxa');
 muda(tr,20);assert.ok(tx.querySelector('.x-vaga.minha'));n++;
 muda(tr,1);assert.equal(tx.querySelector('.x-vaga.minha'),null);assert.match(tx.querySelector('.x-fila').textContent,/você \(1\)/);n+=2;
 muda(tr,7);assert.ok(tx.querySelector('.x-vaga.minha'));clica(tx,'pico');assert.equal(tx.querySelector('.x-vaga.minha'),null);n+=2;
 // Oráculo: 0,5% não atualiza; 2% atualiza; 24 h atualiza.
 const or=fig('oraculo'),ofo=or.querySelector('.o-fora');
 muda(ofo,100.5);assert.equal(or.querySelector('.o-dentro').textContent,'100,00');n++;
 muda(ofo,102);assert.equal(or.querySelector('.o-dentro').textContent,'102,00');n++;
 muda(ofo,102.5);for(let k=0;k<24;k++)clica(or,'hora');assert.equal(or.querySelector('.o-dentro').textContent,'102,50');assert.match(or.querySelector('.cena-estado').textContent,/24 h/);n+=2;
 // Cena camadas sem WebGL: fica o SVG.
 const ca=d.querySelector('.aula-cena[data-cena="camadas"]');assert.ok(ca&&ca.querySelector('.cena-plano svg'));assert.ok(!ca.classList.contains('com-3d'));n+=2;
 // Laboratórios antigos do M2 continuam abrindo.
 ev("app.switchTab('labs')");assert.ok(d.querySelector('#tab-labs .legacy-labs'));n++;
 // ===== Módulo 3 =====
 ev("app.navigate('m3')");
 const p3=[...d.querySelectorAll('#tab-content > .lesson-layout > div > .lesson')];
 assert.equal(p3.length,11);n++;
 for(const a of p3){assert.ok(a.classList.contains('tem-visual'),a.id);n++;}
 const est=f=>f.querySelector('.cena-estado').textContent;
 // Ticker: o cartão falso explica o golpe.
 const tk=fig('ticker');tk.querySelectorAll('.k-cartao')[1].click();assert.match(est(tk),/^Golpe/);n++;
 tk.querySelectorAll('.k-cartao')[0].click();assert.match(est(tk),/oficial/);assert.ok(tk.querySelectorAll('.k-cartao')[0].classList.contains('escolhido'));n+=2;
 // Custódia: a quebra é ruim só na corretora; a frase copiada, só na autocustódia.
 const cu=fig('custodia');clica(cu,'quebra');
 assert.ok(cu.querySelector('.c-res-corretora').classList.contains('ruim')&&!cu.querySelector('.c-res-auto').classList.contains('ruim'));n++;
 clica(cu,'frase');assert.ok(!cu.querySelector('.c-res-corretora').classList.contains('ruim')&&cu.querySelector('.c-res-auto').classList.contains('ruim'));n++;
 // Hardware wallet: confirmar no caso honesto acerta; no invadido, recusar acerta.
 const hw=fig('assinatura');clica(hw,'confirmar');assert.ok(hw.classList.contains('h-certo'));n++;
 clica(hw,'outra');assert.notEqual(hw.querySelector('.h-msg-pc').textContent,hw.querySelector('.h-msg-dev').textContent);clica(hw,'confirmar');assert.ok(hw.classList.contains('h-errado'));clica(hw,'recusar');assert.ok(hw.classList.contains('h-certo'));n+=3;
 // Envenenamento: o certo não tem diferença marcada; os falsos têm.
 const en=fig('envenenado'),itens=[...en.querySelectorAll('.e-item')];assert.equal(itens.length,3);n++;
 const marcas=itens.map(b=>b.querySelectorAll('mark').length);assert.equal(marcas.filter(x=>x===0).length,1);assert.ok(marcas.every(x=>x<=40));n+=2;
 itens[marcas.indexOf(0)].click();assert.match(est(en),/^Certo/);itens[0===marcas.indexOf(0)?1:0].click();assert.match(est(en),/^Golpe/);n+=2;
 assert.ok(en.classList.contains('e-revelado'));n++;
 // FDV: 2 × 100 mi = 200 mi; 2 × 1.000 mi = 2 bi; total nunca abaixo do circulante.
 const fd=fig('fdv');assert.equal(fd.querySelector('.f-cap').textContent,'US$ 200 mi');assert.equal(fd.querySelector('.f-fdv').textContent,'US$ 2,00 bi');n+=2;
 muda(fd.querySelector('.f-total'),50);assert.equal(fd.querySelector('.f-total').value,'100');n++;
 // Desbloqueio: mês 0 = 200, mês 24 = 600 (200% de diluição), mês 48 = 1.000.
 const db=fig('desbloqueio'),dm=db.querySelector('.d-mes');
 assert.equal(db.querySelector('.d-circ').textContent,'200');n++;
 muda(dm,24);assert.equal(db.querySelector('.d-circ').textContent,'600');assert.equal(db.querySelector('.d-dil').textContent,'200%');n+=2;
 muda(dm,48);assert.equal(db.querySelector('.d-circ').textContent,'1.000');n++;
 // Allowance: com 100 aprovados, a invasão não leva nada depois da troca; com ilimitado, leva tudo.
 const al=fig('allowance'),sal=()=>al.querySelector('.a-saldo').textContent;
 clica(al,'aprovar100');clica(al,'trocar');clica(al,'invadido');assert.equal(sal(),'900 USDC');n++;
 clica(al,'recomecar');clica(al,'aprovarTudo');clica(al,'trocar');clica(al,'invadido');assert.equal(sal(),'0 USDC');n++;
 clica(al,'recomecar');clica(al,'aprovarTudo');clica(al,'revogar');clica(al,'invadido');assert.equal(sal(),'1.000 USDC');n++;
 clica(al,'recomecar');clica(al,'trocar');assert.equal(sal(),'1.000 USDC');assert.match(est(al),/falha/);n+=2;
 // Multisig 2 de 3: roubo sozinho não executa; com Ana, executa.
 const ms=fig('multisig'),ex=ms.querySelector('[data-acao="executar"]');
 assert.ok(ex.disabled);clica(ms,'roubo');assert.ok(ex.disabled);n+=2;
 ms.querySelectorAll('.g-dono')[0].click();assert.ok(!ex.disabled);ex.click();assert.match(est(ms),/Ana e Bia/);n+=2;
 const lim=ms.querySelector('.g-limite');clica(ms,'recomecar');lim.value='1';lim.dispatchEvent(new w.Event('change'));clica(ms,'roubo');assert.ok(!ex.disabled);n++;
 // ===== Módulo 4 =====
 ev("app.navigate('m4')");
 const p4=[...d.querySelectorAll('#tab-content > .lesson-layout > div > .lesson')];
 assert.equal(p4.length,10);n++;
 for(const a of p4){assert.ok(a.classList.contains('tem-visual'),a.id);n++;}
 // Gasto duplo: 4 passos.
 const gd=fig('gastoduplo');for(let k=0;k<3;k++)clica(gd,'proximo');assert.ok(gd.classList.contains('passo-3'));assert.match(est(gd),/^4 de 4/);n+=2;
 // Montar transação: 0,35 a 10 sat/vB → 141 vB, 1.410 sat, troco 0,04998590.
 const mt=fig('montartx');
 assert.equal(mt.querySelector('.mt-vb').textContent,'≈ 141 vB');assert.equal(mt.querySelector('.mt-fee').textContent,'1.410 sat');assert.equal(mt.querySelector('.mt-troco').textContent,'0,04998590');n+=3;
 const moedas=[...mt.querySelectorAll('.mt-moeda input')];moedas[3].checked=false;moedas[3].dispatchEvent(new w.Event('change'));moedas[0].checked=true;moedas[0].dispatchEvent(new w.Event('change'));
 assert.ok(mt.classList.contains('mt-falta'));assert.match(est(mt),/Não fecha/);n+=2;
 // Endereços: cada exemplo cai no tipo certo.
 const ed=fig('endereco'),tipos=[];for(const b of ed.querySelectorAll('[data-exemplo]')){b.click();tipos.push(ed.querySelector('.en-tipo').textContent.split(' ')[0]);}
 assert.deepEqual(tipos,['Legado','Script','SegWit','Taproot','Isto']);n++;
 const et=ed.querySelector('.en-texto');et.value='bc1qxyz';et.dispatchEvent(new w.Event('input'));assert.equal(ed.querySelector('.en-tipo').textContent,'Formato não reconhecido');n++;
 // Halving: era 5 (índice 4) = 3,125 BTC; era 1 = 50.
 const hv=fig('halving');assert.equal(hv.querySelector('.hv-sub').textContent,'3,125 BTC');assert.match(hv.querySelector('.hv-tot').textContent,/^20,34 milhões/);n+=2;
 muda(hv.querySelector('.hv-era-in'),0);assert.equal(hv.querySelector('.hv-sub').textContent,'50 BTC');assert.equal(hv.querySelector('.hv-tot').textContent,'10,50 milhões (50,0%)');n+=2;
 // Regras: 3,325 aceita; 3,5 recusa.
 const rb=fig('regrasbtc');assert.ok(!rb.classList.contains('rb-recusado'));muda(rb.querySelector('.rb-valor'),3.5);assert.ok(rb.classList.contains('rb-recusado'));n+=2;
 // Acelerar: RBF e CPFP fazem entrar; esperar três vezes baixa o corte.
 const ac=fig('acelerar');assert.ok(!ac.classList.contains('ac-entra'));clica(ac,'rbf');assert.ok(ac.classList.contains('ac-entra'));n+=2;
 clica(ac,'recomecar');clica(ac,'cpfp');assert.ok(ac.classList.contains('ac-entra')&&ac.classList.contains('ac-com-filho'));n++;
 clica(ac,'recomecar');clica(ac,'esperar');clica(ac,'esperar');clica(ac,'esperar');assert.ok(ac.classList.contains('ac-entra'));n++;
 // Canal: 3 pagamentos e fechamento = 2 transações na blockchain.
 const cn=fig('canal');clica(cn,'ana');clica(cn,'ana');clica(cn,'bruno');assert.equal(cn.querySelector('.cn-ana-txt').textContent,'85.000 sat');n++;
 clica(cn,'fechar');assert.match(cn.querySelector('.cn-cont').textContent,/2 transações · fora dela: 3 pagamentos/);assert.ok(cn.querySelector('[data-acao="ana"]').disabled);n+=2;
 { // ===== Módulo 5 =====
 ev("app.navigate('m5')");
 const p5=[...d.querySelectorAll('#tab-content > .lesson-layout > div > .lesson')];
 assert.equal(p5.length,10);n++;
 for(const a of p5){assert.ok(a.classList.contains('tem-visual'),a.id);n++;}
 // Cofre: Ana sem saldo reverte; depositando, saca.
 const cf=fig('cofre');clica(cf,'saqAna');assert.ok(cf.classList.contains('cf-reverteu'));n++;
 clica(cf,'depAna');clica(cf,'saqAna');assert.equal(cf.querySelector('.cf-ana').textContent,'saldo[Ana] = 0,5 ETH');assert.equal(cf.querySelector('.cf-ev-0').textContent,'Saque(Ana, 0,5 ETH)');n+=2;
 clica(cf,'saqBruno');clica(cf,'saqBruno');clica(cf,'saqBruno');assert.equal(cf.querySelector('.cf-bruno').textContent,'saldo[Bruno] = 0,0 ETH');assert.ok(cf.classList.contains('cf-reverteu'));n+=2;
 // Chamada: sem saldo, a etapa 3 vira "Reverte".
 const ch=fig('chamada');ch.querySelector('.ch-saldo').checked=false;ch.querySelector('.ch-saldo').dispatchEvent(new w.Event('change'));
 for(let k=0;k<3;k++)clica(ch,'proximo');assert.equal(ch.querySelector('.ch-rot-3').textContent,'Reverte');assert.match(est(ch),/taxa foi paga/);n+=2;
 // Gas: 21.000 × 11 gwei = 0,000231 ETH; base queimada = 0,00021.
 const gc=fig('gascalc');assert.equal(gc.querySelector('.gc-total').textContent,'0,000231 ETH');assert.equal(gc.querySelector('.gc-queima').textContent,'0,000210 ETH');assert.equal(gc.querySelector('.gc-usd').textContent,'US$ 0,69');n+=3;
 // Atômico: dentro do limite dá certo; fora, reverte e devolve.
 const at=fig('atomico');clica(at,'executar');assert.match(at.querySelector('.at-saldo').textContent,/^0 USDC/);n++;
 muda(at.querySelector('.at-mov'),3);clica(at,'executar');assert.match(at.querySelector('.at-saldo').textContent,/^100 USDC/);assert.ok(at.querySelector('.at-passo-2').classList.contains('falhou'));n+=2;
 // Reentrância: com falha leva 11; corrigida leva 1.
 const re=fig('reentrancia');clica(re,'atacar');assert.equal(re.querySelector('.re-at').textContent,'11 ETH');assert.equal(re.querySelector('.re-cofre').textContent,'0 ETH');n+=2;
 clica(re,'corrigida');clica(re,'atacar');assert.equal(re.querySelector('.re-at').textContent,'1 ETH');assert.equal(re.querySelector('.re-cofre').textContent,'10 ETH');n+=2;
 // Proxy: com timelock dá para sair; sem timelock, não.
 const px=fig('proxy');clica(px,'propor');clica(px,'passar');clica(px,'sacar');assert.equal(px.querySelector('.px-fundos').textContent,'100 USDC na sua carteira');n++;
 clica(px,'passar');assert.equal(px.querySelector('.px-versao').textContent,'Versão 2');n++;
 const tl=px.querySelector('.px-timelock');tl.checked=false;tl.dispatchEvent(new w.Event('change'));clica(px,'propor');clica(px,'sacar');assert.equal(px.querySelector('.px-fundos').textContent,'50 USDC na sua carteira');n++;
 }
 { // ===== Módulo 6 =====
 ev("app.navigate('m6')");
 const pr=[...d.querySelectorAll('#tab-content > .lesson-layout > div > .lesson')];
 assert.equal(pr.length,12);n++;
 for(const a of pr){assert.ok(a.classList.contains('tem-visual'),a.id);n++;}
 const txt=(f,s)=>f.querySelector(s).textContent;
 // Utilização: 60% → 3,0% para quem toma; 90% → acima do joelho.
 const ut=fig('utilizacao');assert.equal(txt(ut,'.ut-tomar'),'3,0% ao ano');assert.equal(txt(ut,'.ut-fornecer'),'1,6% ao ano');n+=2;
 muda(ut.querySelector('.ut-u'),90);assert.equal(txt(ut,'.ut-tomar'),'41,5% ao ano');assert.match(est(ut),/disparam/);n+=2;
 // HF: 2 ETH × 3.000 × 0,8 ÷ 3.000 = 1,60; liquida a 1.875.
 const hf=fig('hf');assert.equal(txt(hf,'.hf-valor'),'1,60');assert.equal(txt(hf,'.hf-liq'),'US$ 1.875');assert.equal(txt(hf,'.hf-cap'),'4.500 USDC');n+=3;
 muda(hf.querySelector('.hf-preco'),1800);assert.ok(hf.classList.contains('hf-liquidavel'));n++;
 // Liquidação: 4 quedas de 5% passam de HF 1.
 const lq=fig('liquidacao');for(let k=0;k<4;k++)clica(lq,'cair');assert.match(est(lq),/^Liquidada/);assert.equal(txt(lq,'.lq-div'),'2.000 USDC');n+=2;
 clica(lq,'recomecar');clica(lq,'pagar');assert.equal(txt(lq,'.lq-hf'),'HF 1,60');n++;
 // Dívida volátil: ETH a 3.300 liquida.
 const dv=fig('divida');assert.equal(txt(dv,'.dv-hf'),'1,60');muda(dv.querySelector('.dv-preco'),3300);assert.ok(dv.classList.contains('hf-liquidavel'));n+=2;
 // AMM: comprar 1 ETH de 10/30.000 custa 3.343 USDC (com 0,3%).
 const am=fig('amm');assert.equal(txt(am,'.am-paga'),'3.343 USDC');assert.equal(txt(am,'.am-imp'),'+11,4%');n+=2;
 // IL: 2× = −5,7%; 1× = 0.
 const il=fig('il');assert.equal(txt(il,'.il-perda'),'0,0%');muda(il.querySelector('.il-r'),14);assert.equal(txt(il,'.il-perda'),'-5,7%');muda(il.querySelector('.il-r'),20);assert.equal(txt(il,'.il-perda'),'-25,5%');n+=3;
 // APY: 20% mensal = 21,9%; token −50% → real 11,0%.
 const ap=fig('apy');assert.equal(txt(ap,'.ap-apy'),'21,9%');muda(ap.querySelector('.ap-queda'),50);assert.equal(txt(ap,'.ap-real'),'11,0%');n+=2;
 // Loop: 50% e 3 voltas = 1.875 de exposição, 875 de dívida.
 const lp=fig('loop');assert.equal(txt(lp,'.lp-exp'),'US$ 1.875');assert.equal(txt(lp,'.lp-div'),'US$ 875');n+=2;
 // Flash: 0,1% de diferença dá lucro; 0,03% reverte.
 const fl=fig('flash');clica(fl,'executar');assert.equal(txt(fl,'.fl-res'),'lucro de US$ 450');n++;
 muda(fl.querySelector('.fl-dif'),0.03);clica(fl,'executar');assert.match(txt(fl,'.fl-res'),/^revertida/);n++;
 }
 { // ===== Módulo 7 =====
 ev("app.navigate('m7')");
 const pr=[...d.querySelectorAll('#tab-content > .lesson-layout > div > .lesson')];
 assert.equal(pr.length,9);n++;
 for(const a of pr){assert.ok(a.classList.contains('tem-visual'),a.id);n++;}
 const txt=(f,s)=>f.querySelector(s).textContent;
 // Paridade: a 0,98 lucra 200 e o preço volta para perto de 1.
 const pa=fig('paridade');assert.equal(txt(pa,'.pa-lucro'),'US$ 200,00');clica(pa,'arbitrar');assert.equal(pa.querySelector('.pa-preco').value,'0.994');n+=2;
 const rs0=pa.querySelector('.pa-resgate');rs0.checked=false;rs0.dispatchEvent(new w.Event('change'));clica(pa,'arbitrar');assert.match(est(pa),/Sem acesso/);n++;
 // Reservas: 20% com dinheiro e títulos paga tudo; 60% com empréstimos falta 10%.
 const rs=fig('reservas');assert.equal(txt(rs,'.rs-falta'),'nada');n++;
 rs.querySelector('.rs-mix').value='1';rs.querySelector('.rs-mix').dispatchEvent(new w.Event('change'));muda(rs.querySelector('.rs-pedido'),60);assert.equal(txt(rs,'.rs-falta'),'10%');assert.ok(rs.classList.contains('rs-faltou'));n+=2;
 // CDP: 2 ETH a 3.000 e 2.000 emitidas = 300%; liquida a 1.500.
 const cd=fig('cdp');assert.equal(txt(cd,'.cd-razao'),'300%');assert.equal(txt(cd,'.cd-liq'),'US$ 1.500');muda(cd.querySelector('.cd-preco'),1400);assert.ok(cd.classList.contains('hf-liquidavel'));n+=3;
 // Espiral: 6 dias e o botão trava.
 const es=fig('espiral');for(let k=0;k<6;k++)clica(es,'dia');assert.equal(txt(es,'.es-st'),'US$ 0,10');assert.ok(es.querySelector('[data-acao="dia"]').disabled);n+=2;
 // Depeg: sem venda 1,000; vender 2 milhões → 0,694; com dúvida, pior.
 const dp=fig('depeg');assert.equal(txt(dp,'.dp-preco'),'US$ 1,000');muda(dp.querySelector('.dp-venda'),2);assert.equal(txt(dp,'.dp-preco'),'US$ 0,694');n+=2;
 const du=dp.querySelector('.dp-duvida');du.checked=true;du.dispatchEvent(new w.Event('change'));assert.equal(txt(dp,'.dp-preco'),'US$ 0,541');n++;
 }
 { // ===== Módulo 8 =====
 ev("app.navigate('m8')");
 const pr=[...d.querySelectorAll('#tab-content > .lesson-layout > div > .lesson')];
 assert.equal(pr.length,8);n++;
 for(const a of pr){assert.ok(a.classList.contains('tem-visual'),a.id);n++;}
 const txt=(f,s)=>f.querySelector(s).textContent;
 // Papéis: o custodiante explica o lastro.
 const pp=fig('papeisrwa');pp.querySelectorAll('.k-cartao')[2].click();assert.match(est(pp),/^Custodiante/);n++;
 // Renda: valores iniciais dão 4,6% ao ano e R$ 7,65 por token por mês.
 const rd=fig('renda');assert.equal(txt(rd,'.rd-pct'),'4,6% ao ano');assert.equal(txt(rd,'.rd-token'),'R$ 7,65');assert.equal(txt(rd,'.rd-bruto'),'R$ 144.000');n+=3;
 // Permissão: Bruno passa; carteira sem cadastro não; congelado, nem Bruno.
 const pm=fig('permissao'),cs=pm.querySelectorAll('.k-cartao');cs[0].click();assert.ok(pm.classList.contains('pm-ok'));cs[2].click();assert.ok(pm.classList.contains('pm-bloq'));n+=2;
 clica(pm,'congelar');cs[0].click();assert.ok(pm.classList.contains('pm-bloq'));assert.match(est(pm),/congelada/);n+=2;
 // Valor da cota: 1% de desconto custa 102,74 frente ao resgate de segunda.
 const nv=fig('navrwa');assert.equal(txt(nv,'.nv-agora'),'US$ 9.900,00');assert.equal(txt(nv,'.nv-dif'),'US$ 102,74');n+=2;
 }
 { // ===== Módulo 9 =====
 ev("app.navigate('m9')");
 const pr=[...d.querySelectorAll('#tab-content > .lesson-layout > div > .lesson')];
 assert.equal(pr.length,8);n++;
 for(const a of pr){assert.ok(a.classList.contains('tem-visual'),a.id);n++;}
 const txt=(f,s)=>f.querySelector(s).textContent;
 // Baldes: 80% em cripto e R$ 5 mil de gastos → vende R$ 10 mil no fundo.
 const bd=fig('baldes');assert.equal(txt(bd,'.bd-venda'),'R$ 10.000');muda(bd.querySelector('.bd-cr'),60);assert.equal(txt(bd,'.bd-venda'),'nada');n+=2;
 // Recuperação: 50% → +100%; 80% → +400%.
 const rc=fig('recuperacao');assert.equal(txt(rc,'.rc-av'),'+100%');muda(rc.querySelector('.rc-q'),80);assert.equal(txt(rc,'.rc-av'),'+400%');n+=2;
 // Exposição: tudo marcado → 67% no preço do ETH (8.000 de 12.000).
 const ex=fig('exposicao');assert.equal(txt(ex,'.ex-v-0'),'67%');n++;
 // Tamanho: 5% ÷ 70% = R$ 3.571.
 const tm=fig('tamanho');assert.equal(txt(tm,'.tm-max'),'R$ 3.571');n++;
 // Rebalanceamento: BTC +100% → vender R$ 2.500.
 const rb=fig('rebal');assert.equal(txt(rb,'.rb2-acao'),'vender R$ 2.500 de BTC');muda(rb.querySelector('.rb2-var'),-60);assert.equal(txt(rb,'.rb2-acao'),'comprar R$ 1.500 de BTC');n+=2;
 // DCA: "cai e volta" → aportes valem mais que tudo de uma vez.
 const dc=fig('dca');assert.equal(txt(dc,'.dc-fim-tudo'),'R$ 600,00');assert.equal(txt(dc,'.dc-fim-dca'),'R$ 834,52');assert.match(est(dc),/^O aporte mensal ganhou/);n+=3;
 const sel=dc.querySelector('.dc-cen');sel.value='0';sel.dispatchEvent(new w.Event('change'));assert.match(est(dc),/^Comprar tudo/);n++;
 }
 { // ===== Módulo 10 =====
 ev("app.navigate('m10')");
 const pr=[...d.querySelectorAll('#tab-content > .lesson-layout > div > .lesson')];
 assert.equal(pr.length,8);n++;
 for(const a of pr){assert.ok(a.classList.contains('tem-visual'),a.id);n++;}
 const txt=(f,s)=>f.querySelector(s).textContent;
 // Balanço: empréstimo cria depósito; corrida de 30% quebra.
 const bl=fig('balanco');clica(bl,'emprestar');assert.equal(txt(bl,'.bl-dep'),'Depósitos dos clientes: R$ 2.000');clica(bl,'corrida');assert.ok(bl.classList.contains('hf-liquidavel'));n+=2;
 // Remessa: banco entrega US$ 456,00.
 const rm=fig('remessa');assert.match(txt(rm,'.rm-v-0'),/^US\$ 456,00/);n++;
 // DvP: separado com quebra → Ana perde; atômico → ninguém perde.
 const dv=fig('dvp');clica(dv,'quebra');assert.equal(txt(dv,'.dv2-ana'),'0 títulos · R$ 0');n++;
 clica(dv,'atomico');clica(dv,'quebra');assert.equal(txt(dv,'.dv2-ana'),'10 títulos · R$ 0');assert.match(est(dv),/Ninguém perdeu/);n+=2;
 }
 assert.deepEqual(errors,[]);n++;
 console.log('visual ok: '+n+' verificações');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
