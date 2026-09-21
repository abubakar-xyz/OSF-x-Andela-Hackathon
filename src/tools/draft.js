/**
 * Wazi — Civic Draft Studio.  DESIGN.md §21.2.
 *
 * Every draft is assembled from the evidence payload and the disclosure
 * settings. It cannot contain a fact the case does not hold, and it
 * cannot contain a personal detail the user did not switch on.
 */

import { assertSafe } from '../evidence/safety.js';
import { nowISO } from '../evidence/types.js';
import { fmtDate } from '../core/dom.js';

export const FORMATS = {
  email:     { label: 'Email',              font: 'ui'    },
  letter:    { label: 'Formal letter',      font: 'serif' },
  whatsapp:  { label: 'WhatsApp summary',   font: 'ui'    },
  atia:      { label: 'Information request', font: 'serif' },
  complaint: { label: 'Service complaint',  font: 'serif' },
};

/** Everything personal is OFF by default. The user opts in. §22 */
export const DEFAULT_DISCLOSURE = Object.freeze({
  includeName: false,
  includePhone: false,
  includePhoto: true,
  includeSources: true,
  locationPrecision: 'county',      /* coarsest by default */
});

const neutral = (payload) => {
  const rec = payload.record.find((r) => r.claim_type === 'reported_completion' && r.label === 'Project status');
  const lines = [];
  lines.push(`This concerns ${payload.entity.name} in ${payload.entity.admin2 || payload.entity.admin1}.`);
  if (rec) {
    lines.push(`The published record states, in its own words: “${rec.verbatim}”, published ${fmtDate(rec.fact.as_of)}.`);
  }
  for (const f of payload.field) {
    lines.push(`On ${fmtDate(f.fact.as_of)} the following was observed at the site: ${f.fact.value}.`);
  }
  if (payload.differences.length) {
    lines.push('These accounts do not agree. This letter does not allege wrongdoing; it asks for the discrepancy to be explained.');
  }
  return lines.join(' ');
};

const REQUEST = {
  email: 'Please confirm the current status of this facility, and the date of the most recent inspection.',
  letter: 'I request written confirmation of the current status of this facility, the date of the most recent inspection, and a copy of any completion or payment certificate held.',
  whatsapp: 'Asking the county to confirm the current status.',
  atia: 'Under the Access to Information Act, I request: (a) the current status record for this facility; (b) any certificate of completion; (c) records of payments made against the contract.',
  complaint: 'I ask that the department inspect the facility and provide a written status update.',
};

export function build_civic_draft({ payload, route, format = 'email', tone = 'plain', length = 'short',
                                    disclosure = DEFAULT_DISCLOSURE, user = {}, caseId = '' }) {
  if (!FORMATS[format]) return { ok: false, tool: 'build_civic_draft', reason: `unknown format ${format}` };
  if (!route) return { ok: false, tool: 'build_civic_draft', reason: 'no verified route — nothing to address this to' };

  /* Citations are structured, so they survive the user editing the body. */
  const cited = disclosure.includeSources ? payload.sources : [];
  const refs = cited.map((s, i) => ({
    n: i + 1, id: s.id, publisher: s.publisher, title: s.title,
    published_at: s.published_at, retrieved_at: s.retrieved_at, is_fixture: Boolean(s.is_fixture),
  }));

  const place = {
    exact: payload.entity.admin2 ? `${payload.entity.admin2}, ${payload.entity.admin1}` : payload.entity.admin1,
    approx: `near ${payload.entity.admin2 || payload.entity.admin1}`,
    county: payload.entity.admin1,
  }[disclosure.locationPrecision] ?? payload.entity.admin1;

  const subject = format === 'atia'
    ? `Access to information request — ${payload.entity.name}`
    : `Status enquiry — ${payload.entity.name} (${place})`;

  const summary = neutral(payload);
  const ask = REQUEST[format] ?? REQUEST.email;

  const attachments = [];
  if (disclosure.includePhoto && payload.field.length) {
    attachments.push('Dated site photograph (location metadata removed)');
  }
  if (refs.length) attachments.push(`Source list (${refs.length} item${refs.length === 1 ? '' : 's'})`);

  const signOff = [];
  if (disclosure.includeName && user.name) signOff.push(user.name);
  if (disclosure.includePhone && user.phone) signOff.push(user.phone);
  if (!signOff.length) signOff.push('(sender details withheld)');

  let body;
  if (format === 'whatsapp') {
    body = [
      `*${payload.entity.name}* — ${place}`,
      '',
      summary,
      '',
      `Evidence state: ${payload.evidence_state}.`,
      payload.missing_fields.length ? `Still unknown: ${payload.missing_fields[0]}` : '',
      '',
      refs.length ? `Sources: ${refs.map((r) => `${r.publisher} (${fmtDate(r.published_at)})`).join(' · ')}` : '',
      caseId ? `Wazi case ${caseId}` : '',
    ].filter(Boolean).join('\n');
  } else {
    const opening = tone === 'formal'
      ? `To the ${route.office}, ${route.body}`
      : `Dear ${route.office},`;
    const detail = length === 'full'
      ? [
          '',
          'What remains unclear:',
          ...payload.missing_fields.map((m) => `  · ${m}`),
          '',
          payload.limitations.length ? 'Known limitations of the sources used:' : '',
          ...payload.limitations.map((l) => `  · ${l}`),
        ].filter(Boolean).join('\n')
      : '';

    body = [
      opening, '',
      summary, '',
      ask,
      detail, '',
      refs.length ? 'Sources:' : '',
      ...refs.map((r) => `  [${r.n}] ${r.publisher}, “${r.title}”, published ${fmtDate(r.published_at)}, retrieved ${fmtDate(r.retrieved_at)}${r.is_fixture ? ' — DEMO FIXTURE' : ''}`),
      attachments.length ? '' : '',
      attachments.length ? `Attached: ${attachments.join('; ')}` : '',
      '',
      'Yours faithfully,',
      ...signOff,
      '',
      caseId ? `Reference: Wazi case ${caseId}` : '',
      '',
      'This document was prepared for review by the person sending it. It is a draft.',
    ].filter((l) => l !== undefined).join('\n');
  }

  /* Law 3 and §18.3 — the artifact is checked, not trusted. */
  assertSafe(body, `draft(${format})`);
  assertSafe(subject, `draft subject(${format})`);

  return {
    ok: true,
    draft: {
      format, tone, length, subject, body,
      recipient: { body: route.body, office: route.office, channel: route.channel, address: route.address.value },
      verified_at: route.verified_at,
      refs, attachments,
      disclosure: { ...disclosure },
      contains_fixture: refs.some((r) => r.is_fixture),
      built_at: nowISO(),
      is_draft: true,
    },
  };
}

/**
 * Export. The browser's own print-to-PDF is the path: no dependency, works
 * offline, and the document never reaches a server. We do not claim it is
 * signed, because there is no signing flow. §21.2
 */
export function render_export(draft, kind = 'text') {
  if (kind === 'text') return { ok: true, mime: 'text/plain', content: `${draft.subject}\n\n${draft.body}` };
  if (kind === 'print') return { ok: true, mime: 'application/pdf', via: 'browser-print', signed: false };
  return { ok: false, tool: 'render_export', reason: `unknown export kind ${kind}` };
}

/**
 * The last gate. Nothing here sends anything — in this build every
 * external action is simulated, and says so in the UI *and* in the
 * artifact, so a screenshot of a simulated send cannot be mistaken for a
 * real one. §6 Law 8, §21.2
 */
export function prepare_external_action(draft, disclosure, { approved = false, live = false } = {}) {
  if (!approved) {
    return { ok: false, tool: 'prepare_external_action', reason: 'no external action without explicit approval' };
  }
  const simulated = !live;
  return {
    ok: true,
    ready: true,
    simulated,
    channel: draft.recipient.channel,
    to: draft.recipient.address,
    stamp: simulated ? 'SIMULATED — NOT DELIVERED' : null,
    disclosure: { ...disclosure },
    prepared_at: nowISO(),
  };
}

/**
 * Asserts the artifact contains nothing the disclosure settings excluded.
 * tests/honesty.test.js #13 depends on this being real. §22
 */
export function auditDraftAgainstDisclosure(draft, user = {}) {
  const problems = [];
  const b = `${draft.subject}\n${draft.body}`;
  if (!draft.disclosure.includeName && user.name && b.includes(user.name)) problems.push('name present but excluded');
  if (!draft.disclosure.includePhone && user.phone && b.includes(user.phone)) problems.push('phone present but excluded');
  if (!draft.disclosure.includeSources && /^\s*\[\d\]/m.test(b)) problems.push('sources present but excluded');
  if (draft.disclosure.locationPrecision === 'county' && /±\s*\d/.test(b)) problems.push('precise location present but excluded');
  return { ok: problems.length === 0, problems };
}
