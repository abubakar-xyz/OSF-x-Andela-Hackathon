/**
 * Local-first storage.  DESIGN.md §22, §23.2.
 *
 * Two IndexedDB stores, deliberately separate: `cases` holds evidence and
 * drafts, `identity` holds the user's own details. That separation is
 * what makes "delete my details" genuinely leave the case intact, and
 * vice versa.
 *
 * Nothing is retained server-side. There is no account, so there is no
 * account to breach.
 */

const DB = 'wazi';
const VERSION = 1;
const STORE_CASES = 'cases';
const STORE_IDENTITY = 'identity';

let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CASES)) {
        db.createObjectStore(STORE_CASES, { keyPath: 'id' }).createIndex('opened_at', 'opened_at');
      }
      if (!db.objectStoreNames.contains(STORE_IDENTITY)) {
        db.createObjectStore(STORE_IDENTITY, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/* ── Cases ───────────────────────────────────────────────────────────── */

export const saveCase = (kase) =>
  tx(STORE_CASES, 'readwrite', (s) => s.put({ ...kase, updated_at: new Date().toISOString() }));

export const getCase = (id) => tx(STORE_CASES, 'readonly', (s) => s.get(id));

export async function listCases() {
  const all = await tx(STORE_CASES, 'readonly', (s) => s.getAll());
  return (all ?? []).sort((a, b) => (b.opened_at ?? '').localeCompare(a.opened_at ?? ''));
}

export const deleteCase = (id) => tx(STORE_CASES, 'readwrite', (s) => s.delete(id));

/* ── Identity — separate store, separate delete ──────────────────────── */

export const setIdentity = (key, value) =>
  tx(STORE_IDENTITY, 'readwrite', (s) => s.put({ key, value }));

export async function getIdentity() {
  const rows = await tx(STORE_IDENTITY, 'readonly', (s) => s.getAll());
  return Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]));
}

export const clearIdentity = () => tx(STORE_IDENTITY, 'readwrite', (s) => s.clear());

/** Real, immediate and verifiable. §22 */
export async function deleteEverything() {
  await tx(STORE_CASES, 'readwrite', (s) => s.clear());
  await tx(STORE_IDENTITY, 'readwrite', (s) => s.clear());
  try { localStorage.removeItem('wazi.prefs'); } catch { /* private mode */ }
  return { ok: true, cases: 0, identity: 0 };
}

/* ── Preferences: per-device conveniences only, never case data ──────── */

export function readPrefs() {
  try { return JSON.parse(localStorage.getItem('wazi.prefs') || '{}'); }
  catch { return {}; }
}

export function writePrefs(patch) {
  try {
    const next = { ...readPrefs(), ...patch };
    localStorage.setItem('wazi.prefs', JSON.stringify(next));
    return next;
  } catch { return readPrefs(); }
}

/** Strips EXIF and GPS by re-encoding through a canvas. The precise data
 *  never reaches storage, because it never survives import. §22 */
export async function importImage(file, { maxEdge = 1280, quality = 0.82 } = {}) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  return {
    blob, width: w, height: h, bytes: blob.size,
    exif_stripped: true,
    imported_at: new Date().toISOString(),
  };
}
