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
import { todasCategorias, CATEGORIAS_ENTRADA, MERCADINHO, normalizar } from "../core/categorias.js";
import { lerExtrato, pareceExtrato, chaveRepetido, chaveNome } from "../core/extrato.js";

import "./nuvem.js";

export const R = (c, o) => formatarCentavos(c, o);

// chegou coisa do outro aparelho: avisa (as telas se redesenham sozinhas)
window.addEventListener("financas:mudou", (e) => {
  const d = e.detail || {};
  if (d.remoto && d.depois !== d.antes) {
    const n = d.depois - d.antes;
    toast(n > 0 ? `${n} ${n === 1 ? "lançamento chegou" : "lançamentos chegaram"} do outro aparelho.` : "Atualizado com o outro aparelho.");
  }
});

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
  // a linha inteira abre a correção; o lápis faz o mesmo e o X apaga
  return el("div", { class: "fp-linha" },
    el("button", { type: "button", class: "fp-linha-corpo", "aria-label": `Corrigir ${l.descricao}`, on: { click: () => abrirEditor(l) } },
      el("span", { class: `fp-linha-ic ${classeTipo(l.tipo)}`, "aria-hidden": "true", text: icone(l) }),
      el("span", { class: "fp-linha-txt" }, el("b", { text: l.descricao }), el("small", { text: sub })),
      el("span", { class: `fp-linha-v ${classeTipo(l.tipo)}`, text: valorComSinal(l) })),
    el("span", { class: "fp-linha-acoes" },
      el("button", { type: "button", class: "fp-acao", title: "Editar", "aria-label": `Editar ${l.descricao}`, on: { click: () => abrirEditor(l) } }, iconeLapis()),
      el("button", { type: "button", class: "fp-acao fp-acao--apagar", title: "Apagar", "aria-label": `Apagar ${l.descricao}`, on: { click: () => apagarLancamento(l) } }, iconeX())));
}

function iconeLapis() {
  return el("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
    el("path", { d: "M4 20h4L19 9l-4-4L4 16v4z", stroke: "currentColor", "stroke-width": "1.8", "stroke-linejoin": "round" }),
    el("path", { d: "M13.5 6.5l4 4", stroke: "currentColor", "stroke-width": "1.8" }));
}
function iconeX() {
  return el("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
    el("path", { d: "M6 6l12 12M18 6L6 18", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round" }));
}

/* Apaga com confirmação; true se apagou. */
export function apagarLancamento(l) {
  if (!confirm(`Apagar "${l.descricao}" (${R(l.centavos)})?`)) return false;
  salvarEstado(remover(lerEstado(), l.id));
  avisarMudanca();
  toast("Lançamento apagado.");
  return true;
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
    if (apagarLancamento(l)) fechar();
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
      if (!novo) lembrarCorrecao(s, l, campos);
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

/* O dono corrigiu o tipo: o próximo extrato com esse nome já vem certo.
   Transferência → despesa guarda a categoria; despesa → transferência
   marca o nome como conta dele. Mudou só a categoria de uma despesa:
   o nome passa a ir para ela. */
function lembrarCorrecao(estado, antes, depois) {
  const chave = chaveNome(depois.descricao || antes.descricao || "");
  if (!chave) return;
  const a = estado.aprendizado;
  if (depois.tipo === "saida" && antes.tipo === "transferencia") {
    a[`@despesa:${chave}`] = depois.categoria;
    delete a[`@transferencia:${chave}`];
  } else if (depois.tipo === "transferencia" && antes.tipo !== "transferencia") {
    a[`@transferencia:${chave}`] = "Transferência entre contas";
    delete a[`@despesa:${chave}`];
  } else if (depois.tipo === "saida" && depois.categoria && depois.categoria !== antes.categoria && depois.categoria !== "A definir") {
    a[chave] = depois.categoria;
    if (a[`@despesa:${chave}`]) a[`@despesa:${chave}`] = depois.categoria;
  }
}

/* ---------------- importar extrato ---------------- */

/* Cola o texto ou escolhe o arquivo (.txt/.csv); mostra o resumo antes
   e só lança quando o dono toca em Importar. Quem lança é a mesma
   conversa do Oráculo: não repete o que já está lançado, aprende os
   nomes e o "Desfazer" do Oráculo desfaz a importação inteira. */
export function abrirImportar() {
  const area = el("textarea", {
    class: "fp-import-texto", rows: "9", spellcheck: "false",
    placeholder: "Cole aqui o extrato do banco. Ex.:\n2026-10-12\nUBER DO BRASIL\nPix enviado\nTransporte\n-11.96"
  });
  const arquivo = el("input", { type: "file", accept: ".txt,.csv,text/plain,text/csv", hidden: true });
  const previa = el("div", { class: "fp-import-previa", "aria-live": "polite" });
  const botao = el("button", { type: "submit", class: "fp-btn fp-btn--primario", text: "Importar", disabled: true });
  const dlg = el("dialog", { class: "fp-dialogo fp-dialogo--largo" });
  const fechar = () => { if (dlg.open) dlg.close(); dlg.remove(); };

  function atualizar() {
    const texto = area.value;
    botao.disabled = true;
    if (!texto.trim()) { previa.replaceChildren(); return; }
    if (!pareceExtrato(texto)) {
      previa.replaceChildren(el("p", { class: "fp-form-erro", text: "Não reconheci como extrato. Cada lançamento precisa da data (2026-10-12 ou 12/10/2026) e terminar no valor (-11.96)." }));
      return;
    }
    const estado = lerEstado();
    const r = lerExtrato(texto, { aprendizado: estado.aprendizado });
    const chave = chaveRepetido;
    const ja = {};
    estado.lancamentos.forEach((l) => { ja[chave(l)] = (ja[chave(l)] || 0) + 1; });
    const novos = r.itens.filter((i) => { const k = chave(i); if (ja[k]) { ja[k]--; return false; } return true; });
    const soma = (t) => novos.filter((i) => i.tipo === t).reduce((a, i) => a + i.centavos, 0);
    const qtd = (t) => novos.filter((i) => i.tipo === t).length;
    const linhas = [
      el("p", {}, el("b", { text: `${novos.length} ${novos.length === 1 ? "lançamento novo" : "lançamentos novos"}` }),
        r.itens.length > novos.length ? ` · ${r.itens.length - novos.length} já estavam lançados` : ""),
      qtd("entrada") ? el("p", { class: "fp-pos", text: `Ganhos: ${R(soma("entrada"))} (${qtd("entrada")})` }) : null,
      qtd("saida") ? el("p", { class: "fp-neg", text: `Despesas: ${R(soma("saida"))} (${qtd("saida")})` }) : null,
      qtd("transferencia") ? el("p", { text: `Transferências entre contas suas: ${R(soma("transferencia"))} (${qtd("transferencia")})` }) : null,
      novos.some((i) => i.categoria === "A definir") ? el("p", { class: "fp-neutro", text: `${novos.filter((i) => i.categoria === "A definir").length} sem categoria: entram como "A definir".` }) : null,
      r.erros.length ? el("p", { class: "fp-form-erro", text: `${r.erros.length} não ${r.erros.length === 1 ? "vai" : "vão"} entrar: ${r.erros.slice(0, 2).join(" ")}` }) : null
    ];
    previa.replaceChildren(...linhas.filter(Boolean));
    botao.disabled = novos.length === 0;
  }

  area.addEventListener("input", atualizar);
  arquivo.addEventListener("change", async () => {
    const f = arquivo.files[0];
    if (!f) return;
    if (f.size > 2_000_000) { toast("Arquivo grande demais (máx. 2 MB)."); return; }
    area.value = await f.text();
    atualizar();
  });

  const form = el("form", { class: "fp-form", on: {
    submit: (e) => {
      e.preventDefault();
      const r = responder(area.value);
      previa.replaceChildren(el("p", { class: "fp-import-resultado", text: r.texto }));
      area.hidden = true;
      form.querySelector("[data-acoes-import]").replaceChildren(...[
        el("span"),
        dentroDeLancamentos() ? null : el("a", { class: "fp-btn", href: "lancamentos.html", text: "Ver lançamentos" }),
        el("button", { type: "button", class: "fp-btn fp-btn--primario", text: "Fechar", on: { click: fechar } })
      ].filter(Boolean));
    }
  } },
  el("h3", { text: "Importar extrato" }),
  el("p", { class: "fp-sub", style: { margin: 0 }, text: "Cole o extrato do banco (data, nome, tipo, categoria e valor) ou escolha o arquivo. Nada é lançado antes de você tocar em Importar." }),
  area,
  el("div", { class: "fp-filtros" },
    el("button", { type: "button", class: "fp-btn", text: "Escolher arquivo (.txt ou .csv)", on: { click: () => arquivo.click() } }),
    arquivo),
  previa,
  el("div", { class: "fp-form-acoes", "data-acoes-import": "" },
    el("span"),
    el("button", { type: "button", class: "fp-btn", text: "Cancelar", on: { click: fechar } }),
    botao));

  dlg.appendChild(form);
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.showModal();
  area.focus();
}

function dentroDeLancamentos() {
  return document.body.dataset.page === "lancamentos";
}

/* Botão "Importar extrato" pronto para qualquer tela. */
export function botaoImportar(classe = "fp-btn") {
  return el("button", { type: "button", class: classe, on: { click: abrirImportar } }, "⇩ Importar extrato");
}
