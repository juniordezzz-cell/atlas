/* ============================================================
   livro.js — o livro-caixa do Finanças
   ------------------------------------------------------------
   Um lançamento:
     { id, data:"AAAA-MM-DD", tipo, centavos (inteiro > 0),
       descricao, categoria, destino?, criadoEm (ms) }

   Efeito de cada tipo no caixa:
     entrada       + centavos         (ganho)
     saida         − centavos         (despesa)
     investimento  − centavos         (despesa, fatia "Investimentos";
                                       soma no investido por destino)
     resgate       + centavos         (ganho; abate do investido)
     saldo         caixa = centavos   (ponto de partida; não conta no mês)
     transferencia ± centavos         (entre contas; sentido "saida" é
                                       despesa, "entrada" é ganho)

   O caixa corrido segue a ordem data → criadoEm. Um "saldo" diz
   quanto havia naquele dia; o que foi lançado antes dele não muda o
   caixa depois dele. Só conta o que foi lançado: não há previsão.
   ============================================================ */

export const TIPOS = ["entrada", "saida", "investimento", "resgate", "saldo", "transferencia"];

const SINAL = { entrada: 1, saida: -1, investimento: -1, resgate: 1 };

/* Centavos válidos: inteiro positivo (saldo também aceita zero). */
function valido(l) {
  if (!l || !TIPOS.includes(l.tipo) || !/^\d{4}-\d{2}-\d{2}$/.test(String(l.data))) return false;
  if (l.tipo === "transferencia" && l.sentido !== "saida" && l.sentido !== "entrada") return false;
  return Number.isSafeInteger(l.centavos) && (l.centavos > 0 || (l.tipo === "saldo" && l.centavos === 0));
}

export function ordenar(lancs) {
  return (lancs || []).filter(valido).slice().sort((a, b) =>
    a.data < b.data ? -1 : a.data > b.data ? 1 : (Number(a.criadoEm) || 0) - (Number(b.criadoEm) || 0));
}

function sinal(l) {
  if (l.tipo === "transferencia") return l.sentido === "entrada" ? 1 : -1;
  return SINAL[l.tipo];
}

function aplicar(caixa, l) {
  return l.tipo === "saldo" ? l.centavos : caixa + sinal(l) * l.centavos;
}

/* Caixa no fim do dia `data` (sem data: tudo que foi lançado). */
export function caixaAte(lancs, data) {
  let caixa = 0;
  for (const l of ordenar(lancs)) {
    if (data && l.data > data) break;
    caixa = aplicar(caixa, l);
  }
  return caixa;
}

const doMes = (lancs, mes) => ordenar(lancs).filter((l) => l.data.slice(0, 7) === mes);

/* Tudo que saiu do caixa é despesa e tudo que entrou é ganho (pedido do
   dono, 24/10/2026: "senão sempre dá erro matemático"). Assim
       caixa no fim do mês = caixa no início + entrou − saiu
   (só um acerto de caixa, "tenho X", quebra a igualdade, de propósito).
   Investimento e transferência para outra conta entram em `saiu` com as
   fatias "Investimentos" e "Transferências"; resgate e transferência
   que volta entram em `entrou`. `consumo` é só o que foi gasto de fato
   (é o que as metas do Planejar medem). */
export const CAT_INVESTIMENTOS = "Investimentos";
export const CAT_TRANSFERENCIAS = "Transferências";

export function ehSaida(l) {
  return l.tipo === "saida" || l.tipo === "investimento" || (l.tipo === "transferencia" && l.sentido === "saida");
}
export function ehEntrada(l) {
  return l.tipo === "entrada" || l.tipo === "resgate" || (l.tipo === "transferencia" && l.sentido === "entrada");
}
/* Fatia do gráfico de despesas */
export function categoriaDaSaida(l) {
  if (l.tipo === "investimento") return CAT_INVESTIMENTOS;
  if (l.tipo === "transferencia") return CAT_TRANSFERENCIAS;
  return l.categoria || "Outros";
}

export function resumoMes(lancs, mes) {
  const r = {
    entrou: 0, saiu: 0, consumo: 0, investido: 0, resgatado: 0,
    transferido: 0, transfSaiu: 0, transfEntrou: 0,
    porCategoria: {}, quantos: { entradas: 0, saidas: 0, investimentos: 0 }, ultimaEntrada: null
  };
  for (const l of doMes(lancs, mes)) {
    if (ehEntrada(l)) {
      r.entrou += l.centavos; r.quantos.entradas++;
      if (l.tipo === "entrada") r.ultimaEntrada = l.data;
      if (l.tipo === "resgate") r.resgatado += l.centavos;
      if (l.tipo === "transferencia") r.transfEntrou += l.centavos;
    } else if (ehSaida(l)) {
      r.saiu += l.centavos; r.quantos.saidas++;
      const cat = categoriaDaSaida(l);
      r.porCategoria[cat] = (r.porCategoria[cat] || 0) + l.centavos;
      if (l.tipo === "saida") r.consumo += l.centavos;
      if (l.tipo === "investimento") { r.investido += l.centavos; r.quantos.investimentos++; }
      if (l.tipo === "transferencia") r.transfSaiu += l.centavos;
    }
  }
  // transferido: o que foi para outras contas, menos o que veio delas
  r.transferido = r.transfSaiu - r.transfEntrou;
  return r;
}

export function diasNoMes(mes) {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/* Um ponto por dia do mês: quanto entrou, saiu e foi investido no
   dia, e o caixa no fim dele (começando do caixa do fim do mês
   anterior). */
export function serieDiaria(lancs, mes) {
  const n = diasNoMes(mes);
  const dias = Array.from({ length: n }, (_, i) => ({ dia: i + 1, entrou: 0, saiu: 0, investiu: 0, caixa: 0 }));
  let caixa = 0;
  let i = 0;
  const todos = ordenar(lancs);
  for (; i < todos.length && todos[i].data < mes + "-01"; i++) caixa = aplicar(caixa, todos[i]);
  for (const d of dias) {
    const chave = `${mes}-${String(d.dia).padStart(2, "0")}`;
    for (; i < todos.length && todos[i].data === chave; i++) {
      const l = todos[i];
      if (ehEntrada(l)) d.entrou += l.centavos;
      else if (ehSaida(l)) d.saiu += l.centavos;
      if (l.tipo === "investimento") d.investiu += l.centavos;
      caixa = aplicar(caixa, l);
    }
    d.caixa = caixa;
  }
  return dias;
}

/* Investido líquido (investimentos − resgates), no total e por destino. */
export function investidoPorDestino(lancs, ate) {
  const r = { total: 0, destinos: {} };
  for (const l of ordenar(lancs)) {
    if (ate && l.data > ate) break;
    if (l.tipo !== "investimento" && l.tipo !== "resgate") continue;
    const v = l.tipo === "investimento" ? l.centavos : -l.centavos;
    const d = l.destino || "Investimentos";
    r.total += v;
    r.destinos[d] = (r.destinos[d] || 0) + v;
  }
  return r;
}

export function mesesComDados(lancs) {
  return [...new Set(ordenar(lancs).map((l) => l.data.slice(0, 7)))].sort().reverse();
}
