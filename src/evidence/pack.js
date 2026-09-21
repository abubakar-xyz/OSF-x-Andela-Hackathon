/**
 * Country Pack loader.  DESIGN.md §25.
 *
 * A new jurisdiction is seven JSON files and zero application code. That
 * is the scalability story, and it is only true if the loader refuses an
 * incomplete pack — so it does.
 */

export const PACK_FILES = ['pack', 'sources', 'entities', 'records', 'institutions', 'routes', 'procedures'];

export function indexPack(raw) {
  const pack = {
    meta: raw.pack,
    sources: raw.sources.sources,
    entities: raw.entities.entities,
    records: raw.records.records,
    institutions: raw.institutions.institutions,
    routes: raw.routes.routes,
    procedures: raw.procedures.procedures,
  };
  pack.sourceById = new Map(pack.sources.map((s) => [s.id, s]));
  pack.entityById = new Map(pack.entities.map((e) => [e.id, e]));
  pack.institutionById = new Map(pack.institutions.map((i) => [i.id, i]));
  pack.recordsByEntity = new Map();
  for (const r of pack.records) {
    if (!pack.recordsByEntity.has(r.entity_id)) pack.recordsByEntity.set(r.entity_id, []);
    pack.recordsByEntity.get(r.entity_id).push(r);
  }
  pack.routesByInstitution = new Map();
  for (const r of pack.routes) {
    if (!pack.routesByInstitution.has(r.institution_id)) pack.routesByInstitution.set(r.institution_id, []);
    pack.routesByInstitution.get(r.institution_id).push(r);
  }
  return pack;
}

/**
 * The gate a contributed pack has to pass. Everything here is a rule from
 * DESIGN.md that would otherwise be a comment nobody reads.
 */
export function validatePack(raw) {
  const errors = [];
  const warn = [];

  for (const f of PACK_FILES) {
    if (!raw[f]) errors.push(`missing ${f}.json`);
  }
  if (errors.length) return { ok: false, errors, warnings: warn };

  const pack = indexPack(raw);
  const sourceIds = new Set(pack.sources.map((s) => s.id));

  /* Law 2: a source without a retrieval date cannot express freshness. */
  for (const s of pack.sources) {
    if (!s.retrieved_at) errors.push(`source ${s.id}: retrieved_at is required`);
    if (!s.excerpt?.trim()) errors.push(`source ${s.id}: excerpt is required — we quote, we do not paraphrase`);
    if (!('published_at' in s)) errors.push(`source ${s.id}: published_at must be present (null is allowed, absent is not)`);
    if (s.published_at === null) warn.push(`source ${s.id}: undated — the interface will say so`);
  }

  /* §25: every record keeps the exact official wording. */
  for (const r of pack.records) {
    if (!sourceIds.has(r.source_id)) errors.push(`record ${r.id}: source_id "${r.source_id}" does not resolve`);
    if (!r.verbatim?.trim()) errors.push(`record ${r.id}: verbatim official wording is required`);
    if (!pack.entityById.has(r.entity_id)) errors.push(`record ${r.id}: entity_id "${r.entity_id}" does not resolve`);
  }

  for (const e of pack.entities) {
    if (e.institution_id && !pack.institutionById.has(e.institution_id)) {
      errors.push(`entity ${e.id}: institution_id "${e.institution_id}" does not resolve`);
    }
  }

  /* §21.1: an unverified route may exist in the data but must be marked so
     the engine can refuse it. A route claiming verification without a date
     or a source is the dangerous case. */
  for (const r of pack.routes) {
    if (!pack.institutionById.has(r.institution_id)) {
      errors.push(`route ${r.id}: institution_id "${r.institution_id}" does not resolve`);
    }
    const claimsVerified = Boolean(r.verified_at);
    if (claimsVerified && !r.source_id) errors.push(`route ${r.id}: verified_at set but no source_id`);
    if (claimsVerified && !sourceIds.has(r.source_id)) errors.push(`route ${r.id}: source_id "${r.source_id}" does not resolve`);
    if (claimsVerified && !r.verified_how) errors.push(`route ${r.id}: verified_at set but verified_how is missing`);
    if (!claimsVerified) warn.push(`route ${r.id}: unverified — will not be offered to users`);
  }

  /* §21.1: a deadline without a source is an invented deadline. */
  for (const p of pack.procedures) {
    if (p.deadline_days != null && !p.deadline_source_id) {
      errors.push(`procedure ${p.id}: deadline_days set without deadline_source_id — no invented deadlines`);
    }
    if (p.deadline_source_id && !sourceIds.has(p.deadline_source_id)) {
      errors.push(`procedure ${p.id}: deadline_source_id does not resolve`);
    }
  }

  /* Law 8: fixtures are labelled in the data, not only in the repo. */
  const anyFixture = pack.sources.some((s) => s.is_fixture);
  if (anyFixture && !pack.meta.is_fixture) {
    errors.push('pack.json: contains fixture sources but is_fixture is not set on the pack');
  }
  if (pack.meta.is_fixture && !pack.meta.fixture_notice) {
    errors.push('pack.json: is_fixture is set but fixture_notice is missing');
  }

  return { ok: errors.length === 0, errors, warnings: warn, pack };
}

/** Browser-side load. Cached by the service worker for offline use. §17 */
export async function loadPack(id, base = 'data/packs') {
  const raw = {};
  await Promise.all(PACK_FILES.map(async (f) => {
    const res = await fetch(`${base}/${id}/${f}.json`);
    if (!res.ok) throw new Error(`pack ${id}: cannot load ${f}.json (${res.status})`);
    raw[f] = await res.json();
  }));
  const result = validatePack(raw);
  if (!result.ok) throw new Error(`pack ${id} failed validation:\n  ${result.errors.join('\n  ')}`);
  return result.pack;
}
