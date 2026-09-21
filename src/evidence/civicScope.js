/**
 * Wazi — civic search scope.  DESIGN.md §25 (Country Packs), extended.
 *
 * A Country Pack is verified, curated, checkable-by-hand evidence — that
 * is what lets the Two Truths card say "VERIFIED" and mean it. Most of
 * Africa has no pack yet, and won't for a while: hand-curating and
 * re-verifying a government contact directory for even one country is
 * real, ongoing work, not a data-entry task (see PROVENANCE.md).
 *
 * What Wazi can still honestly do outside a loaded pack is point at the
 * *kind* of office that would know, in the citizen's own country, and
 * then search live for its current site rather than asserting one from
 * memory. So this file holds no URLs — a hardcoded government URL is
 * exactly the kind of unverifiable claim that got AI Studio's directory
 * flagged (see the audit earlier in this thread): addresses drift, sites
 * get redesigned, and a stale link asserted with confidence is worse
 * than no link. Only two things are safe to hardcode here: country names
 * (they don't change) and the *category* of office that generally holds
 * a given kind of public record (that doesn't change either, even where
 * the office's current URL does). Everything else is resolved live, at
 * query time, through the same searchPublicRecords() used for a claim —
 * see server/webSearch.mjs.
 */

/** Countries Wazi can meaningfully help search in — English or Kiswahili
 *  civic-record conventions are close enough to this build's language
 *  support to be useful. Adding a country here costs nothing to keep
 *  honest, because nothing about it is asserted as verified. */
export const CIVIC_COUNTRIES = [
  { code: 'KE', name: 'Kenya' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'GH', name: 'Ghana' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'UG', name: 'Uganda' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'SN', name: 'Senegal' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'MW', name: 'Malawi' },
  { code: 'SL', name: 'Sierra Leone' },
];

/** Office *categories*, not offices. "Which body audits public spending"
 *  is a stable fact about how a government is structured; "and its
 *  current URL is exactly this" is not — that half is looked up live. */
export const CIVIC_CATEGORIES = [
  { key: 'procurement',    label: 'Public procurement / tenders regulator',
    query: 'public procurement regulatory authority official website' },
  { key: 'audit',           label: 'Auditor-General / national audit office',
    query: 'auditor general national audit office official website' },
  { key: 'ombudsman',       label: 'Ombudsman / public protector',
    query: 'ombudsman public protector administrative justice commission official website' },
  { key: 'anticorruption',  label: 'Anti-corruption commission',
    query: 'anti-corruption commission official website' },
  { key: 'gazette',         label: 'Official government gazette',
    query: 'official government gazette publication portal' },
  { key: 'ati',             label: 'Access to information / right to information office',
    query: 'access to information right to information act official portal' },
];

export function findCountry(nameOrCode = '') {
  const q = String(nameOrCode).trim().toLowerCase();
  if (!q) return null;
  return CIVIC_COUNTRIES.find((c) => c.code.toLowerCase() === q || c.name.toLowerCase() === q)
      ?? CIVIC_COUNTRIES.find((c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()))
      ?? null;
}
