export interface FieldItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  hectares: number;
  ndvi: number;

  // Campos opcionales — no siempre vienen del backend
  code?: string;
  locality?: string;
  province?: string;
  coordinates?: string;
  primaryCrop?: string;
  secondaryCrop?: string;
  suitabilityScore?: number;
  soilSeries?: string;
  rentUsdHa?: number;
  rentQqSoja?: number;
  waterTable?: string;
  irrigation?: boolean;
  tags?: string[];
  description?: string;
  status?: "disponible" | "en_negociacion" | "destacado" | "published" | "draft";

  // Backend-sourced optional fields
  crop?: string;         // alias for primaryCrop from backend
  soilType?: string;     // alias for soilSeries from backend
  aptitude?: string;     // soil aptitude label
  publicSlug?: string;   // TERRIA public URL slug
  ownerId?: string;      // dueño de la parcela (backend owner_id)
  boundary?: {           // Real GeoJSON polygon boundary from backend
    type: string;
    coordinates: number[][][];
  };
}
