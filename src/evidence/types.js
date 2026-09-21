/**
 * Wazi — evidence types and their schemas.  DESIGN.md §19.
 *
 * The rule this file exists to enforce: there is no such thing as an
 * unsourced Fact. `source_id` is required, `retrieved_at` is required,
 * and a payload that cannot satisfy that never reaches a component.
 */

import { S, validate, assertValid } from './schema.js';
import { LADDER } from './ladder.js';

export const SOURCE_TIERS = ['primary', 'credible', 'user', 'unverified'];
/** §12.5 — the leading mark on a SourceChip. */
export const TIER_MARK = { primary: '▣', credible: '◈', user: '◇', unverified: '○' };
export const OBSERVED = ['stated', 'derived', 'user_observed'];

export const SourceSchema = S.obj({
  id:            S.str({ nonEmpty: true }),
  publisher:     S.str({ nonEmpty: true }),
  title:         S.str({ nonEmpty: true }),
  url:           S.opt(S.str()),
  tier:          S.oneOf(SOURCE_TIERS),
  published_at:  S.nullable(S.iso()),   /* null is legal → renders "undated" */
  retrieved_at:  S.iso(),               /* never optional */
  excerpt:       S.str({ nonEmpty: true }),
  quality_notes: S.opt(S.str()),
  is_fixture:    S.opt(S.bool()),       /* true ⇒ the amber Ribbon renders. Law 8 */
});

export const FactSchema = S.obj({
  value:     S.any(),
  unit:      S.opt(S.str()),
  source_id: S.str({ nonEmpty: true }), /* REQUIRED. The whole point. */
  observed:  S.oneOf(OBSERVED),
  state:     S.oneOf(LADDER),
  as_of:     S.nullable(S.iso()),
});

export const ClueSchema = S.obj({
  key:     S.str({ nonEmpty: true }),
  label:   S.str({ nonEmpty: true }),
  value:   S.str(),
  /* Separating what was seen from what was guessed is not a nicety —
     it is what lets the user correct us before we act. §12.8 */
  observed: S.oneOf(['observed', 'inferred']),
  reason:  S.opt(S.str()),
});

export const EvidencePayloadSchema = S.obj({
  claim:          S.str({ nonEmpty: true }),
  entity:         S.obj({
    id: S.str(), name: S.str({ nonEmpty: true }),
    sector: S.opt(S.str()), admin1: S.opt(S.str()), admin2: S.opt(S.str()),
  }),
  alternatives:   S.arr(S.obj({ id: S.str(), name: S.str() })),
  record:         S.arr(S.obj({ label: S.str(), fact: FactSchema })),
  field:          S.arr(S.obj({ label: S.str(), fact: FactSchema })),
  agreements:     S.arr(S.str()),
  differences:    S.arr(S.str()),
  /* Mandatory and never empty: there are always gaps. §13.1 */
  missing_fields: S.arr(S.str(), { min: 1 }),
  limitations:    S.arr(S.str()),
  sources:        S.arr(SourceSchema, { min: 1 }),
  evidence_state: S.oneOf(LADDER),
  previous_state: S.opt(S.nullable(S.oneOf(LADDER))),
  revision_note:  S.opt(S.nullable(S.str())),
  retrieved_at:   S.iso(),
  failed_checks:  S.arr(S.obj({ tool: S.str(), label: S.str(), reason: S.str() })),
});

export const RouteSchema = S.obj({
  body:            S.str({ nonEmpty: true }),
  office:          S.str({ nonEmpty: true }),
  person:          S.opt(S.nullable(S.obj({ name: S.str(), title: S.str(), verified_current: FactSchema }))),
  jurisdiction:    FactSchema,
  channel:         S.oneOf(['email', 'portal', 'postal', 'phone']),
  address:         FactSchema,
  why_this_office: FactSchema,
  verified_at:     S.iso(),
  procedure:       S.opt(S.nullable(S.obj({
    name: S.str(), steps: S.arr(S.str()), deadline_days: S.opt(S.nullable(FactSchema)),
  }))),
  escalation:      S.opt(S.nullable(S.any())),
});

/* ── Helpers ─────────────────────────────────────────────────────────── */

export const nowISO = () => new Date().toISOString();

export function makeFact(value, source_id, { unit, observed = 'stated', state = 'REPORTED', as_of = null } = {}) {
  if (!source_id) throw new Error('makeFact: source_id is required — there are no unsourced facts');
  const fact = { value, source_id, observed, state, as_of };
  if (unit !== undefined) fact.unit = unit;
  return fact;
}

/** Index a source list by id so `<Fact>` can resolve provenance. */
export function sourceIndex(sources = []) {
  const map = new Map();
  for (const s of sources) map.set(s.id, s);
  return map;
}

/**
 * Every fact referenced by a payload must resolve to a source it carries.
 * This is the check that makes "no orphan facts" true of the data and not
 * merely of the renderer. §19
 */
export function findOrphanFacts(payload) {
  const known = new Set((payload.sources ?? []).map((s) => s.id));
  const orphans = [];
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`));
    if (typeof node.source_id === 'string' && 'observed' in node) {
      if (!known.has(node.source_id)) orphans.push({ path, source_id: node.source_id });
      return;
    }
    for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
  };
  walk(payload, 'payload');
  return orphans;
}

/** True when any source in the payload is a labelled demo fixture. §12.14 */
export const hasFixture = (payload) => (payload?.sources ?? []).some((s) => s.is_fixture);

/** A source older than 90 days is surfaced as possibly stale. §12.5 */
export const STALE_DAYS = 90;
export function isStale(source, now = Date.now()) {
  if (!source?.retrieved_at) return true;
  const age = (now - Date.parse(source.retrieved_at)) / 86400000;
  return age > STALE_DAYS;
}

/**
 * The boundary. Validates shape, then checks provenance integrity.
 * Anything that fails becomes a tool failure, never a render. §19
 */
export function acceptEvidence(payload) {
  const shape = validate(EvidencePayloadSchema, payload, 'evidence');
  if (!shape.ok) return { ok: false, errors: shape.errors };
  const orphans = findOrphanFacts(payload);
  if (orphans.length) {
    return { ok: false, errors: orphans.map((o) => `${o.path}: unresolvable source_id "${o.source_id}"`) };
  }
  return { ok: true, value: payload };
}

export function acceptRoute(route) {
  const shape = validate(RouteSchema, route, 'route');
  if (!shape.ok) return { ok: false, errors: shape.errors };
  return { ok: true, value: route };
}

export { assertValid, validate };
