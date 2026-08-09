/* ============================================================
   ATLAS · core/ui/atlas-flash.js
   O número que mudou avisa que mudou.

   POR QUE ISTO EXISTE
   -------------------
   themes/atlas-effects.css já trazia .atlas-flash-up e
   .atlas-flash-down desde o começo — e nada no sistema inteiro as
   usava. Eram duas animações órfãs.

   O problema que elas resolvem é real. O ATLAS repinta valores sem
   recarregar a página: troca-se a moeda e o patrimônio inteiro muda,
   registra-se um movimento e o KPI se refaz, a cotação chega e o
   total do topo anda. Se nada pisca, o usuário fica sem saber se a
   ação surtiu efeito — e a resposta mais comum a isso é clicar de
   novo. Num sistema financeiro, clicar de novo é registrar duas vezes.

   COMO FUNCIONA
   -------------
   Um observador único vigia todo elemento marcado com
   data-atlas-flash e compara o NÚMERO, não o texto — assim uma
   mudança só de formatação não acende nada.

   Trocar de MOEDA é o caso que a comparação numérica não resolve
   sozinha: US$ 1.000 vira R$ 5.100 sem um centavo ter se movido.
   Nesse momento o flash cala a boca por meio segundo. Mentira em
   número é o pior defeito que um sistema financeiro pode ter.

   Verde quando sobe, vermelho quando desce, nada quando é igual.

   COMO USAR
   ---------
     <div class="valor" data-atlas-flash>US$ 12.400</div>

   Marcar no HTML basta; não há registro a fazer no JavaScript. Para
   um elemento criado depois, o observador o adota sozinho.
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasFlash) return;

  var ATTR = "data-atlas-flash";
  var ANTERIOR = "__atlasFlashValor";
  var DUR = 520;                 // casa com --atlas-dur-slow

  /* MEMÓRIA POR CHAVE — e por que ela é necessária.

     Há duas maneiras de um valor mudar no ATLAS, e só uma delas
     preserva o elemento:

       a) o texto do MESMO nó é reescrito  (topbar do Hold, do RWA)
       b) o bloco inteiro é regerado com innerHTML  (KPIs do Dashboard)

     No caso (b) o nó antigo deixa de existir e leva junto qualquer
     valor guardado nele — o novo nasceria sem passado e nunca
     piscaria. Por isso o atributo aceita uma CHAVE:

         <div data-atlas-flash="patrimonio">US$ 12.400</div>

     Com chave, o valor anterior vive neste mapa e sobrevive à troca
     do elemento. Sem chave, fica no próprio nó — que basta para (a)
     e não gasta memória à toa. */
  var memoria = {};

  /* Extrai o número de "US$ 12.400,50", "-R$ 1.234", "+3,2%".
     O sinal do PREFIXO conta: "-US$ 90" é menos noventa. */
  function valorDe(texto) {
    var s = String(texto == null ? "" : texto).trim();
    if (!s) return null;
    var negativo = /^[-−]/.test(s) || /\(.*\)$/.test(s);
    /* Tira tudo que não é dígito ou separador, e assume o padrão
       pt-BR: ponto agrupa, vírgula decide os centavos. */
    var limpo = s.replace(/[^\d.,]/g, "");
    if (!limpo) return null;
    limpo = limpo.replace(/\./g, "").replace(",", ".");
    var n = parseFloat(limpo);
    if (!isFinite(n)) return null;
    return negativo ? -n : n;
  }

  /* JANELA MUDA — a exceção que a comparação por número não cobre.

     Comparar número em vez de texto evita piscar quando só o formato
     muda. Mas trocar de MOEDA muda o número exibido de verdade:
     US$ 1.000 vira R$ 5.100 sem um centavo ter entrado ou saído.
     Piscar verde aí seria mentira — e mentira em número é o pior
     defeito que um sistema financeiro pode ter.

     Então, quando a moeda (ou o formato numérico) muda, o flash cala a
     boca pelo tempo da repintura e reancora os valores. */
  var mudo = false;
  function calar(ms) {
    mudo = true;
    setTimeout(function () { mudo = false; }, ms || 400);
  }

  function piscar(el, subiu) {
    if (mudo) return;
    var classe = subiu ? "atlas-flash-up" : "atlas-flash-down";
    /* Remover e reforçar o reflow reinicia a animação. Sem isso, dois
       updates seguidos só animam o primeiro. */
    el.classList.remove("atlas-flash-up", "atlas-flash-down");
    void el.offsetWidth;
    el.classList.add(classe);
    setTimeout(function () { el.classList.remove(classe); }, DUR + 60);
  }

  function chaveDe(el) {
    var k = el.getAttribute(ATTR);
    return (k && k !== "true" && k !== "") ? k : null;
  }

  function anteriorDe(el) {
    var k = chaveDe(el);
    return k ? memoria[k] : el[ANTERIOR];
  }

  function guardar(el, v) {
    var k = chaveDe(el);
    if (k) memoria[k] = v; else el[ANTERIOR] = v;
  }

  function conferir(el) {
    var atual = valorDe(el.textContent);
    var antes = anteriorDe(el);
    guardar(el, atual);
    if (antes === undefined || antes === null || atual === null) return;  // primeira leitura
    if (atual === antes) return;                  // só a moeda mudou, não o valor
    piscar(el, atual > antes);
  }

  /* Registra o valor de partida de quem ainda não tem passado. Com
     chave, um elemento REGERADO cai aqui já tendo passado — e então
     não é adotado, é conferido, que é o que faz o KPI piscar. */
  function adotarUm(el) {
    var antes = anteriorDe(el);
    if (antes === undefined) { guardar(el, valorDe(el.textContent)); return; }
    if (chaveDe(el)) conferir(el);
  }

  function adotar(raiz) {
    var alvos = (raiz && raiz.querySelectorAll) ? raiz.querySelectorAll("[" + ATTR + "]") : [];
    Array.prototype.forEach.call(alvos, adotarUm);
    if (raiz && raiz.nodeType === 1 && raiz.hasAttribute && raiz.hasAttribute(ATTR)) adotarUm(raiz);
  }

  function elementoMarcado(no) {
    while (no && no.nodeType !== 1) no = no.parentNode;
    if (!no) return null;
    return no.closest ? no.closest("[" + ATTR + "]") : null;
  }

  function iniciar() {
    if (!document.body || !window.MutationObserver) return;
    adotar(document);

    var pendentes = [];
    var agendado = null;

    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        /* Elemento novo entrou na árvore: registra o valor de partida
           sem piscar. Piscar na primeira aparição seria ruído — não
           mudou nada, acabou de nascer. */
        if (m.type === "childList") {
          Array.prototype.forEach.call(m.addedNodes, function (n) {
            if (n.nodeType === 1) adotar(n);
          });
        }
        var alvo = elementoMarcado(m.target);
        if (alvo && pendentes.indexOf(alvo) < 0) pendentes.push(alvo);
      });
      if (!pendentes.length) return;
      /* Uma repintura mexe em vários nós do mesmo valor. Sem agrupar,
         o mesmo número piscaria três vezes. */
      clearTimeout(agendado);
      agendado = setTimeout(function () {
        var lote = pendentes.slice();
        pendentes.length = 0;
        lote.forEach(conferir);
      }, 40);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  window.AtlasFlash = {
    /* Para quem repinta por caminho que o observador não vê (canvas,
       shadow DOM) ou quer forçar a conferência. */
    check: conferir,
    parse: valorDe,
    adopt: adotar
  };

  if (window.AtlasSettings && AtlasSettings.on) {
    AtlasSettings.on(function (changed) {
      if (!changed || changed.indexOf("currency") >= 0 || changed.indexOf("numberFormat") >= 0) calar(600);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else { iniciar(); }
})();
