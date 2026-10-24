/* ============================================================
   oraculo.js — aba Oráculo do Finanças
   ------------------------------------------------------------
   A conversa inteira, com o personagem grande flutuando enquanto
   está vazia (como a aba do Scanner Pools). Os exemplos só
   preenchem o campo: nada é lançado sem o dono mandar.
   ============================================================ */
import { el, montarChat, ligarOraculoGlobal } from "../ui/comum.js";

const raiz = document.getElementById("oraculo");
const campo = raiz.querySelector("[data-chat-form] input");
const chat = montarChat(raiz, { aoResponder: () => raiz.classList.add("tem-conversa") });
ligarOraculoGlobal();

const preencher = (t) => el("button", { type: "button", class: "fp-sug", text: t, on: { click: () => { campo.value = t; campo.focus(); } } });
const perguntar = (t) => el("button", {
  type: "button", class: "fp-sug fp-sug--fraco", text: t,
  on: { click: () => { raiz.classList.add("tem-conversa"); chat.enviar(t); } }
});

raiz.querySelector("[data-exemplos]").replaceChildren(
  preencher("recebi 500"), preencher("uber 9,80"), preencher("45 no mercadinho"),
  preencher("mandei 100 pra Binance"), perguntar("Quanto tenho?"), perguntar("Quanto gastei este mês?"));

campo.focus({ preventScroll: true });
