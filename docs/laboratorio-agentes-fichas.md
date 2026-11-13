# Laboratório de Agentes · ficha dos agentes

Aprovada pelo dono em 13/11/2026. O nome visível passa a ser **Laboratório de
Agentes** (o "Estúdio" do Atlas é o de vídeos); os nomes internos (`estudio`
no banco, pastas `estudio/`) ficam como estão.

Regras que valem para todos:

- Valores sempre em dólar. Cada simulação usa **US$ 1.000 por 30 dias**, 300
  cenários de preço, o mesmo motor do simulador do Atlas, sem apostar em
  direção (tendência zero).
- Só pools da Solana e da Base que passam no filtro da varredura (TVL ≥
  US$ 250 mil, giro > 0,5) e têm 7 dias ou mais de histórico.
- Nenhuma chave de carteira. Os agentes só simulam e registram.
- **Achado** = a estratégia do agente, na média, ganha da faixa única (Base)
  na mesma pool e fecha no lucro.
- **Boletim** (novo): depois de 7 e de 30 dias, cada achado é refeito com os
  preços e o volume que aconteceram de verdade. O boletim de cada agente diz
  quantas vezes acertou o sinal, quanto errou em dólar e quantas vezes ganhou
  da Base de verdade.
- **Na cidade**, cada agente aparece na sala da plataforma (Raydium, Orca,
  Meteora, Aerodrome...) da pool em que está trabalhando.

---

## Base · faixa única

- **Papel:** a régua de todos e o jeito simples que já paga.
- **Procura:** giro (volume ÷ TVL) ≥ 1 e estável (dia mais fraco dos últimos 7
  ≥ 50% da mediana).
- **Descarta:** volume caindo 3 dias seguidos.
- **Testa:** uma faixa, todo o capital dentro, largura de 1 oscilação normal
  de 30 dias.
- **É achado quando:** a média é positiva (é ela quem define a régua).
- **Entrega:** quanto rende o jeito simples; pools onde não precisa inventar.

## Concentrador · faixas aninhadas

- **Papel:** concentrar a liquidez perto do preço.
- **Procura:** preço lateral (≥ 60% do tempo a ±10% da mediana de 30 dias).
- **Descarta:** o preço não cabe na faixa do meio por uma **semana típica**.
  *(Correção aprovada: hoje compara com o movimento de 30 dias, que por
  construção é maior que a faixa do meio, e descartava quase tudo.)*
- **Testa:** aninhadas com 2 a 5 faixas; fica com o melhor **entre os que
  cabem** (quanto mais faixas, mais estreita a do meio: com a semana agitada,
  só 2 ou 3 faixas passam; se nem 2 cabem, descarta).
- **Entrega:** quantas faixas aninhadas usar e onde.

## Curva · liquidez em curva

- **Papel:** mais liquidez no centro, menos nas bordas.
- **Procura:** preço que volta à média (κ ≥ 5 ao ano) com giro ≥ 1.
- **Descarta:** tendência forte (movimento do mês ≥ 1,5 oscilação normal).
- **Testa:** curva com 2 a 6 faixas.
- **Entrega:** a curva que mais rende na pool.

## Pontas · bid-ask

- **Papel:** liquidez nas bordas, para ganhar quando o preço vai e volta forte.
- **Procura:** oscilação forte (≥ 60% ao ano em 30 dias) e volta à média.
- **Descarta:** preço parado (oscilação de 7 dias < 20% ao ano).
- **Testa:** bid-ask com 2 a 6 faixas.
- **Entrega:** a distribuição nas pontas que mais rende.

## Grade · faixas iguais

- **Papel:** pool nova, sem histórico para confiar em padrão.
- **Procura:** menos de 30 dias de histórico.
- **Descarta:** giro < 1.
- **Testa:** grade (spot) com 2 a 6 faixas iguais.
- **Entrega:** uma grade segura para pool que ainda não se conhece.

## Acumulador Dólar *(nova divisão)*

- **Papel:** comprar aos poucos tokens da lista, buscando terminar com **mais
  dólares**.
- **Procura:** token da lista de compra perto da mínima de 30 dias (até 10%
  acima).
- **Descarta:** fora da lista.
- **Testa:** acumulação com 1 a 6 faixas; fica com a maior média em dólar.
- **Entrega:** a acumulação que mais rende em dólar.

## Acumulador Token *(nova divisão)*

- **Papel:** comprar aos poucos tokens da lista, buscando terminar com **mais
  unidades do token**, mesmo que valham menos em dólar naquele momento.
- **Procura / descarta:** igual ao Acumulador Dólar.
- **Testa:** acumulação com 1 a 6 faixas; fica com a que termina com mais
  tokens na **mediana** dos cenários (a média em tokens engana: favorece quem
  fica parado em dólar quando o preço cai).
- **É achado quando:** termina com mais tokens do que comprar tudo de uma vez
  no início **e** do que esperar com o dinheiro parado e comprar no fim.
- **Entrega:** quanto token a mais a estratégia junta.

Lista de compra (dono, 13/11/2026): SYRUP, AAVE, ENA, BTC, BNB, AERO, UNI,
LDO, SUI, SOL, ETH, RENDER, ONDO, JTO, MORPHO, PENDLE, RAY, LINK, SKY, HYPE,
JUP, PYTH e ações tokenizadas (xStocks, SpaceX, Circle).

## Supervisor

- **Papel:** juntar o trabalho de todos.
- **Entrega:** ranking do dia (pela média em dólar), disputas (pools com mais
  de um achado: quem ganha e por quanto), conflitos (achado de um agente onde a
  regra de outro descarta, com o motivo) e o boletim de cada agente.
- **Fase 5:** escreve o resumo diário (IA só aqui e nos pareceres).

---

## Depois da cidade

**Perfis** (operam usando os agentes acima como ferramentas; cada um com
quanto arrisca e quanto dinheiro usa):

- **Novato** · US$ 100, entra em pool com TVL subindo há 2 dias, quer US$ 2–3
  e sai; prazo de 1 a 3 dias; mora na Solana e na Base (gás barato).
- **Doido das ideias** · memecoins e tokens novos; pools abaixo do filtro atual.
- **Sério, faixa larga** · pool tranquila, faixa grande (ex.: UNI de US$ 5 a 15).
- **Sério, faixa apertada** · mesma pool, faixa curta (ex.: UNI de US$ 4 a 8).

**Redes novas** (casas "em obra" na cidade): Ethereum, BNB Chain, Arbitrum.

## Ordem de construção

1. Ajustes nos agentes: correção do Concentrador, divisão do Acumulador e
   nome "Laboratório de Agentes" no que é visível.
2. Boletim (conferência com o que aconteceu de verdade).
3. Fase 4, a cidade: dados privados pelo login do Atlas → cidade → casa por
   dentro → sala com os agentes.
4. Perfis e redes novas, cada um numa fase própria.
5. Fase 5, IA nos pareceres e no resumo diário.

Cada passo é descrito antes e só começa com o OK do dono.
