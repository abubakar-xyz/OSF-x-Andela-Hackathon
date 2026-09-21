/**
 * Draft Studio surface.  DESIGN.md §12.10 / §15.5 / §21.2.
 *
 * The body is edited in a surface that looks like the finished artifact,
 * not a textarea. Citations are structured, so they survive editing.
 */
import { el, clear } from '../core/dom.js';
import { Ribbon } from './ribbon.js';
import { RouteCard } from './routeCard.js';
import { FORMATS, build_civic_draft } from '../tools/draft.js';

export function DraftStudio({ payload, route, routeSources, caseId, user, disclosure,
                              onChange, onReview, onSource }) {
  const state = { format: 'email', tone: 'plain', length: 'short', disclosure: { ...disclosure }, body: null };

  const wrap = el('section', { 'aria-label': 'Draft studio' });
  const bodyHost = el('div');
  const errorHost = el('div');

  const formatRow = el('div', { class: 'chips', style: { justifyContent: 'flex-start' } });
  const availableFormats = ['email', 'letter', 'whatsapp', 'atia', 'complaint']
    .filter((f) => FORMATS[f]);

  for (const id of availableFormats) {
    formatRow.append(el('button', {
      class: 'chip-sm', type: 'button', 'aria-pressed': String(id === state.format),
      text: FORMATS[id].label,
      onclick: () => { state.format = id; sync(); },
    }));
  }

  const toneRow = optionRow('Tone', [['plain', 'Plain'], ['formal', 'Formal']], (v) => { state.tone = v; sync(); }, () => state.tone);
  const lenRow = optionRow('Length', [['short', 'Short'], ['full', 'Full']], (v) => { state.length = v; sync(); }, () => state.length);

  const attachRow = el('div');
  const toggles = [
    ['includePhoto', 'Attach the photo'],
    ['includeSources', 'Attach the source list'],
    ['includeName', 'Include my name'],
    ['includePhone', 'Include my phone number'],
  ];
  for (const [key, label] of toggles) {
    const input = el('input', {
      type: 'checkbox', id: `tg-${key}`, ...(state.disclosure[key] ? { checked: true } : {}),
      onchange: (e) => { state.disclosure[key] = e.currentTarget.checked; sync(); },
    });
    attachRow.append(el('div', { class: 'field' }, input, el('label', { for: `tg-${key}`, text: label })));
  }

  const reviewBtn = el('button', {
    class: 'btn btn--primary', type: 'button', style: { width: '100%' },
    text: 'Review what’s shared',
    onclick: () => state.body && onReview?.({ ...state.body, body: textarea.value }),
  });

  const textarea = el('textarea', {
    class: 'draft-body', 'aria-label': 'Draft body — you can edit this',
    oninput: () => { if (state.body) state.body.body = textarea.value; },
  });

  function sync() {
    for (const btn of formatRow.children) {
      btn.setAttribute('aria-pressed', String(btn.textContent === FORMATS[state.format].label));
    }
    toneRow.sync(); lenRow.sync();
    clear(errorHost);

    const built = build_civic_draft({
      payload, route, format: state.format, tone: state.tone, length: state.length,
      disclosure: state.disclosure, user, caseId,
    });

    if (!built.ok) {
      errorHost.append(el('p', { class: 'ribbon', text: built.reason }));
      reviewBtn.disabled = true;
      return;
    }
    state.body = built.draft;
    textarea.value = built.draft.body;
    textarea.className = `draft-body${state.format === 'letter' || state.format === 'atia' ? ' draft-body--letter' : ''}`;
    reviewBtn.disabled = false;
    onChange?.(built.draft);
  }

  wrap.append(
    Ribbon('draft'),
    formatRow,
    route ? RouteCard(route, routeSources ?? [], { onSource, collapsed: true }) : null,
    errorHost,
    el('div', { style: { marginTop: '16px' } }, textarea),
    bodyHost,
    toneRow.el, lenRow.el,
    el('p', { class: 'card__label', style: { marginTop: '16px' }, text: 'Attach' }),
    attachRow,
    el('div', { style: { marginTop: '24px' } }, reviewBtn),
  );

  sync();
  return { el: wrap, get draft() { return state.body ? { ...state.body, body: textarea.value } : null; } };
}

function optionRow(label, options, onPick, getCurrent) {
  const row = el('div', { class: 'chips', style: { justifyContent: 'flex-start', marginTop: '12px' } });
  const host = el('div', { class: 'field' }, el('span', { class: 'card__label', text: label }), row);
  const buttons = options.map(([value, text]) =>
    el('button', { class: 'chip-sm', type: 'button', text, onclick: () => onPick(value) }));
  row.append(...buttons);
  const sync = () => buttons.forEach((b, i) =>
    b.setAttribute('aria-pressed', String(options[i][0] === getCurrent())));
  sync();
  return { el: host, sync };
}
