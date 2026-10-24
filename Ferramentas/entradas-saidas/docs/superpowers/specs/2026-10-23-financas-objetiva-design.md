# Finanças objetiva — design (23/10/2026)

Substitui o modelo "planejar primeiro" de `2026-09-09-fundacao-atlas-financas-design.md`.

## Por quê

A ferramenta estava bonita, mas não servia no dia a dia: pedia um formulário
para cada lançamento e partia de uma previsão (Planejar) que espalhava salário
e contas pelo ano inteiro. Na vida real ninguém lança uma corrida de R$ 9,80
por formulário, e o salário muda de mês para mês (1.500, 2.500, 3.000) e cai
dia 30, 31 ou 27. O dono quer **lançar falando** ("recebi 500", "uber 9,80") e
ver o balanço sair sozinho.

## Objetivos

1. Lançar uma movimentação custa uma frase curta para o Oráculo.
2. Conta **só o que foi lançado**. Nada de previsão gerando dinheiro.
3. Contas sem erro: todo valor em **centavos inteiros**, com testes de cada regra.
4. Painel visual forte, no mesmo nível do Scanner Pools.

## Não objetivos

- Não acompanhar o que acontece dentro da corretora (é o dashboard do Atlas).
- Não ligar Finanças ao resto do Atlas por dados agora (segue autônomo, nuvem depois).
- Não usar IA paga para entender as frases: regras locais, de graça e instantâneas.

## Anti-objetivos (seria fracasso mesmo funcionando)

- Somar errado, arredondar errado ou contar um lançamento duas vezes.
- Pedir confirmação a cada R$ 9,80.
- Inventar categoria em vez de perguntar quando não entendeu.

## Decisões do dono

- **Aba Oráculo dentro do Finanças**, como a do Scanner, com o personagem original
  (`assets/atena.webp`) flutuando. Ele lança, desconta e responde com o saldo.
- **Só o dia** do lançamento, sem hora. Padrão: hoje; aceita "ontem", "dia 27", "27/10".
- **Quando não entende, pergunta** a categoria com 3–4 opções em botões.
- **Mercadinho, venda, padaria e bar são uma categoria só.** Mercado (supermercado) é outra.
  Gasolina, Uber, 99, táxi, ônibus → Transporte.
- **Caixa pode ficar negativo** ("fiz um pagamento de 300" com 200 em caixa → −100).
- **Investimento é uma terceira coisa**: "mandei 100 pra Binance" sai do caixa e entra
  em Investimentos (destino Binance). Não é gasto. O que acontece lá dentro é do Atlas.
- **Planejar fica secundário.**
- **Painel inicial** com três números grandes (caixa, entrou, saiu), gráfico grande,
  categorias, investido com link para as carteiras do Atlas.
- **Fundo A — "fios de fluxo"**: linhas finas de luz azul ondulando sobre preto.
  Diferente do Scanner (manchas) e do Academy (rede neural). B e C guardados em
  `docs/visual-financas/fundos-opcoes.html`.

## Regras de dinheiro (o coração)

Todo valor é guardado como **inteiro em centavos**. Só a tela divide por 100.

Um lançamento:

```
{ id, data: "AAAA-MM-DD", tipo, centavos (> 0, inteiro), descricao, categoria, destino?, criadoEm }
```

Tipos e efeito no caixa:

| tipo | caixa | conta em |
| --- | --- | --- |
| `entrada` | + centavos | Entrou |
| `saida` | − centavos | Saiu |
| `investimento` | − centavos | Investido (+) |
| `resgate` | + centavos | Investido (−) |
| `saldo` | caixa passa a ser exatamente `centavos` (pode ser 0) | nada |

- Ordem de cálculo: por `data`, depois `criadoEm`. Caixa corrido percorre essa ordem.
- `saldo` é o ponto de partida ("tenho 500 em caixa"). Um lançamento com data anterior
  a um `saldo` não muda o caixa depois dele: o saldo diz quanto havia naquele dia.
- **Mês** = entradas, saídas e investimentos com data naquele mês. `saldo` não entra.
- **Investido total** = soma de investimentos − soma de resgates, por destino.
- Data no futuro é recusada: só se lança o que já aconteceu.

## Entender a frase (Oráculo)

Determinístico, em `js/core/interpretador.js`, puro e testado.

1. Normaliza (minúsculas, sem acento). Separa várias movimentações numa frase
   ("gastei 9,80 no uber e 45 no mercadinho"); cada pedaço herda o verbo do anterior.
2. **Data**: hoje, ontem, anteontem, "dia N" (último dia N que já passou),
   "N/M", "N/M/AAAA", dia da semana (o último que passou).
3. **Valor**: "9,80", "9.80", "R$ 1.500,50", "1.500", "2 mil", "2,5 mil", "50 reais".
   "99" depois de "no/na/do" ou junto de corrida/app é o aplicativo, não valor.
   Mais de um valor possível no mesmo pedaço → pergunta.
4. **Tipo**: verbos de entrada (recebi, caiu, entrou, ganhei, me pagaram, salário),
   de saldo ("tenho X em caixa", "meu saldo é X"), de investimento (mandei/transferi/
   apliquei/investi para corretora conhecida), de resgate (tirei/saquei da corretora)
   e de saída (gastei, paguei, comprei, botei). Sem verbo, uma categoria de gasto
   conhecida vale como saída ("uber 9,80"). Sem nada → pergunta entrou/saiu/investiu.
5. **Categoria**: dicionário de palavras + o que ele aprendeu. Não achou → pergunta
   com as categorias mais prováveis em botões; a resposta é guardada em
   `aprendizado` ("99" → Transporte) e ele não pergunta de novo.
6. Responde com o lançamento, o caixa novo e botão **Desfazer**. Caixa negativo → avisa.
7. Também responde perguntas simples: quanto tenho, quanto gastei/entrou no mês,
   quanto gastei com X, quanto investi.

O mesmo motor atende a aba Oráculo, a barra do Painel e o painel flutuante global
(`AtlasOraculo.registerTool`), então as três dão a mesma resposta.

## Telas

- **Painel** (`index.html`): ‹ mês ›; Em caixa (com "R$ X por dia até o fim do mês"
  no mês atual), Entrou, Saiu; gráfico dia a dia (barras entrou/saiu + linha do caixa);
  anel de categorias; Investido (mês e total, destinos, link às carteiras do Atlas);
  metas do Planejar, se houver; últimos lançamentos; barra do Oráculo fixa.
- **Oráculo** (`oraculo.html`): conversa com o personagem grande flutuando quando vazia.
- **Lançamentos** (`lancamentos.html`): lista por dia, filtros, busca, editar/apagar,
  lançar à mão, exportar CSV. Substitui Entradas, Despesas, Relatórios e Análises.
- **Investimentos** (`investimentos.html`): investido por destino e histórico.
- **Planejar** (`planejar.html`): metas de gasto (do mês e por categoria). Não lança nada.
- **Configurações**: tema, backup, apagar dados.

## Migração dos dados atuais

Antes de migrar, guarda o estado antigo inteiro em `finance-dashboard-state.backup-v1`.
Entradas e despesas com data até hoje viram lançamentos (em centavos, arredondados
ao centavo). Previstos (data futura) e o planner antigo saem.

## Construção

- Celular primeiro; barra do Oráculo fixa acima da barra inferior.
- Fundo A em canvas 2D: 30 qps no máximo, pausa com a aba oculta, parado com
  "menos movimento", sem fundo no tema claro.
- Service worker passa a buscar na rede primeiro (o cache-primeiro prendia versões velhas).
- Login do Atlas continua em toda página (atlas-auth + atlas-secure).

## Fica com quem construir

Nomes de classes, a lista exata de palavras do dicionário, desenho do gráfico,
textos das respostas.
