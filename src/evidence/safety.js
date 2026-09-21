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
  'definitely', 'guaranteed', 'scandal',
  'we confirmed that they', 'this shows that',
];

/**
 * Phrases that are forbidden as an ASSERTION but required as a DENIAL.
 * "That isn't proof of anything yet" is the restrained line §9.4 asks
 * for; "this is proof of theft" is the accusation Law 3 forbids. A flat
 * substring match cannot tell them apart, so these are checked with a
 * short negation window in front.
 */
export const NEGATABLE = ['proof of', 'proves that', 'evidence of wrongdoing'];
const NEGATORS = /\b(not|isn'?t|is not|aren'?t|are not|never|no|nor|without|doesn'?t|does not|won'?t|will not|cannot|can'?t)\b[^.!?]{0,24}$/i;

/** Percentages are banned outright — §5 Decision 7. */
const PERCENT_CONFIDENCE = /\b\d{1,3}\s?%\s*(confident|confidence|certain|sure|complete)\b/i;
const PERCENT_COMPLETE = /\b\d{1,3}\s?%\s*(done|built|finished)\b/i;

export function scanForbidden(text) {
  const t = String(text || '').toLowerCase();
  const hits = FORBIDDEN.filter((w) => t.includes(w));

  for (const phrase of NEGATABLE) {
    let from = 0;
    for (;;) {
      const at = t.indexOf(phrase, from);
      if (at === -1) break;
      /* Only an unnegated use is an accusation. */
      if (!NEGATORS.test(t.slice(Math.max(0, at - 40), at))) { hits.push(phrase); break; }
      from = at + phrase.length;
    }
  }

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
