// ATLAS · gera a Escada e a Estratégia de Pool a partir da mesma fonte:
//   node Ferramentas/_fonte-quadro/build.js
// Saída: Ferramentas/escada-dca/index.html e Ferramentas/estrategia-de-pool/index.html
// Registro: docs/ferramentas-bancada-2026-11-08.md
const fs = require('fs'), path = require('path');
const dir = __dirname;
const src = fs.readFileSync(path.join(dir, 'quadro-src.html'), 'utf8');
const snap = fs.readFileSync(path.join(dir, 'snap.json'), 'utf8');
const tools = [
  { tool: 'dca', pasta: 'escada-dca', title: 'Escada · DCA e Preço Médio', h1: 'Escada <span>· DCA e preço médio</span>',
    desc: 'Escada do ATLAS: divida a entrada em 2 a 5 compras, veja o preço médio no gráfico real e compare com comprar tudo de uma vez.' },
  { tool: 'pool', pasta: 'estrategia-de-pool', title: 'Estratégia de Pool', h1: 'Estratégia de <span>Pool</span>',
    desc: 'Estratégia de Pool do ATLAS: monte a faixa de uma pool concentrada para comprar na descida, vender na subida, ter renda em dólar ou escolher a proporção.' },
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
