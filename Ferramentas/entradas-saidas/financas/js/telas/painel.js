/* ============================================================
   painel.js — tela inicial do Finanças (23/10/2026)
   ------------------------------------------------------------
   Três números grandes (caixa, ganhos, despesas), gráfico do mês dia a
   dia, para onde foi o dinheiro, investido, metas e últimos
   lançamentos. Embaixo, a barra do Oráculo: lança daqui mesmo.
   Todo número sai de js/core/livro.js (centavos inteiros).
   ============================================================ */
import { lerEstado } from "../core/store.js";
import { caixaAte, resumoMes, serieDiaria, investidoPorDestino, mesesComDados, diasNoMes, ordenar } from "../core/livro.js";
import { todayKey, nomeMes, somarMeses, diaCurto } from "../core/datas.js";
import {
  el, R, montarChat, ligarOraculoGlobal, linhaLancamento, dentroDoAtlas, LINK_CARTEIRAS, AVATAR
} from "../ui/comum.js";

const raiz = document.getElementById("painel");
const conteudo = raiz.querySelector("[data-conteudo]");
const barra = raiz.querySelector("[data-barra]");
const chat = montarChat(barra, { compacto: true });
ligarOraculoGlobal();

const hoje = () => todayKey();
let mes = new URLSearchParams(location.search).get("mes");
if (!/^\d{4}-\d{2}$/.test(mes || "") || mes > hoje().slice(0, 7)) mes = hoje().slice(0, 7);

const CORES = ["#00BFFF", "#FFC94D", "#9B8CFF", "#00E28A", "#FF5470", "#7FA7C9"];
const reaisCurto = (c) => "R$ " + Math.round(c / 100).toLocaleString("pt-BR");

function icone(path, cor) {
  return el("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
    el("circle", { cx: "12", cy: "12", r: "9", fill: cor, opacity: ".3" }),
    el("path", { d: path, stroke: cor, "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" }));
}

/* ---------------- cabeçalho com o mês ---------------- */

function cabecalho(lancs) {
  const atual = hoje().slice(0, 7);
  const meses = mesesComDados(lancs);
  const primeiro = meses.length ? meses[meses.length - 1] : atual;
  const ir = (n) => {
    mes = somarMeses(mes, n);
    const u = new URL(location.href);
    if (mes === atual) u.searchParams.delete("mes"); else u.searchParams.set("mes", mes);
    history.replaceState(null, "", u);
    render();
  };
  return el("div", { class: "fp-cabeca" },
    el("h1", { text: mes === atual ? "Este mês" : nomeMes(mes) }),
    el("div", { class: "fp-mes" },
      el("button", { type: "button", "aria-label": "Mês anterior", text: "‹", disabled: mes <= primeiro, on: { click: () => ir(-1) } }),
      el("strong", { text: nomeMes(mes) }),
      el("button", { type: "button", "aria-label": "Próximo mês", text: "›", disabled: mes >= atual, on: { click: () => ir(1) } })));
}

/* ---------------- três números ---------------- */

function tres(lancs, estado) {
  const atual = hoje().slice(0, 7);
  const r = resumoMes(lancs, mes);
  const fimDoMes = `${mes}-${String(diasNoMes(mes)).padStart(2, "0")}`;
  const caixa = mes === atual ? caixaAte(lancs) : caixaAte(lancs, fimDoMes);

  let notaCaixa = "Caixa no último dia do mês";
  if (mes === atual) {
    const dias = diasNoMes(mes) - Number(hoje().slice(8, 10)) + 1;
    const meta = estado.metas.mensal;
    if (caixa < 0) notaCaixa = "O caixa está negativo";
    else if (meta) {
      const resta = meta - r.saiu;
      notaCaixa = resta <= 0
        ? `Meta do mês estourada em ${R(-resta)}`
        : `Dentro da meta: até ${R(Math.floor(Math.min(resta, caixa) / dias))} por dia até o dia ${diasNoMes(mes)}`;
    } else notaCaixa = `Para durar até o dia ${diasNoMes(mes)}: ${R(Math.floor(caixa / dias))} por dia`;
  }
  const base = Math.max(r.entrou, r.saiu) || 1;
  const pct = r.entrou > 0 ? Math.round((r.saiu / r.entrou) * 100) : null;

  return el("section", { class: "fp-tres", "aria-label": "Resumo do mês" },
    el("article", { class: "fp-card fp-big fp-big--caixa" },
      el("div", { class: "fp-big-ic" },
        el("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
          el("rect", { x: "3", y: "6", width: "18", height: "13", rx: "3", fill: "#00BFFF", opacity: ".35" }),
          el("rect", { x: "3", y: "6", width: "18", height: "13", rx: "3", stroke: "#00BFFF", "stroke-width": "1.6" }),
          el("circle", { cx: "16.5", cy: "12.5", r: "1.6", fill: "#00F0FF" }))),
      el("p", { class: "fp-big-rotulo", text: mes === atual ? "Em caixa agora" : "Caixa no fim do mês" }),
      el("p", { class: `fp-big-valor${caixa < 0 ? " fp-neg" : ""}`, text: R(caixa) }),
      el("p", { class: "fp-big-nota", text: notaCaixa })),
    el("article", { class: "fp-card fp-big fp-big--entrou" },
      el("div", { class: "fp-big-ic" }, icone("M12 16V8m0 0l-3.5 3.5M12 8l3.5 3.5", "#00E28A")),
      el("p", { class: "fp-big-rotulo", text: "Ganhos do mês" }),
      el("p", { class: "fp-big-valor fp-pos", text: R(r.entrou) }),
      el("p", {
        class: "fp-big-nota",
        text: r.quantos.entradas
          ? `${r.quantos.entradas} ${r.quantos.entradas === 1 ? "ganho" : "ganhos"} · último no dia ${r.ultimaEntrada.slice(8, 10)}`
          : "Nenhum ganho lançado"
      }),
      el("div", { class: "fp-barra" }, el("i", { style: { width: `${(r.entrou / base) * 100}%`, background: "var(--verde)" } }))),
    el("article", { class: "fp-card fp-big fp-big--saiu" },
      el("div", { class: "fp-big-ic" }, icone("M12 8v8m0 0l-3.5-3.5M12 16l3.5-3.5", "#FF5470")),
      el("p", { class: "fp-big-rotulo", text: "Despesas do mês" }),
      el("p", { class: "fp-big-valor fp-neg", text: R(r.saiu) }),
      el("p", {
        class: "fp-big-nota",
        text: `${pct != null ? `${pct}% dos ganhos · ` : ""}${r.quantos.saidas} ${r.quantos.saidas === 1 ? "despesa" : "despesas"}` +
          (r.investido ? ` · investiu ${R(r.investido)} (fora daqui)` : "") +
          (r.transferido > 0 ? ` · ${R(r.transferido)} foram para outras contas suas (fora daqui)` : "")
      }),
      el("div", { class: "fp-barra" }, el("i", { style: { width: `${(r.saiu / base) * 100}%`, background: "var(--vermelho)" } }))));
}

/* ---------------- gráfico dia a dia ---------------- */

function grafico(lancs) {
  const serie = serieDiaria(lancs, mes);
  const atual = hoje().slice(0, 7);
  const ateDia = mes === atual ? Number(hoje().slice(8, 10)) : serie.length;
  const W = 640, topo = 12, base = 196, esq = 6, dir = 634;
  const n = serie.length, col = (dir - esq) / n;
  const maxBarra = Math.max(1, ...serie.map((d) => Math.max(d.entrou, d.saiu)));
  const alturaBarra = (base - topo) * 0.55;
  // antes do primeiro acerto de caixa ("tenho 800") o caixa real não é
  // conhecido: a linha só começa nele. Sem acerto nenhum, parte do zero.
  const acerto = ordenar(lancs).find((l) => l.tipo === "saldo");
  const inicio = acerto && acerto.data.slice(0, 7) === mes ? Number(acerto.data.slice(8, 10)) - 1
    : acerto && acerto.data.slice(0, 7) > mes ? ateDia : 0;
  const vistos = serie.slice(0, ateDia);
  const caixas = vistos.slice(inicio).map((d) => d.caixa);
  let min = Math.min(0, ...caixas), max = Math.max(0, ...caixas);
  if (max === min) max = min + 1;
  const yCaixa = (c) => base - ((c - min) / (max - min)) * (base - topo);
  const x = (i) => esq + col * i + col / 2;
  const bw = Math.max(2, Math.min(9, col * 0.32));

  const barras = el("g", {});
  serie.forEach((d, i) => {
    if (d.entrou) {
      const h = Math.max(2, (d.entrou / maxBarra) * alturaBarra);
      barras.appendChild(el("rect", { x: x(i) - bw - 0.5, y: base - h, width: bw, height: h, rx: "2", fill: "#00E28A", opacity: ".9" }));
    }
    if (d.saiu) {
      const h = Math.max(2, (d.saiu / maxBarra) * alturaBarra);
      barras.appendChild(el("rect", { x: x(i) + 0.5, y: base - h, width: bw, height: h, rx: "2", fill: "#FF5470", opacity: ".85" }));
    }
  });

  const pontos = vistos.map((d, i) => `${x(i).toFixed(1)} ${yCaixa(d.caixa).toFixed(1)}`).slice(inicio);
  const linha = pontos.length ? `M${pontos.join(" L")}` : "";
  const area = pontos.length ? `${linha} L${x(vistos.length - 1).toFixed(1)} ${base} L${x(inicio).toFixed(1)} ${base}Z` : "";
  const ultimoX = pontos.length ? x(vistos.length - 1) : 0;
  const ultimoY = pontos.length ? yCaixa(vistos[vistos.length - 1].caixa) : 0;

  const marcas = [1, 8, 15, 22, n].filter((d, i, a) => a.indexOf(d) === i);
  const dica = el("div", { class: "fp-dica", hidden: true });
  const alvo = el("g", {});
  serie.forEach((d, i) => {
    const r = el("rect", { x: esq + col * i, y: topo, width: col, height: base - topo + 20, fill: "transparent" });
    const mostrar = () => {
      const caixaTxt = i >= ateDia ? "Ainda não chegou" : i < inicio ? "Caixa: antes do primeiro acerto" : `Caixa: ${R(d.caixa)}`;
      dica.textContent = "";
      [`Dia ${d.dia}`, d.entrou ? `Ganhos: ${R(d.entrou)}` : null, d.saiu ? `Despesas: ${R(d.saiu)}` : null,
        d.investiu ? `Investiu: ${R(d.investiu)}` : null, caixaTxt].filter(Boolean)
        .forEach((t, k) => { if (k) dica.appendChild(el("br")); dica.appendChild(document.createTextNode(t)); });
      dica.style.left = `${(x(i) / W) * 100}%`;
      dica.style.top = `${(Math.min(i < inicio ? base : yCaixa(d.caixa), base - 40) / 230) * 100}%`;
      dica.hidden = false;
    };
    r.addEventListener("mouseenter", mostrar);
    r.addEventListener("click", mostrar);
    alvo.appendChild(r);
  });

  const svg = el("svg", { viewBox: `0 0 ${W} 230`, role: "img", "aria-label": "Ganhos, despesas e caixa por dia do mês", on: { mouseleave: () => { dica.hidden = true; } } },
    el("defs", {}, el("linearGradient", { id: "fpArea", x1: "0", x2: "0", y1: "0", y2: "1" },
      el("stop", { offset: "0", "stop-color": "#00BFFF", "stop-opacity": ".32" }),
      el("stop", { offset: "1", "stop-color": "#00BFFF", "stop-opacity": "0" }))),
    el("g", { stroke: "rgba(160,174,192,.08)" },
      [0.25, 0.5, 0.75].map((f) => el("line", { x1: "0", x2: String(W), y1: String(topo + (base - topo) * f), y2: String(topo + (base - topo) * f) }))),
    min < 0 ? el("line", { x1: "0", x2: String(W), y1: String(yCaixa(0)), y2: String(yCaixa(0)), stroke: "rgba(255,84,112,.45)", "stroke-dasharray": "4 5" }) : null,
    barras,
    area ? el("path", { d: area, fill: "url(#fpArea)" }) : null,
    linha ? el("path", { d: linha, fill: "none", stroke: "#00BFFF", "stroke-width": "2.4", "stroke-linejoin": "round", "stroke-linecap": "round" }) : null,
    pontos.length ? el("circle", { cx: ultimoX, cy: ultimoY, r: "11", fill: "#00F0FF", opacity: ".18" }) : null,
    pontos.length ? el("circle", { cx: ultimoX, cy: ultimoY, r: "4.5", fill: "#00F0FF" }) : null,
    ateDia < n ? el("line", { x1: String(x(ateDia - 1) + col / 2), x2: String(dir), y1: String(base), y2: String(base), stroke: "rgba(160,174,192,.18)", "stroke-dasharray": "4 5" }) : null,
    el("g", { fill: "rgba(230,241,255,.4)", "font-size": "11", "text-anchor": "middle" },
      marcas.map((d) => el("text", { x: x(d - 1), y: "220", text: String(d) })),
      mes === atual && !marcas.includes(ateDia) ? el("text", { x: x(ateDia - 1), y: "220", fill: "#00F0FF", text: "hoje" }) : null),
    alvo);

  return el("article", { class: "fp-card" },
    el("h2", { text: "Ganhos e despesas, dia a dia" }),
    el("p", { class: "fp-sub", text: "Barras: ganhos e despesas do dia · linha: o caixa. Toque num dia para ver." }),
    el("div", { class: "fp-leg" },
      el("span", {}, el("i", { style: { background: "var(--verde)" } }), "Ganhos"),
      el("span", {}, el("i", { style: { background: "var(--vermelho)" } }), "Despesas"),
      el("span", {}, el("i", { style: { background: "var(--atlas-accent)" } }), "Caixa")),
    el("div", { class: "fp-grafico" }, svg, dica));
}

/* ---------------- para onde foi ---------------- */

function categorias(lancs) {
  const r = resumoMes(lancs, mes);
  const lista = Object.entries(r.porCategoria).sort((a, b) => b[1] - a[1]);
  const top = lista.slice(0, 5);
  const resto = lista.slice(5).reduce((a, [, v]) => a + v, 0);
  if (resto) top.push(["Outras", resto]);
  const card = el("article", { class: "fp-card" },
    el("h2", { text: "Para onde foi o dinheiro" }),
    el("p", { class: "fp-sub", text: `${nomeMes(mes)} · por categoria` }));
  if (!r.saiu) {
    card.appendChild(el("p", { class: "fp-vazio", text: "Nenhuma despesa lançada neste mês." }));
    return card;
  }
  let acum = 0;
  const arcos = top.map(([, v], i) => {
    const p = (v / r.saiu) * 100;
    const c = el("circle", {
      cx: "21", cy: "21", r: "15.915", fill: "none", stroke: CORES[i % CORES.length], "stroke-width": "5",
      "stroke-dasharray": `${p.toFixed(3)} ${(100 - p).toFixed(3)}`, "stroke-dashoffset": String(25 - acum)
    });
    acum += p;
    return c;
  });
  card.appendChild(el("div", { class: "fp-anel" },
    el("svg", { viewBox: "0 0 42 42", role: "img", "aria-label": "Despesas por categoria" },
      el("circle", { cx: "21", cy: "21", r: "15.915", fill: "none", stroke: "rgba(255,255,255,.06)", "stroke-width": "5" }),
      arcos,
      el("text", { x: "21", y: "21", "text-anchor": "middle", fill: "currentColor", "font-size": "4.4", "font-weight": "700", text: reaisCurto(r.saiu) }),
      el("text", { x: "21", y: "26", "text-anchor": "middle", fill: "rgba(230,241,255,.45)", "font-size": "2.6", text: "despesas" })),
    el("ul", { class: "fp-cats" }, top.map(([nome, v], i) => el("li", {},
      el("i", { style: { background: CORES[i % CORES.length] } }),
      el("span", { text: nome }),
      el("b", { text: R(v) }),
      el("em", { text: `${Math.round((v / r.saiu) * 100)}%` }))))));
  return card;
}

/* ---------------- investido, metas, últimos ---------------- */

function investido(lancs) {
  const r = resumoMes(lancs, mes);
  const inv = investidoPorDestino(lancs);
  const liquido = r.investido - r.resgatado;
  const destinos = Object.entries(inv.destinos).filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
  return el("article", { class: "fp-card" },
    el("h2", { text: "Investido" }),
    el("p", { class: "fp-sub", text: "Dinheiro que saiu do caixa para investir. Não conta como despesa." }),
    el("p", { class: "fp-inv-valor" }, R(liquido), " ", el("small", { class: "fp-neutro", style: { fontSize: ".8rem", fontWeight: "500" }, text: "neste mês" })),
    el("p", { class: "fp-big-nota", text: `${R(inv.total)} no total` }),
    destinos.length ? el("div", { class: "fp-chips" }, destinos.map(([d, v]) => el("span", { class: "fp-chip", text: `${d} · ${R(v)}` }))) : el("div", { class: "fp-chips" }),
    dentroDoAtlas ? el("a", { class: "fp-link", href: LINK_CARTEIRAS, text: "Ver carteiras no Atlas →" }) : null);
}

function barraMeta(rotulo, gasto, meta) {
  const p = meta ? gasto / meta : 0;
  const cor = p >= 1 ? "var(--vermelho)" : p >= 0.8 ? "var(--fp-dourado)" : "var(--verde)";
  return el("div", { class: "fp-meta" },
    el("div", { class: "fp-meta-topo" }, el("span", { text: rotulo }), el("b", { text: `${R(gasto)} de ${R(meta)}` })),
    el("div", { class: "fp-barra" }, el("i", { style: { width: `${Math.min(100, p * 100)}%`, background: cor } })));
}

function metas(lancs, estado) {
  const m = estado.metas;
  const cats = Object.entries(m.categorias || {});
  if (!m.mensal && !cats.length) return null;
  const r = resumoMes(lancs, mes);
  return el("article", { class: "fp-card" },
    el("h2", { text: "Metas de despesas" }),
    el("p", { class: "fp-sub", text: "Do Planejar. Não lançam nada no caixa." }),
    m.mensal ? barraMeta("Despesas do mês", r.saiu, m.mensal) : null,
    cats.slice(0, 5).map(([c, v]) => barraMeta(c, r.porCategoria[c] || 0, v)),
    el("p", { style: { margin: "14px 0 0" } }, el("a", { class: "fp-link", href: "planejar.html", text: "Editar metas" })));
}

function ultimos(lancs) {
  const lista = [...lancs].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : b.criadoEm - a.criadoEm)).slice(0, 7);
  return el("article", { class: "fp-card" },
    el("h2", { text: "Últimos lançamentos" }),
    el("p", { class: "fp-sub", text: "Toque num lançamento para corrigir ou apagar." }),
    el("div", { class: "fp-lista" }, lista.map((l) => linhaLancamento(l, diaCurto(l.data, hoje())))),
    el("p", { style: { margin: "12px 0 0" } }, el("a", { class: "fp-link", href: "lancamentos.html", text: "Ver todos" })));
}

function boasVindas() {
  const exemplo = (t) => el("button", {
    type: "button", class: "fp-sug", text: t,
    on: { click: () => { const i = barra.querySelector("input"); i.value = t; i.focus(); } }
  });
  return el("article", { class: "fp-card fp-boas" },
    el("img", { src: AVATAR, alt: "" }),
    el("h2", { text: "Seu Finanças começa com uma frase" }),
    el("p", { text: "Diga ao Oráculo, lá embaixo, quanto você tem em caixa agora. Depois é só ir falando seus ganhos e despesas: ele anota, separa por categoria e faz as contas do mês." }),
    el("div", { class: "fp-sugs", style: { justifyContent: "center" } },
      exemplo("tenho 800 em caixa"), exemplo("recebi 500"), exemplo("uber 9,80"), exemplo("mandei 100 pra Binance")));
}

/* ---------------- montagem ---------------- */

function render() {
  const estado = lerEstado();
  const lancs = estado.lancamentos;
  if (!lancs.length) {
    conteudo.replaceChildren(boasVindas());
    return;
  }
  const meta = metas(lancs, estado);
  conteudo.replaceChildren(
    cabecalho(lancs),
    tres(lancs, estado),
    el("section", { class: "fp-dois" }, grafico(lancs), categorias(lancs)),
    el("section", { class: "fp-tresb" },
      el("div", { class: "fp-coluna" }, investido(lancs), meta),
      ultimos(lancs)));
}

window.addEventListener("financas:mudou", render);
window.addEventListener("storage", render);
render();
void chat;
