import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../migrations/20261015000001_atlas_mcp_oauth.sql'), 'utf8');

// O Supabase concede EXECUTE a anon/authenticated por default privileges; revogar só de public
// não basta (ver 20260927000002_scanner_chat_privileges.sql). Sem isso, a chave anon pública
// conseguiria gravar um token de acesso para o uid do dono.
test('RPCs e tabelas do conector revogam anon e authenticated, não só public', () => {
  assert.match(sql, /revoke all on function public\.%s from public, anon, authenticated/);
  assert.match(sql, /revoke all on all tables in schema atlas_mcp from public, anon, authenticated/);
  assert.match(sql, /revoke all on schema atlas_mcp from public, anon, authenticated/);
});
