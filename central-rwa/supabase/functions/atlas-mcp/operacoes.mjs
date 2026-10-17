import { ErroUsuario } from './mcp.mjs';
import { resolverCarteira, usd, qtd } from './leitura.mjs';

const ESTAVEIS = new Set(['USDT', 'USDC', 'DAI', 'USD1', 'FDUSD', 'PYUSD', 'USDE', 'TUSD']);

export function hojeBrasil(agora = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(agora));
}

function dataOperacao(data, agora) {
  const hoje = hojeBrasil(agora);
  if (data == null || data === '') return hoje;
  const s = String(data).trim();
  const d = new Date(s + 'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    throw new ErroUsuario('Use a data no formato AAAA-MM-DD, por exemplo 2026-09-27.');
  }
  if (s > hoje) throw new ErroUsuario(`A data ${s} está no futuro.`);
  return s;
}

function positivo(v, nome) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new ErroUsuario(`${nome} precisa ser um número maior que zero.`);
  return n;
}

function naoNegativo(v, nome) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new ErroUsuario(`${nome} não pode ser negativa.`);
  return n;
}

function tickerDe(t) {
  const s = String(t ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9.$_-]{1,15}$/.test(s)) throw new ErroUsuario('Informe o ticker do token, por exemplo PYTH.');
  return s;
}

function precoTxt(v) {
  return '$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: v < 1 ? 8 : 4 });
}

function carteiraDe(motor, nome) {
  if (nome == null || String(nome).trim() === '') throw new ErroUsuario('Diga em qual carteira, por exemplo Binance.');
  return resolverCarteira({ wallets: motor.carteiras.all() }, nome);
}

function doSite(r) {
  if (r && r.error) throw new ErroUsuario(r.error);
  return r;
}

function valorEmDolar(tk, q, valor_usd) {
  if (valor_usd != null && valor_usd !== '') return positivo(valor_usd, 'O valor em dólar');
  if (ESTAVEIS.has(tk)) return q;
  throw new ErroUsuario(`Informe quanto valiam os ${qtd(q)} ${tk} em dólar (valor_usd). Para stablecoins o valor é a própria quantidade.`);
}

export function criarCarteira(motor, { nome } = {}) {
  const n = String(nome ?? '').trim();
  if (!n || n.length > 40) throw new ErroUsuario('Dê um nome de até 40 caracteres para a carteira.');
  if (motor.carteiras.nameTaken(n)) throw new ErroUsuario(`Já existe uma carteira chamada "${n}".`);
  const w = motor.carteiras.create({ name: n, type: 'global' });
  return { resumo: `Criar a carteira ${w.name} (global).`, dados: { carteira: { id: w.id, nome: w.name, tipo: w.type } } };
}

function movimentoCaixa(tipo, motor, { carteira, token, quantidade, valor_usd, data } = {}, agora = Date.now()) {
  const w = carteiraDe(motor, carteira);
  const tk = tickerDe(token);
  const q = positivo(quantidade, 'A quantidade');
  const valor = valorEmDolar(tk, q, valor_usd);
  const dia = dataOperacao(data, agora);
  if (tipo === 'saque') {
    const c = motor.caixa.podeGastar(w.id, valor);
    if (!c.ok) throw new ErroUsuario(`Caixa insuficiente na ${w.name}: há ${usd(c.saldo)} e o saque é de ${usd(valor)}.`);
  }
  const ev = motor.caixa.registrar({ tipo, valorUSD: valor, ativo: tk, qtd: q, walletId: w.id, data: dia, obs: 'Registrado pelo Claude' });
  if (!ev) throw new ErroUsuario('O caixa recusou o lançamento. Confira os valores.');
  const rotulo = tipo === 'deposito' ? 'Depósito' : 'Saque';
  const preposicao = tipo === 'deposito' ? 'no' : 'do';
  return { resumo: `${rotulo} de ${qtd(q)} ${tk} (${usd(valor)}) ${preposicao} caixa da ${w.name}, em ${dia}.`, dados: { carteira: w.name, token: tk, quantidade: q, valor_usd: valor, data: dia } };
}

export const deposito = (motor, args, agora) => movimentoCaixa('deposito', motor, args, agora);
export const saque = (motor, args, agora) => movimentoCaixa('saque', motor, args, agora);

export function compra(motor, { carteira, token, quantidade, preco, taxa_usd, data, cobrir_falta = false, nome, coingecko_id } = {}, agora = Date.now()) {
  const w = carteiraDe(motor, carteira);
  const tk = tickerDe(token);
  const q = positivo(quantidade, 'A quantidade');
  const p = positivo(preco, 'O preço');
  const taxa = naoNegativo(taxa_usd, 'A taxa');
  const dia = dataOperacao(data, agora);
  const S = motor.hold;
  const acharAtivo = () => S.state.ativos.find((a) => String(a.ticker || '').toUpperCase() === tk);
  const novoAtivo = !acharAtivo();
  if (novoAtivo) {
    doSite(S.actions.createAsset({ nome: String(nome || tk).slice(0, 60), ticker: tk, preco_atual: p, cg_id: coingecko_id ? String(coingecko_id) : undefined }));
  }
  const ativo = acharAtivo();
  const custo = q * p + taxa;
  const falta = motor.caixa.faltaPara(w.id, custo);
  if (falta > 0 && !cobrir_falta) {
    throw new ErroUsuario(`Falta ${usd(falta)} no caixa da ${w.name} para essa compra de ${usd(custo)}. Registre antes um depósito, ou repita com cobrir_falta: true para lançar um depósito automático desse valor na data da compra, como faz o formulário do site.`);
  }
  const saldoAntes = motor.caixa.saldo(w.id);
  doSite(S.actions.executeBuy({ ativo_id: ativo.id, quantidade: q, preco: p, taxa, data: dia, walletId: w.id, cobrirFalta: !!cobrir_falta }));
  const depositado = Math.max(0, custo - saldoAntes);
  const pos = S.get.positionOf(ativo.id, w.id);
  const linhas = [`Compra de ${qtd(q)} ${tk} a ${precoTxt(p)} na ${w.name}, em ${dia}${taxa ? `, taxa ${usd(taxa)}` : ''}: custo ${usd(custo)}.`];
  if (novoAtivo) linhas.push(`${tk} é novo no Hold e será cadastrado${coingecko_id ? ` (CoinGecko: ${coingecko_id})` : ''}.`);
  if (depositado > 0.000001) linhas.push(`Depósito automático de ${usd(depositado)} no caixa da ${w.name}, em ${dia}, para cobrir a compra.`);
  linhas.push(`Posição depois: ${qtd(pos.quantidade)} ${tk}, preço médio ${precoTxt(pos.preco_medio)}.`);
  return { resumo: linhas.join('\n'), dados: { carteira: w.name, token: tk, quantidade: q, preco: p, taxa_usd: taxa, custo, deposito_automatico: depositado, data: dia, posicao: { quantidade: pos.quantidade, preco_medio: pos.preco_medio } } };
}

export function venda(motor, { carteira, token, quantidade, fracao, preco, taxa_usd, data } = {}, agora = Date.now()) {
  const w = carteiraDe(motor, carteira);
  const tk = tickerDe(token);
  const p = positivo(preco, 'O preço');
  const taxa = naoNegativo(taxa_usd, 'A taxa');
  const dia = dataOperacao(data, agora);
  const S = motor.hold;
  const ativo = S.state.ativos.find((a) => String(a.ticker || '').toUpperCase() === tk);
  if (!ativo) throw new ErroUsuario(`Não há ${tk} no Hold.`);
  const pos = S.get.positionOf(ativo.id, w.id);
  if (!pos) throw new ErroUsuario(`Não há posição de ${tk} na ${w.name}.`);
  let q;
  if (fracao != null && fracao !== '') {
    const f = Number(fracao);
    if (!(f > 0 && f <= 1)) throw new ErroUsuario('A fração vai de 0 a 1, por exemplo 0.5 para metade.');
    q = pos.quantidade * f;
  } else {
    q = positivo(quantidade, 'A quantidade');
  }
  const pm = pos.preco_medio;
  doSite(S.actions.executeSell({ ativo_id: ativo.id, quantidade: q, preco: p, taxa, data: dia, walletId: w.id }));
  const apurado = q * p - taxa;
  const resultado = apurado - q * pm;
  const depois = S.get.positionOf(ativo.id, w.id);
  const resumo = `Venda de ${qtd(q)} ${tk} a ${precoTxt(p)} na ${w.name}, em ${dia}${taxa ? `, taxa ${usd(taxa)}` : ''}: volta ${usd(apurado)} ao caixa.\n`
    + `Resultado ${resultado >= 0 ? '+' : ''}${usd(resultado)} sobre o preço médio de ${precoTxt(pm)}. Fica ${qtd(depois ? depois.quantidade : 0)} ${tk}.`;
  return { resumo, dados: { carteira: w.name, token: tk, quantidade: q, preco: p, taxa_usd: taxa, apurado, resultado, data: dia } };
}
