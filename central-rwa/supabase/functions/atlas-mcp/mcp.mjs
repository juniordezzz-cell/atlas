export class ErroUsuario extends Error {}

export const VERSOES = ['2025-11-25', '2025-06-18', '2025-03-26'];

const INSTRUCOES = 'Atlas é o painel de portfólio cripto do dono. Nesta versão o conector só lê: carteiras, posições do Hold, caixa e histórico. Valores em dólar usam o último preço salvo pelo site. Não invente números que as ferramentas não devolveram.';

const rpcErro = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const rpcOk = (id, result) => ({ jsonrpc: '2.0', id, result });

export async function atenderMcp(msg, { ferramentas, contexto }) {
  if (Array.isArray(msg)) return { status: 400, corpo: rpcErro(null, -32600, 'Lotes não são aceitos.') };
  if (!msg || typeof msg !== 'object') return { status: 400, corpo: rpcErro(null, -32600, 'Requisição JSON-RPC inválida.') };
  if (msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return { status: 400, corpo: rpcErro(msg.id ?? null, -32600, 'Requisição JSON-RPC inválida.') };
  if (!Object.hasOwn(msg, 'id') || msg.id === null) return { status: 202, corpo: null };
  const { id, method, params } = msg;

  if (method === 'initialize') {
    const pedida = params?.protocolVersion;
    return { status: 200, corpo: rpcOk(id, {
      protocolVersion: VERSOES.includes(pedida) ? pedida : VERSOES[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'atlas', title: 'Atlas', version: '0.1.0' },
      instructions: INSTRUCOES,
    }) };
  }
  if (method === 'ping') return { status: 200, corpo: rpcOk(id, {}) };
  if (method === 'tools/list') {
    return { status: 200, corpo: rpcOk(id, { tools: ferramentas.map((f) => ({
      name: f.nome, title: f.titulo, description: f.descricao, inputSchema: f.schema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    })) }) };
  }
  if (method === 'tools/call') {
    const f = ferramentas.find((x) => x.nome === params?.name);
    if (!f) return { status: 200, corpo: rpcErro(id, -32602, `Ferramenta desconhecida: ${params?.name}`) };
    const args = params?.arguments ?? {};
    if (typeof args !== 'object' || Array.isArray(args)) return { status: 200, corpo: rpcErro(id, -32602, 'arguments precisa ser um objeto.') };
    try {
      const r = await f.executar(args, contexto);
      return { status: 200, corpo: rpcOk(id, { content: [{ type: 'text', text: r.texto }], structuredContent: r.dados, isError: false }) };
    } catch (e) {
      const texto = e instanceof ErroUsuario ? e.message : 'Falha interna ao ler o Atlas. Nada foi alterado.';
      if (!(e instanceof ErroUsuario)) console.error('atlas-mcp ferramenta', f.nome, String(e?.message || e).slice(0, 120));
      return { status: 200, corpo: rpcOk(id, { content: [{ type: 'text', text: texto }], isError: true }) };
    }
  }
  return { status: 200, corpo: rpcErro(id, -32601, `Método não suportado: ${method}`) };
}
