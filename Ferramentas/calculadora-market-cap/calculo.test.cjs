/* Testes das contas da Calculadora de Market Cap.
   Rodar na raiz: node --test Ferramentas/calculadora-market-cap/calculo.test.cjs
   Gabarito: os números do texto original (SKY × AAVE, CoinGecko out/2026). */
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("./calculo.js");

const perto = (a, b, tol) => assert.ok(Math.abs(a - b) <= (tol || 1e-9), a + " ≠ " + b);

test("gabarito SKY: valor de mercado hoje e a US$ 1", () => {
  const hoje = C.mcapNoPreco(0.077, 23.4e9);
  perto(hoje, 1.8018e9, 1e3);
  const aUmDolar = C.mcapNoPreco(1, 23.4e9);
  perto(aUmDolar, 23.4e9, 1);
  perto(C.multiplicador(aUmDolar, hoje), 12.987, 0.001);
});

test("gabarito AAVE: 13× e US$ 100 em AAVE", () => {
  perto(160.78 * 13, 2090.14, 0.001);
  const r = C.meuDinheiro(100, 160.78, 1045.07);
  perto(r.tokens, 0.62197, 0.00001);
  perto(r.valorFinal, 650, 0.01);
  perto(r.lucro, 550, 0.01);
  perto(r.lucroPct, 550, 0.01);
});

test("régua: SKY a US$ 1 cabe ~9,45 AAVEs", () => {
  const r = C.regua(23.4e9, [
    { id: "aave", name: "Aave", symbol: "AAVE", marketCap: 2.476e9 },
    { id: "zero", name: "Zero", symbol: "Z", marketCap: 0 }
  ]);
  assert.equal(r.length, 1);
  perto(r[0].vezes, 9.4507, 0.0001);
  assert.deepEqual(C.regua(null, [{ id: "a", marketCap: 1 }]), []);
});

test("precoNoMcap: valer como a Solana", () => {
  perto(C.precoNoMcap(63e9, 23.4e9), 2.6923, 0.0001);
  assert.equal(C.precoNoMcap(63e9, 0), null);
});

/* Critério da CoinGecko, conferido no JUP em 13/10/2026: FDV = preço ×
   oferta TOTAL (6,86 bi), não a máxima (10 bi, desatualizada depois da
   queima). A máxima só entra quando não há total. */
test("oferta usa a total quando existe (JUP: total 6,86 bi, máx. 10 bi)", () => {
  const o = C.oferta({ circulating: 3.32e9, total: 6.86e9, max: 10e9 });
  assert.equal(o.cheia, 6.86e9);
  assert.equal(o.base, "total");
  perto(o.faltaEntrar, 3.54e9, 1);
  perto(o.pctCirculando, 0.48397, 0.00001);
  assert.equal(o.semTeto, false);
  assert.equal(o.teto, 10e9);
  assert.equal(o.inconsistente, false);
});

test("oferta sem total usa a máxima", () => {
  const o = C.oferta({ circulating: 3e9, total: null, max: 10e9 });
  assert.equal(o.cheia, 10e9);
  assert.equal(o.base, "max");
  assert.equal(o.faltaEntrar, 7e9);
  perto(o.pctCirculando, 0.3);
});

test("oferta sem teto usa a total (ETH)", () => {
  const o = C.oferta({ circulating: 120e6, total: 120e6, max: null });
  assert.equal(o.base, "total");
  assert.equal(o.semTeto, true);
  assert.equal(o.teto, null);
  assert.equal(o.faltaEntrar, 0);
  perto(o.pctCirculando, 1);
});

test("oferta sem total nem máximo", () => {
  const o = C.oferta({ circulating: 5e6, total: null, max: null });
  assert.equal(o.cheia, null);
  assert.equal(o.base, null);
  assert.equal(o.faltaEntrar, null);
  assert.equal(o.pctCirculando, null);
  assert.equal(o.circulante, 5e6);
});

test("oferta com circulação zero ou ausente", () => {
  const o = C.oferta({ circulating: 0, total: 1e9, max: 1e9 });
  assert.equal(o.circulante, null);
  assert.equal(o.cheia, 1e9);
  assert.equal(o.pctCirculando, null);
  assert.equal(C.oferta(null).circulante, null);
});

test("oferta inconsistente: circulação maior que a cheia vira 100%", () => {
  const o = C.oferta({ circulating: 12e9, total: 10e9, max: 10e9 });
  assert.equal(o.inconsistente, true);
  assert.equal(o.cheia, 12e9);
  assert.equal(o.faltaEntrar, 0);
  perto(o.pctCirculando, 1);
});

test("contas nunca devolvem NaN/Infinity", () => {
  assert.equal(C.mcapNoPreco(NaN, 1), null);
  assert.equal(C.mcapNoPreco(1, Infinity), null);
  assert.equal(C.mcapNoPreco(-1, 10), null);
  assert.equal(C.multiplicador(10, 0), null);
  assert.equal(C.meuDinheiro(100, 0, 1), null);
  assert.equal(C.meuDinheiro(0, 1, 1), null);
});

const LISTA = [
  { id: "bitcoin", name: "Bitcoin", marketCap: 2000e9 },
  { id: "ethereum", name: "Ethereum", marketCap: 500e9 },
  { id: "solana", name: "Solana", marketCap: 63e9 },
  { id: "jupiter", name: "Jupiter", marketCap: 1.5e9 },
  { id: "aave", name: "Aave", marketCap: 2.476e9 }
];

test("ranking: entre dois vizinhos, ignorando o próprio token", () => {
  const r = C.posicaoNoRanking(10e9, LISTA, "jupiter");
  assert.equal(r.posicao, 4);
  assert.equal(r.acima.id, "solana");
  assert.equal(r.abaixo.id, "aave");
  assert.equal(r.maiorQueTodos, false);
  assert.equal(r.foraDaLista, false);
  assert.equal(r.tamanhoLista, 4);
});

test("ranking: maior que o 1º", () => {
  const r = C.posicaoNoRanking(5000e9, LISTA);
  assert.equal(r.posicao, 1);
  assert.equal(r.maiorQueTodos, true);
  assert.equal(r.acima, null);
  assert.equal(r.abaixo.id, "bitcoin");
});

test("ranking: abaixo do último da lista", () => {
  const r = C.posicaoNoRanking(1e6, LISTA, "jupiter");
  assert.equal(r.foraDaLista, true);
  assert.equal(r.posicao, null);
  assert.equal(r.acima.id, "aave");
  assert.equal(r.abaixo, null);
  assert.equal(C.posicaoNoRanking(null, LISTA), null);
  assert.equal(C.posicaoNoRanking(1e9, []), null);
});

test("lerNumero entende o jeito brasileiro de digitar", () => {
  assert.equal(C.lerNumero("1"), 1);
  assert.equal(C.lerNumero("0,5"), 0.5);
  assert.equal(C.lerNumero("0.077"), 0.077);
  assert.equal(C.lerNumero("1.000"), 1000);
  assert.equal(C.lerNumero("1.234.567,89"), 1234567.89);
  assert.equal(C.lerNumero("1,234.5"), 1234.5);
  assert.equal(C.lerNumero("US$ 100"), 100);
  assert.equal(C.lerNumero("$2,50"), 2.5);
  assert.equal(C.lerNumero("10 bi"), 10e9);
  assert.equal(C.lerNumero("2,5 mi"), 2.5e6);
  assert.equal(C.lerNumero("3 tri"), 3e12);
  assert.equal(C.lerNumero("50k"), 50e3);
  assert.equal(C.lerNumero("50 mil"), 50e3);
});

test("lerNumero recusa o que não é número positivo", () => {
  assert.equal(C.lerNumero(""), null);
  assert.equal(C.lerNumero("   "), null);
  assert.equal(C.lerNumero("abc"), null);
  assert.equal(C.lerNumero("-5"), null);
  assert.equal(C.lerNumero("0"), null);
  assert.equal(C.lerNumero(null), null);
  assert.equal(C.lerNumero("1,2,3"), null);
});

test("formatos", () => {
  assert.equal(C.fmtUSD(1.8018e9), "US$ 1,80 bi");
  assert.equal(C.fmtUSD(23.4e9), "US$ 23,40 bi");
  assert.equal(C.fmtUSD(3.2e12), "US$ 3,20 tri");
  assert.equal(C.fmtUSD(4.5e6), "US$ 4,50 mi");
  assert.equal(C.fmtUSD(1234.5), "US$ 1.234,50");
  assert.equal(C.fmtUSD(160.78), "US$ 160,78");
  assert.equal(C.fmtUSD(0.0767), "US$ 0,0767");
  assert.equal(C.fmtUSD(0.000012345), "US$ 0,00001235");
  assert.equal(C.fmtUSD(null), "—");
  assert.equal(C.fmtQtd(23.4e9), "23,4 bi");
  assert.equal(C.fmtQtd(1298.7), "1.299");
  assert.equal(C.fmtQtd(12.345), "12,35");
  assert.equal(C.fmtQtd(0.62197), "0,622");
  assert.equal(C.fmtVezes(12.987), "13×");
  assert.equal(C.fmtVezes(9.4507), "9,5×");
  assert.equal(C.fmtVezes(0.3712), "0,37×");
  assert.equal(C.fmtVezes(4000), "4.000×");
  assert.equal(C.fmtVezes(null), "—");
  /* fração pequena nunca vira "0×" (JUP a US$ 1 = 0,0016 Bitcoin) */
  assert.equal(C.fmtVezes(0.0015821), "0,0016×");
  assert.equal(C.fmtVezes(0.0123), "0,012×");
  assert.equal(C.fmtVezes(0.00000042), "0,00000042×");
  assert.equal(C.fmtPct(0.62), "62%");
  assert.equal(C.fmtPct(0.0734), "7,3%");
  assert.equal(C.fmtPct(null), "—");
});

/* Revisão final, Important 1: sem a régua (CoinGecko 429) o select só
   tinha "Outro valor…" mas o estado seguia "solana" — tela travada. */
test("opcaoValer nunca aponta para projeto que não está na régua", () => {
  assert.equal(C.opcaoValer("solana", ["bitcoin", "solana"]), "solana");
  assert.equal(C.opcaoValer("outro", ["bitcoin"]), "outro");
  assert.equal(C.opcaoValer("solana", ["bitcoin", "aave"]), "bitcoin");
  assert.equal(C.opcaoValer("solana", []), "outro");
  assert.equal(C.opcaoValer(undefined, null), "outro");
});

/* Revisão final, Important 2: guardar só o que a tela usa. A resposta
   crua tem ~97 KB por token (tickers, descrição) e o top 250 ~212 KB. */
test("enxugarFicha guarda só os campos da tela", () => {
  const cru = {
    id: "jupiter", symbol: "JUP", name: "Jupiter", image: "https://i/j.png", usd: 0.33,
    marketCap: 1.1e9, fdv: 2.28e9, rank: 73, ath: 2.0, athDate: "2024-01-31T00:00:00.000Z",
    supply: { circulating: 3.3e9, total: 6.86e9, max: 10e9 },
    links: { whitepaper: null, homepage: "https://jup.ag", twitter: "https://x.com/j" },
    description: "x".repeat(20000), exchanges: [{ name: "a" }], change: { h24: 1 }
  };
  const e = C.enxugarFicha(cru);
  assert.deepEqual(Object.keys(e).sort(),
    ["ath", "athDate", "fdv", "fonte", "id", "image", "links", "marketCap", "name", "rank", "supply", "symbol", "usd"]);
  assert.equal(e.ath, 2.0);
  assert.deepEqual(e.links, { whitepaper: null, homepage: "https://jup.ag" });
  assert.deepEqual(e.supply, cru.supply);
  assert.ok(JSON.stringify(e).length < 600);
  assert.equal(C.enxugarFicha(null), null);
});

test("enxugarMercado guarda id, nome, símbolo e valor de mercado", () => {
  const l = C.enxugarMercado([{ id: "a", name: "A", symbol: "A", marketCap: 5, usd: 1, image: "x", volume24h: 9 }]);
  assert.deepEqual(l, [{ id: "a", name: "A", symbol: "A", marketCap: 5 }]);
  assert.deepEqual(C.enxugarMercado(null), []);
});

test("podarFichas mantém só as mais recentes", () => {
  const f = { a: { t: 1 }, b: { t: 5 }, c: { t: 3 }, d: { t: 4 } };
  assert.deepEqual(Object.keys(C.podarFichas(f, 2)).sort(), ["b", "d"]);
  assert.deepEqual(C.podarFichas(null, 2), {});
});

test("linkSeguro só aceita http(s)", () => {
  assert.equal(C.linkSeguro("https://docs.jup.ag"), "https://docs.jup.ag");
  assert.equal(C.linkSeguro("http://x.io/a"), "http://x.io/a");
  assert.equal(C.linkSeguro("javascript:alert(1)"), null);
  assert.equal(C.linkSeguro("  "), null);
  assert.equal(C.linkSeguro(null), null);
});

test("linksDoToken: oficial primeiro, Tokenomist depois", () => {
  const a = C.linksDoToken({ id: "jupiter", links: { whitepaper: "https://station.jup.ag/docs", homepage: "https://jup.ag" } });
  assert.deepEqual(a.map(l => l.tipo), ["oficial", "tokenomist"]);
  assert.equal(a[0].url, "https://station.jup.ag/docs");
  assert.equal(a[1].url, "https://tokenomist.ai/jupiter");
  const b = C.linksDoToken({ id: "x", links: { whitepaper: "", homepage: "https://x.io" } });
  assert.equal(b[0].url, "https://x.io");
  const c = C.linksDoToken({ id: "y y", links: { whitepaper: "javascript:1", homepage: null } });
  assert.deepEqual(c.map(l => l.tipo), ["tokenomist"]);
  assert.equal(c[0].url, "https://tokenomist.ai/y%20y");
});

/* ===== Versão para iniciante (13/10/2026) =====
   Gabarito: ENA no print do dono — US$ 0,2098, 13,41 bi circulando,
   valor de mercado US$ 2,81 bi, 1,59 bi ainda a entrar, recorde US$ 1,52. */
const ENA = {
  simbolo: "ENA", precoAtual: 0.2098, precoAlvo: 1, circulante: 13.41e9,
  mcapHoje: 2.8134e9, mcapAlvo: 13.41e9, mcapAlvoCheio: 15e9,
  faltaEntrar: 1.59e9, pctCirculando: 0.894, acimaNoRanking: 11, maiorQueTodos: false,
  ath: 1.52, athDate: "2024-04-11T00:00:00.000Z"
};

test("descreverRegua fala em tamanho, não em ×", () => {
  assert.deepEqual(C.descreverRegua(5.4), { texto: "5,4 vezes o tamanho", barra: 1 });
  assert.deepEqual(C.descreverRegua(13.2), { texto: "13 vezes o tamanho", barra: 1 });
  assert.deepEqual(C.descreverRegua(1.02), { texto: "do mesmo tamanho", barra: 1 });
  assert.deepEqual(C.descreverRegua(0.21), { texto: "21% do tamanho", barra: 0.21 });
  assert.deepEqual(C.descreverRegua(0.008), { texto: "menos de 1% do tamanho", barra: 0.008 });
  assert.equal(C.descreverRegua(null), null);
  assert.equal(C.descreverRegua(0), null);
});

test("fmtPct perto de 100% não arredonda para 100", () => {
  assert.equal(C.fmtPct(0.996), "99,6%");
  assert.equal(C.fmtPct(0.004), "0,4%");
  assert.equal(C.fmtPct(0.89), "89%");
  assert.equal(C.fmtPct(1), "100%");
});

test("mesAno", () => {
  assert.equal(C.mesAno("2024-04-11T00:00:00.000Z"), "abr/2024");
  assert.equal(C.mesAno("2021-12-31T23:00:00.000Z"), "dez/2021");
  assert.equal(C.mesAno(null), null);
  assert.equal(C.mesAno("lixo"), null);
});

test("alvoExemplo: US$ 1 para quem custa centavos, o dobro para o resto", () => {
  assert.equal(C.alvoExemplo(0.2098), 1);
  assert.equal(C.alvoExemplo(160), 320);
  assert.equal(C.alvoExemplo(0), null);
});

test("resumoSimples da ENA a US$ 1", () => {
  assert.deepEqual(C.resumoSimples(ENA), [
    "Para o preço de ENA chegar a US$ 1,00, o projeto inteiro precisa ficar 4,8 vezes maior: de US$ 2,81 bi para US$ 13,41 bi.",
    "Hoje só 11 criptomoedas valem isso ou mais.",
    "E ainda faltam entrar 1,59 bi de tokens. Com eles no mercado, o mesmo preço exige um projeto de US$ 15,00 bi.",
    "ENA já passou desse preço: o recorde foi US$ 1,52, em abr/2024."
  ]);
});

test("resumoSimples: alvo acima do recorde, maior do mundo, sem desbloqueio", () => {
  const r = C.resumoSimples(Object.assign({}, ENA, {
    precoAlvo: 1000, mcapAlvo: 13.41e12, mcapAlvoCheio: 15e12,
    acimaNoRanking: 0, maiorQueTodos: true, pctCirculando: 1, faltaEntrar: 0
  }));
  assert.equal(r[1], "Nenhuma criptomoeda vale isso hoje: seria a maior do mundo.");
  assert.equal(r[2], "ENA nunca chegou a esse preço: o recorde foi US$ 1,52, em abr/2024.");
  assert.equal(r.length, 3);
});

test("resumoSimples: ranking grande sem 'só', 1 no singular, fora da lista omitido", () => {
  assert.equal(C.resumoSimples(Object.assign({}, ENA, { acimaNoRanking: 120 }))[1], "Hoje 120 criptomoedas valem isso ou mais.");
  assert.equal(C.resumoSimples(Object.assign({}, ENA, { acimaNoRanking: 1 }))[1], "Hoje só 1 criptomoeda vale isso ou mais.");
  const sem = C.resumoSimples(Object.assign({}, ENA, { acimaNoRanking: null, ath: null }));
  assert.deepEqual(sem.map(s => s.slice(0, 6)), ["Para o", "E aind"]);
});

test("resumoSimples: alvo abaixo do preço e igual ao preço", () => {
  assert.deepEqual(C.resumoSimples(Object.assign({}, ENA, { precoAlvo: 0.1, mcapAlvo: 1.341e9 })),
    ["Para o preço de ENA cair para US$ 0,10, o valor de mercado encolheria de US$ 2,81 bi para US$ 1,34 bi."]);
  assert.deepEqual(C.resumoSimples(Object.assign({}, ENA, { precoAlvo: 0.21, mcapAlvo: 2.816e9 })),
    ["Esse é praticamente o preço de hoje."]);
  assert.deepEqual(C.resumoSimples(Object.assign({}, ENA, { mcapAlvo: null })), []);
});

test("perguntaComum da ENA", () => {
  const p = C.perguntaComum(ENA);
  assert.equal(p.pergunta, "ENA custa US$ 0,2098. Se chegar a US$ 1,00, eu ganho 4,8 vezes?");
  assert.equal(p.resposta,
    "O seu dinheiro ficaria 4,8 vezes maior (US$ 100 virariam US$ 476,64). " +
    "Mas isso só acontece se o projeto inteiro ficar 4,8 vezes maior: de US$ 2,81 bi para US$ 13,41 bi. " +
    "Preço baixo não é desconto: ENA custa menos de US$ 1 porque existem 13,41 bi de tokens. " +
    "A pergunta certa é se alguém vai pagar US$ 13,41 bi por esse projeto.");
  assert.equal(C.perguntaComum(Object.assign({}, ENA, { precoAlvo: 0.1 })), null);
  const caro = C.perguntaComum(Object.assign({}, ENA, { precoAtual: 160, precoAlvo: 320, mcapHoje: 2e9, mcapAlvo: 4e9 }));
  assert.ok(!/desconto/.test(caro.resposta));
});

test("glossario: termos na ordem, com exemplo do token quando há dado", () => {
  const g = C.glossario({ simbolo: "ENA", preco: 0.2098, circulante: 13.41e9, total: 15e9, teto: 15e9,
    mcap: 2.81e9, fdv: 3.15e9, rank: 41, faltaEntrar: 1.59e9 });
  assert.deepEqual(g.map(t => t.id), ["valor-de-mercado", "circulacao", "oferta-total", "teto", "fdv",
    "desbloqueio", "queima", "emissao", "diluicao", "ranking", "liquidez"]);
  g.forEach(t => { assert.ok(t.termo && t.texto.length > 40, t.id); });
  assert.equal(g.find(t => t.id === "fdv").exemplo, "ENA: US$ 0,2098 × 15 bi tokens = US$ 3,15 bi.");
  assert.equal(g.find(t => t.id === "valor-de-mercado").exemplo, "ENA: US$ 0,2098 × 13,41 bi tokens = US$ 2,81 bi.");
  const vazio = C.glossario(null);
  assert.equal(vazio.length, 11);
  assert.ok(vazio.every(t => t.exemplo === null));
});

/* ===== Fonte reserva (CoinPaprika) quando a CoinGecko dá 429 =====
   Os ids mudam de fonte para fonte ("bitcoin" × "btc-bitcoin"), então
   régua, ranking e tradução de id se apoiam também no SÍMBOLO. */
test("acharNaRegua reconhece os projetos pelo id da CoinGecko ou pelo símbolo", () => {
  const cg = [{ id: "solana", symbol: "SOL", marketCap: 63e9 }, { id: "bitcoin", symbol: "BTC", marketCap: 2e12 }];
  assert.deepEqual(C.acharNaRegua(cg).map(p => p.id), ["bitcoin", "solana"]);
  const cp = [{ id: "btc-bitcoin", symbol: "BTC", marketCap: 2e12 }, { id: "hype-hyperliquid", symbol: "HYPE", marketCap: 18e9 },
              { id: "uni-uniswap", symbol: "UNI", marketCap: 4e9 }, { id: "x-sol-falso", symbol: "SOL", marketCap: 1 },
              { id: "sol-solana", symbol: "SOL", marketCap: 63e9 }];
  assert.deepEqual(C.acharNaRegua(cp).map(p => p.id), ["btc-bitcoin", "sol-solana", "uni-uniswap", "hype-hyperliquid"]);
  assert.deepEqual(C.acharNaRegua(null), []);
});

test("semOToken tira o próprio token da lista pelo id ou pelo símbolo", () => {
  const l = [{ id: "ondo-ondo-finance", symbol: "ONDO" }, { id: "btc-bitcoin", symbol: "BTC" }, { id: "ondo-finance", symbol: "ONDO" }];
  assert.deepEqual(C.semOToken(l, "ondo-finance", "ONDO").map(x => x.id), ["btc-bitcoin"]);
  assert.deepEqual(C.semOToken(l, "zzz", null).length, 3);
});

test("idPeloSimbolo escolhe o símbolo exato de melhor ranking", () => {
  const busca = [{ id: "ondo-ondo-us-dollar", symbol: "USDY", rank: 300 },
                 { id: "ondo-ondo-finance-fake", symbol: "ONDO", rank: 2000 },
                 { id: "ondo-ondo-finance", symbol: "ONDO", rank: 60 }];
  assert.equal(C.idPeloSimbolo(busca, "ondo"), "ondo-ondo-finance");
  assert.equal(C.idPeloSimbolo(busca, "XYZ"), null);
  assert.equal(C.idPeloSimbolo(null, "ONDO"), null);
});

test("enxugarFicha guarda a fonte", () => {
  assert.equal(C.enxugarFicha({ id: "a" }, "coinpaprika").fonte, "coinpaprika");
  assert.equal(C.enxugarFicha({ id: "a" }).fonte, "coingecko");
});

/* A CoinPaprika não manda mais circulating_supply (conferido na ONDO em
   13/10/2026): só total e máximo. Circulação = valor de mercado ÷ preço. */
test("enxugarFicha deduz a circulação do valor de mercado quando a fonte não manda", () => {
  const e = C.enxugarFicha({ id: "ondo-ondo", usd: 0.4667, marketCap: 2.27e9,
    supply: { circulating: null, total: 10e9, max: 10e9 } }, "coinpaprika");
  perto(e.supply.circulating, 4.864e9, 1e6);
  assert.equal(e.supply.total, 10e9);
  const semNada = C.enxugarFicha({ id: "x", usd: null, marketCap: 2e9, supply: { circulating: null, total: 1e9, max: null } });
  assert.equal(semNada.supply.circulating, null);
  const comDado = C.enxugarFicha({ id: "y", usd: 1, marketCap: 5, supply: { circulating: 3, total: 9, max: null } });
  assert.equal(comDado.supply.circulating, 3);
});
