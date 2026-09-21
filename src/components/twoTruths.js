/**
 * The Two Truths card.  DESIGN.md §13.1.  This is the product.
 *
 * One object with two faces: what the record says, and what you showed
 * me. Built to be screenshotted and forwarded, because that is how
 * anything actually spreads. Distribution is a design problem and this is
 * where it gets solved.
 */

import { el, fmtDate, relTime } from '../core/dom.js';
import { Fact } from './fact.js';
import { StateGlyph } from './stateGlyph.js';
import { SourceChip } from './sourceChip.js';
import { DEFINITION } from '../evidence/ladder.js';
import { sourceIndex, hasFixture } from '../evidence/types.js';
import { Ribbon } from './ribbon.js';
import { openSheet } from './sheet.js';

export function TwoTruths(payload, {
  onCheckAgain, onTakeAction, onShare, onSave, onSource, onAlternative, photoSrc,
} = {}) {
  const sources = sourceIndex(payload.sources);
  const openSource = (s) => onSource?.(s);

  const card = el('article', {
    class: 'card tt', 'aria-label': `Record versus reality for ${payload.entity.name}`,
  });

  /* The user's own words, quoted, in the serif. */
  card.append(el('h2', { class: 'tt__claim', text: `“${payload.claim}”` }));

  const entity = el('div', { class: 'tt__entity' },
    el('h3', { class: 'card__title', text: payload.entity.name }),
    el('p', { class: 'card__label',
      text: [payload.entity.admin2, payload.entity.admin1, payload.entity.sector].filter(Boolean).join(' · ') }),
  );
  /* Mistaken identity is expected. Always offer the way out. §17 */
  if (payload.alternatives?.length) {
    entity.append(el('button', {
      class: 'chip-sm', type: 'button', style: { marginTop: '8px' },
      text: 'Not this one?',
      onclick: () => openSheet('Which one is it?', (body) => {
        body.append(el('p', { class: 'tt__verdict-note',
          text: `There ${payload.alternatives.length === 1 ? 'is' : 'are'} ${payload.alternatives.length} other ` +
                'record with a similar name in this area. Pick the right one and I will check again.' }));
        for (const alt of payload.alternatives) {
          body.append(el('button', { class: 'btn', style: { marginTop: '8px', width: '100%' },
            text: alt.name, onclick: () => onAlternative?.(alt) }));
        }
      }),
    }));
  }
  card.append(entity);

  /* ── The two faces ───────────────────────────────────────────── */
  const recordCol = el('div', { class: 'tt__col' },
    el('h4', { class: 'tt__colhead', text: 'WHAT THE RECORD SAYS' }));

  for (const r of payload.record) {
    /* Exact official wording, verbatim, in quotation marks. Never
       paraphrased, never summarised. §13.1 */
    if (r.verbatim && r.claim_type === 'reported_completion' && r.label === 'Project status') {
      recordCol.append(el('blockquote', { class: 'tt__quote', text: `“${r.verbatim}”` }));
      continue;
    }
    recordCol.append(el('p', { class: 'tt__row' },
      el('span', { class: 'card__label', text: `${r.label}  ` }),
      Fact(r.fact, sources, { onSource: openSource, showState: false }),
    ));
  }
  const recSources = payload.sources.filter((s) => s.tier !== 'user');
  for (const s of recSources) recordCol.append(SourceChip(s, { onOpen: openSource }));

  const fieldCol = el('div', { class: 'tt__col' },
    el('h4', { class: 'tt__colhead', text: 'WHAT YOU SHOWED ME' }));
  if (photoSrc) {
    fieldCol.append(el('img', {
      class: 'tt__photo', src: photoSrc, width: '320', height: '240', loading: 'lazy',
      alt: 'The image you supplied. Location metadata was removed when it was imported.',
    }));
  }
  for (const f of payload.field) {
    fieldCol.append(el('p', { class: 'tt__row' },
      el('span', { class: 'card__label', text: `${f.label}: ` }),
      Fact(f.fact, sources, { onSource: openSource, showState: false }),
    ));
  }
  if (!payload.field.length) {
    fieldCol.append(el('p', { class: 'tt__verdict-note', text: "You haven't shown me anything yet." }));
  }
  for (const s of payload.sources.filter((s) => s.tier === 'user')) {
    fieldCol.append(SourceChip(s, { onOpen: openSource }));
  }

  card.append(el('div', { class: 'tt__cols' }, recordCol, fieldCol));

  /* ── The verdict, on the seam ────────────────────────────────── */
  const verdict = el('div', { class: 'tt__verdict' },
    StateGlyph(payload.evidence_state, { large: true, onExplain: explainState }),
    el('p', { class: 'tt__verdict-note', text: DEFINITION[payload.evidence_state] }),
  );
  if (payload.previous_state && payload.previous_state !== payload.evidence_state) {
    /* Never hide a revision. A product seen correcting itself is trusted
       more than one never seen to be wrong. §20 */
    verdict.append(el('p', { class: 'tt__was', text: `was: ${payload.previous_state}` }));
    if (payload.revision_note) {
      verdict.append(el('p', { class: 'tt__verdict-note', text: payload.revision_note }));
    }
  }
  card.append(verdict);

  /* ── Agree / differ / unknown ────────────────────────────────── */
  const lists = el('div', { class: 'tt__lists' });
  lists.append(list('Where they agree', payload.agreements, ''));
  lists.append(list('Where they differ', payload.differences, 'tt__list--differ'));
  /* Mandatory and never empty — there are always gaps. §13.1 */
  lists.append(list("What we still don't know", payload.missing_fields, ''));
  if (payload.failed_checks?.length) {
    lists.append(list("What I couldn't check", payload.failed_checks.map((f) => `${f.label}: ${f.reason}`), ''));
  }
  card.append(lists);

  /* ── Foot ────────────────────────────────────────────────────── */
  card.append(el('div', { class: 'tt__foot' },
    el('p', { class: 'tt__checked', text: `Last checked ${relTime(payload.retrieved_at)}` }),
    el('div', { class: 'tt__actions' },
      el('button', { class: 'btn', type: 'button', text: 'Check again', onclick: () => onCheckAgain?.() }),
      el('button', { class: 'btn btn--primary', type: 'button', text: 'Take action →', onclick: () => onTakeAction?.() }),
      el('button', { class: 'btn btn--ghost', type: 'button', text: 'Share as image', onclick: () => onShare?.() }),
      el('button', { class: 'btn btn--ghost', type: 'button', text: 'Save case', onclick: () => onSave?.() }),
    ),
  ));

  /* Law 8 — a fixture says so on screen, not only in the repo. */
  if (hasFixture(payload)) card.prepend(Ribbon('fixture'));

  return card;
}

function list(heading, items, extraClass) {
  const section = el('section', { class: `tt__list ${extraClass}` },
    el('h4', { text: heading }));
  const ul = el('ul');
  if (!items?.length) {
    ul.append(el('li', { class: 'tt__verdict-note', text: '—' }));
  } else {
    for (const item of items) ul.append(el('li', { text: item }));
  }
  section.append(ul);
  return section;
}

function explainState(state) {
  openSheet(state, (body) => {
    body.append(
      el('p', { class: 'tt__quote', text: DEFINITION[state] }),
      el('p', { class: 'tt__verdict-note',
        text: 'Wazi never gives a confidence percentage. A number sounds precise while saying ' +
              'nothing, and invites you to round it up to “true”. These five words are the whole scale.' }),
    );
  });
}
