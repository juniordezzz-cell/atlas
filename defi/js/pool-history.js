/* Histórico de ciclos: leitura dos dados preservados, sem lançamentos implícitos. */
(function(g){
  'use strict';
  function n(v){return v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function dinheiro(v){const x=n(v);return x==null?'Não informado':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:Math.abs(x)>0&&Math.abs(x)<0.01?4:2}).format(x);}
  function qtd(v){return v==null?'Não informada':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:12}).format(v);}
  function registro(p){
    const S=g.DeFiStore,C=g.AtlasCaixa,encerrada=!!(p.closedAt||p.status==='encerrada');
    const eventos=S.events(p).map(e=>e.derivado?Object.assign({},e,{date:p.createdAt||p.openedAt||null}):e),aberturas=eventos.filter(e=>e.type==='abertura');
    const capitalInicial=n(p.capital),aportesAdicionais=Array.isArray(p.events)?eventos.filter(e=>e.type==='aporte').reduce((a,e)=>a+(n(e.amountUSD)||0),0):null;
    // Um fechamento antigo sem composição não fornece os termos necessários para refazer o resultado.
    const resumo=encerrada?(p.closeSummary||null):(capitalInicial!=null&&n(p.currentValue)!=null?S.poolSummary(p):null);
    const ledger=C?C.eventos({module:'defi'}).filter(e=>(e.refId===p.id||String(e.refId||'').startsWith('fee:'+p.id+':'))&&(!p.walletId||e.walletId===p.walletId)):[];
    const entradas=ledger.filter(e=>e.tipo==='retorno').reduce((a,e)=>a+(n(e.valorUSD)||0),0),saidas=ledger.filter(e=>e.tipo==='aporte').reduce((a,e)=>a+(n(e.valorUSD)||0),0);
    return {id:p.id,encerrada,resumo,aberturaEm:p.openedAt||p.createdAt||(aberturas.find(e=>!e.derivado)||{}).date||null,capitalInicial:aberturas.some(e=>!e.derivado)?aberturas.reduce((a,e)=>a+(n(e.amountUSD)||0),0):capitalInicial,aportesAdicionais,eventos,ledger,
      retornoFechamento:encerrada?n(p.finalValue):null,
      caixa:{entradas:ledger.length?entradas:null,saidas:ledger.length?saidas:null,liquido:ledger.length?entradas-saidas:null},
      tokens:[{simbolo:p.base,entrada:n(p.qtyBase),ultima:n(p.qtyBaseNow)},{simbolo:p.quote,entrada:n(p.qtyQuote),ultima:n(p.qtyQuoteNow)}]};
  }
  function card(p,carteira){
    const h=registro(p),r=h.resumo||{},resultado=n(r.resultado),cls=resultado==null?'':resultado>0?'up':resultado<0?'down':'flat';
    function linha(label,v){return '<div class="pool-audit__metric"><dt>'+esc(label)+'</dt><dd>'+dinheiro(v)+'</dd></div>';}
    function tabela(cols,rows){return '<div class="pool-audit__scroll"><table class="data-table"><thead><tr>'+cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
    const tipos={abertura:'Capital inicial',aporte:'Aporte adicional',reinvest:'Taxas reinvestidas',retirada:'Retirada de principal',taxa_saida:'Destino de taxas'};
    const movimentos=h.eventos.map(e=>[e.date||'Não informada',(tipos[e.type]||e.type)+(e.derivado?' (derivado do cadastro)':''),dinheiro(e.amountUSD),e.note||'—']);
    (p.fees||[]).forEach(f=>movimentos.push([f.collectedAt||f.date||'Não informada',f.status==='coletada'?'Taxa coletada':'Taxa pendente',dinheiro(f.amount),f.note||'—']));
    if(h.encerrada)movimentos.push([p.closedAt||'Não informada','Fechamento',dinheiro(h.retornoFechamento),p.reason||'—']);
    movimentos.sort((a,b)=>a[0].localeCompare(b[0]));
    return '<details class="pool-audit" data-pool-id="'+esc(p.id)+'"><summary><span><b>'+esc(p.base)+' / '+esc(p.quote)+'</b><small>'+esc(p.protocol||'Protocolo não informado')+' · '+esc(p.chain||'Rede não informada')+' · '+esc(carteira||'Carteira não informada')+'</small><small>'+esc(h.aberturaEm||'Abertura não informada')+' → '+esc(h.encerrada?(p.closedAt||'Data não informada'):'Em aberto')+' · ID '+esc(p.id)+'</small></span><span class="pool-audit__result delta '+cls+'">'+dinheiro(resultado)+'<small>'+ (h.encerrada?'Encerrada':'Resultado em aberto')+'</small></span></summary><div class="pool-audit__body">'+
      '<h3>Capital e resultado do ciclo</h3><dl class="pool-audit__metrics">'+linha('Capital inicial',h.capitalInicial)+linha('Aportes adicionais',h.aportesAdicionais)+linha('Total aportado do caixa',r.aportado)+linha('Taxas reinvestidas',r.reinvestido)+linha('Principal retirado',r.retirado)+linha('Base investida',r.baseInvestida)+linha(h.encerrada?'Valor da posição no fechamento':'Último valor da posição',r.valorPosicao)+linha('Taxas já coletadas',r.taxasColetadas)+linha(h.encerrada?'Taxas pendentes no fechamento':'Taxas pendentes',r.taxasPendentes)+linha('Taxas geradas',r.taxasTotal)+linha('Variação dos ativos',r.varAtivos)+linha('Resultado da pool',r.resultado)+linha('Retorno do fechamento ao caixa',h.retornoFechamento)+'</dl>'+
      '<p class="hint">Resultado = valor da posição + taxas pendentes + taxas coletadas − taxas reinvestidas + principal retirado − total aportado. Taxas já coletadas não são somadas outra vez ao retorno do fechamento.</p>'+
      '<h3>Tokens registrados</h3>'+tabela(['Token','Quantidade de entrada',h.encerrada?'Última quantidade informada antes de fechar':'Última quantidade informada'],h.tokens.map(t=>[t.simbolo,qtd(t.entrada),qtd(t.ultima)]))+'<p class="hint">A quantidade de entrada não comprova a composição final. Quantidades finais incluem somente o que você informou; não são verificadas no protocolo e não representam automaticamente tokens recebidos no caixa.</p>'+
      '<h3>Movimentações e taxas</h3>'+tabela(['Data','Registro','Valor em dólares','Observação'],movimentos)+
      '<h3>Conferência do caixa da carteira</h3><dl class="pool-audit__metrics">'+linha('Entrou no caixa',h.caixa.entradas)+linha('Saiu do caixa',h.caixa.saidas)+linha('Variação líquida do caixa',h.caixa.liquido)+'</dl>'+
      (h.ledger.length?tabela(['Data','Lançamento','Valor em dólares','Observação'],h.ledger.map(e=>[e.data,e.tipo,dinheiro(e.valorUSD),e.obs||'—'])):'<p class="hint">Não há lançamentos de caixa vinculados a este ciclo. Não é possível confirmar quanto entrou ou saiu da carteira.</p>')+
      '<p class="hint">A variação do caixa é a soma dos retornos menos os aportes vinculados. Em posição aberta, parte do capital ainda está na pool; não confunda essa diferença com prejuízo. Depósitos externos e swaps da carteira não são rendimento da pool.</p>'+(!h.resumo?'<p class="hint">Registro antigo incompleto: não há dados suficientes para conferir o resultado deste ciclo.</p>':'')+'</div></details>';
  }
  g.DeFiPoolHistorico={registro,card};
})(window);
