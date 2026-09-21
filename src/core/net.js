/** Performance tiers and connection honesty. DESIGN.md §28, §17.
 *  Capability is never silently reduced — only fidelity — and the tier
 *  is announced once, in one line, with a way back. */

export function detectTier() {
  const saved = (() => { try { return JSON.parse(localStorage.getItem('wazi.prefs') || '{}').tier; } catch { return null; } })();
  if (saved) return saved;
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (c?.saveData) return 'light';
  if (c?.effectiveType && ['slow-2g', '2g', '3g'].includes(c.effectiveType)) return 'light';
  if (navigator.deviceMemory && navigator.deviceMemory <= 2) return 'light';
  return 'full';
}

export function applyTier(tier) {
  const root = document.documentElement;
  root.classList.remove('tier-full', 'tier-light', 'tier-text');
  root.classList.add(`tier-${tier}`);
  return tier;
}

export const TIER_LINE = {
  light: 'Your connection’s thin — I’ve switched to light mode. You can change that any time.',
  text:  'Text only. Everything still works, it just won’t talk.',
};

export function watchOnline(onChange) {
  const emit = () => onChange(navigator.onLine);
  window.addEventListener('online', emit);
  window.addEventListener('offline', emit);
  return () => {
    window.removeEventListener('online', emit);
    window.removeEventListener('offline', emit);
  };
}
