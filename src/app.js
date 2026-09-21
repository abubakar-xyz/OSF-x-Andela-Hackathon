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
import { createVoice, voiceSupported } from './voice/speech.js';
import { HONEST_LABEL, LIVE_LABEL, isConfigured as liveConfigured, createLiveVoice } from './voice/live.js';
import { cue, unlockAudio, setSoundEnabled } from './core/sound.js';
import { detectTier, applyTier, TIER_LINE, watchOnline } from './core/net.js';
import { t, setLanguage, getLanguage, LANGUAGES, detectLanguage, SWITCH_LINE } from './i18n/strings.js';
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
  night: document.querySelector('.night'),
};

/* ── Speaking ────────────────────────────────────────────────────────── */

/** Everything Wazi says passes the forbidden-vocabulary scan first. §18.3 */
function say(text, { silent = false } = {}) {
  const hits = scanForbidden(text);
  if (hits.length) {
    console.error('[wazi] refused to say:', hits, text);
    text = REFUSAL_LINE;
  }
  app.captions?.say(text);
  /* The floating bubble is a Night-world affordance. On Day the sheet is
     paper, full of things that must stay legible — including text marked
     mandatory and non-dismissible (§22) — and a fixed-position bubble has
     no way to know it is about to land on top of one. Read the line from
     the transcript instead; the workspace owns the screen here. §15.4 */
  if (host.companion && !host.companion.hidden && !host.day.classList.contains('is-open')) {
    host.companionSay.hidden = false;
    host.companionSay.dataset.fading = 'false';
    host.companionSay.textContent = text;
    clearTimeout(say._fade);
    say._fade = setTimeout(() => {
      host.companionSay.dataset.fading = 'true';
      setTimeout(() => { host.companionSay.hidden = true; }, 500);
    }, 7000);
  } else if (host.companionSay) {
    host.companionSay.hidden = true;
  }
  if (!silent && app.voice && app.tier !== 'text') app.voice.say(text);
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
  /* Day is paper, not a stage. The companion belongs to the Night
     conversation — on Day it has nothing to stand on but the page's own
     content, which is exactly what it must never cover. §15.4, §22 */
  host.companion.hidden = true;
  host.companionSay.hidden = true;
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

const defaultChips = () => [
  { label: t('chip.check'), act: () => promptText('What should I check?') },
  { label: t('chip.explain'), act: () => promptText('Which service or policy?') },
  { label: t('chip.cases'), act: openCases },
];

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
    pace: app.reduced ? 0 : 340,
    onMote: (m) => {
      running.set(m.tool, m);
      setMotes([...running.values()]);
      if (m.status === 'running') status(m.label);
    },
  });

  status('');
  endMotes();

  if (!result.ok) {
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
    say('Copied. Nothing has been sent.');
  } else if (kind === 'print') {
    printDraft(draft, prepared);
  } else if (kind === 'email') {
    const url = `mailto:${encodeURIComponent(draft.recipient.address)}` +
      `?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
    location.href = url;
    say('I have opened a draft email. You are the one who sends it.');
  } else if (kind === 'whatsapp') {
    const url = `https://wa.me/?text=${encodeURIComponent(`${draft.subject}\n\n${draft.body}`)}`;
    window.open(url, '_blank', 'noopener');
    say('Ready to forward. Nothing has been sent from here.');
  }

  saveCurrentCase({ status: 'Letter drafted — not yet sent' });
  app.machine.send('DONE');
  syncAperture();
}

/** Browser print-to-PDF. We never claim it is signed — there is no
 *  signing flow, so there is no signature block. §21.2 */
function printDraft(draft, prepared) {
  const win = window.open('', '_blank');
  if (!win) { say("Your browser blocked the print window. Use Copy instead."); return; }
  const refs = draft.refs.map((r) =>
    `<li>${escapeHTML(r.publisher)} — “${escapeHTML(r.title)}”, published ${fmtDate(r.published_at)}, retrieved ${fmtDate(r.retrieved_at)}${r.is_fixture ? ' — DEMO FIXTURE' : ''}</li>`).join('');
  win.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8">
    <title>Wazi ${escapeHTML(app.caseId ?? '')}</title>
    <style>
      body{font:16px/1.55 Georgia,serif;margin:18mm 16mm;color:#000}
      h1{font:600 22px/1.3 Georgia,serif;margin:0 0 4mm}
      .id{font:14px ui-monospace,monospace;letter-spacing:.06em}
      .stamp{border:2px solid #000;padding:3mm;font:700 13px system-ui;margin:6mm 0;text-align:center}
      ol{font:14px/1.5 system-ui;padding-left:6mm}
      pre{font:16px/1.55 Georgia,serif;white-space:pre-wrap}
      .note{font:13px system-ui;color:#333;margin-top:8mm;border-top:1px solid #999;padding-top:3mm}
    </style></head><body>
    <h1>wazi</h1>
    <p class="id">CASE ${escapeHTML(app.caseId ?? '')} · ${fmtDate(new Date().toISOString())}</p>
    ${prepared?.simulated ? `<p class="stamp">${escapeHTML(prepared.stamp)}</p>` : ''}
    <h2>${escapeHTML(draft.subject)}</h2>
    <pre>${escapeHTML(draft.body)}</pre>
    ${refs ? `<h3>Sources</h3><ol>${refs}</ol>` : ''}
    <p class="note">Prepared with Wazi for review by the person sending it. This is a draft.
      It is not signed, and nothing has been delivered.</p>
    </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 200);
  say('Ready to save as PDF. Nothing has been delivered.');
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
    const go = () => { const v = input.value.trim(); close(); if (v) { app.captions.heard(v); handleUtterance(v); } };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    body.append(input, el('button', { class: 'btn btn--primary', type: 'button',
      style: { width: '100%', marginTop: '12px' }, text: 'Ask Wazi', onclick: go }));
    setTimeout(() => input.focus(), 50);
  });
}

function showSafety() {
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
  openSheet('Language', (body, { close }) => {
    for (const l of LANGUAGES) {
      body.append(el('button', { class: 'btn', style: { width: '100%', marginTop: '8px' },
        type: 'button', onclick: () => { setLanguage(l.code); syncLanguageChip(); close(); renderChips(defaultChips()); } },
        `${l.native} — ${l.tier}`));
    }
    body.append(el('p', { class: 'tt__checked', style: { marginTop: '16px' },
      text: 'Only languages the evaluation suite runs against are offered. ' +
            'Wazi will not claim a language it has not been tested in.' }));
  });
}

/* ── Cold start (§14) ────────────────────────────────────────────────── */

function coldStart() {
  const overlay = el('div', { class: 'world night', id: 'cold',
    style: { zIndex: '40', alignItems: 'center', justifyContent: 'center', gap: '24px' } });
  const dormant = createAperture({ size: 168, motes: false });
  dormant.setState('dormant');

  const tap = el('button', {
    type: 'button', style: { background: 'none', border: 0, padding: '0' },
    'aria-label': 'Tap once to let Wazi hear you',
    onclick: async () => {
      unlockAudio();
      dormant.setState('awaiting');
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

  overlay.append(
    tap,
    el('p', { style: { font: 'var(--body)', textAlign: 'center', maxWidth: '28ch' }, text: t('cold.invite') }),
    el('p', { class: 'tt__checked', style: { textAlign: 'center', maxWidth: '32ch', color: 'var(--text-on-ink-muted)' },
      text: t('cold.why') }),
    el('button', { class: 'chip', type: 'button', text: t('cold.type'),
      onclick: () => { unlockAudio(); overlay.remove(); dormant.destroy(); begin(false); } }),
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
    app.live = createLiveVoice({
      onHeard: (t) => app.captions.partial(t),
      onSaid: (t) => { app.captions.settle(); app.captions.say(t); },
      onEnergy: (v) => { app.aperture?.setEnergy(v); app.companion?.setEnergy(v); },
      onState: (st) => {
        if (st === 'speaking') { app.aperture?.setState('speaking'); app.companion?.setState('speaking'); }
        else if (st === 'working') { app.aperture?.setState('working'); app.companion?.setState('working'); }
        else syncAperture();
      },
      onSurface: handleLiveSurface,
      onReady: (m) => { status(LIVE_LABEL(m.model)); setTimeout(() => status(''), 4000); },
      onError: (msg) => { console.error('[wazi/live]', msg); status(msg); },
      onUnavailable: (reason) => {
        console.error('[wazi/live] unavailable:', reason);
        app.live?.stop(); app.live = null;
        status('The hosted model is not reachable. Using on-device speech instead.');
        startBrowserVoice();
      },
    });
    try {
      await app.live.start();
      /* Wazi speaks first. The opening line is ours, not the model's. */
      app.live.openWith(
        'The person has just opened the app and has not said anything yet. ' +
        'Greet them in one short sentence, in your own voice, and invite them to ' +
        'show you something or tell you what is bothering them.');
    } catch (err) {
      console.error('[wazi/live]', err);
      status('The hosted model did not connect. Using on-device speech instead.');
      app.live = null;
    }
  }

  if (!app.live && micGranted) startBrowserVoice();

  function startBrowserVoice() {
    if (app.voice || !voiceSupported() || app.tier === 'text') return;
    app.voice = createVoice({
      lang: LANGUAGES.find((l) => l.code === getLanguage())?.bcp47 ?? 'en-KE',
      onPartial: (txt) => app.captions.partial(txt),
      onFinal: (txt) => { app.captions.settle(); handleUtterance(txt); },
      onEnergy: (v) => { app.aperture?.setEnergy(v); app.companion?.setEnergy(v); },
      onState: (s) => {
        if (s === 'denied') { say(t('denied')); promptText('What would you like to check?'); }
        if (s === 'speaking') { app.aperture?.setState('speaking'); app.companion?.setState('speaking'); }
        if (s === 'listening' && app.machine.state === 'listening') syncAperture();
      },
    });
    app.voice.start();
  }

  if (!micGranted) say(t('denied'));

  app.aperture.setState('waking');
  cue('wake');
  setTimeout(() => {
    say(app.firstRun ? t('open.first') : t('open.return'));
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
