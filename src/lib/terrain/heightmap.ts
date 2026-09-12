/**
 * DEM (raster-dem) fetch + decode → regular height grid with bilinear sampling.
 *
 * Sources tried in order:
 *  1. Mapterhorn — public terrain tiles (tilejson declares encoding).
 *  2. AWS Terrarium — s3 elevation-tiles-prod, terrarium encoding.
 *
 * Both encodings are PNG raster-dem; we fetch tiles, mosaic them on a canvas
 * and decode elevations to a Float32Array grid in geographic pixel space.
 */

export interface Heightmap {
  /** columns (x) and rows (y) of the decoded mosaic */
  cols: number;
  rows: number;
  /** elevation in meters, row-major (row 0 = northern edge) */
  data: Float32Array;
  /** geographic bounds of the grid */
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
  minH: number;
  maxH: number;
  /** bilinear height at lng/lat (meters), clamped at edges */
  sample(lng: number, lat: number): number;
}

const MAPTERHORN_TILEJSON = "https://tiles.mapterhorn.com/tilejson.json";
const AWS_TERRARIUM =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

const lon2x = (lng: number, z: number) =>
  Math.floor(((lng + 180) / 360) * 2 ** z);
const lat2y = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z
  );
};
const x2lng = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
const y2lat = (y: number, z: number) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
};

type DemEncoding = "terrarium" | "mapbox";

interface DemSource {
  urlTemplate: string;
  encoding: DemEncoding;
  maxzoom: number;
  tileSize: number;
}

async function resolveSources(): Promise<DemSource[]> {
  const sources: DemSource[] = [];
  try {
    const res = await fetch(MAPTERHORN_TILEJSON, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const tj = (await res.json()) as {
        tiles?: string[];
        encoding?: string;
        maxzoom?: number;
        tileSize?: number;
      };
      if (tj.tiles?.[0]) {
        sources.push({
          urlTemplate: tj.tiles[0],
          encoding: tj.encoding === "mapbox" ? "mapbox" : "terrarium",
          maxzoom: tj.maxzoom ?? 12,
          tileSize: tj.tileSize ?? 512,
        });
      }
    }
  } catch {
    /* fall through to AWS */
  }
  sources.push({ urlTemplate: AWS_TERRARIUM, encoding: "terrarium", maxzoom: 15, tileSize: 256 });
  return sources;
}

const decodePixel = (
  encoding: DemEncoding,
  r: number,
  g: number,
  b: number
): number =>
  encoding === "terrarium"
    ? r * 256 + g + b / 256 - 32768
    : -10000 + (r * 65536 + g * 256 + b) * 0.1;

export interface BBox {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

/**
 * Fetches and decodes DEM tiles covering `bbox`. Picks the highest zoom that
 * keeps the mosaic under `maxTiles` per axis (≤ ~1.3M px of decode work).
 */
export async function fetchHeightmap(
  bbox: BBox,
  maxTiles = 4
): Promise<Heightmap> {
  const sources = await resolveSources();
  let lastErr: unknown = null;

  for (const src of sources) {
    // Highest zoom whose tile range fits the budget
    let z = Math.min(src.maxzoom, 13);
    let x0 = 0, x1 = 0, y0 = 0, y1 = 0;
    for (; z >= 8; z--) {
      x0 = lon2x(bbox.minLng, z);
      x1 = lon2x(bbox.maxLng, z);
      y0 = lat2y(bbox.maxLat, z);
      y1 = lat2y(bbox.minLat, z);
      if (x1 - x0 + 1 <= maxTiles && y1 - y0 + 1 <= maxTiles) break;
    }

    const ts = src.tileSize;
    const tw = x1 - x0 + 1;
    const th = y1 - y0 + 1;
    const cols = tw * ts;
    const rows = th * ts;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = cols;
      canvas.height = rows;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("no 2d context");

      const jobs: Promise<void>[] = [];
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const url = src.urlTemplate
            .replace("{z}", String(z))
            .replace("{x}", String(tx))
            .replace("{y}", String(ty));
          const dx = (tx - x0) * ts;
          const dy = (ty - y0) * ts;
          jobs.push(
            (async () => {
              const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
              if (!res.ok) throw new Error(`tile ${res.status}`);
              const bmp = await createImageBitmap(await res.blob());
              ctx.drawImage(bmp, dx, dy);
              bmp.close();
            })()
          );
        }
      }
      await Promise.all(jobs);

      const img = ctx.getImageData(0, 0, cols, rows).data;
      const data = new Float32Array(cols * rows);
      let minH = Infinity;
      let maxH = -Infinity;
      for (let i = 0; i < cols * rows; i++) {
        const h = decodePixel(src.encoding, img[i * 4], img[i * 4 + 1], img[i * 4 + 2]);
        const v = Number.isFinite(h) ? h : 0;
        data[i] = v;
        if (v < minH) minH = v;
        if (v > maxH) maxH = v;
      }

      const minLng = x2lng(x0, z);
      const maxLng = x2lng(x1 + 1, z);
      const maxLat = y2lat(y0, z);
      const minLat = y2lat(y1 + 1, z);
      const pxLng = (maxLng - minLng) / cols;
      const pxLat = (maxLat - minLat) / rows;

      const sample = (lng: number, lat: number): number => {
        const fx = Math.min(Math.max((lng - minLng) / pxLng - 0.5, 0), cols - 1.001);
        const fy = Math.min(Math.max((maxLat - lat) / pxLat - 0.5, 0), rows - 1.001);
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = fx - ix;
        const ty = fy - iy;
        const a = data[iy * cols + ix];
        const b = data[iy * cols + ix + 1];
        const c = data[(iy + 1) * cols + ix];
        const d = data[(iy + 1) * cols + ix + 1];
        return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
      };

      return { cols, rows, data, minLng, maxLng, minLat, maxLat, minH, maxH, sample };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("DEM fetch failed");
}
