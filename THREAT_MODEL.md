# THREAT_MODEL

## Key risks
- Hallucinated civic facts or contact routes
- Accidental disclosure of personal/sensitive details
- Implicit external action without approval

## Controls in this POC
- Deterministic evidence-state logic with UNKNOWN fallback on missing entities/tool failure
- Verified-contact filtering and disclosure toggles
- `prepare_external_action` blocks unless explicit approval is true
