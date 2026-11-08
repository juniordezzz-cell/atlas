/* ATLAS · Ferramentas/_comum/busca-token.js
   Busca de token da CoinGecko com sugestões, teclado e escape, igual em
   todas as calculadoras da bancada. Rede só pelo AtlasHttp.

   AtlasBuscaToken.ligar({ input, lista, aoEscolher, aoErro })
     input      <input type="search"> com role="combobox"
     lista      <ul role="listbox" hidden> logo abaixo do input
     aoEscolher function({ id, sym, nome, img })
     aoErro     function(mensagem)   (opcional)
   AtlasBuscaToken.mercado(id) -> Promise<{ id, sym, nome, img, preco }>
     preço em US$ de /coins/markets (1 min de cache).

   Estilo: .busca-token__lista em ../_comum/ferramenta.css. */
(function () {
  'use strict';
  var API = 'https://api.coingecko.com/api/v3';
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
        var src = seguro(c.thumb);
        if (src) { var im = document.createElement('img'); im.src = src; im.alt = ''; li.appendChild(im); }
        var b = document.createElement('b'); b.textContent = String(c.symbol || '').toUpperCase(); li.appendChild(b);
        var n = document.createElement('span'); n.textContent = c.name; li.appendChild(n);
        if (c.market_cap_rank) { var r = document.createElement('span'); r.className = 'rank'; r.textContent = '#' + c.market_cap_rank; li.appendChild(r); }
        li.addEventListener('mousedown', function (ev) { ev.preventDefault(); escolher(i); });
        ul.appendChild(li);
      });
      ul.hidden = !itens.length; inp.setAttribute('aria-expanded', String(!!itens.length));
    }
    function escolher(i) {
      var c = itens[i]; if (!c) return;
      inp.value = String(c.symbol || '').toUpperCase(); fechar();
      o.aoEscolher({ id: c.id, sym: String(c.symbol || '').toUpperCase(), nome: c.name, img: seguro(c.large || c.thumb) });
    }
    inp.addEventListener('input', function () {
      var q = inp.value.trim(); clearTimeout(espera);
      if (q.length < 2) { itens = []; desenhar(); return; }
      espera = setTimeout(function () {
        AtlasHttp.getJSON(API + '/search?query=' + encodeURIComponent(q), { ttl: 300000 }).then(function (d) {
          itens = ((d && d.coins) || []).slice(0, 8); foco = -1; desenhar();
        }).catch(function (e) { erro('Busca indisponível agora (' + e.message + ').'); });
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

  function mercado(id) {
    return AtlasHttp.getJSON(API + '/coins/markets?vs_currency=usd&ids=' + encodeURIComponent(id), { ttl: 60000 }).then(function (d) {
      var c = d && d[0]; if (!c) throw new Error('token não encontrado');
      return { id: c.id, sym: String(c.symbol || '').toUpperCase(), nome: c.name, img: seguro(c.image), preco: c.current_price };
    });
  }

  window.AtlasBuscaToken = { ligar: ligar, mercado: mercado };
})();
