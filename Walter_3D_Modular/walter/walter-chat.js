(() => {
  const trigger = document.querySelector('#walter-mode');
  if (!trigger || document.querySelector('#wc-dialog')) return;

  const dialog = document.createElement('dialog');
  dialog.id = 'wc-dialog';
  dialog.setAttribute('aria-labelledby', 'wc-title');
  dialog.innerHTML = `
    <div class="wc-top">
      <h2 id="wc-title">Conversa con Walter</h2>
      <button id="wc-close" type="button">Cerrar</button>
    </div>
    <svg class="wc-face" viewBox="0 0 180 108" aria-hidden="true">
      <ellipse class="wc-eye" cx="53" cy="44" rx="13" ry="19"/>
      <ellipse class="wc-eye" cx="127" cy="44" rx="13" ry="19"/>
      <path class="wc-mouth" d="M62 74 Q90 96 118 74"/>
    </svg>
    <p id="wc-status" role="status" aria-live="polite">Listo para conversar.</p>
    <div class="wc-log" id="wc-log" role="log" aria-label="Conversación"></div>
    <form id="wc-form">
      <input id="wc-input" aria-label="Tu pregunta" placeholder="Escribe tu pregunta…" maxlength="1000" autocomplete="off">
      <button id="wc-send" type="submit">Enviar</button>
    </form>
    <div class="wc-actions">
      <button id="wc-mic" type="button" aria-pressed="false">Hablar</button>
      <button id="wc-stop" type="button" disabled>Detener voz</button>
      <button id="wc-reset" type="button">Nueva conversación</button>
    </div>
    <label class="wc-voice">
      Voz <select id="wc-voice" aria-label="Voz en español"></select>
    </label>
    `;
  document.body.append(dialog);

  const $ = id => dialog.querySelector(`#wc-${id}`);
  const synth = window.speechSynthesis;
  let history = [], voices = [], epoch = 0, busy = false;
  let recorder = null, stream = null, timer = null, pending = null;
  const status = text => { $('status').textContent = text; };

  function controls() {
    const recording = recorder?.state === 'recording';
    $('mic').disabled = busy;
    $('send').disabled = busy || recording;
    $('input').disabled = busy || recording;
    $('mic').textContent = recording ? 'Terminar pregunta' : 'Hablar';
    $('mic').setAttribute('aria-pressed', String(recording));
  }

  function line(who, text) {
    const p = document.createElement('p');
    const label = document.createElement('strong');
    label.textContent = who;
    p.append(label, document.createTextNode(text));
    $('log').append(p);
    while ($('log').children.length > 24) $('log').firstChild.remove();
    $('log').scrollTop = $('log').scrollHeight;
  }

  function loadVoices() {
    const previous = $('voice').value;
    voices = synth ? synth.getVoices().filter(v => /^es([-_]|$)/i.test(v.lang)) : [];
    $('voice').replaceChildren(new Option('Sin voz (solo texto)', ''));
    voices.forEach((v, i) => {
      $('voice').add(new Option(`${v.name} (${v.lang})`, String(i)));
    });
    if (previous && voices[Number(previous)]) $('voice').value = previous;
    else if (voices.length) $('voice').value = '0';
  }

  loadVoices();
  synth?.addEventListener('voiceschanged', loadVoices);

  function stopVoice() {
    dialog.dataset.speaking = 'false';
    $('stop').disabled = true;
    synth?.cancel();
  }

  function speak(text, id) {
    if (!synth || !$('voice').value || !voices[Number($('voice').value)]) {
      status('Respuesta lista. Puedes hacer otra pregunta.');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voices[Number($('voice').value)];
    utterance.lang = utterance.voice.lang;
    utterance.rate = 1;

    utterance.onstart = () => {
      if (id !== epoch) return;
      dialog.dataset.speaking = 'true';
      $('stop').disabled = false;
      status('Walter está hablando…');
    };
    utterance.onend = () => {
      if (id !== epoch) return;
      dialog.dataset.speaking = 'false';
      $('stop').disabled = true;
      status('Listo para otra pregunta.');
    };
    utterance.onerror = e => {
      if (id !== epoch || ['canceled','interrupted'].includes(e.error)) return;
      dialog.dataset.speaking = 'false';
      $('stop').disabled = true;
      status('No se pudo reproducir la voz. La respuesta está en pantalla.');
    };
    synth.speak(utterance);
  }

  // Llama al servidor local (walter/server.cjs). La clave de Groq vive solo allí.
  async function request(endpoint, payload, isJson = true) {
    if (location.protocol === 'file:') {
      throw new Error('Abre Walter desde http://localhost:3080 (inicia el servidor con: node walter/server.cjs).');
    }
    const aborter = new AbortController();
    pending = aborter;
    const timeout = setTimeout(() => aborter.abort(), 45000);
    try {
      const response = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': isJson ? 'application/json' : payload.type },
        body: isJson ? JSON.stringify(payload) : payload,
        signal: aborter.signal
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || `No se pudo completar la solicitud (${response.status}).`);
      }
      return result;
    } catch (e) {
      if (e.name === 'TypeError') {
        throw new Error('No se pudo conectar con el servidor de Walter. ¿Está en ejecución?');
      }
      throw e;
    } finally {
      clearTimeout(timeout);
      if (pending === aborter) pending = null;
    }
  }

  async function answer(text, id) {
    line('Tú', text);
    status('Walter está pensando…');
    const messages = [...history.slice(-6), { role: 'user', content: text }];
    const result = await request('chat', { messages }, true);

    if (id !== epoch) return;
    const reply = result.answer?.trim();
    if (!reply) {
      throw new Error('No llegó una respuesta. Intenta con una pregunta más breve.');
    }

    history = [
      ...messages,
      { role: 'assistant', content: reply.slice(0, 2000) }
    ].slice(-6);
    line('Walter', reply);
    speak(reply, id);
  }

  function error(e) {
    status(e.name === 'AbortError'
      ? 'Se agotó el tiempo de espera. Intenta otra vez.'
      : e.message || 'No se pudo conectar.');
  }

  function releaseMic() {
    clearTimeout(timer);
    timer = null;
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
  }

  function cancel() {
    epoch++;
    pending?.abort();
    pending = null;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    recorder = null;
    releaseMic();
    stopVoice();
    busy = false;
    controls();
  }

  function reset() {
    cancel();
    history = [];
    $('log').replaceChildren();
    $('input').value = '';
    line('Walter', '¡Hola! Soy Walter. Puedes preguntarme sobre robótica, ESPOL o cualquier tema que te interese.');
    status('Listo para conversar.');
  }

  $('form').addEventListener('submit', async e => {
    e.preventDefault();
    const text = $('input').value.trim();
    if (!text || busy || recorder?.state === 'recording') return;
    const id = ++epoch;
    stopVoice();
    busy = true;
    controls();
    $('input').value = '';
    try {
      await answer(text, id);
    } catch (e) {
      if (id === epoch) {
        error(e);
        $('input').value = text;
      }
    } finally {
      if (id === epoch) {
        busy = false;
        controls();
      }
    }
  });

  $('mic').addEventListener('click', async () => {
    if (recorder?.state === 'recording') {
      busy = true;
      recorder.stop();
      releaseMic();
      controls();
      return;
    }
    if (busy) return;

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      status('El micrófono no está disponible en este navegador. Escribe tu pregunta.');
      return;
    }

    const id = ++epoch;
    stopVoice();
    busy = true;
    controls();
    status('Esperando permiso del micrófono…');

    try {
      const acquired = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      if (id !== epoch) {
        acquired.getTracks().forEach(t => t.stop());
        return;
      }
      stream = acquired;

      const mime = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus'
      ].find(t => MediaRecorder.isTypeSupported(t));

      if (!mime) {
        throw new Error('Este navegador no ofrece un formato de grabación compatible.');
      }

      const rec = new MediaRecorder(stream, { mimeType: mime });
      const chunks = [];
      recorder = rec;

      rec.ondataavailable = e => {
        if (e.data.size) chunks.push(e.data);
      };

      rec.onerror = () => {
        if (id !== epoch) return;
        cancel();
        status('Falló la grabación. Revisa el micrófono y vuelve a intentar.');
      };

      rec.onstop = async () => {
        if (id !== epoch) return;
        recorder = null;
        releaseMic();
        busy = true;
        controls();
        status('Procesando tu pregunta…');

        try {
          const result = await request('transcribe', new Blob(chunks, { type: mime }), false);
          if (id !== epoch) return;
          const transcribed = result.text?.trim() || '';
          if (!transcribed) {
            throw new Error('No entendí la pregunta. Inténtalo de nuevo.');
          }
          await answer(transcribed.slice(0, 1000), id);
        } catch (e) {
          if (id === epoch) error(e);
        } finally {
          if (id === epoch) {
            busy = false;
            controls();
          }
        }
      };

      rec.start();
      busy = false;
      controls();
      status('Te escucho. Pulsa Terminar pregunta al acabar.');

      timer = setTimeout(() => {
        if (id === epoch && rec.state === 'recording') {
          busy = true;
          rec.stop();
          releaseMic();
          controls();
        }
      }, 20000);
    } catch (e) {
      if (id !== epoch) return;
      releaseMic();
      recorder = null;
      busy = false;
      controls();
      status(e.name === 'NotAllowedError'
        ? 'Permiso denegado. Habilita el micrófono o escribe tu pregunta.'
        : e.name === 'NotFoundError'
          ? 'No se encontró un micrófono.'
          : e.message);
    }
  });

  trigger.addEventListener('click', () => {
    if (!dialog.open) {
      reset();
      dialog.showModal();
    }
  });
  $('close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', cancel);
  $('reset').addEventListener('click', reset);
  $('stop').addEventListener('click', () => {
    stopVoice();
    status('Voz detenida. Puedes hacer otra pregunta.');
  });
  window.addEventListener('pagehide', cancel);
})();