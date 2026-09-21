/**
 * Wazi — live web search grounding.
 *
 * Answers what the Country Pack can't: a claim outside the demo's curated
 * evidence, searched live against the real, open web via Gemini's Google
 * Search grounding tool (`tools: [{ googleSearch: {} }]` on
 * `ai.models.generateContent` — confirmed against the exact type
 * definitions and README shipped inside the installed `@google/genai`
 * SDK, since `ai.google.dev` is blocked in this environment. See
 * DECISIONS.md #7 for why that block is not a reason to guess instead.
 *
 * What this is NOT: a source of VERIFIED facts. Nothing here is
 * independently checked by Wazi the way a Country Pack record is — the
 * model paraphrases what it finds, and a paraphrase is not a quotation.
 * Every source this produces is tier 'credible' at best, never 'primary'
 * (§19's SOURCE_TIERS reserves 'primary' for something a pack curator
 * has actually verified), and the summary is never presented as
 * "verbatim official wording" the way a pack record is (§25). Callers
 * must keep this payload out of the Two Truths / EvidencePayload path —
 * it is a lead, not a finding.
 */

import { nowISO } from '../src/evidence/types.js';

/* Real government TLD patterns worth a config even ceiling of 'credible'.
   Short list, on purpose: an unlisted domain is 'unverified', which is
   the honest default, not a gap to keep padding out. */
const GOV_SUFFIXES = [
  '.go.ke', '.gov.ke',                   // Kenya
  '.gov.ng',                             // Nigeria
  '.gov.gh',                             // Ghana
  '.gov.za',                             // South Africa
  '.go.tz', '.gov.tz',                   // Tanzania
  '.gov.rw',                             // Rwanda
  '.go.ug', '.gov.ug',                   // Uganda
  '.gov.et',                             // Ethiopia
  '.gov',                                // generic ccTLD second-level gov
];

function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return String(url || ''); }
}

/** A domain being a government TLD makes it worth a slightly higher tier
 *  than an arbitrary page. It does NOT make Wazi's paraphrase of it a
 *  verified fact — the ceiling here is 'credible', never 'primary'. */
export function trustTier(hostname = '') {
  const h = String(hostname).toLowerCase();
  return GOV_SUFFIXES.some((suffix) => h.endsWith(suffix)) ? 'credible' : 'unverified';
}

/**
 * @param {object} opts
 * @param {object} opts.ai      A `GoogleGenAI` instance (or a fake with the
 *                               same `models.generateContent` shape, for
 *                               tests — nothing here constructs its own
 *                               client, so nothing here needs a network
 *                               to be unit-tested).
 * @param {string} opts.model   e.g. MODELS.worker.
 * @param {string} opts.query   The claim or place the citizen asked about.
 * @param {string} [opts.context] Extra grounding for the search, e.g. a
 *                               resolved county/jurisdiction name.
 */
export async function searchPublicRecords({ ai, model, query, context = '' }) {
  if (!ai) return { ok: false, reason: 'no search client configured' };
  const q = String(query || '').trim();
  if (!q) return { ok: false, reason: 'empty query' };

  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: [{
        role: 'user',
        parts: [{
          text:
            'You are a careful research assistant helping a citizen check a public claim. ' +
            `Search for what public sources currently say about: "${q}"${context ? ` (${context})` : ''}. ` +
            'Answer in two or three plain sentences, stating only what you can attribute to a ' +
            'specific source you found through search. If you find nothing relevant, say so ' +
            'plainly in one sentence — never guess, and never fill a gap with general knowledge ' +
            'you already had rather than something the search actually returned.',
        }],
      }],
      config: { tools: [{ googleSearch: {} }] },
    });
  } catch (err) {
    return { ok: false, reason: `search failed: ${err?.message ?? err}` };
  }

  const text = response?.text?.trim?.() ?? '';
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

  const sources = [];
  const seen = new Set();
  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    const domain = hostnameOf(uri);
    sources.push({ title: chunk.web.title || domain, url: uri, domain, tier: trustTier(domain) });
  }

  /* No grounding chunks means the model answered from its own training,
     not from a live search — exactly the fabrication risk this exists
     to avoid. Refuse rather than pass that off as a search result. */
  if (!text || !sources.length) {
    return { ok: false, reason: 'no grounded result found for that query' };
  }

  return { ok: true, query: q, summary: text, sources, searched_at: nowISO() };
}
