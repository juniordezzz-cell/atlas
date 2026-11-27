# Forma suave: cantos numa escala só, superfícies e uma entrada (27/11/2026)

Spec aprovada: [2026-11-27-forma-suave-design.md](superpowers/specs/2026-11-27-forma-suave-design.md).

## Por quê

O dono, em 26/11: o site "tá muito quadrado, sem suavidade nenhuma", a aba
Tokens "apertada demais", e "sempre quando eu troco de aba no site, a tela
pisca 2 vezes". Pediu correção na raiz, não remendo.

## O que mudou

### Cantos

- Escala única em `core/ui/atlas-shell.css` (o único CSS que toda página
  carrega): `--atlas-r-xxs 4` · `xs 8` · `sm 12` · `md 16` · `lg 20` ·
  `xl 24` · `pill 999px`. Saiu de `atlas-theme.css`, do bloco do Oráculo nas
  Ferramentas e de `financas/css/atlas-tokens.css`.
- 762 `border-radius` com px solto, em 63 arquivos, passaram para a escala com
  reserva (`var(--atlas-r-sm, 12px)`). Os apelidos de cada módulo (`--r-*` do
  RWA, DeFi e Trade; `--radius*` do Hold; `--raio*`; `--aws-radius*`;
  `--sereno-r`; `--suave-r-*`; `--sp-r`) apontam para a mesma escala.
- `Ferramentas/escada-dca` e `estrategia-de-pool` foram regerados pelo
  `node Ferramentas/_fonte-quadro/build.js` depois da troca na fonte.

### Superfícies no lugar das seções abertas

`themes/atlas-sereno.css`: cartões, painéis e números deixaram de ser "seção
aberta" (sem fundo, borda nem canto, separados por linha reta) e viraram
superfícies leves (`--sereno-fill`), sem contorno, canto `lg` (cartão) ou
`md` (número). Saíram as linhas retas entre fileiras de seções e entre
números.

### Uma entrada só (as duas piscadas)

Medido no Dashboard: a página pintava e o conteúdo ainda nascia transparente
por cima do esmaecimento da troca de página. Saíram todas as animações de
entrada de página:

- `atlasPageIn` em `css/global.css` (cartões e números do Dashboard, com
  atraso em cascata), `defi/css/global.css`, `hold/css/global.css` e
  `trade/assets/css/base.css`;
- `atlas-view-in` (`.view__inner`, `#app > .view`, `.page-enter`) e
  `atlas-kpi-in` em `themes/atlas-effects.css`;
- `.page-enter` e `.reveal` em cascata no DeFi, `#app > *` e `.reveal` no RWA,
  `.reveal` no Trade, `fadeUp` no Simulador de Trade;
- o desfoque da revelação ao rolar (cartão pela metade embaixo da tela ficava
  borrado).

Fica só o `@view-transition` de 0,18 s (`core/atlas-secure.js`). As telas de
abertura (boot, boas-vindas, login, Finanças) mantêm a animação própria.

### Mercado

- Cada aba é montada uma vez e fica guardada; trocar só mostra ou esconde.
  Conferido: no mesmo quadro do clique a aba aparece inteira, sem
  "Carregando…". A atualização de 5 em 5 min roda só na aba aberta; a que
  volta depois de 5 min parada atualiza no lugar.
- `mercado/css/painel.css` refeito: painéis como superfícies com canto 20,
  números em placas, linhas em pílula, abas em pílula, mapa de calor com vão
  e canto (canto menor em célula estreita), mais respiro em tudo.
- Aba Tokens e RWA: linhas de ativo com ícone do token (regra do dono), nome
  embaixo do símbolo e variação embaixo do preço.
- Celular: as quatro abas cabem numa linha.

## Erros achados de passagem

- Dashboard em 1440 px: a página ficava 151 px mais larga que a janela e
  cortava "Distribuição por Plataforma". Causa: `.charts` com
  `1.5fr 1fr 1fr` deixava o gráfico crescer até a largura do canvas.
  Corrigido com `minmax(0, …)`.
- `#app > *` do RWA animava com `both` e `transform`: é o mesmo erro que já
  quebrou o `position: fixed` no `body` (atlas-effects §16). Saiu junto.

## Teste

`node --test core/ui/atlas-forma.test.cjs` — falha se aparecer canto com px
solto, reserva diferente do degrau, ou `--atlas-r-*` definido fora do shell.

## Fica para a próxima etapa

- Desmontar o resto do `atlas-sereno.css` (fundo, tipografia dos números,
  mono → Inter) para dentro da camada única, área por área.
- Escala de espaçamento obrigatória (o teste cobre só cantos).

## Ajuste de 28/11 (Mercado, primeira parte)

- Miolo com o mapa no centro: colunas `.85fr · 2,7fr · 1fr` (o mapa foi de
  ~48% para ~60% da faixa). Em tela larga o mapa acompanha a altura das
  listas ao lado (mínimo 460 px), sem vazio embaixo das laterais.
- Redes: valor com a variação embaixo (`linhaPilha`), linhas mais baixas.
- O que mudou hoje: saiu a hora repetida em cada linha (já está em "dados
  de …"); o peso virou um ponto de cor com o nome em `title`/`aria-label`.
- Mapa: cada rede é um bloco com canto `sm`; as células se separam por um fio
  de 1 px com canto `xxs`, sem a grade de linhas escuras. Saiu `tmap-estreita`.
- Painéis com canto `xl` (24) e números com `lg` (20).

## Ajuste de 28/11 (Mercado, segunda parte)

Aba DeFi só com "Onde está o dinheiro" na faixa central, largura inteira
(`.mk-miolo-so`, proporção 2,3 e mínimo de 420 px; no celular continua 0,9).
Saíram os painéis Redes e "O que mudou hoje" (e o código deles). Clicar no
nome de uma rede abre só ela; o botão "← Todas as redes" no topo do painel
volta. Cada rede mostra até 12 protocolos e "Outras redes" até 14. Tokens e
RWA mantêm as três colunas.

## Ajuste de 28/11 (Mercado, terceira parte)

- Tokens e RWA também ficam só com o mapa na faixa central. Os painéis de
  altas e quedas viraram um filtro em pílulas no topo do mapa
  (`filtroPainel`): Tokens = Maiores · Maiores altas · Maiores quedas;
  RWA = Maiores · Ações em alta · Ações em queda. Em altas e quedas o
  tamanho da célula é o tamanho do movimento em 24h (20 maiores).
- Mapa no jeito da referência do dono: texto alinhado à esquerda, nome com
  letra proporcional à célula (até 64 px) e o valor embaixo; o valor só
  aparece se couber inteiro. Na DeFi (`juntar: true`) as migalhas, abaixo de
  0,3% do mapa, viram uma célula "+N" com os nomes.
- Mesmo dia, o dono achou o mapa enorme numa tela de 1888 px (~770 px de
  altura). Agora a altura é fixa, `clamp(340px, 28vw, 480px)`, e a letra
  do nome vai no máximo a 34 px (o valor, a 14 px).

## Ajuste de 28/11 (Mercado, quarta parte)

- O dono achou o mapa da DeFi ainda apertado e pediu nomes mais
  profissionais, no padrão da DefiLlama, CoinGecko e CoinMarketCap.
  Título: "TVL por protocolo"; legenda: "tamanho: TVL · cor: variação em 7 dias".
- O mapa deixou de ser agrupado por rede. Submenu em pílulas: "Todas as redes"
  mais as 8 maiores redes por TVL (lista da DefiLlama). "Todas" mostra os 20
  maiores protocolos; cada rede mostra os 20 maiores dela, pelo TVL naquela
  rede. A tabela de protocolos segue o mesmo filtro. Saiu o botão "← Todas
  as redes".
- Mesmo padrão levado a Tokens e RWA (o dono: "já era para ter feito
  automaticamente"): títulos "Tokens por valor de mercado" e "Ações
  tokenizadas por valor de mercado", legenda "tamanho: … · cor: variação em
  24h", filtro "Maior valor de mercado · Maiores altas/Ações em alta ·
  Maiores quedas/Ações em queda", 20 células em todos os modos.
- Linha preta entre os quadrados (referência do dono): `.tmap-area` com fundo
  #04060a e células sem canto; o vão de 1 px de cada célula mostra o preto.
  O bloco inteiro do mapa mantém o canto `sm`.
- Correção: a linha não aparecia. O `academy-treemap.js` pinta a célula com
  `style.background` (atalho), que volta o `background-clip` para
  `border-box`; a cor cobria a borda transparente. Agora a borda tem cor
  própria (`1px solid #04060a`) e aparece de qualquer jeito.
- Filtro BSC vazio: a DefiLlama chama a rede de "BSC" em /v2/chains e de
  "Binance" no TVL de cada protocolo. `APELIDO_REDE` + `chaveRede()` em
  `mercado/js/dashboard.js` (também Gnosis→xDai, OP Mainnet→Optimism).
  Conferido: as 8 redes abrem protocolos. Tron mostra 3 e Hyperliquid 7
  porque o Mercado guarda os 200 maiores protocolos.
