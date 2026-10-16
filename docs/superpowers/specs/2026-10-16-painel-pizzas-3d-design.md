# Painel do Hold: pizzas 3D por token e por setor (opção A)

Data: 16/10/2026 · Escolhida pelo dono entre três propostas (A pizza sólida,
B anel 3D, C pizza fatiada).

## Por que

Painel, Ativos e Métricas do Hold mostravam quase a mesma coisa. O dono quer
que o Painel seja **a tela de olhar**: os números do portfólio em cima e, no
lugar da tabela de posições, dois gráficos de pizza em 3D — à esquerda o peso
de cada token em dólar, à direita o peso de cada setor (RWA, IA, DePIN, ZK…).

A primeira versão (pizza SVG simples, já no código, não commitada) foi
reprovada: "infantil", estilo PancakeSwap. A plataforma é para uso
profissional. A referência do dono é a pizza 3D da planilha dele, mas mais
realista, e com **os nomes dentro do gráfico**, não em linhas puxadas para
fora.

## Objetivos

- Pizza sólida em 3D com aparência de objeto real: volume, luz vinda de cima,
  lateral sombreada como um cilindro, sombra suave no chão.
- Nome e % escritos **dentro** de cada fatia que comporte.
- Mesmo componente nas duas pizzas (token e setor), lado a lado.
- Ler a proporção sem esforço: no máximo 7 fatias, maior fatia começando às
  12 h, % sempre escrito.

## Fora do escopo

- Reformar as abas Ativos e Métricas (é o passo seguinte, outro trabalho).
- 3D em WebGL, girar o gráfico com o mouse, animação de entrada.
- Mexer nos quatro números do topo, em "Ganho ou perda por ativo" e nos
  blocos abaixo dele.

## Seria um fracasso se

- Parecer brinquedo: cores saturadas, contorno grosso, brilho/glow,
  degradê arco-íris, fonte grande e gorda.
- Os nomes saírem por fora com linhas de chamada (o que a planilha faz).
- A cor for a única forma de saber qual fatia é qual.
- Uma fatia de 1 % ganhar rótulo amassado ilegível.

## O que já existe e fica

- `core/atlas-setores.js` — classifica o setor de cada ativo (manual >
  catálogo > CoinGecko). Continua sendo a fonte do setor.
- No Painel (`hold/js/pages/dashboard.js`) a tabela de posições já foi
  trocada por dois cartões `col-6`; o cartão "Alocação" antigo saiu e
  "Ganho ou perda por ativo" ocupa a linha inteira. Isso fica.
- `Charts.pie3d` em `hold/js/charts.js` será **reescrito** para o visual
  abaixo (a API pode mudar; só o Painel usa).

## Como fica (decidido)

**Forma.** Elipse inclinada (altura = metade da largura), espessura ≈ 19 %
da largura do raio, base em viewBox 300 × 215, escala com o cartão até ~340 px
de largura. Fatias no sentido horário a partir das 12 h, em ordem de valor;
"Outros" sempre por último.

**Luz e material (o que tira o "infantil").**
- Topo: cor da fatia + véu vertical (branco 20 % em cima → transparente →
  preto 12 % embaixo).
- Lateral: só a metade da frente é desenhada; por cima, um degradê horizontal
  preto que escurece as duas pontas (~62–66 %) e quase some no meio (~12 %),
  como um cilindro iluminado de frente.
- Sombra no chão: elipse com degradê radial preto 55 % → 0, logo abaixo da
  base.
- Separação entre fatias: traço fino (~1,2 px) na cor da superfície do cartão.
  Sem contorno externo, sem glow.

**Paleta.** Sóbria, de tom médio, a mesma das três propostas aprovadas:
`#4C7BD9 #2FA58F #D4A23A #8A6AD1 #C2566F #3E9BC0`, "Outros" `#66707F`.
No tema claro passa por `AtlasChartTheme.serie()` (já escurece para
contraste) e a sombra no chão fica mais fraca.
- **Setor:** cor fixa por setor, a mesma em qualquer carteira (RWA sempre a
  mesma cor). Mapa novo em `AtlasSetores.cor(setor)`, para Métricas reusar
  depois. *Minha decisão.*
- **Token:** cor pela posição no ranking da própria pizza. *Minha decisão* —
  token não tem cor natural e são no máximo 7.

**Quantas fatias.** Por token: as 6 maiores + "Outros" somando o resto
(quando houver mais de 7). Por setor: os setores como vêm; se passar de 7, os
menores juntam em "Outros". A legenda de "Outros" lista quem está dentro.

**Rótulos dentro da fatia.** Posição: centro angular da fatia, a 60 % do raio.
Texto branco com contorno escuro fino (paint-order stroke) para ler sobre
qualquer cor.
- Fatia ≥ 9 %: nome (ticker ou setor, 12 px, peso 500) e, embaixo, % com uma
  casa ("34,4%", 11 px).
- Fatia entre 4,5 % e 9 %: só o % inteiro.
- Fatia < 4,5 %: sem rótulo; aparece na legenda e no tooltip.
- Nome longo ("Reserva de valor"): fonte cai para 10,5 px; se ainda não
  couber na fatia, mostra só o %.
- Uma posição só (100 %): disco inteiro, rótulo no centro.

**Legenda.** Abaixo da pizza (ou ao lado, quando o cartão é largo), em lista:
quadradinho da cor, nome, linha de apoio (nome do token / tickers do setor),
valor em US$ e %. Linha de token clica e abre o ativo em Ativos. Passar o
mouse na linha ou na fatia desloca a fatia ~8 px para fora; com
"menos movimento" ligado, sem transição.

**Acessibilidade.** `<svg role="img">` com `aria-label` resumindo
("ETH 34 %, AAVE 23 %…"); `<title>` por fatia com nome, valor e %; a legenda é
o equivalente em texto.

**Vazio.** Disco cinza com a mesma luz e "sem posições" no centro (já existe,
mantém).

**Celular.** Os dois cartões empilham (regra `col-6` atual), pizza ocupa a
largura, legenda embaixo, sem rolagem lateral.

## Decisões tomadas depois da revisão (minhas, para o dono conferir)

- **Base do %:** a soma das fatias (só posições com valor > 0), não o
  patrimônio com caixa. Rótulo e legenda mostram o mesmo número e a pizza
  fecha 100 %.
- **Um "Outros" só:** o setor "Outros" (ativo sem classificação) e o resto
  agrupado viram uma fatia única, cinza, sempre por último, e conta dentro do
  limite de 7. A legenda lista os tickers dentro dela.
- **Cores de token:** 6 cores da paleta + cinza do "Outros"; com o limite de
  7 fatias, nenhuma cor se repete.
- **Interação:** o componente continua devolvendo `destacar(i)` e aceitando
  `color`/`onClick` por fatia, como hoje.
- **Posição sem preço (valor ≤ 0):** fica fora da pizza; abaixo da legenda,
  uma linha discreta "sem preço: TICKER, TICKER". Se todas estiverem sem
  preço, o disco cinza diz "sem preço" em vez de "sem posições".

## Deixado para quem constrói

- Quando a legenda vai para o lado (hoje: tela ≥ 1280 px).
- A forma exata de medir se o nome cabe na fatia (largura do arco no raio do
  rótulo vs. largura estimada do texto é suficiente).
- As cores fixas de cada um dos 16 setores de `AtlasSetores.lista`, desde que
  vizinhos comuns (DeFi, Layer 1, Oráculos, RWA, IA) fiquem bem diferentes.

## Como conferir

No navegador do Claude (`?atlas-dev=1`, dados de teste só nesse navegador):
carteira vazia, 1 posição, 4 posições (a carteira real do dono), 8 e 12
posições; tema escuro e claro; 1600 px e 375 px. Console sem erros. Mostrar
captura ao dono antes de commitar.
