# Simulador de Pools de Liquidez — registro (17/11/2026)

Ferramenta própria em `Ferramentas/simulador-de-pool/`. Ela começou como aba
do Scanner, e no mesmo dia o dono pediu que virasse **ferramenta separada e
maior**. As **Estratégias de Pools** ensinam o conceito. O **Simulador** usa
pools reais, como um simulador no estilo da Metrix Finance.

## O que faz

- **Pools** (coluna da esquerda, fixa ao rolar): as pools do Scanner que não
  são `oculta`, com TVL de no mínimo US$ 100 mil e endereço conhecido. Busca
  por token ou par (WETH = ETH, USDC.e = USDC). Pendentes aparecem marcadas.
- **Gráfico grande** com velas **diárias (180) ou por hora (168)** da pool, a
  faixa roxa arrastável, a linha do preço de agora e o início do teste.
- **Simulação** (direita): depósito, faixa e atalhos (±5/10/20/50%,
  "1 semana" e "1 mês" pela oscilação real, cheia). Mostra a taxa estimada
  de hoje e o APR, e o **teste** de 7/30/90/180 dias (diário) ou 1/3/7 dias
  (por hora): taxas, tempo na faixa, posição sem taxa, só segurar, resultado
  e mini gráfico. Tem "Acompanhar no Radar" (grava a mesma marca ★ que o
  Scanner lê) e um link para as Estratégias.
- **Outras larguras de faixa:** a tabela roda todos os atalhos no mesmo
  período e com o mesmo dinheiro e marca a melhor. Mostra que faixa estreita
  rende mais taxa, mas sai da faixa e troca mais tokens.
- **Em qual plataforma montar?:** botão que roda a mesma faixa em até 6
  outras pools do par (uma de cada vez, por causa do limite da
  GeckoTerminal). Inverte as pools com tokens em ordem trocada e não mostra
  ranking de uma faixa antiga.
- **Se montar hoje e o preço terminar em −50%…+50%:** composição, valor da
  pool sem taxa, só segurar e a diferença que as taxas precisam cobrir.

## Dados e regras

- Pools: `../scanner-pools/servidor.js` (`ScannerServidor.carregar`,
  `paraPool`, `semDuplicatas`, `trilhoEfetivo`, `enderecoPool`) com
  `core/atlas-supabase-config.js`. **As regras do Scanner (spec de 26/09) não
  mudam**: o Simulador só lê.
- Velas: `api.geckoterminal.com/api/v2/networks/{rede}/pools/{end}/ohlcv/{day|hour}`
  em `currency=usd` e `currency=token`, com cache de 10 min. Rede pelo mapa
  do coletor (`config.GECKO_NET`).
- Conta: `clAmt` (a mesma das Estratégias). Taxa por vela = fee × volume da
  vela × min(1, valor × concentração ÷ TVL) × fração da vela dentro da faixa.
  **Limite escrito na tela:** sem a liquidez preço a preço (ticks), a fatia
  sai do TVL total, que é o de hoje, então pode superestimar em pools muito
  concentradas.

## Ligações

- Card na bancada (DeFi e renda), com arte **provisória**
  `assets/ferramentas/card-simpool-provisoria.svg`. O dono vai gerar a capa
  definitiva; quando chegar, trocar o `src` para `card-simpool.webp`.
- Menu lateral: "Simulador de Pools" no grupo Ferramentas.
- Scanner: a aba saiu. Cada linha de pool do servidor tem um link para
  `simulador-de-pool/index.html?pool=<sid>`.
- Estratégias: o botão "Simulador de pool" abre `?simular=TOKEN[/PAR]`.

## Testes

`Ferramentas/simulador-de-pool/simulador.test.cjs` (5), no CI
`scanner-testes.yml`: preço parado sem perda e taxa exata, fora da faixa sem
taxa, fatia limitada a 100%, inversão e tokens do par. A página foi
conferida com pools e velas simuladas (sem acesso à rede neste ambiente).
