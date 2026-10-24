import { ErroUsuario } from './mcp.mjs';

// Mesmo efeito por tipo de wallets/walletCaixa.js (TIPOS).
const EFEITO_CAIXA = { deposito: 1, saque: -1, transferencia: -1, swap: 0, aporte: -1, retorno: 1 };
const ROTULOS = { deposito: 'Depósito', saque: 'Saque', transferencia: 'Transferência', swap: 'Swap', aporte: 'Aporte em posição', retorno: 'Retorno de posição', buy: 'Compra', sell: 'Venda' };

export function normalizarTexto(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

export function usd(v) {
  const s = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? '-$ ' : '$ ') + s;
}

export function qtd(v) {
  return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 8 });
}

function listaCarteiras(estado) {
  const ws = Array.isArray(estado?.wallets) ? estado.wallets.filter((w) => w && w.id) : [];
  return ws.length ? ws : [{ id: 'principal', name: 'Principal', type: 'global', module: null }];
}

function nomeCarteira(estado, id) {
  return listaCarteiras(estado).find((w) => w.id === id)?.name || id;
}

export function resolverCarteira(estado, nome) {
  if (nome == null || String(nome).trim() === '') return null;
  const alvo = normalizarTexto(nome);
  const ws = listaCarteiras(estado);
  const achou = ws.filter((w) => normalizarTexto(w.id) === alvo || normalizarTexto(w.name) === alvo);
  if (achou.length === 1) return achou[0];
  if (!achou.length) throw new ErroUsuario(`Não encontrei a carteira "${String(nome).trim()}". Carteiras: ${ws.map((w) => w.name).join(', ')}.`);
  throw new ErroUsuario(`Mais de uma carteira se chama "${String(nome).trim()}". Use o id: ${achou.map((w) => w.id).join(', ')}.`);
}

export function posicoes(hold) {
  const ativos = new Map((Array.isArray(hold?.ativos) ? hold.ativos : []).map((a) => [a.id, a]));
  return (Array.isArray(hold?.carteira) ? hold.carteira : [])
    .filter((p) => p && Number(p.quantidade) > 0)
    .map((p) => {
      const a = ativos.get(p.ativo_id) || {};
      const preco = Number(a.preco_atual);
      const temPreco = Number.isFinite(preco) && preco > 0;
      const q = Number(p.quantidade), pm = Number(p.preco_medio) || 0;
      return {
        walletId: p.walletId || 'principal', ativoId: p.ativo_id,
        ticker: String(a.ticker || '?').toUpperCase(), nome: a.nome || '',
        quantidade: q, precoMedio: pm, custo: q * pm,
        preco: temPreco ? preco : null, valor: temPreco ? q * preco : null, resultado: temPreco ? q * preco - q * pm : null,
      };
    });
}

function agruparPorTicker(lista) {
  const grupos = new Map();
  for (const p of lista) {
    const g = grupos.get(p.ticker) || { ativoId: p.ativoId, ticker: p.ticker, nome: p.nome, carteiras: [], quantidade: 0, custo: 0, valor: 0, semPreco: false };
    g.quantidade += p.quantidade; g.custo += p.custo; g.carteiras.push(p.walletId);
    if (p.valor === null) g.semPreco = true; else g.valor += p.valor;
    grupos.set(p.ticker, g);
  }
  return [...grupos.values()].map((g) => ({
    walletId: null, carteiras: g.carteiras, ativoId: g.ativoId, ticker: g.ticker, nome: g.nome,
    quantidade: g.quantidade, precoMedio: g.quantidade ? g.custo / g.quantidade : 0, custo: g.custo,
    preco: g.semPreco ? null : g.valor / g.quantidade, valor: g.semPreco ? null : g.valor, resultado: g.semPreco ? null : g.valor - g.custo,
  }));
}

const porValorDesc = (a, b) => (b.valor ?? -1) - (a.valor ?? -1);

export function verPosicoes({ carteiras, hold }, { carteira, token } = {}) {
  const w = resolverCarteira(carteiras, carteira);
  const alvo = token ? normalizarTexto(token) : null;
  let lista = posicoes(hold).filter((p) => (!w || p.walletId === w.id) && (!alvo || normalizarTexto(p.ticker) === alvo));
  if (!w) lista = agruparPorTicker(lista);
  lista.sort(porValorDesc);
  const ativos = new Map((Array.isArray(hold?.ativos) ? hold.ativos : []).map((a) => [a.id, a]));
  const realizado = (Array.isArray(hold?.vendas) ? hold.vendas : [])
    .filter((v) => v && (!w || (v.walletId || 'principal') === w.id) && (!alvo || normalizarTexto(ativos.get(v.ativo_id)?.ticker) === alvo))
    .reduce((s, v) => s + (Number(v.resultado) || 0), 0);
  const total = lista.filter((p) => p.valor !== null).reduce((s, p) => s + p.valor, 0);
  const custo = lista.reduce((s, p) => s + p.custo, 0);
  const semPreco = lista.filter((p) => p.valor === null).map((p) => p.ticker);
  const onde = w ? `na ${w.name}` : 'em todas as carteiras';
  const dados = { carteira: w?.id ?? null, posicoes: lista, total, custo, realizado, semPreco };
  if (!lista.length) return { texto: `Nenhuma posição no Hold ${onde}${token ? ` para ${String(token).trim().toUpperCase()}` : ''}.`, dados };
  const linhas = lista.map((p) => `${p.ticker}: ${qtd(p.quantidade)} · preço médio ${usd(p.precoMedio)} · `
    + (p.valor === null ? 'sem preço salvo' : `valor ${usd(p.valor)} · resultado ${p.resultado >= 0 ? '+' : ''}${usd(p.resultado)}`));
  linhas.push(`Total ${onde}: ${usd(total)} (custo ${usd(custo)}). Realizado: ${usd(realizado)}.`);
  if (semPreco.length) linhas.push(`Fora do total por falta de preço: ${semPreco.join(', ')}.`);
  linhas.push('Valores com o último preço salvo pelo site.');
  return { texto: linhas.join('\n'), dados };
}

function eventosCaixa(caixa) {
  return (Array.isArray(caixa) ? caixa : []).filter((e) => e && EFEITO_CAIXA[e.tipo] !== undefined && Number(e.valorUSD) > 0 && e.walletId);
}

const porDataDesc = (a, b) => String(b.data ?? '').slice(0, 10).localeCompare(String(a.data ?? '').slice(0, 10));

export function saldosCaixa(caixa) {
  const s = {};
  for (const e of eventosCaixa(caixa)) {
    const v = Number(e.valorUSD);
    s[e.walletId] = (s[e.walletId] || 0) + EFEITO_CAIXA[e.tipo] * v;
    if (e.tipo === 'transferencia' && e.contraWalletId) s[e.contraWalletId] = (s[e.contraWalletId] || 0) + v;
  }
  return s;
}

export function verCaixa({ carteiras, caixa }, { carteira } = {}) {
  const w = resolverCarteira(carteiras, carteira);
  const saldos = saldosCaixa(caixa);
  const ws = w ? [w] : listaCarteiras(carteiras);
  const linhas = ws.map((x) => `${x.name}: ${usd(saldos[x.id] || 0)}`);
  const ultimos = eventosCaixa(caixa).filter((e) => !w || e.walletId === w.id || e.contraWalletId === w.id).sort(porDataDesc).slice(0, 5);
  if (ultimos.length) {
    linhas.push('Últimos movimentos:');
    for (const e of ultimos) {
      linhas.push(`${String(e.data).slice(0, 10)} · ${ROTULOS[e.tipo]} · ${String(e.ativo || 'USDT').toUpperCase()} · ${usd(Number(e.valorUSD))}`
        + (e.tipo === 'transferencia' ? ` (${nomeCarteira(carteiras, e.walletId)} → ${nomeCarteira(carteiras, e.contraWalletId)})` : ''));
    }
  }
  linhas.push('Saldo do caixa em dólar, somando os eventos. O saldo por token vem numa próxima fase.');
  const porCarteira = Object.fromEntries(ws.map((x) => [x.id, saldos[x.id] || 0]));
  return { texto: linhas.join('\n'), dados: { saldos: porCarteira, total: Object.values(porCarteira).reduce((s, v) => s + v, 0), ultimos } };
}

export function listarCarteiras({ carteiras, hold, caixa }) {
  const saldos = saldosCaixa(caixa), pos = posicoes(hold);
  const lista = listaCarteiras(carteiras).map((w) => {
    const ps = pos.filter((p) => p.walletId === w.id);
    const semPreco = ps.filter((p) => p.valor === null).map((p) => p.ticker);
    return { id: w.id, nome: w.name, tipo: w.type || null, modulo: w.module || null, caixa: saldos[w.id] || 0, hold: ps.reduce((s, p) => s + (p.valor ?? 0), 0), posicoes: ps.length, semPreco };
  });
  const texto = lista.map((w) => `${w.nome} (id ${w.id}): caixa ${usd(w.caixa)} · Hold ${usd(w.hold)} em ${w.posicoes} posição(ões)`
    + (w.semPreco.length ? ` (sem preço: ${w.semPreco.join(', ')})` : '')).join('\n');
  return { texto, dados: { carteiras: lista } };
}

export function historico({ carteiras, hold, caixa }, { carteira, token, desde, limite } = {}) {
  const w = resolverCarteira(carteiras, carteira);
  if (desde != null && desde !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(String(desde))) throw new ErroUsuario('Use a data no formato AAAA-MM-DD, por exemplo 2026-10-01.');
  const n = limite == null ? 20 : Number(limite);
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new ErroUsuario('O limite precisa ser um número inteiro de 1 a 100.');
  const alvo = token ? normalizarTexto(token) : null;
  const ativos = new Map((Array.isArray(hold?.ativos) ? hold.ativos : []).map((a) => [a.id, a]));
  const ops = (Array.isArray(hold?.operacoes) ? hold.operacoes : []).filter((o) => o && (o.tipo === 'buy' || o.tipo === 'sell'));
  const ligados = new Set(ops.flatMap((o) => (Array.isArray(o.eventos) ? o.eventos : [])));
  const itens = [
    ...ops.map((o) => ({
      origem: 'hold', data: String(o.data ?? '').slice(0, 10), tipo: o.tipo, rotulo: ROTULOS[o.tipo],
      walletId: o.walletId || 'principal', contraWalletId: null,
      tokens: [String(ativos.get(o.ativo_id)?.ticker || '?').toUpperCase()],
      quantidade: Number(o.quantidade) || 0, preco: Number(o.preco) || 0, valorUSD: Number(o.valorCaixa) || 0,
    })),
    ...eventosCaixa(caixa).filter((e) => !ligados.has(e.id)).map((e) => ({
      origem: 'caixa', data: String(e.data ?? '').slice(0, 10), tipo: e.tipo, rotulo: ROTULOS[e.tipo],
      walletId: e.walletId, contraWalletId: e.contraWalletId || null,
      tokens: [e.ativo, e.ativoDestino].filter(Boolean).map((x) => String(x).toUpperCase()),
      quantidade: Number(e.qtd) || null, preco: null, valorUSD: Number(e.valorUSD),
    })),
  ]
    .filter((i) => (!w || i.walletId === w.id || i.contraWalletId === w.id)
      && (!alvo || i.tokens.some((t) => normalizarTexto(t) === alvo))
      && (!desde || i.data >= desde))
    .sort(porDataDesc)
    .slice(0, n);
  if (!itens.length) return { texto: 'Nenhuma operação encontrada com esses filtros.', dados: { itens: [] } };
  const texto = itens.map((i) => `${i.data} · ${i.rotulo} · ${i.tokens.join(' → ')} · `
    + (i.origem === 'hold' ? `${qtd(i.quantidade)} a ${usd(i.preco)} = ${usd(i.valorUSD)}` : usd(i.valorUSD))
    + ` · ${nomeCarteira(carteiras, i.walletId)}` + (i.contraWalletId ? ` → ${nomeCarteira(carteiras, i.contraWalletId)}` : '')).join('\n');
  return { texto, dados: { itens } };
}
