/**
 * Wazi — the Aperture.  DESIGN.md §8.
 *
 * Six leaves of light around a warm core. No face, no gender, no species.
 * All expression is geometry, light and timing, driven by exactly two
 * numbers — `openness` and `energy` — so the whole character animates
 * convincingly inside a 2ms frame budget on a 3GB Android Go.
 *
 * Only `transform` and `opacity` ever mutate. No layout, no path morphing.
 */

const NS = 'http://www.w3.org/2000/svg';

/* §8.3 — exactly one state at a time, driven by the app machine. */
export const STATES = {
  dormant:   { openness: 0.00, energy: 0.00, spin: 0,    breathe: 0,    core: 'amber', dim: 0.35 },
  waking:    { openness: 1.00, energy: 0.40, spin: 0,    breathe: 0,    core: 'amber', dim: 1.00 },
  resting:   { openness: 0.55, energy: 0.17, spin: 0,    breathe: 0.05, core: 'amber', dim: 1.00 },
  listening: { openness: 1.00, energy: 0.25, spin: 0,    breathe: 0,    core: 'amber', dim: 1.00 },
  hearing:   { openness: 1.00, energy: null, spin: 0,    breathe: 0,    core: 'amber', dim: 1.00 },
  thinking:  { openness: 0.30, energy: 0.15, spin: 0.06, breathe: 0,    core: 'amber', dim: 0.70 },
  working:   { openness: 0.30, energy: 0.15, spin: 0.06, breathe: 0,    core: 'amber', dim: 0.70 },
  speaking:  { openness: 0.72, energy: null, spin: 0,    breathe: 0,    core: 'amber', dim: 1.10 },
  awaiting:  { openness: 0.45, energy: 0.00, spin: 0,    breathe: 0,    core: 'hollow', dim: 1.00 },
  attention: { openness: 0.60, energy: 0.00, spin: 0,    breathe: 0,    core: 'amber', dim: 1.00 },
  offline:   { openness: 0.20, energy: 0.00, spin: 0,    breathe: 0,    core: 'slate', dim: 0.60 },
};

/* How fast a state change is taken up. The listening snap is the tell
   that Wazi is really listening — do not soften it. §8.3 */
const ENTER_MS = {
  dormant: 320, waking: 520, resting: 320, listening: 120, hearing: 60,
  thinking: 240, working: 240, speaking: 160, awaiting: 280,
  attention: 900, offline: 320,
};

/* Announced to screen readers via a polite live region. The SVG itself
   is aria-hidden — the state is information, the drawing is not. §8.5 */
export const STATE_SPEECH = {
  dormant: '', waking: 'Wazi is here',
  resting: '', listening: 'Wazi is listening', hearing: 'Wazi is listening',
  thinking: 'Wazi is thinking', working: 'Wazi is checking the records',
  speaking: 'Wazi is speaking', awaiting: 'Wazi is waiting for permission',
  attention: 'Wazi needs your attention', offline: 'Wazi is offline',
};

/**
 * An aperture blade, authored pointing up from the origin.
 *
 * The straight inner edge is what forms the opening: six of these at 60°
 * each span roughly 95°, so they overlap the way a real iris diaphragm
 * does. An earlier version used narrow rounded leaves, which rendered as
 * a daisy — separated petals read as a flower, not as something opening.
 */
const LEAF_PATH = 'M -30,-14 L 30,-14 L 40,-44 Q 0,-70 -40,-44 Z';
const LEAF_COUNT = 6;
const MAX_MOTES = 5;

const TEAL_CLOSED = [0x0e, 0x8e, 0x7f];   /* --teal-700 */
const TEAL_OPEN   = [0x16, 0xc6, 0xb1];   /* --teal-500 */
const SLATE       = [0x78, 0x90, 0x9a];   /* --slate-500 */

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) =>
  `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── One rAF loop for the whole app (§8.5) ───────────────────────────── */

const instances = new Set();
let running = false;
let slowFrames = 0;
let tier = 'full';          /* full → 30fps → static */
let lastPaint = 0;

function frame(now) {
  if (!instances.size) { running = false; return; }
  requestAnimationFrame(frame);

  const started = performance.now();

  if (tier === 'thirty' && now - lastPaint < 33) return;
  if (tier === 'static') return;
  lastPaint = now;

  for (const inst of instances) inst._tick(now);

  /* Degrade rather than stutter. §8.5 */
  const cost = performance.now() - started;
  if (cost > 40) {
    if (++slowFrames >= 3) {
      if (tier === 'full') { tier = 'thirty'; slowFrames = 0; }
      else if (tier === 'thirty' && slowFrames >= 2) tier = 'static';
    }
  } else if (slowFrames > 0) slowFrames--;
}

function start() {
  if (running) return;
  running = true;
  requestAnimationFrame(frame);
}

/* ── The character ───────────────────────────────────────────────────── */

export function createAperture({ size = 168, motes: showMotes = true, live = false } = {}) {
  const reduced = prefersReducedMotion();

  const wrap = document.createElement('div');
  wrap.className = 'aperture';
  wrap.style.width = wrap.style.height = `${size}px`;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('aperture-svg');

  /* Below 96px the motes and rim dashes are noise. §8.2 */
  const detailed = size >= 96;
  const glowEnabled = detailed && !document.documentElement.classList.contains('tier-light');

  const defs = document.createElementNS(NS, 'defs');
  const uid = `wz${Math.random().toString(36).slice(2, 8)}`;
  defs.innerHTML =
    `<radialGradient id="${uid}core">` +
      `<stop offset="0%" stop-color="#FFE9B8"/>` +
      `<stop offset="55%" stop-color="#F4B942"/>` +
      `<stop offset="100%" stop-color="#E09A1C"/>` +
    `</radialGradient>` +
    /* The housing. A real diaphragm hides the backs of its blades behind
       a circular barrel — without it the outer silhouette goes ragged as
       the blades travel, and the whole thing reads as a gear. */
    `<clipPath id="${uid}housing"><circle cx="0" cy="0" r="45"/></clipPath>` +
    (glowEnabled
      ? `<filter id="${uid}blur" x="-60%" y="-60%" width="220%" height="220%">` +
        `<feGaussianBlur stdDeviation="6"/></filter>`
      : '');
  svg.appendChild(defs);

  const root = document.createElementNS(NS, 'g');
  root.setAttribute('transform', 'translate(60,60)');
  svg.appendChild(root);

  const glow = document.createElementNS(NS, 'circle');
  glow.setAttribute('r', '22');
  glow.setAttribute('fill', '#F4B942');
  glow.setAttribute('opacity', '0.18');
  if (glowEnabled) glow.setAttribute('filter', `url(#${uid}blur)`);
  root.appendChild(glow);

  const rim = document.createElementNS(NS, 'circle');
  rim.setAttribute('r', '52');
  rim.setAttribute('fill', 'none');
  rim.setAttribute('stroke', '#16C6B1');
  rim.setAttribute('stroke-width', '1.25');
  rim.setAttribute('stroke-dasharray', detailed ? '2 6' : '0 0');
  rim.setAttribute('opacity', '0.10');
  root.appendChild(rim);

  const leafGroup = document.createElementNS(NS, 'g');
  leafGroup.setAttribute('clip-path', `url(#${uid}housing)`);
  root.appendChild(leafGroup);
  const leaves = [];
  for (let i = 0; i < LEAF_COUNT; i++) {
    const leaf = document.createElementNS(NS, 'path');
    leaf.setAttribute('d', LEAF_PATH);
    leaf.setAttribute('fill', '#0E8E7F');
    /* Overlapping blades in one flat colour merge into a solid ring —
       a hairline edge is what makes it read as six blades. */
    leaf.setAttribute('stroke', '#071820');
    leaf.setAttribute('stroke-width', '0.9');
    leaf.setAttribute('stroke-linejoin', 'round');
    leafGroup.appendChild(leaf);
    leaves.push(leaf);
  }

  const core = document.createElementNS(NS, 'circle');
  core.setAttribute('r', '14');
  core.setAttribute('fill', `url(#${uid}core)`);
  root.appendChild(core);

  const moteGroup = document.createElementNS(NS, 'g');
  root.appendChild(moteGroup);

  wrap.appendChild(svg);

  /* State is information; the drawing is decoration. §8.5 / §29 */
  let liveEl = null;
  if (live) {
    liveEl = document.createElement('p');
    liveEl.className = 'sr-only';
    liveEl.setAttribute('role', 'status');
    liveEl.setAttribute('aria-live', 'polite');
    wrap.appendChild(liveEl);
  }

  const cur = { openness: 0, energy: 0, dim: 0.35, spinAngle: 0, rimAngle: 0, moteAngle: 0 };
  let stateName = 'dormant';
  let target = STATES.dormant;
  let enterMs = 320;
  let enteredAt = 0;
  let extEnergy = 0;         /* live mic / TTS amplitude */
  let motes = [];
  let attentionUntil = 0;

  const inst = {
    _tick(now) {
      const spec = target;
      const k = reduced ? 1 : Math.min(1, (now - enteredAt) / enterMs);
      /* ease-out on the approach */
      const e = 1 - Math.pow(1 - k, 3);

      let wantOpen = spec.openness;
      let wantEnergy = spec.energy === null ? extEnergy : spec.energy;
      let wantDim = spec.dim;

      if (!reduced && spec.breathe) {
        /* 0.16 Hz — one cycle per 6.25s. Slow enough to be subliminal. §8.3 */
        wantEnergy += Math.sin(now * 0.001 * 0.16 * Math.PI * 2) * spec.breathe;
      }
      if (stateName === 'attention' && !reduced) {
        const p = clamp01((now - enteredAt) / 900);
        wantEnergy = Math.sin(p * Math.PI * 2 * 2) * 0.8;
        if (now > attentionUntil) inst.setState('resting');
      }

      cur.openness = lerp(cur.openness, wantOpen, e);
      cur.energy = lerp(cur.energy, clamp01(wantEnergy), reduced ? 1 : 0.28);
      cur.dim = lerp(cur.dim, wantDim, e);

      if (!reduced) {
        if (spec.spin) cur.spinAngle = (cur.spinAngle + spec.spin * 360 / 60) % 360;
        cur.rimAngle = (cur.rimAngle + 0.02 * 360 / 60) % 360;
        cur.moteAngle = (cur.moteAngle + 0.22 * 360 / 60) % 360;
      }

      /* ── paint ── */
      const open = cur.openness;
      /* push moves the blade along its own axis: negative closes the
         hole over the core, positive opens it. twist adds the slight
         rotation a real diaphragm has as it travels. */
      /* The closed extreme pushes the inner edge PAST the centre so the
         blades genuinely cover the core — stopping short leaves a lit
         pinhole and a closed aperture still looks awake. */
      const twist = lerp(-15, 4, open);
      const push = lerp(-16, 10, open);
      const leafFill = spec.core === 'slate' ? mix(SLATE, SLATE, 0) : mix(TEAL_CLOSED, TEAL_OPEN, open);
      const leafOp = (0.55 + open * 0.45) * cur.dim;

      for (let i = 0; i < LEAF_COUNT; i++) {
        const a = i * (360 / LEAF_COUNT) + twist + cur.spinAngle;
        leaves[i].setAttribute('transform', `rotate(${a.toFixed(2)}) translate(0,${(-push).toFixed(2)})`);
        leaves[i].setAttribute('fill', leafFill);
        leaves[i].setAttribute('opacity', leafOp.toFixed(3));
      }

      /* When the blades close over the core the glow must go with it,
         or a closed aperture still looks lit. */
      const coreR = 14 + cur.energy * 5;
      core.setAttribute('r', coreR.toFixed(2));
      if (spec.core === 'hollow') {
        core.setAttribute('fill', 'none');
        core.setAttribute('stroke', '#F4B942');
        core.setAttribute('stroke-width', '2');
        core.setAttribute('opacity', (0.8 * cur.dim).toFixed(3));
      } else {
        core.setAttribute('fill', spec.core === 'slate' ? '#78909A' : `url(#${uid}core)`);
        core.removeAttribute('stroke');
        core.setAttribute('opacity', Math.min(1, cur.dim).toFixed(3));
      }

      glow.setAttribute('r', (22 + cur.energy * 10).toFixed(2));
      glow.setAttribute('opacity', ((0.18 + cur.energy * 0.22) * cur.dim).toFixed(3));
      glow.setAttribute('fill', spec.core === 'slate' ? '#78909A' : '#F4B942');

      rim.setAttribute('opacity', (0.10 + cur.energy * 0.35).toFixed(3));
      rim.setAttribute('transform', `rotate(${cur.rimAngle.toFixed(2)})`);

      if (showMotes && detailed) inst._paintMotes();
    },

    _paintMotes() {
      const n = Math.min(motes.length, MAX_MOTES);
      while (moteGroup.childNodes.length > n) moteGroup.removeChild(moteGroup.lastChild);
      while (moteGroup.childNodes.length < n) {
        const g = document.createElementNS(NS, 'g');
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('r', '3');
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', '10');
        t.setAttribute('y', '4');
        t.setAttribute('font-size', '9');
        t.setAttribute('font-weight', '500');
        g.append(c, t);
        moteGroup.appendChild(g);
      }
      for (let i = 0; i < n; i++) {
        const m = motes[i];
        const g = moteGroup.childNodes[i];
        const ang = (cur.moteAngle + i * (360 / MAX_MOTES)) * Math.PI / 180;
        const x = Math.cos(ang) * 54, y = Math.sin(ang) * 54;
        g.setAttribute('transform', `translate(${x.toFixed(2)},${y.toFixed(2)})`);
        const colour = m.status === 'failed' ? '#78909A' : '#16C6B1';
        g.firstChild.setAttribute('fill', colour);
        g.firstChild.setAttribute('opacity', m.status === 'done' ? '0.3' : '1');
        /* At most two labels visible at once — more is noise. §8.2 */
        const t = g.lastChild;
        t.textContent = i < 2 ? m.label : '';
        t.setAttribute('fill', colour);
      }
    },

    setState(name) {
      if (!STATES[name]) throw new Error(`Unknown aperture state: ${name}`);
      if (name === stateName) return;
      stateName = name;
      target = STATES[name];
      enterMs = ENTER_MS[name] ?? 320;
      enteredAt = performance.now();
      if (name === 'attention') attentionUntil = enteredAt + 900;
      if (liveEl) {
        const say = STATE_SPEECH[name];
        if (say) liveEl.textContent = say;
      }
      wrap.dataset.state = name;
      return inst;
    },

    get state() { return stateName; },

    /* Live amplitude from mic or TTS, 0..1. Used by `hearing` / `speaking`. */
    setEnergy(v) { extEnergy = clamp01(Number(v) || 0); return inst; },

    /* §8.4 — each mote is a running tool call, labelled in plain language. */
    setMotes(list) { motes = Array.isArray(list) ? list.slice(0, MAX_MOTES) : []; return inst; },

    setSize(px) {
      wrap.style.width = wrap.style.height = `${px}px`;
      svg.setAttribute('width', String(px));
      svg.setAttribute('height', String(px));
      return inst;
    },

    destroy() { instances.delete(inst); wrap.remove(); },

    el: wrap,
  };

  instances.add(inst);
  start();
  inst.setState('dormant');
  inst._tick(performance.now());
  return inst;
}

/* Exposed for the perf tests and the debug panel. */
export const __perf = {
  get tier() { return tier; },
  set tier(v) { tier = v; },
  get instanceCount() { return instances.size; },
};
