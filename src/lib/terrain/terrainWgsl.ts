/**
 * WGSL del visor de terreno 3D — extraído a módulo para validación headless
 * (scripts/validate-gpu.mjs) y para compartir variantes.
 *
 * El shader combina:
 *  - iluminación sol + ambiente + niebla (como antes)
 *  - curvas de nivel por fwidth sobre la cota real
 *  - drape satelital Sentinel-2 con wipe direccional entre capturas
 *    (texPrev → texCur, según spec del diorama)
 *  - vistas analíticas por vértice: ndvi / rgb / térmica / humedad / topo
 *    controladas por cam.params.w y env.met
 */

export const MAX_LOTS = 16;

export const TERRAIN_WGSL = /* wgsl */ `
struct Cam {
  mvp: mat4x4<f32>,
  sun: vec4<f32>,       // xyz dir to sun, w intensity
  ambient: vec4<f32>,   // rgb ambient
  fogColor: vec4<f32>,
  fogRange: vec4<f32>,  // x near, y far
  params: vec4<f32>,    // x relief scale, y contour step (m), z time (s), w viewMode
  eye: vec4<f32>,
};
struct Env {
  lotColors: array<vec4f, ${MAX_LOTS}>, // [0] interior del campo, 1..K lotes
  sat: vec4f,   // x wipe 0..1, y dirección (0=→,1=←), z mezcla satélite, w hay textura
  met: vec4f,   // x precipNorm 0..1, y tempC, z ndviMean, w cloudFrac
  range: vec4f, // x minH, y reliefDelta (m), z ageFade, w libre
  uvT: vec4f,   // xy escala, zw offset: uv-campo → uv-asset
};
@group(0) @binding(0) var<uniform> cam: Cam;
@group(0) @binding(1) var<uniform> env: Env;
@group(0) @binding(2) var texPrev: texture_2d<f32>;
@group(0) @binding(3) var texCur: texture_2d<f32>;
@group(0) @binding(4) var satSmp: sampler;

struct VIn {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) color: vec4f,
  @location(3) elev: f32,
  @location(4) lot: f32,
  @location(5) satUv: vec2f,
};
struct VOut {
  @builtin(position) clip: vec4f,
  @location(0) nrm: vec3f,
  @location(1) col: vec4f,
  @location(2) wpos: vec3f,
  @location(3) elev: f32,
  @location(4) @interpolate(flat) lot: f32,
  @location(5) satUv: vec2f,
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
  o.lot = v.lot;
  o.satUv = v.satUv;
  return o;
}

// Rampa hipsométrica Terria (oliva → tierra → piedra → papel)
fn hypColor(t: f32) -> vec3f {
  let c0 = vec3f(0.490, 0.561, 0.369);
  let c1 = vec3f(0.659, 0.604, 0.439);
  let c2 = vec3f(0.788, 0.698, 0.541);
  let c3 = vec3f(0.863, 0.863, 0.824);
  var col = mix(c0, c1, smoothstep(0.0, 0.45, t));
  col = mix(col, c2, smoothstep(0.45, 0.8, t));
  col = mix(col, c3, smoothstep(0.8, 1.0, t));
  return col;
}

// Rampa térmica ERA5 (cielo → musgo → tierra → tierra profunda)
fn tempColor(tempC: f32) -> vec3f {
  if (tempC < 18.0) { return vec3f(0.482, 0.655, 0.851); }
  if (tempC < 24.0) { return vec3f(0.290, 0.420, 0.275); }
  if (tempC < 30.0) { return vec3f(0.788, 0.698, 0.541); }
  return vec3f(0.561, 0.459, 0.314);
}

// Llovizna procedural: vetas diagonales animadas por cam.params.z
fn rainMask(uv: vec2f, t: f32) -> f32 {
  let rp = uv * vec2f(28.0, 9.0);
  let lane = fract(rp.x + rp.y * 0.55 - t * 1.9);
  let streak = (1.0 - smoothstep(0.0, 0.10, lane)) * smoothstep(0.0, 0.03, lane);
  let lane2 = fract(rp.x * 0.6 + rp.y * 0.8 - t * 1.2 + 0.37);
  let streak2 = (1.0 - smoothstep(0.0, 0.08, lane2)) * smoothstep(0.0, 0.02, lane2);
  return max(streak, streak2 * 0.7);
}

@fragment fn fs_main(f: VOut) -> @location(0) vec4f {
  let n = normalize(f.nrm);
  let sunDir = normalize(cam.sun.xyz);
  let dif = max(dot(n, sunDir), 0.0);
  let wrap = pow(dif * 0.8 + 0.2, 1.15);

  var base = f.col.rgb;
  let mode = i32(round(cam.params.w));
  let inField = f.lot > -0.5;
  let normElev = clamp((f.elev - env.range.x) / max(env.range.y, 1.0), 0.0, 1.0);

  if (inField && f.elev > -9000.0) {
    let li = clamp(i32(round(f.lot)), 0, ${MAX_LOTS - 1});
    let lotCol = env.lotColors[li].rgb;
    let auv = f.satUv * env.uvT.xy + env.uvT.zw;
    let inAsset = all(auv >= vec2f(0.0)) && all(auv <= vec2f(1.0));

    if (mode == 4) {
      // topografía: hipsometría pura dentro del campo también
      base = hypColor(normElev);
    } else if (mode == 2) {
      // térmica ERA5
      base = tempColor(env.met.y);
    } else if (mode == 3) {
      // humedad: suelo seco → saturado según lluvia 7d, con tinte de napa
      let sat = clamp(env.met.x, 0.0, 1.0);
      let dry = vec3f(0.788, 0.698, 0.541);
      let wet = vec3f(0.243, 0.420, 0.400);
      base = mix(dry, wet, sat);
      let napa = smoothstep(0.55, 1.0, sat) * 0.5;
      base = mix(base, vec3f(0.180, 0.545, 0.635), napa);
    } else {
      // ndvi / rgb: drape satelital si hay captura, sino rampa por lote
      base = lotCol;
      if (env.sat.w > 0.5 && inAsset) {
        let wx = select(auv.x, 1.0 - auv.x, env.sat.y > 0.5);
        let wipe = step(wx, env.sat.x);
        let satCol = mix(
          textureSampleLevel(texPrev, satSmp, auv, 0.0),
          textureSampleLevel(texCur, satSmp, auv, 0.0),
          wipe
        ).rgb;
        base = mix(base, satCol, env.sat.z);
      }
    }
  } else if (mode == 4 && f.elev > -9000.0) {
    base = hypColor(normElev);
  }

  // Curvas de nivel: las derivadas (fwidth) no pueden ir dentro de un if
  // no-uniforme en WGSL — se calculan siempre y se enmascaran con select().
  let step = cam.params.y;
  let dd = abs(fract(f.elev / step + 0.5) - 0.5) * step;
  let w = max(fwidth(f.elev) * 1.5, 0.0001);
  var line = (1.0 - smoothstep(0.0, w, dd)) * select(0.0, 1.0, f.elev > -9000.0);
  line = line * select(0.45, 0.8, mode == 4); // modo topo: curvas más marcadas
  base = mix(base, base * 0.6, line);

  var lit = base * (cam.ambient.rgb + cam.sun.w * wrap * vec3f(1.0, 0.96, 0.88));

  // lluvia sobre el campo en vista humedad
  if (mode == 3 && inField && env.met.x > 0.02) {
    let rain = rainMask(f.satUv, cam.params.z) * env.met.x;
    lit = mix(lit, vec3f(0.72, 0.80, 0.84), rain * 0.45);
  }

  let dist = length(cam.eye.xyz - f.wpos);
  let fog = smoothstep(cam.fogRange.x, cam.fogRange.y, dist);
  lit = mix(lit, cam.fogColor.rgb, fog * 0.9);
  return vec4f(lit, f.col.a);
}
`;

export const BLIT_WGSL = /* wgsl */ `
@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var srcSmp: sampler;
@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSampleLevel(srcTex, srcSmp, uv, 0.0);
}
`;
