// src/hooks/useAnchorWatch.ts
// Ankerwache: nimmt die laufenden GPS-Fixes (aus useGeoPosition), misst den
// Abstand zum gesetzten Anker und schlägt Alarm, wenn das Boot den eingestellten
// Radius verlässt. Akku-schonend ohne eigenen Geo-Watch – wird vom bestehenden
// Karten-Watch gefüttert. Anker + Radius + „Wache läuft" liegen in localStorage
// (KEIN Backend, Sheet-Modell ist fix), damit ein Reload die Wache nicht killt.
//
// Bewusst eine „Bildschirm-an-Wache": der Wake Lock hält den Screen wach; ein
// echter Hintergrund-Alarm bei ausgeschaltetem Bildschirm ist im Web nicht
// zuverlässig (dafür braucht es eine native App).

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LatLon } from '../lib/geo'
import {
  evalAnchor,
  nextBreachCount,
  clampRadius,
  BREACH_FIXES,
  DEFAULT_RADIUS_M,
  type AnchorPoint,
  type AnchorStatus,
} from '../lib/anchor'
import { startAlarm, stopAlarm, unlockAlarm } from '../lib/alarmSound'
import { useWakeLock } from './useWakeLock'

const STORAGE_KEY = 'bordbuch-anchor-v1'
const DRIFT_MIN_GAP_MS = 5000 // höchstens alle 5 s einen Drift-Punkt sichern
const DRIFT_MAX_POINTS = 240

export interface AnchorFix {
  lat: number | null
  lon: number | null
  timestamp: number | null
}

export type AnchorUiStatus = AnchorStatus | 'idle'

interface Persisted {
  anchor: AnchorPoint | null
  radiusM: number
  watching: boolean
}

function load(): Persisted {
  const fallback: Persisted = { anchor: null, radiusM: DEFAULT_RADIUS_M, watching: false }
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const p = JSON.parse(raw) as Persisted
    const anchor =
      p.anchor && typeof p.anchor.lat === 'number' && typeof p.anchor.lon === 'number'
        ? { lat: p.anchor.lat, lon: p.anchor.lon, setAt: p.anchor.setAt ?? 0 }
        : null
    return {
      anchor,
      radiusM: clampRadius(p.radiusM ?? DEFAULT_RADIUS_M),
      watching: !!p.watching && !!anchor,
    }
  } catch {
    return fallback
  }
}

export function useAnchorWatch(fix: AnchorFix) {
  const initial = useRef(load()).current
  const [anchor, setAnchor] = useState<AnchorPoint | null>(initial.anchor)
  const [radiusM, setRadiusState] = useState(initial.radiusM)
  const [watching, setWatching] = useState(initial.watching)
  const [status, setStatus] = useState<AnchorUiStatus>(initial.watching ? 'ok' : 'idle')
  const [distanceM, setDistanceM] = useState<number | null>(null)
  const [maxDistanceM, setMaxDistanceM] = useState(0)
  const [driftTrack, setDriftTrack] = useState<LatLon[]>([])
  const [alarm, setAlarm] = useState(false)

  const breachRef = useRef(0)
  const ackRef = useRef(false) // Alarm quittiert → still bis zur Rückkehr in den Radius
  const lastDriftRef = useRef<number | null>(null)

  // Bildschirm wach halten, solange die Wache läuft.
  useWakeLock(watching)

  // Persistenz (Anker/Radius/Wache überleben einen Reload).
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ anchor, radiusM, watching }))
    } catch {
      // localStorage nicht verfügbar – Wache läuft trotzdem, nur ohne Resume.
    }
  }, [anchor, radiusM, watching])

  // Kernschleife: jeden neuen Fix gegen den Anker prüfen.
  useEffect(() => {
    if (!watching || !anchor) return
    const { lat, lon, timestamp } = fix
    if (lat == null || lon == null) return

    const ev = evalAnchor(anchor, lat, lon, radiusM)
    setDistanceM(ev.distanceM)
    setStatus(ev.status)
    setMaxDistanceM((m) => Math.max(m, ev.distanceM))

    const over = ev.status === 'breach'
    breachRef.current = nextBreachCount(breachRef.current, over)
    if (!over) ackRef.current = false // wieder drin → Alarm neu schärfen
    const armed = over && breachRef.current >= BREACH_FIXES
    setAlarm(armed && !ackRef.current)

    // Drift-Spur sichern (ausgedünnt, gegen unbegrenztes Wachstum).
    const now = timestamp ?? 0
    if (lastDriftRef.current == null || now - lastDriftRef.current > DRIFT_MIN_GAP_MS) {
      lastDriftRef.current = now
      setDriftTrack((prev) => {
        const next = [...prev, { lat, lon }]
        return next.length > DRIFT_MAX_POINTS ? next.slice(next.length - DRIFT_MAX_POINTS) : next
      })
    }
  }, [fix, watching, anchor, radiusM])

  // Ton an/aus folgt dem Alarm-Zustand.
  useEffect(() => {
    if (alarm) startAlarm()
    else stopAlarm()
    return () => stopAlarm()
  }, [alarm])

  // Vibration (Android; iOS ignoriert es) – im Takt, solange der Alarm läuft.
  useEffect(() => {
    if (!alarm || typeof navigator === 'undefined' || !navigator.vibrate) return
    const buzz = () => navigator.vibrate([400, 200, 400])
    buzz()
    const id = window.setInterval(buzz, 1500)
    return () => {
      window.clearInterval(id)
      navigator.vibrate?.(0)
    }
  }, [alarm])

  const drop = useCallback((lat: number, lon: number) => {
    unlockAlarm() // läuft im Klick-Handler → schaltet Audio frei
    breachRef.current = 0
    ackRef.current = false
    lastDriftRef.current = null
    setAnchor({ lat, lon, setAt: Date.now() })
    setRadiusState((r) => r) // unverändert
    setWatching(true)
    setStatus('ok')
    setDistanceM(0)
    setMaxDistanceM(0)
    setDriftTrack([{ lat, lon }])
    setAlarm(false)
  }, [])

  const lift = useCallback(() => {
    breachRef.current = 0
    ackRef.current = false
    stopAlarm()
    setWatching(false)
    setAnchor(null)
    setStatus('idle')
    setDistanceM(null)
    setMaxDistanceM(0)
    setDriftTrack([])
    setAlarm(false)
  }, [])

  const setRadius = useCallback((m: number) => setRadiusState(clampRadius(m)), [])

  const acknowledge = useCallback(() => {
    ackRef.current = true
    setAlarm(false)
  }, [])

  return {
    anchor,
    radiusM,
    watching: watching && !!anchor,
    status,
    distanceM,
    maxDistanceM,
    driftTrack,
    alarm,
    drop,
    lift,
    setRadius,
    acknowledge,
  }
}
