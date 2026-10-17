import { listarCarteiras, verPosicoes, verCaixa, historico } from './leitura.mjs';
import { preparar, prepararDesfazer, confirmar } from './previa.mjs';

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
const P_DATA = { type: 'string', description: 'Data da operação, AAAA-MM-DD. Sem isso, hoje (horário de Brasília).' };
const P_QTD = { type: 'number', exclusiveMinimum: 0, description: 'Quantidade de tokens (líquida, depois de taxa cobrada no token).' };
const P_VALOR = { type: 'number', exclusiveMinimum: 0, description: 'Valor total em dólar. Obrigatório para tokens que não são stablecoin.' };
const P_TAXA = { type: 'number', minimum: 0, description: 'Taxa em dólar. Se a corretora cobrou no token, use taxa em tokens × preço.' };
const P_ID = { type: 'string', description: 'O id_previa devolvido pela ferramenta preparar_*.' };
const esquemaCom = (propriedades, required) => ({ ...esquema(propriedades), required });
const prepararOp = (op) => (args, ctx) => preparar(ctx, op, args);

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
  {
    nome: 'preparar_carteira', titulo: 'Preparar carteira nova', escrita: true,
    descricao: 'Prévia da criação de uma carteira global no Atlas (por exemplo Binance). Não grava; devolve id_previa para confirmar.',
    schema: esquemaCom({ nome: { type: 'string', description: 'Nome da carteira, até 40 caracteres.' } }, ['nome']),
    executar: prepararOp('carteira'),
  },
  {
    nome: 'preparar_deposito', titulo: 'Preparar depósito no caixa', escrita: true,
    descricao: 'Prévia de um depósito no caixa de uma carteira (dinheiro que entrou de fora, como um Pix convertido em USDT). Não grava.',
    schema: esquemaCom({ carteira: P_CARTEIRA, token: P_TOKEN, quantidade: P_QTD, valor_usd: P_VALOR, data: P_DATA }, ['carteira', 'token', 'quantidade']),
    executar: prepararOp('deposito'),
  },
  {
    nome: 'preparar_saque', titulo: 'Preparar saque do caixa', escrita: true,
    descricao: 'Prévia de um saque do caixa de uma carteira (dinheiro que saiu do Atlas). Recusa se faltar caixa. Não grava.',
    schema: esquemaCom({ carteira: P_CARTEIRA, token: P_TOKEN, quantidade: P_QTD, valor_usd: P_VALOR, data: P_DATA }, ['carteira', 'token', 'quantidade']),
    executar: prepararOp('saque'),
  },
  {
    nome: 'preparar_compra', titulo: 'Preparar compra no Hold', escrita: true,
    descricao: 'Prévia de uma compra no Hold, com data, preço e taxa. O custo sai do caixa da carteira; com cobrir_falta: true o que faltar entra como depósito automático na data da compra, como no formulário do site. Também serve para mover caixa para o Hold. Não grava.',
    schema: esquemaCom({
      carteira: P_CARTEIRA, token: P_TOKEN, quantidade: P_QTD,
      preco: { type: 'number', exclusiveMinimum: 0, description: 'Preço por token em dólar.' },
      taxa_usd: P_TAXA, data: P_DATA,
      cobrir_falta: { type: 'boolean', description: 'Lançar depósito automático do que faltar no caixa, na data da compra.' },
      nome: { type: 'string', description: 'Nome do token, usado só se ele ainda não existir no Hold.' },
      coingecko_id: { type: 'string', description: 'Id do token na CoinGecko, para o site atualizar o preço sozinho.' },
    }, ['carteira', 'token', 'quantidade', 'preco']),
    executar: prepararOp('compra'),
  },
  {
    nome: 'preparar_venda', titulo: 'Preparar venda no Hold', escrita: true,
    descricao: 'Prévia de uma venda no Hold, por quantidade ou fração (0.5 = metade). O apurado volta ao caixa da carteira e o resultado é calculado sobre o preço médio. Não grava.',
    schema: esquemaCom({
      carteira: P_CARTEIRA, token: P_TOKEN, quantidade: P_QTD,
      fracao: { type: 'number', exclusiveMinimum: 0, maximum: 1, description: 'Fração da posição, por exemplo 0.5 para metade.' },
      preco: { type: 'number', exclusiveMinimum: 0, description: 'Preço de venda por token em dólar.' },
      taxa_usd: P_TAXA, data: P_DATA,
    }, ['carteira', 'token', 'preco']),
    executar: prepararOp('venda'),
  },
  {
    nome: 'preparar_desfazer', titulo: 'Preparar desfazer', escrita: true,
    descricao: 'Prévia para desfazer a última operação gravada pelo Claude, se ninguém mexeu nesses dados depois. Não grava.',
    schema: esquema({}), executar: (args, ctx) => prepararDesfazer(ctx),
  },
  {
    nome: 'confirmar', titulo: 'Confirmar e gravar', escrita: true, destrutiva: true,
    descricao: 'Grava no Atlas a operação de uma prévia. Use somente depois que o dono disser sim à prévia mostrada.',
    schema: esquemaCom({ id_previa: P_ID }, ['id_previa']),
    executar: (args, ctx) => confirmar(ctx, args.id_previa),
  },
  {
    nome: 'cancelar', titulo: 'Cancelar prévia', escrita: true,
    descricao: 'Descarta uma prévia. Nada é gravado; a prévia também expira sozinha em 10 minutos.',
    schema: esquemaCom({ id_previa: P_ID }, ['id_previa']),
    executar: async () => ({ texto: 'Cancelado. Nada foi gravado no Atlas.', dados: { cancelado: true } }),
  },
];
