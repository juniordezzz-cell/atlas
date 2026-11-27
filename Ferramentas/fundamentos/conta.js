/* ============================================================
   ATLAS · Ferramentas/fundamentos/conta.js   (28/11/2026)
   Contas puras da ferramenta Fundamentos de Protocolo.
   Testes: node --test Ferramentas/fundamentos/conta.test.cjs

   Pergunta do dono (28/11): "preciso saber se é uma boa ideia comprar
   tokens da Uniswap, da Aero…". A ferramenta não responde sim ou não:
   mostra se o negócio por trás do token está crescendo e quanto o
   mercado paga por ele.

   Séries diárias da DefiLlama ([[timestamp em s, valor], ...]):
     volume   negociado (só DEX)
     taxas    pagas pelos usuários
     receita  parte das taxas que fica com o protocolo
     token    parte que chega a quem tem o token (recompra, queima, staking)

   Para um período de N dias:
     soma        últimos N dias
     anterior    os N dias antes desses
     variação    soma ÷ anterior − 1
     anual       soma × 365 ÷ N
     múltiplo    valor de mercado ÷ receita do token anual
                 (como o preço/lucro de uma ação: quantos anos de receita
                 o mercado está pagando hoje)
   ============================================================ */
(function (raiz) {
  'use strict';

  var PERIODOS = [7, 30, 90, 365];
  var METRICAS = ['volume', 'taxas', 'receita', 'token'];

  /* série da DefiLlama → números por dia, do mais antigo ao mais novo */
  function limpaSerie(chart) {
    return (chart || []).filter(function (p) { return p && isFinite(+p[0]) && isFinite(+p[1]); })
      .map(function (p) { return [+p[0], Math.max(0, +p[1])]; })
      .sort(function (a, b) { return a[0] - b[0]; });
  }

  /* soma dos N dias que terminam "atras" janelas antes do fim (0 = os últimos N) */
  function somaJanela(serie, dias, atras) {
    var fim = serie.length - (atras || 0) * dias, ini = fim - dias;
    if (ini < 0 || fim <= 0) return null;
    var s = 0; for (var i = ini; i < fim; i++) s += serie[i][1];
    return s;
  }

  function periodo(serie, dias) {
    if (!serie || !serie.length) return null;
    var atual = somaJanela(serie, dias, 0);
    if (atual == null) return null;
    var anterior = somaJanela(serie, dias, 1);
    return {
      soma: atual,
      anterior: anterior,
      variacao: anterior > 0 ? (atual / anterior - 1) * 100 : null,
      anual: atual * 365 / dias
    };
  }

  function multiplo(mcap, anual) { return mcap > 0 && anual > 0 ? mcap / anual : null; }

  /* d = {nome, simbolo, mcap, series:{volume, taxas, receita, token}} já limpas */
  function resumo(d, dias) {
    var r = { nome: d.nome, simbolo: d.simbolo, mcap: d.mcap > 0 ? d.mcap : null, dias: dias };
    METRICAS.forEach(function (m) { r[m] = d.series && d.series[m] ? periodo(d.series[m], dias) : null; });
    r.multiploToken = r.token ? multiplo(r.mcap, r.token.anual) : null;
    r.multiploReceita = r.receita ? multiplo(r.mcap, r.receita.anual) : null;
    r.parteToken = r.taxas && r.token && r.taxas.soma > 0 ? r.token.soma / r.taxas.soma * 100 : null;
    return r;
  }

  /* média móvel de 7 dias (o gráfico diário pula muito de um dia para o outro) */
  function media7(serie) {
    var out = [], s = 0;
    for (var i = 0; i < serie.length; i++) {
      s += serie[i][1]; if (i >= 7) s -= serie[i - 7][1];
      if (i >= 6) out.push([serie[i][0], s / 7]);
    }
    return out;
  }

  /* frase curta, só com fatos; sem "compre" nem "venda" */
  function leitura(r) {
    var f = [], nd = r.dias === 365 ? 'no último ano' : 'nos últimos ' + r.dias + ' dias';
    var ant = r.dias === 365 ? 'o ano anterior' : 'os ' + r.dias + ' anteriores';
    var base = r.taxas && r.taxas.variacao != null ? ['taxas', r.taxas] : r.volume && r.volume.variacao != null ? ['volume', r.volume] : null;
    if (base) {
      var v = base[1].variacao, nome = base[0] === 'taxas' ? 'As taxas pagas' : 'O volume';
      f.push(Math.abs(v) < 3 ? nome + ' ficaram estáveis ' + nd + ' contra ' + ant + '.'
        : nome + (v > 0 ? ' cresceram ' : ' caíram ') + pct(Math.abs(v)) + ' ' + nd + ' contra ' + ant + '.');
    }
    if (r.token && r.token.soma > 0 && r.parteToken != null) f.push('Quem tem ' + (r.simbolo || 'o token') + ' recebe ' + pct(r.parteToken) + ' das taxas.');
    else if (r.token && r.token.soma === 0) f.push('Hoje o token não recebe parte das taxas.');
    if (r.multiploToken != null) f.push('O valor de mercado equivale a ' + num(r.multiploToken, r.multiploToken < 10 ? 1 : 0) + ' anos dessa receita.');
    return f.join(' ');
  }
  function pct(v) { return num(v, v < 10 ? 1 : 0) + '%'; }
  function num(v, d) { return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ','); }

  /* catálogo: protocolos com token, a partir do lite/protocols2 da DefiLlama.
     Pai (Uniswap = V2 + V3 + V4) quando existe; protocolo solto quando não tem pai. */
  var FORA_CAT = /^(Chain|CEX|Developer Tools|Foundation)$/;
  function slugDe(nome) { return String(nome).toLowerCase().trim().replace(/\s+/g, '-'); }
  function catalogo(lite) {
    var tvlPai = {}, out = [];
    ((lite && lite.protocols) || []).forEach(function (p) {
      if (p.parentProtocol) tvlPai[p.parentProtocol] = (tvlPai[p.parentProtocol] || 0) + (p.tvl || 0);
    });
    ((lite && lite.parentProtocols) || []).forEach(function (p) {
      if (!p.gecko_id || !(p.mcap > 0)) return;
      out.push({ slug: String(p.id).replace(/^parent#/, ''), nome: p.name, simbolo: p.symbol || '', mcap: p.mcap, tvl: tvlPai[p.id] || 0, gecko: p.gecko_id });
    });
    ((lite && lite.protocols) || []).forEach(function (p) {
      if (p.parentProtocol || !p.geckoId || !(p.mcap > 0) || FORA_CAT.test(p.category || '')) return;
      out.push({ slug: slugDe(p.name), nome: p.name, simbolo: p.symbol || '', mcap: p.mcap, tvl: p.tvl || 0, gecko: p.geckoId });
    });
    return out.sort(function (a, b) { return b.mcap - a.mcap; });
  }

  var api = { PERIODOS: PERIODOS, METRICAS: METRICAS, limpaSerie: limpaSerie, somaJanela: somaJanela, periodo: periodo,
    multiplo: multiplo, resumo: resumo, media7: media7, leitura: leitura, catalogo: catalogo, slugDe: slugDe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.FundamentosConta = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
