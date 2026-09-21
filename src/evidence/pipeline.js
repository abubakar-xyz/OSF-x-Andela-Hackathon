/**
 * Wazi — the verification pipeline.  DESIGN.md §8.4, §23.1.
 *
 * This is "the Worker" half of the two-brain split. It decides; the
 * conversational layer only narrates what this returns. It emits a mote
 * event per tool so the user watches the work happen instead of watching
 * a spinner (§10.4) — the latency is the trust argument, not dead time.
 */

import * as T from '../tools/index.js';
import { MOTE_LABEL } from '../tools/index.js';
import { buildClientStatutoryRoute, findCounty } from './nationalDirectory.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {object} opts
 * @param {(evt:{type:string,tool:string,label:string,status:string,reason?:string})=>void} opts.onMote
 * @param {number} opts.pace  ms of deliberate spacing between tools so the
 *                            motes are legible. 0 in tests.
 */
export async function runVerification({
  pack, utterance = '', image = null, fieldEvidence = [], coarseLocation = null,
  online = false, onMote = () => {}, pace = 0, signal,
} = {}) {
  const failures = [];
  const aborted = () => signal?.aborted;

  const step = async (tool, fn) => {
    const label = MOTE_LABEL[tool] ?? tool;
    onMote({ type: 'mote', tool, label, status: 'running' });
    if (pace) await wait(pace);
    const res = fn();
    if (res && res.ok === false) {
      failures.push({ tool, label, reason: res.reason });
      onMote({ type: 'mote', tool, label, status: 'failed', reason: res.reason });
    } else {
      onMote({ type: 'mote', tool, label, status: 'done' });
    }
    return res;
  };

  /* 1 — clues */
  let clues = [];
  if (image) {
    const r = await step('extract_visual_clues', () => T.extract_visual_clues(image));
    if (r.ok) clues = r.clues;
  }
  if (utterance) clues.push({ key: 'utterance', label: 'What you said', value: utterance, observed: 'observed' });
  if (aborted()) return { ok: false, reason: 'cancelled' };

  /* 2 — jurisdiction */
  const jur = await step('resolve_jurisdiction', () => T.resolve_jurisdiction(clues, pack, coarseLocation));
  if (aborted()) return { ok: false, reason: 'cancelled' };

  /* 3 — entity */
  const ent = await step('resolve_civic_entity', () =>
    T.resolve_civic_entity(clues, pack, jur.ok ? jur : {}));
  if (!ent.ok) {
    /* Law 4: no match is not disproof. */
    return {
      ok: false, kind: 'no_match', reason: ent.reason,
      say: "I couldn't find this in the records I have. That doesn't mean it isn't real — " +
           'it means it isn\'t where I can see. Want to ask them directly?',
      failures,
    };
  }
  if (aborted()) return { ok: false, reason: 'cancelled' };

  /* 4 — records */
  const search = await step('search_country_pack', () => T.search_country_pack(ent.chosen.id, pack));
  if (!search.ok) {
    return { ok: false, kind: 'no_records', reason: search.reason, failures,
             say: 'I found the project but no records I can quote. I won\'t guess at them.' };
  }
  if (aborted()) return { ok: false, reason: 'cancelled' };

  /* 5 — freshness. Offline this fails, and that failure is shown, not hidden. */
  await step('ground_current_information', () => T.ground_current_information(ent.chosen.name, { online }));

  /* 6 — compare */
  const field = fieldEvidence.length ? fieldEvidence : defaultFieldEvidence(image);
  const fieldSources = [image?.source, ...(fieldSourcesFor(fieldEvidence))].filter(Boolean);
  const verified = await step('verify_claim', () => T.verify_claim({
    claim: utterance || `Is ${ent.chosen.name} complete?`,
    entity: ent.chosen, records: search.records, sources: search.sources,
    fieldEvidence: field, fieldSources, failures,
  }));
  if (!verified.ok) {
    /* A schema failure is a tool failure, never an invitation to improvise. */
    return { ok: false, kind: 'invalid_payload', reason: verified.reason, failures,
             say: "Something went wrong assembling that and I won't show you a half-checked answer." };
  }

  const payload = { ...verified.payload, alternatives: ent.alternatives ?? [] };
  return { ok: true, payload, failures, ambiguous: ent.ambiguous };
}

/** The adversarial second pass. §20 */
export async function runChallenge({ payload, pack, online = false, onMote = () => {}, pace = 0 }) {
  const tool = 'challenge_finding';
  const label = MOTE_LABEL[tool];
  onMote({ type: 'mote', tool, label, status: 'running' });
  if (pace) await wait(pace);
  const res = T.challenge_finding(payload, pack, { online });
  onMote({ type: 'mote', tool, label, status: res.ok ? 'done' : 'failed', reason: res.reason });
  if (!res.ok) {
    return { ok: false, reason: res.reason,
             say: "I couldn't run the second check. The first answer stands, but it hasn't been challenged." };
  }
  return {
    ok: true, payload: res.payload, checks: res.checks, changed: res.changed,
    say: res.changed
      ? `I was wrong. ${res.payload.revision_note ?? 'The answer has changed.'}`
      : "I tried to prove myself wrong and couldn't. The answer stands.",
  };
}

/** §21.1 — routing runs only when the user asks to act. */
export async function runRouting({ payload, pack, onMote = () => {}, pace = 0 }) {
  const step = async (tool, fn) => {
    const label = MOTE_LABEL[tool] ?? tool;
    onMote({ type: 'mote', tool, label, status: 'running' });
    if (pace) await wait(pace);
    const r = fn();
    onMote({ type: 'mote', tool, label, status: r.ok ? 'done' : 'failed', reason: r.reason });
    return r;
  };
  const body = await step('find_responsible_body', () => T.find_responsible_body(payload.entity.id, pack));
  if (!body.ok) {
    const county = findCounty(payload.entity.admin1 || payload.entity.name || '');
    const fallbackRoute = buildClientStatutoryRoute(county);
    const opts = T.list_action_options(payload, fallbackRoute, pack);
    return { ok: true, route: fallbackRoute, sources: fallbackRoute.sources, options: opts.options };
  }
  const opts = T.list_action_options(payload, body.route, pack);
  return { ok: true, route: body.route, sources: body.sources, options: opts.options };
}

function fieldSourcesFor(fieldEvidence) {
  return fieldEvidence.map((f) => f.source).filter(Boolean);
}

function defaultFieldEvidence(image) {
  if (!image?.observations) return [];
  return image.observations.map((o) => ({
    label: o.label, value: o.value, source_id: o.source_id, as_of: o.as_of ?? null,
  }));
}
