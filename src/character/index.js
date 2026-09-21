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
  if (prefersReducedMotion()) return false;
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (c?.saveData) return false;
  if (c?.effectiveType && ['slow-2g', '2g'].includes(c.effectiveType)) return false;
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
  host.style.cssText = 'display:grid;place-items:center;cursor:pointer;';
  host.setAttribute('title', 'Wazi 3D Companion — Interactive Lens');
  host.appendChild(flat.el);

  let active = flat;
  let upgraded = false;
  const pending = { state: null, expression: null, energy: 0, motes: [], size, gaze: null };

  const handle = {
    el: host,
    get is3D() { return upgraded; },
    get state() { return active.state; },

    setState(n) { pending.state = n; active.setState(n); return handle; },
    setExpression(n) { pending.expression = n; active.setExpression?.(n); return handle; },
    setEnergy(v) { pending.energy = v; active.setEnergy(v); return handle; },
    setMotes(l) { pending.motes = l; active.setMotes(l); return handle; },
    setSize(px) { pending.size = px; active.setSize(px); host.style.width = host.style.height = `${px}px`; return handle; },
    lookAt(x, y) { pending.gaze = [x, y]; active.lookAt?.(x, y); return handle; },
    destroy() {
      window.removeEventListener('pointermove', onPointerMove);
      active.destroy?.();
      host.remove();
    },
  };

  /* Interactive pointer gaze tracking: Wazi's eye tracks mouse / touch */
  const onPointerMove = (e) => {
    const rect = host.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth * 0.45)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight * 0.45)));
    handle.lookAt(nx, ny);
  };
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  /* Interactive touch / tap response */
  host.addEventListener('click', () => {
    if (active.state === 'resting') {
      active.setState('attention');
      setTimeout(() => { if (active.state === 'attention') active.setState('resting'); }, 1400);
    }
  });

  if (upgrade && canUpgrade()) {
    const begin = () => import('./avatar3d.js')
      .then(({ createAvatar3D }) => createAvatar3D({ size: pending.size, motes }))
      .then((rich) => {
        /* Carry current state across smoothly */
        if (pending.state) rich.setState(pending.state);
        if (pending.expression) rich.setExpression(pending.expression);
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
        console.warn('[wazi] staying on flat aperture:', err?.message ?? err);
      });

    setTimeout(begin, 60);
  }

  return handle;
}

export { HEAVY_MB as THREE_GZIP_KB };
