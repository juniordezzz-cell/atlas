/* ATLAS · core/ui/atlas-listas.js — listas do menu lateral (19/11/2026)
   Fonte única dos itens dentro dos grupos Academy e Ferramentas do trilho
   (core/ui/atlas-moldura.js). Antes elas moravam dentro da moldura e
   repetiam, à mão, os cards de pages/ferramentas.html e as abas de
   academy/index.html.

   Criou, renomeou ou tirou uma ferramenta?
     1. o card em pages/ferramentas.html (é arte feita à mão, com 3D);
     2. a linha aqui, na MESMA ordem dos cards.
   O teste avisa se os dois saírem de sincronia:
       node --test core/ui/atlas-listas.test.cjs

   href é relativo à raiz do site; icon é o miolo de um <svg> 24×24.
   No navegador: window.AtlasListas. No Node: require('./atlas-listas.js'). */
(function (raiz) {
  'use strict';
  var L = {};

  /* Academy: as abas da página (academy/js/academy-hub.js lê o #hash). */
  L.ACADEMY = [
    { slug: "cursos", nome: "Cursos", href: "academy/index.html#cursos",
      icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>' },
    { slug: "artigos", nome: "Artigos", href: "academy/index.html#artigos",
      icon: '<path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/>' },
    { slug: "papers", nome: "Papers", href: "academy/index.html#papers",
      icon: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7M8 11h7"/>' },
    { slug: "links", nome: "Links", href: "academy/index.html#links",
      icon: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>' }
  ];

  /* Ferramentas: grupo próprio no trilho (17/11/2026). O nome leva ao hub
     (todas as ferramentas); a setinha abre e fecha a lista. Trilho fechado
     no PC: um ícone só, que leva ao hub. Ordem = ordem dos cards em
     pages/ferramentas.html (o teste confere). */
  L.FERRAMENTAS = [
    { slug: "entradas-saidas", nome: "Finanças", href: "Ferramentas/entradas-saidas/financas/index.html",
      icon: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14.5h2"/>' },
    { slug: "conversor", nome: "Conversor e Câmbio", href: "Ferramentas/conversor/index.html",
      icon: '<path d="M4 8h14l-3-3"/><path d="M20 16H6l3 3"/>' },
    { slug: "escada-dca", nome: "DCA · Preço Médio", href: "Ferramentas/escada-dca/index.html",
      icon: '<path d="M4 20h4v-4h4v-4h4V8h4V4"/>' },
    { slug: "lucro-cripto", nome: "Lucro Cripto", href: "Ferramentas/lucro-cripto/index.html",
      icon: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>' },
    { slug: "simulador-de-trade", nome: "Simulador de Trade", href: "Ferramentas/simulador-de-trade/index.html",
      icon: '<path d="M8 3v18M16 3v18"/><rect x="6" y="7" width="4" height="8" rx="1"/><rect x="14" y="9" width="4" height="7" rx="1"/>' },
    { slug: "scanner-pools", nome: "Scanner de Pools", href: "Ferramentas/scanner-pools/index.html",
      icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m12 12 6-6"/>' },
    { slug: "simulador-de-pool", nome: "Simulador de Pools", href: "Ferramentas/simulador-de-pool/index.html",
      icon: '<path d="M3 17l5-5 4 3 8-8"/><path d="M3 21h18"/><path d="M3 7h18" stroke-dasharray="3 3"/>' },
    { slug: "estrategia-de-pool", nome: "Estratégias de Pools", href: "Ferramentas/estrategia-de-pool/index.html",
      icon: '<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>' },
    { slug: "staking", nome: "Staking", href: "Ferramentas/staking/index.html",
      icon: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>' },
    { slug: "juros-compostos", nome: "Juros Compostos", href: "Ferramentas/juros-compostos/index.html",
      icon: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>' },
    { slug: "calculadora-market-cap", nome: "Market Cap", href: "Ferramentas/calculadora-market-cap/index.html",
      icon: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/>' },
    { slug: "comparador-de-ativos", nome: "Comparador de Ativos", href: "Ferramentas/comparador-de-ativos/index.html",
      icon: '<path d="M12 4v16M5 8h14"/><path d="m5 8-3 6h6zM19 8l-3 6h6z"/>' },
    { slug: "medo-e-ganancia", nome: "Medo e Ganância", href: "Ferramentas/medo-e-ganancia/index.html",
      icon: '<path d="M4 16a8 8 0 0 1 16 0"/><path d="m12 16 4-5"/><circle cx="12" cy="16" r="1"/>' },
    { slug: "fundamentos", nome: "Fundamentos de Protocolo", href: "Ferramentas/fundamentos/index.html",
      icon: '<path d="M4 20V14M10 20V10M16 20V6M22 20H2"/><path d="m3 9 6-4 5 3 7-5"/>' }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = L;
  raiz.AtlasListas = L;
})(typeof globalThis !== 'undefined' ? globalThis : this);
