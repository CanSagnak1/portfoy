import * as THREE from 'three';

export const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Parametrik şerit geometri: +Y boyunca uzanır, genişlik X, bükülme +Z yönünde.
 * widthFn(u): genişlik profili, cupFn(u): kenarların içe kıvrılma miktarı,
 * bend: uzunluk boyunca toplam eğilme açısı (radyan), colorFn(u,v): vertex rengi.
 */
export function buildStrip({ lenSeg = 14, widSeg = 4, length = 1, widthFn, cupFn, bend = 0.8, colorFn }) {
  const pos = [], uv = [], col = [], idx = [];
  const k = Math.abs(bend) < 1e-3 ? 1e-3 : bend;
  for (let i = 0; i <= lenSeg; i++) {
    const u = i / lenSeg;
    const a = k * u;
    const cy = (length * Math.sin(a)) / k;
    const cz = (length * (1 - Math.cos(a))) / k;
    const w = widthFn(u);
    for (let j = 0; j <= widSeg; j++) {
      const v = (j / widSeg) * 2 - 1;
      const cup = cupFn(u) * v * v * w;
      pos.push(v * w, cy + cup * Math.sin(a), cz - cup * Math.cos(a));
      uv.push((v + 1) / 2, u);
      const c = colorFn(u, v);
      col.push(c.r, c.g, c.b);
    }
  }
  const row = widSeg + 1;
  for (let i = 0; i < lenSeg; i++) {
    for (let j = 0; j < widSeg; j++) {
      const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Kasımpatı "ray petal": altta tüp gibi dar, uca doğru açılan, ucu yuvarlak. */
export function buildPetalGeometry(bend) {
  // nötr gri-beyaz gradyan: gerçek renk, çiçek başına instance rengiyle verilir
  const base = new THREE.Color().setRGB(0.32, 0.32, 0.32);
  const mid = new THREE.Color().setRGB(0.72, 0.72, 0.72);
  const tip = new THREE.Color().setRGB(1, 1, 1);
  return buildStrip({
    lenSeg: 14,
    widSeg: 4,
    length: 1,
    bend,
    widthFn: (u) => {
      const body = 0.03 * (0.45 + 0.55 * sstep(0, 0.7, u));
      const tipF = u > 0.8 ? Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.8) / 0.2, 2))) : 1;
      return Math.max(0.002, body * tipF);
    },
    cupFn: (u) => 1.1 * (1 - 0.55 * u),
    colorFn: (u, v) => {
      const c = new THREE.Color();
      if (u < 0.5) c.lerpColors(base, mid, u / 0.5);
      else c.lerpColors(mid, tip, (u - 0.5) / 0.5);
      // kenarlar biraz daha açık
      c.lerp(tip, Math.abs(v) * 0.12);
      return c;
    },
  });
}

/** Tırtıklı kasımpatı yaprağı. */
export function buildLeafGeometry() {
  const dark = new THREE.Color('#1e4d2b');
  const light = new THREE.Color('#4f9a5a');
  return buildStrip({
    lenSeg: 24,
    widSeg: 6,
    length: 1,
    bend: 1.1,
    widthFn: (u) => {
      const shape = Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.98 + 0.02)), 0.75);
      const lobes = 1 + 0.28 * Math.sin(u * Math.PI * 8);
      return 0.26 * shape * lobes + 0.004;
    },
    cupFn: () => 0.35,
    colorFn: (u) => new THREE.Color().lerpColors(dark, light, u),
  });
}

/** Yaprak damarları için prosedürel bump dokusu (canvas'ta dikey çizgiler). */
export function makeVeinTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#9a9a9a';
  g.fillRect(0, 0, 128, 128);
  for (let x = 6; x < 128; x += 12) {
    g.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.3})`;
    g.fillRect(x, 0, 2, 128);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(x + 3, 0, 2, 128);
  }
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.fillRect(63, 0, 3, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.35, 'rgba(255,200,230,0.35)');
  gr.addColorStop(1, outer);
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
