# Hackathon summary

## Wazi

*Kiswahili: open, clear, plain.*

> Hold up your phone. Wazi reads the public record back to you, shows you where it does not
> match what you are looking at, and writes the letter to the office that owes you an answer.

**Andela × Open Society Foundations 2026 — *Information You Can Trust***
Primary track: **Transparency & Accountability**. Secondary: **Safety, Reporting & Protection**.

## The problem

Public information exists, and is useless to most people who need it. It is in a format they
cannot read, in a language they do not use, behind a portal they cannot reach on the data they
have — and even when they find it, the hard part is still ahead: knowing **which office** is
responsible and **how to write to it** in terms it will answer.

mySociety's long experience is the evidence: the bottleneck in civic action is not motivation.
It is addressing the envelope.

## What Wazi does

Three things, tightly connected:

1. **Understand** — explains a public record in plain language, in English or Kiswahili, by voice.
2. **Verify** — puts the official record and your own dated photograph side by side on one
   card, with every number tappable to its source, and assigns a claim-level evidence state.
3. **Act** — finds the responsible office and a **verified** contact route, and drafts the
   email, letter or WhatsApp message, with citations, for you to review and send.

## What makes it different

- **It speaks first.** No start button after the first launch, no menu, no account. One tap,
  ever, and thereafter the app is already awake when you get there.
- **The AI's work is visible.** Each running tool is a labelled orbiting mote — including
  *"Trying to prove myself wrong."* There is no spinner anywhere in the product.
- **The Two Truths card** puts record and reality on one object, shareable as an image with
  the verdict and the citations baked in. Distribution is a design problem; WhatsApp is the
  answer.
- **Check Again can lose the argument.** The adversarial second pass genuinely overturns the
  first verdict in the demo, shows the old one struck through, and says *"I was wrong."*
- **No confidence percentages.** A five-rung evidence ladder with fixed words, including
  *"I don't have enough to say either way."*
- **No orphan facts.** A `<Fact>` cannot render without a resolvable source. It is a
  code-enforced rule, not a guideline.

## How it is built

A **zero-dependency static PWA**. 67 KB of gzipped JavaScript, 82 KB total first load — against
budgets of 180 KB and 400 KB. No framework, no build step, nothing to fail on stage. Voice runs
on the browser's own speech engine, so it works with **no API key, no server and no network**.

The reliability decision that matters is the **two-brain split**: the conversational layer is a
narrator that never holds a fact, and a separate worker produces schema-validated evidence. A
payload whose facts do not resolve is rejected at the boundary rather than shown.

## Scale

Adding a jurisdiction is **seven JSON files and zero application code**, refused by
`npm run validate:pack` if a record lacks verbatim official wording, a route claims
verification without a source, or a deadline has no citation. Storage is local-first, so there
is no per-user server cost and no honeypot of citizen reports.

## What is honest about this build

- **The Country Pack is a labelled demo fixture.** Not live government data, labelled three
  times — filename, data field, and an amber ribbon in the interface that a test enforces.
- **No hosted model is connected.** The realtime path is specified and stubbed, and the
  interface says which engine is actually running.
- **The flagship case is synthetic.** `PROVENANCE.md` carries the sign-off table a named human
  must complete before any public demonstration. This is the highest-risk open item and it is
  not a coding task.

## Verification

```
npm run check     # pack validation + contrast gate + 34 tests
```

The sixteen honesty tests of `DESIGN.md` §31 assert the claims this summary makes — that an
unsupported claim never renders, that missing evidence produces UNKNOWN rather than disproof,
that Check Again can overturn, that no unverified contact is ever offered, that no external
action is reachable without explicit approval, and that a draft contains exactly what the
disclosure settings allow.

## The only metric that matters

Amina sends the WhatsApp summary. The chairman's office replies.
