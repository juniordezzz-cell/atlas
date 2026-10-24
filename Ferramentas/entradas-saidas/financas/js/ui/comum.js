/* ============================================================
   comum.js — peças das telas do Finanças
   ------------------------------------------------------------
   • el(): monta elementos sem HTML em texto (o que o dono escreve
     nunca vira marcação — mesmo vindo de um backup importado);
   • a conversa do Oráculo (uma por página, a mesma para a barra do
     Painel, a aba Oráculo e o painel flutuante do Atlas);
   • o chat (mensagens + botões de sugestão);
   • o editor de lançamento (corrigir, apagar, lançamento manual);
   • utilidades (toast, ícones, link ao Atlas).
   Qualquer mudança nos dados dispara "financas:mudou" em window.
   ============================================================ */
import { lerEstado, salvarEstado, adicionar, atualizar, remover } from "../core/store.js";
import { criarConversa } from "../core/conversa.js";
import { paraCentavos, formatarCentavos } from "../core/dinheiro.js";
import { todayKey } from "../core/datas.js";
import { todasCategorias, CATEGORIAS_ENTRADA, MERCADINHO } from "../core/categorias.js";

export const R = (c, o) => formatarCentavos(c, o);

const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_TAGS = new Set(["svg", "g", "rect", "circle", "path", "line", "text", "defs", "linearGradient", "stop", "title", "polyline"]);

/* el("div", { class: "x", on: { click: fn } }, "texto", outroEl, [lista]) */
export function el(tag, props = {}, ...filhos) {
  const svg = SVG_TAGS.has(tag);
  const e = svg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "on") Object.entries(v).forEach(([ev, fn]) => e.addEventListener(ev, fn));
    else if (k === "text") e.textContent = v;
    else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else if (k in e && !svg && typeof v !== "string") e[k] = v;
    else e.setAttribute(k === "className" ? "class" : k, v === true ? "" : String(v));
  }
  const por = (f) => {
    if (f == null || f === false) return;
    if (Array.isArray(f)) f.forEach(por);
    else e.appendChild(f instanceof Node ? f : document.createTextNode(String(f)));
  };
  filhos.forEach(por);
  return e;
}

export function avisarMudanca() {
  window.dispatchEvent(new CustomEvent("financas:mudou"));
}

export const AVATAR = "../../../assets/atena.webp";
export const dentroDoAtlas = /\/Ferramentas\//i.test(location.pathname);
export const LINK_CARTEIRAS = "../../../pages/dashboard.html";

/* ---------------- conversa (singleton da página) ---------------- */

let conversa = null;
export function obterConversa() {
  if (!conversa) {
    conversa = criarConversa({ ler: () => lerEstado(), salvar: salvarEstado, hoje: () => todayKey() });
  }
  return conversa;
}

export function responder(texto) {
  const r = obterConversa().responder(texto);
  if (r.mudou) avisarMudanca();
  return r;
}

/* O botão flutuante do Atlas também lança aqui. Pergunta que não é de
   finanças ("abre o dashboard") volta para o Oráculo geral. */
export function ligarOraculoGlobal() {
  const ligar = () => {
    if (!window.AtlasOraculo || !window.AtlasOraculo.registerTool) return false;
    window.AtlasOraculo.registerTool((q) => {
      const r = responder(q);
      return r.naoEntendi ? null : { texto: r.texto, sugestoes: r.sugestoes || [] };
    });
    return true;
  };
  if (!ligar()) window.addEventListener("load", ligar, { once: true });
}

/* ---------------- ícones e rótulos ---------------- */

const ICONES = {
  "Transporte": "🚕", [MERCADINHO]: "🥖", "Mercado": "🛒", "Comer fora": "🍔", "Contas da casa": "🏠",
  "Assinaturas": "📺", "Saúde": "💊", "Compras": "🛍️", "Lazer": "🎉", "Educação": "📚",
  "Cuidados pessoais": "💇", "Pets": "🐾", "Cartão e dívidas": "💳", "Família e amigos": "👪"
};
export function icone(l) {
  if (l.tipo === "entrada") return "💰";
  if (l.tipo === "investimento" || l.tipo === "resgate") return "📈";
  if (l.tipo === "saldo") return "🧾";
  if (l.tipo === "transferencia") return "🔁";
  return ICONES[l.categoria] || "•";
}

export function classeTipo(tipo) {
  return { entrada: "fp-pos", saida: "fp-neg", investimento: "fp-inv", resgate: "fp-inv" }[tipo] || "fp-neutro";
}

export function valorComSinal(l) {
  if (l.tipo === "entrada") return R(l.centavos, { sinal: true });
  if (l.tipo === "saida") return "−" + R(l.centavos);
  if (l.tipo === "investimento") return "→ " + R(l.centavos);
  if (l.tipo === "resgate") return "← " + R(l.centavos);
  if (l.tipo === "transferencia") return "⇄ " + (l.sentido === "saida" ? "−" : "+") + R(l.centavos);
  return "= " + R(l.centavos);
}

export const NOME_TIPO = { entrada: "Ganho", saida: "Despesa", investimento: "Investimento", resgate: "Resgate", saldo: "Acerto de caixa", transferencia: "Transferência" };

/* Uma linha de lançamento (Painel e Lançamentos). Toque abre o editor. */
export function linhaLancamento(l, rotuloDia) {
  const sub = [rotuloDia, l.tipo === "saida" ? l.categoria : l.tipo === "saldo" ? "Acerto de caixa" : l.tipo === "transferencia" ? (l.sentido === "saida" ? "Para outra conta sua" : "De outra conta sua") : l.tipo === "entrada" ? l.categoria : `${NOME_TIPO[l.tipo]} · ${l.destino}`]
    .filter(Boolean).join(" · ");
  return el("button", { type: "button", class: "fp-linha", on: { click: () => abrirEditor(l) } },
    el("span", { class: `fp-linha-ic ${classeTipo(l.tipo)}`, "aria-hidden": "true", text: icone(l) }),
    el("span", { class: "fp-linha-txt" }, el("b", { text: l.descricao }), el("small", { text: sub })),
    el("span", { class: `fp-linha-v ${classeTipo(l.tipo)}`, text: valorComSinal(l) }));
}

/* ---------------- toast ---------------- */

export function toast(msg) {
  let t = document.querySelector(".fp-toast");
  if (!t) {
    t = el("div", { class: "fp-toast", role: "status" });
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("is-on");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("is-on"), 2600);
}

/* ---------------- chat ---------------- */

/* caixa precisa ter [data-chat-lista] e [data-chat-form] com um input.
   compacto: mostra só a última resposta (barra do Painel). */
export function montarChat(caixa, { compacto = false, aoResponder } = {}) {
  const lista = caixa.querySelector("[data-chat-lista]");
  const form = caixa.querySelector("[data-chat-form]");
  const campo = form.querySelector("input, textarea");
  // caixa de várias linhas (extrato colado): cresce até ~7 linhas;
  // Enter envia, Shift+Enter quebra a linha
  const crescer = () => {
    if (campo.tagName !== "TEXTAREA") return;
    campo.style.height = "auto";
    campo.style.height = `${campo.scrollHeight}px`;
    campo.setAttribute("rows", campo.value.includes("\n") ? "2" : "1");
  };
  campo.addEventListener("input", crescer);
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });

  function bolha(texto, quem, sugestoes = []) {
    if (compacto) lista.replaceChildren();
    const botoes = sugestoes.length
      ? el("div", { class: "fp-sugs" }, sugestoes.map((s) =>
        el("button", {
          type: "button", class: "fp-sug" + (s === "Desfazer" || s === "Cancelar" ? " fp-sug--fraco" : ""),
          text: s, on: { click: () => enviar(s) }
        })))
      : null;
    const fechar = compacto
      ? el("button", {
        type: "button", class: "fp-msg-fechar", "aria-label": "Fechar resposta", text: "×",
        on: { click: () => { lista.replaceChildren(); caixa.classList.remove("tem-resposta"); } }
      })
      : null;
    const m = el("div", { class: `fp-msg fp-msg--${quem}` }, el("p", { text: texto }), botoes, fechar);
    if (compacto) caixa.classList.add("tem-resposta");
    lista.appendChild(m);
    lista.scrollTop = lista.scrollHeight;
    return m;
  }

  function enviar(texto) {
    const t = String(texto || "").trim();
    if (!t) return;
    // extrato colado: mostra o começo, não as 150 linhas
    const linhas = t.split("\n");
    if (!compacto) bolha(linhas.length > 6 ? `${linhas.slice(0, 5).join("\n")}\n… (${linhas.length} linhas coladas)` : t, "eu");
    const r = responder(t);
    bolha(r.texto, "oraculo", r.sugestoes || []);
    if (aoResponder) aoResponder(r);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = campo.value;
    campo.value = "";
    crescer();
    enviar(t);
    campo.focus();
  });

  return { enviar, bolha };
}

/* ---------------- editor de lançamento ---------------- */

function campo(rotulo, input, extra = {}) {
  return el("label", { class: "fp-campo", ...extra }, el("span", { text: rotulo }), input);
}

export function abrirEditor(lanc, { tipo = "saida" } = {}) {
  const estado = lerEstado();
  const novo = !lanc;
  const l = lanc || { tipo, data: todayKey(), centavos: 0, descricao: "", categoria: "" };
  const usadas = estado.lancamentos.map((x) => x.categoria).filter(Boolean);
  const cats = [...new Set([...todasCategorias(usadas), ...Object.keys(CATEGORIAS_ENTRADA)])];
  const destinos = [...new Set(estado.lancamentos.map((x) => x.destino).filter(Boolean))];
  const valorInicial = l.centavos || (l.tipo === "saldo" && !novo) ? R(l.centavos).replace(/^-?R\$\s*/, "") : "";

  const seg = el("div", { class: "fp-seg", role: "radiogroup", "aria-label": "Tipo" },
    ["entrada", "saida", "investimento", "resgate", "transferencia", "saldo"].map((t) =>
      el("label", {}, el("input", { type: "radio", name: "tipo", value: t, checked: l.tipo === t }), el("span", { text: NOME_TIPO[t] }))));
  const erro = el("p", { class: "fp-form-erro", hidden: true });
  const dlg = el("dialog", { class: "fp-dialogo" });
  // fecha e tira do DOM na hora (o evento "close" pode atrasar com a aba em segundo plano)
  const fechar = () => { if (dlg.open) dlg.close(); dlg.remove(); };
  const form = el("form", { class: "fp-form", novalidate: true },
    el("h3", { text: novo ? "Lançamento manual" : "Corrigir lançamento" }),
    seg,
    campo("Valor (R$)", el("input", { name: "valor", inputmode: "decimal", autocomplete: "off", placeholder: "9,80", value: valorInicial })),
    campo("Dia", el("input", { name: "data", type: "date", max: todayKey(), value: l.data })),
    campo("Descrição", el("input", { name: "descricao", maxlength: "80", autocomplete: "off", placeholder: "Uber, mercadinho, salário…", value: l.descricao || "" })),
    campo("Categoria", el("input", { name: "categoria", list: "fpCats", maxlength: "40", autocomplete: "off", value: l.categoria || "" }), { "data-so": "entrada saida" }),
    el("datalist", { id: "fpCats" }, cats.map((c) => el("option", { value: c }))),
    campo("Onde (corretora, banco…)", el("input", { name: "destino", list: "fpDest", maxlength: "40", autocomplete: "off", placeholder: "Binance", value: l.destino || "" }), { "data-so": "investimento resgate" }),
    el("datalist", { id: "fpDest" }, destinos.map((d) => el("option", { value: d }))),
    campo("Sentido", el("select", { name: "sentido" },
      el("option", { value: "saida", text: "Saiu para outra conta minha", selected: l.sentido !== "entrada" }),
      el("option", { value: "entrada", text: "Veio de outra conta minha", selected: l.sentido === "entrada" })), { "data-so": "transferencia" }),
    erro,
    el("div", { class: "fp-form-acoes" },
      novo ? null : el("button", { type: "button", class: "fp-btn fp-btn--perigo", text: "Apagar", on: { click: apagar } }),
      el("span"),
      el("button", { type: "button", class: "fp-btn", text: "Cancelar", on: { click: fechar } }),
      el("button", { type: "submit", class: "fp-btn fp-btn--primario", text: "Salvar" })));
  dlg.appendChild(form);
  document.body.appendChild(dlg);

  const mostrarCampos = () => {
    const t = form.elements.tipo.value;
    dlg.querySelectorAll("[data-so]").forEach((x) => { x.hidden = !x.dataset.so.split(" ").includes(t); });
  };
  form.addEventListener("change", mostrarCampos);
  mostrarCampos();

  function apagar() {
    if (!confirm(`Apagar "${l.descricao}" (${R(l.centavos)})?`)) return;
    salvarEstado(remover(lerEstado(), l.id));
    avisarMudanca();
    toast("Lançamento apagado.");
    fechar();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = form.elements;
    const t = f.tipo.value;
    const zero = t === "saldo" && /^\s*0+([.,]0{1,2})?\s*$/.test(f.valor.value);
    const centavos = zero ? 0 : paraCentavos(f.valor.value);
    const falha = (m) => { erro.textContent = m; erro.hidden = false; };
    if (centavos == null) return falha("Valor inválido. Use vírgula para centavos, ex.: 9,80.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data.value)) return falha("Escolha o dia.");
    if (f.data.value > todayKey()) return falha("Esse dia ainda não chegou. Só lance o que já aconteceu.");
    const investe = t === "investimento" || t === "resgate";
    const destino = f.destino.value.trim() || "Investimentos";
    const campos = {
      tipo: t, centavos, data: f.data.value,
      descricao: f.descricao.value.trim() || (investe ? destino : NOME_TIPO[t]),
      categoria: t === "entrada" ? (f.categoria.value.trim() || "Recebimento")
        : t === "saida" ? (f.categoria.value.trim() || "Outros")
        : t === "saldo" ? null : t === "transferencia" ? "Transferência entre contas" : "Investimento",
      destino: investe ? destino : undefined,
      sentido: t === "transferencia" ? f.sentido.value : undefined
    };
    try {
      const s = lerEstado();
      salvarEstado(novo ? adicionar(s, campos) : atualizar(s, l.id, campos));
    } catch (err) {
      return falha("Não deu para salvar: confira os campos.");
    }
    avisarMudanca();
    toast(novo ? "Lançado." : "Corrigido.");
    fechar();
  });

  dlg.addEventListener("close", () => dlg.remove());
  dlg.showModal();
  (novo ? form.elements.valor : form.elements.descricao).focus();
}
