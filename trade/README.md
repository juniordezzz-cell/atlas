# ATLAS — Sistema Operacional para Traders

Fundação (Sprint 1). Um sistema de trade baseado em **processo**: toda operação
nasce de um estudo, passa por um registro de decisão e é acompanhada até a
pós-análise. O **Oráculo** é a inteligência onipresente que lê os próprios dados
do ATLAS e aponta o que precisa de atenção.

## Como rodar

Abra o arquivo **`index.html`** com dois cliques (funciona direto no navegador,
sem instalar nada e sem servidor). Para uma versão de arquivo único, use
**`ATLAS_preview.html`**.

## O que já existe

**Fundação (Sprint 1)**
- **Design system** completo em azul + glassmorphism (tokens centralizados).
- **Shell** com barra superior, navegação lateral e área de conteúdo.
- **Seletor de carteiras** — trocar a carteira atualiza todo o sistema.
- **Dashboard** dinâmico: patrimônio + gráfico da banca, KPIs, estudos
  pendentes, trades abertos e alertas.
- **Oráculo**: orbe sempre presente + painel que responde a partir dos dados da
  carteira ativa (estudos parados >72h, trades a revisar, resumo).

**Estudos (Sprint 2)**
- Lista com filtros por estado (futuro · em andamento · concluído) e contadores.
- Criar, editar e excluir estudos; fila de pesquisas nos "futuros".
- **Histórico de evolução da tese**: cada nova visão entra numa linha do tempo
  com data/hora, preservando como o pensamento mudou.
- **Regra das 72h** ativa: estudo em andamento além do limite é sinalizado na
  lista, no detalhe e pelo Oráculo.
- Fluxo de estado: iniciar → concluir → reabrir. Botão de RD preparado para o
  Sprint 3.
- CRUD real persistido pela camada de dados (base que RD e Trades reutilizam).

**Registro de Decisão (Sprint 3)**
- Lista de RDs com filtros e medidor de confiança (1–5).
- Cada RD **nasce de um estudo concluído**: o botão "Criar RD" no detalhe do
  estudo já abre o registro com ativo e estudo de origem preenchidos.
- Documenta a decisão racional: por que entrar / não entrar, justificativa
  técnica, gestão de risco (stop, tamanho, R:R), alavancagem e observações.
- Dashboard e Oráculo sinalizam estudos concluídos ainda sem RD.
- Botão "Executar trade" preparado para o Sprint 4.

**Trades (Sprint 4)**
- Lista com filtros (Abertos · Encerrados) e resultado (PnL) colorido.
- **Nasce de um RD "Entrar"**: o botão "Executar trade" abre a execução com
  ativo, stop, tamanho e alavancagem já preenchidos a partir do RD.
- Ciclo completo: entrada, **parciais**, **gerenciamento** (mover stop, notas) e
  **encerramento** com resultado — numa linha do tempo de acompanhamento.
- Alerta de trade aberto há tempo demais (Dashboard e Oráculo).
- Links de volta para o RD e o estudo de origem.

**Analytics — Pós-Análise e Métricas (Sprint 5)**
- Cada trade encerrado recebe **pós-análise**: aderência ao plano, disciplina
  (1–5), o que funcionou, o que falhou, lição e tags.
- **Métricas** consolidadas dos trades encerrados: winrate, profit factor,
  resultado líquido, tempo médio, curva de resultado, resultado por ativo e
  desempenho Long vs Short.
- **Aprendizado do Oráculo**: insights derivados dos dados (ex.: winrate Long vs
  Short, aderência vs resultado, tendência de segurar perdedores, ativo mais
  lucrativo). O Oráculo responde sobre desempenho a partir dessas métricas.
- Dashboard e Oráculo sinalizam trades encerrados sem pós-análise.

**Configurações (Sprint 6)**
- **Preferências** que afetam o sistema de verdade: nome do operador (usado pelo
  Oráculo/saudação), limite de horas do estudo (regra das 72h configurável) e
  prazo para revisar trades — tudo realimenta os alertas.
- **Gestão de carteiras**: criar, editar (nome, categoria, cor) e excluir.
- **Backup e arquivamento**: exportar backup (.json), importar, arquivar
  estudos/trades antigos para o arquivo (restauráveis) e redefinir dados.

## Roadmap — concluído

- ~~**Sprint 1** — Fundação~~ ✓
- ~~**Sprint 2** — Estudos~~ ✓
- ~~**Sprint 3** — Registro de Decisão~~ ✓
- ~~**Sprint 4** — Trades~~ ✓
- ~~**Sprint 5** — Pós-Análise e Métricas (Analytics)~~ ✓
- ~~**Sprint 6** — Configurações (carteiras, backup, preferências)~~ ✓

O fluxo oficial completo — Ideia → Estudo → RD → Trade → Monitoramento →
Encerramento → Pós-Análise → Métricas → Oráculo aprende — está implementado, sobre
a arquitetura modular preparada para evoluir.

## Estrutura

```
ATLAS/
├── index.html              → shell + ordem de carga
├── assets/
│   ├── css/                → tokens · base · components · oraculo · dashboard
│   └── js/
│       ├── core/           → store · util · seed · state · router
│       └── components/     → topbar · walletSelector · sidebar · oraculo
├── modules/                → dashboard (pronto) + estudos/rd/trades/analytics/config (stubs)
├── data/                   → espaço para dados exportados
└── backup/                 → espaço para arquivamento
```

## Camada de dados

Tudo passa por **`assets/js/core/store.js`** (o `DataStore`). Hoje ele usa o
`localStorage` do navegador, com queda automática para memória quando o
armazenamento não está disponível. Nenhuma outra parte do sistema toca o
armazenamento direto — então migrar para nuvem no futuro (ex.: Supabase, API
própria) significa reescrever **só esse arquivo**, sem mexer nas telas.

A arquitetura não muda a cada Sprint: cada módulo se encaixa no router e grava
seus dados pela mesma camada. É a base preparada para evoluir (ex.: sincronização
em nuvem, login e multiusuário) sem retrabalho.
