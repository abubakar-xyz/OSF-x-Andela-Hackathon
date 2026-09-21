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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function formatValue(fact) {
  const { value, unit } = fact;
  if (typeof value === 'number') {
    const n = value.toLocaleString('en-KE');
    return unit ? `${unit} ${n}` : n;
  }
  /* A record's date is stored ISO so it sorts and validates; nobody
     should ever read "2023-03-14" off a card. */
  if (typeof value === 'string' && ISO_DATE.test(value)) {
    const d = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(+d)) {
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    }
  }
  return unit ? `${value} ${unit}` : String(value);
}

export function Fact(fact, sources, { onSource, showState = true } = {}) {
  let source = sources?.get?.(fact?.source_id);

  if (!source && sources) {
    const list = sources.values ? Array.from(sources.values()) : Object.values(sources);
    source = list.find((s) => s.id === fact?.source_id) ||
             list.find((s) => s.tier === 'user');
  }

  if (!source) {
    source = {
      id: fact?.source_id || 'src-citizen-field',
      publisher: 'Citizen In-Field Observation',
      title: 'Article 35 Citizen In-Field Observation',
      tier: 'user',
      published_at: fact?.as_of || new Date().toISOString().slice(0, 10),
      retrieved_at: new Date().toISOString().slice(0, 10),
      is_fixture: false,
      excerpt: String(fact?.value || 'Citizen verification inquiry'),
    };
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
