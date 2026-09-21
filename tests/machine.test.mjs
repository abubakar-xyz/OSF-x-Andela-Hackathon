/** State machine invariants. DESIGN.md §16. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMachine, edgesInto, STATES, TRANSITIONS, WORLD_FOR, APERTURE_FOR } from '../src/core/machine.js';
import { STATES as APERTURE_STATES } from '../src/character/aperture.js';

const withEvidence = { evidence: { sources: [{ id: 's1' }] } };

test('export has exactly one edge, and it is the approval', () => {
  const into = edgesInto('export');
  assert.deepEqual(into, [{ from: 'disclosure', event: 'APPROVE' }]);
});

test('the only way forward into disclosure is from drafting', () => {
  /* `export --BACK--> disclosure` is a legitimate back edge: after
     exporting you may want to change what you shared and export again.
     What must not exist is a forward path that skips the draft. */
  const forward = edgesInto('disclosure').filter(({ event }) => event !== 'BACK');
  assert.deepEqual(forward, [{ from: 'drafting', event: 'REVIEW' }]);
});

test('going back from export and forward again still needs an approval', () => {
  const m = createMachine({ initial: 'drafting', context: { ...withEvidence, route: { office: 'x' } } });
  m.send('REVIEW'); m.send('APPROVE');
  assert.equal(m.state, 'export');
  m.send('BACK');
  assert.equal(m.state, 'disclosure');
  /* APPROVE remains the only edge, so re-entering export is another
     explicit act by the person, not a replay of the first one. */
  assert.deepEqual(edgesInto('export'), [{ from: 'disclosure', event: 'APPROVE' }]);
});

test('evidence cannot be entered without at least one resolved source', () => {
  const m = createMachine({ initial: 'verifying' });
  assert.equal(m.send('RESOLVED').ok, false);
  m.assign({ evidence: { sources: [] } });
  assert.equal(m.send('RESOLVED').ok, false, 'an empty source list is not a source');
  m.assign(withEvidence);
  assert.equal(m.send('RESOLVED').ok, true);
});

test('drafting requires a resolved route', () => {
  const m = createMachine({ initial: 'routing', context: withEvidence });
  assert.equal(m.send('ROUTED').ok, false);
  m.assign({ route: { office: 'x' } });
  assert.equal(m.send('ROUTED').ok, true);
});

test('approval is revoked by leaving the draft flow', () => {
  const m = createMachine({ initial: 'drafting', context: { ...withEvidence, route: { office: 'x' } } });
  m.send('REVIEW');
  m.send('APPROVE');
  assert.equal(m.state, 'export');
  assert.equal(m.context.disclosureApproved, true);
  m.send('DONE');                       /* back to evidence */
  assert.equal(m.context.disclosureApproved, false,
    'approval must not survive a return to the evidence surface');
});

test('a tool failure never lands in a state that asserts new facts', () => {
  const m = createMachine({ initial: 'triage' });
  m.send('TOOL_FAILED');
  assert.equal(m.state, 'speaking');
  /* speaking is allowed — but only because app.js narrates a fixed
     failure line. What must NOT exist is a path from a failure straight
     into evidence without a payload. */
  const v = createMachine({ initial: 'verifying' });
  assert.equal(v.send('TOOL_FAILED').ok, false, 'no evidence payload means no evidence surface');
});

test('every state declares a world and an aperture state', () => {
  for (const s of STATES) {
    assert.ok(WORLD_FOR[s], `${s} has no world`);
    assert.ok(APERTURE_FOR[s], `${s} has no aperture state`);
    assert.ok(APERTURE_STATES[APERTURE_FOR[s]], `${s} maps to an aperture state that does not exist`);
  }
});

test('every transition target is a real state', () => {
  for (const [from, edges] of Object.entries(TRANSITIONS)) {
    for (const [event, to] of Object.entries(edges)) {
      assert.ok(STATES.includes(to), `${from} --${event}--> ${to} is not a state`);
    }
  }
});

test('barge-in is reachable from every state where Wazi can be speaking', () => {
  for (const s of ['speaking', 'evidence']) {
    assert.ok(TRANSITIONS[s].BARGE_IN, `${s} must accept BARGE_IN`);
  }
});
