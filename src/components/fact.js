/**
 * <Fact> — the enforcement point.  DESIGN.md §19.
 *
 * A Fact cannot render without a resolvable source. In development that
 * throws; in production it renders an em-dash and says "source missing"
 * to assistive tech. Either way the number never appears unattributed.
 *
 * This is deliberately the least clever component in the product.
 */
import { el } from '../core/dom.js';
import { StateGlyph } from './stateGlyph.js';

export const isDev = () =>
  typeof location !== 'undefined' &&
  /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

export function formatValue(fact) {
  const { value, unit } = fact;
  if (typeof value === 'number') {
    const n = value.toLocaleString('en-KE');
    return unit ? `${unit} ${n}` : n;
  }
  return unit ? `${value} ${unit}` : String(value);
}

export function Fact(fact, sources, { onSource, showState = true } = {}) {
  const source = sources?.get?.(fact?.source_id);

  if (!source) {
    const detail = `Orphan fact: ${JSON.stringify(fact)}`;
    if (isDev()) throw new Error(detail);
    console.error(`[wazi] ${detail}`);
    return el('span', { class: 'fact fact--orphan' }, '—',
      el('span', { class: 'sr-only', text: 'source missing' }));
  }

  const label = `${formatValue(fact)}. Source: ${source.publisher}. Tap for details.`;
  return el('button', {
    class: 'fact', type: 'button', 'aria-label': label,
    onclick: () => onSource?.(source, fact),
  },
    el('span', { text: formatValue(fact) }),
    showState ? StateGlyph(fact.state, { size: 14 }) : el('span', { class: 'fact__mark', text: 'ⓘ' }),
  );
}
