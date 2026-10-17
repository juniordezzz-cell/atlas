import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
// Ordem de dependência. fakes.mjs e *.test.mjs ficam de fora de propósito.
const ORDEM = ['crypto.mjs', 'mcp.mjs', 'store.mjs', 'firestore.mjs', 'leitura.mjs', 'site-gerado.mjs', 'motor.mjs', 'operacoes.mjs', 'previa.mjs', 'ferramentas.mjs', 'oauth.mjs', 'handler.mjs'];

export function montar() {
  const partes = ORDEM.map((nome) => {
    const fonte = readFileSync(join(AQUI, nome), 'utf8');
    if (/^\s*import\s[^;]*?from\s+['"](?!\.\/)/m.test(fonte)) throw new Error(`${nome}: import externo não é suportado no bundle`);
    const limpo = fonte
      .replace(/^\s*import\s[\s\S]*?from\s+['"]\.\/[^'"]+['"];?[ \t]*$/gm, '')
      .replace(/^export\s+(?=(async\s+)?function|const|class|let)/gm, '');
    return `// ---- ${nome} ----\n${limpo.trim()}\n`;
  });
  return '// GERADO por build.mjs a partir dos módulos de atlas-mcp. Não edite à mão.\n'
    + partes.join('\n')
    + '\nDeno.serve(createHandler({ env: Deno.env, fetcher: fetch }));\n';
}
