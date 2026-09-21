#!/usr/bin/env node
/**
 * npm run check:contrast — DESIGN.md §11.1, §29.
 *
 * The design file states that the light accent ramp is for dark surfaces
 * only and that text on paper uses the 700/800 steps. That is only true
 * if something checks it, so this does: it parses the real tokens out of
 * tokens.css and asserts every documented pairing against WCAG 2.2 AA.
 */
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/tokens.css', 'utf8');
const tokens = Object.fromEntries(
  [...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)].map((m) => [m[1], m[2]]));

const srgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = (hex) => { const [r, g, b] = srgb(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/* [foreground, background, minimum, what it is] */
const PAIRS = [
  ['text-on-ink',          'ink-800',   4.5, 'body text on Night'],
  ['text-on-ink',          'ink-700',   4.5, 'body text on raised Night'],
  ['text-on-ink-muted',    'ink-800',   4.5, 'captions on Night'],
  ['text-on-ink-muted',    'ink-700',   4.5, 'captions on raised Night'],
  ['teal-500',             'ink-800',   4.5, 'live accent on Night'],
  ['teal-500',             'ink-700',   4.5, 'live accent on raised Night'],
  ['amber-400',            'ink-800',   4.5, 'focus ring / attention on Night'],
  ['text-on-paper',        'paper-100', 4.5, 'body text on Day'],
  ['text-on-paper',        'paper-50',  4.5, 'body text on a card'],
  ['text-on-paper-muted',  'paper-100', 4.5, 'source lines on Day'],
  ['text-on-paper-muted',  'paper-50',  4.5, 'source lines on a card'],
  ['teal-800',             'paper-100', 4.5, 'teal TEXT on paper — must use the dark step'],
  ['teal-800',             'paper-50',  4.5, 'teal text on a card'],
  ['amber-700',            'paper-100', 4.5, 'amber text on paper'],
  ['paper-50',             'teal-800',  4.5, 'label on a primary button'],
  ['state-verified-ink',     'paper-50', 4.5, 'VERIFIED word on a card'],
  ['state-corroborated-ink', 'paper-50', 4.5, 'CORROBORATED word on a card'],
  ['state-reported-ink',     'paper-50', 4.5, 'REPORTED word on a card'],
  ['state-conflicting-ink',  'paper-50', 4.5, 'CONFLICTING word on a card'],
  ['state-unknown-ink',      'paper-50', 4.5, 'UNKNOWN word on a card'],
  ['state-verified-ink',     'paper-100', 4.5, 'VERIFIED word on the verdict band'],
  ['state-conflicting-ink',  'paper-100', 4.5, 'CONFLICTING word on the verdict band'],
  ['state-reported-ink',     'paper-100', 4.5, 'REPORTED word on the verdict band'],
  /* Focus indicators must be visible against the surface they sit on
     (WCAG 2.2 SC 2.4.11). This is the pair an earlier version missed. */
  ['focus-ring',     'ink-800',   3.0, 'focus ring on Night'],
  ['focus-ring',     'ink-700',   3.0, 'focus ring on raised Night'],
  ['focus-ring-day', 'paper-100', 3.0, 'focus ring on Day'],
  ['focus-ring-day', 'paper-50',  3.0, 'focus ring on a card'],
];

/* Purely decorative separators are NOT graphical objects under WCAG
   1.4.11 — they carry no information a sighted user needs. They are
   reported for awareness and never fail the build. */
const DECORATIVE = [
  ['paper-300', 'paper-100', 'hairline rule on Day'],
  ['ink-600',   'ink-800',   'divider on Night'],
];

let failed = 0;
console.log('\nContrast — WCAG 2.2 AA (4.5:1 text, 3:1 meaningful non-text)\n');
for (const [fg, bg, min, what] of PAIRS) {
  if (!tokens[fg] || !tokens[bg]) {
    console.error(`  ✗ unknown token in pair ${fg} / ${bg}`); failed++; continue;
  }
  const r = ratio(tokens[fg], tokens[bg]);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(`  ${ok ? '✓' : '✗'} ${r.toFixed(2).padStart(5)}:1  (min ${min})  ${what}`);
  if (!ok) console.log(`       --${fg} ${tokens[fg]} on --${bg} ${tokens[bg]}`);
}

console.log('\nDecorative separators (reported, not enforced)\n');
for (const [fg, bg, what] of DECORATIVE) {
  console.log(`  · ${ratio(tokens[fg], tokens[bg]).toFixed(2).padStart(5)}:1  ${what}`);
}

/* The rule the design file states in prose, asserted. */
console.log('\nRamp rule — a light accent must never be text on paper\n');
for (const light of ['teal-400', 'teal-500', 'amber-400', 'amber-500']) {
  const r = ratio(tokens[light], tokens['paper-100']);
  const correctlyUnusable = r < 4.5;
  console.log(`  ${correctlyUnusable ? '✓' : '✗'} --${light} on paper is ${r.toFixed(2)}:1 ` +
              `— ${correctlyUnusable ? 'correctly unusable as text' : 'UNEXPECTEDLY passes, the rule is not doing any work'}`);
}

console.log(failed ? `\n${failed} pairing(s) below the minimum.\n` : '\nAll pairings pass.\n');
process.exit(failed ? 1 : 0);
