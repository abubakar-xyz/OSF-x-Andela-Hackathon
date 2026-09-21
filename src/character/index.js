/**
 * Which Wazi is mounted.  DESIGN.md §8, §28.
 *
 * The flat aperture mounts first, always. It is 4KB, it works on every
 * device, and the app is fully usable on it — so time to Wazi's first
 * word is unchanged. The 3D avatar then loads in the background and
 * upgrades in place if the device can carry it.
 *
 * This is one character at two fidelities, not two characters. The state
 * vocabulary is identical and the machine never knows which is mounted.
 */

import { createAperture, prefersReducedMotion } from './aperture.js';

const HEAVY_MB = 407;   /* three.js, gzipped. Measured, not estimated. */

export function canUpgrade() {
  if (typeof document === 'undefined') return false;
  /* Never on a thin connection or a small device: this is a civic
     product and Amina has 200MB left this week. §28 */
  const tier = document.documentElement.className.match(/tier-(\w+)/)?.[1];
  if (tier && tier !== 'full') return false;
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (c?.saveData) return false;
  if (c?.effectiveType && ['slow-2g', '2g', '3g'].includes(c.effectiveType)) return false;
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
  if (prefersReducedMotion()) return false;
  try {
    const cv = document.createElement('canvas');
    if (!(cv.getContext('webgl2') || cv.getContext('webgl'))) return false;
  } catch { return false; }
  return true;
}

/**
 * Mounts the flat aperture immediately and returns a handle that proxies
 * to whichever fidelity is live. Callers never branch on it.
 */
export function mountCharacter({ size = 168, motes = true, live = false, upgrade = true } = {}) {
  const flat = createAperture({ size, motes, live });
  const host = document.createElement('div');
  host.style.cssText = 'display:grid;place-items:center';
  host.appendChild(flat.el);

  let active = flat;
  let upgraded = false;
  const pending = { state: null, energy: 0, motes: [], size, gaze: null };

  const handle = {
    el: host,
    get is3D() { return upgraded; },
    get state() { return active.state; },

    setState(n) { pending.state = n; active.setState(n); return handle; },
    setEnergy(v) { pending.energy = v; active.setEnergy(v); return handle; },
    setMotes(l) { pending.motes = l; active.setMotes(l); return handle; },
    setSize(px) { pending.size = px; active.setSize(px); host.style.width = host.style.height = `${px}px`; return handle; },
    lookAt(x, y) { pending.gaze = [x, y]; active.lookAt?.(x, y); return handle; },
    destroy() { active.destroy?.(); host.remove(); },
  };

  if (upgrade && canUpgrade()) {
    /* Deliberately after first paint and after the app is interactive —
       407KB must never sit between the person and Wazi's first word. */
    const begin = () => import('./avatar3d.js')
      .then(({ createAvatar3D }) => createAvatar3D({ size: pending.size, motes }))
      .then((rich) => {
        /* Carry the current state across so the swap is invisible. */
        if (pending.state) rich.setState(pending.state);
        rich.setEnergy(pending.energy);
        rich.setMotes(pending.motes);
        if (pending.gaze) rich.lookAt(...pending.gaze);
        host.replaceChildren(rich.el);
        flat.destroy();
        active = rich;
        upgraded = true;
        host.dispatchEvent(new CustomEvent('wazi:upgraded', { bubbles: true }));
      })
      .catch((err) => {
        /* Staying flat is a correct outcome, not a failure to report to
           the person. The character keeps working. */
        console.warn('[wazi] staying on the flat aperture:', err?.message ?? err);
      });

    if ('requestIdleCallback' in window) requestIdleCallback(begin, { timeout: 4000 });
    else setTimeout(begin, 1800);
  }

  return handle;
}

export { HEAVY_MB as THREE_GZIP_KB };
