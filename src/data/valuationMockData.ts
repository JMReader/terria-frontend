import { FieldItem } from "./fieldsData";
import { LandValuation } from "@/types/valuation";

/**
 * Réplica determinística v2 del motor de valuación agronómica y financiera de TERRIA:
 *   Projected = V0 × M_hyd × M_soil × M_rent
 *
 * Basado en:
 * - Driver 1 (M_hyd): Resiliencia hídrica (Cota de napa freática INTA + aporte capilar estival 150-250 mm)
 *   más conectividad a red vial troncal pavimentada (OSM / DPV).
 * - Driver 2 (M_soil): Salud del suelo y estabilidad biomasa Sentinel-2 acoplado a series
 *   departamentales SAGyP 15 años y elasticidad de renta de Ricardo-Thünen (0.52).
 * - Driver 3 (M_rent): Ciclo de renta agrícola (quintales de soja/ha) capitalizado a tasa CAIR/BCR (2.85% anual).
 *
 * Utilizado como fallback offline y como estado inicial optimista mientras la API resuelve en vivo.
 */

interface DemoZoneParams {
  baseValueUsdHa: number;
  hydricImpactPct: number;
  waterTableDetail: string;
  distanceToCurrentPavedKm: number;
  distanceToFuturePavedKm: number;
  roadDetail: string;
  cagrAnnualPct: number;
  soilHealthFactor: number;
  soilSeriesDetail: string;
  rentQqSoja: number;
}

const DEMO_ZONE_PARAMS: Record<string, DemoZoneParams> = {
  // --- 3 CAMPOS REALES DE SUPABASE ---
  // 1. Lote Sur — EEA INTA Marcos Juárez
  "9d103ed2-cfac-4ff9-bd9f-9fa3d9225d38": {
    baseValueUsdHa: 10500,
    hydricImpactPct: 3.8,
    waterTableDetail: "Napa freática en 1.9m (Argiudol típico Serie Marcos Juárez; aporte capilar ~190 mm estival)",
    distanceToCurrentPavedKm: 3.0,
    distanceToFuturePavedKm: 3.0,
    roadDetail: "Acceso pavimentado directo por RP 12 km 3 a 3.0 km de RN 9 troncal",
    cagrAnnualPct: 1.83,
    soilHealthFactor: 1.0,
    soilSeriesDetail: "Suelo Argiudol típico Clase I con alta estabilidad de biomasa satelital Sentinel-2",
    rentQqSoja: 14.5,
  },
  "2e9a0e25032e": {
    baseValueUsdHa: 10500,
    hydricImpactPct: 3.8,
    waterTableDetail: "Napa freática en 1.9m (Argiudol típico Serie Marcos Juárez; aporte capilar ~190 mm estival)",
    distanceToCurrentPavedKm: 3.0,
    distanceToFuturePavedKm: 3.0,
    roadDetail: "Acceso pavimentado directo por RP 12 km 3 a 3.0 km de RN 9 troncal",
    cagrAnnualPct: 1.83,
    soilHealthFactor: 1.0,
    soilSeriesDetail: "Suelo Argiudol típico Clase I con alta estabilidad de biomasa satelital Sentinel-2",
    rentQqSoja: 14.5,
  },

  // 2. Lote NO — EEA INTA Manfredi
  "377e9838-826a-46ad-bb25-9a5230f59752": {
    baseValueUsdHa: 6800,
    hydricImpactPct: 1.8,
    waterTableDetail: "Napa freática en 2.8m (Cota moderada a profunda; aporte capilar ~75 mm estival)",
    distanceToCurrentPavedKm: 1.5,
    distanceToFuturePavedKm: 1.5,
    roadDetail: "Frente a Autopista Córdoba-Rosario (RN 9 km 636)",
    cagrAnnualPct: 1.94,
    soilHealthFactor: 0.85,
    soilSeriesDetail: "Suelo Haplustol típico con ensayos históricos de labranza y rotación INTA Manfredi",
    rentQqSoja: 11.5,
  },
  "94d9fb54c3d3": {
    baseValueUsdHa: 6800,
    hydricImpactPct: 1.8,
    waterTableDetail: "Napa freática en 2.8m (Cota moderada a profunda; aporte capilar ~75 mm estival)",
    distanceToCurrentPavedKm: 1.5,
    distanceToFuturePavedKm: 1.5,
    roadDetail: "Frente a Autopista Córdoba-Rosario (RN 9 km 636)",
    cagrAnnualPct: 1.94,
    soilHealthFactor: 0.85,
    soilSeriesDetail: "Suelo Haplustol típico con ensayos históricos de labranza y rotación INTA Manfredi",
    rentQqSoja: 11.5,
  },

  // 3. Campo Experimental Pozo del Carril (FAV-UNRC)
  "6b54bd15-70b3-40aa-970c-7922e3c82741": {
    baseValueUsdHa: 3800,
    hydricImpactPct: 0.0,
    waterTableDetail: "Napa profunda a 4.5m (pedemonte de Comechingones sin aporte freático)",
    distanceToCurrentPavedKm: 14.0,
    distanceToFuturePavedKm: 14.0,
    roadDetail: "Camino rural consolidado con enlace a RN 36 a 14 km",
    cagrAnnualPct: 1.88,
    soilHealthFactor: 0.5,
    soilSeriesDetail: "Suelo de pedemonte silvopastoril con limitantes de pendiente y carbono orgánico",
    rentQqSoja: 7.0,
  },
  "af1b4970ff52": {
    baseValueUsdHa: 3800,
    hydricImpactPct: 0.0,
    waterTableDetail: "Napa profunda a 4.5m (pedemonte de Comechingones sin aporte freático)",
    distanceToCurrentPavedKm: 14.0,
    distanceToFuturePavedKm: 14.0,
    roadDetail: "Camino rural consolidado con enlace a RN 36 a 14 km",
    cagrAnnualPct: 1.88,
    soilHealthFactor: 0.5,
    soilSeriesDetail: "Suelo de pedemonte silvopastoril con limitantes de pendiente y carbono orgánico",
    rentQqSoja: 7.0,
  },

  // --- PRESETS / MOCKS FRONTEND TRADICIONALES ---
  "la-esperanza": {
    baseValueUsdHa: 8400,
    hydricImpactPct: 3.5,
    waterTableDetail: "Napa freática a 2.1m en cinturón verde periurbano (aporte capilar estival ~140 mm)",
    distanceToCurrentPavedKm: 4.0,
    distanceToFuturePavedKm: 4.0,
    roadDetail: "Lote consolidado sobre Av. 11 de Septiembre — acceso directo pavimentado",
    cagrAnnualPct: 1.3,
    soilHealthFactor: 0.9,
    soilSeriesDetail: "Clase IIw Serie Córdoba — rotación intensiva de granos y hortalizas",
    rentQqSoja: 12.0,
  },
  "don-pedro": {
    baseValueUsdHa: 9800,
    hydricImpactPct: 4.5,
    waterTableDetail: "Napa freática óptima a 1.6m en corazón de zona núcleo (aporte capilar ~220 mm)",
    distanceToCurrentPavedKm: 28.0,
    distanceToFuturePavedKm: 8.0,
    roadDetail: "Autovía RN 8 (tramo Pergamino–Arrecifes) en ejecución — acerca el pavimento 20 km",
    cagrAnnualPct: 1.85,
    soilHealthFactor: 1.0,
    soilSeriesDetail: "Argiudol típico Serie Pergamino Clase I — máxima estabilidad Sentinel-2",
    rentQqSoja: 15.5,
  },
  "el-ombu": {
    baseValueUsdHa: 7900,
    hydricImpactPct: 3.8,
    waterTableDetail: "Napa freática en 1.9m (Hapludol Serie Venado Tuerto; aporte capilar ~180 mm)",
    distanceToCurrentPavedKm: 35.0,
    distanceToFuturePavedKm: 20.0,
    roadDetail: "Corredor RN 33 sur en duplicación — ahorra 15 km al asfalto",
    cagrAnnualPct: 1.8,
    soilHealthFactor: 0.9,
    soilSeriesDetail: "Hapludol profundo con rotación maíz/trigo de alta tecnología",
    rentQqSoja: 15.0,
  },
  "san-jeronimo": {
    baseValueUsdHa: 8200,
    hydricImpactPct: 8.0,
    waterTableDetail: "Riego suplementario presurizado por 2 pivotes centrales (estabilidad hídrica total)",
    distanceToCurrentPavedKm: 22.0,
    distanceToFuturePavedKm: 12.0,
    roadDetail: "Variante RN 158 / acceso Villa María en obra — ahorra 10 km al asfalto",
    cagrAnnualPct: 1.75,
    soilHealthFactor: 0.85,
    soilSeriesDetail: "Serie Ballesteros con riego pivote y manejo de nutrición balanceada",
    rentQqSoja: 12.5,
  },
  "la-josefina": {
    baseValueUsdHa: 5900,
    hydricImpactPct: 0.0,
    waterTableDetail: "Estrato con tosca somera a 1.2m sin aporte freático profundo",
    distanceToCurrentPavedKm: 40.0,
    distanceToFuturePavedKm: 15.0,
    roadDetail: "Repavimentación RP 65 corredor exportador Balcarce — ahorra 25 km",
    cagrAnnualPct: 1.45,
    soilHealthFactor: 0.8,
    soilSeriesDetail: "Argiudol lítico Serie Mar del Plata con alto contenido de materia orgánica",
    rentQqSoja: 11.0,
  },
};

const DEFAULT_ZONE: DemoZoneParams = {
  baseValueUsdHa: 7000,
  hydricImpactPct: 1.5,
  waterTableDetail: "Napa freática moderada a 2.5m según atlas INTA",
  distanceToCurrentPavedKm: 25,
  distanceToFuturePavedKm: 25,
  roadDetail: "Red vial secundaria sin obras activas en 50 km",
  cagrAnnualPct: 1.2,
  soilHealthFactor: 0.8,
  soilSeriesDetail: "Suelo agrícola regional con manejo estándar",
  rentQqSoja: 10.0,
};

const AUDIT_URLS: Record<string, string> = {
  idecor_mapas_cordoba: "https://mapascordoba.gob.ar/#/mapas/tierra-rural",
  osm_overpass_vialidad: "https://overpass-turbo.eu",
  sagyp_estimaciones_oficiales: "https://datos.magyp.gob.ar/dataset/estimaciones-agricolas",
  cair_inmobiliarias_rurales: "https://cairural.com.ar/informes-sectoriales/",
};

const round = (n: number, digits = 4) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

/** Hash determinista estilo SHA-256 para el demo (cyrb53 × 4 seeds → 64 hex). */
function demoHash(payload: string): string {
  const cyrb53 = (str: string, seed: number) => {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 =
      Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
      Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 =
      Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
      Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return ((h2 >>> 0).toString(16) + (h1 >>> 0).toString(16)).padStart(16, "0");
  };
  return [0, 1, 2, 3].map((s) => cyrb53(payload, s)).join("");
}

export function computeDemoValuation(
  field: FieldItem,
  projectionYears = 5
): LandValuation {
  const zone = DEMO_ZONE_PARAMS[field.id] ?? DEFAULT_ZONE;
  const currentYear = new Date().getFullYear();
  const targetYear = currentYear + projectionYears;

  // 1. M_hyd: Resiliencia Hídrica & Logística (INTA + Red Troncal OSM)
  const distanceSavedKm = Math.max(
    0,
    zone.distanceToCurrentPavedKm - zone.distanceToFuturePavedKm
  );
  const roadImpactPct = Math.min(3.0, (distanceSavedKm / 10.0) * 1.5);
  const totalLogisticImpactPct = Math.min(
    15.0,
    Math.max(-2.5, zone.hydricImpactPct + roadImpactPct)
  );
  const logisticMultiplier = 1 + totalLogisticImpactPct / 100;

  // 2. M_soil: Salud del Suelo & Satélite Sentinel-2 (SAGyP 15a × Ricardo-Thünen 0.52)
  const effectiveCagr = zone.cagrAnnualPct * zone.soilHealthFactor;
  const accumAgroGrowthPct = effectiveCagr * projectionYears;
  const agroImpactPct = accumAgroGrowthPct * 0.52;
  const agroMultiplier = 1 + agroImpactPct / 100;

  // 3. M_rent: Ciclo de Renta & Capitalización Rural (CAIR / BCR)
  const marketAnnualRate = 0.4 + (zone.rentQqSoja / 14.5) * 0.42;
  const marketMultiplier = Math.pow(1 + marketAnnualRate / 100, projectionYears);
  const marketImpactPct = (marketMultiplier - 1) * 100;

  // Ecuación maestra: Projected = V0 × M_hyd × M_soil × M_rent
  const totalMultiplier = logisticMultiplier * agroMultiplier * marketMultiplier;
  const projectedValueUsdHa = zone.baseValueUsdHa * totalMultiplier;
  const surfaceHa = field.hectares;
  const totalBaseUsd = zone.baseValueUsdHa * surfaceHa;
  const totalProjectedUsd = projectedValueUsdHa * surfaceHa;

  const valuation: Omit<LandValuation, "contentHash"> = {
    currentYear,
    targetYear,
    projectionYears,
    baseValueUsdHa: round(zone.baseValueUsdHa, 2),
    projectedValueUsdHa: round(projectedValueUsdHa, 2),
    totalAppreciationPercentage: round((totalMultiplier - 1) * 100, 2),
    driversBreakdown: {
      logisticImprovement: {
        impactPercentage: round(totalLogisticImpactPct, 2),
        multiplier: round(logisticMultiplier, 4),
        detail: `Resiliencia hídrica: ${zone.waterTableDetail}. ${zone.roadDetail}.`,
        distanceToCurrentPavedKm: zone.distanceToCurrentPavedKm,
        distanceToFuturePavedKm: zone.distanceToFuturePavedKm,
        distanceSavedKm,
      },
      agronomicTrend: {
        impactPercentage: round(agroImpactPct, 2),
        multiplier: round(agroMultiplier, 4),
        detail: `${zone.soilSeriesDetail} (factor salud ${zone.soilHealthFactor.toFixed(2)}): capitaliza ${agroImpactPct >= 0 ? "+" : ""}${round(agroImpactPct, 1)}% a ${projectionYears} años.`,
        cagrAnnualPct: zone.cagrAnnualPct,
      },
      marketAppreciation: {
        impactPercentage: round(marketImpactPct, 2),
        multiplier: round(marketMultiplier, 4),
        detail: `Paridad inmobiliaria rural basada en alquiler de ${zone.rentQqSoja.toFixed(1)} qq soja/ha capitalizado a tasa CAIR/BCR (+${round(marketAnnualRate, 2)}% anual compuesto).`,
        annualRatePct: round(marketAnnualRate, 2),
      },
    },
    financialTotals: {
      surfaceHa,
      totalBaseValueUsd: round(totalBaseUsd, 2),
      totalProjectedValueUsd: round(totalProjectedUsd, 2),
      totalCapitalGainUsd: round(totalProjectedUsd - totalBaseUsd, 2),
    },
    auditUrls: AUDIT_URLS,
  };

  return {
    ...valuation,
    contentHash: demoHash(JSON.stringify({ field: field.id, ...valuation })),
  };
}
