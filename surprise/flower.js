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

const isMobile = matchMedia('(pointer: coarse)').matches || innerWidth < 700;
const PETALS = isMobile ? 360 : 640;

// ---- zaman çizelgesi (saniye) ----
const T = {
  stem0: 0.8, stem1: 5.0,
  swell: 4.2,
  bloom: 5.0, bloomSpan: 4.4, petalDur: 2.4,
  name: 10.4, hint: 14.5,
  handoff: 12.5,
};

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
scene.fog = new THREE.Fog('#0a0512', 6, 17);

camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 60);
camera.position.set(0, -2.2, 5.5);

// ---- ışıklar ----
scene.add(new THREE.HemisphereLight('#c9b6ff', '#2a0f2a', 0.55));
const key = new THREE.DirectionalLight('#ffe3cf', 2.1);
key.position.set(2.5, 4, 4);
scene.add(key);
const rim = new THREE.DirectionalLight('#ff7ac0', 2.6);
rim.position.set(-3, 1.5, -4);
scene.add(rim);
const rim2 = new THREE.DirectionalLight('#7fa8ff', 1.2);
rim2.position.set(3, -1, -3);
scene.add(rim2);
const core = new THREE.PointLight('#ff9bd0', 0, 4.5, 1.6);
scene.add(core);

// ---- sap ----
const stemCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, -2.7, 0),
  new THREE.Vector3(0.12, -1.8, -0.08),
  new THREE.Vector3(-0.06, -0.9, 0.05),
  new THREE.Vector3(0.02, -0.35, 0.22),
  new THREE.Vector3(0, 0, 0.18),
]);
const TUBE_SEG = 80, TUBE_RAD = 8;
const stemGeo = new THREE.TubeGeometry(stemCurve, TUBE_SEG, 0.032, TUBE_RAD, false);
const stemIndexTotal = stemGeo.index.count;
const stemMat = new THREE.MeshStandardMaterial({ color: '#2d6a3a', roughness: 0.6, metalness: 0.0 });
const stem = new THREE.Mesh(stemGeo, stemMat);
scene.add(stem);

// ---- yapraklar ----
const leafGeo = buildLeafGeometry();
const veinTex = makeVeinTexture();
const leafMat = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.55, side: THREE.DoubleSide, bumpMap: veinTex, bumpScale: 0.25,
});
const leaves = [];
[
  { s: 0.2, ang: 0.4, len: 0.95, pitch: 0.55 },
  { s: 0.36, ang: 3.6, len: 0.85, pitch: 0.5 },
  { s: 0.52, ang: 2.0, len: 0.7, pitch: 0.7 },
  { s: 0.68, ang: 5.2, len: 0.55, pitch: 0.8 },
].forEach((d, i) => {
  const holder = new THREE.Group();
  holder.position.copy(stemCurve.getPoint(d.s));
  holder.rotation.order = 'YXZ';
  holder.rotation.set(d.pitch + 0.6, d.ang, 0);
  const m = new THREE.Mesh(leafGeo, leafMat);
  holder.add(m);
  holder.scale.setScalar(0.0001);
  holder.visible = false;
  scene.add(holder);
  leaves.push({ holder, s: d.s, len: d.len, start: 2.3 + i * 0.55 });
});

// ---- çiçek başı ----
const head = new THREE.Group();
head.rotation.x = 0.5;
scene.add(head);

const petalMat = new THREE.MeshPhysicalMaterial({
  vertexColors: true,
  roughness: 0.5,
  metalness: 0,
  sheen: 1,
  sheenRoughness: 0.35,
  sheenColor: new THREE.Color('#ffc2e6'),
  side: THREE.DoubleSide,
  bumpMap: veinTex,
  bumpScale: 1.2,
  emissive: new THREE.Color('#5a1048'),
  emissiveIntensity: 0.4,
});

const LAYERS = [
  { max: 0.4, bend: 0.95 },   // dış: açık, hafif sarkan
  { max: 0.75, bend: 0.35 },  // orta
  { max: 1.01, bend: -0.55 }, // iç: içe kıvrık, top şekli
];
const layerGeo = LAYERS.map((l) => buildPetalGeometry(l.bend));
const petals = [];
const layerCount = [0, 0, 0];
const GOLDEN = 2.399963229728653;
for (let i = 0; i < PETALS; i++) {
  const r = i / (PETALS - 1);
  const li = LAYERS.findIndex((l) => r < l.max);
  petals.push({
    r, li, slot: layerCount[li]++,
    phi: i * GOLDEN + (Math.random() - 0.5) * 0.12,
    pitchEnd: lerp(1.2, 0.3, Math.pow(r, 0.8)) + (Math.random() - 0.5) * 0.16,
    len: lerp(1.0, 0.3, Math.pow(r, 0.8)) * (0.92 + Math.random() * 0.16),
    wid: lerp(1.2, 0.8, r) * (0.9 + Math.random() * 0.25),
    baseY: lerp(0, 0.1, r),
    delay: r * T.bloomSpan + Math.random() * 0.35,
    roll: (Math.random() - 0.5) * 0.12,
    swayPhase: Math.random() * 6.28,
    dP: 0, vP: 0, dR: 0, vR: 0,
    sign: Math.random() < 0.5 ? -1 : 1,
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
  // dışta açık pembe, içe doğru koyu magenta
  const k = lerp(1.0, 0.62, Math.pow(p.r, 0.9)) * (0.94 + Math.random() * 0.06);
  tmpC.setRGB(k, lerp(1, 0.6, p.r) * k, lerp(1, 0.85, p.r) * k);
  meshes[p.li].setColorAt(p.slot, tmpC);
});
meshes.forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });

// merkez
const centerMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.1, 16, 12),
  new THREE.MeshStandardMaterial({ color: '#f3c14b', emissive: '#a2630f', emissiveIntensity: 0.8, roughness: 0.6 })
);
centerMesh.scale.set(1, 0.7, 1);
centerMesh.position.y = 0.02;
head.add(centerMesh);

// tomurcuk parıltısı
const glowTex = makeGlowTexture();
const orb = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex, color: '#ffb3dc', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
}));
scene.add(orb);

// ---- zemin ----
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(3.2, 48),
  new THREE.MeshBasicMaterial({
    map: makeGlowTexture('rgba(255,120,190,0.35)', 'rgba(60,20,70,0)'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35,
  })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2.72;
scene.add(ground);

// ---- ateş böcekleri / ışık parçacıkları ----
const FF = isMobile ? 90 : 190;
const ffPos = new Float32Array(FF * 3);
const ffSeed = [];
for (let i = 0; i < FF; i++) {
  ffSeed.push({ x: (Math.random() - 0.5) * 9, y: Math.random() * 7 - 3, z: (Math.random() - 0.5) * 7 - 1, sp: 0.1 + Math.random() * 0.25, ph: Math.random() * 6.28 });
}
const ffGeo = new THREE.BufferGeometry();
ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
const ff = new THREE.Points(ffGeo, new THREE.PointsMaterial({
  map: glowTex, size: 0.14, color: '#ffc9e8', transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, opacity: 0.0,
}));
ff.frustumCulled = false;
scene.add(ff);

// ---- post-processing ----
composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.4, 0.8, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---- kontroller (intro sonrası) ----
controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 2.2;
controls.maxDistance = 11;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = 2.3;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.7;
controls.enabled = false;

// ---- işaretçi ----
const ptr = { x: 9, y: 9, px: 9, py: 9, energy: 0, active: false };
function setPtr(e) {
  const nx = (e.clientX / innerWidth) * 2 - 1;
  const ny = -(e.clientY / innerHeight) * 2 + 1;
  if (ptr.active) ptr.energy = Math.min(3, ptr.energy + Math.hypot(nx - ptr.x, ny - ptr.y) * 14);
  ptr.x = nx; ptr.y = ny; ptr.active = true;
}
addEventListener('pointermove', setPtr);
addEventListener('pointerdown', setPtr);
addEventListener('pointerleave', () => { ptr.active = false; ptr.x = ptr.y = 9; });

// ---- yardımcı: kamera yolu ----
let finalDist = 4.7;
function computeFinalDist() {
  const a = innerWidth / innerHeight;
  finalDist = 4.7 * Math.max(1, 0.78 / a);
}
computeFinalDist();
const FINAL_TARGET = new THREE.Vector3(0, -0.3, 0);

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
const dummy = new THREE.Object3D();
dummy.rotation.order = 'YXZ';
const tip = new THREE.Vector3();
const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3(), tipPos = new THREE.Vector3();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (running) t += dt;
  const tt = running ? t : -1;

  // sap büyümesi
  const g = running ? sstep(T.stem0, T.stem1, t) : 0;
  const rings = Math.max(1, Math.floor(g * TUBE_SEG));
  stemGeo.setDrawRange(0, rings * TUBE_RAD * 6);
  stemCurve.getPoint(Math.max(g, 0.001), tipPos);
  head.position.copy(tipPos);
  const swell = sstep(T.swell, T.swell + 2.5, tt);
  head.scale.setScalar(lerp(0.5, 1, swell));
  const sway = Math.sin(now * 0.0006) * 0.025;
  head.rotation.z = sway;

  // yapraklar
  leaves.forEach((l) => {
    const show = running && g > l.s;
    l.holder.visible = show;
    if (show) {
      const p = easeOutBack(clamp01((t - l.start) / 1.6));
      l.holder.scale.setScalar(Math.max(0.0001, l.len * p));
      l.holder.rotation.z = Math.sin(now * 0.0007 + l.s * 9) * 0.04;
    }
  });

  // yapraklar açılıyor
  const bt = tt - T.bloom;
  const wind = now * 0.001;
  const asp = innerWidth / innerHeight;
  head.updateMatrixWorld(true);
  const decay = Math.exp(-dt * 4);
  ptr.energy *= decay;
  const R = 0.22;
  const bloomPhase = clamp01((tt - T.bloom) / (T.bloomSpan + T.petalDur));

  for (let i = 0; i < petals.length; i++) {
    const p = petals[i];
    const prog = clamp01((bt - p.delay) / T.petalDur);
    const e = prog > 0 ? easeOutBack(prog) : 0;
    const closedPitch = -LAYERS[p.li].bend * 0.8;
    const baseSway = Math.sin(wind * 0.9 + p.swayPhase) * 0.03 * prog;
    let pitch = lerp(closedPitch, p.pitchEnd, e) + baseSway;
    const roll = p.roll * e + Math.sin(wind * 0.7 + p.swayPhase * 1.3) * 0.02 * prog;
    const lenS = p.len * lerp(0.5, 1, sstep(0, 1, prog)) * lerp(0.55, 1, swell);

    // etkileşim: petal ucunun ekrandaki konumu
    if (ptr.active && ptr.energy > 0.05 && prog > 0.5) {
      const L = p.len;
      const ang = p.pitchEnd + LAYERS[p.li].bend * 0.5;
      tip.set(Math.sin(p.phi) * Math.sin(ang) * L * 0.9, p.baseY + Math.cos(ang) * L * 0.9, Math.cos(p.phi) * Math.sin(ang) * L * 0.9);
      tip.applyMatrix4(head.matrixWorld).project(camera);
      const dx = (tip.x - ptr.x) * asp, dy = tip.y - ptr.y;
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

  // parıltı ve ışık
  const orbIn = running ? sstep(0.2, 1.2, t) : 0.6 + 0.25 * Math.sin(now * 0.003);
  const orbOut = 1 - sstep(T.swell + 0.2, T.bloom + 1.5, tt);
  const orbPulse = 1 + 0.2 * Math.sin(now * 0.006);
  orb.position.copy(running ? head.position : new THREE.Vector3(0, -2.65, 0.05));
  orb.position.y += running ? 0.02 : 0;
  orb.scale.setScalar(0.5 * orbIn * (running ? orbOut : 1) * orbPulse + 0.001);
  orb.material.opacity = (running ? orbOut : 1) * 0.55;
  centerMesh.scale.set(1, 0.7, 1).multiplyScalar(sstep(T.bloom + 1, T.bloom + 4, tt) + 0.001);
  core.position.copy(head.position);
  core.intensity = running ? lerp(0.5, 1.1, bloomPhase) : 0.8;

  // ateş böcekleri
  ff.material.opacity = running ? sstep(0.5, 3, t) * 0.75 : 0.4;
  for (let i = 0; i < FF; i++) {
    const s = ffSeed[i];
    const y = ((s.y + wind * s.sp + 3) % 7) - 3;
    ffPos[i * 3] = s.x + Math.sin(wind * 0.4 + s.ph) * 0.4;
    ffPos[i * 3 + 1] = y;
    ffPos[i * 3 + 2] = s.z + Math.cos(wind * 0.3 + s.ph) * 0.4;
  }
  ffGeo.attributes.position.needsUpdate = true;
  bloom.strength = lerp(0.4, 0.6, bloomPhase);

  ground.material.opacity = running ? 0.35 * sstep(0, 2, t) : 0.25;

  // kamera
  if (!handed) {
    if (!running) {
      camera.position.set(Math.sin(now * 0.0002) * 0.3, -2.3, 5.5);
      camera.lookAt(0, -2.4, 0);
    } else {
      // faz A: sapı takip et
      const aPos = camPos.set(Math.sin(t * 0.18) * 0.8, tipPos.y + 0.1, 5.2);
      const aTar = camTarget.set(0, tipPos.y - 0.1, 0);
      const s = sstep(T.bloom - 0.5, T.handoff, t);
      const ang = (t - 5) * 0.1;
      const fx = Math.sin(ang) * finalDist, fz = Math.cos(ang) * finalDist;
      const px = lerp(aPos.x, fx, s), py = lerp(aPos.y, 0.7, s), pz = lerp(aPos.z, fz, s);
      camera.position.set(px, py, pz);
      camera.lookAt(lerp(aTar.x, FINAL_TARGET.x, s), lerp(aTar.y, FINAL_TARGET.y, s), 0);
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

  // yazı ve ipucu
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
