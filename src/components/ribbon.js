/** Honest labels. DESIGN.md §12.14 — exactly three messages, nothing else. */
import { el } from '../core/dom.js';

export const RIBBON = {
  fixture:   'Demo data — clearly labelled fixture',
  simulated: 'Simulated send — nothing was delivered',
  draft:     'Draft — review before you send this',
};

export function Ribbon(kind) {
  const text = RIBBON[kind];
  if (!text) throw new Error(`Ribbon: unknown kind "${kind}" — only ${Object.keys(RIBBON)} are allowed`);
  return el('p', { class: 'ribbon', role: 'note' },
    el('span', { 'aria-hidden': 'true', text: '▓' }), el('span', { text }));
}
