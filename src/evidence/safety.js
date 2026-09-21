/**
 * Wazi — what Wazi may never say.  DESIGN.md §18.3.
 *
 * The difference between "this is a ghost project" and "the record says
 * completed and the photograph from 18 September does not appear to show
 * a completed building" is the difference between a defamation exposure
 * and a civic instrument. It is also, in practice, far more persuasive to
 * the office receiving it.
 *
 * Enforced at the speech layer and the drafting layer, and asserted by
 * tests/honesty.test.js #14.
 */

export const FORBIDDEN = [
  'stolen', 'stole', 'embezzled', 'embezzlement', 'corrupt', 'corruption',
  'fraud', 'fraudulent', 'ghost project', 'abandoned', 'they lied', 'lied about',
  'proof of', 'proves that', 'definitely', 'guaranteed', 'scandal',
  'we confirmed that they', 'this shows that',
];

/** Percentages are banned outright — §5 Decision 7. */
const PERCENT_CONFIDENCE = /\b\d{1,3}\s?%\s*(confident|confidence|certain|sure|complete)\b/i;
const PERCENT_COMPLETE = /\b\d{1,3}\s?%\s*(done|built|finished)\b/i;

export function scanForbidden(text) {
  const t = String(text || '').toLowerCase();
  const hits = FORBIDDEN.filter((w) => t.includes(w));
  if (PERCENT_CONFIDENCE.test(t)) hits.push('percentage confidence');
  if (PERCENT_COMPLETE.test(t)) hits.push('percentage completion');
  return hits;
}

export const isSafe = (text) => scanForbidden(text).length === 0;

/**
 * Used before anything is spoken or written into an artifact. Returning
 * the hits rather than silently rewriting is deliberate: a silent rewrite
 * would hide the fact that the generator tried.
 */
export function assertSafe(text, where = 'output') {
  const hits = scanForbidden(text);
  if (hits.length) {
    const err = new Error(`${where} contains language Wazi may not use: ${hits.join(', ')}`);
    err.name = 'ForbiddenClaimError';
    err.hits = hits;
    throw err;
  }
  return text;
}

/** §9.4 — the substitution Wazi offers when asked to accuse someone. */
export const REFUSAL_LINE =
  "I won't write that they stole it — I can't show that. What I can write is what the " +
  'record says, what you saw, and a request for them to explain the gap. ' +
  "That's harder to dismiss.";

/** §10 of the brief — immediate danger stops everything. No investigation. */
export const DANGER_LINE =
  "Stop — your safety first. Here are numbers that work in your area. I'll keep the case saved; " +
  "it'll be here later.";
