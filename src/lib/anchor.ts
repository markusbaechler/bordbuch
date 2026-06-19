// src/lib/anchor.ts
// Reine Logik der Ankerwache: Distanz zum gesetzten Anker bewerten und die
// Alarm-Entscheidung entprellen. Bewusst dependency-frei und ohne React, damit
// sie testbar bleibt (src/lib/anchor.test.ts). Die zustandsbehaftete
// Verkabelung (GPS-Watch, Wake Lock, Ton) liegt im Hook useAnchorWatch.

import { haversineM } from './geo'

export interface AnchorPoint {
  lat: number
  lon: number
  setAt: number // ms – Zeitpunkt „Anker gesetzt"
}

export type AnchorStatus = 'ok' | 'warn' | 'breach'

export interface AnchorEval {
  distanceM: number
  fraction: number // Distanz ÷ Radius (für Ring-/Warnzustand)
  status: AnchorStatus
}

// Ab 80 % des Radius „gelb" (Vorwarnung), ab 100 % „rot" (Alarm scharf).
export const WARN_FRACTION = 0.8

// So viele aufeinanderfolgende Fixes müssen ausserhalb des Radius liegen, bevor
// der Alarm auslöst – fängt einzelne GPS-Ausreisser ab.
export const BREACH_FIXES = 3

// Sinnvolle Radius-Grenzen (m) für den Einstell-Slider.
export const MIN_RADIUS_M = 15
export const MAX_RADIUS_M = 120
export const DEFAULT_RADIUS_M = 30

export function clampRadius(m: number): number {
  if (Number.isNaN(m)) return DEFAULT_RADIUS_M
  return Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Math.round(m)))
}

/** Distanz und Status einer Position relativ zum Anker. */
export function evalAnchor(
  anchor: AnchorPoint,
  lat: number,
  lon: number,
  radiusM: number,
): AnchorEval {
  const distanceM = haversineM(anchor.lat, anchor.lon, lat, lon)
  const fraction = radiusM > 0 ? distanceM / radiusM : 0
  const status: AnchorStatus =
    fraction >= 1 ? 'breach' : fraction >= WARN_FRACTION ? 'warn' : 'ok'
  return { distanceM, fraction, status }
}

/**
 * Entprell-Zähler fortschreiben: ausserhalb → +1, sonst zurück auf 0. Der Alarm
 * gilt als scharf, sobald der Zähler BREACH_FIXES erreicht.
 */
export function nextBreachCount(prev: number, isOver: boolean): number {
  return isOver ? prev + 1 : 0
}
