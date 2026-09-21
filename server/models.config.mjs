/**
 * Model selection.  DESIGN.md §23.4.
 *
 * These IDs are taken from Google's own `gemini-live-api-dev` skill,
 * vendored at `.claude/skills/gemini-live-api-dev/SKILL.md`, which is the
 * current authoritative source. An earlier version of this file claimed
 * the director's brief named models that "could not be confirmed". That
 * was wrong: the brief was right and the check was inadequate. See
 * DECISIONS.md #7.
 */

export const MODELS = {
  /* Default for low-latency voice conversation via Live API */
  host: process.env.WAZI_HOST_MODEL || 'gemini-3.8-live',

  /* Deep model for extended reasoning turns */
  deep: process.env.WAZI_DEEP_MODEL || 'gemini-3.8-live',

  /* The evidence and search worker using Google Search Grounding */
  worker: process.env.WAZI_WORKER_MODEL || 'gemini-3.5-flash',
};

/* Straight from the skill's Audio Formats section. */
export const AUDIO = {
  inputMime: 'audio/pcm;rate=16000',
  inputRate: 16000,
  outputRate: 24000,
};

/* Documented limits — the relay has to plan around these, not discover
   them in a demo. */
export const LIMITS = {
  audioOnlySessionMs: 15 * 60 * 1000,
  audioVideoSessionMs: 2 * 60 * 1000,
  connectionLifetimeMs: 10 * 60 * 1000,
  contextInputTokens: 128_000,
  contextOutputTokens: 64_000,
};

export const THINKING_LEVEL = process.env.WAZI_THINKING_LEVEL || 'low';
