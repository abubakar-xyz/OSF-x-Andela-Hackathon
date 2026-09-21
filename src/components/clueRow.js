/** Editable clue extraction. DESIGN.md §12.8.
 *  Observed and inferred are visually distinct, and everything is
 *  editable before it is used — deleting a clue visibly changes the
 *  query, because the user owns the input. */
import { el } from '../core/dom.js';

export function ClueList(clues, { onChange } = {}) {
  const host = el('div', { 'aria-label': 'What I read from your image' });
  const items = clues.map((c) => ({ ...c }));

  function paint() {
    host.replaceChildren();
    items.forEach((clue, i) => {
      const value = el('span', {
        class: `clue__v${clue.observed === 'inferred' ? ' clue__v--inferred' : ''}`,
        text: clue.value, contenteditable: 'true', role: 'textbox',
        'aria-label': `${clue.label}, ${clue.observed}. Edit if I got it wrong.`,
        oninput: (e) => { items[i].value = e.currentTarget.textContent.trim(); onChange?.(current()); },
      });
      host.append(el('div', { class: 'clue' },
        el('span', { class: 'clue__k', text: clue.label }),
        value,
        el('span', { class: 'clue__tag', text: clue.observed === 'inferred' ? 'inferred' : 'observed',
          title: clue.reason || (clue.observed === 'inferred' ? 'I am guessing this' : 'I can see this') }),
        el('button', { class: 'clue__del', type: 'button', text: 'Remove',
          'aria-label': `Remove ${clue.label}`,
          onclick: () => { items.splice(i, 1); paint(); onChange?.(current()); } }),
      ));
    });
    if (!items.length) {
      host.append(el('p', { class: 'empty', text: "Nothing left. Add something back or tell me in words." }));
    }
  }

  const current = () => items.map((c) => ({ ...c }));
  paint();
  return { el: host, get clues() { return current(); } };
}
