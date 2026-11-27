# Fundamentos de Protocolo (28/11/2026)

Ferramenta nova da Bancada, seção "Estudar o mercado".
Pasta: `Ferramentas/fundamentos/`.

## Por quê

Na conversa sobre a aba Eficiência do Scanner, o dono disse que o estudo que
queria de verdade era outro: "eu preciso saber se é uma boa ideia comprar
tokens da Uniswap, da Aero…". Volume ÷ TVL serve para quem fornece liquidez;
para o token, a pergunta é se o negócio cresce e quanto o mercado paga por
ele. Ele escolheu ferramenta nova, fora do Scanner.

## O que mostra

- Até 6 protocolos lado a lado (padrão: Uniswap, Aero, PancakeSwap, Raydium,
  Orca). Busca por nome ou símbolo entre os 500 maiores com token. A escolha
  fica guardada (`atlas.fundamentos.escolha.v1`).
- Período: 7 dias, 30 dias, 90 dias ou 1 ano. Cada número compara com o
  período anterior de mesmo tamanho.
- Colunas: valor de mercado, volume (só DEX), taxas pagas, receita para o
  token, parte do token (receita do token ÷ taxas) e anos de receita (valor
  de mercado ÷ receita do token anualizada, como o preço/lucro de uma ação).
- Clicar numa linha abre o gráfico do último ano (média de 7 dias) de volume,
  taxas ou receita do token, com uma frase só de fatos (`leitura()`: nunca
  "compre" nem "venda"; o teste confere).

## Dados (DefiLlama, grátis, sem chave, pelo roteador `AtlasDados.pedir`)

| O quê | Endereço |
|---|---|
| Catálogo, símbolo, valor de mercado | `lite/protocols2` (pai quando existe: Uniswap = V2 + V3 + V4) |
| Volume | `summary/dexs/<slug>` (não-DEX responde erro → "—") |
| Taxas, receita, receita do token | `summary/fees/<slug>?dataType=dailyFees` / `dailyRevenue` / `dailyHoldersRevenue` |

- O dia de hoje (UTC) fica de fora: ainda está pela metade.
- Guardado: catálogo 6 h (`atlas.fundamentos.catalogo.v1`), séries de cada
  protocolo 1 h (`atlas.fundamentos.serie.v1.<slug>`, últimos 800 dias).

## Arquivos

- `conta.js`: contas puras (`periodo`, `resumo`, `multiplo`, `media7`,
  `leitura`, `catalogo`). Teste: `node --test Ferramentas/fundamentos/conta.test.cjs`.
- `app.js`: tela. `estilo.css`: só o desta ferramenta (o resto é
  `_comum/ferramenta.css`).
- Card em `pages/ferramentas.html` com capa provisória
  `assets/ferramentas/card-fundamentos-provisoria.svg`. Item no menu em
  `core/ui/atlas-listas.js` (o teste das listas confere a ordem).

## Números conferidos em 28/11 (30 dias)

Uniswap: 12% das taxas chegam a quem tem UNI, 29 anos de receita. Aero: 79%,
3 anos. PancakeSwap: 22%, 20 anos. Raydium: 10%, 25 anos. Orca: 3%, 37 anos.

## Não mostra

Emissão de tokens novos, desbloqueios, dívida e riscos de contrato. A página
aponta para a Calculadora de Market Cap para oferta e desbloqueio.
