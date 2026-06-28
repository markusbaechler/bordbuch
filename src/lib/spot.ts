// src/lib/spot.ts
// Wählt den Wetter-Spot für "Vor der Abfahrt": Liegt die Live-Position auf dem
// Lago Maggiore, folgt der Wind der Position; sonst Heimathafen Ascona.
// Pegel/Wassertemperatur bleiben seeweit (eine hydroStation) – darum erbt der
// Live-Spot die hydroStation von Ascona.

import { ASCONA, type Spot } from "./liveData";

// Grobe Bounding-Box des Sees (CH-Nordbecken bis italienische Seite).
export const LAKE_BBOX = { latMin: 45.78, latMax: 46.2, lonMin: 8.48, lonMax: 8.9 };

export function onLake(lat: number, lon: number): boolean {
  return (
    lat >= LAKE_BBOX.latMin &&
    lat <= LAKE_BBOX.latMax &&
    lon >= LAKE_BBOX.lonMin &&
    lon <= LAKE_BBOX.lonMax
  );
}

// ~0.01°-Raster, damit der Spot nicht bei jedem GPS-Fix wechselt.
export const quant = (v: number) => Math.round(v * 100) / 100;

export function quantLatLon(
  lat: number | null,
  lon: number | null,
): { qlat: number; qlon: number } | null {
  if (lat == null || lon == null) return null;
  return { qlat: quant(lat), qlon: quant(lon) };
}

export interface ResolvedSpot {
  spot: Spot;
  label: string;
  live: boolean;
}

export function resolveSpot(lat: number | null, lon: number | null): ResolvedSpot {
  if (lat != null && lon != null && onLake(lat, lon)) {
    return {
      spot: { lat, lon, hydroStation: ASCONA.hydroStation },
      label: "Live-Position",
      live: true,
    };
  }
  return { spot: ASCONA, label: "Hafen Ascona", live: false };
}
