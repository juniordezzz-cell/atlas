/* ATLAS · Ferramentas/_comum/busca-token.js
   Busca de token com sugestões, teclado e escape, igual em todas as
   calculadoras da bancada. Os dados vêm do roteador (core/atlas-dados.js):
   catálogo local primeiro, rede só se o token não estiver lá.

   AtlasBuscaToken.ligar({ input, lista, aoEscolher, aoErro })
     input      <input type="search"> com role="combobox"
     lista      <ul role="listbox" hidden> logo abaixo do input
     aoEscolher function({ id, sym, nome, img })
     aoErro     function(mensagem)   (opcional)
   AtlasBuscaToken.mercado(id, sym) -> Promise<{ id, sym, nome, img, preco, fonte, quando, salvo }>
     preço em US$ pela cadeia de preço do roteador (DefiLlama primeiro).

   Precisa de: core/http.js, core/dados/tokens-top.js, core/atlas-dados.js.
   Estilo: .busca-token__lista em ../_comum/ferramenta.css. */
(function () {
  'use strict';
  function seguro(u) { return /^https:\/\//.test(u || '') ? u : ''; }

  function ligar(o) {
    var inp = o.input, ul = o.lista, itens = [], foco = -1, espera = null;
    var erro = o.aoErro || function () {};
    function fechar() { ul.hidden = true; inp.setAttribute('aria-expanded', 'false'); foco = -1; }
    function desenhar() {
      ul.textContent = '';
      itens.forEach(function (c, i) {
        var li = document.createElement('li');
        li.setAttribute('role', 'option'); li.setAttribute('aria-selected', String(i === foco));
        var src = seguro(c.img);
        if (src) { var im = document.createElement('img'); im.src = src; im.alt = ''; li.appendChild(im); }
        var b = document.createElement('b'); b.textContent = c.sym; li.appendChild(b);
        var n = document.createElement('span'); n.textContent = c.nome; li.appendChild(n);
        if (c.rank) { var r = document.createElement('span'); r.className = 'rank'; r.textContent = '#' + c.rank; li.appendChild(r); }
        li.addEventListener('mousedown', function (ev) { ev.preventDefault(); escolher(i); });
        ul.appendChild(li);
      });
      ul.hidden = !itens.length; inp.setAttribute('aria-expanded', String(!!itens.length));
    }
    function escolher(i) {
      var c = itens[i]; if (!c) return;
      inp.value = c.sym; fechar();
      o.aoEscolher({ id: c.id, sym: c.sym, nome: c.nome, img: seguro(c.img) });
    }
    inp.addEventListener('input', function () {
      var q = inp.value.trim(); clearTimeout(espera);
      if (q.length < 2) { itens = []; desenhar(); return; }
      espera = setTimeout(function () {
        AtlasDados.buscar(q).then(function (l) {
          itens = l; foco = -1; desenhar();
          if (!l.length) erro('Nenhum token encontrado para "' + q + '". Confira a sigla ou digite o preço manualmente.');
        });
      }, 250);
    });
    inp.addEventListener('keydown', function (ev) {
      if (ul.hidden) return;
      if (ev.key === 'ArrowDown') { foco = Math.min(itens.length - 1, foco + 1); desenhar(); ev.preventDefault(); }
      else if (ev.key === 'ArrowUp') { foco = Math.max(0, foco - 1); desenhar(); ev.preventDefault(); }
      else if (ev.key === 'Enter') { escolher(foco < 0 ? 0 : foco); ev.preventDefault(); }
      else if (ev.key === 'Escape') fechar();
    });
    inp.addEventListener('blur', function () { setTimeout(fechar, 150); });
  }

  function mercado(id, sym) {
    var cat = AtlasDados.doCatalogo(id) || {};
    sym = sym || cat.sym || '';
    return AtlasDados.preco(id, sym).then(function (p) {
      if (!p) throw new Error('nenhuma fonte tem o preço deste token');
      return { id: id, sym: sym || cat.sym || id, nome: cat.nome || sym || id, img: seguro(cat.img), preco: p.usd, fonte: p.fonte, quando: p.quando, salvo: p.salvo };
    });
  }

  window.AtlasBuscaToken = { ligar: ligar, mercado: mercado };
})();
