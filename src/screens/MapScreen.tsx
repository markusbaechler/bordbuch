// src/screens/MapScreen.tsx
// Interaktive Seekarte für den Lago Maggiore:
//  - OSM-Basiskacheln + OpenSeaMap-Seezeichen-Overlay
//  - kuratierte, boots-relevante POIs (Filter als Dropdown)
//  - GPS-Position + Tacho + Standort-Hilfe (Android-Freigabe)
//  - Fahrtaufzeichnung → Logbuch
//  - Mess-/Planungstool MIT Wasser-Routing (kein Geradeaus durch die Berge)
//  - Wetter/Regen + Wind über den ganzen See (mehrere Messpunkte)
//  - See-Regeln/Zonen (Uferlinie + Naturschutz), nur wenn aktiviert
// Leaflet ist eine bewusste Ausnahme von „keine neuen Deps".

import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useGeoPosition, speedReadout } from '../hooks/useGeoPosition'
import { useTripRecorder, fmtDistance, fmtDuration } from '../hooks/useTripRecorder'
import { useAnchorWatch } from '../hooks/useAnchorWatch'
import { MIN_RADIUS_M, MAX_RADIUS_M, type AnchorStatus } from '../lib/anchor'
import { haversineM, bearingDeg, cardinal8, KM_TO_NM, MS_TO_KN } from '../lib/geo'
import { routeOnWater, shoreZoneRing } from '../lib/route'
import { LAKE_OUTLINE } from '../lib/lake'
import {
  ACTIVE_CATEGORIES,
  CATEGORY_BY_KEY,
  CURATED_POIS,
  nearestHarborName,
  type Category,
  type CategoryKey,
  type Poi,
} from '../lib/mapData'
import { ZONES, LAKE_RULES } from '../lib/zones'
import { fetchLakeConditions, weatherEmoji, type LakeCondition } from '../lib/liveData'
import { Modal } from '../components/Modal'
import { WeatherReport } from '../components/WeatherReport'
import type { EntryDraft } from './FormScreen'

const CENTER: L.LatLngTuple = [46.13, 8.78]
const START_ZOOM = 12
const COND = "'Barlow Condensed', sans-serif"

// Ringfarbe der Ankerwache je Status (Teal ok / Amber Vorwarnung / Rot Alarm).
const RING_COLOR: Record<AnchorStatus, string> = {
  ok: '#0C7C82',
  warn: '#E8930C',
  breach: '#D8352A',
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

const iconCache = new Map<CategoryKey, L.DivIcon>()
function iconFor(cat: Category): L.DivIcon {
  let icon = iconCache.get(cat.key)
  if (!icon) {
    icon = L.divIcon({
      className: '',
      html: `<div class="poi-pin" style="background:${cat.color}">${cat.emoji}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    })
    iconCache.set(cat.key, icon)
  }
  return icon
}

const gpsIcon = L.divIcon({
  className: '',
  html: '<div class="gps-dot"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const anchorIcon = L.divIcon({
  className: '',
  html: '<div class="anchor-pin">⚓</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

// Wind-Pfeil (zeigt, wohin der Wind weht = dir+180) + Stärke.
function windIcon(c: LakeCondition): L.DivIcon {
  return L.divIcon({
    className: '',
    html:
      `<div class="wind-arrow"><svg width="22" height="22" viewBox="0 0 24 24" style="transform:rotate(${c.dirDeg + 180}deg)">` +
      `<path d="M12 3 L12 21 M12 3 L8 9 M12 3 L16 9" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>` +
      `<b>${c.windKn}</b></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

type PermState = 'granted' | 'prompt' | 'denied' | 'unknown'

export function MapScreen({ onLogTrip }: { onLogTrip: (draft: EntryDraft) => void }) {
  const elRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const poiLayerRef = useRef<L.LayerGroup | null>(null)
  const zonesLayerRef = useRef<L.LayerGroup | null>(null)
  const windLayerRef = useRef<L.LayerGroup | null>(null)
  const measureLayerRef = useRef<L.LayerGroup | null>(null)
  const meMarkerRef = useRef<L.Marker | null>(null)
  const meCircleRef = useRef<L.Circle | null>(null)
  const trackLineRef = useRef<L.Polyline | null>(null)
  const anchorMarkerRef = useRef<L.Marker | null>(null)
  const anchorCircleRef = useRef<L.Circle | null>(null)
  const driftLineRef = useRef<L.Polyline | null>(null)
  const measuringRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [follow, setFollow] = useState(false)

  const [measuring, setMeasuring] = useState(false)
  const [measurePts, setMeasurePts] = useState<L.LatLngTuple[]>([])
  const [showRules, setShowRules] = useState(false)
  const [showWind, setShowWind] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [showWeather, setShowWeather] = useState(false)
  const [showAnchor, setShowAnchor] = useState(false)
  const [keepGeoAlive, setKeepGeoAlive] = useState(false)
  const [conditions, setConditions] = useState<LakeCondition[] | null>(null)
  const [permState, setPermState] = useState<PermState>('unknown')
  const [showGeoHelp, setShowGeoHelp] = useState(false)

  // Bei aktiver Ankerwache läuft der GPS-Watch auch im Hintergrund weiter.
  const geo = useGeoPosition(true, keepGeoAlive)
  const fix = useMemo(
    () => ({ lat: geo.lat, lon: geo.lon, speedMs: geo.speedMs, timestamp: geo.timestamp }),
    [geo.lat, geo.lon, geo.speedMs, geo.timestamp],
  )
  const trip = useTripRecorder(fix)
  const anchor = useAnchorWatch(fix)

  // Keep-Alive des GPS-Watch an die Wache koppeln (ein Render Verzug ist ok).
  useEffect(() => {
    setKeepGeoAlive(anchor.watching)
  }, [anchor.watching])

  const [active, setActive] = useState<Set<CategoryKey>>(
    () => new Set(ACTIVE_CATEGORIES.map((c) => c.key)),
  )

  // --- Karte initialisieren ---------------------------------------------------
  useEffect(() => {
    if (mapRef.current || !elRef.current) return

    const map = L.map(elRef.current, {
      center: CENTER,
      zoom: START_ZOOM,
      zoomControl: false,
      attributionControl: true,
    })
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map)
    L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
      maxZoom: 18,
      opacity: 0.85,
      attribution: '© OpenSeaMap',
    }).addTo(map)

    zonesLayerRef.current = L.layerGroup().addTo(map)
    poiLayerRef.current = L.layerGroup().addTo(map)
    windLayerRef.current = L.layerGroup().addTo(map)
    measureLayerRef.current = L.layerGroup().addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!measuringRef.current) return
      const ll: L.LatLngTuple = [e.latlng.lat, e.latlng.lng]
      setMeasurePts((prev) => (prev.length >= 2 ? [ll] : [...prev, ll]))
    })
    map.on('dragstart', () => setFollow(false))

    // Default-Ansicht: der ganze Lago Maggiore (nicht der Standort).
    const lakeBounds = L.latLngBounds(LAKE_OUTLINE as L.LatLngExpression[])
    map.fitBounds(lakeBounds, { padding: [12, 12] })

    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(elRef.current)
    requestAnimationFrame(() => {
      map.invalidateSize()
      map.fitBounds(lakeBounds, { padding: [12, 12] })
    })

    setReady(true)
    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      poiLayerRef.current = null
      zonesLayerRef.current = null
      windLayerRef.current = null
      measureLayerRef.current = null
      meMarkerRef.current = null
      meCircleRef.current = null
      trackLineRef.current = null
      anchorMarkerRef.current = null
      anchorCircleRef.current = null
      driftLineRef.current = null
      setReady(false)
    }
  }, [])

  // Wetter/Wind über den See laden.
  useEffect(() => {
    let alive = true
    fetchLakeConditions()
      .then((c) => alive && setConditions(c))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  // Standort-Berechtigungsstatus beobachten (für die Freigabe-Hilfe).
  useEffect(() => {
    if (!('permissions' in navigator)) return
    let status: PermissionStatus | null = null
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((p) => {
        status = p
        setPermState(p.state as PermState)
        p.onchange = () => setPermState(p.state as PermState)
      })
      .catch(() => undefined)
    return () => {
      if (status) status.onchange = null
    }
  }, [])

  // --- POI-Marker je nach Filter ---------------------------------------------
  useEffect(() => {
    const layer = poiLayerRef.current
    if (!ready || !layer) return
    layer.clearLayers()
    for (const poi of CURATED_POIS) {
      if (!active.has(poi.category)) continue
      const cat = CATEGORY_BY_KEY[poi.category]
      L.marker([poi.lat, poi.lon], { icon: iconFor(cat), title: poi.name })
        .bindPopup(popupHtml(poi, cat))
        .addTo(layer)
    }
  }, [ready, active])

  // --- See-Regeln/Zonen (nur wenn aktiviert) ---------------------------------
  useEffect(() => {
    const layer = zonesLayerRef.current
    if (!ready || !layer) return
    layer.clearLayers()
    if (!showRules) return
    // Uferzone: Band zwischen Küstenlinie und der 150-m-Linie (ins Wasser versetzt).
    const inner = shoreZoneRing(150)
    L.polygon([LAKE_OUTLINE, inner] as L.LatLngExpression[][], {
      stroke: false,
      fillColor: '#0C7C82',
      fillOpacity: 0.16,
    })
      .bindPopup('<div class="poi-popup"><strong>Uferzone (150 m)</strong><br><span class="poi-popup-sub">Innerhalb 150 m vom Ufer: max. 10 km/h, kein Wasserski.</span></div>')
      .addTo(layer)
    // Die 150-m-Grenzlinie selbst.
    L.polyline(inner, { color: '#0C7C82', weight: 2, opacity: 0.9, dashArray: '5 4' }).addTo(layer)
    for (const z of ZONES) {
      L.polygon(z.polygon, {
        color: '#D8352A',
        weight: 1.5,
        dashArray: '5 4',
        fillColor: '#D8352A',
        fillOpacity: 0.18,
      })
        .bindPopup(`<div class="poi-popup"><strong>⚠ ${z.name}</strong><br><span class="poi-popup-sub">${z.note}</span></div>`)
        .addTo(layer)
    }
  }, [ready, showRules])

  // --- Wind-Feld (mehrere Punkte, nur wenn aktiviert) ------------------------
  useEffect(() => {
    const layer = windLayerRef.current
    if (!ready || !layer) return
    layer.clearLayers()
    if (!showWind || !conditions) return
    for (const c of conditions) {
      L.marker([c.lat, c.lon], { icon: windIcon(c), interactive: false, keyboard: false }).addTo(layer)
    }
  }, [ready, showWind, conditions])

  // --- GPS-Marker + Kreis ----------------------------------------------------
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || geo.lat == null || geo.lon == null) return
    const pos: L.LatLngTuple = [geo.lat, geo.lon]
    if (!meMarkerRef.current) {
      meMarkerRef.current = L.marker(pos, { icon: gpsIcon, zIndexOffset: 1000 }).addTo(map)
    } else {
      meMarkerRef.current.setLatLng(pos)
    }
    if (geo.accuracyM != null) {
      if (!meCircleRef.current) {
        meCircleRef.current = L.circle(pos, {
          radius: geo.accuracyM,
          color: '#1C5C8C',
          weight: 1,
          fillColor: '#1C5C8C',
          fillOpacity: 0.12,
        }).addTo(map)
      } else {
        meCircleRef.current.setLatLng(pos).setRadius(geo.accuracyM)
      }
    }
    if (follow) map.panTo(pos, { animate: true })
  }, [ready, geo.lat, geo.lon, geo.accuracyM, follow])

  // --- Track-Linie -----------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const latlngs = trip.track.map((p) => [p.lat, p.lon] as L.LatLngTuple)
    if (!trackLineRef.current) {
      trackLineRef.current = L.polyline(latlngs, { color: '#1C5C8C', weight: 4, opacity: 0.85 }).addTo(map)
    } else {
      trackLineRef.current.setLatLngs(latlngs)
    }
  }, [ready, trip.track])

  // --- Ankerwache: Anker-Pin + Radiuskreis + Drift-Spur ----------------------
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const a = anchor.anchor
    if (!a) {
      anchorMarkerRef.current?.remove()
      anchorCircleRef.current?.remove()
      driftLineRef.current?.remove()
      anchorMarkerRef.current = null
      anchorCircleRef.current = null
      driftLineRef.current = null
      return
    }
    const pos: L.LatLngTuple = [a.lat, a.lon]
    const color = anchor.status === 'idle' ? RING_COLOR.ok : RING_COLOR[anchor.status]

    if (!anchorMarkerRef.current) {
      anchorMarkerRef.current = L.marker(pos, { icon: anchorIcon, zIndexOffset: 800 }).addTo(map)
    } else {
      anchorMarkerRef.current.setLatLng(pos)
    }
    if (!anchorCircleRef.current) {
      anchorCircleRef.current = L.circle(pos, {
        radius: anchor.radiusM,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.1,
      }).addTo(map)
    } else {
      anchorCircleRef.current.setLatLng(pos).setRadius(anchor.radiusM).setStyle({ color, fillColor: color })
    }
    const latlngs = anchor.driftTrack.map((p) => [p.lat, p.lon] as L.LatLngTuple)
    if (!driftLineRef.current) {
      driftLineRef.current = L.polyline(latlngs, {
        color: '#52708A',
        weight: 2,
        opacity: 0.7,
        dashArray: '3 4',
      }).addTo(map)
    } else {
      driftLineRef.current.setLatLngs(latlngs)
    }
  }, [ready, anchor.anchor, anchor.radiusM, anchor.status, anchor.driftTrack])

  // --- Mess-Ergebnis (Wasser-Route) ------------------------------------------
  const measure = useMemo(() => {
    if (measurePts.length < 2) return null
    const [a, b] = measurePts
    const route = routeOnWater([a[0], a[1]], [b[0], b[1]])
    const km = route.distanceM / 1000
    const nm = km * KM_TO_NM
    const brg = bearingDeg(a[0], a[1], b[0], b[1])
    const curKn = geo.speedMs != null ? geo.speedMs * MS_TO_KN : 0
    const moving = curKn > 1
    const speedKn = moving ? curKn : 12
    const etaMin = speedKn > 0 ? (nm / speedKn) * 60 : 0
    return { route, km, nm, brg, speedKn, etaMin, moving }
  }, [measurePts, geo.speedMs])

  // Messlinie + Punkte zeichnen.
  useEffect(() => {
    const layer = measureLayerRef.current
    if (!ready || !layer) return
    layer.clearLayers()
    for (const p of measurePts) {
      L.circleMarker(p, { radius: 5, color: '#0C7C82', weight: 2, fillColor: '#fff', fillOpacity: 1 }).addTo(layer)
    }
    if (measure) {
      L.polyline(measure.route.path, {
        color: measure.route.onWater ? '#0C7C82' : '#D8352A',
        weight: 3,
        dashArray: measure.route.onWater ? undefined : '6 5',
      }).addTo(layer)
    }
  }, [ready, measurePts, measure])

  function toggle(key: CategoryKey) {
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function locate() {
    const map = mapRef.current
    if (!map) return
    setFollow(true)
    if (geo.lat != null && geo.lon != null) {
      map.setView([geo.lat, geo.lon], Math.max(map.getZoom(), 15), { animate: true })
    }
  }

  function startTrip() {
    trip.start()
    setFollow(true)
    locate()
  }

  function logTrip() {
    const t = trip.track
    if (t.length < 2) return
    const start = t[0]
    const end = t[t.length - 1]
    const { km, nm } = fmtDistance(trip.stats.distanceM)
    const dur = fmtDuration(trip.stats.durationMs)
    const notes =
      `GPS-Fahrt: ${km} km (${nm} sm) · ${dur} h · ` +
      `Ø ${trip.stats.avgKn.toFixed(1)} kn, max ${trip.stats.maxKn.toFixed(1)} kn`
    onLogTrip({
      harborFrom: nearestHarborName(start.lat, start.lon) ?? undefined,
      harborTo: nearestHarborName(end.lat, end.lon) ?? undefined,
      notes,
    })
  }

  function toggleMeasure() {
    const next = !measuring
    measuringRef.current = next // synchron, damit ein Tap direkt danach greift
    setShowRules(false)
    setShowAnchor(false)
    setMeasuring(next)
    if (next) setFollow(false)
    else setMeasurePts([])
  }
  function toggleRules() {
    measuringRef.current = false
    setMeasuring(false)
    setMeasurePts([])
    setShowAnchor(false)
    setShowRules((s) => !s)
  }
  function toggleAnchor() {
    measuringRef.current = false
    setMeasuring(false)
    setMeasurePts([])
    setShowRules(false)
    setShowAnchor((s) => !s)
  }
  function requestGeo() {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      () => undefined,
      () => setShowGeoHelp(true),
      { enableHighAccuracy: true },
    )
  }

  const speed = useMemo(() => speedReadout(geo.speedMs), [geo.speedMs])
  const mode: 'idle' | 'rec' | 'summary' = trip.recording
    ? 'rec'
    : trip.track.length > 1
      ? 'summary'
      : 'idle'

  // Conditions nahe der eigenen Position (sonst nördlicher Punkt = Locarno).
  const nearCond = useMemo(() => {
    if (!conditions?.length) return null
    if (geo.lat == null || geo.lon == null) return conditions[0]
    let best = conditions[0]
    let bd = Infinity
    for (const c of conditions) {
      const d = haversineM(geo.lat, geo.lon, c.lat, c.lon)
      if (d < bd) {
        bd = d
        best = c
      }
    }
    return best
  }, [conditions, geo.lat, geo.lon])

  const denied = permState === 'denied' || geo.error === 'Standort-Freigabe verweigert'

  return (
    <div className="relative h-full w-full">
      <div ref={elRef} className="absolute inset-0 z-0 bg-surface-2" />

      {/* Obere Leiste: Filter (links) + Wetter/Wind-Badge (rechts) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-start justify-between p-2">
        <div className="pointer-events-auto relative">
          <button
            onClick={() => setShowFilter((s) => !s)}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface/95 px-3 py-1.5 text-[12px] font-semibold text-ink-2 shadow-[var(--shadow)] backdrop-blur-sm"
          >
            <FilterIcon />
            Filter
            <span className="tabnum rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
              {active.size}
            </span>
          </button>
          {showFilter && (
            <div className="absolute left-0 top-11 w-[190px] rounded-2xl border border-line bg-surface/97 p-1.5 shadow-[var(--shadow)] backdrop-blur-sm">
              {ACTIVE_CATEGORIES.map((cat) => {
                const on = active.has(cat.key)
                return (
                  <button
                    key={cat.key}
                    onClick={() => toggle(cat.key)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium text-ink hover:bg-surface-2"
                  >
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-[5px] border text-[10px] text-white"
                      style={{ background: on ? cat.color : 'transparent', borderColor: on ? cat.color : 'var(--line)' }}
                    >
                      {on ? '✓' : ''}
                    </span>
                    <span>{cat.emoji}</span>
                    <span className={on ? '' : 'text-ink-3'}>{cat.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {nearCond && (
          <button
            onClick={() => setShowWeather(true)}
            title="Wetter & Wind – ganzer See + Prognose"
            className={`pointer-events-auto flex items-center gap-2 rounded-xl border bg-surface/95 px-2.5 py-1.5 shadow-[var(--shadow)] backdrop-blur-sm ${
              showWind ? 'border-accent' : 'border-line'
            }`}
          >
            <span className="text-[18px] leading-none">{weatherEmoji(nearCond.weatherCode)}</span>
            <div className="text-left leading-tight">
              <div className="tabnum font-mono text-[13px] font-bold text-ink">
                {nearCond.tempC}°<span className="ml-1 text-ink-2">{nearCond.windKn}kn</span>
              </div>
              <div className="text-[9px] text-ink-3">
                {nearCond.precipMm > 0 ? `🌧 ${nearCond.precipMm} mm` : `Böen ${nearCond.gustKn} kn`}
              </div>
            </div>
          </button>
        )}
      </div>

      {/* Wind-Feld-Legende (nur wenn eingeblendet) */}
      {showWind && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-[900] flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-surface/95 px-2.5 py-1 text-[10px] font-medium text-ink-2 shadow-[var(--shadow)] backdrop-blur-sm">
          <svg width="12" height="12" viewBox="0 0 24 24">
            <path d="M12 3 L12 21 M12 3 L8 9 M12 3 L16 9" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Wind: Pfeil = Richtung · Zahl = kn
        </div>
      )}

      {/* Fahrt-/Tacho-Panel (links, unter der oberen Leiste) */}
      <div className="absolute left-2 top-16 z-[900] w-[150px] rounded-2xl border border-line bg-surface/95 px-3 py-2.5 shadow-[var(--shadow)] backdrop-blur-sm">
        {mode === 'summary' ? (
          <TripSummary trip={trip} onLog={logTrip} onDiscard={trip.reset} />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-2">Tempo</span>
              {mode === 'rec' && (
                <span className="flex items-center gap-1 text-[9px] font-bold text-danger">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
                  REC
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="tabnum font-mono text-[28px] font-bold leading-none text-ink">{speed.kmh}</span>
              <span className="text-[11px] font-medium text-ink-2">km/h</span>
            </div>
            <div className="tabnum mt-0.5 font-mono text-[12px] leading-none text-teal">
              {speed.kn} <span className="font-sans text-[10px] font-medium text-ink-2">kn</span>
            </div>

            {mode === 'rec' && <RecStats trip={trip} />}

            {/* Standort-Status / -Hilfe */}
            {mode !== 'rec' && geo.lat == null && (
              denied ? (
                <button
                  onClick={() => setShowGeoHelp(true)}
                  className="mt-2 w-full rounded-lg border border-danger px-2 py-1.5 text-[10px] font-semibold text-danger"
                >
                  ⚠ Standort blockiert – freigeben
                </button>
              ) : (
                <button
                  onClick={requestGeo}
                  className="mt-2 w-full rounded-lg bg-accent px-2 py-1.5 text-[10px] font-semibold text-white"
                >
                  📍 Standort aktivieren
                </button>
              )
            )}

            {mode === 'idle' ? (
              <button
                onClick={startTrip}
                disabled={!geo.supported}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-2 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                <span className="h-2 w-2 rounded-full bg-white" /> Fahrt aufzeichnen
              </button>
            ) : (
              <button
                onClick={trip.stop}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-danger px-2 py-1.5 text-[11px] font-semibold text-white"
              >
                <span className="h-2 w-2 rounded-[2px] bg-white" /> Stopp
              </button>
            )}
          </>
        )}
      </div>

      {/* Werkzeuge (unten links) */}
      <div className="absolute bottom-9 left-3 z-[1000] flex flex-col gap-2">
        <ToolButton label="Ankerwache" active={anchor.watching} onClick={toggleAnchor}>
          <span className="text-[18px] leading-none">⚓</span>
        </ToolButton>
        <ToolButton label="Messen" active={measuring} onClick={toggleMeasure}>
          <RulerIcon />
        </ToolButton>
        <ToolButton label="See-Regeln" active={showRules} onClick={toggleRules}>
          <span className="text-[18px] leading-none">⚠</span>
        </ToolButton>
      </div>

      {measuring && (
        <BottomPanel onClose={toggleMeasure} title="Messen (auf dem Wasser)">
          {measure ? (
            <div className="space-y-1">
              <Row
                label="Distanz"
                value={`${measure.km.toFixed(2)} km`}
                sub={`${measure.nm.toFixed(2)} sm`}
              />
              <Row label="Kurs" value={`${Math.round(measure.brg)}° ${cardinal8(measure.brg)}`} />
              <Row
                label="ETA"
                value={`~${Math.round(measure.etaMin)} min`}
                sub={`@ ${measure.speedKn.toFixed(0)} kn${measure.moving ? '' : ' (Plan)'}`}
              />
              {!measure.route.onWater && (
                <p className="pt-1 text-[10px] leading-snug text-danger">
                  Kein Wasserweg gefunden – Luftlinie angezeigt.
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px] leading-snug text-ink-2">
              Zwei Punkte antippen – der Weg folgt dem Wasser, Distanz/Kurs/ETA erscheinen hier.
            </p>
          )}
        </BottomPanel>
      )}
      {showRules && (
        <BottomPanel onClose={toggleRules} title="See-Regeln (ohne Gewähr)">
          <ul className="space-y-1">
            {LAKE_RULES.map((r) => (
              <li key={r} className="flex gap-1.5 text-[11px] leading-snug text-ink-2">
                <span className="text-ink-3">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </BottomPanel>
      )}
      {showAnchor && (
        <BottomPanel onClose={() => setShowAnchor(false)} title="Ankerwache">
          <AnchorPanel anchor={anchor} geoLat={geo.lat} geoLon={geo.lon} denied={denied} />
        </BottomPanel>
      )}

      <button
        onClick={locate}
        aria-label="Auf meine Position zentrieren"
        className={`absolute bottom-9 right-3 z-[1000] flex h-12 w-12 items-center justify-center rounded-full border shadow-[var(--shadow)] ${
          follow ? 'border-transparent bg-accent text-white' : 'border-line bg-surface text-accent'
        }`}
      >
        <LocateIcon />
      </button>

      {showGeoHelp && (
        <Modal title="Standort freigeben" onClose={() => setShowGeoHelp(false)}>
          <GeoHelp denied={denied} onRetry={requestGeo} onClose={() => setShowGeoHelp(false)} />
        </Modal>
      )}

      {showWeather && (
        <Modal title="Wetter & Wind · Lago Maggiore" onClose={() => setShowWeather(false)}>
          <WeatherReport
            conditions={conditions}
            windOn={showWind}
            onToggleWind={() => setShowWind((s) => !s)}
          />
        </Modal>
      )}

      {anchor.alarm && (
        <div className="anchor-alarm-overlay fixed inset-0 z-[1300] flex flex-col items-center justify-center gap-4 bg-danger px-6 text-center text-white">
          <div className="text-[64px] leading-none">⚓</div>
          <div className="text-3xl font-bold" style={{ fontFamily: COND }}>
            ANKER-ALARM
          </div>
          <div className="tabnum font-mono text-lg">
            Abstand {Math.round(anchor.distanceM ?? 0)} m · Radius {anchor.radiusM} m
          </div>
          <p className="max-w-[280px] text-[13px] leading-snug text-white/90">
            Das Boot hat den Ankerradius verlassen. Position prüfen!
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={anchor.acknowledge}
              className="min-h-12 rounded-xl bg-white px-5 py-3 text-[14px] font-bold text-danger"
            >
              Alarm quittieren
            </button>
            <button
              onClick={anchor.lift}
              className="min-h-12 rounded-xl border-2 border-white px-5 py-3 text-[14px] font-bold text-white"
            >
              Anker lichten
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ----------------------------- Teil-Komponenten ----------------------------- */

function GeoHelp({ denied, onRetry, onClose }: { denied: boolean; onRetry: () => void; onClose: () => void }) {
  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      // iOS-Safari-PWA
      (navigator as unknown as { standalone?: boolean }).standalone === true)
  return (
    <div className="text-[13px] leading-relaxed text-ink-2">
      {denied ? (
        <>
          <p className="mb-2 text-ink">
            Der Standort ist <strong>blockiert</strong>. Das Web kann ihn nicht selbst wieder
            freischalten – du musst es einmal in den Einstellungen erlauben:
          </p>
          {standalone ? (
            <>
              <p className="mb-2 text-ink-2">
                Die installierte App nutzt <strong>Chrome</strong> im Hintergrund. Der Standort
                steckt darum in den <strong>Chrome-Website-Einstellungen</strong>, NICHT in den
                App-Berechtigungen (dort steht nur „Benachrichtigungen").
              </p>
              <p className="mb-1 font-semibold text-ink">Android · installierte App</p>
              <ol className="mb-3 list-decimal space-y-0.5 pl-5">
                <li><strong>Chrome</strong> öffnen (den Browser).</li>
                <li>⋮ Menü → <strong>Einstellungen</strong> → <strong>Website-Einstellungen</strong> → <strong>Standort</strong>.</li>
                <li>
                  Eintrag <strong className="break-all">{typeof location !== 'undefined' ? location.host : 'github.io'}</strong> suchen
                  (ggf. unter „Blockiert") → antippen → <strong>Zulassen</strong>.
                </li>
                <li>Bordbuch-App schliessen und neu öffnen.</li>
              </ol>
              <p className="mb-3 text-ink-3">
                Schneller Alternativweg: die Seite in <strong>Chrome</strong> öffnen, dann beim
                Standort-Symbol in der Adresszeile freigeben.
              </p>
            </>
          ) : (
            <>
              <p className="mb-1 font-semibold text-ink">Android · Chrome</p>
              <ol className="mb-3 list-decimal space-y-0.5 pl-5">
                <li>Auf das <strong>Schloss-/Regler-Symbol</strong> links in der Adresszeile tippen.</li>
                <li><strong>Berechtigungen</strong> → <strong>Standort</strong> → <strong>Zulassen</strong>.</li>
                <li>(Fehlt es dort: Chrome-Menü ⋮ → <strong>Einstellungen → Website-Einstellungen → Standort</strong>.)</li>
                <li>Seite neu laden.</li>
              </ol>
              <p className="mb-1 font-semibold text-ink">iPhone · Safari</p>
              <ol className="mb-3 list-decimal space-y-0.5 pl-5">
                <li>iOS-<strong>Einstellungen → Safari → Standort</strong> → „Fragen"/„Erlauben".</li>
                <li>Zusätzlich: <strong>Datenschutz → Ortungsdienste</strong> für Safari aktivieren.</li>
              </ol>
            </>
          )}
          <p className="mb-3 text-ink-3">
            Wichtig: Android-<strong>Ortung/GPS</strong> muss generell eingeschaltet sein.
          </p>
          <button
            onClick={() => location.reload()}
            className="min-h-11 w-full rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-white"
          >
            Seite neu laden
          </button>
        </>
      ) : (
        <>
          <p className="mb-3 text-ink">
            Tippe auf „Standort erlauben", wenn der Browser fragt. Danach erscheinen Position und Tempo.
          </p>
          <button
            onClick={() => {
              onRetry()
              onClose()
            }}
            className="min-h-11 w-full rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-white"
          >
            Standort aktivieren
          </button>
        </>
      )}
    </div>
  )
}

function AnchorPanel({
  anchor,
  geoLat,
  geoLon,
  denied,
}: {
  anchor: ReturnType<typeof useAnchorWatch>
  geoLat: number | null
  geoLon: number | null
  denied: boolean
}) {
  const hasGps = geoLat != null && geoLon != null
  const statusLabel =
    anchor.status === 'breach'
      ? 'AUSSERHALB'
      : anchor.status === 'warn'
        ? 'nahe Grenze'
        : 'in Position'
  const statusColor =
    anchor.status === 'breach' ? 'text-danger' : anchor.status === 'warn' ? 'text-[#E8930C]' : 'text-good'

  return (
    <div className="space-y-2">
      {anchor.watching ? (
        <>
          <div className="flex items-baseline justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-3">Status</span>
            <span className={`text-[11px] font-bold ${statusColor}`}>● {statusLabel}</span>
          </div>
          <Row label="Abstand" value={`${Math.round(anchor.distanceM ?? 0)} m`} sub={`max ${Math.round(anchor.maxDistanceM)} m`} />
        </>
      ) : (
        <p className="text-[11px] leading-snug text-ink-2">
          Anker an der aktuellen Position setzen. Die Wache alarmiert, sobald das Boot den Radius verlässt.
        </p>
      )}

      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-3">Radius</span>
          <span className="tabnum font-mono text-[12px] font-bold text-ink">{anchor.radiusM} m</span>
        </div>
        <input
          type="range"
          min={MIN_RADIUS_M}
          max={MAX_RADIUS_M}
          step={5}
          value={anchor.radiusM}
          onChange={(e) => anchor.setRadius(Number(e.target.value))}
          className="mt-1 w-full accent-[var(--accent)]"
          aria-label="Ankerradius"
        />
      </div>

      {anchor.watching ? (
        <>
          {anchor.alarm && (
            <button
              onClick={anchor.acknowledge}
              className="w-full rounded-lg bg-danger px-2 py-1.5 text-[11px] font-semibold text-white"
            >
              🔕 Alarm quittieren
            </button>
          )}
          <button
            onClick={anchor.lift}
            className="w-full rounded-lg border border-line px-2 py-1.5 text-[11px] font-semibold text-ink-2"
          >
            Anker lichten
          </button>
        </>
      ) : hasGps ? (
        <button
          onClick={() => anchor.drop(geoLat!, geoLon!)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-2 py-1.5 text-[11px] font-semibold text-white"
        >
          ⚓ Anker hier setzen
        </button>
      ) : (
        <p className="text-[10px] font-semibold text-danger">
          {denied ? '⚠ Standort blockiert – im Tacho-Panel freigeben.' : 'Warte auf GPS-Position…'}
        </p>
      )}

      <p className="text-[9px] leading-snug text-ink-3">
        Bildschirm bleibt an (Akku!) – Gerät am besten ans Ladegerät. Ohne Gewähr.
      </p>
    </div>
  )
}

function RecStats({ trip }: { trip: ReturnType<typeof useTripRecorder> }) {
  const { km, nm } = fmtDistance(trip.stats.distanceM)
  return (
    <div className="mt-2 space-y-1 border-t border-line pt-2">
      <Row label="Strecke" value={`${km} km`} sub={`${nm} sm`} />
      <Row label="Dauer" value={fmtDuration(trip.stats.durationMs)} />
    </div>
  )
}

function TripSummary({
  trip,
  onLog,
  onDiscard,
}: {
  trip: ReturnType<typeof useTripRecorder>
  onLog: () => void
  onDiscard: () => void
}) {
  const { km, nm } = fmtDistance(trip.stats.distanceM)
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-2">Fahrt beendet</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="tabnum font-mono text-[24px] font-bold leading-none text-ink">{km}</span>
        <span className="text-[11px] font-medium text-ink-2">km</span>
        <span className="tabnum ml-1 font-mono text-[12px] text-teal">{nm} sm</span>
      </div>
      <div className="mt-1.5 space-y-1">
        <Row label="Dauer" value={fmtDuration(trip.stats.durationMs)} />
        <Row label="Ø / max" value={`${trip.stats.avgKn.toFixed(1)} / ${trip.stats.maxKn.toFixed(1)} kn`} />
      </div>
      <button onClick={onLog} className="mt-2 w-full rounded-lg bg-accent px-2 py-1.5 text-[11px] font-semibold text-white">
        ⛵ Ins Logbuch
      </button>
      <button onClick={onDiscard} className="mt-1 w-full rounded-lg border border-line px-2 py-1 text-[10px] font-semibold text-ink-2">
        Verwerfen
      </button>
    </div>
  )
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-3">{label}</span>
      <span className="tabnum font-mono text-[12px] font-bold leading-none text-ink">
        {value}
        {sub && <span className="ml-1 font-sans text-[9px] font-medium text-ink-3">{sub}</span>}
      </span>
    </div>
  )
}

function popupHtml(poi: Poi, cat: Category): string {
  const parts = [`<strong>${esc(poi.name)}</strong>`]
  if (poi.detail) parts.push(`<span class="poi-popup-sub">${esc(poi.detail)}</span>`)
  parts.push(`<span class="poi-popup-cat">${cat.emoji} ${cat.label}</span>`)
  const links: string[] = []
  if (poi.website)
    links.push(`<a href="${esc(poi.website)}" target="_blank" rel="noopener noreferrer">🌐 Website</a>`)
  if (poi.phone) links.push(`<a href="tel:${esc(poi.phone.replace(/\s+/g, ''))}">☎ ${esc(poi.phone)}</a>`)
  if (links.length) parts.push(`<span class="poi-popup-links">${links.join(' · ')}</span>`)
  return `<div class="poi-popup">${parts.join('<br>')}</div>`
}

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-[var(--shadow)] ${
        active ? 'border-transparent bg-teal text-white' : 'border-line bg-surface text-ink-2'
      }`}
    >
      {children}
    </button>
  )
}

function BottomPanel({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="absolute bottom-9 left-1/2 z-[1000] w-[230px] -translate-x-1/2 rounded-2xl border border-line bg-surface/95 px-3.5 py-2.5 shadow-[var(--shadow)] backdrop-blur-sm">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-2">{title}</span>
        <button onClick={onClose} aria-label="Schliessen" className="-mr-1 px-1 text-[13px] text-ink-3">
          ✕
        </button>
      </div>
      {children}
    </div>
  )
}

function FilterIcon() {
  return (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M3 5h18l-7 8v6l-4-2v-4z" />
    </svg>
  )
}

function RulerIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="2" y="8" width="20" height="8" rx="1.5" />
      <path d="M6 8v3M10 8v4M14 8v3M18 8v4" />
    </svg>
  )
}

function LocateIcon() {
  return (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
