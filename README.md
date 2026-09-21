# NURU Civic (OSF x Andela Hackathon POC)

NURU Civic is a mobile-first civic companion prototype for the **Information You Can Trust** challenge.

## Tracks
- Primary: Transparency & Accountability
- Secondary: Safety, Reporting & Protection

## What this POC demonstrates
- Companion-first interaction shell with text-first fallback
- Deterministic civic verification flow with evidence states
- Record vs Reality output with provenance and freshness
- Check Again adversarial pass
- Responsible-body/contact routing with verified-route filtering
- Draft Studio outputs (email, formal letter, WhatsApp summary)
- Explicit approval gate before external action preparation

## Architecture (POC)
- `src/engine.js`: tool contracts and trust-state logic
- `src/data/countryPack.js`: flagship jurisdiction pack fixture
- `src/prompts/*`: separated prompt/policy files
- `src/jurisdictions/kenya/pack.json`: country pack artifact
- `src/schemas/evidence-result.schema.json`: evidence schema
- `tests/engine.test.js`: evaluation suite

## Setup
```bash
npm test
npm run start
# open http://localhost:4173
```

## Data provenance and limitations
- The repository includes a clearly scoped demo fixture for Nairobi County.
- Outputs include publication and retrieval metadata.
- This POC does not auto-send external submissions; action prep is simulated.

## Demo path
See `DEMO_SCRIPT.md`.

## Required deliverables included
- `.env.example`
- `DECISIONS.md`
- `THREAT_MODEL.md`
- `ACCESSIBILITY.md`
- `AI_CODING_LOG.md`
- prompt files separated by role
- country pack + schema + tests
