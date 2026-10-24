/* ============================================================
   extrato.js — extrato do banco colado no Oráculo
   ------------------------------------------------------------
   Pedido do dono em 24/10/2026. Formato de cada lançamento:
       2026-10-12            ← data (AAAA-MM-DD ou DD/MM/AAAA)
       UBER DO BRASIL        ← nome
       Pix enviado           ← tipo no banco (opcional)
       Transporte            ← categoria (opcional)
       -11.96                ← valor com sinal (− saiu, + entrou)
   Aceita também tudo numa linha só (o campo de texto do celular junta
   as linhas) e colunas separadas por tabulação (planilha).

   Puro: lerExtrato(texto, { hoje, aprendizado }) →
     { itens: [{ data, tipo, centavos, descricao, categoria, sentido? }],
       erros: ["texto para o dono"] }
   "Transferência entre contas" (para outra conta do dono) vira tipo
   `transferencia`: mexe no caixa, mas não é despesa nem ganho.
   ============================================================ */
import { paraCentavos } from "./dinheiro.js";
import { dataValida, montar, todayKey } from "./datas.js";
import { normalizar, categoriaDe, todasCategorias, MERCADINHO } from "./categorias.js";

const RE_DATA = /(^|\s)(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})(?=\s)/g;
const RE_VALOR = /^([+-])?\s*(?:r\$\s*)?([+-])?\s*(\d[\d.,]*)$/i;
/* tipo do banco, como campo inteiro (várias linhas) */
const RE_TIPO_CAMPO = /^(pix( recebido| enviado| devolvido)?|d[eé]bito|cr[eé]dito|compra( no (d[eé]bito|cr[eé]dito))?|transfer[eê]ncia( enviada| recebida)?|ted|doc|boleto|pagamento|tarifa)$/i;
/* tipo do banco no meio de uma linha só ("pix" sozinho não: aparece em nomes) */
const RE_TIPO_DENTRO = /(^|\s)(pix recebido|pix enviado|pix devolvido|compra no d[eé]bito|compra no cr[eé]dito|transfer[eê]ncia enviada|transfer[eê]ncia recebida|transfer[eê]ncia|d[eé]bito|cr[eé]dito|boleto)(?=\s|$)/gi;
const RE_ENTRE_CONTAS = /entre contas|mesma titularidade|outra conta|propria conta|conta propria/;
const MINUSCULAS = new Set(["do", "da", "de", "dos", "das", "e"]);

/* "UBER DO BRASIL" → "Uber do Brasil"; "jones silveira" → "Jones Silveira";
   texto já em maiúsculas e minúsculas fica como está. */
function arrumarNome(s) {
  const t = s.replace(/\s+/g, " ").trim();
  const tudoMinusculo = !/\p{Lu}/u.test(t);
  return t.split(" ").map((w, i) => {
    const letras = w.replace(/[^\p{L}]/gu, "");
    const caixaAlta = letras.length >= 2 && letras === letras.toUpperCase() && /\p{Lu}/u.test(letras);
    if (!tudoMinusculo && !caixaAlta) return w;
    const baixo = w.toLowerCase();
    if (i > 0 && MINUSCULAS.has(baixo)) return baixo;
    return baixo.replace(/\p{L}/u, (c) => c.toUpperCase());
  }).join(" ");
}

function lerDataCampo(s) {
  let a, m, d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) [a, m, d] = s.split("-").map(Number);
  else { [d, m, a] = s.split("/").map(Number); }
  return dataValida(a, m, d) ? montar(a, m, d) : null;
}

/* Fora de parênteses? ("Claude (… Pix Automático)" não conta) */
function foraDeParenteses(texto, pos) {
  let nivel = 0;
  for (let i = 0; i < pos; i++) {
    if (texto[i] === "(") nivel++;
    else if (texto[i] === ")") nivel = Math.max(0, nivel - 1);
  }
  return nivel === 0;
}

/* Um bloco depois da data → { nome, tipoBanco, categoria, valorTexto } */
function campos(bloco) {
  let partes, valorTexto;
  if (/[\t\n]/.test(bloco)) {
    partes = bloco.split(/[\t\n]+/).map((x) => x.trim()).filter(Boolean);
    valorTexto = partes.pop() || "";
    // "R$" numa coluna e o número na outra
    if (/^r\$$/i.test(partes[partes.length - 1] || "")) partes.pop();
    const i = partes.findIndex((p) => RE_TIPO_CAMPO.test(p));
    if (i >= 0) return { nome: partes.slice(0, i).join(" "), tipoBanco: partes[i], categoria: partes.slice(i + 1).join(" "), valorTexto };
    return { nome: partes[0] || "", tipoBanco: "", categoria: partes.slice(1).join(" "), valorTexto };
  }
  const tokens = bloco.trim().split(/\s+/);
  valorTexto = tokens.pop() || "";
  if (/^r\$$/i.test(tokens[tokens.length - 1] || "")) tokens.pop();
  const resto = tokens.join(" ");
  for (const m of resto.matchAll(RE_TIPO_DENTRO)) {
    const ini = m.index + m[1].length;
    if (!foraDeParenteses(resto, ini)) continue;
    return { nome: resto.slice(0, ini).trim(), tipoBanco: m[2], categoria: resto.slice(ini + m[2].length).trim(), valorTexto };
  }
  return { nome: resto, tipoBanco: "", categoria: "", valorTexto };
}

function blocos(texto) {
  const t = String(texto == null ? "" : texto).replace(/\r/g, "");
  const marcas = [...t.matchAll(RE_DATA)].map((m) => ({ ini: m.index + m[1].length, fim: m.index + m[0].length, data: m[2] }));
  return marcas.map((m, i) => ({ dataTexto: m.data, corpo: t.slice(m.fim, i + 1 < marcas.length ? marcas[i + 1].ini : t.length) }));
}

/* Tem cara de extrato: pelo menos uma data completa seguida de campos
   e terminando num valor; uma só, só se o tipo do banco aparece. */
export function pareceExtrato(texto) {
  const bs = blocos(texto).filter((b) => RE_VALOR.test((campos(b.corpo).valorTexto || "").trim()));
  if (bs.length >= 2) return true;
  return bs.length === 1 && !!campos(bs[0].corpo).tipoBanco;
}

function chaveNome(nome) {
  return normalizar(nome.replace(/\s*\([^)]*\)\s*/g, " ")).replace(/\s+/g, " ").trim();
}

function categoriaFinal(cat, tipo, nome, aprendizado) {
  const n = normalizar(cat);
  if (tipo === "transferencia") return "Transferência entre contas";
  if (tipo === "entrada") return !n || /^entrada\b|^recebimento$|^pix recebido$/.test(n) ? "Recebimento" : cat.trim().slice(0, 40);
  if (!n || /^a definir|^sem categoria|^outros?$/.test(n)) {
    if (n.startsWith("outro")) return "Outros";
    const aprendida = aprendizado[chaveNome(nome)];
    if (aprendida) return aprendida;
    return categoriaDe(nome, aprendizado).categoria || "A definir";
  }
  if (n === "mercadinho") return MERCADINHO;
  const conhecida = todasCategorias().find((c) => normalizar(c) === n);
  return conhecida || cat.trim().slice(0, 40);
}

export function lerExtrato(texto, ctx = {}) {
  const hoje = ctx.hoje || todayKey();
  const aprendizado = ctx.aprendizado || {};
  const itens = [], erros = [];
  for (const b of blocos(texto)) {
    const c = campos(b.corpo);
    const rotulo = `${b.dataTexto} ${arrumarNome(c.nome || "")}`.trim();
    const data = lerDataCampo(b.dataTexto);
    if (!data) { erros.push(`${rotulo}: data inválida.`); continue; }
    if (data > hoje) { erros.push(`${rotulo}: data no futuro, não lancei.`); continue; }
    const v = (c.valorTexto || "").trim().match(RE_VALOR);
    const centavos = v ? paraCentavos(v[3]) : null;
    if (centavos == null) { erros.push(`${rotulo}: valor "${c.valorTexto}" não entendido.`); continue; }
    const sinal = v[1] || v[2];
    const banco = normalizar(c.tipoBanco);
    const entrou = sinal ? sinal === "+" : /recebid|credito|devolvid/.test(banco);
    const entreContas = RE_ENTRE_CONTAS.test(normalizar(`${c.categoria} ${c.nome}`));
    const tipo = entreContas ? "transferencia" : entrou ? "entrada" : "saida";
    const descricao = arrumarNome(c.nome || c.tipoBanco || "Lançamento").slice(0, 80);
    const item = { data, tipo, centavos, descricao, categoria: categoriaFinal(c.categoria || "", tipo, descricao, aprendizado) };
    if (tipo === "transferencia") item.sentido = entrou ? "entrada" : "saida";
    itens.push(item);
  }
  return { itens, erros };
}

export { chaveNome };
