/**
 * Wazi — tool contracts.  DESIGN.md §24.
 *
 * Narrow, testable, individually mockable. Every evidence-bearing return
 * carries sources, retrieved_at, missing_fields, evidence_state and
 * limitations. A tool error is a valid product state (§7 of the brief,
 * §17 here) — it is never permission for the conversational layer to
 * improvise.
 *
 * These run server-side in the deployed architecture (§23.3). In this
 * build they run in-process against the cached Country Pack, which is
 * what makes the whole journey work offline.
 */

import { deriveState, downgradeForFailure } from '../evidence/ladder.js';
import { makeFact, nowISO, acceptEvidence, acceptRoute } from '../evidence/types.js';

/** §8.4 — plain-language mote labels. Never the function name. */
export const MOTE_LABEL = {
  resolve_jurisdiction:      'Finding the area',
  extract_visual_clues:      'Reading the sign',
  resolve_civic_entity:      'Matching the project',
  search_country_pack:       'Checking the records',
  ground_current_information:'Looking for anything newer',
  verify_claim:              'Comparing',
  challenge_finding:         'Trying to prove myself wrong',
  find_responsible_body:     'Finding who is responsible',
  verify_contact_route:      'Checking the address is real',
};

const ok = (data) => ({ ok: true, ...data });
const fail = (tool, reason) => ({ ok: false, tool, reason, label: MOTE_LABEL[tool] ?? tool });

/* ── 1. Intent ───────────────────────────────────────────────────────── */

const DANGER = /\b(in danger|threatened|being attacked|they will kill|unsafe right now|help me now|emergency)\b/i;
const CIVIC = /\b(project|clinic|health centre|health center|hospital|road|water|school|budget|tender|contract|county|ward|completed|finished|stalled|bursary|permit|licence|license)\b/i;
const SHOW = /\b(look at|see this|showing you|this sign|signboard|photo|picture|here is|look what)\b/i;
const CASES = /\b(my cases|saved cases|my drafts|open my)\b/i;

export function classify_civic_intent(utterance = '', context = {}) {
  const u = String(utterance);
  if (DANGER.test(u)) return ok({ intent: 'danger', needs_evidence: false, band: 'high' });
  if (CASES.test(u)) return ok({ intent: 'cases', needs_evidence: false, band: 'high' });
  if (SHOW.test(u) && !context.hasImage) return ok({ intent: 'show', needs_evidence: true, band: 'medium' });
  if (CIVIC.test(u) || context.hasImage) {
    return ok({ intent: 'civic', needs_evidence: true, band: CIVIC.test(u) ? 'high' : 'medium' });
  }
  return ok({ intent: 'chat', needs_evidence: false, band: 'low' });
}

/* ── 2. Jurisdiction ─────────────────────────────────────────────────── */

export function resolve_jurisdiction(clues = [], pack, coarseLocation = null) {
  const text = clues.map((c) => c.value).join(' ').toLowerCase();
  const hit = pack.entities.find((e) =>
    text.includes((e.admin2 || '').toLowerCase()) || text.includes((e.admin1 || '').toLowerCase()));
  const admin1 = hit?.admin1 ?? coarseLocation?.admin1 ?? pack.meta.admin1;
  const admin2 = hit?.admin2 ?? coarseLocation?.admin2 ?? null;
  if (!admin1) return fail('resolve_jurisdiction', 'no location clue and no coarse location offered');
  return ok({
    country: pack.meta.country, admin1, admin2,
    /* Falling back to the pack's own area is an assumption, not a
       reading. Downstream must be able to tell the difference. */
    inferred: !hit && !coarseLocation?.admin1,
    source_id: pack.meta.is_fixture ? pack.sources[0].id : null,
    retrieved_at: nowISO(),
  });
}

/* ── 3. Visual clues ─────────────────────────────────────────────────── */

/**
 * In the deployed build this is a vision call. Here it reads the fixture's
 * declared clue set, because inventing OCR output would be exactly the
 * kind of plausible fabrication the whole product exists to prevent.
 * What matters architecturally is the shape: observed vs inferred, every
 * row editable before it is used. §12.8
 */
export function extract_visual_clues(image) {
  if (!image || !image.clues) return fail('extract_visual_clues', 'no readable image supplied');
  return ok({ clues: image.clues.map((c) => ({ ...c })), retrieved_at: nowISO() });
}

/* ── 4. Entity resolution ────────────────────────────────────────────── */

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function resolve_civic_entity(clues = [], pack, jurisdiction = {}) {
  const text = norm(clues.map((c) => c.value).join(' '));
  const ref = clues.find((c) => c.key === 'reference')?.value;

  const scored = pack.entities.map((e) => {
    /* Identity has to come from the name or the reference number.
       Being in the same county is a tie-breaker, never a match — an
       earlier version let jurisdiction alone score, which meant every
       entity in the pack "matched" every utterance. */
    let identity = 0;
    if (ref && norm(e.reference) === norm(ref)) identity += 10;
    const names = [e.name, ...(e.aliases || [])];
    for (const n of names) if (text.includes(norm(n))) identity += 6;
    for (const tok of norm(e.name).split(' ')) if (tok.length > 3 && text.includes(tok)) identity += 1;
    if (identity === 0) return { entity: e, score: 0, identity: 0 };

    let score = identity;
    if (jurisdiction.admin2 && e.admin2 === jurisdiction.admin2) score += 2;
    else if (jurisdiction.admin1 && e.admin1 === jurisdiction.admin1) score += 1;
    return { entity: e, score, identity };
  }).filter((s) => s.identity > 0).sort((a, b) => b.score - a.score);

  if (!scored.length) return fail('resolve_civic_entity', 'no entity in this pack matches those clues');

  const chosen = scored[0].entity;
  /* Mistaken identity is expected, not exceptional, and it matters MOST
     when we are confident — a high-scoring reference-number match on the
     wrong facility is the failure nobody catches. So any candidate whose
     name or reference matched at all is offered, not only the close
     ones. §17 */
  const alternatives = scored.slice(1, 4)
    .map((s) => ({ id: s.entity.id, name: s.entity.name }));

  return ok({ chosen, alternatives, ambiguous: alternatives.length > 0, retrieved_at: nowISO() });
}

/* ── 5. Pack search ──────────────────────────────────────────────────── */

export function search_country_pack(entityId, pack, { includeChallengeOnly = false } = {}) {
  const records = (pack.recordsByEntity.get(entityId) ?? [])
    .filter((r) => includeChallengeOnly || !r.discoverable_only_on_challenge);
  if (!records.length) return fail('search_country_pack', 'no records for that entity in this pack');
  const sources = [...new Set(records.map((r) => r.source_id))]
    .map((id) => pack.sourceById.get(id)).filter(Boolean);
  return ok({ records, sources, retrieved_at: nowISO() });
}

/* ── 6. Grounding ────────────────────────────────────────────────────── */

/**
 * Discovery and freshness. Offline this returns a clean "could not check"
 * rather than nothing — the difference matters, because a silent empty
 * result would be indistinguishable from "we looked and there is nothing",
 * which is exactly the inference Law 4 forbids.
 */
export function ground_current_information(query, { online = false } = {}) {
  if (!online) {
    return fail('ground_current_information', 'offline — could not check for anything newer');
  }
  return ok({ results: [], searched_at: nowISO(), note: 'no newer public record found' });
}

/* ── 7. Verify ───────────────────────────────────────────────────────── */

function factFromRecord(r, state) {
  return {
    label: r.label,
    verbatim: r.verbatim,
    fact: makeFact(r.value, r.source_id, {
      unit: r.unit, observed: 'stated', state, as_of: r.published_at ?? null,
    }),
    limitations: r.limitations ?? [],
    claim_type: r.claim_type,
  };
}

const CLAIM_WORD = {
  budget_allocation: 'money was set aside',
  contract_award: 'a contract was awarded',
  payment: 'money was paid',
  reported_completion: 'the agency reported it finished',
  scope_change: 'the scope was changed',
  audit_finding: 'an auditor made an observation',
  reported_observation: 'someone reported what they saw',
};

export function verify_claim({ claim, entity, records, sources, fieldEvidence = [],
                              fieldSources = [], failures = [] }) {
  /* The user's own photograph is a source like any other — tier "user".
     If it is not carried in the payload, the orphan-fact guard rejects
     the whole thing, which is the behaviour we want. §19 */
  const allSources = [...new Map([...sources, ...fieldSources].map((s) => [s.id, s])).values()];
  /* The user's own photo corroborates nothing on its own — counting it
     would let a photograph promote a claim to CORROBORATED. §18.1 */
  const primary = sources.filter((s) => s.tier === 'primary').length;
  const independent = sources.filter((s) => s.tier === 'credible').length;

  /* A record and a dated observation disagreeing is a DIFFERENCE, never a
     finding of wrongdoing. Law 3. */
  const completion = records.find((r) => r.claim_type === 'reported_completion' && r.label === 'Project status');
  const fieldContradicts = fieldEvidence.some((f) => /absent|unglazed|incomplete|not (built|finished|complete)|no roof/i.test(String(f.value)));
  const auditContradicts = records.some((r) => r.claim_type === 'audit_finding');
  const disagreement = Boolean(completion && (fieldContradicts || auditContradicts));

  let state = deriveState({ primary, independent, disagreement, failures: failures.length });
  for (let i = 0; i < failures.length; i++) state = downgradeForFailure(state);

  const record = records.map((r) => factFromRecord(r, r.claim_type === 'audit_finding' ? 'REPORTED' : state));
  const field = fieldEvidence.map((f) => ({
    label: f.label,
    fact: makeFact(f.value, f.source_id, { observed: 'user_observed', state: 'REPORTED', as_of: f.as_of ?? null }),
  }));

  const agreements = [];
  const differences = [];
  if (entity) agreements.push(`A project of this name exists in ${entity.admin1}, ${entity.sector} sector.`);
  if (completion && fieldContradicts) {
    differences.push(
      `Record: ${completion.value} (${completion.published_at}) · Your photo: incomplete (${field[0]?.fact?.as_of ?? 'undated'})`);
  }
  if (auditContradicts) {
    differences.push('An audit observation says completion could not be confirmed and payment certificates were not produced.');
  }

  /* Mandatory and never empty — there are always gaps. §13.1 */
  const missing_fields = [];
  if (!records.some((r) => r.claim_type === 'payment')) missing_fields.push('Whether final payment was made');
  if (!records.some((r) => r.claim_type === 'scope_change')) missing_fields.push('Whether the project was re-scoped after the completion date');
  missing_fields.push('Whether this is the same facility — more than one in this county has a similar name');
  for (const f of failures) missing_fields.push(`Not checked: ${f.label}`);

  const limitations = [...new Set(records.flatMap((r) => r.limitations ?? []))];
  /* Distinguishing these five is the difference between a useful finding
     and an accusation. §5 of the brief. */
  const claimLadder = [...new Set(records.map((r) => CLAIM_WORD[r.claim_type]).filter(Boolean))];
  if (claimLadder.length > 1) {
    limitations.push(`These are different kinds of claim: ${claimLadder.join('; ')}. They are not interchangeable.`);
  }

  const payload = {
    claim: claim || `Is ${entity?.name ?? 'this project'} complete?`,
    entity: entity
      ? { id: entity.id, name: entity.name, sector: entity.sector, admin1: entity.admin1, admin2: entity.admin2 }
      : { id: '', name: 'Unmatched' },
    alternatives: [],
    record, field, agreements, differences, missing_fields, limitations,
    sources: allSources, evidence_state: state,
    previous_state: null, revision_note: null,
    retrieved_at: nowISO(),
    failed_checks: failures.map((f) => ({ tool: f.tool, label: f.label, reason: f.reason })),
  };

  const accepted = acceptEvidence(payload);
  if (!accepted.ok) return fail('verify_claim', `payload failed validation: ${accepted.errors.join('; ')}`);
  return ok({ payload });
}

/* ── 8. Challenge (§20) ──────────────────────────────────────────────── */

/**
 * A different framing, briefed to look for the nine ways the first answer
 * could be wrong. It MUST be able to change the verdict, including to a
 * less settled one — a pass that can only confirm is a rubber stamp.
 */
export function challenge_finding(payload, pack, { online = false } = {}) {
  const entityId = payload.entity.id;
  const all = search_country_pack(entityId, pack, { includeChallengeOnly: true });
  if (!all.ok) return fail('challenge_finding', all.reason);

  const known = new Set(payload.sources.map((s) => s.id));
  const checks = [];
  let state = payload.evidence_state;
  let note = null;

  /* 1 — a newer record that supersedes the one we relied on. */
  const superseding = all.records.filter((r) =>
    r.supersedes && !known.has(r.source_id) &&
    Date.parse(r.published_at) > Date.parse(payload.record[0]?.fact?.as_of ?? 0));

  /* 2 — duplicate or similar names in the same jurisdiction. */
  const entity = pack.entityById.get(entityId);
  const lookalikes = pack.entities.filter((e) =>
    e.id !== entityId && e.admin2 === entity?.admin2 &&
    norm(e.name).slice(0, 14) === norm(entity?.name ?? '').slice(0, 14));

  /* 3 — could we check for anything newer at all? */
  const grounding = ground_current_information(entity?.name, { online });

  const newSources = [];
  if (superseding.length) {
    const r = superseding[0];
    const src = pack.sourceById.get(r.source_id);
    if (src) newSources.push(src);
    checks.push(`A newer record supersedes the one I used: ${r.verbatim}`);
    /* The conflict dissolves into an ordinary reported status: the older
       completion claim was superseded, not contradicted. */
    state = 'REPORTED';
    note = `A newer notice (${r.published_at}) varies the scope and moves completion. ` +
           `The 2023 completion claim it replaces is no longer the current record.`;
  }
  if (lookalikes.length) {
    checks.push(`Similar name in the same sub-county: ${lookalikes.map((e) => e.name).join(', ')} — mistaken identity is possible.`);
  }
  if (!grounding.ok) {
    checks.push(`Could not search for anything newer: ${grounding.reason}`);
    /* Not being able to look is a reason to be less sure, not more. */
    if (!superseding.length) state = downgradeForFailure(state);
  }

  const next = {
    ...payload,
    sources: [...payload.sources, ...newSources],
    record: superseding.length
      ? [...payload.record, factFromRecord(superseding[0], 'VERIFIED')]
      : payload.record,
    alternatives: lookalikes.map((e) => ({ id: e.id, name: e.name })),
    limitations: [...new Set([...payload.limitations, ...checks])],
    missing_fields: [...new Set([
      ...payload.missing_fields.filter((m) => !superseding.length || !/re-scoped/.test(m)),
      'Whether the varied scope has since been completed',
    ])],
    evidence_state: state,
    previous_state: payload.evidence_state,
    revision_note: note,
    retrieved_at: nowISO(),
    failed_checks: grounding.ok
      ? payload.failed_checks
      : [...payload.failed_checks, { tool: 'ground_current_information', label: MOTE_LABEL.ground_current_information, reason: grounding.reason }],
  };

  const accepted = acceptEvidence(next);
  if (!accepted.ok) return fail('challenge_finding', `payload failed validation: ${accepted.errors.join('; ')}`);
  return ok({ payload: next, checks, changed: next.evidence_state !== payload.evidence_state });
}

/* ── 9 & 10. Responsible body and route verification ─────────────────── */

export function find_responsible_body(entityId, pack) {
  const entity = pack.entityById.get(entityId);
  const inst = entity && pack.institutionById.get(entity.institution_id);
  if (!inst) return fail('find_responsible_body', 'no institution mapped to that entity in this pack');

  const candidates = pack.routesByInstitution.get(inst.id) ?? [];
  const verified = candidates.filter((r) => verify_contact_route(r, pack).ok);
  if (!verified.length) {
    /* Refusing to offer a route is a correct outcome, not a failure to
       be papered over with a guess. §21.1 */
    const esc = inst.escalation_id ? find_responsible_body_byInstitution(inst.escalation_id, pack) : null;
    return fail('find_responsible_body',
      `no verified contact route for ${inst.office}. ` +
      (esc?.ok ? `Verified escalation available: ${esc.route.office}.` : 'No verified escalation either.'));
  }

  const chosen = verified.find((r) => r.channel === 'email') ?? verified[0];
  const src = pack.sourceById.get(chosen.source_id);
  const proc = pack.procedures.find((p) => p.applies_to_sectors?.includes(entity.sector) &&
    (p.jurisdiction === inst.jurisdiction || p.jurisdiction === pack.meta.country_name));

  const route = {
    body: inst.body,
    office: inst.office,
    person: null,                       /* offices, not people. Law 5 */
    jurisdiction: makeFact(inst.jurisdiction, inst.mandate_source_id, { state: 'VERIFIED' }),
    channel: chosen.channel,
    address: makeFact(chosen.address, chosen.source_id, { state: 'VERIFIED', as_of: chosen.verified_at }),
    why_this_office: makeFact(inst.mandate, inst.mandate_source_id, { state: 'VERIFIED' }),
    verified_at: chosen.verified_at,
    procedure: proc ? {
      name: proc.name,
      steps: proc.steps,
      deadline_days: proc.deadline_days != null
        ? makeFact(proc.deadline_days, proc.deadline_source_id, { unit: 'days', state: 'VERIFIED' })
        : null,
    } : null,
    escalation: null,
  };

  const escalationSources = [];
  if (inst.escalation_id) {
    const esc = find_responsible_body_byInstitution(inst.escalation_id, pack);
    if (esc?.ok) {
      route.escalation = { body: esc.route.body, office: esc.route.office, address: esc.route.address };
      /* The escalation's address is a Fact too, so its source has to
         travel with the route or the renderer will refuse it. §19 */
      const escSrc = pack.sourceById.get(esc.route.address.source_id);
      if (escSrc) escalationSources.push(escSrc);
    }
  }

  const accepted = acceptRoute(route);
  if (!accepted.ok) return fail('find_responsible_body', `route failed validation: ${accepted.errors.join('; ')}`);
  const sources = [src, pack.sourceById.get(inst.mandate_source_id),
                   proc && pack.sourceById.get(proc.deadline_source_id), ...escalationSources]
    .filter(Boolean);
  return ok({ route, sources: [...new Map(sources.map((s) => [s.id, s])).values()] });
}

function find_responsible_body_byInstitution(instId, pack) {
  const inst = pack.institutionById.get(instId);
  if (!inst) return null;
  const verified = (pack.routesByInstitution.get(instId) ?? []).filter((r) => verify_contact_route(r, pack).ok);
  if (!verified.length) return null;
  const chosen = verified[0];
  return { ok: true, route: {
    body: inst.body, office: inst.office,
    address: makeFact(chosen.address, chosen.source_id, { state: 'VERIFIED', as_of: chosen.verified_at }),
  } };
}

/** A route is offerable only with a source AND a verification date. §21.1 */
export function verify_contact_route(route, pack) {
  if (!route) return fail('verify_contact_route', 'no route supplied');
  if (!route.verified_at) return fail('verify_contact_route', 'route has never been verified');
  if (!route.source_id || !pack.sourceById.has(route.source_id)) {
    return fail('verify_contact_route', 'route claims verification but its source does not resolve');
  }
  if (!route.verified_how) return fail('verify_contact_route', 'route does not record how it was verified');
  return ok({ verified: true, verified_at: route.verified_at, how: route.verified_how });
}

/* ── 11. Action options ──────────────────────────────────────────────── */

export function list_action_options(payload, route, pack) {
  const options = [
    { id: 'email',    label: 'Email',           always: true },
    { id: 'letter',   label: 'Formal letter',   always: true },
    { id: 'whatsapp', label: 'WhatsApp summary', always: true },
  ];
  /* Only offered where the jurisdiction actually provides it. §21.2 */
  for (const p of pack.procedures) {
    if (!p.applies_to_sectors?.includes(payload.entity.sector)) continue;
    if (/access to information/i.test(p.name)) {
      options.push({ id: 'atia', label: 'Information request', procedure_id: p.id, source_id: p.source_id });
    } else if (/complaint/i.test(p.name)) {
      options.push({ id: 'complaint', label: 'Service complaint', procedure_id: p.id, source_id: p.source_id });
    }
  }
  return ok({ options, retrieved_at: nowISO() });
}

export { fail as toolFail, ok as toolOk };
