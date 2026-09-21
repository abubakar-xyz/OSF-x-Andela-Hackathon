# Provenance — `ke-siaya` Country Pack

## Status: **DEMO FIXTURE. NOT LIVE GOVERNMENT DATA.**

Every record in this pack is synthetic. It is modelled on the *shape* of real Kenyan
open-contracting returns, Gazette notices, Auditor-General extracts and county directory
entries, so that the engine, the schemas and the interface are exercised honestly. It is not
sourced from those systems, and all URLs resolve to `example-fixture.invalid`, which cannot
be registered.

`DESIGN.md` §6 Law 8 requires fixtures to be labelled three times. They are:

1. **Filename / directory** — fixture assets are prefixed `FIXTURE_`.
2. **Data** — every source object carries `"is_fixture": true`, and `pack.json` carries a
   `fixture_notice`.
3. **Interface** — any payload containing a fixture source forces the amber
   `Demo data — clearly labelled fixture` ribbon to render. This is asserted by
   `tests/honesty.test.js` #16, so it cannot be silently removed.

## What must happen before any public demonstration

`DESIGN.md` Appendix D question 1 names this as the highest-risk open item in the project,
and it is not a coding task:

| # | Required | Who |
|---|---|---|
| 1 | Choose **one real** public project or service issue in a chosen jurisdiction | team |
| 2 | Retrieve the authoritative record and record its **exact official wording**, verbatim | named human |
| 3 | Record publication date and retrieval date for every source | named human |
| 4 | Identify the responsible institution and a **genuinely published** contact route | named human |
| 5 | Confirm the complaint / information-request procedure and any statutory deadline | named human |
| 6 | Obtain a current dated field photograph, or label the stand-in as a fixture | named human |
| 7 | Find an independent credible source where one exists | named human |
| 8 | Write down the known data-quality limitations of each source | named human |

Each row must be signed off in the table below with a name and a date. Until it is, the
pack stays `"is_fixture": true` and the interface keeps saying so.

| Record | Checked by | Date | Method |
|---|---|---|---|
| _(none yet — this pack is entirely fixture)_ | — | — | — |

## Why the variation notice is hidden from the first pass

`rec-bondo-variation` carries `"discoverable_only_on_challenge": true`. This is deliberate and
it is the one piece of stagecraft in the pack: it models the real and very common situation
where a newer record exists but is not returned by the obvious query. It exists so that
**Check Again can genuinely overturn the first verdict** (`DESIGN.md` §20) rather than
rubber-stamping it, and `tests/honesty.test.js` #7 fails the build if it cannot.

When this pack is replaced with real records, that flag must be re-earned honestly — either
by a record that genuinely requires a second, differently-framed query, or by removing the
demo of the overturn.
