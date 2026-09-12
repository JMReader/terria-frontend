/**
 * Builds the WebGPU terrain scene geometry for a field:
 *  - a displaced grid mesh with baked normals, hypsometric/NDVI vertex colors
 *  - vertical "cerco" ribbons following lot boundaries and the perimeter
 *  - a dark skirt ring so the slab reads as a floating diorama
 *
 * World space: meters → world units via a uniform scale so the region spans
 * WORLD_W units on x. Relief is normalized to a fixed amplitude so the pampa's
 * subtle elevation still reads dramatically.
 */

import type { FieldItem } from "@/data/fieldsData";
import { generateParcelsGeoJson } from "@/data/backendParcelsGeoJson";
import type { Heightmap, BBox } from "./heightmap";

const WORLD_W = 14;
const RELIEF_AMP = 2.6; // world units from lowest to highest terrain point
const SKIRT_DEPTH = 0.85;
const GRID = 192; // verts per side

const hexRgb = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})/i.exec(hex.trim());
  if (!m) return [0.54, 0.6, 0.42];
  const v = parseInt(m[1], 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};

const pointInRing = (lng: number, lat: number, ring: number[][]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
};

// Hypsometric ramp on Terria tokens: bajo → oliva, medio → tierra, alto → piedra
const RAMP: [number, [number, number, number]][] = [
  [0.0, hexRgb("#7d8f5e")],
  [0.45, hexRgb("#a89a70")],
  [0.8, hexRgb("#c9b28a")],
  [1.0, hexRgb("#dcdcd2")],
];
const hypColor = (t: number): [number, number, number] => {
  for (let i = 1; i < RAMP.length; i++) {
    if (t <= RAMP[i][0]) {
      const [t0, c0] = RAMP[i - 1];
      const [t1, c1] = RAMP[i];
      const k = (t - t0) / (t1 - t0);
      return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k];
    }
  }
  return RAMP[RAMP.length - 1][1];
};

const hash2 = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const niceStep = (raw: number) => {
  const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 0.001)));
  const n = raw / mag;
  const step = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10;
  return step * mag;
};

/** Distancia Haversine en metros entre dos puntos lng/lat. */
const haversineM = (lng1: number, lat1: number, lng2: number, lat2: number) => {
  const R = 6371000;
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLng = (lng2 - lng1) * r;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
};

/**
 * Reduce un anillo a ≤maxSeg aristas conservando las más largas.
 * Los polígonos catastrales reales tienen decenas de vértices — etiquetar
 * cada arista sería ruido; se eligen las más significativas.
 */
function decimateRing(ring: number[][], maxSeg = 7): number[][] {
  const pts = ring.slice(0, -1); // drop closing dup
  if (pts.length <= maxSeg) return pts;
  const scored = pts.map((p, i) => ({
    p,
    len: haversineM(p[0], p[1], pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1]),
  }));
  const keep = new Set(
    [...scored]
      .sort((a, b) => b.len - a.len)
      .slice(0, maxSeg)
      .map((s) => pts.indexOf(s.p))
  );
  return pts.filter((_, i) => keep.has(i));
}

export interface MeshBuffers {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  elevs: Float32Array;
  /** -1 = fuera del campo, 0 = interior sin lote, 1..K = índice de lote */
  lotIdx: Float32Array;
  /** uv normalizado dentro del bbox del perímetro (para drapear tiles Sentinel-2) */
  satUv: Float32Array;
  indices: Uint32Array;
}

/** Arista del perímetro con su longitud real — para cotas HTML proyectadas. */
export interface TerrainSegment {
  a: [number, number]; // world xz
  b: [number, number];
  mid: [number, number, number]; // world xyz (y = cota del terreno)
  meters: number;
}

export interface TerrainScene {
  terrain: MeshBuffers;
  walls: MeshBuffers;
  worldW: number;
  worldD: number;
  reliefDelta: number; // meters, real
  minH: number;
  maxH: number;
  contourStep: number; // meters between contour lines
  region: BBox;
  /** bbox del perímetro real (lng/lat) — espacio UV del drape satelital */
  fieldBBox: BBox;
  /** ids de features de lote, alineados con lotIdx 1..K */
  lotIds: string[];
  /** colores iniciales por lote (index 0 = interior genérico) */
  lotColors: [number, number, number][];
  /** aristas decimadas del perímetro con longitud Haversine */
  segments: TerrainSegment[];
}

export function fieldPerimeterRing(field: FieldItem): number[][] {
  const geo = generateParcelsGeoJson("2024-01-01", "ndvi", field.id, [field]);
  const feat = geo.features.find((f) => f.properties?.isPerimeter);
  const ring =
    (feat?.geometry?.coordinates?.[0] as number[][]) ??
    (field.boundary?.coordinates?.[0] as number[][]);
  return ring && ring.length >= 3
    ? ring
    : [
        [field.lng - 0.01, field.lat + 0.01],
        [field.lng + 0.01, field.lat + 0.01],
        [field.lng + 0.01, field.lat - 0.01],
        [field.lng - 0.01, field.lat - 0.01],
      ];
}

/** Padded geographic bbox that frames the field with surrounding context. */
export function computeRegion(field: FieldItem): BBox {
  const ring = fieldPerimeterRing(field);
  let bMinLng = Infinity, bMaxLng = -Infinity, bMinLat = Infinity, bMaxLat = -Infinity;
  for (const [x, y] of ring) {
    if (x < bMinLng) bMinLng = x;
    if (x > bMaxLng) bMaxLng = x;
    if (y < bMinLat) bMinLat = y;
    if (y > bMaxLat) bMaxLat = y;
  }
  const padLng = (bMaxLng - bMinLng) * 0.55;
  const padLat = (bMaxLat - bMinLat) * 0.55;
  return {
    minLng: bMinLng - padLng,
    maxLng: bMaxLng + padLng,
    minLat: bMinLat - padLat,
    maxLat: bMaxLat + padLat,
  };
}

export function buildTerrainScene(
  field: FieldItem,
  hm: Heightmap,
  grid: number = GRID
): TerrainScene {
  const geo = generateParcelsGeoJson("2024-01-01", "ndvi", field.id, [field]);
  const lotFeats = geo.features.filter(
    (f) => f.properties?.isPortfolio && !f.properties?.isPerimeter
  );
  const ring = fieldPerimeterRing(field);
  const region = computeRegion(field);

  const cLng = (region.minLng + region.maxLng) / 2;
  const cLat = (region.minLat + region.maxLat) / 2;
  const mpdLng = 111320 * Math.cos((cLat * Math.PI) / 180);
  const mpdLat = 111320;
  const wMeters = (region.maxLng - region.minLng) * mpdLng;
  const dMeters = (region.maxLat - region.minLat) * mpdLat;
  const s = WORLD_W / wMeters;
  const worldD = dMeters * s;

  const toWorld = (lng: number, lat: number): [number, number] => [
    (lng - cLng) * mpdLng * s,
    (cLat - lat) * mpdLat * s, // north = -z… we use +z = south so z = (cLat-lat)
  ];

  // ---- raw heights --------------------------------------------------------
  const n = grid;
  const hs = new Float32Array(n * n);
  let minH = Infinity, maxH = -Infinity;
  for (let j = 0; j < n; j++) {
    const lat = region.maxLat - ((region.maxLat - region.minLat) * j) / (n - 1);
    for (let i = 0; i < n; i++) {
      const lng = region.minLng + ((region.maxLng - region.minLng) * i) / (n - 1);
      const h = hm.sample(lng, lat);
      hs[j * n + i] = h;
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
    }
  }
  const reliefDelta = Math.max(4, maxH - minH);
  const yk = RELIEF_AMP / reliefDelta;
  const yOf = (h: number) => (h - minH) * yk;

  // ---- terrain verts ------------------------------------------------------
  const positions = new Float32Array(n * n * 3);
  const normals = new Float32Array(n * n * 3);
  const colors = new Float32Array(n * n * 4);
  const elevs = new Float32Array(n * n);
  const lotIdx = new Float32Array(n * n);
  const satUv = new Float32Array(n * n * 2);

  const lotRings = lotFeats
    .map((f, i) => ({
      ring: (f.geometry?.coordinates?.[0] as number[][]) ?? [],
      color: hexRgb(f.properties?.color ?? "#8a9a6b"),
      id: f.properties?.id ?? `lot-${i}`,
    }))
    .filter((l) => l.ring.length >= 3);

  // bbox del perímetro → espacio UV del drape satelital
  const fBBox: BBox = { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity };
  for (const [x, y] of ring) {
    if (x < fBBox.minLng) fBBox.minLng = x;
    if (x > fBBox.maxLng) fBBox.maxLng = x;
    if (y < fBBox.minLat) fBBox.minLat = y;
    if (y > fBBox.maxLat) fBBox.maxLat = y;
  }
  const fSpanLng = Math.max(fBBox.maxLng - fBBox.minLng, 1e-6);
  const fSpanLat = Math.max(fBBox.maxLat - fBBox.minLat, 1e-6);

  const dxW = WORLD_W / (n - 1);
  const dzW = worldD / (n - 1);

  for (let j = 0; j < n; j++) {
    const lat = region.maxLat - ((region.maxLat - region.minLat) * j) / (n - 1);
    for (let i = 0; i < n; i++) {
      const lng = region.minLng + ((region.maxLng - region.minLng) * i) / (n - 1);
      const idx = j * n + i;
      const [x, z] = toWorld(lng, lat);
      const h = hs[idx];
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = yOf(h);
      positions[idx * 3 + 2] = z;
      elevs[idx] = h;

      // normal via central differences on world-space heights
      const hL = hs[j * n + Math.max(i - 1, 0)];
      const hR = hs[j * n + Math.min(i + 1, n - 1)];
      const hU = hs[Math.max(j - 1, 0) * n + i];
      const hD = hs[Math.min(j + 1, n - 1) * n + i];
      const nx = (yOf(hL) - yOf(hR)) / (2 * dxW);
      const nz = (yOf(hU) - yOf(hD)) / (2 * dzW);
      const ny = 1;
      const nl = Math.hypot(nx, ny, nz) || 1;
      normals[idx * 3] = nx / nl;
      normals[idx * 3 + 1] = ny / nl;
      normals[idx * 3 + 2] = nz / nl;

      // color: inside a lot → NDVI ramp color; inside field → musgo; else hypsometric
      let col: [number, number, number];
      let lot = -1;
      if (pointInRing(lng, lat, ring)) {
        lot = 0;
        col = hexRgb("#5c7a4a");
        for (let li = 0; li < lotRings.length; li++) {
          if (pointInRing(lng, lat, lotRings[li].ring)) {
            col = lotRings[li].color;
            lot = li + 1;
            break;
          }
        }
      } else {
        col = hypColor((h - minH) / reliefDelta);
        const v = (hash2(i, j) - 0.5) * 0.09; // subtle grain
        col = [col[0] + v, col[1] + v, col[2] + v];
      }
      colors[idx * 4] = col[0];
      colors[idx * 4 + 1] = col[1];
      colors[idx * 4 + 2] = col[2];
      colors[idx * 4 + 3] = 1;
      lotIdx[idx] = lot;
      satUv[idx * 2] = (lng - fBBox.minLng) / fSpanLng;
      satUv[idx * 2 + 1] = (fBBox.maxLat - lat) / fSpanLat;
    }
  }

  // ---- terrain indices + skirt -------------------------------------------
  const idxArr: number[] = [];
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idxArr.push(a, c, b, b, c, d);
    }
  }

  // skirt: border verts duplicated downward
  const border: number[] = [];
  for (let i = 0; i < n; i++) border.push(i);
  for (let j = 1; j < n; j++) border.push(j * n + n - 1);
  for (let i = n - 2; i >= 0; i--) border.push((n - 1) * n + i);
  for (let j = n - 2; j >= 1; j--) border.push(j * n);

  const tVertCount = n * n;
  const extra = border.length; // top ring duplicated
  const skirtBase = tVertCount;
  const tPos = new Float32Array((tVertCount + extra) * 3);
  const tNrm = new Float32Array((tVertCount + extra) * 3);
  const tCol = new Float32Array((tVertCount + extra) * 4);
  const tElv = new Float32Array(tVertCount + extra);
  const tLot = new Float32Array(tVertCount + extra);
  const tUv = new Float32Array((tVertCount + extra) * 2);
  tPos.set(positions); tNrm.set(normals); tCol.set(colors); tElv.set(elevs);
  tLot.set(lotIdx); tUv.set(satUv);

  const skirtColor = hexRgb("#5c4a30");
  border.forEach((vi, k) => {
    const o = skirtBase + k;
    const x = positions[vi * 3], y = positions[vi * 3 + 1], z = positions[vi * 3 + 2];
    tPos[o * 3] = x;
    tPos[o * 3 + 1] = y - SKIRT_DEPTH;
    tPos[o * 3 + 2] = z;
    // outward horizontal normal
    const ox = x, oz = z;
    const ol = Math.hypot(ox, oz) || 1;
    tNrm[o * 3] = ox / ol;
    tNrm[o * 3 + 1] = 0;
    tNrm[o * 3 + 2] = oz / ol;
    tCol[o * 4] = skirtColor[0];
    tCol[o * 4 + 1] = skirtColor[1];
    tCol[o * 4 + 2] = skirtColor[2];
    tCol[o * 4 + 3] = 1;
    tElv[o] = -9999;
    tLot[o] = -1;
    tUv[o * 2] = satUv[vi * 2];
    tUv[o * 2 + 1] = satUv[vi * 2 + 1];

    const k2 = (k + 1) % border.length;
    const top = vi, top2 = border[k2], bot = o, bot2 = skirtBase + k2;
    idxArr.push(top, bot, top2, top2, bot, bot2);
  });

  // ---- walls: vertical ribbons along perimeter + lot rings -----------------
  const wPos: number[] = [];
  const wNrm: number[] = [];
  const wCol: number[] = [];
  const wElv: number[] = [];
  const wLot: number[] = [];
  const wUv: number[] = [];
  const wIdx: number[] = [];

  const emitWall = (
    pts: number[][],
    height: number,
    rgb: [number, number, number],
    alpha: number
  ) => {
    const maxSeg = Math.max(dxW, dzW) * 0.9;
    const pushVert = (x: number, y: number, z: number, nx: number, nz: number, top: boolean) => {
      wPos.push(x, top ? y + height : y - 0.06, z);
      wNrm.push(nx, 0, nz);
      wCol.push(rgb[0], rgb[1], rgb[2], alpha);
      wElv.push(-9999);
      wLot.push(-1);
      wUv.push(0, 0);
      return wPos.length / 3 - 1;
    };
    for (let p = 0; p < pts.length - 1; p++) {
      const [lng1, lat1] = pts[p];
      const [lng2, lat2] = pts[p + 1];
      const [x1, z1] = toWorld(lng1, lat1);
      const [x2, z2] = toWorld(lng2, lat2);
      const segLen = Math.hypot(x2 - x1, z2 - z1) || 1e-6;
      const nx = -(z2 - z1) / segLen;
      const nz = (x2 - x1) / segLen;
      const steps = Math.max(1, Math.ceil(segLen / maxSeg));
      for (let k = 0; k < steps; k++) {
        const t0 = k / steps, t1 = (k + 1) / steps;
        const ax = x1 + (x2 - x1) * t0, az = z1 + (z2 - z1) * t0;
        const bx = x1 + (x2 - x1) * t1, bz = z1 + (z2 - z1) * t1;
        const ha = yOf(hm.sample(lng1 + (lng2 - lng1) * t0, lat1 + (lat2 - lat1) * t0));
        const hb = yOf(hm.sample(lng1 + (lng2 - lng1) * t1, lat1 + (lat2 - lat1) * t1));
        const b0 = pushVert(ax, ha, az, nx, nz, false);
        const t0v = pushVert(ax, ha, az, nx, nz, true);
        const b1 = pushVert(bx, hb, bz, nx, nz, false);
        const t1v = pushVert(bx, hb, bz, nx, nz, true);
        wIdx.push(b0, b1, t0v, t0v, b1, t1v);
      }
    }
  };

  // perimeter: taller & darker; lots: slimmer
  emitWall(ring, 0.62, hexRgb("#12271e"), 0.96);
  for (const lot of lotRings) emitWall(lot.ring, 0.34, hexRgb("#1c3a2e"), 0.82);

  // ---- cotas: aristas decimadas del perímetro con metros reales -------------
  const decimated = decimateRing(ring, 7);
  const segments: TerrainSegment[] = [];
  for (let i = 0; i < decimated.length; i++) {
    const a = decimated[i];
    const b = decimated[(i + 1) % decimated.length];
    const meters = haversineM(a[0], a[1], b[0], b[1]);
    if (meters < 8) continue; // aristas triviales no se rotulan
    const [ax, az] = toWorld(a[0], a[1]);
    const [bx, bz] = toWorld(b[0], b[1]);
    const midLng = (a[0] + b[0]) / 2;
    const midLat = (a[1] + b[1]) / 2;
    segments.push({
      a: [ax, az],
      b: [bx, bz],
      mid: [(ax + bx) / 2, yOf(hm.sample(midLng, midLat)) + 0.4, (az + bz) / 2],
      meters,
    });
  }

  return {
    terrain: {
      positions: tPos,
      normals: tNrm,
      colors: tCol,
      elevs: tElv,
      lotIdx: tLot,
      satUv: tUv,
      indices: new Uint32Array(idxArr),
    },
    walls: {
      positions: new Float32Array(wPos),
      normals: new Float32Array(wNrm),
      colors: new Float32Array(wCol),
      elevs: new Float32Array(wElv),
      lotIdx: new Float32Array(wLot),
      satUv: new Float32Array(wUv),
      indices: new Uint32Array(wIdx),
    },
    worldW: WORLD_W,
    worldD,
    reliefDelta,
    minH,
    maxH,
    contourStep: niceStep(reliefDelta / 7),
    region,
    fieldBBox: fBBox,
    lotIds: lotRings.map((l) => l.id),
    lotColors: [hexRgb("#5c7a4a"), ...lotRings.map((l) => l.color)],
    segments,
  };
}
