# Scanner Pools — registro para Codex e Claude Code

## Pedido e diagnóstico

Em 26/09/2026 o usuário mostrou várias pools de UNI na Uniswap/Base, enquanto
o Scanner exibia somente WETH/UNI 1%. APIs confirmaram duas causas: DefiLlama
retornou duas pools UNI/Base nessa consulta e o coletor descartava TVL < US$100 mil
ou volume < US$50 mil antes dos filtros da tela. GeckoTerminal por contrato de UNI
retornou pools v3/v4 e taxas distintas. Usuário autorizou implementar e subir.

Referência atual, acima dos documentos de 23/09:
[spec vigente](superpowers/specs/2026-09-26-scanner-regras-design.md).

## Comportamento implementado

1. Razão = volume real de 24h / TVL. <=0,50 exclui de Descobrir e Radar.
2. Pools sem meme detectada entram em Sólidas por padrão. Falta de idade, holders,
   market cap ou confirmação não significa meme. Sólidas não garante segurança.
3. Memecoin detectada vai para Pendentes de análise; <=2,00 exclui mesmo se aprovada.
4. ✓ verde aprova somente aquela pool; ✕ vermelho rejeita somente aquela pool.
   Sem decisão permanece pendente. Decisões são reaplicadas após novas coletas.
5. Bloqueios de segurança anteriores continuam prioritários. Fórmula e nota mínima
   não mudaram (não há corte por nota mínima).
6. **Pedido posterior vigente: TVL >= US$100 mil obrigatório** na coleta e na tela,
   incluindo pools manuais, aprovadas e cache. Seletor permite apenas mínimos maiores.
   A remoção anterior do piso foi substituída pelo usuário após observar pools rasas
   com razão inflada. UNI/WETH com TVL ~US$750 sai mesmo com razão ~1,54.
   O piso absoluto independente de volume continua removido.

## Arquivos e identidade

- `pools/classificacao.py`: cortes inclusivos e trilho padrão.
- `pools/memes.py` e `fontes.py`: categoria oficial CoinGecko `meme-token`, até
  20 páginas de 250 IDs. Associação pelo `coingecko_coin_id` obtido a partir do
  contrato. Reserva conservadora de IDs conhecidos para falhas; nunca inferir pelo nome.
- `pools/descoberta.py`: complementa DefiLlama consultando pools por contrato de
  token na GeckoTerminal: até 24 contratos/coleta e uma página/contrato, com rotação.
  UNI/Base é prioridade para a regressão relatada. Demais sementes vêm das fontes
  configuradas. Fusão exige os dois contratos, rede, DEX, versão, fee e TVL próximo,
  com correspondência única. Não funde endereços Gecko distintos por semelhança.
- `conferencia.py`: conserva identidade descoberta quando conhecida; corrige números
  sem usar falta de confirmação como motivo para Pendentes.
- `servidor.js` e `index.html`: decisões por rede + endereço da pool; ID da fonte
  como alternativa. Alias do ID preserva decisão quando endereço aparece depois.
  Entre fontes distintas, decisão só compartilha identidade com endereço conhecido.
- `core/atlas-storage.js`: `estudo_pools_liquidez_decisoes_v1` no backup central.
  Exportar/Importar do Scanner inclui `decisoes`. Backups antigos são aceitos sem
  apagar decisões que não constavam nesses arquivos.
- Aprovações antigas por token ficam guardadas mas inativas; bloqueios por token
  seguem válidos. Decisões ficam no navegador; não sincronizam entre dispositivos.
- `scanner-pools.yml`: coleta também dispara em push na main que muda o coletor.
- `central-rwa-tests.yml`: regressões JS em Node 24, além da suíte Python.

Schema Supabase não mudou: `caca` é o valor interno legado para Pendentes de análise.
Não renomear isoladamente enum/check do banco. Ocultar não apaga histórico/posições.

## Limitações

- Categoria CoinGecko não detecta toda meme. Sem ID, tokens ainda não consultados
  (limite de 100 consultas/coleta) e falhas da categoria podem deixar memes passar.
  “Não detectada” nunca equivale a “comprovadamente não é meme”.
- Descoberta é limitada, não enumera todo o universo on-chain. Rotação amplia
  cobertura entre coletas; falhas/orçamento são sinalizados no status.
- Linhas antigas sem sinais de meme usam o novo padrão até a próxima coleta.
- Limpar armazenamento/trocar navegador exige restaurar backup para reter decisões.
- Autenticação de produção não foi alterada. Teste visual usou cópia local com
  dados sintéticos, sem dados do usuário; cópias de teste não são publicadas.

## Validação e revisão

Regressões escritas antes da implementação reproduziram falhas antigas.
Suíte Python: 151 testes passaram localmente; duas suítes Postgres dependem de pgserver e são
puladas no Windows. CI Linux mantém essas integrações. Node: 7 testes de cortes,
refresh, identidade entre fontes e backup. Bateria HTML: 22 passaram, 0 falharam.
No navegador: razão 0,50 e meme 2,00 ocultadas; meme 3,20 pendente; ✓ levou a
Sólidas e persistiu após reload; ✕ rejeitou e continuou fora após reload.

Revisão independente corrigiu aprovações legadas por símbolo, casamento por
contratos e falhas de descoberta que poderiam aparecer como status ok.

## Próximo passo

Conferir a primeira coleta em Actions e comparar UNI/Base/Uniswap com as regras.
Depois ampliar detecção de memes sem CoinGecko ID, sem alterar critérios sem pedido.

## Correção posterior: TVL mínimo obrigatório

Motivo: denominador minúsculo produz razões gigantes e resultados sem liquidez.
Corte TVL < US$100.000 no `passa_pre_corte` e no `trilhoEfetivo`, antes de aprovação
ou classificação; `fTvlMin` não permite baixar o piso. Histórico não é apagado.
Regressões cobrem TVL 0; 0,22; 1; 22; 41; 800; 1.000; 99.999,99 e fronteira 100.000,
inclusive dados em cache, manuais e aprovadas. 152 Python passaram (2 suites
Postgres puladas no Windows); 8 Node passaram. Regras de razão e decisões preservadas.


## Assistente local do Scanner (27/09/2026)

Metodologia e contexto para Codex/Claude: [scanner-pools-metodologia-ia.md](scanner-pools-metodologia-ia.md). Primeira etapa autorizada: aba ampla e botão flutuante nas outras abas, com a mesma conversa em memória. Independente do Oráculo principal (`core/ui/atlas-shell.js`). Ainda não há integração OpenRouter, gateway, chave, pesquisa externa ou simulador de posição.

`assistente-dados.js` consulta todo `state.pools`, não só a página visível, preservando `trilhoDe`, decisões, TVL, razão e exclusões de migração/arquivo. Atende lista/favoritas, perguntas com capital/meta/prazo e evolução diária de TVL das favoritas. Interpretação de linguagem ainda é restrita; pergunta não suportada recebe ajuda explícita. Em meta, capital × fee%/100 × vol24h/TVL × dias é apenas referência agregada. Exclui ve(3,3) dessa fórmula e não promete taxa da faixa nem lucro líquido. A classificação real conservadora/mediana/agressiva exige montagem, objetivo e prazo.

`assistente-ui.js` renderiza conteúdo via `textContent`, compartilha conversa entre aba e painel, não envia espontaneamente. `assistente-regras.json` resume regras vigentes, editadas a partir do MD. `servidor.js` expõe `historicoDiario(sid)` com `dia` original; o histórico é buscado pela consulta mesmo sem abrir Radar, com cache de cinco minutos e até quatro requisições concorrentes. Comparação de “últimos dois dias” requer registro no dia atual e outro exatamente dois dias antes; se não houver, marca histórico insuficiente. Registros diários não são horários exatos de coleta. Favoritos/decisões continuam locais ao navegador.

Validação: 18 testes Node (10 do assistente, 8 anteriores) e 152 Python, 2 suítes Postgres puladas no Windows. Prévia local sem autenticação de produção confirmou aba, regras e conversa compartilhada no painel. Essa cópia de teste não é publicada. Revisão independente identificou e corrigiu comparação de histórico antigo como atual, filtro Sui ignorado e roteamento de diferença de TVL para regras genéricas.

Próximo incremento: gateway autenticado de OpenRouter gratuito e análise de consultas mais livres. Chave somente no servidor; verificar cotas atuais e privacidade antes de enviar qualquer contexto a provedor.


## Ação tokenizada confirmada pelo emissor (10/10/2026)

Pedido do dono: ação tokenizada da Robinhood confirmada vai para Sólidas. Diagnóstico: FMRGN, OTLGR e RROVR (Uniswap, Robinhood Chain) são FalconMargin, OtterLedger e RenderRover, tokens lançados em 09/10, sem cadastro na CoinGecko; ficam em Pendentes. As ações reais ("Apple • Robinhood Token", 87 mil holders) têm ID `*-robinhood-tokenized-stock`; a cópia "Apple (Robinhood)" usa o símbolo AAPL, tem 11 holders e $1,3 mi de TVL.

Decisões do dono: (1) ação com emissor confirmado é Sólida mesmo abaixo do mínimo de rendimento; (2) ticker de ação sem emissor confirmado vai para Pendentes.

`classificacao.rwa_confirmado(info)`: ID CoinGecko com `tokenized-stock|xstock|backpack-securities|bstock`, ou RWA_EXTRA/COMMODITIES com cadastro, ou ticker de ação com emissor não provável. `fraqueza_token` deixou de isentar pelo ticker; `categoria_token` aceita ticker novo confirmado; `trilho` pula o mínimo de rendimento quando um token é confirmado. Barradas (honeypot, wash, APR impossível) e volume suspeito continuam valendo. Efeito esperado na próxima coleta: NVDA/WETH, NVDA/USDG, SPCX/WETH e SPY/WETH da Robinhood e xStocks/bStocks em Pendentes por rendimento sobem; NFLX/USDC (Solana, sem cadastro) e wTCENTx/USDT (BNB, emissor provável) descem para Pendentes. 183 Python passaram (2 Postgres puladas).

Complemento (10/10/2026): stables e blue chips também deixaram de valer só pelo símbolo. `coleta._dispensa_consulta` agora só dispensa a moeda nativa (endereço zero); majors são consultados como qualquer token (cache de 7 dias, prioridade por TVL). `classificacao.major_falso`: símbolo de MAJORS com consulta feita e sem cadastro na CoinGecko (e fora de CONTRATOS_RECONHECIDOS) vira altcoin e token fraco. Sem consulta ainda, vale o símbolo, para a primeira coleta não derrubar as Sólidas. Conferido na GeckoTerminal: USDG Robinhood (global-dollar, 418 mil holders), WETH Robinhood/Base, USDC Base, USDT BNB/Ethereum, USD1 BNB, SOL bridged em Base/Arbitrum/BNB, WHYPE e SUI têm cadastro; o "PYUSD" DuXfm3… da Solana (110 holders, sem cadastro) estava nas pools como stable. 185 Python passaram.

Complemento 2 (10/10/2026): token consultado sem cadastro na CoinGecko deixa de ir para Pendentes e é **removido** (`classificacao.sem_cadastro`, chamado em `trilho` logo após o pré-corte), inclusive cópia de token grande e ticker de ação sem emissor; bridged conferida e CONTRATOS_RECONHECIDOS passam; sem consulta ainda (info None) continua Pendentes. Mínimo de par com altcoin baixou de 0,5 para 0,3%/dia: NEAR/WBNB, AERO/CBBTC, VELO/WETH e SOL/RAY (0,32–0,42%/dia, tokens sólidos) sobem. Guia atualizado. 185 Python passaram.

Complemento 3 (10/10/2026): `config.ALTCOINS_PREFERIDAS` = PYTH, RAY, ONDO, NEAR, AAVE, JUP. Par de preferida com MAJORS ou outra preferida é Sólida sem mínimo de rendimento (`classificacao.preferida` + bloco em `trilho` depois do RWA confirmado). Exige contrato confirmado (passa em `sem_cadastro` com consulta feita); token fraco, volume suspeito e barradas continuam valendo. Sobem: SOL/PYTH (0,252 e 0,113%/dia), WETH/AAVE, AAVE/WETH, AAVE/WBNB, USDC/AAVE, USDT/AAVE, WETH/ONDO, NEAR/USDC, SOL/NEAR, JUP/SOL e SOL/RAY. Para mudar a lista, editar o conjunto no config.py. 186 Python passaram.

## Nota por classe do par; ve(3,3) sem emissão (11/10/2026)

Pedido: a emissão da Aerodrome inflava a nota; PancakeSwap e Ethereum tinham notas baixas com ativos sólidos. Diagnóstico: a régua única de taxa (ponto bom 0,25–0,8%) e de rendimento (0,01–1%/dia) punia pares sólidos de taxa baixa — USDT/WBNB (PancakeSwap, 0,01%, US$ 15,6 mi, giro 2,3×) tirava 41; o TVL pesa 5%. Na Aerodrome, as pools do topo já eram boas pela taxa; dependiam da emissão pools como SOL/CBBTC e WETH/CBBTC 0,0085%.

Decisões do dono: nota das ve(3,3) conta só taxa × giro (`nota.eficiencia_nota`); a régua de entrada nas Sólidas continua vendo a emissão (`eficiencia`). Taxa e rendimento medidos pela classe do par (`nota.classe_nota`, `TAXA_CLASSE`, `RENDIMENTO_CLASSE`); para a nota, majors que são altcoin (BNB, AVAX, SUI, HYPE, POL) contam como blue chip. A coleta calcula a nota depois da categoria. Simulação com os dados de 11/10: USDT/WBNB 47→73, USDC/WETH Ethereum 51→78, USDC/USDT Velodrome 57→88; SOL/CBBTC Aerodrome 73→90 pela taxa (APR de taxa 111% a.a.), não pela emissão. Pares de cauda não mudam. Pendente: pools de taxa 0 da Curve e Uniswap v4 na Ethereum (USDT/USDS, US$ 49,5 mi) ficam com rendimento zero porque a fonte não informa taxa. 188 Python passaram.

Taxa zero (11/10/2026): 43 pools, todas da DefiLlama, que não traz o fee tier (Curve, Orca, Kamino, LFJ, Camelot, Ramses, QuickSwap; Uniswap v4 com "0.00%" — taxa abaixo de 0,005% — ou "Dynamic fee (hook)") mas traz `apyBase`. A coleta já usava o APR (`nota.eficiencia`, `taxa_inferida`); a tela fazia taxa × razão = 0 e mostrava "taxa ?". `index.html`: `aprTaxaFonte`, `feeEfetiva`, `feeHTML` (mostra "~taxa efetiva" = APR ÷ 365 ÷ razão) e `efic`/`temTaxa` usam o APR. Diagnóstico das maiores: USDT/USDS v4 (US$ 49,5 mi) tem taxa efetiva ~0,0006% e paga 0,45% a.a. — a nota baixa é real; USDG/USDC Curve ~0,005%; SOL/PUMP Orca ~0,22%; JUP/SOL Kamino ~0,38%.

Pool madura (11/10/2026): `config.IDADE_SOLIDA_DIAS = 30`. Pool com 30 dias ou mais é Sólida sem mínimo de rendimento (bloco em `trilho` depois do RWA confirmado); segurança, sem cadastro, memecoin e token fraco continuam valendo. Exemplo: CAKE/WBNB, 333 dias, 0,085%/dia. Das 213 pools em Pendentes por rendimento, 81 tinham idade ≥ 30 dias e 130 não tinham data (DefiLlama não informa). A conferência passou a guardar `pool_created_at` da busca da GeckoTerminal (`PoolGecko.criada_em`, `sinais.conferencia.criada_em`), e a memória do endereço devolve a data nas coletas seguintes; a fila da conferência cobre o acervo em ~2 dias. 190 Python passaram.

## Battle Pools (11/10/2026)

Aba nova entre Radar e Minhas pools: duas pools lado a lado para decidir onde pôr o mesmo ativo (ex.: SPCX/SOL na Raydium × USDT/SPCXB na BNB Chain). Arquivos próprios: `Ferramentas/scanner-pools/battle-pools.js` e `battle-pools.css`; no `index.html`, só o botão da aba, a `<section id="tab-battle">`, o `switchTab` e o botão ⚔ na tabela do Descobrir e nos cards do Radar (`BattlePools.adicionar`). Gráfico com as fotos de 4 em 4 h (`ScannerServidor.snapshots`, cai para `historico` diário), seletor 24 h / 3 dias / 7 dias, métricas TVL / Volume 24h / Rendimento por dia, e modo Valor ou Variação % (para pools de tamanhos diferentes). Placar com o vencedor de cada linha (rendimento por dia, APR, US$ 1.000 por dia e mês, razão, nota, TVL, volume, variação no período; taxa sem vencedor) usando as mesmas funções da tabela (`efic`, `aprOf`, `feeHTML`), e veredito em fatos, sem recomendação. Escolha guardada em `localStorage` (`scanner_battle_v1`). Fora do escopo: mais de duas pools e perda impermanente.

## Par de majors com liquidez; EURC é stable (12/10/2026)

Pedido: ETH/USDC, WBTC/WETH, ETH/CBBTC, USDC/CBBTC, USDT/WBNB, BNB/USDT e EURC/USDC caíam em Pendentes por rendimento (0,02–0,06%/dia), sem baixar a régua de 0,3%/dia das altcoins. Regra nova: par com os dois tokens em `config.MAJORS` (stable, blue chip, BNB, AVAX, SUI, HYPE, POL), fora stable/stable, com TVL e volume 24h ≥ US$ 250 mil (`MAJORS_TVL_MIN`, `MAJORS_VOL_MIN`) é Sólida sem mínimo (bloco em `classificacao.trilho` depois das altcoins preferidas). Stable/stable segue com o piso de 0,01%/dia; cópia com símbolo de major já sai antes (sem cadastro/token fraco). EURC entrou em MAJORS e STABLES (EURC/USDC passa a stable/stable, 0,017–0,025%/dia). Tela: `servidor.js` ganhou EURC nas listas e `majorsComLiquidez` + `soPorRendimento` em `trilhoEfetivo`, que soltam na hora as pools com motivo só de rendimento gravado antes da regra. Nos dados de 12/10, 35 pools saíram de Pendentes; as 9 do print viraram Sólidas; WETH/USDC com US$ 135–156 mil de TVL ficam. 192 Python e 19 JS passaram.

Complemento (12/10/2026): `config.ALTCOINS_PREFERIDAS` ganhou ENA, ZRO, SKY, AERO, UNI, ETHFI, ARB e LDO (rendiam 0,16–0,24%/dia: ENA/WETH, ZRO/WETH, SKY/USDC, AERO/CBBTC, USDC/UNI, WETH/ETHFI, WETH/ARB, LDO/WETH). A tela espelha a lista em `servidor.js` (`PREFERIDAS`, `parDePreferida`) e solta na hora as pools com motivo só de rendimento; cadastro e token fraco continuam valendo. USDC/USDC (Polygon, 0,005%/dia) segue no piso de stable/stable. 193 Python e 20 JS passaram.

## Stable oficial com mint/freeze; ve(3,3) que paga em emissão perde nota (12/10/2026)

PLTRx/USDC da Orca (US$ 126 mil, giro 1,5×, `palantir-xstock`) não aparecia: chegava da Orca e era barrada por "mint ativo, freeze ativo" — do **USDC**, não da ação. Na Solana a Circle (e a Tether) mantém mint e freeze por desenho. Atingia 67 das 117 pools diretas da Orca/Raydium no pré-corte (SOL/USDC, cbBTC/USDC, NVDAx/SPYx/METAx/MSFTx/GOOGLx/MSTRx/AVGOx/CRCLx/USDC…). `classificacao.motivos_barrada` agora pula mint/freeze/dev de token em `config.MAJORS` com cadastro na CoinGecko ou contrato reconhecido; cópia segue travada e honeypot vale para todos. As outras pools de PLTRx na Solana têm menos de US$ 100 mil de TVL (corte obrigatório).

Nota (pedido do dono: renda nos tokens do par, não em AERO): `nota.parte_emissao` = reward ÷ (reward + APR de taxa), só nas ve(3,3) (nas outras DEXs o reward é extra). Nota final = nota × (1 − 0,5 × parte), `PERDA_EMISSAO = 0.5`; componente novo `emissao`. Pool da Aerodrome sem emissão não muda. Dados de 12/10: SOL/CBBTC 91,8→54,6, WETH/CBBTC 89,3→45,5, USDC/MSTRC 90,5→46,5, WETH/ZRO 85,2→70,6. Tela: `servidor.js` (`notaComEmissao`) aplica a perda em linha gravada sem `emissao`; a dica da nota diz quanto da renda vem em AERO; Guia 16 atualizado. Depois da fusão Aero (21/10) as emissões param e a perda some sozinha. 195 Python e 21 JS passaram.

Complemento (12/10/2026): THENA e parte da Velodrome só vêm da GeckoTerminal, sem APR nem reward (a DefiLlama não lista a THENA Fusion), e escapavam da perda. Pedido do dono: baixar a da THENA também. `nota.PARTE_EMISSAO_PRESUMIDA = 0.6` (mediana medida em 67 pools da Aerodrome: 55%) para ve(3,3) com APR e reward ausentes — nota × 0,7 e componente `emissao_presumida`; APR de taxa informado sem reward continua sem perda. Tela igual (`semDadoEmissao` em `servidor.js`), dica diz "presumido". THENA ETH/USDT 62,4→43,7; Velodrome USDC/USDT 87,8→61,5. Revisar tudo depois da fusão Aero (21/10). 196 Python e 22 JS passaram.

## Pool duplicada DefiLlama × Orca/Raydium (12/10/2026)

Depois que o USDC deixou de barrar, PLTRx/USDC, SPCXx, NVDAx, GMEx, BABA, DJT, HIMS e outras apareciam duas vezes: a DefiLlama manda taxa 0 (não informada) e a Orca/Raydium a taxa real, e `coleta.reconciliar_diretas` exigia taxa igual. Regra nova (pedido do dono: conferir endereço, TVL e taxa): mesma rede e DEX, os mesmos dois contratos, TVL até 15% diferente e taxa igual ou não informada por um dos lados; taxas informadas e diferentes (0,08% × 0,25%) ficam separadas; só junta casamento único nos dois sentidos. Fica o ID da DefiLlama, com a taxa da direta. SOL/USDC da Orca (0,01/0,02/0,04%, DefiLlama sem taxa) casa cada tier pelo TVL. Tela: `semDuplicataDireta` em `servidor.js` com a mesma regra, e a remoção antiga por endereço da conferência passou a levar a taxa da cópia. Solana na tela: 131 → 89 pools. 200 Python e 23 JS passaram.

Complemento (12/10/2026, depois da coleta das 23:10): SOL/USDC 0,01% da Orca seguiu duplicada — a DefiLlama tem três SOL/USDC da Orca sem taxa (US$ 203, 211 e 223 mil), o TVL não decide e `reconciliar_diretas` corretamente não junta. A conferência já sabia o endereço (83v8…), mas `unir_mesma_pool` só casava pelo endereço com fonte `geckoterminal`; passou a incluir `orca` e `raydium` (mesmo formato de ID `gecko:solana:<endereço>`). 201 Python passaram.
