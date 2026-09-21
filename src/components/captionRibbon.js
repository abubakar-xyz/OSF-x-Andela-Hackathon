/**
 * Caption ribbon.  DESIGN.md §12.2.
 *
 * Captions are always on and never hideable (§29). Any line of the user's
 * own speech is tappable to correct — and correcting re-runs the turn,
 * it does not merely fix the text (§15.3).
 */
import { el, clear } from '../core/dom.js';

const MAX_VISIBLE = 3;

export function CaptionRibbon({ onCorrect } = {}) {
  const host = el('div', {
    class: 'ribbon-cap', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation captions',
  });
  const lines = [];

  function paint() {
    clear(host);
    const visible = lines.slice(-MAX_VISIBLE);
    visible.forEach((line, i) => {
      const faded = i === 0 && visible.length === MAX_VISIBLE;
      if (line.who === 'user' && onCorrect) {
        host.append(el('button', {
          class: `cap-line cap-line--user${faded ? ' cap-line--faded' : ''}`,
          type: 'button', text: line.text,
          'aria-label': `You said: ${line.text}. Tap to correct.`,
          onclick: () => edit(line),
        }));
      } else {
        host.append(el('p', {
          class: `cap-line cap-line--${line.who}${faded ? ' cap-line--faded' : ''}`,
          text: line.text,
        }));
      }
    });
  }

  function edit(line) {
    clear(host);
    const input = el('input', { class: 'cap-edit', value: line.text, 'aria-label': 'Correct what you said' });
    const commit = () => {
      const next = input.value.trim();
      if (next && next !== line.text) { line.text = next; onCorrect?.(next); }
      paint();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') paint();
    });
    input.addEventListener('blur', commit);
    host.append(input,
      el('button', { class: 'chip', type: 'button', text: 'Use this instead', onmousedown: (e) => e.preventDefault(), onclick: commit }));
    input.focus(); input.select();
  }

  return {
    el: host,
    say(text) { lines.push({ who: 'wazi', text }); paint(); },
    heard(text) { lines.push({ who: 'user', text }); paint(); },
    tool(text) { lines.push({ who: 'tool', text }); paint(); },
    /** Replace the trailing partial transcript as it streams in. */
    partial(text) {
      const last = lines[lines.length - 1];
      if (last?.who === 'user' && last.partial) { last.text = text; }
      else lines.push({ who: 'user', text, partial: true });
      paint();
    },
    settle() { const last = lines[lines.length - 1]; if (last?.partial) delete last.partial; },
    all() { return lines.map((l) => ({ ...l })); },
    clear() { lines.length = 0; paint(); },
  };
}
