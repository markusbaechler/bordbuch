// src/hooks/useGeoPosition.ts
// Live-GPS via Geolocation.watchPosition: Position (Karten-Marker) und
// Geschwindigkeit (Tacho). Knoten = m/s × 1.94384, km/h = m/s × 3.6.
//
// Akku: Der Watch läuft nur, solange dieser Hook gemountet ist (= Karten-Tab
// offen) UND der Tab/Screen sichtbar ist. Wird der Bildschirm ausgeschaltet
// oder die App in den Hintergrund geschoben (Page-Visibility = hidden), stoppt
// der Watch automatisch und startet beim Zurückkehren neu. So zieht das
// stromhungrige `enableHighAccuracy` nur, wenn man tatsächlich auf die Karte schaut.
//
// `coords.speed` fehlt auf vielen Geräten (Desktop) → dann schätzen wir die
// Geschwindigkeit aus zwei Fixes (Haversine ÷ dt).

import { useEffect, useRef, useState } from 'react'
import { haversineM, MS_TO_KMH, MS_TO_KN } from '../lib/geo'

export interface GeoState {
  lat: number | null
  lon: number | null
  accuracyM: number | null // Genauigkeitsradius in Metern
  headingDeg: number | null
  speedMs: number | null // null, solange noch kein verwertbarer Wert vorliegt
  timestamp: number | null // ms (für Track-Aufzeichnung)
  error: string | null
  supported: boolean
}

const SUPPORTED = typeof navigator !== 'undefined' && 'geolocation' in navigator

const INITIAL: GeoState = {
  lat: null,
  lon: null,
  accuracyM: null,
  headingDeg: null,
  speedMs: null,
  timestamp: null,
  error: null,
  supported: SUPPORTED,
}

export function useGeoPosition(enabled = true): GeoState {
  const [state, setState] = useState<GeoState>(INITIAL)
  // Letzter Fix für die Geschwindigkeits-Schätzung, wenn coords.speed fehlt.
  const lastFix = useRef<{ lat: number; lon: number; t: number } | null>(null)

  useEffect(() => {
    if (!enabled || !SUPPORTED) return

    let watchId: number | null = null

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
        timestamp: pos.timestamp,
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

    const start = () => {
      if (watchId != null) return
      lastFix.current = null // nach Pause neu schätzen
      watchId = navigator.geolocation.watchPosition(onOk, onErr, {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 15000,
      })
    }
    const stop = () => {
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId)
        watchId = null
      }
    }

    // Akku: bei verstecktem Tab/Screen pausieren.
    const onVisibility = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVisibility)
    if (!document.hidden) start()

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
    }
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
