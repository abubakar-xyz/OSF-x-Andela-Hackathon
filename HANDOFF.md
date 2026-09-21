# Wazi — state of things, and how to carry it into Google AI Studio

*Written 21 September 2026, for migrating the voice layer to AI Studio while keeping the
evidence engine that already works.*

---

## 1. The one-paragraph version

Wazi is a civic companion: you hold up your phone at a project that was declared finished and
isn't, it reads the public record back to you, shows where the record and your photograph
disagree, and drafts the letter to the office responsible. **The evidence engine, the trust
rules, the interface and the 3D character are built, tested and working.** The Gemini Live
voice layer is **written against the documented protocol but has never been run against an API
key** — that is the one gap, and it is the part you are taking to AI Studio.

---

## 2. What is DONE and verified

| Area | State | Where |
|---|---|---|
| Evidence engine — verify, challenge, route | **working, tested** | `src/evidence/pipeline.js`, `src/tools/index.js` |
| Trust rules — 5-state ladder, no orphan facts, no percentages | **working, enforced in code** | `src/evidence/{ladder,types,safety}.js` |
| Two Truths card + shareable 1080×1350 PNG | **working** | `src/components/{twoTruths,shareImage}.js` |
| Draft Studio, Disclosure Review, print-to-PDF | **working** | `src/components/{draftStudio,disclosure}.js` |
| State machine with safety invariants | **working, invariants tested** | `src/core/machine.js` |
| Country Pack (7 JSON files) + validator | **working, labelled fixture** | `data/packs/ke-siaya/` |
| 3D avatar (Three.js) with eye, gaze, blink | **working** | `src/character/avatar3d.js` |
| Flat SVG aperture fallback | **working** | `src/character/aperture.js` |
| Local storage, cases, receipts | **working** | `src/core/store.js` |
| 35 unit tests + 9 browser drills + contrast gate | **all green** | `tests/` |
| **Gemini Live relay** | **written, NEVER RUN** | `server/relay.mjs` |
| **Gemini Live browser client** | **written, NEVER RUN** | `src/voice/live.js` |

```bash
npm run check           # 35 tests, 25 contrast pairings, pack validation
npm run verify:browser  # full journey + 9 failure drills, real Chromium
```

---

## 3. What is NOT done — read this first

1. **Nothing has ever run against a Gemini API key.** The relay refuses to start without one
   and reports `unavailable` on a bad one (that path *is* tested), but no live conversation has
   ever happened. **This is the whole reason for the migration.**
2. **The Country Pack is entirely synthetic.** Labelled three ways and enforced by a test, but
   there is no real civic case yet. `data/packs/ke-siaya/PROVENANCE.md` has the sign-off table.
3. **Clue extraction from photographs is fixture-backed.** The shape (observed vs inferred,
   editable before use) is real; the vision call is not wired.
4. **Tone adaptation is not available.** `enable_affective_dialog` was removed from the API.
   Language adaptation *is* available and automatic.

---

## 4. The architecture, and the one decision that matters

```
microphone ──16kHz PCM16──┐
camera frames ────────────┤
text ─────────────────────┤
                          ▼
              ┌───────────────────────┐
              │  THE HOST             │   gemini-3.8-live
              │  conversation only    │   or -extended-thinking
              │  NEVER holds a fact   │
              └──────────┬────────────┘
                         │ function call (NON_BLOCKING)
                         ▼
              ┌───────────────────────┐
              │  THE WORKER (ours)    │   src/evidence/pipeline.js
              │  runs SERVER-side     │   runs the real tools
              └──────────┬────────────┘
                         │ validated payload
                         ▼
              ┌───────────────────────┐
              │  THE RENDERER         │   <Fact> refuses to render
              │  deterministic        │   anything unsourced
              └───────────────────────┘
```

**The decision to preserve through the migration:** the Live model is a *narrator*, not a
source. Its tools return one or two sentences of already-decided language plus a pointer to
what is on screen — **never the evidence itself**. That is why it cannot invent a contract
figure: it never holds one. See `server/tools.bridge.mjs`.

If you re-implement in AI Studio and let the model see raw evidence, you lose the property the
whole product is built on.

---

## 5. Exact Live API configuration as built

From Google's own `gemini-live-api-dev` skill, vendored at
`.claude/skills/gemini-live-api-dev/SKILL.md` — read it, it is authoritative.

```js
// server/relay.mjs
const ai = new GoogleGenAI({ apiKey: process.env.WAZI_API_KEY });

session = await ai.live.connect({
  model: 'gemini-3.8-live',            // or 'gemini-3.8-live-extended-thinking'
  config: {
    responseModalities: ['AUDIO'],     // AUDIO *or* TEXT, never both
    inputAudioTranscription: {},       // captions for what the person said
    outputAudioTranscription: {},      // captions for what Wazi said
    speechConfig: {
      voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
    },
    systemInstruction: { parts: [{ text: SYSTEM }] },
    tools: [{ functionDeclarations: DECLARATIONS }],   // all NON_BLOCKING
    sessionResumption: {},
    contextWindowCompression: { slidingWindow: {} },
    // thinkingConfig ONLY on -extended-thinking; it errors on plain 3.8-live
    thinkingConfig: { thinkingLevel: 'low' },
  },
  callbacks: { onopen, onmessage, onerror, onclose },
});
```

### Protocol facts that cost time to learn

| | |
|---|---|
| Input audio | raw PCM16 mono **16 kHz**, base64, `audio/pcm;rate=16000` |
| Output audio | raw PCM16 mono **24 kHz** |
| Send realtime | `sendRealtimeInput({ audio: { data, mimeType } })` — also for text and video |
| Inject a turn | `sendClientContent({ turns: [...], turnComplete: true })` — **interrupts generation** |
| Barge-in signal | `serverContent.interrupted === true` → drop the playback queue |
| **Idle signal** | `interactionStatus` `IDLE`. **`turnComplete` is NOT idle** on extended-thinking |
| Session limits | audio-only 15 min · audio+video 2 min · connection ~10 min · context 128k/64k |
| Removed | `enable_affective_dialog` (gone), `proactive_audio: false` (errors — it's always on) |
| Multiple parts | one server event can carry several parts — **process all of them** |

---

## 6. Four things your SABI writeup caught that were wrong here

All four are now fixed in this repo. They are worth carrying over.

1. **No voice was ever selected.** There was no `speechConfig` at all, so the voice was
   whatever the default happened to be. Now `WAZI_VOICE` (default `Kore`).
2. **No accent or register guidance.** Added `prompts/voice_persona.md` — East African
   English, free Kiswahili code-switching, follow the person's language without announcing it.
   Native-audio models pick the language themselves, so there is deliberately **no language
   code**; the register comes from the prompt, exactly as SABI does it.
3. **Self-interruption.** The barge-in gate was `rms > 0.06` with no guarding, so Wazi would
   have cut itself off on its own speaker bleed. Now: higher threshold while speaking (0.115
   vs 0.045), sustained over 3 frames, with a 900 ms grace window at the start of each turn.
4. **Jitter buffer was 20 ms.** Far too tight; the queue underran between chunks. Now 150 ms,
   matching your number.

### One place this build differs from SABI deliberately

SABI keeps `let globalGeminiSession` — one session for everyone. Wazi opens **a session per
WebSocket connection**, with its own tool runner and its own case state
(`server/relay.mjs`, inside `wss.on('connection')`). Keep that. A shared session leaks one
person's civic case into another person's conversation, which for this product is not a bug,
it is a harm.

### And one policy that needed correcting

`conversation_policy.md` said "never imitate an accent." That was too blunt — read literally it
makes Wazi sound like a foreigner reading a script to the people it is for. `voice_persona.md`
splits it properly: **speak naturally in the person's language including Kenyan English and
Kiswahili; never caricature, and never mimic an individual's accent back at them.** Sounding
local is respect; mimicking someone is mockery.

---

## 7. Running it as it stands

```bash
npm install                              # also vendors three.js into assets/
npm start                                # http://localhost:4173 — works with NO key
WAZI_API_KEY=your-key npm run relay      # the Live path
# then set <meta name="wazi-relay" content="ws://localhost:8787"> in index.html
```

Without a relay the app falls back to the browser speech engine **and says so in the UI** —
that honesty is deliberate and is worth keeping.

---

## 8. The nine rules that make this product what it is

If the migration keeps nothing else, keep these. They are in `DESIGN.md` §6 and each one is
enforced somewhere in code, not just written down.

1. Wazi never states a civic fact it did not retrieve.
2. Every displayed fact carries a source, a publication date and a retrieval date.
3. A photograph is a dated observation, never proof of wrongdoing.
4. Absence of evidence is reported as absence of evidence, never as disproof.
5. Name offices, not people.
6. Nothing leaves the device without an explicit human approval screen.
7. Every voice path has a complete text path.
8. Simulated actions are labelled simulated — in the UI *and* in the artifact.
9. Never claim protection that does not exist — no anonymity, no privilege, no guaranteed reply.

---

## 9. Files to take, in priority order

| File | Why |
|---|---|
| `server/relay.mjs` | the Live session, tool execution, barge-in, resumption |
| `server/tools.bridge.mjs` | **the two-brain boundary** — the most important file here |
| `src/voice/live.js` | capture, playback, jitter buffer, self-interruption guarding |
| `prompts/voice_persona.md` | how it sounds |
| `prompts/identity.md` + `safety_policy.md` | who it is and what it may never say |
| `src/evidence/` (whole directory) | the engine — no Gemini dependency, portable as-is |
| `data/packs/ke-siaya/` | the pack schema and the fixture |
| `.claude/skills/gemini-live-api-dev/` | Google's own current docs, vendored |
| `DESIGN.md` | the full specification |
| `DECISIONS.md` | every deviation and why, including the ones I got wrong |

---

## 10. What I would do first in AI Studio

1. **Drop in a key and run the relay.** Everything else is guesswork until a real session
   opens. Expect the first bugs to be in audio format and in `interactionStatus` handling.
2. **Listen to the voice with `voice_persona.md` loaded**, and tune the prompt — that is the
   entire accent-and-personality mechanism, as your SABI writeup correctly identifies.
3. **Then, and only then**, get one real civic case into the pack. Everything is built to
   receive it: seven JSON files, zero application code.

The honest summary: **the hard, unglamorous half — the evidence, the trust rules, the
refusals, the interface — is done and tested. The half that makes people fall in love with it
has never been switched on.**
