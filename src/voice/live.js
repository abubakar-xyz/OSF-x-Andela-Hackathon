/**
 * Hosted realtime path — SPECIFIED, NOT WIRED.  DESIGN.md §23.3–§23.5.
 *
 * Deliberately a stub. The UI must never imply a hosted model is running
 * when it is not (§6 Law 8), so this throws rather than degrading
 * silently, and `isConfigured()` is false until someone supplies a relay.
 *
 * The contract below is what the relay must satisfy. Tools execute
 * SERVER-side: if they ran on the client, the client would decide what
 * counts as evidence, which is precisely what we must not allow.
 */

export const LIVE_CONTRACT = {
  transport: 'WebSocket to our own relay, never direct to a model provider',
  why: 'keys stay server-side, and tool execution stays somewhere the phone cannot lie to',
  host_capabilities: [
    'bidirectional streaming audio in/out',
    'image frames in',
    'server-side VAD with interruption',
    'input and output transcription',
    'function calling',
    'multilingual',
    'session resumption',
    'ephemeral tokens',
  ],
  worker_capabilities: [
    'strict JSON-schema structured output',
    'tool/function calling',
    'search grounding with returned citations',
    'temperature 0',
  ],
  timings: {
    barge_in_ms: 120,
    duck_ms: 80,
    tool_timeout_ms: 6000,
    grounded_tool_timeout_ms: 12000,
    idle_close_ms: 90000,
    resume_buffer_ms: 8000,
  },
  /* §23.5 — turnComplete does not mean idle. Track pending tools
     explicitly and only leave `working` when the set is empty AND the
     turn is complete. */
  notes: 'turnComplete !== idle; a tool timeout is a visible tool_failed event, never a silent retry',
};

export const isConfigured = () =>
  Boolean(globalThis.WAZI_RELAY_URL && String(globalThis.WAZI_RELAY_URL).startsWith('ws'));

export function connectLive() {
  if (!isConfigured()) {
    throw new Error(
      'The hosted realtime path is not configured in this build. ' +
      'Wazi is using the browser speech engine instead, and says so. ' +
      'See DESIGN.md §23.4 and DECISIONS.md.');
  }
  throw new Error('connectLive: relay client not implemented in this build — see LIVE_CONTRACT');
}

/** Shown in the UI wherever someone might assume a hosted model is live. */
export const HONEST_LABEL = 'On-device speech — no hosted model is connected in this build';
