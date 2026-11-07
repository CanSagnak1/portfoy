import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildPetalGeometry, buildLeafGeometry, makeVeinTexture, makeGlowTexture, sstep } from './petal.js';
import { createMusic } from './music.js';

const $ = (s) => document.querySelector(s);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeOutBack = (x) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const isMobile = matchMedia('(pointer: coarse)').matches || innerWidth < 700;
const FLOWER_COUNT = isMobile ? 14 : 26;      // ana çiçek hariç
const HERO_PETALS = isMobile ? 360 : 560;
const OTHER_PETALS = isMobile ? 140 : 230;

// ---- genel zaman çizelgesi (saniye) ----
const T = { name: 12.2, hint: 17, handoff: 14.5 };

// ---- renk paletleri (dış yaprak / iç yaprak) ----
const PALETTES = {
  pink:   { outer: '#ffb3d9', inner: '#ff4fa3' },
  white:  { outer: '#ffffff', inner: '#ffe6b0' },
  yellow: { outer: '#ffe36a', inner: '#ffb300' },
  orange: { outer: '#ffb27a', inner: '#ff6a1f' },
  purple: { outer: '#d2a6ff', inner: '#8a3fe0' },
  red:    { outer: '#ff6677', inner: '#b00c2e' },
};
const PALETTE_ORDER = ['pink', 'white', 'yellow', 'orange', 'purple', 'red'];

let renderer, scene, camera, composer, controls, bloom;
try {
  renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
} catch (e) {
  document.body.classList.add('nogl');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('#stage').appendChild(renderer.domElement);

scene = new THREE.Scene();
scene.background = new THREE.Color('#0a0512');
scene.fog = new THREE.Fog('#0a0512', 9, 26);

camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 80);
camera.position.set(0, -2.2, 5.5);

// ---- ışıklar ----
scene.add(new THREE.HemisphereLight('#c9b6ff', '#2a0f2a', 0.6));
const key = new THREE.DirectionalLight('#ffe3cf', 2.1);
key.position.set(2.5, 4, 5);
scene.add(key);
const rim = new THREE.DirectionalLight('#ff9ad0', 2.2);
rim.position.set(-3, 1.5, -5);
scene.add(rim);
const rim2 = new THREE.DirectionalLight('#7fa8ff', 1.2);
rim2.position.set(4, -1, -3);
scene.add(rim2);
const core = new THREE.PointLight('#ff9bd0', 0, 4.5, 1.6);
scene.add(core);

// ---- ortak kaynaklar ----
const LAYERS = [
  { max: 0.4, bend: 0.95 },   // dış: açık, hafif sarkan
  { max: 0.75, bend: 0.35 },  // orta
  { max: 1.01, bend: -0.55 }, // iç: içe kıvrık, top şekli
];
const layerGeo = LAYERS.map((l) => buildPetalGeometry(l.bend));
const leafGeo = buildLeafGeometry();
const veinTex = makeVeinTexture();
const glowTex = makeGlowTexture();
const leafMat = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.55, side: THREE.DoubleSide, bumpMap: veinTex, bumpScale: 0.25,
});
const GOLDEN = 2.399963229728653;
const UP = new THREE.Vector3(0, 1, 0);

const flowers = [];
const dummy = new THREE.Object3D();
dummy.rotation.order = 'YXZ';

/** Tek bir kasımpatı üretir: sap + yapraklar + taç yapraklar + parıltı. */
function createFlower(o) {
  const rnd = mulberry32(o.seed);
  const pal = PALETTES[o.palette];
  const cInner = new THREE.Color(pal.inner), cOuter = new THREE.Color(pal.outer);

  // sap eğrisi
  const base = new THREE.Vector3(o.x, -2.7, o.z);
  const tip = new THREE.Vector3(o.x + (rnd() - 0.5) * 0.3, o.tipY, o.z + 0.18);
  const pts = [base];
  const wob = o.hero ? 0.05 : 0.09;
  for (let k = 1; k <= 3; k++) {
    const p = base.clone().lerp(tip, k / 4);
    p.x += (rnd() - 0.5) * wob * 2;
    p.z += (rnd() - 0.5) * wob * 2;
    pts.push(p);
  }
  pts.push(tip);
  const curve = new THREE.CatmullRomCurve3(pts);

  const tubeSeg = o.hero ? 120 : 80, tubeRad = o.hero ? 10 : 8;
  const stemGeo = new THREE.TubeGeometry(curve, tubeSeg, o.hero ? 0.03 : 0.02 + 0.012 * o.scale, tubeRad, false);
  {
    const uvA = stemGeo.attributes.uv;
    const center = new Float32Array(uvA.count * 3);
    const p = new THREE.Vector3();
    for (let i = 0; i < uvA.count; i++) {
      curve.getPointAt(uvA.getX(i), p);
      center.set([p.x, p.y, p.z], i * 3);
    }
    stemGeo.setAttribute('aCenter', new THREE.BufferAttribute(center, 3));
  }
  const stemU = { uG: { value: 0 }, uTip: { value: base.clone() }, uTaper: { value: 0.12 } };
  const stemMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2d6a3a').offsetHSL((rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.05),
    roughness: 0.55,
  });
  stemMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, stemU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aCenter;\nuniform float uG;\nuniform vec3 uTip;\nuniform float uTaper;')
      .replace('#include <begin_vertex>', `
        float sArc = uv.x;
        float taperK = 1.0 - smoothstep(uG - uTaper, uG, sArc);
        float thick = mix(1.45, 0.75, sArc);
        vec3 transformed = aCenter + (position - aCenter) * taperK * thick;
        if (sArc > uG) transformed = uTip;
      `);
  };
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.frustumCulled = false;
  scene.add(stem);

  // yapraklar
  const leafDefs = [
    { s: 0.2, len: 0.95 }, { s: 0.36, len: 0.85 }, { s: 0.52, len: 0.7 }, { s: 0.68, len: 0.55 },
  ].slice(0, o.leafCount);
  const leaves = leafDefs.map((d, i) => {
    const pitch = 0.5 + rnd() * 0.3;
    const holder = new THREE.Group();
    holder.position.copy(curve.getPointAt(d.s));
    holder.rotation.order = 'YXZ';
    holder.add(new THREE.Mesh(leafGeo, leafMat));
    holder.scale.setScalar(0.0001);
    holder.visible = false;
    scene.add(holder);
    return { holder, s: d.s, len: d.len * (o.hero ? 1 : 0.55 + 0.35 * o.scale), pitch, ang: i * 2.4 + rnd() * 2, t0: null };
  });

  // çiçek başı
  const head = new THREE.Group();
  const qTan = new THREE.Quaternion();
  const qFinal = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    o.hero ? 0.5 : 0.25 + rnd() * 0.4, (rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.35));
  head.quaternion.copy(qFinal);
  scene.add(head);

  const petalMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.5, metalness: 0,
    sheen: 1, sheenRoughness: 0.35, sheenColor: cOuter.clone().lerp(new THREE.Color('#ffffff'), 0.4),
    side: THREE.DoubleSide, bumpMap: veinTex, bumpScale: 1.2,
    emissive: cInner.clone().multiplyScalar(0.28), emissiveIntensity: 0.55,
  });

  const N = o.petals;
  const petals = [];
  const layerCount = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const r = i / (N - 1);
    const li = LAYERS.findIndex((l) => r < l.max);
    petals.push({
      r, li, slot: layerCount[li]++,
      phi: i * GOLDEN + (rnd() - 0.5) * 0.12,
      pitchEnd: lerp(1.2, 0.3, Math.pow(r, 0.8)) + (rnd() - 0.5) * 0.16,
      len: lerp(1.0, 0.3, Math.pow(r, 0.8)) * (0.92 + rnd() * 0.16),
      wid: lerp(1.2, 0.8, r) * (0.9 + rnd() * 0.25) * (o.hero ? 1 : 1.5), // az yapraklı çiçeklerde biraz geniş
      baseY: lerp(0, 0.1, r),
      delay: r * o.tl.bloomSpan + rnd() * 0.3,
      roll: (rnd() - 0.5) * 0.12,
      swayPhase: rnd() * 6.28,
      dP: 0, vP: 0, dR: 0, vR: 0,
      sign: rnd() < 0.5 ? -1 : 1,
    });
  }
  const meshes = layerGeo.map((g, li) => {
    const m = new THREE.InstancedMesh(g, petalMat, layerCount[li]);
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    head.add(m);
    return m;
  });
  const tmpC = new THREE.Color();
  petals.forEach((p) => {
    tmpC.copy(cInner).lerp(cOuter, 1 - Math.pow(p.r, 0.8));
    tmpC.multiplyScalar(0.92 + rnd() * 0.08);
    meshes[p.li].setColorAt(p.slot, tmpC);
  });
  meshes.forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });

  const centerMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 16, 12),
    new THREE.MeshStandardMaterial({ color: '#f3c14b', emissive: '#a2630f', emissiveIntensity: 0.8, roughness: 0.6 })
  );
  centerMesh.position.y = 0.02;
  head.add(centerMesh);

  const orb = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: cOuter, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(orb);

  const tipPos = new THREE.Vector3();
  const tmpTan = new THREE.Vector3();
  const tip3 = new THREE.Vector3();
  const tl = o.tl;
  const S = o.scale;
  let bloomPhase = 0;

  function update(c) {
    const { t, running, now, dt, ptr, asp, wind } = c;
    const lt = running ? t : -1; // çiçek yerel zamanı = global t (çizelge zaten gecikmeli)
    const g = running ? sstep(tl.stem0, tl.stem1, t) : 0;
    const gg = Math.max(g, 0.0005);
    curve.getPointAt(gg, tipPos);
    stemU.uG.value = gg;
    stemU.uTip.value.copy(tipPos);
    stemU.uTaper.value = 0.12 * (1 - sstep(0.85, 1, g)) + 0.0001;
    head.position.copy(tipPos);
    const swell = sstep(tl.swell, tl.swell + 2.5, lt);
    head.scale.setScalar(lerp(0.5, 1, swell) * S);
    curve.getTangentAt(gg, tmpTan);
    qTan.setFromUnitVectors(UP, tmpTan);
    head.quaternion.slerpQuaternions(qTan, qFinal, swell);
    head.rotateZ(Math.sin(now * 0.0006 + o.seed) * 0.025);

    leaves.forEach((l) => {
      const show = running && g > l.s;
      l.holder.visible = show;
      if (show) {
        if (l.t0 === null) l.t0 = t;
        const k = clamp01((t - l.t0) / 2.2);
        const e = sstep(0, 1, k);
        const sc = l.len;
        l.holder.scale.set(sc * (0.25 + 0.75 * e), sc * Math.max(0.001, e), sc * (0.25 + 0.75 * e));
        l.holder.rotation.set(l.pitch + 0.6 - (1 - easeOutBack(k)) * 1.0, l.ang, Math.sin(now * 0.0007 + l.s * 9) * 0.04);
      }
    });

    const bt = lt - tl.bloom;
    head.updateMatrixWorld(true);
    const R = 0.22;
    const interact = ptr.active && ptr.energy > 0.05;
    bloomPhase = clamp01(bt / (tl.bloomSpan + tl.petalDur));

    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      const prog = clamp01((bt - p.delay) / tl.petalDur);
      const e = prog > 0 ? easeOutBack(prog) : 0;
      const closedPitch = -LAYERS[p.li].bend * 0.8;
      const pitch = lerp(closedPitch, p.pitchEnd, e) + Math.sin(wind * 0.9 + p.swayPhase) * 0.03 * prog;
      const roll = p.roll * e + Math.sin(wind * 0.7 + p.swayPhase * 1.3) * 0.02 * prog;
      const lenS = p.len * lerp(0.5, 1, sstep(0, 1, prog)) * lerp(0.55, 1, swell);

      if (interact && prog > 0.5) {
        const L = p.len;
        const ang = p.pitchEnd + LAYERS[p.li].bend * 0.5;
        tip3.set(Math.sin(p.phi) * Math.sin(ang) * L * 0.9, p.baseY + Math.cos(ang) * L * 0.9, Math.cos(p.phi) * Math.sin(ang) * L * 0.9);
        tip3.applyMatrix4(head.matrixWorld).project(camera);
        const dx = (tip3.x - ptr.x) * asp, dy = tip3.y - ptr.y;
        const d = Math.hypot(dx, dy);
        if (d < R) {
          const f = Math.pow(1 - d / R, 2);
          p.vP += ptr.energy * f * 3.2 * p.sign * dt * 60 * 0.12;
          p.vR += ptr.energy * f * 2.4 * Math.sign(dx || 1) * dt * 60 * 0.12;
        }
      }
      p.vP += (-48 * p.dP - 5 * p.vP) * dt; p.dP += p.vP * dt;
      p.vR += (-48 * p.dR - 5 * p.vR) * dt; p.dR += p.vR * dt;
      p.dP = Math.max(-0.8, Math.min(0.8, p.dP));
      p.dR = Math.max(-0.8, Math.min(0.8, p.dR));

      dummy.position.set(0, p.baseY, 0);
      dummy.rotation.set(pitch + p.dP, p.phi, roll + p.dR);
      dummy.scale.set(p.wid, lenS, lenS);
      dummy.updateMatrix();
      meshes[p.li].setMatrixAt(p.slot, dummy.matrix);
    }
    meshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; });

    // parıltı
    const orbIn = running ? sstep(tl.stem0 - 0.6, tl.stem0 + 0.4, t) : (o.hero ? 0.6 + 0.25 * Math.sin(now * 0.003) : 0);
    const orbOut = 1 - sstep(tl.swell + 0.2, tl.bloom + 1.5, lt);
    const orbPulse = 1 + 0.2 * Math.sin(now * 0.006 + o.seed);
    if (running) orb.position.copy(head.position); else orb.position.set(o.x, -2.65, o.z + 0.05);
    orb.scale.setScalar(0.5 * S * orbIn * (running ? orbOut : 1) * orbPulse + 0.001);
    orb.material.opacity = (running ? orbOut : 1) * 0.55;
    centerMesh.scale.set(1, 0.7, 1).multiplyScalar((sstep(tl.bloom + 1, tl.bloom + 4, lt) + 0.001));
    return g;
  }

  return { o, update, get tipPos() { return tipPos; }, get head() { return head; }, get bloomPhase() { return bloomPhase; } };
}

// ---- çiçekleri yerleştir: ana çiçek + bahçe ----
const hero = createFlower({
  hero: true, seed: 1, palette: 'pink', x: 0, z: 1.2, tipY: 0.1, scale: 1.2,
  petals: HERO_PETALS, leafCount: 4,
  tl: { stem0: 0.8, stem1: 5.0, swell: 4.2, bloom: 5.0, bloomSpan: 4.4, petalDur: 2.4 },
});
flowers.push(hero);

{
  const rnd = mulberry32(2026);
  const placed = [];
  let guard = 0;
  while (placed.length < FLOWER_COUNT && guard++ < 4000) {
    const x = (rnd() - 0.5) * 11;
    const z = -4.8 + rnd() * 5.2;
    if (Math.hypot(x - 0, (z - 1.2) * 1.2) < 1.9) continue; // ana çiçeğin etrafı boş
    if (placed.some((p) => Math.hypot(p.x - x, (p.z - z) * 1.1) < 1.15)) continue;
    placed.push({ x, z });
  }
  // dalga: ana çiçeğe yakından uzağa doğru açılır
  placed.forEach((p, i) => {
    const d = Math.hypot(p.x, p.z - 1.2);
    const delay = 1.2 + d * 0.85 + rnd() * 0.5;
    const scale = lerp(0.62, 0.8, rnd()) * (1 + (-p.z) * 0.05); // uzaktakiler biraz büyük görünsün
    const tipY = -0.75 + (-p.z) * 0.22 + (rnd() - 0.5) * 0.7;
    flowers.push(createFlower({
      hero: false, seed: 100 + i * 17, palette: PALETTE_ORDER[i % PALETTE_ORDER.length],
      x: p.x, z: p.z, tipY, scale,
      petals: OTHER_PETALS, leafCount: 2 + (i % 2),
      tl: { stem0: delay, stem1: delay + 3.6, swell: delay + 2.8, bloom: delay + 3.6, bloomSpan: 2.6, petalDur: 2.2 },
    }));
  });
}

// ---- zemin ----
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(9, 64),
  new THREE.MeshBasicMaterial({
    map: makeGlowTexture('rgba(255,120,190,0.3)', 'rgba(60,20,70,0)'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35,
  })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2.72;
ground.position.z = -1.5;
scene.add(ground);

// ---- ateş böcekleri ----
const FF = isMobile ? 120 : 260;
const ffPos = new Float32Array(FF * 3);
const ffSeed = [];
for (let i = 0; i < FF; i++) {
  ffSeed.push({ x: (Math.random() - 0.5) * 16, y: Math.random() * 7 - 3, z: (Math.random() - 0.5) * 10 - 1.5, sp: 0.1 + Math.random() * 0.25, ph: Math.random() * 6.28 });
}
const ffGeo = new THREE.BufferGeometry();
ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
const ff = new THREE.Points(ffGeo, new THREE.PointsMaterial({
  map: glowTex, size: 0.16, color: '#ffc9e8', transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, opacity: 0.0,
}));
ff.frustumCulled = false;
scene.add(ff);

// ---- post-processing ----
composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.8, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---- kontroller (intro sonrası) ----
controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 2.5;
controls.maxDistance = 20;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = 1.85;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
controls.enabled = false;

// ---- işaretçi ----
const ptr = { x: 9, y: 9, energy: 0, active: false };
function setPtr(e) {
  const nx = (e.clientX / innerWidth) * 2 - 1;
  const ny = -(e.clientY / innerHeight) * 2 + 1;
  if (ptr.active) ptr.energy = Math.min(3, ptr.energy + Math.hypot(nx - ptr.x, ny - ptr.y) * 14);
  ptr.x = nx; ptr.y = ny; ptr.active = true;
}
addEventListener('pointermove', setPtr);
addEventListener('pointerdown', setPtr);
addEventListener('pointerleave', () => { ptr.active = false; ptr.x = ptr.y = 9; });

// ---- kamera yolu ----
let finalDist = 11;
function computeFinalDist() {
  const a = innerWidth / innerHeight;
  finalDist = 11 * Math.max(1, 0.95 / a);
}
computeFinalDist();
const FINAL_TARGET = new THREE.Vector3(0, -0.5, -0.8);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  computeFinalDist();
});

// ---- ana döngü ----
let running = false, t = 0, last = performance.now();
let nameShown = false, hintShown = false, handed = false;
let camTipY = -2.6;
const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
const ctx = { t: 0, running: false, now: 0, dt: 0, ptr, asp: 1, wind: 0 };

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (running) t += dt;
  const wind = now * 0.001;
  ptr.energy *= Math.exp(-dt * 4);

  ctx.t = t; ctx.running = running; ctx.now = now; ctx.dt = dt; ctx.asp = innerWidth / innerHeight; ctx.wind = wind;
  for (let i = 0; i < flowers.length; i++) flowers[i].update(ctx);

  const heroTl = hero.o.tl;
  const tipPos = hero.tipPos;
  const heroBloom = hero.bloomPhase;
  const globalBloom = clamp01((t - 5) / 10);

  core.position.copy(hero.head.position);
  core.intensity = running ? lerp(0.5, 1.1, heroBloom) : 0.8;

  ff.material.opacity = running ? sstep(0.5, 3, t) * 0.75 : 0.4;
  for (let i = 0; i < FF; i++) {
    const s = ffSeed[i];
    ffPos[i * 3] = s.x + Math.sin(wind * 0.4 + s.ph) * 0.4;
    ffPos[i * 3 + 1] = ((s.y + wind * s.sp + 3) % 7) - 3;
    ffPos[i * 3 + 2] = s.z + Math.cos(wind * 0.3 + s.ph) * 0.4;
  }
  ffGeo.attributes.position.needsUpdate = true;
  bloom.strength = lerp(0.4, 0.6, globalBloom);
  ground.material.opacity = running ? 0.35 * sstep(0, 2, t) : 0.25;

  // kamera
  camTipY += (tipPos.y - camTipY) * (1 - Math.exp(-dt * 4));
  if (!handed) {
    if (!running) {
      camera.position.set(Math.sin(now * 0.0002) * 0.3, -2.3, 6.5);
      camera.lookAt(0, -2.4, 1.2);
    } else {
      // faz A: ana çiçeğin sapını takip et, sonra bahçenin tamamını gösterecek şekilde geri çekil
      const aPos = camPos.set(Math.sin(t * 0.18) * 0.8, camTipY + 0.1, 6.2);
      const aTar = camTarget.set(0, camTipY - 0.1, 1.2);
      const s = sstep(heroTl.bloom - 0.5, T.handoff, t);
      const ang = (t - 5) * 0.02;
      const fx = Math.sin(ang) * finalDist, fz = FINAL_TARGET.z + Math.cos(ang) * finalDist;
      camera.position.set(lerp(aPos.x, fx, s), lerp(aPos.y, 1.7, s), lerp(aPos.z, fz, s));
      camera.lookAt(lerp(aTar.x, FINAL_TARGET.x, s), lerp(aTar.y, FINAL_TARGET.y, s), lerp(aTar.z, FINAL_TARGET.z, s));
      if (t >= T.handoff) {
        handed = true;
        controls.target.copy(FINAL_TARGET);
        controls.enabled = true;
        controls.update();
      }
    }
  } else {
    controls.update();
  }

  if (running && !nameShown && t >= T.name) {
    nameShown = true;
    document.body.classList.add('show-name');
  }
  if (running && !hintShown && t >= T.hint) {
    hintShown = true;
    document.body.classList.add('show-hint');
    setTimeout(() => document.body.classList.remove('show-hint'), 6000);
  }

  composer.render();
}
requestAnimationFrame(frame);

// ---- başlat / müzik ----
let music = null;
createMusic().then((m) => { music = m; });
let muted = false;
$('#start').addEventListener('click', async () => {
  if (running) return;
  document.body.classList.add('started');
  if (!music) music = await createMusic();
  music.start();
  running = true;
  t = 0;
});
$('#mute').addEventListener('click', () => {
  muted = !muted;
  $('#mute').classList.toggle('off', muted);
  $('#mute').setAttribute('aria-label', muted ? 'Sesi aç' : 'Sesi kapat');
  if (music) music.setMuted(muted);
});

// test için: index.html#t=9 doğrudan 9. saniyeden başlatır (müziksiz)
const hm = location.hash.match(/^#t=(\d+(\.\d+)?)$/);
if (hm) {
  document.body.classList.add('started');
  running = true;
  t = parseFloat(hm[1]);
}

// hata ayıklama için
window.__flower = { get t() { return t; }, skipTo(s) { t = s; } };
