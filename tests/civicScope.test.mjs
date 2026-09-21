import test from 'node:test';
import assert from 'node:assert/strict';
import { findCountry, CIVIC_COUNTRIES, CIVIC_CATEGORIES } from '../src/evidence/civicScope.js';

test('every entry is a name/code pair only — nothing here is a URL to go stale', () => {
  for (const c of CIVIC_COUNTRIES) {
    assert.equal(typeof c.code, 'string');
    assert.equal(typeof c.name, 'string');
    assert.equal(Object.keys(c).sort().join(','), 'code,name');
  }
  for (const c of CIVIC_CATEGORIES) {
    assert.ok(!('url' in c), `category ${c.key} must not carry a hardcoded URL`);
  }
});

test('findCountry matches by code, exact name, or substring', () => {
  assert.equal(findCountry('KE')?.name, 'Kenya');
  assert.equal(findCountry('kenya')?.name, 'Kenya');
  assert.equal(findCountry('Siaya County, Kenya')?.name, 'Kenya');
  assert.equal(findCountry('nowhereland'), null);
  assert.equal(findCountry(''), null);
});
