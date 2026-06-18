import { describe, it, expect } from 'vitest'
import { inLake, routeOnWater, shoreZoneRing, type LL } from './route'
import { haversineM } from './geo'
import { nearestHarborName } from './mapData'

// Mitten im See (Becken zwischen Ascona-West- und Magadino-Ostufer bzw.
// Ascona–Brissago) – als Stützpunkte für die Wasser-Tests.
const MID_ASCONA_MAGADINO: LL = [46.148, 8.826]
const MID_ASCONA_BRISSAGO: LL = [46.14, 8.756]
const FAR_INLAND: LL = [0, 0] // garantiert ausserhalb des Sees

describe('inLake', () => {
  it('Punkte mitten im See sind drin', () => {
    expect(inLake(...MID_ASCONA_MAGADINO)).toBe(true)
    expect(inLake(...MID_ASCONA_BRISSAGO)).toBe(true)
  })

  it('ein Punkt weit ausserhalb ist draussen', () => {
    expect(inLake(...FAR_INLAND)).toBe(false)
    expect(inLake(47.5, 9.5)).toBe(false) // irgendwo in den Bergen
  })
})

describe('routeOnWater', () => {
  it('verbindet zwei Seepunkte auf dem Wasser, nie kürzer als die Luftlinie', () => {
    const a = MID_ASCONA_MAGADINO
    const b = MID_ASCONA_BRISSAGO
    const r = routeOnWater(a, b)

    expect(r.onWater).toBe(true)
    expect(r.path.length).toBeGreaterThanOrEqual(2)
    // Endpunkte bleiben die echten Eingaben.
    expect(r.path[0]).toEqual(a)
    expect(r.path[r.path.length - 1]).toEqual(b)
    // Ein Wasserweg kann nie kürzer als die direkte Luftlinie sein.
    const straight = haversineM(a[0], a[1], b[0], b[1])
    expect(r.distanceM).toBeGreaterThan(0)
    expect(r.distanceM).toBeGreaterThanOrEqual(straight - 1)
  })

  it('fällt auf Luftlinie zurück, wenn ein Punkt nicht am Wasser liegt', () => {
    const r = routeOnWater(MID_ASCONA_MAGADINO, FAR_INLAND)
    expect(r.onWater).toBe(false)
    expect(r.path).toHaveLength(2)
    expect(r.distanceM).toBeGreaterThan(0)
  })
})

describe('shoreZoneRing', () => {
  it('liefert einen Ring im See, gecacht und gleich lang wie der Umriss', () => {
    const ring = shoreZoneRing(150)
    expect(ring.length).toBeGreaterThan(100)
    // Versatz ins Wasser: die Stützpunkte liegen im See.
    const inside = ring.filter(([lat, lon]) => inLake(lat, lon)).length
    expect(inside / ring.length).toBeGreaterThan(0.8)
    // Cache: identische Referenz beim zweiten Aufruf.
    expect(shoreZoneRing(150)).toBe(ring)
  })
})

describe('nearestHarborName', () => {
  it('findet den Hafen direkt an der Koordinate', () => {
    // Exakt auf Porto Patriziale Ascona.
    expect(nearestHarborName(46.14667, 8.79324)).toBe('Porto Patriziale Ascona')
  })

  it('gibt null zurück, wenn kein Hafen innerhalb maxM liegt', () => {
    expect(nearestHarborName(0, 0)).toBeNull()
  })
})
