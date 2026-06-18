// src/hooks/useTripRecorder.ts
// Zeichnet aus den GPS-Fixes eine Fahrt auf (Track + Live-Kennzahlen). Die
// Aufzeichnung ist opt-in (start/stop) – nur dann werden Punkte gesammelt.
// Akku-schonend: kein eigener Geo-Watch, sondern füttert sich aus dem bereits
// laufenden useGeoPosition (ein Watch für Karte + Tacho + Track).

import { useEffect, useMemo, useRef, useState } from 'react'
import { haversineM, MS_TO_KN, KM_TO_NM } from '../lib/geo'

export interface TrackPoint {
  lat: number
  lon: number
  t: number // ms
  speedMs: number
}

export interface TripStats {
  distanceM: number
  durationMs: number
  avgKn: number
  maxKn: number
}

export interface CurrentFix {
  lat: number | null
  lon: number | null
  speedMs: number | null
  timestamp: number | null
}

export function useTripRecorder(fix: CurrentFix) {
  const [recording, setRecording] = useState(false)
  const [track, setTrack] = useState<TrackPoint[]>([])
  const lastStamp = useRef<number | null>(null)

  // Neue Fixes anhängen, solange aufgezeichnet wird.
  useEffect(() => {
    if (!recording) return
    const { lat, lon, speedMs, timestamp } = fix
    if (lat == null || lon == null || timestamp == null) return
    if (lastStamp.current === timestamp) return // selber Fix
    lastStamp.current = timestamp

    setTrack((prev) => {
      const last = prev[prev.length - 1]
      // Steh-Jitter unterdrücken: <3 m Bewegung bei <0.5 m/s nicht werten.
      if (last) {
        const moved = haversineM(last.lat, last.lon, lat, lon)
        if (moved < 3 && (speedMs == null || speedMs < 0.5)) return prev
      }
      return [...prev, { lat, lon, t: timestamp, speedMs: speedMs ?? 0 }]
    })
  }, [recording, fix])

  const stats: TripStats = useMemo(() => {
    if (track.length < 2) return { distanceM: 0, durationMs: 0, avgKn: 0, maxKn: 0 }
    let distanceM = 0
    let maxMs = 0
    for (let i = 1; i < track.length; i++) {
      distanceM += haversineM(track[i - 1].lat, track[i - 1].lon, track[i].lat, track[i].lon)
      maxMs = Math.max(maxMs, track[i].speedMs)
    }
    const durationMs = track[track.length - 1].t - track[0].t
    const avgMs = durationMs > 0 ? distanceM / (durationMs / 1000) : 0
    return { distanceM, durationMs, avgKn: avgMs * MS_TO_KN, maxKn: maxMs * MS_TO_KN }
  }, [track])

  function start() {
    setTrack([])
    lastStamp.current = null
    setRecording(true)
  }
  function stop() {
    setRecording(false)
  }
  function reset() {
    setRecording(false)
    setTrack([])
    lastStamp.current = null
  }

  return { recording, track, stats, start, stop, reset }
}

// Formatierungs-Helfer für die Anzeige.
export function fmtDistance(distanceM: number): { km: string; nm: string } {
  const km = distanceM / 1000
  return { km: km.toFixed(km < 10 ? 2 : 1), nm: (km * KM_TO_NM).toFixed(1) }
}

export function fmtDuration(durationMs: number): string {
  const s = Math.max(0, Math.floor(durationMs / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`
}
