import {
  audio_state_machine,
  build_civic_draft,
  challenge_finding,
  prepare_external_action,
  resolve_civic_entity,
  resolve_jurisdiction,
  verify_claim,
  verify_contact_route
} from './engine.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}

const claimEl = document.getElementById('claim');
const observationEl = document.getElementById('observation');
const verifyBtn = document.getElementById('verifyBtn');
const checkAgainBtn = document.getElementById('checkAgainBtn');
const evidenceOut = document.getElementById('evidenceOut');
const draftOut = document.getElementById('draftOut');
const buildDraftBtn = document.getElementById('buildDraftBtn');
const prepareActionBtn = document.getElementById('prepareActionBtn');
const formatEl = document.getElementById('draftFormat');
const includeLocationEl = document.getElementById('sharePreciseLocation');
const approvalEl = document.getElementById('approval');
const talkBtn = document.getElementById('talkBtn');

let latestResult;
let latestDraft;

talkBtn.addEventListener('click', () => {
  const state = audio_state_machine('interrupted');
  evidenceOut.textContent = `Audio state: ${state}`;
});

verifyBtn.addEventListener('click', () => {
  const jurisdiction = resolve_jurisdiction({ text: observationEl.value });
  const entityMatch = resolve_civic_entity({ nameHint: 'Kawangware' });
  latestResult = verify_claim({
    claim: claimEl.value,
    observation: observationEl.value,
    entity: entityMatch.matched
  });
  latestResult.jurisdiction = jurisdiction;
  evidenceOut.textContent = JSON.stringify(latestResult, null, 2);
});

checkAgainBtn.addEventListener('click', () => {
  const challenged = challenge_finding(latestResult);
  latestResult = { ...latestResult, challenged };
  evidenceOut.textContent = JSON.stringify(latestResult, null, 2);
});

buildDraftBtn.addEventListener('click', () => {
  const entityMatch = resolve_civic_entity({ nameHint: 'Kawangware' });
  const verifiedRoutes = verify_contact_route(entityMatch.matched);
  latestDraft = build_civic_draft({
    format: formatEl.value,
    evidence: latestResult,
    contactRoute: verifiedRoutes[0],
    disclosure: { sharePreciseLocation: includeLocationEl.checked, attachments: [] }
  });
  draftOut.textContent = JSON.stringify(latestDraft, null, 2);
});

prepareActionBtn.addEventListener('click', () => {
  const result = prepare_external_action({ approved: approvalEl.checked, draft: latestDraft });
  draftOut.textContent = JSON.stringify(result, null, 2);
});
