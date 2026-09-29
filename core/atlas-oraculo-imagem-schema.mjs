/* Contrato compartilhado: IA fornece dados; este módulo calcula e valida. */
export const CAMPOS=['base','quote','qtyBase','qtyQuote','priceBaseUSD','priceQuoteUSD','capitalUSD','rangeLow','rangeHigh','rangeDenom','ratingPercent','protocol','chain','openedAt'];
export function normalizar(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Leitura da imagem não contém um objeto válido.');
 const data={},duvidas=new Set(),numericos=['qtyBase','qtyQuote','priceBaseUSD','priceQuoteUSD','capitalUSD','rangeLow','rangeHigh','ratingPercent'];
 for(const k of CAMPOS){const v=value[k];if(v==null||v===''){data[k]=null;continue;}if(numericos.includes(k)){data[k]=typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e15?v:null;if(data[k]==null)duvidas.add(k);}else{data[k]=typeof v==='string'?v.trim().slice(0,80):null;if(data[k]==null)duvidas.add(k);}}
 for(const k of ['base','quote'])if(data[k]){if(/^[a-z0-9][a-z0-9._-]{0,24}$/i.test(data[k]))data[k]=data[k].toUpperCase();else {data[k]=null;duvidas.add(k);}}
 if(data.rangeDenom&&!['quote_por_base','base_por_quote'].includes(data.rangeDenom)){data.rangeDenom=null;duvidas.add('rangeDenom');}
 if(data.openedAt&&(!/^\d{4}-\d{2}-\d{2}$/.test(data.openedAt)||!Number.isFinite(Date.parse(data.openedAt+'T00:00:00Z'))||new Date(data.openedAt+'T00:00:00Z').toISOString().slice(0,10)!==data.openedAt)){data.openedAt=null;duvidas.add('openedAt');}
 if(value.uncertainFields!=null&&(!Array.isArray(value.uncertainFields)||value.uncertainFields.some(k=>!CAMPOS.includes(k))))throw Error('Campos duvidosos da leitura inválidos.');
 (value.uncertainFields||[]).forEach(k=>duvidas.add(k));data.uncertainFields=[...duvidas];
 data.warnings=Array.isArray(value.warnings)?value.warnings.filter(x=>typeof x==='string').slice(0,8).map(x=>x.slice(0,240)):[];
 return {data};
}
export function preparar(value){
 const d=normalizar(value).data,p=[];
 if(!d.base||!d.quote||d.base===d.quote)p.push('Informe dois tokens diferentes.');
 if(d.qtyBase==null||d.qtyQuote==null||!(d.qtyBase+d.qtyQuote>0))p.push('Informe as quantidades dos dois tokens (zero é permitido em um lado).');
 const soma=d.qtyBase!=null&&d.qtyQuote!=null&&d.priceBaseUSD>0&&d.priceQuoteUSD>0?d.qtyBase*d.priceBaseUSD+d.qtyQuote*d.priceQuoteUSD:null;
 const capital=d.capitalUSD==null?soma:d.capitalUSD;
 if(!(capital>0&&Number.isFinite(capital)))p.push('Informe o capital em dólares, ou quantidades e preços de entrada.');
 if(soma!=null&&d.capitalUSD!=null&&Math.abs(soma-d.capitalUSD)>0.02)p.push('O capital informado diverge de quantidade × preço; revise os valores.');
 if(!d.protocol)p.push('Informe o protocolo.');if(!d.chain)p.push('Informe a rede.');
 let low=d.rangeLow,high=d.rangeHigh,den=d.rangeDenom;
 if(low==null&&high==null&&d.ratingPercent!=null){if(!(d.ratingPercent>0&&d.ratingPercent<100&&d.priceBaseUSD>0&&d.priceQuoteUSD>0))p.push('Para rating, informe preços de referência e percentual entre 0 e100.');else {const r=d.ratingPercent/100;low=d.priceBaseUSD/d.priceQuoteUSD*(1-r);high=d.priceBaseUSD/d.priceQuoteUSD*(1+r);den='quote_por_base';}}
 if(!(low>0&&high>low))p.push('Informe os limites válidos da faixa de preço.');
 if(!den)p.push('Confirme a unidade da faixa: qual token por qual token.');
 if(d.uncertainFields.length)p.push('Revise e confirme os campos duvidosos: '+d.uncertainFields.join(', ')+'.');
 return {data:d,pendencias:p,pool:{base:d.base,quote:d.quote,qtyBase:d.qtyBase,qtyQuote:d.qtyQuote,priceBase:d.priceBaseUSD,priceQuote:d.priceQuoteUSD,capital,currentValue:capital,protocol:d.protocol,chain:d.chain,rangeLow:low,rangeHigh:high,rangeDenom:den,openedAt:d.openedAt,fees:[],objectives:[],status:'aberta',profit:0,profitPct:0,apr:0,origem:'oraculo-print'}};
}
