#!/usr/bin/env node
/**
 * Copies the three.js build into `assets/three/` so the app can import
 * it as a plain ES module with no bundler.  DECISIONS.md #11.
 *
 * Why a copy rather than a commit: the three.js build is ~80,000 lines,
 * and committing it buries every real change in an unreviewable diff.
 * Why a copy rather than a CDN: the 3D avatar has to work offline like
 * the rest of the product, and a civic tool should not depend on a
 * third-party origin being reachable.
 *
 * Runs automatically on `npm install`. If it does not run, nothing
 * breaks — `mountCharacter()` fails to import the avatar, logs it, and
 * keeps the flat aperture. That is the designed degradation, not an
 * error state.
 */
import { mkdirSync, copyFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', 'three', 'build');
const to = join(root, 'assets', 'three');
const FILES = ['three.module.js', 'three.core.js'];

if (!existsSync(from)) {
  console.log('  three.js not installed — the 3D avatar will not be available.');
  console.log('  The flat aperture still works everywhere. `npm install` to add it.');
  process.exit(0);
}

mkdirSync(to, { recursive: true });
let bytes = 0;
for (const f of FILES) {
  const src = join(from, f);
  if (!existsSync(src)) {
    console.error(`  missing ${f} in the three.js build — not vendoring a partial copy`);
    process.exit(1);
  }
  copyFileSync(src, join(to, f));
  bytes += statSync(src).size;
}
console.log(`  vendored three.js → assets/three/ (${(bytes / 1048576).toFixed(1)} MB, ~407 KB gzipped on the wire)`);
