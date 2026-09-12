"use client";

import { useEffect, useRef, useState } from "react";
import { SolanaCertification } from "@/types/terria";
import { CertificationVersion, CertificationVerify } from "@/types/certification";
import {
  listFieldCertifications,
  monthlyCertUid,
  toAuditCertification,
  verifyCertification,
} from "@/lib/terriaApi";

export type FieldCertificationState =
  | "loading"
  | "ready"
  | "empty"
  | "error";

export interface FieldCertification {
  state: FieldCertificationState;
  /** View-model listo para `SolanaAuditCard` (solo datos reales del backend). */
  audit: SolanaCertification | null;
  /** Versión vigente: la más reciente anclada (o la última si ninguna ancló). */
  latest: CertificationVersion | null;
  /** Cadena mensual (scope=month) ordenada por mes descendente. */
  monthlyChain: CertificationVersion[];
  verify: CertificationVerify | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INITIAL: FieldCertification = {
  state: "loading",
  audit: null,
  latest: null,
  monthlyChain: [],
  verify: null,
};

/** Meses `YYYY-MM` desde el actual hacia atrás (ventana de sondeo). */
function recentMonths(count = 26): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = 0; i < count; i++) {
    out.push(d.toISOString().slice(0, 7));
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return out;
}

function pickLatest(versions: CertificationVersion[]): CertificationVersion {
  const anchored = versions.filter(
    (v) => v.status === "anchored" && v.anchor?.txSignature
  );
  const pool = anchored.length > 0 ? anchored : versions;
  return pool.reduce((a, b) => (b.version > a.version ? b : a));
}

function monthlyChainOf(versions: CertificationVersion[]): CertificationVersion[] {
  return versions
    .filter((v) => v.scope === "month")
    .sort((a, b) => (b.month ?? "").localeCompare(a.month ?? ""));
}

function readyState(
  latest: CertificationVersion,
  versions: CertificationVersion[],
  verify: CertificationVerify | null
): FieldCertification {
  return {
    state: "ready",
    audit: toAuditCertification(latest, verify),
    latest,
    monthlyChain: monthlyChainOf(versions),
    verify,
  };
}

/**
 * Versión sintética reconstruida desde `/verify` (sondeo rápido): la respuesta
 * trae version, hashes, memo on-chain y tx — suficiente para la auditoría.
 */
function versionFromVerify(
  fieldId: string,
  month: string,
  v: CertificationVerify
): CertificationVersion {
  const memoParts = v.onChainMemo?.split("|") ?? [];
  const prev = memoParts[4];
  return {
    id: v.certUid,
    fieldId,
    version: v.version,
    certUid: v.certUid,
    schemaVersion: "terria.cert/4",
    algorithmVersion: "jcs+sha256/1",
    periodFrom: Number(month.slice(0, 4)),
    periodTo: Number(month.slice(0, 4)),
    status: "anchored",
    contentHash: v.expectedHash,
    prevContentHash: prev && prev !== "-" ? prev : null,
    issuedAt: null,
    createdAt: "",
    scope: "month",
    month,
    anchor: {
      provider: "solana",
      cluster: "devnet",
      memoPayload: v.onChainMemo ?? "",
      txSignature: v.txSignature,
      slot: null,
      blockTime: null,
      status: "confirmed",
      explorerUrl: v.explorerUrl,
    },
  };
}

/**
 * Sondeo rápido del último certificado mensual: los `cert_uid` mensuales son
 * determinísticos (`uuid5(URL, "terria:monthly:{field_id}:{YYYY-MM}")`), así que
 * se prueba `/verify` para cada mes de la ventana — en paralelo — y se queda con
 * el hit más reciente. Evita depender del listado completo, que es lento
 * (N+1 contra Storage), y un waterfall secuencial de ~26 requests.
 */
async function probeLatestMonthly(
  fieldId: string
): Promise<{ version: CertificationVersion; verify: CertificationVerify } | null> {
  const months = recentMonths();
  const uids = await Promise.all(months.map((m) => monthlyCertUid(fieldId, m)));
  if (uids.some((u) => !u)) return null; // sin WebCrypto → el caller usa el listado

  // Los meses vienen ordenados descendente: el primer hit es el más reciente.
  const hits = await Promise.all(
    months.map((month, i) =>
      verifyCertification(uids[i] as string)
        .then((verify) => ({ month, verify }))
        .catch(() => null)
    )
  );
  const hit = hits.find((h) => h !== null);
  if (!hit) return null;
  return { version: versionFromVerify(fieldId, hit.month, hit.verify), verify: hit.verify };
}

/**
 * Certificación blockchain real del campo, en dos etapas:
 *  1) sondeo determinístico del último cert mensual → auditoría en segundos;
 *  2) listado completo `/v1/fields/{id}/certifications` → cadena autoritativa.
 * - id ausente o no-UUID → `empty` (sin fetch, sin datos inventados).
 * - `enabled === false` → queda en loading sin fetchear (p.ej. sheet cerrado).
 */
export function useFieldCertification(
  fieldId: string | undefined,
  opts?: { enabled?: boolean }
): FieldCertification {
  const { enabled = true } = opts ?? {};
  const [cert, setCert] = useState<FieldCertification>(INITIAL);
  const requestRef = useRef(0);
  const isMockId = !fieldId || !UUID_RE.test(fieldId);

  useEffect(() => {
    const requestId = ++requestRef.current;
    queueMicrotask(() => {
      if (requestRef.current === requestId) {
        setCert(isMockId ? { ...INITIAL, state: "empty" } : INITIAL);
      }
    });
    if (isMockId || !enabled || !fieldId) return;

    let cancelled = false;
    const alive = () => !cancelled && requestRef.current === requestId;

    (async () => {
      // Etapa 1 — fast-path: último cert mensual por uid determinístico.
      const probe = probeLatestMonthly(fieldId)
        .then((hit) => {
          if (hit && alive()) {
            setCert(readyState(hit.version, [hit.version], hit.verify));
          }
        })
        .catch(() => {
          /* sondeo indisponible — la etapa 2 cubre */
        });

      // Etapa 2 — listado completo (autoritativo; lento por N+1 del backend).
      // Corre en paralelo al sondeo para no sumar latencias.
      const listing = (async () => {
        try {
          const versions = await listFieldCertifications(fieldId);
          if (!alive()) return;
          if (versions.length === 0) {
            setCert({ ...INITIAL, state: "empty" });
            return;
          }
          const latest = pickLatest(versions);
          let verify: CertificationVerify | null = null;
          try {
            verify = await verifyCertification(latest.certUid);
          } catch {
            /* /verify es best-effort — el badge cae a "pending" */
          }
          if (!alive()) return;
          setCert(readyState(latest, versions, verify));
        } catch {
          if (alive()) {
            setCert((prev) =>
              prev.state === "ready" ? prev : { ...INITIAL, state: "error" }
            );
          }
        }
      })();

      await Promise.all([probe, listing]);
    })();

    return () => {
      cancelled = true;
    };
  }, [fieldId, enabled, isMockId]);

  return cert;
}
