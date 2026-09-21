# wazi

**Kiswahili: open, clear, plain.**

> Hold up your phone. Wazi reads the public record back to you, shows you where it does not
> match what you are looking at, and writes the letter to the office that owes you an answer.

Andela × Open Society Foundations 2026 civic-tech hackathon — *Information You Can Trust*.
Primary track: **Transparency & Accountability**. Secondary: **Safety, Reporting & Protection**.

---

## Run it

```bash
npm start          # http://localhost:4173
npm run check      # pack validation + contrast gate + 34 tests — no install needed
```

No install step, no build step, no API key, no account. It is a static PWA — any file server
will do. Voice runs on the browser's own speech engine, so it works offline.

The browser checks drive the real app and need Playwright, so they are separate:

```bash
npm install
npm run verify:browser            # full journey + the six failure drills
SHOTS=./shots npm run verify:journey   # and write screenshots
```

### Turning on the hosted voice

Everything above works with no key. To run the real Gemini Live conversation instead of the
browser speech engine:

```bash
npm install
WAZI_API_KEY=your-key npm run relay      # holds the key, runs the tools
# then set <meta name="wazi-relay" content="ws://localhost:8787"> in index.html
npm start
```

The relay **refuses to start without a key** rather than degrading quietly, and it does not
tell the browser a model is connected until the session has produced something — a bad key
produces `unavailable`, the app falls back to on-device speech, and the interface says so.
Models, limits and protocol are in [`DESIGN.md`](DESIGN.md) §23.4.

The three-minute demo path is in [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md).

## The problem

Public information exists and is useless to most people who need it — wrong format, wrong
language, behind a portal they cannot reach on the data they have. And even when they find it,
the hard part is still ahead: knowing **which office** is responsible and **how to write to it**
in terms it will answer.

## What it does

1. **Understand** — explains a public record in plain language, by voice, in English or Kiswahili.
2. **Verify** — puts the official record and your own dated photograph side by side on one card,
   with every number tappable to its source, and assigns a claim-level evidence state.
3. **Act** — finds the responsible office and a **verified** contact route, and drafts the
   email, letter or WhatsApp message, with citations, for you to review and send.

## What makes it different

- **It speaks first.** One tap ever; after that the app is already awake when you get there.
- **The AI's work is visible** — each running tool is a labelled orbiting mote, including
  *"Trying to prove myself wrong."* There is no spinner anywhere in this product.
- **The Two Truths card** is shareable as an image with the verdict and the citations baked in.
- **Check Again can lose the argument** — it overturns the first verdict in the demo, shows the
  old one struck through, and says *"I was wrong."*
- **No confidence percentages.** Five fixed words, including *"I don't have enough to say."*
- **No orphan facts.** A `<Fact>` cannot render without a resolvable source.

## Architecture

```
src/
  character/   the Aperture — six blades, eleven states, one rAF loop, pure SVG
  core/        machine (§16) · storage · sound · tiers · DOM helpers
  evidence/    ladder · schema validator · types · pack loader · pipeline · safety
  tools/       the fourteen tool contracts (§24) and the Draft Studio
  components/  the component library (§12)
  voice/       Web Speech, and the hosted relay contract (stubbed, not wired)
  styles/      tokens.css is the only place a raw colour value exists
data/packs/    Country Packs — seven JSON files per jurisdiction
prompts/       one responsibility per file (§26)
tests/         the sixteen honesty tests, machine invariants, pack contract
```

**The reliability decision that matters** is the two-brain split: the conversational layer is a
narrator that never holds a fact, and a separate worker produces schema-validated evidence. A
payload whose facts do not resolve is rejected at the boundary rather than shown. Full
reasoning in [`DESIGN.md`](DESIGN.md) §23.1.

**No build step.** The core app has no runtime dependencies: 75 KB gzipped JS against a 180 KB
budget, 192 KB first load on a full-tier device, **94 KB on a thin connection** — which never
fetches the webfonts or the 3D rig.

The character is **one being at two fidelities**. A 4 KB flat aperture mounts immediately
(measured: working character at 114 ms); a Three.js lens-being with a real eye, gaze and blink
swaps in on idle where the device can carry it. Three.js is 407 KB gzipped — knowingly over
budget, quarantined behind `canUpgrade()`, and never on the path to Wazi's first word.
[`DECISIONS.md`](DECISIONS.md) #5 and #11.

## Data provenance and limitations

**The Country Pack shipped here is a labelled demo fixture. It is not live government data.**

It is labelled three times — the `FIXTURE_` filename prefix, the `is_fixture` field in the
data, and an amber ribbon in the interface that `tests/honesty.test.mjs` #16 enforces.
`data/packs/ke-siaya/PROVENANCE.md` carries the sign-off table a named human has to complete
before any public demonstration.

Also honest about this build:

- **No hosted model is connected.** The realtime path is specified in `DESIGN.md` §23.3–§23.5
  and stubbed in `src/voice/live.js`; the interface says which engine is actually running.
- **Clue extraction is fixture-backed.** The shape — observed vs inferred, every row editable
  before use — is the part that matters architecturally, but it has not been tested against
  real photographs.
- **Nothing is sent, ever.** Every external action is simulated and stamped
  `SIMULATED — NOT DELIVERED` in the artifact itself.

## Scale

A new jurisdiction is **seven JSON files and zero application code**. `npm run validate:pack`
refuses a contribution where a record lacks verbatim official wording, a route claims
verification without a source, or a deadline has no citation.

## Principles

Wazi never states a civic fact it did not retrieve. Every number carries its source, its
publication date and the date we fetched it. A photograph is a dated observation, never proof
of wrongdoing. Absence of evidence is reported as absence of evidence. Wazi names offices, not
people. Nothing leaves the device without a human approving exactly what goes out. Every voice
path has a complete text path. Simulated actions are labelled simulated. Wazi never claims
protection it cannot provide.

The full nine Product Laws are in [`DESIGN.md`](DESIGN.md) §6.

## Documents

| | |
|---|---|
| [`DESIGN.md`](DESIGN.md) | The complete specification — idea, character, tokens, machine, evidence model, architecture, budgets, demo |
| [`DECISIONS.md`](DECISIONS.md) | Every deviation and why, including corrections found while implementing the design |
| [`THREAT_MODEL.md`](THREAT_MODEL.md) | Who could be harmed, by what, what we do — and what we are exposed to and are not fixing |
| [`ACCESSIBILITY.md`](ACCESSIBILITY.md) | What is enforced, what is implemented, and what has **not** been tested |
| [`AI_CODING_LOG.md`](AI_CODING_LOG.md) | How this was built with AI tooling, and the six defects the guards caught that review did not |
| [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) | Three minutes, to the second, plus the failure drills |
| [`HACKATHON_SUMMARY.md`](HACKATHON_SUMMARY.md) | The written submission |
| [`.env.example`](.env.example) | No credentials — this build needs none |

## The only metric that matters

Amina sends the WhatsApp summary. The chairman's office replies.
