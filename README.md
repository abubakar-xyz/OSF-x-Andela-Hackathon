# wazi

**Kiswahili: open, clear, plain.**

> Hold up your phone. Wazi reads the public record back to you, shows you where it does not
> match what you are looking at, and writes the letter to the office that owes you an answer.

Andela × Open Society Foundations 2026 civic-tech hackathon — *Information You Can Trust*.
Primary track: **Transparency & Accountability**. Secondary: **Safety, Reporting & Protection**.

Formerly briefed as *NURU Civic*. Renamed — the reasoning is in [`DESIGN.md §1`](DESIGN.md).

---

## The design

Everything needed to build this product lives in one file:

### 👉 **[`DESIGN.md`](DESIGN.md)**

The idea and the name · who it's for · what we borrowed from civic tech that actually reached
millions · the seven product decisions · the nine Product Laws · the character · the voice ·
design tokens · every component · the Two Truths card · the state machine · the evidence model ·
the architecture · the tool contracts · the data pack · performance budgets · accessibility ·
the build sequence · the tests · the three-minute demo.

## Status

Design complete. Implementation follows the build sequence in `DESIGN.md §30`.

Step 1 is not writing code — it is listing the models actually available in the team's API
project and choosing by capability. Step 5 is verifying, by hand, the one real civic case this
whole thing stands on. Nothing in the demo is real until that is done.

## Principles, in short

Wazi never states a civic fact it did not retrieve. Every number on screen carries its source,
its publication date and the date we fetched it. A photograph is a dated observation, never a
proof of wrongdoing. Absence of evidence is reported as absence of evidence. Nothing leaves the
device without a human approving exactly what goes out. There are no confidence percentages —
there is a five-rung evidence ladder that includes *"I don't have enough to say either way."*

The full nine are in `DESIGN.md §6`.
