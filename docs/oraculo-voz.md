# Ditado de voz do Oráculo

Autorizado em 29/10/2026: microfone dentro do site, sem chave API própria,
com texto revisável antes do envio. O áudio nunca dispara mensagens ou confirmações.

`core/atlas-oraculo-voz.js` é carregado pelo shell e acrescenta o mesmo controle
ao painel global, às conversas do Scanner e aos formulários de Finanças, inclusive
quando montados dinamicamente. Nenhum motor de operações ou análise foi alterado.

## Uso

Toque em Ditar mensagem, autorize o microfone e fale em português brasileiro.
O texto final é acrescentado ao rascunho existente. Toque novamente para parar,
revise valores, nomes e pontuação e clique em Enviar. Resultados parciais são
mostrados só no status. O limite de caracteres do campo é respeitado.

Só uma conversa escuta por vez. Enviar, editar, fechar o painel, trocar de conversa
ou sair da página interrompe a captura; eventos atrasados não repõem texto enviado.
A sessão é limitada a 60 segundos, sem reinício automático. Permissão negada,
ausência de fala, falhas de rede e de microfone mantêm a digitação disponível.

## Compatibilidade e áudio

Usa `SpeechRecognition` ou `webkitSpeechRecognition`, detectado no dispositivo.
A presença da API não garante disponibilidade do serviço. Sem suporte, o botão
fica desabilitado e o status sugere digitar ou usar o microfone do teclado.
Usar o site HTTPS; testar no navegador real do PC e do celular.

O Atlas não contrata API, não exige chave, não armazena áudio e não o envia ao
Supabase/OpenRouter. O navegador pode enviar áudio ao próprio serviço de voz;
não prometer funcionamento offline nem reconhecimento local. O texto só segue
para o fluxo normal da ferramenta quando o usuário clica em Enviar.

## Validação e implantação

`node --test core/atlas-oraculo-voz.test.cjs` cobre composição do rascunho, ausência
de envio automático, resultados atrasados, permissão negada, falta de suporte,
sessão única, saída da página, edição e limite de caracteres. A API de reconhecimento
é simulada; precisão real e permissão do microfone exigem teste no dispositivo.

Publicação: HTML/JS/CSS pelo GitHub Pages; nenhuma Edge Function ou chave nova.
Código preparado nesta alteração; verificar separadamente a publicação do site.

Validação desta alteração: 41 testes de voz/operações/imagens/histórico e 76 de
Scanner/conversa/Finanças passaram. Chromium isolado verificou montagem pelo shell,
três tipos de campo, ausência de envio automático, fechamento e falta de suporte em
1280 e 390 px. A página real de Finanças foi verificada nas duas larguras com
reconhecimento simulado e bloqueio de login desativado somente no contexto de teste.
Nenhum lançamento ocorreu ao ditar. Revisão de código concluída sem pendências;
autorização e precisão do microfone real permanecem para conferir no dispositivo.
