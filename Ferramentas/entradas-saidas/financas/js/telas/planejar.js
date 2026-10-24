/* ============================================================
   planejar.js — metas de gasto (aba secundária desde 23/10/2026)
   ------------------------------------------------------------
   Antes o Planejar espalhava salário e contas pelo ano inteiro. Agora
   só conta o que foi lançado; aqui o dono marca limites ("no máximo
   800 por mês", "no máximo 200 em mercadinho") e o Painel mostra
   quanto já usou. Nada daqui entra no caixa.
   ============================================================ */
import { lerEstado, salvarEstado } from "../core/store.js";
import { resumoMes } from "../core/livro.js";
import { paraCentavos } from "../core/dinheiro.js";
import { todayKey, nomeMes } from "../core/datas.js";
import { todasCategorias } from "../core/categorias.js";
import { el, R, ligarOraculoGlobal, avisarMudanca, toast } from "../ui/comum.js";

const raiz = document.getElementById("planejar");
ligarOraculoGlobal();

function barra(gasto, meta) {
  const p = meta ? gasto / meta : 0;
  const cor = p >= 1 ? "var(--vermelho)" : p >= 0.8 ? "var(--fp-dourado)" : "var(--verde)";
  return el("div", { class: "fp-barra" }, el("i", { style: { width: `${Math.min(100, p * 100)}%`, background: cor } }));
}

function salvar(muda) {
  const s = lerEstado();
  muda(s.metas);
  s.metasEm = Date.now(); // a meta editada por último vence na sincronia
  salvarEstado(s);
  avisarMudanca();
}

function render() {
  const estado = lerEstado();
  const mes = todayKey().slice(0, 7);
  const r = resumoMes(estado.lancamentos, mes);
  const m = estado.metas;

  const valorMensal = el("input", { name: "valor", inputmode: "decimal", autocomplete: "off", placeholder: "800,00", value: m.mensal ? R(m.mensal).replace(/^R\$\s*/, "") : "" });
  const formMensal = el("form", {
    class: "fp-meta-form", on: {
      submit: (e) => {
        e.preventDefault();
        const c = paraCentavos(valorMensal.value);
        if (c == null) return toast("Valor inválido. Ex.: 800 ou 1.200,50");
        salvar((x) => { x.mensal = c; });
        toast("Meta do mês salva.");
      }
    }
  },
  el("label", { class: "fp-campo" }, el("span", { text: "Gastar no máximo, por mês (R$)" }), valorMensal),
  el("button", { type: "submit", class: "fp-btn fp-btn--primario", text: "Salvar" }),
  m.mensal ? el("button", { type: "button", class: "fp-btn", text: "Tirar meta", on: { click: () => { salvar((x) => { x.mensal = null; }); toast("Meta removida."); } } }) : null);

  const usadas = estado.lancamentos.map((l) => l.categoria).filter(Boolean);
  const cat = el("input", { name: "cat", list: "fpCatsMeta", maxlength: "40", autocomplete: "off", placeholder: "Mercadinho, bar e padaria" });
  const valorCat = el("input", { name: "valor", inputmode: "decimal", autocomplete: "off", placeholder: "200,00" });
  const formCat = el("form", {
    class: "fp-meta-form", on: {
      submit: (e) => {
        e.preventDefault();
        const nome = cat.value.trim();
        const c = paraCentavos(valorCat.value);
        if (!nome) return toast("Escolha a categoria.");
        if (c == null) return toast("Valor inválido. Ex.: 200 ou 150,50");
        salvar((x) => { x.categorias[nome] = c; });
        toast("Meta salva.");
      }
    }
  },
  el("label", { class: "fp-campo" }, el("span", { text: "Categoria" }), cat),
  el("datalist", { id: "fpCatsMeta" }, todasCategorias(usadas).map((c) => el("option", { value: c }))),
  el("label", { class: "fp-campo" }, el("span", { text: "No máximo (R$)" }), valorCat),
  el("button", { type: "submit", class: "fp-btn fp-btn--primario", text: "Adicionar" }));

  const cats = Object.entries(m.categorias);
  raiz.replaceChildren(
    el("div", { class: "fp-cabeca" }, el("h1", { text: "Metas de despesas" }), el("span", { class: "fp-sub", style: { margin: 0 }, text: `${nomeMes(mes)} · só o que foi lançado conta` })),
    el("article", { class: "fp-card" },
      el("h2", { text: "Meta do mês" }),
      el("p", { class: "fp-sub", text: "Um limite para as despesas do mês (investimento não conta)." }),
      m.mensal ? el("div", { class: "fp-metas", style: { marginBottom: "16px" } },
        el("div", { class: "fp-meta-topo" }, el("span", { text: `Gastos até agora` }), el("b", { text: `${R(r.consumo)} de ${R(m.mensal)}` })),
        barra(r.consumo, m.mensal),
        el("p", { class: "fp-big-nota", text: r.consumo > m.mensal ? `Passou ${R(r.consumo - m.mensal)} da meta.` : `Ainda cabem ${R(m.mensal - r.consumo)} neste mês.` })) : null,
      formMensal),
    el("article", { class: "fp-card" },
      el("h2", { text: "Metas por categoria" }),
      el("p", { class: "fp-sub", text: "Ex.: no máximo 200 em mercadinho, bar e padaria." }),
      cats.length ? el("div", { class: "fp-metas", style: { marginBottom: "18px" } }, cats.map(([nome, v]) => {
        const g = r.porCategoria[nome] || 0;
        return el("div", {},
          el("div", { class: "fp-meta-topo" }, el("span", { text: nome }),
            el("b", {}, `${R(g)} de ${R(v)} `,
              el("button", { type: "button", class: "fp-sug fp-sug--fraco", style: { padding: "2px 9px", marginLeft: "6px" }, "aria-label": `Tirar meta de ${nome}`, text: "×", on: { click: () => salvar((x) => { delete x.categorias[nome]; }) } }))),
          barra(g, v));
      })) : null,
      formCat));
}

window.addEventListener("financas:mudou", render);
window.addEventListener("storage", render);
render();
