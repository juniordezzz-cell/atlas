import { listarCarteiras, verPosicoes, verCaixa, historico } from './leitura.mjs';

export const CHAVES = { carteiras: 'atlas.wallets.v2', hold: 'atlas.hold.state.v2', caixa: 'atlas.caixa.v1' };

export async function carregarEstado(ctx) {
  const [w, h, c] = await Promise.all([CHAVES.carteiras, CHAVES.hold, CHAVES.caixa].map((k) => ctx.firestore.lerChave(ctx.uid, k)));
  const ilegiveis = [[w, 'carteiras'], [h, 'Hold'], [c, 'caixa']].filter(([x]) => x?.corrompido).map(([, nome]) => nome);
  return {
    carteiras: w?.valor ?? null, hold: h?.valor ?? null, caixa: c?.valor ?? null,
    aviso: ilegiveis.length ? `Não consegui ler: ${ilegiveis.join(', ')}. Abra o Atlas no navegador para reenviar esses dados.` : null,
  };
}

function comAviso(r, estado) {
  return estado.aviso ? { texto: r.texto + '\n' + estado.aviso, dados: { ...r.dados, aviso: estado.aviso } } : r;
}

const esquema = (propriedades) => ({ type: 'object', properties: propriedades, additionalProperties: false });
const P_CARTEIRA = { type: 'string', description: 'Nome ou id da carteira, por exemplo Binance ou JRB1. Sem isso, considera todas.' };
const P_TOKEN = { type: 'string', description: 'Ticker do token, por exemplo PYTH.' };
const usando = (fn) => async (args, ctx) => { const estado = await carregarEstado(ctx); return comAviso(fn(estado, args), estado); };

export const FERRAMENTAS = [
  {
    nome: 'listar_carteiras', titulo: 'Listar carteiras',
    descricao: 'Lista as carteiras do Atlas com o caixa em dólar e o valor no Hold de cada uma. Use para descobrir os nomes das carteiras.',
    schema: esquema({}), executar: usando((e) => listarCarteiras(e)),
  },
  {
    nome: 'ver_posicoes', titulo: 'Ver posições do Hold',
    descricao: 'Mostra quantidade, preço médio, valor atual e resultado das posições do Hold, por carteira ou somando todas, com filtro opcional por token.',
    schema: esquema({ carteira: P_CARTEIRA, token: P_TOKEN }), executar: usando((e, a) => verPosicoes(e, a)),
  },
  {
    nome: 'ver_caixa', titulo: 'Ver caixa',
    descricao: 'Mostra o saldo de caixa em dólar de cada carteira (ou de uma) e os últimos movimentos de depósito, saque e transferência.',
    schema: esquema({ carteira: P_CARTEIRA }), executar: usando((e, a) => verCaixa(e, a)),
  },
  {
    nome: 'historico', titulo: 'Histórico de operações',
    descricao: 'Lista compras, vendas e movimentos de caixa em ordem do mais recente, com filtros por carteira, token e data inicial.',
    schema: esquema({
      carteira: P_CARTEIRA, token: P_TOKEN,
      desde: { type: 'string', description: 'Data inicial no formato AAAA-MM-DD.' },
      limite: { type: 'integer', minimum: 1, maximum: 100, description: 'Máximo de itens. Padrão 20.' },
    }),
    executar: usando((e, a) => historico(e, a)),
  },
];
