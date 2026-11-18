// ATLAS · gera o DCA · Preço Médio (pasta escada-dca/) e as Estratégias de Pools de Liquidez a partir da mesma fonte:
//   node Ferramentas/_fonte-quadro/build.js
// Saída: Ferramentas/escada-dca/index.html e Ferramentas/estrategia-de-pool/index.html
// Registro: docs/ferramentas-bancada-2026-11-08.md
const fs = require('fs'), path = require('path');
const dir = __dirname;
const src = fs.readFileSync(path.join(dir, 'quadro-src.html'), 'utf8');
/* Retrato embutido (18/11/2026): a lista dos 500 tokens vai inteira, mas o
   gráfico de 7 dias de reserva (usado só quando a cotação ao vivo falha) fica
   para os 80 maiores e os favoritos padrão, com 4 algarismos. O HTML caía de
   827 KB para ~210 KB. O snap.json continua completo. */
const snapCheio = JSON.parse(fs.readFileSync(path.join(dir, 'snap.json'), 'utf8'));
const watchPadrao = (src.match(/const DEFAULT_WATCH=\[([^\]]*)\]/) || [, ''])[1].match(/'([^']+)'/g) || [];
const manter = new Set(watchPadrao.map(s => s.replace(/'/g, '')));
const sig = v => (typeof v === 'number' && isFinite(v)) ? Number(v.toPrecision(4)) : v;
const snap = JSON.stringify({ t: snapCheio.t, c: snapCheio.c.map(x => {
  const [id, sym, nome, img, preco, ch, rank, spark] = x;
  const guarda = (rank && rank <= 80) || manter.has(id);
  return [id, sym, nome, img, preco, ch, rank, guarda && Array.isArray(spark) ? spark.map(sig) : []];
}) });
const tools = [
  { tool: 'dca', pasta: 'escada-dca', title: 'DCA · Preço Médio', h1: 'DCA <span>· Preço Médio</span>',
    desc: 'DCA · Preço Médio do ATLAS: divida a entrada em 2 a 5 compras, veja o preço médio no gráfico real e compare uma compra só com compras em etapas.' },
  { tool: 'pool', pasta: 'estrategia-de-pool', title: 'Estratégias de Pools de Liquidez', h1: 'Estratégias de <span>Pools de Liquidez</span>',
    desc: 'Estratégias de Pools de Liquidez do ATLAS: monte a faixa de uma pool concentrada para comprar na descida, vender na subida, ter renda em dólar ou escolher a proporção.' },
];
for (const t of tools) {
  const out = src
    .replace('__SNAP__', () => snap)
    .replace("'__TOOL__'", `'${t.tool}'`)
    .replace('__TITLE__', t.title)
    .replace('__DESC__', t.desc)
    .replace('__H1__', t.h1);
  const destino = path.join(dir, '..', t.pasta);
  fs.mkdirSync(destino, { recursive: true });
  fs.writeFileSync(path.join(destino, 'index.html'), out);
  console.log('gerado', t.pasta + '/index.html');
}
