// src/lib/mapData.ts
// Kuratierte POI-Liste für die Seekarte (nördliches Lago-Maggiore-Becken, der
// realistische Tagesfahrt-Radius ab Ascona: Locarno/Gambarogno bis Brissago,
// Cannobio, Cannero, Oggebbio).
//
// Bewusste Abkehr von der Live-Overpass-Abfrage: die lieferte zu viel Clutter
// (hunderte Restaurants, jeder Adler der Falconeria als „attraction" …) und
// damit keinen Mehrwert gegenüber Google Maps. Diese Liste ist klein, verlässlich
// und boots-relevant. Koordinaten stammen aus OpenStreetMap (Stand Kuratierung),
// Pflege bei Bedarf von Hand. Attribution Kartenkacheln weiterhin © OSM/OpenSeaMap.

export type CategoryKey = 'harbor' | 'anchor' | 'fuel' | 'food' | 'shop' | 'sights'

export interface Category {
  key: CategoryKey
  label: string
  emoji: string
  color: string // fixe Hex-Farbe (Marker liegen auf Kacheln, nicht auf Surface)
}

// Reihenfolge = Reihenfolge der Filter-Chips. Nur Kategorien mit ≥1 POI werden
// als Chip angezeigt (siehe MapScreen) – leere Kategorien stören nicht.
export const CATEGORIES: Category[] = [
  { key: 'harbor', label: 'Häfen', emoji: '⛵', color: '#1C5C8C' },
  { key: 'anchor', label: 'Ankerplätze', emoji: '⚓', color: '#0C7C82' },
  { key: 'fuel', label: 'Tankstellen', emoji: '⛽', color: '#D8930C' },
  { key: 'food', label: 'Gastro & Bäder', emoji: '🍽️', color: '#C44536' },
  { key: 'shop', label: 'Einkauf', emoji: '🛒', color: '#7A5BA6' },
  { key: 'sights', label: 'Ausflugsziele', emoji: '📷', color: '#15935E' },
]

export const CATEGORY_BY_KEY: Record<CategoryKey, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
) as Record<CategoryKey, Category>

export interface Poi {
  id: string
  lat: number
  lon: number
  name: string
  category: CategoryKey
  detail: string | null // kurzer Zusatz fürs Popup
  website: string | null // klickbarer Link (http(s)://…)
  phone: string | null // klickbar als tel:
}

// Kompakte Definition; `mk` füllt id/Defaults auf.
type PoiDef = [name: string, lat: number, lon: number, detail?: string, website?: string]

function mk(category: CategoryKey, defs: PoiDef[]): Poi[] {
  return defs.map(([name, lat, lon, detail, website], i) => ({
    id: `${category}-${i}`,
    name,
    lat,
    lon,
    category,
    detail: detail ?? null,
    website: website ?? null,
    phone: null,
  }))
}

// Häfen / Marinas / Anlegestellen (boots-relevant, von Ascona aus erreichbar).
const HARBORS = mk('harbor', [
  ['Porto Patriziale Ascona', 46.14667, 8.79324, 'Heimathafen', 'https://www.portoascona.ch/'],
  ['Porto Regionale di Locarno', 46.16625, 8.80447, 'Locarno', 'http://www.portolocarno.com'],
  ['Porto Muralto', 46.1712, 8.80301, 'Muralto / Locarno'],
  ['Porto Minusio', 46.17802, 8.84036, 'Minusio'],
  ['Porto Campofelice', 46.16636, 8.85518, 'Tenero'],
  ['Centro Nautico Di Domenico', 46.15595, 8.80382, 'Bootscenter', 'https://www.didomenico.ch/'],
  ['Marina Magadino', 46.14914, 8.85873, 'Gambarogno'],
  ['Porto Gambarogno', 46.12867, 8.7964, 'Gambarogno'],
  ['Porto Ticino Brissago', 46.12284, 8.71477, 'Brissago', 'https://www.yachtsport-resort.com/'],
  ['Porto alla Resiga', 46.12243, 8.71391, 'Brissago'],
  ['Porto Vecchio Brissago', 46.11807, 8.71046, 'Brissago'],
  ['Porto Turistico di Cannobio', 46.06261, 8.70041, 'Cannobio (IT)'],
  ['Porto comunale Cannero Riviera', 46.0227, 8.68629, 'Cannero (IT)'],
  ['Porto Portobello', 46.01912, 8.68329, 'Cannero (IT)', 'https://www.nauticabego.com/'],
  ['Oggebbio Marina', 45.99094, 8.64856, 'Oggebbio (IT)'],
])

// Ausflugsziele, die man per Boot ansteuert.
const SIGHTS = mk('sights', [
  ['Isole di Brissago', 46.1326, 8.7345, 'Parco Botanico (Inseln)', 'https://www.isoledibrissago.ti.ch/'],
  ['Castelli di Cannero', 46.02365, 8.70531, 'Rocca Vitaliana (Inselburgen)', 'https://terreborromeo.it/castelli-di-cannero'],
  ['Falconeria Locarno', 46.16192, 8.79216, 'Greifvogelschau am Ufer', 'https://www.falconeria.ch/'],
  ['Castello Visconteo', 46.16789, 8.79326, 'Locarno'],
  ['Orrido di Sant’Anna', 46.0612, 8.66847, 'Schlucht bei Cannobio'],
])

// Strandbäder / Beach-Clubs am Wasser (per Boot anfahrbar).
const FOOD = mk('food', [
  ['Lido Locarno', 46.16317, 8.80094, 'Strandbad'],
  ['Shaka Beach', 46.14289, 8.83831, 'Beach-Bar Tenero'],
])

// Kuratierte Gesamtliste. Ankerplätze/Tankstellen bewusst (noch) leer – siehe README:
// für das Nordbecken gibt es in OSM keine verlässlich verorteten Boots-Tankstellen
// oder offiziellen Ankerfelder; das kommt mit recherchierten Daten nach.
export const CURATED_POIS: Poi[] = [...HARBORS, ...SIGHTS, ...FOOD]

// Kategorien, die tatsächlich POIs enthalten (für die Filter-Chips).
export const ACTIVE_CATEGORIES: Category[] = CATEGORIES.filter((c) =>
  CURATED_POIS.some((p) => p.category === c.key),
)

import { haversineM } from './geo'

/**
 * Nächstgelegener Hafen-Name zu einer Position (für „Fahrt ins Logbuch").
 * Gibt null zurück, wenn nichts innerhalb `maxM` liegt.
 */
export function nearestHarborName(lat: number, lon: number, maxM = 1500): string | null {
  let best: { name: string; d: number } | null = null
  for (const p of HARBORS) {
    const d = haversineM(lat, lon, p.lat, p.lon)
    if (!best || d < best.d) best = { name: p.name, d }
  }
  return best && best.d <= maxM ? best.name : null
}
