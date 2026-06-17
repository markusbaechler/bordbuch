// src/lib/mapData.ts
// POI-Client für die Seekarte. Quelle ist OpenStreetMap live über die Overpass-API
// (keylos, CORS) – keine eigene Liste, sondern selbst-aktualisierend. Die Region
// (Nord-Lago-Maggiore, Locarno/Ascona) ist fix; das Ergebnis wird gecacht
// (Modul-Speicher + sessionStorage mit TTL), damit Overpass nicht bei jedem
// Tab-Wechsel erneut belastet wird.
//
// Fokus „mit dem Boot erreichbar": Rein nautische POIs (Häfen, Stege, Ankerplätze,
// Bojen, Bootstankstellen) werden im ganzen Seegebiet gesucht. Die „weichen"
// Kategorien (Gastro, Einkauf, Ausflugsziele) NUR in einem schmalen Uferband um
// den See (Overpass `around` auf das Seepolygon) – so fällt die ganze Orts-Clutter
// im Landesinneren weg. (Ein echtes „ausschliesslich per Boot"-Tag gibt es in OSM
// nicht; das Uferband ist der bestmögliche Proxy.)
//
// Attribution: © OpenStreetMap-Mitwirkende (in der Karte als Leaflet-Attribution).

// Bounding-Box Nord-Lago-Maggiore: Locarno/Ascona/Brissago bis Cannobio/Luino.
// Reihenfolge: süd, west, nord, ost.
const BBOX = { s: 45.9, w: 8.62, n: 46.2, e: 8.92 } as const

// Uferband-Breiten (m) für die „weichen" Kategorien. Eng = nur die erste Reihe
// am Wasser (boots-/anlegerelevant), nicht die zweite Häuserzeile.
const SHORE_NEAR = 80 // Gastro, Einkauf (direkt am Wasser)
const SHORE_WIDE = 250 // Strandbäder, Ausflugsziele (Parks, Inseln, Burgen)

export type CategoryKey = 'harbor' | 'fuel' | 'food' | 'anchor' | 'shop' | 'sights'

export interface Category {
  key: CategoryKey
  label: string
  emoji: string
  color: string // fixe Hex/Token-Farbe (Marker liegen auf Kacheln, nicht auf Surface)
}

// Reihenfolge = Reihenfolge der Filter-Chips. Farben bewusst kräftig & unterscheidbar.
export const CATEGORIES: Category[] = [
  { key: 'harbor', label: 'Häfen & Stege', emoji: '⛵', color: '#1C5C8C' },
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
  detail: string | null // z. B. Adresse oder Unterkategorie für das Popup
  website: string | null // klickbarer Link (normalisiert auf http(s)://…)
  phone: string | null // klickbar als tel:
}

// ---------------------------------------------------------------------------
// Overpass-Abfrage
// ---------------------------------------------------------------------------

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

// Eine kombinierte Abfrage. Zuerst das Seepolygon (.lake) bestimmen, dann:
//  - nautische POIs ohne Uferfilter (liegen ohnehin am/im Wasser, sind selten)
//  - „weiche" POIs nur `around` dem Seeufer (boots-/anlegerelevant)
// `nwr` = Nodes/Ways/Relations; `out center tags` liefert für Flächen den
// Mittelpunkt + Tags.
const OVERPASS_QUERY = `
[out:json][timeout:60][bbox:${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e}];
nwr["natural"="water"]["name"~"Maggiore|Verbano"]->.lake;
(
  nwr["leisure"="marina"];
  nwr["amenity"="ferry_terminal"];
  nwr["seamark:type"~"harbour|harbour_basin|berth"];
  nwr["waterway"="fuel"];
  nwr["seamark:type"~"anchorage|mooring"];
  nwr["amenity"~"restaurant|cafe|bar|biergarten|ice_cream"](around.lake:${SHORE_NEAR});
  nwr["shop"~"supermarket|convenience|bakery|kiosk|deli|greengrocer"](around.lake:${SHORE_NEAR});
  nwr["leisure"~"beach_resort|swimming_area"](around.lake:${SHORE_WIDE});
  nwr["natural"="beach"](around.lake:${SHORE_WIDE});
  nwr["tourism"~"attraction|viewpoint|museum|garden|zoo"](around.lake:${SHORE_WIDE});
  nwr["historic"~"castle|fort|monument|ruins"](around.lake:${SHORE_WIDE});
);
out center tags;
`.trim()

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

// Ordnet ein OSM-Element genau einer Kategorie zu (Priorität von oben nach unten).
function classify(tags: Record<string, string>): CategoryKey | null {
  const sea = tags['seamark:type'] ?? ''

  if (tags.waterway === 'fuel') return 'fuel'
  if (sea === 'anchorage' || sea === 'mooring') return 'anchor'
  if (
    tags.leisure === 'marina' ||
    tags.amenity === 'ferry_terminal' ||
    sea === 'harbour' ||
    sea === 'harbour_basin' ||
    sea === 'berth'
  )
    return 'harbor'
  if (
    ['restaurant', 'cafe', 'bar', 'biergarten', 'ice_cream'].includes(tags.amenity) ||
    tags.leisure === 'beach_resort' ||
    tags.leisure === 'swimming_area' ||
    tags.natural === 'beach'
  )
    return 'food'
  if (['supermarket', 'convenience', 'bakery', 'kiosk', 'deli', 'greengrocer'].includes(tags.shop))
    return 'shop'
  if (
    ['attraction', 'viewpoint', 'museum', 'garden', 'zoo'].includes(tags.tourism) ||
    tags.historic
  )
    return 'sights'
  return null
}

// Lesbarer Name mit Fallback auf die Unterkategorie (z. B. „Restaurant").
function nameOf(tags: Record<string, string>, category: CategoryKey): string {
  if (tags.name) return tags.name
  const fallback: Record<CategoryKey, string> = {
    harbor: 'Hafen / Steg',
    fuel: 'Bootstankstelle',
    food: 'Gastronomie / Strandbad',
    anchor: 'Ankerplatz',
    shop: 'Einkauf',
    sights: 'Sehenswürdigkeit',
  }
  return fallback[category]
}

// Kurzdetail fürs Popup: Adresse, sonst der konkrete OSM-Typ.
function detailOf(tags: Record<string, string>): string | null {
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ')
  const place = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ')
  const addr = [street, place].filter(Boolean).join(', ')
  if (addr) return addr
  return tags.amenity ?? tags.shop ?? tags.tourism ?? tags.leisure ?? tags.historic ?? null
}

// Website-Link aus den üblichen Tags, normalisiert auf http(s)://…
function websiteOf(tags: Record<string, string>): string | null {
  const raw = tags.website ?? tags['contact:website'] ?? tags.url ?? tags['contact:url'] ?? null
  if (!raw) return null
  const url = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw.replace(/^\/+/, '')
  // Nur plausible URLs durchlassen.
  return /\./.test(url) ? url : null
}

function phoneOf(tags: Record<string, string>): string | null {
  return tags.phone ?? tags['contact:phone'] ?? tags['contact:mobile'] ?? null
}

function parse(elements: OverpassElement[]): Poi[] {
  const seen = new Set<string>()
  const pois: Poi[] = []
  for (const el of elements) {
    const tags = el.tags
    if (!tags) continue
    const lat = el.lat ?? el.center?.lat
    const lon = el.lon ?? el.center?.lon
    if (lat == null || lon == null) continue
    const category = classify(tags)
    if (!category) continue
    const id = `${el.type[0]}${el.id}`
    if (seen.has(id)) continue
    seen.add(id)
    pois.push({
      id,
      lat,
      lon,
      name: nameOf(tags, category),
      category,
      detail: detailOf(tags),
      website: websiteOf(tags),
      phone: phoneOf(tags),
    })
  }
  return pois
}

// ---------------------------------------------------------------------------
// Caching (Modul-Speicher + sessionStorage), TTL 12 h
// ---------------------------------------------------------------------------

// Schema-/Abfrage-Version im Key: bei Änderungen alten Cache automatisch verwerfen.
const CACHE_KEY = 'bordbuch.pois.v3'
const TTL_MS = 12 * 60 * 60 * 1000

interface CacheEntry {
  ts: number
  pois: Poi[]
}

let memoryCache: CacheEntry | null = null
let inflight: Promise<Poi[]> | null = null

function readSession(): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CacheEntry
  } catch {
    return null
  }
}

function writeSession(entry: CacheEntry): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    /* Speicher voll / privat – Cache ist optional. */
  }
}

const fresh = (entry: CacheEntry | null, now: number): entry is CacheEntry =>
  !!entry && now - entry.ts < TTL_MS

/**
 * POIs für die Region laden. Liefert gecachte Daten sofort, solange sie frisch
 * sind; parallele Aufrufe (z. B. StrictMode-Doppelmount) teilen sich einen Fetch.
 * `now` ist injizierbar für Tests; Default = aktuelle Zeit.
 */
export async function fetchPois(now: number = Date.now()): Promise<Poi[]> {
  if (fresh(memoryCache, now)) return memoryCache.pois

  const session = readSession()
  if (fresh(session, now)) {
    memoryCache = session
    return session.pois
  }

  if (inflight) return inflight

  inflight = (async () => {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(OVERPASS_QUERY),
    })
    if (!res.ok) throw new Error(`Overpass ${res.status}`)
    const json = (await res.json()) as { elements?: OverpassElement[] }
    const pois = parse(json.elements ?? [])
    const entry: CacheEntry = { ts: now, pois }
    memoryCache = entry
    writeSession(entry)
    return pois
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}
