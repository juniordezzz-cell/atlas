# Scanner: cobertura, razão e decisões por pool

Autorizado pelo usuário em 26/09/2026: aplicar, documentar e subir ao GitHub.
Este documento substitui as regras de classificação e pré-corte da spec de 23/09.

- Razão = volume real de 24h / TVL. Razão <= 0,50 sai de todo o scanner.
- Memecoin detectada vai para **Pendentes de análise** (valor interno legado `caca`).
- Pendentes com razão <= 2,00 saem. Aprovar não contorna esse corte de elegibilidade.
- Demais pools entram em **Sólidas** por padrão, inclusive quando faltam idade,
  holders ou segunda confirmação. Sólidas é a lista principal, não garantia de segurança.
- Bloqueios de segurança existentes continuam acima das decisões do usuário.
- ✓ verde aprova uma pool; ✕ vermelho rejeita uma pool. Sem decisão permanece pendente.
- Decisão persistente por rede + endereço da pool, quando conhecido; ID de fonte como
  alternativa. Nunca usar apenas símbolo ou par: versões/taxas diferentes são pools diferentes.
- Detecção de meme por ID CoinGecko, obtido do contrato na GeckoTerminal, associado
  à categoria `meme-token`. Sem dado não significa meme. Limites/falhas são visíveis.
- Pedido posterior do usuário: **TVL >= US$ 100.000 é obrigatório**, inclusive
  em dados antigos, pools manuais e aprovadas. O seletor só permite elevar esse mínimo.
  Não há piso absoluto independente de volume; razão > 0,50 continua obrigatória.
- Complementar descoberta por contrato de token, com orçamento explícito de chamadas;
  não prometer cobrir todas as pools de todas as redes em uma execução.
- Persistência das decisões segue a arquitetura existente: navegador + backups;
  não sincroniza entre dispositivos. Lista antiga de bloqueios por token permanece válida.

Regressão principal: UNI na Base/Uniswap. As pools com razão <= 0,50 devem ser
descobertas mas eliminadas. Após o pedido de TVL mínimo obrigatório, UNI/WETH
0,05% com TVL ~US$750 também fica fora, mesmo com razão > 0,50.
