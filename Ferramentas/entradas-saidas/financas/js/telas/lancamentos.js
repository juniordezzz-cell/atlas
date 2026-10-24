/* ============================================================
   lancamentos.js — tudo que foi lançado, mês a mês
   ------------------------------------------------------------
   Substitui Entradas, Despesas, Relatórios e Análises (23/10/2026).
   Lista por dia, filtro por tipo, busca, corrigir/apagar (toque na
   linha), lançamento manual e exportar CSV do que está na tela.
   ============================================================ */
import { lerEstado } from "../core/store.js";
import { resumoMes, mesesComDados, ordenar } from "../core/livro.js";
import { todayKey, nomeMes, somarMeses, diaCurto } from "../core/datas.js";
import { normalizar } from "../core/categorias.js";
import { el, R, linhaLancamento, abrirEditor, ligarOraculoGlobal, NOME_TIPO } from "../ui/comum.js";

const raiz = document.getElementById("lancamentos");
ligarOraculoGlobal();

const atual = () => todayKey().slice(0, 7);
let mes = new URLSearchParams(location.search).get("mes");
if (!/^\d{4}-\d{2}$/.test(mes || "") || mes > atual()) mes = atual();
let filtro = "tudo";
let busca = "";

const FILTROS = [["tudo", "Tudo"], ["entrada", "Ganhos"], ["saida", "Despesas"], ["investimento", "Investimentos"], ["saldo", "Acertos"]];

function passa(l) {
  if (filtro === "investimento" && l.tipo !== "investimento" && l.tipo !== "resgate") return false;
  if (filtro !== "tudo" && filtro !== "investimento" && l.tipo !== filtro) return false;
  if (busca) {
    const alvo = normalizar(`${l.descricao} ${l.categoria || ""} ${l.destino || ""}`);
    if (!alvo.includes(normalizar(busca))) return false;
  }
  return true;
}

function doMes(lancs) {
  return ordenar(lancs).filter((l) => l.data.slice(0, 7) === mes && passa(l)).reverse();
}

function csv(lista) {
  const cel = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const sinal = { entrada: 1, saida: -1, investimento: -1, resgate: 1, saldo: 1 };
  const valor = (l) => {
    const c = l.centavos * sinal[l.tipo];
    const abs = Math.abs(c);
    return `${c < 0 ? "-" : ""}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
  };
  const linhas = [["Data", "Tipo", "Descrição", "Categoria", "Destino", "Valor (R$)"]]
    .concat(lista.map((l) => [l.data, NOME_TIPO[l.tipo], l.descricao, l.categoria || "", l.destino || "", valor(l)]));
  const blob = new Blob(["﻿" + linhas.map((r) => r.map(cel).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `financas-${mes}.csv` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function render() {
  const lancs = lerEstado().lancamentos;
  const meses = mesesComDados(lancs);
  const primeiro = meses.length ? meses[meses.length - 1] : atual();
  const r = resumoMes(lancs, mes);
  const lista = doMes(lancs);
  const hoje = todayKey();

  const ir = (n) => { mes = somarMeses(mes, n); render(); };
  const cabeca = el("div", { class: "fp-cabeca" },
    el("div", { class: "fp-mes" },
      el("button", { type: "button", "aria-label": "Mês anterior", text: "‹", disabled: mes <= primeiro, on: { click: () => ir(-1) } }),
      el("strong", { text: nomeMes(mes) }),
      el("button", { type: "button", "aria-label": "Próximo mês", text: "›", disabled: mes >= atual(), on: { click: () => ir(1) } })),
    el("div", { class: "fp-filtros" },
      el("button", { type: "button", class: "fp-btn", text: "Exportar CSV", disabled: !lista.length, on: { click: () => csv(lista) } }),
      el("button", { type: "button", class: "fp-btn fp-btn--primario", text: "+ Manual", on: { click: () => abrirEditor(null) } })));

  const resumo = el("div", { class: "fp-card fp-resumo-linha" },
    el("span", {}, "Ganhos ", el("b", { class: "fp-pos", text: R(r.entrou) })),
    el("span", {}, "Despesas ", el("b", { class: "fp-neg", text: R(r.saiu) })),
    el("span", {}, "Investido ", el("b", { class: "fp-inv", text: R(r.investido - r.resgatado) })),
    el("span", {}, "Saldo do mês ", el("b", { class: r.entrou - r.saiu < 0 ? "fp-neg" : "", text: R(r.entrou - r.saiu) })));

  const campoBusca = el("input", {
    class: "fp-busca", type: "search", placeholder: "Buscar (uber, mercado…)", value: busca, "aria-label": "Buscar lançamento",
    on: { input: (e) => { busca = e.target.value; desenharLista(); } }
  });
  const filtros = el("div", { class: "fp-filtros", role: "group", "aria-label": "Filtrar por tipo" },
    FILTROS.map(([k, rot]) => el("button", {
      type: "button", class: `fp-filtro${filtro === k ? " is-on" : ""}`, text: rot, "aria-pressed": String(filtro === k),
      on: { click: () => { filtro = k; render(); } }
    })), campoBusca);

  const card = el("article", { class: "fp-card" });
  function desenharLista() {
    const itens = doMes(lerEstado().lancamentos);
    if (!itens.length) {
      card.replaceChildren(el("p", { class: "fp-vazio", text: busca || filtro !== "tudo" ? "Nada encontrado com esse filtro." : "Nenhum lançamento neste mês. Fale com o Oráculo para lançar." }));
      return;
    }
    const dias = [];
    for (const l of itens) {
      if (!dias.length || dias[dias.length - 1].data !== l.data) dias.push({ data: l.data, itens: [] });
      dias[dias.length - 1].itens.push(l);
    }
    card.replaceChildren(...dias.map((d) => {
      const ent = d.itens.filter((l) => l.tipo === "entrada").reduce((a, l) => a + l.centavos, 0);
      const sai = d.itens.filter((l) => l.tipo === "saida").reduce((a, l) => a + l.centavos, 0);
      const tot = [ent ? `+${R(ent)}` : null, sai ? `−${R(sai)}` : null].filter(Boolean).join(" · ");
      return el("section", { class: "fp-dia" },
        el("div", { class: "fp-dia-topo" }, el("span", { text: diaCurto(d.data, hoje) }), el("span", { text: tot })),
        el("div", { class: "fp-lista" }, d.itens.map((l) => linhaLancamento(l, null))));
    }));
  }
  desenharLista();
  raiz.replaceChildren(cabeca, resumo, filtros, card);
}

window.addEventListener("financas:mudou", render);
window.addEventListener("storage", render);
render();
