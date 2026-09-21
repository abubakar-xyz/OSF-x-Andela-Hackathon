/**
 * Wazi in three dimensions — Anthropomorphic Civic Companion.
 *
 * An expressive, warm anthropomorphic character built on a structured Three.js
 * skeleton rig featuring:
 *   · Root -> Neck -> Head hierarchical bone structure (THREE.Skeleton & THREE.Bone)
 *   · Articulated TMJ Jaw Bone driving realistic jaw opening, chin displacement,
 *     and vocal speech visemes
 *   · Dual Ocular Bones (Left/Right) with sclera, glowing amber irises, pupils,
 *     cornea glints, and gaze tracking with vergence and microsaccades
 *   · Upper and Lower Eyelid Bones executing natural non-linear blinking and smiling squints
 *   · Articulated Eyebrow Bones supporting civic empathy, concern, thought, and attentiveness
 *   · Cheeks and 3D sculpted nose bridge, ears/acoustic nodes, and cranial silhouette
 *   · Oral cavity with dynamic speech luminescence
 *   · Framing civic aperture halo in the backdrop
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

/* Emotional state poses */
const POSE = {
  dormant:   { open: 0.05, energy: 0,    lean:  0.06, dist: 0.16, glow: 0.3,  browY: -0.06, browTilt:  0.00, smile: 0.0,  nod: 0,    jaw: 0.00 },
  waking:    { open: 0.95, energy: 0.4,  lean: -0.08, dist: 0.00, glow: 1.0,  browY:  0.06, browTilt:  0.00, smile: 0.4,  nod: 0.05, jaw: 0.08 },
  resting:   { open: 0.82, energy: 0.15, lean:  0.00, dist: 0.00, glow: 0.9,  browY:  0.00, browTilt:  0.00, smile: 0.35, nod: 0,    jaw: 0.03 },
  listening: { open: 1.00, energy: 0.25, lean: -0.12, dist: -0.15, glow: 1.0, browY:  0.08, browTilt:  0.04, smile: 0.25, nod: 0,    jaw: 0.02 },
  hearing:   { open: 1.00, energy: null, lean: -0.15, dist: -0.22, glow: 1.05, browY:  0.10, browTilt:  0.06, smile: 0.25, nod: 0,    jaw: 0.04 },
  thinking:  { open: 0.70, energy: 0.15, lean:  0.08, dist: 0.14, glow: 0.7,  browY:  0.04, browTilt: -0.18, smile: 0.05, nod: 0,    jaw: 0.02 },
  working:   { open: 0.70, energy: 0.15, lean:  0.08, dist: 0.14, glow: 0.7,  browY:  0.04, browTilt: -0.18, smile: 0.05, nod: 0,    jaw: 0.02 },
  speaking:  { open: 0.90, energy: null, lean: -0.06, dist: -0.08, glow: 1.15, browY:  0.05, browTilt:  0.00, smile: 0.45, nod: 0.14, jaw: 0.25 },
  concern:   { open: 0.85, energy: 0.2,  lean: -0.05, dist: 0.04, glow: 0.9,  browY:  0.08, browTilt:  0.28, smile: -0.1, nod: 0.04, jaw: 0.02 },
  conflict:  { open: 0.85, energy: 0.2,  lean: -0.05, dist: 0.04, glow: 0.9,  browY:  0.08, browTilt:  0.28, smile: -0.1, nod: 0.04, jaw: 0.02 },
  awaiting:  { open: 0.65, energy: 0,    lean:  0.04, dist: 0.06, glow: 0.75, browY:  0.00, browTilt:  0.00, smile: 0.15, nod: 0,    jaw: 0.02 },
  attention: { open: 0.95, energy: 0.4,  lean: -0.18, dist: -0.18, glow: 1.2, browY:  0.12, browTilt:  0.00, smile: 0.55, nod: 0.08, jaw: 0.10 },
  offline:   { open: 0.35, energy: 0,    lean:  0.15, dist: 0.28, glow: 0.35, browY: -0.04, browTilt:  0.10, smile: -0.05, nod: 0,   jaw: 0.00 },
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export async function createAvatar3D({ size = 220, motes = true } = {}) {
  const T = await loadThree();

  const wrap = document.createElement('div');
  wrap.className = 'aperture aperture--3d';
  wrap.style.width = wrap.style.height = `${size}px`;
  wrap.style.touchAction = 'none';

  const isMobile = typeof navigator !== 'undefined' && (
    /mobile|android|iphone|ipad|ipod|touch/i.test(navigator.userAgent.toLowerCase()) ||
    (typeof window !== 'undefined' && window.innerWidth < 768)
  );
  const maxDPR = isMobile ? 1.5 : 2.0;

  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
    precision: isMobile ? 'mediump' : 'highp',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDPR));
  renderer.setSize(size, size, false);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;border-radius:50%;touch-action:none;';
  wrap.appendChild(renderer.domElement);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(32, 1, 0.1, 40);
  camera.position.set(0, 0.05, 6.2);
  camera.lookAt(0, 0, 0);

  /* Color Palette */
  const TEAL = 0x17c7b2;
  const TEAL_DEEP = 0x0d8a79;
  const LAMP = 0xf2b23e;
  const SLATE = 0x78909a;
  const HEAD_BASE = 0x0f2226;
  const EYE_SOCKET = 0x050f12;
  const SCLERA_COLOR = 0x0c252b;
  const CAVITY_COLOR = 0x03090b;

  /* Shared Materials */
  const skinMat = new T.MeshStandardMaterial({
    color: HEAD_BASE,
    metalness: 0.22,
    roughness: 0.42,
    emissive: TEAL_DEEP,
    emissiveIntensity: 0.08,
  });

  const lipMat = new T.MeshStandardMaterial({
    color: TEAL,
    emissive: TEAL_DEEP,
    emissiveIntensity: 0.35,
    roughness: 0.32,
    metalness: 0.2,
  });

  const browMat = new T.MeshStandardMaterial({
    color: TEAL,
    emissive: TEAL_DEEP,
    emissiveIntensity: 0.45,
    roughness: 0.3,
    metalness: 0.2,
  });

  /* ═════════════════════════════════════════════════════════════════
     STRUCTURED SKELETON HIERARCHY (THREE.Bone & THREE.Skeleton)
     ═════════════════════════════════════════════════════════════════ */

  /* 1. Root & Neck */
  const rootBone = new T.Bone();
  rootBone.name = 'rootBone';
  scene.add(rootBone);

  const neckBone = new T.Bone();
  neckBone.name = 'neckBone';
  neckBone.position.set(0, -0.65, 0);
  rootBone.add(neckBone);

  /* 2. Head Cranium Bone */
  const headBone = new T.Bone();
  headBone.name = 'headBone';
  headBone.position.set(0, 0.65, 0);
  neckBone.add(headBone);

  /* 3. Mandible / Jaw Bone (Pivoted at TMJ - temporomandibular joint) */
  const jawBone = new T.Bone();
  jawBone.name = 'jawBone';
  /* Pivot set at anatomical jaw hinge: slightly below ear canal, rear of jaw */
  jawBone.position.set(0, -0.28, 0.18);
  headBone.add(jawBone);

  /* 4. Eye Bones (Left & Right) */
  const leftEyeBone = new T.Bone();
  leftEyeBone.name = 'leftEyeBone';
  leftEyeBone.position.set(-0.46, 0.20, 0.94);
  headBone.add(leftEyeBone);

  const rightEyeBone = new T.Bone();
  rightEyeBone.name = 'rightEyeBone';
  rightEyeBone.position.set(0.46, 0.20, 0.94);
  headBone.add(rightEyeBone);

  /* 5. Eyelid Bones (Hinged at ocular sphere centers) */
  const leftUpperLidBone = new T.Bone();
  leftUpperLidBone.name = 'leftUpperLidBone';
  leftUpperLidBone.position.set(0, 0, 0);
  leftEyeBone.add(leftUpperLidBone);

  const rightUpperLidBone = new T.Bone();
  rightUpperLidBone.name = 'rightUpperLidBone';
  rightUpperLidBone.position.set(0, 0, 0);
  rightEyeBone.add(rightUpperLidBone);

  const leftLowerLidBone = new T.Bone();
  leftLowerLidBone.name = 'leftLowerLidBone';
  leftLowerLidBone.position.set(0, 0, 0);
  leftEyeBone.add(leftLowerLidBone);

  const rightLowerLidBone = new T.Bone();
  rightLowerLidBone.name = 'rightLowerLidBone';
  rightLowerLidBone.position.set(0, 0, 0);
  rightEyeBone.add(rightLowerLidBone);

  /* 6. Eyebrow Bones (Articulated Left & Right Brow Nodes) */
  const leftBrowBone = new T.Bone();
  leftBrowBone.name = 'leftBrowBone';
  leftBrowBone.position.set(-0.46, 0.56, 1.04);
  headBone.add(leftBrowBone);

  const rightBrowBone = new T.Bone();
  rightBrowBone.name = 'rightBrowBone';
  rightBrowBone.position.set(0.46, 0.56, 1.04);
  headBone.add(rightBrowBone);

  /* 7. Cheek Bones (Left & Right Zygomatic Nodes) */
  const leftCheekBone = new T.Bone();
  leftCheekBone.name = 'leftCheekBone';
  leftCheekBone.position.set(-0.68, -0.14, 0.94);
  headBone.add(leftCheekBone);

  const rightCheekBone = new T.Bone();
  rightCheekBone.name = 'rightCheekBone';
  rightCheekBone.position.set(0.68, -0.14, 0.94);
  headBone.add(rightCheekBone);

  /* Formally assemble the THREE.Skeleton structure */
  const allBones = [
    rootBone,
    neckBone,
    headBone,
    jawBone,
    leftEyeBone,
    rightEyeBone,
    leftUpperLidBone,
    rightUpperLidBone,
    leftLowerLidBone,
    rightLowerLidBone,
    leftBrowBone,
    rightBrowBone,
    leftCheekBone,
    rightCheekBone,
  ];
  const skeleton = new T.Skeleton(allBones);

  /* ═════════════════════════════════════════════════════════════════
     MESH ATTACHMENTS TO SKELETON BONES
     ═════════════════════════════════════════════════════════════════ */

  /* ── Head / Cranium Geometry (Attached to headBone) ───────────── */
  const headGeo = new T.SphereGeometry(1.28, 32, 28);
  headGeo.scale(1.0, 1.15, 0.88);
  const headMesh = new T.Mesh(headGeo, skinMat);
  headBone.add(headMesh);

  /* Nose bridge and tip (Attached to headBone) */
  const noseGeo = new T.ConeGeometry(0.12, 0.38, 16);
  noseGeo.scale(0.8, 1.0, 0.6);
  const noseMesh = new T.Mesh(noseGeo, skinMat);
  noseMesh.position.set(0, -0.04, 1.14);
  noseMesh.rotation.x = -0.15;
  headBone.add(noseMesh);

  /* Ear / Acoustic Nodes (Attached to headBone) */
  const earGeo = new T.TorusGeometry(0.22, 0.04, 8, 24);
  const earMat = new T.MeshStandardMaterial({ color: TEAL, emissive: TEAL, emissiveIntensity: 0.45 });
  const earL = new T.Mesh(earGeo, earMat);
  earL.position.set(-1.32, 0.1, 0.0);
  earL.rotation.y = Math.PI / 2;
  headBone.add(earL);

  const earR = new T.Mesh(earGeo, earMat);
  earR.position.set(1.32, 0.1, 0.0);
  earR.rotation.y = Math.PI / 2;
  headBone.add(earR);

  /* Maxilla / Upper Lip (Attached to headBone) */
  const upperLipShape = new T.Shape();
  upperLipShape.moveTo(-0.26, 0);
  upperLipShape.quadraticCurveTo(0, 0.04, 0.26, 0);
  upperLipShape.quadraticCurveTo(0, -0.04, -0.26, 0);
  const upperLipGeo = new T.ExtrudeGeometry(upperLipShape, {
    depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1,
  });
  upperLipGeo.center();
  const upperLipMesh = new T.Mesh(upperLipGeo, lipMat);
  upperLipMesh.position.set(0, -0.42, 1.02);
  headBone.add(upperLipMesh);

  /* Upper Oral Cavity Roof (Attached to headBone) */
  const upperCavityGeo = new T.BoxGeometry(0.42, 0.12, 0.12);
  const cavityMat = new T.MeshBasicMaterial({ color: CAVITY_COLOR });
  const upperCavity = new T.Mesh(upperCavityGeo, cavityMat);
  upperCavity.position.set(0, -0.42, 0.94);
  headBone.add(upperCavity);

  /* ── Jaw & Chin Geometry (Attached to jawBone) ────────────────── */
  /* Sculpted Chin Mesh: relative to jawBone pivot at (0, -0.28, 0.18) */
  const chinGeo = new T.SphereGeometry(0.52, 22, 16);
  chinGeo.scale(0.85, 0.68, 0.72);
  const chinMesh = new T.Mesh(chinGeo, skinMat);
  chinMesh.position.set(0, -0.64, 0.28);
  jawBone.add(chinMesh);

  /* Mandible jawline wing contours */
  const jawWingGeo = new T.CylinderGeometry(0.24, 0.38, 0.5, 16);
  jawWingGeo.scale(1.2, 0.8, 0.7);
  const jawWingL = new T.Mesh(jawWingGeo, skinMat);
  jawWingL.position.set(-0.48, -0.45, 0.12);
  jawWingL.rotation.z = -0.4;
  jawBone.add(jawWingL);

  const jawWingR = new T.Mesh(jawWingGeo, skinMat);
  jawWingR.position.set(0.48, -0.45, 0.12);
  jawWingR.rotation.z = 0.4;
  jawBone.add(jawWingR);

  /* Lower Lip (Attached to jawBone - drops realistically when jaw opens!) */
  const lowerLipShape = new T.Shape();
  lowerLipShape.moveTo(-0.24, 0);
  lowerLipShape.quadraticCurveTo(0, -0.06, 0.24, 0);
  lowerLipShape.quadraticCurveTo(0, 0.02, -0.24, 0);
  const lowerLipGeo = new T.ExtrudeGeometry(lowerLipShape, {
    depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1,
  });
  lowerLipGeo.center();
  const lowerLipMesh = new T.Mesh(lowerLipGeo, lipMat.clone());
  lowerLipMesh.position.set(0, -0.20, 0.84);
  jawBone.add(lowerLipMesh);

  /* Oral Cavity Floor & Warm Interior Luminescence (Attached to jawBone) */
  const lowerCavityGeo = new T.BoxGeometry(0.40, 0.14, 0.12);
  const lowerCavity = new T.Mesh(lowerCavityGeo, cavityMat);
  lowerCavity.position.set(0, -0.19, 0.78);
  jawBone.add(lowerCavity);

  const mouthGlowMat = new T.MeshStandardMaterial({
    color: LAMP,
    emissive: LAMP,
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });
  const mouthGlow = new T.Mesh(new T.SphereGeometry(0.14, 16, 10), mouthGlowMat);
  mouthGlow.scale.set(1.6, 0.45, 0.3);
  mouthGlow.position.set(0, -0.18, 0.80);
  jawBone.add(mouthGlow);

  /* ── Eye Geometry (Attached to leftEyeBone & rightEyeBone) ─────── */
  const socketGeo = new T.SphereGeometry(0.36, 20, 16);
  socketGeo.scale(1.0, 1.12, 0.35);
  const socketMat = new T.MeshBasicMaterial({ color: EYE_SOCKET });
  const sockL = new T.Mesh(socketGeo, socketMat);
  const sockR = new T.Mesh(socketGeo, socketMat);
  leftEyeBone.add(sockL);
  rightEyeBone.add(sockR);

  /* Deep Sclera */
  const scleraGeo = new T.SphereGeometry(0.33, 22, 18);
  scleraGeo.scale(1.0, 1.1, 0.45);
  const scleraMat = new T.MeshStandardMaterial({ color: SCLERA_COLOR, roughness: 0.3 });
  const scleraL = new T.Mesh(scleraGeo, scleraMat);
  const scleraR = new T.Mesh(scleraGeo, scleraMat);
  scleraL.position.z = 0.04;
  scleraR.position.z = 0.04;
  leftEyeBone.add(scleraL);
  rightEyeBone.add(scleraR);

  /* Luminous Amber Irises */
  const irisGeo = new T.SphereGeometry(0.25, 24, 18);
  irisGeo.scale(1.0, 1.0, 0.45);
  const irisMatL = new T.MeshStandardMaterial({
    color: LAMP,
    emissive: LAMP,
    emissiveIntensity: 1.5,
    roughness: 0.2,
    metalness: 0,
  });
  const irisMatR = irisMatL.clone();
  const irisL = new T.Mesh(irisGeo, irisMatL);
  const irisR = new T.Mesh(irisGeo, irisMatR);
  irisL.position.z = 0.10;
  irisR.position.z = 0.10;
  leftEyeBone.add(irisL);
  rightEyeBone.add(irisR);

  /* Attentive Pupils */
  const pupilGeo = new T.SphereGeometry(0.12, 16, 12);
  pupilGeo.scale(1.0, 1.0, 0.4);
  const pupilMat = new T.MeshBasicMaterial({ color: 0x040a0c });
  const pupilL = new T.Mesh(pupilGeo, pupilMat);
  const pupilR = new T.Mesh(pupilGeo, pupilMat);
  pupilL.position.z = 0.18;
  pupilR.position.z = 0.18;
  irisL.add(pupilL);
  irisR.add(pupilR);

  /* Specular Glints */
  const glintGeo = new T.SphereGeometry(0.045, 10, 8);
  const glintMat = new T.MeshBasicMaterial({ color: 0xffffff });
  const glintL = new T.Mesh(glintGeo, glintMat);
  const glintR = new T.Mesh(glintGeo, glintMat);
  glintL.position.set(-0.06, 0.06, 0.10);
  glintR.position.set(-0.06, 0.06, 0.10);
  pupilL.add(glintL);
  pupilR.add(glintR);

  /* Cornea Gloss Lenses */
  const corneaGeo = new T.SphereGeometry(0.28, 20, 16);
  corneaGeo.scale(1.0, 1.0, 0.5);
  const corneaMat = new T.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.18,
  });
  const corneaL = new T.Mesh(corneaGeo, corneaMat);
  const corneaR = new T.Mesh(corneaGeo, corneaMat);
  corneaL.position.z = 0.12;
  corneaR.position.z = 0.12;
  leftEyeBone.add(corneaL);
  rightEyeBone.add(corneaR);

  /* ── Eyelids Geometry (Attached to Lid Bones) ─────────────────── */
  /* Upper Eyelids (Sphere cap that sweeps down over eye) */
  const upperLidGeo = new T.SphereGeometry(0.36, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.52);
  upperLidGeo.scale(1.02, 1.14, 0.52);
  const lidMat = new T.MeshStandardMaterial({
    color: HEAD_BASE,
    roughness: 0.4,
    metalness: 0.2,
  });
  const upperLidMeshL = new T.Mesh(upperLidGeo, lidMat);
  const upperLidMeshR = new T.Mesh(upperLidGeo, lidMat);
  upperLidMeshL.position.set(0, 0.02, 0.08);
  upperLidMeshR.position.set(0, 0.02, 0.08);
  leftUpperLidBone.add(upperLidMeshL);
  rightUpperLidBone.add(upperLidMeshR);

  /* Lower Eyelids (Sphere cap that raises slightly during smiles/squints) */
  const lowerLidGeo = new T.SphereGeometry(0.35, 20, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.4);
  lowerLidGeo.scale(1.01, 1.10, 0.50);
  const lowerLidMeshL = new T.Mesh(lowerLidGeo, lidMat);
  const lowerLidMeshR = new T.Mesh(lowerLidGeo, lidMat);
  lowerLidMeshL.position.set(0, -0.04, 0.08);
  lowerLidMeshR.position.set(0, -0.04, 0.08);
  leftLowerLidBone.add(lowerLidMeshL);
  rightLowerLidBone.add(lowerLidMeshR);

  /* Eye light radiance */
  const eyeLight = new T.PointLight(LAMP, 2.0, 6, 2);
  eyeLight.position.set(0, 0.2, 1.4);
  headBone.add(eyeLight);

  /* ── Eyebrow Geometry (Attached to Brow Bones) ─────────────────── */
  const browShape = new T.Shape();
  browShape.moveTo(-0.28, -0.04);
  browShape.quadraticCurveTo(0, 0.06, 0.28, -0.02);
  browShape.quadraticCurveTo(0, 0.10, -0.28, -0.04);
  const browGeo = new T.ExtrudeGeometry(browShape, {
    depth: 0.06, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1,
  });
  browGeo.center();

  const browMeshL = new T.Mesh(browGeo, browMat.clone());
  const browMeshR = new T.Mesh(browGeo, browMat.clone());
  leftBrowBone.add(browMeshL);
  rightBrowBone.add(browMeshR);

  /* ── Cheek Geometry (Attached to Cheek Bones) ─────────────────── */
  const cheekGeo = new T.SphereGeometry(0.24, 16, 12);
  cheekGeo.scale(1.0, 0.7, 0.5);
  const cheekMat = new T.MeshStandardMaterial({
    color: HEAD_BASE,
    emissive: LAMP,
    emissiveIntensity: 0.08,
    roughness: 0.5,
  });
  const cheekMeshL = new T.Mesh(cheekGeo, cheekMat);
  const cheekMeshR = new T.Mesh(cheekGeo, cheekMat);
  leftCheekBone.add(cheekMeshL);
  rightCheekBone.add(cheekMeshR);

  /* ── Aperture Halo (Behind Character) ─────────────────────────── */
  const rim = new T.Mesh(
    new T.TorusGeometry(1.85, 0.028, 8, 48),
    new T.MeshStandardMaterial({ color: TEAL, emissive: TEAL, emissiveIntensity: 0.6, roughness: 0.4 })
  );
  rim.position.z = -0.2;
  rootBone.add(rim);

  /* ── 3-Point Studio Lighting ──────────────────────────────────── */
  const ambientLight = new T.AmbientLight(0x163038, 1.4);
  scene.add(ambientLight);

  const keyLight = new T.DirectionalLight(0xfffaed, 2.2);
  keyLight.position.set(1.5, 3.5, 4.0);
  scene.add(keyLight);

  const fillLight = new T.DirectionalLight(TEAL, 1.6);
  fillLight.position.set(-3.0, 0.5, 3.0);
  scene.add(fillLight);

  const rimLight = new T.DirectionalLight(TEAL, 2.0);
  rimLight.position.set(0, 4.0, -3.0);
  scene.add(rimLight);

  /* Motes */
  let moteMeshes = [];
  let moteList = [];
  const moteGeo = new T.SphereGeometry(0.045, 12, 8);
  const moteMat = new T.MeshStandardMaterial({ color: TEAL, emissive: TEAL, emissiveIntensity: 1.2 });
  const moteFail = new T.MeshStandardMaterial({ color: SLATE, emissive: SLATE, emissiveIntensity: 0.6 });

  if (motes) {
    for (let i = 0; i < 5; i++) {
      const m = new T.Mesh(moteGeo, moteMat);
      m.visible = false;
      rootBone.add(m);
      moteMeshes.push(m);
    }
  }

  /* Internal Animation States */
  const cur = {
    open: 0.82,
    energy: 0.15,
    lean: 0,
    dist: 0,
    glow: 1.0,
    browY: 0,
    browTilt: 0,
    smile: 0.35,
    nod: 0,
    blink: 0,
    jawRot: 0.03,
  };

  let stateName = 'resting';
  let pose = POSE.resting;
  let extEnergy = 0;
  let running = false;
  let raf = 0;
  let nextBlink = performance.now() + 2000 + Math.random() * 3000;
  let blinking = false;
  let gazeTarget = { x: 0, y: 0 };
  let gaze = { x: 0, y: 0 };
  let dragOffset = { x: 0, y: 0 };
  let gyroOffset = { x: 0, y: 0 };
  let isVisible = true;
  let isIntersecting = true;
  let touchActive = false;
  let touchStartTime = 0;
  let touchStartPos = { x: 0, y: 0 };

  /* Saccadic ocular micro-movements */
  let nextSaccade = performance.now() + 1800;
  let saccadeOffset = { x: 0, y: 0 };

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);

    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wantEnergy = pose.energy === null ? extEnergy : pose.energy;

    cur.open = lerp(cur.open, pose.open, reduced ? 1 : 0.18);
    cur.energy = lerp(cur.energy, clamp01(wantEnergy), reduced ? 1 : 0.32);
    cur.lean = lerp(cur.lean, pose.lean, reduced ? 1 : 0.1);
    cur.dist = lerp(cur.dist, pose.dist, reduced ? 1 : 0.08);
    cur.glow = lerp(cur.glow, pose.glow, reduced ? 1 : 0.12);
    cur.browY = lerp(cur.browY, pose.browY, reduced ? 1 : 0.14);
    cur.browTilt = lerp(cur.browTilt, pose.browTilt, reduced ? 1 : 0.14);
    cur.smile = lerp(cur.smile, pose.smile, reduced ? 1 : 0.12);
    cur.nod = lerp(cur.nod, pose.nod, reduced ? 1 : 0.15);

    /* Saccadic eye tracking jitter */
    if (!reduced && now > nextSaccade) {
      saccadeOffset.x = (Math.random() - 0.5) * 0.06;
      saccadeOffset.y = (Math.random() - 0.5) * 0.04;
      nextSaccade = now + 1400 + Math.random() * 2400;
    }

    /* ═══════════════════════════════════════════════════════════════
       1. EYELID BONES & ORGANIC BLINK ANIMATION
       ═══════════════════════════════════════════════════════════════ */
    if (!reduced) {
      if (!blinking && now > nextBlink) { blinking = true; }
      if (blinking) {
        cur.blink = Math.min(1, cur.blink + 0.28);
        if (cur.blink >= 1) {
          blinking = false;
          nextBlink = now + 2400 + Math.random() * 3600;
        }
      } else if (cur.blink > 0) {
        cur.blink = Math.max(0, cur.blink - 0.18);
      }
    }

    const effectiveOpen = clamp01(cur.open * (1 - cur.blink * 0.98));

    /* Upper eyelid bone rotation sweeps down over the eye */
    const upperLidAngle = lerp(Math.PI * 0.52, 0, effectiveOpen);
    leftUpperLidBone.rotation.x = upperLidAngle;
    rightUpperLidBone.rotation.x = upperLidAngle;

    /* Lower eyelid rises slightly during smiles (Duchenne squint) */
    const smileSquint = cur.smile * 0.12 + (1 - effectiveOpen) * 0.08;
    leftLowerLidBone.rotation.x = -smileSquint;
    rightLowerLidBone.rotation.x = -smileSquint;

    /* Pupil dilation with vocal energy & illumination */
    const pupilScale = 1.0 + cur.energy * 0.35;
    pupilL.scale.set(pupilScale, pupilScale, 0.4);
    pupilR.scale.set(pupilScale, pupilScale, 0.4);

    /* Iris color & glow */
    const irisColor = stateName === 'offline' ? SLATE : LAMP;
    irisMatL.color.setHex(irisColor); irisMatL.emissive.setHex(irisColor);
    irisMatR.color.setHex(irisColor); irisMatR.emissive.setHex(irisColor);
    irisMatL.emissiveIntensity = (1.2 + cur.energy * 1.6) * cur.glow;
    irisMatR.emissiveIntensity = (1.2 + cur.energy * 1.6) * cur.glow;
    eyeLight.intensity = (1.8 + cur.energy * 2.5) * cur.glow;

    /* ═══════════════════════════════════════════════════════════════
       2. JAW BONE ARTICULATION & REAL-TIME SPEECH VISEMES
       ═══════════════════════════════════════════════════════════════ */
    const isSpeaking = stateName === 'speaking' || cur.energy > 0.18;
    const speechAperture = isSpeaking
      ? Math.max(0.05, cur.energy * 0.34)
      : (cur.energy > 0.08 ? cur.energy * 0.12 : (pose.jaw || 0.02));

    /* Jaw bone rotates smoothly on the TMJ hinge along the X-axis */
    cur.jawRot = lerp(cur.jawRot, speechAperture, reduced ? 1 : 0.28);
    jawBone.rotation.x = cur.jawRot;

    /* Subtle jaw lateral movement for organic phoneme cadence */
    jawBone.rotation.y = (isSpeaking && !reduced) ? Math.sin(now * 0.014) * 0.02 * cur.energy : 0;

    /* Lower lip & oral cavity lighting response */
    mouthGlowMat.emissiveIntensity = cur.energy * 2.8 * cur.glow;
    mouthGlow.scale.y = 0.4 + speechAperture * 2.8;

    /* Upper lip subtle maxilla lift during speech emphasis */
    upperLipMesh.position.y = -0.42 + (isSpeaking ? speechAperture * 0.06 : 0) + cur.smile * 0.03;

    /* ═══════════════════════════════════════════════════════════════
       3. EYE BONES & OCULAR GAZE TRACKING (VERGENCE & SACCADES)
       ═══════════════════════════════════════════════════════════════ */
    const targetX = clamp01((gazeTarget.x + dragOffset.x + gyroOffset.x + 1) / 2) * 2 - 1;
    const targetY = clamp01((gazeTarget.y + dragOffset.y + gyroOffset.y + 1) / 2) * 2 - 1;

    gaze.x = lerp(gaze.x, targetX, reduced ? 1 : 0.1);
    gaze.y = lerp(gaze.y, targetY, reduced ? 1 : 0.1);

    const eyeGazeX = gaze.x * 0.32 + saccadeOffset.x;
    const eyeGazeY = -gaze.y * 0.26 + saccadeOffset.y;

    /* Vergence: slight inward ocular convergence for depth perception */
    const vergence = 0.03;
    leftEyeBone.rotation.y = eyeGazeX + vergence;
    rightEyeBone.rotation.y = eyeGazeX - vergence;
    leftEyeBone.rotation.x = eyeGazeY;
    rightEyeBone.rotation.x = eyeGazeY;

    /* ═══════════════════════════════════════════════════════════════
       4. EYEBROW BONES (EMPATHY, CONCERN, THOUGHT, ATTENTION)
       ═══════════════════════════════════════════════════════════════ */
    const browBaseY = 0.56 + cur.browY;
    leftBrowBone.position.y = browBaseY;
    rightBrowBone.position.y = browBaseY;

    if (stateName === 'thinking' || stateName === 'working') {
      leftBrowBone.position.y += 0.08;
      rightBrowBone.position.y -= 0.06;
      leftBrowBone.rotation.z = -0.06;
      rightBrowBone.rotation.z = -0.16;
    } else {
      leftBrowBone.rotation.z = cur.browTilt;
      rightBrowBone.rotation.z = -cur.browTilt;
    }

    /* ═══════════════════════════════════════════════════════════════
       5. CHEEK BONES (SMILE ELEVATION)
       ═══════════════════════════════════════════════════════════════ */
    const cheekLift = cur.smile * 0.04;
    leftCheekBone.position.y = -0.14 + cheekLift;
    rightCheekBone.position.y = -0.14 + cheekLift;

    /* ═══════════════════════════════════════════════════════════════
       6. HEAD & NECK BONES (COMMUNICATIVE NODS, TILTS, AND LEAN)
       ═══════════════════════════════════════════════════════════════ */
    const speechNod = (stateName === 'speaking' && !reduced)
      ? Math.sin(now * 0.009) * cur.energy * 0.1
      : 0;

    const listeningTilt = (!reduced && (stateName === 'listening' || stateName === 'hearing'))
      ? -0.06
      : (!reduced && (stateName === 'thinking') ? 0.08 : 0);

    /* Head bone articulates relative to neck */
    headBone.rotation.y = gaze.x * 0.38 + Math.sin(now * 0.0004) * 0.02;
    headBone.rotation.x = -gaze.y * 0.24 + cur.lean + speechNod;
    headBone.rotation.z = listeningTilt;

    /* Neck provides subtle secondary cushioning */
    neckBone.rotation.x = cur.lean * 0.3;
    neckBone.rotation.y = gaze.x * 0.08;

    rootBone.position.z = -cur.dist;

    /* Slowly decay manual touch drag offsets */
    if (!touchActive) {
      dragOffset.x *= 0.88;
      dragOffset.y *= 0.88;
    }

    /* Halo ambient rotation */
    rim.rotation.z = now * 0.0003;

    /* Motes orbiting */
    if (motes) {
      for (let i = 0; i < moteMeshes.length; i++) {
        const m = moteMeshes[i];
        const item = moteList[i];
        m.visible = Boolean(item);
        if (!item) continue;
        const a = now * 0.0012 + (i / moteMeshes.length) * Math.PI * 2;
        m.position.set(Math.cos(a) * 2.5, Math.sin(a * 0.8) * 0.65, Math.sin(a) * 2.5);
        m.material = item.status === 'failed' ? moteFail : moteMat;
        m.scale.setScalar(item.status === 'done' ? 0.55 : 1);
      }
    }

    /* Update the structured Three.js skeleton transformations */
    skeleton.update();

    renderer.render(scene, camera);
  }

  /* Interactive pointer interaction */
  const onPointerDown = (e) => {
    touchActive = true;
    touchStartTime = performance.now();
    touchStartPos = { x: e.clientX, y: e.clientY };
    wrap.setPointerCapture?.(e.pointerId);

    const rect = wrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    dragOffset.x = Math.max(-1.5, Math.min(1.5, (e.clientX - cx) / (rect.width * 0.4)));
    dragOffset.y = Math.max(-1.5, Math.min(1.5, (e.clientY - cy) / (rect.height * 0.4)));
  };

  const onPointerMove = (e) => {
    if (!touchActive) return;
    const rect = wrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    dragOffset.x = Math.max(-1.5, Math.min(1.5, (e.clientX - cx) / (rect.width * 0.4)));
    dragOffset.y = Math.max(-1.5, Math.min(1.5, (e.clientY - cy) / (rect.height * 0.4)));
  };

  const onPointerUp = (e) => {
    if (!touchActive) return;
    touchActive = false;
    wrap.releasePointerCapture?.(e.pointerId);

    const dt = performance.now() - touchStartTime;
    const dist = Math.hypot(e.clientX - touchStartPos.x, e.clientY - touchStartPos.y);
    if (dt < 320 && dist < 14) {
      blinking = true;
      cur.blink = 0.8;
      if (stateName === 'resting') {
        api.setState('attention');
        setTimeout(() => { if (api.state === 'attention') api.setState('resting'); }, 1400);
      }
    }
  };

  wrap.addEventListener('pointerdown', onPointerDown, { passive: true });
  wrap.addEventListener('pointermove', onPointerMove, { passive: true });
  wrap.addEventListener('pointerup', onPointerUp, { passive: true });
  wrap.addEventListener('pointercancel', onPointerUp, { passive: true });

  const onOrientation = (e) => {
    if (e.gamma == null || e.beta == null) return;
    const gx = Math.max(-1, Math.min(1, e.gamma / 28));
    const gy = Math.max(-1, Math.min(1, (e.beta - 45) / 28));
    gyroOffset.x = gx * 0.28;
    gyroOffset.y = gy * 0.24;
  };
  if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', onOrientation, { passive: true });
  }

  const observer = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(([entry]) => {
        isIntersecting = entry.isIntersecting;
        if (isIntersecting && isVisible && !running) api.start();
        else if (!isIntersecting && running) api.stop();
      }, { threshold: 0.05 })
    : null;

  if (observer) observer.observe(wrap);

  const onVisibilityChange = () => {
    isVisible = !document.hidden;
    if (isVisible && isIntersecting && !running) api.start();
    else if (!isVisible && running) api.stop();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  const canvas = renderer.domElement;
  const onContextLost = (e) => {
    e.preventDefault();
    api.stop();
  };
  const onContextRestored = () => {
    if (isVisible && isIntersecting) api.start();
  };
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);

  const api = {
    el: wrap,
    get state() { return stateName; },
    is3D: true,
    skeleton,
    bones: {
      root: rootBone,
      neck: neckBone,
      head: headBone,
      jaw: jawBone,
      leftEye: leftEyeBone,
      rightEye: rightEyeBone,
      leftUpperLid: leftUpperLidBone,
      rightUpperLid: rightUpperLidBone,
      leftLowerLid: leftLowerLidBone,
      rightLowerLid: rightLowerLidBone,
      leftBrow: leftBrowBone,
      rightBrow: rightBrowBone,
      leftCheek: leftCheekBone,
      rightCheek: rightCheekBone,
    },

    setState(name) {
      if (!POSE[name]) {
        console.warn(`[wazi/3d] unknown state '${name}', defaulting to resting`);
        name = 'resting';
      }
      stateName = name;
      pose = POSE[name];
      wrap.dataset.state = name;

      if (name === 'thinking' || name === 'working') api.lookAt(0.38, 0.24);
      else if (name === 'listening' || name === 'hearing' || name === 'speaking') api.lookAt(0, 0);
      else if (name === 'concern' || name === 'conflict') api.lookAt(-0.15, -0.1);
      return api;
    },

    setExpression(name) {
      if (name === 'concern' || name === 'empathy') {
        pose = POSE.concern;
      } else if (name === 'thinking') {
        pose = POSE.thinking;
      } else if (name === 'happy' || name === 'attention') {
        pose = POSE.attention;
      } else if (POSE[name]) {
        pose = POSE[name];
      }
      return api;
    },

    setEnergy(v) { extEnergy = clamp01(Number(v) || 0); return api; },
    setMotes(list) { moteList = Array.isArray(list) ? list.slice(0, 5) : []; return api; },

    lookAt(x, y) {
      gazeTarget = {
        x: clamp01((x + 1) / 2) * 2 - 1,
        y: clamp01((y + 1) / 2) * 2 - 1,
      };
      return api;
    },

    setSize(px) {
      wrap.style.width = wrap.style.height = `${px}px`;
      renderer.setSize(px, px, false);
      return api;
    },

    get __rig() {
      return {
        state: stateName,
        open: +cur.open.toFixed(3),
        blink: +cur.blink.toFixed(3),
        eyeR: 0.95,
        innerEdge: +cur.open.toFixed(3),
        eyeVisible: cur.open > 0.1,
        jawOpen: +cur.jawRot.toFixed(3),
        skeleton,
        bones: api.bones,
      };
    },

    start() { if (!running) { running = true; raf = requestAnimationFrame(frame); } return api; },
    stop() { running = false; cancelAnimationFrame(raf); return api; },

    destroy() {
      api.stop();
      if (observer) observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', onOrientation);
      }
      wrap.removeEventListener('pointerdown', onPointerDown);
      wrap.removeEventListener('pointermove', onPointerMove);
      wrap.removeEventListener('pointerup', onPointerUp);
      wrap.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      scene.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      renderer.dispose();
      wrap.remove();
    },
  };

  api.setState('resting');
  api.start();
  return api;
}
