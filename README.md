# wazi

**Kiswahili: open, clear, plain.**

> Hold up your phone. Wazi reads the public record back to you, shows you where it does not
> match what you are looking at, and writes the letter to the office that owes you an answer.

Andela × Open Society Foundations 2026 civic-tech hackathon — *Information You Can Trust*.

## Tracks

- **Primary: Transparency & Accountability**
- **Secondary: Safety, Reporting & Protection**

---

## The design

Everything needed to build this product lives in one file:

### 👉 **[`DESIGN.md`](DESIGN.md)**

The idea and the name · who it's for · what we borrowed from civic tech that actually reached
millions · the seven product decisions · the nine Product Laws · the character · the voice ·
design tokens · every component · the Two Truths card · the state machine · the evidence model ·
the architecture · the tool contracts · the data pack · performance budgets · accessibility ·
the build sequence · the tests · the three-minute demo.

### The rename

This project was briefed as **NURU Civic**. It is now **Wazi** — *serikali wazi* is the standing
Kiswahili phrase for open government, *sema wazi* means speak plainly, and a product that will
often have to say "I don't know" cannot be named after truth. Reasoning in
[`DESIGN.md §1`](DESIGN.md).

> **The rename is not yet applied to the code.** `src/` still carries the NURU name from the
> baseline POC. That is tracked as the next change, not an oversight.

---

## What the current POC demonstrates

A deterministic baseline, ahead of the design in `DESIGN.md` being implemented:

- Companion-first interaction shell with text-first fallback
- Deterministic civic verification flow with evidence states
- Record vs Reality output with provenance and freshness
- Check Again adversarial pass
- Responsible-body / contact routing with verified-route filtering
- Draft Studio outputs (email, formal letter, WhatsApp summary)
- Explicit approval gate before external action preparation

## Architecture (current POC)

| Path | What it holds |
|---|---|
| `src/engine.js` | tool contracts and trust-state logic |
| `src/data/countryPack.js` | flagship jurisdiction pack fixture |
| `src/prompts/*` | separated prompt / policy files |
| `src/jurisdictions/kenya/pack.json` | country pack artifact |
| `src/schemas/evidence-result.schema.json` | evidence schema |
| `tests/engine.test.js` | evaluation suite |

The target architecture — the two-brain split, the state machine, the component library — is
specified in `DESIGN.md §16`, `§23` and `§24`.

## Setup

```bash
npm test
npm run start
# open http://localhost:4173
```

## Data provenance and limitations

- The repository includes a **clearly labelled demo fixture** for Nairobi County. It is not
  live government data and is not presented as such.
- Outputs carry publication and retrieval metadata.
- This POC does **not** auto-send external submissions. Action preparation is simulated, and
  labelled simulated.
- The flagship case is not yet backed by a hand-verified real record. `DESIGN.md §25` and
  Appendix D name this as the highest-risk open item.

## Demo path

See [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md). The target three-minute choreography is in
`DESIGN.md §32`.

## Principles, in short

Wazi never states a civic fact it did not retrieve. Every number on screen carries its source,
its publication date and the date we fetched it. A photograph is a dated observation, never a
proof of wrongdoing. Absence of evidence is reported as absence of evidence. Nothing leaves the
device without a human approving exactly what goes out. There are no confidence percentages —
there is a five-rung evidence ladder that includes *"I don't have enough to say either way."*

The full nine Product Laws are in `DESIGN.md §6`.

## Required deliverables

- [`.env.example`](.env.example) — no credentials
- [`DESIGN.md`](DESIGN.md)
- [`DECISIONS.md`](DECISIONS.md)
- [`THREAT_MODEL.md`](THREAT_MODEL.md)
- [`ACCESSIBILITY.md`](ACCESSIBILITY.md)
- [`AI_CODING_LOG.md`](AI_CODING_LOG.md)
- [`HACKATHON_SUMMARY.md`](HACKATHON_SUMMARY.md)
- prompt files separated by role — `src/prompts/`
- country pack + schema + tests
