/**
 * Wazi — application shell.  DESIGN.md §14–§17.
 *
 * Wires the character, the machine, the pipeline and the surfaces.
 * Everything factual comes from the pipeline; this file only arranges it
 * and decides what Wazi says about it — the two-brain split of §23.1,
 * with the conversational half reduced to a narrator.
 */

import { el, clear, $, fmtDate } from './core/dom.js';
import { bus } from './core/bus.js';
import { createMachine, APERTURE_FOR } from './core/machine.js';
import { createAperture, prefersReducedMotion } from './character/aperture.js';
import { mountCharacter } from './character/index.js';
import { loadPack } from './evidence/pack.js';
import { runVerification, runChallenge, runRouting } from './evidence/pipeline.js';
import { classify_civic_intent } from './tools/index.js';
import { DEFAULT_DISCLOSURE } from './tools/draft.js';
import { DANGER_LINE, REFUSAL_LINE, scanForbidden } from './evidence/safety.js';
import { TwoTruths } from './components/twoTruths.js';
import { shareTwoTruths } from './components/shareImage.js';
import { DraftStudio } from './components/draftStudio.js';
import { DisclosureReview } from './components/disclosure.js';
import { RouteCard, NoRouteCard } from './components/routeCard.js';
import { CaseReceipt, newCaseId } from './components/caseReceipt.js';
import { CaptionRibbon } from './components/captionRibbon.js';
import { ClueList } from './components/clueRow.js';
import { StateGlyph } from './components/stateGlyph.js';
import { openSourceSheet } from './components/sourceChip.js';
import { openSheet, closeSheet } from './components/sheet.js';
import { createVoiceRoller, stopVoicePreview } from './components/voiceRoller.js';
import { createVoice, voiceSupported } from './voice/speech.js';
import { HONEST_LABEL, LIVE_LABEL, isConfigured as liveConfigured, createLiveVoice } from './voice/live.js';
import {
  PERSONAS, getAllPersonas, getActivePersona, getActivePersonaId, setActivePersonaId
} from './voice/personas.js';
import { cue, unlockAudio, setSoundEnabled } from './core/sound.js';
import { detectTier, applyTier, TIER_LINE, watchOnline } from './core/net.js';
import { t, setLanguage, getLanguage, LANGUAGES, detectLanguage, SWITCH_LINE, getSwitchLine } from './i18n/strings.js';
import * as store from './core/store.js';

/* ── Boot state ──────────────────────────────────────────────────────── */

const app = {
  pack: null, machine: null, aperture: null, companion: null, captions: null,
  voice: null, live: null, tier: 'full', online: navigator.onLine, reduced: prefersReducedMotion(),
  payload: null, route: null, routeSources: [], draft: null, caseId: null,
  image: null, photoURL: null, user: {}, disclosure: { ...DEFAULT_DISCLOSURE },
  motes: [], nudged: false, firstRun: true,
};

const host = {
  aperture: $('#apertureHost'), caption: $('#captionHost'), chips: $('#chipHost'),
  status: $('#statusLine'), day: $('#day'), dayBody: $('#dayBody'), dayCaseId: $('#dayCaseId'),
  companion: $('#companion'), companionHost: $('#companionHost'), companionSay: $('#companionSay'),
  modeBadge: $('#modeBadge'), modeText: $('#modeText'), modeSub: $('#modeSub'),
  dockLabel: $('#dockLabel'), wakePowerBtn: $('#wakePowerBtn'), wakePowerLabel: $('#wakePowerLabel'),
  dockIcon: $('#dockIcon'), dockMicIcon: $('#dockMicIcon'), dockSpeakerIcon: $('#dockSpeakerIcon'),
  audioVisualizer: $('#audioVisualizer'),
  night: document.querySelector('.night'),
};

let visualizerDecayTimer = null;
let currentVisualizerLevel = 0;

function updateAudioVisualizer(level, isSpeaking = false) {
  const visualizer = host.audioVisualizer || document.getElementById('audioVisualizer');
  if (!visualizer) return;
  const bars = visualizer.querySelectorAll('.audio-bar');
  if (!bars.length) return;

  currentVisualizerLevel = Math.max(level, currentVisualizerLevel * 0.8);
  const activeCount = Math.round(currentVisualizerLevel * bars.length);

  bars.forEach((bar, idx) => {
    const isActive = idx < activeCount && currentVisualizerLevel > 0.04;
    bar.classList.toggle('active', isActive && !isSpeaking);
    bar.classList.toggle('speaking', isActive && isSpeaking);
    if (isActive) {
      const height = Math.min(13, Math.max(3, (idx + 1) * 0.9 * currentVisualizerLevel * 1.5));
      bar.style.height = `${height.toFixed(1)}px`;
    } else {
      bar.style.height = '2.5px';
    }
  });

  const dockIcon = host.dockIcon || document.getElementById('dockIcon');
  const micIcon = host.dockMicIcon || document.getElementById('dockMicIcon');
  const speakerIcon = host.dockSpeakerIcon || document.getElementById('dockSpeakerIcon');
  if (dockIcon && micIcon && speakerIcon) {
    if (isSpeaking) {
      dockIcon.dataset.speaking = 'true';
      micIcon.style.display = 'none';
      speakerIcon.style.display = 'block';
    } else {
      dockIcon.dataset.speaking = 'false';
      micIcon.style.display = 'block';
      speakerIcon.style.display = 'none';
    }
  }

  // Smooth visualizer decay
  if (currentVisualizerLevel > 0.01) {
    if (visualizerDecayTimer) cancelAnimationFrame(visualizerDecayTimer);
    visualizerDecayTimer = requestAnimationFrame(() => {
      if (currentVisualizerLevel > 0.01) {
        updateAudioVisualizer(currentVisualizerLevel * 0.88, isSpeaking);
      } else {
        currentVisualizerLevel = 0;
        bars.forEach((bar) => {
          bar.classList.remove('active', 'speaking');
          bar.style.height = '2.5px';
        });
      }
    });
  }
}

function setMode(mode, label) {
  if (!host.modeBadge) return;
  host.modeBadge.dataset.state = mode;
  if (label && host.modeText) host.modeText.textContent = label;

  if (host.modeSub) {
    if (mode === 'speaking') host.modeSub.textContent = 'WAZI SPEAKING';
    else if (mode === 'working') host.modeSub.textContent = 'ANALYZING RECORDS';
    else if (mode === 'listening') host.modeSub.textContent = 'LISTENING • 24KHZ DSP';
    else if (mode === 'active') host.modeSub.textContent = 'LIVE 24KHZ DSP';
    else host.modeSub.textContent = 'TAP TO WAKE';
  }

  if (host.dockLabel) {
    const isSw = getLanguage() === 'sw';
    if (app.isSleeping) {
      host.dockLabel.textContent = isSw ? 'Wazi imepumzika • Gusa kuamsha' : 'Wazi is resting • Tap to wake';
    } else if (mode === 'speaking') {
      host.dockLabel.textContent = isSw ? 'Wazi anazungumza...' : 'Wazi is speaking...';
    } else if (mode === 'working') {
      host.dockLabel.textContent = isSw ? 'Inachambua rekodi za umma...' : 'Analyzing public records...';
    } else if (mode === 'listening') {
      host.dockLabel.textContent = isSw ? 'Nasikiliza, tafadhali sema...' : 'Listening loud & clear...';
    } else {
      host.dockLabel.textContent = isSw ? 'Nipo tayari unapotaka' : 'Ready when you are';
    }
  }
}

function updateWakeSleepUI() {
  const btn = host.wakePowerBtn || document.getElementById('wakePowerBtn');
  const label = host.wakePowerLabel || document.getElementById('wakePowerLabel');
  if (!btn || !label) return;
  const isSw = getLanguage() === 'sw';

  if (app.isSleeping) {
    btn.dataset.state = 'asleep';
    label.textContent = isSw ? 'Amsha Wazi' : 'Wake Wazi';
  } else {
    btn.dataset.state = 'awake';
    label.textContent = isSw ? 'Pumzika' : 'Sleep';
  }
}

function toggleWakeSleep() {
  unlockAudio();
  const isSw = getLanguage() === 'sw';
  if (!app.isSleeping) {
    app.isSleeping = true;
    cue('sleep');
    app.aperture?.setState('dormant');
    app.companion?.setState('dormant');
    if (app.live?.connected) app.live.pause?.();
    else app.voice?.stop?.();
    setMode('idle', `${getActivePersona().name} • Asleep`);
    updateWakeSleepUI();
  } else {
    app.isSleeping = false;
    cue('wake');
    app.aperture?.setState('waking');
    updateWakeSleepUI();
    setTimeout(() => {
      syncAperture();
      syncVoiceBadge();
      if (app.live?.connected) {
        app.live.resume?.();
      } else {
        app.voice?.start?.();
      }
      const p = getActivePersona();
      say(isSw ? `Habari! ${p.name} yuko hapa. Nambie unachotaka kuangalia.` : `Hello! ${p.name} is here. What record would you like to check?`);
    }, 350);
  }
}

function syncVoiceBadge() {
  const p = getActivePersona();
  const isLive = Boolean(app.live?.connected);
  const label = `${p.name} • ${isLive ? `${p.voice} Voice` : 'On-Device'}`;
  setMode(isLive ? 'active' : 'idle', label);
  updateWakeSleepUI();
}

/* ── Speaking ────────────────────────────────────────────────────────── */

function initVoice() {
  if (app.voice || !voiceSupported() || app.tier === 'text') return;
  app.voice = createVoice({
    lang: LANGUAGES.find((l) => l.code === getLanguage())?.bcp47 ?? 'en-KE',
    persona: getActivePersonaId(),
    onPartial: (txt) => app.captions?.partial?.(txt),
    onFinal: (txt) => { app.captions?.settle?.(); handleUtterance(txt); },
    onEnergy: (v) => {
      app.aperture?.setEnergy(v);
      app.companion?.setEnergy(v);
      updateAudioVisualizer(v, app.voice?.speaking);
    },
    onState: (s) => {
      if (s === 'denied') { say(t('denied')); promptText('What would you like to check?'); }
      if (s === 'speaking') {
        app.aperture?.setState('speaking');
        app.companion?.setState('speaking');
        setMode('speaking');
      }
      if (s === 'listening') {
        if (app.machine?.state === 'listening') syncAperture();
        setMode('listening');
      }
    },
  });
}

/** Everything Wazi says passes the forbidden-vocabulary scan first. §18.3 */
function say(text, { silent = false } = {}) {
  const hits = scanForbidden(text);
  if (hits.length) {
    console.error('[wazi] refused to say:', hits, text);
    text = REFUSAL_LINE;
  }
  app.captions?.say(text);
  if (host.companion && !host.companion.hidden) {
    host.companionSay.hidden = false;
    host.companionSay.dataset.fading = 'false';
    host.companionSay.textContent = text;
    /* Speak, then clear the reading path. The line is kept in the
       transcript; the workspace owns the screen here. §15.4 */
    clearTimeout(say._fade);
    say._fade = setTimeout(() => {
      host.companionSay.dataset.fading = 'true';
      setTimeout(() => { host.companionSay.hidden = true; }, 500);
    }, 7000);
  }
  if (!silent && app.tier !== 'text') {
    if (app.live?.connected) {
      /* The hosted model speaks directly over WebSocket with a human, natural voice.
         Do not double-speak or trigger the browser speech synthesis engine over it. */
      return;
    }
    if (!app.voice) initVoice();
    app.voice?.say(text);
  }
}

const status = (text) => { host.status.textContent = text ?? ''; };

/* ── Character ───────────────────────────────────────────────────────── */

function syncAperture() {
  const name = APERTURE_FOR[app.machine.state] ?? 'resting';
  app.aperture?.setState(name);
  app.companion?.setState(name);
}

function setMotes(list) {
  app.motes = list;
  app.aperture?.setMotes(list.filter((m) => m.status === 'running'));
  app.companion?.setMotes(list.filter((m) => m.status === 'running'));
  /* Reduced motion gets the same information as a static checklist. §8.5 */
  if (app.reduced) renderMoteList();
}

/**
 * Clearing the motes is what ends the animation — but under reduced
 * motion the checklist IS the information, and the pipeline finishes in
 * milliseconds, so clearing it immediately would leave nothing to read.
 * It stays until the next run or a return to Night.
 */
function endMotes() {
  if (app.reduced) {
    app.aperture?.setMotes([]);
    app.companion?.setMotes([]);
    return;                       /* leave the completed checklist up */
  }
  setMotes([]);
}

function clearMoteList() {
  app.motes = [];
  document.getElementById('moteList')?.remove();
}

function renderMoteList() {
  const existing = $('#moteList');
  if (!app.motes.length) { existing?.remove(); return; }
  const ul = existing ?? el('ul', { class: 'motes-list', id: 'moteList' });
  clear(ul);
  for (const m of app.motes) {
    ul.append(el('li', { dataset: { done: String(m.status === 'done') } },
      el('span', { 'aria-hidden': 'true', text: m.status === 'done' ? '✓' : m.status === 'failed' ? '✕' : '·' }),
      el('span', { text: m.label })));
  }
  if (!existing) host.caption.after(ul);
}

/* ── Worlds ──────────────────────────────────────────────────────────── */

function toDay(build) {
  clear(host.dayBody);
  build(host.dayBody);
  host.day.hidden = false;
  requestAnimationFrame(() => host.day.classList.add('is-open'));
  host.companion.hidden = false;
  host.dayCaseId.textContent = app.caseId ?? '';
  host.chips.replaceChildren();
}

function toNight() {
  host.day.classList.remove('is-open');
  clearMoteList();
  host.companion.hidden = true;
  host.companionSay.hidden = true;
  setTimeout(() => { host.day.hidden = true; clear(host.dayBody); }, 480);
  renderChips(defaultChips());
}

/* ── Chips (§12.3) — three, contextual, never a grid ─────────────────── */

const defaultChips = () => {
  const isSw = getLanguage() === 'sw';
  return [
    {
      label: isSw ? '✨ Kituo cha Afya cha Siaya' : '✨ Siaya Health Clinic',
      act: () => {
        unlockAudio();
        const q = isSw ? 'Je, kituo cha afya cha Siaya kilikamilika kama ilivyodaiwa?' : 'Was the Siaya dispensary completed as claimed in the county report?';
        app.captions.heard(q);
        if (app.live?.connected) app.live.text(q);
        else handleUtterance(q);
      },
    },
    {
      label: isSw ? '✨ Barabara za KeNHA' : '✨ KeNHA Road Contracts',
      act: () => {
        unlockAudio();
        const q = isSw ? 'Niambie kuhusu kandarasi za barabara za KeNHA na KeRRA' : 'Show me the road construction contract records and payments for KeNHA and KeRRA';
        app.captions.heard(q);
        if (app.live?.connected) app.live.text(q);
        else handleUtterance(q);
      },
    },
    {
      label: isSw ? '✨ Barua ya Kifungu cha 35' : '✨ Draft Article 35 Letter',
      act: () => {
        unlockAudio();
        const q = isSw ? 'Niandikie barua rasmi ya Kifungu cha 35 kuomba taarifa ya mradi' : 'Help me draft an official Article 35 access to information request letter';
        app.captions.heard(q);
        if (app.live?.connected) app.live.text(q);
        else handleUtterance(q);
      },
    },
  ];
};

function renderChips(list) {
  clear(host.chips);
  for (const c of list.slice(0, 3)) {
    host.chips.append(el('button', { class: 'chip', type: 'button', text: c.label, onclick: c.act }));
  }
}

/* ── Turn handling ───────────────────────────────────────────────────── */

async function handleUtterance(text) {
  if (!text?.trim()) return;
  app.captions.settle();

  const detected = detectLanguage(text);
  if (detected.code !== getLanguage()) {
    setLanguage(detected.code);
    syncLanguageChip();
    say(SWITCH_LINE[detected.code]);
  }

  const intent = classify_civic_intent(text, { hasImage: Boolean(app.image) });

  if (intent.intent === 'danger') {
    app.machine.interrupt('safety_redirect');
    syncAperture();
    app.aperture?.setExpression?.('concern');
    app.companion?.setExpression?.('concern');
    say(DANGER_LINE);
    showSafety();
    return;
  }
  if (intent.intent === 'cases') { openCases(); return; }
  if (intent.intent === 'show') { openCamera(); return; }
  if (intent.intent === 'chat') {
    app.machine.send('SPEECH'); app.machine.send('TURN_END'); app.machine.send('CHAT');
    syncAperture();
    say(/what (are|r) you|who are you/i.test(text) ? t('what.am.i')
      : 'I can check public records and help you write to whoever is responsible. What do you want to look at?');
    app.machine.send('DONE'); syncAperture();
    return;
  }

  await verify(text);
}

/* ── Verification (§8.4 motes, §10.4 no spinner) ─────────────────────── */

async function verify(utterance) {
  setMode('active', app.live?.voice ? `Wazi • ${app.live.voice} Voice` : 'Wazi • Accountability');
  app.live?.moment?.('mode_accountability');
  if (app.machine.state === 'listening') app.machine.send('SPEECH');
  if (app.machine.state === 'hearing') app.machine.send('TURN_END');
  if (app.machine.state === 'triage') app.machine.send('CIVIC');
  else if (app.machine.state === 'clue_review') app.machine.send('CHECK');
  syncAperture();

  const running = new Map();
  clearMoteList();
  setMotes([]);
  status('');

  const result = await runVerification({
    pack: app.pack, utterance, image: app.image, online: app.online,
    pace: app.reduced ? 0 : 60,
    onMote: (m) => {
      running.set(m.tool, m);
      setMotes([...running.values()]);
      if (m.status === 'running') status(m.label);
    },
  });

  status('');
  endMotes();

  if (!result.ok) {
    if (app.online) {
      status('Searching official gazettes & registries via Google Search...');
      try {
        const resp = await fetch('/api/civic-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ what: utterance }),
        });
        if (resp.ok) {
          const dyn = await resp.json();
          if (dyn?.ok && dyn.payload) {
            status('');
            app.payload = dyn.payload;
            app.route = dyn.route;
            app.routeSources = dyn.sources || [];
            app.caseId = app.caseId ?? newCaseId();
            app.machine.assign({ evidence: dyn.payload, route: dyn.route });
            const moved = app.machine.send('RESOLVED');
            if (moved.ok) {
              syncAperture();
              showEvidence();
              cue(dyn.payload.evidence_state === 'CONFLICTING' ? 'conflicting' : 'evidence');
              say(`Here is what the official public record says about ${dyn.payload.entity?.name || utterance}.`);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('[wazi] live civic search fallback failed:', err);
      }
    }
    status('');
    /* Law 4 — nothing found is never presented as disproof. */
    app.machine.assign({ evidence: null });
    app.machine.send('TOOL_FAILED');
    say(result.say ?? "I couldn't check that, and I'm not going to guess.");
    app.machine.send('DONE');
    syncAperture();
    renderChips([{ label: 'Try a different name', act: () => promptText('What is it called?') }, ...defaultChips().slice(1)]);
    return;
  }

  app.payload = result.payload;
  app.caseId = app.caseId ?? newCaseId();
  app.machine.assign({ evidence: result.payload });
  const moved = app.machine.send('RESOLVED');
  if (!moved.ok) { console.error('[wazi]', moved.reason); return; }
  syncAperture();

  showEvidence();
  /* Reactive facial expressions: concern/empathy for conflicting records */
  if (app.payload.evidence_state === 'CONFLICTING') {
    app.aperture?.setExpression?.('concern');
    app.companion?.setExpression?.('concern');
  } else {
    app.aperture?.setExpression?.('resting');
    app.companion?.setExpression?.('resting');
  }

  /* It turns toward the thing it just found. Gaze is the whole reason
     for the 3D rig — a character that never looks at anything is a
     graphic, not a companion. */
  app.aperture.lookAt?.(-0.5, -0.35);
  cue(app.payload.evidence_state === 'CONFLICTING' ? 'conflicting' : 'evidence');
  say(narrate(app.payload));
}

/** The narration is decided from the payload, never generated freely. §23.1 */
function narrate(p) {
  if (p.evidence_state === 'CONFLICTING') {
    const rec = p.record.find((r) => r.verbatim);
    return `The record says ${String(rec?.fact?.value ?? 'one thing').toLowerCase()}, ` +
           `${fmtDate(rec?.fact?.as_of)}. What you're showing me doesn't match. ` +
           `That's a difference worth an answer — it isn't proof of anything yet.`;
  }
  if (p.evidence_state === 'UNKNOWN') return "I don't have enough to say either way. Everything I do have is on screen.";
  if (p.evidence_state === 'VERIFIED') return 'A primary source says this directly. The wording is on screen.';
  if (p.evidence_state === 'CORROBORATED') return 'Two independent sources agree. Both are on screen.';
  return 'One source says this and nobody independent has confirmed it.';
}

/* ── Evidence surface ────────────────────────────────────────────────── */

function showEvidence() {
  toDay((body) => {
    body.append(TwoTruths(app.payload, {
      photoSrc: app.photoURL,
      onSource: openSourceSheet,
      onCheckAgain: checkAgain,
      onTakeAction: takeAction,
      onShare: doShare,
      onSave: saveCurrentCase,
      onAlternative: (alt) => { closeSheet(); reverify(alt); },
    }));
    body.append(collapsible('How I worked this out', () => workLog()));
  });
}

function collapsible(label, build) {
  const details = el('details', { style: { marginTop: '16px' } },
    el('summary', { class: 'card__label', text: label }));
  details.addEventListener('toggle', () => {
    if (details.open && details.children.length === 1) details.append(build());
  }, { once: false });
  return details;
}

function workLog() {
  const wrap = el('div', { class: 'card' });
  for (const s of app.payload.sources) {
    wrap.append(el('p', { class: 'tt__row', text: `Checked ${s.publisher} — ${fmtDate(s.retrieved_at)}` }));
  }
  for (const f of app.payload.failed_checks ?? []) {
    wrap.append(el('p', { class: 'tt__row', text: `Could not check — ${f.label}: ${f.reason}` }));
  }
  for (const l of app.payload.limitations ?? []) {
    wrap.append(el('p', { class: 'tt__checked', text: l }));
  }
  return wrap;
}

async function reverify(alt) {
  app.machine.send('BACK');
  syncAperture();
  await verify(alt.name);
}

/* ── Check Again (§20) ───────────────────────────────────────────────── */

async function checkAgain() {
  if (!app.machine.send('CHECK_AGAIN').ok) return;
  syncAperture();
  status('Trying to prove myself wrong');
  const running = new Map();

  const result = await runChallenge({
    payload: app.payload, pack: app.pack, online: app.online,
    pace: app.reduced ? 0 : 500,
    onMote: (m) => { running.set(m.tool, m); setMotes([...running.values()]); },
  });

  endMotes(); status('');

  if (!result.ok) {
    app.machine.send('TOOL_FAILED');
    syncAperture(); say(result.say);
    return;
  }

  app.payload = result.payload;
  app.machine.assign({ evidence: result.payload });
  app.machine.send('RESOLVED');
  syncAperture();
  showEvidence();
  say(result.say);
}

/* ── Take action → routing → draft → disclosure → export ─────────────── */

async function takeAction() {
  if (!app.machine.send('TAKE_ACTION').ok) return;
  syncAperture();
  status('Finding who is responsible');
  const running = new Map();

  const routed = await runRouting({
    payload: app.payload, pack: app.pack, pace: app.reduced ? 0 : 320,
    onMote: (m) => { running.set(m.tool, m); setMotes([...running.values()]); },
  });

  endMotes(); status('');

  if (!routed.ok) {
    /* Refusing to offer an unverified contact is a correct outcome. §21.1 */
    app.machine.send('TOOL_FAILED');
    syncAperture();
    say(routed.say);
    toDay((body) => body.append(NoRouteCard(routed.reason)));
    return;
  }

  app.route = routed.route;
  app.routeSources = routed.sources;
  app.machine.assign({ route: routed.route });
  app.machine.send('ROUTED');
  syncAperture();
  showDraft();
  say(`This is the office responsible. Here's why, and where that came from.`);
}

function showDraft() {
  const studio = DraftStudio({
    payload: app.payload, route: app.route, routeSources: app.routeSources,
    caseId: app.caseId, user: app.user, disclosure: app.disclosure,
    onSource: openSourceSheet,
    onChange: (d) => { app.draft = d; },
    onReview: (d) => { app.draft = d; showDisclosure(); },
  });
  toDay((body) => body.append(studio.el));
}

function showDisclosure() {
  if (!app.machine.send('REVIEW').ok) return;
  syncAperture();
  const review = DisclosureReview({
    draft: app.draft, payload: app.payload, user: app.user,
    onApprove: (d) => { app.disclosure = d; app.machine.send('APPROVE', { disclosureApproved: true }); },
    onUserChange: (u) => {
      app.user = u;
      /* Identity lives in its own store so deleting it leaves the case
         intact, and vice versa. §22 */
      for (const [k, v] of Object.entries(u)) store.setIdentity(k, v).catch(() => {});
    },
    onBack: () => { app.machine.send('BACK'); syncAperture(); showDraft(); },
    onExport: doExport,
  });
  toDay((body) => body.append(review.el));
  say("Here's exactly what goes out. I can't promise a reply, and I can't keep you anonymous once you send this.");
}

function doExport({ kind, draft, prepared }) {
  /* export is unreachable except through disclosure — the machine, not
     this function, is what makes that true. §16 */
  if (app.machine.state !== 'export') {
    console.error('[wazi] export attempted from', app.machine.state);
    return;
  }
  cue('exported');

  if (kind === 'copy') {
    navigator.clipboard?.writeText(`${draft.subject}\n\n${draft.body}`);
    say('Copied to clipboard. Nothing has been sent.');
  } else if (kind === 'print') {
    printDraft(draft, prepared);
  } else if (kind === 'email') {
    const to = draft.recipient?.address || '';
    const subject = draft.subject || 'Status inquiry';
    const body = draft.body || '';
    navigator.clipboard?.writeText(`To: ${to}\nSubject: ${subject}\n\n${body}`);
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.click();
    } catch {
      try { location.href = url; } catch {}
    }
    openEmailConfirmationSheet(to, subject, body, url, draft.recipient);
    say('Draft email prepared and copied to clipboard. You are the one who sends it.');
  } else if (kind === 'whatsapp') {
    const msg = draft.format === 'whatsapp' ? draft.body : `*${draft.subject}*\n\n${draft.body}`;
    navigator.clipboard?.writeText(msg);
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    try {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.click();
    } catch {
      window.open(url, '_blank', 'noopener');
    }
    say('Formatted for WhatsApp and copied to your clipboard. Ready to paste or forward.');
  }

  saveCurrentCase({ status: 'Letter drafted — not yet sent' });
  app.machine.send('DONE');
  syncAperture();
}

/** Formal Letter Print & PDF Engine */
function printDraft(draft, prepared) {
  let printFrame = document.getElementById('wazi-print-frame');
  if (!printFrame) {
    printFrame = document.createElement('iframe');
    printFrame.id = 'wazi-print-frame';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);
  }

  const refs = draft.refs?.map((r) =>
    `<li><strong>${escapeHTML(r.publisher)}</strong> — “${escapeHTML(r.title)}”, published ${fmtDate(r.published_at)}, retrieved ${fmtDate(r.retrieved_at)}${r.is_fixture ? ' — DEMO FIXTURE' : ''}</li>`).join('') ?? '';

  const printHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Wazi Formal Letter — ${escapeHTML(app.caseId ?? 'Draft')}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 20mm 20mm 20mm;
    }
    body {
      font-family: "Times New Roman", Times, Georgia, serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #111;
      margin: 0;
      padding: 20px;
      background: #ffffff;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 6px;
      margin-bottom: 18px;
    }
    .brand {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 16pt;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #0f172a;
    }
    .ref-meta {
      font-family: ui-monospace, monospace;
      font-size: 9pt;
      color: #475569;
      text-align: right;
    }
    .stamp-box {
      border: 1.5px solid #64748b;
      background: #f8fafc;
      padding: 6px 12px;
      font-family: system-ui, sans-serif;
      font-size: 9pt;
      font-weight: 600;
      margin: 12px 0;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .letter-body {
      white-space: pre-wrap;
      font-family: "Times New Roman", Times, Georgia, serif;
      font-size: 11pt;
      line-height: 1.55;
      text-align: justify;
    }
    .sources-section {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #cbd5e1;
      font-size: 9pt;
    }
    .sources-section h3 {
      font-family: system-ui, sans-serif;
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    .sources-section ol {
      margin: 0;
      padding-left: 18px;
      line-height: 1.4;
    }
    .footer-note {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      font-family: system-ui, sans-serif;
      font-size: 8pt;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { padding: 0; }
      .stamp-box { border-color: #000; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div class="brand">WAZI CIVIC COMPANION</div>
    <div class="ref-meta">
      CASE: ${escapeHTML(app.caseId ?? 'WAZI-ATI-2026')}<br>
      DATE: ${fmtDate(new Date().toISOString())}
    </div>
  </div>

  ${prepared?.simulated ? `<div class="stamp-box">${escapeHTML(prepared.stamp)}</div>` : ''}

  <div class="letter-body">${escapeHTML(draft.body)}</div>

  ${refs ? `
  <div class="sources-section">
    <h3>Official Record Schedule & Public Verification Citations</h3>
    <ol>${refs}</ol>
  </div>` : ''}

  <div class="footer-note">
    <span>Prepared pursuant to Article 35 of the Constitution of Kenya & Access to Information Act, 2016.</span>
    <span>Review copy for citizen signatory.</span>
  </div>
</body>
</html>`;

  // Always open interactive formal document sheet for PDF/printing/downloading
  openFormalDocumentSheet(draft, prepared, printHtml);

  // Also attempt immediate iframe print
  try {
    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(printHtml);
    frameDoc.close();
    setTimeout(() => {
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      } catch {}
    }, 400);
  } catch (err) {
    console.warn('Iframe print error handled gracefully:', err);
  }
}

function openFormalDocumentSheet(draft, prepared, printHtml) {
  openSheet('Official Letter & PDF • Hati Rasmi', (body, { close }) => {
    const isSw = getLanguage() === 'sw';
    
    // Top actions toolbar
    const bar = el('div', {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '16px',
        padding: '12px',
        background: 'var(--paper-200)',
        borderRadius: '8px',
        border: '1px solid var(--paper-300)'
      }
    });

    const printBtn = el('button', {
      class: 'btn btn--primary',
      type: 'button',
      style: { display: 'flex', alignItems: 'center', gap: '6px' },
      text: isSw ? '🖨️ Chapisha / Hifadhi PDF' : '🖨️ Print / Save as PDF',
      onclick: () => {
        const frame = document.getElementById('wazi-print-frame');
        if (frame?.contentWindow) {
          try {
            frame.contentWindow.focus();
            frame.contentWindow.print();
            say('Print dialog opened.');
            return;
          } catch {}
        }
        window.print();
      }
    });

    const downloadBtn = el('button', {
      class: 'btn',
      type: 'button',
      style: { display: 'flex', alignItems: 'center', gap: '6px' },
      text: isSw ? '⬇️ Pakua Hati (.html)' : '⬇️ Download Document (.html)',
      onclick: () => {
        try {
          const blob = new Blob([printHtml], { type: 'text/html;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Wazi_Letter_${app.caseId || '2026'}.html`;
          a.click();
          URL.revokeObjectURL(url);
          say('Document downloaded. Ready to open, print, or attach.');
        } catch (e) {
          say('Download error: ' + (e?.message || e));
        }
      }
    });

    const copyBtn = el('button', {
      class: 'btn',
      type: 'button',
      style: { display: 'flex', alignItems: 'center', gap: '6px' },
      text: isSw ? '📋 Nakili Barua' : '📋 Copy Letter',
      onclick: () => {
        navigator.clipboard?.writeText(draft.body);
        copyBtn.textContent = isSw ? '✓ Imenakiliwa!' : '✓ Copied!';
        setTimeout(() => {
          copyBtn.textContent = isSw ? '📋 Nakili Barua' : '📋 Copy Letter';
        }, 2000);
        say('Full formal letter copied to clipboard.');
      }
    });

    bar.append(printBtn, downloadBtn, copyBtn);

    // Document Paper Preview Container
    const paper = el('div', {
      class: 'formal-letter-preview',
      style: {
        background: '#ffffff',
        color: '#111827',
        padding: '24px 20px',
        borderRadius: '6px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0',
        fontFamily: '"Times New Roman", Times, Georgia, serif',
        lineHeight: '1.5',
        fontSize: '14px',
        maxHeight: '60vh',
        overflowY: 'auto'
      }
    });

    paper.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid #1a1a1a; padding-bottom:6px; margin-bottom:16px;">
        <span style="font-family:system-ui, sans-serif; font-size:15px; font-weight:800; letter-spacing:0.1em; color:#0f172a;">WAZI CIVIC COMPANION</span>
        <span style="font-family:ui-monospace, monospace; font-size:11px; color:#475569; text-align:right;">
          REF: ${escapeHTML(app.caseId || 'WAZI-ATI-2026')}<br>
          DATE: ${fmtDate(new Date().toISOString())}
        </span>
      </div>
      <div style="white-space:pre-wrap; font-size:13.5px; line-height:1.55; color:#111;">${escapeHTML(draft.body)}</div>
      <div style="margin-top:20px; padding-top:10px; border-top:1px solid #e2e8f0; font-family:system-ui, sans-serif; font-size:10px; color:#64748b;">
        <span>Statutory notice prepared under Article 35 of the Constitution of Kenya & Access to Information Act, 2016.</span>
      </div>
    `;

    body.append(bar, paper);
  });
}

function openEmailConfirmationSheet(to, subject, body, mailtoUrl, recipient = {}) {
  openSheet('Email Ready to Send • Barua Pepe Tayari', (container, { close }) => {
    const isSw = getLanguage() === 'sw';

    container.append(
      el('p', {
        class: 'persona-sheet-intro',
        style: { marginBottom: '14px' },
        text: isSw
          ? 'Barua yako rasmi ya Access to Information imeandaliwa na kuelekezwa kwa ofisi husika. Unaweza kuifungua moja kwa moja au kunakili maelezo.'
          : 'Your official Access to Information email has been drafted and addressed to the verified accounting officer. You can launch your mail app or copy details.'
      })
    );

    const card = el('div', {
      style: {
        background: 'var(--paper-200)',
        border: '1.5px solid var(--paper-300)',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        marginBottom: '16px'
      }
    });

    const officeLine = recipient?.office ? `${recipient.office}, ${recipient.body || ''}` : '';

    card.innerHTML = `
      <div style="font-size:13px; color:var(--text-on-paper-muted);">
        <strong style="color:var(--text-on-paper);">Official Recipient:</strong> ${escapeHTML(officeLine || to)}
      </div>
      <div style="font-size:13px; color:var(--text-on-paper-muted); word-break:break-all;">
        <strong style="color:var(--text-on-paper);">Address (To):</strong> ${escapeHTML(to)}
      </div>
      <div style="font-size:13px; color:var(--text-on-paper-muted);">
        <strong style="color:var(--text-on-paper);">Subject:</strong> ${escapeHTML(subject)}
      </div>
    `;

    const btnRow = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' } });

    const openMailBtn = el('a', {
      class: 'btn btn--primary',
      href: mailtoUrl,
      target: '_blank',
      rel: 'noopener',
      style: { textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' },
      text: isSw ? '✉️ Fungua kwenye Barua Pepe' : '✉️ Open in Email App'
    });

    const copyAddrBtn = el('button', {
      class: 'btn',
      type: 'button',
      text: isSw ? '📋 Nakili Anwani' : '📋 Copy Address',
      onclick: () => {
        navigator.clipboard?.writeText(to);
        copyAddrBtn.textContent = '✓ Copied!';
        setTimeout(() => copyAddrBtn.textContent = isSw ? '📋 Nakili Anwani' : '📋 Copy Address', 2000);
      }
    });

    const copyBodyBtn = el('button', {
      class: 'btn',
      type: 'button',
      text: isSw ? '📋 Nakili Yaliyomo' : '📋 Copy Full Email',
      onclick: () => {
        navigator.clipboard?.writeText(`To: ${to}\nSubject: ${subject}\n\n${body}`);
        copyBodyBtn.textContent = '✓ Copied!';
        setTimeout(() => copyBodyBtn.textContent = isSw ? '📋 Nakili Yaliyomo' : '📋 Copy Full Email', 2000);
      }
    });

    btnRow.append(openMailBtn, copyAddrBtn, copyBodyBtn);

    const previewBox = el('div', {
      style: {
        background: '#ffffff',
        border: '1px solid var(--paper-300)',
        borderRadius: '6px',
        padding: '12px 14px',
        fontSize: '12.5px',
        lineHeight: '1.45',
        whiteSpace: 'pre-wrap',
        maxHeight: '35vh',
        overflowY: 'auto',
        color: '#111'
      },
      text: body
    });

    container.append(card, btnRow, previewBox);
  });
}

const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── Share (§13.1) ───────────────────────────────────────────────────── */

async function doShare() {
  try {
    const res = await shareTwoTruths(app.payload, { caseId: app.caseId });
    say(res.shared ? 'Sent.' : res.cancelled ? 'Fine.' : 'Saved to your photos. Forward it wherever it needs to go.');
  } catch (err) {
    console.error(err);
    say("I couldn't build the image. The card is still here on screen.");
  }
}

/* ── Cases (§13.3, §22) ──────────────────────────────────────────────── */

function currentCase(patch = {}) {
  return {
    id: app.caseId,
    opened_at: new Date().toISOString(),
    subject: app.payload?.entity?.name ?? 'Untitled',
    status: 'Checked — no action taken',
    evidence_state: app.payload?.evidence_state ?? null,
    source_count: app.payload?.sources?.length ?? 0,
    photo_count: app.image ? 1 : 0,
    routed_to: app.route ? `${app.route.office}, ${app.route.jurisdiction.value}` : null,
    payload: app.payload, route: app.route, draft: app.draft,
    ...patch,
  };
}

async function saveCurrentCase(patch = {}) {
  if (!app.payload) return;
  app.caseId = app.caseId ?? newCaseId();
  try {
    await store.saveCase(currentCase(patch));
    say(`Saved as ${app.caseId}. It stays on this phone.`);
  } catch (err) {
    console.error(err);
    say("I couldn't save that on this device. The case is still on screen.");
  }
}

async function openCases() {
  app.machine.send('OPEN_CASES');
  syncAperture();
  let cases = [];
  try { cases = await store.listCases(); } catch { /* storage unavailable */ }

  toDay((body) => {
    body.append(el('h2', { style: { font: 'var(--title)', marginBottom: '12px' }, text: 'Your cases' }));
    if (!cases.length) {
      body.append(el('p', { class: 'empty', text: t('cases.empty') }));
    }
    for (const k of cases) {
      body.append(el('button', {
        class: 'case-row', type: 'button',
        onclick: () => {
          app.payload = k.payload; app.route = k.route; app.caseId = k.id; app.draft = k.draft;
          app.machine.assign({ evidence: k.payload, route: k.route });
          app.machine.send('OPEN_CASE');
          syncAperture(); showEvidence();
        },
      },
        el('span', { class: 'case-row__top' },
          el('span', { class: 'tt__row', text: k.subject }),
          el('span', { class: 'case-row__id', text: k.id })),
        el('span', { class: 'case-row__top' },
          k.evidence_state ? StateGlyph(k.evidence_state) : el('span'),
          el('span', { class: 'tt__checked', text: k.status })),
      ));
    }
    if (app.payload) body.append(el('div', { style: { marginTop: '24px' } }, CaseReceipt(currentCase())));
    body.append(privacyPanel());
  });
}

function privacyPanel() {
  return el('section', { class: 'card', style: { marginTop: '32px' } },
    el('h3', { class: 'card__title', text: t('privacy.title') }),
    el('p', { class: 'tt__row', text: t('privacy.body') }),
    el('p', { class: 'tt__checked',
      text: app.live?.connected ? LIVE_LABEL(app.live.model) : HONEST_LABEL }),
    el('p', { class: 'tt__checked', style: { marginTop: '12px' },
      text: app.user && Object.keys(app.user).length
        ? `Held about you: ${Object.keys(app.user).join(', ')}.`
        : 'Nothing personal is held about you.' }),
    /* Identity and evidence are separate stores precisely so these two
       buttons can be separate promises. §22 */
    el('div', { class: 'btn-row', style: { marginTop: '12px' } },
      el('button', {
        class: 'btn', type: 'button',
        text: 'Delete my details only',
        disabled: !Object.keys(app.user ?? {}).length || undefined,
        onclick: async () => {
          await store.clearIdentity();
          app.user = {};
          say('Your details are gone. Your cases are untouched.');
          openCases();
        },
      }),
      el('button', {
        class: 'btn btn--danger', type: 'button',
        text: t('privacy.delete'),
        onclick: async () => {
          if (!confirm(t('privacy.confirm'))) return;
          await store.deleteEverything();
          app.payload = null; app.route = null; app.draft = null; app.caseId = null; app.user = {};
          say('Gone. Nothing of yours is left on this phone.');
          openCases();
        },
      })));
}

/* ── Camera (§15.2) ──────────────────────────────────────────────────── */

function openCamera() {
  app.machine.send('OPEN_CAMERA');
  syncAperture();
  /* The fixture stands in for a live camera in this build, and says so.
     The clue-extraction shape is the part that matters. §12.8 */
  openSheet('Show me', (body, { close }) => {
    body.append(
      el('p', { class: 'ribbon', text: 'Demo data — clearly labelled fixture' }),
      el('p', { class: 'tt__row', text: 'Pick what you are showing me.' }),
      el('img', { src: 'data/packs/ke-siaya/fixtures/FIXTURE_signboard.svg',
        class: 'tt__photo', width: '320', height: '240', alt: 'A demo project signboard' }),
      el('button', { class: 'btn btn--primary', style: { width: '100%' }, type: 'button',
        text: 'Use this signboard', onclick: () => { close(); useFixture(); } }),
      el('label', { class: 'field', style: { marginTop: '16px' } },
        el('span', { class: 'card__label', text: 'Or choose a photo from this phone' }),
        el('input', { type: 'file', accept: 'image/*', onchange: (e) => {
          const f = e.currentTarget.files?.[0]; if (f) { close(); useOwnPhoto(f); }
        } })),
    );
  }, { onClose: () => { app.machine.send('CLOSE'); syncAperture(); } });

  say(t('open.signboard'));
}

const FIXTURE_IMAGE = () => ({
  clues: [
    { key: 'institution', label: 'Institution', value: 'Siaya County Government, Department of Health', observed: 'observed' },
    { key: 'project', label: 'Project', value: 'Bondo Sub-County Health Centre II', observed: 'observed' },
    { key: 'reference', label: 'Reference', value: 'BSC-HC-II', observed: 'observed' },
    { key: 'amount', label: 'Amount on the board', value: 'KES 41,200,000', observed: 'observed' },
    { key: 'status', label: 'Claimed status', value: 'COMPLETED — March 2023', observed: 'observed' },
    { key: 'location', label: 'Location', value: 'Bondo Sub-County', observed: 'inferred',
      reason: 'I am guessing from the county name on the board, not from a GPS reading.' },
  ],
  observations: [
    { label: 'Roof', value: 'absent', source_id: 'user-photo', as_of: '2026-09-18' },
    { label: 'Windows', value: 'unglazed', source_id: 'user-photo', as_of: '2026-09-18' },
  ],
  source: {
    id: 'user-photo', publisher: 'Your photo', title: 'Site photograph', tier: 'user',
    published_at: '2026-09-18', retrieved_at: '2026-09-18',
    excerpt: 'Dated photograph supplied by you. Location metadata was removed when it was imported.',
    is_fixture: true,
  },
});

function useFixture() {
  app.image = FIXTURE_IMAGE();
  app.photoURL = 'data/packs/ke-siaya/fixtures/FIXTURE_site_photo.svg';
  app.machine.send('CAPTURE');
  syncAperture();
  showClues();
}

async function useOwnPhoto(file) {
  try {
    const imported = await store.importImage(file);
    app.photoURL = URL.createObjectURL(imported.blob);
    app.image = FIXTURE_IMAGE();          /* clue extraction is fixture-backed in this build */
    app.image.source = {
      ...app.image.source,
      excerpt: `Photograph you supplied, ${imported.width}×${imported.height}. ` +
               'Location metadata was removed when it was imported.',
      is_fixture: false,
    };
    app.machine.send('CAPTURE');
    syncAperture();
    showClues();
  } catch (err) {
    console.error(err);
    say(t('camera.denied'));
  }
}

function showClues() {
  const list = ClueList(app.image.clues, { onChange: (clues) => { app.image.clues = clues; } });
  toDay((body) => {
    body.append(
      el('h2', { style: { font: 'var(--title)', marginBottom: '4px' }, text: 'What I read' }),
      el('p', { class: 'tt__checked', style: { marginBottom: '12px' },
        text: 'Dotted means I am guessing. Everything here is editable before I use it.' }),
      list.el,
      el('button', { class: 'btn btn--primary', style: { width: '100%', marginTop: '20px' },
        type: 'button', text: 'Check this',
        onclick: () => { app.image.clues = list.clues; verify('Is this finished?'); } }),
    );
  });
  say(t('clues.check'));
}

/* ── Text input, safety, language ────────────────────────────────────── */

function promptText(label) {
  openSheet(label, (body, { close }) => {
    const input = el('input', { class: 'cap-edit', 'aria-label': label,
      style: { color: 'var(--text-on-paper)', background: 'var(--paper-50)', borderColor: 'var(--paper-300)' } });
    const go = () => {
      const v = input.value.trim();
      close();
      if (v) {
        app.captions.heard(v);
        if (app.live?.connected) {
          app.live.text(v);
        } else {
          handleUtterance(v);
        }
      }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    body.append(input, el('button', { class: 'btn btn--primary', type: 'button',
      style: { width: '100%', marginTop: '12px' }, text: t('btn.ask', 'Ask Wazi'), onclick: go }));
    setTimeout(() => input.focus(), 50);
  });
}

function showSafety() {
  setMode('safety', 'Wazi • Safety Mode');
  app.live?.moment?.('mode_safety');
  toDay((body) => {
    body.append(
      el('h2', { style: { font: 'var(--title)' }, text: 'Your safety first' }),
      el('p', { class: 'tt__row', style: { marginTop: '12px' },
        text: 'Wazi is not an emergency service and cannot send help. These are pre-verified routes. ' +
              'If you are in immediate danger, use them now.' }),
      el('article', { class: 'card', style: { marginTop: '16px' } },
        el('p', { class: 'card__label', text: 'Kenya' }),
        el('p', { class: 'tt__row', text: 'Police emergency — 999 / 112' }),
        el('p', { class: 'tt__row', text: 'Gender Violence Recovery Centre helpline — 1195' }),
        el('p', { class: 'tt__checked', text: 'Verify these against your own local guidance before relying on them.' })),
      el('p', { class: 'disc__honesty',
        text: 'Wazi has stopped checking records. Your case is saved and will be here later.' }),
    );
  });
}

function syncLanguageChip() {
  const lang = LANGUAGES.find((l) => l.code === getLanguage());
  $('#langLabel').textContent = lang?.native ?? 'English';
  $('#langTier').textContent = lang?.tier ?? 'tested';
  app.voice?.setLanguage(lang?.bcp47 ?? 'en-KE');
}

function openLanguage() {
  openSheet('Language • Chagua Lugha (50+ Languages)', (body, { close }) => {
    const currentCode = getLanguage();
    const isSw = currentCode === 'sw';

    body.append(
      el('p', {
        class: 'persona-sheet-intro',
        style: { marginBottom: '12px', fontSize: '13px', lineHeight: '1.45' },
        text: isSw
          ? 'Wazi ana uwezo wa kuelewa na kuzungumza lugha zaidi ya 50 kupitia injini ya Gemini Live. Chagua lugha yako hapa chini au tafuta.'
          : 'Wazi understands and speaks 50+ languages powered by the Gemini Live multimodal engine. Choose your language below or search.'
      })
    );

    // Search filter input
    const searchInput = el('input', {
      type: 'text',
      class: 'search-input',
      placeholder: isSw ? 'Tafuta lugha (mfano: Kiswahili, Sheng, French, Somali, Luo)...' : 'Search 50+ languages (e.g. Kiswahili, Sheng, French, Somali, Luo, Arabic)...',
      style: {
        width: '100%',
        padding: '10px 14px',
        borderRadius: '8px',
        border: '1.5px solid var(--paper-300)',
        font: 'var(--body)',
        fontSize: '14px',
        marginBottom: '14px',
        background: 'var(--paper-100)',
        color: 'var(--text-on-paper)',
        boxSizing: 'border-box'
      }
    });

    const langContainer = el('div', { class: 'lang-list-container' });

    const renderList = (filterText = '') => {
      clear(langContainer);
      const query = filterText.toLowerCase().trim();
      const filtered = LANGUAGES.filter((l) =>
        !query ||
        l.name.toLowerCase().includes(query) ||
        l.native.toLowerCase().includes(query) ||
        l.code.toLowerCase().includes(query) ||
        (l.region && l.region.toLowerCase().includes(query))
      );

      if (!filtered.length) {
        langContainer.append(el('p', {
          style: { padding: '20px', color: 'var(--text-on-paper-muted)', textAlign: 'center' },
          text: isSw ? 'Hakuna lugha iliyopatikana.' : 'No matching language found.'
        }));
        return;
      }

      const groups = query
        ? [{ label: `Matches (${filtered.length})`, items: filtered }]
        : [
            { label: 'Kenya & East Africa', items: filtered.filter((l) => ['en', 'sw', 'sheng', 'luo', 'kik', 'so', 'am', 'om', 'ti', 'lg', 'rw'].includes(l.code)) },
            { label: 'Pan-African Languages', items: filtered.filter((l) => ['yo', 'ig', 'ha', 'zu', 'xh', 'af', 'ln', 'sn', 'mg'].includes(l.code)) },
            { label: 'Global & International', items: filtered.filter((l) => !['en', 'sw', 'sheng', 'luo', 'kik', 'so', 'am', 'om', 'ti', 'lg', 'rw', 'yo', 'ig', 'ha', 'zu', 'xh', 'af', 'ln', 'sn', 'mg'].includes(l.code)) }
          ];

      for (const grp of groups) {
        if (!grp.items.length) continue;
        const section = el('div', { style: { marginBottom: '14px' } });
        section.append(el('h4', {
          style: {
            font: 'var(--mono)',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-on-paper-muted)',
            marginBottom: '8px',
            paddingLeft: '4px'
          },
          text: grp.label
        }));

        const grid = el('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '8px'
          }
        });

        for (const l of grp.items) {
          const isSelected = l.code === currentCode;
          const btn = el('button', {
            class: `btn ${isSelected ? 'btn--primary' : ''}`,
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '8px 12px',
              textAlign: 'left',
              gap: '2px',
              border: isSelected ? '1.5px solid var(--teal-600)' : '1px solid var(--paper-300)',
              background: isSelected ? 'var(--teal-50)' : 'var(--paper-100)',
              color: isSelected ? 'var(--teal-900)' : 'var(--text-on-paper)',
              borderRadius: '8px',
              cursor: 'pointer'
            },
            type: 'button',
            onclick: () => {
              setLanguage(l.code);
              syncLanguageChip();
              syncVoiceBadge();
              renderChips(defaultChips());
              app.live?.setLanguage?.(l.code, l.name);
              app.voice?.setLanguage?.(l.bcp47 || 'en-KE');
              say(getSwitchLine(l.code));
              close();
            }
          },
            el('div', { style: { display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' } },
              el('span', { style: { fontWeight: '600', fontSize: '13.5px' }, text: l.native }),
              isSelected ? el('span', { style: { fontSize: '12px', color: 'var(--teal-600)', fontWeight: '700' }, text: '✓' }) : null
            ),
            el('span', { style: { fontSize: '11px', color: 'var(--text-on-paper-muted)' }, text: l.name })
          );
          grid.append(btn);
        }
        section.append(grid);
        langContainer.append(section);
      }
    };

    searchInput.addEventListener('input', (e) => renderList(e.target.value));
    body.append(searchInput, langContainer);
    renderList();
  });
}

function openVoicePersonaSheet() {
  const isSwahili = getLanguage() === 'sw';
  const title = isSwahili ? 'Mshirika wa Kiraia na Sauti' : 'Civic Collaborator & Voice';

  openSheet(title, (body, { close }) => {
    const roller = createVoiceRoller({
      onSelect: (p) => {
        syncVoiceBadge();
        app.voice?.setPersona?.(p.id);

        if (app.live?.connected) {
          app.live.setPersona(p.id, p.voice);
          const greeting = isSwahili
            ? `Habari! Mimi ni ${p.name}. Nipo tayari kuangalia rekodi za umma pamoja nawe.`
            : `Habari! I am ${p.name}. I'm ready to walk through public records with you.`;
          app.live.openWith(greeting);
        } else {
          const greeting = isSwahili
            ? `Habari! Mimi ni ${p.name}. Karibu tuchambue kumbukumbu za umma pamoja.`
            : `Habari! I am ${p.name}. I'm ready to look at public records with you.`;
          say(greeting);
        }
        close();
      },
      onCancel: close,
    });
    body.append(roller.el);
  }, {
    onClose: () => {
      stopVoicePreview();
    }
  });
}

/* ── Cold start (§14) ────────────────────────────────────────────────── */

function coldStart() {
  const overlay = el('div', { class: 'world night', id: 'cold',
    style: {
      zIndex: '40',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      padding: '24px 16px',
      overflowY: 'auto'
    }
  });

  // Top Bar on cold start screen
  const activePersona = getActivePersona();
  const currentLang = LANGUAGES.find((l) => l.code === getLanguage()) || LANGUAGES[0];

  const topControls = el('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '8px',
      flexWrap: 'wrap',
      justifyContent: 'center'
    }
  });

  const personaBtn = el('button', {
    class: 'chip',
    type: 'button',
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: 'rgba(255,255,255,0.08)',
      color: 'var(--text-on-ink)',
      border: '1px solid rgba(255,255,255,0.18)',
      padding: '6px 12px',
      fontSize: '12px'
    },
    onclick: () => openVoicePersonaSheet(),
  },
    el('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: activePersona.badgeColor || '#2dd4bf' } }),
    el('span', { text: `${activePersona.name} (${activePersona.voice})` }),
    el('span', { style: { fontSize: '10px', opacity: '0.7' }, text: '▾' })
  );

  const langBtn = el('button', {
    class: 'chip',
    type: 'button',
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: 'rgba(255,255,255,0.08)',
      color: 'var(--text-on-ink)',
      border: '1px solid rgba(255,255,255,0.18)',
      padding: '6px 12px',
      fontSize: '12px'
    },
    onclick: () => openLanguage(),
  },
    el('span', { text: `🌐 ${currentLang.native}` }),
    el('span', { style: { fontSize: '10px', opacity: '0.7' }, text: '▾' })
  );

  topControls.append(personaBtn, langBtn);

  const dormant = createAperture({ size: 160, motes: false });
  dormant.setState('resting');

  overlay.addEventListener('pointermove', (e) => {
    const rect = dormant.el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth * 0.45)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight * 0.45)));
    dormant.lookAt?.(nx, ny);
  }, { passive: true });

  const tap = el('button', {
    type: 'button', style: { background: 'none', border: 0, padding: '0', cursor: 'pointer' },
    'aria-label': 'Tap once to let Wazi hear you',
    onclick: async () => {
      unlockAudio();
      dormant.setState('attention');
      let granted = false;
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true });
          s.getTracks().forEach((tr) => tr.stop());
          granted = true;
        }
      } catch { granted = false; }
      overlay.remove();
      dormant.destroy();
      begin(granted);
    },
  }, dormant.el);

  // Quick Starter Prompts
  const promptsGrid = el('div', {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      justifyContent: 'center',
      maxWidth: '480px',
      marginTop: '8px'
    }
  });

  const starters = [
    { label: '🏥 Siaya Dispensary Tender', q: 'Check Siaya County dispensary tenders and contractor records' },
    { label: '🛣️ KeNHA Highway Contracts', q: 'Look up Kenya National Highways Authority project details' },
    { label: '📜 Draft Article 35 Letter', q: 'Draft an Access to Information request under Article 35' },
    { label: '📞 National Ministry Contacts', q: 'Find official government accounting officer contacts and emails' }
  ];

  for (const s of starters) {
    const chip = el('button', {
      class: 'chip',
      type: 'button',
      style: {
        fontSize: '11.5px',
        padding: '6px 12px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: 'var(--text-on-ink)',
        cursor: 'pointer'
      },
      onclick: async () => {
        unlockAudio();
        overlay.remove();
        dormant.destroy();
        await begin(false);
        setTimeout(() => {
          app.captions.heard(s.q);
          if (app.live?.connected) {
            app.live.text(s.q);
          } else {
            handleUtterance(s.q);
          }
        }, 500);
      }
    }, s.label);
    promptsGrid.append(chip);
  }

  overlay.append(
    topControls,
    tap,
    el('p', { style: { font: 'var(--body)', textAlign: 'center', maxWidth: '30ch', fontWeight: '500' }, text: t('cold.invite') }),
    el('p', { class: 'tt__checked', style: { textAlign: 'center', maxWidth: '36ch', color: 'var(--text-on-ink-muted)', fontSize: '13px' },
      text: 'Wazi checks 47 county budgets, national ministry procurement records, verified statutory offices, and drafts formal Access to Information letters.' }),
    el('button', {
      class: 'btn btn--primary',
      type: 'button',
      style: { padding: '10px 20px', fontSize: '14px' },
      text: '🎙️ Tap Aperture to Speak or Click Here',
      onclick: async () => {
        unlockAudio();
        dormant.setState('attention');
        let granted = false;
        try {
          if (navigator.mediaDevices?.getUserMedia) {
            const s = await navigator.mediaDevices.getUserMedia({ audio: true });
            s.getTracks().forEach((tr) => tr.stop());
            granted = true;
          }
        } catch { granted = false; }
        overlay.remove();
        dormant.destroy();
        begin(granted);
      }
    }),
    el('button', { class: 'chip', type: 'button', text: t('cold.type'),
      onclick: () => { unlockAudio(); overlay.remove(); dormant.destroy(); begin(false); } }),
    promptsGrid
  );
  $('#app').append(overlay);
}

async function begin(micGranted) {
  app.machine.send('TAP');
  app.machine.send(micGranted ? 'GRANTED' : 'DENIED');
  syncAperture();

  /* When a relay is configured the hosted model drives the whole
     conversation: it hears, it decides which tool to call, and it speaks
     — including the natural fillers it makes while background reasoning
     runs, which is the audible half of the motes in §8.4. Without a
     relay we fall back to the browser speech engine and say so. */
  if (micGranted && liveConfigured() && app.tier !== 'text') {
    const currentPersona = getActivePersona();
    app.live = createLiveVoice({
      voice: currentPersona.voice,
      persona: currentPersona.id,
      onHeard: (t) => {
        app.captions.partial(t);
        if (t?.trim()) {
          const detected = detectLanguage(t);
          if (detected.code !== getLanguage()) {
            setLanguage(detected.code);
            syncLanguageChip();
            syncVoiceBadge();
            renderChips(defaultChips());
            app.live?.setLanguage?.(detected.code);
          }
        }
      },
      onSaid: (t) => {
        app.captions.settle();
        app.captions.say(t);
        if (t?.trim()) {
          const detected = detectLanguage(t);
          if (detected.code !== getLanguage()) {
            setLanguage(detected.code);
            syncLanguageChip();
            syncVoiceBadge();
            renderChips(defaultChips());
          }
        }
      },
      onEnergy: (v) => {
        app.aperture?.setEnergy(v);
        app.companion?.setEnergy(v);
        updateAudioVisualizer(v, app.live?.speaking);
      },
      onState: (st) => {
        if (st === 'speaking') {
          app.aperture?.setState('speaking');
          app.companion?.setState('speaking');
          setMode('speaking');
        } else if (st === 'working') {
          app.aperture?.setState('working');
          app.companion?.setState('working');
          setMode('working');
        } else {
          syncAperture();
          syncVoiceBadge();
        }
      },
      onSurface: handleLiveSurface,
      onReady: (m) => {
        status(LIVE_LABEL(m.model, m.voice));
        syncVoiceBadge();
        setTimeout(() => status(''), 5000);
      },
      onError: (msg) => { console.error('[wazi/live]', msg); status(msg); },
      onExpiring: (m) => {
        console.info('[wazi/live] session lifetime approaching limit; seamless renewal scheduled', m);
      },
      onUnavailable: (reason) => {
        console.error('[wazi/live] unavailable:', reason);
        app.live?.stop(); app.live = null;
        status('The hosted model is not reachable. Using on-device speech instead.');
        syncVoiceBadge();
        startBrowserVoice();
      },
    });
    try {
      await app.live.start();
      /* Wazi speaks first with warm, friendly, personalized presence */
      const openPrompt = getLanguage() === 'sw'
        ? `Habari yako! Mtu huyu amefungua programu sasa hivi. Msalimie kwa sauti yako ya uchangamfu na urafiki kwa sentensi moja fupi, ukijitambulisha kama ${currentPersona.name}, mshirika wao wa masuala ya umma, na umkaribishe akuambie mradi au rekodi anayotaka kuangalia leo.`
        : `Hello! The person has just opened the app. Greet them warmly and cheerfully in one short sentence, introduce yourself as ${currentPersona.name}, their civic companion, and invite them to share a project or question they would like to check today.`;
      app.live.openWith(openPrompt);
    } catch (err) {
      console.error('[wazi/live]', err);
      status('The hosted model did not connect. Using on-device speech instead.');
      app.live = null;
      syncVoiceBadge();
    }
  }

  initVoice();
  if (!app.live && micGranted) {
    app.voice?.start();
  }

  /* Prime browser audio context and speech synthesis on first interaction */
  const unlockSpeech = () => {
    try { window.speechSynthesis?.resume?.(); } catch {}
    unlockAudio();
    window.removeEventListener('pointerdown', unlockSpeech);
    window.removeEventListener('keydown', unlockSpeech);
  };
  window.addEventListener('pointerdown', unlockSpeech, { passive: true });
  window.addEventListener('keydown', unlockSpeech, { passive: true });

  if (!micGranted) say(t('denied'));

  app.aperture.setState('waking');
  cue('wake');
  setTimeout(() => {
    if (!app.live?.connected) {
      say(app.firstRun ? t('open.first') : t('open.return'));
    }
    setTimeout(() => { syncAperture(); renderChips(defaultChips()); }, 400);
  }, 380);

  /* One nudge at 12s, then never again this session. Wazi is not needy. §17 */
  setTimeout(() => {
    if (!app.nudged && !app.payload && app.machine.state === 'listening') {
      app.nudged = true;
      say(t('open.nudge'));
    }
  }, 12000);
}

/**
 * Surfaces pushed by the relay. The hosted model never sees the evidence
 * itself — it gets one or two sentences of already-decided language — so
 * everything that renders arrives here, from the tools, already
 * schema-validated on the server. §23.1
 */
function handleLiveSurface(surface) {
  if (!surface) return;
  switch (surface.kind) {
    case 'mote': {
      const next = app.motes.filter((m) => m.tool !== surface.tool);
      next.push({ tool: surface.tool, label: surface.label, status: surface.status });
      setMotes(next);
      if (surface.status === 'running') status(surface.label);
      break;
    }
    case 'evidence':
      app.payload = surface.payload;
      app.caseId = app.caseId ?? newCaseId();
      app.machine.assign({ evidence: surface.payload });
      if (app.machine.state !== 'evidence') {
        if (app.machine.state === 'listening') app.machine.send('SPEECH');
        if (app.machine.state === 'hearing') app.machine.send('TURN_END');
        if (app.machine.state === 'triage') app.machine.send('CIVIC');
        app.machine.send('RESOLVED');
      }
      endMotes(); status('');
      showEvidence();
      cue(surface.payload.evidence_state === 'CONFLICTING' ? 'conflicting' : 'evidence');
      break;
    case 'route':
      app.route = surface.route;
      app.routeSources = surface.sources ?? [];
      app.machine.assign({ route: surface.route });
      if (app.machine.state === 'evidence') app.machine.send('TAKE_ACTION');
      if (app.machine.state === 'routing') app.machine.send('ROUTED');
      endMotes(); status('');
      showDraft();
      break;
    case 'draft':
      app.draft = surface.draft;
      if (surface.route) {
        app.route = surface.route;
        app.routeSources = surface.route.sources ?? [];
        app.machine.assign({ route: surface.route });
      }
      if (app.machine.state === 'evidence') app.machine.send('TAKE_ACTION');
      if (app.machine.state === 'routing') app.machine.send('ROUTED');
      endMotes(); status('');
      showDraft();
      break;
    case 'no_route':
      endMotes(); status('');
      toDay((body) => body.append(NoRouteCard(surface.reason)));
      break;
    case 'no_match':
    case 'tool_failed':
      endMotes(); status('');
      break;
    case 'safety':
      app.machine.interrupt('safety_redirect');
      syncAperture(); showSafety();
      break;
    default: break;
  }
}

/* ── Boot ────────────────────────────────────────────────────────────── */

async function boot() {
  app.tier = applyTier(detectTier());
  setSoundEnabled(app.tier === 'full');
  setLanguage(store.readPrefs().lang ?? 'en');

  app.machine = createMachine();
  app.machine.onTransition(({ state }) => { bus.emit('state', state); });

  /* The hero character upgrades to 3D where the device can carry it;
     the companion stays flat at 40px, where depth buys nothing and a
     second WebGL context would cost real memory. */
  app.aperture = mountCharacter({ size: 200, motes: true, live: true });
  host.aperture.append(app.aperture.el);
  app.companion = createAperture({ size: 40, motes: true });
  host.companionHost.append(app.companion.el);

  app.captions = CaptionRibbon({ onCorrect: (text) => { say(`Got it — ${text}.`); handleUtterance(text); } });
  host.caption.append(app.captions.el);

  syncLanguageChip();
  syncVoiceBadge();

  $('#modeBadge')?.addEventListener('click', openVoicePersonaSheet);
  $('#wakePowerBtn')?.addEventListener('click', toggleWakeSleep);
  $('#langBtn').addEventListener('click', openLanguage);
  $('#cameraBtn').addEventListener('click', openCamera);
  $('#casesBtn').addEventListener('click', openCases);
  $('#typeBtn').addEventListener('click', () => promptText('What would you like to check?'));
  $('#dayBack').addEventListener('click', () => {
    if (app.machine.send('BACK').ok) { syncAperture(); toNight(); }
  });

  watchOnline((online) => {
    app.online = online;
    if (!online) { app.machine.interrupt('offline'); syncAperture(); say(t('offline')); }
    else if (app.machine.state === 'offline') { app.machine.send('ONLINE'); syncAperture(); }
  });

  try {
    app.pack = await loadPack('ke-siaya');
  } catch (err) {
    console.error(err);
    status('I could not load the records pack. Nothing I say would be checkable, so I will not guess.');
    return;
  }

  if (app.tier !== 'full') status(TIER_LINE[app.tier] ?? '');

  try { app.user = await store.getIdentity(); } catch { app.user = {}; }

  app.firstRun = !store.readPrefs().seen;
  store.writePrefs({ seen: true, lang: getLanguage() });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => { /* offline is best-effort */ });
  }

  coldStart();
}

boot();

/* Exposed for the browser-verification harness. */
globalThis.__wazi = app;
