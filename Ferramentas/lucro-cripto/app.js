/* ATLAS · Lucro Cripto (Ferramentas/lucro-cripto/)
   Contas em ../_comum/calculos.js: lucroOperacao, precoEmpate,
   impostoCripto. Rede só pelo AtlasHttp: busca e preço na CoinGecko e o
   dólar em reais pela cotação do USDT. Aceita ?compra=&venda=&qtd=&token=
   vindo da Escada. Registro: docs/ferramentas-bancada-2026-11-08.md */
(function () {
  'use strict';
  var C = window.AtlasCalculos;
  var API = 'https://api.coingecko.com/api/v3';
  var $ = function (id) { return document.getElementById(id); };
  var token = null;

  function ler(id) { return C.lerNumero($(id).value); }
  function usd(v) { return (v < 0 ? '−' : '') + 'US$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: Math.abs(v) < 1 && v !== 0 ? 6 : 2 }); }
  function brl(v) { return (v < 0 ? '−' : '') + 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function campo(id, v) { $(id).value = v == null ? '' : C.numeroCampo(+(+v).toPrecision(10)); }
  function linkSeguro(u) { return /^https:\/\//.test(u || '') ? u : ''; }
  function status(t) { $('lc-status').textContent = t || ''; }

  /* ---------- token: busca e preço ---------- */
  function mostrarFicha(t) {
    token = t;
    $('lc-ficha').hidden = false;
    var img = $('lc-ficha-img'), src = linkSeguro(t.img);
    img.hidden = !src; if (src) img.src = src;
    $('lc-ficha-nome').textContent = t.nome + ' (' + t.sym + ')';
    $('lc-ficha-preco').textContent = t.preco != null ? usd(t.preco) + ' hoje' : 'buscando preço…';
  }
  function carregarToken(id) {
    status('');
    return AtlasBuscaToken.mercado(id).then(mostrarFicha)
      .catch(function (e) { status('Não consegui buscar o preço agora (' + e.message + '). Digite os preços à mão.'); });
  }
  AtlasBuscaToken.ligar({
    input: $('lc-busca'), lista: $('lc-sugestoes'), aoErro: status,
    aoEscolher: function (t) { t.preco = null; mostrarFicha(t); carregarToken(t.id); }
  });
  $('lc-usar-preco').addEventListener('click', function () { if (token && token.preco != null) { campo('lc-venda', token.preco); calcular(); } });

  /* ---------- conta ---------- */
  function calcular() {
    var qtd = ler('lc-qtd'), compra = ler('lc-compra'), venda = ler('lc-venda');
    var taxa = ler('lc-taxa') || 0, dolar = ler('lc-dolar') || 0, outras = ler('lc-outras') || 0;
    if (!(qtd > 0) || !(compra > 0) || !(venda > 0)) { $('lc-erro').hidden = false; return; }
    $('lc-erro').hidden = true;
    var R = C.lucroOperacao({ quantidade: qtd, precoCompra: compra, precoVenda: venda, taxaPct: taxa });
    var lucroBRL = R.lucro * dolar;
    var ir = C.impostoCripto({ lucroBRL: lucroBRL, vendasMesBRL: R.recebido * dolar + outras, custodia: $('lc-custodia').value });
    var empate = C.precoEmpate(compra, taxa);

    $('lc-resultado').hidden = false;
    var el = $('lc-r-lucro'); el.textContent = usd(R.lucro); el.className = 'res__valor ' + (R.lucro >= 0 ? 'pos' : 'neg');
    $('lc-r-lucro-brl').textContent = brl(lucroBRL);
    var p = $('lc-r-pct'); p.textContent = (R.lucroPct >= 0 ? '+' : '') + R.lucroPct.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%'; p.className = 'res__valor ' + (R.lucroPct >= 0 ? 'pos' : 'neg');
    $('lc-r-inv').textContent = usd(R.investido);
    $('lc-r-out').textContent = usd(R.recebido);
    $('lc-r-taxas').textContent = usd(R.taxas);
    $('lc-r-empate').textContent = empate == null ? '—' : usd(empate);
    $('lc-r-ir').textContent = brl(ir.imposto);
    $('lc-r-sobra').textContent = brl(lucroBRL - ir.imposto);
    var vendasMes = R.recebido * dolar + outras, nota;
    if (lucroBRL <= 0) nota = 'Sem lucro, sem imposto. Na exchange brasileira, o prejuízo pode abater lucros futuros.';
    else if ($('lc-custodia').value === 'ext') nota = '15% sobre o lucro, declarado no ano seguinte (Lei 14.754/2023). Exchange estrangeira não tem a isenção dos R$ 35 mil.';
    else if (ir.isento) nota = 'Isento: as vendas do mês somam ' + brl(vendasMes) + ', até R$ 35 mil. Declare na ficha de bens.';
    else nota = 'As vendas do mês somam ' + brl(vendasMes) + ', acima de R$ 35 mil: alíquota de ' + (ir.aliquota * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%. DARF código 4600, até o último dia útil do mês seguinte.';
    $('lc-r-ir-nota').textContent = nota;
  }
  $('lc-calcular').addEventListener('click', calcular);
  document.querySelectorAll('.bloco input').forEach(function (inp) {
    if (inp.id === 'lc-busca') return;
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') calcular(); });
  });
  $('lc-limpar').addEventListener('click', function () {
    ['lc-compra', 'lc-venda', 'lc-busca'].forEach(function (id) { $(id).value = ''; });
    $('lc-qtd').value = '1'; $('lc-taxa').value = '0,1'; $('lc-outras').value = '0';
    $('lc-resultado').hidden = true; $('lc-ficha').hidden = true; token = null;
  });

  /* ---------- dólar em reais (cotação do USDT) ---------- */
  AtlasHttp.getJSON(API + '/simple/price?ids=tether&vs_currencies=brl,usd', { ttl: 600000 }).then(function (d) {
    var t = d && d.tether; if (!t || !(t.brl > 0) || !(t.usd > 0)) return;
    if ($('lc-dolar').dataset.mexido) return;
    campo('lc-dolar', +(t.brl / t.usd).toFixed(4));
    if (!$('lc-resultado').hidden) calcular();
  }).catch(function () {});
  $('lc-dolar').addEventListener('input', function () { this.dataset.mexido = '1'; });

  /* ---------- vindo da Escada: ?compra=&venda=&qtd=&token= ---------- */
  var q = new URLSearchParams(location.search);
  // gerados por máquina, com ponto decimal: parseFloat, não lerNumero ("1234.567" não é milhar)
  var qc = parseFloat(q.get('compra')), qv = parseFloat(q.get('venda')), qq = parseFloat(q.get('qtd'));
  if (qc > 0) campo('lc-compra', qc);
  if (qv > 0) campo('lc-venda', qv);
  if (qq > 0) campo('lc-qtd', qq);
  var qt = q.get('token');
  if (qt && /^[a-z0-9-]{1,80}$/.test(qt)) carregarToken(qt);
  if (qc > 0 && qv > 0) calcular();
})();
