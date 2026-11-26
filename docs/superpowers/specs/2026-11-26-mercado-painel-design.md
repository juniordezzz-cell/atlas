# Mercado: Painel de quatro abas (design aprovado em 26/11/2026)

Desenho aprovado pelo dono: [docs/propostas/mercado-painel-2026-11-26.html](../../propostas/mercado-painel-2026-11-26.html).

## Por quê

A aba Mercado é a entrada do site e hoje não serve nem ao dono: o título fica
encostado à esquerda, o globo ocupa o centro com 7 pontos, a mesma lista de
"em alta" aparece duas vezes e traz lixo (A7A5 +550%), e os horários dos
Alertas são inventados. O objetivo é que o dono abra o ATLAS para estudar o
mercado em vez de TradingView, CryptoBubbles e CoinMarketCap.

## Decisões do dono

- Fica só o modelo A (Painel). Bolhas descartadas.
- Abas centralizadas: **DeFi · Tokens · RWA · Rendimentos**. Sempre abre em DeFi.
- DeFi: protocolos (Aave, Uniswap, Lido, **Hyperliquid**…), TVL e volume 24h.
- Tokens: maiores altas e quedas 24h etc.
- RWA: ações tokenizadas.
- Rendimentos: proposta minha aprovada (dólar parado, régua do Tesouro
  tokenizado, staking, melhores pools do Scanner).

## Abordagens consideradas

1. Terminal (A) — escolhido.
2. Briefing (B) — descartado pelo dono.
3. Bolhas (C) — desenhado como chave alternativa e depois descartado.

## Esqueleto comum

Esteira de cotações (fica como está) · abas centralizadas · frase do dia
centralizada (montada dos números, nunca escrita à mão) · faixa de 5 números ·
miolo em 3 colunas (lista | mapa de calor | lista ou "O que mudou hoje") ·
3 painéis embaixo · tabela.

## Dados (todos grátis, sem chave)

| Bloco | Fonte |
|---|---|
| Protocolos, TVL, 1d/7d, redes | DefiLlama `/protocols` (já usado), agrupado por `parentProtocol`; fora: CEX, Chain, pontes e curadores (contam em dobro) |
| Volume DEX 24h | DefiLlama `/overview/dexs` |
| Volume de perpétuos da Hyperliquid | `api.hyperliquid.xyz/info` `metaAndAssetCtxs` (soma de `dayNtlVlm`); o overview de derivativos da DefiLlama virou pago (402) |
| Taxas 24h | DefiLlama `/overview/fees` |
| Stablecoins total e 7d | `stablecoins.llama.fi/stablecoincharts/all` |
| Redes e fluxo 7d | DefiLlama `/v2/chains` + série por rede (já usado) |
| Tokens | lista ampla de `AcademyData.markets()` (já usada) com filtro de qualidade |
| Ações tokenizadas | CoinGecko categoria `tokenized-stock` (já usada) |
| RWA por protocolo | DefiLlama `/protocols` categoria RWA (já usado) |
| Rendimentos | `yields.llama.fi/pools` (já usado); régua = BUIDL ponderado por TVL |
| Pools do Scanner | `Ferramentas/scanner-pools/servidor.js` (o mesmo que o Simulador lê) |

## Regras

- Nunca inventar número. Campo ausente mostra "—"; painel sem dado mostra
  "indisponível" com "Tentar de novo".
- "O que mudou hoje" mostra a hora em que os dados chegaram, igual para todos
  os sinais da mesma leitura. Selos em português: alta, média, baixa.
- Filtro de qualidade em listas de alta/queda de tokens: valor de mercado
  acima de US$ 50 mi, volume 24h acima de US$ 1 mi, sem stablecoins.
- Risco nos Rendimentos é **estimado** por tipo de produto e escrito assim
  na tela: baixo (Tesouro, empréstimo dos grandes, staking líquido), médio
  (cofres e curadores), alto (dólar sintético e o que rende mais que 2× a régua).
- Cada aba carrega seus dados só quando aberta.

## Fica para depois

- Coluna "preço na bolsa" das ações tokenizadas (precisa de fonte de ações).
- Página própria de protocolo (clique no mapa leva ao DefiLlama por enquanto;
  token com `gecko_id` abre a página do ativo do ATLAS).
- Frase do dia por IA (por enquanto montada por regra a partir dos números).

## Arquivos

- `mercado/js/dashboard.js` reescrito (painel novo).
- `mercado/js/market-data.js` e `core/providers/defillama.js`: funções novas.
- `mercado/js/academy-treemap.js` novo (mapa de calor, algoritmo squarify).
- `mercado/css/painel.css` novo.
- `mercado/js/academy-globe.js` sai do `index.html`.
