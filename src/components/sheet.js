/** Bottom sheet. DESIGN.md §12.13 — maximum depth is ONE.
 *  A sheet may never open another sheet; it replaces itself. */
import { el, clear } from '../core/dom.js';

let open = null;

export function closeSheet() {
  if (!open) return;
  if (open.onKey) document.removeEventListener('keydown', open.onKey);
  open.scrim.remove();
  open.sheet.remove();
  open.restore?.focus?.();
  open = null;
}

/**
 * `onClose` fires only when the USER dismisses the sheet — scrim, Escape
 * or a back affordance. The `close()` handed to buildBody is the caller
 * advancing its own flow, and must not fire it: doing so let the machine
 * fall back to `listening` and then reject the CAPTURE that followed.
 */
export function openSheet(title, buildBody, { onClose } = {}) {
  const restore = document.activeElement;
  if (open) { open.scrim.remove(); open.sheet.remove(); }   /* replace, never stack */

  const dismiss = () => { closeSheet(); onClose?.(); };
  const scrim = el('div', { class: 'sheet-scrim', onclick: dismiss });
  const body = el('div');
  const sheet = el('div', {
    class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1',
  },
    el('div', { class: 'sheet__grab', 'aria-hidden': 'true' }),
    el('h2', { class: 'sheet__title', text: title }),
    body,
  );

  buildBody(body, { close: closeSheet, dismiss });
  document.body.append(scrim, sheet);
  sheet.focus();

  const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
  document.addEventListener('keydown', onKey, { once: false });
  open = { scrim, sheet, restore, body, onKey };
  return { close: closeSheet, dismiss, body, rebuild: (fn) => fn(clear(body)) };
}

export const sheetIsOpen = () => Boolean(open);
