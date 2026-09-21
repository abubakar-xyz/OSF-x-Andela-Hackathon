/**
 * Wazi in three dimensions.  DESIGN.md §8, revised.
 *
 * The flat aperture was legible but cold — it could show a state and it
 * could not look at you. This is the same character with depth and, more
 * importantly, with **gaze**: it looks at the person, turns toward a card
 * when one lands, blinks, leans in when it is curious and draws back a
 * little when the record and the evidence disagree.
 *
 * Eyes are the relatability mechanism, and an iris IS an eye — so this
 * stays a lens-being rather than becoming a face. No human, no robot, no
 * costume, and therefore no uncanny valley and no cultural assumption.
 *
 * Three.js is ~407KB gzipped, which is more than the whole rest of the
 * product. It is therefore LAZY: the app is fully interactive on the flat
 * aperture first, and this upgrades in place when it arrives. Light and
 * text tiers never fetch it. See DECISIONS.md #11.
 */

let THREE = null;

export async function loadThree() {
  if (THREE) return THREE;
  THREE = await import('../../assets/three/three.module.js');
  return THREE;
}

export const webglAvailable = () => {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
};

/* Same state vocabulary as the flat aperture, so the machine does not
   know or care which one is mounted. §8.3 */
const POSE = {
  dormant:   { open: 0.00, energy: 0, lean:  0.06, dist: 0.16, spin: 0,   glow: 0.18 },
  waking:    { open: 0.95, energy: 0.4, lean: -0.10, dist: 0.0, spin: 0,   glow: 1.00 },
  resting:   { open: 0.70, energy: 0.16, lean: 0.00, dist: 0.0, spin: 0,   glow: 0.85 },
  listening: { open: 1.00, energy: 0.25, lean: -0.13, dist: -0.18, spin: 0, glow: 1.00 },
  hearing:   { open: 1.00, energy: null, lean: -0.16, dist: -0.24, spin: 0, glow: 1.05 },
  thinking:  { open: 0.44, energy: 0.15, lean:  0.10, dist: 0.16, spin: 0.5, glow: 0.60 },
  working:   { open: 0.44, energy: 0.15, lean:  0.10, dist: 0.16, spin: 0.5, glow: 0.60 },
  speaking:  { open: 0.78, energy: null, lean: -0.06, dist: -0.08, spin: 0, glow: 1.10 },
  awaiting:  { open: 0.50, energy: 0, lean:  0.04, dist: 0.06, spin: 0,     glow: 0.70 },
  attention: { open: 0.66, energy: 0, lean: -0.20, dist: -0.20, spin: 0,    glow: 1.15 },
  /* Draws back. The one piece of body language that carries meaning:
     the record and what you saw do not agree, and Wazi is not pleased
     about it either. */
  offline:   { open: 0.22, energy: 0, lean:  0.16, dist: 0.30, spin: 0,    glow: 0.26 },
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export async function createAvatar3D({ size = 220, motes = true } = {}) {
  const T = await loadThree();

  const wrap = document.createElement('div');
  wrap.className = 'aperture aperture--3d';
  wrap.style.width = wrap.style.height = `${size}px`;

  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(size, size, false);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
  wrap.appendChild(renderer.domElement);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(32, 1, 0.1, 40);
  camera.position.set(0.5, 0.38, 8.1);
  camera.lookAt(0, 0, 0);

  /* The being sits in its own group so gaze rotates the whole thing. */
  const being = new T.Group();
  scene.add(being);

  const TEAL = 0x17c7b2, TEAL_DEEP = 0x0d8a79, LAMP = 0xf2b23e, SLATE = 0x78909a;
  /* The eye's radius. Blades must retract past it to reveal it, and
     cross it to cover it. Every travel number is expressed against it. */
  const EYE_R = 0.95;

  /* ── Blades ──────────────────────────────────────────────────────
     Six thin blades that shutter ACROSS the eye from in front, the way
     an iris diaphragm does. An earlier version sat them behind the eye
     and made them broad, which produced a flat disc with a button on
     it — the eye has to be the subject and the blades have to move
     over it. */
  const bladeShape = new T.Shape();
  bladeShape.moveTo(-1.50, 0);
  bladeShape.lineTo(1.50, 0);
  bladeShape.quadraticCurveTo(1.74, 0.70, 1.16, 1.26);
  bladeShape.quadraticCurveTo(0, 1.70, -1.16, 1.26);
  bladeShape.quadraticCurveTo(-1.74, 0.70, -1.50, 0);
  const bladeGeo = new T.ExtrudeGeometry(bladeShape, {
    depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.025, bevelSegments: 2,
  });
  /* Anchor the geometry at its INNER EDGE, not its centroid. `center()`
     moved the origin to the middle of the blade, which made every
     travel number below mean something other than what it said — the
     aperture read as shut in states that should have been open. With
     the inner edge at local y=0, `position.y` is literally how far the
     opening's edge is from the middle, and EYE_R is the number it has
     to clear. */
  bladeGeo.computeBoundingBox();
  bladeGeo.translate(0, -bladeGeo.boundingBox.min.y, 0);

  const bladeMat = new T.MeshStandardMaterial({
    color: TEAL, metalness: 0.28, roughness: 0.34,
    emissive: TEAL_DEEP, emissiveIntensity: 0.16,
  });

  const blades = [];
  for (let i = 0; i < 6; i++) {
    const pivot = new T.Group();
    pivot.rotation.z = (i / 6) * Math.PI * 2;
    const m = new T.Mesh(bladeGeo, bladeMat.clone());
    /* Alternating blades sit fractionally back, so six overlapping
       shapes read as six rather than as one disc. */
    m.material.color.setHex(i % 2 ? TEAL_DEEP : TEAL);
    /* In FRONT of the eye, each blade a hair deeper than the last so
       they stack rather than z-fight. */
    m.position.z = 0.62 + i * 0.014;
    pivot.add(m);
    being.add(pivot);
    blades.push({ pivot, mesh: m });
  }

  /* ── The core: a warm light, and the thing that looks at you ───── */
  const coreMat = new T.MeshStandardMaterial({
    color: LAMP, emissive: LAMP, emissiveIntensity: 1.5, roughness: 0.25, metalness: 0,
  });
  const core = new T.Mesh(new T.SphereGeometry(0.95, 40, 28), coreMat);
  /* Flattened along z so the eye sits BEHIND the blade plane. A full
     sphere reached past the blades, and a shut aperture still showed an
     eye staring through it. */
  core.scale.z = 0.42;
  being.add(core);

  const lamp = new T.PointLight(LAMP, 3.2, 12, 2);
  core.add(lamp);

  /* A dark pupil in front of the core gives the iris an actual centre —
     without it the eye has no focus and the gaze reads as nothing. */
  const pupil = new T.Mesh(
    new T.SphereGeometry(0.34, 28, 20),
    new T.MeshStandardMaterial({ color: 0x07110F, roughness: 0.55, metalness: 0 }));
  pupil.position.z = 0.82;
  core.add(pupil);

  /* A specular highlight. One tiny sphere, and it is most of why a
     rendered eye looks wet and alive rather than moulded. */
  const glint = new T.Mesh(
    new T.SphereGeometry(0.10, 14, 12),
    new T.MeshBasicMaterial({ color: 0xffffff }));
  glint.position.set(-0.30, 0.34, 1.0);
  core.add(glint);

  /* ── Housing ─────────────────────────────────────────────────── */
  const rim = new T.Mesh(
    new T.TorusGeometry(2.02, 0.036, 10, 84),
    new T.MeshStandardMaterial({ color: TEAL, emissive: TEAL, emissiveIntensity: 0.7, roughness: 0.4 }));
  rim.position.z = 1.5;
  being.add(rim);

  /* The barrel. A real diaphragm hides its retracted blades inside a
     housing; without one they fly past the rim and bleed to the edge of
     the canvas. This is the 3D equivalent of the flat version's clip
     path, and it is painted in the Night surface colour because the
     character only ever sits on Night. */
  const mask = new T.Mesh(
    new T.RingGeometry(2.06, 7, 72),
    new T.MeshBasicMaterial({ color: 0x0a1416, side: T.DoubleSide, transparent: true, opacity: 1 }));
  mask.position.z = 1.45;
  being.add(mask);

  const shell = new T.Mesh(
    new T.SphereGeometry(2.12, 40, 30),
    new T.MeshPhysicalMaterial({
      color: 0x0d2528, transparent: true, opacity: 0.30,
      roughness: 0.1, metalness: 0.25, side: T.BackSide,
    }));
  being.add(shell);

  /* ── Lights ──────────────────────────────────────────────────── */
  scene.add(new T.AmbientLight(0x1a2e2c, 2.0));
  const key = new T.DirectionalLight(0xdff5ef, 1.5); key.position.set(-2.4, 2.6, 3.4); scene.add(key);
  const rimLight = new T.DirectionalLight(TEAL, 1.1); rimLight.position.set(2.8, -1.4, -2.2); scene.add(rimLight);

  /* ── Motes: tool calls, orbiting in depth ────────────────────── */
  const moteGroup = new T.Group();
  being.add(moteGroup);
  const moteGeo = new T.SphereGeometry(0.11, 12, 10);
  const moteMat = new T.MeshBasicMaterial({ color: TEAL });
  const moteFail = new T.MeshBasicMaterial({ color: SLATE });
  const moteMeshes = [];
  for (let i = 0; i < 5; i++) {
    const m = new T.Mesh(moteGeo, moteMat);
    m.visible = false;
    moteGroup.add(m);
    moteMeshes.push(m);
  }

  /* ── Rig state ───────────────────────────────────────────────── */
  const cur = { open: 0.02, energy: 0, lean: 0, dist: 0, glow: 0.25, spin: 0, blink: 0 };
  let stateName = 'dormant';
  let pose = POSE.dormant;
  let extEnergy = 0;
  let moteList = [];
  let gaze = { x: 0, y: 0 };          /* where it is looking, -1..1 */
  let gazeTarget = { x: 0, y: 0 };
  let nextBlink = performance.now() + 2200 + Math.random() * 3000;
  let blinking = false;
  let raf = 0;
  let running = false;
  const reduced = matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);

    const wantEnergy = pose.energy === null ? extEnergy
      : pose.energy + (stateName === 'resting' && !reduced
          ? Math.sin(now * 0.001 * 0.16 * Math.PI * 2) * 0.05 : 0);

    cur.open = lerp(cur.open, pose.open, reduced ? 1 : 0.12);
    cur.energy = lerp(cur.energy, clamp01(wantEnergy), reduced ? 1 : 0.3);
    cur.lean = lerp(cur.lean, pose.lean, reduced ? 1 : 0.07);
    cur.dist = lerp(cur.dist, pose.dist, reduced ? 1 : 0.07);
    cur.glow = lerp(cur.glow, pose.glow, reduced ? 1 : 0.1);
    if (pose.spin && !reduced) cur.spin += pose.spin * 0.012;

    /* Blink. The single most alive-making signal there is, so it is not
       decorative: the blades shutter fully and snap back. */
    if (!reduced) {
      if (!blinking && now > nextBlink) { blinking = true; }
      if (blinking) {
        cur.blink = Math.min(1, cur.blink + 0.22);
        if (cur.blink >= 1) {
          blinking = false;
          nextBlink = now + 2600 + Math.random() * 4200;
        }
      } else if (cur.blink > 0) {
        cur.blink = Math.max(0, cur.blink - 0.14);
      }
    }

    const openNow = clamp01(cur.open * (1 - cur.blink * 0.94));

    /* Blades: rotate outward and travel along their own axis. */
    for (let i = 0; i < blades.length; i++) {
      const { pivot, mesh } = blades[i];
      pivot.rotation.z = (i / 6) * Math.PI * 2 + cur.spin + lerp(-0.30, 0.10, openNow);
      /* Closed, the inner edge crosses the centre and covers the eye.
         Open, it retracts past the eye's rim and the eye is clear. */
      /* Shut: the inner edge crosses the middle, covering the eye.
         Open: it clears EYE_R with room to spare. */
      mesh.position.y = lerp(-0.55, EYE_R + 1.05, openNow);
      mesh.rotation.x = lerp(0.10, 0.0, openNow);
      mesh.material.emissiveIntensity = 0.1 + cur.energy * 0.5;
    }

    /* The eye dilates with energy — this is the lip-sync equivalent,
       driven by the live 24kHz amplitude when Wazi is speaking. */
    core.scale.set(1 + cur.energy * 0.13, 1 + cur.energy * 0.13, 0.42);
    pupil.scale.setScalar(1 - cur.energy * 0.16);
    coreMat.emissiveIntensity = (1.1 + cur.energy * 1.6) * cur.glow;
    lamp.intensity = (2.2 + cur.energy * 3.4) * cur.glow;
    rim.material.emissiveIntensity = (0.35 + cur.energy * 0.8) * cur.glow;

    if (stateName === 'offline') {
      coreMat.color.setHex(SLATE); coreMat.emissive.setHex(SLATE);
    } else {
      coreMat.color.setHex(LAMP); coreMat.emissive.setHex(LAMP);
    }

    /* Gaze. The whole being turns a little; the core turns more, the way
       an eye leads a head. */
    gaze.x = lerp(gaze.x, gazeTarget.x, reduced ? 1 : 0.06);
    gaze.y = lerp(gaze.y, gazeTarget.y, reduced ? 1 : 0.06);
    being.rotation.y = gaze.x * 0.34 + Math.sin(now * 0.0004) * 0.02;
    being.rotation.x = -gaze.y * 0.26 + cur.lean;
    being.position.z = -cur.dist;
    core.rotation.y = gaze.x * 0.5;
    core.rotation.x = -gaze.y * 0.4;

    /* Motes orbit in depth, which is the one thing the flat version
       could never do. */
    if (motes) {
      for (let i = 0; i < moteMeshes.length; i++) {
        const m = moteMeshes[i];
        const item = moteList[i];
        m.visible = Boolean(item);
        if (!item) continue;
        const a = now * 0.0012 + (i / moteMeshes.length) * Math.PI * 2;
        m.position.set(Math.cos(a) * 2.6, Math.sin(a * 0.8) * 0.66, Math.sin(a) * 2.6);
        m.material = item.status === 'failed' ? moteFail : moteMat;
        m.scale.setScalar(item.status === 'done' ? 0.55 : 1);
      }
    }

    renderer.render(scene, camera);
  }

  const api = {
    el: wrap,
    get state() { return stateName; },
    is3D: true,

    setState(name) {
      if (!POSE[name]) throw new Error(`Unknown avatar state: ${name}`);
      stateName = name;
      pose = POSE[name];
      wrap.dataset.state = name;
      /* Looking slightly away while it thinks is what makes thinking
         read as thinking rather than as freezing. */
      if (name === 'thinking' || name === 'working') api.lookAt(0.42, 0.22);
      else if (name === 'listening' || name === 'hearing' || name === 'speaking') api.lookAt(0, 0);
      return api;
    },

    setEnergy(v) { extEnergy = clamp01(Number(v) || 0); return api; },
    setMotes(list) { moteList = Array.isArray(list) ? list.slice(0, 5) : []; return api; },

    /** -1..1 in each axis. The workspace calls this when a card lands,
     *  so Wazi turns toward the thing it just found. */
    lookAt(x, y) { gazeTarget = { x: clamp01((x + 1) / 2) * 2 - 1, y: clamp01((y + 1) / 2) * 2 - 1 }; return api; },

    setSize(px) {
      wrap.style.width = wrap.style.height = `${px}px`;
      renderer.setSize(px, px, false);
      return api;
    },

    /* Exposed for the render tests: the numbers that decide whether the
       eye is visible, so a regression is measurable and not a matter of
       squinting at a screenshot. */
    get __rig() {
      return {
        state: stateName,
        open: +cur.open.toFixed(3),
        blink: +cur.blink.toFixed(3),
        eyeR: EYE_R,
        innerEdge: +blades[0].mesh.position.y.toFixed(3),
        eyeVisible: blades[0].mesh.position.y > EYE_R,
      };
    },

    start() { if (!running) { running = true; raf = requestAnimationFrame(frame); } return api; },
    stop() { running = false; cancelAnimationFrame(raf); return api; },

    destroy() {
      api.stop();
      bladeGeo.dispose(); moteGeo.dispose();
      scene.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      renderer.dispose();
      wrap.remove();
    },
  };

  api.setState('dormant');
  api.start();
  return api;
}
