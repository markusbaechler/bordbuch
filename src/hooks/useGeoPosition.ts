// src/hooks/useGeoPosition.ts
// Live-GPS via Geolocation.watchPosition: Position (für den Karten-Marker) und
// Geschwindigkeit (für den Tacho). Knoten = m/s × 1.94384, km/h = m/s × 3.6.
//
// `coords.speed` ist nicht überall verfügbar (Desktop/manche Browser liefern
// null). In dem Fall schätzen wir die Geschwindigkeit aus der Distanz zwischen
// zwei aufeinanderfolgenden Fixes (Haversine ÷ Zeitdifferenz).

import { useEffect, useRef, useState } from 'react'

const MS_TO_KMH = 3.6
const MS_TO_KN = 1.94384

export interface GeoState {
  lat: number | null
  lon: number | null
  accuracyM: number | null // Genauigkeitsradius in Metern
  headingDeg: number | null
  speedMs: number | null // null, solange noch kein verwertbarer Wert vorliegt
  error: string | null
  supported: boolean
}

const INITIAL: GeoState = {
  lat: null,
  lon: null,
  accuracyM: null,
  headingDeg: null,
  speedMs: null,
  error: null,
  supported: typeof navigator !== 'undefined' && 'geolocation' in navigator,
}

// Distanz zweier Koordinaten in Metern (Haversine).
function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function useGeoPosition(enabled = true): GeoState {
  const [state, setState] = useState<GeoState>(INITIAL)
  // Letzter Fix für die Geschwindigkeits-Schätzung, wenn coords.speed fehlt.
  const lastFix = useRef<{ lat: number; lon: number; t: number } | null>(null)

  useEffect(() => {
    if (!enabled || !INITIAL.supported) return

    const onOk = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy, speed, heading } = pos.coords

      let speedMs = speed != null && !Number.isNaN(speed) ? speed : null
      const prev = lastFix.current
      // Fallback-Schätzung nur über sinnvolle Zeitabstände (≥1 s, ≤30 s).
      if (speedMs == null && prev) {
        const dt = (pos.timestamp - prev.t) / 1000
        if (dt >= 1 && dt <= 30) {
          speedMs = haversineM(prev.lat, prev.lon, latitude, longitude) / dt
        }
      }
      lastFix.current = { lat: latitude, lon: longitude, t: pos.timestamp }

      setState({
        lat: latitude,
        lon: longitude,
        accuracyM: accuracy ?? null,
        headingDeg: heading != null && !Number.isNaN(heading) ? heading : null,
        speedMs,
        error: null,
        supported: true,
      })
    }

    const onErr = (err: GeolocationPositionError) => {
      const msg =
        err.code === err.PERMISSION_DENIED
          ? 'Standort-Freigabe verweigert'
          : err.code === err.POSITION_UNAVAILABLE
            ? 'Position nicht verfügbar'
            : 'Standort-Timeout'
      setState((s) => ({ ...s, error: msg }))
    }

    const id = navigator.geolocation.watchPosition(onOk, onErr, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 15000,
    })
    return () => navigator.geolocation.clearWatch(id)
  }, [enabled])

  return state
}

// Abgeleitete Tacho-Werte (gerundet) – getrennt, damit die UI sie leicht nutzt.
export function speedReadout(speedMs: number | null): { kmh: string; kn: string } {
  if (speedMs == null || speedMs < 0) return { kmh: '–', kn: '–' }
  // GPS-Rauschen im Stand unterdrücken.
  const v = speedMs < 0.3 ? 0 : speedMs
  return { kmh: (v * MS_TO_KMH).toFixed(1), kn: (v * MS_TO_KN).toFixed(1) }
}
