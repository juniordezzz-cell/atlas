/* ============================================================
   investimentos.js — o que saiu do caixa para investir
   ------------------------------------------------------------
   "Mandei 100 pra Binance" tira do caixa e soma aqui; "tirei 200 da
   Binance" faz o caminho inverso. O que acontece dentro da corretora
   é acompanhado no dashboard do Atlas, não aqui (decisão do dono,
   23/10/2026).
   ============================================================ */
import { lerEstado } from "../core/store.js";
import { investidoPorDestino, resumoMes, ordenar } from "../core/livro.js";
import { todayKey, diaCurto, nomeMes } from "../core/datas.js";
import { el, R, linhaLancamento, abrirEditor, ligarOraculoGlobal, dentroDoAtlas, LINK_CARTEIRAS } from "../ui/comum.js";

const raiz = document.getElementById("investimentos");
ligarOraculoGlobal();

function render() {
  const lancs = lerEstado().lancamentos;
  const hoje = todayKey();
  const mes = hoje.slice(0, 7);
  const inv = investidoPorDestino(lancs);
  const r = resumoMes(lancs, mes);
  const destinos = Object.entries(inv.destinos).filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
  const maior = Math.max(1, ...destinos.map(([, v]) => Math.abs(v)));
  const historico = ordenar(lancs).filter((l) => l.tipo === "investimento" || l.tipo === "resgate").reverse();

  raiz.replaceChildren(
    el("section", { class: "fp-tres" },
      el("article", { class: "fp-card fp-big fp-big--caixa" },
        el("p", { class: "fp-big-rotulo", text: "Investido no total" }),
        el("p", { class: "fp-big-valor fp-inv", text: R(inv.total) }),
        el("p", { class: "fp-big-nota", text: "Tudo que foi mandado para investir, menos o que voltou." })),
      el("article", { class: "fp-card fp-big" },
        el("p", { class: "fp-big-rotulo", text: `Em ${nomeMes(mes).split(" ")[0].toLowerCase()}` }),
        el("p", { class: "fp-big-valor", text: R(r.investido - r.resgatado) }),
        el("p", { class: "fp-big-nota", text: `${R(r.investido)} mandados · ${R(r.resgatado)} de volta` })),
      el("article", { class: "fp-card fp-big" },
        el("p", { class: "fp-big-rotulo", text: "Como registrar" }),
        el("p", { class: "fp-big-nota", style: { fontSize: ".9rem", lineHeight: "1.55", color: "var(--texto-suave)" }, text: "Diga ao Oráculo \"mandei 100 pra Binance\" ou \"tirei 200 da Binance\". Não conta como despesa: o dinheiro continua seu, só mudou de lugar." }),
        el("p", { style: { margin: "12px 0 0" } }, el("button", { type: "button", class: "fp-btn", text: "+ Manual", on: { click: () => abrirEditor(null, { tipo: "investimento" }) } })))),
    el("section", { class: "fp-tresb" },
      el("article", { class: "fp-card" },
        el("h2", { text: "Onde está" }),
        el("p", { class: "fp-sub", text: "Por corretora, banco ou destino" }),
        destinos.length
          ? el("div", { class: "fp-dest" }, destinos.map(([d, v]) => el("div", { class: "fp-dest-linha" },
            el("span", { text: d }), el("b", { class: "fp-num", text: R(v) }),
            el("div", { class: "fp-barra" }, el("i", { style: { width: `${(Math.abs(v) / maior) * 100}%`, background: "var(--fp-roxo)" } })))))
          : el("p", { class: "fp-vazio", text: "Nada investido ainda." }),
        dentroDoAtlas ? el("p", { style: { margin: "16px 0 0" } }, el("a", { class: "fp-link", href: LINK_CARTEIRAS, text: "Ver carteiras no Atlas →" })) : null),
      el("article", { class: "fp-card" },
        el("h2", { text: "Histórico" }),
        el("p", { class: "fp-sub", text: "Lápis corrige, X apaga." }),
        historico.length
          ? el("div", { class: "fp-lista" }, historico.map((l) => linhaLancamento(l, diaCurto(l.data, hoje))))
          : el("p", { class: "fp-vazio", text: "Sem movimentações de investimento." }))));
}

window.addEventListener("financas:mudou", render);
window.addEventListener("storage", render);
render();
