// ATLAS · gera core/dados/tokens-top.js (catálogo local dos maiores tokens)
//   node core/dados/gerar-tokens-top.js
// Fonte: Ferramentas/_fonte-quadro/snap.json (o mesmo instantâneo da Escada
// e da Estratégia de Pool). Formato de cada linha: [id, sigla, nome,
// sufixo da imagem na CoinGecko, posição no ranking].
// Para atualizar: renove o snap.json e rode este script de novo.
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..', '..');
const snap = JSON.parse(fs.readFileSync(path.join(raiz, 'Ferramentas/_fonte-quadro/snap.json'), 'utf8'));
const lista = snap.c.map(r => [r[0], r[1], r[2], r[3], r[6]]);
const js = '/* ATLAS · catálogo local dos maiores tokens (gerado por core/dados/gerar-tokens-top.js;\n' +
  '   não edite à mão). Usado pela busca do roteador (core/atlas-dados.js) sem rede. */\n' +
  'window.ATLAS_TOKENS_TOP = ' + JSON.stringify({ quando: snap.t, lista }) + ';\n';
fs.writeFileSync(path.join(__dirname, 'tokens-top.js'), js);
console.log('tokens:', lista.length, 'bytes:', js.length);
