/* ============================================================
   livro.js — o livro-caixa do Finanças
   ------------------------------------------------------------
   Um lançamento:
     { id, data:"AAAA-MM-DD", tipo, centavos (inteiro > 0),
       descricao, categoria, destino?, criadoEm (ms) }

   Efeito de cada tipo no caixa:
     entrada       + centavos         (conta em "Entrou")
     saida         − centavos         (conta em "Saiu")
     investimento  − centavos         (conta em "Investido", não é gasto)
     resgate       + centavos         (abate do "Investido")
     saldo         caixa = centavos   (ponto de partida; não conta no mês)

   O caixa corrido segue a ordem data → criadoEm. Um "saldo" diz
   quanto havia naquele dia; o que foi lançado antes dele não muda o
   caixa depois dele. Só conta o que foi lançado: não há previsão.
   ============================================================ */

export const TIPOS = ["entrada", "saida", "investimento", "resgate", "saldo"];

const SINAL = { entrada: 1, saida: -1, investimento: -1, resgate: 1 };

/* Centavos válidos: inteiro positivo (saldo também aceita zero). */
function valido(l) {
  if (!l || !TIPOS.includes(l.tipo) || !/^\d{4}-\d{2}-\d{2}$/.test(String(l.data))) return false;
  return Number.isSafeInteger(l.centavos) && (l.centavos > 0 || (l.tipo === "saldo" && l.centavos === 0));
}

export function ordenar(lancs) {
  return (lancs || []).filter(valido).slice().sort((a, b) =>
    a.data < b.data ? -1 : a.data > b.data ? 1 : (Number(a.criadoEm) || 0) - (Number(b.criadoEm) || 0));
}

function aplicar(caixa, l) {
  return l.tipo === "saldo" ? l.centavos : caixa + SINAL[l.tipo] * l.centavos;
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

export function resumoMes(lancs, mes) {
  const r = {
    entrou: 0, saiu: 0, investido: 0, resgatado: 0,
    porCategoria: {}, quantos: { entradas: 0, saidas: 0, investimentos: 0 }, ultimaEntrada: null
  };
  for (const l of doMes(lancs, mes)) {
    if (l.tipo === "entrada") { r.entrou += l.centavos; r.quantos.entradas++; r.ultimaEntrada = l.data; }
    else if (l.tipo === "saida") {
      r.saiu += l.centavos; r.quantos.saidas++;
      const cat = l.categoria || "Outros";
      r.porCategoria[cat] = (r.porCategoria[cat] || 0) + l.centavos;
    }
    else if (l.tipo === "investimento") { r.investido += l.centavos; r.quantos.investimentos++; }
    else if (l.tipo === "resgate") r.resgatado += l.centavos;
  }
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
      if (l.tipo === "entrada") d.entrou += l.centavos;
      else if (l.tipo === "saida") d.saiu += l.centavos;
      else if (l.tipo === "investimento") d.investiu += l.centavos;
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
