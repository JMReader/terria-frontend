/**
 * Tipos de certificación blockchain TERRIA — espejo del contrato frontend
 * "TERRIA — API Histórica y Certificación (Contrato Frontend) v0.1" §6-7.
 * El backend emite snapshots canónicos (JCS + SHA-256) anclados en Solana devnet.
 */

export type CertificationScope = "campaign" | "month";
export type CertificationStatus =
  | "draft"
  | "pending_anchor"
  | "anchored"
  | "failed"
  | "superseded";
export type VerifyStatus = "verified" | "tampered" | "pending" | "rpc_unavailable";

export interface CertificationAnchor {
  provider: string;
  cluster: string;
  memoPayload: string;
  txSignature: string | null;
  slot: number | null;
  blockTime: string | null;
  status: string;
  explorerUrl: string | null;
}

/** Versión de certificación — `GET /v1/fields/{field_id}/certifications`. */
export interface CertificationVersion {
  id: string;
  fieldId: string;
  version: number;
  certUid: string;
  schemaVersion: string;
  algorithmVersion: string;
  periodFrom: number;
  periodTo: number;
  status: CertificationStatus;
  /** SHA-256 del snapshot canónico (lo que se ancla on-chain). */
  contentHash: string;
  /** Hash de la versión anterior — cadena de "certificación viva". */
  prevContentHash: string | null;
  issuedAt: string | null;
  createdAt: string;
  scope: CertificationScope;
  /** `YYYY-MM` — sólo cuando scope === "month". */
  month: string | null;
  anchor: CertificationAnchor | null;
}

/** `GET /v1/public/certifications/{cert_uid}/verify`. */
export interface CertificationVerify {
  status: VerifyStatus;
  certUid: string;
  fieldId: string;
  version: number;
  expectedHash: string;
  recomputedHash: string;
  onChainMemo: string | null;
  txSignature: string | null;
  explorerUrl: string | null;
}
