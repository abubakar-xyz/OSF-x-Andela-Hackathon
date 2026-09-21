/** Bottom sheet. DESIGN.md §12.13 — maximum depth is ONE.
 *  A sheet may never open another sheet; it replaces itself. */
import { el, clear } from '../core/dom.js';

let open = null;

export function closeSheet() {
  if (!open) return;
  open.scrim.remove();
  open.sheet.remove();
  open.restore?.focus?.();
  open = null;
}

export function openSheet(title, buildBody, { onClose } = {}) {
  const restore = document.activeElement;
  if (open) { open.scrim.remove(); open.sheet.remove(); }   /* replace, never stack */

  const scrim = el('div', { class: 'sheet-scrim', onclick: () => { closeSheet(); onClose?.(); } });
  const body = el('div');
  const sheet = el('div', {
    class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1',
  },
    el('div', { class: 'sheet__grab', 'aria-hidden': 'true' }),
    el('h2', { class: 'sheet__title', text: title }),
    body,
  );

  buildBody(body, { close: () => { closeSheet(); onClose?.(); } });
  document.body.append(scrim, sheet);
  sheet.focus();

  const onKey = (e) => { if (e.key === 'Escape') { closeSheet(); onClose?.(); } };
  document.addEventListener('keydown', onKey, { once: false });
  open = { scrim, sheet, restore, body, detachKey: () => document.removeEventListener('keydown', onKey) };
  return { close: () => { closeSheet(); onClose?.(); }, body, rebuild: (fn) => fn(clear(body)) };
}

export const sheetIsOpen = () => Boolean(open);
