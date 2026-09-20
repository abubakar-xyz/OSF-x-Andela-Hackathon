# DECISIONS

1. **Deterministic offline-first POC first**: Implemented a static mobile-first PWA shell and deterministic evidence engine before live API integration to maximize demo reliability under low bandwidth.
2. **Strict evidence states over confidence scores**: Used claim-level states (VERIFIED/CORROBORATED/REPORTED/CONFLICTING/UNKNOWN) with explicit provenance metadata.
3. **Verified contact route filtering**: Only verified office routes are returned; unverified personal-like addresses are excluded from action outputs.
