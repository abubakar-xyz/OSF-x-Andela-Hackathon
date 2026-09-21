/**
 * Wazi — the state machine.  DESIGN.md §16.
 *
 * The character renderer reads from this; it never holds its own state.
 * The invariants at the bottom are the product's safety properties
 * expressed as code, and `tests/machine.test.js` asserts each one.
 *
 * Note on naming: §16's diagram used "routing" for two different things —
 * intent classification and institution lookup. Here the first is `triage`
 * and the second is `routing`.
 */

export const STATES = [
  'dormant', 'awaiting', 'text_only',
  'listening', 'hearing', 'triage', 'speaking',
  'camera', 'clue_review', 'verifying', 'evidence', 'challenging',
  'routing', 'drafting', 'disclosure', 'export',
  'cases', 'safety_redirect', 'offline',
];

/** Which aperture state each app state presents as. §8.3 */
export const APERTURE_FOR = {
  dormant: 'dormant', awaiting: 'awaiting', text_only: 'resting',
  listening: 'listening', hearing: 'hearing', triage: 'thinking',
  speaking: 'speaking', camera: 'listening', clue_review: 'resting',
  verifying: 'working', evidence: 'resting', challenging: 'working',
  routing: 'thinking', drafting: 'resting', disclosure: 'resting',
  export: 'resting', cases: 'resting', safety_redirect: 'attention',
  offline: 'offline',
};

/** Which world each state lives in. §7 */
export const WORLD_FOR = {
  dormant: 'night', awaiting: 'night', text_only: 'night',
  listening: 'night', hearing: 'night', triage: 'night', speaking: 'night',
  camera: 'night', clue_review: 'night',
  verifying: 'night', evidence: 'day', challenging: 'day',
  routing: 'day', drafting: 'day', disclosure: 'day', export: 'day',
  cases: 'day', safety_redirect: 'night', offline: 'night',
};

const T = {
  dormant:    { TAP: 'awaiting' },
  awaiting:   { GRANTED: 'listening', DENIED: 'text_only' },
  text_only:  { SUBMIT: 'triage', OPEN_CAMERA: 'camera', OPEN_CASES: 'cases',
                GRANTED: 'listening' },

  listening:  { SPEECH: 'hearing', SUBMIT: 'triage', OPEN_CAMERA: 'camera',
                OPEN_CASES: 'cases', DENIED: 'text_only' },
  hearing:    { TURN_END: 'triage', BARGE_IN: 'hearing', CANCEL: 'listening' },

  /* classify_civic_intent decides where the turn goes. */
  triage:     { CHAT: 'speaking', CIVIC: 'verifying', SHOW: 'camera',
                CASES: 'cases', DANGER: 'safety_redirect', TOOL_FAILED: 'speaking' },

  speaking:   { DONE: 'listening', BARGE_IN: 'hearing' },

  camera:     { CAPTURE: 'clue_review', CLOSE: 'listening', DENIED: 'listening' },
  clue_review:{ CHECK: 'verifying', CLOSE: 'listening' },

  /* Motes run here. world-shift fires on RESOLVED. */
  verifying:  { RESOLVED: 'evidence', TOOL_FAILED: 'evidence', CANCEL: 'listening' },

  evidence:   { CHECK_AGAIN: 'challenging', TAKE_ACTION: 'routing',
                BACK: 'listening', OPEN_CASES: 'cases', BARGE_IN: 'hearing' },
  challenging:{ RESOLVED: 'evidence', TOOL_FAILED: 'evidence' },

  routing:    { ROUTED: 'drafting', BACK: 'evidence', TOOL_FAILED: 'evidence' },
  drafting:   { REVIEW: 'disclosure', BACK: 'evidence' },
  /* The ONLY edge into export. §16 invariant 1. */
  disclosure: { APPROVE: 'export', BACK: 'drafting' },
  export:     { DONE: 'evidence', BACK: 'disclosure' },

  cases:      { OPEN_CASE: 'evidence', BACK: 'listening' },
  safety_redirect: { BACK: 'listening' },
  offline:    { ONLINE: 'listening' },
};

/* Guards run before a transition is taken. Returning a string rejects it. */
const GUARDS = {
  evidence(ctx) {
    if (!ctx.evidence) return 'evidence state requires an evidence payload';
    const n = ctx.evidence.sources?.length ?? 0;
    if (n < 1) return 'evidence state requires at least one resolved source';
    return null;
  },
  export(ctx, from) {
    if (from !== 'disclosure') return 'export is only reachable through disclosure';
    if (!ctx.disclosureApproved) return 'export requires an explicit disclosure approval';
    return null;
  },
  disclosure(ctx, from) {
    /* Forward, only from drafting — you cannot skip the draft. Backward
       from export is allowed so someone can change what they shared and
       export again; re-entering export still needs a fresh APPROVE,
       which is the only edge into it. */
    if (from !== 'drafting' && from !== 'export') {
      return 'disclosure is only reachable from drafting, or back from export';
    }
    return null;
  },
  drafting(ctx) {
    if (!ctx.route) return 'drafting requires a resolved route';
    return null;
  },
};

export function createMachine({ initial = 'dormant', context = {} } = {}) {
  let state = initial;
  let ctx = { evidence: null, route: null, disclosureApproved: false, ...context };
  const listeners = new Set();
  const history = [];

  function notify(prev, event) {
    for (const fn of listeners) {
      try { fn({ state, prev, event, context: ctx }); }
      catch (err) { console.error('[machine]', err); }
    }
  }

  const api = {
    get state() { return state; },
    get context() { return ctx; },
    get history() { return history.slice(); },
    get world() { return WORLD_FOR[state]; },
    get aperture() { return APERTURE_FOR[state]; },

    /** Merge into context without moving state. */
    assign(patch) { ctx = { ...ctx, ...patch }; return api; },

    /** Does this event have a defined edge from the current state? */
    can(event) { return Boolean(T[state]?.[event]); },

    /** Why would this event be rejected? null if it would be taken. */
    why(event) {
      const next = T[state]?.[event];
      if (!next) return `no transition for ${event} from ${state}`;
      return GUARDS[next]?.(ctx, state) ?? null;
    },

    send(event, payload) {
      const next = T[state]?.[event];
      if (!next) return { ok: false, reason: `no transition for ${event} from ${state}` };

      if (payload) ctx = { ...ctx, ...payload };

      /* Approving disclosure is the one act that unlocks export. §6 Law 6 */
      if (event === 'APPROVE' && state === 'disclosure') ctx.disclosureApproved = true;
      /* Leaving the draft flow revokes it again — approval is not sticky. */
      if (next === 'drafting' || next === 'evidence') ctx.disclosureApproved = false;

      const blocked = GUARDS[next]?.(ctx, state);
      if (blocked) return { ok: false, reason: blocked };

      const prev = state;
      state = next;
      history.push({ from: prev, event, to: next, at: Date.now() });
      notify(prev, event);
      return { ok: true, state };
    },

    /** Cross-cutting states can be entered from anywhere. §16 */
    interrupt(to, payload) {
      if (!STATES.includes(to)) return { ok: false, reason: `unknown state ${to}` };
      if (payload) ctx = { ...ctx, ...payload };
      const blocked = GUARDS[to]?.(ctx, state);
      if (blocked) return { ok: false, reason: blocked };
      const prev = state;
      state = to;
      history.push({ from: prev, event: 'INTERRUPT', to, at: Date.now() });
      notify(prev, 'INTERRUPT');
      return { ok: true, state };
    },

    onTransition(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  return api;
}

/** Static reachability check used by the invariant tests. §16 */
export function edgesInto(target) {
  const found = [];
  for (const [from, edges] of Object.entries(T)) {
    for (const [event, to] of Object.entries(edges)) {
      if (to === target) found.push({ from, event });
    }
  }
  return found;
}

export const TRANSITIONS = T;
