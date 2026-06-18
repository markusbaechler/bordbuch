// src/lib/route.ts
// „Intelligente" Distanzmessung auf dem Wasser: statt Luftlinie (die quer durch
// die Berge laufen kann) ein Weg, der im See bleibt. Vorgehen:
//  1. Punkt-im-See-Test gegen den OSM-Umriss (Ray-Casting).
//  2. Grobes Gitter (~200 m) aller Wasser-Zellen, A*-Suche darauf.
//  3. „String-Pulling": Zwischenpunkte entfernen, solange die Direktlinie im
//     Wasser bleibt → glatter, natürlicher Verlauf.
// Dependency-frei; das Gitter wird beim ersten Aufruf einmalig gebaut und gecacht.

import { LAKE_OUTLINE } from './lake'
import { haversineM } from './geo'

export type LL = [number, number] // [lat, lon]

const LATS = LAKE_OUTLINE.map((p) => p[0])
const LONS = LAKE_OUTLINE.map((p) => p[1])
const BB = {
  s: Math.min(...LATS),
  n: Math.max(...LATS),
  w: Math.min(...LONS),
  e: Math.max(...LONS),
}

// Ray-Casting (lon = x, lat = y).
export function inLake(lat: number, lon: number): boolean {
  let inside = false
  const n = LAKE_OUTLINE.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const yi = LAKE_OUTLINE[i][0]
    const xi = LAKE_OUTLINE[i][1]
    const yj = LAKE_OUTLINE[j][0]
    const xj = LAKE_OUTLINE[j][1]
    const intersect = xi > lon !== xj > lon && lat < ((yj - yi) * (lon - xi)) / (xj - xi) + yi
    if (intersect) inside = !inside
  }
  return inside
}

// Gitterauflösung ~200 m (Längengrad-Schritt kürzer wegen cos(lat)).
const D_LAT = 0.0018
const D_LON = 0.0026

interface Grid {
  rows: number
  cols: number
  water: Uint8Array
}
let grid: Grid | null = null

const ix = (g: Grid, r: number, c: number) => r * g.cols + c
const cellLat = (r: number) => BB.s + r * D_LAT
const cellLon = (c: number) => BB.w + c * D_LON

function buildGrid(): Grid {
  const rows = Math.ceil((BB.n - BB.s) / D_LAT) + 1
  const cols = Math.ceil((BB.e - BB.w) / D_LON) + 1
  const water = new Uint8Array(rows * cols)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (inLake(cellLat(r), cellLon(c))) water[r * cols + c] = 1
    }
  }
  return { rows, cols, water }
}
const getGrid = () => (grid ??= buildGrid())

// Nächste Wasser-Zelle zu einem Punkt (Spiralsuche).
function nearestWater(g: Grid, lat: number, lon: number): number | null {
  const r0 = Math.round((lat - BB.s) / D_LAT)
  const c0 = Math.round((lon - BB.w) / D_LON)
  for (let rad = 0; rad < 40; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue
        const r = r0 + dr
        const c = c0 + dc
        if (r < 0 || c < 0 || r >= g.rows || c >= g.cols) continue
        if (g.water[ix(g, r, c)]) return ix(g, r, c)
      }
    }
  }
  return null
}

const NEIGH = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
]

// Minimal-Heap für A* (klein gehalten).
class MinHeap {
  private a: { i: number; f: number }[] = []
  get size() {
    return this.a.length
  }
  push(i: number, f: number) {
    const a = this.a
    a.push({ i, f })
    let k = a.length - 1
    while (k > 0) {
      const p = (k - 1) >> 1
      if (a[p].f <= a[k].f) break
      ;[a[p], a[k]] = [a[k], a[p]]
      k = p
    }
  }
  pop(): number {
    const a = this.a
    const top = a[0].i
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let k = 0
      for (;;) {
        const l = 2 * k + 1
        const r = l + 1
        let m = k
        if (l < a.length && a[l].f < a[m].f) m = l
        if (r < a.length && a[r].f < a[m].f) m = r
        if (m === k) break
        ;[a[m], a[k]] = [a[k], a[m]]
        k = m
      }
    }
    return top
  }
}

export interface RouteResult {
  path: LL[]
  distanceM: number
  onWater: boolean // false = Fallback Luftlinie (kein Wasserweg gefunden)
}

function straight(a: LL, b: LL): RouteResult {
  return { path: [a, b], distanceM: haversineM(a[0], a[1], b[0], b[1]), onWater: false }
}

// Bleibt die Direktlinie a→b im Wasser? (Abtastung ~120 m)
function segInWater(a: LL, b: LL): boolean {
  const steps = Math.max(2, Math.ceil(haversineM(a[0], a[1], b[0], b[1]) / 120))
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    if (!inLake(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false
  }
  return true
}

function stringPull(pts: LL[]): LL[] {
  if (pts.length <= 2) return pts
  const out: LL[] = [pts[0]]
  let anchor = 0
  for (let i = 2; i < pts.length; i++) {
    if (!segInWater(pts[anchor], pts[i])) {
      out.push(pts[i - 1])
      anchor = i - 1
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

/** Wasserweg zwischen zwei Punkten (oder Luftlinie als Fallback). */
export function routeOnWater(a: LL, b: LL): RouteResult {
  // Direktlinie schon im Wasser? Dann reicht sie.
  if (inLake(a[0], a[1]) && inLake(b[0], b[1]) && segInWater(a, b)) {
    return { path: [a, b], distanceM: haversineM(a[0], a[1], b[0], b[1]), onWater: true }
  }

  const g = getGrid()
  const startI = nearestWater(g, a[0], a[1])
  const goalI = nearestWater(g, b[0], b[1])
  if (startI == null || goalI == null) return straight(a, b)

  const N = g.rows * g.cols
  const gScore = new Float64Array(N).fill(Infinity)
  const came = new Int32Array(N).fill(-1)
  const closed = new Uint8Array(N)
  const goalR = (goalI / g.cols) | 0
  const goalC = goalI % g.cols
  const h = (i: number) =>
    haversineM(cellLat((i / g.cols) | 0), cellLon(i % g.cols), cellLat(goalR), cellLon(goalC))

  const open = new MinHeap()
  gScore[startI] = 0
  open.push(startI, h(startI))
  let found = false
  let guard = 0
  while (open.size && guard++ < 500000) {
    const cur = open.pop()
    if (cur === goalI) {
      found = true
      break
    }
    if (closed[cur]) continue
    closed[cur] = 1
    const r = (cur / g.cols) | 0
    const c = cur % g.cols
    for (const [dr, dc] of NEIGH) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nc < 0 || nr >= g.rows || nc >= g.cols) continue
      const ni = nr * g.cols + nc
      if (!g.water[ni]) continue
      // Diagonalen nicht durch Land-Ecken schneiden.
      if (dr !== 0 && dc !== 0 && !(g.water[r * g.cols + nc] || g.water[nr * g.cols + c])) continue
      const step = haversineM(cellLat(r), cellLon(c), cellLat(nr), cellLon(nc))
      const tentative = gScore[cur] + step
      if (tentative < gScore[ni]) {
        gScore[ni] = tentative
        came[ni] = cur
        open.push(ni, tentative + h(ni))
      }
    }
  }
  if (!found) return straight(a, b)

  // Gitter-Pfad rekonstruieren (Zell-Mittelpunkte), Endpunkte real einsetzen.
  const cells: LL[] = []
  for (let i = goalI; i !== -1; i = came[i]) {
    cells.push([cellLat((i / g.cols) | 0), cellLon(i % g.cols)])
  }
  cells.reverse()
  const raw: LL[] = [a, ...cells, b]
  const path = stringPull(raw)
  let distanceM = 0
  for (let i = 1; i < path.length; i++) {
    distanceM += haversineM(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1])
  }
  return { path, distanceM, onWater: true }
}
