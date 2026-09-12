"use client";

import { useEffect, useRef, useState } from "react";
import { SolanaCertification } from "@/types/terria";
import { CertificationVersion, CertificationVerify } from "@/types/certification";
import {
  certificationHeroUrl,
  certificationPageUrl,
  certificationPdfUrl,
  listFieldCertifications,
  monthlyCertUid,
  toAuditCertification,
  verifyCertification,
} from "@/lib/terriaApi";
import { DEMO_SOLANA_CERTIFICATION } from "@/data/timelapseMockData";

export type FieldCertificationState =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "demo";

export interface FieldCertification {
  state: FieldCertificationState;
  /** View-model listo para `SolanaAuditCard` (real o demo etiquetado). */
  audit: SolanaCertification | null;
  /** Versión vigente: la más reciente anclada (o la última si ninguna ancló). */
  latest: CertificationVersion | null;
  /** Cadena mensual (scope=month) ordenada por mes descendente. */
  monthlyChain: CertificationVersion[];
  verify: CertificationVerify | null;
  pdfUrl: string | null;
  certPageUrl: string | null;
  heroUrl: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INITIAL: FieldCertification = {
  state: "loading",
  audit: null,
  latest: null,
  monthlyChain: [],
  verify: null,
  pdfUrl: null,
  certPageUrl: null,
  heroUrl: null,
};

const DEMO: FieldCertification = {
  ...INITIAL,
  state: "demo",
  audit: DEMO_SOLANA_CERTIFICATION,
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
    pdfUrl: certificationPdfUrl(latest.certUid),
    certPageUrl: certificationPageUrl(latest.certUid),
    heroUrl: certificationHeroUrl(latest.certUid),
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
 * se prueba `/verify` mes a mes hacia atrás hasta el primer hit. Evita depender
 * del listado completo, que es lento (N+1 contra Storage).
 */
async function probeLatestMonthly(
  fieldId: string
): Promise<{ version: CertificationVersion; verify: CertificationVerify } | null> {
  for (const month of recentMonths()) {
    const uid = await monthlyCertUid(fieldId, month);
    if (!uid) return null; // sin WebCrypto → el caller usa el listado
    try {
      const verify = await verifyCertification(uid);
      return { version: versionFromVerify(fieldId, month, verify), verify };
    } catch {
      continue; // mes sin certificación → probar el anterior
    }
  }
  return null;
}

/**
 * Certificación blockchain real del campo, en dos etapas:
 *  1) sondeo determinístico del último cert mensual → auditoría en segundos;
 *  2) listado completo `/v1/fields/{id}/certifications` → cadena autoritativa.
 * - `demo` o id no-UUID (campos del mock) → datos demo etiquetados, sin fetch.
 * - `enabled === false` → queda en loading sin fetchear (p.ej. sheet cerrado).
 */
export function useFieldCertification(
  fieldId: string | undefined,
  opts?: { demo?: boolean; enabled?: boolean }
): FieldCertification {
  const { demo = false, enabled = true } = opts ?? {};
  const [cert, setCert] = useState<FieldCertification>(INITIAL);
  const requestRef = useRef(0);
  const isMockId = !fieldId || !UUID_RE.test(fieldId);

  useEffect(() => {
    const requestId = ++requestRef.current;
    queueMicrotask(() => {
      if (requestRef.current === requestId) {
        setCert(demo || isMockId ? DEMO : INITIAL);
      }
    });
    if (demo || isMockId || !enabled || !fieldId) return;

    let cancelled = false;
    const alive = () => !cancelled && requestRef.current === requestId;

    (async () => {
      // Etapa 1 — fast-path: último cert mensual por uid determinístico.
      try {
        const hit = await probeLatestMonthly(fieldId);
        if (hit && alive()) {
          setCert(readyState(hit.version, [hit.version], hit.verify));
        }
      } catch {
        /* sondeo indisponible — la etapa 2 cubre */
      }

      // Etapa 2 — listado completo (autoritativo; lento por N+1 del backend).
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

    return () => {
      cancelled = true;
    };
  }, [fieldId, demo, enabled, isMockId]);

  return cert;
}
