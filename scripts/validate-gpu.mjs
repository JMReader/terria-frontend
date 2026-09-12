/**
 * Validación headless del shader del visor FieldTerrainGPU.
 * Renderiza frames reales con vgpu/node (Dawn) en los 5 modos analíticos
 * y verifica que la salida tenga contenido (píxeles no uniformes).
 * Uso: node scripts/validate-gpu.mjs
 */
import { readFileSync } from "node:fs";
import { init, draw, effect, frame, target, geometry, sampler, uniforms } from "vgpu/node";

const src = readFileSync(
  new URL("../src/lib/terrain/terrainWgsl.ts", import.meta.url),
  "utf8"
);
const grab = (name) => {
  const m = src.match(
    new RegExp(`export const ${name} = /\\* wgsl \\*/ \`([\\s\\S]*?)\`;`)
  );
  if (!m) throw new Error(`Shader ${name} no encontrado en terrainWgsl.ts`);
  // las interpolaciones ${MAX_LOTS} quedan como en el fuente — resolver
  return m[1].replace(/\$\{MAX_LOTS(?:\s*-\s*\d+)?\}/g, (s) => {
    const n = s.match(/-\s*(\d+)/);
    return String(n ? 16 - Number(n[1]) : 16);
  });
};

const TERRAIN = grab("TERRAIN_WGSL");
const BLIT = grab("BLIT_WGSL");

const gpu = await init();
const W = 320;
const H = 240;

const off = target(gpu, {
  size: [W, H],
  depth: true,
  msaa: 4,
  clearColor: [0.957, 0.965, 0.949, 1],
});

// ---- mini malla de terreno con los 6 atributos del shader -----------------
const N = 24;
const pos = new Float32Array(N * N * 3);
const nrm = new Float32Array(N * N * 3);
const col = new Float32Array(N * N * 4);
const elv = new Float32Array(N * N);
const lot = new Float32Array(N * N);
const suv = new Float32Array(N * N * 2);
for (let j = 0; j < N; j++) {
  for (let i = 0; i < N; i++) {
    const k = j * N + i;
    const x = (i / (N - 1)) * 2 - 1;
    const z = (j / (N - 1)) * 2 - 1;
    const h = Math.sin(x * 3) * Math.cos(z * 2.2) * 0.35;
    pos.set([x, h, z], k * 3);
    nrm.set([0, 1, 0], k * 3);
    const inside = Math.abs(x) < 0.7 && Math.abs(z) < 0.7;
    col.set(inside ? [0.35, 0.55, 0.3, 1] : [0.6, 0.58, 0.45, 1], k * 4);
    elv[k] = 40 + h * 60;
    lot[k] = inside ? 1 : -1;
    suv.set([i / (N - 1), j / (N - 1)], k * 2);
  }
}
const idx = [];
for (let j = 0; j < N - 1; j++)
  for (let i = 0; i < N - 1; i++) {
    const a = j * N + i;
    idx.push(a, a + N, a + 1, a + 1, a + N, a + N + 1);
  }

const geo = geometry(gpu, {
  buffers: [
    { attributes: { position: "float32x3" }, data: pos },
    { attributes: { normal: "float32x3" }, data: nrm },
    { attributes: { color: "float32x4" }, data: col },
    { attributes: { elev: "float32" }, data: elv },
    { attributes: { lot: "float32" }, data: lot },
    { attributes: { satUv: "float32x2" }, data: suv },
  ],
  indices: new Uint32Array(idx),
});

// ortho-ish perspective simple (mirando desde arriba-en-ángulo)
const persp = (f, a, n, ff) => {
  const t = 1 / Math.tan(f / 2);
  return new Float32Array([
    t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, ff / (n - ff), -1, 0, 0, (ff * n) / (n - ff), 0,
  ]);
};
const look = (e, c, up) => {
  const zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
  const zl = Math.hypot(zx, zy, zz);
  const z = [zx / zl, zy / zl, zz / zl];
  const x = [
    up[1] * z[2] - up[2] * z[1],
    up[2] * z[0] - up[0] * z[2],
    up[0] * z[1] - up[1] * z[0],
  ];
  const xl = Math.hypot(...x);
  x[0] /= xl; x[1] /= xl; x[2] /= xl;
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return new Float32Array([
    x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
    -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]),
    -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]),
    -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1,
  ]);
};
const mul4 = (a, b) => {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};

const mvp = mul4(
  persp((35 * Math.PI) / 180, W / H, 0.1, 50),
  look([2.2, 2.0, 2.6], [0, 0, 0], [0, 1, 0])
);

const cam = uniforms(gpu, {
  mvp,
  sun: new Float32Array([-0.55, 0.78, -0.3, 0.82]),
  ambient: new Float32Array([0.38, 0.4, 0.38, 0]),
  fogColor: new Float32Array([0.957, 0.965, 0.949, 0]),
  fogRange: new Float32Array([30, 62, 0, 0]),
  params: new Float32Array([1, 5, 0, 0]),
  eye: new Float32Array([2.2, 2.0, 2.6, 0]),
});
const env = uniforms(gpu, {
  lotColors: Array.from({ length: 16 }, (_, i) =>
    i === 1 ? [0.29, 0.62, 0.25, 1] : [0.36, 0.48, 0.29, 1]
  ),
  sat: new Float32Array([1, 0, 0.9, 1]),
  met: new Float32Array([0.7, 29, 0.62, 0.1]),
  range: new Float32Array([20, 40, 0, 0]),
  uvT: new Float32Array([1, 1, 0, 0]),
});

// textura de prueba con gradiente (simula tile Sentinel-2)
const mkTile = (r, g, b) => {
  const tex = gpu.device.createTexture({
    size: [64, 64],
    format: "rgba8unorm-srgb",
    usage: ["texture_binding", "copy_dst", "render_attachment"],
  });
  const px = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < 64 * 64; i++) {
    const x = i % 64, y = (i / 64) | 0;
    px[i * 4] = Math.min(255, r + x);
    px[i * 4 + 1] = Math.min(255, g + y);
    px[i * 4 + 2] = Math.min(255, b + ((x + y) % 40));
    px[i * 4 + 3] = 255;
  }
  gpu.gpu.queue.writeTexture({ texture: tex.gpu }, px, { bytesPerRow: 256 }, [64, 64]);
  return tex;
};

const d = draw(gpu, {
  shader: TERRAIN,
  geometry: geo,
  set: {
    cam,
    env,
    texPrev: mkTile(30, 60, 25),
    texCur: mkTile(80, 140, 40),
    satSmp: sampler(gpu, { magFilter: "linear", minFilter: "linear" }),
  },
  depth: { write: true, compare: "less" },
});

const MODES = [
  ["ndvi", 0],
  ["rgb", 1],
  ["thermal", 2],
  ["moisture", 3],
  ["topography", 4],
];
let failures = 0;
for (const [name, mode] of MODES) {
  cam.set({ params: new Float32Array([1, 5, 0.5, mode]) });
  frame(gpu, (f) => {
    f.pass({ target: off, clear: true, clearDepth: 1 }, (p) => p.draw(d));
  });
  await gpu.settled?.();
  const px = await off.color.read();
  let sum = 0, sq = 0, npx = px.length / 4;
  for (let i = 0; i < px.length; i += 4) {
    const lum = px[i] + px[i + 1] + px[i + 2];
    sum += lum;
    sq += lum * lum;
  }
  const mean = sum / npx;
  const variance = sq / npx - mean * mean;
  const ok = variance > 20;
  console.log(
    `${ok ? "OK  " : "FAIL"} mode=${name.padEnd(10)} mean=${mean.toFixed(1)} var=${variance.toFixed(1)}`
  );
  if (!ok) failures++;
}

// sanity: el blit (surface pass) renderiza el offscreen a un segundo target
const final = target(gpu, { size: [W, H], clearColor: [0, 0, 0, 1] });
const blitCheck = effect(gpu, BLIT, {
  set: { srcTex: off, srcSmp: sampler(gpu, { magFilter: "linear" }) },
});
try {
  frame(gpu, (f) => {
    f.pass({ target: final }, (p) => p.draw(blitCheck));
  });
  await gpu.settled?.();
  const px = await final.color.read();
  const lit = px.filter((_, i) => i % 4 === 0 && px[i] + px[i + 1] + px[i + 2] > 30).length;
  const ok = lit > 100;
  console.log(`${ok ? "OK  " : "FAIL"} blit pass lit=${lit}px`);
  if (!ok) failures++;
} catch (e) {
  console.log("FAIL blit pass:", e.message);
  failures++;
}

gpu.dispose?.();
if (failures > 0) {
  console.error(`\n${failures} check(s) fallaron`);
  process.exit(1);
}
console.log("\nTodos los modos del shader de terreno renderizan contenido.");
