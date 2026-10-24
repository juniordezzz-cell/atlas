/* ============================================================
   conversa.js — o Oráculo do Finanças
   ------------------------------------------------------------
   Lança o que o dono fala, pergunta só quando não entende, aprende
   com a resposta e desfaz. Os números saem sempre do livro-caixa
   (livro.js); o Oráculo nunca inventa valor.

   criarConversa({ ler, salvar, hoje }) → { responder(texto) }
     ler()     → estado (store.js v2), uma cópia
     salvar(s) → grava
     hoje()    → "AAAA-MM-DD"
   responder devolve { texto, sugestoes?: string[], mudou: boolean }.
   É o mesmo motor para a aba Oráculo, a barra do Painel e o painel
   flutuante do Atlas (AtlasOraculo.registerTool).
   ============================================================ */
import { interpretar, temValor } from "./interpretador.js";
import { lerExtrato, pareceExtrato, chaveNome, chaveRepetido } from "./extrato.js";
import { adicionar, remover } from "./store.js";
import { caixaAte, resumoMes, investidoPorDestino, ordenar } from "./livro.js";
import { formatarCentavos } from "./dinheiro.js";
import {
  categoriaDe, categoriaDeEntrada, palavrasChave, sugestoes, todasCategorias, normalizar
} from "./categorias.js";
import { todayKey, somarDias, somarMeses, nomeMes } from "./datas.js";

const GENERICAS = new Set(["pagamento", "conta", "contas", "boleto", "pix", "compra", "compras", "transferencia",
  "gasto", "coisa", "coisas", "negocio", "lancamento"]);

const R = (c) => formatarCentavos(c);

/* nomes que não ensinam nada sozinhos (empresa, sobrenome comum) */
const NOMES_COMUNS = new Set(["google", "brasil", "pagamentos", "banco", "conta", "pix", "loja", "comercio",
  "posto", "mercado", "supermercado", "silva", "santos", "souza", "oliveira", "pereira", "lima", "costa"]);

function quando(data, hoje) {
  if (data === hoje) return "hoje";
  if (data === somarDias(hoje, -1)) return "ontem";
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

function linha(l, hoje) {
  const dia = quando(l.data, hoje);
  if (l.tipo === "entrada") return `+${R(l.centavos)} · ${l.descricao} · ${dia}`;
  if (l.tipo === "saida") {
    const cat = l.categoria && l.categoria !== l.descricao ? ` · ${l.categoria}` : "";
    return `−${R(l.centavos)} · ${l.descricao}${cat} · ${dia}`;
  }
  if (l.tipo === "investimento") return `${R(l.centavos)} → ${l.destino} (investimento, não é despesa) · ${dia}`;
  if (l.tipo === "resgate") return `${R(l.centavos)} ← ${l.destino} (voltou para o caixa) · ${dia}`;
  if (l.tipo === "transferencia") return `${l.sentido === "saida" ? "−" : "+"}${R(l.centavos)} ⇄ ${l.descricao} (entre contas suas, não é despesa) · ${dia}`;
  return `Caixa definido em ${R(l.centavos)} · ${dia}`;
}

function ultimoAcerto(lancs) {
  return ordenar(lancs).filter((l) => l.tipo === "saldo").pop() || null;
}

export function criarConversa({ ler, salvar, hoje = todayKey }) {
  let pendentes = [];   // itens esperando tipo ou categoria, em ordem
  let ultimoLote = [];  // ids lançados na última resposta

  function caixaTexto(estado) {
    const c = caixaAte(estado.lancamentos);
    return c < 0
      ? `Caixa agora: ${R(c)}. Atenção: o caixa ficou negativo.`
      : `Caixa agora: ${R(c)}`;
  }

  function lancar(estado, item) {
    const lanc = {
      data: item.data, tipo: item.tipo, centavos: item.centavos,
      descricao: item.descricao, categoria: item.categoria || null,
      ...(item.destino ? { destino: item.destino } : {}),
      ...(item.sentido ? { sentido: item.sentido } : {}),
      ...(item.origem ? { origem: item.origem } : {})
    };
    adicionar(estado, lanc);
    return estado.lancamentos[estado.lancamentos.length - 1];
  }

  function perguntaDe(item, estado) {
    if (!item.tipo) {
      return {
        texto: `"${item.descricao}" (${R(item.centavos)}): é ganho, despesa ou investimento?`,
        sugestoes: ["Ganho", "Despesa", "Investimento", "Cancelar"]
      };
    }
    return {
      texto: `Em qual categoria entra "${item.descricao}" (${R(item.centavos)})? Toque numa opção ou escreva o nome.`,
      sugestoes: [...sugestoes(item.descricao, estado.lancamentos), "Cancelar"]
    };
  }

  /* Lança o que está completo, segura o resto e monta a resposta. */
  function processar(itens, estado, prefixo = []) {
    const hojeK = hoje();
    const feitos = [];
    for (const item of itens) {
      const falta = !item.tipo || (item.tipo === "saida" && !item.categoria);
      if (falta) pendentes.push(item);
      else feitos.push(lancar(estado, item));
    }
    if (feitos.length) {
      salvar(estado);
      ultimoLote = feitos.map((l) => l.id);
    }
    const linhas = [...prefixo];
    if (feitos.length) {
      linhas.push(feitos.length === 1 ? "Anotado:" : `Anotei ${feitos.length}:`);
      feitos.forEach((l) => linhas.push(linha(l, hojeK)));
      linhas.push(caixaTexto(estado));
      // "tenho 800" hoje já inclui o que entrou ontem: o retroativo vai
      // para o histórico do mês, mas não mexe no caixa de agora
      const acerto = ultimoAcerto(estado.lancamentos);
      if (acerto && feitos.some((l) => l.tipo !== "saldo" && l.data < acerto.data)) {
        linhas.push(`(É de antes do seu acerto de caixa de ${quando(acerto.data, hojeK)} (${R(acerto.centavos)}), então conta no mês mas não muda o caixa de agora.)`);
      }
    }
    if (pendentes.length) {
      const p = perguntaDe(pendentes[0], estado);
      linhas.push(p.texto);
      return { texto: linhas.join("\n"), sugestoes: p.sugestoes, mudou: feitos.length > 0 };
    }
    return { texto: linhas.join("\n"), sugestoes: feitos.length ? ["Desfazer"] : [], mudou: feitos.length > 0 };
  }

  function responderPendente(texto, estado) {
    const item = pendentes[0];
    const n = normalizar(texto).replace(/[!?.]/g, "").trim();
    if (/^(cancelar|cancela|deixa|deixa pra la|esquece|nao|nada)$/.test(n)) {
      pendentes.shift();
      const r = pendentes.length ? processar([], estado, [`Ok, não lancei "${item.descricao}".`])
        : { texto: `Ok, não lancei "${item.descricao}".`, sugestoes: [], mudou: false };
      return r;
    }
    if (!item.tipo) {
      if (/^(ganho|entrou|entrada|recebi|ganhei)/.test(n)) { item.tipo = "entrada"; item.categoria = categoriaDeEntrada(item.descricao); }
      else if (/^(despesa|saiu|saida|gastei|paguei|gasto)/.test(n)) { item.tipo = "saida"; item.categoria = categoriaDe(item.descricao, estado.aprendizado).categoria; }
      else if (/^(investi|investimento|apliquei)/.test(n)) { item.tipo = "investimento"; item.destino = "Investimentos"; item.categoria = "Investimento"; }
      else return { ...perguntaDe(item, estado), mudou: false };
      pendentes.shift();
      return processar([item], estado);
    }
    // categoria: uma das conhecidas, ou um nome novo que o dono escreveu
    const usadas = estado.lancamentos.map((l) => l.categoria).filter(Boolean);
    const conhecida = todasCategorias(usadas).find((c) => normalizar(c) === n) ||
      todasCategorias(usadas).find((c) => normalizar(c).startsWith(n) && n.length >= 3);
    const nome = conhecida || texto.trim().replace(/\s+/g, " ").slice(0, 40).replace(/^./, (c) => c.toUpperCase());
    item.categoria = nome;
    for (const p of palavrasChave(item.descricao)) {
      if (!GENERICAS.has(p) && !/^\d+$/.test(p) || p === "99") estado.aprendizado[p] = nome;
    }
    pendentes.shift();
    return processar([item], estado);
  }

  /* Extrato colado: lança tudo de uma vez, sem repetir o que já está
     lançado, e aprende o nome → categoria de cada despesa. */
  function importar(texto, estado, prefixo = []) {
    const hojeK = hoje();
    const r = lerExtrato(texto, { hoje: hojeK, aprendizado: estado.aprendizado });
    if (!r.itens.length) {
      return { texto: [...prefixo, "Não consegui ler nenhum lançamento desse extrato.", ...r.erros.slice(0, 3)].join("\n"), sugestoes: [], mudou: false };
    }
    // sem o tipo e a categoria: um lançamento que o dono corrigiu
    // (transferência → despesa) continua sendo "o mesmo" do extrato
    const chave = (l) => chaveRepetido(l);
    const ja = {};
    estado.lancamentos.forEach((l) => { ja[chave(l)] = (ja[chave(l)] || 0) + 1; });
    const feitos = [];
    let repetidos = 0;
    for (const item of r.itens) {
      const k = chave(item);
      if (ja[k]) { ja[k]--; repetidos++; continue; }
      // origem "extrato": se o mesmo extrato for importado no outro
      // aparelho, a sincronia reconhece e não duplica
      feitos.push(lancar(estado, { ...item, origem: "extrato" }));
      if (item.tipo === "saida" && item.categoria && item.categoria !== "A definir") {
        const nome = chaveNome(item.descricao);
        const primeiro = nome.split(" ")[0];
        if (nome && !estado.aprendizado[nome]) estado.aprendizado[nome] = item.categoria;
        if (primeiro && primeiro.length >= 3 && !NOMES_COMUNS.has(primeiro) && !estado.aprendizado[primeiro]) estado.aprendizado[primeiro] = item.categoria;
      }
    }
    salvar(estado);
    ultimoLote = feitos.map((l) => l.id);

    const total = (t) => feitos.filter((l) => l.tipo === t).reduce((a, l) => a + l.centavos, 0);
    const qtd = (t) => feitos.filter((l) => l.tipo === t).length;
    const datas = r.itens.map((i) => i.data).sort();
    const linhas = [...prefixo];
    if (feitos.length) {
      linhas.push(`Importei ${feitos.length} ${feitos.length === 1 ? "lançamento" : "lançamentos"} do extrato (${quando(datas[0], hojeK)} a ${quando(datas[datas.length - 1], hojeK)}):`);
      if (qtd("entrada")) linhas.push(`Ganhos: ${R(total("entrada"))} (${qtd("entrada")})`);
      if (qtd("saida")) linhas.push(`Despesas: ${R(total("saida"))} (${qtd("saida")})`);
      const tr = feitos.filter((l) => l.tipo === "transferencia");
      if (tr.length) {
        const liquido = tr.reduce((a, l) => a + (l.sentido === "saida" ? l.centavos : -l.centavos), 0);
        linhas.push(`Transferências entre contas suas: ${R(Math.abs(liquido))} ${liquido >= 0 ? "saíram" : "entraram"} (${tr.length}, não contam como despesa)`);
      }
      const indefinidos = feitos.filter((l) => l.categoria === "A definir").length;
      if (indefinidos) linhas.push(`${indefinidos} ${indefinidos === 1 ? "ficou" : "ficaram"} em "A definir": toque em cada um em Lançamentos para escolher a categoria.`);
    } else {
      linhas.push("Tudo desse extrato já estava lançado. Não repeti nada.");
    }
    if (feitos.length && repetidos) linhas.push(`${repetidos} já ${repetidos === 1 ? "estava lançado e foi ignorado" : "estavam lançados e foram ignorados"}.`);
    if (r.erros.length) linhas.push(`Não lancei ${r.erros.length}: ${r.erros.slice(0, 3).join(" ")}`);
    if (feitos.length) {
      linhas.push(caixaTexto(estado));
      const acerto = ultimoAcerto(estado.lancamentos);
      if (acerto && feitos.some((l) => l.data < acerto.data)) {
        linhas.push(`(O que é de antes do seu acerto de caixa de ${quando(acerto.data, hojeK)} (${R(acerto.centavos)}) conta nos meses, mas não muda o caixa de agora.)`);
      }
    }
    return { texto: linhas.join("\n"), sugestoes: feitos.length ? ["Desfazer"] : [], mudou: feitos.length > 0 };
  }

  function desfazer(estado) {
    let ids = ultimoLote.filter((id) => estado.lancamentos.some((l) => l.id === id));
    if (!ids.length && estado.lancamentos.length) {
      const ultimo = estado.lancamentos.reduce((a, b) => (Number(b.criadoEm) > Number(a.criadoEm) ? b : a));
      ids = [ultimo.id];
    }
    if (!ids.length) return { texto: "Não tem nada para desfazer.", sugestoes: [], mudou: false };
    const hojeK = hoje();
    const tirados = estado.lancamentos.filter((l) => ids.includes(l.id));
    ids.forEach((id) => remover(estado, id));
    salvar(estado);
    ultimoLote = [];
    return {
      texto: ["Desfeito:", ...tirados.map((l) => linha(l, hojeK)), caixaTexto(estado)].join("\n"),
      sugestoes: [], mudou: true
    };
  }

  function perguntar(texto, estado) {
    const n = normalizar(texto).replace(/[!?.]/g, " ").replace(/\s+/g, " ").trim();
    const hojeK = hoje();
    const mesAtual = hojeK.slice(0, 7);
    const mes = /\bmes passado\b/.test(n) ? somarMeses(mesAtual, -1) : mesAtual;
    const nomeDoMes = nomeMes(mes).split(" ")[0].toLowerCase();
    const lancs = estado.lancamentos;

    if (/\b(quanto (eu )?invest|investido|investimentos?)\b/.test(n)) {
      const inv = investidoPorDestino(lancs);
      const r = resumoMes(lancs, mes);
      const destinos = Object.entries(inv.destinos).filter(([, v]) => v !== 0).map(([d, v]) => `${d}: ${R(v)}`);
      return {
        texto: [`Investido no total: ${R(inv.total)}.`, `Em ${nomeDoMes}: ${R(r.investido - r.resgatado)}.`,
          ...(destinos.length ? [destinos.join(" · ")] : [])].join("\n"),
        sugestoes: [], mudou: false
      };
    }
    if (/\b(quanto (eu )?(gastei|paguei)|gastos?|saidas?|despesas?|gastei)\b/.test(n)) {
      const resto = n.replace(/\b(quanto|eu|gastei|paguei|gastos?|saidas?|despesas?|com|de|do|no|na|em|esse|este|nesse|neste|mes|passado|hoje|ontem|semana|foi|o|a|meu|meus|minhas?)\b/g, " ").trim();
      const cat = resto ? categoriaDe(resto, estado.aprendizado).categoria : null;
      const filtro = (l) => l.tipo === "saida" && (!cat || l.categoria === cat);
      let periodo, lista;
      if (/\bhoje\b/.test(n)) { periodo = "hoje"; lista = lancs.filter((l) => l.data === hojeK); }
      else if (/\bontem\b/.test(n)) { periodo = "ontem"; lista = lancs.filter((l) => l.data === somarDias(hojeK, -1)); }
      else if (/\bsemana\b/.test(n)) { periodo = "nos últimos 7 dias"; lista = lancs.filter((l) => l.data > somarDias(hojeK, -7) && l.data <= hojeK); }
      else { periodo = `em ${nomeDoMes}`; lista = lancs.filter((l) => l.data.slice(0, 7) === mes); }
      const gastos = lista.filter(filtro);
      const total = gastos.reduce((a, l) => a + l.centavos, 0);
      const linhas = [`Despesas ${cat ? `com ${cat} ` : ""}${periodo}: ${R(total)} (${gastos.length} ${gastos.length === 1 ? "lançamento" : "lançamentos"}).`];
      if (!cat && gastos.length) {
        const por = {};
        gastos.forEach((l) => { por[l.categoria || "Outros"] = (por[l.categoria || "Outros"] || 0) + l.centavos; });
        const top = Object.entries(por).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => `${c}: ${R(v)}`);
        linhas.push(`Mais: ${top.join(" · ")}`);
      }
      return { texto: linhas.join("\n"), sugestoes: [], mudou: false };
    }
    if (/\b(quanto (eu )?(recebi|ganhei)|quanto entrou|entradas?|ganhos?|recebi)\b/.test(n)) {
      const r = resumoMes(lancs, mes);
      return { texto: `Ganhos em ${nomeDoMes}: ${R(r.entrou)} (${r.quantos.entradas} ${r.quantos.entradas === 1 ? "lançamento" : "lançamentos"}).`, sugestoes: [], mudou: false };
    }
    if (/\b(quanto (eu )?tenho|meu caixa|meu saldo|saldo|caixa|quanto tem)\b/.test(n)) {
      return { texto: `Seu caixa: ${R(caixaAte(lancs))}.`, sugestoes: [], mudou: false };
    }
    if (/\b(resumo|balanco|como (eu )?(to|estou|tou)|como esta|como ta)\b/.test(n)) {
      const r = resumoMes(lancs, mes);
      return {
        texto: [`${nomeMes(mes)}:`, `Ganhos ${R(r.entrou)} · Despesas ${R(r.saiu)} · Investido ${R(r.investido - r.resgatado)}`,
          `Saldo do mês: ${R(r.entrou - r.saiu)}`, caixaTexto(estado)].join("\n"),
        sugestoes: [], mudou: false
      };
    }
    return null;
  }

  const AJUDA = {
    texto: "Me conte seus ganhos e despesas do jeito que você falaria:\n• \"recebi 500\"\n• \"uber 9,80\" ou \"45 no mercadinho\"\n• \"mandei 100 pra Binance\"\n• \"tenho 800 em caixa\" (para acertar o caixa)\nTambém respondo \"quanto tenho?\" e \"despesas do mês\".",
    sugestoes: ["Quanto tenho?", "Despesas do mês", "Resumo do mês"],
    mudou: false
  };

  function responder(texto) {
    // extrato colado pode ser longo; frase normal raramente passa de 500
    const t = String(texto == null ? "" : texto).trim().slice(0, 20000);
    if (!t) return AJUDA;
    const estado = ler();
    const n = normalizar(t).replace(/[!?.]/g, "").trim();

    if (/^(desfazer|desfaz|desfaca|apaga o ultimo|apagar o ultimo|cancela o ultimo)$/.test(n)) return desfazer(estado);
    if (/^(ajuda|como funciona|o que voce faz|oi|ola|bom dia|boa tarde|boa noite)$/.test(n)) return AJUDA;

    const prefixo = [];
    if (pendentes.length) {
      if (!temValor(t)) return responderPendente(t, estado);
      prefixo.push(`Não lancei "${pendentes[0].descricao}" (ficou sem resposta).`);
      pendentes = [];
    }

    if (pareceExtrato(t)) return importar(t, estado, prefixo);

    if (!temValor(t)) {
      const r = perguntar(t, estado);
      // naoEntendi: o painel flutuante do Atlas pode responder no lugar
      return r || { ...AJUDA, texto: "Não entendi. " + AJUDA.texto, naoEntendi: true };
    }

    const r = interpretar(t, { hoje: hoje(), aprendizado: estado.aprendizado });
    if (r.erro) return { texto: [...prefixo, r.erro].join("\n"), sugestoes: [], mudou: false };
    return processar(r.itens, estado, prefixo);
  }

  return { responder, pendente: () => pendentes.length > 0 };
}
