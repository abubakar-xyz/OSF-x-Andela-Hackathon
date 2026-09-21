# AI coding log

*A judged criterion for this hackathon is the use of AI software-development tools. This is an
honest account: what was generated, what was rejected, and — the part that actually matters —
**what the tooling caught that review did not**.*

## How this was built

The whole of Wazi was designed and implemented with **Claude Code** (Claude Opus 5) driving
the work in a remote session, with a human directing scope and making the product calls.

The sequence was deliberately design-first:

1. A director's brief was written by the team.
2. `DESIGN.md` was produced as a single self-contained specification — the name, the product
   decisions, the nine Product Laws, the character, the design tokens, the state machine, the
   evidence model, the architecture, the budgets, the tests.
3. Implementation followed the build sequence in `DESIGN.md` §30, with the riskiest items
   first.

Writing the specification before the code was the highest-leverage decision. Nearly every
correction below was caught because there was a written rule to check the code against.

## What the model proposed and the human rejected

| Proposed | Decision |
|---|---|
| Keep the working name NURU | **Renamed to Wazi.** A product whose evidence model includes UNKNOWN cannot be named after light or truth. |
| React + Vite + XState + Tailwind (as written in `DESIGN.md` §23.2) | **Rejected during implementation.** ~70 KB gzipped before a line of product code, against a 180 KB budget, plus a build step that can fail on stage. Built zero-dependency instead: 67 KB total. Recorded in `DECISIONS.md`. |
| The brief's five-entry action dock | **Cut.** Three contextual chips instead. |
| The brief's specific Gemini model identifiers | **Not shipped.** They could not be confirmed against official documentation from the build environment, so model selection is capability-based config and step 1 of the build is reading the real model list. |

## What the code caught that review did not

This is the interesting part. Six defects reached working code and were caught by the
product's own guards and tests rather than by reading the diff.

1. **Orphan fact in the escalation route.** `find_responsible_body` built an escalation whose
   address `Fact` cited a source the route did not carry. The `<Fact>` component threw in dev.
   *The guard was right; the tool was wrong.* Caught in browser verification.

2. **The forbidden-vocabulary scanner flagged Wazi's own money line.** "That isn't proof of
   anything yet" contains "proof of" — and that line is the restrained phrasing `DESIGN.md`
   §9.4 explicitly prescribes. Scanning is now negation-aware. A blunt substring match would
   have either blocked the best line in the product or been deleted entirely.

3. **Entity resolution matched everything.** Jurisdiction proximity scored on its own, so
   "Is the Kisumu flyover finished?" resolved to a Siaya health centre. Caught by honesty test
   06. This is precisely the wrong-project failure mode §17 exists to prevent, and it would
   have shipped.

4. **A dead edge in the state machine.** `export --BACK--> disclosure` was declared but its
   guard rejected it, so it could never be taken. Caught by a machine invariant test.

5. **The focus ring was invisible on half the product.** Amber on both worlds: 12.8:1 on
   Night, **1.28:1 on paper**. Caught by the contrast script — which was not even looking for
   it until the failing dividers prompted adding focus pairs.

6. **`--amber-700` failed 4.5:1 on paper**, which also meant the REPORTED evidence state word
   was below AA. Caught by the contrast script.

Two of my own **tests** were also wrong rather than the code — asserting that every edge into
`disclosure` came from `drafting` (forbidding a legitimate back edge), and treating decorative
hairlines as WCAG 1.4.11 graphical objects. Both were corrected rather than worked around.

## The biggest miss

**I declared a product did not exist because one domain was blocked.**

The brief named `Gemini 3.8 Live` and `Gemini 3.8 Live Extended Thinking`. `ai.google.dev` is
blocked by this environment's egress proxy, so I could not read the official docs. I wrote in
`DECISIONS.md` and `DESIGN.md` that the identifiers "could not be confirmed", specified model
selection abstractly, and shipped `src/voice/live.js` as a stub that threw.

That reasoning was wrong in a way worth naming: **a claim about my own search was stated as a
claim about the world.** Google publishes its own `gemini-live-api-dev` skill on GitHub, which
is reachable from here, authoritative, and current. Both models exist. The brief was right and
I had quietly designed around it.

What that cost: a specified-but-stubbed realtime path, and — worse — a design that assumed
Wazi would have to narrate its own tool use, when `gemini-3.8-live-extended-thinking` speaks
natural conversational fillers while async tools run. The capability I was designing a
substitute for was already in the model.

Corrected: the skill is vendored at `.claude/skills/gemini-live-api-dev/`, both models are
pinned in `server/models.config.mjs`, and `server/relay.mjs` is a real client against the
documented protocol. It has still never been run against a live key — see the limitations
below — but it refuses to start without one and refuses to claim a connection it has not
proven.

**Lesson:** check the vendor's own repository before concluding a product does not exist.
One blocked domain is not the end of a search.

## What the model got wrong on its own terms

- **`DESIGN.md` §18 described the evidence ladder as if it were a strength ordering.** It is
  not: `CONFLICTING → REPORTED` is a *strengthening*, not a downgrade. Found while
  implementing `challenge_finding`. Display order and settledness are now separate scales.
- **§16's state diagram used "routing" for two different states** — intent classification and
  institution lookup. Renamed `triage` and `routing` in code, and the diagram corrected.
- **The character was wrong on first render.** Narrow rounded leaves read as a **daisy**, not
  as something opening. This was only visible by rendering it and looking. Blades are now
  broad overlapping wedges clipped to a circular housing, as a real iris diaphragm works.

The lesson from the last one: *for anything visual, generated code has to be rendered and
looked at.* It compiled, it animated, it matched the written spec — and it was wrong.

## Verification loop

Every claim in this repository is checked by something that runs:

```
npm run check      # pack validation + contrast + 34 tests
```

- `npm run validate:pack` — a contributed jurisdiction is refused if a record lacks verbatim
  wording, a route claims verification without a source, or a deadline has no citation.
- `npm run check:contrast` — parses the shipped tokens, asserts 25 pairings.
- `npm test` — the sixteen honesty tests of §31, plus machine invariants and pack contract.
- Browser verification in Chromium at 390×844, driving the full journey from cold start to
  disclosure review, asserting zero console errors.

## Update: run against a real key, and what it found

That gap was closed. A working key made two things possible for the first time: an actual
live Gemini conversation, and a second reference implementation (a separate, working Live API
project by the same team) to learn from directly rather than from documentation alone.

Studying that reference caught a real, live bug review had missed: **typed input never
reached the live model.** `app.live.text()` existed on the client; nothing called it. A typed
message during a live session went to the local offline pipeline instead, silently. Since
typing is the natural way to test on a machine without a reliable mic, this was very likely
the actual reason an earlier round of manual testing judged the live experience "not good
enough" — the live model may never have been exercised at all, only its fallback.

With that fixed and a real key in place, the full architecture was verified end-to-end for
the first time: connect → model-first greeting → a typed question correctly triggers
`check_public_record` via tool-calling, with the model speaking a natural filler
("Let me check the records") while it runs → the resulting evidence card → "Check again"
genuinely overturning a verdict via `challenge_finding` → "Take action" resolving a real
office via `find_who_is_responsible` → the draft screen. Zero console errors, real audio
confirmed via populated output transcription.

The same real-key testing also caught a subtler bug no amount of code review would have:
Google's search-grounding response never populates `groundingChunk.web.domain`, and
`web.uri` is an opaque `vertexaisearch.cloud.google.com` redirect, not the source's real
address — so a domain-trust check reading the URL would have graded every single result
"unverified" regardless of the actual site. `web.title` turned out to reliably carry the
real bare domain instead, confirmed against ~14 live grounding chunks mixing real government
sites with facebook.com and an unrelated NGO site. Fixed and locked in with a regression test
built from the real response shape.

**Lesson, twice now:** a stub that has never met the real system will look correct right up
until it does. The fix both times was not more careful reading — it was running the real
thing and treating what it returned as data, not as what the SDK types or intuition implied
it would return.

## Honest limitations of this account

- The vision/clue-extraction path is fixture-backed, so nothing here demonstrates AI tooling
  against real photographs.
- The flagship case is entirely synthetic. `data/packs/ke-siaya/PROVENANCE.md` carries the
  sign-off table that has to be completed by a named human before any public demonstration.
- Barge-in (interrupting Wazi mid-sentence) was exercised against a real session with a loud
  synthetic tone as fake microphone input and did not break the conversation, but was not
  rigorously confirmed frame-by-frame — a synthetic tone's amplitude profile is not the same
  thing as a real interruption, and that distinction matters for a threshold-based detector.
