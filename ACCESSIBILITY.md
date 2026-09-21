# Accessibility

Target: **WCAG 2.2 AA**. Where we have not tested something, this file says so rather than
claiming conformance.

## What is enforced by the build

| Requirement | How | Where |
|---|---|---|
| Contrast ≥4.5:1 text, ≥3:1 focus indicators | `npm run check:contrast` parses the real tokens and asserts 25 documented pairings | `scripts/check-contrast.mjs` |
| Status is never colour alone | Every evidence state renders glyph **+ word** + colour; `StateGlyph` cannot render without its label | `src/components/stateGlyph.js` |
| Minimum type size 14px | `--label` is the smallest token in the system; source lines and disclaimers use it, not a caption size | `src/styles/tokens.css` |
| Touch targets ≥48px | Enforced on every control in the base layer | `src/styles/app.css` |
| Every voice path has a text path | Machine invariant — `text_only` reaches the same engine | `tests/honesty.test.mjs` #08 |

## What is implemented

- **Captions are always on and cannot be hidden.** Any line of your own speech is tappable to
  correct, and correcting **re-runs the turn** rather than only fixing the text.
- **The character is `aria-hidden`.** Its state is announced through a polite live region
  ("Wazi is listening", "Wazi is checking the records") — the drawing is decoration, the state
  is information.
- **`prefers-reduced-motion`** collapses every duration token, stops the breathing, the orbit
  and the spin, and turns the orbiting motes into a **static checklist carrying the same
  labels**. Equivalent information, zero motion.
- **Focus rings differ per world.** Amber on Night at 12.8:1; a dark teal on Day at 8.9:1.
  An earlier version used amber on both, which was 1.28:1 on paper and effectively invisible.
- **Sheet depth is capped at one.** A sheet may never open another; it replaces itself. Escape
  closes, focus returns to the element that opened it.
- **Plain-language summary before detail** on every evidence surface, and a plain definition
  one tap away from every evidence state.
- **Evidence states read word-first** to assistive tech, so colour is irrelevant to meaning.
- **Print styles keep the citations.** A printed brief without its sources is exactly the
  artifact we refuse to produce.

## What has NOT been tested

Stated honestly, because an untested claim is worse than an absent one:

| | Status |
|---|---|
| TalkBack on Android | **Not tested.** No device available in this environment. |
| VoiceOver on iOS | **Not tested.** |
| 200% browser zoom | **Not tested** beyond the 390px viewport below. |
| Switch control / keyboard-only end-to-end | **Partially** — every control is a real `<button>` or `<input>` and reachable, but the full journey has not been driven by keyboard alone. |
| Screen-reader reading order on the Two Truths card | **Not tested.** The DOM order is Record → Reality → verdict → differences, which should read correctly linearly, but that is reasoning, not evidence. |
| Real users with low digital confidence | **Not tested.** `DESIGN.md` §30 step 17 puts this before polish, and it has not happened. |

## What was tested

- Chromium 1194, viewport **390 × 844** at DPR 2, full journey from cold start to disclosure
  review: **zero console errors**.
- Mic permission **denied** path: lands in a complete text journey, reaches the same engine,
  produces the same artifacts.
- Contrast: 25 pairings, all passing, checked against the shipped token values.

## Known gaps

1. **The camera flow is fixture-backed**, so its accessibility under a real camera stream is
   unknown.
2. **No skip-link target beyond `#main`.** Adequate for a single-surface app; will need more
   if surfaces multiply.
3. **`contenteditable` clue rows** are announced as textboxes, but editing behaviour under a
   screen reader has not been verified.
4. **Language tiers cover English and Kiswahili only.** Anything else is not offered, because
   offering an untested language is a worse failure than declining.
