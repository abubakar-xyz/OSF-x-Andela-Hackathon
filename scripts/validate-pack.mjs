#!/usr/bin/env node
/** npm run validate:pack — the gate a contributed jurisdiction must pass. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validatePack, PACK_FILES } from '../src/evidence/pack.js';

const root = 'data/packs';
if (!existsSync(root)) { console.error(`no ${root} directory`); process.exit(1); }

let failed = 0;
for (const id of readdirSync(root)) {
  const dir = join(root, id);
  const raw = {};
  for (const f of PACK_FILES) {
    const p = join(dir, `${f}.json`);
    if (existsSync(p)) raw[f] = JSON.parse(readFileSync(p, 'utf8'));
  }
  const r = validatePack(raw);
  console.log(`\n── ${id} ──`);
  if (r.ok) {
    console.log(`  ✓ valid — ${r.pack.sources.length} sources, ${r.pack.entities.length} entities, ` +
                `${r.pack.records.length} records, ${r.pack.routes.length} routes`);
    if (r.pack.meta.is_fixture) console.log('  ▓ pack is a labelled DEMO FIXTURE');
  } else {
    failed++;
    for (const e of r.errors) console.error(`  ✗ ${e}`);
  }
  for (const w of r.warnings ?? []) console.log(`  · ${w}`);
}
console.log('');
process.exit(failed ? 1 : 0);
