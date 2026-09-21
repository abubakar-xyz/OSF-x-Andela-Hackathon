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
import { searchCivicRecords } from './civicSearch.mjs';
import { PERSONAS } from '../src/voice/personas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const PORT = 3000;
const getApiKey = () => process.env.WAZI_API_KEY || process.env.GEMINI_API_KEY;
const PACK_ID = process.env.WAZI_PACK || 'ke-siaya';
const VOICE = process.env.WAZI_VOICE || 'Aoede';

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
               '## Civic Initiative and Tools\n' +
               'You have proactive tools to help random citizens across Kenya:\n' +
               '1. Use `check_public_record` for any question about whether something was built, funded, finished, or delivered.\n' +
               '2. Use `search_public_offices` to look up verified contact details, addresses, and statutory jurisdiction for any of Kenya’s 47 counties or national oversight bodies.\n' +
               '3. Use `find_who_is_responsible` to pinpoint the public authority in charge of a project.\n' +
               '4. Use `draft_civic_letter` proactively whenever the citizen wants to take action, write to an office, ask for documents or budget details under the Access to Information Act (ATIA 2016), or prepare a WhatsApp message for local community groups. Do not wait passively—if there is an unresolved discrepancy or an unanswered question, take initiative and offer or generate the draft.\n' +
               '5. While a tool runs, you may speak a short natural filler (e.g. "Let me check the record", or in Kiswahili: "Wacha niangalie rekodi").\n' +
               '6. When a tool returns, convey the finding naturally in the active language (English or Kiswahili) with warmth, precision, and honesty.\n' +
               '7. Never read long numbers, full URLs, or legal citations aloud—they appear on the citizen’s screen.\n' +
               '8. Adaptive response length: For brief banter and quick check-ins, keep answers to 1–2 punchy sentences. When the citizen asks a complex civic question, discusses policy, public finance, procurement, or devolution, or asks for an in-depth breakdown, provide a thorough, complete, and well-structured explanation without arbitrary sentence limits.';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, models: MODELS, pack: PACK_ID, fixture: pack.meta.is_fixture });
});

app.post('/api/civic-search', async (req, res) => {
  try {
    const { what = '', where = '' } = req.body || {};
    const result = await searchCivicRecords({ what, where });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

// Serve static files from repository root
app.use(express.static(rootDir));

// SPA fallback for page navigation
app.use((req, res) => {
  res.sendFile(join(rootDir, 'index.html'));
});

const http = createServer(app);

const wss = new WebSocketServer({ server: http });

wss.on('connection', async (client, req) => {
  const reqUrl = new URL(req?.url || '/', 'http://localhost');
  const resumeParam = reqUrl.searchParams.get('resume');
  const voiceParam = reqUrl.searchParams.get('voice');
  const personaParam = reqUrl.searchParams.get('persona') || 'amina';

  const VALID_VOICES = ['Aoede', 'Puck', 'Kore', 'Charon', 'Fenrir'];
  const persona = PERSONAS[personaParam] || PERSONAS.amina;
  const chosenVoice = VALID_VOICES.includes(voiceParam) ? voiceParam : (persona.voice || VOICE);

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
    /* Everything the workspace needs to render goes straight to the
       browser. The model never sees it. */
    onSurface: (surface) => send('surface', { surface }),
  });

  const model = process.env.WAZI_LIVE_MODEL || MODELS.host;
  const isThinking = model.includes('thinking');

  const personaDirective = persona.promptInstruction
    ? `\n\n## Active Civic Collaborator Persona\n${persona.promptInstruction}\nSpeak with genuine human breath, emotional resonance, authentic East African cadence, and unhurried warmth.`
    : '';

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
      voiceConfig: { prebuiltVoiceConfig: { voiceName: chosenVoice } },
    },
    systemInstruction: { parts: [{ text: SYSTEM + personaDirective }] },
    tools: [{ functionDeclarations: DECLARATIONS }],
    sessionResumption: resumeParam ? { handle: resumeParam } : {},
    contextWindowCompression: { slidingWindow: {} },
    ...(isThinking ? { thinkingConfig: { thinkingLevel: THINKING_LEVEL } } : {}),
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
      send('ready', { model, voice: chosenVoice, persona: persona.id, deep: isThinking, limits: LIMITS });
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
      } else if (m.type === 'language') {
        let langDirective = '';
        if (m.code === 'sw') {
          langDirective = 'The citizen prefers Kiswahili. Speak in natural, fluent, conversational Kenyan Kiswahili, preserving your personality.';
        } else if (m.code === 'en') {
          langDirective = 'The citizen prefers English. Speak in natural East African English, preserving your personality.';
        } else if (m.code === 'sheng') {
          langDirective = 'The citizen prefers Sheng (Nairobi urban dialect). Speak in authentic, lively Kenyan Sheng, blending Kiswahili and English naturally.';
        } else {
          const langLabel = m.name || m.code;
          langDirective = `The citizen prefers ${langLabel} (language code: ${m.code}). Speak, comprehend, and converse fluently in ${langLabel}, preserving your civic companion personality, clarity, and warmth.`;
        }
        session.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: `[System directive: ${langDirective}]` }] }],
          turnComplete: true,
        });
      } else if (m.type === 'moment') {
        const momentDirectives = {
          wake: 'You have just woken up. Greet the person with genuine warmth and friendliness in one short, engaging sentence. Introduce yourself as Wazi, their civic companion, and ask what they would like to look into today.',
          re_wake: 'The person has returned. Give a warm, welcoming, single-sentence check-in: "Welcome back! What are we checking into next?"',
          mode_accountability: 'Active mode is now: Accountability Mode. Be calm, factual, supportive, evidence-first, and distinguish published records from on-site observations.',
          mode_safety: 'Active mode is now: Safety Mode. The person may be in distress. Be warm, protective, gentle, and reassuring. Offer verified emergency hotlines.',
          idle_farewell: 'The person is wrapping up or stepped away. Offer a short, kind farewell: "I will be right here whenever you need me. Stay safe!"',
        };
        const text = momentDirectives[m.moment] || m.prompt || 'Greet the person warmly.';
        session.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: `[Moment instruction: ${text}]` }] }],
          turnComplete: true,
        });
      } else if (m.type === 'persona') {
        const p = PERSONAS[m.persona];
        if (p) {
          session.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: `[Active Collaborator persona updated to ${p.name}: ${p.promptInstruction}]` }] }],
            turnComplete: true,
          });
        }
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
