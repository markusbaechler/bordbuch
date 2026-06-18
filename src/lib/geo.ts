// src/lib/geo.ts
// Geo-Mathematik für die Seekarte: Distanz, Kurs, Einheiten-Umrechnung.
// Bewusst dependency-frei (kein turf o. Ä.) – für unsere Zwecke reicht Haversine.

export const MS_TO_KMH = 3.6
export const MS_TO_KN = 1.94384
export const KM_TO_NM = 0.539957 // Seemeilen

export type LatLon = { lat: number; lon: number }

const toRad = (d: number) => (d * Math.PI) / 180
const toDeg = (r: number) => (r * 180) / Math.PI

/** Distanz zweier Koordinaten in Metern (Haversine). */
export function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Anfangskurs (rechtweisend, 0–360°) von a nach b. */
export function bearingDeg(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLon = toRad(bLon - aLon)
  const y = Math.sin(dLon) * Math.cos(toRad(bLat))
  const x =
    Math.cos(toRad(aLat)) * Math.sin(toRad(bLat)) -
    Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(dLon)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

const CARDINALS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW']
export const cardinal8 = (deg: number) => CARDINALS[Math.round(deg / 45) % 8]
