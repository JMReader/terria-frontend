"use client";

/**
 * FieldTerrainGPU — visor 3D real del terreno sobre WebGPU (vgpu).
 *
 * Pipeline: tiles DEM públicos (Mapterhorn/AWS Terrarium) → heightmap decodificado
 * → malla desplazada con normales + colores hipsométricos/NDVI → render offscreen
 * con depth+MSAA → blit al canvas. Orbita con drag/wheel/pinch, damping suave y
 * entrada animada (el relieve "crece" desde plano).
 *
 * Sin WebGPU o si el DEM falla → onFallback() para que el caller muestre la
 * vista MapLibre con terrain+pitch.
 */

import React, { useEffect, useRef, useState } from "react";
import type { FieldItem } from "@/data/fieldsData";
import { fetchHeightmap } from "@/lib/terrain/heightmap";
import { buildTerrainScene, computeRegion } from "@/lib/terrain/buildScene";
import { perspective, lookAt, multiply } from "@/lib/terrain/mat4";

const NUBE: [number, number, number, number] = [0.957, 0.965, 0.949, 1];

const TERRAIN_WGSL = /* wgsl */ `
struct Cam {
  mvp: mat4x4<f32>,
  sun: vec4<f32>,       // xyz dir to sun, w intensity
  ambient: vec4<f32>,   // rgb ambient
  fogColor: vec4<f32>,
  fogRange: vec4<f32>,  // x near, y far
  params: vec4<f32>,    // x relief scale, y contour step (m)
  eye: vec4<f32>,
};
@group(0) @binding(0) var<uniform> cam: Cam;

struct VIn {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) color: vec4f,
  @location(3) elev: f32,
};
struct VOut {
  @builtin(position) clip: vec4f,
  @location(0) nrm: vec3f,
  @location(1) col: vec4f,
  @location(2) wpos: vec3f,
  @location(3) elev: f32,
};

@vertex fn vs_main(v: VIn) -> VOut {
  var p = v.position;
  p.y = p.y * cam.params.x;
  var o: VOut;
  o.clip = cam.mvp * vec4f(p, 1.0);
  o.nrm = v.normal;
  o.col = v.color;
  o.wpos = p;
  o.elev = v.elev;
  return o;
}

@fragment fn fs_main(f: VOut) -> @location(0) vec4f {
  let n = normalize(f.nrm);
  let sunDir = normalize(cam.sun.xyz);
  let dif = max(dot(n, sunDir), 0.0);
  let wrap = pow(dif * 0.8 + 0.2, 1.15);

  var base = f.col.rgb;
  if (f.elev > -9000.0) {
    let step = cam.params.y;
    let dd = abs(fract(f.elev / step + 0.5) - 0.5) * step;
    let w = max(fwidth(f.elev) * 1.5, 0.0001);
    let line = 1.0 - smoothstep(0.0, w, dd);
    base = mix(base, base * 0.6, line * 0.45);
  }

  var lit = base * (cam.ambient.rgb + cam.sun.w * wrap * vec3f(1.0, 0.96, 0.88));
  let dist = length(cam.eye.xyz - f.wpos);
  let fog = smoothstep(cam.fogRange.x, cam.fogRange.y, dist);
  lit = mix(lit, cam.fogColor.rgb, fog * 0.9);
  return vec4f(lit, f.col.a);
}
`;

const BLIT_WGSL = /* wgsl */ `
@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var srcSmp: sampler;
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSample(srcTex, srcSmp, uv);
}
`;

export interface FieldTerrainGPUProps {
  field: FieldItem;
  className?: string;
  onFallback?: (reason: string) => void;
}

type Status = "loading" | "dem" | "build" | "ready" | "failed";

export default function FieldTerrainGPU({
  field,
  className = "",
  onFallback,
}: FieldTerrainGPUProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const failedRef = useRef(false);
  const onFallbackRef = useRef(onFallback);
  useEffect(() => {
    onFallbackRef.current = onFallback;
  });

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
            ],
            indices: b.indices,
          });

        const terrainDraw = draw(gpu, {
          shader: TERRAIN_WGSL,
          geometry: mkGeometry(scene.terrain),
          set: { cam },
          cull: "none",
          depth: { write: true, compare: "less" },
        });
        const wallsDraw = draw(gpu, {
          shader: TERRAIN_WGSL,
          geometry: mkGeometry(scene.walls),
          set: { cam },
          cull: "none",
          depth: { write: true, compare: "less" },
          blend: "alpha",
        });
        const blit = effect(gpu, BLIT_WGSL, {
          set: {
            srcTex: off.color,
            srcSmp: sampler(gpu, { magFilter: "linear", minFilter: "linear" }),
          },
        });

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
          cam.set({
            mvp,
            eye: new Float32Array([eye[0], eye[1], eye[2], 0]),
            params: new Float32Array([relief, scene.contourStep, 0, 0]),
          });

          const [w, h] = surf.size;
          if (off.size[0] !== w || off.size[1] !== h) off.resize([w, h]);

          frame.pass({ target: off, clear: true, clearDepth: 1 }, (p) => {
            p.draw(terrainDraw);
            p.draw(wallsDraw);
          });
          frame.pass(surf, blit);
        });

        setStatus("ready");
        cleanup = () => {
          loop.stop();
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
        console.warn("[FieldTerrainGPU]", err);
        fail(err instanceof Error ? err.message : "gpu-error");
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [field]);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ touchAction: "none", cursor: "grab" }}
      />
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
