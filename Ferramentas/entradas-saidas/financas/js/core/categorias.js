/* ============================================================
   categorias.js — de "uber" para "Transporte"
   ------------------------------------------------------------
   Dicionário de palavras (sem acento, minúsculas) → categoria.
   Combinado com o dono em 23/10/2026:
     • mercadinho, venda, padaria e bar são UMA categoria;
     • mercado (supermercado) é outra;
     • gasolina, Uber, 99, táxi, ônibus → Transporte.
   O que o dono ensina ("99 é transporte") fica em
   estado.aprendizado e vale antes do dicionário.
   ============================================================ */

export function normalizar(texto) {
  return String(texto == null ? "" : texto)
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const MERCADINHO = "Mercadinho, bar e padaria";

/* Ordem = ordem das sugestões quando não há histórico. */
export const CATEGORIAS_SAIDA = {
  "Transporte": ["uber", "99", "99pop", "taxi", "onibus", "metro", "trem", "brt", "van", "passagem",
    "gasolina", "combustivel", "etanol", "diesel", "gnv", "abasteci", "abastecer", "posto", "estacionamento",
    "pedagio", "mototaxi", "moto taxi", "corrida", "oficina", "mecanico", "pneu", "ipva", "indriver", "cabify"],
  [MERCADINHO]: ["mercadinho", "venda", "vendinha", "padaria", "pao", "paes", "bar", "boteco", "buteco",
    "conveniencia", "quitanda", "mercearia", "cerveja", "cachaca", "bebida", "refrigerante", "acougue", "leite"],
  "Mercado": ["mercado", "supermercado", "atacadao", "assai", "atacarejo", "carrefour", "feira",
    "hortifruti", "sacolao", "compras do mes", "rancho"],
  "Comer fora": ["restaurante", "lanche", "lanchonete", "ifood", "pizza", "pizzaria", "hamburguer", "hamburger",
    "sanduiche", "acai", "sorvete", "almoco", "janta", "jantar", "cafe", "espetinho", "pastel", "coxinha",
    "salgado", "marmita", "quentinha", "delivery", "churrasco"],
  "Contas da casa": ["luz", "energia", "agua", "internet", "wifi", "aluguel", "condominio", "gas", "botijao",
    "telefone", "recarga", "iptu", "conta de celular", "plano do celular"],
  "Assinaturas": ["netflix", "spotify", "prime video", "amazon prime", "disney", "hbo", "globoplay", "youtube",
    "deezer", "icloud", "chatgpt", "claude", "assinatura", "streaming"],
  "Saúde": ["farmacia", "drogaria", "remedio", "remedios", "medico", "consulta", "exame", "dentista",
    "plano de saude", "hospital", "academia", "psicologo"],
  "Compras": ["roupa", "roupas", "sapato", "tenis", "loja", "shopee", "shein", "mercado livre", "amazon",
    "magalu", "aliexpress", "presente", "eletronico"],
  "Lazer": ["cinema", "show", "festa", "viagem", "jogo", "passeio", "ingresso", "balada", "praia", "hotel"],
  "Educação": ["curso", "faculdade", "escola", "livro", "material escolar", "apostila"],
  "Cuidados pessoais": ["cabelo", "barbearia", "barbeiro", "salao", "manicure", "unha", "perfume",
    "maquiagem", "depilacao"],
  "Pets": ["racao", "veterinario", "pet", "petshop", "banho e tosa"],
  "Cartão e dívidas": ["fatura", "cartao", "emprestimo", "parcela", "divida", "juros", "financiamento"],
  "Família e amigos": ["mae", "pai", "filho", "filha", "esposa", "marido", "namorada", "namorado",
    "irmao", "irma", "amigo", "amiga", "vo", "avo"],
  "Outros": []
};

export const CATEGORIAS_ENTRADA = {
  "Salário": ["salario", "ordenado", "semana", "semanal", "quinzena", "pagamento da semana"],
  "Trabalho extra": ["freela", "freelance", "bico", "servico", "trampo", "extra", "diaria"],
  "Vendas": ["vendi"],
  "Reembolso": ["reembolso", "estorno", "devolveram", "devolucao"],
  "Recebimento": []
};

/* Corretoras e lugares de investir → nome bonito do destino. */
export const DESTINOS = {
  "binance": "Binance", "bybit": "Bybit", "okx": "OKX", "coinbase": "Coinbase", "kraken": "Kraken",
  "kucoin": "KuCoin", "mexc": "MEXC", "bitget": "Bitget", "gate io": "Gate.io", "mercado bitcoin": "Mercado Bitcoin",
  "foxbit": "Foxbit", "novadax": "NovaDAX", "metamask": "MetaMask", "corretora": "Corretora",
  "xp": "XP", "clear": "Clear", "btg": "BTG", "nuinvest": "NuInvest",
  "tesouro direto": "Tesouro Direto", "tesouro": "Tesouro Direto", "cdb": "CDB", "poupanca": "Poupança",
  "caixinha": "Caixinha", "cofrinho": "Cofrinho", "reserva de emergencia": "Reserva de emergência",
  "acoes": "Ações", "bolsa de valores": "Bolsa",
  "cripto": "Cripto", "bitcoin": "Bitcoin", "btc": "Bitcoin", "usdt": "USDT", "ethereum": "Ethereum"
};

/* Procura frase inteira (com borda de palavra) no texto normalizado.
   As frases mais longas primeiro: "mercado livre" antes de "mercado". */
function achar(texto, mapa) {
  const t = ` ${normalizar(texto).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ")} `;
  const pares = [];
  for (const [nome, palavras] of Object.entries(mapa)) {
    for (const p of palavras) pares.push([p, nome]);
  }
  pares.sort((a, b) => b[0].length - a[0].length);
  for (const [p, nome] of pares) {
    if (t.includes(` ${p} `)) return { nome, palavra: p };
  }
  return null;
}

export function palavrasDe(texto) {
  return normalizar(texto).replace(/[^a-z0-9 ]/g, " ").split(" ").filter(Boolean);
}

const VAZIAS = new Set(["de", "do", "da", "dos", "das", "no", "na", "nos", "nas", "num", "numa", "em", "um",
  "uma", "o", "a", "os", "as", "com", "pra", "pro", "para", "por", "pelo", "pela", "e", "que", "meu", "minha"]);

/* Palavras que valem ensinar ("corrida no 99" → ["corrida", "99"]). */
export function palavrasChave(texto) {
  return palavrasDe(texto).filter((p) => !VAZIAS.has(p) && p.length >= 2);
}

/* { categoria, palavra } ou { categoria: null } */
export function categoriaDe(descricao, aprendizado = {}) {
  const chave = normalizar(descricao);
  if (chave && aprendizado[chave]) return { categoria: aprendizado[chave], palavra: chave };
  for (const p of palavrasChave(descricao)) {
    if (aprendizado[p]) return { categoria: aprendizado[p], palavra: p };
  }
  const achou = achar(descricao, CATEGORIAS_SAIDA);
  return achou ? { categoria: achou.nome, palavra: achou.palavra } : { categoria: null };
}

export function categoriaDeEntrada(descricao) {
  const achou = achar(descricao, CATEGORIAS_ENTRADA);
  return achou ? achou.nome : "Recebimento";
}

export function destinoDe(texto) {
  const achou = achar(texto, Object.fromEntries(Object.entries(DESTINOS).map(([k, v]) => [k, [k]])));
  return achou ? DESTINOS[achou.palavra] : null;
}

/* Dicas para palavras genéricas, que não dá para adivinhar sozinho. */
const DICAS = {
  pagamento: ["Contas da casa", "Cartão e dívidas"], boleto: ["Contas da casa", "Cartão e dívidas"],
  conta: ["Contas da casa", "Cartão e dívidas"], pix: ["Família e amigos", "Compras"],
  transferencia: ["Família e amigos", "Cartão e dívidas"], compra: ["Compras", "Mercado"]
};

/* Até 3 categorias prováveis (dica da palavra, depois as mais usadas,
   depois a ordem do dicionário) + "Outros" no fim. */
export function sugestoes(descricao, lancamentos = []) {
  const lista = [];
  const por = (c) => { if (c && c !== "Outros" && !lista.includes(c) && lista.length < 3) lista.push(c); };
  for (const p of palavrasDe(descricao)) (DICAS[p] || []).forEach(por);
  const uso = {};
  for (const l of lancamentos) if (l.tipo === "saida" && l.categoria) uso[l.categoria] = (uso[l.categoria] || 0) + 1;
  Object.entries(uso).sort((a, b) => b[1] - a[1]).forEach(([c]) => por(c));
  Object.keys(CATEGORIAS_SAIDA).forEach(por);
  return [...lista, "Outros"];
}

/* Nomes de marca com a grafia certa na descrição. */
export const GRAFIA = {
  uber: "Uber", "99": "99", ifood: "iFood", netflix: "Netflix", spotify: "Spotify", shopee: "Shopee",
  shein: "Shein", amazon: "Amazon", binance: "Binance", pix: "Pix", "99pop": "99Pop"
};

/* Todas as categorias conhecidas, para reconhecer a resposta do dono. */
export function todasCategorias(extra = []) {
  return [...new Set([...Object.keys(CATEGORIAS_SAIDA), ...extra])];
}
