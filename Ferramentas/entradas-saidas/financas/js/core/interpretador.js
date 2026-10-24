/* ============================================================
   interpretador.js — "gastei 9,80 no uber" → lançamento
   ------------------------------------------------------------
   Sem IA: regras locais, de graça e instantâneas. Puro (sem DOM,
   sem armazenamento); `hoje` e `aprendizado` vêm de fora.

   interpretar(texto, { hoje, aprendizado }) →
     { itens: [{ tipo, centavos, data, descricao, categoria, destino? }] }
     ou { itens: [], erro: "texto para o dono" }
   tipo null = não deu para saber se entrou ou saiu (o Oráculo pergunta);
   categoria null numa saída = não reconheceu (o Oráculo pergunta).

   O texto é trabalhado em duas cópias do MESMO tamanho: `o` (original
   em minúsculas, com acento, para a descrição) e `n` (sem acento, para
   as regras). Tudo que é reconhecido (data, valor) é apagado com
   espaços nas duas, para as posições continuarem batendo.
   ============================================================ */
import { paraCentavos } from "./dinheiro.js";
import { somarDias, dataValida, montar, diaDaSemana, todayKey } from "./datas.js";
import { categoriaDe, categoriaDeEntrada, destinoDe, GRAFIA } from "./categorias.js";

/* sem acento, caractere a caractere (mantém o tamanho) */
function semAcento(s) {
  let r = "";
  for (const ch of s) {
    const b = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    r += b.length === 1 ? b : " ".repeat(ch.length);
  }
  return r;
}

function texto2(t) {
  const o = String(t == null ? "" : t).normalize("NFC").toLowerCase().replace(/[\t\r]/g, " ");
  return { o, n: semAcento(o) };
}

function apagar(t, ini, fim) {
  const vazio = " ".repeat(fim - ini);
  return { o: t.o.slice(0, ini) + vazio + t.o.slice(fim), n: t.n.slice(0, ini) + vazio + t.n.slice(fim) };
}

/* ---------------- datas ---------------- */

const SEMANA = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

/* Último dia N que já passou (este mês ou um anterior que tenha o dia). */
function ultimoDiaN(dia, hoje) {
  let [a, m] = hoje.split("-").map(Number);
  if (dia > Number(hoje.slice(8, 10))) m -= 1;
  for (let i = 0; i < 12; i++) {
    if (m < 1) { m += 12; a -= 1; }
    if (dataValida(a, m, dia)) return montar(a, m, dia);
    m -= 1;
  }
  return null;
}

const RE_DMA = /(?:\b(?:em|no dia|dia)\s+)?\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?\b/;
const RE_DIA = /\b(?:(?:em|no)\s+)?dia\s+(\d{1,2})\b(?!\s*\/)/;
const RE_REL = /\b(anteontem|ontem|hoje)\b/;
const RE_SEMANA = /\b(?:(?:na|no|nesta|neste|nessa|nesse|essa|esse|esta|este)\s+)?(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:[- ]feira)?(\s+passad[ao])?\b/;

function formatarDia(data) {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;
}

/* Acha a primeira data do texto e a apaga.
   Devolve { data|null, t } ou { erro } — `t` é o texto sem a data. */
function lerData(t, hoje) {
  let m = t.n.match(RE_DMA);
  if (m) {
    const d = Number(m[1]), mes = Number(m[2]);
    const ano = m[3] ? Number(m[3].length === 2 ? "20" + m[3] : m[3]) : Number(hoje.slice(0, 4));
    if (!dataValida(ano, mes, d)) return { erro: `A data ${m[1]}/${m[2]} não existe. Confere o dia e o mês?` };
    let data = montar(ano, mes, d);
    if (data > hoje) {
      // sem ano: um dia das próximas semanas é erro; mais longe, é do ano passado
      if (!m[3] && dataValida(ano - 1, mes, d) && somarDias(hoje, 60) < data) data = montar(ano - 1, mes, d);
      else return { erro: `O dia ${formatarDia(data)} ainda não chegou. Só lanço o que já aconteceu.` };
    }
    return { data, t: apagar(t, m.index, m.index + m[0].length) };
  }
  m = t.n.match(RE_DIA);
  if (m) {
    const dia = Number(m[1]);
    const data = dia >= 1 && dia <= 31 ? ultimoDiaN(dia, hoje) : null;
    if (!data) return { erro: `Não existe dia ${m[1]}. Confere a data?` };
    return { data, t: apagar(t, m.index, m.index + m[0].length) };
  }
  m = t.n.match(RE_REL);
  if (m) {
    const data = m[1] === "hoje" ? hoje : somarDias(hoje, m[1] === "ontem" ? -1 : -2);
    return { data, t: apagar(t, m.index, m.index + m[0].length) };
  }
  m = t.n.match(RE_SEMANA);
  if (m) {
    let volta = (diaDaSemana(hoje) - SEMANA[m[1]] + 7) % 7;
    if (m[2] && volta === 0) volta = 7;
    return { data: somarDias(hoje, -volta), t: apagar(t, m.index, m.index + m[0].length) };
  }
  return { data: null, t };
}

export function interpretarData(textoLivre, hoje = todayKey()) {
  const r = lerData(texto2(textoLivre), hoje);
  return { data: r.data || null, erro: r.erro };
}

/* ---------------- valor ---------------- */

const RE_VALOR = /(r\$\s*)?(?<![a-z\d.,])(\d[\d.,]*\d|\d)(\s*(?:mil|k)(?![a-z]))?(\s*(?:reais|real|contos?|pilas?)\b)?/g;
/* "99" que é o aplicativo: depois de no/na/do/da/pelo/pela/de/um/uma */
const RE_99 = /\b(?:no|na|do|da|pelo|pela|de|um|uma|o)\s+(99)(\s*pop)?\b(?!\s*(?:reais|real|contos?|mil|k\b|[.,]\d))/;

function candidatos(n, pular) {
  const lista = [];
  for (const m of n.matchAll(RE_VALOR)) {
    const ini = m.index, fim = m.index + m[0].length;
    const ini2 = m.index + (m[1] ? m[1].length : 0);
    if (pular && ini2 >= pular[0] && ini2 < pular[1]) continue;
    lista.push({ ini, fim, num: m[2] + (m[3] ? " mil" : ""), marcado: !!(m[1] || m[4]), bruto: m[0].trim() });
  }
  return lista;
}

function lerValor(t) {
  // "99" de aplicativo só quando sobra outro número para ser o valor
  let pular = null;
  const a = t.n.match(RE_99);
  if (a) {
    const ini = a.index + a[0].lastIndexOf("99");
    const p = [ini, ini + 2];
    if (candidatos(t.n, p).length >= 1) pular = p;
  }
  let lista = candidatos(t.n, pular);
  if (!lista.length) return { erro: "Não achei o valor. Manda assim: \"gastei 9,80 no uber\" ou \"recebi 500\"." };
  if (lista.length > 1) {
    const marcados = lista.filter((c) => c.marcado);
    if (marcados.length === 1) lista = marcados;
    else return { erro: `Vi mais de um número (${lista.map((c) => c.bruto).join(" e ")}). Me manda um valor por vez, tipo "gastei 30 no mercado".` };
  }
  const c = lista[0];
  const centavos = paraCentavos(c.num);
  if (centavos == null) return { erro: `Não entendi o valor "${c.bruto}". Usa vírgula para centavos, tipo 9,80.` };
  return { centavos, t: apagar(t, c.ini, c.fim) };
}

/* ---------------- tipo ---------------- */

const RE_SALDO = /\b(tenho|to com|tou com|estou com|fiquei com|sobrou|sobraram|meu saldo|saldo|meu caixa|caixa|comecei com)\b/;
const RE_RESGATE = /\b(tirei|saquei|resgatei|retirei|puxei|resgate|saque|voltou)\b/;
const RE_INVESTIR = /\b(mandei|enviei|transferi|coloquei|botei|depositei|apliquei|investi|aportei|guardei|comprei|aporte|deposito|depositado)\b/;
const RE_INVEST_SO = /\b(investi|apliquei|aportei|aporte|investimento)\b/;
const RE_ENTRADA = /\b(recebi|recebimento|recebido|recebida|caiu|entrou|ganhei|me pagaram|pagaram|vendi|devolveram)\b/;
const RE_SAIDA = /\b(gastei|gasto|gastos|paguei|pago|pagar|pagamento|comprei|compra|compras|botei|coloquei|abasteci|torrei|saiu|debito|mandei|enviei|transferi|fiz um pix|pix)\b/;
const RE_ENTRADA_NOME = /\b(salario|ordenado|freela|reembolso|estorno|entrada)\b/;

/* palavras que somem da descrição (verbos e enchimento) */
const FORA = new Set(["gastei", "gasto", "paguei", "pago", "pagar", "comprei", "botei", "coloquei", "abasteci",
  "torrei", "recebi", "recebido", "recebida", "ganhei", "caiu", "entrou", "mandei", "enviei", "transferi",
  "depositei", "apliquei", "investi", "aportei", "guardei", "tirei", "saquei", "resgatei", "retirei", "puxei",
  "tenho", "sobrou", "sobraram", "fiz", "tive", "me", "pagaram", "devolveram", "vendi", "eu", "ai", "ja", "so",
  "la", "foi", "acabei", "estou", "to", "tou", "fiquei", "comecei", "reais", "real", "conto", "contos",
  "pila", "pilas", "r", "agora", "saiu"]);
const BORDA = new Set(["de", "do", "da", "dos", "das", "no", "na", "nos", "nas", "num", "numa", "em", "um",
  "uma", "o", "a", "os", "as", "com", "pra", "pro", "para", "por", "pelo", "pela", "e", "que", "mais", "meu",
  "minha", "valor"]);

function descricaoDe(t) {
  const os = t.o.split(" "), ns = t.n.split(" ");
  const par = os.map((o, i) => ({ o: o.replace(/[^\p{L}\p{N}&+-]/gu, ""), n: (ns[i] || "").replace(/[^a-z0-9&+-]/g, "") }))
    .filter((x) => x.n && !FORA.has(x.n));
  while (par.length && BORDA.has(par[0].n)) par.shift();
  while (par.length && BORDA.has(par[par.length - 1].n)) par.pop();
  const s = par.map((x) => GRAFIA[x.n] || x.o).join(" ").slice(0, 80);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function classificar(n, herdado, aprendizado) {
  const destino = destinoDe(n);
  if (destino && RE_RESGATE.test(n)) return { tipo: "resgate", destino };
  if (destino && (RE_INVESTIR.test(n) || RE_INVEST_SO.test(n) || !(RE_SAIDA.test(n) || RE_ENTRADA.test(n)))) {
    return { tipo: "investimento", destino };
  }
  if (RE_INVEST_SO.test(n)) return { tipo: "investimento", destino: "Investimentos" };
  if (RE_SALDO.test(n) && !RE_ENTRADA.test(n) && !RE_SAIDA.test(n)) return { tipo: "saldo" };
  if (RE_ENTRADA.test(n)) return { tipo: "entrada" };
  if (RE_SAIDA.test(n)) return { tipo: "saida" };
  if (RE_ENTRADA_NOME.test(n)) return { tipo: "entrada" };
  if (categoriaDe(n, aprendizado).categoria) return { tipo: "saida" };
  return { tipo: herdado || null };
}

/* ---------------- frase com várias movimentações ---------------- */

const RE_SEP = /\s*;\s*|\n+|,\s+|\s+e\s+|\s+mais\s+/g;

function temNumero(t) {
  const r = lerData(t, "2100-12-31");
  return /\d/.test((r.t || t).n);
}

function dividir(t) {
  const partes = [];
  let ini = 0;
  for (const m of t.n.matchAll(RE_SEP)) {
    partes.push({ ini, fim: m.index });
    ini = m.index + m[0].length;
  }
  partes.push({ ini, fim: t.n.length });
  const pedaco = (p) => ({ o: t.o.slice(p.ini, p.fim), n: t.n.slice(p.ini, p.fim) });
  // pedaço sem número junta com o seguinte ("paguei luz e agua 150"); o último, com o anterior
  const juntos = [];
  let aberto = null;
  partes.forEach((p, i) => {
    const atual = { ini: aberto ? aberto.ini : p.ini, fim: p.fim };
    const comNumero = temNumero(pedaco(p));
    if (!comNumero && i < partes.length - 1) { aberto = atual; return; }
    aberto = null;
    if (!comNumero && juntos.length) juntos[juntos.length - 1].fim = p.fim;
    else juntos.push(atual);
  });
  return juntos.map(pedaco);
}

export function interpretar(texto, ctx = {}) {
  const hoje = ctx.hoje || todayKey();
  const aprendizado = ctx.aprendizado || {};
  const tudo = texto2(texto);
  if (!/\S/.test(tudo.n)) return { itens: [], erro: "Me manda o que entrou ou saiu, tipo \"uber 9,80\"." };

  const itens = [];
  let dataAnterior = null, tipoAnterior = null;
  for (let pedaco of dividir(tudo)) {
    const d = lerData(pedaco, hoje);
    if (d.erro) return { itens: [], erro: d.erro };
    pedaco = d.t;
    const data = d.data || dataAnterior || hoje;

    const v = lerValor(pedaco);
    if (v.erro) return { itens: [], erro: v.erro };
    pedaco = v.t;

    const c = classificar(pedaco.n, tipoAnterior, aprendizado);
    const item = { tipo: c.tipo, centavos: v.centavos, data, descricao: descricaoDe(pedaco), categoria: null };

    if (c.tipo === "saida") item.categoria = categoriaDe(pedaco.n, aprendizado).categoria;
    else if (c.tipo === "entrada") item.categoria = categoriaDeEntrada(pedaco.n);
    else if (c.tipo === "investimento" || c.tipo === "resgate") {
      item.destino = c.destino;
      item.categoria = "Investimento";
      item.descricao = c.destino;
    } else if (c.tipo === "saldo") item.descricao = "Saldo informado";

    if (!item.descricao) item.descricao = item.categoria || (c.tipo === "entrada" ? "Recebimento" : "Lançamento");
    itens.push(item);
    dataAnterior = data;
    if (c.tipo === "entrada" || c.tipo === "saida") tipoAnterior = c.tipo;
  }
  return { itens };
}

/* Para a conversa: o texto tem algum número que pareça valor? */
export function temValor(texto) {
  return temNumero(texto2(texto));
}
