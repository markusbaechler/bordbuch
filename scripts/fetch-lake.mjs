// scripts/fetch-lake.mjs
// Holt den Umriss des Lago Maggiore (OSM-Multipolygon natural=water) und gibt
// einen vereinfachten Aussenring als Koordinaten-Array aus – für die Uferzonen-
// Anzeige und das Wasser-Routing (Punkt-im-See-Test). Einmalig laufen lassen,
// Ausgabe in src/lib/lake.ts übernehmen.
//
// Lauf:  node scripts/fetch-lake.mjs  >  lake-coords.txt

const ENDPOINT = 'https://overpass-api.de/api/interpreter'
const QUERY = `[out:json][timeout:120];
rel["natural"="water"]["name"~"Maggiore|Verbano"];
out geom;`

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'bordbuch-curation/1.0' },
  body: 'data=' + encodeURIComponent(QUERY),
})
if (!res.ok) { console.error(`Overpass ${res.status}`); process.exit(1) }
const { elements = [] } = await res.json()

const rel = elements.find((e) => e.type === 'relation')
if (!rel) { console.error('Keine Relation gefunden'); process.exit(1) }
console.error(`Relation ${rel.id} "${rel.tags?.name}", members=${rel.members.length}`)

// Aussen-Wege (role=outer) einsammeln; jeder member.geometry = [{lat,lon},...]
const outers = rel.members
  .filter((m) => m.type === 'way' && (m.role === 'outer' || m.role === '') && m.geometry)
  .map((m) => m.geometry.map((g) => [g.lat, g.lon]))

console.error(`outer ways: ${outers.length}, points total: ${outers.reduce((a, w) => a + w.length, 0)}`)

// Wege zu einem Ring zusammenketten (Endpunkte matchen).
const key = (p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`
function stitch(ways) {
  const segs = ways.map((w) => w.slice())
  const ring = segs.shift()
  let guard = 0
  while (segs.length && guard++ < 100000) {
    const tail = ring[ring.length - 1]
    let idx = -1
    let rev = false
    for (let i = 0; i < segs.length; i++) {
      if (key(segs[i][0]) === key(tail)) { idx = i; rev = false; break }
      if (key(segs[i][segs[i].length - 1]) === key(tail)) { idx = i; rev = true; break }
    }
    if (idx < 0) break
    let seg = segs.splice(idx, 1)[0]
    if (rev) seg = seg.reverse()
    ring.push(...seg.slice(1))
  }
  return { ring, leftover: segs.length }
}

const { ring, leftover } = stitch(outers)
console.error(`Ring-Punkte: ${ring.length}, nicht verkettet: ${leftover}`)

// Douglas-Peucker (sphärisch grob, in Grad reicht für die Vereinfachung).
function rdp(points, eps) {
  if (points.length < 3) return points
  let dmax = 0, idx = 0
  const [a, b] = [points[0], points[points.length - 1]]
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], a, b)
    if (d > dmax) { dmax = d; idx = i }
  }
  if (dmax > eps) {
    const left = rdp(points.slice(0, idx + 1), eps)
    const right = rdp(points.slice(idx), eps)
    return left.slice(0, -1).concat(right)
  }
  return [a, b]
}
function perpDist(p, a, b) {
  const [x, y] = [p[1], p[0]], [x1, y1] = [a[1], a[0]], [x2, y2] = [b[1], b[0]]
  const dx = x2 - x1, dy = y2 - y1
  const len2 = dx * dx + dy * dy || 1e-12
  const t = ((x - x1) * dx + (y - y1) * dy) / len2
  const px = x1 + t * dx, py = y1 + t * dy
  return Math.hypot(x - px, y - py)
}

const simplified = rdp(ring, 0.0006) // ~60 m
console.error(`Vereinfacht: ${simplified.length} Punkte`)
console.log(simplified.map((p) => `[${p[0].toFixed(5)}, ${p[1].toFixed(5)}]`).join(',\n'))
