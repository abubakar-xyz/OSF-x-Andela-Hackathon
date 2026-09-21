/**
 * SearchLeadCard.  Extends §12.9 to a claim the Country Pack doesn't hold.
 *
 * This is deliberately NOT a Two Truths card. Nothing here has gone
 * through verify_claim, deriveState or acceptEvidence — it is Wazi's own
 * paraphrase of a live web search, and the one thing it must never do is
 * look as settled as a checked finding. Real links, real domains, an
 * honest label on every line, and the citizen reads the source
 * themselves before trusting it. See server/webSearch.mjs.
 */
import { el } from '../core/dom.js';

export function SearchLeadCard(lead, { onOpenScope } = {}) {
  const card = el('article', { class: 'card', 'aria-label': 'Live search result — not verified' });

  card.append(
    el('p', { class: 'ribbon', role: 'note' },
      el('span', { 'aria-hidden': 'true', text: '▓' }),
      el('span', { text: "Live web search — Wazi hasn't checked this, read the source yourself" })),
    el('p', { class: 'card__label', style: { marginTop: '16px' }, text: `Searched for “${lead.query}”` }),
    el('p', { class: 'tt__row', text: lead.summary }),
  );

  if (lead.sources?.length) {
    const list = el('div', { style: { marginTop: '12px' } });
    for (const s of lead.sources) {
      list.append(el('a', {
        class: 'chip-sm', href: s.url, target: '_blank', rel: 'noopener noreferrer',
        style: { display: 'block', marginTop: '6px', textDecoration: 'none' },
      }, el('span', { text: `${s.tier === 'credible' ? '◈' : '○'} ${s.title || s.domain}` }),
         el('span', { class: 'tt__checked', style: { display: 'block' }, text: s.domain })));
    }
    card.append(list);
  }

  if (onOpenScope) {
    card.append(el('button', {
      class: 'btn btn--ghost', type: 'button', style: { marginTop: '16px', width: '100%' },
      text: 'Show me where to look myself', onclick: onOpenScope,
    }));
  }

  return card;
}

/** Offered whether or not a live search ran — the categories are static,
 *  so this works even offline. Opens onto a real, live-searched result
 *  per category when the citizen picks one. */
export function ScopeCard(scope, { onSearchCategory } = {}) {
  const card = el('article', { class: 'card', 'aria-label': 'Where to look' });
  card.append(
    el('p', { class: 'card__label', text: 'Not in what Wazi has checked' }),
    el('h3', { class: 'card__title', text: `Real offices to try in ${scope.country.name}` }),
    el('p', { class: 'tt__row',
      text: "These are the kinds of office that would know — Wazi will search live for each one's " +
            "current site when you tap it. Nothing here is asserted as verified until you open the link." }),
  );
  const list = el('div', { style: { marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' } });
  for (const cat of scope.categories) {
    list.append(el('button', {
      class: 'btn btn--ghost', type: 'button', text: cat.label,
      onclick: () => onSearchCategory?.(cat),
    }));
  }
  card.append(list);
  return card;
}
