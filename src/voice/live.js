/**
 * Hosted realtime voice.  DESIGN.md §23.3–§23.5.
 *
 * Talks to our own relay, never to a model provider directly — the key
 * stays server-side and every tool executes there, because a client that
 * runs its own tools is a client that decides what counts as evidence.
 *
 * Protocol per Google's gemini-live-api-dev skill, vendored at
 * .claude/skills/gemini-live-api-dev/. The details that matter here:
 *
 *   · input  16 kHz PCM16 mono, base64, as audio/pcm;rate=16000
 *   · output 24 kHz PCM16 mono, base64, queued and played in order
 *   · `interrupted` means drop the queue NOW — barge-in, §10.3
 *   · `turnComplete` does NOT mean idle on the extended-thinking model;
 *     `interactionStatus` IDLE does. The character leaves `working` on
 *     the latter.
 */

const IN_RATE = 16000;
const OUT_RATE = 24000;

/**
 * Barge-in guarding.
 *
 * The microphone hears the speaker. A naive "any sound above threshold
 * cancels playback" gate therefore makes Wazi interrupt ITSELF on its
 * own output — the classic voice-agent failure, and the one an earlier
 * version of this file had.
 *
 * Three guards, together:
 *   · a higher threshold while Wazi is speaking than while it is idle
 *   · sustained over several frames, so a cough or a door does not count
 *   · a grace window at the start of a turn, so Wazi gets to finish at
 *     least its opening clause before its own first syllables can
 *     trigger a cancel
 */
const BARGE = {
  idleRms: 0.045,        /* not speaking: a light touch is enough        */
  speakingRms: 0.115,    /* speaking: must be clearly louder than bleed  */
  sustainFrames: 3,      /* consecutive frames over threshold            */
  graceMs: 900,          /* from the start of a turn, ignore everything  */
};

export const relayURL = () =>
  globalThis.WAZI_RELAY_URL ||
  document.querySelector('meta[name="wazi-relay"]')?.content ||
  '';

export const isConfigured = () => {
  const u = relayURL();
  return Boolean(u) && /^wss?:\/\//.test(u);
};

/** Shown wherever someone might assume a hosted model is running. */
export const HONEST_LABEL = 'On-device speech — no hosted model is connected';
export const LIVE_LABEL = (model) => `Live: ${model}`;

export function createLiveVoice({
  onHeard, onSaid, onEnergy, onState, onSurface, onError, onReady, onUnavailable,
} = {}) {
  let ws = null, actx = null, micStream = null, worklet = null, src = null;
  let playhead = 0;
  let queued = [];
  let speaking = false;
  let speechStartedAt = 0;
  let loudFrames = 0;
  let open = false;
  let model = '';

  const send = (obj) => { if (ws?.readyState === 1) ws.send(JSON.stringify(obj)); };

  /** Drop everything scheduled. This is the barge-in path and it has to
   *  be immediate — ≤120 ms from speech detected to silence. §8.3 */
  function flushPlayback() {
    for (const node of queued) { try { node.stop(); } catch { /* already ended */ } }
    queued = [];
    playhead = actx ? actx.currentTime : 0;
    loudFrames = 0;
    if (speaking) { speaking = false; onState?.('listening'); }
  }

  function playPCM(b64) {
    if (!actx) return;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const pcm = new Int16Array(bytes.buffer);
    const buf = actx.createBuffer(1, pcm.length, OUT_RATE);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;

    const node = actx.createBufferSource();
    node.buffer = buf;
    /* A gain node so the output amplitude can drive the character's
       `speaking` energy without another analyser. */
    const gain = actx.createGain();
    node.connect(gain); gain.connect(actx.destination);

    /* ~150ms of slack. At 20ms the queue underran between chunks on
       anything but a perfect connection and the speech came out
       stuttered. */
    playhead = Math.max(playhead, actx.currentTime + 0.15);
    node.start(playhead);
    playhead += buf.duration;
    queued.push(node);
    node.onended = () => {
      queued = queued.filter((n) => n !== node);
      if (!queued.length && speaking) { speaking = false; onState?.('listening'); }
    };
    if (!speaking) { speaking = true; speechStartedAt = performance.now(); loudFrames = 0; onState?.('speaking'); }
    /* Cheap amplitude for the core pulse: RMS of the chunk. */
    let sum = 0;
    for (let i = 0; i < ch.length; i += 16) sum += ch[i] * ch[i];
    onEnergy?.(Math.min(1, Math.sqrt(sum / (ch.length / 16)) * 3));
  }

  async function startMic() {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    actx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: IN_RATE });
    if (actx.state === 'suspended') await actx.resume();
    src = actx.createMediaStreamSource(micStream);

    /* An AudioWorklet keeps capture off the main thread, which matters
       on the cheap phones this is for. ScriptProcessor is the fallback. */
    const code = `
      class Cap extends AudioWorkletProcessor {
        process(inputs) {
          const ch = inputs[0][0];
          if (ch) {
            const out = new Int16Array(ch.length);
            for (let i = 0; i < ch.length; i++) {
              const s = Math.max(-1, Math.min(1, ch[i]));
              out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            this.port.postMessage(out.buffer, [out.buffer]);
          }
          return true;
        }
      }
      registerProcessor('wazi-cap', Cap);`;
    const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
    try {
      await actx.audioWorklet.addModule(url);
      worklet = new AudioWorkletNode(actx, 'wazi-cap');
      worklet.port.onmessage = (e) => emitAudio(new Int16Array(e.data));
      src.connect(worklet);
    } catch {
      const proc = actx.createScriptProcessor(2048, 1, 1);
      proc.onaudioprocess = (e) => {
        const ch = e.inputBuffer.getChannelData(0);
        const out = new Int16Array(ch.length);
        for (let i = 0; i < ch.length; i++) {
          const s = Math.max(-1, Math.min(1, ch[i]));
          out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        emitAudio(out);
      };
      src.connect(proc); proc.connect(actx.destination);
      worklet = proc;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function emitAudio(int16) {
    /* Local amplitude drives `hearing`, and gives us a barge-in signal
       that does not wait for a server round trip. */
    let sum = 0;
    for (let i = 0; i < int16.length; i += 8) { const v = int16[i] / 32768; sum += v * v; }
    const rms = Math.sqrt(sum / (int16.length / 8));
    onEnergy?.(Math.min(1, rms * 4));

    if (speaking) {
      const past = performance.now() - speechStartedAt > BARGE.graceMs;
      loudFrames = rms > BARGE.speakingRms ? loudFrames + 1 : 0;
      if (past && loudFrames >= BARGE.sustainFrames) {
        loudFrames = 0;
        flushPlayback();          /* deliberate interruption — §10.3 */
      }
    } else {
      loudFrames = 0;
    }

    let bin = '';
    const bytes = new Uint8Array(int16.buffer);
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    send({ type: 'audio', pcm: btoa(bin) });
  }

  const api = {
    get connected() { return open; },
    get model() { return model; },

    async start() {
      if (!isConfigured()) throw new Error('no relay configured');
      await startMic();
      ws = new WebSocket(relayURL());

      /* The socket being open says nothing about the model being
         reachable. `open` is set when the relay sends `ready`. */
      ws.onopen = () => { /* awaiting proof */ };
      ws.onclose = () => { open = false; onState?.('idle'); };
      ws.onerror = () => onError?.('the relay connection failed');

      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        switch (m.type) {
          case 'ready':
            open = true; model = m.model; onReady?.(m); onState?.('listening'); break;
          case 'audio':      playPCM(m.pcm); break;
          case 'heard':      onHeard?.(m.text); break;
          case 'said':       onSaid?.(m.text); break;
          case 'interrupted': flushPlayback(); break;
          case 'surface':    onSurface?.(m.surface); break;
          case 'status':
            /* IDLE is the real "the server is done" signal. */
            if (m.status === 'IDLE') onState?.('listening');
            else if (m.status === 'IN_PROGRESS') onState?.('working');
            break;
          case 'turn_complete': break;   /* deliberately not idle */
          case 'expiring':   onError?.('this session is about to roll over'); break;
          case 'unavailable':
            /* Never leave the interface implying a hosted model is
               running when it is not. §6 Law 8 */
            open = false;
            onUnavailable?.(m.reason);
            break;
          case 'error':      onError?.(m.message); break;
          default: break;
        }
      };
      return true;
    },

    /** Wazi opens the conversation. §5 Decision 3. */
    openWith(text) { send({ type: 'say_first', text }); },

    text(t) { send({ type: 'text', text: t }); },
    image(jpegB64) { send({ type: 'image', jpeg: jpegB64 }); },
    micPaused() { send({ type: 'audio_end' }); },
    interrupt() { flushPlayback(); },

    stop() {
      flushPlayback();
      try { ws?.close(); } catch { /* already closed */ }
      try { worklet?.disconnect?.(); src?.disconnect?.(); } catch { /* not connected */ }
      micStream?.getTracks().forEach((t) => t.stop());
      try { actx?.close(); } catch { /* already closed */ }
      ws = null; actx = null; micStream = null; worklet = null; src = null; open = false;
    },
  };
  return api;
}

/** The contract the relay satisfies, kept next to the client that
 *  depends on it. Values are from the vendored skill, not from memory. */
export const LIVE_CONTRACT = {
  models: {
    host: 'gemini-3.8-live',
    deep: 'gemini-3.8-live-extended-thinking',
  },
  audio: { inputMime: 'audio/pcm;rate=16000', inputRate: 16000, outputRate: 24000 },
  limits: {
    audioOnlySessionMs: 900_000,
    audioVideoSessionMs: 120_000,
    connectionLifetimeMs: 600_000,
    contextInputTokens: 128_000,
    contextOutputTokens: 64_000,
  },
  notes: [
    'response modality is AUDIO or TEXT, never both — captions come from output_audio_transcription',
    'turnComplete does not mean idle on extended thinking; interactionStatus IDLE does',
    'every function declaration is NON_BLOCKING',
    'proactive audio is permanently enabled and must not be configured',
    'affective dialogue was removed from the API — do not send enable_affective_dialog',
    'use ephemeral tokens if the browser ever connects directly; never a raw key',
  ],
};
