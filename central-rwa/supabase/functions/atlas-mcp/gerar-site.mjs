import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..', '..', '..');

// Ordem de carga igual à das páginas do site.
export const ARQUIVOS_SITE = [
  'wallets/walletStore.js', 'wallets/walletTypes.js', 'wallets/walletLedger.js',
  'wallets/walletManager.js', 'wallets/walletCaixa.js', 'hold/js/state.js',
];

export function gerarCodigoSite() {
  const partes = ARQUIVOS_SITE.map((f) => `// ---- ${f} ----\n${readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n')}\n;`);
  return '// GERADO por gerar-site.mjs a partir dos arquivos do site. Não edite à mão.\n'
    + '// Mudou algum desses arquivos? Rode: node central-rwa/supabase/functions/atlas-mcp/gerar-site.mjs\n'
    + 'export function codigoSite(window, localStorage) {\n"use strict";\n'
    + partes.join('\n')
    + '\nreturn window;\n}\n';
}

export function escreverCodigoSite() {
  writeFileSync(join(AQUI, 'site-gerado.mjs'), gerarCodigoSite());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  escreverCodigoSite();
  console.log('site-gerado.mjs atualizado');
}
