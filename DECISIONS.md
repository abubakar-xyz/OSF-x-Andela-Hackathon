# Decisions

Every deviation, with the reasoning. Template in `DESIGN.md` Appendix C.

---

## 1. Deterministic, offline-first before any hosted model

**Context** Demo reliability under low bandwidth, and a venue network nobody controls.
**Decision** A static PWA and a deterministic evidence engine, working end to end from a
cached pack, before any live API integration.
**Why** Strengthens demo reliability (§33) and is also the correct answer for the user we are
designing for — Amina has 200 MB of data left this week.
**Reversible** Yes. The hosted path is specified in `DESIGN.md` §23.3–§23.5 and stubbed in
`src/voice/live.js`.

## 2. Evidence states, never confidence scores

**Context** How to express certainty about a civic claim.
**Options** A percentage; a star rating; a fixed vocabulary.
**Decision** Five rungs with fixed words and glyphs — VERIFIED, CORROBORATED, REPORTED,
CONFLICTING, UNKNOWN — with a plain definition one tap away.
**Why** A percentage sounds precise while saying nothing, and invites the reader to round it up
to "true". The ladder is learnable in three encounters and survives greyscale, print and a
screen reader. §5 Decision 7.
**Reversible** No, and deliberately: percentages are banned in code, and the scanner in
`src/evidence/safety.js` refuses them.

## 3. Verified contact routes only

**Context** An address is the most consequential thing this product outputs.
**Decision** A route is offered only with both a resolvable source and a verification date.
An unverified route is not shown at all; the interface says what could not be confirmed and
offers the verified escalation instead.
**Why** Sending someone to the wrong office wastes the one letter they will write. Scraped
contacts were explicitly cut in the brief. Asserted by `tests/honesty.test.mjs` #11.
**Reversible** No.

## 4. Renamed NURU Civic to Wazi

**Context** The working name needed to signal illumination and public agency.
**Options** Ona (collides with ona.io, a Nairobi civic-data company), Shahidi (too close to
Ushahidi), Taarifa (existing platform), Kweli ("truth"), Sauti, Sawa, Tazama.
**Decision** **Wazi** — Kiswahili for *open, clear, plain*.
**Why** *Serikali wazi* is the standing phrase for open government (the primary track);
*sema wazi* means "speak plainly" (the conversation policy). Decisive factor: a product whose
evidence model includes UNKNOWN and CONFLICTING cannot be named after light or truth without
the name contradicting its own verdicts. Full reasoning in `DESIGN.md` §1.
**Evidence** Applied across `package.json`, `manifest.webmanifest`, `service-worker.js` (cache
key bumped to `wazi-v2`), `index.html`, `prompts/identity.md` and the docs. Historical
references are preserved in `DESIGN.md` §1 and Appendix B so the rename stays traceable.
**Reversible** Cheap now, expensive after any public use. Run a trademark search before real
deployment — "wazi" is a common word and appears in unrelated ventures.

## 5. Zero-dependency vanilla instead of React + Vite + XState + Tailwind

**Context** `DESIGN.md` §23.2 specified that stack. Implementation measured what it costs.
**Options** The specified stack; Preact + a small router; zero dependencies.
**Decision** **Zero runtime dependencies. No build step.** Plain ES modules, CSS custom
properties, a hand-written state machine and a hand-written schema validator.
**Why** React + react-dom + XState + Tailwind is roughly 70 KB gzipped before a single line of
product code, against a 180 KB budget (§28) — 40% of the budget spent on the ability to write
JSX. Measured result: **67 KB gzipped for the entire application**, 82 KB total first load. It
also removes the build step as a failure mode on stage, and the app runs from any static file
server. For a low-bandwidth civic product this is not a shortcut; it is the right answer.
**Evidence** `npm run check` measures it; the browser journey runs with zero console errors.
**Reversible** Yes, but there is no reason to. The state machine is ~200 lines and the
validator ~90.

## 6. Local-first storage, no server persistence

**Decision** Two IndexedDB stores — `cases` and `identity` — and nothing held server-side.
**Why** No account means no breach, no subpoena target, and no per-user cost (the scalability
argument in §33). Separating identity from evidence is what makes "delete my details" genuinely
leave the case intact.
**Reversible** Yes, and if it ever changes, `THREAT_MODEL.md` needs rewriting first.

## 7. Model identifiers are capability-based config, not hard-coded

**Context** The director's brief named specific Gemini model versions.
**Decision** `server/models.config.ts` in the specification; nothing hard-coded in application
code. Step 1 of the build sequence is reading the real model list in the team's API project.
**Why** The brief's identifiers could not be confirmed against official documentation from the
build environment (`ai.google.dev` is blocked by the network egress proxy). Google's current
Live API documentation describes native-audio realtime models with function calling and search
grounding — the capability set we need — but a model ID nobody has called must never ship.
**Reversible** Yes. Record the exact IDs and the date the list was read.

## 8. Browser print-to-PDF instead of a PDF library

**Decision** `window.print()` with a print stylesheet.
**Why** Zero dependency, works offline, and the document never reaches a server. We do not
claim the result is signed, because there is no signing flow.
**Reversible** Yes, if a real signing flow is ever built.

## 9. Web Speech instead of a hosted realtime model

**Decision** The browser's own speech engine for this build; the hosted relay specified and
stubbed, throwing rather than degrading silently.
**Why** Voice works with no API key, no server and no network — honest and also the correct
low-bandwidth answer. `src/voice/live.js` throws instead of falling back quietly, because a UI
implying a hosted model is connected when it is not would break Law 8.
**Reversible** Yes. The contract the relay must satisfy is in `LIVE_CONTRACT`.

---

## Corrections to `DESIGN.md` found while implementing it

**A. The evidence ladder was written as a strength ordering.** It is not — `CONFLICTING →
REPORTED` is a *strengthening*, not a downgrade. Display order and settledness are now separate
scales (`src/evidence/ladder.js`). Found while implementing `challenge_finding`.

**B. §16's diagram used "routing" for two different states** — intent classification and
institution lookup. Renamed `triage` and `routing`.

**C. The character was wrong on first render.** Narrow rounded leaves read as a **daisy**, not
as something opening. Blades are now broad overlapping wedges clipped to a circular housing,
as a real iris diaphragm works, and the closed extreme pushes past centre so a closed aperture
is genuinely dark. This was only visible by rendering it and looking at it.

**D. The focus ring was amber on both worlds** — 12.8:1 on Night, **1.28:1 on paper**. There is
now a separate Day value. Found by `npm run check:contrast` after adding focus pairs.

**E. `--amber-700` failed 4.5:1 on paper**, which also put the REPORTED state word below AA.
Darkened to `#8A5F0A`.
