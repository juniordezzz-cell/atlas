# Assistente do Scanner Pools: metodologia e regras

Status: primeira versão para validação com o proprietário, em 27/09/2026. Não representa uma integração de IA já implementada.

## Origem e prioridade

Base: conversa com o proprietário e leitura integral das 16 páginas de `Sistema_9_Pools_MundoDeFi_369_Reestruturado.pdf` (MundoDeFi, Método 3–6–9).

O proprietário autorizou aproveitar a lógica de qualidade, montagem, faixa, horizonte e gestão. Explicitamente NÃO incorporar obrigação de abrir 3, 6 ou 9 pools, distribuição 1–1–1/2–2–2/3–3–3 ou proporções obrigatórias de capital. Exemplos e padrões do PDF não são comandos para executar operações nem resultados verificados independentemente.

## Identidade e escopo

Assistente independente do Oráculo principal, inicialmente exclusivo do Scanner Pools: Descobrir, Radar e comparação. Pode reaproveitar a estrutura visual do Oráculo, mas deve ter nome, instruções, contexto e configuração próprios. Só responde quando chamado.

### Escopo esclarecido pelo proprietário: chat sobre os dados internos

O produto solicitado NÃO é uma aba de simulador. É um assistente de consulta e análise em linguagem natural, com uma aba própria para chat em janela maior e um botão flutuante nas demais abas do Scanner Pools. As duas interfaces devem acessar a mesma conversa/contexto, sem se integrar ao Oráculo principal.

A fonte de dados é o próprio scanner: conjunto de pools armazenadas, favoritas, decisões, métricas atuais e histórico disponível. Não restringir uma consulta global às linhas da página visível. Respeitar os filtros explicitamente pedidos e distinguir universo completo, favoritos e seleção da tela. Não buscar CoinGecko ou outra fonte externa por padrão.

A API do modelo interpreta a pergunta e redige a resposta; o acesso aos dados do scanner e os cálculos dependem de funções internas que a aplicação fornecerá ao assistente. A chave sozinha não concede acesso ao banco ou navegador. Localização exata, autenticação e acesso a favoritos/histórico devem ser inspecionados na implementação, sem pressupor que tudo esteja no mesmo banco.

Exemplos prioritários:

- “Das pools disponíveis, quais se encaixam no cenário X para gerar US$ 2–3 de taxas em um dia com US$ 100?”: consultar as candidatas, aplicar critérios pessoais e cortes vigentes, calcular a referência de taxas com os dados disponíveis e explicar premissas e limitações da faixa. Não criar uma interface de simulação nem prometer rendimento. A meta corresponde a 2%–3% do capital por dia; não confundir com lucro líquido.
- “Das minhas favoritas, quais aumentaram o TVL nos últimos dois dias?”: consultar favoritas e comparar observações históricas por identidade da pool; apresentar TVL inicial/final, diferença em dólares e percentual, com horários reais. Se não houver observação adequada ou histórico suficiente, dizer isso sem fabricar uma comparação de 48 horas.

As respostas devem trazer uma seleção curta e justificada, números verificáveis e identificação das pools. O objetivo é evitar que o proprietário procure manualmente entre centenas de linhas. Cálculos e ordenações devem ocorrer em funções determinísticas; o modelo explica os resultados conforme a metodologia pessoal.

Integração implementada no código em `central-rwa/supabase/functions/scanner-chat/`: uma Edge Function recebe o token Firebase do usuário, valida a conta no Firebase, limita o acesso ao proprietário e reserva até 20 chamadas por dia UTC no banco antes de chamar exclusivamente `openrouter/free`. O navegador envia até 30 candidatas selecionadas do conjunto elegível e os resultados calculados localmente; a IA apenas explica os dados. Ela não busca preços fora do scanner, não faz operações e não substitui os cálculos determinísticos. Quando recebe menos candidatas que o total, deve declarar essa limitação. Falhas do provedor deixam as consultas locais disponíveis. O Oráculo principal permanece independente.

`central-rwa/supabase/functions/.env.example` reserva o nome `SCANNER_OPENROUTER_API_KEY` sem guardar o valor. Em produção, esse nome deve ser cadastrado nos segredos das Edge Functions do Supabase. Um GitHub Actions Secret com esse nome só serviria para um workflow, não para o chat da página já publicada. Não colocar o valor em HTML, JavaScript, JSON versionado ou GitHub Pages. O código publicado no GitHub não ativa a IA sozinho: aplicar a migration, implantar a função e então cadastrar a chave. Consulte `docs/scanner-pools-openrouter-deploy.md`.

Se a cota ou qualidade do OpenRouter for insuficiente, considerar um roteador próprio com Gemini e outros provedores, com orçamento, prioridade e limites por provedor. Não montar esse roteador antes de medir o uso real. O fato de o assistente responder somente quando chamado reduz chamadas, mas uma pergunta longa ou contexto grande ainda pode consumir muitos tokens; medir e limitar contexto, resposta e chamadas. Verificar cotas atuais antes da integração. Pesquisa externa exige uma ferramenta de consulta; não presumir que qualquer modelo acessa a internet.

## Duas avaliações distintas

1. **Qualidade e riscos da pool:** identidade dos dois ativos, categoria, liquidez, giro, taxa, sustentabilidade do volume, contratos, capacidade de saída e sinais de risco.
2. **Perfil da posição:** função, limites de preço, geometria, horizonte, tese, frequência de manutenção e gatilhos de saída.

Primeiro avaliar se a pool merece análise/entrada; depois definir a montagem. Ativo conhecido, TVL alto ou APR alto não aprovam automaticamente uma oportunidade. Faixa larga não elimina riscos do ativo ou protocolo. Faixa estreita em um par preferido pode produzir uma posição agressiva.

Usar conservadora, mediana e agressiva. Nunca chamar uma pool ou posição de segura. O termo Fixa no PDF corresponde à função estrutural da montagem conservadora nesta interface; não implica capital garantido.

## Referências de montagem extraídas do PDF

| Perfil | Referência de faixa no método | Função | Horizonte de referência | Manutenção |
|---|---|---|---|---|
| Conservadora (Fixa no PDF) | 30% a 60% | Base estrutural, permanência | 3 a 9 meses | Baixa |
| Mediana | 9% a 27% | Equilíbrio, posição de carteira | Cerca de 27 dias, com extensões justificadas | Média |
| Agressiva | 3% a 9% | Giro, taxas e eventualmente tese direcional | 3 a 9 dias | Alta |

Esses valores são referências do método, não fronteiras automáticas aprovadas para código. A classificação considera função e horizonte, tolerando diferenças justificadas de execução. Não alterar o selo por pequenas oscilações nem transformar uma agressiva em mediana por simples permanência.

### Desempate confirmado: range de 9%

O proprietário aprovou usar objetivo e prazo para desempatar em 9%, sem classificar apenas pelo percentual. Para uma montagem simétrica, 9% significa −9%/+9%.

- **Agressiva:** objetivo de giro curto, captura de taxas e/ou tese direcional, com horizonte curto (referência de 3 a 9 dias) e acompanhamento ativo.
- **Mediana:** objetivo de equilíbrio ou posição de carteira, com horizonte maior (referência de cerca de 27 dias, admitindo extensões justificadas).
- **Contexto insuficiente ou contraditório:** perguntar objetivo e prazo; não inventar um selo definitivo. As referências de dias não criam uma nova fronteira automática para todo prazo intermediário.

Aplicar também a compatibilidade dos ativos e as exceções documentadas. Uma agressiva em 9% não vira mediana por permanecer aberta além do plano; reavaliar a tese e registrar uma eventual mudança deliberada de montagem.

O intervalo de 27% a 30% ainda não tem regra explícita. Registrar intenção da montagem e solicitar esclarecimento quando necessário.

## Faixa de preço: registrar os dois lados

Guardar preço de referência, unidade/cotação do par, limite inferior, limite superior, distância inferior e superior, data da leitura e se a posição está dentro da faixa.

Convenção confirmada pelo proprietário: “rating/range de 6%” significa, por padrão, −6% e +6% em torno do preço de referência, e NÃO −3%/+3%. Para preço P e percentual r em fração decimal, limite inferior = P × (1 − r) e superior = P × (1 + r). Exemplo: P = 100 e r = 0,06 produzem limites 94 e 106; a largura total corresponde a 12% do preço de referência.

Os percentuais da tabela seguem essa convenção por lado quando a montagem for simétrica. Montagens assimétricas devem informar separadamente os dois lados, como −6%/+9%; não presumir simetria quando limites explícitos forem fornecidos. “Rating” nesta conversa significa faixa de preço, não a nota de qualidade do scanner.

A geometria depende de volatilidade, tendência, correlação, liquidez, objetivo, prazo e tese. Se esses dados faltarem, informar a limitação. Não atribuir perfil definitivo a uma posição sem conhecer sua montagem; apresentar cenários possíveis para a pool.

## Preferências do proprietário

Pares crossover citados: SOL/Nvidia, SOL/SpaceX, BNB/BTC e ETH/BTC. São exemplos de interesse, não lista de contratos aprovados nem classificação conservadora automática. Identificar rede, contratos e natureza dos ativos, especialmente representações tokenizadas.

O proprietário declarou não gostar de investir em memecoins, mas esclareceu permissões específicas por montagem. Isso não torna memes uma preferência geral. Uma pool pendente ou aprovada no scanner não se torna uma recomendação pessoal automaticamente.

### Compatibilidade de ativos e exceções confirmadas

- **Conservadora: memecoin proibida em qualquer lado do par.** Faixa larga não cria exceção a essa regra. Categoria desconhecida não permite confirmar compatibilidade conservadora.
- **Mediana: pode conter memecoin em uma tese específica**, com prazo e saída definidos. Não presumir que a oportunidade dure todo o horizonte de referência do PDF; a duração deve ser justificada pelo cenário.
- **Agressiva: montagem de faixa apertada e giro.** BTC e ETH geralmente ficam fora das montagens agressivas no método pessoal; é uma preferência padrão, não um bloqueio absoluto. Registrar eventual exceção e sua justificativa, sem inventar autorização.
- **SOL pode integrar os três perfis.** SOL com um token em forte movimento pode receber montagem agressiva para entrada e saída curtas. Isso NÃO muda a categoria de SOL para memecoin. Classificar cada token separadamente e a posição pelo conjunto de faixa, função, prazo e compatibilidade dos ativos.

Na comunicação comum, priorizar a regra principal. Exceções pertinentes podem aparecer com asterisco e explicação curta. No registro interno, guardar regra aplicada, motivo da exceção e se foi explicitamente confirmada pelo proprietário. Não usar a existência de exceções para contornar cortes obrigatórios ou a proibição de meme em conservadora.

As referências a valorização de BTC/ETH e a movimentos de pump and dump descrevem a tese/preferência do proprietário; não são garantias de valorização nem evidência de oportunidade. O assistente deve validar dados atuais antes de analisar um caso concreto.

## Cortes vigentes do scanner

- TVL >= US$ 100.000, incluindo cache, pools manuais e aprovadas.
- Razão = volume real das últimas 24 horas / TVL; razão <= 0,50 exclui.
- Memecoin detectada: razão <= 2,00 exclui; acima disso fica pendente até decisão por pool.
- Aprovação verde promove aquela pool; rejeição vermelha mantém aquela pool fora após atualização. Não aprovar por símbolo.
- Sólidas é uma lista operacional, não certificação de segurança. Bloqueios existentes continuam prioritários.

## Matemática e projeções

Com taxa em fração decimal: razão = volume24h / TVL; eficiência agregada diária = taxa × razão; APR agregado aproximado = 365 × eficiência × 100%.

Essa aproximação descreve a pool sob as premissas informadas. NÃO equivale ao rendimento de uma posição concentrada específica: faltam participação na liquidez ativa, distribuição por faixa, movimento de preço e tempo dentro da faixa. Não aplicar um multiplicador arbitrário pela concentração.

Para perguntas como “quero US$ 2–3 em dois dias”, obter capital, limites da faixa, prazo, objetivo e custos pertinentes. Separar taxas estimadas, variação do valor dos ativos, comparação com manter os ativos e resultado líquido. Não prometer meta atingida.

Mostrar fonte e horário dos dados, fórmulas, hipóteses e dados ausentes. Se só houver uma observação de volume24h, não afirmar sustentabilidade nem inventar histórico. Cenários de volume constante, queda ou alta devem ser identificados como hipóteses, não previsões comprovadas.

IL é a diferença de desempenho frente a manter os ativos sob a mesma evolução de preços; não é liquidação. Taxas não garantem compensação. Valores dos cases do PDF são relatos: CASHCAT/USDG contém divergência de taxas (US$ 1,64 versus US$ 1,84), e os saldos/PnL dos demais cases não devem ser somados sem reconciliar o que cada campo inclui.

## Processo de análise

Pool elegível → qualidade e riscos → adequação ao proprietário → função da posição → faixa → prazo → cenários → plano de monitoramento e saída.

Não escolher pelo maior APR. Explicar por que uma montagem atende ao objetivo, quais condições invalidam a tese e quando nenhuma candidata atende. Uma saída de faixa exige avaliação da tese e do plano; o assistente não executa operações por conta própria.

## Adaptação por memória

Guardar escolhas, rejeições, motivos, contexto da análise e resultados posteriores quando fornecidos. Distinguir preferência declarada de inferência. Propor mudanças de metodologia ao proprietário antes de torná-las regras permanentes. Não afirmar que o modelo retreinou seus pesos ou melhorou sua precisão só porque acumulou conversas.

## Próximas definições

### Inspeção do código existente (27/09/2026)

- `Ferramentas/scanner-pools/servidor.js`: `ScannerServidor.carregar()` lê as visões Supabase `scanner_pools` e `scanner_status`, com paginação. Em falha, utiliza `estudo_pools_liquidez_servidor_cache`, sinalizando cache. Não existe limite da página visual na consulta ao servidor.
- `index.html`: `carregarServidor()` reúne pools do servidor e pools locais em `state.pools`. A consulta do assistente deve usar esse conjunto e aplicar identidade, cortes e decisões, excluindo duplicatas locais migradas e arquivadas.
- Favoritas, níveis e notas do servidor são marcas por `sid`, armazenadas em `estudo_pools_liquidez_marcas`. Pools manuais ficam em `estudo_pools_liquidez_v1`. Decisões por pool ficam em `estudo_pools_liquidez_decisoes_v1`. O gateway não sabe quais são as favoritas: o navegador precisa informar IDs e contexto necessários.
- `ScannerServidor.historico(sid)` consulta `scanner_leituras`. Hoje essa consulta é disparada por `initRadarChart()` quando uma pool é aberta. A resposta global sobre favoritas não pode depender de a pessoa já ter aberto seus gráficos; o assistente deve carregar as leituras necessárias explicitamente, preferencialmente em lote com cache.
- Migração `central-rwa/supabase/migrations/20260923000001_scanner_pools.sql`: `scanner.leituras` tem chave `(pool_id, dia)`. É histórico diário, não uma série de horários exatos de cada coleta. A conversão atual do frontend atribui meio-dia ao dia; esse horário sintético NÃO deve ser apresentado como horário de coleta. Para comparações históricas, preservar o campo `dia` original.
- `var_tvl_7d` usa uma base disponível dentro de sete dias; não atende diretamente à pergunta sobre dois dias. Calcular a comparação pedida com registros identificados, informando as datas e eventuais lacunas. Com base zero, não apresentar variação percentual finita.
- O frontend também tem um snapshot atual em `visto_em`/`updatedAt`. Diferenciar esse horário real de atualização dos registros históricos diários.
- O Oráculo compartilhado em `core/ui/atlas-shell.js` e `.css` oferece botão, painel, mensagens, sugestões e envio. O fluxo inspecionado usa respostas locais (`criarConversa`, `AtlasVocabulario`), sem chamada de LLM naquele componente. A nova IA deve espelhar a experiência visual, sem registrar seu cérebro no Oráculo compartilhado. O scanner não inclui atualmente `atlas-shell.js` entre os scripts identificados.
- O scanner remove chaves antigas de IA armazenadas no navegador (`apagarChavesAntigasIA`). Não restaurar esse mecanismo. Não foi encontrado gateway de chat pronto na estrutura inspecionada; o backend atual contém coleta e processamento, não um endpoint HTTP de chat identificado.

### Arquitetura recomendada a partir da inspeção

1. **Adaptador de dados do scanner:** consultas determinísticas ao conjunto completo elegível, favoritas e leituras. Retorna IDs, métricas, cálculos, datas e limitações. Funções iniciais: listar/filtrar pools, ordenar candidatas para uma meta de taxas e comparar TVL de favoritas por período.
2. **Chat independente:** uma conversa acessível na aba ampla e no painel flutuante. Sugestões de perguntas somente após interação; sem mensagens espontâneas. Nome e avatar próprios ainda serão definidos.
3. **Respostas fixas:** metodologia versionada e JSON de regras, com respostas locais para perguntas óbvias. O MD é a fonte editorial; o JSON operacional deve manter a mesma versão para evitar divergência.
4. **Gateway exclusivo:** endpoint protegido para chamadas OpenRouter, com segredo no servidor, autenticação, limite de requisições e lista permitida de modelos gratuitos. Recebe somente o contexto necessário do scanner. Nenhuma chave do modelo no HTML/localStorage. Provedor/hospedagem e condições gratuitas serão verificados antes de implantação.
5. **Modelo:** interpreta a intenção, solicita funções permitidas e explica resultados. Não executa SQL/JavaScript arbitrário, não escolhe uma URL externa para consulta e não pode modificar favoritos, decisões ou regras silenciosamente. Enviar resultados selecionados evita repassar centenas de pools em toda mensagem.

A configuração inicial deve usar um único provedor; múltiplos provedores podem entrar depois se as cotas justificarem. Ao esgotar a cota, manter consultas/cálculos locais e informar indisponibilidade da redação por IA.

### Critérios para validar a primeira implementação

- Consulta global considera pools além da página visível, mantendo cortes, decisões e identidades.
- Consulta de favoritas usa as marcas do navegador sem exigir abertura prévia dos gráficos.
- Variação de TVL apresenta datas e números reproduzíveis; histórico insuficiente produz resposta explícita.
- Meta de taxas distingue referência agregada de rendimento de posição concentrada e de lucro líquido.
- Aba e painel compartilham a conversa e não alteram o Oráculo principal.
- Sem credenciais, o chat mantém respostas fixas e cálculos locais; com provedor, só usa modelos gratuitos permitidos.
- Dados em cache e falhas de coleta aparecem nas respostas, sem inventar atualizações.

Convenção simétrica dos percentuais, compatibilidade/exceções e desempate em 9% por objetivo e prazo já confirmados. Adaptador, chat independente, respostas locais e gateway OpenRouter estão implementados no repositório; ativação remota depende de implantação da Edge Function e segredo no projeto Supabase. Ainda definir tratamento de montagens fora das referências, capital habitual, pares/contratos preferidos, custos e frequência de manutenção aceitável. Testar as consultas exemplificadas pelo proprietário com o provedor configurado. Não criar simulador como substituto do chat solicitado.

