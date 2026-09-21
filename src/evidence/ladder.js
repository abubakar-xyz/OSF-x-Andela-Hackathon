/**
 * Wazi — the Evidence Ladder.  DESIGN.md §18.
 *
 * Five rungs, fixed words, fixed glyphs, fixed order. No numeric
 * confidence anywhere in the product — a percentage sounds precise while
 * saying nothing, and invites the reader to round it up to "true". §5.7
 */

export const LADDER = ['VERIFIED', 'CORROBORATED', 'REPORTED', 'CONFLICTING', 'UNKNOWN'];

/** Plain definitions, shown verbatim on tap. Appendix A. */
export const DEFINITION = {
  VERIFIED:     'A primary official source says this directly.',
  CORROBORATED: "Two sources that don't depend on each other agree.",
  REPORTED:     'Someone says this. Nobody independent has confirmed it.',
  CONFLICTING:  'Credible sources disagree with each other, or with what you showed me.',
  UNKNOWN:      "I don't have enough to say either way.",
};

export const WORD = {
  VERIFIED: 'Verified', CORROBORATED: 'Corroborated', REPORTED: 'Reported',
  CONFLICTING: 'Conflicting', UNKNOWN: 'Unknown',
};

export const CSS_CLASS = {
  VERIFIED: 'state--verified', CORROBORATED: 'state--corroborated',
  REPORTED: 'state--reported', CONFLICTING: 'state--conflicting',
  UNKNOWN: 'state--unknown',
};

/** §18.2 — 20×20, fixed geometry, learnable like a battery icon.
 *  Scale changes between contexts; the shape never does. */
export const GLYPH_PATH = {
  VERIFIED:     '<path d="M3 3h14v9.5L10 17 3 12.5V3Z" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M6.5 9.8l2.6 2.6 4.6-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>',
  CORROBORATED: '<circle cx="10" cy="10" r="7.1" fill="none" stroke="currentColor" stroke-width="1.75"/><circle cx="10" cy="10" r="3.1" fill="none" stroke="currentColor" stroke-width="1.75"/>',
  REPORTED:     '<path d="M4.2 13.5c0-4.2 1.6-6.6 4.4-7.6l.7 1.7c-1.6.7-2.5 2-2.6 3.6h2.4v5.3H4.2v-3Zm7.6 0c0-4.2 1.6-6.6 4.4-7.6l.7 1.7c-1.6.7-2.5 2-2.6 3.6h2.4v5.3h-4.9v-3Z" fill="currentColor"/>',
  CONFLICTING:  '<path d="M10 2.6l6.4 3.7v7.4L10 17.4 3.6 13.7V6.3L10 2.6Z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-dasharray="5.5 3.4"/><path d="M6.6 13.4L13.4 6.6" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>',
  UNKNOWN:      '<circle cx="10" cy="10" r="7.1" fill="none" stroke="currentColor" stroke-width="1.75" stroke-dasharray="2 3.1"/>',
};

/**
 * LADDER above is DISPLAY order. It is not a strength ordering, and an
 * earlier draft of this file wrongly used it as one — which made
 * CONFLICTING -> REPORTED look like a downgrade when it is the opposite.
 *
 * `settledness` is the comparison scale: 0 is the most settled claim,
 * 4 the least. CONFLICTING and UNKNOWN are both unsettled; CONFLICTING
 * is the stronger statement of the two because it means we found the
 * disagreement rather than finding nothing at all.
 */
export const SETTLEDNESS = {
  VERIFIED: 0, CORROBORATED: 1, REPORTED: 2, CONFLICTING: 3, UNKNOWN: 4,
};
export const settledness = (s) => SETTLEDNESS[s] ?? 4;

/** Display position, for ordering a legend. Not for comparison. */
export const rank = (s) => LADDER.indexOf(s);

/** True when `to` is a LESS settled claim than `from`. Used to assert the
 *  adversarial pass is genuinely able to lose the argument. §20 */
export const isWeaker = (from, to) => settledness(to) > settledness(from);
export const isStronger = (from, to) => settledness(to) < settledness(from);
/** Any movement at all — what "Check Again overturned it" actually means. */
export const isRevision = (from, to) => from !== to;

export function isValidState(s) { return LADDER.includes(s); }

/**
 * CONFLICTING outranks everything: if any credible source disagrees, the
 * claim is CONFLICTING even if four others agree. A failed retrieval can
 * only ever weaken a verdict, never strengthen it. §18.1
 */
export function deriveState({ primary = 0, independent = 0, disagreement = false, failures = 0 }) {
  if (disagreement) return 'CONFLICTING';
  if (failures > 0 && primary === 0 && independent < 2) return 'UNKNOWN';
  if (primary >= 1) return 'VERIFIED';
  if (independent >= 2) return 'CORROBORATED';
  if (independent === 1) return 'REPORTED';
  return 'UNKNOWN';
}

/** A tool failure downgrades the verdict automatically. §17, §18.1 */
export function downgradeForFailure(state) {
  if (state === 'VERIFIED') return 'CORROBORATED';
  if (state === 'CORROBORATED') return 'REPORTED';
  if (state === 'REPORTED') return 'UNKNOWN';
  return state;   /* CONFLICTING and UNKNOWN are already terminal */
}
