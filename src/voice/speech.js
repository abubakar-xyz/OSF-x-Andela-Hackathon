/**
 * Voice.  DESIGN.md §9, §14, §23.5.
 *
 * This build uses the browser's own Web Speech API, which means voice
 * works with no API key, no server and no network — which is the honest
 * demo and also the correct low-bandwidth answer. The hosted Live-model
 * path is specified in §23.4 and stubbed in ./live.js; it is not wired,
 * and the UI never claims it is.
 *
 * The two timings that matter (§10.3):
 *   · barge-in must flip speaking → listening in ≤120ms
 *   · audio ducks in 80ms and the queue is flushed, never finished
 */

import { bus } from '../core/bus.js';

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export const voiceSupported = () => Boolean(SR) && typeof speechSynthesis !== 'undefined';

export function createVoice({ lang = 'en-KE', onPartial, onFinal, onEnergy, onState } = {}) {
  let recog = null;
  let speaking = false;
  let wantListening = false;
  let currentUtterance = null;
  let analyser = null, micStream = null, rafId = 0;
  let language = lang;

  /* ── Mic amplitude drives the character's `hearing` energy. §8.3 ── */
  async function attachMeter() {
    if (analyser || !navigator.mediaDevices?.getUserMedia) return;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AC = window.AudioContext || window.webkitAudioContext;
      const actx = new AC();
      const src = actx.createMediaStreamSource(micStream);
      analyser = actx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        rafId = requestAnimationFrame(loop);
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / buf.length);
        onEnergy?.(Math.min(1, rms * 4));
      };
      loop();
    } catch { /* meter is a nicety; the transcript is the product */ }
  }

  function detachMeter() {
    cancelAnimationFrame(rafId);
    micStream?.getTracks().forEach((t) => t.stop());
    micStream = null; analyser = null;
  }

  function build() {
    if (!SR) return null;
    const r = new SR();
    r.lang = language;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += txt; else interim += txt;
      }
      /* Barge-in always wins. Wazi stops mid-word; it never finishes the
         sentence first. §9.2 rule 5 */
      if ((interim.trim() || final.trim()) && speaking) stopSpeaking('barge-in');
      if (interim.trim()) onPartial?.(interim.trim());
      if (final.trim()) onFinal?.(final.trim());
    };

    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantListening = false;
        onState?.('denied');
        bus.emit('voice:denied');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        bus.emit('voice:error', e.error);
      }
    };

    /* Chrome ends recognition on silence. Restart quietly so that "it is
       just here" stays true without the user pressing anything. §5.2 */
    r.onend = () => { if (wantListening) { try { r.start(); } catch { /* already starting */ } } };
    return r;
  }

  const api = {
    get listening() { return wantListening; },
    get speaking() { return speaking; },

    async start() {
      if (!SR) { onState?.('unsupported'); return false; }
      wantListening = true;
      recog = recog || build();
      try { recog.start(); } catch { /* already running */ }
      onState?.('listening');
      attachMeter();
      return true;
    },

    stop() {
      wantListening = false;
      try { recog?.stop(); } catch { /* not running */ }
      detachMeter();
      onState?.('idle');
    },

    setLanguage(bcp47) {
      language = bcp47;
      if (recog) { recog.lang = bcp47; if (wantListening) { try { recog.abort(); } catch {} } }
    },

    /**
     * One spoken sentence by default, three short ones maximum (§9.2).
     * Long figures, source lists and reference numbers are never read
     * aloud — they are rendered. The caller is responsible for that; this
     * layer enforces the sentence cap.
     */
    say(text, { onDone } = {}) {
      if (typeof speechSynthesis === 'undefined') { onDone?.(); return; }
      const trimmed = capSentences(text, 3);
      stopSpeaking('replaced');

      const u = new SpeechSynthesisUtterance(trimmed);
      u.lang = language;
      u.rate = 1.02; u.pitch = 1.0;
      const voice = pickVoice(language);
      if (voice) u.voice = voice;

      u.onstart = () => { speaking = true; onState?.('speaking'); bus.emit('voice:speaking', trimmed); };
      u.onend = () => { speaking = false; currentUtterance = null; onState?.(wantListening ? 'listening' : 'idle'); onDone?.(); };
      u.onerror = () => { speaking = false; currentUtterance = null; onDone?.(); };

      currentUtterance = u;
      speechSynthesis.speak(u);
      return u;
    },

    interrupt() { stopSpeaking('manual'); },
    destroy() { api.stop(); stopSpeaking('destroy'); recog = null; },
  };

  function stopSpeaking(reason) {
    if (typeof speechSynthesis === 'undefined') return;
    if (!speaking && !currentUtterance) return;
    try { speechSynthesis.cancel(); } catch { /* nothing queued */ }
    speaking = false; currentUtterance = null;
    onState?.(wantListening ? 'listening' : 'idle');
    bus.emit('voice:interrupted', reason);
  }

  return api;
}

/** §9.2 rule 1 — one sentence by default, three maximum, ever. */
export function capSentences(text, max = 3) {
  const parts = String(text).match(/[^.!?]+[.!?]*/g) ?? [String(text)];
  return parts.slice(0, max).join(' ').trim();
}

function pickVoice(bcp47) {
  try {
    const all = speechSynthesis.getVoices();
    const base = bcp47.split('-')[0];
    /* Never imitate an accent — prefer the plain regional voice. §9.2 */
    return all.find((v) => v.lang === bcp47)
        ?? all.find((v) => v.lang?.startsWith(base))
        ?? null;
  } catch { return null; }
}
