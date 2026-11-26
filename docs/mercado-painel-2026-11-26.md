# Mercado reformado: Painel de quatro abas (26/11/2026)

Design aprovado: [spec](superpowers/specs/2026-11-26-mercado-painel-design.md) e
o desenho [mercado-painel-2026-11-26.html](propostas/mercado-painel-2026-11-26.html).
Propostas anteriores (descartadas): `propostas/mercado-proposta-2026-11-26.html`
e `propostas/mercado-painel-e-bolhas-2026-11-26.html` (bolhas recusadas pelo dono).

## O que mudou na tela

- Saíram: título "Panorama global" à esquerda, relógio "ao vivo", globo, as
  abas Mercado geral / Análises / Alertas 24h, e a lista de "em alta" repetida.
- Abas **centralizadas**: DeFi · Tokens · RWA · Rendimentos. **Sempre abre em
  DeFi** (a aba escolhida só vale enquanto a página está aberta).
- Esqueleto igual nas quatro: esteira de cotações (a mesma de antes), frase do
  dia centralizada (montada por regra a partir dos números), faixa de 5
  números, miolo em 3 colunas com o **mapa de calor** no centro, 3 painéis e
  tabela ordenável.
- **DeFi:** protocolos agrupados pela mãe (Aave V2+V3 = Aave), Hyperliquid
  incluída (Earn, HLP e Spot; a ponte fica de fora como todas as pontes),
  TVL, volume 24h (DEX + perpétuos da Hyperliquid), taxas 24h. Clicar numa
  rede (lista ou título no mapa) filtra mapa e tabela; clicar de novo volta.
- **Tokens:** altas e quedas 24h com filtro de qualidade (≥ US$ 50 mi de valor
  de mercado, ≥ US$ 1 mi de volume, sem stablecoins, sem variação acima de
  200%), mapa dos 30 maiores, volume fora do normal, setores, tabela.
- **RWA:** ações tokenizadas (altas, quedas, mapa das 30 maiores, mais
  negociadas, tabela); classes (crédito privado, Tesouro, ouro, prata) nos
  números e na lista, pelas categorias da CoinGecko.
- **Rendimentos:** dólar parado (stablecoins com mais de US$ 200 mi e pelo
  menos 1% ao ano), staking, gráfico rendimento × risco com a régua do
  Tesouro tokenizado (BUIDL ponderado por TVL) e as melhores pools Sólidas do
  Scanner (clique abre o Simulador com a pool).
- **"O que mudou hoje"** mostra a hora em que os dados chegaram, igual para
  todos os sinais da leitura, com selos alta/média/baixa em português.

## Erros corrigidos de passagem

- Horários inventados nos Alertas 24h (`hora atual − i × 137 s`) e selos em
  inglês: o painel saiu.
- A7A5 +550% (stablecoin de rublo) como destaque: barrado pelo filtro.
- `AtlasHttp` tentava gravar no `localStorage` as respostas de ~10 MB da
  DefiLlama (`/protocols`, `yields`): convertia tudo em texto a cada leitura
  e a gravação falhava. Agora `lerGrande()` em `core/providers/defillama.js`
  guarda só em memória.
- Variação de taxas tipo "+19.920%" (dia anterior quase zerado): acima de
  500% vira "—".

## Fontes que mudaram (ver `docs/apis/inventario.md`)

- Volume de perpétuos da DefiLlama ficou pago (402) → provedor novo
  `core/providers/hyperliquid.js` (API pública da Hyperliquid).
- `/protocols` da DefiLlama zera BUIDL, Ondo, Paxos Gold e Tether Gold → RWA
  pelas categorias da CoinGecko (`AcademyData.categoriasRwa`).

## Arquivos

- `mercado/js/dashboard.js` — reescrito.
- `mercado/js/academy-treemap.js` — novo (squarified, em %, 2 níveis).
- `mercado/css/painel.css` — novo.
- `mercado/js/market-data.js` — funções novas com resumo guardado
  (`guardado()` em `atlas.mercado.v1`, devolve o último bom de até 24 h se a
  fonte falhar).
- `core/providers/defillama.js` — `defiProtocolos`, `defiVolume`,
  `defiTaxas`, `stablecoinsTotal`, `yieldsBrutos`; `defiChains` ganhou
  `change7d`/`delta7d`; `rwaTvl` ganhou `change7d` e link.
- `core/providers/hyperliquid.js` — novo.
- `mercado/js/academy-globe.js` — apagado. `sw.js` → v108.
- `mercado/index.html` — inclui `atlas-supabase-config.js` e
  `ferramentas/scanner-pools/servidor.js` (pools do Scanner).

## Limitações conhecidas

- Risco nos Rendimentos é **estimado** pelo tipo de produto (lista em
  `market-data.js`), e a tela diz isso.
- Protocolo sem `gecko_id` abre a página dele na DefiLlama (não há página de
  protocolo no ATLAS ainda).
- Filtro por rede usa os 200 maiores protocolos; redes pequenas mostram poucos.
- Ações tokenizadas dependem da CoinGecko grátis; no limite (429), os painéis
  mostram "indisponível" com "Tentar de novo".
- Coluna "preço na bolsa" das ações ficou para depois (precisa de fonte de ações).
