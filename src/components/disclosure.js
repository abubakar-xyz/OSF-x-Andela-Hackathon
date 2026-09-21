/**
 * Disclosure Review — the gate.  DESIGN.md §22.
 *
 * Privacy is the requirement, but the design reason is different: people
 * do not send anything until they can see exactly what is in it. This
 * screen is a conversion feature that happens to be a safety feature.
 *
 * It cannot be skipped, and it is the only edge into export (§16).
 */
import { el, fmtDate } from '../core/dom.js';
import { auditDraftAgainstDisclosure, prepare_external_action, render_export } from '../tools/draft.js';
import { Ribbon } from './ribbon.js';

const PRECISION = [
  ['exact', 'Exact'],
  ['approx', '±2 km'],
  ['county', 'County only'],
];

export function DisclosureReview({ draft, payload, user = {}, onApprove, onBack, onExport }) {
  const disclosure = { ...draft.disclosure };
  const wrap = el('section', { 'aria-label': 'Disclosure review' });
  const rows = el('div');

  const render = () => {
    rows.replaceChildren();

    rows.append(inRow('Your message', `${draft.body.split('\n').length} lines`, () => preview(draft.subject, draft.body)));

    if (disclosure.includeSources) {
      rows.append(inRow(`${draft.refs.length} source${draft.refs.length === 1 ? '' : 's'} with dates`,
        draft.refs.map((r) => r.publisher).join(', '),
        () => preview('Sources', draft.refs.map((r) =>
          `[${r.n}] ${r.publisher} — ${r.title}\n     published ${fmtDate(r.published_at)}, retrieved ${fmtDate(r.retrieved_at)}`).join('\n\n'))));
    } else {
      rows.append(outRow('Sources', 'Not attached'));
    }

    if (disclosure.includePhoto && payload.field.length) {
      rows.append(inRow('1 photo', 'EXIF and GPS removed ✓', null,
        'Location metadata is stripped when the image is imported, not when it is exported — ' +
        'the precise data never exists in storage.'));
    } else {
      rows.append(outRow('Photo', 'Not attached'));
    }

    /* Location precision defaults to the coarsest. §22 */
    const locRow = outRow('Your exact location',
      `Sending: ${labelFor(disclosure.locationPrecision, payload)}`);
    const picker = el('div', { class: 'chips', style: { justifyContent: 'flex-start' } });
    for (const [value, text] of PRECISION) {
      picker.append(el('button', {
        class: 'chip-sm', type: 'button', text,
        'aria-pressed': String(disclosure.locationPrecision === value),
        onclick: () => { disclosure.locationPrecision = value; render(); },
      }));
    }
    locRow.querySelector('.disc__body').append(picker);
    rows.append(locRow);

    rows.append(toggleRow('Your name', disclosure.includeName, user.name,
      (v) => { disclosure.includeName = v; render(); }));
    rows.append(toggleRow('Your phone number', disclosure.includePhone, user.phone,
      (v) => { disclosure.includePhone = v; render(); }));
  };
  render();

  const audit = () => auditDraftAgainstDisclosure({ ...draft, disclosure }, user);

  const actions = el('div', { class: 'btn-row', style: { marginTop: '20px' } });
  for (const [kind, label] of [['copy', 'Copy'], ['print', 'PDF'], ['email', 'Email'], ['whatsapp', 'WhatsApp']]) {
    actions.append(el('button', {
      class: `btn${kind === 'print' ? ' btn--primary' : ''}`, type: 'button', text: label,
      onclick: () => {
        const a = audit();
        if (!a.ok) {
          alert(`Not exporting: ${a.problems.join('; ')}`);
          return;
        }
        /* Approval is the one act that unlocks export. §16 invariant */
        onApprove?.({ ...disclosure });
        const prepared = prepare_external_action({ ...draft, disclosure }, disclosure, { approved: true, live: false });
        onExport?.({ kind, draft: { ...draft, disclosure }, prepared, rendered: render_export(draft, kind === 'print' ? 'print' : 'text') });
      },
    }));
  }

  wrap.append(
    el('h2', { class: 'day__id', style: { font: 'var(--title)' }, text: 'Here’s exactly what goes out' }),
    rows,
    el('article', { class: 'card', style: { marginTop: '16px' } },
      el('p', { class: 'card__label', text: 'GOES TO' }),
      el('p', { class: 'tt__row', text: `${draft.recipient.office}, ${draft.recipient.body}` }),
      el('p', { class: 'tt__row', text: draft.recipient.address }),
      el('p', { class: 'tt__checked', text: `▣ verified ${fmtDate(draft.verified_at)}` }),
    ),
    /* Mandatory, non-dismissible. We do not promise anonymity, privilege,
       protection or a reply. Law 9. */
    el('p', { class: 'disc__honesty',
      text: 'Wazi can’t promise you’ll get a reply, and can’t keep you anonymous once you send this.' }),
    Ribbon('simulated'),
    actions,
    el('button', { class: 'btn btn--ghost', type: 'button', style: { marginTop: '12px', width: '100%' },
      text: '← Back to the draft', onclick: () => onBack?.() }),
  );

  return { el: wrap, get disclosure() { return { ...disclosure }; } };
}

function labelFor(precision, payload) {
  if (precision === 'exact') return `${payload.entity.admin2 ?? ''}, ${payload.entity.admin1}`.replace(/^, /, '');
  if (precision === 'approx') return `near ${payload.entity.admin2 ?? payload.entity.admin1}, ±2 km`;
  return `${payload.entity.admin1} only`;
}

function inRow(title, detail, onView, note) {
  return el('div', { class: 'disc__row' },
    el('span', { class: 'disc__mark disc__mark--in', 'aria-hidden': 'true', text: '✓' }),
    el('div', { class: 'disc__body' },
      el('span', { class: 'tt__row', text: title }),
      el('span', { class: 'tt__checked', text: detail }),
      note ? el('span', { class: 'tt__checked', text: note }) : null,
      onView ? el('button', { class: 'chip-sm', type: 'button', text: 'View', onclick: onView }) : null,
    ),
    el('span', { class: 'sr-only', text: 'included' }));
}

function outRow(title, detail) {
  return el('div', { class: 'disc__row' },
    el('span', { class: 'disc__mark disc__mark--out', 'aria-hidden': 'true', text: '✕' }),
    el('div', { class: 'disc__body' },
      el('span', { class: 'tt__row', text: title }),
      el('span', { class: 'tt__checked', text: detail }),
    ),
    el('span', { class: 'sr-only', text: 'not included' }));
}

function toggleRow(title, on, value, onToggle) {
  const row = on ? inRow(title, value || '(not set)') : outRow(title, value ? 'Not included' : '(not set)');
  row.querySelector('.disc__body').append(el('button', {
    class: 'chip-sm', type: 'button', text: on ? 'Remove' : 'Include',
    disabled: !value || undefined,
    onclick: () => onToggle(!on),
  }));
  return row;
}

function preview(title, text) {
  import('./sheet.js').then(({ openSheet }) => {
    openSheet(title, (body) => body.append(el('pre', {
      style: { whiteSpace: 'pre-wrap', font: 'var(--bodysm)' }, text,
    })));
  });
}
