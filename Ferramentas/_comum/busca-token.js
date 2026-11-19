/* ATLAS · Ferramentas/_comum/busca-token.js
   Busca de token com sugestões, teclado e escape, igual em todas as
   calculadoras da bancada. Fontes em _comum/cotacao.js (19/11/2026):
   busca na CoinPaprika e, se falhar, na CoinGecko; preço na Coinbase,
   DefiLlama/CoinPaprika e, por último, CoinGecko.

   AtlasBuscaToken.ligar({ input, lista, aoEscolher, aoErro })
     input      <input type="search"> com role="combobox"
     lista      <ul role="listbox" hidden> logo abaixo do input
     aoEscolher function({ id, sym, nome, img, fonte })
     aoErro     function(mensagem)   (opcional)
   AtlasBuscaToken.mercado(token) -> Promise<{ id, sym, nome, img, fonte, preco, fontePreco }>
     token é o objeto de aoEscolher ou só o id da CoinGecko (texto).

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
        if (src) { var im = document.createElement('img'); im.src = src; im.alt = ''; im.onerror = function () { this.hidden = true; }; li.appendChild(im); }
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
      o.aoEscolher({ id: c.id, sym: c.sym, nome: c.nome, img: seguro(c.img), fonte: c.fonte });
    }
    inp.addEventListener('input', function () {
      var q = inp.value.trim(); clearTimeout(espera);
      if (q.length < 2) { itens = []; desenhar(); return; }
      espera = setTimeout(function () {
        AtlasCotacao.buscar(q).then(function (r) {
          if (inp.value.trim() !== q) return;          /* resposta velha: a pessoa já digitou outra coisa */
          itens = r.valor || []; foco = -1; desenhar();
        }).catch(function (e) { erro('Busca de tokens indisponível no momento. Tente de novo em instantes.'); });
      }, 350);
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

  function mercado(token) {
    var t = typeof token === 'string' ? { id: token, fonte: 'coingecko' } : (token || {});
    return AtlasCotacao.preco(t).then(function (r) {
      return { id: t.id, sym: t.sym || '', nome: t.nome || t.id, img: seguro(t.img), fonte: t.fonte || 'coingecko',
        preco: r.valor, fontePreco: r.fonte };
    });
  }

  window.AtlasBuscaToken = { ligar: ligar, mercado: mercado };
})();
