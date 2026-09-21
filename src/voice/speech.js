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
import { getPersona, getActivePersonaId } from './personas.js';

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export const voiceSupported = () => typeof window !== 'undefined' && ('speechSynthesis' in window || Boolean(SR));
export const speechRecognitionSupported = () => Boolean(SR);

/* Pre-warm voices on script load to avoid asynchronous voice lookup delays */
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try {
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => {
        try { window.speechSynthesis.getVoices(); } catch {}
      };
    }
  } catch {}
}

export function createVoice({ lang = 'en-KE', persona: initialPersonaId, onPartial, onFinal, onEnergy, onState } = {}) {
  let recog = null;
  let speaking = false;
  let wantListening = false;
  let currentUtterance = null;
  let analyser = null, micStream = null, rafId = 0, speechRafId = 0;
  let language = lang;
  let activePersonaId = initialPersonaId || getActivePersonaId();

  /* ── Mic amplitude drives character energy during listening ────── */
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
        if (!speaking) onEnergy?.(Math.min(1, rms * 4));
      };
      loop();
    } catch { /* meter is optional */ }
  }

  function detachMeter() {
    cancelAnimationFrame(rafId);
    micStream?.getTracks().forEach((t) => t.stop());
    micStream = null; analyser = null;
  }

  /* ── Reactive speech energy loop: animates mouth & face during speech ── */
  function startSpeechEnergy() {
    cancelAnimationFrame(speechRafId);
    const startT = performance.now();
    const step = () => {
      if (!speaking) {
        onEnergy?.(0);
        return;
      }
      const t = (performance.now() - startT) * 0.001;
      /* Natural conversational phonetic modulation: ~4Hz syllable rate with micro-pauses */
      const syll = Math.sin(t * 19.0) * 0.35 + Math.sin(t * 7.5) * 0.28 + Math.cos(t * 12.0) * 0.18;
      const energy = Math.max(0.12, Math.min(1.0, 0.52 + syll));
      onEnergy?.(energy);
      speechRafId = requestAnimationFrame(step);
    };
    speechRafId = requestAnimationFrame(step);
  }

  function stopSpeechEnergy() {
    cancelAnimationFrame(speechRafId);
    onEnergy?.(0);
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
      /* Barge-in always wins: Wazi stops speaking immediately on speech */
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

    r.onend = () => { if (wantListening) { try { r.start(); } catch {} } };
    return r;
  }

  const api = {
    get listening() { return wantListening; },
    get speaking() { return speaking; },

    async start() {
      if (!SR) { onState?.('unsupported'); return false; }
      wantListening = true;
      recog = recog || build();
      try { recog.start(); } catch {}
      onState?.('listening');
      attachMeter();
      return true;
    },

    stop() {
      wantListening = false;
      try { recog?.stop(); } catch {}
      detachMeter();
      onState?.('idle');
    },

    setLanguage(bcp47) {
      language = bcp47;
      if (recog) { recog.lang = bcp47; if (wantListening) { try { recog.abort(); } catch {} } }
    },

    /**
     * Spoken utterance with instant latency and reactive mouth visemes.
     * Supports adaptive length for both quick check-ins and in-depth explanations.
     */
    say(text, opts = {}) {
      const { onDone, maxSentences } = opts;
      const trimmed = maxSentences ? capSentences(text, maxSentences) : String(text || '').trim();
      if (!trimmed) { onDone?.(); return; }

      stopSpeaking('replaced');

      speaking = true;
      onState?.('speaking');
      bus.emit('voice:speaking', trimmed);
      startSpeechEnergy();

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        speaking = false;
        currentUtterance = null;
        stopSpeechEnergy();
        onState?.(wantListening ? 'listening' : 'idle');
        onDone?.();
      };

      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        const words = trimmed.trim().split(/\s+/).length;
        const estMs = Math.max(1600, words * 360);
        setTimeout(finish, estMs);
        return;
      }

      const synth = window.speechSynthesis;
      try { synth.resume(); } catch {}

      const p = getPersona(opts.persona || activePersonaId);
      const u = new SpeechSynthesisUtterance(trimmed);
      u.lang = language;
      u.rate = opts.rate ?? (p?.rate ?? 0.96);
      u.pitch = opts.pitch ?? (p?.pitch ?? 1.0);

      const voice = pickVoice(language, p?.gender);
      if (voice) u.voice = voice;

      u.onboundary = () => {
        /* Syllable and word boundary spikes for dynamic lip visemes */
        onEnergy?.(0.92);
      };

      /* Safety fallback: ensure mouth does not get stuck open if synthesis hangs */
      const words = trimmed.trim().split(/\s+/).length;
      const safetyMs = Math.max(2200, words * 420 + 900);
      const safetyTimer = setTimeout(() => {
        if (!finished && !synth.speaking) finish();
      }, safetyMs);

      const guardedFinish = () => {
        clearTimeout(safetyTimer);
        finish();
      };

      u.onend = guardedFinish;
      u.onerror = (err) => {
        console.warn('[wazi/speech] utterance ended with:', err?.error);
        guardedFinish();
      };

      currentUtterance = u;
      try {
        synth.speak(u);
      } catch (err) {
        console.warn('[wazi/speech] speak failed:', err);
        guardedFinish();
      }
      return u;
    },

    get persona() { return getPersona(activePersonaId); },
    setPersona(id) {
      if (id) activePersonaId = id;
    },

    interrupt() { stopSpeaking('manual'); },
    destroy() {
      api.stop();
      stopSpeaking('destroy');
      recog = null;
    },
  };

  function stopSpeaking(reason) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try { window.speechSynthesis.cancel(); } catch {}
    speaking = false;
    currentUtterance = null;
    stopSpeechEnergy();
    onState?.(wantListening ? 'listening' : 'idle');
    bus.emit('voice:interrupted', reason);
  }

  return api;
}

/** Adaptive sentence capping utility when a caller requests a specific ceiling. */
export function capSentences(text, max = 3) {
  const parts = String(text).match(/[^.!?]+[.!?]*/g) ?? [String(text)];
  return parts.slice(0, max).join(' ').trim();
}

function pickVoice(bcp47, gender) {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const all = window.speechSynthesis.getVoices();
    if (!all || all.length === 0) return null;
    const base = bcp47.split('-')[0];

    const isNonRobotic = (v) => !/espeak|whisper|metallic|robotic|compact|flite/i.test(v.name);
    const isNeural = (v) => /natural|neural|online|premium|enhanced/i.test(v.name);
    const isMale = (v) => /(guy|ryan|daniel|oliver|arthur|david|george|james|male|mzee|bernard|ken)/i.test(v.name) &&
                          !/(female|samantha|karen|serena|moira|fiona|tessa|zira|jenny|aria|ava)/i.test(v.name);
    const isFemale = (v) => /(female|samantha|karen|serena|moira|fiona|tessa|zira|jenny|aria|ava|victoria|hazel|susan)/i.test(v.name);

    const langMatches = all.filter((v) => (v.lang === bcp47 || v.lang?.startsWith(base)) && isNonRobotic(v));
    const pool = langMatches.length > 0 ? langMatches : all.filter(isNonRobotic);

    if (gender === 'male') {
      const maleNeural = pool.find((v) => isNeural(v) && isMale(v));
      if (maleNeural) return maleNeural;
      const maleAny = pool.find((v) => isMale(v));
      if (maleAny) return maleAny;
    } else if (gender === 'female') {
      const femaleNeural = pool.find((v) => isNeural(v) && isFemale(v));
      if (femaleNeural) return femaleNeural;
      const femaleAny = pool.find((v) => isFemale(v));
      if (femaleAny) return femaleAny;
    }

    const neuralGeneral = pool.find((v) => isNeural(v));
    if (neuralGeneral) return neuralGeneral;

    return pool.find((v) => v.default) ?? pool[0] ?? all[0] ?? null;
  } catch { return null; }
}
