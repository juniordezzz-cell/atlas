# ATLAS — Especificação Oficial do Projeto

> Documento de referência. Toda decisão de arquitetura e desenvolvimento
> deve responder a estas definições. Congelado como fonte da verdade.

## Frase oficial

> "O ATLAS é um Sistema Operacional para Traders baseado em processo, onde toda
> operação nasce de um estudo, passa por uma decisão documentada e termina em
> uma análise de desempenho, permitindo evolução contínua do operador."

## Visão geral

O ATLAS é um **Sistema Operacional para Traders**. O objetivo não é prever o
mercado nem gerar sinais de compra e venda, mas **estruturar todo o processo de
tomada de decisão** do operador. A filosofia é baseada em processo: nenhuma
operação nasce por impulso — toda operação segue um fluxo obrigatório, o que
permite ao trader evoluir através da análise dos próprios dados.

A prioridade do projeto é **melhorar a qualidade das decisões do operador**.
Não é apenas um registrador de operações, e sim um ambiente completo de
trabalho, reunindo num único sistema: organização dos estudos, documentação das
decisões, acompanhamento das operações, análise de desempenho, métricas,
histórico e inteligência operacional.

## Fluxo oficial

Todo trade segue obrigatoriamente esta sequência, sem pular etapas:

```
Ideia → Estudo → Registro de Decisão (RD) → Execução do Trade →
Monitoramento → Encerramento → Pós-Análise → Métricas → Oráculo aprende
```

## O Oráculo

Ferramenta interna, **não** um módulo separado nem um chatbot genérico. Presente
em **todas as telas**, funciona como assistente especializado em trading. Seu
conhecimento vem principalmente dos **dados produzidos dentro do próprio ATLAS**:
estudos, registros de decisão, trades, histórico, métricas e carteira
selecionada.

Deve responder perguntas como: quais estudos estão pendentes; quais ficaram
abertos tempo demais; quais trades precisam de revisão; histórico completo de
uma operação; evolução do operador. Precisa entender datas, horários, duração
dos estudos e tempo das operações.

**Na interface:** sempre visível, com identidade visual própria — animação
contínua, brilho, aparência tecnológica. Não é apenas um botão. Ao clicar, abre
o painel de conversa.

## Registro de Decisão (RD)

O conceito de "diário" foi abandonado em favor do **Registro de Decisão**. O RD
documenta racionalmente os motivos de entrar ou não numa operação: por que
entrou; por que não entrou; confiança da operação; justificativa técnica;
gerenciamento de risco; alavancagem utilizada; observações. O objetivo não é
registrar emoções, e sim o **processo racional de decisão**.

## Estudos

Estados: **futuros · em andamento · concluídos**.

Regras: um estudo não pode ficar aberto por mais de **72 horas**; o Oráculo avisa
quando um estudo está parado; estudos futuros funcionam como fila de pesquisas.

Os estudos mantêm **histórico**, preservando a evolução da tese (ex.: segunda
"minha visão é X", terça "mudou para Y").

## Trades

Todo trade **nasce obrigatoriamente de um estudo**. O sistema acompanha entrada,
saída, parcial, stop, gerenciamento e resultado. Trades muito antigos geram
alertas para reavaliação.

## Histórico e arquivamento

O projeto mantém histórico. Para evitar crescimento excessivo dos arquivos,
dados recentes permanecem na base ativa e dados antigos podem ser movidos para
uma pasta de **backup/arquivo** — permanecendo acessíveis pelo Oráculo.

## Dashboard

Tela inicial. O usuário nunca abre uma "central de comandos" — ao abrir o ATLAS,
vê imediatamente o **estado atual da operação**. Contém: gráfico principal da
banca, patrimônio, evolução, KPIs, alertas, estudos pendentes, trades abertos e
resumo produzido pelo Oráculo. A Home é **dinâmica** e muda conforme a situação do
operador.

## Layout

Referência inspirada em plataformas como Pendle e Kamino, **sem copiar** sua
identidade. Layout centralizado; aparência premium; glassmorphism; sombras
suaves; bordas arredondadas; gradientes discretos; **tons de azul** (roxo
descartado); aspecto de software profissional, não de site institucional.

## Carteiras

Múltiplas carteiras, com seletor na barra superior (ex.: Principal, Scalping,
Swing Trade, Bybit, Hyperliquid, Testes). Ao trocar a carteira, **todo o
sistema** passa a exibir os dados daquela carteira.

## Organização do projeto

Software **modular**. Cada módulo é independente.

```
ATLAS/
  index.html
  assets/ (css · js · icons · images)
  modules/ (dashboard · estudos · rd · trades · analytics · configuracoes)
  data/
  backup/
```

## Filosofia de desenvolvimento

O projeto cresce por **Sprints**. Cada Sprint adiciona funcionalidades reais
**sem alterar a arquitetura principal**. A base é preparada para um software
comercial de longo prazo.

---

## Estado da implementação

- **Sprint 1 — Fundação** ✓ — design system, shell, seletor de carteiras,
  Dashboard dinâmico, Oráculo onipresente, camada de dados abstrata.
- **Sprint 2 — Estudos** ✓ — estados, fila, regra das 72h, histórico da tese,
  CRUD real.
- **Sprint 3 — Registro de Decisão** ✓ — decisão racional (entrar/não entrar),
  confiança, técnica, risco e alavancagem; nasce de um estudo concluído.
- **Sprint 4 — Trades** ✓ — execução a partir de um RD "Entrar"; entrada,
  parciais, gerenciamento (stop/notas), encerramento com resultado; alerta de
  trade antigo.
- **Sprint 5 — Pós-Análise e Métricas (Analytics)** ✓ — cada trade encerrado
  recebe pós-análise (aderência, disciplina, o que funcionou/falhou, lição,
  tags); as métricas consolidam winrate, profit factor, resultado, distribuição
  e long/short; o Oráculo extrai aprendizados dos dados. **Fluxo oficial completo:
  Ideia → Estudo → RD → Trade → Encerramento → Pós-Análise → Métricas → Oráculo.**
- **Sprint 6 — Configurações** ✓ — preferências que afetam o sistema (nome do
  operador, limite de estudo, prazo de revisão de trade), gestão de carteiras
  (criar/editar/excluir) e backup/arquivamento (exportar, importar, arquivar
  dados antigos e restaurar). **Todos os Sprints e a estrutura de pastas prevista
  estão implementados.**
