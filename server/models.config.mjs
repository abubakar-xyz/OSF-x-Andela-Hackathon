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
  /* Default for low-latency conversation. Async function calling is the
     default mode (behavior: NON_BLOCKING). No thinking_level. */
  host: process.env.WAZI_HOST_MODEL || 'gemini-3.8-live',

  /* Used for the verification turn. It speaks natural conversational
     fillers WHILE async tools run in the background, which is exactly
     the moment §8.4 designs motes for — the difference is that here
     Wazi actually says "checking the records" rather than only showing
     it. Requires NON_BLOCKING on every declaration. */
  deep: process.env.WAZI_DEEP_MODEL || 'gemini-3.8-live-extended-thinking',

  /* The evidence worker: live web search grounding for facts the Country
     Pack doesn't have. Not a Live model — it must never be the thing
     holding a conversation. §23.1
     'gemini-3-flash' was never confirmed against anything and was wrong
     in the same way the brief's models were once wrongly waved off as
     unconfirmed (DECISIONS.md #7) — the fix there was the same fix as
     here: check an authoritative source instead of guessing. ai.google.dev
     is blocked in this environment, but the installed SDK is its own
     authoritative source — 'gemini-flash-latest' is the model used
     throughout node_modules/@google/genai's own README, including its
     "Grounding with Google Search" example. */
  worker: process.env.WAZI_WORKER_MODEL || 'gemini-flash-latest',
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
