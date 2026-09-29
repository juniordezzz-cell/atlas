# Oráculo — registro de operações internas

Implementado em 29/09/2026. Independente do assistente OpenRouter do Scanner Pools. Comandos de texto usam motor local sem API. A leitura de prints usa a integração separada descrita em [Oráculo por imagem](oraculo-imagem.md). Não conecta carteira nem executa transações em protocolos: registra operações que o usuário já realizou.

## Fluxo

O Oráculo interpreta comandos definidos, pede campos ausentes e apresenta uma prévia. `confirmar` registra; `cancelar` descarta. A confirmação revalida os dados atuais. Perguntas, negações, saldo insuficiente e posições ambíguas não gravam. Uma operação por mensagem. Rascunhos de comandos de texto ficam somente na sessão; rascunhos de prints são persistidos por usuário na aba Pools.

## Exemplos

- `Fecha posição SOL/HYPE na M2R` — usa valor e resultado já registrados, devolve o valor da posição e taxas pendentes ao caixa, preservando o histórico. Taxas já coletadas não retornam outra vez. Se houver posições iguais, informe protocolo e ID mostrado pelo Oráculo.
- `Abre pool SOL/HYPE na Orca na M2R, 1 SOL e 5 HYPE, preço SOL 100 e preço HYPE 20, rating 6%` — cria um registro novo; 6% significa −6%/+6% sobre a relação de preços. Também aceita `faixa 2 a 8 HYPE por SOL`. Capital calculado: quantidades × preços. Nunca cria depósito para cobrir falta de caixa.
- `Troquei 1 SOL por 5 HYPE na M2R na Solana` — registra quantidades e transfere o custo contábil do token enviado, sem inventar lucro do swap.
- `Transferi 1 SOL da M2R para M2P na Solana` — move o registro entre carteiras e preserva o patrimônio total.
- `Na verdade 2 SOL por 8 HYPE` corrige os dois lados do swap antes de confirmar. Em transferências, `na verdade 2 SOL` corrige a quantidade.

## Limites atuais

Datas anteriores, custos separados, bridges e atualização do valor final via chat não estão implementados. Atualize primeiro os dados da posição pela tela se o resultado estiver incorreto. O fechamento usa esses dados, não pesquisa a blockchain. Abrir outra faixa depois de fechar cria outro ciclo; não altera o histórico antigo. Após registrar, recarregue a tela para atualizar cartões. Os exemplos aceitam vírgula ou ponto decimal, sem separador de milhares. O motor não é um modelo que compreende qualquer frase.

## Arquitetura e verificação

`core/atlas-oraculo-operacoes.js` interpreta e prepara ações. O loader carrega os stores reais sob demanda; `core/ui/atlas-shell.js` serializa pedidos e mantém as consultas existentes. `defi/js/data.js` fecha a posição na carteira proprietária, mesmo que outra esteja selecionada. Não editar o assistente do Scanner para implementar essas operações.

Validação: `node --test core/atlas-oraculo-operacoes.test.cjs`. Integração no Chromium isolado validou abertura, fechamento, correção de swap e transferência. Páginas de regressão: Oráculo 154/154; DeFi 419/419. Testes de navegador usam dados fictícios e desativam somente a trava de login no contexto isolado.
