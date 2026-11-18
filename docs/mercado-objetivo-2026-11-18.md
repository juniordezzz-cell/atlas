# Mercado objetivo — registro (18/11/2026)

Pedido do dono: o Mercado é a página principal e a vitrine do ATLAS, mas não
deve competir com CoinGecko, CoinMarketCap ou DefiLlama. Precisa ser
objetivo e seguir a visão de mercado dele. O site não é público: ele mostra
para quem chega até ele (ver o plano de venda futuro).

## Escolhas do dono

- **Responder logo de cara:** em que fase o ciclo está, para onde vai o
  dinheiro, RWA e ações tokenizadas.
- **Sai:** tokens em alta, maiores quedas, volume anormal, alertas de 24 h e
  as abas Análises e Rendimentos.
- **Fica:** o mapa global de liquidez.
- **Sem** bloco de texto "minha leitura".

## Como ficou (`mercado/js/dashboard.js`)

- Abas: **Panorama · DeFi · RWA** (eram 6).
- **Panorama**, em três seções (`cicloSecao`, `dinheiroSecao`, `rwaSecao`):
  1. *Em que fase o ciclo está*: um quadro "Fase pelos indicadores" e quatro
     cartões. O primeiro é Bitcoin × média de 200 dias (múltiplo: <0,8 zona
     barata, <1 abaixo, <1,5 alta, <2,4 aquecido, acima disso esticado). Os
     outros são distância do topo histórico, dominância do BTC e medo e
     ganância. Abaixo, o gráfico de 1 ano com a média de 200 dias tracejada
     (`AcademyChart.line` ganhou `opts.extra`). A fase sai da média de 200
     dias com a distância do topo: fundo/acumulação, baixa ou recuperação,
     recuperação, alta saudável, alta aquecida ou euforia. É sempre
     apresentada como leitura de indicadores, não como previsão.
  2. *Para onde vai o dinheiro*: stablecoins em circulação com a variação de
     30 dias (`circulatingPrevMonth`, novo em `core/providers/defillama.js`)
     e o TVL do DeFi com 30 dias. Depois o TVL por rede, o mapa global de
     liquidez e o fluxo de protocolos.
  3. *RWA e ações tokenizadas*: total de RWA tokenizado com 7 dias
     (`change_7d`, novo no provedor) e o maior emissor; depois os maiores
     protocolos de RWA e as ações tokenizadas.
- **DeFi:** a barra de números, TVL por rede, fluxo de protocolos, o mapa, a
  tendência do TVL, as stablecoins e a dominância (saíram rendimentos e
  alertas).
- **RWA:** os maiores protocolos e as ações tokenizadas.
- Cada cartão sem dado mostra "indisponível". Conferido com fontes simuladas
  (sem acesso à rede neste ambiente).
