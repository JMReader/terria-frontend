/// <reference types="@webgpu/types" />
"use client";

/**
 * FieldTerrainGPU — visor 3D real del terreno sobre WebGPU (vgpu).
 *
 * Pipeline: tiles DEM públicos (Mapterhorn/AWS Terrarium) → heightmap decodificado
 * → malla desplazada con normales + colores hipsométricos/NDVI → render offscreen
 * con depth+MSAA → blit al canvas. Orbita con drag/wheel/pinch, damping suave y
 * entrada animada (el relieve "crece" desde plano).
 *
 * Integración timelapse (spec diorama): recibe el estado compartido del
 * timelapse y reacciona a la fecha seleccionada —
 *  - drapea el tile Sentinel-2 real (rgb/ndvi) sobre el polígono del campo con
 *    wipe direccional entre capturas (texPrev → texCur)
 *  - recolorea lotes por NDVI vía uniform lotColors[] (sin rebuildear geometría)
 *  - vistas analíticas: ndvi / satelital / térmica / humedad / topografía
 *  - telemetría atmosférica ERA5 + cotas métricas Haversine del perímetro
 *
 * Sin WebGPU o si el DEM falla → onFallback() para que el caller muestre la
 * vista MapLibre con terrain+pitch.
 */

import React, { useEffect, useRef, useState } from "react";
import type { FieldItem } from "@/data/fieldsData";
import type { useFieldTimelapse } from "@/hooks/useFieldTimelapse";
import { fetchHeightmap } from "@/lib/terrain/heightmap";
import { buildTerrainScene, computeRegion } from "@/lib/terrain/buildScene";
import { perspective, lookAt, multiply } from "@/lib/terrain/mat4";
import { TERRAIN_WGSL, BLIT_WGSL, MAX_LOTS } from "@/lib/terrain/terrainWgsl";
import { generateParcelsGeoJson } from "@/data/backendParcelsGeoJson";
import AnalyticalViewSelector, { type TerrainViewMode } from "./AnalyticalViewSelector";
import AtmosphericTelemetryOverlay from "./AtmosphericTelemetryOverlay";

type Timelapse = ReturnType<typeof useFieldTimelapse>;

const NUBE: [number, number, number, number] = [0.957, 0.965, 0.949, 1];

const hexRgb = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})/i.exec(hex.trim());
  if (!m) return [0.36, 0.48, 0.29];
  const v = parseInt(m[1], 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};

/** modos analíticos ↔ layer del timelapse compartido */
const LAYER_TO_MODE: Record<string, TerrainViewMode> = {
  rgb: "rgb",
  ndvi: "ndvi",
  weather: "moisture",
};
const MODE_TO_LAYER: Record<TerrainViewMode, "rgb" | "ndvi" | "weather"> = {
  ndvi: "ndvi",
  rgb: "rgb",
  thermal: "weather",
  moisture: "weather",
  topography: "ndvi",
};
const MODE_INDEX: Record<TerrainViewMode, number> = {
  ndvi: 0,
  rgb: 1,
  thermal: 2,
  moisture: 3,
  topography: 4,
};

export interface FieldTerrainGPUProps {
  field: FieldItem;
  timelapse?: Timelapse;
  className?: string;
  onFallback?: (reason: string) => void;
}

type Status = "loading" | "dem" | "build" | "ready" | "failed";

/** Textura vgpu bindable (Texture de vgpu/core). */
type SatTexture = { gpu: GPUTexture; createView(): GPUTextureView; destroy(): void };

interface CotaChip {
  key: string;
  x: number; // % del ancho
  y: number; // % del alto
  label: string;
  behind: boolean;
}

export default function FieldTerrainGPU({
  field,
  timelapse,
  className = "",
  onFallback,
}: FieldTerrainGPUProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [cotas, setCotas] = useState<CotaChip[]>([]);
  const [mode, setMode] = useState<TerrainViewMode>(
    LAYER_TO_MODE[timelapse?.activeLayer ?? "ndvi"] ?? "ndvi"
  );
  const failedRef = useRef(false);
  const onFallbackRef = useRef(onFallback);
  const tlRef = useRef(timelapse);
  const modeRef = useRef(mode);
  const [lastLayer, setLastLayer] = useState(timelapse?.activeLayer);

  // el controller del timelapse manda la vista por defecto del terreno
  // (patrón "adjust state during render" — sin efecto extra)
  const layer = timelapse?.activeLayer;
  if (layer !== lastLayer) {
    setLastLayer(layer);
    if (layer) setMode(LAYER_TO_MODE[layer] ?? "ndvi");
  }

  useEffect(() => {
    onFallbackRef.current = onFallback;
    tlRef.current = timelapse;
    modeRef.current = mode;
  });

  const handleModeChange = (m: TerrainViewMode) => {
    setMode(m);
    timelapse?.setActiveLayer?.(MODE_TO_LAYER[m]);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const fail = (why: string) => {
      if (cancelled || failedRef.current) return;
      failedRef.current = true;
      setStatus("failed");
      onFallbackRef.current?.(why);
    };

    (async () => {
      if (typeof navigator === "undefined" || !("gpu" in navigator)) {
        fail("webgpu-unavailable");
        return;
      }
      try {
        const { init, surface, target, geometry, draw, effect, frameLoop, uniforms, sampler } =
          await import("vgpu");

        const gpu = await init();
        if (cancelled) return;
        // Errores async de pipeline (compilación WGSL, validación) → fallback
        const offError = (gpu as { onError?: (cb: (e: Error) => void) => () => void }).onError?.(
          (e) => {
            console.warn("[FieldTerrainGPU] gpu error:", e);
            fail(e.message || "gpu-pipeline");
          }
        );
        const surf = surface(gpu, canvas, { dpr: [1, 2] });

        setStatus("dem");
        const region = computeRegion(field);
        const hm = await fetchHeightmap(region);
        if (cancelled) return;

        setStatus("build");
        const scene = buildTerrainScene(field, hm);

        const off = target(gpu, {
          size: [4, 4],
          depth: true,
          msaa: 4,
          format: "rgba8unorm",
          clearColor: NUBE,
        });

        const cam = uniforms(gpu, {
          mvp: new Float32Array(16),
          sun: new Float32Array([-0.55, 0.78, -0.3, 0.82]),
          ambient: new Float32Array([0.38, 0.4, 0.38, 0]),
          fogColor: new Float32Array([NUBE[0], NUBE[1], NUBE[2], 0]),
          fogRange: new Float32Array([30, 62, 0, 0]),
          params: new Float32Array([0, scene.contourStep, 0, 0]),
          eye: new Float32Array(4),
        });

        const initLotColors: number[][] = Array.from({ length: MAX_LOTS }, (_, i) => {
          const c = scene.lotColors[Math.min(i, scene.lotColors.length - 1)];
          return [c[0], c[1], c[2], 1];
        });
        const env = uniforms(gpu, {
          lotColors: initLotColors,
          sat: new Float32Array([1, 0, 0, 0]), // wipe, dir, mix, hasTex
          met: new Float32Array([0, 21, 0.5, 0]), // precipN, tempC, ndvi, cloud
          range: new Float32Array([scene.minH, scene.reliefDelta, 0, 0]),
          uvT: new Float32Array([1, 1, 0, 0]), // uv-campo → uv-asset
        });

        // placeholder 1×1 para texturas satelitales antes del primer fetch
        const dev = gpu.device;
        const blankTex = dev.createTexture({
          size: [1, 1],
          format: "rgba8unorm-srgb",
          usage: ["texture_binding", "copy_dst"],
        });
        gpu.gpu.queue.writeTexture(
          { texture: blankTex.gpu },
          new Uint8Array([120, 130, 110, 255]),
          { bytesPerRow: 4 },
          [1, 1]
        );

        const samp = sampler(gpu, {
          magFilter: "linear",
          minFilter: "linear",
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge",
        });

        const mkGeometry = (b: typeof scene.terrain) =>
          geometry(gpu, {
            buffers: [
              {
                attributes: { position: "float32x3" },
                data: b.positions as Float32Array<ArrayBuffer>,
              },
              {
                attributes: { normal: "float32x3" },
                data: b.normals as Float32Array<ArrayBuffer>,
              },
              {
                attributes: { color: "float32x4" },
                data: b.colors as Float32Array<ArrayBuffer>,
              },
              {
                attributes: { elev: "float32" },
                data: b.elevs as Float32Array<ArrayBuffer>,
              },
              {
                attributes: { lot: "float32" },
                data: b.lotIdx as Float32Array<ArrayBuffer>,
              },
              {
                attributes: { satUv: "float32x2" },
                data: b.satUv as Float32Array<ArrayBuffer>,
              },
            ],
            indices: b.indices,
          });

        const texSet = {
          cam,
          env,
          texPrev: blankTex,
          texCur: blankTex,
          satSmp: samp,
        };
        const terrainDraw = draw(gpu, {
          shader: TERRAIN_WGSL,
          geometry: mkGeometry(scene.terrain),
          set: texSet,
          cull: "none",
          depth: { write: true, compare: "less" },
        });
        const wallsDraw = draw(gpu, {
          shader: TERRAIN_WGSL,
          geometry: mkGeometry(scene.walls),
          set: texSet,
          cull: "none",
          depth: { write: true, compare: "less" },
          blend: "alpha",
        });
        const blit = effect(gpu, BLIT_WGSL, {
          set: {
            srcTex: off,
            srcSmp: sampler(gpu, { magFilter: "linear", minFilter: "linear" }),
          },
        });
        try {
          // las surfaces no son compile targets fuera de un frame → compilar por firma
          const surfFormats = (surf as { colors?: readonly (string | { format: string })[] })
            .colors;
          const colors = (surfFormats ?? ["bgra8unorm"]).map((c) =>
            typeof c === "string" ? c : c.format
          );
          await (blit as { compile?: (t: unknown) => Promise<unknown> }).compile?.({ colors });
        } catch (e) {
          console.warn("[FieldTerrainGPU] blit compile:", e);
        }

        // ---- timelapse: texturas Sentinel-2 + estado por fecha ---------------
        const texCache = new Map<string, SatTexture>();
        const inflight = new Set<string>();
        const failedKeys = new Set<string>();
        let curTex: SatTexture = blankTex;
        let prevTex: SatTexture = blankTex;
        let curAssetKey = "";
        let lastColorKey = "";

        // objetivo animado — el frame loop interpola hacia acá
        const targetSat = { mix: 0, has: 0 };
        const wipe = { t: 1, dir: 0 };

        const loadSatellite = async (url: string, bbox: number[] | undefined) => {
          const key = url;
          if (inflight.has(key) || failedKeys.has(key)) return;
          inflight.add(key);
          try {
            let tex = texCache.get(key);
            if (!tex) {
              const res = await fetch(url, { mode: "cors", signal: AbortSignal.timeout(12000) });
              if (!res.ok) throw new Error(`asset ${res.status}`);
              const bmp = await createImageBitmap(await res.blob());
              const t = dev.createTexture({
                size: [bmp.width, bmp.height],
                format: "rgba8unorm-srgb",
                usage: ["texture_binding", "copy_dst", "render_attachment"],
              });
              gpu.gpu.queue.copyExternalImageToTexture(
                { source: bmp },
                { texture: t.gpu },
                [bmp.width, bmp.height]
              );
              bmp.close();
              tex = t;
              texCache.set(key, tex);
            }
            if (cancelled) return;

            // uv-campo → uv-asset: si el asset trae bbox, mapear
            const fb = scene.fieldBBox;
            if (bbox && bbox.length >= 4) {
              const [aMinLng, aMinLat, aMaxLng, aMaxLat] = bbox;
              const sU = (fb.maxLng - fb.minLng) / Math.max(aMaxLng - aMinLng, 1e-9);
              const sV = (fb.maxLat - fb.minLat) / Math.max(aMaxLat - aMinLat, 1e-9);
              const oU = (fb.minLng - aMinLng) / Math.max(aMaxLng - aMinLng, 1e-9);
              // v: campo mide lat→v con v=0 al norte; el asset igual tras flipY
              const oV = (aMaxLat - fb.maxLat) / Math.max(aMaxLat - aMinLat, 1e-9);
              env.set({ uvT: new Float32Array([sU, sV, oU, oV]) });
            } else {
              env.set({ uvT: new Float32Array([1, 1, 0, 0]) });
            }

            if (key !== curAssetKey) {
              // wipe: la captura actual pasa a prev, la nueva entra con transición
              prevTex = curTex;
              curTex = tex;
              curAssetKey = key;
              wipe.t = 0;
              wipe.dir = Math.random() > 0.5 ? 1 : 0;
              terrainDraw.set({ texPrev: prevTex, texCur: curTex });
              wallsDraw.set({ texPrev: prevTex, texCur: curTex });
            }
            targetSat.has = 1;
            targetSat.mix = 1;
          } catch (err) {
            console.warn("[FieldTerrainGPU] sat tile:", err);
            failedKeys.add(key);
          } finally {
            inflight.delete(key);
          }
        };

        const refreshLotColors = () => {
          const tl = tlRef.current;
          const ts = tl?.timelineState;
          const date = ts?.selectedDate ?? "2024-01-01";
          const geo = generateParcelsGeoJson(
            date,
            "ndvi",
            field.id,
            [field],
            ts ?? undefined,
            tl?.manifest ?? undefined
          );
          const byId = new Map(
            geo.features.map((f) => [f.properties?.id, f.properties?.color])
          );
          const next: number[][] = initLotColors.map((c) => [...c]);
          scene.lotIds.forEach((id, i) => {
            const hex = byId.get(id);
            if (typeof hex === "string") {
              const c = hexRgb(hex);
              next[i + 1] = [c[0], c[1], c[2], 1];
            }
          });
          env.set({ lotColors: next });
        };

        // ---- orbit state --------------------------------------------------
        const targetY = 1.15;
        const fitDist = Math.max(scene.worldW, scene.worldD) * 1.9;
        const orbit = {
          yaw: -0.65,
          pitch: 0.62,
          dist: fitDist * 1.45,
          tYaw: -0.65,
          tPitch: 0.62,
          tDist: fitDist,
          interacted: false,
          born: performance.now(),
        };

        const pointers = new Map<number, { x: number; y: number }>();
        let pinchDist = 0;
        const onPointerDown = (e: PointerEvent) => {
          canvas.setPointerCapture(e.pointerId);
          pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          orbit.interacted = true;
          if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
          }
        };
        const onPointerMove = (e: PointerEvent) => {
          const prev = pointers.get(e.pointerId);
          if (!prev) return;
          const dx = e.clientX - prev.x;
          const dy = e.clientY - prev.y;
          pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.size === 1) {
            orbit.tYaw += dx * 0.0052;
            orbit.tPitch = Math.min(1.35, Math.max(0.12, orbit.tPitch + dy * 0.0042));
          } else if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (pinchDist > 0)
              orbit.tDist = Math.min(90, Math.max(7, orbit.tDist * (pinchDist / d)));
            pinchDist = d;
          }
        };
        const onPointerUp = (e: PointerEvent) => {
          pointers.delete(e.pointerId);
          pinchDist = 0;
        };
        const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          orbit.interacted = true;
          orbit.tDist = Math.min(90, Math.max(7, orbit.tDist * (1 + e.deltaY * 0.0011)));
        };
        canvas.addEventListener("pointerdown", onPointerDown);
        canvas.addEventListener("pointermove", onPointerMove);
        canvas.addEventListener("pointerup", onPointerUp);
        canvas.addEventListener("pointercancel", onPointerUp);
        canvas.addEventListener("wheel", onWheel, { passive: false });

        // envío animado: valores actuales que interpolan hacia target*
        const cur = { satMix: 0, has: 0, precip: 0, temp: 21, ndvi: 0.5, cloud: 0 };
        let cotaTimer = 0;
        const lastChips: CotaChip[] = [];

        const fov = (32 * Math.PI) / 180;
        const loop = frameLoop(gpu, (frame) => {
          const now = performance.now();
          const t = (now - orbit.born) / 1000;
          const ease = 1 - Math.pow(1 - Math.min(t / 1.4, 1), 3);
          if (!orbit.interacted) orbit.tYaw += 0.0016; // giro lento en reposo

          const k = 0.1;
          orbit.yaw += (orbit.tYaw - orbit.yaw) * k;
          orbit.pitch += (orbit.tPitch - orbit.pitch) * k;
          orbit.dist += (orbit.tDist - orbit.dist) * k;

          // ---- timelapse sync ------------------------------------------
          const tl = tlRef.current;
          const ts = tl?.timelineState;
          const m = MODE_INDEX[modeRef.current] ?? 0;

          // colores de lote por fecha (una vez por cambio de estado)
          const colorKey = `${ts?.selectedDate ?? ""}|${ts?.satellite?.id ?? ""}`;
          if (colorKey !== lastColorKey) {
            lastColorKey = colorKey;
            refreshLotColors();
          }

          // textura satelital según modo
          const wantLayer = m === 1 ? "rgb" : "ndvi";
          const asset = ts?.satellite?.assets?.find((a) => a.layer === wantLayer);
          if (asset?.url && (m === 0 || m === 1)) {
            if (asset.url !== curAssetKey) {
              void loadSatellite(asset.url, asset.bbox);
            } else {
              targetSat.mix = 1; // ya cargada — reaparecer al volver al modo
            }
          } else {
            targetSat.mix = 0;
          }

          // met: precip7d normalizada /80mm, tempC media, ndvi, nubosidad
          const wd = ts?.weather;
          const rain7 = wd?.precipitation7d?.value ?? wd?.precipitationDay?.value ?? 0;
          const tMax = wd?.temperatureMax?.value;
          const tMin = wd?.temperatureMin?.value;
          const tempC =
            tMax != null && tMin != null ? (tMax + tMin) / 2 : tMax ?? tMin ?? 21;
          const ndvi = ts?.satellite?.ndvi?.mean?.value ?? 0.5;
          const cloud = ts?.satellite?.quality?.cloudFraction ?? 0;

          const lerp = (a: number, b: number) => a + (b - a) * 0.12;
          cur.satMix = lerp(cur.satMix, targetSat.mix);
          cur.has = lerp(cur.has, targetSat.has);
          cur.precip = lerp(cur.precip, Math.min(rain7 / 80, 1));
          cur.temp = lerp(cur.temp, tempC);
          cur.ndvi = lerp(cur.ndvi, ndvi);
          cur.cloud = lerp(cur.cloud, cloud);
          wipe.t = Math.min(1, wipe.t + 0.02);

          cam.set({
            params: new Float32Array([
              0.15 + 0.85 * ease, // relief crece en la entrada
              scene.contourStep,
              t,
              m,
            ]),
          });
          env.set({
            sat: new Float32Array([wipe.t, wipe.dir, cur.satMix, cur.has]),
            met: new Float32Array([cur.precip, cur.temp, cur.ndvi, cur.cloud]),
          });

          const relief = 0.15 + 0.85 * ease;
          const eye: [number, number, number] = [
            Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist,
            targetY + Math.sin(orbit.pitch) * orbit.dist,
            Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist,
          ];
          const aspect = Math.max(surf.size[0] / Math.max(surf.size[1], 1), 0.01);
          const mvp = multiply(
            perspective(fov, aspect, 0.5, 220),
            lookAt(eye, [0, targetY, 0], [0, 1, 0])
          );
          cam.set({ mvp, eye: new Float32Array([eye[0], eye[1], eye[2], 0]) });

          // cotas del perímetro → chips HTML (≈10 Hz)
          cotaTimer += 1;
          if (cotaTimer >= 6 && scene.segments.length > 0) {
            cotaTimer = 0;
            const chips: CotaChip[] = [];
            scene.segments.forEach((seg, i) => {
              const [x, y, z] = seg.mid;
              const cy = y * relief;
              const cx = mvp[0] * x + mvp[4] * cy + mvp[8] * z + mvp[12];
              const cyy = mvp[1] * x + mvp[5] * cy + mvp[9] * z + mvp[13];
              const cz = mvp[2] * x + mvp[6] * cy + mvp[10] * z + mvp[14];
              const cw = mvp[3] * x + mvp[7] * cy + mvp[11] * z + mvp[15];
              if (cw <= 0.01) return;
              const nx = cx / cw;
              const ny = cyy / cw;
              if (nx < -1 || nx > 1 || ny < -1 || ny > 1) return;
              const label =
                seg.meters >= 1000
                  ? `${(seg.meters / 1000).toFixed(2)} km`
                  : `${Math.round(seg.meters)} m`;
              chips.push({
                key: `c${i}`,
                x: ((nx + 1) / 2) * 100,
                y: ((1 - ny) / 2) * 100,
                label,
                behind: cz / cw > 0.92,
              });
            });
            const sig = chips.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(";");
            const prevSig = lastChips.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(";");
            if (sig !== prevSig || chips.length !== lastChips.length) {
              lastChips.length = 0;
              lastChips.push(...chips);
              setCotas(chips);
            }
          }

          const [w, h] = surf.size;
          if (off.size[0] !== w || off.size[1] !== h) off.resize([w, h]);

          frame.pass({ target: off, clear: true, clearDepth: 1 }, (p) => {
            p.draw(terrainDraw);
            p.draw(wallsDraw);
          });
          frame.pass(surf, (p) => p.draw(blit));
        });

        setStatus("ready");
        cleanup = () => {
          loop.stop();
          offError?.();
          texCache.forEach((t) => t.destroy());
          blankTex.destroy();
          canvas.removeEventListener("pointerdown", onPointerDown);
          canvas.removeEventListener("pointermove", onPointerMove);
          canvas.removeEventListener("pointerup", onPointerUp);
          canvas.removeEventListener("pointercancel", onPointerUp);
          canvas.removeEventListener("wheel", onWheel);
          try {
            (gpu as { dispose?: () => void }).dispose?.();
          } catch {
            /* noop */
          }
        };
      } catch (err) {
        const cause = (err as { cause?: { message?: string } })?.cause?.message;
        console.warn("[FieldTerrainGPU]", err, cause ? `cause: ${cause}` : "");
        fail(err instanceof Error ? err.message : "gpu-error");
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [field]);

  const timelineState = timelapse?.timelineState;

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ touchAction: "none", cursor: "grab" }}
      />

      {/* cotas métricas del perímetro — flotan sobre la arista proyectada */}
      {status === "ready" &&
        cotas.map((c) => (
          <span
            key={c.key}
            className={`pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border px-1.5 py-0.5 font-mono text-[9px] tabular-nums transition-opacity duration-300 ${
              c.behind
                ? "border-piedra/40 bg-papel/50 text-bosque/40 opacity-40"
                : "border-piedra/60 bg-papel/80 text-bosque/80 opacity-90"
            }`}
            style={{ left: `${c.x}%`, top: `${c.y}%` }}
          >
            {c.label}
          </span>
        ))}

      {/* selector de vista analítica */}
      {status === "ready" && (
        <div className="absolute right-3 top-3 z-20">
          <AnalyticalViewSelector mode={mode} onChange={handleModeChange} />
        </div>
      )}

      {/* telemetría atmosférica sincronizada con la fecha del timelapse */}
      {status === "ready" && timelineState && (
        <AtmosphericTelemetryOverlay
          timelineState={timelineState}
          className="absolute left-3 top-3 z-20"
        />
      )}

      {status !== "ready" && status !== "failed" && (
        <div className="absolute inset-0 flex items-center justify-center bg-nube">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-musgo/30 border-t-musgo" />
            <p className="font-mono text-[11px] tracking-wide text-bosque/60">
              {status === "dem"
                ? "Descargando relieve…"
                : status === "build"
                  ? "Construyendo terreno…"
                  : "Iniciando WebGPU…"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
