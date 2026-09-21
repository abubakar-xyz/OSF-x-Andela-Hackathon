/**
 * The sixteen honesty tests.  DESIGN.md §31.
 *
 * These are not unit tests. They are the claims the product makes about
 * itself, written as assertions. If one of these fails, the pitch is
 * false — so they gate the build.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadFixturePack, signboardImage, PHOTO_SOURCE } from './helpers.mjs';
import { runVerification, runChallenge, runRouting } from '../src/evidence/pipeline.js';
import * as T from '../src/tools/index.js';
import { acceptEvidence, findOrphanFacts, isStale, hasFixture, makeFact } from '../src/evidence/types.js';
import { deriveState, downgradeForFailure, isWeaker, settledness } from '../src/evidence/ladder.js';
import { scanForbidden, FORBIDDEN } from '../src/evidence/safety.js';
import { build_civic_draft, auditDraftAgainstDisclosure, prepare_external_action, DEFAULT_DISCLOSURE } from '../src/tools/draft.js';
import { createMachine, edgesInto } from '../src/core/machine.js';

const pack = loadFixturePack();

const verifyFlagship = () =>
  runVerification({ pack, utterance: 'They said this health centre was finished', image: signboardImage() });

/* ── 01 ─────────────────────────────────────────────────────────────── */
test('01 an unsupported factual claim never reaches the interface', async () => {
  const bad = {
    claim: 'x', entity: { id: 'e', name: 'E' }, alternatives: [],
    record: [{ label: 'Contract sum', fact: makeFact(41200000, 'src-that-does-not-exist', { state: 'VERIFIED' }) }],
    field: [], agreements: [], differences: [], missing_fields: ['something'], limitations: [],
    sources: [pack.sourceById.get('src-ocp-2023')],
    evidence_state: 'VERIFIED', retrieved_at: new Date().toISOString(), failed_checks: [],
  };
  const res = acceptEvidence(bad);
  assert.equal(res.ok, false, 'a fact citing a source the payload does not carry must be rejected');
  assert.match(res.errors.join(' '), /unresolvable source_id/);
});

/* ── 02 ─────────────────────────────────────────────────────────────── */
test('02 a stale source is surfaced rather than quietly used', () => {
  const old = { ...pack.sourceById.get('src-ocp-2023'), retrieved_at: '2020-01-01' };
  assert.equal(isStale(old), true);
  assert.equal(isStale(pack.sourceById.get('src-ocp-2023'), Date.parse('2026-09-21')), false);
});

/* ── 03 ─────────────────────────────────────────────────────────────── */
test('03 the wrong jurisdiction is corrected, not silently accepted', () => {
  const clues = [{ key: 'project', label: 'Project', value: 'Bondo Sub-County Health Centre II', observed: 'observed' }];
  const right = T.resolve_civic_entity(clues, pack, { admin1: 'Siaya County', admin2: 'Bondo Sub-County' });
  assert.equal(right.ok, true);
  assert.equal(right.chosen.admin1, 'Siaya County');

  const nonsense = T.resolve_civic_entity(
    [{ key: 'project', label: 'Project', value: 'Something in another country entirely', observed: 'observed' }],
    pack, { admin1: 'Lagos State' });
  assert.equal(nonsense.ok, false, 'an entity from the wrong jurisdiction must not be returned');
});

/* ── 04 ─────────────────────────────────────────────────────────────── */
test('04 a project-ID mismatch is not merged into one answer', () => {
  const byRef = T.resolve_civic_entity(
    [{ key: 'reference', label: 'Reference', value: 'BSC-HC-I', observed: 'observed' }], pack, {});
  assert.equal(byRef.ok, true);
  assert.equal(byRef.chosen.reference, 'BSC-HC-I', 'the reference number decides, not the similar name');
  assert.notEqual(byRef.chosen.id, 'ent-bondo-hc2');
});

/* ── 05 ─────────────────────────────────────────────────────────────── */
test('05 contradictory evidence produces CONFLICTING and shows both sides', async () => {
  const v = await verifyFlagship();
  assert.equal(v.ok, true);
  assert.equal(v.payload.evidence_state, 'CONFLICTING');
  assert.ok(v.payload.differences.length >= 1, 'the difference must be stated');
  assert.ok(v.payload.record.length >= 1 && v.payload.field.length >= 1,
    'both the record and the field evidence must be present — we do not adjudicate');
});

/* ── 06 ─────────────────────────────────────────────────────────────── */
test('06 missing evidence produces UNKNOWN and is never reported as disproof', async () => {
  const empty = await runVerification({ pack, utterance: 'Is the Kisumu flyover finished?' });
  assert.equal(empty.ok, false);
  assert.equal(empty.kind, 'no_match');
  assert.match(empty.say, /doesn't mean it isn't real/i);
  assert.doesNotMatch(empty.say, /does not exist|never built|no such project/i);

  assert.equal(deriveState({ primary: 0, independent: 0, failures: 1 }), 'UNKNOWN');
});

/* ── 07 ─────────────────────────────────────────────────────────────── */
test('07 Check Again can overturn the first result, and can weaken a verdict', async () => {
  const v = await verifyFlagship();
  const c = await runChallenge({ payload: v.payload, pack });
  assert.equal(c.ok, true);
  assert.equal(c.changed, true, 'the adversarial pass must be able to change the answer');
  assert.notEqual(c.payload.evidence_state, v.payload.evidence_state);
  assert.equal(c.payload.previous_state, v.payload.evidence_state, 'the revision must be recorded, not hidden');
  assert.ok(c.payload.revision_note, 'a changed verdict must say why');
  assert.match(c.say, /I was wrong/i);

  /* And separately: it must be *capable* of producing a less settled
     verdict, or it is a rubber stamp. */
  assert.equal(downgradeForFailure('VERIFIED'), 'CORROBORATED');
  assert.equal(downgradeForFailure('REPORTED'), 'UNKNOWN');
  assert.equal(isWeaker('VERIFIED', 'UNKNOWN'), true);
  assert.equal(isWeaker('CONFLICTING', 'REPORTED'), false, 'REPORTED is more settled than CONFLICTING');
});

/* ── 08 ─────────────────────────────────────────────────────────────── */
test('08 permission denial preserves a complete path forward', () => {
  const m = createMachine();
  m.send('TAP');
  m.send('DENIED');
  assert.equal(m.state, 'text_only');
  assert.equal(m.can('SUBMIT'), true, 'text mode must reach the same engine');
  assert.equal(m.can('OPEN_CAMERA'), true);
  assert.equal(m.can('OPEN_CASES'), true);
});

/* ── 09 ─────────────────────────────────────────────────────────────── */
test('09 barge-in is always available while Wazi is speaking', () => {
  const m = createMachine();
  m.send('TAP'); m.send('GRANTED'); m.send('SPEECH'); m.send('TURN_END'); m.send('CHAT');
  assert.equal(m.state, 'speaking');
  assert.equal(m.can('BARGE_IN'), true);
  assert.equal(m.send('BARGE_IN').ok, true);
  assert.equal(m.state, 'hearing');
});

/* ── 10 ─────────────────────────────────────────────────────────────── */
test('10 a tool failure is reported, not filled in', async () => {
  const grounding = T.ground_current_information('anything', { online: false });
  assert.equal(grounding.ok, false);
  assert.match(grounding.reason, /offline/i);

  const v = await verifyFlagship();               /* runs offline by default */
  assert.ok(v.payload.failed_checks.length >= 1, 'the failed check must appear in the payload');
  assert.ok(v.payload.missing_fields.some((m) => /Not checked/.test(m)),
    'what could not be checked must be listed among the unknowns');
});

/* ── 11 ─────────────────────────────────────────────────────────────── */
test('11 an unverified contact route is never offered', () => {
  const unverified = pack.routes.find((r) => r.id === 'route-unverified-example');
  assert.ok(unverified, 'the fixture must contain an unverified route to exercise this');
  assert.equal(T.verify_contact_route(unverified, pack).ok, false);

  const water = T.find_responsible_body('ent-usenge-water', pack);
  assert.equal(water.ok, false, 'an entity whose only route is unverified must yield no route');
  assert.match(water.reason, /no verified contact route/i);

  const health = T.find_responsible_body('ent-bondo-hc2', pack);
  assert.equal(health.ok, true);
  assert.ok(health.route.verified_at, 'an offered route always carries its verification date');
});

/* ── 12 ─────────────────────────────────────────────────────────────── */
test('12 no external action is reachable without explicit approval', () => {
  /* Structural: disclosure is the only edge into export. */
  const into = edgesInto('export');
  assert.equal(into.length, 1);
  assert.equal(into[0].from, 'disclosure');
  assert.equal(into[0].event, 'APPROVE');

  /* Behavioural: the tool refuses too. */
  const refused = prepare_external_action({ recipient: { channel: 'email', address: 'x@y' } }, {}, { approved: false });
  assert.equal(refused.ok, false);

  /* And a simulated send is stamped as simulated. */
  const ok = prepare_external_action({ recipient: { channel: 'email', address: 'x@y' } }, {}, { approved: true });
  assert.equal(ok.simulated, true);
  assert.equal(ok.stamp, 'SIMULATED — NOT DELIVERED');
});

/* ── 13 ─────────────────────────────────────────────────────────────── */
test('13 the draft contains exactly what the disclosure settings allow', async () => {
  const v = await verifyFlagship();
  const c = await runChallenge({ payload: v.payload, pack });
  const r = await runRouting({ payload: c.payload, pack });
  const user = { name: 'Amina Otieno', phone: '+254700111222' };

  const closed = build_civic_draft({
    payload: c.payload, route: r.route, format: 'email',
    disclosure: { ...DEFAULT_DISCLOSURE }, user, caseId: 'WZ-TEST',
  });
  assert.equal(closed.ok, true);
  assert.ok(!closed.draft.body.includes(user.name), 'name is off by default and must be absent');
  assert.ok(!closed.draft.body.includes(user.phone), 'phone is off by default and must be absent');
  assert.equal(auditDraftAgainstDisclosure(closed.draft, user).ok, true);

  const opened = build_civic_draft({
    payload: c.payload, route: r.route, format: 'email',
    disclosure: { ...DEFAULT_DISCLOSURE, includeName: true }, user, caseId: 'WZ-TEST',
  });
  assert.ok(opened.draft.body.includes(user.name), 'opting in must actually include it');
  assert.ok(!opened.draft.body.includes(user.phone), 'opting into one thing must not include another');

  const noSources = build_civic_draft({
    payload: c.payload, route: r.route, format: 'email',
    disclosure: { ...DEFAULT_DISCLOSURE, includeSources: false }, user, caseId: 'WZ-TEST',
  });
  assert.equal(noSources.draft.refs.length, 0);
});

/* ── 14 ─────────────────────────────────────────────────────────────── */
test('14 forbidden language never appears in speech or in an artifact', async () => {
  for (const word of FORBIDDEN) {
    assert.ok(scanForbidden(`They ${word} the money`).length > 0, `"${word}" must be caught`);
  }
  /* A denial is the restrained phrasing §9.4 asks for, not an accusation. */
  assert.equal(scanForbidden("That's a difference worth an answer — it isn't proof of anything yet.").length, 0);
  assert.ok(scanForbidden('This is proof of theft.').length > 0);
  assert.ok(scanForbidden('I am 87% confident.').length > 0, 'percentages are banned outright');
  assert.ok(scanForbidden('The project is 60% complete.').length > 0);

  const v = await verifyFlagship();
  const c = await runChallenge({ payload: v.payload, pack });
  const r = await runRouting({ payload: c.payload, pack });
  for (const format of ['email', 'letter', 'whatsapp', 'atia', 'complaint']) {
    const d = build_civic_draft({ payload: c.payload, route: r.route, format,
      disclosure: DEFAULT_DISCLOSURE, user: {}, caseId: 'WZ-TEST' });
    assert.equal(d.ok, true, `${format} must build`);
    assert.equal(scanForbidden(d.draft.body).length, 0, `${format} must contain no forbidden language`);
  }
});

/* ── 15 ─────────────────────────────────────────────────────────────── */
test('15 no fact in a real payload is an orphan', async () => {
  const v = await verifyFlagship();
  assert.deepEqual(findOrphanFacts(v.payload), []);

  const c = await runChallenge({ payload: v.payload, pack });
  assert.deepEqual(findOrphanFacts(c.payload), [], 'the challenge pass must carry its new sources');

  const r = await runRouting({ payload: c.payload, pack });
  assert.deepEqual(findOrphanFacts({ ...r.route, sources: r.sources }), [],
    'every route fact, including the escalation address, must resolve');
});

/* ── 16 ─────────────────────────────────────────────────────────────── */
test('16 a fixture is labelled in the data, so the interface must label it', async () => {
  const v = await verifyFlagship();
  assert.equal(hasFixture(v.payload), true, 'the fixture pack must announce itself');
  assert.equal(pack.meta.is_fixture, true);
  assert.ok(pack.meta.fixture_notice, 'a fixture pack must carry a notice');
  for (const s of pack.sources) {
    assert.equal(s.is_fixture, true, `${s.id} is fixture data and must say so`);
  }

  const c = await runChallenge({ payload: v.payload, pack });
  const r = await runRouting({ payload: c.payload, pack });
  const d = build_civic_draft({ payload: c.payload, route: r.route, format: 'letter',
    disclosure: DEFAULT_DISCLOSURE, user: {}, caseId: 'WZ-TEST' });
  assert.equal(d.draft.contains_fixture, true);
  assert.match(d.draft.body, /DEMO FIXTURE/, 'the artifact itself must carry the label');
});
