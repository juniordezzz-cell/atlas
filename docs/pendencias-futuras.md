# Pendências para mais adiante

Itens combinados com o dono e **adiados de propósito**. A prioridade atual é
arrumar as Ferramentas. Estes itens ficam para depois da compra de um domínio
próprio, prevista para dez/2026 ou jan/2027.

## Segurança (anotado em 17/11/2026)

1. **Política de conteúdo (CSP).** Hoje nenhuma página declara
   `Content-Security-Policy`. É a camada que mais protege um site estático
   contra injeção de script: limita de onde scripts, estilos e conexões
   podem vir (o site usa CoinGecko, DefiLlama, GeckoTerminal, open.er-api,
   Firebase e outros). Com o domínio próprio dá para ir além da `<meta>`,
   com cabeçalhos HTTP via Cloudflare ou outro provedor.
   Como fazer: mapear todos os hosts usados (`core/providers/`, `core/http.js`,
   Firebase), definir a política, testar página por página, tirar scripts
   inline quando possível.
2. **Auditoria geral de segurança** do site inteiro, não só de um diff:
   login (Firebase/Google, `core/atlas-auth.js`, `core/atlas-secure.js`),
   conexão com o Claude (`pages/conectar-claude.html`, `central-rwa/`),
   pontos que escrevem HTML com dados vindos de APIs externas (nomes e
   símbolos de tokens) e o que fica guardado no navegador.

A revisão de 17/11 cobriu só as mudanças daquele dia
(`d4df1d4..159f379`): nenhuma vulnerabilidade.

## Manutenção

- As listas do menu lateral (`FERRAMENTAS` e `ACADEMY` em
  `core/ui/atlas-moldura.js`) repetem os cards de `pages/ferramentas.html`
  e as abas de `academy/index.html`. Ao criar ou renomear uma ferramenta,
  atualize os dois lugares, ou crie um arquivo de lista compartilhado.

## Venda

- Ver [plano de venda futuro](plano-de-venda-futuro-2026-11-17.md).
