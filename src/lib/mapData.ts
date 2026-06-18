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

// Häfen / Marinas / Anlegestellen über den ganzen Lago Maggiore (Nordbecken dichter,
// weil Heimatrevier). Erweitert/gepflegt halb-automatisch via
// `scripts/fetch-poi-candidates.mjs` (Overpass → Kandidaten sichten → hier einfügen).
const HARBORS = mk('harbor', [
  // --- Schweizer Nordbecken ---
  ['Porto Minusio', 46.17802, 8.84036, 'Minusio'],
  ['Porto Muralto', 46.1712, 8.80301, 'Muralto / Locarno'],
  ['Porto Campofelice', 46.16636, 8.85518, 'Tenero'],
  ['Porto Regionale di Locarno', 46.16625, 8.80447, 'Locarno', 'http://www.portolocarno.com'],
  ['Centro Nautico Di Domenico', 46.15595, 8.80382, 'Bootscenter Locarno', 'https://www.didomenico.ch/'],
  ['Marina Magadino', 46.14914, 8.85873, 'Gambarogno'],
  ['Porto Patriziale Ascona', 46.14667, 8.79324, 'Heimathafen', 'https://www.portoascona.ch/'],
  ['Porto Apona', 46.13411, 8.72018, 'Brissago'],
  ['Porto Gambarogno', 46.12867, 8.7964, 'Gambarogno'],
  ['Porto Ticino Brissago', 46.12284, 8.71477, 'Brissago', 'https://www.yachtsport-resort.com/'],
  ['Porto alla Resiga', 46.12243, 8.71391, 'Brissago'],
  ['Porto Vecchio Brissago', 46.11807, 8.71046, 'Brissago'],
  // --- Italienische Seite (Ostufer, Nord → Süd) ---
  ['Porto Turistico di Cannobio', 46.06261, 8.70041, 'Cannobio (IT)'],
  ['Porto della Gabella', 46.04534, 8.73346, 'Maccagno (IT)', 'https://www.portolago.com/SpondaLombarda/Maccagno/Porti/PortoDellaGabella.htm'],
  ['Porto della Madonnina', 46.03628, 8.74204, 'Maccagno (IT)', 'https://www.portolago.com/SpondaLombarda/Maccagno/Porti/DescrizionePorto.html'],
  ['Porto di Colmegna', 46.02523, 8.75081, 'Luino (IT)'],
  ['Porto comunale Cannero Riviera', 46.0227, 8.68629, 'Cannero (IT)'],
  ['Porto Portobello', 46.01912, 8.68329, 'Cannero (IT)', 'https://www.nauticabego.com/'],
  ['Porto Marinestar', 45.99722, 8.73211, 'Luino (IT)', 'http://www.marinestar.it'],
  ['Nuovo porto turistico Porto Valtravaglia', 45.96145, 8.67954, 'Porto Valtravaglia (IT)', 'https://www.portolago.com/SpondaLombarda/PortoValtravaglia/Porti/DescrizionePorto.html'],
  ['Porto comunale Caldè', 45.94621, 8.66136, 'Castelveccana (IT)', 'https://www.portolago.com/SpondaLombarda/Calde-Castelveccana/Porti/DescrizionePorto.html'],
  ['Marina Portolabieno', 45.91251, 8.6156, 'Laveno (IT)', 'http://www.portolabieno.com'],
  ['Porto comunale Laveno Mombello', 45.9098, 8.61893, 'Laveno (IT)', 'https://portolago.com/SpondaLombarda/Laveno/Porti/DescrizionePorti.htm'],
  ['Porto di Cerro', 45.89825, 8.59603, 'Cerro (IT)'],
  ['Porto di Ranco', 45.79748, 8.5683, 'Ranco (IT)', 'https://www.autoritadibacino.va.it/'],
  ['Angera – Porto Austriaco', 45.77094, 8.5734, 'Angera (IT)'],
  // --- Italienische Seite (Westufer / Piemont, Nord → Süd) ---
  ['Oggebbio Marina', 45.99094, 8.64856, 'Oggebbio (IT)'],
  ['Porto comunale Ghiffa', 45.9572, 8.61852, 'Ghiffa (IT)', 'https://portolago.com/SpondaPiemontese/Ghiffa/Porti/DescrizionePorto.html'],
  ['Porto comunale Verbania Intra', 45.93443, 8.57413, 'Verbania (IT)', 'https://portolago.com/SpondaPiemontese/Intra/Porti/DescrizionePorto.html'],
  ['Porto turistico Feriolo', 45.92821, 8.48125, 'Baveno (IT)', 'https://portolago.com/SpondaPiemontese/Feriolo/Porti/PontiliGalleggianti.html'],
  ['Porto comunale San Dazio', 45.92058, 8.55356, 'Pallanza (IT)', 'https://portolago.com/SpondaPiemontese/Pallanza/Porti/DescrizionePorto.html'],
  ['Nuovo Porto di Stresa', 45.88365, 8.54349, 'Stresa (IT)', 'https://www.portolago.com/SpondaPiemontese/Stresa/Porti/DescrizionePorti.htm'],
  ['Porto Comunale Belgirate', 45.84253, 8.57348, 'Belgirate (IT)'],
  ['Motonautica Verbano', 45.74757, 8.56646, 'Arona (IT)'],
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

// Bootstankstellen (auf dem See rar). Quelle: OSM (`waterway=fuel`/`seamark`),
// via `scripts/fetch-poi-candidates.mjs`. Namenlose OSM-Punkte sind nach Ort benannt.
const FUEL = mk('fuel', [
  ['Bootstankstelle Tenero', 46.16653, 8.85582, 'Tenero / Gambarogno'],
  ['Bootstankstelle Porto Valtravaglia', 45.96115, 8.67939, 'Porto Valtravaglia (IT)'],
  ['Tankstelle Cantiere Donato', 45.94693, 8.66071, 'Caldè (IT)', 'http://www.cantierenauticodonato.it/'],
  ['Nautica Bego – Tankstelle', 45.92865, 8.56905, 'Verbania (IT)', 'https://www.nauticabego.com/'],
  ['Bootstankstelle Feriolo', 45.9249, 8.48834, 'Baveno (IT)', 'https://portolago.com/SpondaPiemontese/Feriolo/HPFeriolo.htm'],
  ['Bootstankstelle Taroni', 45.89028, 8.52208, 'Stresa (IT)'],
])

// Anker-/Bojenfelder. In OSM für den See nur dünn erfasst (`seamark:type`).
const ANCHOR = mk('anchor', [
  ['Bojen-/Ankerfeld Locarno', 46.17105, 8.80479, 'beim Porto Locarno'],
  ['Ankerplatz Cannero', 46.02427, 8.70664, 'bei den Castelli di Cannero'],
])

// Kuratierte Gesamtliste.
export const CURATED_POIS: Poi[] = [...HARBORS, ...ANCHOR, ...FUEL, ...SIGHTS, ...FOOD]

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
