export type MetricKind = "derived" | "reanalysis" | "declared";

export interface MetricValue<T = number> {
  value: T | null;
  unit: string;
  sourceId: string;
  kind: MetricKind;
  missingReason?: "clouds" | "no_scene" | "insufficient_coverage" | "provider_error" | "window_incomplete" | string;
}

export type TimelapseLayer = "rgb" | "ndvi" | "weather";

export interface TimelapseAsset {
  layer: "rgb" | "ndvi";
  url: string;
  expiresAt: string;
  resolutionM: number;
  nodata?: string;
  checksum?: string;
  /** [minLng, minLat, maxLng, maxLat] — geographic extent the tile covers */
  bbox?: number[];
}

export interface TimelapseFrameQuality {
  validPixelFraction: number; // e.g. 0.94 (94%)
  validPixelCount: number;
  cloudFraction: number;
}

export interface TimelapseFrame {
  id: string;
  observedAt: string; // ISO UTC: "2025-02-12T14:32:00Z"
  localDate: string;  // "2025-02-12"
  sourceItemIds: string[];
  usable: boolean;
  unusableReason?: string;
  quality: TimelapseFrameQuality;
  ndvi: {
    mean: MetricValue<number>;
    p10: MetricValue<number>;
    p90: MetricValue<number>;
  };
  assets: TimelapseAsset[];
}

export interface WeatherDaily {
  date: string; // "2025-02-12"
  precipitationDay: MetricValue<number>;
  precipitation7d: MetricValue<number>;
  temperatureMin: MetricValue<number>;
  temperatureMax: MetricValue<number>;
}

export interface TimelapseSource {
  id: string;
  provider: string;
  dataset: string;
  documentationUrl?: string;
  resolution?: string;
  attribution: string;
}

export interface TimelapseManifest {
  schemaVersion: "1";
  datasetVersion: string;
  fieldId: string;
  geometryVersion: string;
  from: string;
  to: string;
  generatedAt: string;
  status: "ready" | "partial";
  frames: TimelapseFrame[];
  weatherDaily: WeatherDaily[];
  sources: TimelapseSource[];
}

export interface TimelineState {
  selectedDate: string;
  weather: WeatherDaily | null;
  satellite: TimelapseFrame | null;
  isFresh: boolean;
  ageDays: number | null;
  missingReason?: string;
}

export interface SolanaCertification {
  snapshotHash: string;       // content_hash del snapshot canónico (SHA-256)
  txSignature: string | null; // firma de la tx Memo (null si aún no ancló)
  cluster: string;            // "devnet" | "mainnet-beta" | ...
  slot: number | null;
  blockTime: number | null;
  verified: boolean;          // verify.status === "verified"
  verifyStatus?: "verified" | "tampered" | "pending" | "rpc_unavailable";
  certifiedAt: string | null; // issued_at de la versión
  campaign: string;           // etiqueta de período: "2024→2026" o "2025-04"
  version?: number;
  certUid?: string;
  memoPayload?: string | null; // TERRIA1|v1|<cert_uid>|<hash>|<prev>
  memoProgram: string;
  explorerUrl: string | null;
  isDemo?: boolean;           // datos de demostración (no on-chain)
}
