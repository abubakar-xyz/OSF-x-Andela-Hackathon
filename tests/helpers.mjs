import { readFileSync } from 'node:fs';
import { validatePack, PACK_FILES } from '../src/evidence/pack.js';

export function loadFixturePack() {
  const raw = {};
  for (const f of PACK_FILES) raw[f] = JSON.parse(readFileSync(`data/packs/ke-siaya/${f}.json`, 'utf8'));
  const r = validatePack(raw);
  if (!r.ok) throw new Error(`fixture pack invalid: ${r.errors.join('; ')}`);
  return r.pack;
}

export const PHOTO_SOURCE = {
  id: 'user-photo', publisher: 'Your photo', title: 'Site photograph', tier: 'user',
  published_at: '2026-09-18', retrieved_at: '2026-09-18',
  excerpt: 'Dated photograph supplied by the user. Location metadata removed at import.',
  is_fixture: true,
};

export const signboardImage = () => ({
  clues: [
    { key: 'project', label: 'Project', value: 'Bondo Sub-County Health Centre II', observed: 'observed' },
    { key: 'reference', label: 'Reference', value: 'BSC-HC-II', observed: 'observed' },
    { key: 'status', label: 'Claimed status', value: 'COMPLETED — March 2023', observed: 'observed' },
  ],
  observations: [
    { label: 'Roof', value: 'absent', source_id: 'user-photo', as_of: '2026-09-18' },
    { label: 'Windows', value: 'unglazed', source_id: 'user-photo', as_of: '2026-09-18' },
  ],
  source: PHOTO_SOURCE,
});
