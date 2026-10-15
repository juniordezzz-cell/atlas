const test = require('node:test');
const assert = require('node:assert/strict');
const { concluirAutorizacao } = require('./conectar-claude.js');

const user = { getIdToken: async () => 'id-token-firebase' };

test('envia req e idToken para a função e devolve o retorno do Claude', async () => {
  let chamada;
  const fetcher = async (url, init) => { chamada = { url, init }; return Response.json({ redirect: 'https://claude.ai/api/mcp/auth_callback?code=abc&state=s' }); };
  const destino = await concluirAutorizacao({ req: 'pedido.assinado', user, fetcher, baseFuncao: 'https://opaimjoimbndwuwkxuva.supabase.co/' });
  assert.equal(destino, 'https://claude.ai/api/mcp/auth_callback?code=abc&state=s');
  assert.equal(chamada.url, 'https://opaimjoimbndwuwkxuva.supabase.co/functions/v1/atlas-mcp/authorize/concluir');
  assert.deepEqual(JSON.parse(chamada.init.body), { req: 'pedido.assinado', idToken: 'id-token-firebase' });
});

test('mostra a mensagem de erro da função', async () => {
  const fetcher = async () => Response.json({ error: 'Esta conta não tem permissão para conectar o Claude ao Atlas.' }, { status: 403 });
  await assert.rejects(() => concluirAutorizacao({ req: 'r', user, fetcher, baseFuncao: 'https://x' }), /não tem permissão/);
});

test('recusa link sem pedido e retorno fora do Claude', async () => {
  await assert.rejects(() => concluirAutorizacao({ req: '', user, fetcher: async () => { throw new Error('não deveria chamar'); }, baseFuncao: 'https://x' }), /Link incompleto/);
  const fetcher = async () => Response.json({ redirect: 'https://evil.example/cb?code=abc' });
  await assert.rejects(() => concluirAutorizacao({ req: 'r', user, fetcher, baseFuncao: 'https://x' }), /retorno inesperado/);
});
