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
6. TVL mínimo da tela é opcional e começa em “tudo”; pisos absolutos saíram da coleta.
   UNI 1% com razão ~0,2 agora sai por pedido do usuário; UNI/WETH 0,05% com razão
   ~1,54 pode aparecer mesmo com TVL ~US$750.

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
