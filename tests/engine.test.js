import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVIDENCE_STATES,
  audio_state_machine,
  build_civic_draft,
  challenge_finding,
  handle_permission_denial,
  handle_tool_error,
  prepare_external_action,
  resolve_civic_entity,
  resolve_jurisdiction,
  verify_claim,
  verify_contact_route
} from '../src/engine.js';

test('unsupported factual claim is blocked when no entity matches', () => {
  const result = verify_claim({ claim: 'Unknown project completed', observation: 'site empty', entity: null });
  assert.equal(result.unsupportedClaimBlocked, true);
  assert.equal(result.evidenceState, EVIDENCE_STATES.UNKNOWN);
});

test('stale source metadata is surfaced', () => {
  const entity = resolve_civic_entity({ projectId: 'NCC-HEALTH-017' }).matched;
  const result = verify_claim({ claim: 'Completed', observation: 'looks incomplete', entity });
  assert.ok(Array.isArray(result.staleSourceIds));
});

test('wrong jurisdiction falls back with correction flag', () => {
  const result = resolve_jurisdiction({ text: 'Unknown location' });
  assert.equal(result.corrected, true);
});

test('project id mismatch is handled', () => {
  const result = resolve_civic_entity({ projectId: 'BAD-ID' });
  assert.equal(result.mismatch, true);
  assert.equal(result.matched, null);
});

test('contradictory evidence yields CONFLICTING', () => {
  const entity = resolve_civic_entity({ projectId: 'NCC-HEALTH-017' }).matched;
  const result = verify_claim({ claim: 'Completed', observation: 'site looks abandoned', entity });
  assert.equal(result.evidenceState, EVIDENCE_STATES.CONFLICTING);
});

test('missing evidence yields UNKNOWN', () => {
  const result = verify_claim({ claim: 'Any', observation: 'Any', entity: null });
  assert.equal(result.evidenceState, EVIDENCE_STATES.UNKNOWN);
});

test('Check Again can overturn initial finding', () => {
  const entity = resolve_civic_entity({ projectId: 'NCC-HEALTH-017' }).matched;
  const first = verify_claim({ claim: 'Completed', observation: 'site looks abandoned', entity });
  const second = challenge_finding(first);
  assert.equal(second.revised, true);
  assert.notEqual(second.evidenceState, first.evidenceState);
});

test('permission denial preserves path forward', () => {
  const result = handle_permission_denial();
  assert.equal(result.pathForward, 'text_mode');
});

test('audio interruption returns listening state', () => {
  assert.equal(audio_state_machine('interrupted'), 'listening');
});

test('tool failure does not hallucinate', () => {
  const result = handle_tool_error();
  assert.equal(result.evidenceState, EVIDENCE_STATES.UNKNOWN);
  assert.equal(result.toolStatus, 'failed');
});

test('only verified contacts are returned', () => {
  const entity = resolve_civic_entity({ projectId: 'NCC-HEALTH-017' }).matched;
  const routes = verify_contact_route(entity);
  assert.equal(routes.length, 1);
  assert.match(routes[0].route, /@nairobi\.go\.ke$/);
});

test('external action requires explicit approval', () => {
  const blocked = prepare_external_action({ approved: false, draft: {} });
  assert.equal(blocked.status, 'blocked');
});

test('draft respects disclosure settings and evidence state', () => {
  const draft = build_civic_draft({
    format: 'email',
    evidence: { evidenceState: EVIDENCE_STATES.CONFLICTING, provenance: [] },
    contactRoute: { route: 'healthcomplaints@nairobi.go.ke' },
    disclosure: { sharePreciseLocation: false, attachments: ['photo.jpg'] }
  });
  assert.match(draft.body, /Precise location withheld/);
  assert.equal(draft.attachmentList[0], 'photo.jpg');
});
