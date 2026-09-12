"use client";

import { useEffect, useRef, useState } from "react";
import { FieldItem } from "@/data/fieldsData";
import { LandValuation, ValuationSource } from "@/types/valuation";
import { fetchFieldValuation } from "@/lib/terriaApi";

/**
 * Proyección de valor del campo vía `POST /v1/valuations/5yr` (standalone con
 * centroide + hectáreas del FieldItem). Si el backend no responde la fuente
 * queda en `error` — sin fallback a datos mock.
 *
 * Cachea por `field.id + años` y descarta respuestas viejas si el usuario
 * cambia de campo o mueve el horizonte rápido (race guard por requestId).
 */
export function useFieldValuation(field: FieldItem) {
  const [projectionYears, setProjectionYears] = useState(5);
  const [valuation, setValuation] = useState<LandValuation | null>(null);
  const [source, setSource] = useState<ValuationSource>("loading");

  const cacheRef = useRef(new Map<string, LandValuation>());
  const requestRef = useRef(0);

  useEffect(() => {
    const key = `${field.id}:${projectionYears}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setValuation(cached);
      setSource("live");
      return;
    }

    setValuation(null);
    setSource("loading");

    const requestId = ++requestRef.current;
    const timer = setTimeout(() => {
      fetchFieldValuation({
        name: field.name,
        centroidLat: field.lat,
        centroidLon: field.lng,
        areaHectares: field.hectares,
        projectionYears,
      })
        .then((v) => {
          if (requestId !== requestRef.current) return;
          cacheRef.current.set(key, v);
          setValuation(v);
          setSource("live");
        })
        .catch(() => {
          if (requestId !== requestRef.current) return;
          setValuation(null);
          setSource("error");
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [field, projectionYears]);

  return { valuation, source, projectionYears, setProjectionYears };
}
