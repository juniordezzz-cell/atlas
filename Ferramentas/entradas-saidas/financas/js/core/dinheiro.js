/* ============================================================
   dinheiro.js — valores em CENTAVOS INTEIROS
   ------------------------------------------------------------
   Toda conta do Finanças é feita em centavos (inteiro). Em float,
   0,1 + 0,2 = 0,30000000000000004; somando centenas de lançamentos
   isso vira um centavo a mais ou a menos no fim do mês. Aqui o
   texto vira inteiro uma vez, na entrada, e a tela divide por 100
   só para mostrar.
   ============================================================ */

/* "9,80" → 980 · "1.500" → 150000 · "1.500,50" → 150050 ·
   "2 mil" → 200000 · "1k" → 100000. Devolve null para o que não é
   um valor positivo com no máximo duas casas. */
export function paraCentavos(texto) {
  let s = String(texto == null ? "" : texto).toLowerCase().replace(/r\$/g, "").trim();
  let mult = 1;
  const mil = s.match(/^(.*?)\s*(mil|k)$/);
  if (mil) { s = mil[1].trim(); mult = 1000; }
  if (!/^\d[\d.,]*$/.test(s)) return null;

  let inteiro, frac = "";
  const ultV = s.lastIndexOf(","), ultP = s.lastIndexOf(".");
  if (ultV >= 0 && ultP >= 0) {
    // os dois aparecem: o último é o decimal, o outro é milhar
    const dec = ultV > ultP ? "," : ".";
    const mi = dec === "," ? "." : ",";
    const [a, b] = s.split(dec);
    if (s.split(dec).length !== 2) return null;
    if (!grupoMilharOk(a, mi)) return null;
    inteiro = a.split(mi).join(""); frac = b;
  } else if (ultV >= 0) {
    const partes = s.split(",");
    if (partes.length !== 2) return null;
    [inteiro, frac] = partes;
  } else if (ultP >= 0) {
    const partes = s.split(".");
    // "1.500" e "12.345.678" são milhar; "9.80" e "9.8" são decimal
    if (partes.length > 2 || partes[partes.length - 1].length === 3) {
      if (!grupoMilharOk(s, ".")) return null;
      inteiro = partes.join("");
    } else {
      [inteiro, frac] = partes;
    }
  } else {
    inteiro = s;
  }
  if (!/^\d+$/.test(inteiro) || !/^\d{0,2}$/.test(frac)) return null;
  if (mult === 1000 && frac.length > 3) return null;

  const centavos = (Number(inteiro) * 100 + Number((frac + "00").slice(0, 2))) * mult;
  return Number.isSafeInteger(centavos) && centavos > 0 ? centavos : null;
}

function grupoMilharOk(s, sep) {
  const g = s.split(sep);
  return g[0].length >= 1 && g[0].length <= 3 && g.slice(1).every((x) => /^\d{3}$/.test(x));
}

/* Valores antigos (v1 guardava reais em float). */
export function centavosDeReais(reais) {
  const n = Number(reais);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

const FMT = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/* A divisão por 100 de um inteiro de até 2^53 é exata o suficiente
   para duas casas; Intl arredonda para exibir. */
export function formatarCentavos(centavos, opcoes = {}) {
  const c = Math.trunc(Number(centavos) || 0);
  const texto = FMT.format(Math.abs(c) / 100);
  if (c < 0) return "-" + texto;
  if (opcoes.sinal && c > 0) return "+" + texto;
  return texto;
}
