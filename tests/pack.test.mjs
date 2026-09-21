/** Country Pack contract. DESIGN.md §25.
 *  A new jurisdiction is data, not code — which is only true if the
 *  validator refuses an incomplete contribution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePack, PACK_FILES } from '../src/evidence/pack.js';

const load = () => {
  const raw = {};
  for (const f of PACK_FILES) raw[f] = JSON.parse(readFileSync(`data/packs/ke-siaya/${f}.json`, 'utf8'));
  return raw;
};

test('the shipped pack validates', () => {
  const r = validatePack(load());
  assert.equal(r.ok, true, r.errors?.join('; '));
});

test('a record without verbatim official wording is refused', () => {
  const raw = load();
  raw.records.records[0] = { ...raw.records.records[0], verbatim: '' };
  const r = validatePack(raw);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /verbatim official wording is required/);
});

test('a source without a retrieval date is refused', () => {
  const raw = load();
  delete raw.sources.sources[0].retrieved_at;
  const r = validatePack(raw);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /retrieved_at is required/);
});

test('a route claiming verification without a source is refused', () => {
  const raw = load();
  raw.routes.routes[0] = { ...raw.routes.routes[0], source_id: null };
  const r = validatePack(raw);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /verified_at set but no source_id/);
});

test('a deadline without a citation is refused', () => {
  const raw = load();
  raw.procedures.procedures[0] = { ...raw.procedures.procedures[0], deadline_source_id: null };
  const r = validatePack(raw);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /no invented deadlines/);
});

test('fixture sources force the pack to declare itself a fixture', () => {
  const raw = load();
  raw.pack.is_fixture = false;
  const r = validatePack(raw);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /contains fixture sources but is_fixture is not set/);
});

test('a missing file is refused rather than partially loaded', () => {
  const raw = load();
  delete raw.routes;
  const r = validatePack(raw);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /missing routes\.json/);
});

test('an unverified route is reported as a warning, not silently dropped', () => {
  const r = validatePack(load());
  assert.ok(r.warnings.some((w) => /unverified — will not be offered/.test(w)));
});
