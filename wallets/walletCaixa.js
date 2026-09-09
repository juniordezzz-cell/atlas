/* ============================================================
   ATLAS · /wallets/walletCaixa.js
   ------------------------------------------------------------
   O CAIXA DE CADA CARTEIRA — e o livro de eventos que o produz.

   A REGRA QUE ESTE ARQUIVO EXISTE PARA GARANTIR
   ---------------------------------------------
   Saldo é CONSEQUÊNCIA de eventos, nunca uma variável solta. Não
   existe `setSaldo`. Não existe campo `saldo` gravado. O caixa de uma
   carteira é sempre a soma do seu histórico, recalculada na leitura —
   e por isso é impossível ele divergir do extrato que a tela mostra.

   O QUE HAVIA ANTES
   -----------------
   Nada. O ATLAS inteiro não tinha conceito de dinheiro parado. O
   `walletLedger` guarda `{capital, saldo, valorAtual}` por módulo, mas
   ali "saldo" é sinônimo de "valor das posições" — é patrimônio
   alocado, não dinheiro disponível. O Trade tinha um array `equity`
   escrito uma única vez na criação da carteira e nunca mais tocado:
   fechar um trade não devolvia nada a lugar nenhum, porque não havia
   lugar nenhum para devolver.

   OS SEIS TIPOS, E O QUE CADA UM FAZ COM O PATRIMÔNIO
   ---------------------------------------------------
     deposito       + caixa      mundo externo → carteira    ↑ patrimônio
     saque          − caixa      carteira → mundo externo    ↓ patrimônio
     transferencia  − origem     carteira → carteira          = patrimônio
                    + destino
     swap           (neutro)     ativo → ativo, mesma carteira = patrimônio
     aporte         − caixa      caixa → posição              = patrimônio
     retorno        + caixa      posição → caixa              = patrimônio

   Só DEPÓSITO e SAQUE mudam o patrimônio total. Todo o resto
   redistribui — é essa a invariante que o teste `patrimônio fecha`
   verifica, e é ela que responde "onde está cada dólar".

   POR QUE UM ARQUIVO NOVO, E NÃO DENTRO DO walletLedger
   -----------------------------------------------------
   São coisas de natureza oposta. O walletLedger é um CACHE de valores
   agregados que os módulos reportam (e que pode estar velho, por
   design — ver o comentário lá). Este é um LIVRO-RAZÃO: append-only,
   fonte da verdade, sem cache possível. Misturar os dois faria o
   dinheiro disponível herdar a tolerância a defasagem que só faz
   sentido para valor de posição.

   Exposto em: window.AtlasCaixa
   ============================================================ */
(function (global) {
  "use strict";
  if (global.AtlasCaixa) return;

  var KEY = "atlas.caixa.v1";

  /* Efeito de cada tipo sobre o caixa da carteira citada em walletId.
     `contra` marca os que também mexem numa segunda carteira. */
  var TIPOS = {
    deposito:      { sinal: +1, contra: false, patrimonio: +1, rotulo: "Depósito" },
    saque:         { sinal: -1, contra: false, patrimonio: -1, rotulo: "Saque" },
    transferencia: { sinal: -1, contra: true,  patrimonio: 0,  rotulo: "Transferência" },
    swap:          { sinal: 0,  contra: false, patrimonio: 0,  rotulo: "Swap" },
    aporte:        { sinal: -1, contra: false, patrimonio: 0,  rotulo: "Aporte em posição" },
    retorno:       { sinal: +1, contra: false, patrimonio: 0,  rotulo: "Retorno de posição" }
  };

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function pos(v) { var n = Number(v); return (isFinite(n) && n > 0) ? n : null; }
  function txt(v) { return String(v == null ? "" : v).trim(); }
  function ativo(v) {
    var s = txt(v).toUpperCase();
    return s || "USDT";
  }

  function hoje() {
    var d = new Date();
    var mm = String(d.getMonth() + 1), dd = String(d.getDate());
    return d.getFullYear() + "-" + (mm.length < 2 ? "0" + mm : mm) + "-" + (dd.length < 2 ? "0" + dd : dd);
  }

  function dia(v) {
    if (!v) return hoje();
    var s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var d = new Date(s);
    if (isNaN(d.getTime())) return hoje();
    var mm = String(d.getMonth() + 1), dd = String(d.getDate());
    return d.getFullYear() + "-" + (mm.length < 2 ? "0" + mm : mm) + "-" + (dd.length < 2 ? "0" + dd : dd);
  }

  /* ---- persistência ---- */
  var _mem = null;

  function ler() {
    if (_mem) return _mem;
    try {
      var raw = global.localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      _mem = Array.isArray(arr) ? arr : [];
    } catch (e) { _mem = []; }
    return _mem;
  }

  function gravar(arr) {
    _mem = arr;
    try { global.localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) { /* só memória */ }
    emitir();
  }

  var subs = [];
  function emitir() { subs.slice().forEach(function (fn) { try { fn(); } catch (e) {} }); }

  var _seq = 0;
  function gerarId() {
    _seq = (_seq + 1) % 100000;
    return "cx_" + Date.now().toString(36) + _seq.toString(36);
  }

  function normalizar(ev) {
    if (!ev) return null;
    var tipo = String(ev.tipo || "").toLowerCase();
    if (!TIPOS[tipo]) return null;

    var valor = num(ev.valorUSD);
    /* Valor negativo é erro de entrada, não uma forma alternativa de
       escrever o tipo oposto. Math.abs() aqui corrigiria em silêncio um
       saque digitado como −100 e o registraria como intencional. */
    if (!(valor > 0)) return null;
    if (!ev.walletId) return null;
    if (TIPOS[tipo].contra && !ev.contraWalletId) return null;
    if (TIPOS[tipo].contra && ev.contraWalletId === ev.walletId) return null;

    return {
      id: ev.id || gerarId(),
      data: dia(ev.data),
      tipo: tipo,
      valorUSD: valor,
      ativo: ativo(ev.ativo),
      ativoNome: txt(ev.ativoNome) || null,
      ativoThumb: txt(ev.ativoThumb) || null,
      walletId: ev.walletId,
      contraWalletId: ev.contraWalletId || null,
      module: ev.module || null,
      refId: ev.refId || null,
      /* swap guarda os dois lados: sem isso ele seria um evento sem
         conteúdo, já que não mexe no caixa em dólar */
      ativoDestino: ev.ativoDestino ? ativo(ev.ativoDestino) : null,
      ativoDestinoNome: txt(ev.ativoDestinoNome) || null,
      ativoDestinoThumb: txt(ev.ativoDestinoThumb) || null,
      qtd: ev.qtd != null ? pos(ev.qtd) : null,
      qtdOrigem: ev.qtdOrigem != null ? pos(ev.qtdOrigem) : null,
      qtdDestino: ev.qtdDestino != null ? pos(ev.qtdDestino) : null,
      obs: ev.obs || "",
      criadoEm: ev.criadoEm || new Date().toISOString()
    };
  }

  var API = {
    TIPOS: TIPOS,

    /* ---------------- escrita ---------------- */

    /* ------------------------------------------------------------
       A TRAVA DE VERDADE — no livro, não na tela

       "Carteira sem caixa não abre posição" estava implementado em
       CINCO telas: o wizard de pool, o de staking/lending, o formulário
       de trade, a compra do Hold e as ações desta tela. O RWA não
       tinha, e por isso adicionar um ativo furava o caixa em silêncio.

       Regra espalhada por tela é regra que um caminho novo esquece —
       importação, restauração de backup, uma tela futura. Aqui ela
       fica no lugar por onde TODO aporte passa, e as telas continuam
       verificando antes só para poder dar uma mensagem melhor: elas
       explicam quanto falta, o livro apenas recusa.

       Só o APORTE é travado. Saque e transferência são gastos também,
       mas quem os registra é esta tela, que já confere — e travá-los
       aqui impediria de corrigir um lançamento errado registrando o
       oposto.
       ------------------------------------------------------------ */
    registrar: function (ev) {
      var n = normalizar(ev);
      if (!n) return null;
      if (n.tipo === "aporte" && !API.podeGastar(n.walletId, n.valorUSD).ok) return null;
      var arr = ler().slice();
      arr.push(n);
      gravar(arr);
      return n;
    },

    /* ------------------------------------------------------------
       Vários de uma vez, tudo ou nada.

       Aplica em SEQUÊNCIA, não em bloco: a abertura de saldo registra
       o depósito e os aportes que ele financia na mesma chamada, e um
       saldo conferido contra o estado ANTERIOR recusaria todos os
       aportes — o depósito ainda não teria entrado. Sequencial, cada
       evento vê o efeito do anterior, que é como o dinheiro funciona.
       ------------------------------------------------------------ */
    registrarVarios: function (lista) {
      var normalizados = (lista || []).map(normalizar);
      if (normalizados.some(function (x) { return !x; })) return null;

      var original = ler().slice();
      var arr = original.slice();
      for (var i = 0; i < normalizados.length; i++) {
        var n = normalizados[i];
        if (n.tipo === "aporte") {
          _mem = arr;                                   // saldo do estado parcial
          if (!API.podeGastar(n.walletId, n.valorUSD).ok) { _mem = original; return null; }
        }
        arr.push(n);
      }
      _mem = original;
      gravar(arr);
      return normalizados;
    },

    remover: function (id) {
      var arr = ler();
      var proximo = arr.filter(function (e) { return e.id !== id; });
      if (proximo.length === arr.length) return false;
      gravar(proximo);
      return true;
    },

    /* Apaga os eventos ligados a uma posição — usado quando a posição
       é excluída (não encerrada) e o dinheiro dela nunca existiu. */
    removerPorRef: function (module, refId) {
      if (!refId) return 0;
      var arr = ler();
      var proximo = arr.filter(function (e) {
        return !(e.refId === refId && (!module || e.module === module));
      });
      var n = arr.length - proximo.length;
      if (n) gravar(proximo);
      return n;
    },

    /* ---------------- leitura ---------------- */

    eventos: function (opts) {
      opts = opts || {};
      var arr = ler().filter(function (e) {
        if (opts.walletId && e.walletId !== opts.walletId && e.contraWalletId !== opts.walletId) return false;
        if (opts.tipo && e.tipo !== opts.tipo) return false;
        if (opts.module && e.module !== opts.module) return false;
        if (opts.refId && e.refId !== opts.refId) return false;
        if (opts.de && e.data < dia(opts.de)) return false;
        if (opts.ate && e.data > dia(opts.ate)) return false;
        return true;
      });
      /* mais recente primeiro; empate resolvido pela ordem de registro,
         para o extrato ficar estável entre carregamentos */
      return arr.sort(function (a, b) {
        if (a.data !== b.data) return a.data < b.data ? 1 : -1;
        return String(a.criadoEm) < String(b.criadoEm) ? 1 : -1;
      });
    },

    /* ------------------------------------------------------------
       O CAIXA DE UMA CARTEIRA — derivado, sempre

       Percorre o livro inteiro. Não há cache, e é de propósito: o
       custo é irrelevante (centenas de eventos) e o benefício é a
       impossibilidade estrutural de o saldo mostrado divergir do
       extrato que o produziu.
       ------------------------------------------------------------ */
    saldo: function (walletId) {
      if (!walletId) return 0;
      var total = 0;
      ler().forEach(function (e) {
        var t = TIPOS[e.tipo];
        if (!t) return;
        if (e.walletId === walletId) total += t.sinal * e.valorUSD;
        /* o outro lado da transferência entra com o sinal invertido */
        if (t.contra && e.contraWalletId === walletId) total += -t.sinal * e.valorUSD;
      });
      /* poeira de ponto flutuante não é saldo */
      return Math.round(total * 1e6) / 1e6;
    },

    saldos: function () {
      var out = {};
      ler().forEach(function (e) {
        var t = TIPOS[e.tipo];
        if (!t) return;
        out[e.walletId] = (out[e.walletId] || 0) + t.sinal * e.valorUSD;
        if (t.contra && e.contraWalletId) {
          out[e.contraWalletId] = (out[e.contraWalletId] || 0) + -t.sinal * e.valorUSD;
        }
      });
      Object.keys(out).forEach(function (k) { out[k] = Math.round(out[k] * 1e6) / 1e6; });
      return out;
    },

    caixaPorAtivo: function (walletId) {
      if (!walletId) return [];

      function add(mapa, symbol, usdDelta, qtdDelta, nome, thumb) {
        var key = ativo(symbol);
        if (!mapa[key]) mapa[key] = { ativo: key, nome: nome || key, thumb: thumb || "", usd: 0, qtd: 0 };
        if (!mapa[key].nome && nome) mapa[key].nome = nome;
        if (!mapa[key].thumb && thumb) mapa[key].thumb = thumb;
        if (isFinite(usdDelta)) mapa[key].usd += Number(usdDelta) || 0;
        if (qtdDelta != null && isFinite(qtdDelta)) mapa[key].qtd += Number(qtdDelta) || 0;
      }

      var mapa = {};
      ler().forEach(function (e) {
        var t = TIPOS[e.tipo];
        if (!t) return;

        if (e.walletId === walletId) {
          if (e.tipo === "swap") {
            add(mapa, e.ativo, -e.valorUSD, e.qtdOrigem != null ? -e.qtdOrigem : null, e.ativoNome, e.ativoThumb);
            add(mapa, e.ativoDestino || "USDT", +e.valorUSD, e.qtdDestino, e.ativoDestinoNome, e.ativoDestinoThumb);
            return;
          }
          add(
            mapa,
            e.ativo,
            t.sinal * e.valorUSD,
            e.qtd != null ? t.sinal * e.qtd : null,
            e.ativoNome,
            e.ativoThumb
          );
          return;
        }

        if (t.contra && e.contraWalletId === walletId) {
          add(mapa, e.ativo, +e.valorUSD, e.qtd, e.ativoNome, e.ativoThumb);
        }
      });

      return Object.keys(mapa).map(function (k) {
        return {
          ativo: mapa[k].ativo,
          nome: mapa[k].nome || mapa[k].ativo,
          thumb: mapa[k].thumb || "",
          usd: Math.round(mapa[k].usd * 1e6) / 1e6,
          qtd: Math.round(mapa[k].qtd * 1e8) / 1e8
        };
      }).filter(function (r) {
        return Math.abs(r.usd) > 1e-6 || Math.abs(r.qtd) > 1e-8;
      }).sort(function (a, b) {
        return Math.abs(b.usd) - Math.abs(a.usd);
      });
    },

    /* Caixa somado de todas as carteiras GLOBAIS — é o que sobe para o
       patrimônio consolidado. Carteira local fica fora, pela mesma
       regra que já vale para as posições. */
    caixaGlobal: function () {
      var W = global.AtlasWallets;
      var ids = (W && W.globals) ? W.globals().map(function (w) { return w.id; }) : ["principal"];
      var s = API.saldos(), t = 0;
      ids.forEach(function (id) { t += s[id] || 0; });
      return Math.round(t * 1e6) / 1e6;
    },

    /* ------------------------------------------------------------
       PODE GASTAR?

       A pergunta que bloqueia a abertura de posição sem caixa. Devolve
       um objeto em vez de um booleano porque a tela precisa dizer
       QUANTO falta — "saldo insuficiente" sem número obriga a pessoa a
       ir conferir noutra tela.
       ------------------------------------------------------------ */
    podeGastar: function (walletId, valor) {
      var v = num(valor);
      var s = API.saldo(walletId);
      /* tolerância de um centavo: o caixa vem de somas de ponto
         flutuante, e recusar por 0,0000001 seria recusar o saldo
         inteiro que a pessoa acabou de ver na tela */
      var ok = v <= s + 0.01;
      return { ok: ok, saldo: s, pedido: v, falta: ok ? 0 : Math.round((v - s) * 100) / 100 };
    },

    /* ------------------------------------------------------------
       PATRIMÔNIO PELO LIVRO — a conta de conferência

       Só depósito e saque mudam o total. Se esta soma não bater com
       (caixa + posições), há dinheiro aparecendo ou sumindo em algum
       lugar — e é isso que o teste de invariante verifica.
       ------------------------------------------------------------ */
    patrimonioExterno: function () {
      var t = 0;
      ler().forEach(function (e) {
        var d = TIPOS[e.tipo];
        if (d && d.patrimonio) t += d.patrimonio * e.valorUSD;
      });
      return Math.round(t * 1e6) / 1e6;
    },

    /* Quanto saiu do caixa para posições de um módulo (aportes menos
       retornos). É o que permite responder "onde está cada dólar" sem
       perguntar a cada módulo. */
    alocadoPorModulo: function (walletId) {
      var out = {};
      ler().forEach(function (e) {
        if (walletId && e.walletId !== walletId) return;
        if (e.tipo !== "aporte" && e.tipo !== "retorno") return;
        var m = e.module || "outros";
        out[m] = (out[m] || 0) + (e.tipo === "aporte" ? e.valorUSD : -e.valorUSD);
      });
      Object.keys(out).forEach(function (k) { out[k] = Math.round(out[k] * 1e6) / 1e6; });
      return out;
    },

    rotulo: function (tipo) {
      var t = TIPOS[String(tipo || "").toLowerCase()];
      return t ? t.rotulo : "Movimento";
    },

    /* ---------------- eventos de UI ---------------- */
    subscribe: function (fn) {
      if (typeof fn !== "function") return function () {};
      if (subs.indexOf(fn) === -1) subs.push(fn);
      return function () {
        var i = subs.indexOf(fn);
        if (i !== -1) subs.splice(i, 1);
      };
    },

    /* Descarta o cache em memória — usado pela bateria de testes, que
       reescreve o localStorage por baixo. */
    _reload: function () { _mem = null; return ler(); }
  };

  /* reage a mudanças vindas de outra aba */
  try {
    global.addEventListener("storage", function (ev) {
      if (ev && ev.key === KEY) { _mem = null; emitir(); }
    });
  } catch (e) {}

  global.AtlasCaixa = API;
})(typeof window !== "undefined" ? window : this);
