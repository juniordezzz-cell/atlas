/* Ditado do Oráculo. Somente rascunho: nunca envia mensagens ou operações. */
(function (g) {
  'use strict';
  if (g.AtlasOraculoVoz) return;
  var Recognition = g.SpeechRecognition || g.webkitSpeechRecognition;
  var active = null, nextId = 0;
  var SELECTOR = '.atlas-oraculo__input, .sp-composer textarea, [data-chat-form] textarea, [data-chat-form] input';

  function mount(input) {
    if (input._atlasVoz) return input._atlasVoz;
    var composer = input.parentNode;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'atlas-voz__mic';
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>';
    var status = document.createElement('p');
    status.className = 'atlas-voz__status';
    status.id = 'atlas-voz-status-' + (++nextId);
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    button.setAttribute('aria-describedby', status.id);
    composer.insertBefore(button, input.nextSibling);
    composer.parentNode.insertBefore(status, composer.nextSibling);
    var session = null;

    function idle() {
      button.setAttribute('aria-label', 'Ditar mensagem');
      button.setAttribute('aria-pressed', 'false');
      button.title = 'Ditar mensagem';
    }
    function cancel(message) {
      var old = session;
      session = null;
      if (active === control) active = null;
      if (old) {
        clearTimeout(old.timer);
        try { old.recognition.abort(); } catch (_) {}
      }
      idle();
      if (message) status.textContent = message;
    }
    var control = {cancel: cancel, input: input, composer: composer};
    input._atlasVoz = control;
    idle();
    status.textContent = Recognition
      ? 'Ditado: revise antes de enviar. O navegador pode enviar áudio ao serviço de voz dele.'
      : 'Este navegador não oferece ditado de voz. Continue digitando ou use o microfone do teclado.';
    button.disabled = !Recognition;

    button.addEventListener('click', function () {
      if (session) {
        status.textContent = 'Finalizando ditado…';
        try { session.recognition.stop(); } catch (_) { cancel('Revise o texto antes de enviar.'); }
        return;
      }
      if (!Recognition || input.disabled || input.readOnly) return;
      if (active) active.cancel('Ditado interrompido. Revise o texto antes de enviar.');
      var recognition;
      try { recognition = new Recognition(); }
      catch (_) { status.textContent = 'Não foi possível iniciar o ditado. Continue digitando.'; return; }
      var current = {recognition: recognition, base: input.value, written: input.value, heard: false};
      session = current;
      active = control;
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = true;
      button.setAttribute('aria-label', 'Parar ditado');
      button.setAttribute('aria-pressed', 'true');
      button.title = 'Parar ditado';
      status.textContent = 'Aguardando microfone…';
      recognition.onstart = function () {
        if (session === current) status.textContent = 'Ouvindo… Toque no microfone para parar.';
      };
      recognition.onresult = function (event) {
        if (session !== current) return;
        if (input.value !== current.written || input.disabled || input.readOnly) {
          cancel('Ditado interrompido. Revise o texto antes de enviar.'); return;
        }
        var finalText = [], interim = [];
        for (var i = 0; i < event.results.length; i++) {
          var result = event.results[i];
          (result.isFinal ? finalText : interim).push(result[0].transcript);
        }
        var text = finalText.join(' ').trim();
        if (text) {
          var value = current.base + (current.base && !/\s$/.test(current.base) ? ' ' : '') + text;
          if (input.maxLength >= 0) value = value.slice(0, input.maxLength);
          current.written = value;
          current.heard = true;
          input.value = value;
          input.dispatchEvent(new Event('input', {bubbles: true}));
        }
        status.textContent = interim.length ? 'Ouvindo: ' + interim.join(' ') : 'Texto capturado. Revise antes de enviar.';
      };
      recognition.onerror = function (event) {
        if (session !== current) return;
        var messages = {
          'not-allowed': 'Microfone sem permissão. Autorize o microfone nas configurações do navegador e tente novamente.',
          'service-not-allowed': 'Serviço de voz não permitido neste navegador. Continue digitando.',
          'audio-capture': 'Microfone indisponível. Confira se está conectado e tente novamente.',
          'no-speech': 'Não ouvi nenhuma fala. Toque no microfone para tentar novamente.',
          'network': 'Não foi possível acessar o serviço de voz. Confira a conexão e tente novamente.',
          'language-not-supported': 'Português não está disponível no serviço de voz deste navegador.'
        };
        cancel(messages[event.error] || 'Ditado interrompido. Continue digitando ou tente novamente.');
      };
      recognition.onend = function () {
        if (session !== current) return;
        clearTimeout(current.timer);
        session = null;
        if (active === control) active = null;
        idle();
        status.textContent = current.heard ? 'Revise o texto e clique em Enviar quando estiver pronto.' : 'Não ouvi nenhuma fala. Toque no microfone para tentar novamente.';
      };
      current.timer = setTimeout(function () {
        if (session === current) cancel('Tempo de ditado encerrado. Revise o texto antes de enviar.');
      }, 60000);
      try { recognition.start(); }
      catch (_) { cancel('Não foi possível iniciar o ditado. Confira a permissão do microfone e tente novamente.'); }
    });
    // Captura antes dos handlers existentes: respostas atrasadas não repõem mensagens enviadas.
    composer.addEventListener('click', function (event) {
      if (event.target !== button && !button.contains(event.target) && session) cancel('Revise o texto antes de enviar.');
    }, true);
    composer.addEventListener('submit', function () { if (session) cancel('Revise o texto antes de enviar.'); }, true);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && session) cancel('Revise o texto antes de enviar.');
    }, true);
    input.addEventListener('input', function () {
      if (session && input.value !== session.written) cancel('Ditado interrompido para edição. Revise o texto antes de enviar.');
    });
    return control;
  }

  function scan() {
    document.querySelectorAll(SELECTOR).forEach(mount);
    if (active && (!active.input.isConnected || !active.input.getClientRects().length ||
      active.input.closest('.atlas-oraculo[data-open="false"]') ||
      (g.getComputedStyle && g.getComputedStyle(active.input).visibility === 'hidden'))) {
      active.cancel('Ditado interrompido. Revise o texto antes de enviar.');
    }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && active) active.cancel('Ditado interrompido ao sair da página. Revise o texto antes de enviar.');
  });
  document.addEventListener('click', function (event) {
    if (active && !active.composer.contains(event.target)) {
      active.cancel('Ditado interrompido. Revise o texto antes de enviar.');
    }
  }, true);
  g.addEventListener && g.addEventListener('pagehide', function () { if (active) active.cancel(); });
  g.AtlasOraculoVoz = {mount: mount};
  if (document.querySelectorAll && g.MutationObserver) {
    scan();
    new g.MutationObserver(scan).observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'data-open', 'class']});
  }
})(window);
