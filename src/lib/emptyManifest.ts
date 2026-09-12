import { TimelapseManifest } from "@/types/terria";

/**
 * Manifest vacío para antes de que el backend responda (o cuando falla).
 * No es data de demo: la serie queda vacía y la UI muestra "sin datos".
 */
export const EMPTY_TIMELAPSE_MANIFEST: TimelapseManifest = {
  schemaVersion: "1",
  datasetVersion: "empty",
  fieldId: "",
  geometryVersion: "",
  from: "",
  to: "",
  generatedAt: "",
  status: "partial",
  frames: [],
  weatherDaily: [],
  sources: [],
};
