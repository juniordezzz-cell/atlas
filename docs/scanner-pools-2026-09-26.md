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
