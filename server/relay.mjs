#!/usr/bin/env node
/**
 * Wazi relay.  DESIGN.md §23.3–§23.5.
 *
 * The browser talks to this; this talks to Gemini. The API key never
 * leaves the server, and every tool executes here, because a client that
 * runs its own tools is a client that decides what counts as evidence.
 *
 *     WAZI_API_KEY=... npm run relay
 *
 * Protocol details follow Google's own gemini-live-api-dev skill,
 * vendored at .claude/skills/gemini-live-api-dev/.
 */

import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { GoogleGenAI } from '@google/genai';

import { MODELS, AUDIO, LIMITS, THINKING_LEVEL } from './models.config.mjs';
import { DECLARATIONS, createToolRunner } from './tools.bridge.mjs';
import { validatePack, PACK_FILES } from '../src/evidence/pack.js';
import { searchPublicRecords } from './webSearch.mjs';
import { CIVIC_COUNTRIES, CIVIC_CATEGORIES } from '../src/evidence/civicScope.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const PORT = 3000;
const getApiKey = () => process.env.WAZI_API_KEY || process.env.GEMINI_API_KEY;
const PACK_ID = process.env.WAZI_PACK || 'ke-siaya';
const VOICE = process.env.WAZI_VOICE || 'Kore';

if (!getApiKey()) {
  console.warn(
    '\n  [Wazi] GEMINI_API_KEY / WAZI_API_KEY is not set.\n' +
    '  The relay is running in standby mode. WebSocket sessions will report unavailable\n' +
    '  until an API key is set in your environment. In the meantime, Wazi will use\n' +
    '  the browser on-device speech engine as designed.\n'
  );
}

/* The pack is loaded once, here, and never shipped to the model. */
const raw = {};
for (const f of PACK_FILES) raw[f] = JSON.parse(readFileSync(join(rootDir, `data/packs/${PACK_ID}/${f}.json`), 'utf8'));
const packResult = validatePack(raw);
if (!packResult.ok) {
  console.error(`  pack ${PACK_ID} is invalid:\n   ${packResult.errors.join('\n   ')}`);
  process.exit(1);
}
const pack = packResult.pack;

const SYSTEM = readFileSync(join(rootDir, 'prompts/identity.md'), 'utf8') + '\n\n' +
               readFileSync(join(rootDir, 'prompts/voice_persona.md'), 'utf8') + '\n\n' +
               readFileSync(join(rootDir, 'prompts/conversation_policy.md'), 'utf8') + '\n\n' +
               readFileSync(join(rootDir, 'prompts/evidence_policy.md'), 'utf8') + '\n\n' +
               readFileSync(join(rootDir, 'prompts/safety_policy.md'), 'utf8') + '\n\n' +
               'You have tools. Use check_public_record for any question about whether ' +
               'something was built, funded, finished or delivered — never answer such a ' +
               'question from your own knowledge. While a tool runs you may speak a short ' +
               'natural filler such as "let me check the records". When a tool returns, say ' +
               'the `say` field it gives you, in your own rhythm, and nothing beyond it. ' +
               'Never read figures, dates, source names or reference numbers aloud — they are ' +
               'on screen.';

/* One search client, reused. Built lazily so a key set after boot (or
   never set at all) doesn't crash the process — the same "degrade, don't
   die" posture as the WebSocket path below. */
let searchAI = null;
const getSearchAI = () => {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  if (!searchAI) searchAI = new GoogleGenAI({ apiKey });
  return searchAI;
};

/** Injected into the tool runner, and used directly by /api/civic-search.
 *  Never constructs its own network call outside webSearch.mjs, so both
 *  paths stay honest in exactly the same way. */
const search = (query, context) => {
  const ai = getSearchAI();
  if (!ai) return Promise.resolve({ ok: false, reason: 'no search capability configured' });
  return searchPublicRecords({ ai, model: MODELS.worker, query, context });
};

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, models: MODELS, pack: PACK_ID, fixture: pack.meta.is_fixture, search: Boolean(getApiKey()) });
});

/* For the deterministic/typed path, which runs in the browser with no
   live WebSocket session — it still deserves a real search, not just the
   live-voice path. Same honest primitive either way. */
app.post('/api/civic-search', async (req, res) => {
  const { query, context } = req.body ?? {};
  if (!query || typeof query !== 'string') {
    res.status(400).json({ ok: false, reason: 'query is required' });
    return;
  }
  const r = await search(query, typeof context === 'string' ? context : '');
  res.json(r);
});

/* The categories and countries are static (§ civicScope.js) — no network,
   nothing to go stale — so the browser can always ask for the list even
   offline. Which of a country's institutions actually has a live,
   current URL is resolved through /api/civic-search, not here. */
app.get('/api/civic-scope', (req, res) => {
  res.json({ countries: CIVIC_COUNTRIES, categories: CIVIC_CATEGORIES });
});

// Serve static files from repository root
app.use(express.static(rootDir));

// SPA fallback for page navigation
app.use((req, res) => {
  res.sendFile(join(rootDir, 'index.html'));
});

const http = createServer(app);

const wss = new WebSocketServer({ server: http });

wss.on('connection', async (client) => {
  const send = (type, data) => {
    if (client.readyState === 1) client.send(JSON.stringify({ type, ...data }));
  };

  const apiKey = getApiKey();
  if (!apiKey) {
    send('unavailable', {
      reason: 'WAZI_API_KEY / GEMINI_API_KEY is not set. Falling back to on-device speech.',
    });
    return;
  }

  const ai = new GoogleGenAI({ apiKey });

  let session = null;
  let resumptionHandle = null;
  let closed = false;
  /* `onopen` fires when the socket opens, which is before we know the
     key is good. Claiming a hosted model is connected when it is not
     would break Law 8, so the browser is not told "ready" until a real
     server message has arrived. */
  let proven = false;
  const opened = Date.now();

  const runner = createToolRunner({
    pack,
    online: true,
    search,
    /* Everything the workspace needs to render goes straight to the
       browser. The model never sees it. */
    onSurface: (surface) => send('surface', { surface }),
  });

  const useDeep = process.env.WAZI_USE_DEEP !== '0';
  const model = useDeep ? MODELS.deep : MODELS.host;

  const config = {
    responseModalities: ['AUDIO'],
    /* AUDIO or TEXT, never both — so captions come from transcription. */
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    /* The base voice. An earlier version set no speechConfig at all,
       which left the voice to whatever the default happened to be —
       the single biggest thing standing between this and a character
       that sounds like anyone in particular.
       Native-audio models pick the LANGUAGE themselves from what they
       hear, so there is deliberately no language code here: the
       register comes from prompts/voice_persona.md instead. */
    speechConfig: {
      voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
    },
    systemInstruction: { parts: [{ text: SYSTEM }] },
    tools: [{ functionDeclarations: DECLARATIONS }],
    sessionResumption: {},
    contextWindowCompression: { slidingWindow: {} },
    ...(useDeep ? { thinkingConfig: { thinkingLevel: THINKING_LEVEL } } : {}),
  };

  try {
    session = await ai.live.connect({
      model,
      config,
      callbacks: {
        onopen: () => { /* socket up; not yet proven — see `proven` */ },
        onerror: (err) => send('error', { message: String(err?.message ?? err) }),
        onclose: (e) => {
          if (closed) return;
          if (!proven) {
            /* Died before a single server message: almost always a bad
               or unauthorised key. Say so, and tell the browser to fall
               back rather than sit in a silent "live" state. */
            send('unavailable', {
              reason: e?.reason || 'the live session closed before it produced anything — check WAZI_API_KEY',
            });
          } else {
            send('closed', {});
          }
        },
        onmessage: (msg) => handleServerMessage(msg),
      },
    });
  } catch (err) {
    send('error', { message: `could not open a live session: ${err?.message ?? err}` });
    client.close();
    return;
  }

  async function handleServerMessage(msg) {
    if (!proven) {
      proven = true;
      send('ready', { model, deep: useDeep, limits: LIMITS });
    }
    const content = msg.serverContent;

    /* A single event can carry several parts. Process all of them. */
    if (content?.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        if (part.inlineData?.data) send('audio', { pcm: part.inlineData.data, rate: AUDIO.outputRate });
      }
    }
    if (content?.inputTranscription?.text) send('heard', { text: content.inputTranscription.text });
    if (content?.outputTranscription?.text) send('said', { text: content.outputTranscription.text });

    /* Barge-in. Tell the browser to drop its queue immediately. */
    if (content?.interrupted === true) send('interrupted', {});

    /* turnComplete does NOT mean idle on the extended-thinking model —
       background reasoning and async tool calls continue after it. The
       character leaves `working` on interactionStatus, not on this. */
    if (content?.turnComplete) send('turn_complete', {});
    const status = msg.interactionStatus ?? msg.interaction_status;
    if (status) send('status', { status });

    if (msg.sessionResumptionUpdate?.resumable && msg.sessionResumptionUpdate.newHandle) {
      resumptionHandle = msg.sessionResumptionUpdate.newHandle;
    }
    if (msg.goAway) send('go_away', { timeLeft: msg.goAway.timeLeft });
    if (msg.setupComplete) send('setup_complete', {});

    if (msg.toolCall?.functionCalls?.length) {
      for (const call of msg.toolCall.functionCalls) {
        let response;
        try {
          response = await runner.run(call.name, call.args ?? {});
        } catch (err) {
          /* A tool failure is a product state, never an invitation to
             improvise. The model is told exactly what to say. */
          response = { error: true, say: `I couldn't complete that check: ${err?.message ?? err}. I won't guess at it.` };
          send('surface', { surface: { kind: 'tool_failed', tool: call.name, reason: String(err?.message ?? err) } });
        }
        try {
          session.sendToolResponse({
            functionResponses: [{ id: call.id, name: call.name, response }],
          });
        } catch (err) {
          send('error', { message: `tool response rejected: ${err?.message ?? err}` });
        }
      }
    }
  }

  client.on('message', (buf) => {
    let m;
    try { m = JSON.parse(buf.toString()); } catch { return; }
    if (!session) return;

    try {
      if (m.type === 'audio') {
        session.sendRealtimeInput({ audio: { data: m.pcm, mimeType: AUDIO.inputMime } });
      } else if (m.type === 'audio_end') {
        session.sendRealtimeInput({ audioStreamEnd: true });
      } else if (m.type === 'text') {
        session.sendRealtimeInput({ text: m.text });
      } else if (m.type === 'image') {
        session.sendRealtimeInput({ video: { data: m.jpeg, mimeType: 'image/jpeg' } });
      } else if (m.type === 'say_first') {
        /* Wazi opens the conversation. §5 Decision 3 — the character
           speaks first, unprompted, and this is how. */
        session.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: m.text }] }],
          turnComplete: true,
        });
      }
    } catch (err) {
      send('error', { message: String(err?.message ?? err) });
    }
  });

  client.on('close', () => {
    closed = true;
    try { session?.close(); } catch { /* already gone */ }
  });

  /* Connections last about ten minutes. Warn the browser before the
     server does, so a reconnect looks deliberate rather than broken. */
  const warn = setTimeout(() => {
    send('expiring', { resumptionHandle, afterMs: Date.now() - opened });
  }, LIMITS.connectionLifetimeMs - 45_000);
  client.on('close', () => clearTimeout(warn));
});

http.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Wazi server running on http://0.0.0.0:${PORT}`);
  console.log(`  host model   ${MODELS.host}`);
  console.log(`  deep model   ${MODELS.deep}  (thinking_level: ${THINKING_LEVEL})`);
  console.log(`  voice        ${VOICE}`);
  console.log(`  pack         ${PACK_ID}${pack.meta.is_fixture ? '  [DEMO FIXTURE]' : ''}`);
  console.log(`  tools        ${DECLARATIONS.map((d) => d.name).join(', ')}`);
});
