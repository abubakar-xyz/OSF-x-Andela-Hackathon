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

## 7. Model identifiers — CORRECTED

**Original decision (wrong).** An earlier version of this entry said the brief's model
identifiers "could not be confirmed against official documentation", because `ai.google.dev`
is blocked by this environment's egress proxy, and concluded that model selection should stay
abstract.

**That was a failure of effort, not a limitation.** One blocked domain is not the end of the
search. Google publishes its own `gemini-live-api-dev` skill on GitHub, which is reachable,
authoritative and current. It is now vendored at
`.claude/skills/gemini-live-api-dev/SKILL.md` and `migration.md`.

**The brief was right.** Both models it named exist:

| Model | Role |
|---|---|
| `gemini-3.8-live` | default for low-latency conversation; async function calling (`NON_BLOCKING`) is the default mode; no `thinking_level` |
| `gemini-3.8-live-extended-thinking` | background reasoning during a live call, speaking natural conversational fillers while async tools run; `thinking_level` low/medium/high; `interaction_status` rather than `turnComplete` for idle |

**Decision** Both are pinned in `server/models.config.mjs`, and the relay in
`server/relay.mjs` is a real client against the documented protocol rather than a stub.

**What this changed in the design.** The extended-thinking model speaks natural fillers while
background tools run. That is the audible half of the motes in §8.4 — the design anticipated
the shape ("turnComplete ≠ idle", §23.5) but assumed the narration would have to be ours.
It does not: the model does it, and `interaction_status` is the exact signal §23.5 was
describing without knowing its name.

**Still unverified.** Nothing here has been run against a live key. The relay refuses to start
without `WAZI_API_KEY` rather than degrading quietly, and the interface names whichever engine
is actually connected. See `AI_CODING_LOG.md`.

**Lesson** "The documentation is unreachable" was a claim about my own search, stated as a
claim about the world. Check the vendor's own repository before concluding a product does not
exist.

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

## 10. Visual direction: the register and the snapshot

**Context** A design review against Anthropic's `frontend-design` skill, now vendored at
`.claude/skills/frontend-design/SKILL.md`.
**Finding** The Day side was warm cream `#F7F3E8` under a high-contrast serif display — the
skill names that exact combination as the commonest look a generator produces. The product
also carried four more of the listed tells: tracked-out ALL-CAPS eyebrows above every heading,
meta strings joined with middle dots, `→` appended to button labels, and identical rounded
cards with one radius and the same shadow. None of those were decisions. They were defaults.
**Decision** Rebuilt the palette and typography around the two objects this product actually
sits between: **the project signboard** and **the government duplicate form**. Register
green-grey `#E4E9E1` instead of cream; rubber-stamp red instead of terracotta; Archivo (a
signage grotesque) and Fraunces, with the serif reserved for a person's own words and never
used for the system's voice or for the record's filed wording. Radius now encodes meaning —
a record has square corners, a photograph has soft ones. Depth comes from a hairline and a
translucent fill; Day has no `box-shadow` at all.
**Why** Every one of those choices is traceable to the subject matter rather than to a
template, which is the difference the brief is paying for. It also fixed real defects found
on the way: raw ISO dates were leaking into prose a person reads, a long audit observation
was being forced into a right-aligned table cell, and the photo crop was cutting off the
"not a real photograph" label — an honesty label that must never be croppable.
**Evidence** `npm run check:contrast` passes all 25 pairings on the new tokens. JS is 69.7 KB
gzipped against the 180 KB budget; total first load 186 KB against 400 KB, and 88 KB on the
light tier, which requests no webfonts at all.
**Reversible** Yes — the whole palette is nine tokens in one file.

## 11. A 3D avatar, loaded late and never required

**Context** Review feedback: the flat aperture was "detached and hard to relate to". That was
correct. It could show a state; it could not look at you.

**Options** A 2D creature with a face; a richer flat aperture; a 3D avatar; a hybrid.

**Decision** A **Three.js lens-being**, chosen by the product owner over the cheaper options.
It keeps the aperture identity — six blades shuttering over a core — and adds the thing that
actually creates attachment: **an eye**. A dilating amber iris, a dark pupil, a specular
glint, and **gaze** — it looks at the person, turns toward a card when one lands, blinks, leans
in when curious and draws back when offline.

Eyes are the relatability mechanism, and an iris *is* an eye. So this stays a lens-being
rather than becoming a face: no human, no robot, no costume, and therefore no uncanny valley
and no cultural assumption about whose face a civic companion should have.

**The cost, stated plainly.** Three.js is **407 KB gzipped** — more than five times the rest
of the product put together, and on its own more than the 400 KB total-load budget in §28.
That budget is broken, knowingly, on this one thing.

**What the cost is not allowed to touch.** Three mitigations, each tested:

1. **The flat aperture mounts first, always.** 4 KB, every device. The 3D rig loads on
   `requestIdleCallback` and swaps in place carrying the current state. Measured: character
   mounted at 114 ms, upgraded at 270 ms — and the upgrade is never on the path to Wazi's
   first word. `tests/browser/drills.mjs` #7.
2. **A thin connection never fetches it.** `canUpgrade()` refuses on the light and text tiers,
   on `saveData`, on `effectiveType ≤ 3g`, under 4 GB of device memory, with reduced motion,
   and without WebGL. Drill #8.
3. **One character, two fidelities.** The state vocabulary is identical and the machine never
   branches on which is mounted, so nothing downstream knows or cares.

**Why not the 2D creature** (my recommendation, overruled): it would have cost ~30 KB instead
of 407 KB and kept the Android Go promise intact. The owner's call was that the emotional
ceiling of a flat character is lower, and for a product whose whole job is to make an
institution feel answerable, presence is worth the bytes. On a `full`-tier device that is a
defensible trade; the mitigations are what keep it from being paid by the person who can least
afford it.

**Reversible** Entirely. Delete `avatar3d.js` and `assets/three/`, and `mountCharacter()`
keeps returning the flat aperture with no other change.
