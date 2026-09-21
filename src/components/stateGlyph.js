/** Evidence Ladder mark. DESIGN.md §12.4 / §18.2.
 *  Never rendered alone: the word always accompanies the glyph, so the
 *  status survives greyscale, colour-blindness and a printed page. §29 */
import { el } from '../core/dom.js';
import { GLYPH_PATH, WORD, CSS_CLASS, DEFINITION } from '../evidence/ladder.js';

export function StateGlyph(state, { size = 20, large = false, onExplain } = {}) {
  const word = WORD[state] ?? 'Unknown';
  const node = el(onExplain ? 'button' : 'span', {
    class: `state ${CSS_CLASS[state] ?? 'state--unknown'}${large ? ' state--lg' : ''}`,
    ...(onExplain ? { type: 'button', onclick: () => onExplain(state) } : {}),
    'aria-label': `Evidence state: ${word}. ${DEFINITION[state] ?? ''}`,
  },
    el('span', {
      class: 'state__glyph', 'aria-hidden': 'true',
      html: `<svg viewBox="0 0 20 20" width="${size}" height="${size}">${GLYPH_PATH[state] ?? GLYPH_PATH.UNKNOWN}</svg>`,
    }),
    /* The word is set in sentence case and given its weight by the
       glyph and the rule beside it. Shouting it in capitals is template
       chrome, and all-caps also mangles diacritics. */
    el('span', { text: word }),
  );
  return node;
}
