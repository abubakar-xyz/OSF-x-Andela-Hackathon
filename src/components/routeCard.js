/**
 * RouteCard.  DESIGN.md §12.9 / §21.1.
 *
 * mySociety's lesson: the bottleneck in civic action is not motivation,
 * it is addressing the envelope. This card is where most of the real
 * value sits, so "why this office" is shown, always, with its own source.
 */
import { el, fmtDate } from '../core/dom.js';
import { Fact } from './fact.js';
import { SourceChip } from './sourceChip.js';
import { sourceIndex } from '../evidence/types.js';

const CHANNEL = { email: 'Email', portal: 'Online portal', postal: 'Post', phone: 'Phone' };

export function RouteCard(route, sources, { onSource, collapsed = false } = {}) {
  const idx = sourceIndex(sources);
  const card = el('article', { class: 'card', 'aria-label': `Responsible office: ${route.office}` });

  card.append(
    el('p', { class: 'card__label', text: 'GOES TO' }),
    el('h3', { class: 'card__title', text: route.office }),
    el('p', { class: 'tt__row', text: route.body }),
  );

  card.append(el('p', { class: 'tt__row' },
    el('span', { class: 'card__label', text: `${CHANNEL[route.channel] ?? route.channel}: ` }),
    Fact(route.address, idx, { onSource, showState: false })));

  card.append(el('p', { class: 'tt__checked', text: `Verified ${fmtDate(route.verified_at)}` }));

  const detail = el('div', { hidden: collapsed || undefined });
  detail.append(
    el('p', { class: 'card__label', style: { marginTop: '16px' }, text: 'WHY THIS OFFICE' }),
    el('p', { class: 'tt__row' }, Fact(route.why_this_office, idx, { onSource, showState: false })),
  );

  if (route.procedure) {
    detail.append(el('p', { class: 'card__label', style: { marginTop: '16px' }, text: route.procedure.name.toUpperCase() }));
    const ol = el('ol', { style: { paddingLeft: '20px' } });
    for (const s of route.procedure.steps) ol.append(el('li', { class: 'tt__row', text: s }));
    detail.append(ol);
    if (route.procedure.deadline_days) {
      /* A deadline is only ever shown with a source. No invented deadlines. §21.1 */
      detail.append(el('p', { class: 'tt__row' },
        el('span', { class: 'card__label', text: 'They must respond within ' }),
        Fact(route.procedure.deadline_days, idx, { onSource, showState: false })));
    }
  }

  if (route.escalation) {
    detail.append(
      el('p', { class: 'card__label', style: { marginTop: '16px' }, text: "IF THEY DON'T REPLY, NEXT IS" }),
      el('p', { class: 'tt__row', text: `${route.escalation.office}, ${route.escalation.body}` }),
      el('p', { class: 'tt__row' }, Fact(route.escalation.address, idx, { onSource, showState: false })),
    );
  }

  for (const s of sources) detail.append(SourceChip(s, { onOpen: onSource }));
  card.append(detail);

  if (collapsed) {
    card.append(el('button', {
      class: 'chip-sm', type: 'button', text: 'Why this office?',
      'aria-expanded': 'false',
      onclick: (e) => {
        const open = detail.hidden;
        detail.hidden = !open;
        e.currentTarget.setAttribute('aria-expanded', String(open));
        e.currentTarget.textContent = open ? 'Hide details' : 'Why this office?';
      },
    }));
  }
  return card;
}

/** §21.1 — when nothing is verified we say so and offer the escalation.
 *  We never fill the gap with a guess. */
export function NoRouteCard(reason, { onEscalate } = {}) {
  return el('article', { class: 'card' },
    el('p', { class: 'card__label', text: 'NO VERIFIED CONTACT' }),
    el('h3', { class: 'card__title', text: "I won't give you an address I haven't checked" }),
    el('p', { class: 'tt__row', text: reason }),
    onEscalate
      ? el('button', { class: 'btn', type: 'button', text: 'Use the verified escalation instead', onclick: onEscalate })
      : null,
  );
}
