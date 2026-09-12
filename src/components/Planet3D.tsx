"use client";

import React, { useEffect, useRef, useCallback } from "react";
// Use MapLibre GL — 100% open source, no API token required, full Mapbox GL JS compatibility
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { FIELDS_DATA, FieldItem } from "@/data/fieldsData";
import { useFieldTimelapse } from "@/hooks/useFieldTimelapse";
import { generateParcelsGeoJson } from "@/data/backendParcelsGeoJson";
import { ZoomIn, ZoomOut, Info } from "lucide-react";

export interface Planet3DProps {
  embedded?: boolean;
  selectedField?: FieldItem;
  isExpanded?: boolean;
  className?: string;
  onSelectField?: (field: FieldItem) => void;
  onDiveEnd?: () => void;
  timelapse?: ReturnType<typeof useFieldTimelapse>;
  fields?: FieldItem[];
}

// Un solo estilo: relieve/terreno. Topo raster + raster-dem para hillshade y terrain 3D.
const TERRAIN_DEM = "aws-terrarium";
const RELIEF_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: "Terria — Relieve",
  sources: {
    "esri-topo": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 17,
      attribution: "© Esri, USGS, FAO",
    },
    [TERRAIN_DEM]: {
      type: "raster-dem",
      tiles: [
        "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 15,
      encoding: "terrarium",
      attribution: "Terrain: AWS Open Data / Mapzen Terrarium",
    } as maplibregl.RasterDEMSourceSpecification,
  },
  layers: [
    {
      id: "topo-base",
      type: "raster",
      source: "esri-topo",
      minzoom: 0,
      maxzoom: 20,
      paint: {
        "raster-saturation": -0.35,
        "raster-brightness-max": 0.96,
      },
    },
    {
      id: "hillshade",
      type: "hillshade",
      source: TERRAIN_DEM,
      paint: {
        "hillshade-exaggeration": 0.55,
        "hillshade-shadow-color": "#1c3a2e",
        "hillshade-highlight-color": "#fafaf6",
        "hillshade-accent-color": "#8f7550",
        "hillshade-illumination-anchor": "viewport",
      },
    },
  ],
};

const OVERVIEW = { center: [-64.4, -34.6] as [number, number], zoom: 4.9, pitch: 0 };

export default function Planet3D({
  selectedField,
  isExpanded = false,
  className = "",
  onSelectField,
  onDiveEnd,
  timelapse,
  fields,
}: Planet3DProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [showInfo, setShowInfo] = React.useState(false);

  const fieldsList = fields && fields.length > 0 ? fields : FIELDS_DATA;
  const fieldsListRef = useRef(fieldsList);
  const onSelectRef = useRef(onSelectField);
  const onDiveEndRef = useRef(onDiveEnd);
  const diveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    fieldsListRef.current = fieldsList;
    onSelectRef.current = onSelectField;
    onDiveEndRef.current = onDiveEnd;
  });

  // Construct GeoJSON FeatureCollection for field cadastral parcels & crop sectors
  const buildParcelsGeoJson = useCallback(() => {
    const selectedDate = timelapse?.timelineState?.selectedDate || "2024-01-01";
    const activeLayer = (timelapse?.activeLayer as "rgb" | "ndvi" | "weather") || "ndvi";
    return generateParcelsGeoJson(
      selectedDate,
      activeLayer,
      selectedField?.id,
      fieldsList,
      timelapse?.timelineState,
      timelapse?.manifest
    );
  }, [timelapse?.timelineState, timelapse?.activeLayer, timelapse?.manifest, selectedField?.id, fieldsList]);

  // Add parcels layers on map style load
  const addParcelLayers = useCallback(
    (map: maplibregl.Map) => {
      if (!map.isStyleLoaded || !map.isStyleLoaded()) return;
      try {
        const data = buildParcelsGeoJson();
        if (map.getSource("field-parcels")) {
          (map.getSource("field-parcels") as maplibregl.GeoJSONSource).setData(data as any);
          return;
        }

        map.addSource("field-parcels", { type: "geojson", data: data as any });

        map.addLayer({
          id: "cadastre-neighbors-fill",
          type: "fill",
          source: "field-parcels",
          filter: ["==", ["get", "isPortfolio"], false],
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.35 },
        });
        map.addLayer({
          id: "cadastre-neighbors-line",
          type: "line",
          source: "field-parcels",
          filter: ["==", ["get", "isPortfolio"], false],
          paint: { "line-color": "#a7a7a0", "line-width": 1.0, "line-opacity": 0.55 },
        });
        map.addLayer({
          id: "field-perimeter-fill",
          type: "fill",
          source: "field-parcels",
          filter: ["==", ["get", "isPerimeter"], true],
          paint: { "fill-color": "#1c3a2e", "fill-opacity": 0.04 },
        });
        map.addLayer({
          id: "field-parcels-fill",
          type: "fill",
          source: "field-parcels",
          filter: ["all", ["==", ["get", "isPortfolio"], true], ["!=", ["get", "isPerimeter"], true]],
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.78 },
        });
        map.addLayer({
          id: "field-parcels-line",
          type: "line",
          source: "field-parcels",
          filter: ["all", ["==", ["get", "isPortfolio"], true], ["!=", ["get", "isPerimeter"], true]],
          paint: { "line-color": "#1c3a2e", "line-width": 1.4, "line-opacity": 0.7 },
        });
        map.addLayer({
          id: "field-perimeter-line",
          type: "line",
          source: "field-parcels",
          filter: ["==", ["get", "isPerimeter"], true],
          paint: { "line-color": "#12271e", "line-width": 2.4, "line-opacity": 0.95 },
        });
        map.addLayer({
          id: "field-active-halo",
          type: "line",
          source: "field-parcels",
          filter: [
            "all",
            ["==", ["get", "isPortfolio"], true],
            ["==", ["get", "fieldId"], selectedField?.id || ""],
          ],
          paint: { "line-color": "#4a6b46", "line-width": 6.0, "line-opacity": 0.45 },
        });
        map.addLayer({
          id: "field-active-highlight",
          type: "line",
          source: "field-parcels",
          filter: [
            "all",
            ["==", ["get", "isPortfolio"], true],
            ["==", ["get", "fieldId"], selectedField?.id || ""],
          ],
          paint: { "line-color": "#f4f6f2", "line-width": 2.6, "line-opacity": 1.0 },
        });
      } catch (err) {
        console.warn("Failed to add parcel layers:", err);
      }
    },
    [buildParcelsGeoJson, selectedField]
  );

  // Sync GeoJSON when timelapse state changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded || !map.isStyleLoaded()) return;
    try {
      const source = map.getSource("field-parcels") as maplibregl.GeoJSONSource | undefined;
      if (source) source.setData(buildParcelsGeoJson() as any);
      else addParcelLayers(map);
    } catch {
      /* style not ready */
    }
  }, [buildParcelsGeoJson, addParcelLayers]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: RELIEF_STYLE,
      center: OVERVIEW.center,
      zoom: OVERVIEW.zoom,
      pitch: OVERVIEW.pitch,
      maxZoom: 16.5,
      minZoom: 2.2,
      attributionControl: false,
    });
    mapRef.current = map;

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(mapContainerRef.current);

    const applyAtmosphere = () => {
      if (!map.isStyleLoaded || !map.isStyleLoaded()) return;
      try {
        map.setTerrain({ source: TERRAIN_DEM, exaggeration: 2.1 });
      } catch {
        /* raster-dem no disponible — el topo sigue mostrando relieve en 2D */
      }
      try {
        map.setSky({
          "sky-color": "#fafaf6",
          "sky-horizon-blend": 0.6,
          "horizon-color": "#f4f6f2",
          "horizon-fog-blend": 0.08,
          "atmosphere-blend": 0.6,
        } as any);
      } catch { /* noop */ }
      addParcelLayers(map);
    };
    map.on("style.load", applyAtmosphere);
    if (map.isStyleLoaded && map.isStyleLoaded()) applyAtmosphere();

    // Zoom-aware projection: globo de lejos, mercator de cerca
    map.on("zoom", () => {
      try {
        map.setProjection({
          type: map.getZoom() < 5.0 ? "vertical-perspective" : "mercator",
        } as any);
      } catch { /* noop */ }
    });

    map.on("click", (e: maplibregl.MapMouseEvent) => {
      if (!map.isStyleLoaded || !map.isStyleLoaded()) return;
      try {
        const layers = ["field-parcels-fill", "field-perimeter-fill"].filter((l) =>
          map.getLayer(l)
        );
        if (!layers.length) return;
        const feats = map.queryRenderedFeatures(e.point, { layers });
        const f = feats?.[0];
        if (f?.properties?.isPortfolio) {
          const match =
            fieldsListRef.current.find((x) => x.id === f.properties?.fieldId) ??
            FIELDS_DATA.find((x) => x.id === f.properties?.fieldId);
          if (match) onSelectRef.current?.(match);
        }
      } catch { /* noop */ }
    });

    // Cursor estable sobre campos del portfolio — sin popups (evita jitter)
    map.on("mousemove", (e: maplibregl.MapMouseEvent) => {
      if (!map.isStyleLoaded || !map.isStyleLoaded()) return;
      try {
        const layers = ["field-parcels-fill", "field-perimeter-fill", "cadastre-neighbors-fill"].filter(
          (l) => map.getLayer(l)
        );
        if (!layers.length) return;
        const feats = map.queryRenderedFeatures(e.point, { layers });
        const f = feats?.[0];
        const isPortfolio =
          f && (f.properties?.isPortfolio === true || f.properties?.isPortfolio === "true");
        map.getCanvas().style.cursor = isPortfolio ? "pointer" : "";
      } catch { /* noop */ }
    });
    map.on("mouseout", () => {
      map.getCanvas().style.cursor = "";
    });

    return () => {
      ro.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dot markers — un punto + halo por campo
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    fieldsList.forEach((field) => {
      const el = document.createElement("button");
      const isSel = field.id === selectedField?.id;
      el.setAttribute("aria-label", `Ver terreno 3D de ${field.name}`);
      el.style.cssText = `
        position: relative; width: ${isSel ? 20 : 14}px; height: ${isSel ? 20 : 14}px;
        border-radius: 9999px; border: 2.5px solid #f4f6f2; cursor: pointer;
        background: ${isSel ? "#4a6b46" : "#1c3a2e"};
        box-shadow: 0 1px 6px rgba(18,39,30,0.45), 0 0 0 ${isSel ? 7 : 4}px rgba(74,107,70,${isSel ? 0.35 : 0.18});
        transition: transform .18s ease, box-shadow .18s ease;
      `;
      el.onmouseenter = () => (el.style.transform = "scale(1.3)");
      el.onmouseleave = () => (el.style.transform = "scale(1)");
      el.onclick = (ev) => {
        ev.stopPropagation();
        onSelectRef.current?.(field);
      };
      markersRef.current.push(
        new maplibregl.Marker({ element: el }).setLngLat([field.lng, field.lat]).addTo(map)
      );
    });
  }, [fieldsList, selectedField?.id]);

  // Dive cinematográfico al expandir (la escena 3D aparece cuando la cámara aterriza);
  // al colapsar vuelve a la vista general
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (diveTimerRef.current) {
      clearTimeout(diveTimerRef.current);
      diveTimerRef.current = null;
    }

    if (isExpanded && selectedField) {
      map.flyTo({
        center: [selectedField.lng, selectedField.lat],
        zoom: 15.2,
        pitch: 56,
        bearing: -12,
        duration: 1600,
        essential: true,
      });
      const reveal = () => {
        if (diveTimerRef.current) {
          clearTimeout(diveTimerRef.current);
          diveTimerRef.current = null;
        }
        map.off("moveend", reveal);
        onDiveEndRef.current?.();
      };
      map.once("moveend", reveal);
      diveTimerRef.current = setTimeout(reveal, 1900); // red de seguridad
      return () => {
        map.off("moveend", reveal);
        if (diveTimerRef.current) clearTimeout(diveTimerRef.current);
      };
    }
    map.flyTo({ ...OVERVIEW, bearing: 0, pitch: 0, duration: 1400, essential: true });
  }, [isExpanded, selectedField]);

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* Zoom — lo único que flota */}
      <div className="absolute bottom-6 right-4 z-10 flex flex-col gap-1">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Acercar"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-papel/90 text-bosque shadow-sm backdrop-blur-sm transition-colors hover:bg-papel"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Alejar"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-papel/90 text-bosque shadow-sm backdrop-blur-sm transition-colors hover:bg-papel"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
      </div>

      {/* Info mínima colapsable */}
      <div className="absolute bottom-6 left-4 z-10">
        {showInfo && (
          <div className="mb-2 w-44 rounded-xl bg-papel/95 p-3 shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-bosque/70">Relieve</p>
            <div className="mt-2 space-y-1.5 text-[10px] text-bosque/80">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-bosque" /> Campo · clic → 3D
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm bg-oliva" /> Parcela NDVI
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm bg-piedra" /> Catastro lindero
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => setShowInfo((v) => !v)}
          aria-label="Leyenda del mapa"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-papel/80 text-bosque/60 shadow-sm backdrop-blur-sm transition-colors hover:bg-papel hover:text-bosque"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
