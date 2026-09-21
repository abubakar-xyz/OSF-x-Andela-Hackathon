/**
 * Wazi — Anthropomorphic Civic Companion (Vector Aperture).
 *
 * An expressive, warm anthropomorphic face designed with:
 *   · Distinct dual eyes that blink, dilate, and follow the user's gaze
 *   · Expressive articulated eyebrows conveying civic empathy, thought, and attentiveness
 *   · Responsive mouth and lips with real-time lip-sync articulation driven by speech audio
 *   · Smooth state transitions and low-overhead SVG rendering for high performance
 */

const NS = 'http://www.w3.org/2000/svg';

/* §8.3 — exactly one state at a time, driven by the app machine. */
export const STATES = {
  dormant:   { openness: 0.05, energy: 0.00, browY: -2, browTilt:  0.0, smile: 0.0,  dim: 0.45, core: 'amber' },
  waking:    { openness: 0.95, energy: 0.40, browY:  4, browTilt:  0.0, smile: 0.5,  dim: 1.00, core: 'amber' },
  resting:   { openness: 0.82, energy: 0.15, browY:  1, browTilt:  0.0, smile: 0.35, dim: 1.00, core: 'amber' },
  listening: { openness: 1.00, energy: 0.25, browY:  3, browTilt:  0.05, smile: 0.25, dim: 1.00, core: 'amber' },
  hearing:   { openness: 1.00, energy: null, browY:  4, browTilt:  0.08, smile: 0.25, dim: 1.05, core: 'amber' },
  thinking:  { openness: 0.70, energy: 0.15, browY:  2, browTilt: -0.25, smile: 0.0,  dim: 0.80, core: 'amber' },
  working:   { openness: 0.70, energy: 0.15, browY:  2, browTilt: -0.25, smile: 0.0,  dim: 0.80, core: 'amber' },
  speaking:  { openness: 0.90, energy: null, browY:  2, browTilt:  0.0, smile: 0.45, dim: 1.15, core: 'amber' },
  concern:   { openness: 0.85, energy: 0.20, browY:  3, browTilt:  0.30, smile: -0.1, dim: 0.95, core: 'amber' },
  conflict:  { openness: 0.85, energy: 0.20, browY:  3, browTilt:  0.30, smile: -0.1, dim: 0.95, core: 'amber' },
  awaiting:  { openness: 0.65, energy: 0.00, browY:  0, browTilt:  0.0, smile: 0.15, dim: 0.85, core: 'hollow' },
  attention: { openness: 1.00, energy: 0.50, browY:  5, browTilt:  0.0, smile: 0.55, dim: 1.20, core: 'amber' },
  offline:   { openness: 0.35, energy: 0.00, browY: -1, browTilt:  0.15, smile: -0.1, dim: 0.50, core: 'slate' },
};

/* State enter durations */
const ENTER_MS = {
  dormant: 320, waking: 520, resting: 320, listening: 120, hearing: 60,
  thinking: 240, working: 240, speaking: 160, awaiting: 280,
  attention: 600, offline: 320, concern: 240, conflict: 240,
};

export const STATE_SPEECH = {
  dormant: '', waking: 'Wazi is here',
  resting: '', listening: 'Wazi is listening', hearing: 'Wazi is listening',
  thinking: 'Wazi is thinking', working: 'Wazi is checking the records',
  speaking: 'Wazi is speaking', awaiting: 'Wazi is waiting for permission',
  attention: 'Wazi needs your attention', offline: 'Wazi is offline',
};

export const LEAF_PATH = 'M -30,-14 L 30,-14 L 40,-44 Q 0,-70 -40,-44 Z';
export const LEAF_COUNT = 6;
export const MAX_MOTES = 5;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Single animation loop */
const instances = new Set();
let running = false;
let slowFrames = 0;
let tier = 'full';
let lastPaint = 0;

function frame(now) {
  if (!instances.size) { running = false; return; }
  requestAnimationFrame(frame);

  const started = performance.now();
  if (tier === 'thirty' && now - lastPaint < 33) return;
  if (tier === 'static') return;
  lastPaint = now;

  for (const inst of instances) inst._tick(now);

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

export function createAperture({ size = 168, motes: showMotes = true, live = false } = {}) {
  const reduced = prefersReducedMotion();

  const wrap = document.createElement('div');
  wrap.className = 'aperture';
  wrap.style.width = wrap.style.height = `${size}px`;
  wrap.style.display = 'grid';
  wrap.style.placeItems = 'center';

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-60 -60 120 120');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('aperture-svg');

  const detailed = size >= 80;
  const uid = `wz${Math.random().toString(36).slice(2, 8)}`;

  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = `
    <radialGradient id="${uid}core" cx="38%" cy="36%" r="64%">
      <stop offset="0%" stop-color="#FFFDF5"/>
      <stop offset="25%" stop-color="#FEF3C7"/>
      <stop offset="60%" stop-color="#F59E0B"/>
      <stop offset="90%" stop-color="#D97706"/>
      <stop offset="100%" stop-color="#78350F"/>
    </radialGradient>
    <radialGradient id="${uid}head" cx="42%" cy="26%" r="80%">
      <stop offset="0%" stop-color="#1B383F"/>
      <stop offset="45%" stop-color="#11282D"/>
      <stop offset="85%" stop-color="#09181B"/>
      <stop offset="100%" stop-color="#040C0E"/>
    </radialGradient>
    <radialGradient id="${uid}blush" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.35"/>
      <stop offset="70%" stop-color="#F43F5E" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#F59E0B" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${uid}rim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2DD4BF"/>
      <stop offset="50%" stop-color="#14B8A6"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
    <filter id="${uid}glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3.0" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <clipPath id="${uid}eyeLClip">
      <rect id="${uid}eyeLRect" x="-26" y="-22" width="18" height="24" rx="9"/>
    </clipPath>
    <clipPath id="${uid}eyeRClip">
      <rect id="${uid}eyeRRect" x="8" y="-22" width="18" height="24" rx="9"/>
    </clipPath>
  `;
  svg.appendChild(defs);

  const root = document.createElementNS(NS, 'g');
  svg.appendChild(root);

  /* Outer halo / aperture frame */
  const halo = document.createElementNS(NS, 'circle');
  halo.setAttribute('cx', '0'); halo.setAttribute('cy', '0'); halo.setAttribute('r', '54');
  halo.setAttribute('fill', 'none');
  halo.setAttribute('stroke', `url(#${uid}rim)`);
  halo.setAttribute('stroke-width', '1.2');
  halo.setAttribute('stroke-dasharray', detailed ? '3 5' : '0 0');
  halo.setAttribute('opacity', '0.35');
  root.appendChild(halo);

  /* Sculpted Anthropomorphic Head Silhouette */
  const head = document.createElementNS(NS, 'path');
  head.setAttribute('d', 'M -38 -12 C -38 -42 38 -42 38 -12 C 38 18 26 42 0 46 C -26 42 -38 18 -38 -12 Z');
  head.setAttribute('fill', `url(#${uid}head)`);
  head.setAttribute('stroke', '#16C6B1');
  head.setAttribute('stroke-width', '1.3');
  root.appendChild(head);

  /* Temple acoustic nodes (left & right ears) */
  const earL = document.createElementNS(NS, 'ellipse');
  earL.setAttribute('cx', '-39'); earL.setAttribute('cy', '-6'); earL.setAttribute('rx', '2.5'); earL.setAttribute('ry', '7');
  earL.setAttribute('fill', '#16C6B1'); earL.setAttribute('opacity', '0.6');
  root.appendChild(earL);

  const earR = document.createElementNS(NS, 'ellipse');
  earR.setAttribute('cx', '39'); earR.setAttribute('cy', '-6'); earR.setAttribute('rx', '2.5'); earR.setAttribute('ry', '7');
  earR.setAttribute('fill', '#16C6B1'); earR.setAttribute('opacity', '0.6');
  root.appendChild(earR);

  /* ── Expressive Dual Eyes (Left & Right) ────────────────────────── */
  const eyeLGroup = document.createElementNS(NS, 'g');
  const eyeRGroup = document.createElementNS(NS, 'g');
  root.appendChild(eyeLGroup);
  root.appendChild(eyeRGroup);

  /* Eye sockets (deep contrast) */
  const sockL = document.createElementNS(NS, 'ellipse');
  sockL.setAttribute('cx', '-17'); sockL.setAttribute('cy', '-10'); sockL.setAttribute('rx', '8.5'); sockL.setAttribute('ry', '10.5');
  sockL.setAttribute('fill', '#040B0D');
  sockL.setAttribute('stroke', '#0E8E7F');
  sockL.setAttribute('stroke-width', '0.8');
  eyeLGroup.appendChild(sockL);

  const sockR = document.createElementNS(NS, 'ellipse');
  sockR.setAttribute('cx', '17'); sockR.setAttribute('cy', '-10'); sockR.setAttribute('rx', '8.5'); sockR.setAttribute('ry', '10.5');
  sockR.setAttribute('fill', '#040B0D');
  sockR.setAttribute('stroke', '#0E8E7F');
  sockR.setAttribute('stroke-width', '0.8');
  eyeRGroup.appendChild(sockR);

  /* Eye whites / sclera */
  const scleraL = document.createElementNS(NS, 'ellipse');
  scleraL.setAttribute('cx', '-17'); scleraL.setAttribute('cy', '-10'); scleraL.setAttribute('rx', '7.8'); scleraL.setAttribute('ry', '9.6');
  scleraL.setAttribute('fill', '#0A1C20');
  eyeLGroup.appendChild(scleraL);

  const scleraR = document.createElementNS(NS, 'ellipse');
  scleraR.setAttribute('cx', '17'); scleraR.setAttribute('cy', '-10'); scleraR.setAttribute('rx', '7.8'); scleraR.setAttribute('ry', '9.6');
  scleraR.setAttribute('fill', '#0A1C20');
  eyeRGroup.appendChild(scleraR);

  /* Luminous warm amber irises with gaze tracking */
  const irisL = document.createElementNS(NS, 'circle');
  irisL.setAttribute('cx', '-17'); irisL.setAttribute('cy', '-10'); irisL.setAttribute('r', '5.8');
  irisL.setAttribute('fill', `url(#${uid}core)`);
  eyeLGroup.appendChild(irisL);

  const irisR = document.createElementNS(NS, 'circle');
  irisR.setAttribute('cx', '17'); irisR.setAttribute('cy', '-10'); irisR.setAttribute('r', '5.8');
  irisR.setAttribute('fill', `url(#${uid}core)`);
  eyeRGroup.appendChild(irisR);

  /* Pupils that dilate with vocal energy */
  const pupilL = document.createElementNS(NS, 'circle');
  pupilL.setAttribute('cx', '-17'); pupilL.setAttribute('cy', '-10'); pupilL.setAttribute('r', '2.8');
  pupilL.setAttribute('fill', '#050D0F');
  eyeLGroup.appendChild(pupilL);

  const pupilR = document.createElementNS(NS, 'circle');
  pupilR.setAttribute('cx', '17'); pupilR.setAttribute('cy', '-10'); pupilR.setAttribute('r', '2.8');
  pupilR.setAttribute('fill', '#050D0F');
  eyeRGroup.appendChild(pupilR);

  /* Moisture glints for lively, sentient eye contact */
  const glintL = document.createElementNS(NS, 'circle');
  glintL.setAttribute('cx', '-18.8'); glintL.setAttribute('cy', '-12.2'); glintL.setAttribute('r', '1.6');
  glintL.setAttribute('fill', '#FFFFFF'); glintL.setAttribute('opacity', '0.95');
  eyeLGroup.appendChild(glintL);

  const glint2L = document.createElementNS(NS, 'circle');
  glint2L.setAttribute('cx', '-15.2'); glint2L.setAttribute('cy', '-8.2'); glint2L.setAttribute('r', '0.8');
  glint2L.setAttribute('fill', '#FFFFFF'); glint2L.setAttribute('opacity', '0.75');
  eyeLGroup.appendChild(glint2L);

  const glintR = document.createElementNS(NS, 'circle');
  glintR.setAttribute('cx', '15.2'); glintR.setAttribute('cy', '-12.2'); glintR.setAttribute('r', '1.6');
  glintR.setAttribute('fill', '#FFFFFF'); glintR.setAttribute('opacity', '0.95');
  eyeRGroup.appendChild(glintR);

  const glint2R = document.createElementNS(NS, 'circle');
  glint2R.setAttribute('cx', '18.8'); glint2R.setAttribute('cy', '-8.2'); glint2R.setAttribute('r', '0.8');
  glint2R.setAttribute('fill', '#FFFFFF'); glint2R.setAttribute('opacity', '0.75');
  eyeRGroup.appendChild(glint2R);

  /* Eyelids for organic blinking */
  const lidL = document.createElementNS(NS, 'path');
  lidL.setAttribute('fill', '#0D1E22');
  lidL.setAttribute('stroke', '#16C6B1');
  lidL.setAttribute('stroke-width', '1');
  eyeLGroup.appendChild(lidL);

  const lidR = document.createElementNS(NS, 'path');
  lidR.setAttribute('fill', '#0D1E22');
  lidR.setAttribute('stroke', '#16C6B1');
  lidR.setAttribute('stroke-width', '1');
  eyeRGroup.appendChild(lidR);

  /* ── Articulated Eyebrows (Empathy, Curiosity, Thought) ────────── */
  const browL = document.createElementNS(NS, 'path');
  browL.setAttribute('stroke', '#2DD4BF');
  browL.setAttribute('stroke-width', '2.2');
  browL.setAttribute('stroke-linecap', 'round');
  browL.setAttribute('fill', 'none');
  root.appendChild(browL);

  const browR = document.createElementNS(NS, 'path');
  browR.setAttribute('stroke', '#2DD4BF');
  browR.setAttribute('stroke-width', '2.2');
  browR.setAttribute('stroke-linecap', 'round');
  browR.setAttribute('fill', 'none');
  root.appendChild(browR);

  /* ── Nose Contour ──────────────────────────────────────────────── */
  const nose = document.createElementNS(NS, 'path');
  nose.setAttribute('d', 'M 0 -3 L 0 5 L 2.8 7');
  nose.setAttribute('stroke', '#2DD4BF');
  nose.setAttribute('stroke-width', '1.2');
  nose.setAttribute('stroke-linecap', 'round');
  nose.setAttribute('stroke-linejoin', 'round');
  nose.setAttribute('fill', 'none');
  nose.setAttribute('opacity', '0.45');
  root.appendChild(nose);

  /* Friendly warm cheek radiance */
  const cheekL = document.createElementNS(NS, 'circle');
  cheekL.setAttribute('cx', '-25'); cheekL.setAttribute('cy', '6'); cheekL.setAttribute('r', '8');
  cheekL.setAttribute('fill', `url(#${uid}blush)`);
  root.appendChild(cheekL);

  const cheekR = document.createElementNS(NS, 'circle');
  cheekR.setAttribute('cx', '25'); cheekR.setAttribute('cy', '6'); cheekR.setAttribute('r', '8');
  cheekR.setAttribute('fill', `url(#${uid}blush)`);
  root.appendChild(cheekR);

  /* ── Articulated Mouth & Lips (Active Real-Time Lip-Sync) ───────── */
  const mouthGroup = document.createElementNS(NS, 'g');
  root.appendChild(mouthGroup);

  const mouthCavity = document.createElementNS(NS, 'path');
  mouthCavity.setAttribute('fill', '#050D0F');
  mouthCavity.setAttribute('stroke', '#0E8E7F');
  mouthCavity.setAttribute('stroke-width', '0.8');
  mouthGroup.appendChild(mouthCavity);

  const mouthGlow = document.createElementNS(NS, 'ellipse');
  mouthGlow.setAttribute('cx', '0'); mouthGlow.setAttribute('cy', '22');
  mouthGlow.setAttribute('rx', '7'); mouthGlow.setAttribute('ry', '3');
  mouthGlow.setAttribute('fill', '#F4B942');
  mouthGlow.setAttribute('opacity', '0.0');
  mouthGroup.appendChild(mouthGlow);

  const upperLip = document.createElementNS(NS, 'path');
  upperLip.setAttribute('stroke', '#16C6B1');
  upperLip.setAttribute('stroke-width', '2.0');
  upperLip.setAttribute('stroke-linecap', 'round');
  upperLip.setAttribute('fill', 'none');
  mouthGroup.appendChild(upperLip);

  const lowerLip = document.createElementNS(NS, 'path');
  lowerLip.setAttribute('stroke', '#16C6B1');
  lowerLip.setAttribute('stroke-width', '1.8');
  lowerLip.setAttribute('stroke-linecap', 'round');
  lowerLip.setAttribute('fill', 'none');
  mouthGroup.appendChild(lowerLip);

  /* Mote Group */
  const moteGroup = document.createElementNS(NS, 'g');
  root.appendChild(moteGroup);

  wrap.appendChild(svg);

  let liveEl = null;
  if (live) {
    liveEl = document.createElement('p');
    liveEl.className = 'sr-only';
    liveEl.setAttribute('role', 'status');
    liveEl.setAttribute('aria-live', 'polite');
    wrap.appendChild(liveEl);
  }

  /* Internal state */
  const cur = {
    openness: 0.82,
    energy: 0.15,
    browY: 1,
    browTilt: 0,
    smile: 0.35,
    dim: 1.0,
    blink: 0,
    gazeX: 0,
    gazeY: 0,
    moteAngle: 0,
  };

  let stateName = 'resting';
  let target = STATES.resting;
  let enterMs = 320;
  let enteredAt = performance.now();
  let extEnergy = 0;
  let motes = [];
  let nextBlink = performance.now() + 2200 + Math.random() * 3000;
  let blinking = false;
  let targetGaze = { x: 0, y: 0 };

  const inst = {
    _tick(now) {
      const spec = target;
      const k = reduced ? 1 : Math.min(1, (now - enteredAt) / enterMs);
      const e = 1 - Math.pow(1 - k, 3);

      let wantOpen = spec.openness;
      let wantEnergy = spec.energy === null ? extEnergy : spec.energy;
      let wantDim = spec.dim;

      /* Organic breathing */
      if (!reduced && (stateName === 'resting' || stateName === 'dormant')) {
        wantEnergy += Math.sin(now * 0.001 * 0.22 * Math.PI * 2) * 0.04;
      }

      cur.openness = lerp(cur.openness, wantOpen, e);
      cur.energy = lerp(cur.energy, clamp01(wantEnergy), reduced ? 1 : 0.35);
      cur.browY = lerp(cur.browY, spec.browY ?? 0, e);
      cur.browTilt = lerp(cur.browTilt, spec.browTilt ?? 0, e);
      cur.smile = lerp(cur.smile, spec.smile ?? 0.3, e);
      cur.dim = lerp(cur.dim, wantDim, e);

      cur.gazeX = lerp(cur.gazeX, targetGaze.x, reduced ? 1 : 0.12);
      cur.gazeY = lerp(cur.gazeY, targetGaze.y, reduced ? 1 : 0.12);

      if (!reduced) {
        cur.moteAngle = (cur.moteAngle + 0.3) % 360;

        /* Organic blinking */
        if (!blinking && now > nextBlink) { blinking = true; }
        if (blinking) {
          cur.blink = Math.min(1, cur.blink + 0.26);
          if (cur.blink >= 1) {
            blinking = false;
            nextBlink = now + 2400 + Math.random() * 3800;
          }
        } else if (cur.blink > 0) {
          cur.blink = Math.max(0, cur.blink - 0.18);
        }
      }

      /* ── Paint Eyes & Eyelids ──────────────────────────────────── */
      const eyeOpen = clamp01(cur.openness * (1 - cur.blink * 0.95));
      const gazeOffX = cur.gazeX * 3.2;
      const gazeOffY = cur.gazeY * 2.8;

      irisL.setAttribute('cx', String(-17 + gazeOffX));
      irisL.setAttribute('cy', String(-10 + gazeOffY));
      irisR.setAttribute('cx', String(17 + gazeOffX));
      irisR.setAttribute('cy', String(-10 + gazeOffY));

      const pupilRVal = 2.4 + cur.energy * 1.3;
      pupilL.setAttribute('cx', String(-17 + gazeOffX));
      pupilL.setAttribute('cy', String(-10 + gazeOffY));
      pupilL.setAttribute('r', pupilRVal.toFixed(2));
      pupilR.setAttribute('cx', String(17 + gazeOffX));
      pupilR.setAttribute('cy', String(-10 + gazeOffY));
      pupilR.setAttribute('r', pupilRVal.toFixed(2));

      glintL.setAttribute('cx', String(-18.8 + gazeOffX * 0.7));
      glintL.setAttribute('cy', String(-12.2 + gazeOffY * 0.7));
      glint2L.setAttribute('cx', String(-15.2 + gazeOffX * 0.6));
      glint2L.setAttribute('cy', String(-8.2 + gazeOffY * 0.6));
      glintR.setAttribute('cx', String(15.2 + gazeOffX * 0.7));
      glintR.setAttribute('cy', String(-12.2 + gazeOffY * 0.7));
      glint2R.setAttribute('cx', String(18.8 + gazeOffX * 0.6));
      glint2R.setAttribute('cy', String(-8.2 + gazeOffY * 0.6));

      if (!reduced && detailed) {
        wrap.style.transform = `translateY(${(Math.sin(now / 1400) * 1.5).toFixed(2)}px)`;
      }

      /* Eyelids: closed arch when eyeOpen is 0, retracted when 1 */
      const lidY = lerp(0, -12, eyeOpen);
      lidL.setAttribute('d', `M -26 -22 L -8 -22 L -8 ${lidY.toFixed(1)} Q -17 ${(lidY + 4).toFixed(1)} -26 ${lidY.toFixed(1)} Z`);
      lidR.setAttribute('d', `M 8 -22 L 26 -22 L 26 ${lidY.toFixed(1)} Q 17 ${(lidY + 4).toFixed(1)} 8 ${lidY.toFixed(1)} Z`);

      /* ── Paint Eyebrows (Articulated Emotion) ─────────────────── */
      const bY = -23 - cur.browY;
      const tiltL = cur.browTilt * 8;
      const tiltR = -cur.browTilt * 8;

      if (stateName === 'thinking' || stateName === 'working') {
        /* Inquisitive thinking: left raised, right furrowed */
        browL.setAttribute('d', `M -26 ${bY - 3} Q -17 ${bY - 7} -8 ${bY - 2}`);
        browR.setAttribute('d', `M 8 ${bY + 2} Q 17 ${bY + 1} 26 ${bY + 4}`);
      } else {
        browL.setAttribute('d', `M -26 ${bY + tiltL} Q -17 ${bY - 2} -8 ${bY - tiltL}`);
        browR.setAttribute('d', `M 8 ${bY - tiltR} Q 17 ${bY - 2} 26 ${bY + tiltR}`);
      }

      /* ── Paint Mouth with Active Real-Time Lip-Sync ─────────────── */
      /* When speaking or voice energy > 0.05, lips articulate actively */
      const isSpeaking = stateName === 'speaking' || cur.energy > 0.22;
      const mouthOpen = isSpeaking ? Math.max(0.1, cur.energy * 14) : (cur.energy > 0.08 ? cur.energy * 4 : 0);
      const smileCurv = cur.smile * 4;

      if (mouthOpen > 1.2) {
        /* Articulating open mouth with inner glow */
        mouthCavity.setAttribute('d',
          `M -14 20 Q 0 ${20 - mouthOpen * 0.25} 14 20 Q 0 ${(20 + mouthOpen).toFixed(1)} -14 20 Z`
        );
        mouthCavity.setAttribute('opacity', '1');

        upperLip.setAttribute('d',
          `M -15 20 Q 0 ${(20 - mouthOpen * 0.25 + smileCurv * 0.2).toFixed(1)} 15 20`
        );
        lowerLip.setAttribute('d',
          `M -13 ${(20 + mouthOpen * 0.6).toFixed(1)} Q 0 ${(20 + mouthOpen + 1.5).toFixed(1)} 13 ${(20 + mouthOpen * 0.6).toFixed(1)}`
        );

        mouthGlow.setAttribute('cy', (20 + mouthOpen * 0.4).toFixed(1));
        mouthGlow.setAttribute('rx', (5 + mouthOpen * 0.4).toFixed(1));
        mouthGlow.setAttribute('ry', (mouthOpen * 0.35).toFixed(1));
        mouthGlow.setAttribute('opacity', (cur.energy * 1.5).toFixed(2));
      } else {
        /* Friendly closed resting smile */
        mouthCavity.setAttribute('opacity', '0');
        upperLip.setAttribute('d', `M -14 20 Q 0 ${(20 + smileCurv).toFixed(1)} 14 20`);
        lowerLip.setAttribute('d', `M -10 ${(21 + smileCurv * 0.4).toFixed(1)} Q 0 ${(23 + smileCurv * 0.8).toFixed(1)} 10 ${(21 + smileCurv * 0.4).toFixed(1)}`);
        mouthGlow.setAttribute('opacity', '0');
      }

      /* Halo & Motes */
      halo.setAttribute('opacity', (0.15 + cur.energy * 0.4).toFixed(2));
      if (showMotes && detailed) inst._paintMotes();
    },

    _paintMotes() {
      const n = Math.min(motes.length, MAX_MOTES);
      while (moteGroup.childNodes.length > n) {
        try {
          moteGroup.removeChild(moteGroup.lastChild);
        } catch {
          break;
        }
      }
      while (moteGroup.childNodes.length < n) {
        const g = document.createElementNS(NS, 'g');
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('r', '3');
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', '9');
        t.setAttribute('y', '3');
        t.setAttribute('font-size', '8.5');
        t.setAttribute('font-weight', '500');
        g.append(c, t);
        moteGroup.appendChild(g);
      }
      for (let i = 0; i < n; i++) {
        const m = motes[i];
        const g = moteGroup.childNodes[i];
        const ang = (cur.moteAngle + i * (360 / MAX_MOTES)) * Math.PI / 180;
        const x = Math.cos(ang) * 52, y = Math.sin(ang) * 52;
        g.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
        const colour = m.status === 'failed' ? '#78909A' : '#16C6B1';
        g.firstChild.setAttribute('fill', colour);
        g.firstChild.setAttribute('opacity', m.status === 'done' ? '0.35' : '1');
        const t = g.lastChild;
        t.textContent = i < 2 ? m.label : '';
        t.setAttribute('fill', colour);
      }
    },

    setState(name) {
      if (!STATES[name]) {
        console.warn(`[wazi] unknown aperture state ${name}, defaulting to resting`);
        name = 'resting';
      }
      stateName = name;
      target = STATES[name];
      enterMs = ENTER_MS[name] ?? 320;
      enteredAt = performance.now();
      if (liveEl) {
        const say = STATE_SPEECH[name];
        if (say) liveEl.textContent = say;
      }
      wrap.dataset.state = name;
      return inst;
    },

    setExpression(name) {
      if (STATES[name]) {
        target = STATES[name];
      }
      return inst;
    },

    get state() { return stateName; },

    setEnergy(v) {
      extEnergy = clamp01(Number(v) || 0);
      return inst;
    },

    setMotes(list) {
      motes = Array.isArray(list) ? list.slice(0, MAX_MOTES) : [];
      return inst;
    },

    lookAt(x, y) {
      targetGaze.x = Math.max(-1, Math.min(1, Number(x) || 0));
      targetGaze.y = Math.max(-1, Math.min(1, Number(y) || 0));
      return inst;
    },

    setSize(px) {
      wrap.style.width = wrap.style.height = `${px}px`;
      svg.setAttribute('width', String(px));
      svg.setAttribute('height', String(px));
      return inst;
    },

    destroy() {
      instances.delete(inst);
      wrap.remove();
    },

    el: wrap,
  };

  instances.add(inst);
  start();
  inst.setState('resting');
  inst._tick(performance.now());
  return inst;
}

export const __perf = {
  get tier() { return tier; },
  set tier(v) { tier = v; },
  get instanceCount() { return instances.size; },
};
