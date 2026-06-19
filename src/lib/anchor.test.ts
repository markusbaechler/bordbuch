import { describe, it, expect } from 'vitest'
import {
  evalAnchor,
  nextBreachCount,
  clampRadius,
  WARN_FRACTION,
  MIN_RADIUS_M,
  MAX_RADIUS_M,
  DEFAULT_RADIUS_M,
  type AnchorPoint,
} from './anchor'

const ANCHOR: AnchorPoint = { lat: 46.16, lon: 8.78, setAt: 0 }

// 0.0001° Breite ≈ 11,1 m; wir leiten daraus grobe Nord-Versätze ab.
const north = (deltaDeg: number) => ({ lat: ANCHOR.lat + deltaDeg, lon: ANCHOR.lon })

describe('evalAnchor', () => {
  it('misst die Distanz zum Anker (Haversine)', () => {
    const p = north(0.0009) // ~100 m nördlich
    const { distanceM } = evalAnchor(ANCHOR, p.lat, p.lon, 30)
    expect(distanceM).toBeCloseTo(100, 0)
  })

  it('Position am Anker → ok, Distanz 0', () => {
    const r = evalAnchor(ANCHOR, ANCHOR.lat, ANCHOR.lon, 30)
    expect(r.distanceM).toBeCloseTo(0, 5)
    expect(r.status).toBe('ok')
    expect(r.fraction).toBe(0)
  })

  it('innerhalb des Radius → ok', () => {
    const p = north(0.00009) // ~10 m
    expect(evalAnchor(ANCHOR, p.lat, p.lon, 30).status).toBe('ok')
  })

  it('zwischen WARN_FRACTION und Radius → warn', () => {
    const p = north(0.0002) // ~22 m
    const r = evalAnchor(ANCHOR, p.lat, p.lon, 25) // fraction ~0,89
    expect(r.fraction).toBeGreaterThanOrEqual(WARN_FRACTION)
    expect(r.fraction).toBeLessThan(1)
    expect(r.status).toBe('warn')
  })

  it('ausserhalb des Radius → breach', () => {
    const p = north(0.0005) // ~55 m
    expect(evalAnchor(ANCHOR, p.lat, p.lon, 30).status).toBe('breach')
  })
})

describe('nextBreachCount', () => {
  it('zählt bei Überschreitung hoch', () => {
    expect(nextBreachCount(2, true)).toBe(3)
  })
  it('setzt bei Rückkehr in den Radius zurück', () => {
    expect(nextBreachCount(5, false)).toBe(0)
  })
})

describe('clampRadius', () => {
  it('begrenzt nach unten/oben', () => {
    expect(clampRadius(2)).toBe(MIN_RADIUS_M)
    expect(clampRadius(9999)).toBe(MAX_RADIUS_M)
  })
  it('rundet und lässt gültige Werte durch', () => {
    expect(clampRadius(33.4)).toBe(33)
  })
  it('NaN → Default', () => {
    expect(clampRadius(Number.NaN)).toBe(DEFAULT_RADIUS_M)
  })
})
