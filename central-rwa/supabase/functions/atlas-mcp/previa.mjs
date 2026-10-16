import { assinar, verificar, aleatorio } from './crypto.mjs';
import { ErroUsuario } from './mcp.mjs';
import { criarMotor, CHAVES_GRAVAVEIS } from './motor.mjs';
import { ConflitoGravacao } from './firestore.mjs';
import { criarCarteira, deposito, saque, compra, venda } from './operacoes.mjs';

const EXECUTORES = { carteira: criarCarteira, deposito, saque, compra, venda };
export const OPERACOES_ESCRITA = Object.keys(EXECUTORES);
const VALIDADE_PREVIA_MS = 10 * 60000;
const MUDOU = 'Os dados do Atlas mudaram desde a prévia (talvez pelo site). Prepare a operação de novo para ver a prévia atualizada.';

// `exigirBases`: na confirmação, confere ANTES de executar que nada mudou desde a prévia,
// para a resposta ser "mudou" e não um erro da regra rodando sobre o estado novo.
async function simular(ctx, op, args, exigirBases = null) {
  const docs = await ctx.firestore.lerDocs(ctx.uid, CHAVES_GRAVAVEIS);
  if (exigirBases && CHAVES_GRAVAVEIS.some((k) => docs[k].updateTime !== exigirBases[k])) throw new ErroUsuario(MUDOU);
  const motor = criarMotor(Object.fromEntries(CHAVES_GRAVAVEIS.map((k) => [k, docs[k].bruto])));
  const r = EXECUTORES[op](motor, args, ctx.agora());
  return { docs, r, mudancas: motor.alteracoes() };
}

const basesDe = (docs, chaves) => Object.fromEntries(chaves.map((k) => [k, docs[k].updateTime]));
const brutosDe = (docs, chaves) => Object.fromEntries(chaves.map((k) => [k, docs[k].bruto]));

// Ordem lexicográfica = ordem de gravação: carimbo, depois sequência (dois pedidos no mesmo ms).
let sequenciaOp = 0;
const novoOpId = (ctx) => String(ctx.agora()).padStart(15, '0') + '-' + String(++sequenciaOp % 10000).padStart(4, '0') + aleatorio(4);

// Uma resposta perdida (timeout, 5xx) não prova que nada foi gravado: o backup vai no
// mesmo commit, então a existência dele decide. Nunca responder "nada mudou" sem saber.
async function gravarComTratamento(ctx, args) {
  try { await ctx.firestore.gravar(ctx.uid, args); } catch (e) {
    if (e instanceof ConflitoGravacao) throw new ErroUsuario(MUDOU);
    let gravou = false;
    try { gravou = !!(await ctx.firestore.lerBackup(ctx.uid, args.opId)); } catch { gravou = false; }
    if (gravou) return;
    console.error('atlas-mcp gravar', String(e?.message || e).slice(0, 120));
    throw new ErroUsuario('Não consegui confirmar se a gravação aconteceu. Confira com ver_posicoes ou ver_caixa antes de repetir, para não lançar em dobro.');
  }
}

export async function preparar(ctx, op, args = {}) {
  if (!EXECUTORES[op]) throw new ErroUsuario(`Operação desconhecida: ${op}.`);
  const { docs, r, mudancas } = await simular(ctx, op, args);
  if (!Object.keys(mudancas).length) throw new ErroUsuario('Essa operação não mudaria nada no Atlas.');
  // A data resolvida ("hoje" em Brasília) vai assinada: confirmar depois da meia-noite grava a data mostrada.
  const assinados = r.dados?.data && !args.data ? { ...args, data: r.dados.data } : args;
  const id = await assinar({ t: 'previa', u: ctx.uid, op, a: assinados, b: basesDe(docs, CHAVES_GRAVAVEIS), exp: ctx.agora() + VALIDADE_PREVIA_MS }, ctx.segredo);
  return {
    texto: `PRÉVIA — nada foi gravado ainda.\n${r.resumo}\n\nMostre esta prévia ao dono. Só chame confirmar com o id_previa depois de um "sim" explícito. Vale 10 minutos.`,
    dados: { id_previa: id, operacao: op, ...r.dados },
  };
}

export async function prepararDesfazer(ctx) {
  const b = await ctx.firestore.ultimoBackup(ctx.uid);
  if (!b) throw new ErroUsuario('Não há operação feita pelo Claude para desfazer.');
  if (b.ferramenta === 'desfazer' || b.desfeito) throw new ErroUsuario('A última operação do Claude já foi um desfazer. Corrija pelo site se precisar voltar mais.');
  const chaves = Object.keys(b.antes).filter((k) => CHAVES_GRAVAVEIS.includes(k));
  const docs = await ctx.firestore.lerDocs(ctx.uid, chaves);
  if (chaves.some((k) => docs[k].mcpOp !== b.id)) throw new ErroUsuario('Os dados mudaram depois dessa operação (pelo site ou por outra operação). Desfaça pelo site.');
  const id = await assinar({ t: 'previa', u: ctx.uid, op: 'desfazer', a: { backup: b.id }, b: basesDe(docs, chaves), exp: ctx.agora() + VALIDADE_PREVIA_MS }, ctx.segredo);
  return { texto: `PRÉVIA — desfazer a última operação do Claude:\n${b.resumo}\n\nMostre ao dono e só confirme depois de um "sim".`, dados: { id_previa: id, operacao: 'desfazer' } };
}

export async function confirmar(ctx, idPrevia) {
  const p = await verificar(idPrevia, ctx.segredo, ctx.agora());
  if (!p || p.t !== 'previa' || p.u !== ctx.uid) throw new ErroUsuario('Prévia inválida ou vencida. Prepare a operação de novo.');
  const opId = novoOpId(ctx);

  if (p.op === 'desfazer') {
    const b = await ctx.firestore.lerBackup(ctx.uid, p.a?.backup);
    if (!b || b.desfeito) throw new ErroUsuario('Essa operação já foi desfeita ou não existe mais.');
    const chaves = Object.keys(p.b);
    const docs = await ctx.firestore.lerDocs(ctx.uid, chaves);
    if (chaves.some((k) => docs[k].updateTime !== p.b[k])) throw new ErroUsuario(MUDOU);
    const mudancas = Object.fromEntries(chaves.map((k) => [k, b.antes[k] ?? null]));
    await gravarComTratamento(ctx, { opId, mudancas, bases: p.b, backup: { ferramenta: 'desfazer', resumo: 'Desfeito: ' + b.resumo, antes: brutosDe(docs, chaves) }, marcarDesfeito: b.id });
    return { texto: `Desfeito no Atlas.\n${b.resumo}\nRecarregue o Atlas para ver.`, dados: { gravado: true, operacao: 'desfazer' } };
  }

  if (!EXECUTORES[p.op]) throw new ErroUsuario('Prévia inválida ou vencida. Prepare a operação de novo.');
  const { docs, r, mudancas } = await simular(ctx, p.op, p.a, p.b);
  const chaves = Object.keys(mudancas);
  await gravarComTratamento(ctx, { opId, mudancas, bases: basesDe(docs, chaves), backup: { ferramenta: p.op, resumo: r.resumo, antes: brutosDe(docs, chaves) } });
  return { texto: `Gravado no Atlas.\n${r.resumo}\nAbra ou recarregue o Atlas para ver.`, dados: { gravado: true, operacao: p.op, ...r.dados } };
}
