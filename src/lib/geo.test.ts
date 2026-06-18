import { describe, it, expect } from 'vitest'
import { haversineM, bearingDeg, cardinal8, MS_TO_KN, MS_TO_KMH } from './geo'

describe('haversineM', () => {
  it('Distanz zum selben Punkt ist 0', () => {
    expect(haversineM(46.1467, 8.7932, 46.1467, 8.7932)).toBe(0)
  })

  it('1° Breitengrad ≈ 111 km', () => {
    const d = haversineM(46, 8, 47, 8)
    expect(d).toBeGreaterThan(111_000)
    expect(d).toBeLessThan(111_400)
  })

  it('ist symmetrisch (a→b == b→a)', () => {
    const ab = haversineM(46.14667, 8.79324, 46.13411, 8.72018) // Ascona → Brissago Apona
    const ba = haversineM(46.13411, 8.72018, 46.14667, 8.79324)
    expect(ab).toBeCloseTo(ba, 6)
    // Plausibilitäts-Korridor: ~5–6 km Luftlinie
    expect(ab).toBeGreaterThan(5_000)
    expect(ab).toBeLessThan(6_500)
  })
})

describe('bearingDeg', () => {
  it('liefert die vier Haupt-Himmelsrichtungen', () => {
    expect(bearingDeg(0, 0, 1, 0)).toBeCloseTo(0, 4) // Nord
    expect(bearingDeg(0, 0, 0, 1)).toBeCloseTo(90, 4) // Ost
    expect(bearingDeg(1, 0, 0, 0)).toBeCloseTo(180, 4) // Süd
    expect(bearingDeg(0, 0, 0, -1)).toBeCloseTo(270, 4) // West
  })

  it('normalisiert immer auf 0–360', () => {
    const b = bearingDeg(46.14667, 8.79324, 46.13411, 8.72018)
    expect(b).toBeGreaterThanOrEqual(0)
    expect(b).toBeLessThan(360)
  })
})

describe('cardinal8', () => {
  it('mappt Grad auf den 8-Punkt-Kompass', () => {
    expect(cardinal8(0)).toBe('N')
    expect(cardinal8(45)).toBe('NO')
    expect(cardinal8(90)).toBe('O')
    expect(cardinal8(180)).toBe('S')
    expect(cardinal8(270)).toBe('W')
    expect(cardinal8(350)).toBe('N') // wrap-around
  })
})

describe('Einheiten-Konstanten', () => {
  it('rechnen m/s plausibel um', () => {
    expect(10 * MS_TO_KMH).toBeCloseTo(36)
    expect(1 * MS_TO_KN).toBeCloseTo(1.94384, 4)
  })
})
