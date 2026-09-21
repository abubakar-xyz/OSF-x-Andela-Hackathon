/**
 * Case receipt.  DESIGN.md §13.3.
 *
 * M-Pesa taught a continent that a transaction is not real until you have
 * a reference number. This costs almost nothing and it is the thing
 * people screenshot and keep.
 */
import { el, fmtDate } from '../core/dom.js';
import { StateGlyph } from './stateGlyph.js';

/* Crockford base32 — no I, L, O or U, so an ID survives being read aloud
   or written by hand. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function newCaseId(rand = Math.random) {
  let out = '';
  for (let i = 0; i < 4; i++) out += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return `WZ-${out}`;
}

export function CaseReceipt(kase) {
  return el('article', { class: 'receipt', 'aria-label': `Case receipt ${kase.id}` },
    el('p', { class: 'wordmark', text: 'wazi' }),
    el('p', { class: 'receipt__id', text: kase.id }),
    row('Opened', fmtDate(kase.opened_at)),
    row('Subject', kase.subject),
    row('Status', kase.status),
    el('div', { class: 'field' },
      el('span', { class: 'receipt__k', text: 'Evidence' }),
      kase.evidence_state ? StateGlyph(kase.evidence_state) : el('span', { text: '—' }),
      el('span', { class: 'clue__v',
        text: `${kase.source_count ?? 0} source${kase.source_count === 1 ? '' : 's'}` +
              (kase.photo_count ? ` · ${kase.photo_count} photo` : '') }),
    ),
    kase.routed_to ? row('Routed', kase.routed_to) : null,
    el('p', { class: 'receipt__note',
      text: 'This is a record you created. It has not been sent to anyone. ' +
            'Wazi keeps it on this phone only.' }),
  );
}

function row(k, v) {
  return el('div', { class: 'field' },
    el('span', { class: 'receipt__k', text: k }),
    el('span', { class: 'clue__v', text: v ?? '—' }));
}
