// scripts/fetch-poi-candidates.mjs
// Halb-automatische Kuration der Seekarten-POIs.
//
// Holt Kandidaten (Bootstankstellen, Häfen/Marinas, Liege-/Ankerplätze) aus
// OpenStreetMap über die Overpass-API und gibt sie als fertige `mapData`-Zeilen
// im Format  ['Name', lat, lon, 'Detail', 'Website']  aus – gruppiert nach
// Kategorie. Workflow: laufen lassen, Ausgabe SICHTEN (Quatsch/Doppelte raus)
// und die guten Zeilen in `src/lib/mapData.ts` in die passende `mk(...)`-Liste
// einfügen. Bewusst kein automatischer Schreibzugriff – die Liste bleibt kuratiert.
//
// Lauf:  node scripts/fetch-poi-candidates.mjs
// (Node 18+ wegen global fetch; keine npm-Abhängigkeit.)

const ENDPOINT = 'https://overpass-api.de/api/interpreter'

// Ganzer Lago Maggiore (Locarno bis Arona/Stresa) – inkl. italienischer Seite.
const BBOX = { s: 45.74, w: 8.48, n: 46.2, e: 8.88 }

// Lago di Lugano überlappt die Bbox im Südosten → diese Orte rauswerfen.
const LUGANO_PLACES = [
  'Lugano', 'Paradiso', 'Caslano', 'Agno', 'Morcote', 'Vico Morcote', 'Melide',
  'Bissone', 'Maroggia', 'Ponte Tresa', 'Lavena', 'Lavena Ponte Tresa', 'Porto Ceresio',
  'Brusino', 'Brusino Arsizio', 'Riva San Vitale', 'Capolago', 'Campione', 'Gandria',
  'Magliaso', 'Carona', 'Figino',
]

const QUERY = `[out:json][timeout:90][bbox:${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e}];
(
  nwr["waterway"="fuel"];
  nwr["seamark:type"="fuel_station"];
  nwr["amenity"="fuel"]["boat"="yes"];
  nwr["leisure"="marina"];
  nwr["seamark:type"~"harbour|harbour_basin"];
  nwr["seamark:type"~"anchorage|mooring"];
);
out center tags;`

const round5 = (n) => Math.round(n * 1e5) / 1e5

function classify(t) {
  const sea = t['seamark:type'] ?? ''
  if (t.waterway === 'fuel' || sea === 'fuel_station' || t.amenity === 'fuel') return 'fuel'
  if (sea === 'anchorage' || sea === 'mooring') return 'anchor'
  if (t.leisure === 'marina' || sea === 'harbour' || sea === 'harbour_basin') return 'harbor'
  return null
}

const isLugano = (t) => {
  const hay = `${t['addr:city'] ?? ''} ${t.name ?? ''}`.toLowerCase()
  return LUGANO_PLACES.some((p) => hay.includes(p.toLowerCase()))
}

const esc = (s) => String(s).replace(/'/g, "\\'")

function line(t, lat, lon) {
  const name = t.name ?? '(ohne Name)'
  const detail = t['addr:city'] ?? ''
  const website = t.website ?? t['contact:website'] ?? ''
  const parts = [`'${esc(name)}'`, round5(lat), round5(lon)]
  if (detail || website) parts.push(`'${esc(detail)}'`)
  if (website) parts.push(`'${esc(website)}'`)
  return `  [${parts.join(', ')}],`
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'bordbuch-curation/1.0' },
  body: 'data=' + encodeURIComponent(QUERY),
})
if (!res.ok) {
  console.error(`Overpass ${res.status}`)
  process.exit(1)
}
const { elements = [] } = await res.json()

const groups = { fuel: [], harbor: [], anchor: [] }
const seen = new Set()
for (const el of elements) {
  const t = el.tags
  if (!t) continue
  const lat = el.lat ?? el.center?.lat
  const lon = el.lon ?? el.center?.lon
  if (lat == null || lon == null) continue
  const cat = classify(t)
  if (!cat) continue
  if (isLugano(t)) continue
  const key = `${el.type[0]}${el.id}`
  if (seen.has(key)) continue
  seen.add(key)
  groups[cat].push({ t, lat, lon })
}

for (const [cat, items] of Object.entries(groups)) {
  items.sort((a, b) => b.lat - a.lat) // Nord → Süd
  console.log(`\n// ===== ${cat.toUpperCase()} (${items.length}) =====`)
  for (const { t, lat, lon } of items) console.log(line(t, lat, lon))
}
console.log(`\n// Total: ${groups.fuel.length + groups.harbor.length + groups.anchor.length} Kandidaten. Bitte sichten, dann in src/lib/mapData.ts einfügen.`)
