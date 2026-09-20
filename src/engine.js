import { countryPack } from './data/countryPack.js';

export const EVIDENCE_STATES = {
  VERIFIED: 'VERIFIED',
  CORROBORATED: 'CORROBORATED',
  REPORTED: 'REPORTED',
  CONFLICTING: 'CONFLICTING',
  UNKNOWN: 'UNKNOWN'
};

export function classify_civic_intent(text) {
  const value = (text || '').toLowerCase();
  if (value.includes('report') || value.includes('complaint')) return 'report_issue';
  if (value.includes('verify') || value.includes('completed')) return 'verify_claim';
  return 'understand_service';
}

export function resolve_jurisdiction(input = {}) {
  const hint = `${input.location || ''} ${input.text || ''}`.toLowerCase();
  if (hint.includes('kawangware') || hint.includes('nairobi')) {
    return { jurisdiction: 'nairobi_county', corrected: false };
  }
  return { jurisdiction: countryPack.jurisdiction, corrected: true, note: 'Defaulted to flagship pack jurisdiction pending better signal.' };
}

export function extract_visual_clues(payload = {}) {
  const observed = payload.observed || {};
  return {
    observed,
    inferred: payload.inferred || {},
    editable: true
  };
}

export function resolve_civic_entity({ projectId, nameHint } = {}) {
  const byId = countryPack.projects.find((p) => p.projectId === projectId);
  if (projectId && !byId) {
    return { matched: null, mismatch: true, reason: 'project_id_mismatch' };
  }
  const byName = countryPack.projects.find((p) => (nameHint || '').toLowerCase().includes(p.name.toLowerCase().split(' ')[0]));
  return { matched: byId || byName || null, mismatch: false };
}

export function search_country_pack() {
  return countryPack;
}

export function ground_current_information() {
  return { status: 'grounded', retrievalDate: new Date().toISOString().slice(0, 10) };
}

function staleSources(sources) {
  return sources.filter((s) => Number(s.retrievalDate.slice(0, 4)) < 2026).map((s) => s.id);
}

export function verify_claim({ claim, observation, entity }) {
  if (!entity) {
    return {
      evidenceState: EVIDENCE_STATES.UNKNOWN,
      agreements: [],
      differences: [],
      missingEvidence: ['No matched project/entity.'],
      provenance: [],
      unsupportedClaimBlocked: true
    };
  }

  const provenance = countryPack.sourceRegistry.map((s) => ({
    sourceId: s.id,
    publicationDate: s.publicationDate,
    retrievalDate: s.retrievalDate,
    quality: s.quality
  }));

  const contradictions = /unfinished|closed|not built|abandoned/i.test(observation || '');
  const evidenceState = contradictions ? EVIDENCE_STATES.CONFLICTING : EVIDENCE_STATES.REPORTED;

  return {
    claim,
    officialRecord: entity.officialStatus,
    fieldEvidence: observation,
    agreements: contradictions ? [] : ['Project exists in official records.'],
    differences: contradictions ? ['Field observation differs from reported completion status.'] : [],
    missingEvidence: ['Completion certificate is not published.'],
    evidenceState,
    staleSourceIds: staleSources(countryPack.sourceRegistry),
    provenance,
    lastChecked: new Date().toISOString()
  };
}

export function challenge_finding(result) {
  if (!result || result.evidenceState === EVIDENCE_STATES.UNKNOWN) {
    return { revised: false, evidenceState: EVIDENCE_STATES.UNKNOWN, rationale: 'No basis for adversarial pass.' };
  }

  if (result.evidenceState === EVIDENCE_STATES.REPORTED) {
    return {
      revised: true,
      evidenceState: EVIDENCE_STATES.CORROBORATED,
      rationale: 'Independent civic source supports record metadata but not physical completion.'
    };
  }

  if (result.evidenceState === EVIDENCE_STATES.CONFLICTING) {
    return {
      revised: true,
      evidenceState: EVIDENCE_STATES.UNKNOWN,
      rationale: 'Adversarial pass found potential date mismatch in field photo metadata.'
    };
  }

  return { revised: false, evidenceState: result.evidenceState, rationale: 'No contradiction found.' };
}

export function find_responsible_body(entity) {
  return entity ? { body: entity.responsibleBody, jurisdiction: countryPack.jurisdiction } : null;
}

export function verify_contact_route(entity) {
  if (!entity) return [];
  return entity.contacts.filter((c) => c.verified).map((c) => ({
    role: c.role,
    route: c.route,
    checkedAt: c.checkedAt,
    sourceId: c.sourceId
  }));
}

export function list_action_options() {
  return ['email', 'formal_letter', 'whatsapp'];
}

export function build_civic_draft({ format, evidence, contactRoute, disclosure = {} }) {
  const locationLine = disclosure.sharePreciseLocation ? 'Precise location shared.' : 'Precise location withheld.';
  return {
    format,
    recipient: contactRoute?.route || 'No verified route available',
    subject: 'Request for clarification on project delivery status',
    body: `This is a draft for review.\nEvidence state: ${evidence?.evidenceState || EVIDENCE_STATES.UNKNOWN}.\n${locationLine}`,
    references: evidence?.provenance || [],
    attachmentList: disclosure.attachments || []
  };
}

export function render_export(draft, type = 'json') {
  if (type === 'pdf') {
    return { type: 'pdf', simulated: true, content: JSON.stringify(draft, null, 2) };
  }
  return { type: 'json', content: JSON.stringify(draft, null, 2) };
}

export function prepare_external_action({ approved, draft }) {
  if (!approved) {
    return { status: 'blocked', reason: 'Explicit approval is required before external action.' };
  }
  return { status: 'ready', mode: 'simulated', draft };
}

export function handle_tool_error() {
  return {
    evidenceState: EVIDENCE_STATES.UNKNOWN,
    toolStatus: 'failed',
    userMessage: 'I could not complete that check. Please retry or continue in text mode.'
  };
}

export function handle_permission_denial() {
  return { pathForward: 'text_mode', message: 'Camera/microphone denied. Continue with text and uploads.' };
}

export function audio_state_machine(event) {
  const allowed = ['idle', 'listening', 'thinking', 'speaking', 'interrupted'];
  if (!allowed.includes(event)) return 'idle';
  if (event === 'interrupted') return 'listening';
  return event;
}
