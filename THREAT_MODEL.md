# Threat model

Wazi helps people compare official records with what they can see, and write to the office
responsible. That is a politically consequential act in some places, so the risks here are not
hypothetical.

This document is about **who could be harmed, by what, and what we actually do** — not a list
of mitigations we wish we had.

## Who is at risk

| Who | From what |
|---|---|
| **The person reporting** | Retaliation, identification, having a draft read as an accusation they have to defend |
| **A named individual** | Being publicly accused on the basis of a discrepancy that has an innocent explanation |
| **The institution** | A forwarded card misrepresented as a finding of wrongdoing |
| **Anyone reading a shared card** | Believing a fixture is live government data |

## What we do

### Identification of the reporter

- **No account, no login, no server-side record.** Cases live in IndexedDB on the device.
  There is nothing to breach, subpoena or leak, because there is nothing held.
- **Identity is stored separately from evidence.** Two IndexedDB stores, so deleting personal
  details genuinely leaves the case intact and vice versa (`src/core/store.js`).
- **Personal details are off by default** in every draft. The person opts in, item by item,
  on a screen that shows exactly what goes out (`src/components/disclosure.js`).
- **Location precision defaults to the coarsest** available — county, not a coordinate.
- **Images are re-encoded through a canvas at import**, so EXIF and GPS never reach storage.
  This is deliberately at import rather than export: data that never exists cannot leak later.

**What we do not promise:** anonymity. Once a letter is sent, the recipient knows who sent it.
The disclosure screen says this in those words, and it cannot be dismissed.

### Accusation of an individual

- **Wazi names offices, not people**, unless an official current directory confirms the
  post-holder *and* that confirmation is itself sourced and dated.
- **A forbidden-vocabulary scan runs before anything is spoken or written into an artifact**
  (`src/evidence/safety.js`). "stolen", "corrupt", "fraud", "ghost project", "proves that"
  and percentage confidence are blocked.
- The scan is **negation-aware**: "that isn't proof of anything yet" is the phrasing we want;
  "this is proof of theft" is refused.
- **A photograph is treated as a dated observation**, never as proof of anything. The Two
  Truths card says "Where they differ", never "what they did".

### Misrepresentation of a shared card

The share image is the highest-reach artifact the product makes, so it is the one most likely
to be re-captioned:

- The **evidence state word is baked into the image**, large. A card reading `CONFLICTING`
  cannot be captioned "PROOF OF THEFT" without visibly contradicting itself.
- **Citations with publication dates travel inside the image**, so the card survives scrutiny
  away from the app.
- **Fixture data stamps an amber band across the image**, not just the screen.

### Mistaking a fixture for real data

Law 8 requires three labels, and there are three: the filename prefix (`FIXTURE_`), the
`is_fixture` field in the data, and the ribbon in the interface. A build that dropped the
ribbon would fail `tests/honesty.test.mjs` #16.

### Immediate danger

Wazi is **not an emergency service**. If someone reports immediate danger the machine jumps to
`safety_redirect`, **all verification stops**, and pre-verified local support routes are shown.
No investigation, no open-ended search, no improvisation.

## What we are exposed to, and are not fixing in this build

Stated plainly rather than buried:

| Exposure | Status |
|---|---|
| **The clue extraction is fixture-backed.** A real vision model could misread a signboard and the person could act on it. | Mitigated by design — every clue is editable before use and tagged observed vs inferred — but not by evaluation. Needs testing against real photographs. |
| **Face and licence-plate redaction is not implemented.** | Not offered, therefore not promised. Offering "best-effort" blurring that fails would be worse than not offering it. |
| **A malicious Country Pack could route someone to an attacker-controlled address.** | The validator requires a source and a verification date for every offered route, but it cannot verify that the source is honest. Packs are trusted content and must be reviewed by a human before shipping. |
| **`localStorage` preferences are readable by anything else on the origin.** | Only non-sensitive per-device conveniences are kept there — language and tier. Case data never touches it. |
| **No transport security story, because there is no transport.** | Nothing is sent. When the hosted relay of §23.3 is built, this section needs rewriting. |
| **Device seizure.** | Anyone with the unlocked phone has the cases. `Delete everything` is real and immediate, but there is no duress mode and we do not claim one. |

## What would change if the hosted relay were built

The two-brain architecture (§23.1) keeps tool execution server-side specifically so the client
cannot decide what counts as evidence. That is a *correctness* property, and it comes with a
*privacy* cost: audio and images would leave the device. Before that is built:

- ephemeral tokens, never a long-lived key in the browser
- no raw-audio persistence
- an explicit, visible indication that a hosted model is connected — the current build says the
  opposite, because the opposite is true
