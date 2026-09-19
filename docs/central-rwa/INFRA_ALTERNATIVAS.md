# Central RWA — Infraestrutura: plano em uso e alternativas

> Registro da decisão tomada em 2026-09-19, ao desenhar a Central RWA.
> Existe para que, se um dia for preciso trocar de infraestrutura, a pesquisa e o raciocínio já estejam aqui.
> Os limites de planos gratuitos mudam com frequência, então **reconfirme os números antes de migrar**.

---

## Por que não precisamos de servidor 24/7

A Central atualiza em camadas: a lista de observação a cada **6h** e o resto a cada **24h**. Então o sistema não fica "ouvindo" o mercado; ele **acorda, coleta, calcula, grava e desliga**. Isso permite rodar tudo com jobs agendados, sem máquina ligada.

As movimentações on-chain não se perdem entre as execuções: cada job busca tudo o que aconteceu desde o último bloco lido.

**Quando isso deixa de valer:** se um dia a Central precisar de **tempo real** (alerta no minuto em que algo acontece, WebSocket aberto, Telegram instantâneo). Aí é hora do Plano B ou C.

---

## Plano A — EM USO

```text
GitHub Actions (cron 6h / 24h)  →  Supabase (Postgres)  →  Central RWA (front do Atlas)
```

| Item | Detalhe |
|---|---|
| Custo | Zero |
| GitHub Actions | Repositório privado: 2.000 min/mês grátis (Linux). Público: ilimitado |
| Consumo estimado | 4 execuções/dia × ~5–8 min + jobs diários ≈ 800–1.300 min/mês |
| Supabase | Postgres, 500 MB por projeto, 2 projetos grátis |
| Volume estimado | 10 anos de histórico diário de ~200 ativos ≈ 50–80 MB; o resto, poucos MB por ano |
| Front | O Supabase gera uma API REST automática e aceita o login do Firebase que o Atlas já usa |

**Cuidados conhecidos:**
- O cron do GitHub pode atrasar alguns minutos em horários de pico. Não é problema para uma frequência de 6h.
- Em **repositório público**, o GitHub desativa workflows agendados depois de 60 dias sem atividade no repositório.
- O Supabase grátis **pausa o projeto após 1 semana sem atividade**. Com jobs gravando a cada 6h isso não acontece, mas se os jobs pararem por mais de uma semana, o banco pausa e precisa ser reativado no painel.
- Não guardar respostas brutas das APIs no banco, só o dado normalizado. É o que mantém o volume dentro dos 500 MB.

**Sinais de que é hora de sair do Plano A:**
- o banco passando de ~400 MB;
- o consumo do Actions passando de ~1.700 min/mês;
- necessidade de tempo real.

---

## Plano B — Oracle Cloud Always Free

```text
Máquina Oracle (ARM, ligada 24/7)  →  Postgres na própria máquina (ou continua o Supabase)  →  Central RWA
```

| Item | Detalhe |
|---|---|
| Custo | Zero (o cadastro pede cartão só para verificação) |
| Máquina | ARM Ampere A1: **2 OCPU / 12 GB RAM** (limite cortado pela metade em 15/06/2026; antes era 4 / 24) |
| Disco | 200 GB de armazenamento em bloco |
| Banco extra grátis | Oracle Autonomous Database: 2 × 20 GB |
| Quando usar | Tempo real, processos contínuos (WebSocket), bancos maiores que 500 MB |

**Cuidados conhecidos:**
- **Recuperação de máquina ociosa:** a Oracle pode recuperar instâncias gratuitas se, em 7 dias, o uso de CPU (percentil 95), de rede e de memória ficar abaixo de 20%.
- Às vezes falta capacidade na região para criar a máquina ARM ("Out of capacity").
- Você passa a administrar um servidor: atualizações, segurança, backup e reinício dos serviços.
- Contas "Pay As You Go" ainda recebem 4 OCPU / 24 GB grátis, mas isso exige cartão ativo e cuidado para não gerar cobrança.

**Migração A → B:**
1. Criar a máquina e instalar Python.
2. Copiar o repositório e as variáveis de ambiente (as mesmas dos GitHub Secrets).
3. Trocar o cron do GitHub Actions por `cron`/`systemd timers` na máquina.
4. (Opcional) Migrar o banco do Supabase para o Postgres local com `pg_dump`/`pg_restore`.

---

## Plano C — VPS pago

```text
VPS (~US$ 5–7/mês)  →  Supabase (ou Postgres na VPS)  →  Central RWA
```

| Item | Detalhe |
|---|---|
| Custo | ~US$ 5–7/mês |
| Máquina | 1–2 vCPU, 2–4 GB RAM |
| Quando usar | Quando os gratuitos incomodarem (instabilidade, ociosidade, limites) e der para pagar pouco |
| Vantagem | Estável, sem risco de recuperação por ociosidade e sem limites escondidos |

**Migração A → C:** igual à migração A → B.

---

## Outras opções avaliadas e descartadas

| Opção | Por que ficou de fora |
|---|---|
| Render (free) | Desliga após 15 min sem uso; o Postgres grátis expira em 30 dias |
| Koyeb (free) | 512 MB RAM / 0,1 vCPU, fraco; desliga quando fica ocioso |
| Railway / Fly.io | Não têm mais plano grátis de verdade (só crédito de teste) |
| PC do usuário (Agendador do Windows) | Só roda com o PC ligado |
| Neon | Bom, mas 0,5 GB por projeto e sem a integração pronta com o front |
| CockroachDB (10 GB) / Turso (5 GB) / Cloudflare D1 (5 GB) | Mais espaço, e são as alternativas se o Supabase ficar pequeno; menos ferramentas prontas para o front |
| MongoDB Atlas / Firestore | Ruins para séries históricas e estatística |

---

## Fontes (consultadas em 2026-09-19)

- Oracle — cortes no Always Free: https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/
- Oracle — recursos Always Free: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- GitHub Actions — preços 2026: https://github.com/resources/insights/2026-pricing-changes-for-github-actions
- GitHub Actions — cobrança: https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions
- Comparação de bancos gratuitos 2026: https://agentdeals.dev/database-free-tier-comparison-2026
- Hospedagem gratuita 2026: https://hatchable.com/articles/state-of-free-web-hosting-in-2026
- Koyeb free tier: https://www.srvrlss.io/provider/koyeb/
