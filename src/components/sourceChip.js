/**
 * SourceChip — the most-used component in the product. DESIGN.md §12.5.
 *
 * Freshness is stated in relative words; the absolute date lives on the
 * sheet. A source we failed to reach is rendered greyed with what we last
 * had — it never silently disappears, because a vanished citation is
 * indistinguishable from a citation that never existed.
 */
import { el } from '../core/dom.js';
import { relTime, fmtDate } from '../core/dom.js';
import { TIER_MARK, isStale } from '../evidence/types.js';
import { openSheet } from './sheet.js';

const TIER_WORD = {
  primary: 'Primary official source', credible: 'Credible independent source',
  user: 'Your own evidence', unverified: 'Unverified',
};

export function SourceChip(source, { onOpen } = {}) {
  const stale = isStale(source);
  const failed = Boolean(source.retrieval_failed);

  const meta = failed
    ? `couldn't reach this source today — showing what I had on ${fmtDate(source.retrieved_at)}`
    : `Published ${fmtDate(source.published_at)}, checked ${relTime(source.retrieved_at)}` +
      (stale ? ' — may be stale' : '');

  return el('button', {
    class: `src${stale ? ' src--stale' : ''}${failed ? ' src--failed' : ''}`,
    type: 'button',
    'aria-label': `${TIER_WORD[source.tier]}: ${source.publisher}. ${meta}. Tap for the full excerpt.`,
    onclick: () => (onOpen ? onOpen(source) : openSourceSheet(source)),
  },
    el('span', { class: 'src__tier', 'aria-hidden': 'true', text: TIER_MARK[source.tier] ?? '○' }),
    el('span', { class: 'src__body' },
      el('span', { class: 'src__pub', text: source.publisher }),
      el('span', { class: 'src__meta', text: meta }),
    ),
  );
}

export function openSourceSheet(source) {
  return openSheet(source.publisher, (body) => {
    body.append(
      el('p', { class: 'card__label', text: TIER_WORD[source.tier] ?? 'Unverified' }),
      el('h3', { class: 'card__title', text: source.title }),
      el('blockquote', { class: 'tt__quote', text: `“${source.excerpt}”` }),
      el('dl', { class: 'src-meta' },
        row('Published', fmtDate(source.published_at)),
        row('Retrieved', `${fmtDate(source.retrieved_at)} (${relTime(source.retrieved_at)})`),
        source.url ? row('Address', source.url) : null,
      ),
      source.quality_notes
        ? el('p', { class: 'tt__verdict-note', text: `Known limitation: ${source.quality_notes}` })
        : null,
      isStale(source)
        ? el('p', { class: 'ribbon', text: 'This is the newest I can find. Worth knowing.' })
        : null,
      source.is_fixture
        ? el('p', { class: 'ribbon', text: 'Demo data — clearly labelled fixture' })
        : null,
    );
  });
}

function row(k, v) {
  return el('div', { class: 'field' },
    el('dt', { class: 'card__label', text: k }),
    el('dd', { class: 'clue__v', text: v }));
}

export function SourceList(sources, opts) {
  return el('div', { class: 'src-list' }, ...sources.map((s) => SourceChip(s, opts)));
}
