/**
 * Wazi's sonic identity.  DESIGN.md §8.6.
 *
 * Three notes. Synthesised with two oscillators rather than shipped as an
 * audio sprite — it costs nothing to download and nothing to cache, which
 * matters more here than timbre.
 *
 * Errors never make a sound. CONFLICTING never makes a sound: silence is
 * the drama.
 */

let ctx = null;
let enabled = true;

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const setSoundEnabled = (v) => { enabled = Boolean(v); };
export const soundEnabled = () => enabled;

const NOTE = { D4: 293.66, A4: 440.0, D5: 587.33 };

function tone(freq, startAt, dur, peak = 0.16) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  /* Triangle plus a quiet sine an octave up reads as "warm marimba"
     without a sample. */
  osc.type = 'triangle';
  osc.frequency.value = freq;
  const harm = ctx.createOscillator();
  const hg = ctx.createGain();
  harm.type = 'sine'; harm.frequency.value = freq * 2; hg.gain.value = 0.28;

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);

  harm.connect(hg); hg.connect(gain);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(startAt); harm.start(startAt);
  osc.stop(startAt + dur + 0.02); harm.stop(startAt + dur + 0.02);
}

function play(notes) {
  if (!enabled || !ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + 0.005;
  for (const [freq, offset, dur, peak] of notes) tone(freq, t0 + offset, dur, peak);
}

export const SOUND = {
  wake:      () => play([[NOTE.D4, 0, 0.30], [NOTE.A4, 0.11, 0.30], [NOTE.D5, 0.22, 0.42]]),
  listening: () => play([[NOTE.A4, 0, 0.09, 0.06]]),
  evidence:  () => play([[NOTE.D5, 0, 0.16], [NOTE.A4, 0.10, 0.26]]),
  exported:  () => play([[NOTE.A4, 0, 0.12], [NOTE.D5, 0.08, 0.20]]),
  conflicting: () => { /* deliberately silent — §8.6 */ },
  error:       () => { /* errors are quiet — §8.6 */ },
};

/** Haptics, where the device offers them. Never a substitute for a
 *  visible state change. */
export const HAPTIC = {
  wake: [12], listening: [8], evidence: [10, 40, 10],
  conflicting: [18], exported: [12, 30, 12],
};

export function buzz(pattern) {
  if (!enabled) return;
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}

export function cue(name) {
  SOUND[name]?.();
  if (HAPTIC[name]) buzz(HAPTIC[name]);
}
