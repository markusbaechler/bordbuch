// src/screens/MapScreen.tsx
// Interaktive Seekarte für den Lago Maggiore (Locarno/Ascona):
//  - OSM-Basiskacheln + halbtransparentes OpenSeaMap-Seezeichen-Overlay
//  - kuratierte, boots-relevante POIs (Häfen, Ausflugsziele, Bäder)
//  - GPS-Position + Tacho (km/h und Knoten)
//  - Fahrtaufzeichnung: Track, Live-Strecke/Dauer/Tempo, „ins Logbuch übernehmen"
//  - Mess-/Planungstool (2 Punkte → Distanz/Kurs/ETA)
//  - Wind-Lage (Open-Meteo) als Pfeil-Badge
//  - See-Regeln/Zonen (Naturschutz Bolle di Magadino) + Regel-Legende
// Leaflet ist eine bewusste Ausnahme von „keine neuen Deps".

import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useGeoPosition, speedReadout } from '../hooks/useGeoPosition'
import { useTripRecorder, fmtDistance, fmtDuration } from '../hooks/useTripRecorder'
import { haversineM, bearingDeg, cardinal8, KM_TO_NM, MS_TO_KN } from '../lib/geo'
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
import { fetchWind, type WindNow } from '../lib/liveData'
import type { EntryDraft } from './FormScreen'

// Karten-Startansicht: Überblick über den nördlichen Lago Maggiore.
const CENTER: L.LatLngTuple = [46.13, 8.78]
const START_ZOOM = 12

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

// DivIcons je Kategorie nur einmal bauen (Leaflet teilt sie über alle Marker).
const iconCache = new Map<CategoryKey, L.DivIcon>()
function iconFor(cat: Category): L.DivIcon {
  let icon = iconCache.get(cat.key)
  if (!icon) {
    icon = L.divIcon({
      className: '', // ohne Leaflet-Default-Weißkasten
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

export function MapScreen({ onLogTrip }: { onLogTrip: (draft: EntryDraft) => void }) {
  const elRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const poiLayerRef = useRef<L.LayerGroup | null>(null)
  const meMarkerRef = useRef<L.Marker | null>(null)
  const meCircleRef = useRef<L.Circle | null>(null)
  const trackLineRef = useRef<L.Polyline | null>(null)
  const measureLayerRef = useRef<L.LayerGroup | null>(null)
  const measuringRef = useRef(false) // für den einmal gebundenen Map-Click-Handler
  const [ready, setReady] = useState(false)
  const [follow, setFollow] = useState(false)

  // Mess-/Planungstool (Phase 2)
  const [measuring, setMeasuring] = useState(false)
  const [measurePts, setMeasurePts] = useState<L.LatLngTuple[]>([])
  // See-Regeln-Legende (Phase 4)
  const [showRules, setShowRules] = useState(false)
  // Wind-Lage (Phase 3)
  const [wind, setWind] = useState<WindNow | null>(null)

  const geo = useGeoPosition()
  const fix = useMemo(
    () => ({ lat: geo.lat, lon: geo.lon, speedMs: geo.speedMs, timestamp: geo.timestamp }),
    [geo.lat, geo.lon, geo.speedMs, geo.timestamp],
  )
  const trip = useTripRecorder(fix)

  // Aktive POI-Kategorien (anfangs alle vorhandenen).
  const [active, setActive] = useState<Set<CategoryKey>>(
    () => new Set(ACTIVE_CATEGORIES.map((c) => c.key)),
  )

  // --- Karte initialisieren (einmalig; StrictMode-fest über Cleanup) ---------
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

    // See-Regeln/Zonen (Naturschutz): immer sichtbar, da sicherheitsrelevant.
    for (const zone of ZONES) {
      L.polygon(zone.polygon, {
        color: '#D8352A',
        weight: 1.5,
        dashArray: '5 4',
        fillColor: '#D8352A',
        fillOpacity: 0.14,
      })
        .bindPopup(`<div class="poi-popup"><strong>⚠ ${zone.name}</strong><br><span class="poi-popup-sub">${zone.note}</span></div>`)
        .addTo(map)
    }

    // Leere Layer-Gruppen für POIs und Messwerkzeug; Befüllung in Effekten unten.
    poiLayerRef.current = L.layerGroup().addTo(map)
    measureLayerRef.current = L.layerGroup().addTo(map)

    // Mess-Tool: im Mess-Modus setzen Karten-Taps die zwei Messpunkte.
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!measuringRef.current) return
      const ll: L.LatLngTuple = [e.latlng.lat, e.latlng.lng]
      setMeasurePts((prev) => (prev.length >= 2 ? [ll] : [...prev, ll]))
    })

    map.on('dragstart', () => setFollow(false))

    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(elRef.current)
    requestAnimationFrame(() => map.invalidateSize())

    setReady(true)
    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      poiLayerRef.current = null
      measureLayerRef.current = null
      meMarkerRef.current = null
      meCircleRef.current = null
      trackLineRef.current = null
      setReady(false)
    }
  }, [])

  // Mess-Modus für den (einmal gebundenen) Map-Click-Handler spiegeln.
  useEffect(() => {
    measuringRef.current = measuring
  }, [measuring])

  // Wind-Lage einmalig laden (Open-Meteo, scheitert still).
  useEffect(() => {
    let alive = true
    fetchWind()
      .then((w) => alive && setWind(w))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  // --- Messpunkte/-linie zeichnen --------------------------------------------
  useEffect(() => {
    const layer = measureLayerRef.current
    if (!ready || !layer) return
    layer.clearLayers()
    for (const p of measurePts) {
      L.circleMarker(p, {
        radius: 5,
        color: '#0C7C82',
        weight: 2,
        fillColor: '#ffffff',
        fillOpacity: 1,
      }).addTo(layer)
    }
    if (measurePts.length === 2) {
      L.polyline(measurePts, { color: '#0C7C82', weight: 3, dashArray: '6 5' }).addTo(layer)
    }
  }, [ready, measurePts])

  // --- POI-Marker je nach aktiver Kategorie rendern --------------------------
  useEffect(() => {
    const map = mapRef.current
    const layer = poiLayerRef.current
    if (!ready || !map || !layer) return
    layer.clearLayers()
    for (const poi of CURATED_POIS) {
      if (!active.has(poi.category)) continue
      const cat = CATEGORY_BY_KEY[poi.category]
      L.marker([poi.lat, poi.lon], { icon: iconFor(cat), title: poi.name })
        .bindPopup(popupHtml(poi, cat))
        .addTo(layer)
    }
  }, [ready, active])

  // --- GPS-Marker + Genauigkeitskreis ----------------------------------------
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

  // --- Track-Linie an den aufgezeichneten Punkten ----------------------------
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const latlngs = trip.track.map((p) => [p.lat, p.lon] as L.LatLngTuple)
    if (!trackLineRef.current) {
      trackLineRef.current = L.polyline(latlngs, {
        color: '#1C5C8C',
        weight: 4,
        opacity: 0.85,
      }).addTo(map)
    } else {
      trackLineRef.current.setLatLngs(latlngs)
    }
  }, [ready, trip.track])

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

  // Mess-/Planungs-Ergebnis (Distanz, Kurs, ETA beim aktuellen bzw. Planungstempo).
  const measure = useMemo(() => {
    if (measurePts.length < 2) return null
    const [a, b] = measurePts
    const m = haversineM(a[0], a[1], b[0], b[1])
    const nm = (m / 1000) * KM_TO_NM
    const brg = bearingDeg(a[0], a[1], b[0], b[1])
    const curKn = geo.speedMs != null ? geo.speedMs * MS_TO_KN : 0
    const moving = curKn > 1
    const speedKn = moving ? curKn : 12 // Planungstempo, wenn gerade nicht in Fahrt
    const etaMin = speedKn > 0 ? (nm / speedKn) * 60 : 0
    return { km: m / 1000, nm, brg, speedKn, etaMin, moving }
  }, [measurePts, geo.speedMs])

  function toggleMeasure() {
    setShowRules(false)
    setMeasuring((on) => {
      const next = !on
      if (next) setFollow(false)
      else setMeasurePts([])
      return next
    })
  }

  function toggleRules() {
    setMeasuring(false)
    setMeasurePts([])
    setShowRules((s) => !s)
  }

  const speed = useMemo(() => speedReadout(geo.speedMs), [geo.speedMs])
  const mode: 'idle' | 'rec' | 'summary' = trip.recording
    ? 'rec'
    : trip.track.length > 1
      ? 'summary'
      : 'idle'

  return (
    <div className="relative h-full w-full">
      <div ref={elRef} className="absolute inset-0 z-0 bg-surface-2" />

      {/* Kategorie-Filter (oben, horizontal scrollbar) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-2">
        <div className="pointer-events-auto flex gap-1.5 overflow-x-auto pb-1">
          {ACTIVE_CATEGORIES.map((cat) => {
            const on = active.has(cat.key)
            return (
              <button
                key={cat.key}
                onClick={() => toggle(cat.key)}
                aria-pressed={on}
                className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold shadow-[var(--shadow)] ${
                  on ? 'border-transparent text-white' : 'border-line bg-surface text-ink-3'
                }`}
                style={on ? { background: cat.color } : undefined}
              >
                <span aria-hidden>{cat.emoji}</span>
                {cat.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Wind-Lage (oben rechts) – Pfeil zeigt, wohin der Wind weht */}
      {wind && (
        <div
          className="absolute right-2 top-14 z-[1000] flex items-center gap-2 rounded-xl border border-line bg-surface/95 px-2.5 py-1.5 shadow-[var(--shadow)] backdrop-blur-sm"
          title={`Wind aus ${wind.cardinal} · ${wind.windKn} kn · Böen ${wind.gustKn} kn`}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            className="shrink-0"
            aria-hidden
            style={{ transform: `rotate(${wind.directionDeg + 180}deg)` }}
          >
            <path
              d="M12 3 L12 21 M12 3 L8 9 M12 3 L16 9"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="leading-tight">
            <div className="tabnum font-mono text-[13px] font-bold text-ink">
              {wind.cardinal} {wind.windKn}
              <span className="ml-0.5 font-sans text-[9px] font-medium text-ink-2">kn</span>
            </div>
            <div className="text-[9px] text-ink-3">Böen {wind.gustKn} kn</div>
          </div>
        </div>
      )}

      {/* Fahrt-/Tacho-Panel (oben links) */}
      <div className="absolute left-2 top-14 z-[1000] w-[150px] rounded-2xl border border-line bg-surface/95 px-3 py-2.5 shadow-[var(--shadow)] backdrop-blur-sm">
        {mode === 'summary' ? (
          <TripSummary trip={trip} onLog={logTrip} onDiscard={trip.reset} />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-2">
                Tempo
              </span>
              {mode === 'rec' && (
                <span className="flex items-center gap-1 text-[9px] font-bold text-danger">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
                  REC
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="tabnum font-mono text-[28px] font-bold leading-none text-ink">
                {speed.kmh}
              </span>
              <span className="text-[11px] font-medium text-ink-2">km/h</span>
            </div>
            <div className="tabnum mt-0.5 font-mono text-[12px] leading-none text-teal">
              {speed.kn} <span className="font-sans text-[10px] font-medium text-ink-2">kn</span>
            </div>

            {mode === 'rec' && <RecStats trip={trip} />}

            {mode === 'idle' && geo.error ? (
              <div className="mt-1.5 text-[9px] leading-tight text-danger">{geo.error}</div>
            ) : null}

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

      {/* Werkzeug-Leiste (unten links): Messen + Regeln */}
      <div className="absolute bottom-9 left-3 z-[1000] flex flex-col gap-2">
        <ToolButton label="Messen" active={measuring} onClick={toggleMeasure}>
          <RulerIcon />
        </ToolButton>
        <ToolButton label="See-Regeln" active={showRules} onClick={toggleRules}>
          <span className="text-[18px] leading-none">⚠</span>
        </ToolButton>
      </div>

      {/* Mess-/Regel-Panel (unten, zentriert) */}
      {measuring && (
        <BottomPanel onClose={toggleMeasure} title="Messen">
          {measure ? (
            <div className="space-y-1">
              <Row label="Distanz" value={`${measure.km.toFixed(2)} km`} sub={`${measure.nm.toFixed(2)} sm`} />
              <Row label="Kurs" value={`${Math.round(measure.brg)}° ${cardinal8(measure.brg)}`} />
              <Row
                label="ETA"
                value={`~${Math.round(measure.etaMin)} min`}
                sub={`@ ${measure.speedKn.toFixed(0)} kn${measure.moving ? '' : ' (Plan)'}`}
              />
            </div>
          ) : (
            <p className="text-[11px] leading-snug text-ink-2">
              Zwei Punkte auf der Karte antippen – Distanz, Kurs und ETA erscheinen hier.
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

      {/* Mich-zentrieren-Button (unten rechts, über der Attribution) */}
      <button
        onClick={locate}
        aria-label="Auf meine Position zentrieren"
        className={`absolute bottom-9 right-3 z-[1000] flex h-12 w-12 items-center justify-center rounded-full border shadow-[var(--shadow)] ${
          follow ? 'border-transparent bg-accent text-white' : 'border-line bg-surface text-accent'
        }`}
      >
        <LocateIcon />
      </button>
    </div>
  )
}

/* ----------------------------- Teil-Komponenten ----------------------------- */

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
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-2">
        Fahrt beendet
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="tabnum font-mono text-[24px] font-bold leading-none text-ink">{km}</span>
        <span className="text-[11px] font-medium text-ink-2">km</span>
        <span className="tabnum ml-1 font-mono text-[12px] text-teal">{nm} sm</span>
      </div>
      <div className="mt-1.5 space-y-1">
        <Row label="Dauer" value={fmtDuration(trip.stats.durationMs)} />
        <Row label="Ø / max" value={`${trip.stats.avgKn.toFixed(1)} / ${trip.stats.maxKn.toFixed(1)} kn`} />
      </div>
      <button
        onClick={onLog}
        className="mt-2 w-full rounded-lg bg-accent px-2 py-1.5 text-[11px] font-semibold text-white"
      >
        ⛵ Ins Logbuch
      </button>
      <button
        onClick={onDiscard}
        className="mt-1 w-full rounded-lg border border-line px-2 py-1 text-[10px] font-semibold text-ink-2"
      >
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
    links.push(
      `<a href="${esc(poi.website)}" target="_blank" rel="noopener noreferrer">🌐 Website</a>`,
    )
  if (poi.phone)
    links.push(`<a href="tel:${esc(poi.phone.replace(/\s+/g, ''))}">☎ ${esc(poi.phone)}</a>`)
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
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-2">
          {title}
        </span>
        <button onClick={onClose} aria-label="Schliessen" className="-mr-1 px-1 text-[13px] text-ink-3">
          ✕
        </button>
      </div>
      {children}
    </div>
  )
}

function RulerIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="2" y="8" width="20" height="8" rx="1.5" transform="rotate(0 12 12)" />
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
