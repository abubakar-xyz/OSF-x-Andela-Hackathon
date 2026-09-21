# Demo script — three minutes

Rehearse to the second. **Everything runs from a cached pack, so venue wi-fi cannot kill it** —
say that on stage, because it is itself the low-bandwidth story.

```bash
npm start          # http://localhost:4173
```

| Time | On screen | Spoken | The point |
|---|---|---|---|
| **0:00–0:15** | Black. One line: *"Tap once. After this, I'm just here."* Tap. The aperture blooms, a warm triad plays. | Wazi: *"Hey. I'm Wazi — it means open. Show me something, or just tell me what's bothering you."* | It speaks first. No button was pressed. |
| **0:15–0:35** | Tap **Show**. The project signboard. | Wazi, unprompted: *"That's a project board. Want me to check what the record says?"* | It sees. It is outgoing. |
| **0:35–0:50** | Six clue rows, tagged **observed** / **inferred**. **Edit one on stage** — change the location. | *"Tell me if I've got any of this wrong."* | The human owns the input. The dotted rows are guesses and say so. |
| **0:50–1:20** | Tap **Check this**. The world shifts: aperture shrinks to the corner, paper rises, **labelled motes orbit** — *Matching the project · Checking the records · Looking for anything newer · Comparing*. Cards land as they resolve. | status lines only | The AI's work is legible. No spinner exists in this product. |
| **1:20–1:50** | **The Two Truths card.** Record: *"Project status: Completed"*, 14 Mar 2023, quoted verbatim in serif. Reality: the dated photo, roof absent. Then **⬡ CONFLICTING**, and — alone, 240 ms later, in silence — *Where they differ*. | *"The record says completed, March 2023. What you're showing me doesn't look complete. That's a difference worth an answer — it isn't proof of anything yet."* | **The money shot.** The restraint is the flex. Tap any number: its source rises. |
| **1:50–2:10** | Tap **Check again**. The mote says *Trying to prove myself wrong*. The verdict changes to **REPORTED**, with **was: CONFLICTING** struck through and the reason below it. | *"I was wrong. A newer notice varies the scope and moves completion."* | An AI that publicly corrects itself. Nobody else will demo this. |
| **2:10–2:30** | Tap **Take action**. The responsible office, the verified email, `verified 19 Sep 2026`, and **why this office** — with its own source. | *"This is the office responsible. Here's why, and where that came from."* | mySociety's lesson: the hard part is addressing the envelope. |
| **2:30–2:45** | Draft Studio. Switch **Email → Formal letter** — it renders as a letter. Switch to **WhatsApp summary** — a forwardable message. Then **Share as image** on the evidence card. | — | The artifact, and its distribution. |
| **2:45–2:57** | **Review what's shared.** Everything personal is already off. Switch location from exact to **county only**. Export the PDF — `SIMULATED — NOT DELIVERED` is stamped on it. | *"Wazi can't promise you'll get a reply, and can't keep you anonymous once you send this."* | Honesty as a feature. Human approval as a gate. |
| **2:57–3:00** | Case receipt: `WZ-…`. Aperture returns to resting. | *"Public information only becomes power when someone can connect it to what they see, understand what it means, and reach the office that can act."* | Close. |

## Failure drills — rehearse these too

A team that can demo its own failure modes is the team the judges believe. Each is reachable:

| Drill | How | What should happen |
|---|---|---|
| **Nothing found** | Type *"Is the Kisumu flyover finished?"* | *"That doesn't mean it isn't real — it means it isn't where I can see."* Never "it does not exist". |
| **Wrong project** | On the card, tap **Not this one?** | The near-miss with the similar name is offered. Re-runs cleanly. |
| **No verified contact** | The water entity's only route is unverified | Wazi refuses to give an address it has not checked, and says why. |
| **Offline** | Devtools → offline, reload | The cached pack still answers. *"I just can't check for anything newer."* The failed check appears on the card. |
| **Mic denied** | Block the mic and reload | Complete text journey to the same PDF. |
| **Reduced motion** | OS setting, reload | Motes become a static checklist with the same labels. |

## What to say if asked "is this real data?"

Say the true thing, and say it first: **no, this pack is a labelled fixture.** Then point at
the amber ribbon on screen, the `is_fixture` fields in `data/packs/ke-siaya/`, and
`PROVENANCE.md`, which carries the sign-off table a named human has to complete before any
real deployment. Presenting synthetic data as live government data is the one thing this
product exists to make harder.
