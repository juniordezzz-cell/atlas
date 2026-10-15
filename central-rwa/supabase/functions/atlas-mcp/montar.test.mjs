import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { montar } from './montar.mjs';

test('bundle único, sem import/export, termina em Deno.serve', () => {
  const b = montar();
  assert.doesNotMatch(b, /^\s*import\s/m);
  assert.doesNotMatch(b, /^export\s/m);
  assert.doesNotMatch(b, /storeMemoria/);
  assert.match(b, /Deno\.serve\(createHandler\(\{ env: Deno\.env, fetcher: fetch \}\)\);\s*$/);
});

test('bundle carrega (sem nomes repetidos) e responde metadados', async () => {
  const codigo = montar().replace(/Deno\.serve\([\s\S]*$/, 'export { createHandler };\n');
  const arquivo = join(mkdtempSync(join(tmpdir(), 'atlas-mcp-')), 'bundle.mjs');
  writeFileSync(arquivo, codigo);
  const { createHandler } = await import(pathToFileURL(arquivo).href);
  const env = { get: (k) => ({ ATLAS_MCP_BASE_URL: 'https://x/functions/v1/atlas-mcp', ATLAS_MCP_SECRET: 's'.repeat(40), SUPABASE_URL: 'https://db', SUPABASE_SERVICE_ROLE_KEY: 'k' })[k] };
  const r = await createHandler({ env, fetcher: fetch })(new Request('https://x/functions/v1/atlas-mcp/.well-known/oauth-authorization-server'));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).issuer, 'https://x/functions/v1/atlas-mcp');
});
